# ShadowNotes

**The first on-device AI notebook for air-gapped intelligence work** — voice capture, streaming AI extraction, and zero-trace ephemeral storage, all running in your browser via WebAssembly.

> No cloud. No API keys. No servers. No trace. Every byte of AI processing runs on YOUR device.

[Live Demo](https://shadownotes.dmj.one) | [Demo Video](https://youtube.com/watch?v=qqV9ezvwY6U) | [Field Manual](https://shadownotes.dmj.one/docs/field-manual.html) | [About the Hackathon & Vision](docs/vision-india2047.md)

---

## The Vision — Atmanirbhar Bharat meets India 2047

ShadowNotes is built with the spirit of **Atmanirbhar Bharat** (Self-Reliant India) and the **#India2047** vision at its core. Built for the [RunAnywhere Vibe Challenge](https://vibechallenge.runanywhere.org/) hackathon, facilitated by **ThoughtWorks Technologies**, this project demonstrates that critical AI-powered tools handling sensitive data — medical records, legal depositions, security audits, incident reports — must not depend on foreign cloud infrastructure.

As **Prof. Yoshua Bengio** (Turing Award 2018, Université de Montréal) emphasized at the **AI Impact Summit**, responsible AI deployment requires privacy by design, data governance, and democratization of AI capabilities. ShadowNotes answers this call: **every byte of AI processing runs on the user's device**, with zero network transmission of data — not as a privacy policy, but as an architectural guarantee.

**Why this matters for India:**
- Physicians in rural clinics can dictate AI-powered prescriptions without internet connectivity
- Security auditors can document vulnerabilities without data leaving Indian soil
- Legal practitioners can transcribe depositions with full attorney-client privilege
- Incident responders can capture real-time intelligence at disaster sites, fully offline

Each domain carries a Hindi name honouring India's heritage: **Sanjeevani** (Medical — "The Life-Giving Herb"), **Kavach** (Security — "The Divine Shield"), **Nyaaya** (Legal — "The Path of Justice"), **Prahari** (Incident — "The Vigilant Sentinel").

> Read the full vision: [About the Hackathon & India 2047 Vision](docs/vision-india2047.md)

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

ShadowNotes deeply integrates all three RunAnywhere SDK packages — **20+ load-bearing features** powering LLM streaming, audio intelligence, voice agents, and model lifecycle management.

| SDK Feature | Package | How It's Used |
|-------------|---------|---------------|
| **`TextGeneration.generateStream()`** | `web-llamacpp` | Core extraction engine. Gemma 3 1B Instruct streams tokens one-by-one with real-time cursor animation. Domain-specific system prompts guide extraction and correct speech errors. |
| **`StructuredOutput.extractJson()`** | `web-llamacpp` | JSON schema-guided validation fallback for reliable parsing when LLM returns structured data. |
| **`ToolCalling.generateWithTools()`** | `web-llamacpp` | Available SDK feature for structured tool-call extraction. Not used in the active extraction pipeline. |
| **`Embeddings` + `findSimilar()`** | `web-llamacpp` | Semantic deduplication, RAG context retrieval (`buildRAGContext`), and GlobalSearch reranking via cosine similarity. |
| **`VoicePipeline` + `VoiceAgent`** | `web` | Hands-free agent mode: continuous listen → process → respond loop for field operatives. |
| **`SDKLogger`** | `web` | Structured logging throughout SDK integration (replaces raw `console.*`). |
| **`detectCapabilities()`** | `web` | Hardware detection (WebGPU, RAM, cores) for capability-aware performance presets. |
| **`ModelManager` + `EventBus`** | `web` | Model lifecycle management with OPFS caching (~810MB) and real-time download progress events. |
| **`RunAnywhere.initialize()`** | `web` | GPU detection with crash recovery. Probes WebGPU + shader-f16, falls back to CPU if WebGPU crashes. |
| **`OPFSStorage`** | `web` | Origin Private File System cache for instant startup on return visits. |
| **`STT` + `VAD` + `AudioCapture`** | `web-onnx` | On-device speech-to-text with voice activity detection and audio capture pipeline. |
| **`TTS` + `AudioPlayback`** | `web-onnx` | Text-to-speech synthesis for agent mode spoken responses. |
| **Advanced Sampling** | `web-llamacpp` | `topK: 40`, `topP: 0.9`, `temperature: 0.3`, `stopSequences` for factual extraction boundaries. |
| **LlamaCPP + ONNX Frameworks** | `web-llamacpp`, `web-onnx` | Dual WASM backends — LlamaCPP for LLM inference, ONNX for audio models. |

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

### AI & Extraction
- **Streaming AI Extraction** — Token-by-token LLM output with real-time UI feedback via `TextGeneration.generateStream()`
- **Two-Layer Extraction** — Single LLM generation (StructuredOutput JSON + line-based parsing) → Keyword regex fallback
- **VoiceAgent Hands-Free Mode** — `VoicePipeline` + `VoiceAgent` orchestrate a continuous listen-process-respond loop without manual button presses
- **RAG Context Injection** — `buildRAGContext()` uses embeddings to semantically retrieve relevant prior findings and inject them into the LLM prompt
- **Semantic Search Reranking** — GlobalSearch uses `findSimilar()` from the embeddings engine to rerank results by semantic relevance
- **Semantic Deduplication** — Cosine-similarity based dedup prevents near-duplicate intelligence items
- **4 Domain Profiles** — Security Audit, Legal Deposition, Medical Notes, Incident Report — each with tailored system prompts and speech error correction
- **Capability-Aware Presets** — Auto-detects device hardware (WebGPU, RAM, cores) and adapts AI performance settings

### Security & Privacy
- **Encrypted Vault** — AES-256-GCM with per-case HKDF-derived keys for compartmentalized storage
- **WebAuthn/Biometric Auth** — Windows Hello / Touch ID with PRF for key material derivation
- **Brute-Force Protection** — Exponential backoff (5s/15s/30s/60s) after 3 failed unlock attempts
- **Schema Validation** — Decrypted content validated against expected structure before use
- **Security Headers** — HSTS, CSP with WASM support, Referrer-Policy, Permissions-Policy
- **DESTROY Mode** — Cinematic burn animation + complete state wipe with zero-trace guarantee

### User Experience
- **Onboarding Tutorial** — 3-step first-run walkthrough with keyboard navigation and ARIA accessibility
- **Error Recovery** — React error boundary catches crashes and provides a one-click recovery UI
- **Loading Skeletons** — Shimmer animation states during boot sequence
- **Voice Commands** — "Hey Shadow, delete case..." with fuzzy matching
- **Editable Intelligence** — Click any AI-extracted finding to correct inline
- **Cross-Session Context** — Prior findings auto-injected into LLM context for deduplication
- **Encrypted Export/Import** — `.shadow` files with independent passphrase encryption
- **Global Search** — Decryption-at-query across all cases with semantic reranking
- **Auto-Save Drafts** — Debounced persistence during active capture
- **Session Dossier** — Complete summary view with grouped intelligence findings
- **Classified Dossier UI** — Authentic declassified-document aesthetic with stamps, CRT effects, and monospace typography
- **WCAG 2.2 Accessible** — 172+ ARIA attributes, keyboard-navigable, screen-reader-friendly, reduced-motion support

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 19 + TypeScript 5.9 (strict mode) |
| Build Tool | Vite 7 + ESLint 10 |
| AI SDK | RunAnywhere Web SDK — `web`, `web-llamacpp`, `web-onnx` (3 packages, 20+ features) |
| LLM Models | 3-tier selection: Gemma 3 1B, Qwen2.5 0.5B, SmolLM2 135M — all via llama.cpp WASM |
| STT | Whisper Tiny English (on-device ONNX) + Web Speech API (browser fallback) |
| VAD | Silero VAD (on-device ONNX, ~2.3 MB) — real voice activity detection |
| TTS | Piper (Lessac Medium, on-device ONNX) — spoken feedback after extraction |
| Embeddings | On-device via LlamaCPP — semantic dedup, RAG context, search reranking |
| Encryption | AES-256-GCM + HKDF + PBKDF2 (600K iterations) via WebCrypto API |
| Auth | WebAuthn with PRF extension (Windows Hello / Touch ID / Face ID) |
| PDF Export | jsPDF 4.2 — domain-specific professional reports (Sanjeevani, Kavach, Nyaaya, Prahari) |
| Desktop | Electron 35 + electron-builder — cross-platform desktop with GPU acceleration |
| Styling | Custom CSS — JetBrains Mono + Special Elite fonts, classified dossier aesthetic |
| PWA | vite-plugin-pwa + Workbox — full offline support, installable |
| Testing | Vitest 4 + Testing Library — 231 tests across 18 files |

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
Microphone -> AudioCapture/VAD -> STT (on-device) -> RunAnywhere LLM (single generation + StructuredOutput parsing)
                                                   -> Keyword fallback (instant, if LLM loading)
                                                   -> Embeddings (RAG context + dedup)
```

1. **Boot** — SDK initializes (GPU detection, crash recovery, capability detection), auto-selects performance preset
2. **Onboard** — First-time users see a 3-step walkthrough; returning users skip to auth
3. **Authenticate** — WebAuthn biometric or passphrase unlock (brute-force protected) derives encryption keys
4. **Session Init** — Select domain profile. LLM begins downloading in background with progress tracking
5. **Voice Capture** — Three modes: MIC (push-to-talk), TEXT (manual input), AGENT (hands-free VoiceAgent loop)
6. **Two-Layer Extraction** — Single LLM generation (with StructuredOutput JSON + line-based parsing) → Keyword regex fallback, with RAG context from prior findings
7. **Session Dossier** — Complete summary view with grouped findings, copy/edit/delete per item
8. **Vault** — Sessions encrypted with AES-256-GCM (per-case HKDF keys) and stored in IndexedDB

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
  App.tsx                    # App shell, boot sequence, error boundary, skeleton loading
  runanywhere.ts             # RunAnywhere SDK init — 3 packages, 20+ features, VoiceAgent factory
  extraction.ts              # Keyword-based intelligence extraction (regex fallback)
  crypto.ts                  # AES-256-GCM + HKDF + PBKDF2 encryption + schema validation
  perfConfig.tsx             # Capability-aware performance presets (auto-detect + manual)
  auth.ts                    # WebAuthn with PRF extension
  vault.ts                   # Encrypted IndexedDB storage layer
  VaultContext.tsx            # React Context for vault state management
  types.ts                   # TypeScript interfaces
  domains.ts                 # Domain profiles with system prompts + speech corrections
  hooks/
    useModelLoader.ts        # Model download + loading lifecycle hook
    useAutoSave.ts           # Debounced auto-save with draft management
    useEmbeddings.ts         # Semantic dedup, findSimilar, buildRAGContext
    useAudioPipeline.ts      # AudioCapture → VAD → STT pipeline
    useTTS.ts                # Text-to-speech via TTS + AudioPlayback
  components/
    SessionInit.tsx          # Domain selection + onboarding tutorial + LLM preload
    ActiveCapture.tsx        # 3-mode capture (MIC/TEXT/AGENT) + RAG context
    SessionSummary.tsx       # Dossier view with edit/delete/copy
    VaultUnlock.tsx          # WebAuthn + passphrase auth + brute-force protection
    CaseList.tsx             # Case management with search
    CaseDetail.tsx           # Session history per case
    GlobalSearch.tsx         # Cross-case decryption search + semantic reranking
    ExportModal.tsx          # Encrypted .shadow file export/import
  styles/
    index.css                # Classified Dossier theme + onboarding + skeletons + a11y
```

## Privacy & Security

- **On-device AI** — Intelligence extraction via RunAnywhere LLM (llama.cpp WASM) — zero network requests
- **End-to-end encryption** — AES-256-GCM with per-case HKDF-derived keys (PBKDF2, 600K iterations)
- **Biometric authentication** — WebAuthn with PRF extension for key material derivation
- **Brute-force protection** — Exponential backoff lockout (5s/15s/30s/60s) after 3 failed passphrase attempts
- **Schema validation** — Decrypted content validated against expected structure before use
- **Security headers** — Content-Security-Policy (with `wasm-unsafe-eval`), HSTS, Referrer-Policy, Permissions-Policy, X-Frame-Options, X-Content-Type-Options
- **No cookies, localStorage** used for sensitive data — vault uses encrypted IndexedDB
- **Tab close = total wipe** for ephemeral sessions (vault sessions encrypted at rest)
- **Models cached in OPFS** — Browser's private filesystem, isolated per origin
- **GPU crash recovery** — Automatic CPU fallback if WebGPU crashes (crash flag in sessionStorage)

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
npx vitest run      # Run all 231 tests
npm run test:watch  # Watch mode
```

Test coverage across the pyramid:
- **Unit tests** — Extraction, crypto, auth, vault, domains, voice commands
- **Component tests** — All 9 components with Testing Library
- **Integration tests** — Full session lifecycle for all 4 domains

## License

MIT

---

Built with the spirit of **Atmanirbhar Bharat** for the [RunAnywhere Vibe Challenge](https://vibechallenge.runanywhere.org/) Hackathon, facilitated by **ThoughtWorks Technologies** and **GGSIPU, Delhi**, by [Divya Mohan](https://github.com/divyamohan1993) & Kumkum Thakur (Shoolini University). **#India2047**

*ShadowNotes: Because some notes should never exist anywhere but your memory — and some technology should never depend on anyone but your own device.*
