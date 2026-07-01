import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Boot Express Backend Server
import './backend/server.js';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: '#0a0c18', // Match Aetheris dark mode background
    title: 'Aetheris - Obsidian Knowledge Synthesizer',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Hide the standard browser menus for a clean native app look
  win.setMenuBarVisibility(false);

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Wait a brief moment for the Vite dev server to start
    setTimeout(() => {
      win.loadURL('http://localhost:5173').catch(() => {
        // Fallback reload if Vite server was slightly slower
        setTimeout(() => win.loadURL('http://localhost:5173'), 1500);
      });
    }, 1500);
  } else {
    win.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
