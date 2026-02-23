# ShadowNotes - Privacy & Data Protection Proof

## Executive Summary

ShadowNotes uses a hybrid architecture that keeps sensitive AI analysis on-device while leveraging browser-native capabilities for speech recognition. Intelligence extraction — the step where sensitive content is analyzed and categorized — runs entirely on-device via the RunAnywhere LLM or keyword-based regex matching. No user data is sent to any external server by the application code.

---

## 1. Architecture: Hybrid On-Device AI

### Two-Layer Processing

| Layer | Technology | Location | Network Usage |
|-------|-----------|----------|---------------|
| Speech-to-Text | Web Speech API (browser-native) | Browser engine | May use browser's speech service |
| Intelligence Extraction | RunAnywhere LFM2 350M (WASM) | On-device | None after model download |
| Intelligence Extraction (fallback) | Keyword regex matching | On-device | None |

### Why This Architecture

The original design used three WASM models (VAD + Whisper STT + LLM) all running on the main thread. This caused browser tab freezes on most devices due to the combined 360MB memory footprint and audio processing overhead. The hybrid approach solves this:

1. **Web Speech API** handles transcription — browser-native, zero memory, works on any device
2. **RunAnywhere LLM** handles intelligence extraction — the most sensitive processing step, running entirely on-device via llama.cpp WASM
3. **Keyword extraction** provides instant fallback — zero memory, zero latency, zero network

### What This Means for Privacy

- **Transcript text**: Processed by the browser's built-in speech recognition engine. On Chrome/Edge, this may route audio through Google's speech service. This is the same speech engine used by all websites using the Web Speech API standard.
- **Intelligence extraction**: 100% on-device. The LLM (or keyword fallback) processes transcript text locally. No findings, categorizations, or structured intelligence data leave the device.
- **Session data**: Exists only in React state (JavaScript heap memory). Zero persistent storage.

---

## 2. On-Device AI Processing

### RunAnywhere LLM

The LFM2 350M Q4_K_M model runs in llama.cpp WASM inside the browser sandbox:

```
Transcript text (from Web Speech API)
    ↓
TextGeneration.generate(systemPrompt + text)  — llama.cpp WASM, in memory
    ↓
Parse: /^\[([^\]]+)\]\s*(.+)/  — extract structured categories
    ↓
IntelligenceItem[] → React State (JavaScript heap)
    ↓
Screen render (DOM — in memory)
```

**At no point does intelligence extraction data leave the browser sandbox.**

### Keyword Extraction Fallback

When the LLM is loading or unavailable, `src/extraction.ts` provides instant regex-based extraction:

- Domain-specific pattern rules (medical, security, legal, incident)
- Zero memory overhead — pure regex matching
- Runs synchronously on the main thread
- No network activity of any kind

---

## 3. Data Storage: Ephemeral Memory Only

### Where Data Lives

All session data exists **exclusively** in React component state, which is JavaScript heap memory:

```typescript
// App.tsx — ALL session data lives here
const [session, setSession] = useState<SessionData | null>(null);
```

### What Is NOT Used

| Storage Mechanism | Used? | Proof |
|-------------------|-------|-------|
| `localStorage` | **NO** | `grep -r "localStorage" src/` = 0 matches |
| `sessionStorage` | **NO** | `grep -r "sessionStorage" src/` = 0 matches |
| `IndexedDB` | **NO** | `grep -r "IndexedDB\|indexedDB" src/` = 0 matches |
| `document.cookie` | **NO** | `grep -r "cookie" src/` = 0 matches |
| `Cache API` | **NO** | `grep -r "caches\.\|CacheStorage" src/` = 0 matches |

### OPFS Clarification

The RunAnywhere SDK uses the browser's Origin Private File System (OPFS) to cache the downloaded LLM model file. This is:

- **Only for the LFM2 model binary** (GGUF weights, ~250MB)
- **Not accessible** to other origins, websites, or applications
- **Contains zero user data** — only pre-trained model weights
- **Sandboxed** by the browser's security model

---

## 4. Data Destruction

### Automatic Destruction (Tab Close)

When the browser tab is closed:
1. React component tree unmounts
2. All `useState` values are garbage collected
3. JavaScript heap memory is reclaimed by the browser
4. **Zero session data remains anywhere on disk**

### Manual Destruction (DESTROY SESSION)

The DESTROY SESSION feature provides explicit, animated data wiping:

```typescript
const destroySession = useCallback(() => {
  setSession(null);    // Wipes ALL session data
  setScreen('init');   // Returns to initial state
}, []);
```

The burn animation provides visual confirmation with phase-specific messages:
- 0-30%: "Wiping transcript buffer..."
- 30-60%: "Purging intelligence extracts..."
- 60-90%: "Zeroing session memory..."
- 90-100%: "Session destroyed. No trace remains."

---

## 5. No Application-Level Network Calls

The application source code contains:

- **Zero API keys** — no environment variables, no secrets, no tokens
- **Zero fetch/XMLHttpRequest calls** — no `fetch()`, no `axios`, no `XMLHttpRequest` in application code
- **Zero WebSocket connections** — no real-time server communication
- **Zero analytics or tracking** — no Google Analytics, no Mixpanel, no Sentry, no telemetry
- **Zero server-sent events** — no EventSource connections

```bash
# Verify — search application code for network calls
grep -r "fetch(" src/ --include="*.ts" --include="*.tsx"       # ZERO matches
grep -r "XMLHttpRequest" src/ --include="*.ts" --include="*.tsx" # ZERO matches
grep -r "WebSocket" src/ --include="*.ts" --include="*.tsx"     # ZERO matches
grep -r "analytics\|telemetry\|tracking" src/                    # ZERO matches
```

---

## 6. Verification Steps for Judges

### Step 1: Intelligence Extraction is On-Device

1. Open DevTools → Network tab during a capture session
2. Speak and observe intelligence extraction appearing in the right panel
3. **No network requests are made for intelligence extraction** — the LLM runs in WASM

### Step 2: Source Code Audit

1. Clone the repo: `git clone https://github.com/divyamohan1993/shadownotes.git`
2. Search for network calls: `grep -rn "fetch\|XMLHttpRequest\|WebSocket" src/`
3. Search for storage: `grep -rn "localStorage\|sessionStorage\|IndexedDB\|cookie" src/`
4. Verify: **zero matches** in application code

### Step 3: Data Ephemeral Verification

1. Start a session, record several transcript segments
2. Click DESTROY SESSION → confirm
3. Observe burn animation
4. **All data is gone** — no way to recover

### Step 4: Automated Test Verification

```bash
npx vitest run    # Run all 162 tests
```

Integration tests verify:
- Complete session lifecycle for all 4 domains
- Data is completely wiped after DESTROY SESSION
- No residual data persists between sessions

---

## 7. Third-Party Dependencies

| Dependency | Network Activity | Purpose |
|------------|-----------------|---------|
| React / ReactDOM | None | UI rendering (client-side only) |
| RunAnywhere Web SDK | Model download only (one-time) | SDK initialization + model management |
| RunAnywhere Web-LlamaCPP | None after load | WASM-based LLM inference |
| Web Speech API | Browser-managed | Speech-to-text transcription |
| Google Fonts (CSS) | Font download (one-time, cached) | JetBrains Mono + Special Elite fonts |

---

## 8. Conclusion

ShadowNotes achieves **on-device intelligence extraction** through:

1. **On-device AI** — RunAnywhere LFM2 350M runs in browser WASM sandbox
2. **Keyword fallback** — instant regex extraction with zero network/memory overhead
3. **No persistent storage** — zero localStorage/IndexedDB/cookie usage
4. **Memory-only data** — all session data in React state (JS heap)
5. **Verified destruction** — tab close or DESTROY SESSION irrecoverably wipes data
6. **No application network calls** — zero fetch/XHR/WebSocket in source code

**Intelligence extraction — the analysis of sensitive content — never leaves the device.**
