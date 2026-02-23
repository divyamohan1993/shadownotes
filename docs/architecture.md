# ShadowNotes - Technical Architecture

## System Overview

ShadowNotes is a single-page React application that combines browser-native speech recognition with on-device AI intelligence extraction through the RunAnywhere Web SDK. The hybrid architecture ensures the app works on any device while leveraging on-device AI for sensitive data analysis.

```
+------------------------------------------------------------------+
|                        BROWSER SANDBOX                            |
|                                                                   |
|  +--------------------+    +------------------+    +------------+ |
|  |   React 19 App     |    |  RunAnywhere SDK |    |   WASM     | |
|  |   (TypeScript)     |--->|  (web 0.1.0-b9)  |--->|  Runtime   | |
|  +--------------------+    +------------------+    +------------+ |
|         |                         |                      |        |
|         v                         v                      v        |
|  +-----------+            +---------------+      +-------------+  |
|  | React     |            | Model Manager |      | llama.cpp   |  |
|  | State     |            | Event Bus     |      | (WebAssembly)|  |
|  | (Heap)    |            | Download/Load |      +-------------+  |
|  +-----------+            +---------------+                       |
|         |                                                         |
|         v                                                         |
|  +------------------+    +------------------+                     |
|  | Web Speech API   |    | Keyword Extraction|                    |
|  | (browser-native) |    | (regex fallback) |                     |
|  +------------------+    +------------------+                     |
|                                   |                               |
|                           +---------------+                       |
|                           | OPFS Cache    |                       |
|                           | (LLM model)   |                       |
|                           +---------------+                       |
+------------------------------------------------------------------+
         |
         | Microphone (getUserMedia via Web Speech API)
         v
    [User's Voice]
```

## Application Screens

The app has three screens managed by React state (no router library):

### 1. Boot Sequence (`bootPhase 0-4`)
- Phase 1: "Initializing secure environment..."
- Phase 2: "Verifying air-gap integrity..."
- Phase 3: "Loading on-device inference engine..."
- Phase 4: RunAnywhere SDK initialized, transition to Session Init

### 2. Session Init (`screen: 'init'`)
- Domain selection grid (2x2): Security Audit, Legal Deposition, Medical Notes, Incident Report
- LLM download begins in background when domain is selected (non-blocking)
- Progress bar with download tracking via EventBus
- Session starts immediately — no waiting for model download

### 3. Active Capture (`screen: 'capture'`)
- Split view: transcript panel (left) + intelligence panel (right)
- Audio visualization (12-bar VAD indicator with CSS animation)
- Session timer, case number, clearance level header
- AI status indicator: PENDING -> downloading % -> LOADING -> ACTIVE (or KEYWORDS)
- Pipeline: Web Speech API -> transcript text -> LLM extraction (or keyword fallback)

### 4. Session Summary (`screen: 'summary'`)
- Full dossier view with metadata grid
- Grouped intelligence by category
- Two-step destroy: click once for confirm, click again for burn animation
- Burn animation: progress 0->100% with phase-specific status messages

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
    +--- LLM Ready? --YES--> TextGeneration.generate()  <-- LFM2 350M (llama.cpp WASM, 250MB)
    |                              |
    |                              | Parse: /^\[([^\]]+)\]\s*(.+)/
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

1. **RunAnywhere LLM (primary)**: LFM2 350M model processes transcript text with domain-specific system prompts. Outputs structured `[Category] finding` lines parsed by regex. Runs entirely on-device via llama.cpp WASM.

2. **Keyword Extraction (fallback)**: Regex-based pattern matching engine in `src/extraction.ts`. Zero memory overhead, instant results. Domain-specific rules for medical, security, legal, and incident domains. Used when LLM is loading or unavailable.

## Model Registry

Defined in `src/runanywhere.ts`:

| Model | ID | Framework | Category | Size | Source |
|-------|----|-----------|----------|------|--------|
| LFM2 350M Q4_K_M | `lfm2-350m-q4_k_m` | LlamaCPP | Language | ~250MB | `LiquidAI/LFM2-350M-GGUF` (HuggingFace) |

Total download: ~250MB (one-time, cached in OPFS)

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

## File Structure

```
src/
  main.tsx                       # React DOM entry point
  App.tsx                        # App shell: boot sequence, screen routing, session state
  runanywhere.ts                 # SDK init, LLM model registration
  extraction.ts                  # Keyword-based intelligence extraction (regex fallback)
  types.ts                       # TypeScript interfaces (DomainProfile, SessionData, etc.)
  domains.ts                     # 4 domain profiles with system prompts
  speech.d.ts                    # Web Speech API type declarations
  vite-env.d.ts                  # Vite type declarations
  hooks/
    useModelLoader.ts            # Model download/load lifecycle hook
  components/
    SessionInit.tsx              # Domain picker + LLM preload progress
    ActiveCapture.tsx            # Web Speech API + LLM/keyword extraction + split view
    SessionSummary.tsx           # Dossier view + destroy animation
  styles/
    index.css                    # Classified Dossier theme
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

- **`copyWasmPlugin()`**: Custom plugin copies llama.cpp WASM binaries from `node_modules` to `dist/assets/` during production build
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
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | React DOM renderer |
| `vite` | ^7.3.1 | Build tool |
| `typescript` | ^5.9.3 | Type checking |
| `vitest` | ^4.0.18 | Test runner |

## Testing

162 tests across 8 test files:

- **60 unit tests**: Domain profiles, case number generation, system prompt validation
- **20 extraction tests**: Keyword-based intelligence extraction across all 4 domains
- **11 hook tests**: useModelLoader state transitions, error handling
- **65 component tests**: SessionInit, ActiveCapture, SessionSummary, App shell
- **6 integration tests**: Full session lifecycle, ephemeral data wipe verification

All SDK dependencies are mocked with comprehensive test helpers. Web Speech API is mocked via `MockSpeechRecognition` class.
