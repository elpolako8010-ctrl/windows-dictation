const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');
const toggleBtn = document.getElementById('toggle-btn');
const saveBtn = document.getElementById('save-btn');
const apiKeyEl = document.getElementById('api-key');
const hotkeyEl = document.getElementById('hotkey');
const autoPasteEl = document.getElementById('auto-paste');
const closeToTrayEl = document.getElementById('close-to-tray');
const resultEl = document.getElementById('result');
const lastActionEl = document.getElementById('last-action');
const helpLink = document.getElementById('groq-link');

let config = {
  apiKey: '',
  hotkey: 'F8',
  language: 'de',
  autoPaste: true,
  closeToTray: true
};

let mediaRecorder = null;
let audioChunks = [];
let currentStream = null;
let isRecording = false;
let isBusy = false;

function setStatus(title, detail, tone = 'idle') {
  statusEl.textContent = title;
  detailEl.textContent = detail;
  document.body.dataset.tone = tone;
}

function setLastAction(text) {
  lastActionEl.textContent = text || 'Noch nichts transkribiert.';
}

function loadForm() {
  apiKeyEl.value = config.apiKey || '';
  hotkeyEl.value = config.hotkey || 'F8';
  autoPasteEl.checked = Boolean(config.autoPaste);
  closeToTrayEl.checked = config.closeToTray !== false;
}

async function loadConfig() {
  config = await window.picoClaw.loadConfig();
  loadForm();
  setStatus('Bereit', `Drücke ${config.hotkey || 'F8'}, um die Aufnahme zu starten.`, 'idle');
  if (config.hasApiKey) {
    setLastAction('API-Schlüssel gespeichert.');
  } else {
    setLastAction('Bitte zuerst deinen Groq API-Schlüssel eintragen.');
  }
}

async function saveConfig() {
  const next = {
    apiKey: apiKeyEl.value.trim(),
    hotkey: hotkeyEl.value.trim() || 'F8',
    autoPaste: autoPasteEl.checked,
    closeToTray: closeToTrayEl.checked,
    language: 'de'
  };

  config = await window.picoClaw.saveConfig(next);
  loadForm();
  setStatus('Gespeichert', `Hotkey aktiv: ${config.hotkey}.`, 'idle');
  setLastAction(config.hotkeyRegistered === false
    ? `Hotkey ${config.hotkey} konnte nicht registriert werden.`
    : 'Einstellungen gespeichert.');
}

function pickMimeType() {
  const preferred = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4'
  ];
  return preferred.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

async function ensureStream() {
  if (currentStream) {
    return currentStream;
  }

  currentStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  });

  return currentStream;
}

async function startRecording() {
  if (isBusy || isRecording) {
    return;
  }

  if (!config.apiKey?.trim()) {
    setStatus('API-Schlüssel fehlt', 'Trage unten deinen Groq API-Schlüssel ein und speichere ihn.', 'warn');
    setLastAction('Ohne API-Schlüssel kann keine Transkription gestartet werden.');
    await window.picoClaw.showApp();
    return;
  }

  try {
    const stream = await ensureStream();
    audioChunks = [];
    const mimeType = pickMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      await transcribeAndInsert();
    };

    mediaRecorder.start(250);
    isRecording = true;
    toggleBtn.textContent = 'Aufnahme stoppen';
    setStatus('Aufnahme läuft', `Sprich jetzt. Mit ${config.hotkey} stoppst du wieder.`, 'recording');
    setLastAction('Audio wird aufgenommen ...');
  } catch (error) {
    console.error(error);
    setStatus('Mikrofonfehler', 'Bitte Mikrofon prüfen und App neu starten.', 'error');
    setLastAction(error.message || 'Mikrofon konnte nicht geöffnet werden.');
  }
}

function stopRecording() {
  if (!mediaRecorder || !isRecording) {
    return;
  }

  isRecording = false;
  isBusy = true;
  toggleBtn.textContent = 'Verarbeite ...';
  setStatus('Verarbeitung', 'Audio wird zu Groq gesendet ...', 'busy');
  setLastAction('Transkription läuft ...');

  try {
    mediaRecorder.requestData();
  } catch {}

  mediaRecorder.stop();
}

async function transcribeAndInsert() {
  try {
    const mimeType = audioChunks[0]?.type || 'audio/webm';
    const blob = new Blob(audioChunks, { type: mimeType });

    if (!blob || blob.size === 0) {
      throw new Error('Audioaufnahme ist leer. Bitte 1–2 Sekunden sprechen und dann stoppen.');
    }

    const filename = mimeType.includes('mp4') ? 'aufnahme.mp4' : 'aufnahme.webm';
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', config.language || 'de');
    formData.append('temperature', '0');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq Fehler ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = (data.text || '').trim();

    if (!text) {
      throw new Error('Keine Transkription erhalten.');
    }

    resultEl.value = text;

    const insertResult = await window.picoClaw.completeDictation({
      text,
      autoPaste: Boolean(config.autoPaste)
    });

    if (insertResult.pasted) {
      setStatus('Fertig', 'Text wurde in die aktive App eingefügt.', 'success');
      setLastAction('Transkription erfolgreich eingefügt.');
    } else {
      setStatus('Fertig', 'Text liegt in der Zwischenablage.', 'success');
      setLastAction('Automatisches Einfügen fehlgeschlagen – Text wurde in die Zwischenablage kopiert.');
    }
  } catch (error) {
    console.error(error);
    setStatus('Fehler', 'Transkription fehlgeschlagen. Details stehen unten.', 'error');
    setLastAction(error.message || 'Unbekannter Fehler.');
  } finally {
    isBusy = false;
    toggleBtn.textContent = 'Aufnahme starten';
    setTimeout(() => {
      if (!isRecording && !isBusy) {
        setStatus('Bereit', `Drücke ${config.hotkey || 'F8'}, um erneut aufzunehmen.`, 'idle');
      }
    }, 1200);
  }
}

async function toggleRecording() {
  const scrollY = window.scrollY;
  if (isBusy) {
    return;
  }

  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }

  requestAnimationFrame(() => {
    try {
      window.scrollTo(0, scrollY);
    } catch {}
  });
}

toggleBtn.addEventListener('click', () => {
  try {
    toggleBtn.blur();
  } catch {}
  toggleRecording();
});

saveBtn.addEventListener('click', async () => {
  await saveConfig();
});

helpLink.addEventListener('click', (event) => {
  event.preventDefault();
  window.picoClaw.openLink('https://console.groq.com/keys');
});

window.picoClaw.onHotkeyToggle(() => {
  toggleRecording();
});

loadConfig();
