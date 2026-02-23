# Hybrid Architecture Design

## Problem
Removing RunAnywhere SDK entirely disqualifies the hackathon submission. But running all 3 WASM models (VAD + STT + LLM) freezes slow devices due to audio processing on main thread.

## Solution
Web Speech API for transcription + RunAnywhere LLM for intelligence extraction. Only the LLM model (250MB) is needed — no VAD or Whisper WASM. The LLM processes finished text strings, not streaming audio, so it won't freeze the main thread.

## Pipeline
```
Microphone -> Web Speech API (browser-native) -> transcript text
    -> RunAnywhere LLM (on-device WASM) -> structured intelligence
    -> Keyword extraction fallback if LLM unavailable
```

## Key Changes
- `runanywhere.ts`: Register only LLM model (remove Whisper + VAD)
- `App.tsx`: Call initSDK() non-blocking during boot
- `SessionInit.tsx`: Download LLM in background, session starts immediately
- `ActiveCapture.tsx`: Try LLM extraction first, fall back to keywords
- Docs: Update submission.md, architecture.md, privacy-proof.md
