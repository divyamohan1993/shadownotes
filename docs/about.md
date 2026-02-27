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
2. **Streaming AI extraction** — An on-device LLM (Qwen2.5 0.5B, running in WebAssembly) streams token-by-token structured intelligence extraction via `TextGeneration.generateStream()`, with `StructuredOutput.extractJson()` for JSON validation fallback
3. **Keyword fallback** — A regex-based extraction engine provides instant results while the LLM loads or as a backup
4. **Encrypted vault** — All session data encrypted with AES-256-GCM using per-case HKDF-derived keys, authenticated via WebAuthn biometrics (Windows Hello / Touch ID)
5. **Ephemeral mode** — Hit DESTROY for cinematic burn animation that wipes all data irrecoverably

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
│     Intelligence Extraction          │
│                                      │
│  ┌──────────────┐  ┌─────────────┐  │
│  │ Streaming LLM│  │  Keyword    │  │
│  │ generateStream│  │ Extraction  │  │
│  │ + Structured │  │ (fallback)  │  │
│  │   Output     │──│             │  │
│  │ + Sampling   │  │             │  │
│  └──────────────┘  └─────────────┘  │
└──────────────────────────────────────┘
    ↓
Categorized intelligence items
    ↓
Editable, grouped display
    ↓
Encrypted vault (AES-256-GCM) or DESTROY → zero memory
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

ShadowNotes uses a dual-layer extraction pipeline with deep RunAnywhere SDK integration:

**Layer 1: Streaming On-Device LLM (Primary)**
- Model: Qwen2.5 0.5B Instruct (Q4_K_M quantization, ~400MB)
- Runs via llama.cpp compiled to WebAssembly
- **Streaming output** via `TextGeneration.generateStream()` — tokens appear in real-time with cursor blink animation
- **Structured Output** via `StructuredOutput.extractJson()` — JSON schema-guided validation fallback for reliable parsing
- **Advanced sampling**: `topK: 40`, `topP: 0.9`, `temperature: 0.3`, `stopSequences: ['\n\n\n', '---']`
- Domain-specific system prompts instruct the model to output `[Category] fact` format
- The model corrects speech recognition errors using domain knowledge (e.g., "sequel injection" → SQL injection)
- 60-second timeout prevents hangs; falls back to Layer 2 automatically

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
| **RunAnywhere Web SDK** (`@runanywhere/web`) | Core framework: RunAnywhere.initialize(), ModelManager, EventBus, OPFSStorage |
| **RunAnywhere LlamaCPP** (`@runanywhere/web-llamacpp`) | Streaming LLM via TextGeneration.generateStream(), StructuredOutput, advanced sampling |
| **Qwen2.5 0.5B Instruct** (Q4_K_M) | On-device language model for structured extraction |
| **Web Speech API** | Browser-native continuous speech recognition |
| **WebAuthn + PRF** | Biometric authentication with key material derivation |
| **AES-256-GCM + HKDF** | Per-case encryption for vault storage |
| **WebGPU / shader-f16** | GPU acceleration for WASM inference (CPU fallback) |
| **OPFS** (Origin Private File System) | Browser-local model caching (~400MB, persists across sessions) |
| **SharedArrayBuffer** | Multi-threaded WASM execution (requires COOP/COEP headers) |
| **React 19** | UI framework with hooks-based state management |
| **TypeScript** (strict) | Type-safe codebase with ESLint |
| **Vite 7** | Build tool with custom WASM copy plugin |
| **vite-plugin-pwa** | Progressive Web App with full offline support |
| **Vitest** | Test framework (227 tests across 17 files) |

### Browser Requirements

- Chrome 96+ or Edge 96+ (for Web Speech API + SharedArrayBuffer)
- Microphone access
- ~400MB storage for model cache (OPFS)
- ~400MB RAM for inference

---

## Key Features

### Zero-Trust Architecture
- **No network calls** — All AI processing happens in the browser sandbox
- **Encrypted vault** — AES-256-GCM with per-case HKDF-derived keys
- **Biometric auth** — WebAuthn with PRF extension (Windows Hello / Touch ID)
- **No telemetry** — Zero analytics, zero tracking, zero logging
- **Ephemeral mode** — DESTROY wipes vault entry + heap memory irrecoverably

### Streaming AI Intelligence
- **Streaming LLM output** — Tokens appear in real-time via `TextGeneration.generateStream()`
- **Structured validation** — `StructuredOutput.extractJson()` ensures reliable extraction format
- **Advanced sampling** — `topK`, `topP`, `temperature`, `stopSequences` for fine-grained generation control
- Continuous speech capture with live transcript preview
- Dual-layer extraction: streaming LLM for accuracy, keywords for speed
- Findings grouped by domain-specific categories
- Editable items: click to edit, X to delete, Enter to save

### Progressive Web App
- Installable on desktop and mobile
- Full offline functionality after first load
- Service worker caches all app assets (8MB workbox cache limit)
- Model cached in OPFS for instant startup on return visits

### Performance Tuning
- Three presets: **High** (full LLM), **Medium** (balanced), **Low** (keywords only)
- Debug panel with runtime sliders for: max tokens, temperature, extraction debounce, animation toggle, VAD bars, timer interval
- Settings persisted to localStorage

### Vault & Case Management
- **Multi-case vault** — Encrypted IndexedDB with per-case keys
- **Auto-save drafts** — Debounced encryption during active capture
- **Voice commands** — "Hey Shadow, delete case..." with fuzzy matching
- **Encrypted export/import** — `.shadow` files with independent passphrase encryption
- **Global search** — Decryption-at-query across all cases

### Classified Dossier UI
- Authentic declassified-document aesthetic
- JetBrains Mono + Special Elite typography
- CRT scanline and noise overlays
- Boot sequence with system initialization messages
- Case numbers (SN-YYMMDD-XXXX), clearance stamps, operation codenames
- Streaming token display with cursor blink animation
- Cinematic destroy animation with progress phases

### Accessibility
- WCAG 2.2 compliant: ARIA labels, focus-visible, reduced-motion, forced-colors
- 44px minimum touch targets on mobile
- Screen-reader-friendly with `aria-live` regions for streaming output
- Keyboard-navigable throughout

---

## Architecture Highlights

### Speech Recognition
- Uses the browser's built-in `SpeechRecognition` API (no model download needed)
- Continuous mode with automatic restart after silence
- Text-based deduplication detects mobile speech refinements
- Interim results shown as live grey text; final results committed to transcript

### Streaming LLM Pipeline
- SDK initializes on boot with GPU capability detection (WebGPU + shader-f16 probe with crash recovery)
- Model registered via `ModelManager` with LlamaCPP framework, cached in OPFS via `OPFSStorage`
- Model downloads non-blocking (user can start capture immediately), progress tracked via `EventBus`
- `TextGeneration.generateStream()` delivers tokens in real-time to the UI
- `StructuredOutput.extractJson()` validates JSON-formatted extraction responses
- Advanced sampling: `topK: 40`, `topP: 0.9`, `temperature: 0.3`, `stopSequences` for early termination
- LLM calls serialized via mutex to prevent KV cache corruption
- System prompts include speech correction instructions
- Case-insensitive category matching for robust parsing
- 60-second timeout with automatic keyword fallback

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
| Encrypted at rest | AES-256-GCM with per-case HKDF-derived keys in IndexedDB vault |
| Biometric auth | WebAuthn PRF extension derives master key from Windows Hello / Touch ID |
| No telemetry | Zero analytics scripts, no tracking pixels, no error reporting services |
| Ephemeral mode | DESTROY SESSION wipes vault entry + heap memory irrecoverably |
| Air-gapped capable | Works offline after first load (PWA + cached model) |
| Model stays local | OPFS storage is origin-scoped and inaccessible to other sites |
| Streaming on-device | `TextGeneration.generateStream()` processes tokens locally — no cloud API |

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
