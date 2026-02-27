# ShadowNotes

**The first on-device AI notebook for air-gapped intelligence work** — voice capture, streaming AI extraction, and zero-trace ephemeral storage, all running in your browser via WebAssembly.

> No cloud. No API keys. No servers. No trace. Every byte of AI processing runs on YOUR device.

[Live Demo](https://shadownotes.dmj.one) | [Demo Video](https://youtube.com/watch?v=qqV9ezvwY6U) | [Field Manual](https://shadownotes.dmj.one/docs/field-manual.html)

---

## The Problem

Professionals handling classified, HIPAA-protected, or legally privileged information face an impossible choice:

- **Cloud AI tools** send sensitive data to external servers — unacceptable for classified or privileged information
- **Offline tools** lack AI capabilities — forcing manual categorization and extraction
- **Existing secure apps** (encrypted Notion, Signal notes) don't understand domain context and can't extract structured intelligence

**No existing tool combines AI-powered extraction with zero-network operation.** ShadowNotes is the first.

## Why ShadowNotes Is Different

| | Cloud AI (ChatGPT, Otter.ai) | Encrypted Notes (Standard Notes) | ShadowNotes |
|---|---|---|---|
| AI extraction | Yes (cloud) | No | **Yes (on-device)** |
| Works offline | No | Yes | **Yes** |
| Zero data transmission | No | Partial | **100%** |
| Domain-aware extraction | No | No | **4 specialized domains** |
| Streaming AI feedback | Yes (cloud) | N/A | **Yes (local WASM)** |
| Ephemeral mode | No | No | **Built-in** |

## RunAnywhere SDK Integration

ShadowNotes deeply integrates the RunAnywhere Web SDK's LLM pipeline — streaming generation, structured output, and intelligent model lifecycle management — the features that matter most for on-device intelligence extraction.

| SDK Feature | Package | How It's Used |
|-------------|---------|---------------|
| **`TextGeneration.generateStream()`** | `@runanywhere/web-llamacpp` | The core extraction engine. Qwen2.5 0.5B Instruct runs via llama.cpp WASM, streaming tokens one-by-one into the intelligence panel with real-time cursor animation. Domain-specific system prompts guide extraction and correct speech recognition errors. |
| **`StructuredOutput.extractJson()`** | `@runanywhere/web-llamacpp` | JSON schema-guided validation fallback. When the LLM returns structured JSON instead of bracketed text, this ensures reliable parsing without losing extraction data. |
| **Advanced Sampling** | `@runanywhere/web-llamacpp` | Fine-grained control: `topK: 40`, `topP: 0.9`, `temperature: 0.3` for factual extraction, `stopSequences: ['\n\n\n', '---']` for early termination at extraction boundaries. Configurable via performance presets. |
| **`ModelManager`** | `@runanywhere/web` | Registers the Qwen2.5 model with LlamaCPP framework, manages OPFS caching (~400MB persisted across sessions), handles download lifecycle with progress tracking. |
| **`EventBus`** | `@runanywhere/web` | Real-time download progress events drive the progress bar UI during model download. Provides percentage updates without polling. |
| **`OPFSStorage`** | `@runanywhere/web` | Model cache management in the browser's Origin Private File System. Enables instant startup on return visits — no re-download needed. |
| **`RunAnywhere.initialize()`** | `@runanywhere/web` | GPU detection with crash recovery. Probes WebGPU + shader-f16 support, falls back to CPU if WebGPU crashes, ensuring the LLM runs on any hardware. |
| **LlamaCPP Framework** | `@runanywhere/web-llamacpp` | Registered as the inference backend. Handles WebGPU acceleration with automatic CPU fallback, WASM thread management via SharedArrayBuffer. |

### Advanced LLM Configuration

```typescript
// Streaming generation with advanced sampling
const stream = await TextGeneration.generateStream(prompt, {
  systemPrompt,            // Domain-specific extraction prompt with speech error correction
  maxTokens: 150,          // Configurable via performance presets
  temperature: 0.3,        // Low temperature for factual extraction
  topP: 0.9,               // Nucleus sampling
  topK: 40,                // Top-K sampling for diversity control
  stopSequences: ['\n\n\n', '---'],  // Early termination on extraction boundary
});

// Real-time token streaming to UI
for await (const token of stream.stream) {
  updateStreamingDisplay(token);
}
```

## Features

- **Streaming AI Extraction** — Token-by-token LLM output with real-time UI feedback via `TextGeneration.generateStream()`
- **4 Domain Profiles** — Security Audit, Legal Deposition, Medical Notes, Incident Report — each with tailored system prompts and speech error correction
- **Keyword Fallback** — Instant regex-based extraction while LLM loads, ensuring intelligence from the first word
- **Encrypted Vault** — AES-256-GCM encryption with HKDF key derivation for persistent case storage
- **WebAuthn/Biometric Auth** — Windows Hello / Touch ID with PRF for key material derivation
- **Cross-Session Context** — Prior findings auto-injected into LLM context for deduplication
- **Voice Commands** — "Hey Shadow, delete case..." with fuzzy matching
- **Encrypted Export/Import** — `.shadow` files with independent passphrase encryption
- **Global Search** — Decryption-at-query across all cases
- **Auto-Save Drafts** — Debounced persistence during active capture
- **Session Dossier** — Complete summary view with grouped intelligence findings
- **DESTROY Mode** — Cinematic burn animation + complete state wipe
- **Classified Dossier UI** — Authentic declassified-document aesthetic with stamps, CRT effects, and monospace typography

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 19 + TypeScript (strict mode) |
| Build Tool | Vite 7 |
| AI SDK | RunAnywhere Web SDK (0.1.0-beta.9) — `web`, `web-llamacpp` |
| LLM | Qwen2.5 0.5B Instruct Q4_K_M via llama.cpp WASM |
| STT | Web Speech API (browser-native) + Vosk (Electron offline) |
| Encryption | AES-256-GCM + HKDF + PBKDF2 (600K iterations) |
| Auth | WebAuthn with PRF extension |
| Styling | Custom CSS — JetBrains Mono + Special Elite fonts |
| PWA | Workbox service worker with 8MB model cache |
| Testing | Vitest + Testing Library — 227 tests |

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
Microphone -> Web Speech API (transcription) -> RunAnywhere LLM (streaming extraction)
                                              -> StructuredOutput (JSON validation)
                                              -> Keyword fallback (instant, if LLM loading)
```

1. **Boot** — RunAnywhere SDK initializes, registers LLM model with GPU detection and crash recovery
2. **Authenticate** — WebAuthn biometric or passphrase unlock derives encryption keys
3. **Session Init** — Select domain profile. LLM begins downloading in background with progress tracking
4. **Voice Capture** — Real-time transcription via Web Speech API with deduplication
5. **Streaming Extraction** — `TextGeneration.generateStream()` delivers tokens in real-time, displayed live in the intelligence panel. StructuredOutput validates extraction format
6. **Session Dossier** — Complete summary with grouped findings, copy/edit/delete per item
7. **Vault** — Sessions encrypted with AES-256-GCM and stored in IndexedDB

### Domain Profiles

| Domain | Extraction Categories | Speech Correction Examples |
|--------|----------------------|--------------------------|
| Security Audit | Vulnerabilities, Timeline, Evidence, Affected Systems, Risk Assessment | "sequel injection" → SQL injection, "cross site" → XSS |
| Legal Deposition | Key Statements, Timeline, Parties Involved, Contradictions, Exhibits | "hay BS corpus" → habeas corpus |
| Medical Notes | Symptoms, Diagnoses, Medications, Vital Signs, Follow-up Actions | "Tell me Satin" → Telmisartan, "parse atomol" → Paracetamol |
| Incident Report | Incident Timeline, Witnesses, Damage Assessment, Root Cause, Next Steps | Domain-aware context extraction |

## Architecture

```
src/
  App.tsx                    # App shell, boot sequence, screen routing, session state
  runanywhere.ts             # RunAnywhere SDK init — LLM streaming, model lifecycle, GPU detection
  extraction.ts              # Keyword-based intelligence extraction (regex fallback)
  crypto.ts                  # AES-256-GCM + HKDF + PBKDF2 encryption
  auth.ts                    # WebAuthn with PRF extension
  vault.ts                   # Encrypted IndexedDB storage layer
  VaultContext.tsx            # React Context for vault state management
  types.ts                   # TypeScript interfaces
  domains.ts                 # Domain profiles with system prompts + speech corrections
  hooks/
    useModelLoader.ts        # Model download + loading lifecycle hook
    useAutoSave.ts           # Debounced auto-save with draft management
  components/
    SessionInit.tsx          # Domain selection + LLM preload progress
    ActiveCapture.tsx        # Streaming LLM extraction + speech pipeline
    SessionSummary.tsx       # Dossier view with edit/delete/copy
    VaultUnlock.tsx          # WebAuthn + passphrase authentication
    CaseList.tsx             # Case management with search
    CaseDetail.tsx           # Session history per case
    GlobalSearch.tsx         # Cross-case decryption search
    ExportModal.tsx          # Encrypted .shadow file export/import
  styles/
    index.css                # Classified Dossier theme + responsive + a11y
```

## Privacy & Security

- **On-device AI** — Intelligence extraction via RunAnywhere LLM (llama.cpp WASM) — zero network requests
- **End-to-end encryption** — AES-256-GCM with per-case HKDF-derived keys
- **Biometric authentication** — WebAuthn with PRF for key material
- **No cookies, localStorage** used for sensitive data — vault uses encrypted IndexedDB
- **Tab close = total wipe** for ephemeral sessions (vault sessions encrypted at rest)
- **Models cached in OPFS** — Browser's private filesystem, isolated per origin
- **GPU crash recovery** — Automatic CPU fallback if WebGPU fails

## Deployment

```bash
npx vercel    # Deploy to Vercel (configured with COOP/COEP headers)
```

Required headers for any static host:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

## Testing

```bash
npx vitest run      # Run all 227 tests
npm run test:watch  # Watch mode
```

Test coverage across the pyramid:
- **Unit tests** — Extraction, crypto, auth, vault, domains, voice commands
- **Component tests** — All 9 components with Testing Library
- **Integration tests** — Full session lifecycle for all 4 domains

## License

MIT

---

Built for the [RunAnywhere Vibe Challenge](https://vibechallenge.runanywhere.org/) Hackathon by [Divya Mohan](https://github.com/divyamohan1993) & Kumkum Thakur (GGSIPU, Delhi).
