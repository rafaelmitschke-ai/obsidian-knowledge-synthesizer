import React, { useState, useEffect } from 'react';

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

export default function SettingsModal({ isOpen, onClose, onSave }) {
  const [activeSubTab, setActiveSubTab] = useState('general'); // 'general' | 'template' | 'routing'
  
  // Settings state
  const [apiKey, setApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [pdfPath, setPdfPath] = useState('');
  const [folder, setFolder] = useState('Aetheris');
  const [titleTemplate, setTitleTemplate] = useState('{{title}}');
  const [language, setLanguage] = useState('auto');
  const [model, setModel] = useState('gemini-2.5-flash');
  
  // Premium Features state
  const [customTemplate, setCustomTemplate] = useState(DEFAULT_TEMPLATE);
  const [routingRules, setRoutingRules] = useState([]);
  
  // UI states
  const [showKey, setShowKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [newRuleTag, setNewRuleTag] = useState('');
  const [newRuleFolder, setNewRuleFolder] = useState('');
 
  useEffect(() => {
    if (isOpen) {
      // Load configurations from localStorage
      setApiKey(localStorage.getItem('aetheris_api_key') || '');
      setOpenaiApiKey(localStorage.getItem('aetheris_openai_api_key') || '');
      setAnthropicApiKey(localStorage.getItem('aetheris_anthropic_api_key') || '');
      setOpenrouterApiKey(localStorage.getItem('aetheris_openrouter_api_key') || '');
      setVaultPath(localStorage.getItem('aetheris_vault_path') || '');
      setPdfPath(localStorage.getItem('aetheris_pdf_path') || '');
      setFolder(localStorage.getItem('aetheris_folder') || 'Aetheris');
      setTitleTemplate(localStorage.getItem('aetheris_template') || '{{title}}');
      setLanguage(localStorage.getItem('aetheris_language') || 'auto');
      setCustomTemplate(localStorage.getItem('aetheris_custom_template') || DEFAULT_TEMPLATE);
      
      let savedModel = localStorage.getItem('aetheris_model') || 'gemini-2.5-flash';
      if (savedModel === 'gemini-1.5-flash') {
        savedModel = 'gemini-2.5-flash';
      } else if (savedModel === 'gemini-1.5-pro') {
        savedModel = 'gemini-2.5-pro';
      }
      setModel(savedModel);
      
      const savedRules = localStorage.getItem('aetheris_routing_rules');
      setRoutingRules(savedRules ? JSON.parse(savedRules) : []);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('aetheris_api_key', apiKey.trim());
    localStorage.setItem('aetheris_openai_api_key', openaiApiKey.trim());
    localStorage.setItem('aetheris_anthropic_api_key', anthropicApiKey.trim());
    localStorage.setItem('aetheris_openrouter_api_key', openrouterApiKey.trim());
    localStorage.setItem('aetheris_vault_path', vaultPath.trim());
    localStorage.setItem('aetheris_pdf_path', pdfPath.trim());
    localStorage.setItem('aetheris_folder', folder.trim());
    localStorage.setItem('aetheris_template', titleTemplate.trim());
    localStorage.setItem('aetheris_language', language);
    localStorage.setItem('aetheris_custom_template', customTemplate);
    localStorage.setItem('aetheris_routing_rules', JSON.stringify(routingRules));
    localStorage.setItem('aetheris_model', model);

    onSave({
      apiKey: apiKey.trim(),
      openaiApiKey: openaiApiKey.trim(),
      anthropicApiKey: anthropicApiKey.trim(),
      openrouterApiKey: openrouterApiKey.trim(),
      vaultPath: vaultPath.trim(),
      pdfPath: pdfPath.trim(),
      folder: folder.trim(),
      titleTemplate: titleTemplate.trim(),
      language,
      customTemplate,
      routingRules,
      model
    });
    
    onClose();
  };

  const handleAddRule = () => {
    if (!newRuleTag.trim() || !newRuleFolder.trim()) return;
    
    // Check if tag already has a rule
    const cleanedTag = newRuleTag.trim().toLowerCase().replace(/^#/, '');
    if (routingRules.some(r => r.tag === cleanedTag)) {
      alert('Für diesen Tag existiert bereits eine Ordnerregel!');
      return;
    }

    const updatedRules = [...routingRules, { tag: cleanedTag, subfolder: newRuleFolder.trim() }];
    setRoutingRules(updatedRules);
    setNewRuleTag('');
    setNewRuleFolder('');
  };

  const handleRemoveRule = (index) => {
    const updatedRules = routingRules.filter((_, idx) => idx !== index);
    setRoutingRules(updatedRules);
  };

  const handleResetTemplate = () => {
    if (window.confirm('Möchtest du die Notiz-Vorlage wirklich auf den Standard zurücksetzen?')) {
      setCustomTemplate(DEFAULT_TEMPLATE);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container glass-panel" style={{ maxWidth: '700px', width: '94%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Aetheris Systemsteuerung</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Settings Sub-Tabs */}
        <div className="workspace-tabs" style={{ width: '100%', marginBottom: '8px', padding: '4px' }}>
          <button 
            className={`tab-btn ${activeSubTab === 'general' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem', flex: 1 }}
            onClick={() => setActiveSubTab('general')}
          >
            ⚙ Allgemein
          </button>
          <button 
            className={`tab-btn ${activeSubTab === 'template' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem', flex: 1 }}
            onClick={() => setActiveSubTab('template')}
          >
            📄 Notiz-Vorlage
          </button>
          <button 
            className={`tab-btn ${activeSubTab === 'routing' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem', flex: 1 }}
            onClick={() => setActiveSubTab('routing')}
          >
            📂 Auto-Routing Rules
          </button>
        </div>

        {/* Tab 1: General Settings */}
        {activeSubTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }}>
            <div className="form-group">
              <label className="form-label">Gemini API Key</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  className="text-input"
                  style={{ flex: 1 }}
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowKey(!showKey)}
                  style={{ padding: '0 16px', height: '48px' }}
                >
                  {showKey ? 'Verbergen' : 'Anzeigen'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">OpenAI API Key (für GPT-Modelle & Whisper)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  className="text-input"
                  style={{ flex: 1 }}
                  placeholder="sk-..."
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                />
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  style={{ padding: '0 16px', height: '48px' }}
                >
                  {showOpenaiKey ? 'Verbergen' : 'Anzeigen'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Anthropic API Key (für Claude)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showAnthropicKey ? 'text' : 'password'}
                  className="text-input"
                  style={{ flex: 1 }}
                  placeholder="sk-ant-..."
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                />
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  style={{ padding: '0 16px', height: '48px' }}
                >
                  {showAnthropicKey ? 'Verbergen' : 'Anzeigen'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">OpenRouter API Key (für DeepSeek, Llama, Qwen)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showOpenrouterKey ? 'text' : 'password'}
                  className="text-input"
                  style={{ flex: 1 }}
                  placeholder="sk-or-..."
                  value={openrouterApiKey}
                  onChange={(e) => setOpenrouterApiKey(e.target.value)}
                />
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                  style={{ padding: '0 16px', height: '48px' }}
                >
                  {showOpenrouterKey ? 'Verbergen' : 'Anzeigen'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Obsidian Vault Pfad (Absolut)</label>
              <input
                type="text"
                className="text-input"
                placeholder="C:\Users\Name\Documents\ObsidianVault"
                value={vaultPath}
                onChange={(e) => setVaultPath(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Lokaler PDF-Speicherpfad (PC)</label>
              <input
                type="text"
                className="text-input"
                placeholder="C:\Users\Name\Documents\ObsidianVault-PDFs"
                value={pdfPath}
                onChange={(e) => setPdfPath(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Optional. Wenn leer, werden PDFs im Obsidian Vault Ordner abgelegt.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Standard-Zielordner im Vault</label>
              <input
                type="text"
                className="text-input"
                placeholder="Aetheris"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Wird genutzt, wenn keine passenden Ordner-Routing-Regeln (Pillar 3) greifen.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">KI-Modell & Anbieter</label>
              <select 
                className="text-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{ height: '48px' }}
              >
                <optgroup label="Google Gemini (Natives Audio)">
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Empfohlen - Schnell & stabil)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Hochpräzise & intelligent)</option>
                </optgroup>
                <optgroup label="OpenAI (Whisper benötigt)">
                  <option value="gpt-4o">GPT-4o (Sehr intelligent & ausgewogen)</option>
                  <option value="gpt-4o-mini">GPT-4o-Mini (Schnell & kostengünstig)</option>
                </optgroup>
                <optgroup label="Anthropic Claude (Whisper benötigt)">
                  <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Herausragender deutscher Schreibstil)</option>
                  <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Schnell & effizient)</option>
                </optgroup>
                <optgroup label="OpenRouter (Whisper benötigt - DeepSeek & Open Source)">
                  <option value="deepseek/deepseek-chat">DeepSeek V3 (Leistungsstark & preiswert)</option>
                  <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B (Ausgewogenes Open Source Modell)</option>
                  <option value="meta-llama/llama-3.1-405b-instruct">Llama 3.1 405B (Maximales Open Source Modell)</option>
                </optgroup>
              </select>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Nicht-Gemini Modelle nutzen die OpenAI Whisper-API zur Transkription von Audiodateien.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Dateinamen-Template</label>
                <select 
                  className="text-input"
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  style={{ height: '48px' }}
                >
                  <option value="{{title}}">Titel (Standard)</option>
                  <option value="{{date}} - {{title}}">Datum - Titel</option>
                  <option value="YT - {{title}}">YT - Titel</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Analysesprache</label>
                <select 
                  className="text-input"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{ height: '48px' }}
                >
                  <option value="auto">Video-Originalsprache</option>
                  <option value="de">Deutsch (Erzwingen)</option>
                  <option value="en">Englisch (Erzwingen)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Custom Template Editor */}
        {activeSubTab === 'template' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Notiz-Struktur (Markdown + Variable Platzhalter)</label>
              <button 
                className="btn btn-secondary" 
                onClick={handleResetTemplate}
                style={{ padding: '4px 12px', fontSize: '0.75rem', height: '30px' }}
              >
                Standard wiederherstellen
              </button>
            </div>
            <textarea
              className="text-input editor-textarea"
              style={{ minHeight: '260px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
              value={customTemplate}
              onChange={(e) => setCustomTemplate(e.target.value)}
            />
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <strong>Verfügbare Platzhalter:</strong><br />
              <code>{"{{title}}"}</code> (Titel) • 
              <code>{"{{source}}"}</code> (YouTube URL / Audio-Pfad) • 
              <code>{"{{type}}"}</code> (Video/Audio/Text) • 
              <code>{"{{date}}"}</code> (Datum) • 
              <code>{"{{tags}}"}</code> (Obsidian Tags) • 
              <code>{"{{summary}}"}</code> (KI-Zusammenfassung) • 
              <code>{"{{takeaways}}"}</code> (KI Bulletpoints) • 
              <code>{"{{content}}"}</code> (KI-Gliederung) • 
              <code>{"{{todos}}"}</code> (To-Do Checkboxen) • 
              <code>{"{{flashcards}}"}</code> (Q&A Blöcke)
            </div>
          </div>
        )}

        {/* Tab 3: Folder-Routing Rules */}
        {activeSubTab === 'routing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label">Tag-basiertes Ordner-Routing</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Speichert Notizen automatisch in Unterordnern ab, wenn die KI passende Tags generiert (z. B. wenn Tag `#programmierung` enthält ➔ in Ordner `ObsidianVault/Coding` speichern).
              </p>
            </div>

            {/* Add new rule form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Wenn Tag enthält (z.B. coding)</label>
                <input
                  type="text"
                  className="text-input"
                  style={{ height: '40px', padding: '8px 12px', fontSize: '0.85rem' }}
                  placeholder="z.B. coding"
                  value={newRuleTag}
                  onChange={(e) => setNewRuleTag(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>...speichere in (z.B. Aetheris/Coding)</label>
                <input
                  type="text"
                  className="text-input"
                  style={{ height: '40px', padding: '8px 12px', fontSize: '0.85rem' }}
                  placeholder="z.B. Aetheris/Coding"
                  value={newRuleFolder}
                  onChange={(e) => setNewRuleFolder(e.target.value)}
                />
              </div>

              <button 
                className="btn btn-primary" 
                onClick={handleAddRule}
                style={{ height: '40px', padding: '0 16px', fontSize: '0.85rem' }}
              >
                + Hinzufügen
              </button>
            </div>

            {/* List existing rules */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
              {routingRules.length === 0 ? (
                <div style={{ padding: '16px', textCenter: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Noch keine Routing-Regeln angelegt. Alle Notizen landen im Standard-Zielordner.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {routingRules.map((rule, idx) => (
                    <div 
                      key={idx} 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: idx < routingRules.length - 1 ? '1px solid var(--border-glass)' : 'none', background: 'rgba(255,255,255,0.01)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>#{rule.tag}</span>
                        <span style={{ color: 'var(--text-muted)' }}>➔</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{rule.subfolder}</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveRule(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0 8px' }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="modal-footer" style={{ marginTop: '8px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
