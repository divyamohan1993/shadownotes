# ShadowNotes

**Zero-Trust Investigator's Notebook** — On-device AI for air-gapped voice capture and intelligence extraction.

> All AI processing runs locally in your browser via WebAssembly. No data ever leaves your device. No servers. No API keys. No trace.

---

## The Problem

Professionals in security auditing, legal proceedings, medical documentation, and incident response routinely handle extremely sensitive information. Existing note-taking tools either:

- **Send data to cloud servers** — unacceptable for classified or HIPAA-protected information
- **Require constant internet** — unusable in secure facilities, field operations, or air-gapped environments
- **Leave digital traces** — saved files, cloud sync, and browser history create attack surfaces

## The Solution

ShadowNotes is a completely on-device AI notebook that runs entirely in your browser. It captures voice via microphone, transcribes speech to text, and uses an on-device LLM to extract structured intelligence — all without a single network request after initial model download.

**When you close the tab, everything is gone.** Zero persistence. Zero trace.

## Features

- **Voice Activity Detection (VAD)** — Silero VAD v5 detects when you start and stop speaking
- **Real-time Speech-to-Text** — Whisper Tiny English transcribes your speech on-device
- **AI Intelligence Extraction** — LFM2 350M LLM analyzes transcripts and extracts structured findings
- **4 Domain Profiles** — Security Audit, Legal Deposition, Medical Notes, Incident Report — each with tailored extraction categories
- **Ephemeral Storage** — All data lives in browser memory only. No localStorage, no IndexedDB, no cookies
- **Session Dossier** — Complete summary view with all transcripts and extracted intelligence
- **DESTROY Session** — Animated data destruction that wipes all state completely
- **Classified Dossier UI** — Authentic declassified-document aesthetic with stamps, monospace typography, and CRT effects

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 6 |
| AI SDK | RunAnywhere Web SDK (0.1.0-beta.9) |
| LLM | LFM2 350M Q4_K_M (Liquid AI) via llama.cpp WASM |
| STT | Whisper Tiny English via sherpa-onnx WASM |
| VAD | Silero VAD v5 via sherpa-onnx WASM |
| Styling | Custom CSS with JetBrains Mono + Special Elite fonts |

## Getting Started

### Prerequisites

- Node.js 18+
- A modern browser (Chrome 96+, Edge 96+ recommended)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/shadownotes.git
cd shadownotes
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in Chrome or Edge.

### Production Build

```bash
npm run build
npm run preview
```

## How It Works

### Data Flow

```
Microphone -> VAD (speech detection) -> STT (transcription) -> LLM (intelligence extraction)
```

1. **Session Init** — Select a domain profile (Security, Legal, Medical, Incident)
2. **Model Download** — Three AI models download directly to your browser (~360MB total, cached in OPFS)
3. **Voice Capture** — Click "BEGIN CAPTURE" to start recording. VAD automatically detects speech segments
4. **Transcription** — Each speech segment is transcribed on-device by Whisper
5. **Intelligence Extraction** — The LLM analyzes the full transcript and extracts structured findings based on the selected domain
6. **Session Dossier** — Click "END SESSION" for a complete summary view
7. **Destroy** — Click "DESTROY SESSION" to permanently wipe all data from memory

### Domain Profiles

| Domain | Extraction Categories |
|--------|----------------------|
| Security Audit | Vulnerabilities, Timeline, Evidence, Affected Systems, Risk Assessment |
| Legal Deposition | Key Statements, Timeline, Parties Involved, Contradictions, Exhibits |
| Medical Notes | Symptoms, Diagnoses, Medications, Vital Signs, Follow-up Actions |
| Incident Report | Incident Timeline, Witnesses, Damage Assessment, Root Cause, Next Steps |

## Architecture

```
src/
  App.tsx                    # App shell, screen routing, session state
  runanywhere.ts             # SDK initialization, model catalog
  types.ts                   # TypeScript interfaces
  domains.ts                 # Domain profiles with system prompts
  hooks/
    useModelLoader.ts        # Model download + loading hook
  components/
    SessionInit.tsx          # Domain selection + model loading
    ActiveCapture.tsx        # VAD + STT + LLM capture pipeline
    SessionSummary.tsx       # Dossier view + destroy animation
  styles/
    index.css                # Classified Dossier theme (1900+ lines)
```

## Privacy & Security

- **No server communication** — After model download, the app makes zero network requests
- **No data persistence** — All data is held in React state (JavaScript heap memory)
- **No cookies, localStorage, or IndexedDB** used for session data
- **Tab close = total wipe** — Closing the browser tab permanently destroys all data
- **beforeunload warning** — Prevents accidental data loss during active sessions
- **Models cached in OPFS** — Browser's private filesystem, not accessible to other origins

## Deployment

The app includes configuration for Vercel deployment with the required Cross-Origin Isolation headers:

```bash
# Deploy to Vercel
npx vercel
```

Alternatively, any static hosting with these headers works:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

## License

MIT

---

Built for the RunAnywhere Vibe Challenge Hackathon.
