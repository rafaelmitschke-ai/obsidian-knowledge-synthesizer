# ⚡ Aetheris - Obsidian Knowledge Synthesizer

Aetheris ist ein intelligentes, KI-gestütztes Tool zur Wissenssynthese, das Audioaufnahmen, Podcasts, YouTube-Videos und Web-Inhalte analysiert, strukturiert und nahtlos in deinen Obsidian-Tresor integriert. Das Highlight ist die interaktive, performante 2D-Netzwerk-Graph-Ansicht, die deinen gesamten Tresor abbildet und Verbindungen visualisiert.

---

## ✨ Features

- **📻 Spotify & Podcast Resolution**: Löst Spotify-Show/Episoden-Links und standardmäßige Podcast-Feeds automatisch in abspielbare MP3s auf.
- **🎙️ Audio & Voice Memo Synthese**: Lade Audio-Dateien hoch oder nimm Memos direkt über das Mikrofon auf. Gemini analysiert diese und generiert strukturierte Zusammenfassungen, Key Takeaways und Karteikarten.
- **🕸️ Vault-weiter Interaktiver Graph**: Visualisiert die Wiki-Link-Verbindungen (`[[Notiz]]`) deines gesamten Obsidian-Tresors. Unterstützt flüssiges Zoomen (Pinch-to-touch), Panning, Drag-and-Drop und das direkte Öffnen jeder Notiz im Editor.
- **✏️ Integrierter Markdown-Editor**: Bearbeite und speichere Notizen direkt im Tool. Automatische PDF-Generierung für jede Notiz.
- **🔍 Lokale Suchmaschine (TF-IDF & Semantisch)**: Durchsuche deinen Tresor blitzschnell lokal oder nutze den **RAG Obsidian Copilot**, um Fragen basierend auf deinen eigenen Notizen per KI zu beantworten.

---

## 🛠️ Anforderungen

- **Node.js** (Version 18 oder neuer)
- **Obsidian** (installierte App & ein aktiver Tresor)
- **Gemini API Key** (für die KI-Features und Spotify-Auflösung)

---

## 🚀 Installation & Setup

1. **Repository klonen**:
   ```bash
   git clone https://github.com/rafaelmitschke-ai/obsidian-knowledge-synthesizer.git
   cd obsidian-knowledge-synthesizer
   ```

2. **Abhängigkeiten installieren**:
   Installiere die Node-Pakete für das Hauptprojekt, das Backend und das Frontend:
   ```bash
   # Im Hauptverzeichnis
   npm install
   
   # Im Backend-Verzeichnis
   cd backend
   npm install
   
   # Im Frontend-Verzeichnis
   cd ../frontend
   npm install
   cd ..
   ```

3. **Entwicklungsserver starten**:
   Starte Frontend und Backend gleichzeitig mit einem einzigen Befehl:
   ```bash
   npm run dev
   ```
   - Das **Frontend** läuft standardmäßig auf: `http://localhost:5173/`
   - Das **Backend** läuft standardmäßig auf: `http://localhost:5001/`

---

## ⚙️ Konfiguration (In der Web-App)

Klicke oben rechts auf das **Zahnrad-Symbol** (Einstellungen):
1. **Gemini API-Key**: Trage deinen Google Gemini API-Schlüssel ein.
2. **Obsidian-Tresorpfad**: Gib den absoluten Pfad zu deinem Obsidian-Tresor an (z. B. `C:\Users\Name\Documents\ObsidianVault`).
3. **Ordner**: Der Standard-Unterordner für neu generierte Aetheris-Notizen (Voreinstellung: `Aetheris`).

---

## 📱 Mobile Nutzung

Aetheris ist vollständig mobil-optimiert! Wenn sich dein PC und dein Handy im selben WLAN befinden:
1. Starte den Server (`npm run dev`).
2. Öffne den im Terminal angezeigten Netzwerk-Link (z. B. `http://192.168.X.X:5173`) auf deinem Smartphone.
3. Du kannst Audio aufnehmen, Notizen editieren und den Graphen per Touch-Gesten (Pinch-to-Zoom, Ziehen) steuern.
