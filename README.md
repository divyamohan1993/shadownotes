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

- **Real-time Speech-to-Text** — Browser-native Web Speech API for fast, lightweight transcription on any device
- **On-Device AI Extraction** — RunAnywhere LFM2 350M LLM analyzes transcripts and extracts structured findings via llama.cpp WASM
- **Keyword Fallback** — Instant regex-based extraction while LLM loads, ensuring intelligence from the first word
- **4 Domain Profiles** — Security Audit, Legal Deposition, Medical Notes, Incident Report — each with tailored extraction categories
- **Ephemeral Storage** — All data lives in browser memory only. No localStorage, no IndexedDB, no cookies
- **Session Dossier** — Complete summary view with all transcripts and extracted intelligence
- **DESTROY Session** — Animated data destruction that wipes all state completely
- **Classified Dossier UI** — Authentic declassified-document aesthetic with stamps, monospace typography, and CRT effects

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| AI SDK | RunAnywhere Web SDK (0.1.0-beta.9) |
| LLM | LFM2 350M Q4_K_M (Liquid AI) via llama.cpp WASM |
| STT | Web Speech API (browser-native) |
| Fallback | Keyword-based regex extraction engine |
| Styling | Custom CSS with JetBrains Mono + Special Elite fonts |

## Getting Started

### Prerequisites

- Node.js 18+
- A modern browser (Chrome 96+, Edge 96+ recommended)

### Installation

```bash
git clone https://github.com/divyamohan1993/shadownotes.git
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
Microphone -> Web Speech API (transcription) -> RunAnywhere LLM (intelligence extraction)
                                              -> Keyword fallback (instant, if LLM loading)
```

1. **Boot** — RunAnywhere SDK initializes and registers the LLM model
2. **Session Init** — Select a domain profile (Security, Legal, Medical, Incident). LLM begins downloading in background
3. **Voice Capture** — Click "BEGIN CAPTURE" to start recording via the browser's Web Speech API
4. **Transcription** — Speech is transcribed in real-time by the browser's native speech engine
5. **Intelligence Extraction** — If LLM is ready, the on-device AI extracts structured findings. Otherwise, keyword-based regex extraction provides instant results
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
  App.tsx                    # App shell, boot sequence, screen routing, session state
  runanywhere.ts             # RunAnywhere SDK init, LLM model registration
  extraction.ts              # Keyword-based intelligence extraction (regex fallback)
  types.ts                   # TypeScript interfaces
  domains.ts                 # Domain profiles with system prompts
  speech.d.ts                # Web Speech API type declarations
  hooks/
    useModelLoader.ts        # Model download + loading lifecycle hook
  components/
    SessionInit.tsx          # Domain selection + LLM preload progress
    ActiveCapture.tsx        # Web Speech API + LLM/keyword extraction pipeline
    SessionSummary.tsx       # Dossier view + destroy animation
  styles/
    index.css                # Classified Dossier theme
```

## Privacy & Security

- **On-device AI** — Intelligence extraction runs locally via RunAnywhere LLM (llama.cpp WASM)
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

## Testing

```bash
npx vitest run      # Run all 162 tests
npm run test:watch  # Watch mode
```

Test coverage includes:
- **60 unit tests** — Domain profiles, case number generation, system prompt validation
- **20 extraction tests** — Keyword-based intelligence extraction across all 4 domains
- **11 hook tests** — useModelLoader state transitions, error handling
- **65 component tests** — SessionInit, ActiveCapture, SessionSummary, App shell
- **6 integration tests** — Full session lifecycle for all 4 domains, ephemeral data wipe

## License

MIT

---

Built for the [RunAnywhere Vibe Challenge](https://vibechallenge.runanywhere.org/) Hackathon.
