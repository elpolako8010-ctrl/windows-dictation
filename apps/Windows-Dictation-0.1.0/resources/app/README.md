# Windows Dictation

Windows Dictation ist ein **einfaches Windows-Diktier-Tool auf Deutsch**.
Du drückst einen globalen Hotkey, sprichst kurz, und der erkannte Text wird mit **Groq Whisper** transkribiert und direkt in das aktuell aktive Programm eingefügt.

## Warum dieser Stack?

Ich habe **Electron + Vanilla JS** gewählt.

**Vorteile**
- schnell baubar und leicht weiterzugeben
- globaler Hotkey direkt per Electron
- Mikrofonaufnahme ohne extra Backend
- einfache Oberfläche für nicht-technische Nutzer
- gut als portable Windows-App verteilbar

**Tradeoffs**
- größer als eine native Win32-App
- automatisches Einfügen nutzt unter Windows `SendKeys`, was bei manchen Admin-/Sonderfenstern nicht perfekt ist
- für einen richtigen Installer baut man am besten zusätzlich einmal direkt auf Windows

## Funktionen
- globaler Hotkey (Standard: `F8`)
- Start/Stop per Hotkey oder Button
- Transkription mit Groq `whisper-large-v3-turbo`
- Standard-Sprache: **Deutsch**
- automatisches Einfügen in die aktive App
- Fallback: Text bleibt wenigstens in der Zwischenablage
- läuft auf Wunsch im Tray/Hintergrund weiter

## Einrichtung für deine Freundin

### Option A – am einfachsten
1. `Windows Dictation.exe` starten
2. Im Feld **Groq API-Schlüssel** den Schlüssel einfügen
3. **Einstellungen speichern** klicken
4. In Word / Mail / Chatfenster klicken
5. `F8` drücken → sprechen → `F8` drücken

### Wo landet der API-Schlüssel?
Windows Dictation speichert die Einstellung lokal hier:

`%APPDATA%\Windows Dictation\config.json`

Falls nötig, kann man die Datei auch manuell bearbeiten.

Beispiel:

```json
{
  "apiKey": "YOUR_API_KEY_HERE",
  "hotkey": "F8",
  "language": "de",
  "autoPaste": true,
  "closeToTray": true
}
```

## Groq API-Schlüssel holen
- Öffnen: <https://console.groq.com/keys>
- Einen neuen Schlüssel anlegen
- In Windows Dictation einfügen und speichern

## Praktische Hinweise
- Wenn automatisches Einfügen einmal nicht klappt, liegt der Text trotzdem in der Zwischenablage.
- Bei Programmen mit Admin-Rechten kann Windows das Einfügen blockieren.
- Wenn `F8` schon belegt ist, nimm z. B. `F9` oder `Alt+Space`.

## Entwicklung

```bash
npm install
npm start
```

## Windows-Paket bauen

### Standard
```bash
npm run package:win
```

Das baut via `electron-builder` echte **Windows-x64-Artefakte**:
- `Windows-Dictation-...-Windows-Portable.exe`
- `Windows-Dictation-...-win-x64.zip`

### Fallback ohne Installer-Magie
```bash
npm run package:win:manual
```

Das erzeugt zusätzlich einen portablen Ordner mit `Windows Dictation.exe` plus ZIP-Datei.
Praktisch, falls ein bestimmter Builder auf einem Rechner zickt.


