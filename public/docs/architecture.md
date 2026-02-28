# ShadowNotes - Technical Architecture

## System Overview

ShadowNotes is a single-page React application that combines on-device speech recognition with on-device AI intelligence extraction through the RunAnywhere Web SDK. Built with the spirit of **Atmanirbhar Bharat** and the **#India2047** vision, the architecture ensures 100% on-device AI processing — no cloud dependency for any core operation. All session data is encrypted at rest with AES-256-GCM and authenticated via WebAuthn biometrics. The app runs on both web (Vercel) and desktop (Electron 35).

> See [About the Hackathon & Vision](vision-india2047.md) for the full context on why this architecture prioritizes data sovereignty and on-device processing.

```
+------------------------------------------------------------------+
|                        BROWSER SANDBOX                            |
|                                                                   |
|  +--------------------+    +------------------+    +------------+ |
|  |   React 19 App     |    |  RunAnywhere SDK |    |   WASM     | |
|  |   (TypeScript)     |--->|  (3 packages)    |--->|  Runtime   | |
|  +--------------------+    +------------------+    +------------+ |
|         |                         |                      |        |
|         v                         v                      v        |
|  +-----------+            +---------------+      +-------------+  |
|  | React     |            | Model Manager |      | llama.cpp   |  |
|  | State +   |            | EventBus      |      | (WebAssembly)|  |
|  | Vault     |            | OPFSStorage   |      +-------------+  |
|  +-----------+            | StructuredOut |                       |
|         |                 +---------------+                       |
|         v                        |                                |
|  +------------------+    +------------------+                     |
|  | Web Speech API   |    | Keyword Extraction|                    |
|  | (browser-native) |    | (regex fallback) |                     |
|  +------------------+    +------------------+                     |
|         |                        |                                |
|  +------------------+    +---------------+                        |
|  | WebAuthn + PRF   |    | OPFS Cache    |                        |
|  | AES-256-GCM      |    | (LLM model)   |                        |
|  | Encrypted Vault  |    +---------------+                        |
|  +------------------+                                             |
+------------------------------------------------------------------+
         |
         | Microphone (getUserMedia via Web Speech API)
         v
    [User's Voice]
```

## Application Screens

The app has the following screens managed by React state (no router library):

### 1. Boot Sequence (`bootPhase 0-4`)
- Phase 1: "Initializing secure environment..."
- Phase 2: "Verifying air-gap integrity..."
- Phase 3: "Loading on-device inference engine..."
- Phase 4: RunAnywhere SDK initialized, LLM model registered with GPU detection

### 2. Vault Unlock (`screen: 'unlock'`)
- WebAuthn biometric authentication (Windows Hello / Touch ID) with PRF extension
- Passphrase fallback with PBKDF2 (600K iterations) key derivation
- Derives master encryption key for AES-256-GCM vault operations

### 3. Session Init (`screen: 'init'`)
- Domain selection grid (2x2): Security Audit, Legal Deposition, Medical Notes, Incident Report
- LLM download begins in background when domain is selected (non-blocking)
- Progress bar with download tracking via EventBus
- Session starts immediately — no waiting for model download

### 4. Active Capture (`screen: 'capture'`)
- Split view: transcript panel (left) + intelligence panel (right)
- Audio visualization (12-bar VAD indicator with CSS animation)
- Session timer, case number, clearance level header
- AI status indicator: PENDING -> downloading % -> LOADING -> ACTIVE (or KEYWORDS)
- Streaming LLM output displayed token-by-token with cursor blink animation
- Pipeline: Web Speech API -> transcript text -> streaming LLM extraction (or keyword fallback)
- Auto-save drafts with debounced encryption to vault

### 5. Session Summary (`screen: 'summary'`)
- Full dossier view with metadata grid
- Grouped intelligence by category with edit/delete/copy per item
- Two-step destroy: click once for confirm, click again for burn animation
- Burn animation: progress 0->100% with phase-specific status messages

### 6. Case Management
- **Case List**: All encrypted cases with search, voice commands ("Hey Shadow, delete case...")
- **Case Detail**: Session history per case with encrypted export/import (.shadow files)
- **Global Search**: Decryption-at-query across all cases

## Hybrid AI Pipeline

```
Microphone (browser Web Speech API)
    |
    v
SpeechRecognition (browser-native, continuous mode)
    |
    | interim results -> live transcript preview
    | final results -> TranscriptEntry
    v
Intelligence Extraction (branching):
    |
    +--- LLM Ready? --YES--> TextGeneration.generateStream()  <-- Gemma 3 1B (llama.cpp WASM, ~900MB)
    |                              |                            topK:40, topP:0.9, stopSequences
    |                              | Stream tokens -> live UI
    |                              v
    |                         Unified Parsing:
    |                              | 1. StructuredOutput.extractJson() for JSON responses
    |                              | 2. Line-based regex: /^\[([^\]]+)\]\s*(.+)/
    |                              v
    |                         LLM items found?
    |                              |
    |                     YES -----+------ NO (fall back)
    |                      |                    |
    +--- LLM Not Ready ----+--------------------+
    |                                           |
    v                                           v
extractIntelligence()                  extractIntelligence()
(keyword regex matching)               (keyword regex matching)
    |                                           |
    v                                           v
IntelligenceItem[] -> React State      IntelligenceItem[] -> React State
```

### Extraction Layers

1. **RunAnywhere LLM with Unified Parsing (primary)**: Gemma 3 1B Instruct model processes transcript text with domain-specific system prompts via a single `TextGeneration.generateStream()` call. Tokens stream to the UI in real-time. The response is parsed through unified parsing: `StructuredOutput.extractJson()` handles JSON-formatted responses, and line-based regex (`/^\[([^\]]+)\]\s*(.+)/`) handles bracketed `[Category] finding` lines. Advanced sampling: `topK: 40`, `topP: 0.9`, `stopSequences`. Runs entirely on-device via llama.cpp WASM.

2. **Keyword Extraction (fallback)**: Regex-based pattern matching engine in `src/extraction.ts`. Zero memory overhead, instant results. Domain-specific rules for medical, security, legal, and incident domains. Used when LLM is loading or unavailable.

## Model Registry

Defined in `src/runanywhere.ts`. Users can select from 3 LLM tiers based on device capability:

### LLM Models (User-Selectable)

| Model | ID | Framework | Size | Source | Use Case |
|-------|----|-----------|------|--------|----------|
| Gemma 3 1B Instruct Q4_K_M | `gemma-3-1b-it-q4_k_m` | LlamaCPP | ~810 MB | `bartowski/google_gemma-3-1b-it-GGUF` | Primary — highest quality extraction |
| Qwen2.5 0.5B Instruct Q4_K_M | `qwen2.5-0.5b-instruct-q4_k_m` | LlamaCPP | ~400 MB | `bartowski/Qwen2.5-0.5B-Instruct-GGUF` | Balanced — mid-range devices |
| SmolLM2 135M Instruct Q4_K_M | `smollm2-135m-instruct-q4_k_m` | LlamaCPP | ~100 MB | `bartowski/SmolLM2-135M-Instruct-GGUF` | Lightweight — low-resource devices |

### ONNX Audio Models (Auto-Loaded at Boot)

| Model | ID | Framework | Category | Size | Source |
|-------|----|-----------|----------|------|--------|
| Silero VAD | `silero-vad` | ONNX | Voice Activity Detection | ~2.3 MB | `deepghs/silero-vad-onnx` |
| Whisper Tiny English (int8) | `whisper-tiny-en` | OpenAI Whisper | Speech Recognition | ~103 MB | `csukuangfj/sherpa-onnx-whisper-tiny.en` |
| Piper English (Lessac) | `vits-piper-en_US-lessac-medium` | Piper TTS | Speech Synthesis | ~64 MB | `vits-piper-en_US-lessac-medium` |

Total download: ~100–810 MB for LLM (user's choice) + ~170 MB for audio models (one-time, cached in OPFS)

## Domain Profiles

Each domain profile (defined in `src/domains.ts`) provides:

- **id**: Unique identifier (`security` | `legal` | `medical` | `incident`)
- **name**: Display name
- **codename**: Operation codename (e.g., "OPERATION FIREWALL")
- **icon**: Unicode emoji
- **clearanceLevel**: Display classification level
- **categories**: 5 extraction categories per domain
- **systemPrompt**: Tailored LLM prompt enforcing bracketed output format

### Extraction Format

The LLM is instructed to output in a strict bracketed format:
```
[Category Name] extracted finding text
```

This is parsed by the regex `/^\[([^\]]+)\]\s*(.+)/` in `ActiveCapture.tsx` to create structured `IntelligenceItem` objects. The same format is used as category keys in the keyword extraction fallback.

### Domain Details

| Domain | Codename | Clearance | Categories |
|--------|----------|-----------|------------|
| Security Audit | OPERATION FIREWALL | TOP SECRET | Vulnerabilities, Timeline, Evidence, Affected Systems, Risk Assessment |
| Legal Deposition | OPERATION TESTIMONY | CONFIDENTIAL | Key Statements, Timeline, Parties Involved, Contradictions, Exhibits |
| Medical Notes | OPERATION VITALS | RESTRICTED | Symptoms, Diagnoses, Medications, Vital Signs, Follow-up Actions |
| Incident Report | OPERATION CHRONICLE | SECRET | Incident Timeline, Witnesses, Damage Assessment, Root Cause, Next Steps |

## RunAnywhere SDK Integration

ShadowNotes deeply integrates the RunAnywhere Web SDK across all three packages (`@runanywhere/web`, `@runanywhere/web-llamacpp`, `@runanywhere/web-onnx`) with 20+ genuinely load-bearing API calls:

### @runanywhere/web — Core Infrastructure

| SDK Feature | API Used | How It's Used |
|-------------|----------|---------------|
| **SDK Init** | `RunAnywhere.initialize()` | Probes WebGPU + shader-f16 with crash recovery. Falls back to CPU if WebGPU fails. |
| **Model Manager** | `ModelManager.register()` | Registers the Gemma 3 model with LlamaCPP framework. Manages download, OPFS cache, and load. |
| **EventBus** | Event subscriptions | Real-time download progress events drive the progress bar UI without polling. |
| **OPFSStorage** | OPFS cache management | Model cache in browser's Origin Private File System (~810MB). Instant startup on return visits. |
| **SDKLogger** | Logging | SDK-level logging for debugging and diagnostics. |
| **VoicePipeline + VoiceAgent** | Pipeline orchestration | Voice pipeline coordination for STT → LLM → TTS flow. |
| **detectCapabilities()** | Device detection | Detects WebGPU, WASM SIMD, device memory, hardware concurrency at startup. |

### @runanywhere/web-llamacpp — LLM, ToolCalling, Embeddings

| SDK Feature | API Used | How It's Used |
|-------------|----------|---------------|
| **Streaming Text Generation** | `TextGeneration.generateStream()` | Core extraction engine. Streams tokens into intelligence panel with cursor animation. |
| **Structured Output** | `StructuredOutput.extractJson()` | JSON schema validation fallback for reliable parsing. |
| **ToolCalling** | `ToolCalling.generateWithTools()` | Available as an SDK feature but no longer used in the active extraction pipeline. The single-generation approach with unified parsing replaced the separate ToolCalling extraction path. |
| **Embeddings** | `Embeddings.embed()`, `embedBatch()`, `cosineSimilarity()` | Semantic deduplication of extracted findings (0.85 cosine threshold). Batch embedding with caching for efficiency. |
| **Advanced Sampling** | `topK`, `topP`, `temperature`, `stopSequences` | `topK: 40`, `topP: 0.9`, `temperature: 0.3` for factual extraction. Configurable via presets. |
| **LlamaCPP Framework** | `LlamaCPP.register()` | Inference backend with WebGPU acceleration and automatic CPU fallback. |

### @runanywhere/web-onnx — Audio Pipeline

| SDK Feature | API Used | How It's Used |
|-------------|----------|---------------|
| **ONNX Backend** | `ONNX.register()` | Registers ONNX runtime for audio model inference. Graceful fallback when unavailable. |
| **Speech-to-Text** | `STT.transcribe()` | On-device transcription of speech segments detected by VAD. Falls back to Web Speech API. |
| **Text-to-Speech** | `TTS.synthesize()` | On-device voice feedback after extraction (e.g., "Extracted 3 findings"). |
| **Voice Activity Detection** | `VAD.onSpeechActivity()`, `processSamples()` | Real-time speech detection driving audio level visualizer with actual VAD data. |
| **Audio Capture** | `AudioCapture` (16kHz mono) | Microphone capture feeding PCM audio to VAD → STT pipeline. |
| **Audio Playback** | `AudioPlayback` (22kHz) | Plays TTS-synthesized audio with lazy initialization and proper cleanup. |

## File Structure

```
src/
  main.tsx                       # React DOM entry point
  App.tsx                        # App shell: boot sequence, screen routing, session state
  runanywhere.ts                 # SDK init — all 3 packages, GPU detection, crash recovery
  extraction.ts                  # Keyword-based intelligence extraction (regex fallback)
  crypto.ts                      # AES-256-GCM + HKDF + PBKDF2 (random per-vault salt)
  auth.ts                        # WebAuthn with PRF extension (chunked base64)
  vault.ts                       # Encrypted IndexedDB storage layer
  storage.ts                     # Low-level IndexedDB operations
  VaultContext.tsx                # React Context + error handling + DoS protection
  types.ts                       # TypeScript interfaces (DomainProfile, SessionData, etc.)
  domains.ts                     # 4 domain profiles with system prompts + speech corrections
  voiceCommands.ts               # Voice command parser with fuzzy matching
  perfConfig.tsx                 # Performance presets (High/Medium/Low)
  ollamaEngine.ts                # Ollama backend for Electron offline mode
  voskEngine.ts                  # Vosk STT engine for Electron offline mode
  speech.d.ts                    # Web Speech API type declarations
  vite-env.d.ts                  # Vite type declarations
  hooks/
    useModelLoader.ts            # Model download + loading lifecycle hook
    useAutoSave.ts               # Debounced auto-save with draft management
    useAudioPipeline.ts          # On-device STT + VAD + AudioCapture (ONNX)
    useTTS.ts                    # On-device TTS + AudioPlayback (ONNX)
    useEmbeddings.ts             # Semantic deduplication via embeddings
  components/
    SessionInit.tsx              # Domain selection + LLM preload progress
    ActiveCapture.tsx            # Streaming LLM extraction + speech pipeline + split view
    SessionSummary.tsx           # Dossier view with edit/delete/copy + destroy animation
    VaultUnlock.tsx              # WebAuthn + passphrase authentication
    CaseList.tsx                 # Case management with search + voice commands
    CaseDetail.tsx               # Session history per case
    GlobalSearch.tsx             # Cross-case decryption-at-query search
    ExportModal.tsx              # Encrypted .shadow file export/import
    KeyboardShortcutsHelp.tsx    # Keyboard shortcut reference modal
    VoiceCommandHelp.tsx         # Voice command reference modal
    StorageBanner.tsx            # Storage quota and usage display
  styles/
    index.css                    # Classified Dossier theme + responsive + a11y
```

## State Management

Session state is managed via React `useState` in `App.tsx`. Vault state is provided via `VaultContext`:

```typescript
interface SessionData {
  domain: DomainProfile;         // Selected domain profile
  caseNumber: string;            // Generated SN-YYMMDD-XXXX
  startTime: Date;               // Session start timestamp
  transcripts: TranscriptEntry[];   // All transcribed segments
  intelligence: IntelligenceItem[]; // All extracted findings (editable, with IDs)
}
```

- **No external state library** (Redux, Zustand, etc.)
- **Encrypted persistence** via AES-256-GCM vault in IndexedDB (per-case HKDF-derived keys)
- **WebAuthn biometric or passphrase** required to unlock vault
- **Auto-save drafts** with debounced encryption during active capture
- **Ephemeral mode** still available — DESTROY wipes vault entry + heap memory

## Build Configuration

### Vite Config (`vite.config.ts`)

- **`copyWasmPlugin()`**: Custom plugin copies llama.cpp WASM binaries from `node_modules` to `dist/assets/` during production build
- **Cross-Origin headers**: `COOP: same-origin` + `COEP: credentialless` for SharedArrayBuffer support (required by WASM threads)
- **`optimizeDeps.exclude`**: Prevents Vite from pre-bundling WASM packages
- **`worker.format: 'es'`**: ES module workers for WASM thread support

### Vercel Config (`vercel.json`)

- Sets COOP/COEP headers on all routes
- WASM files served with `application/wasm` content type and immutable caching

## Encryption & Authentication

### Vault Architecture

```
WebAuthn PRF / Passphrase
    ↓
HKDF key derivation (per-case salt)
    ↓
AES-256-GCM encryption
    ↓
IndexedDB (encrypted blobs)
```

- **WebAuthn with PRF extension**: Windows Hello / Touch ID derives master key material from biometric authenticator
- **Passphrase fallback**: PBKDF2 with 600,000 iterations for key derivation
- **Per-case encryption**: HKDF derives unique keys per case number, so compromising one case doesn't expose others
- **Encrypted export/import**: `.shadow` files with independent passphrase encryption for sharing

## PDF Export System

ShadowNotes includes a professional PDF export system (`src/prescriptionPdf.ts`) via **jsPDF 4.2**, with domain-specific branding using Hindi names that honour India's heritage:

| Domain | Hindi Name | Meaning | PDF Title |
|--------|-----------|---------|-----------|
| Medical | **Sanjeevani** (संजीवनी) | The Life-Giving Herb | dmj.one CSR Hospital — Sanjeevani |
| Security | **Kavach** (कवच) | The Divine Shield | dmj.one CSR Cybersecurity — Kavach |
| Legal | **Nyaaya** (न्याय) | The Path of Justice | dmj.one CSR Legal Services — Nyaaya |
| Incident | **Prahari** (प्रहरी) | The Vigilant Sentinel | dmj.one CSR Incident Response — Prahari |

Each domain generates a professionally formatted A4 document with header branding, metadata grid, categorized intelligence sections, signature blocks, and domain-specific colour schemes.

## Desktop Application (Electron)

ShadowNotes ships as a cross-platform desktop application via **Electron 35** + **electron-builder**:

- Local HTTP server on `localhost` for WebAuthn support (requires secure context)
- GPU flags enabled: WebGPU, Vulkan, SharedArrayBuffer, ANGLE D3D11
- Context isolation with preload script (`contextBridge`, `nodeIntegration=false`)
- Separate TypeScript config (`tsconfig.electron.json`)
- Build scripts: `electron:dev`, `electron:build`, `electron:package`

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@runanywhere/web` | 0.1.0-beta.9 | Core SDK: RunAnywhere.initialize(), ModelManager, EventBus, OPFSStorage, VoicePipeline, VoiceAgent, SDKLogger, detectCapabilities() |
| `@runanywhere/web-llamacpp` | 0.1.0-beta.9 | LLM: TextGeneration.generateStream(), StructuredOutput, ToolCalling, Embeddings, LlamaCPP framework |
| `@runanywhere/web-onnx` | 0.1.0-beta.9 | Audio: STT (Whisper), TTS (Piper), VAD (Silero), AudioCapture, AudioPlayback |
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | React DOM renderer |
| `jspdf` | ^4.2.0 | PDF export with domain-specific Hindi branding |
| `vosk-browser` | ^0.0.8 | Legacy STT engine (superseded by RunAnywhere ONNX Whisper) |
| `vite` | ^7.3.1 | Build tool with custom WASM copy plugin |
| `vite-plugin-pwa` | ^1.2.0 | Progressive Web App with Workbox offline caching |
| `electron` | ^35.7.5 | Cross-platform desktop application framework |
| `electron-builder` | ^26.8.1 | Desktop packaging and distribution |
| `vite-plugin-electron` | ^0.29.0 | Vite + Electron integration |
| `cross-env` | ^10.1.0 | Cross-platform environment variable handling |
| `typescript` | ^5.9.3 | Type checking (strict mode) |
| `eslint` | ^10.0.2 | Code quality with typescript-eslint and React Hooks rules |
| `vitest` | ^4.0.18 | Test runner |
| `@testing-library/react` | ^16.3.2 | Component testing with Testing Library |
| `fake-indexeddb` | ^6.2.5 | IndexedDB mock for tests |
| `jsdom` | ^28.1.0 | DOM simulation for test environment |

## Testing

231 tests across 18 test files:

- **61 domain tests**: Domain profiles, case number generation, system prompt validation
- **21 extraction tests**: Keyword-based intelligence extraction across all 4 domains
- **11 hook tests**: useModelLoader state transitions, error handling
- **21 ActiveCapture tests**: Streaming LLM extraction, speech pipeline, streaming UI
- **17 SessionInit tests**: Domain selection, LLM preload, accessibility
- **22 SessionSummary tests**: Dossier view, edit/delete, destroy animation
- **5 App tests**: Boot sequence, screen routing
- **4 VaultUnlock tests**: WebAuthn, passphrase authentication
- **5 CaseList tests**: Case management, creation
- **4 CaseDetail tests**: Session history
- **15 vault tests**: Encryption, key derivation, CRUD operations
- **8 storage tests**: IndexedDB operations
- **5 crypto tests**: AES-256-GCM, HKDF, PBKDF2
- **16 voice command tests**: Command parsing, fuzzy matching
- **7 integration tests**: Full session lifecycle, domain coverage
- **1 auth test**: WebAuthn availability

All SDK dependencies are mocked with comprehensive test helpers (`TextGeneration`, `StructuredOutput`, `ModelManager`, `EventBus`, `OPFSStorage`). Web Speech API is mocked via `MockSpeechRecognition` class.

## Accessibility

- **ARIA labels** on all interactive elements (buttons, radio groups, status regions)
- **`aria-live` regions** for streaming LLM output and status updates
- **`role="radiogroup"`** on domain selection grid with `aria-checked` states
- **Focus-visible** rings for keyboard navigation
- **`prefers-reduced-motion`** media query disables animations
- **`forced-colors`** media query for Windows High Contrast mode
- **44px minimum touch targets** on mobile for WCAG 2.2 compliance
- **WCAG AA contrast** ratios on all text (muted text: `#9ca3af` on `#0a0e1a`)
