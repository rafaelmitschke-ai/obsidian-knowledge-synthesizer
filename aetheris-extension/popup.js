document.addEventListener('DOMContentLoaded', async () => {
  const pageTitleEl = document.getElementById('page-title');
  const pageTypeEl = document.getElementById('page-type');
  const clipBtn = document.getElementById('clip-btn');
  const toastEl = document.getElementById('toast');
  const toggleSettingsBtn = document.getElementById('toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');
  const serverUrlInput = document.getElementById('server-url');

  let activeTab = null;
  let isYoutube = false;
  let serverUrl = 'http://localhost:5001';

  // 1. Load Settings
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['serverUrl'], (result) => {
      if (result.serverUrl) {
        serverUrl = result.serverUrl;
        serverUrlInput.value = serverUrl;
      } else {
        serverUrlInput.value = serverUrl;
      }
    });
  } else {
    serverUrlInput.value = serverUrl;
  }

  // Save Settings on Input
  serverUrlInput.addEventListener('input', () => {
    serverUrl = serverUrlInput.value.trim() || 'http://localhost:5001';
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ serverUrl });
    }
  });

  // Toggle Settings Panel
  toggleSettingsBtn.addEventListener('click', () => {
    const isVisible = settingsPanel.style.display === 'block';
    settingsPanel.style.display = isVisible ? 'none' : 'block';
  });

  // Helper to show status message
  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast toast-${type}`;
    toastEl.style.display = 'block';
  }

  // 2. Query Active Tab Details
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      pageTitleEl.textContent = 'Keine aktive Seite gefunden.';
      clipBtn.disabled = true;
      return;
    }

    activeTab = tabs[0];
    const url = activeTab.url || '';
    const title = activeTab.title || 'Ohne Titel';

    pageTitleEl.textContent = title;
    
    // Check type
    isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
    pageTypeEl.textContent = isYoutube ? '📹 YouTube-Video' : '📄 Text-Dokument / Website';

  } catch (err) {
    console.error('Error fetching tab:', err);
    pageTitleEl.textContent = 'Fehler beim Abrufen der Tab-Details.';
    clipBtn.disabled = true;
  }

  // 3. Handle Clip Action
  clipBtn.addEventListener('click', async () => {
    if (!activeTab) return;

    clipBtn.disabled = true;
    clipBtn.textContent = 'Verbinde...';
    toastEl.style.display = 'none';

    try {
      let body = {
        type: isYoutube ? 'youtube' : 'text',
        inputVal: activeTab.url,
        inputTitle: activeTab.title || 'Clipped Page'
      };

      if (!isYoutube) {
        clipBtn.textContent = 'Lese Text...';
        // Extract text from page using content script injection
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => document.body.innerText
        });

        if (results && results[0] && results[0].result) {
          body.inputVal = results[0].result;
        } else {
          throw new Error('Inhalt der Seite konnte nicht ausgelesen werden.');
        }
      }

      clipBtn.textContent = 'Sende zu Aetheris...';
      const cleanServerUrl = serverUrl.replace(/\/$/, ''); // strip trailing slash

      const response = await fetch(`${cleanServerUrl}/api/queue/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Serverfehler beim Hinzufügen.');
      }

      showToast('⚡ Erfolgreich zur Warteschlange hinzugefügt!', 'success');
      clipBtn.textContent = 'Erledigt!';
      
      // Auto-close extension popup after 1.5 seconds on success
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (err) {
      console.error(err);
      showToast(`❌ Fehler: ${err.message}. Läuft der Server unter ${serverUrl}?`, 'error');
      clipBtn.disabled = false;
      clipBtn.textContent = '⚡ Wissen clippen';
    }
  });
});
