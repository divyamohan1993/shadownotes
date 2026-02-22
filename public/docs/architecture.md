# ShadowNotes - Technical Architecture

## System Overview

ShadowNotes is a single-page React application that orchestrates three on-device AI models through the RunAnywhere Web SDK. The entire application runs in the browser with zero server-side components after initial static file serving.

```
+------------------------------------------------------------------+
|                        BROWSER SANDBOX                            |
|                                                                   |
|  +--------------------+    +------------------+    +------------+ |
|  |   React 19 App     |    |  RunAnywhere SDK |    |   WASM     | |
|  |   (TypeScript)     |--->|  (web 0.1.0-b9)  |--->|  Runtimes  | |
|  +--------------------+    +------------------+    +------------+ |
|         |                         |                      |        |
|         v                         v                      v        |
|  +-----------+            +---------------+      +-------------+  |
|  | React     |            | Model Manager |      | llama.cpp   |  |
|  | State     |            | Event Bus     |      | sherpa-onnx  |  |
|  | (Heap)    |            | Download/Load |      | (WebAssembly)|  |
|  +-----------+            +---------------+      +-------------+  |
|                                   |                               |
|                                   v                               |
|                           +---------------+                       |
|                           | OPFS Cache    |                       |
|                           | (model files) |                       |
|                           +---------------+                       |
+------------------------------------------------------------------+
         |
         | Microphone (getUserMedia)
         v
    [User's Voice]
```

## Application Screens

The app has three screens managed by React state (no router library):

### 1. Boot Sequence (`bootPhase 0-4`)
- Phase 1: "Initializing secure environment..."
- Phase 2: "Verifying air-gap integrity..."
- Phase 3: "Loading on-device inference engine..."
- Phase 4: SDK initialized, transition to Session Init

### 2. Session Init (`screen: 'init'`)
- Domain selection grid (2x2): Security Audit, Legal Deposition, Medical Notes, Incident Report
- Sequential model loading: VAD (5MB) -> STT (105MB) -> LLM (250MB)
- Progress bar with download tracking via EventBus

### 3. Active Capture (`screen: 'capture'`)
- Split view: transcript panel (left) + intelligence panel (right)
- Real-time VAD visualization (12-bar audio level indicator)
- Session timer, case number, clearance level header
- Pipeline: AudioCapture -> VAD -> STT -> LLM -> parsed intelligence

### 4. Session Summary (`screen: 'summary'`)
- Full dossier view with metadata grid
- Grouped intelligence by category
- Two-step destroy: click once for confirm, click again for burn animation
- Burn animation: progress 0->100% with phase-specific status messages

## AI Pipeline

```
Microphone (16kHz PCM)
    |
    v
AudioCapture.start(onChunk, onLevel)
    |
    v
VAD.processSamples(chunk)        <-- Silero VAD v5 (ONNX, 5MB)
    |
    | SpeechActivity.Ended
    v
VAD.popSpeechSegment()
    |
    | Float32Array (>1600 samples = 100ms minimum)
    v
STT.transcribe(audioData)        <-- Whisper Tiny English (ONNX, 105MB)
    |
    | { text: string }
    v
TextGeneration.generateStream()  <-- LFM2 350M Q4_K_M (llama.cpp, 250MB)
    |
    | Streaming text output
    v
Parse bracketed categories:
  /^\[([^\]]+)\]\s*(.+)/
    |
    v
IntelligenceItem[] -> React State
```

## Model Registry

Defined in `src/runanywhere.ts`:

| Model | ID | Framework | Category | Size | Source |
|-------|----|-----------|----------|------|--------|
| LFM2 350M Q4_K_M | `lfm2-350m-q4_k_m` | LlamaCPP | Language | ~250MB | `LiquidAI/LFM2-350M-GGUF` (HuggingFace) |
| Whisper Tiny English | `sherpa-onnx-whisper-tiny.en` | ONNX | SpeechRecognition | ~105MB | `runanywhere/sherpa-onnx-whisper-tiny.en` (HuggingFace) |
| Silero VAD v5 | `silero-vad-v5` | ONNX | Audio | ~5MB | `runanywhere/silero-vad-v5` (HuggingFace) |

Total download: ~360MB (one-time, cached in OPFS)

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

This is parsed by the regex `/^\[([^\]]+)\]\s*(.+)/` in `ActiveCapture.tsx` to create structured `IntelligenceItem` objects.

### Domain Details

| Domain | Codename | Clearance | Categories |
|--------|----------|-----------|------------|
| Security Audit | OPERATION FIREWALL | TOP SECRET | Vulnerabilities, Timeline, Evidence, Affected Systems, Risk Assessment |
| Legal Deposition | OPERATION TESTIMONY | CONFIDENTIAL | Key Statements, Timeline, Parties Involved, Contradictions, Exhibits |
| Medical Notes | OPERATION VITALS | RESTRICTED | Symptoms, Diagnoses, Medications, Vital Signs, Follow-up Actions |
| Incident Report | OPERATION CHRONICLE | SECRET | Incident Timeline, Witnesses, Damage Assessment, Root Cause, Next Steps |

## File Structure

```
src/
  main.tsx                       # React DOM entry point
  App.tsx                        # App shell: boot sequence, screen routing, session state
  runanywhere.ts                 # SDK init, model catalog, backend registration
  types.ts                       # TypeScript interfaces (DomainProfile, SessionData, etc.)
  domains.ts                     # 4 domain profiles with system prompts
  vite-env.d.ts                  # Vite type declarations
  hooks/
    useModelLoader.ts            # Model download/load lifecycle hook
  components/
    SessionInit.tsx              # Domain picker + model loading UI
    ActiveCapture.tsx            # VAD + STT + LLM pipeline + split view
    SessionSummary.tsx           # Dossier view + destroy animation
  styles/
    index.css                    # Classified Dossier theme (1917 lines)
```

## State Management

All state is managed via React's `useState` hook in `App.tsx`:

```typescript
interface SessionData {
  domain: DomainProfile;      // Selected domain profile
  caseNumber: string;          // Generated SN-YYMMDD-XXXX
  startTime: Date;             // Session start timestamp
  transcripts: TranscriptEntry[]; // All transcribed segments
  intelligence: IntelligenceItem[]; // All extracted findings
}
```

- **No external state library** (Redux, Zustand, etc.)
- **No persistence layer** (localStorage, IndexedDB, cookies)
- **All data in JavaScript heap memory only**
- **Tab close = total wipe** (GC reclaims all memory)

## Build Configuration

### Vite Config (`vite.config.ts`)

- **`copyWasmPlugin()`**: Custom plugin copies WASM binaries from `node_modules` to `dist/assets/` during production build
- **Cross-Origin headers**: `COOP: same-origin` + `COEP: credentialless` for SharedArrayBuffer support (required by WASM threads)
- **`optimizeDeps.exclude`**: Prevents Vite from pre-bundling WASM packages
- **`worker.format: 'es'`**: ES module workers for WASM thread support

### Vercel Config (`vercel.json`)

- Sets COOP/COEP headers on all routes
- WASM files served with `application/wasm` content type and immutable caching

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@runanywhere/web` | 0.1.0-beta.9 | Core SDK: ModelManager, EventBus, initialization |
| `@runanywhere/web-llamacpp` | 0.1.0-beta.9 | LLM inference via llama.cpp WASM |
| `@runanywhere/web-onnx` | 0.1.0-beta.9 | STT + VAD via sherpa-onnx WASM |
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | React DOM renderer |
| `vite` | ^7.3.1 | Build tool |
| `typescript` | ^5.9.3 | Type checking |
| `vitest` | ^4.0.18 | Test runner |

## Testing

137 tests across 7 test files:

- **60 unit tests**: Domain profiles, case number generation, system prompt validation
- **11 hook tests**: useModelLoader state transitions, error handling
- **53 component tests**: SessionInit, ActiveCapture, SessionSummary, App shell
- **6 integration tests**: Full session lifecycle, ephemeral data wipe verification

All SDK dependencies are mocked with comprehensive test helpers (`_triggerSpeechEnd`, `_setSpeechSegment`, `_reset`).
