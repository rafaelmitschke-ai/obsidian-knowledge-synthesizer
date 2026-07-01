import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import PDFDocument from 'pdfkit';
import { fetch as undiciFetch, Agent } from 'undici';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get local IPv4 address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}


const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to sanitize filenames for OS compatibility
function sanitizeFilename(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '-') // Replace invalid characters with hyphens
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim();
}

// 1. YouTube Transcript Fetching Endpoint
app.post('/api/transcript', (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'YouTube URL or Video ID is required.' });
  }

  // Spawn Python process to run get_transcript.py
  // Note: we use 'python' as we confirmed Python 3.14 is available
  const pythonProcess = spawn('python', [
    path.join(__dirname, 'get_transcript.py'),
    url
  ]);

  let stdoutData = '';
  let stderrData = '';

  pythonProcess.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}. Stderr: ${stderrData}`);
      
      // Try parsing clean JSON error from stdout first
      try {
        const parsedData = JSON.parse(stdoutData.trim());
        if (parsedData && parsedData.error) {
          return res.status(400).json({ error: parsedData.error });
        }
      } catch (e) {
        // Ignore parsing errors and fall back to standard error
      }

      return res.status(500).json({ 
        error: `Failed to fetch transcript. Python exited with code ${code}.`,
        details: stderrData || 'Unknown error'
      });
    }

    try {
      const parsedData = JSON.parse(stdoutData.trim());
      if (parsedData.error) {
        return res.status(400).json({ error: parsedData.error });
      }
      return res.json(parsedData);
    } catch (parseError) {
      console.error('Failed to parse Python script output:', stdoutData);
      return res.status(500).json({ 
        error: 'Failed to parse transcript output from internal helper.',
        details: stdoutData
      });
    }
  });
});

function renderPdfDocument(doc, title, markdown) {
  // --- Custom Styling Palette ---
  const primaryColor = '#6366f1'; // Indigo
  const secondaryColor = '#4f46e5'; // Darker Indigo
  const textColor = '#1e293b'; // Slate 800
  const mutedColor = '#64748b'; // Slate 500
  
  // Title Header
  doc.fillColor(primaryColor)
     .font('Helvetica-Bold')
     .fontSize(24)
     .text(title, { align: 'left' });
     
  doc.moveDown(0.5);
  
  // Horizontal Rule
  doc.moveTo(50, doc.y)
     .lineTo(doc.page.width - 50, doc.y)
     .strokeColor('#e2e8f0')
     .lineWidth(1)
     .stroke();
     
  doc.moveDown(1);

  // Parse and render lines
  const lines = markdown.split('\n');
  let inCallout = false;
  let calloutText = [];
  let calloutType = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Handle Callouts (e.g. > [!summary] Summary text)
    if (line.startsWith('>')) {
      const content = line.substring(1).trim();
      if (content.startsWith('[!')) {
        inCallout = true;
        calloutType = content.match(/\[!([^\]]+)\]/)?.[1] || 'note';
        // Start collecting callout content
        const rest = content.replace(/\[![^\]]+\]/i, '').trim();
        if (rest) calloutText.push(rest);
      } else if (inCallout) {
        calloutText.push(content);
      }
      continue;
    } else if (inCallout && !line.startsWith('>')) {
      // Render accumulated callout box!
      renderCalloutBox(doc, calloutType, calloutText.join(' '));
      inCallout = false;
      calloutText = [];
      doc.moveDown(0.8);
    }

    if (!line) {
      doc.moveDown(0.5);
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      doc.fillColor(primaryColor)
         .font('Helvetica-Bold')
         .fontSize(18)
         .text(line.replace('# ', ''), { paragraphGap: 10 });
    } else if (line.startsWith('## ')) {
      doc.fillColor(secondaryColor)
         .font('Helvetica-Bold')
         .fontSize(14)
         .text(line.replace('## ', ''), { paragraphGap: 8 });
    } else if (line.startsWith('### ')) {
      doc.fillColor(textColor)
         .font('Helvetica-Bold')
         .fontSize(12)
         .text(line.replace('### ', ''), { paragraphGap: 6 });
    }
    // Checklist/Bullet points
    else if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
      const completed = line.startsWith('- [x]');
      const text = line.substring(5).trim();
      
      doc.fillColor(textColor)
         .font('Helvetica')
         .fontSize(10);
         
      // Draw check box
      const currentY = doc.y;
      doc.rect(52, currentY + 2, 8, 8)
         .strokeColor(completed ? primaryColor : mutedColor)
         .lineWidth(1)
         .stroke();
         
      if (completed) {
        // Draw checkmark
        doc.moveTo(54, currentY + 6)
           .lineTo(56, currentY + 8)
           .lineTo(59, currentY + 3)
           .strokeColor(primaryColor)
           .stroke();
      }

      doc.text(text, 68, currentY, { paragraphGap: 4 });
    } else if (line.startsWith('- ')) {
      const text = line.substring(2).trim();
      doc.fillColor(textColor)
         .font('Helvetica')
         .fontSize(10);
         
      const currentY = doc.y;
      doc.circle(56, currentY + 6, 2)
         .fillColor(primaryColor)
         .fill();
         
      doc.text(text, 68, currentY, { paragraphGap: 4 });
    } 
    // Standard text
    else {
      // Check for YAML Frontmatter and ignore
      if (line === '---') {
        // Skip YAML blocks
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '---') {
          j++;
        }
        i = j;
        continue;
      }

      doc.fillColor(textColor)
         .font('Helvetica')
         .fontSize(10)
         .text(line, 50, doc.y, { paragraphGap: 6, lineGap: 2 });
    }
  }

  // If callout ends at EOF
  if (inCallout) {
    renderCalloutBox(doc, calloutType, calloutText.join(' '));
  }
}

function generatePdfFromMarkdown(title, markdown, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      renderPdfDocument(doc, title, markdown);

      doc.end();
      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}

function renderCalloutBox(doc, type, text) {
  // Styles based on type
  let title = 'HINWEIS';
  let borderCol = '#6366f1';
  let bgCol = '#f5f3ff';
  
  if (type.toLowerCase() === 'summary') {
    title = 'ZUSAMMENFASSUNG';
    borderCol = '#0d9488';
    bgCol = '#f0fdfa';
  } else if (type.toLowerCase() === 'key-takeaways') {
    title = 'WICHTIGSTE ERKENNTNISSE';
    borderCol = '#a855f7';
    bgCol = '#faf5ff';
  }

  const startY = doc.y;
  doc.save();
  
  // Estimate height of text to draw background rectangle
  const textWidth = doc.page.width - 120;
  const titleHeight = 15;
  const textHeight = doc.heightOfString(text, { width: textWidth });
  const totalBoxHeight = textHeight + titleHeight + 20;

  // Background rect
  doc.rect(50, startY, doc.page.width - 100, totalBoxHeight)
     .fillColor(bgCol)
     .fill();

  // Left thick border line
  doc.rect(50, startY, 4, totalBoxHeight)
     .fillColor(borderCol)
     .fill();

  // Callout Title
  doc.fillColor(borderCol)
     .font('Helvetica-Bold')
     .fontSize(9)
     .text(title, 64, startY + 8);

  // Callout Text
  doc.fillColor('#334155')
     .font('Helvetica')
     .fontSize(9.5)
     .text(text, 64, startY + 22, { width: textWidth, lineGap: 2 });

  doc.restore();
  
  // Set cursor past the callout box
  doc.y = startY + totalBoxHeight + 10;
}

// 2. Save Note directly to local Obsidian Vault
app.post('/api/save', async (req, res) => {
  const { vaultPath, folder, fileName, content, pdfPath } = req.body;

  if (!vaultPath || !fileName || !content) {
    return res.status(400).json({ error: 'vaultPath, fileName, and content are required.' });
  }

  try {
    // Standardize paths
    const resolvedVaultPath = path.resolve(vaultPath);
    
    // Check if Vault path exists
    if (!fs.existsSync(resolvedVaultPath)) {
      return res.status(400).json({ error: `The vault path does not exist: ${resolvedVaultPath}` });
    }

    // Build absolute target folder path
    const targetFolder = folder ? path.join(resolvedVaultPath, folder) : resolvedVaultPath;

    // Create target folder if it doesn't exist
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    // Sanitize filename and append markdown extension
    const cleanFileName = `${sanitizeFilename(fileName)}.md`;
    const fullFilePath = path.join(targetFolder, cleanFileName);

    // Save markdown file
    fs.writeFileSync(fullFilePath, content, 'utf8');

    // Generate and save PDF
    const cleanPdfFileName = `${sanitizeFilename(fileName)}.pdf`;
    let fullPdfFilePath = '';

    if (pdfPath && pdfPath.trim()) {
      const resolvedPdfPath = path.resolve(pdfPath.trim());
      if (!fs.existsSync(resolvedPdfPath)) {
        try {
          fs.mkdirSync(resolvedPdfPath, { recursive: true });
        } catch (e) {
          // ignore directory creation error and fallback below
        }
      }
      if (fs.existsSync(resolvedPdfPath)) {
        fullPdfFilePath = path.join(resolvedPdfPath, cleanPdfFileName);
      } else {
        fullPdfFilePath = path.join(targetFolder, cleanPdfFileName);
      }
    } else {
      fullPdfFilePath = path.join(targetFolder, cleanPdfFileName);
    }
    
    try {
      await generatePdfFromMarkdown(fileName, content, fullPdfFilePath);
      console.log(`Generated companion PDF at: ${fullPdfFilePath}`);
    } catch (pdfErr) {
      console.warn('PDF generation warning (markdown was saved successfully):', pdfErr);
    }

    return res.json({ 
      success: true, 
      filePath: fullFilePath,
      fileName: cleanFileName,
      message: `Successfully saved to Obsidian Vault as: ${cleanFileName} (PDF created)` 
    });
  } catch (error) {
    console.error('Error saving note:', error);
    return res.status(500).json({ 
      error: 'Failed to save note to Obsidian Vault.', 
      details: error.message 
    });
  }
});

// 2b. Download PDF on-the-fly from active editor text
app.post('/api/download-pdf', (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required.' });
  }

  try {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    // Set standard binary download headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(sanitizeFilename(title))}.pdf"`);

    doc.pipe(res);
    renderPdfDocument(doc, title, content);
    doc.end();
  } catch (error) {
    console.error('Error generating download PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF.', details: error.message });
  }
});

function extractTextFromEpub(epubBuffer) {
  const zip = new AdmZip(epubBuffer);
  const entries = zip.getEntries();
  
  // Find the .opf file
  const opfEntry = entries.find(e => e.entryName.endsWith('.opf'));
  if (!opfEntry) {
    throw new Error('Invalid EPUB: content.opf not found.');
  }
  
  const opfContent = opfEntry.getData().toString('utf8');
  const opfDir = path.dirname(opfEntry.entryName);
  
  // Robust manifest extraction
  const manifestItems = {};
  const manifestMatch = opfContent.match(/<manifest>([\s\S]*?)<\/manifest>/i);
  if (manifestMatch) {
    const items = manifestMatch[1].match(/<item\s+[^>]*>/gi) || [];
    items.forEach(item => {
      const idMatch = item.match(/id\s*=\s*["']([^"']+)["']/i);
      const hrefMatch = item.match(/href\s*=\s*["']([^"']+)["']/i);
      if (idMatch && hrefMatch) {
        manifestItems[idMatch[1]] = hrefMatch[1];
      }
    });
  }

  // Robust spine extraction
  const spineRefItems = [];
  const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i);
  if (spineMatch) {
    const itemrefs = spineMatch[1].match(/<itemref\s+[^>]*>/gi) || [];
    itemrefs.forEach(itemref => {
      const idrefMatch = itemref.match(/idref\s*=\s*["']([^"']+)["']/i);
      if (idrefMatch) {
        spineRefItems.push(idrefMatch[1]);
      }
    });
  }
  
  let fullText = "";
  
  // Extract text in spine order
  for (const idref of spineRefItems) {
    const href = manifestItems[idref];
    if (href) {
      const decodedHref = decodeURIComponent(href);
      const entryPath = opfDir === '.' || opfDir === '' 
        ? decodedHref 
        : path.join(opfDir, decodedHref).replace(/\\/g, '/');
      const entry = zip.getEntry(entryPath);
      if (entry) {
        const html = entry.getData().toString('utf8');
        const text = html
          .replace(/<head>[\s\S]*?<\/head>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ');
        fullText += text + "\n\n";
      }
    }
  }
  
  return fullText.trim();
}

app.post('/api/extract-pdf', express.raw({ type: 'application/pdf', limit: '50mb' }), async (req, res) => {
  try {
    const pdfBuffer = req.body;
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(400).json({ error: 'PDF Buffer is empty or invalid.' });
    }
    const parser = new pdfParse.PDFParse({ data: pdfBuffer });
    const data = await parser.getText();
    return res.json({ success: true, text: data.text });
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return res.status(500).json({ error: 'Text-Extraktion aus PDF fehlgeschlagen.', details: error.message });
  }
});

app.post('/api/extract-epub', express.raw({ type: 'application/epub+zip', limit: '100mb' }), async (req, res) => {
  try {
    const epubBuffer = req.body;
    if (!epubBuffer || epubBuffer.length === 0) {
      return res.status(400).json({ error: 'EPUB Buffer is empty or invalid.' });
    }
    const text = extractTextFromEpub(epubBuffer);
    return res.json({ success: true, text: text });
  } catch (error) {
    console.error('Error extracting text from EPUB:', error);
    return res.status(500).json({ error: 'Text-Extraktion aus EPUB fehlgeschlagen.', details: error.message });
  }
});

// 3. List existing synthesized notes
app.post('/api/list-notes', (req, res) => {
  const { vaultPath, folder } = req.body;

  if (!vaultPath) {
    return res.status(400).json({ error: 'vaultPath is required.' });
  }

  try {
    const resolvedVaultPath = path.resolve(vaultPath);
    const targetFolder = folder ? path.join(resolvedVaultPath, folder) : resolvedVaultPath;

    if (!fs.existsSync(targetFolder)) {
      return res.json({ success: true, notes: [] }); // Folder doesn't exist yet, so no notes
    }

    const files = fs.readdirSync(targetFolder);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    const notes = mdFiles.map(file => {
      const filePath = path.join(targetFolder, file);
      const stats = fs.statSync(filePath);
      
      // Try to parse some title/yaml from the file (first few lines)
      let title = file.replace(/\.md$/, '');
      let tags = [];
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        // Simple frontmatter parsing
        if (fileContent.startsWith('---')) {
          const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (match) {
            const yamlLines = match[1].split('\n');
            const yaml = {};
            yamlLines.forEach(line => {
              const parts = line.split(':');
              if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                yaml[key] = value;
              }
            });
            if (yaml.title) {
              // strip quotes if any
              title = yaml.title.replace(/^["']|["']$/g, '');
            }
            if (yaml.tags) {
              // Parse basic tags: e.g. [learning, typescript]
              tags = yaml.tags.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean);
            }
          }
        }
      } catch (err) {
        // Ignore read errors
      }

      return {
        fileName: file,
        title: title,
        tags: tags,
        modifiedAt: stats.mtime,
        createdAt: stats.birthtime,
        size: stats.size
      };
    });

    // Sort by modified time descending (newest first)
    notes.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    return res.json({ success: true, notes });
  } catch (error) {
    console.error('Error listing notes:', error);
    return res.status(500).json({ 
      error: 'Failed to list notes from Obsidian Vault.', 
      details: error.message 
    });
  }
});

// 4. Read specific note content
app.post('/api/read-note', (req, res) => {
  const { vaultPath, folder, fileName, isVaultRelative } = req.body;

  if (!vaultPath || !fileName) {
    return res.status(400).json({ error: 'vaultPath and fileName are required.' });
  }

  try {
    const resolvedVaultPath = path.resolve(vaultPath);
    
    let fullFilePath;
    if (isVaultRelative || !folder) {
      fullFilePath = path.join(resolvedVaultPath, fileName);
    } else {
      const targetFolder = path.join(resolvedVaultPath, folder);
      fullFilePath = path.join(targetFolder, fileName);
    }

    if (!fs.existsSync(fullFilePath)) {
      // Fallback: search recursively in the entire vault
      const findFileRecursive = (dir, name) => {
        const list = fs.readdirSync(dir);
        for (let i = 0; i < list.length; i++) {
          const file = list[i];
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat && stat.isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules') {
              const resVal = findFileRecursive(filePath, name);
              if (resVal) return resVal;
            }
          } else if (file.toLowerCase() === name.toLowerCase()) {
            return filePath;
          }
        }
        return null;
      };

      const foundPath = findFileRecursive(resolvedVaultPath, fileName);
      if (foundPath) {
        fullFilePath = foundPath;
        console.log(`Fallback: Resolved note "${fileName}" recursively to "${foundPath}"`);
      } else {
        return res.status(404).json({ error: `File not found: ${fileName}` });
      }
    }

    const content = fs.readFileSync(fullFilePath, 'utf8');
    return res.json({ success: true, content });
  } catch (error) {
    console.error('Error reading note:', error);
    return res.status(500).json({ 
      error: 'Failed to read note from Obsidian Vault.', 
      details: error.message 
    });
  }
});

// Helper to detect audio mime-type from path extension
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.mp3') return 'audio/mp3';
  if (ext === '.mpeg') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.m4a') return 'audio/m4a';
  if (ext === '.x-m4a') return 'audio/x-m4a';
  if (ext === '.m4b') return 'audio/mp4';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.aac') return 'audio/aac';
  if (ext === '.flac') return 'audio/flac';
  return 'application/octet-stream';
}

// Google File API: Upload utility
async function uploadToGeminiFileApi(apiKey, fileBuffer, mimeType) {
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-Header-Content-Length': fileBuffer.length.toString(),
    },
    body: fileBuffer
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to upload to Gemini File API: ${errText}`);
  }

  const result = await response.json();
  return result.file; // returns { name: "files/...", uri: "https://..." }
}

// Google File API: Delete/Cleanup utility
async function deleteFromGeminiFileApi(apiKey, fileName) {
  const deleteUrl = `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`;
  try {
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
    });
    if (!response.ok) {
      console.warn(`Failed to delete file ${fileName} from Gemini storage:`, await response.text());
    } else {
      console.log(`Successfully cleaned up file from Gemini storage: ${fileName}`);
    }
  } catch (err) {
    console.warn(`Failed to execute delete for file ${fileName}:`, err);
  }
}

// Helper functions for multi-provider LLM support
async function transcribeAudioWithWhisper(fileBuffer, mimeType, fileName, apiKey) {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  let uploadFileName = fileName;
  if (fileName.toLowerCase().endsWith('.m4b')) {
    uploadFileName = fileName.substring(0, fileName.length - 4) + '.m4a';
  }
  formData.append('file', blob, uploadFileName);
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Whisper transcription failed');
  }
  return data.text;
}

async function callOpenAiChat(apiKey, model, messages) {
  const isReasoning = model.startsWith('o1') || model.startsWith('o3');
  const body = {
    model: model,
    messages: messages
  };
  if (!isReasoning) {
    body.temperature = 0.3;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenAI API error');
  }
  return data.choices[0].message.content;
}

async function callAnthropicChat(apiKey, model, messages) {
  // Extract system prompt if any to pass as top level system parameter
  let systemPrompt = '';
  const chatMessages = messages.filter(m => {
    if (m.role === 'system') {
      systemPrompt = m.content;
      return false;
    }
    return true;
  });

  const body = {
    model: model,
    messages: chatMessages,
    max_tokens: 4096,
    temperature: 0.3
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Anthropic API error');
  }
  return data.content[0].text;
}

async function callOpenRouterChat(apiKey, model, messages) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/rafaelmitschke-ai/obsidian-knowledge-synthesizer',
      'X-Title': 'Aetheris'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.3
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenRouter API error');
  }
  return data.choices[0].message.content;
}

// 5. Podcast and general Audio Synthesis Endpoint
app.post('/api/analyze-audio', async (req, res) => {
  const { apiKey, openaiApiKey, anthropicApiKey, openrouterApiKey, localPath, audioUrl, prompt, model } = req.body;
  
  let selectedModel = model || 'gemini-2.5-flash';
  if (selectedModel === 'gemini-1.5-flash') {
    selectedModel = 'gemini-2.5-flash';
  } else if (selectedModel === 'gemini-1.5-pro') {
    selectedModel = 'gemini-2.5-pro';
  }

  const isGemini = selectedModel.startsWith('gemini-');

  if (isGemini && !apiKey) {
    return res.status(400).json({ error: 'Gemini API-Key ist erforderlich für Gemini-Modelle.' });
  }
  if (!isGemini && !openaiApiKey) {
    return res.status(400).json({ error: 'Ein OpenAI API-Key wird benötigt, um Audios für Nicht-Gemini-Modelle via Whisper zu transkribieren.' });
  }
  if ((!localPath && !audioUrl) || !prompt) {
    return res.status(400).json({ error: 'prompt and either localPath or audioUrl are required.' });
  }

  let uploadedFile = null;

  try {
    let fileBuffer;
    let mimeType;
    let originalName = 'podcast_audio';

    if (localPath) {
      const resolvedPath = path.resolve(localPath);
      if (!fs.existsSync(resolvedPath)) {
        return res.status(400).json({ error: `Die Datei existiert nicht unter dem Pfad: ${resolvedPath}` });
      }
      fileBuffer = fs.readFileSync(resolvedPath);
      mimeType = getMimeType(resolvedPath);
      originalName = path.basename(resolvedPath);
    } else if (audioUrl) {
      console.log(`Downloading audio from URL: ${audioUrl}`);
      const downloadRes = await fetch(audioUrl);
      if (!downloadRes.ok) {
        throw new Error(`Failed to download audio from URL. Status: ${downloadRes.status}`);
      }
      fileBuffer = Buffer.from(await downloadRes.arrayBuffer());
      mimeType = downloadRes.headers.get('Content-Type') || getMimeType(audioUrl);
      originalName = audioUrl.split('/').pop() || 'audio_file';
    }

    const isPdf = mimeType === 'application/pdf';
    if (isPdf && !isGemini) {
      return res.status(400).json({ error: 'Bild/Grafik-PDFs (Vision/OCR) werden derzeit nur von Google Gemini-Modellen unterstützt, da diese Dokumente nativ visuell einlesen können. Bitte wähle ein Gemini-Modell.' });
    }

    if (!isGemini) {
      console.log(`Transcribing audio via Whisper for non-Gemini model: ${selectedModel}...`);
      const transcribedText = await transcribeAudioWithWhisper(fileBuffer, mimeType, originalName, openaiApiKey);
      console.log(`Transcription complete. Characters: ${transcribedText.length}`);

      const userMessageContent = `Hier ist das Transkript der Audiodatei:\n\n"""\n${transcribedText}\n"""\n\nBitte führe die Analyse und Synthese gemäß folgenden Anweisungen durch:\n\n${prompt}`;
      
      let answer;
      const isOpenAi = selectedModel.startsWith('gpt-') || selectedModel.startsWith('o1-') || selectedModel.startsWith('o3-') || selectedModel === 'o1';
      if (isOpenAi) {
        answer = await callOpenAiChat(openaiApiKey, selectedModel, [{ role: 'user', content: userMessageContent }]);
      } else if (selectedModel.startsWith('claude-')) {
        if (!anthropicApiKey) {
          return res.status(400).json({ error: 'Ein Anthropic API-Key wird für Claude-Modelle benötigt.' });
        }
        answer = await callAnthropicChat(anthropicApiKey, selectedModel, [{ role: 'user', content: userMessageContent }]);
      } else if (selectedModel.includes('/')) {
        if (!openrouterApiKey) {
          return res.status(400).json({ error: 'Ein OpenRouter API-Key wird für OpenRouter-Modelle benötigt.' });
        }
        answer = await callOpenRouterChat(openrouterApiKey, selectedModel, [{ role: 'user', content: userMessageContent }]);
      } else {
        throw new Error(`Unbekannter Modell-Typ: ${selectedModel}`);
      }

      return res.json({
        success: true,
        markdown: answer,
        fileName: originalName
      });
    }

    console.log(`Uploading ${originalName} (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) to Gemini File API...`);
    uploadedFile = await uploadToGeminiFileApi(apiKey, fileBuffer, mimeType);
    console.log(`Upload complete. File Name: ${uploadedFile.name}, URI: ${uploadedFile.uri}`);

    // Allow 1 second process buffering
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('uploadedFile response:', JSON.stringify(uploadedFile, null, 2));
    
    try {
      const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const modelsRes = await fetch(listModelsUrl);
      const modelsData = await modelsRes.json();
      console.log('Available models for key:', JSON.stringify(modelsData.models?.map(m => m.name), null, 2));
    } catch (e) {
      console.error('Failed to list models:', e.message);
    }

    let currentModel = selectedModel;
    let attempts = 0;
    const maxAttempts = 3;
    let generateResponse;
    let generateData;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Running audio analysis using ${currentModel} (Attempt ${attempts}/${maxAttempts})...`);
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
      
      const requestBody = {
        contents: [
          {
            parts: [
              {
                file_data: {
                  mime_type: mimeType || uploadedFile.mimeType,
                  file_uri: uploadedFile.uri
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 8192
        }
      };

      try {
        generateResponse = await undiciFetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          dispatcher: new Agent({
            headersTimeout: 900000, // 15 minutes
            bodyTimeout: 900000
          })
        });

        generateData = await generateResponse.json();

        if (!generateResponse.ok) {
          console.error(`Gemini REST API generateContent error for ${currentModel}:`, JSON.stringify(generateData, null, 2));
          throw new Error(generateData.error?.message || 'Fehler bei der Inhaltsgenerierung in Gemini.');
        }

        if (!generateData.candidates || !generateData.candidates[0].content) {
          throw new Error('Gemini API response structure invalid: No candidate content generated.');
        }

        break; // Success! Exit loop

      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${attempts} failed for model ${currentModel}:`, err.message);
        
        if (attempts < maxAttempts) {
          if (attempts === 2 && currentModel.includes('pro')) {
            currentModel = currentModel.replace('pro', 'flash');
            console.log(`API busy or quota reached. Switching to fallback model: ${currentModel}`);
          } else {
            const delay = attempts * 2000;
            console.log(`API busy or quota reached. Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    if (!generateResponse || !generateResponse.ok || !generateData || !generateData.candidates) {
      throw lastError || new Error('Wiederholte Syntheseversuche für Audio fehlgeschlagen.');
    }

    const generatedMarkdown = generateData.candidates[0].content.parts[0].text;

    return res.json({
      success: true,
      markdown: generatedMarkdown,
      fileName: originalName
    });

  } catch (error) {
    console.error('Audio analysis error:', error);
    return res.status(500).json({
      error: 'Fehler bei der Audio-Analyse.',
      details: error.message
    });
  } finally {
    // ALWAYS clean up by deleting the file from Gemini File API in the background!
    if (uploadedFile && uploadedFile.name) {
      deleteFromGeminiFileApi(apiKey, uploadedFile.name);
    }
  }
});

// 5b. Text-Only Synthesis Endpoint
app.post('/api/synthesize-text', async (req, res) => {
  const { apiKey, openaiApiKey, anthropicApiKey, openrouterApiKey, prompt, model } = req.body;

  let selectedModel = model || 'gemini-2.5-flash';
  if (selectedModel === 'gemini-1.5-flash') selectedModel = 'gemini-2.5-flash';
  if (selectedModel === 'gemini-1.5-pro') selectedModel = 'gemini-2.5-pro';

  const isGemini = selectedModel.startsWith('gemini-');

  try {
    let answer;

    if (isGemini) {
      if (!apiKey) {
        return res.status(400).json({ error: 'Gemini API-Key ist erforderlich.' });
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            maxOutputTokens: 8192
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Fehler beim Aufruf der Gemini API.');
      }
      answer = data.candidates[0].content.parts[0].text;
    } else if (selectedModel.startsWith('gpt-') || selectedModel.startsWith('o1-') || selectedModel.startsWith('o3-') || selectedModel === 'o1') {
      if (!openaiApiKey) {
        return res.status(400).json({ error: 'OpenAI API-Key ist erforderlich.' });
      }
      answer = await callOpenAiChat(openaiApiKey, selectedModel, [{ role: 'user', content: prompt }]);
    } else if (selectedModel.startsWith('claude-')) {
      if (!anthropicApiKey) {
        return res.status(400).json({ error: 'Anthropic API-Key ist erforderlich.' });
      }
      answer = await callAnthropicChat(anthropicApiKey, selectedModel, [{ role: 'user', content: prompt }]);
    } else if (selectedModel.includes('/')) {
      if (!openrouterApiKey) {
        return res.status(400).json({ error: 'OpenRouter API-Key ist erforderlich.' });
      }
      answer = await callOpenRouterChat(openrouterApiKey, selectedModel, [{ role: 'user', content: prompt }]);
    } else {
      throw new Error(`Unbekannter Modell-Typ: ${selectedModel}`);
    }

    return res.json({ success: true, text: answer });
  } catch (error) {
    console.error('Error in text synthesis:', error);
    return res.status(500).json({ error: 'Fehler bei der Wissens-Synthese.', details: error.message });
  }
});

// Server-side Queue State (Pillar 4 Web Clipper Queue)
let serverQueue = [];

app.get('/api/queue', (req, res) => {
  res.json({ success: true, queue: serverQueue });
});

app.post('/api/queue/add-webclip', (req, res) => {
  const { type, inputVal, inputTitle, redirectUrl } = req.body;
  if (!type || !inputVal) {
    return res.status(400).send('Fehler: type und inputVal sind erforderlich.');
  }

  const newItem = {
    id: Date.now().toString(),
    type: type,
    inputVal: inputVal.trim(),
    inputTitle: inputTitle ? inputTitle.trim() : `Clipped_${type}_${new Date().toLocaleTimeString('de-DE')}`,
    status: 'pending',
    error: null
  };

  serverQueue.push(newItem);
  res.redirect(redirectUrl || 'http://localhost:5173/?clipped=true');
});

app.post('/api/queue/add', (req, res) => {
  const { type, inputVal, inputTitle } = req.body;
  if (!type || !inputVal) {
    return res.status(400).json({ error: 'type and inputVal are required.' });
  }

  const newItem = {
    id: Date.now().toString(),
    type: type,
    inputVal: inputVal.trim(),
    inputTitle: inputTitle ? inputTitle.trim() : `Clipped_${type}_${new Date().toLocaleTimeString('de-DE')}`,
    status: 'pending',
    error: null
  };

  serverQueue.push(newItem);
  res.json({ success: true, item: newItem });
});

app.post('/api/queue/update', (req, res) => {
  const { id, status, error } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: 'id and status are required.' });
  }

  const itemIndex = serverQueue.findIndex(item => item.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Queue item not found.' });
  }

  serverQueue[itemIndex].status = status;
  if (error !== undefined) {
    serverQueue[itemIndex].error = error;
  }

  res.json({ success: true, item: serverQueue[itemIndex] });
});

app.post('/api/queue/clear', (req, res) => {
  serverQueue = serverQueue.filter(item => item.status !== 'completed' && item.status !== 'failed');
  res.json({ success: true, queue: serverQueue });
});

app.post('/api/queue/remove', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id is required.' });
  }
  serverQueue = serverQueue.filter(item => item.id !== id);
  res.json({ success: true, queue: serverQueue });
});

// Binary WebM Microphone recording parser (Pillar 3)
app.post('/api/upload-audio', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  try {
    const fileBuffer = req.body;
    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'No audio bytes received.' });
    }

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFileName = `voice_memo_${Date.now()}.webm`;
    const tempFilePath = path.join(tempDir, tempFileName);

    fs.writeFileSync(tempFilePath, fileBuffer);

    return res.json({
      success: true,
      filePath: tempFilePath,
      fileName: tempFileName
    });
  } catch (error) {
    console.error('Error writing recorded audio:', error);
    return res.status(500).json({ error: 'Failed to write recorded audio memo.', details: error.message });
  }
});

// Binary upload for files in the Podcast/Audio tab
app.post('/api/upload-audio-file', express.raw({ type: '*/*', limit: '500mb' }), (req, res) => {
  try {
    const fileBuffer = req.body;
    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'Keine Audio-Bytes empfangen.' });
    }

    const headerFileName = req.headers['x-file-name'];
    let originalName = 'uploaded_audio.mp3';
    if (headerFileName) {
      originalName = decodeURIComponent(headerFileName);
    }

    const ext = path.extname(originalName).toLowerCase();
    const allowed = ['.mp3', '.mpeg', '.wav', '.m4a', '.m4b', '.ogg', '.aac', '.flac', '.pdf'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ error: `Ungültiges Dateiformat: ${ext}. Erlaubt sind: ${allowed.join(', ')}` });
    }

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFileName = `upload_${Date.now()}${ext}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    fs.writeFileSync(tempFilePath, fileBuffer);

    return res.json({
      success: true,
      filePath: tempFilePath,
      fileName: originalName
    });
  } catch (error) {
    console.error('Error writing uploaded audio file:', error);
    return res.status(500).json({ error: 'Speichern der Audio-Datei fehlgeschlagen.', details: error.message });
  }
});

// Local FFmpeg decryption tool for Audible audiobooks (.aax or .m4b)
app.post('/api/decrypt-audible', async (req, res) => {
  const { localPath, activationBytes } = req.body;

  if (!localPath || !activationBytes) {
    return res.status(400).json({ error: 'Dateipfad und Activation Bytes sind erforderlich.' });
  }

  // Validate activation bytes (4-byte hex: 8 characters)
  const hexRegex = /^[a-fA-F0-9]{8}$/;
  if (!hexRegex.test(activationBytes.trim())) {
    return res.status(400).json({ error: 'Ungültige Activation Bytes. Es muss ein 8-stelliger Hex-Code sein (z.B. 1a2b3c4d).' });
  }

  try {
    const resolvedPath = path.resolve(localPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(400).json({ error: `Die Datei existiert nicht unter dem Pfad: ${resolvedPath}` });
    }

    const ext = path.extname(resolvedPath);
    const dirName = path.dirname(resolvedPath);
    const baseName = path.basename(resolvedPath, ext);
    
    // Output path: suffix with _decrypted.m4b
    const outputPath = path.join(dirName, `${baseName}_decrypted.m4b`);

    // Spawn ffmpeg
    const args = [
      '-y',
      '-activation_bytes', activationBytes.trim(),
      '-i', resolvedPath,
      '-c', 'copy',
      outputPath
    ];

    console.log(`Running ffmpeg: ffmpeg ${args.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', args);

    let stderr = '';
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`FFmpeg exited with code ${code}. Stderr: ${stderr}`);
        
        let customError = 'Hörbuch-Entschlüsselung fehlgeschlagen.';
        if (stderr.includes('file decrypt failed') || stderr.includes('Activation bytes') || stderr.includes('verify')) {
          customError = 'Ungültige Activation Bytes. Das Hörbuch konnte nicht entschlüsselt werden.';
        } else if (stderr.includes('not recognized') || stderr.includes('not found') || stderr.includes('CommandNotFoundException') || stderr.includes('cannot find') || stderr.includes('ENOENT')) {
          customError = 'FFmpeg ist auf diesem System nicht installiert oder nicht im PATH. Bitte installiere FFmpeg.';
        }

        return res.status(500).json({ 
          error: customError,
          details: stderr
        });
      }

      console.log(`Successfully decrypted audiobook to: ${outputPath}`);
      return res.json({
        success: true,
        outputPath: outputPath,
        message: `Hörbuch erfolgreich entschlüsselt und gespeichert unter: ${outputPath}`
      });
    });

    // Handle process spawning error (e.g. ffmpeg not installed/found)
    ffmpegProcess.on('error', (err) => {
      console.error('Failed to start FFmpeg process:', err);
      let errorMsg = 'Fehler beim Starten von FFmpeg.';
      if (err.code === 'ENOENT') {
        errorMsg = 'FFmpeg konnte nicht gefunden werden. Bitte stelle sicher, dass FFmpeg installiert und im System-PATH eingetragen ist.';
      }
      return res.status(500).json({
        error: errorMsg,
        details: err.message
      });
    });

  } catch (error) {
    console.error('Decryption error:', error);
    return res.status(500).json({ error: 'Fehler bei der Entschlüsselung.', details: error.message });
  }
});

// Helper to tokenize and clean text for local search
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\säöüß]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// 6. High-Performance Local TF-IDF Search Engine (Pillar 5)
// Helper to perform TF-IDF search on Obsidian vault and retrieve matching files
function performTfidfSearch(vaultPath, folder, query) {
  const resolvedVaultPath = path.resolve(vaultPath);
  const targetFolder = folder ? path.join(resolvedVaultPath, folder) : resolvedVaultPath;

  if (!fs.existsSync(targetFolder)) {
    return [];
  }

  const files = fs.readdirSync(targetFolder);
  const mdFiles = files.filter(file => file.endsWith('.md'));

  const documents = [];
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  // 1. Read files and extract text
  mdFiles.forEach(file => {
    const filePath = path.join(targetFolder, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const tokens = tokenize(content);

      documents.push({
        fileName: file,
        title: file.replace(/\.md$/, ''),
        content: content,
        tokens: tokens,
        tokenCount: tokens.length
      });
    } catch (err) {
      console.warn(`Could not read vault file ${file} during search:`, err.message);
    }
  });

  // 2. Compute TF-IDF
  const numDocs = documents.length;
  const results = [];

  documents.forEach(doc => {
    let score = 0;
    let snippet = '';

    queryTokens.forEach(token => {
      const termCount = doc.tokens.filter(t => t === token).length;
      if (termCount === 0) return;

      const tf = termCount / doc.tokenCount;
      const docsWithTerm = documents.filter(d => d.tokens.includes(token)).length;
      const idf = Math.log(numDocs / (docsWithTerm || 1)) + 1;

      let tokenScore = tf * idf;

      // Boost score if keyword is in the title!
      if (doc.title.toLowerCase().includes(token)) {
        tokenScore += 1.5;
      }

      score += tokenScore;
    });

    if (score > 0) {
      const lowerContent = doc.content.toLowerCase();
      let matchIdx = -1;
      
      for (const token of queryTokens) {
        matchIdx = lowerContent.indexOf(token);
        if (matchIdx !== -1) break;
      }

      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 60);
        const end = Math.min(doc.content.length, matchIdx + 80);
        snippet = `...${doc.content.substring(start, end).replace(/\r?\n/g, ' ')}...`;
      } else {
        snippet = doc.content.substring(0, 140).replace(/\r?\n/g, ' ') + '...';
      }

      results.push({
        fileName: doc.fileName,
        title: doc.title,
        content: doc.content,
        score: score,
        snippet: snippet
      });
    }
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

// Helper for Cosine Similarity between two embedding vectors
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper to sync local Obsidian notes with Gemini text-embedding-004
async function syncEmbeddings(targetFolder, apiKey) {
  const cachePath = path.join(targetFolder, '.aetheris_embeddings.json');
  let cache = { files: {} };
  
  if (fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (!cache.files) cache.files = {};
    } catch (err) {
      console.warn('Konnte Embeddings-Cache-Datei nicht parsen, starte neu:', err.message);
    }
  }

  const files = fs.readdirSync(targetFolder);
  const mdFiles = files.filter(file => file.endsWith('.md'));
  const dirtyFiles = [];

  // Remove deleted files from cache
  Object.keys(cache.files).forEach(cachedFile => {
    if (!fs.existsSync(path.join(targetFolder, cachedFile))) {
      delete cache.files[cachedFile];
    }
  });

  // Identify new/modified files
  mdFiles.forEach(file => {
    const filePath = path.join(targetFolder, file);
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;
      const cached = cache.files[file];
      
      if (!cached || cached.mtime !== mtime) {
        const content = fs.readFileSync(filePath, 'utf8');
        dirtyFiles.push({
          fileName: file,
          mtime: mtime,
          text: content.substring(0, 6000) // embed the first 6k chars (covers context cleanly)
        });
      }
    } catch (err) {
      console.warn(`Fehler beim Scannen der Datei ${file} für Embeddings:`, err.message);
    }
  });

  if (dirtyFiles.length > 0) {
    console.log(`Synchronisiere semantischen Index: Generiere Embeddings für ${dirtyFiles.length} neue/geänderte Notizen...`);
    
    // Batch requests into groups of 20 to stay within API limits
    const batchSize = 20;
    for (let i = 0; i < dirtyFiles.length; i += batchSize) {
      const batch = dirtyFiles.slice(i, i + batchSize);
      
      const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`;
      const response = await fetch(embedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map(item => ({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: item.text }] }
          }))
        })
      });

      const resData = await response.json();
      
      if (!response.ok) {
        throw new Error(resData.error?.message || 'Fehler beim Abruf der Batch-Embeddings.');
      }

      if (resData.embeddings && resData.embeddings.length === batch.length) {
        batch.forEach((item, idx) => {
          cache.files[item.fileName] = {
            fileName: item.fileName,
            mtime: item.mtime,
            embedding: resData.embeddings[idx].values
          };
        });
      } else {
        throw new Error('Ungültige Antwort von Gemini Batch Embedding API.');
      }
    }

    // Save updated cache
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
    console.log('Semantischer Vektor-Index erfolgreich aktualisiert.');
  }
}

// 6. High-Performance Local TF-IDF Search Engine (Pillar 5)
app.post('/api/search', (req, res) => {
  const { vaultPath, folder, query } = req.body;

  if (!vaultPath || !query) {
    return res.status(400).json({ error: 'vaultPath and query are required.' });
  }

  try {
    const allResults = performTfidfSearch(vaultPath, folder, query);
    // Strip full content to save bandwidth for standard history search
    const results = allResults.map(({ fileName, title, score, snippet }) => ({
      fileName, title, score, snippet
    }));
    return res.json({ success: true, results });
  } catch (error) {
    console.error('Error during local vault search:', error);
    return res.status(500).json({ error: 'Failed to search local Obsidian Vault.', details: error.message });
  }
});

app.post('/api/copilot/search-ai', async (req, res) => {
  const { vaultPath, folder, query, apiKey, openaiApiKey, anthropicApiKey, openrouterApiKey, model } = req.body;

  if (!vaultPath || !query) {
    return res.status(400).json({ error: 'vaultPath and query are required.' });
  }

  try {
    const resolvedVaultPath = path.resolve(vaultPath);
    const targetFolder = folder ? path.join(resolvedVaultPath, folder) : resolvedVaultPath;

    let topDocs = [];
    let useSemantic = false;
    let embeddingsCache = { files: {} };

    // 1. Try semantic embeddings sync (only if Gemini apiKey is provided)
    if (apiKey) {
      try {
        if (fs.existsSync(targetFolder)) {
          await syncEmbeddings(targetFolder, apiKey);
          const cachePath = path.join(targetFolder, '.aetheris_embeddings.json');
          if (fs.existsSync(cachePath)) {
            embeddingsCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            useSemantic = Object.keys(embeddingsCache.files).length > 0;
          }
        }
      } catch (err) {
        console.warn('Semantische Suche fehlgeschlagen beim Synchronisieren, weiche auf TF-IDF aus:', err.message);
        useSemantic = false;
      }
    }

    // 2. Perform search (Semantic or Fallback TF-IDF)
    if (useSemantic && apiKey) {
      try {
        // Embed search query
        const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
        const embedRes = await fetch(embedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: query }] }
          })
        });
        const embedData = await embedRes.json();
        
        if (!embedRes.ok) {
          throw new Error(embedData.error?.message || 'Fehler beim Einbetten der Suchanfrage.');
        }

        if (embedData.embedding && embedData.embedding.values) {
          const queryVector = embedData.embedding.values;
          const results = [];
          
          Object.keys(embeddingsCache.files).forEach(fileName => {
            const cached = embeddingsCache.files[fileName];
            const filePath = path.join(targetFolder, fileName);
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath, 'utf8');
              const score = cosineSimilarity(queryVector, cached.embedding);

              results.push({
                fileName,
                title: fileName.replace(/\.md$/, ''),
                content,
                score
              });
            }
          });

          // Sort descending and take top 4
          results.sort((a, b) => b.score - a.score);
          topDocs = results.slice(0, 4);
          console.log(`Semantische Suche erfolgreich. Top-Match: ${topDocs[0]?.title} (Score: ${topDocs[0]?.score.toFixed(3)})`);
        } else {
          throw new Error('Ungültiges Query-Embedding von Gemini.');
        }
      } catch (err) {
        console.warn('Generierung des Query-Embeddings schlug fehl, weiche auf TF-IDF aus:', err.message);
        useSemantic = false;
      }
    }

    // Fallback: If not semantic or embedding query failed, use classical TF-IDF search
    if (!useSemantic) {
      console.log('Führe stichwortbasierte TF-IDF-Suche als Fallback aus...');
      const allResults = performTfidfSearch(vaultPath, folder, query);
      topDocs = allResults.slice(0, 4);
    }

    // 3. Build context block
    let context = '';
    if (topDocs.length > 0) {
      context = topDocs.map(doc => `--- START NOTE: ${doc.title} ---\n${doc.content}\n--- END NOTE ---`).join('\n\n');
    } else {
      context = '(Keine passenden Obsidian-Notizen in deinem Vault gefunden)';
    }

    // 4. Formulate RAG system prompt
    const systemPrompt = `Du bist Aetheris Copilot, ein intelligenter KI-Wissens-Assistent.
Deine Aufgabe ist es, die Frage des Benutzers basierend auf den bereitgestellten Obsidian-Notizen (Kontext) präzise, strukturiert und umfassend zu beantworten.

Hier sind deine Obsidian-Notizen als Kontext:
=== KONTEXT ===
${context}
===============

Anweisungen:
1. Beantworte die Frage auf Deutsch.
2. Formatiere deine Antwort mit schönem Markdown (nutze Gliederungen, Aufzählungspunkte, Tabellen und fette Schlüsselbegriffe).
3. Zitier die Notizen, aus denen du dein Wissen hast, als Obsidian-Wiki-Links im Format [[Notiztitel]]. Nutze dafür exakt die Titel der Notizen aus dem Kontext (z.B. [[TypeScript Einführung]] oder [[Podcast BPC-157 Peptide]]).
4. Wenn der Kontext keine nützlichen Informationen enthält, sag das dem Benutzer kurz und beantworte die Frage mit deinem eigenen Allgemeinwissen, aber kennzeichne dies deutlich.

Frage des Benutzers: ${query}`;

    const selectedModel = model || 'gemini-2.5-flash';
    let actualModel = selectedModel;
    if (actualModel === 'gemini-1.5-flash') actualModel = 'gemini-2.5-flash';
    if (actualModel === 'gemini-1.5-pro') actualModel = 'gemini-2.5-pro';

    const isGemini = actualModel.startsWith('gemini-');
    let answer;

    if (isGemini) {
      if (!apiKey) {
        return res.status(400).json({ error: 'Gemini API-Key ist erforderlich für Gemini-Modelle.' });
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Fehler beim Aufruf der Gemini API.');
      }
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Es wurde keine Antwort von Gemini generiert.');
      }
      answer = data.candidates[0].content.parts[0].text;
    } else if (actualModel.startsWith('gpt-') || actualModel.startsWith('o1-') || actualModel.startsWith('o3-') || actualModel === 'o1') {
      if (!openaiApiKey) {
        return res.status(400).json({ error: 'OpenAI API-Key ist erforderlich für OpenAI-Modelle.' });
      }
      answer = await callOpenAiChat(openaiApiKey, actualModel, [{ role: 'user', content: systemPrompt }]);
    } else if (actualModel.startsWith('claude-')) {
      if (!anthropicApiKey) {
        return res.status(400).json({ error: 'Anthropic API-Key ist erforderlich für Claude-Modelle.' });
      }
      answer = await callAnthropicChat(anthropicApiKey, actualModel, [{ role: 'user', content: systemPrompt }]);
    } else if (actualModel.includes('/')) {
      if (!openrouterApiKey) {
        return res.status(400).json({ error: 'OpenRouter API-Key ist erforderlich für OpenRouter-Modelle.' });
      }
      answer = await callOpenRouterChat(openrouterApiKey, actualModel, [{ role: 'user', content: systemPrompt }]);
    } else {
      throw new Error(`Unbekannter Modell-Typ: ${actualModel}`);
    }

    const sources = topDocs.map(d => ({ title: d.title, fileName: d.fileName, score: d.score }));
    return res.json({ success: true, answer, sources });

  } catch (error) {
    console.error('Error during Copilot AI search:', error);
    return res.status(500).json({ error: 'Fehler bei der KI-gestützten Suche.', details: error.message });
  }
});

// 7. Podcast Directory Search (iTunes API wrapper)
app.get('/api/podcasts/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter q is required.' });
  }

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=podcast&limit=15`;
    const response = await fetch(itunesUrl);
    if (!response.ok) {
      throw new Error(`iTunes API returned status ${response.status}`);
    }
    const data = await response.json();
    const podcasts = (data.results || []).map(r => ({
      title: r.collectionName || 'Unbekannter Podcast',
      artist: r.artistName || 'Unbekannter Künstler',
      feedUrl: r.feedUrl || '',
      cover: r.artworkUrl600 || r.artworkUrl100 || ''
    })).filter(p => p.feedUrl);

    return res.json({ success: true, podcasts });
  } catch (error) {
    console.error('Error searching podcasts:', error);
    return res.status(500).json({ error: 'Podcast-Suche fehlgeschlagen.', details: error.message });
  }
});

// 8. Podcast Episodes RSS Parser
app.post('/api/podcasts/episodes', async (req, res) => {
  const { feedUrl } = req.body;
  if (!feedUrl) {
    return res.status(400).json({ error: 'feedUrl is required.' });
  }

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed. Status: ${response.status}`);
    }
    const xml = await response.text();

    const items = xml.split('<item>');
    const episodes = [];

    // Skip the first block as it contains channel metadata before the first <item>
    for (let i = 1; i < Math.min(31, items.length); i++) {
      const item = items[i];

      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
      const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]+)"/i);
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/i) || 
                        item.match(/<itunes:summary>([\s\S]*?)<\/itunes:summary>/i);
      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const durationMatch = item.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i);

      if (!enclosureMatch) continue; // Only keep episodes with playable audio files

      // Clean CDATA blocks
      const cleanCDATA = (str) => {
        if (!str) return '';
        return str.trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
      };

      const title = titleMatch ? cleanCDATA(titleMatch[1]) : 'Episode ohne Titel';
      const audioUrl = enclosureMatch[1];
      let description = descMatch ? cleanCDATA(descMatch[1]) : 'Keine Beschreibung verfügbar.';
      
      // Strip HTML tags from description for clean look
      description = description.replace(/<[^>]*>/g, '').trim();
      if (description.length > 250) {
        description = description.substring(0, 247) + '...';
      }

      const pubDate = pubDateMatch ? cleanCDATA(pubDateMatch[1]) : '';
      const durationVal = durationMatch ? cleanCDATA(durationMatch[1]) : '';

      // Format duration into readable HH:MM:SS or MM:SS
      let duration = durationVal;
      if (durationVal && /^\d+$/.test(durationVal)) {
        const secs = parseInt(durationVal, 10);
        const hrs = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        const remainingSecs = secs % 60;
        if (hrs > 0) {
          duration = `${hrs}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
        } else {
          duration = `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
        }
      }

      episodes.push({
        title,
        audioUrl,
        description,
        pubDate,
        duration
      });
    }

    return res.json({ success: true, episodes });
  } catch (error) {
    console.error('Error parsing podcast episodes:', error);
    return res.status(500).json({ error: 'Episoden konnten nicht geladen werden.', details: error.message });
  }
});
// 9. Resolve Spotify Links using Gemini with Google Search tool or oEmbed
app.post('/api/podcasts/resolve-spotify', async (req, res) => {
  const { spotifyUrl, apiKey } = req.body;
  if (!spotifyUrl) {
    return res.status(400).json({ error: 'spotifyUrl is required.' });
  }

  // Parse type and id
  const showMatch = spotifyUrl.match(/\/show\/([a-zA-Z0-9]+)/i);
  const episodeMatch = spotifyUrl.match(/\/episode\/([a-zA-Z0-9]+)/i);

  if (!showMatch && !episodeMatch) {
    return res.status(400).json({ error: 'Ungültiger Spotify-Link. Unterstützt werden Spotify Shows und Episoden.' });
  }

  const isEpisode = !!episodeMatch;
  const type = isEpisode ? 'episode' : 'show';

  try {
    let episodeTitle = null;
    let showTitle = null;

    // 1. If it's an episode, try fetching the public oEmbed endpoint first (fast, reliable fallback)
    if (isEpisode) {
      try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          if (oembedData.title) {
            episodeTitle = oembedData.title.trim();
            console.log(`Resolved episode title via oEmbed: "${episodeTitle}"`);
          }
        }
      } catch (err) {
        console.warn('oEmbed resolution failed, falling back to Gemini:', err.message);
      }
    }

    // 2. Query Gemini with Google Search tool to find titles
    if (!apiKey) {
      // If we don't have an API key, we can only succeed if it was an episode and we got the episode title,
      // but we still need the show title to search. We'll return an error if we have no show title.
      if (isEpisode && episodeTitle) {
        return res.status(400).json({ 
          error: 'Bitte trage deinen Gemini API-Key in den Einstellungen ein, um den Show-Namen für diese Episode aufzulösen.', 
          episodeTitle 
        });
      }
      return res.status(400).json({ error: 'Bitte trage deinen Gemini API-Key in den Einstellungen ein, um Spotify-Links aufzulösen.' });
    }

    // Ask Gemini to search Google and return show/episode names
    const prompt = `You are a helper for a podcast app.
Please find the official podcast show (series) name, and if this is an episode URL, also the exact episode title for the following Spotify link:
Spotify Link: ${spotifyUrl}
${isEpisode && episodeTitle ? `(We resolved the episode title as: "${episodeTitle}")` : ''}

You MUST use Google Search to verify the titles.
Provide your response strictly as a JSON object matching this schema. No markdown formatting, no backticks, no other text:
{
  "type": "${type}",
  "showTitle": "Exact name of the podcast show/series",
  "episodeTitle": "Exact name of the episode or null if it is a show URL"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiRes.ok) {
      const errorData = await geminiRes.json();
      throw new Error(errorData.error?.message || 'Gemini API Error');
    }

    const geminiData = await geminiRes.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      throw new Error('Keine Antwort von Gemini erhalten.');
    }

    const parsedResult = JSON.parse(resultText.trim());
    showTitle = parsedResult.showTitle;
    if (parsedResult.episodeTitle) {
      episodeTitle = parsedResult.episodeTitle;
    }

    if (!showTitle) {
      throw new Error('Der Name der Show konnte nicht ermittelt werden.');
    }

    console.log(`Resolved from Spotify link: Show = "${showTitle}", Episode = "${episodeTitle}"`);

    // 3. Search iTunes API for the resolved podcast show
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(showTitle)}&entity=podcast&limit=5`;
    const itunesRes = await fetch(itunesUrl);
    if (!itunesRes.ok) {
      throw new Error('iTunes Suche fehlgeschlagen.');
    }
    const itunesData = await itunesRes.json();
    const podcasts = (itunesData.results || []).map(r => ({
      title: r.collectionName || 'Unbekannter Podcast',
      artist: r.artistName || 'Unbekannter Künstler',
      feedUrl: r.feedUrl || '',
      cover: r.artworkUrl600 || r.artworkUrl100 || ''
    })).filter(p => p.feedUrl);

    if (podcasts.length === 0) {
      return res.status(404).json({ 
        error: `Der Podcast "${showTitle}" konnte nicht in der öffentlichen Datenbank gefunden werden. Eventuell handelt es sich um ein exklusives Spotify-Format.`,
        showTitle 
      });
    }

    // Best matching podcast from results
    const matchedPodcast = podcasts[0];

    // If it's a show URL, we are done!
    if (!isEpisode) {
      return res.json({
        success: true,
        type: 'show',
        showTitle,
        podcast: matchedPodcast
      });
    }

    // 4. If it is an episode, load its RSS feed and find the matching episode
    const feedResponse = await fetch(matchedPodcast.feedUrl);
    if (!feedResponse.ok) {
      throw new Error('Podcast RSS Feed konnte nicht geladen werden.');
    }
    const xml = await feedResponse.text();
    const items = xml.split('<item>');
    
    let matchedEpisode = null;
    const cleanCDATA = (str) => {
      if (!str) return '';
      return str.trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
    };

    // Helper to compute simple string similarity (for fuzzy matching)
    const getSimilarity = (str1, str2) => {
      const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
      const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (s1.includes(s2) || s2.includes(s1)) return 0.9;
      const set1 = new Set(s1.split(''));
      const set2 = new Set(s2.split(''));
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      return intersection.size / Math.max(set1.size, set2.size);
    };

    let bestScore = 0;
    // Iterate through items (skip first, up to 100 items)
    for (let i = 1; i < Math.min(101, items.length); i++) {
      const item = items[i];
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
      const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]+)"/i);
      if (!titleMatch || !enclosureMatch) continue;

      const title = cleanCDATA(titleMatch[1]);
      const audioUrl = enclosureMatch[1];
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/i) || 
                        item.match(/<itunes:summary>([\s\S]*?)<\/itunes:summary>/i);
      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const durationMatch = item.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i);

      let description = descMatch ? cleanCDATA(descMatch[1]) : '';
      description = description.replace(/<[^>]*>/g, '').trim();
      if (description.length > 250) {
        description = description.substring(0, 247) + '...';
      }

      const score = getSimilarity(title, episodeTitle);
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        matchedEpisode = {
          title,
          audioUrl,
          description,
          pubDate: pubDateMatch ? cleanCDATA(pubDateMatch[1]) : '',
          duration: durationMatch ? cleanCDATA(durationMatch[1]) : ''
        };
      }
    }

    if (!matchedEpisode) {
      return res.status(404).json({
        error: `Die Episode "${episodeTitle}" konnte im öffentlichen RSS-Feed von "${showTitle}" nicht gefunden werden.`,
        showTitle,
        episodeTitle,
        podcast: matchedPodcast
      });
    }

    return res.json({
      success: true,
      type: 'episode',
      showTitle,
      episodeTitle,
      podcast: matchedPodcast,
      episode: matchedEpisode
    });

  } catch (error) {
    console.error('Error in /api/podcasts/resolve-spotify:', error);
    return res.status(500).json({ error: 'Spotify-Auflösung fehlgeschlagen.', details: error.message });
  }
});

// 10. Scan Vault and Parse Wiki-Links for Graph View
app.post('/api/graph', (req, res) => {
  const { vaultPath } = req.body;
  if (!vaultPath) {
    return res.status(400).json({ error: 'vaultPath is required.' });
  }

  try {
    const resolvedVaultPath = path.resolve(vaultPath);

    if (!fs.existsSync(resolvedVaultPath)) {
      return res.json({ success: true, nodes: [], links: [] });
    }

    const getFilesRecursive = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          if (!file.startsWith('.') && file !== 'node_modules') {
            results = results.concat(getFilesRecursive(filePath));
          }
        } else if (file.endsWith('.md')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const allFiles = getFilesRecursive(resolvedVaultPath);
    const nodes = [];
    const links = [];
    const noteNameMap = new Map(); // lowercase -> actualName

    // First pass: add all existing files as nodes
    allFiles.forEach(filePath => {
      const relativePath = path.relative(resolvedVaultPath, filePath).replace(/\\/g, '/');
      const noteName = path.basename(filePath, '.md');
      
      let mtime = Date.now();
      try {
        const stat = fs.statSync(filePath);
        mtime = stat.mtimeMs;
      } catch (e) {
        // ignore
      }

      // Parse tags from frontmatter
      let tags = [];
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (fileContent.startsWith('---')) {
          const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (match) {
            const yamlLines = match[1].split('\n');
            yamlLines.forEach(line => {
              const parts = line.split(':');
              if (parts.length >= 2 && parts[0].trim() === 'tags') {
                const val = parts.slice(1).join(':').trim();
                tags = val.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean);
              }
            });
          }
        }
      } catch (err) {
        // ignore read error
      }

      // Map lowercase note name
      noteNameMap.set(noteName.toLowerCase(), noteName);
      
      // Map lowercase relative path without extension
      const relPathNoExt = relativePath.replace(/\.md$/, '');
      noteNameMap.set(relPathNoExt.toLowerCase(), noteName);

      nodes.push({
        id: noteName,
        label: noteName,
        relativePath: relativePath,
        exists: true,
        tags: tags,
        mtime: mtime
      });
    });

    // Second pass: extract links and resolve them case-insensitively
    allFiles.forEach(filePath => {
      const noteName = path.basename(filePath, '.md');
      const content = fs.readFileSync(filePath, 'utf8');
      
      const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
      let match;
      const seenLinks = new Set();

      while ((match = wikiLinkRegex.exec(content)) !== null) {
        const rawTarget = match[1].trim();
        if (!rawTarget) continue;

        const targetKey = rawTarget.toLowerCase();
        let resolvedTarget = rawTarget;
        let exists = false;

        if (noteNameMap.has(targetKey)) {
          resolvedTarget = noteNameMap.get(targetKey);
          exists = true;
        } else {
          // If not directly found, check if it's a relative path like Folder/Subfolder/Note
          const targetBase = rawTarget.split('/').pop().toLowerCase();
          if (noteNameMap.has(targetBase)) {
            resolvedTarget = noteNameMap.get(targetBase);
            exists = true;
          }
        }

        // Avoid self-linking (case-insensitive check)
        if (resolvedTarget.toLowerCase() === noteName.toLowerCase()) {
          continue;
        }

        const linkKey = `${noteName}->${resolvedTarget}`;
        if (!seenLinks.has(linkKey)) {
          seenLinks.add(linkKey);
          links.push({
            source: noteName,
            target: resolvedTarget
          });

          // If it doesn't exist, we must add it as an unresolved node
          if (!exists) {
            const resolvedTargetLower = resolvedTarget.toLowerCase();
            if (!noteNameMap.has(resolvedTargetLower)) {
              noteNameMap.set(resolvedTargetLower, resolvedTarget);
              nodes.push({
                id: resolvedTarget,
                label: resolvedTarget,
                relativePath: null,
                exists: false,
                mtime: Date.now()
              });
            }
          }
        }
      }
    });

    return res.json({ success: true, nodes, links });

  } catch (error) {
    console.error('Error parsing graph:', error);
    return res.status(500).json({ error: 'Vault-Graph konnte nicht generiert werden.', details: error.message });
  }
});


app.post('/api/debug-log', (req, res) => {
  console.log('--- CLIENT DEBUG LOG ---');
  console.log('Error message:', req.body.error);
  console.log('Raw text content length:', req.body.text?.length);
  console.log('Raw text content:\n', req.body.text);
  console.log('------------------------');
  res.json({ success: true });
});


app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`\n======================================================`);
  console.log(`⚡ Aetheris Backend running on http://localhost:${PORT}`);
  console.log(`📱 Mobile verknüpft! Öffne auf deinem Handy: http://${localIp}:5173`);
  console.log(`======================================================\n`);
});




