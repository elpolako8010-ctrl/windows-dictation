# Windows Dictation

Windows Dictation is a simple push-to-talk dictation app for Windows.
It records microphone input, sends the audio to Groq Whisper, and pastes the transcribed text into the active app.

## Features

- Global hotkey support
- Push-to-talk recording
- German dictation by default
- Automatic paste into the active window
- Clipboard fallback if auto-paste fails
- Portable local app data inside the project folder

## Current Setup

- App folder: `apps/Windows-Dictation-0.1.0`
- Executable: `apps/Windows-Dictation-0.1.0/Windows Dictation.exe`
- Start script: `Run-WindowsDictation.ps1`

## Run

Start with PowerShell:

```powershell
.\Run-WindowsDictation.ps1
```

Or launch the executable directly:

```powershell
.\apps\Windows-Dictation-0.1.0\Windows Dictation.exe
```

## Configuration

The app stores its runtime data locally in:

```text
apps/Windows-Dictation-0.1.0/WindowsDictationData/
```

The local `config.json` is ignored by Git so API keys are not committed.

## Notes

- Default language is German.
- The current hotkey is `F9`.
- This repo is prepared for sharing publicly without local secrets.

## For YouTube

This project is a compact example of a real desktop AI workflow:

- voice input
- speech-to-text
- hotkey control
- desktop automation

If you show it in a video, the easiest demo flow is:

1. Start the app
2. Press `F9`
3. Speak a short sentence
4. Press `F9` again
5. Show the text appearing in the target app