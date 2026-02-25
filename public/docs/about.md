# ShadowNotes — Zero-Trust Intelligence Extraction

**Speak. Extract. Destroy.**

ShadowNotes is a real-time intelligence extraction system that runs entirely in your browser. No servers, no cloud, no trace. Speak into your microphone and watch as on-device AI categorizes your words into structured intelligence — then destroy everything when you're done.

---

## The Problem

Professionals handling sensitive information — security auditors, attorneys, physicians, incident responders — need AI-powered note-taking. But sending that data to cloud servers is a non-starter:

- **Security audits** contain vulnerability details that could be exploited if intercepted
- **Legal depositions** are privileged and confidentiality-bound
- **Medical notes** fall under HIPAA and strict patient privacy regulations
- **Incident reports** contain damage assessments and liability-sensitive details

Cloud-based AI means your most sensitive data crosses the wire. ShadowNotes eliminates that risk entirely.

## The Solution

Everything happens on-device, inside the browser sandbox:

1. **Speech capture** — Browser-native Web Speech API transcribes your voice in real time
2. **AI extraction** — An on-device LLM (Qwen2.5 0.5B, running in WebAssembly) reads the transcript and extracts structured intelligence
3. **Keyword fallback** — A regex-based extraction engine provides instant results while the LLM loads or as a backup
4. **Zero persistence** — All data lives in JavaScript heap memory. Close the tab or hit DESTROY and it's gone forever

No API keys. No server endpoints. No telemetry. No trace.

---

## How It Works

### Data Flow

```
Microphone
    ↓
Web Speech API (browser-native, continuous)
    ↓
Real-time transcript (interim + final results)
    ↓
┌──────────────────────────────────────┐
│        Intelligence Extraction       │
│                                      │
│  ┌─────────┐      ┌──────────────┐  │
│  │ On-Device│      │   Keyword    │  │
│  │   LLM   │ ──── │  Extraction  │  │
│  │ (primary)│ fail │  (fallback)  │  │
│  └─────────┘ over └──────────────┘  │
└──────────────────────────────────────┘
    ↓
Categorized intelligence items
    ↓
Editable, grouped display
    ↓
DESTROY → zero memory
```

### Step by Step

1. **Boot** — App initializes the RunAnywhere SDK and checks GPU capabilities (WebGPU with shader-f16 for acceleration, CPU fallback otherwise)
2. **Select Domain** — Choose from 4 specialized domains. The LLM model begins downloading in the background (~400MB, cached after first download in OPFS)
3. **Capture** — Hit BEGIN CAPTURE. The Web Speech API streams your voice to text. Interim results show as live preview; final segments are committed to the transcript
4. **Extract** — Hit PAUSE CAPTURE. The accumulated transcript is sent to the on-device LLM with a domain-specific prompt. The LLM outputs structured `[Category] fact` lines. If the LLM times out (30s limit) or isn't ready, keyword extraction takes over instantly
5. **Review** — Intelligence items appear grouped by category. Click any item to edit. Click X to delete. Resume capture to add more
6. **End Session** — View the full dossier: metadata, raw transcript, extracted intelligence
7. **Destroy** — Two-step confirmation, then a cinematic burn animation wipes all data from memory

### Hybrid Extraction

ShadowNotes uses a dual-layer extraction pipeline:

**Layer 1: On-Device LLM (Primary)**
- Model: Qwen2.5 0.5B Instruct (Q4_K_M quantization, ~400MB)
- Runs via llama.cpp compiled to WebAssembly
- Domain-specific system prompts instruct the model to output `[Category] fact` format
- The model corrects speech recognition errors using domain knowledge (e.g., "sequel injection" → SQL injection)
- 30-second timeout prevents hangs; falls back to Layer 2 automatically

**Layer 2: Keyword Extraction (Fallback)**
- Pure regex pattern matching — zero memory overhead
- 130+ domain-specific patterns across 21 categories
- Runs instantly on any device
- Used while LLM downloads, during LLM timeout, or on low-power devices

---

## Four Professional Domains

| Domain | Codename | Clearance | Categories |
|--------|----------|-----------|------------|
| **Security Audit** | OPERATION FIREWALL | TOP SECRET | Vulnerabilities, Timeline, Evidence, Affected Systems, Risk Assessment |
| **Legal Deposition** | OPERATION TESTIMONY | CONFIDENTIAL | Key Statements, Timeline, Parties Involved, Contradictions, Exhibits |
| **Medical Notes** | OPERATION VITALS | RESTRICTED | Patient Info, Symptoms, Diagnoses, Medications, Vital Signs, Follow-up Actions |
| **Incident Report** | OPERATION CHRONICLE | SECRET | Incident Timeline, Witnesses, Damage Assessment, Root Cause, Next Steps |

Each domain has:
- Tailored LLM system prompt with extraction instructions
- Domain-specific keyword rules (regex patterns)
- Unique codename, clearance level, and icon
- 5-6 extraction categories tuned to the profession

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **RunAnywhere Web SDK** (`@runanywhere/web`) | Core framework for on-device AI model management |
| **llama.cpp WASM** (`@runanywhere/web-llamacpp`) | LLM inference engine compiled to WebAssembly |
| **Qwen2.5 0.5B Instruct** (Q4_K_M) | On-device language model for structured extraction |
| **Web Speech API** | Browser-native continuous speech recognition |
| **WebGPU / shader-f16** | GPU acceleration for WASM inference (CPU fallback) |
| **OPFS** (Origin Private File System) | Browser-local model caching (~400MB, persists across sessions) |
| **SharedArrayBuffer** | Multi-threaded WASM execution (requires COOP/COEP headers) |
| **React 19** | UI framework with hooks-based state management |
| **TypeScript** | Type-safe codebase |
| **Vite 7** | Build tool with custom WASM copy plugin |
| **vite-plugin-pwa** | Progressive Web App with full offline support |
| **Vitest** | Test framework (164 tests) |

### Browser Requirements

- Chrome 96+ or Edge 96+ (for Web Speech API + SharedArrayBuffer)
- Microphone access
- ~400MB storage for model cache (OPFS)
- ~400MB RAM for inference

---

## Key Features

### Zero-Trust Architecture
- **No network calls** — All AI processing happens in the browser sandbox
- **No persistence** — Session data lives only in JavaScript heap memory
- **No telemetry** — Zero analytics, zero tracking, zero logging
- **Tab close = total wipe** — Garbage collector reclaims all memory

### Real-Time Intelligence
- Continuous speech capture with live transcript preview
- Dual-layer extraction: LLM for accuracy, keywords for speed
- Findings grouped by domain-specific categories
- Editable items: click to edit, X to delete, Enter to save

### Progressive Web App
- Installable on desktop and mobile
- Full offline functionality after first load
- Service worker caches all app assets
- Model cached in OPFS for instant startup on return visits

### Performance Tuning
- Three presets: **High** (full LLM), **Medium** (balanced), **Low** (keywords only)
- Debug panel with runtime sliders for: max tokens, temperature, extraction debounce, animation toggle, VAD bars, timer interval
- Settings persisted to localStorage

### Classified Dossier UI
- Authentic declassified-document aesthetic
- JetBrains Mono + Special Elite typography
- CRT scanline and noise overlays
- Boot sequence with system initialization messages
- Case numbers (SN-YYMMDD-XXXX), clearance stamps, operation codenames
- Cinematic destroy animation with progress phases

---

## Architecture Highlights

### Speech Recognition
- Uses the browser's built-in `SpeechRecognition` API (no model download needed)
- Continuous mode with automatic restart after silence
- Text-based deduplication detects mobile speech refinements
- Interim results shown as live grey text; final results committed to transcript

### LLM Pipeline
- SDK initializes on boot with GPU capability detection
- Model downloads non-blocking (user can start capture immediately)
- LLM calls serialized via mutex to prevent KV cache corruption
- System prompts include speech correction instructions
- Case-insensitive category matching for robust parsing
- 30-second timeout with automatic keyword fallback

### State Management
- All state in React `useState` — no Redux, no Zustand, no external libraries
- Session data: domain, case number, start time, transcripts, intelligence items
- Mutations centralized in App.tsx: add/update/delete intelligence
- `beforeunload` handler warns against accidental tab close during capture

### Build & Deploy
- Vite with custom plugin to copy WASM binaries to dist
- Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy headers for SharedArrayBuffer
- Deployed to Vercel with Cloudflare DNS proxy
- WASM files cached immutably (1 year max-age)

---

## Security & Privacy Guarantees

| Claim | Implementation |
|-------|---------------|
| Data never leaves the device | No `fetch`, `XMLHttpRequest`, or WebSocket calls for user data |
| No persistence | No `localStorage`, `IndexedDB`, or cookies for session data |
| No telemetry | Zero analytics scripts, no tracking pixels, no error reporting services |
| Ephemeral sessions | React state (heap memory) is the only storage; GC reclaims on tab close |
| Air-gapped capable | Works offline after first load (PWA + cached model) |
| Model stays local | OPFS storage is origin-scoped and inaccessible to other sites |

---

## Who It's For

- **Security auditors** conducting penetration test debriefs
- **Attorneys** transcribing depositions and witness interviews
- **Physicians** dictating clinical notes and patient encounters
- **Incident commanders** documenting events during active response
- **Anyone** who needs AI-powered note-taking without trusting a cloud provider

---

## Project Information

- **Team**: Vibe With Singularity
- **Members**: Divya Mohan (Team Lead), Kumkum Thakur
- **Institution**: GGSIPU, Delhi
- **Hackathon**: RunAnywhere Vibe Challenge
- **Repository**: [github.com/divyamohan1993/shadownotes](https://github.com/divyamohan1993/shadownotes)
- **Live Demo**: [shadownotes.dmj.one](https://shadownotes.dmj.one)

---

*ShadowNotes: Because some notes should never exist anywhere but your memory.*
