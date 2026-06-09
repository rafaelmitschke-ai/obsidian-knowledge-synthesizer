import React, { useState, useEffect, useRef } from 'react';
import SettingsModal from './components/SettingsModal';

const API_BASE = `http://${window.location.hostname}:5001`;

const repairTruncatedJson = (jsonStr) => {
  let cleaned = jsonStr.trim();
  
  let inString = false;
  let escapeNext = false;
  let stack = [];
  let repaired = "";

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    repaired += char;

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        stack.pop();
      }
    }
  }

  if (inString) {
    if (escapeNext) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  } else {
    let temp = repaired.trim();
    if (temp.endsWith(',') || temp.endsWith(':')) {
      temp = temp.slice(0, -1).trim();
    }
    repaired = temp;
  }

  while (stack.length > 0) {
    const openChar = stack.pop();
    if (openChar === '{') {
      repaired += '}';
    } else if (openChar === '[') {
      repaired += ']';
    }
  }

  return repaired;
};

const cleanAndParseJson = (text) => {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  
  // Escape raw newlines and tabs inside double quotes
  cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, function(match) {
    return match
      .replace(/\r?\n/g, '\\n')
      .replace(/\t/g, '\\t');
  });

  try {
    return JSON.parse(cleaned.trim());
  } catch (err) {
    console.warn('Initial JSON parsing failed. Attempting resilient repair...', err);
    try {
      const repaired = repairTruncatedJson(cleaned);
      return JSON.parse(repaired.trim());
    } catch (repairErr) {
      console.error('JSON repair and parsing failed. Raw text length:', cleaned.length, repairErr);
      fetch(`${API_BASE}/api/debug-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: err.message,
          text: cleaned
        })
      }).catch(() => {});
      throw err;
    }
  }
};

const buildAudioSchemaPrompt = (level) => {
  let schemaText = "";
  if (level === 'compact') {
    schemaText = `{
  "title": "Aussagekräftiger Titel",
  "summary": "Zusammenfassung in 3-4 Sätzen",
  "takeaways": ["Erkenntnis 1", "Erkenntnis 2", "Erkenntnis 3"],
  "content": "Kurze Gliederung mit Überschriften (##, ###) und Wiki-Links [[Verknüpfung]]",
  "todos": ["Schritt 1", "Schritt 2"],
  "flashcards": [{"q": "Frage?", "a": "Antwort"}],
  "tags": ["tag1", "tag2"],
  "wikiLinks": ["Konzept1"]
}`;
  } else if (level === 'detailed') {
    schemaText = `{
  "title": "Sehr ausgiebiger Titel",
  "summary": "Detaillierte Zusammenfassung in 1-2 Absätzen (6-8 Sätze)",
  "takeaways": [
    "Umfassende Erkenntnis 1 (hebe wichtige Begriffe **fett** hervor)",
    "Umfassende Erkenntnis 2",
    "Umfassende Erkenntnis 3",
    "Umfassende Erkenntnis 4",
    "Umfassende Erkenntnis 5",
    "Umfassende Erkenntnis 6",
    "Umfassende Erkenntnis 7",
    "Umfassende Erkenntnis 8"
  ],
  "content": "Sehr ausführliche, hierarchische Gliederung mit mindestens 6-8 Hauptüberschriften (##, ###) und detaillierten Textabschnitten (jeweils 1-2 Absätze pro Thema). Integriere wichtige Konzepte als Obsidian-Wiki-Links.",
  "todos": ["Schritt 1", "Schritt 2", "Schritt 3", "Schritt 4", "Schritt 5", "Schritt 6"],
  "flashcards": [
    {"q": "Anspruchsvolle Frage 1?", "a": "Detaillierte Antwort..."},
    {"q": "Frage 2?", "a": "Antwort 2..."},
    {"q": "Frage 3?", "a": "Antwort 3..."},
    {"q": "Frage 4?", "a": "Antwort 4..."},
    {"q": "Frage 5?", "a": "Antwort 5..."},
    {"q": "Frage 6?", "a": "Antwort 6..."},
    {"q": "Frage 7?", "a": "Antwort 7..."},
    {"q": "Frage 8?", "a": "Antwort 8..."}
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "wikiLinks": ["Konzept1", "Konzept2", "Konzept3"]
}`;
  } else if (level === 'comprehensive') {
    schemaText = `{
  "title": "Ausführlicher und umfassender Titel",
  "summary": "Detaillierter Überblick aus 2-3 Absätzen, der alle Themen einleitet",
  "takeaways": [
    "Sehr tiefgehende Erkenntnis 1 (hebe wichtige Begriffe **fett** hervor)",
    "Erkenntnis 2", "Erkenntnis 3", "Erkenntnis 4", "Erkenntnis 5",
    "Erkenntnis 6", "Erkenntnis 7", "Erkenntnis 8", "Erkenntnis 9",
    "Erkenntnis 10", "Erkenntnis 11", "Erkenntnis 12"
  ],
  "content": "Lehrbuchartige, extrem ausführliche und vollständige Ausarbeitung. Gliedere den Inhalt in mindestens 10-12 detaillierte Kapitel mit Unterüberschriften (##, ###, ####). Schreibe zu jedem Punkt ausführliche Fließtexte (mindestens 2 Absätze pro Abschnitt) und integriere 12-15 Obsidian-Wiki-Links.",
  "todos": [
    "Schritt 1", "Schritt 2", "Schritt 3", "Schritt 4", "Schritt 5",
    "Schritt 6", "Schritt 7", "Schritt 8", "Schritt 9", "Schritt 10"
  ],
  "flashcards": [
    {"q": "Lernfrage 1?", "a": "Ausführliche, präzise Erklärung..."},
    {"q": "Lernfrage 2?", "a": "Erklärung..."},
    {"q": "Lernfrage 3?", "a": "Erklärung..."},
    {"q": "Lernfrage 4?", "a": "Erklärung..."},
    {"q": "Lernfrage 5?", "a": "Erklärung..."},
    {"q": "Lernfrage 6?", "a": "Erklärung..."},
    {"q": "Lernfrage 7?", "a": "Erklärung..."},
    {"q": "Lernfrage 8?", "a": "Erklärung..."},
    {"q": "Lernfrage 9?", "a": "Erklärung..."},
    {"q": "Lernfrage 10?", "a": "Erklärung..."},
    {"q": "Lernfrage 11?", "a": "Erklärung..."},
    {"q": "Lernfrage 12?", "a": "Erklärung..."}
  ],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "wikiLinks": ["Konzept1", "Konzept2", "Konzept3", "Konzept4", "Konzept5"]
}`;
  } else { // exhaustive
    schemaText = `{
  "title": "Ausführlicher und umfassender Titel",
  "summary": "Ein umfassender Überblick aus 3-4 ausführlichen Absätzen, der alle Hauptthemen einleitet und zusammenfasst",
  "takeaways": [
    "Sehr tiefgehende Erkenntnis 1 (hebe wichtige Begriffe **fett** hervor)",
    "Sehr tiefgehende Erkenntnis 2", "Sehr tiefgehende Erkenntnis 3", "Sehr tiefgehende Erkenntnis 4",
    "Sehr tiefgehende Erkenntnis 5", "Sehr tiefgehende Erkenntnis 6", "Sehr tiefgehende Erkenntnis 7",
    "Sehr tiefgehende Erkenntnis 8", "Sehr tiefgehende Erkenntnis 9", "Sehr tiefgehende Erkenntnis 10",
    "Sehr tiefgehende Erkenntnis 11", "Sehr tiefgehende Erkenntnis 12", "Sehr tiefgehende Erkenntnis 13",
    "Sehr tiefgehende Erkenntnis 14", "Sehr tiefgehende Erkenntnis 15"
  ],
  "content": "Eine extrem ausführliche, lehrbuchartige und lückenlose Ausarbeitung aller Inhalte und Konzepte des Quellmaterials. Gliedere den Inhalt in 12-15 detaillierte Kapitel mit Unterüberschriften (##, ###, ####). Schreibe zu JEDEM Kapitel einen sehr ausführlichen Fließtext (mindestens 3-4 Absätze pro Abschnitt), erkläre theoretische Hintergründe im Detail, bringe praktische Beispiele, nenne konkrete Daten und Zitate aus dem Material und strukturiere den Text sehr leserfreundlich. Hebe wichtige Fachbegriffe fett hervor. Integriere 15-20 Obsidian-Wiki-Links. Nutze das verfügbare Token-Limit maximal aus (schreibe so viel Text wie möglich, ohne dich zu wiederholen).",
  "todos": [
    "Schritt 1", "Schritt 2", "Schritt 3", "Schritt 4", "Schritt 5",
    "Schritt 6", "Schritt 7", "Schritt 8", "Schritt 9", "Schritt 10",
    "Schritt 11", "Schritt 12", "Schritt 13", "Schritt 14", "Schritt 15"
  ],
  "flashcards": [
    {"q": "Lernfrage 1?", "a": "Ausführliche, präzise und tiefgehende Erklärung..."},
    {"q": "Lernfrage 2?", "a": "Erklärung..."},
    {"q": "Lernfrage 3?", "a": "Erklärung..."},
    {"q": "Lernfrage 4?", "a": "Erklärung..."},
    {"q": "Lernfrage 5?", "a": "Erklärung..."},
    {"q": "Lernfrage 6?", "a": "Erklärung..."},
    {"q": "Lernfrage 7?", "a": "Erklärung..."},
    {"q": "Lernfrage 8?", "a": "Erklärung..."},
    {"q": "Lernfrage 9?", "a": "Erklärung..."},
    {"q": "Lernfrage 10?", "a": "Erklärung..."},
    {"q": "Lernfrage 11?", "a": "Erklärung..."},
    {"q": "Lernfrage 12?", "a": "Erklärung..."},
    {"q": "Lernfrage 13?", "a": "Erklärung..."},
    {"q": "Lernfrage 14?", "a": "Erklärung..."},
    {"q": "Lernfrage 15?", "a": "Erklärung..."}
  ],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "wikiLinks": ["Konzept1", "Konzept2", "Konzept3", "Konzept4", "Konzept5", "Konzept6", "Konzept7"]
}`;
  }

  return `Du bist Aetheris, ein hochpräziser Wissens-Synthetisierer. Höre dir das angehängte Audio aufmerksam an und erstelle ein JSON-Wissensmodell auf **Deutsch**.
Du musst exakt dieses JSON-Schema zurückgeben:
${schemaText}`;
};

const chunkTranscriptByTime = (segments, maxDurationSeconds = 1800) => {
  if (!segments || segments.length === 0) return [];
  const chunks = [];
  let currentChunk = [];
  let currentStartTime = segments[0].start;
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentChunk.push(seg);
    const duration = (seg.start + seg.duration) - currentStartTime;
    if (duration >= maxDurationSeconds) {
      chunks.push({
        text: currentChunk.map(s => s.text).join(' '),
        start: currentStartTime,
        end: seg.start + seg.duration
      });
      currentChunk = [];
      if (i + 1 < segments.length) {
        currentStartTime = segments[i + 1].start;
      }
    }
  }
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.map(s => s.text).join(' '),
      start: currentStartTime,
      end: segments[segments.length - 1].start + segments[segments.length - 1].duration
    });
  }
  return chunks;
};

const chunkTextByWords = (text, maxWords = 5000) => {
  if (!text) return [];
  const paragraphs = text.split(/\r?\n/);
  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;
    
    const wordCount = trimmedPara.split(/\s+/).length;
    
    if (currentWordCount + wordCount > maxWords && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join('\n\n')
      });
      currentChunk = [trimmedPara];
      currentWordCount = wordCount;
    } else {
      currentChunk.push(trimmedPara);
      currentWordCount += wordCount;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join('\n\n')
    });
  }
  return chunks;
};

const formatTime = (seconds) => {
  if (seconds === undefined) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const mergeSynthesises = (results, mainTitle) => {
  if (!results || results.length === 0) return null;
  if (results.length === 1) return results[0];

  const title = mainTitle || results[0].title || "Synthesized Knowledge";
  const summary = results.map((r, idx) => `**Teil ${idx + 1}:** ${r.summary}`).join('\n\n');

  const takeaways = [];
  const takeawaySet = new Set();
  results.forEach(r => {
    if (Array.isArray(r.takeaways)) {
      r.takeaways.forEach(t => {
        if (t && !takeawaySet.has(t.toLowerCase())) {
          takeawaySet.add(t.toLowerCase());
          takeaways.push(t);
        }
      });
    }
  });

  const content = results.map((r, idx) => `## Teil ${idx + 1}: ${r.title || 'Abschnitt'}\n\n${r.content}`).join('\n\n---\n\n');

  const todos = [];
  const todoSet = new Set();
  results.forEach(r => {
    if (Array.isArray(r.todos)) {
      r.todos.forEach(t => {
        if (t && !todoSet.has(t.toLowerCase())) {
          todoSet.add(t.toLowerCase());
          todos.push(t);
        }
      });
    }
  });

  const flashcards = [];
  const questionSet = new Set();
  results.forEach(r => {
    if (Array.isArray(r.flashcards)) {
      r.flashcards.forEach(f => {
        if (f && f.q && !questionSet.has(f.q.toLowerCase())) {
          questionSet.add(f.q.toLowerCase());
          flashcards.push(f);
        }
      });
    }
  });

  const tags = [];
  const tagSet = new Set();
  results.forEach(r => {
    if (Array.isArray(r.tags)) {
      r.tags.forEach(t => {
        const cleanT = t.toLowerCase().trim().replace(/^#/, '');
        if (cleanT && !tagSet.has(cleanT)) {
          tagSet.add(cleanT);
          tags.push(t);
        }
      });
    }
  });

  const wikiLinks = [];
  const wikiSet = new Set();
  results.forEach(r => {
    if (Array.isArray(r.wikiLinks)) {
      r.wikiLinks.forEach(w => {
        if (w && !wikiSet.has(w.toLowerCase())) {
          wikiSet.add(w.toLowerCase());
          wikiLinks.push(w);
        }
      });
    }
  });

  return {
    title,
    summary,
    takeaways,
    content,
    todos,
    flashcards,
    tags,
    wikiLinks
  };
};

const DEFAULT_TEMPLATE = `---
title: "{{title}}"
source: "{{source}}"
type: "{{type}}"
synthesized: "{{date}}"
tags: {{tags}}
---

> [!summary] Zusammenfassung
> {{summary}}

> [!key-takeaways] Wichtigste Erkenntnisse
> {{takeaways}}

{{content}}

## Action Items & To-Dos
{{todos}}

## Concept Flashcards (Q&A)
{{flashcards}}`;

const GraphVisualizer = ({ data, onNodeSelect, activeNoteTitle }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const stateRef = useRef({
    nodes: [],
    links: [],
    draggedNode: null,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    mousePos: { x: 0, y: 0 }
  });

  useEffect(() => {
    const currentState = stateRef.current;
    const posMap = new Map();
    currentState.nodes.forEach(n => {
      posMap.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
    });

    const w = canvasRef.current ? canvasRef.current.width : 800;
    const h = canvasRef.current ? canvasRef.current.height : 500;

    currentState.nodes = data.nodes.map(n => {
      const prev = posMap.get(n.id);
      return {
        ...n,
        x: prev ? prev.x : (w / 2) + (Math.random() - 0.5) * 200,
        y: prev ? prev.y : (h / 2) + (Math.random() - 0.5) * 200,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0
      };
    });

    currentState.links = data.links;
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const resizeCanvas = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height || 500;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const updatePhysics = () => {
      const state = stateRef.current;
      const { nodes, links, draggedNode } = state;
      if (nodes.length === 0) return;

      const w = canvas.width;
      const h = canvas.height;
      const centerX = w / 2;
      const centerY = h / 2;

      // Stable physics settings
      const maxSpeed = 8;
      const repellingForce = 1200;
      const attractionForce = 0.04;
      const desiredLinkLength = 70;
      const gravity = 0.008;
      const friction = 0.82; // 18% energy loss per frame

      // 1. Repulsion (with softening factor to prevent infinite close-range forces)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          if (dist < 300) {
            // Softening factor (+300) prevents forces from shooting to infinity
            const force = repellingForce / (distSq + 300);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }
      }

      const nodeMap = {};
      nodes.forEach(n => { nodeMap[n.id] = n; });

      // 2. Attraction along links
      links.forEach(link => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - desiredLinkLength) * attractionForce;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          sourceNode.vx += fx;
          sourceNode.vy += fy;
          targetNode.vx -= fx;
          targetNode.vy -= fy;
        }
      });

      // 3. Gravity and Position Updates with Clamped Speeds
      nodes.forEach(node => {
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        node.vx += dx * gravity;
        node.vy += dy * gravity;

        if (node === draggedNode) {
          node.vx = 0;
          node.vy = 0;
        } else {
          // Clamp velocity to prevent high-speed escape (fireworks)
          const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy) || 1;
          if (speed > maxSpeed) {
            node.vx = (node.vx / speed) * maxSpeed;
            node.vy = (node.vy / speed) * maxSpeed;
          }

          node.x += node.vx;
          node.y += node.vy;
          node.vx *= friction;
          node.vy *= friction;
        }
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const state = stateRef.current;
      const { nodes, links } = state;

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      ctx.lineWidth = 1;
      const nodeMap = {};
      nodes.forEach(n => { nodeMap[n.id] = n; });

      links.forEach(link => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
          ctx.stroke();
        }
      });

      nodes.forEach(node => {
        const isCurrent = node.id === activeNoteTitle;
        const isSelected = selectedNode && selectedNode.id === node.id;
        const matchesFilter = searchQuery ? node.id.toLowerCase().includes(searchQuery.toLowerCase()) : false;
        
        const radius = isCurrent ? 8 : (isSelected ? 7 : 5);

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

        if (isCurrent) {
          ctx.fillStyle = '#c084fc';
          ctx.shadowColor = '#c084fc';
          ctx.shadowBlur = 12;
        } else if (matchesFilter) {
          ctx.fillStyle = '#facc15';
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 15;
        } else if (isSelected) {
          ctx.fillStyle = '#6366f1';
          ctx.shadowColor = '#6366f1';
          ctx.shadowBlur = 10;
        } else if (node.exists) {
          ctx.fillStyle = '#38bdf8';
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.4)';
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0;

        if (!node.exists) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 1, 0, Math.PI * 2);
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (zoom > 0.4 || isSelected || isCurrent || matchesFilter) {
          ctx.font = isCurrent || isSelected || matchesFilter ? 'bold 11px Inter, system-ui' : '9px Inter, system-ui';
          ctx.fillStyle = isCurrent ? '#c084fc' : (matchesFilter ? '#facc15' : (isSelected ? '#fff' : 'rgba(255, 255, 255, 0.7)'));
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y - radius - 5);
        }
      });

      ctx.restore();
    };

    const tick = () => {
      updatePhysics();
      draw();
      animationId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [pan, zoom, selectedNode, searchQuery, activeNoteTitle]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const getSimCoords = (canvasCoords) => {
    return {
      x: (canvasCoords.x - pan.x) / zoom,
      y: (canvasCoords.y - pan.y) / zoom
    };
  };

  const handleMouseDown = (e) => {
    if (e.touches && e.touches.length > 1) return;
    const coords = getCanvasCoords(e);
    const simCoords = getSimCoords(coords);
    const state = stateRef.current;

    let clickedNode = null;
    const clickRadius = 15;
    
    for (let i = 0; i < state.nodes.length; i++) {
      const n = state.nodes[i];
      const dx = n.x - simCoords.x;
      const dy = n.y - simCoords.y;
      if (dx * dx + dy * dy < clickRadius * clickRadius) {
        clickedNode = n;
        break;
      }
    }

    if (clickedNode) {
      state.draggedNode = clickedNode;
      setSelectedNode(clickedNode);
      onNodeSelect(clickedNode);
    } else {
      state.isPanning = true;
      state.panStart = { x: coords.x - pan.x, y: coords.y - pan.y };
    }
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasCoords(e);
    const simCoords = getSimCoords(coords);
    const state = stateRef.current;
    state.mousePos = coords;

    if (state.draggedNode) {
      state.draggedNode.x = simCoords.x;
      state.draggedNode.y = simCoords.y;
    } else if (state.isPanning) {
      setPan({
        x: coords.x - state.panStart.x,
        y: coords.y - state.panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    const state = stateRef.current;
    state.draggedNode = null;
    state.isPanning = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const zoomFactor = 1.1;
    let newZoom = zoom;

    if (e.deltaY < 0) {
      newZoom = Math.min(newZoom * zoomFactor, 5);
    } else {
      newZoom = Math.max(newZoom / zoomFactor, 0.15);
    }

    const dx = coords.x - pan.x;
    const dy = coords.y - pan.y;
    const newPan = {
      x: coords.x - (dx / zoom) * newZoom,
      y: coords.y - (dy / zoom) * newZoom
    };

    setZoom(newZoom);
    setPan(newPan);
  };

  const touchStartRef = useRef({ distance: 0, zoom: 1, pan: { x: 0, y: 0 } });
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartRef.current = {
        distance: dist,
        zoom: zoom,
        pan: { ...pan }
      };
    } else {
      handleMouseDown(e);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      
      const start = touchStartRef.current;
      if (start.distance > 0) {
        const factor = dist / start.distance;
        let newZoom = Math.max(0.15, Math.min(start.zoom * factor, 5));
        
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const coords = { x: midX - rect.left, y: midY - rect.top };

        const dx = coords.x - start.pan.x;
        const dy = coords.y - start.pan.y;
        const newPan = {
          x: coords.x - (dx / start.zoom) * newZoom,
          y: coords.y - (dy / start.zoom) * newZoom
        };

        setZoom(newZoom);
        setPan(newPan);
      }
    } else {
      handleMouseMove(e);
    }
  };

  return (
    <div ref={containerRef} className="graph-container" style={{ position: 'relative', width: '100%', height: '500px', background: 'rgba(10,12,24,0.3)', borderRadius: '12px', border: '1px solid var(--border-glass)', overflow: 'hidden' }}>
      
      <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, display: 'flex', gap: '8px', width: 'calc(100% - 24px)', maxWidth: '360px' }}>
        <input 
          type="text" 
          className="text-input"
          style={{ height: '36px', fontSize: '0.8rem', padding: '0 12px' }}
          placeholder="Filtere Notizen im Graph..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0 10px', height: '36px', minWidth: '40px' }} 
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        style={{ display: 'block', width: '100%', height: '100%', cursor: stateRef.current.draggedNode ? 'grabbing' : 'grab' }}
      />

      <div style={{ position: 'absolute', bottom: '12px', right: '12px', pointerEvents: 'none', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(15,23,42,0.6)', padding: '4px 8px', borderRadius: '4px' }}>
        🖱 Mausrad: Zoom | 👆 Ziehen: Pan
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('youtube'); // 'youtube' | 'text' | 'audio' | 'queue'
  
  // Single Inputs
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [audioPath, setAudioPath] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  // Bulk Queue Input State
  const [queue, setQueue] = useState([]);
  const [queueType, setQueueType] = useState('youtube');
  const [queueInput, setQueueInput] = useState('');
  const [queueTitle, setQueueTitle] = useState('');
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);

  // App Pipeline Loading State
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0: Idle, 1: Extract, 2: AI Analyze, 3: Completed
  const [errorMsg, setErrorMsg] = useState(null);
  const [synthesisProgress, setSynthesisProgress] = useState('');

  // Offline Search Engine States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Obsidian Copilot (RAG Search) States
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotAnswer, setCopilotAnswer] = useState(null);
  const [copilotSources, setCopilotSources] = useState([]);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState('');

  // Generated Content States
  const [generatedMarkdown, setGeneratedMarkdown] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [previewMode, setPreviewMode] = useState('preview'); // 'preview' | 'editor'
  const [detailLevel, setDetailLevel] = useState('detailed'); // 'compact' | 'detailed' | 'comprehensive'
  const [structuredData, setStructuredData] = useState(null); // Loaded JSON data from AI

  // Interactivity Modes
  const [activeStudyMode, setActiveStudyMode] = useState(false);
  const [studyCardIndex, setStudyCardIndex] = useState(0);
  const [studyCardFlipped, setStudyCardFlipped] = useState(false);
  const [studyCardResults, setStudyCardResults] = useState([]); // track user score
  
  const [activeGraphMode, setActiveGraphMode] = useState(false);
  const [draggedNode, setDraggedNode] = useState(null);
  const [graphOffsets, setGraphOffsets] = useState({}); // custom offsets for dragging

  // Settings & Status
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    apiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    openrouterApiKey: '',
    vaultPath: '',
    pdfPath: '',
    folder: 'Aetheris',
    titleTemplate: '{{title}}',
    language: 'auto',
    customTemplate: DEFAULT_TEMPLATE,
    routingRules: [],
    model: 'gemini-2.5-flash'
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [vaultNotes, setVaultNotes] = useState([]);
  const [toast, setToast] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Graph View States
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState(null);

  // Fetch Vault Graph Data
  const fetchGraphData = async () => {
    if (!settings.vaultPath) return;
    setIsGraphLoading(true);
    setSelectedGraphNode(null);
    try {
      const res = await fetch(`${API_BASE}/api/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultPath: settings.vaultPath, folder: settings.folder })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Fehler beim Laden des Graphen.');
      setGraphData(data);
    } catch (err) {
      console.error(err);
      triggerToast(err.message || 'Graph konnte nicht geladen werden.', 'error');
    } finally {
      setIsGraphLoading(false);
    }
  };

  // Podcast Directory Integration
  const [podcastQuery, setPodcastQuery] = useState('');
  const [podcasts, setPodcasts] = useState([]);
  const [selectedPodcast, setSelectedPodcast] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // Initialize and load settings
  useEffect(() => {
    let savedModel = localStorage.getItem('aetheris_model') || 'gemini-2.5-flash';
    if (savedModel === 'gemini-1.5-flash') {
      savedModel = 'gemini-2.5-flash';
      localStorage.setItem('aetheris_model', 'gemini-2.5-flash');
    } else if (savedModel === 'gemini-1.5-pro') {
      savedModel = 'gemini-2.5-pro';
      localStorage.setItem('aetheris_model', 'gemini-2.5-pro');
    }

    const loadedSettings = {
      apiKey: localStorage.getItem('aetheris_api_key') || '',
      openaiApiKey: localStorage.getItem('aetheris_openai_api_key') || '',
      anthropicApiKey: localStorage.getItem('aetheris_anthropic_api_key') || '',
      openrouterApiKey: localStorage.getItem('aetheris_openrouter_api_key') || '',
      vaultPath: localStorage.getItem('aetheris_vault_path') || '',
      pdfPath: localStorage.getItem('aetheris_pdf_path') || '',
      folder: localStorage.getItem('aetheris_folder') || 'Aetheris',
      titleTemplate: localStorage.getItem('aetheris_template') || '{{title}}',
      language: localStorage.getItem('aetheris_language') || 'auto',
      customTemplate: localStorage.getItem('aetheris_custom_template') || DEFAULT_TEMPLATE,
      routingRules: JSON.parse(localStorage.getItem('aetheris_routing_rules') || '[]'),
      model: savedModel
    };
    
    setSettings(loadedSettings);
    
    if (loadedSettings.vaultPath) {
      checkVaultConnection(loadedSettings.vaultPath, loadedSettings.folder);
    }
  }, []);

  // Fetch Graph Data on Tab Switch
  useEffect(() => {
    if (activeTab === 'graph') {
      fetchGraphData();
    }
  }, [activeTab]);

  // Handle query parameter for clipped notes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('clipped') === 'true') {
      triggerToast('Erfolgreich über Lesezeichen in die Warteschlange eingefügt!', 'success');
      const url = new URL(window.location.href);
      url.searchParams.delete('clipped');
      window.history.replaceState({}, document.title, url.pathname + url.search);
      setActiveTab('queue');
    }
  }, []);

  // Helper to load queue from server
  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/queue`);
      const data = await res.json();
      if (data.success && Array.isArray(data.queue)) {
        setQueue(data.queue);
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    }
  };

  // Helper to update queue item status on server
  const updateQueueItemStatus = async (id, status, error) => {
    try {
      await fetch(`${API_BASE}/api/queue/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, error })
      });
    } catch (err) {
      console.error('Failed to update queue item status:', err);
    }
  };

  // Poll queue from server periodically
  useEffect(() => {
    if (!isProcessingQueue) {
      fetchQueue();
    }
    const interval = setInterval(() => {
      if (!isProcessingQueue) {
        fetchQueue();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [API_BASE, isProcessingQueue]);

  const triggerToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const checkVaultConnection = async (vaultPath, folder) => {
    try {
      const res = await fetch(`${API_BASE}/api/list-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultPath, folder })
      });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus('connected');
        setVaultNotes(data.notes || []);
      } else {
        setConnectionStatus('disconnected');
        setVaultNotes([]);
      }
    } catch (err) {
      setConnectionStatus('disconnected');
      setVaultNotes([]);
      console.error('Failed to connect to local server:', err);
    }
  };

  const handleSettingsSave = (newSettings) => {
    setSettings(newSettings);
    triggerToast('Einstellungen gespeichert!', 'success');
    if (newSettings.vaultPath) {
      checkVaultConnection(newSettings.vaultPath, newSettings.folder);
    } else {
      setConnectionStatus('disconnected');
    }
  };

  // Compile Markdown Note from Structured AI JSON & User Custom Template
  const compileTemplate = (aiData, sourceInfo, noteType) => {
    const template = settings.customTemplate || DEFAULT_TEMPLATE;
    const dateStr = new Date().toLocaleDateString('de-DE');
    
    // Format takeaways
    const takeaways = aiData?.takeaways || [];
    const takeawaysStr = takeaways.map(t => `- ${t}`).join('\n');
    // Format todos
    const todos = aiData?.todos || [];
    const todosStr = todos.map(t => `- [ ] ${t}`).join('\n');
    // Format flashcards
    const flashcards = aiData?.flashcards || [];
    const flashcardsStr = flashcards.map(f => `- **F:** ${f.q}\n  - **A:** ${f.a}`).join('\n');
    // Format tags
    const tags = aiData?.tags || [];
    const tagsStr = `[${tags.map(t => t.toLowerCase().trim().replace(/^#/, '')).join(', ')}]`;

    let compiled = template
      .replace(/\{\{title\}\}/g, aiData?.title || 'Ohne Titel')
      .replace(/\{\{source\}\}/g, sourceInfo || '')
      .replace(/\{\{type\}\}/g, noteType || '')
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{tags\}\}/g, tagsStr)
      .replace(/\{\{summary\}\}/g, aiData?.summary || '')
      .replace(/\{\{takeaways\}\}/g, takeawaysStr)
      .replace(/\{\{content\}\}/g, aiData?.content || '')
      .replace(/\{\{todos\}\}/g, todosStr)
      .replace(/\{\{flashcards\}\}/g, flashcardsStr);

    return compiled;
  };

  // Tag-based Smart Folder Routing Rule Resolver
  const resolveSaveFolder = (tags) => {
    if (!tags || tags.length === 0 || !settings.routingRules || settings.routingRules.length === 0) {
      return settings.folder;
    }

    const cleanedTags = tags.map(t => t.toLowerCase().trim().replace(/^#/, ''));
    
    for (const rule of settings.routingRules) {
      if (cleanedTags.includes(rule.tag.toLowerCase().trim())) {
        return rule.subfolder;
      }
    }
    
    return settings.folder; // Default subfolder
  };

  // Direct AI Synthesis utilizing Gemini JSON-mode
  const runAiSynthesis = async (contentToAnalyze, sourceInfo, noteType) => {
    const targetLang = settings.language === 'auto' ? 'Deutsch' : (settings.language === 'de' ? 'Deutsch' : 'Englisch');
    
    let detailInstructions = "";
    if (detailLevel === 'compact') {
      detailInstructions = `
Du musst exakt das folgende JSON-Schema einhalten:
{
  "title": "Aussagekräftiger, prägnanter Notiztitel",
  "summary": "Kurze Zusammenfassung in 3-4 Sätzen",
  "takeaways": [
    "Wichtige Erkenntnis 1 (verwende **fette** Schlüsselbegriffe)",
    "Wichtige Erkenntnis 2",
    "Wichtige Erkenntnis 3"
  ],
  "content": "Hier folgt die strukturierte Gliederung mit Markdown Überschriften (##, ###) und kurzen Stichpunkten. Hebe wichtige Begriffe **fett** hervor. Integriere 3-5 Obsidian Wiki-Links (z.B. [[Konzept]]). Verwende KEINE h1 Überschriften (#), starte direkt mit h2 (##).",
  "todos": [
    "Schritt 1",
    "Schritt 2",
    "Schritt 3"
  ],
  "flashcards": [
    {
      "q": "Frage 1 zum Lernen?",
      "a": "Präzise, leicht verständliche Antwort..."
    },
    {
      "q": "Frage 2?",
      "a": "Antwort..."
    },
    {
      "q": "Frage 3?",
      "a": "Antwort..."
    }
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "wikiLinks": ["Konzept1", "Konzept2"]
}`;
    } else if (detailLevel === 'detailed') {
      detailInstructions = `
Du musst exakt das folgende JSON-Schema einhalten:
{
  "title": "Aussagekräftiger, prägnanter Notiztitel",
  "summary": "Detaillierte Zusammenfassung in 1-2 Absätzen (6-8 Sätze)",
  "takeaways": [
    "Wichtige Erkenntnis 1 (verwende **fette** Schlüsselbegriffe)",
    "Wichtige Erkenntnis 2",
    "Wichtige Erkenntnis 3",
    "Wichtige Erkenntnis 4",
    "Wichtige Erkenntnis 5",
    "Wichtige Erkenntnis 6",
    "Wichtige Erkenntnis 7",
    "Wichtige Erkenntnis 8"
  ],
  "content": "Hier folgt die ausführliche strukturierte Gliederung mit Markdown Überschriften (##, ###) und detaillierten Textabschnitten (jeweils 1-2 Absätze pro Thema). Hebe wichtige Begriffe **fett** hervor. Integriere 6-10 Obsidian-Wiki-Links.",
  "todos": [
    "Schritt 1", "Schritt 2", "Schritt 3", "Schritt 4", "Schritt 5", "Schritt 6"
  ],
  "flashcards": [
    { "q": "Frage 1?", "a": "Detaillierte Antwort..." },
    { "q": "Frage 2?", "a": "Antwort..." },
    { "q": "Frage 3?", "a": "Antwort..." },
    { "q": "Frage 4?", "a": "Antwort..." },
    { "q": "Frage 5?", "a": "Antwort..." },
    { "q": "Frage 6?", "a": "Antwort..." },
    { "q": "Frage 7?", "a": "Antwort..." },
    { "q": "Frage 8?", "a": "Antwort..." }
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "wikiLinks": ["Konzept1", "Konzept2", "Konzept3"]
}`;
    } else if (detailLevel === 'comprehensive') {
      detailInstructions = `
Du musst exakt das folgende JSON-Schema einhalten:
{
  "title": "Umfassender und sehr detaillierter Notiztitel",
  "summary": "Ein umfassender Überblick aus 2-3 ausführlichen Absätzen, der alle Hauptthemen einleitet",
  "takeaways": [
    "Wichtige Erkenntnis 1 (verwende **fette** Schlüsselbegriffe)",
    "Erkenntnis 2", "Erkenntnis 3", "Erkenntnis 4", "Erkenntnis 5",
    "Erkenntnis 6", "Erkenntnis 7", "Erkenntnis 8", "Erkenntnis 9",
    "Erkenntnis 10", "Erkenntnis 11", "Erkenntnis 12"
  ],
  "content": "Eine lehrbuchartige, extrem ausführliche und vollständige Ausarbeitung. Gliedere den Inhalt in mindestens 10-12 detaillierte Kapitel mit Unterüberschriften (##, ###, ####). Schreibe zu jedem Punkt ausführliche Fließtexte (mindestens 2 Absätze pro Abschnitt), erkläre theoretische Hintergründe, bringe Beispiele und strukturiere den Text sehr leserfreundlich. Hebe wichtige Fachbegriffe fett hervor. Integriere 12-15 Obsidian-Wiki-Links.",
  "todos": [
    "Schritt 1", "Schritt 2", "Schritt 3", "Schritt 4", "Schritt 5",
    "Schritt 6", "Schritt 7", "Schritt 8", "Schritt 9", "Schritt 10"
  ],
  "flashcards": [
    { "q": "Lernfrage 1?", "a": "Ausführliche, präzise Erklärung..." },
    { "q": "Lernfrage 2?", "a": "Erklärung..." },
    { "q": "Lernfrage 3?", "a": "Erklärung..." },
    { "q": "Lernfrage 4?", "a": "Erklärung..." },
    { "q": "Lernfrage 5?", "a": "Erklärung..." },
    { "q": "Lernfrage 6?", "a": "Erklärung..." },
    { "q": "Lernfrage 7?", "a": "Erklärung..." },
    { "q": "Lernfrage 8?", "a": "Erklärung..." },
    { "q": "Lernfrage 9?", "a": "Erklärung..." },
    { "q": "Lernfrage 10?", "a": "Erklärung..." },
    { "q": "Lernfrage 11?", "a": "Erklärung..." },
    { "q": "Lernfrage 12?", "a": "Erklärung..." }
  ],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "wikiLinks": ["Konzept1", "Konzept2", "Konzept3", "Konzept4", "Konzept5"]
}`;
    } else { // exhaustive
      detailInstructions = `
Du musst exakt das folgende JSON-Schema einhalten:
{
  "title": "Umfassender und sehr detaillierter Notiztitel",
  "summary": "Ein umfassender Überblick aus 3-4 ausführlichen Absätzen, der alle Hauptthemen einleitet und zusammenfasst",
  "takeaways": [
    "Sehr tiefgehende Erkenntnis 1 (verwende **fette** Schlüsselbegriffe)",
    "Sehr tiefgehende Erkenntnis 2", "Sehr tiefgehende Erkenntnis 3", "Sehr tiefgehende Erkenntnis 4", 
    "Sehr tiefgehende Erkenntnis 5", "Sehr tiefgehende Erkenntnis 6", "Sehr tiefgehende Erkenntnis 7", 
    "Sehr tiefgehende Erkenntnis 8", "Sehr tiefgehende Erkenntnis 9", "Sehr tiefgehende Erkenntnis 10",
    "Sehr tiefgehende Erkenntnis 11", "Sehr tiefgehende Erkenntnis 12", "Sehr tiefgehende Erkenntnis 13",
    "Sehr tiefgehende Erkenntnis 14", "Sehr tiefgehende Erkenntnis 15"
  ],
  "content": "Eine extrem ausführliche, lehrbuchartige und lückenlose Ausarbeitung aller Inhalte und Konzepte des Quellmaterials. Gliedere den Inhalt in 12-15 detaillierte Kapitel mit Unterüberschriften (##, ###, ####). Schreibe zu JEDEM Kapitel einen sehr ausführlichen Fließtext (mindestens 3-4 Absätze pro Abschnitt), erkläre theoretische Hintergründe im Detail, bringe praktische Beispiele, nenne konkrete Daten und Zitate aus dem Material und strukturiere den Text sehr leserfreundlich. Hebe wichtige Fachbegriffe fett hervor. Integriere 15-20 Obsidian-Wiki-Links. Nutze das verfügbare Token-Limit maximal aus (schreibe so viel Text wie möglich, ohne dich zu wiederholen).",
  "todos": [
    "Schritt 1", "Schritt 2", "Schritt 3", "Schritt 4", "Schritt 5",
    "Schritt 6", "Schritt 7", "Schritt 8", "Schritt 9", "Schritt 10",
    "Schritt 11", "Schritt 12", "Schritt 13", "Schritt 14", "Schritt 15"
  ],
  "flashcards": [
    { "q": "Lernfrage 1?", "a": "Ausführliche, präzise und tiefgehende Erklärung..." },
    { "q": "Lernfrage 2?", "a": "Erklärung..." },
    { "q": "Lernfrage 3?", "a": "Erklärung..." },
    { "q": "Lernfrage 4?", "a": "Erklärung..." },
    { "q": "Lernfrage 5?", "a": "Erklärung..." },
    { "q": "Lernfrage 6?", "a": "Erklärung..." },
    { "q": "Lernfrage 7?", "a": "Erklärung..." },
    { "q": "Lernfrage 8?", "a": "Erklärung..." },
    { "q": "Lernfrage 9?", "a": "Erklärung..." },
    { "q": "Lernfrage 10?", "a": "Erklärung..." },
    { "q": "Lernfrage 11?", "a": "Erklärung..." },
    { "q": "Lernfrage 12?", "a": "Erklärung..." },
    { "q": "Lernfrage 13?", "a": "Erklärung..." },
    { "q": "Lernfrage 14?", "a": "Erklärung..." },
    { "q": "Lernfrage 15?", "a": "Erklärung..." }
  ],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "wikiLinks": ["Konzept1", "Konzept2", "Konzept3", "Konzept4", "Konzept5", "Konzept6", "Konzept7"]
}`;
    }

    const prompt = `Du bist Aetheris, ein hochpräziser Wissens-Synthetisierer.
Deine Aufgabe ist es, das folgende Textmaterial zu analysieren und ein extrem nützliches JSON-Wissensmodell auf **${targetLang}** zu erstellen.

${detailInstructions}

Gib AUSSCHLIESSLICH das gültige JSON-Objekt zurück. Schreibe KEINE einleitenden Sätze, KEINE Kommentare und verwende KEINE Markdown-Code-Blöcke wie \`\`\`json.

Hier ist das Textmaterial zur Analyse:
---
${contentToAnalyze}
`;

    let selectedModel = settings.model || 'gemini-2.5-flash';
    if (selectedModel === 'gemini-1.5-flash') {
      selectedModel = 'gemini-2.5-flash';
    } else if (selectedModel === 'gemini-1.5-pro') {
      selectedModel = 'gemini-2.5-pro';
    }

    try {
      const res = await fetch(`${API_BASE}/api/synthesize-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          openaiApiKey: settings.openaiApiKey,
          anthropicApiKey: settings.anthropicApiKey,
          openrouterApiKey: settings.openrouterApiKey,
          prompt: prompt,
          model: selectedModel
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Fehler bei der Synthese.');
      }

      const parsedData = cleanAndParseJson(data.text);
      return parsedData;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Perform Synthesis Flow
  const handleSynthesize = async () => {
    setErrorMsg(null);
    setSynthesisProgress('');
    
    const model = settings.model || 'gemini-2.5-flash';
    const isGemini = model.startsWith('gemini-');
    const isOpenAi = model.startsWith('gpt-');
    const isAnthropic = model.startsWith('claude-');
    const isOpenRouter = model.includes('/');

    if (isGemini && !settings.apiKey) {
      setErrorMsg('Bitte hinterlege zuerst deinen Gemini API-Key in den Einstellungen.');
      setShowSettings(true);
      return;
    }
    if (isOpenAi && !settings.openaiApiKey) {
      setErrorMsg('Bitte hinterlege zuerst deinen OpenAI API-Key in den Einstellungen.');
      setShowSettings(true);
      return;
    }
    if (isAnthropic && !settings.anthropicApiKey) {
      setErrorMsg('Bitte hinterlege zuerst deinen Anthropic API-Key in den Einstellungen.');
      setShowSettings(true);
      return;
    }
    if (isOpenRouter && !settings.openrouterApiKey) {
      setErrorMsg('Bitte hinterlege zuerst deinen OpenRouter API-Key in den Einstellungen.');
      setShowSettings(true);
      return;
    }

    setIsLoading(true);
    try {
      let contentToAnalyze = '';
      let sourceInfo = '';
      let noteType = 'text-document';
      let chunks = [];

      if (activeTab === 'audio') {
        if (!audioPath && !audioUrl) throw new Error('Bitte gib einen Dateipfad oder eine Audio-URL an.');
        
        // Intercept Spotify URL pasted in the Audio tab!
        if (audioUrl && audioUrl.includes('open.spotify.com')) {
          triggerToast('Spotify-Links werden automatisch aufgelöst und im Podcast-Tab gesucht...', 'info');
          setPodcastQuery(audioUrl);
          setActiveTab('podcasts');
          handleSearchPodcasts(audioUrl);
          setIsLoading(false);
          return;
        }

        setCurrentStep(1); // Load audio
        
        sourceInfo = audioPath ? `Lokale Datei: ${audioPath}` : audioUrl;
        noteType = 'audio-podcast';

        const prompt = buildAudioSchemaPrompt(detailLevel);
        setCurrentStep(2);
        const res = await fetch(`${API_BASE}/api/analyze-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: settings.apiKey,
            openaiApiKey: settings.openaiApiKey,
            anthropicApiKey: settings.anthropicApiKey,
            openrouterApiKey: settings.openrouterApiKey,
            localPath: audioPath,
            audioUrl: audioUrl,
            prompt: prompt,
            model: settings.model || 'gemini-2.5-flash'
          })
        });

        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Fehler bei Audio-Analyse.');

        // Parse structured data from audio API response
        const parsedAudioData = cleanAndParseJson(data.markdown);
        const compiled = compileTemplate(parsedAudioData, sourceInfo, noteType);

        setStructuredData(parsedAudioData);
        setGeneratedMarkdown(compiled);
        setGeneratedTitle(parsedAudioData.title);
        setCurrentStep(3);
        triggerToast('Erfolgreich synthetisiert!', 'success');
        return;
      }

      if (activeTab === 'youtube') {
        if (!youtubeUrl) throw new Error('Bitte gib eine gültige YouTube URL ein.');
        setCurrentStep(1); // Fetch transcript

        const response = await fetch(`${API_BASE}/api/transcript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: youtubeUrl })
        });
        
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Fehler beim Transkript.');
        
        contentToAnalyze = data.text;
        sourceInfo = youtubeUrl;
        noteType = 'youtube-video';

        // Check word count to decide whether to chunk
        const totalWords = data.text.split(/\s+/).length;
        if (totalWords > 6000 && data.segments && data.segments.length > 0) {
          chunks = chunkTranscriptByTime(data.segments, 1800);
        } else if (totalWords > 6000) {
          chunks = chunkTextByWords(data.text, 5000);
        } else {
          chunks = [{ text: data.text }];
        }
      } else {
        if (!rawText) throw new Error('Bitte gib einen Text ein.');
        contentToAnalyze = rawText;
        sourceInfo = 'Pasted Text';
        noteType = 'text-document';

        const totalWords = rawText.split(/\s+/).length;
        if (totalWords > 6000) {
          chunks = chunkTextByWords(rawText, 5000);
        } else {
          chunks = [{ text: rawText }];
        }
      }

      setCurrentStep(2); // AI Analysis
      let aiResponse;

      if (chunks.length > 1) {
        const results = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          let progressText = `Analysiere Teil ${i + 1} von ${chunks.length}`;
          if (chunk.start !== undefined && chunk.end !== undefined) {
            progressText += ` (${formatTime(chunk.start)} - ${formatTime(chunk.end)})`;
          }
          progressText += '...';
          setSynthesisProgress(progressText);
          
          const chunkRes = await runAiSynthesis(chunk.text, sourceInfo, noteType);
          results.push(chunkRes);
        }
        setSynthesisProgress('Führe Notiz-Teile zusammen...');
        aiResponse = mergeSynthesises(results, generatedTitle);
      } else {
        setSynthesisProgress('Gemini AI analysiert den Inhalt...');
        aiResponse = await runAiSynthesis(chunks[0].text, sourceInfo, noteType);
      }

      const compiledMd = compileTemplate(aiResponse, sourceInfo, noteType);

      setStructuredData(aiResponse);
      setGeneratedMarkdown(compiledMd);
      setGeneratedTitle(aiResponse.title);
      setCurrentStep(3);
      triggerToast('Erfolgreich synthetisiert!', 'success');

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setCurrentStep(0);
      triggerToast('Synthese fehlgeschlagen.', 'error');
    } finally {
      setIsLoading(false);
      setSynthesisProgress('');
    }
  };

   // Search podcast index
   const handleSearchPodcasts = async (queryOverride = null) => {
     const activeQuery = queryOverride || podcastQuery;
     if (!activeQuery.trim()) return;
     setSearchLoading(true);
     setSelectedPodcast(null);
     setPodcasts([]);
     
     const isSpotify = activeQuery.includes('open.spotify.com');
     
     try {
       if (isSpotify) {
         triggerToast('Löse Spotify-Link auf...', 'info');
         const res = await fetch(`${API_BASE}/api/podcasts/resolve-spotify`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ spotifyUrl: activeQuery.trim(), apiKey: settings.apiKey })
         });
         const data = await res.json();
         if (!res.ok || data.error) throw new Error(data.error || 'Fehler bei der Spotify-Auflösung.');
         
         if (data.type === 'show') {
           setPodcastQuery(data.showTitle);
           setPodcasts([data.podcast]);
           handleSelectPodcast(data.podcast);
         } else if (data.type === 'episode') {
           setPodcastQuery(data.showTitle);
           setPodcasts([data.podcast]);
           
           setSelectedPodcast(data.podcast);
           setEpisodes([]);
           setEpisodesLoading(true);
           
           const epRes = await fetch(`${API_BASE}/api/podcasts/episodes`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ feedUrl: data.podcast.feedUrl })
           });
           const epData = await epRes.json();
           if (!epRes.ok || epData.error) throw new Error(epData.error || 'Fehler beim Laden der Episoden.');
           
           setEpisodes(epData.episodes || []);
           setEpisodesLoading(false);
           
           // Find matched episode
           const matchedEp = (epData.episodes || []).find(e => 
             e.title.toLowerCase().replace(/[^a-z0-9]/g, '') === data.episode.title.toLowerCase().replace(/[^a-z0-9]/g, '') ||
             e.audioUrl === data.episode.audioUrl
           );
           
           if (matchedEp) {
             triggerToast(`Episode gefunden: "${matchedEp.title}"!`, 'success');
             handleSynthesizeEpisode(matchedEp);
           } else {
             triggerToast(`Podcast geladen, aber Episode "${data.episode.title}" wurde im RSS-Feed nicht gefunden.`, 'warning');
           }
         }
       } else {
         const res = await fetch(`${API_BASE}/api/podcasts/search?q=${encodeURIComponent(activeQuery)}`);
         const data = await res.json();
         if (!res.ok || data.error) throw new Error(data.error || 'Fehler bei der Podcast-Suche.');
         setPodcasts(data.podcasts || []);
       }
     } catch (err) {
       console.error(err);
       triggerToast(err.message || 'Podcast-Suche fehlgeschlagen.', 'error');
     } finally {
       setSearchLoading(false);
     }
   };

   // Select a podcast and parse its RSS Feed
   const handleSelectPodcast = async (podcast) => {
     setSelectedPodcast(podcast);
     setEpisodes([]);
     setEpisodesLoading(true);
     try {
       const res = await fetch(`${API_BASE}/api/podcasts/episodes`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ feedUrl: podcast.feedUrl })
       });
       const data = await res.json();
       if (!res.ok || data.error) throw new Error(data.error || 'Fehler beim Laden der Episoden.');
       setEpisodes(data.episodes || []);
     } catch (err) {
       console.error(err);
       triggerToast(err.message || 'Episoden konnten nicht geladen werden.', 'error');
     } finally {
       setEpisodesLoading(false);
     }
   };

   // Synthesize Podcast Episode via backend downloading and Gemini File API
   const handleSynthesizeEpisode = async (episode) => {
     setErrorMsg(null);
     if (!settings.apiKey) {
       setErrorMsg('Bitte hinterlege zuerst deinen Gemini API-Key in den Einstellungen.');
       setShowSettings(true);
       return;
     }

     setIsLoading(true);
     setCurrentStep(1); // Load audio
     try {
       const sourceInfo = `${selectedPodcast.title}: ${episode.title}`;
       const noteType = 'audio-podcast';

       const prompt = buildAudioSchemaPrompt(detailLevel);
       
       setCurrentStep(2); // Upload & analyze
       const res = await fetch(`${API_BASE}/api/analyze-audio`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           apiKey: settings.apiKey,
           audioUrl: episode.audioUrl,
           prompt: prompt,
           model: settings.model || 'gemini-1.5-flash'
         })
       });

       const data = await res.json();
       if (!res.ok || data.error) throw new Error(data.error || 'Fehler bei Audio-Analyse.');

       const parsedAudioData = cleanAndParseJson(data.markdown);
       const compiled = compileTemplate(parsedAudioData, episode.audioUrl, noteType);

       setStructuredData(parsedAudioData);
       setGeneratedMarkdown(compiled);
       setGeneratedTitle(parsedAudioData.title);
       setCurrentStep(3);
       triggerToast('Podcast erfolgreich synthetisiert!', 'success');
     } catch (err) {
       console.error(err);
       setErrorMsg(err.message || 'Fehler bei der Synthese.');
       setCurrentStep(0);
     } finally {
       setIsLoading(false);
     }
   };

  // Save the generated Markdown to Obsidian Vault (utilizing tag-routing)
  const handleSaveToObsidian = async () => {
    if (!settings.vaultPath) {
      triggerToast('Bitte Vault-Pfad in den Einstellungen einrichten.', 'error');
      setShowSettings(true);
      return;
    }

    try {
      // Run smart folder routing logic based on generated tags
      const targetSubfolder = resolveSaveFolder(structuredData?.tags || []);

      const res = await fetch(`${API_BASE}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultPath: settings.vaultPath,
          folder: targetSubfolder,
          fileName: generatedTitle,
          content: generatedMarkdown,
          pdfPath: settings.pdfPath
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Fehler beim Speichern.');

      const cleanFolderName = targetSubfolder.split(/[\\/]/).pop();
      triggerToast(`Gespeichert in: .../${cleanFolderName}/${generatedTitle}.md`, 'success');
      
      // Refresh notes list
      checkVaultConnection(settings.vaultPath, settings.folder);
    } catch (err) {
      console.error(err);
      triggerToast(err.message, 'error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!generatedTitle || !generatedMarkdown) {
      triggerToast('Keine Notiz zum Herunterladen vorhanden.', 'error');
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/download-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedTitle,
          content: generatedMarkdown
        })
      });

      if (!res.ok) {
        throw new Error('PDF-Download fehlgeschlagen.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      triggerToast('PDF-Download gestartet!', 'success');
    } catch (err) {
      console.error(err);
      triggerToast('Fehler beim Generieren/Herunterladen der PDF.', 'error');
    }
  };

  // Load a note's text content and parse tags/meta
  const handleLoadNoteContent = async (fileName, isVaultRelative = false) => {
    try {
      const readRes = await fetch(`${API_BASE}/api/read-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultPath: settings.vaultPath, folder: settings.folder, fileName, isVaultRelative })
      });
      const readData = await readRes.json();
      if (readData.success) {
        setGeneratedMarkdown(readData.content);
        const cleanTitle = fileName.split('/').pop().replace(/\.md$/, '');
        setGeneratedTitle(cleanTitle);
        
        // Mock structured data wrapper for loaded notes to enable study/graph views if possible
        // (Just parses a simple mock list from the file to satisfy previews)
        const mockTags = [];
        const mockWiki = [];
        const wikiRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = wikiRegex.exec(readData.content)) !== null) {
          mockWiki.push(match[1].split('|')[0]);
        }
        
        setStructuredData({
          title: cleanTitle,
          tags: mockTags.length > 0 ? mockTags : ['Geladen'],
          wikiLinks: mockWiki.length > 0 ? mockWiki : ['Wissen'],
          flashcards: [
            { q: 'Wie lautet der Titel dieser geladenen Notiz?', a: cleanTitle },
            { q: 'Wie kann ich dieses Wissen verknüpfen?', a: 'Nutze Obsidian Wiki-Links [[Verknüpfung]]!' }
          ]
        });

        setCurrentStep(3);
        triggerToast('Notiz geladen!', 'success');
      } else {
        triggerToast('Fehler beim Laden.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Serververbindung fehlgeschlagen.', 'error');
    }
  };

  const handleSearchNotes = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultPath: settings.vaultPath,
          folder: settings.folder,
          query: q
        })
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results || []);
      } else {
        triggerToast(data.error || 'Fehler bei der Suche.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Verbindung zur Suche fehlgeschlagen.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleNoteSelect = async (title) => {
    if (!title) return;
    const normalizedTitle = title.replace(/\.md$/, '').trim().toLowerCase();
    const note = vaultNotes.find(n => n.title && n.title.replace(/\.md$/, '').trim().toLowerCase() === normalizedTitle);
    const fileName = note ? note.fileName : `${title}.md`;
    
    setActiveTab('text');
    await handleLoadNoteContent(fileName);
  };

  const handleCopilotSearch = async (e) => {
    if (e) e.preventDefault();
    if (!copilotQuery.trim()) return;

    if (!settings.apiKey) {
      setErrorMsg('Bitte trage deinen Gemini API-Key in den Einstellungen (Zahnrad-Symbol oben rechts) ein.');
      return;
    }
    if (!settings.vaultPath) {
      setErrorMsg('Bitte trage deinen Obsidian-Tresorpfad in den Einstellungen ein.');
      return;
    }

    setIsCopilotLoading(true);
    setCopilotStatus('Durchsuche Obsidian-Tresor...');
    setCopilotAnswer(null);
    setCopilotSources([]);
    setErrorMsg(null);

    const statusTimer = setTimeout(() => {
      setCopilotStatus('KI formuliert Antwort...');
    }, 1500);

    try {
      const res = await fetch(`${API_BASE}/api/copilot/search-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultPath: settings.vaultPath,
          folder: settings.folder,
          query: copilotQuery,
          apiKey: settings.apiKey,
          openaiApiKey: settings.openaiApiKey,
          anthropicApiKey: settings.anthropicApiKey,
          openrouterApiKey: settings.openrouterApiKey,
          model: settings.model
        })
      });
      
      clearTimeout(statusTimer);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler bei der Suche.');
      }

      const data = await res.json();
      if (data.success) {
        setCopilotAnswer(data.answer);
        setCopilotSources(data.sources || []);
      } else {
        throw new Error(data.error || 'Fehler bei der Suche.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Fehler bei der KI-gestützten Suche.');
    } finally {
      setIsCopilotLoading(false);
      setCopilotStatus('');
    }
  };

  // PILLAR 1: Bulk Queue Processing Manager
  const handleAddToQueue = async () => {
    if (!queueInput.trim()) return;
    const titleVal = queueTitle.trim() || `Stapel_${queueType}_${new Date().toLocaleTimeString('de-DE')}`;
    
    try {
      const res = await fetch(`${API_BASE}/api/queue/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: queueType,
          inputVal: queueInput.trim(),
          inputTitle: titleVal
        })
      });
      const data = await res.json();
      if (data.success) {
        setQueueInput('');
        setQueueTitle('');
        triggerToast('Zur Warteschlange hinzugefügt!', 'success');
        fetchQueue();
      } else {
        triggerToast(data.error || 'Fehler beim Hinzufügen.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Verbindung zum Server fehlgeschlagen.', 'error');
    }
  };

  const handleRemoveFromQueue = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/queue/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchQueue();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleProcessQueue = async () => {
    if (queue.length === 0 || isProcessingQueue) return;
    if (!settings.apiKey) {
      triggerToast('Bitte hinterlege zuerst deinen API-Key.', 'error');
      setShowSettings(true);
      return;
    }
    if (!settings.vaultPath) {
      triggerToast('Bitte hinterlege zuerst deinen Vault-Pfad.', 'error');
      setShowSettings(true);
      return;
    }

    setIsProcessingQueue(true);
    triggerToast('Warteschlange wird verarbeitet...', 'success');

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'completed') continue; // Skip already finished ones
      
      setCurrentQueueIndex(i);
      
      // Update status to processing
      const updatedQueue = [...queue];
      updatedQueue[i].status = 'processing';
      setQueue(updatedQueue);
      await updateQueueItemStatus(queue[i].id, 'processing');

      try {
        const item = queue[i];
        let contentToAnalyze = '';
        let sourceInfo = '';
        let noteType = 'text-document';
        let segments = null;

        if (item.type === 'youtube') {
          // 1. Fetch transcript
          const transRes = await fetch(`${API_BASE}/api/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.inputVal })
          });
          const transData = await transRes.json();
          if (!transRes.ok || transData.error) throw new Error(transData.error || 'Fehler beim Transkript.');
          
          contentToAnalyze = transData.text;
          sourceInfo = item.inputVal;
          noteType = 'youtube-video';
          segments = transData.segments;
        } else if (item.type === 'audio') {
          let targetAudioUrl = item.inputVal;
          let activeSourceInfo = item.inputVal;
          
          if (item.inputVal.includes('open.spotify.com')) {
            // Resolve Spotify link in queue
            const resolveRes = await fetch(`${API_BASE}/api/podcasts/resolve-spotify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ spotifyUrl: item.inputVal, apiKey: settings.apiKey })
            });
            const resolveData = await resolveRes.json();
            if (!resolveRes.ok || resolveData.error) {
              throw new Error(resolveData.error || 'Fehler bei der Spotify-Auflösung in der Warteschlange.');
            }
            if (resolveData.type === 'episode' && resolveData.episode && resolveData.episode.audioUrl) {
              targetAudioUrl = resolveData.episode.audioUrl;
              activeSourceInfo = `${resolveData.showTitle}: ${resolveData.episode.title}`;
            } else {
              throw new Error('Der Spotify-Link konnte nicht zu einer abspielbaren Episode aufgelöst werden.');
            }
          }

          // 2. Fetch/Upload audio (Uses local path or URL)
          const prompt = buildAudioSchemaPrompt(detailLevel);
          const isLocal = !targetAudioUrl.startsWith('http');
          const audioRes = await fetch(`${API_BASE}/api/analyze-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: settings.apiKey,
              localPath: isLocal ? targetAudioUrl : '',
              audioUrl: !isLocal ? targetAudioUrl : '',
              prompt: prompt,
              model: settings.model || 'gemini-1.5-flash'
            })
          });
          
          const audioData = await audioRes.json();
          if (!audioRes.ok || audioData.error) throw new Error(audioData.error || 'Fehler bei Audio-Analyse.');
          
          const parsed = cleanAndParseJson(audioData.markdown);
          const compiled = compileTemplate(parsed, isLocal ? `Lokale Datei: ${targetAudioUrl}` : activeSourceInfo, 'audio-podcast');
          
          // Save directly
          const targetSubfolder = resolveSaveFolder(parsed.tags || []);
          const saveRes = await fetch(`${API_BASE}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vaultPath: settings.vaultPath,
              folder: targetSubfolder,
              fileName: parsed.title,
              content: compiled,
              pdfPath: settings.pdfPath
            })
          });
          if (!saveRes.ok) throw new Error('Speichern in Obsidian fehlgeschlagen.');

          updatedQueue[i].status = 'completed';
          setQueue([...updatedQueue]);
          await updateQueueItemStatus(item.id, 'completed');
          continue;
        } else {
          contentToAnalyze = item.inputVal;
          sourceInfo = 'Pasted Text';
          noteType = 'text-document';
        }

        // 3. AI synthesis JSON mode (with support for chunking)
        let aiResponse;
        const totalWords = contentToAnalyze.split(/\s+/).length;
        if (totalWords > 6000) {
          let itemChunks = [];
          if (item.type === 'youtube' && segments && segments.length > 0) {
            itemChunks = chunkTranscriptByTime(segments, 1800);
          } else {
            itemChunks = chunkTextByWords(contentToAnalyze, 5000);
          }
          
          const results = [];
          for (let c = 0; c < itemChunks.length; c++) {
            const chunkRes = await runAiSynthesis(itemChunks[c].text, sourceInfo, noteType);
            results.push(chunkRes);
          }
          aiResponse = mergeSynthesises(results, item.inputTitle);
        } else {
          aiResponse = await runAiSynthesis(contentToAnalyze, sourceInfo, noteType);
        }
        
        // 4. Compile layout template
        const compiledMarkdownStr = compileTemplate(aiResponse, sourceInfo, noteType);
        
        // 5. Smart folder routing save
        const targetSubfolder = resolveSaveFolder(aiResponse.tags || []);
        const saveResponse = await fetch(`${API_BASE}/api/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultPath: settings.vaultPath,
            folder: targetSubfolder,
            fileName: aiResponse.title,
            content: compiledMarkdownStr,
            pdfPath: settings.pdfPath
          })
        });

        const saveResult = await saveResponse.json();
        if (!saveResponse.ok || saveResult.error) throw new Error(saveResult.error || 'Fehler beim Speichern.');

        updatedQueue[i].status = 'completed';
        await updateQueueItemStatus(item.id, 'completed');
      } catch (err) {
        console.error(err);
        updatedQueue[i].status = 'failed';
        updatedQueue[i].error = err.message;
        await updateQueueItemStatus(queue[i].id, 'failed', err.message);
      }

      setQueue([...updatedQueue]);
    }

    setIsProcessingQueue(false);
    setCurrentQueueIndex(-1);
    triggerToast('Warteschlange abgearbeitet!', 'success');
    checkVaultConnection(settings.vaultPath, settings.folder);
  };

  // PILLAR 4: 3D Flashcards study grading mechanics
  const handleGradeCard = (correct) => {
    const updatedResults = [...studyCardResults, correct];
    setStudyCardResults(updatedResults);
    setStudyCardFlipped(false);
    
    if (studyCardIndex < (structuredData?.flashcards?.length || 0) - 1) {
      setStudyCardIndex(studyCardIndex + 1);
    } else {
      // Completed the deck
      setStudyCardIndex(structuredData.flashcards.length); // triggers completion screen
      triggerToast('Lerneinheit beendet! Gut gemacht!', 'success');
    }
  };

  const handleResetStudy = () => {
    setStudyCardIndex(0);
    setStudyCardFlipped(false);
    setStudyCardResults([]);
  };

  // PILLAR 5: Interactive SVG Mind Map node dragging mechanics
  const handleNodeMouseDown = (e, nodeId) => {
    e.preventDefault();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    setDraggedNode(nodeId);
    
    const currentOffset = graphOffsets[nodeId] || { x: 0, y: 0 };
    setGraphOffsets({
      ...graphOffsets,
      [nodeId]: {
        ...currentOffset,
        startX: clientX,
        startY: clientY,
        origX: currentOffset.x,
        origY: currentOffset.y
      }
    });
  };

  const handleNodeMouseMove = (e) => {
    if (!draggedNode) return;
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    const offset = graphOffsets[draggedNode];
    const dx = clientX - offset.startX;
    const dy = clientY - offset.startY;

    setGraphOffsets({
      ...graphOffsets,
      [draggedNode]: {
        ...offset,
        x: offset.origX + dx,
        y: offset.origY + dy
      }
    });
  };

  const handleNodeMouseUp = () => {
    setDraggedNode(null);
  };

  // HIGH FIDELITY OBSIDIAN MARKDOWN TO HTML RENDERER
  const renderObsidianMarkdown = (markdown) => {
    if (!markdown) return <p style={{ color: 'var(--text-muted)' }}>Noch keine Notiz generiert.</p>;

    const lines = markdown.split('\n');
    const elements = [];
    
    let inYaml = false;
    let yamlLines = [];
    let inCallout = false;
    let calloutType = '';
    let calloutTitle = '';
    let calloutContentLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '---') {
        if (!inYaml && i === 0) {
          inYaml = true;
          continue;
        } else if (inYaml) {
          inYaml = false;
          elements.push(
            <div key={`yaml-${i}`} className="obsidian-yaml">
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '6px' }}>Metadata frontmatter</div>
              {yamlLines.map((yl, idx) => {
                const parts = yl.split(':');
                if (parts.length >= 2) {
                  return (
                    <div className="yaml-line" key={idx}>
                      <span className="yaml-key">{parts[0].trim()}:</span>
                      <span className="yaml-val">{parts.slice(1).join(':').trim()}</span>
                    </div>
                  );
                }
                return <div key={idx}>{yl}</div>;
              })}
            </div>
          );
          continue;
        }
      }

      if (inYaml) {
        yamlLines.push(line);
        continue;
      }

      const calloutMatch = line.match(/^>\s*\[!([a-zA-Z0-9_-]+)\]\s*(.*)$/);
      if (calloutMatch) {
        if (inCallout) {
          elements.push(renderCallout(calloutType, calloutTitle, calloutContentLines, `callout-flush-${i}`));
          calloutContentLines = [];
        }
        inCallout = true;
        calloutType = calloutMatch[1];
        calloutTitle = calloutMatch[2] || calloutType;
        continue;
      }

      if (inCallout) {
        if (line.startsWith('>')) {
          calloutContentLines.push(line.replace(/^>\s?/, ''));
          continue;
        } else {
          elements.push(renderCallout(calloutType, calloutTitle, calloutContentLines, `callout-end-${i}`));
          inCallout = false;
          calloutContentLines = [];
        }
      }

      if (line.startsWith('# ')) {
        elements.push(<h1 key={i}>{parseInlineFormatting(line.substring(2))}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i}>{parseInlineFormatting(line.substring(3))}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i}>{parseInlineFormatting(line.substring(4))}</h3>);
      } else if (line.match(/^\s*-\s+\[([ x])\]\s+(.*)$/)) {
        const checkboxMatch = line.match(/^\s*-\s+\[([ x])\]\s+(.*)$/);
        const checked = checkboxMatch[1] === 'x';
        elements.push(
          <li className="obsidian-todo-item" key={i}>
            <div className={`obsidian-checkbox ${checked ? 'checked' : ''}`}>
              {checked && <span style={{ color: 'white', fontSize: '0.65rem' }}>✓</span>}
            </div>
            <span className={`obsidian-checkbox-text ${checked ? 'checked' : ''}`}>
              {parseInlineFormatting(checkboxMatch[2])}
            </span>
          </li>
        );
      } else if (line.startsWith('- ')) {
        elements.push(
          <ul key={i} style={{ marginBottom: '8px' }}>
            <li>{parseInlineFormatting(line.substring(2))}</li>
          </ul>
        );
      } else if (line.trim() === '---') {
        elements.push(<hr key={i} style={{ border: 'none', borderBottom: '1px solid var(--border-glass)', margin: '20px 0' }} />);
      } else if (line.trim() !== '') {
        elements.push(<p key={i}>{parseInlineFormatting(line)}</p>);
      }
    }

    if (inCallout) {
      elements.push(renderCallout(calloutType, calloutTitle, calloutContentLines, 'callout-final'));
    }

    return elements;
  };

  const renderCallout = (type, title, contentLines, key) => {
    let calloutIcon = '📝';
    let typeClass = 'co-note';
    if (type.toLowerCase() === 'summary') {
      calloutIcon = '✨';
      typeClass = 'co-summary';
    } else if (type.toLowerCase() === 'key-takeaways') {
      calloutIcon = '💡';
      typeClass = 'co-summary';
    } else if (type.toLowerCase() === 'warning' || type.toLowerCase() === 'important') {
      calloutIcon = '⚠️';
      typeClass = 'co-warning';
    } else if (type.toLowerCase() === 'todo') {
      calloutIcon = '🎯';
      typeClass = 'co-todo';
    }

    return (
      <div className={`obsidian-callout ${typeClass}`} key={key}>
        <div className="obsidian-callout-title">
          <span>{calloutIcon}</span>
          <span>{title}</span>
        </div>
        <div className="obsidian-callout-content">
          {contentLines.map((cl, idx) => (
            <p key={idx} style={{ margin: 0, marginBottom: idx < contentLines.length - 1 ? '8px' : 0 }}>
              {parseInlineFormatting(cl)}
            </p>
          ))}
        </div>
      </div>
    );
  };

  const parseInlineFormatting = (text) => {
    if (!text) return '';
    const parts = [];
    let currentIdx = 0;
    const wikiRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = wikiRegex.exec(text)) !== null) {
      const matchIdx = match.index;
      if (matchIdx > currentIdx) {
        parts.push(...parseBoldAndItalic(text.substring(currentIdx, matchIdx)));
      }

      const linkContent = match[1];
      const linkParts = linkContent.split('|');
      parts.push(
        <span 
          key={`wiki-${matchIdx}`} 
          className="obsidian-wikilink"
          onClick={() => handleNoteSelect(linkParts[0])}
        >
          <span>🔗 </span>
          <span>{linkParts[1] || linkParts[0]}</span>
        </span>
      );
      currentIdx = wikiRegex.lastIndex;
    }

    if (currentIdx < text.length) {
      parts.push(...parseBoldAndItalic(text.substring(currentIdx)));
    }
    return parts;
  };

  const parseBoldAndItalic = (text) => {
    const boldRegex = /\*\*([^*]+)\*\*/g;
    const parts = [];
    let currentIdx = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      const matchIdx = match.index;
      if (matchIdx > currentIdx) parts.push(text.substring(currentIdx, matchIdx));
      parts.push(<strong key={`bold-${matchIdx}`}>{match[1]}</strong>);
      currentIdx = boldRegex.lastIndex;
    }

    if (currentIdx < text.length) parts.push(text.substring(currentIdx));
    return parts;
  };

  return (
    <div className="app-container" onMouseMove={handleNodeMouseMove} onMouseUp={handleNodeMouseUp} onTouchMove={handleNodeMouseMove} onTouchEnd={handleNodeMouseUp}>
      <div className="bg-glow-orb-1"></div>
      <div className="bg-glow-orb-2"></div>

      {toast && (
        <div className={`toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '✗'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        onSave={handleSettingsSave} 
      />

      {/* PILLAR 4: 3D Flippable Flashcards learning screen overlay */}
      {activeStudyMode && structuredData?.flashcards && (
        <div className="modal-overlay" onClick={() => setActiveStudyMode(false)}>
          <div className="modal-container glass-panel" style={{ maxWidth: '520px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🎙 Karteikarten Lernmodus</h3>
              <button className="close-btn" onClick={() => setActiveStudyMode(false)}>&times;</button>
            </div>
            
            {studyCardIndex < structuredData.flashcards.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Karte {studyCardIndex + 1} von {structuredData.flashcards.length}
                </div>

                {/* 3D Flipping Card Container */}
                <div className={`flashcard-scene`} onClick={() => setStudyCardFlipped(!studyCardFlipped)}>
                  <div className={`flashcard-card ${studyCardFlipped ? 'is-flipped' : ''}`}>
                    {/* Front */}
                    <div className="flashcard-face flashcard-front">
                      <div className="flashcard-type-label">FRAGE</div>
                      <div className="flashcard-text">{structuredData.flashcards[studyCardIndex].q}</div>
                      <div className="flashcard-hint">Tippe auf die Karte, um sie umzudrehen</div>
                    </div>
                    {/* Back */}
                    <div className="flashcard-face flashcard-back">
                      <div className="flashcard-type-label" style={{ color: 'var(--color-accent)' }}>ANTWORT</div>
                      <div className="flashcard-text">{structuredData.flashcards[studyCardIndex].a}</div>
                      <div className="flashcard-hint">Tippe auf die Karte, um die Frage anzuzeigen</div>
                    </div>
                  </div>
                </div>

                {/* Grade buttons show on flipped card */}
                {studyCardFlipped ? (
                  <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, height: '44px', background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#f87171' }} onClick={() => handleGradeCard(false)}>
                      🟥 Wiederholen
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1, height: '44px', background: 'rgba(20,184,166,0.15)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }} onClick={() => handleGradeCard(true)}>
                      🟩 Verstanden
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary" style={{ width: '100%', height: '44px' }} onClick={() => setStudyCardFlipped(true)}>
                    👀 Antwort anzeigen
                  </button>
                )}
              </div>
            ) : (
              // Quiz Finished Screen
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center', padding: '20px 0' }}>
                <span style={{ fontSize: '3rem' }}>🎉</span>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Lerneinheit beendet!</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Du hast alle {structuredData.flashcards.length} Karteikarten durchgearbeitet.<br />
                  Dein Score: <strong>{studyCardResults.filter(Boolean).length} / {structuredData.flashcards.length}</strong> gewusst!
                </p>
                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleResetStudy}>
                    Nochmal lernen
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setActiveStudyMode(false)}>
                    Fertig
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PILLAR 5: Interactive SVG Mind Map node graph overlay */}
      {activeGraphMode && structuredData && (
        <div className="modal-overlay" onClick={() => setActiveGraphMode(false)}>
          <div className="modal-container glass-panel" style={{ maxWidth: '850px', width: '94%', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🕸️ Wissensnetzwerk Graph</h3>
              <button className="close-btn" onClick={() => setActiveGraphMode(false)}>&times;</button>
            </div>
            
            {/* Interactive SVG Workspace */}
            <div style={{ flex: 1, position: 'relative', background: '#090d16', borderRadius: '12px', border: '1px solid var(--border-glass)', overflow: 'hidden', marginTop: '8px' }}>
              <svg style={{ width: '100%', height: '100%', cursor: draggedNode ? 'grabbing' : 'grab' }}>
                {/* Connecting lines between center and orbiting concepts */}
                {structuredData.tags && structuredData.tags.map((tag, idx) => {
                  const nodeId = `tag-${idx}`;
                  const offset = graphOffsets[nodeId] || { x: 0, y: 0 };
                  const angle = (idx * 2 * Math.PI) / (structuredData.tags.length + (structuredData.wikiLinks?.length || 0));
                  const tx = 425 + 170 * Math.cos(angle) + offset.x;
                  const ty = 250 + 170 * Math.sin(angle) + offset.y;
                  return (
                    <line key={`line-tag-${idx}`} x1="425" y1="250" x2={tx} y2={ty} stroke="rgba(20, 184, 166, 0.25)" strokeWidth="1.5" strokeDasharray="3,3" />
                  );
                })}

                {structuredData.wikiLinks && structuredData.wikiLinks.map((wiki, idx) => {
                  const nodeId = `wiki-${idx}`;
                  const offset = graphOffsets[nodeId] || { x: 0, y: 0 };
                  const angle = ((idx + (structuredData.tags?.length || 0)) * 2 * Math.PI) / ((structuredData.tags?.length || 0) + structuredData.wikiLinks.length);
                  const tx = 425 + 190 * Math.cos(angle) + offset.x;
                  const ty = 250 + 190 * Math.sin(angle) + offset.y;
                  return (
                    <line key={`line-wiki-${idx}`} x1="425" y1="250" x2={tx} y2={ty} stroke="rgba(168, 85, 247, 0.25)" strokeWidth="1.5" />
                  );
                })}

                {/* Render Orbiting Tag Nodes */}
                {structuredData.tags && structuredData.tags.map((tag, idx) => {
                  const nodeId = `tag-${idx}`;
                  const offset = graphOffsets[nodeId] || { x: 0, y: 0 };
                  const angle = (idx * 2 * Math.PI) / (structuredData.tags.length + (structuredData.wikiLinks?.length || 0));
                  const tx = 425 + 170 * Math.cos(angle) + offset.x;
                  const ty = 250 + 170 * Math.sin(angle) + offset.y;
                  return (
                    <g key={nodeId} transform={`translate(${tx}, ${ty})`} style={{ cursor: 'pointer' }} onMouseDown={(e) => handleNodeMouseDown(e, nodeId)} onTouchStart={(e) => handleNodeMouseDown(e, nodeId)}>
                      <circle r="22" fill="rgba(20, 184, 166, 0.15)" stroke="var(--color-accent)" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px rgba(20,184,166,0.3))' }} />
                      <text textAnchor="middle" y="32" fill="#94a3b8" fontSize="0.7rem" fontWeight="600">#{tag.toLowerCase().trim().replace(/^#/, '')}</text>
                      <text textAnchor="middle" y="4" fill="white" fontSize="0.75rem">🏷️</text>
                    </g>
                  );
                })}

                {/* Render Orbiting WikiLink Nodes */}
                {structuredData.wikiLinks && structuredData.wikiLinks.map((wiki, idx) => {
                  const nodeId = `wiki-${idx}`;
                  const offset = graphOffsets[nodeId] || { x: 0, y: 0 };
                  const angle = ((idx + (structuredData.tags?.length || 0)) * 2 * Math.PI) / ((structuredData.tags?.length || 0) + structuredData.wikiLinks.length);
                  const tx = 425 + 190 * Math.cos(angle) + offset.x;
                  const ty = 250 + 190 * Math.sin(angle) + offset.y;
                  return (
                    <g key={nodeId} transform={`translate(${tx}, ${ty})`} style={{ cursor: 'pointer' }} onMouseDown={(e) => handleNodeMouseDown(e, nodeId)} onTouchStart={(e) => handleNodeMouseDown(e, nodeId)}>
                      <circle r="24" fill="rgba(168, 85, 247, 0.15)" stroke="var(--color-secondary)" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.3))' }} />
                      <text textAnchor="middle" y="32" fill="#cbd5e1" fontSize="0.68rem" fontWeight="600">{wiki}</text>
                      <text textAnchor="middle" y="4" fill="white" fontSize="0.75rem">🔗</text>
                    </g>
                  );
                })}

                {/* Main Node (Center Glowing Node representing note) */}
                <g transform="translate(425, 250)">
                  <circle r="36" fill="rgba(99, 102, 241, 0.25)" stroke="var(--color-primary)" strokeWidth="2.5" className="graph-center-node" style={{ filter: 'drop-shadow(0 0 12px var(--color-primary-glow))' }} />
                  <text textAnchor="middle" y="52" fill="white" fontSize="0.8rem" fontWeight="bold">
                    {generatedTitle.length > 20 ? `${generatedTitle.substring(0, 17)}...` : generatedTitle}
                  </text>
                  <text textAnchor="middle" y="5" fill="white" fontSize="1.1rem">📓</text>
                </g>
              </svg>

              <div style={{ position: 'absolute', bottom: '12px', left: '12px', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: '4px' }}>
                💡 Ziehe an den Knoten, um sie im Raum zu bewegen
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Vault Notes History */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="app-logo">A</div>
          <h1 className="app-title">Aetheris</h1>
          <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>&times;</button>
        </div>

        <div className="history-section">
          <div className="section-label">Obsidian Tresor-Notizen</div>
          
          {/* Search Input Field */}
          <div style={{ padding: '0 8px 12px 8px', position: 'relative' }}>
            <input 
              type="text" 
              className="text-input" 
              placeholder="🔍 Notizen durchsuchen..." 
              value={searchQuery}
              onChange={(e) => handleSearchNotes(e.target.value)}
              style={{ 
                width: '100%', 
                height: '34px', 
                fontSize: '0.8rem', 
                paddingRight: searchQuery ? '30px' : '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderColor: searchQuery ? 'var(--color-primary)' : 'var(--border-glass)',
                boxShadow: searchQuery ? '0 0 8px var(--color-primary-glow)' : 'none'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => handleSearchNotes('')}
                style={{ 
                  position: 'absolute', 
                  right: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer',
                  fontSize: '1rem',
                  padding: '4px'
                }}
              >
                &times;
              </button>
            )}
          </div>

          {searchQuery.trim() ? (
            /* Search Results View */
            searchResults.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 8px' }}>
                {isSearching ? 'Suche läuft...' : 'Keine passenden Notizen gefunden.'}
              </p>
            ) : (
              <div className="history-list">
                {searchResults.map((result, idx) => (
                  <div 
                    key={idx} 
                    className={`history-item ${generatedTitle === result.title ? 'active' : ''}`}
                    onClick={() => handleLoadNoteContent(result.fileName)}
                    style={{ borderLeft: '3px solid var(--color-primary)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="history-item-title" style={{ fontWeight: 'bold' }}>{result.title}</div>
                      <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {(result.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="history-item-meta" style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                      {result.snippet}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Default Date-Sorted Note History List */
            vaultNotes.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 8px' }}>
                {connectionStatus === 'connected' 
                  ? 'Noch keine synthetisierten Notizen im Zielordner.' 
                  : 'Verbindung zum Vault einrichten, um Historie anzuzeigen.'}
              </p>
            ) : (
              <div className="history-list">
                {vaultNotes.map((note, idx) => (
                  <div 
                    key={idx} 
                    className={`history-item ${generatedTitle === note.title.replace(/\.md$/, '') ? 'active' : ''}`}
                    onClick={() => handleLoadNoteContent(note.fileName)}
                  >
                    <div className="history-item-title">{note.title}</div>
                    <div className="history-item-meta">
                      <span>{new Date(note.modifiedAt).toLocaleDateString('de-DE')}</span>
                      <span>{(note.size / 1024).toFixed(1)} KB</span>
                    </div>
                    {note.tags && note.tags.length > 0 && (
                      <div className="history-item-tags">
                        {note.tags.slice(0, 3).map((tag, tIdx) => (
                          <span key={tIdx} className="mini-tag">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Vault Status:</span>
            <div className={`status-pill ${connectionStatus}`}>
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>•</span>
              {connectionStatus === 'connected' ? 'Verbunden' : 'Getrennt'}
            </div>
          </div>
          {settings.vaultPath && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              Ordner: {settings.folder}
            </span>
          )}
          <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            ⚙ Einstellungen
          </button>
        </div>
      </div>

      {/* Main Panel */}
      <div className="main-workspace">
        <div className="top-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)}>☰</button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Aetheris Knowledge Synthesizer
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Dashboard</span>
            </div>
          </div>
          <div className="nav-actions">
            {connectionStatus === 'connected' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} className="vault-path-label">
                ✓ Vault: {settings.vaultPath.split('\\').pop() || settings.vaultPath.split('/').pop()}
              </span>
            )}
          </div>
        </div>

        <div className="content-pane">
          {/* Main workspace cards */}
          <div className="input-card glass-panel">
            <div className="workspace-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%' }}>
              <button className={`tab-btn ${activeTab === 'youtube' ? 'active' : ''}`} onClick={() => { setActiveTab('youtube'); setErrorMsg(null); }}>
                📹 YouTube-Video
              </button>
              <button className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`} onClick={() => { setActiveTab('text'); setErrorMsg(null); }}>
                📄 Freitext / Dokument
              </button>
              <button className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => { setActiveTab('audio'); setErrorMsg(null); }}>
                🎙 Podcast / Audio
              </button>
              <button className={`tab-btn ${activeTab === 'podcasts' ? 'active' : ''}`} onClick={() => { setActiveTab('podcasts'); setErrorMsg(null); }}>
                📻 Podcasts (Suche)
              </button>
              <button className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => { setActiveTab('queue'); setErrorMsg(null); }} style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-primary)', border: activeTab === 'queue' ? '1px solid var(--color-primary)' : '1px solid transparent' }}>
                📥 Warteschlange ({queue.length})
              </button>
              <button className={`tab-btn ${activeTab === 'copilot' ? 'active' : ''}`} onClick={() => { setActiveTab('copilot'); setErrorMsg(null); }} style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-primary)', border: activeTab === 'copilot' ? '1px solid var(--color-primary)' : '1px solid transparent' }}>
                🧠 Copilot
              </button>
              <button className={`tab-btn ${activeTab === 'graph' ? 'active' : ''}`} onClick={() => { setActiveTab('graph'); setErrorMsg(null); }} style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-primary)', border: activeTab === 'graph' ? '1px solid var(--color-primary)' : '1px solid transparent' }}>
                🕸 Graph
              </button>
            </div>

            {activeTab === 'youtube' && (
              <div className="form-group">
                <label className="form-label">YouTube Video-URL</label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}

            {activeTab === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Titel der Notiz</label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="z.B. Einführung in TypeScript"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Inhalt des Textes</label>
                  <textarea
                    className="text-input textarea-input"
                    placeholder="Füge hier deinen zu analysierenden Text ein..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Lokaler Dateipfad (auf deinem PC)</label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="z.B. C:\Users\Name\Music\podcast.mp3"
                    value={audioPath}
                    onChange={(e) => { setAudioPath(e.target.value); setAudioUrl(''); }}
                    disabled={isLoading}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Wird sofort und ohne Uploadzeit direkt von deiner Festplatte gelesen.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  — ODER —
                </div>
                <div className="form-group">
                  <label className="form-label">Direkte Audio-URL (MP3 / WAV / M4A)</label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="https://example.com/podcast/episode_1.mp3"
                    value={audioUrl}
                    onChange={(e) => { setAudioUrl(e.target.value); setAudioPath(''); }}
                    disabled={isLoading}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Das Backend lädt die Datei im Hintergrund herunter und verarbeitet sie.
                  </span>
                </div>
              </div>
            )}

            {/* Podcast Directory Integration tab content */}
            {activeTab === 'podcasts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!selectedPodcast ? (
                  <div>
                    <label className="form-label">Öffentliche Podcasts durchsuchen</label>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                      <input 
                        type="text" 
                        className="text-input" 
                        placeholder="Podcast-Name oder Thema eingeben..." 
                        value={podcastQuery}
                        onChange={(e) => setPodcastQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearchPodcasts(); }}
                      />
                      <button className="btn btn-primary" onClick={handleSearchPodcasts} disabled={searchLoading} style={{ minWidth: '120px', height: '48px' }}>
                        {searchLoading ? 'Suche...' : 'Suchen'}
                      </button>
                    </div>

                    {searchLoading && (
                      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        🔍 Verzeichnis wird durchsucht...
                      </div>
                    )}
                    
                    {!searchLoading && podcasts.length > 0 && (
                      <div className="podcast-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                        {podcasts.map((podcast, idx) => (
                          <div 
                            key={idx} 
                            className="podcast-card glass-panel" 
                            onClick={() => handleSelectPodcast(podcast)}
                            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: '12px', gap: '10px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid var(--border-glass)', transition: 'all 0.2s ease-in-out' }}
                          >
                            <img 
                              src={podcast.cover} 
                              alt={podcast.title} 
                              style={{ width: '100%', aspectRatio: '1/1', borderRadius: '8px', objectFit: 'cover' }} 
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }} title={podcast.title}>
                                {podcast.title}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {podcast.artist}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!searchLoading && podcasts.length === 0 && podcastQuery && (
                      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Keine Podcasts gefunden. Versuche es mit einem anderen Begriff!
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setSelectedPodcast(null)} 
                      style={{ marginBottom: '16px', padding: '6px 12px', fontSize: '0.8rem', height: '36px' }}
                    >
                      ← Zurück zur Suche
                    </button>
                    
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                      <img 
                        src={selectedPodcast.cover} 
                        alt={selectedPodcast.title} 
                        style={{ width: '90px', height: '90px', borderRadius: '8px', objectFit: 'cover' }} 
                      />
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{selectedPodcast.title}</h3>
                        <p style={{ margin: '4px 0 0 0', color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>{selectedPodcast.artist}</p>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>RSS: {selectedPodcast.feedUrl}</span>
                      </div>
                    </div>
                    
                    <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                      Verfügbare Episoden (Aktuelle)
                    </h4>
                    
                    {episodesLoading ? (
                      <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        ⏳ Episoden-Feed wird parst...
                      </div>
                    ) : (
                      <div className="episode-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                        {episodes.map((episode, idx) => (
                          <div 
                            key={idx} 
                            style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px solid var(--border-glass)' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                              <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{episode.title}</h5>
                              <button 
                                className="btn btn-primary" 
                                onClick={() => handleSynthesizeEpisode(episode)} 
                                disabled={isLoading}
                                style={{ padding: '6px 12px', fontSize: '0.72rem', height: '30px', whiteSpace: 'nowrap' }}
                              >
                                ⚡ Synthetisieren
                              </button>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                              {episode.description}
                            </p>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.68rem', color: 'var(--color-primary)', marginTop: '2px' }}>
                              <span>📅 {episode.pubDate ? new Date(episode.pubDate).toLocaleDateString('de-DE') : 'Unbekanntes Datum'}</span>
                              {episode.duration && <span>⏱ {episode.duration}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PILLAR 1: Bulk Queue manager GUI dashboard */}
            {activeTab === 'queue' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Form to add item to queue */}
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: '12px', alignItems: 'flex-end', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Typ</label>
                    <select className="text-input" style={{ height: '40px', padding: '8px 12px' }} value={queueType} onChange={(e) => setQueueType(e.target.value)}>
                      <option value="youtube">📹 YouTube</option>
                      <option value="audio">🎙 Audio</option>
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Quelle (URL oder absoluter Pfad)</label>
                    <input 
                      type="text" 
                      className="text-input" 
                      style={{ height: '40px', padding: '8px 12px' }} 
                      placeholder={queueType === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'C:\\path\\file.mp3 oder http://url.mp3'}
                      value={queueInput}
                      onChange={(e) => setQueueInput(e.target.value)}
                    />
                  </div>

                  <button className="btn btn-secondary" style={{ height: '40px' }} onClick={handleAddToQueue}>
                    + Hinzufügen
                  </button>
                </div>

                {/* Queue list table */}
                <div style={{ border: '1px solid var(--border-glass)', borderRadius: '10px', overflow: 'hidden' }}>
                  {queue.length === 0 ? (
                    <div style={{ padding: '32px', textCenter: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Die Warteschlange ist leer. Füge oben YouTube-Videos oder Audio-Dateien hinzu!
                    </div>
                  ) : (
                    <div>
                      {queue.map((item, idx) => (
                        <div 
                          key={item.id} 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: idx < queue.length - 1 ? '1px solid var(--border-glass)' : 'none', background: currentQueueIndex === idx ? 'rgba(99,102,241,0.06)' : 'transparent' }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                                {item.type === 'youtube' ? '📹 YT' : '🎙 Audio'}
                              </span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.inputVal}
                              </span>
                            </div>
                            {item.error && (
                              <div style={{ fontSize: '0.72rem', color: '#f87171' }}>
                                ❌ Fehler: {item.error}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {/* Queue Item Status badges */}
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: item.status === 'completed' ? 'var(--color-accent)' : (item.status === 'processing' ? 'var(--color-primary)' : (item.status === 'failed' ? '#ef4444' : 'var(--text-muted)')) }}>
                              {item.status === 'completed' ? '✓ Fertig' : (item.status === 'processing' ? '⚡ Läuft...' : (item.status === 'failed' ? '✗ Fehlgeschlagen' : 'Wartend'))}
                            </span>

                            <button 
                              onClick={() => handleRemoveFromQueue(item.id)} 
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
                              disabled={isProcessingQueue}
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {queue.length > 0 && (
                  <button className="btn btn-primary" style={{ width: 'fit-content' }} onClick={handleProcessQueue} disabled={isProcessingQueue}>
                    {isProcessingQueue ? `Verarbeite... (${currentQueueIndex + 1}/${queue.length})` : '⚡ Warteschlange abarbeiten'}
                  </button>
                )}

                {/* Bookmarklet Web Clipper Info & Draggable Link */}
                <div className="glass-panel" style={{ padding: '20px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                    🔌 Aetheris Web Clipper Bookmarklet
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Ziehe den folgenden Button in deine Lesezeichenleiste. Wenn du eine Webseite (z. B. einen Fachartikel oder ein YouTube-Video) besuchst, klicke auf das Lesezeichen, um den Inhalt direkt in deine Aetheris-Warteschlange einzufügen.
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <a 
                      ref={(el) => {
                        if (el) {
                          el.setAttribute('href', `javascript:(function(){const url=window.location.href,title=document.title,type=(url.indexOf('youtube.com')!==-1||url.indexOf('youtu.be')!==-1)?'youtube':'text';let val=url;if(type==='text')val=document.body.innerText;const f=document.createElement('form');f.method='POST';f.action='http://${window.location.hostname}:5001/api/queue/add-webclip';f.target='_blank';const a=function(n,v){const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;f.appendChild(i);};a('type',type);a('inputVal',val);a('inputTitle',title);a('redirectUrl','${window.location.origin}/?clipped=true');document.body.appendChild(f);f.submit();document.body.removeChild(f);})();`);
                        }
                      }}
                      className="btn btn-primary"
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        cursor: 'grab', 
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', 
                        color: 'white', 
                        padding: '10px 18px', 
                        textDecoration: 'none', 
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        boxShadow: '0 0 15px var(--color-primary-glow)'
                      }}
                      onClick={(e) => e.preventDefault()}
                    >
                      ✂ Aetheris Clipper
                    </a>
                    
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      💡 <strong>Anleitung:</strong> Halte die Maustaste auf dem Button gedrückt und ziehe ihn nach oben in deine Lesezeichenleiste (Bookmarks Bar) deines Browsers.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'copilot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🧠 Obsidian Copilot
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Stelle Fragen an dein gesammeltes Wissen. Die KI durchsucht deine Obsidian-Notizen und formuliert eine fundierte Antwort mit Quellenangaben.
                  </p>
                </div>

                <form onSubmit={handleCopilotSearch} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Frage zu deinen Notizen stellen... (z. B. 'Was sind Peptide?')"
                    value={copilotQuery}
                    onChange={(e) => setCopilotQuery(e.target.value)}
                    disabled={isCopilotLoading}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={isCopilotLoading} style={{ minWidth: '120px' }}>
                    {isCopilotLoading ? 'Läuft...' : '⚡ Fragen'}
                  </button>
                </form>

                {isCopilotLoading && (
                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: 'rgba(99,102,241,0.03)', border: '1px solid var(--border-glass-glow)' }}>
                    <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--color-primary)' }}></div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>{copilotStatus}</span>
                  </div>
                )}

                {copilotAnswer && !isCopilotLoading && (
                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass-glow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.05em' }}>Antwort des Copiloten</span>
                      <button 
                        className="btn btn-secondary" 
                        style={{ height: '30px', padding: '0 10px', fontSize: '0.75rem' }}
                        onClick={() => {
                          setGeneratedTitle(`Copilot Antwort - ${copilotQuery.substring(0, 30)}`);
                          setGeneratedMarkdown(copilotAnswer);
                          setActiveTab('text');
                          triggerToast('Antwort in Editor geladen!', 'success');
                        }}
                      >
                        ✏ Im Editor öffnen
                      </button>
                    </div>

                    <div className="rendered-preview" style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                      {renderObsidianMarkdown(copilotAnswer)}
                    </div>

                    {copilotSources.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Verwendete Quellen:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {copilotSources.map((source, sIdx) => (
                            <div 
                              key={sIdx} 
                              className="mini-tag" 
                              onClick={() => handleNoteSelect(source.title)}
                              style={{ 
                                padding: '6px 12px', 
                                background: 'rgba(99,102,241,0.08)', 
                                border: '1px solid rgba(99,102,241,0.15)', 
                                color: 'var(--text-primary)', 
                                borderRadius: '20px', 
                                fontSize: '0.75rem', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(99,102,241,0.15)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(99,102,241,0.08)';
                                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)';
                              }}
                            >
                              📚 <strong>{source.title}</strong> 
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                                (Score: {source.score.toFixed(1)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'graph' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🕸 Notizen-Graph (Wiki-Netzwerk)
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Visualisiere Verbindungen durch Wiki-Links. Punkte sind Notizen, Linien sind Verweise.
                    </p>
                  </div>
                  <button 
                    className="btn btn-secondary" 
                    style={{ height: '36px', padding: '0 12px', fontSize: '0.8rem' }}
                    onClick={fetchGraphData}
                    disabled={isGraphLoading}
                  >
                    🔄 Graph aktualisieren
                  </button>
                </div>

                {isGraphLoading ? (
                  <div className="glass-panel" style={{ height: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'rgba(99,102,241,0.02)' }}>
                    <div className="spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--color-primary)' }}></div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Analysiere Tresor-Verbindungen...</span>
                  </div>
                ) : (
                  <div>
                    <GraphVisualizer 
                      data={graphData} 
                      onNodeSelect={(node) => setSelectedGraphNode(node)} 
                      activeNoteTitle={generatedTitle}
                    />

                    {selectedGraphNode && (
                      <div className="glass-panel" style={{ marginTop: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(99,102,241,0.04)', border: '1px solid var(--border-glass-glow)' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {selectedGraphNode.label}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {selectedGraphNode.exists 
                              ? `Dateipfad: ${selectedGraphNode.relativePath}`
                              : '⚠️ Diese Notiz existiert noch nicht im Tresor (nur verlinkt).'
                            }
                          </span>
                        </div>
                        {selectedGraphNode.exists && (
                          <button 
                            className="btn btn-primary"
                            style={{ height: '36px', padding: '0 14px', fontSize: '0.8rem' }}
                            onClick={() => {
                              if (selectedGraphNode.relativePath) {
                                setActiveTab('text');
                                handleLoadNoteContent(selectedGraphNode.relativePath, true);
                              } else {
                                handleNoteSelect(selectedGraphNode.id);
                              }
                              triggerToast(`Notiz "${selectedGraphNode.id}" geladen!`, 'success');
                            }}
                          >
                            ✏ Im Editor öffnen
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '8px', color: '#ef4444', fontSize: '0.9rem' }}>
                {errorMsg}
              </div>
            )}

            {activeTab !== 'queue' && activeTab !== 'copilot' && activeTab !== 'graph' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
                <button className="btn btn-primary" onClick={handleSynthesize} disabled={isLoading} style={{ width: 'fit-content' }}>
                  {isLoading ? 'Synthese läuft...' : '⚡ Wissen synthetisieren'}
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Detailgrad:</span>
                  <select 
                    className="text-input" 
                    value={detailLevel} 
                    onChange={(e) => setDetailLevel(e.target.value)} 
                    style={{ height: '38px', padding: '0 12px', fontSize: '0.8rem', minWidth: '140px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', cursor: 'pointer' }}
                    disabled={isLoading}
                  >
                    <option value="compact">📋 Kompakt</option>
                    <option value="detailed">📚 Ausführlich</option>
                    <option value="comprehensive">🎓 Umfassend</option>
                    <option value="exhaustive">🧠 Enzyklopädisch (Maximale Tiefe)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Pipeline Loading State */}
          {isLoading && (
            <div className="pipeline-container glass-panel">
              <div className={`pipeline-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
                <div className="step-indicator">1</div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {activeTab === 'audio' ? 'Audio-Quelle vorbereiten' : 'Untertitel extrahieren'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {activeTab === 'audio' 
                      ? 'Lade Audio-Datei oder verarbeite lokalen Dateipfad...' 
                      : (activeTab === 'youtube' 
                          ? 'Lade YouTube-Video-Transkript über unseren Python-Dienst...' 
                          : 'Lese den eingegebenen Text ein...')}
                  </div>
                </div>
              </div>
              
              <div className={`pipeline-step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
                <div className="step-indicator">2</div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {activeTab === 'audio' ? 'Multimodale Audio-Synthese & KI-Analyse' : 'KI-Zusammenfassung generieren'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {activeTab === 'audio'
                      ? 'Die Audio-Datei wird zu Gemini hochgeladen und nativ analysiert...'
                      : (synthesisProgress || 'Gemini AI analysiert den Inhalt und erstellt Callouts, Kern-Erkenntnisse und Wiki-Links...')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Output Workspaces */}
          {generatedMarkdown && !isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dateiname:</span>
                  <input 
                    type="text" 
                    className="text-input" 
                    style={{ padding: '6px 12px', fontSize: '0.9rem', maxWidth: '350px', background: 'rgba(255,255,255,0.03)', height: '36px' }} 
                    value={generatedTitle} 
                    onChange={(e) => setGeneratedTitle(e.target.value)} 
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>.md</span>
                </div>
                
                {/* Visual Interactivity buttons for study mode & mind map graph */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {structuredData && (
                    <>
                      <button className="btn btn-secondary" style={{ height: '38px', padding: '0 14px', fontSize: '0.8rem', border: '1px solid var(--border-glass-glow)' }} onClick={() => { handleResetStudy(); setActiveStudyMode(true); }}>
                        🧠 Karteikarten ({structuredData.flashcards?.length || 0})
                      </button>
                      <button className="btn btn-secondary" style={{ height: '38px', padding: '0 14px', fontSize: '0.8rem', border: '1px solid var(--border-glass-glow)' }} onClick={() => setActiveGraphMode(true)}>
                        🕸️ Graph View
                      </button>
                    </>
                  )}
                  
                  <div className="workspace-tabs" style={{ padding: '4px', height: '38px' }}>
                    <button className={`tab-btn ${previewMode === 'preview' ? 'active' : ''}`} onClick={() => setPreviewMode('preview')} style={{ padding: '2px 10px', fontSize: '0.75rem' }}>
                      👁 Vorschau
                    </button>
                    <button className={`tab-btn ${previewMode === 'editor' ? 'active' : ''}`} onClick={() => setPreviewMode('editor')} style={{ padding: '2px 10px', fontSize: '0.75rem' }}>
                      ✏ Quelltext Editor
                    </button>
                  </div>

                  <button className="btn btn-secondary" style={{ height: '38px', padding: '0 14px', fontSize: '0.8rem', border: '1px solid var(--border-glass-glow)' }} onClick={handleDownloadPdf}>
                    📄 PDF herunterladen
                  </button>
                  
                  <button className="btn btn-success" style={{ height: '38px' }} onClick={handleSaveToObsidian}>
                    💾 In Obsidian speichern
                  </button>
                </div>
              </div>

              {/* Preview workspace panes */}
              <div className="dual-workspace glass-panel">
                {previewMode === 'editor' ? (
                  <div className="pane">
                    <div className="pane-header">
                      <span className="pane-title">Raw Markdown Editor</span>
                    </div>
                    <textarea 
                      className="editor-textarea" 
                      value={generatedMarkdown} 
                      onChange={(e) => setGeneratedMarkdown(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="pane">
                    <div className="pane-header">
                      <span className="pane-title">Obsidian Rendered Note</span>
                    </div>
                    <div className="rendered-preview">
                      {renderObsidianMarkdown(generatedMarkdown)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
