const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, Notification, clipboard, nativeImage, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Portable mode: keep Electron userData inside the app folder (avoids %APPDATA% permission issues).
try {
  const portableDataDir = path.join(path.dirname(process.execPath), 'WindowsDictationData');
  fs.mkdirSync(portableDataDir, { recursive: true });
  app.setPath('userData', portableDataDir);
} catch {
  // ignore
}

let mainWindow;
let tray;
let isQuitting = false;

const defaultConfig = {
  apiKey: '',
  hotkey: 'F8',
  language: 'de',
  autoPaste: true,
  closeToTray: true
};

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return { ...defaultConfig };
  }
}

function writeConfig(nextConfig) {
  const finalConfig = { ...defaultConfig, ...nextConfig };
  fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(finalConfig, null, 2), 'utf8');
  return finalConfig;
}

function iconPath() {
  return path.join(__dirname, 'assets', 'icon.png');
}

function notify(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 380,
    minHeight: 650,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('minimize', (event) => {
    const config = readConfig();
    if (config.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      notify('Windows Dictation', 'Läuft weiter im Hintergrund.');
    }
  });

  mainWindow.on('close', (event) => {
    const config = readConfig();
    if (!isQuitting && config.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      notify('Windows Dictation', 'Im Infobereich weiter aktiv.');
    }
  });
}

function createTray() {
  try {
    tray = new Tray(iconPath());
  } catch {
    const img = nativeImage.createFromPath(iconPath());
    tray = new Tray(img);
  }
  tray.setToolTip('Windows Dictation');
  const menu = Menu.buildFromTemplate([
    {
      label: 'Fenster öffnen',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'README öffnen',
      click: () => shell.openPath(path.join(__dirname, 'README.md'))
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  const config = readConfig();
  const hotkey = config.hotkey || defaultConfig.hotkey;
  const success = globalShortcut.register(hotkey, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hotkey-toggle');
    }
  });
  return { success, hotkey };
}

async function pasteTextIntoActiveWindow(text) {
  clipboard.writeText(text);

  if (process.platform !== 'win32') {
    return { ok: false, fallback: true, reason: 'non-windows-platform' };
  }

  return new Promise((resolve) => {
    const psScript = [
      'Add-Type -AssemblyName System.Windows.Forms',
      'Start-Sleep -Milliseconds 120',
      '[System.Windows.Forms.SendKeys]::SendWait("^v")'
    ].join('; ');

    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', psScript], {
      windowsHide: true
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, fallback: true, reason: stderr || `exit-${code}` });
      }
    });

    child.on('error', (error) => {
      resolve({ ok: false, fallback: true, reason: error.message });
    });
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'microphone') {
      callback(true);
      return;
    }
    callback(false);
  });

  createWindow();
  createTray();
  const hotkeyState = registerHotkey();
  if (!hotkeyState.success) {
    notify('Windows Dictation', `Hotkey ${hotkeyState.hotkey} konnte nicht registriert werden.`);
  }
});

ipcMain.handle('config:load', () => {
  const config = readConfig();
  return {
    ...config,
    hasApiKey: Boolean(config.apiKey)
  };
});

ipcMain.handle('config:save', (_event, partial) => {
  const next = writeConfig({ ...readConfig(), ...partial });
  const hotkeyState = registerHotkey();
  return {
    ...next,
    hasApiKey: Boolean(next.apiKey),
    hotkeyRegistered: hotkeyState.success
  };
});

ipcMain.handle('dictation:complete', async (_event, { text, autoPaste }) => {
  const result = { pasted: false, clipboardOnly: false, reason: null };

  if (!text || !text.trim()) {
    return result;
  }

  if (autoPaste) {
    const pasteResult = await pasteTextIntoActiveWindow(text);
    result.pasted = pasteResult.ok;
    result.clipboardOnly = !pasteResult.ok;
    result.reason = pasteResult.reason || null;
  } else {
    clipboard.writeText(text);
    result.clipboardOnly = true;
  }

  if (result.pasted) {
    notify('Windows Dictation', 'Text eingefügt.');
  } else {
    notify('Windows Dictation', 'Text liegt in der Zwischenablage.');
  }

  return result;
});

ipcMain.handle('app:show', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('link:open', (_event, url) => shell.openExternal(url));

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep app alive in tray on Windows.
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

