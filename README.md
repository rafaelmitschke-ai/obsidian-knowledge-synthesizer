# ⚡ Aetheris - Multi-Platform Obsidian Knowledge Synthesizer

<p align="center">
  <b>KI-gestützte Wissenssynthese für Obsidian • Native Desktop App (Windows & Linux) • iOS Standalone PWA • Zwei-Wege-Synchronisation</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Plattform-Windows%20%7C%20Linux%20%7C%20iOS-6366f1?style=for-the-badge" alt="Plattformen" />
  <img src="https://img.shields.io/badge/Electron-43.0-0a0c18?style=for-the-badge&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React%20%2B%20Vite-8.0-61dafb?style=for-the-badge&logo=react" alt="React Vite" />
  <img src="https://img.shields.io/badge/Obsidian-Vault%20Native-8b5cf6?style=for-the-badge&logo=obsidian" alt="Obsidian" />
  <img src="https://img.shields.io/badge/AI%20Models-Gemini%20%7C%20OpenAI%20%7C%20Claude%20%7C%20DeepSeek-10b981?style=for-the-badge" alt="AI Models" />
</p>

---

## 🌟 Was ist Aetheris?

**Aetheris** ist eine universelle Wissens- und Synthesezentrale für deinen lokalen [Obsidian](https://obsidian.md)-Tresor. Sie wandelt Audioaufnahmen, Hörbücher, YouTube-Videos, Podcasts, E-Books und handschriftliche Skizzen in verknüpfte, formatierte Obsidian-Markdown-Notizen um. 

Aetheris läuft als **vollwertige native Desktop-App** unter Windows und Linux, verbindet sich nahtlos mit deinem **iPhone/iPad als iOS-PWA**, synchronisiert Notizen live in beide Richtungen und visualisiert deinen gesamten Wissensgraphen in einer hardwarebeschleunigten 2D-Netzwerk-Canvas.

---

## ✨ Die wichtigsten Highlights

### 🖥️ 1. Native Desktop- & Mobil-Apps
* **Windows (.exe & Installer):** Starte Aetheris mit einem einzigen Klick. Es stehen sowohl ein klassischer Windows-Setup-Installer (`Aetheris Setup.exe`) als auch eine sofort lauffähige portable Datei (`Aetheris.exe`) zur Verfügung.
* **Linux (.AppImage & .deb):** Vorkonfiguriert für alle gängigen Linux-Distributionen (Ubuntu, Debian, Fedora, Arch).
* **iOS Standalone PWA:** Öffne Aetheris im Safari-Browser auf deinem iPhone und wähle *„Zum Home-Bildschirm“*. Aetheris startet als randlose Vollbild-App mit Dark-Theme-Statusleiste und angepasstem Safe-Area-Layout für iPhone-Notches und Dynamic Islands.

---

### 🔄 2. Zwei-Wege-Synchronisation (Two-Way Sync)
* **Obsidian ➔ Aetheris (Polling File Watcher):** Wenn du eine Notiz in Obsidian bearbeitest, erkennt Aetheris dies alle 4 Sekunden und aktualisiert Vorschau und Editor live.
* **Aetheris ➔ Obsidian (Debounced Auto-Save):** Sobald du im Aetheris-Editor tippst, wird deine Notiz nach 2,5 Sekunden Inaktivität automatisch in deinen Obsidian-Tresor gespeichert und die dazugehörige Begleit-PDF aktualisiert.
* **Konflikterkennung:** Falls eine Datei zeitgleich an beiden Orten verändert wird, schützt Aetheris deine Daten mit einem `⚠️ Konflikt`-Status und einem 1-Klick-Button (`[Obsidian-Version laden]`).

---

### 📖 3. Multi-Note Kapitel-Splitting (Chunking)
* **Kapitel-Einzelnotizen:** Zerlege lange Texte, Manuskripte oder ganze E-Books auf Wunsch automatisch in modular verknüpfte Einzelkapitel.
* **Navigations-Header & Footer:** Jede Unter-Notiz enthält automatische Querverweise (`← [[Teil X-1]] | [[Index]] | [[Teil X+1]] →`).
* **Zentraler Index:** Erstellt automatisch ein übersichtliches Inhaltsverzeichnis mit Wiki-Links und Zusammenfassungen aller Kapitel.

---

### 🕸️ 4. Interaktiver 2D Vault-Graph
* **Fuzzy-Search & Auto-Complete:** Finde Notizen im Suchfeld der Graph-Ansicht blitzschnell über ein Dropdown-Menü; die Kamera gleitet sanft zur gewünschten Notiz und hebt deren Nachbarschaft hervor.
* **Timeline-Filter (Zeitstrahl):** Filtere Knoten nach Alter (*Heute*, *7 Tage*, *30 Tage*, *90 Tage*). Ältere Notizen werden dynamisch ausgeblendet und die Physik-Simulation ordnet die verbleibenden Knoten neu an.
* **Performante Canvas:** Unterstützt Drag & Drop, Pinch-to-Zoom, Ordner-Farbcodierung und Kantengewichtung (`[[Wiki-Links]]`).

---

### 🎙️ 5. Audio, Podcasts & Hörbücher (M4B & AAX)
* **Audible AAX / M4B Decryption:** Integrierter FFmpeg-Entschlüssler zum direkten Entsperren geschützter `.aax`-Hörbücher in DRM-freie `.m4b`-Dateien mittels Activation Bytes.
* **Drag & Drop Intercept:** Erkennt verschlüsselte Hörbuch-Dateien beim Hineinziehen sofort und bietet Unterstützung an.
* **Integrierte Dateiauswahl (`📂 Datei wählen`):** Ermittelt absolute Dateipfade direkt im System.
* **Spotify & RSS:** Löst Spotify-Podcasts und beliebige RSS-Feeds direkt in abspielbare Episoden auf.
* **Whisper & Native Audio LLMs:** Gemini analysiert Audio direkt oder transkribiert über Whisper für Nicht-Gemini-Modelle.

---

### 📚 6. E-Book Extraktion & Vision OCR (NotebookLM)
* **PDF & EPUB:** Direkte Extraktion von E-Book-Texten.
* **Vision / OCR Modus:** Für eingescannte Dokumente, Skizzen, Grafiken oder NotebookLM-PDF-Exporte. Die Seiten werden visuell als Bildfolge von multimodalen Modellen analysiert.

---

### 🤖 7. Multi-Provider LLMs & Reasoning
* **Google Gemini:** Gemini 2.5 Flash, 2.5 Pro, 2.0 Flash
* **OpenAI:** GPT-4o, o1, o3-mini (mit automatischer Deaktivierung von Temperature-Parametern für Reasoning-Modelle)
* **Anthropic:** Claude 3.5 Sonnet, Claude 3.5 Haiku
* **OpenRouter:** DeepSeek R1, DeepSeek V3, Llama 3.3, Qwen 2.5

---

## 🛠️ Systemvoraussetzungen

* **Betriebssystem:** Windows 10/11, Linux (64-Bit) oder iOS (via Safari PWA)
* **Node.js:** Version 18 oder neuer (nur für Entwicklung und eigene Builds erforderlich)
* **Obsidian:** Ein lokaler Tresor-Ordner
* **FFmpeg:** *(Optional)* Für die Audible `.aax`-Entschlüsselung im System-PATH hinterlegt

---

## 🚀 Schnelleinstieg

### A. Fertige Desktop-App starten (Windows)
1. Lade dir die neueste `Aetheris Setup.exe` oder `Aetheris.exe` aus dem Ordner `dist-electron/` oder den Releases herunter.
2. Doppelklick zum Starten – kein Terminal oder Node.js notwendig!

---

### B. Entwicklungsmodus (Source Code)

1. **Repository klonen:**
   ```bash
   git clone https://github.com/rafaelmitschke-ai/obsidian-knowledge-synthesizer.git
   cd obsidian-knowledge-synthesizer
   ```

2. **Abhängigkeiten installieren:**
   ```bash
   npm run install:all
   ```

3. **Desktop-App im Entwicklungsmodus starten:**
   ```bash
   npm run desktop
   ```
   *(Startet das Backend auf Port 5001, das Frontend mit Hot-Reload auf Port 5173 und öffnet das Electron-Fenster).*

---

### C. Eigene Installationspakete bauen

| Plattform | Befehl | Ausgabe |
|---|---|---|
| **Windows** | `npm run build:win` | `dist-electron/Aetheris Setup 1.0.0.exe` & `Aetheris 1.0.0.exe` |
| **Linux** | `npm run build:linux` | `dist-electron/Aetheris-1.0.0.AppImage` & `.deb` |
| **Beide** | `npm run build:all` | Erzeugt alle Desktop-Targets |

---

## 📱 Mobile Einrichtung auf iOS (iPhone / iPad)

1. Starte Aetheris auf deinem Rechner (`npm run desktop` oder die `.exe`).
2. Öffne **Safari** auf deinem iPhone und gib die IP deines Rechners ein:
   ```text
   http://<DEINE-PC-IP>:5001
   ```
   *(Tipp: Funktioniert auch von unterwegs über ein VPN wie Tailscale).*
3. Tippe in Safari auf das **Teilen-Symbol** (Viereck mit Pfeil nach oben).
4. Scrolle nach unten und wähle **„Zum Home-Bildschirm“**.
5. Aetheris erscheint nun als eigene App auf deinem iPhone und startet im randlosen Vollbildmodus!

---

## ⚙️ Einstellungen & Vault-Verbindung

Klicke oben rechts auf das **Zahnrad-Symbol** in Aetheris:
1. **Vault-Pfad:** Gib den Pfad zu deinem Obsidian-Tresor an (z. B. `C:\Users\Name\Documents\jARVIS`).
2. **Ordner:** Zielordner für neue Notizen (z. B. `00 Kontext` oder `Synthesen`).
3. **API-Schlüssel:** Trage deine Schlüssel für Gemini, OpenAI, Anthropic oder OpenRouter ein.
4. **Companion PDF-Pfad:** Optionaler Speicherort für automatisch generierte Begleit-PDFs.

---

## 📄 Lizenz & Danksagung

Entwickelt für Obsidian-Enthusiasten und Knowledge-Worker.  
Feedback und Pull Requests sind herzlich willkommen!
