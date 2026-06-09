import sys
import json
import re
from youtube_transcript_api import YouTubeTranscriptApi

# Force standard output and error to use UTF-8 encoding (prevents charmap CP1252 crash on Windows!)
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def extract_video_id(url_or_id):

    if not url_or_id:
        return None
        
    url_or_id = url_or_id.strip()
    
    # If it is already a direct 11-char ID
    if len(url_or_id) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
        
    # Standard patterns including live, shorts, watch, embed, v, youtu.be
    patterns = [
        r'v=([a-zA-Z0-9_-]{11})',
        r'embed\/([a-zA-Z0-9_-]{11})',
        r'shorts\/([a-zA-Z0-9_-]{11})',
        r'live\/([a-zA-Z0-9_-]{11})',
        r'v\/([a-zA-Z0-9_-]{11})',
        r'youtu\.be\/([a-zA-Z0-9_-]{11})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
            
    # Last resort fallback: check if any slash-separated path segment is 11-char ID
    parts = url_or_id.split('/')
    for part in parts:
        clean_part = part.split('?')[0].split('&')[0]
        if len(clean_part) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', clean_part):
            return clean_part
            
    return None


def get_transcript(video_id):
    try:
        api = YouTubeTranscriptApi()
        
        # Try fetching German or English transcripts first
        try:
            transcript = api.fetch(video_id, languages=['de', 'en'])
            return [{"text": segment.text, "start": segment.start, "duration": segment.duration} for segment in transcript]
        except Exception:
            pass

        # Try to list transcripts and find German, English or anything else
        transcript_list = api.list(video_id)
        
        # Try to find German or English
        try:
            transcript = transcript_list.find_transcript(['de', 'en']).fetch()
            return [{"text": segment.text, "start": segment.start, "duration": segment.duration} for segment in transcript]
        except Exception:
            pass
            
        # Try to find any manual transcript
        try:
            for t in transcript_list:
                if not t.is_generated:
                    fetched = t.fetch()
                    return [{"text": segment.text, "start": segment.start, "duration": segment.duration} for segment in fetched]
        except Exception:
            pass

        # Fallback to the first available transcript in the list (including auto-generated)
        for t in transcript_list:
            fetched = t.fetch()
            return [{"text": segment.text, "start": segment.start, "duration": segment.duration} for segment in fetched]
            
        raise Exception("No transcripts found for this video.")

    except Exception as e:
        raise Exception(f"Failed to fetch transcript: {str(e)}")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No YouTube URL or Video ID provided."}))
        sys.exit(1)
        
    input_str = sys.argv[1]
    video_id = extract_video_id(input_str)
    
    if not video_id:
        print(json.dumps({"error": f"Could not extract YouTube Video ID from: {input_str}"}))
        sys.exit(1)
        
    try:
        transcript_data = get_transcript(video_id)
        
        # Combine segments into a clean structure and raw text
        full_text = " ".join([segment['text'] for segment in transcript_data])
        
        result = {
            "success": True,
            "videoId": video_id,
            "text": full_text,
            "segments": transcript_data
        }
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
