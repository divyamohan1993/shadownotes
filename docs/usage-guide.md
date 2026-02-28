# ShadowNotes - Usage Guide

## Prerequisites

| Requirement | Details |
|------------|---------|
| **Node.js** | Version 18 or higher ([download](https://nodejs.org)) |
| **Browser** | Chrome 96+ or Edge 96+ (required for WebAssembly SIMD + SharedArrayBuffer) |
| **Microphone** | Any working microphone for voice capture |
| **Disk Space** | ~810MB for LLM model download (one-time, cached in OPFS) |
| **RAM** | 2GB+ free (for WASM model inference) |
| **ONNX Models** *(optional)* | On-device STT, VAD, and TTS models (~50MB total, auto-downloaded). Enables voice activity detection, on-device speech-to-text, and spoken feedback. Falls back gracefully to Web Speech API if unavailable. |

The app runs identically on **Windows**, **macOS**, and **Linux**. No platform-specific setup required. All three RunAnywhere SDK packages are used: **web**, **web-llamacpp**, and **web-onnx**.

---

## Installation

### From GitHub

```bash
git clone https://github.com/divyamohan1993/shadownotes.git
cd shadownotes
npm install
```

### Development Server

```bash
npm run dev
```

Open the URL shown in your terminal (typically `http://localhost:5173`) in Chrome or Edge.

### Production Build

```bash
npm run build       # Compile TypeScript + bundle with Vite
npm run preview     # Serve the production build locally
```

### Deploy to Vercel

```bash
npx vercel
```

The included `vercel.json` configures required Cross-Origin Isolation headers automatically.

---

## Using ShadowNotes

### Step 1: Boot Sequence

When you first open ShadowNotes, you'll see a classified-style boot sequence:

```
[SYS] Initializing secure environment...        ✓
[SEC] Verifying air-gap integrity...             ✓
[AI]  Loading on-device inference engine...      ✓
```

This initializes the RunAnywhere SDK, registers both the LlamaCPP backend (for LLM text generation) and the ONNX backend (for STT, VAD, TTS, and embeddings), and prepares the streaming extraction pipeline. It takes 1-2 seconds.

### Step 2: Select Your Domain

You'll see four domain cards. Select the one that matches your use case:

| Domain | Best For | Extracts |
|--------|----------|----------|
| **Security Audit** | Penetration test debriefs, vulnerability assessments | Vulnerabilities, Timeline, Evidence, Affected Systems, Risk Assessment |
| **Legal Deposition** | Witness statements, legal interviews | Key Statements, Timeline, Parties Involved, Contradictions, Exhibits |
| **Medical Notes** | Clinical dictation, patient encounters | Symptoms, Diagnoses, Medications, Vital Signs, Follow-up Actions |
| **Incident Report** | Accident reports, security incidents | Incident Timeline, Witnesses, Damage Assessment, Root Cause, Next Steps |

### Step 2b: Unlock Vault

Before starting a session, you'll authenticate via WebAuthn biometrics (Windows Hello / Touch ID) or a passphrase. This derives the encryption key used to protect your session data at rest. Each vault uses a random PBKDF2 salt for key derivation.

When entering a passphrase, a real-time **strength indicator** rates it as WEAK, FAIR, STRONG, or EXCELLENT. A **show/hide toggle** lets you verify what you typed. Strong passphrases are recommended for maximum security.

### Step 3: Begin Session

Select a domain and click **"BEGIN CAPTURE SESSION"**. The LLM model (Gemma 3 1B Instruct, ~810MB) begins downloading in the background. You can start capturing immediately — keyword-based extraction works instantly while the LLM loads.

A progress bar shows download status. The model is cached in your browser's private filesystem (OPFS), so subsequent sessions skip the download.

### Step 4: Active Capture

After models load, you enter the capture screen:

- **Header**: Shows clearance level, case number (SN-YYMMDD-XXXX), session timer, and **SDK status badges** for each on-device capability: LLM, STT, VAD, TTS, and EMB (embeddings). Each badge shows its current state (PENDING/LOADING/ACTIVE/ERROR).
- **Domain Banner**: Shows the operation codename (e.g., "OPERATION FIREWALL")
- **Left Panel (RAW TRANSCRIPT)**: Shows all transcribed speech segments with timestamps
- **Right Panel (INTELLIGENCE EXTRACT)**: Shows AI-extracted findings grouped by category

#### Recording

1. Click **"BEGIN CAPTURE"** to activate your microphone. On-device STT via ONNX is used when available; otherwise, the Web Speech API provides a graceful fallback.
2. Speak naturally — **on-device VAD** (Voice Activity Detection) monitors real audio levels and detects actual speech, distinguishing it from background noise. The 12-bar audio visualizer reflects real VAD audio levels (not animated placeholders).
3. When you finish a phrase, the segment goes through a **three-layer extraction cascade**:
   - **Layer 1 — LLM Streaming**: The on-device LLM (`TextGeneration.generateStream()`) analyzes the transcript and streams structured intelligence tokens in real-time.
   - **Layer 2 — Tool Calling**: If the LLM supports it, structured tool-calling extraction runs as a secondary pass.
   - **Layer 3 — Keywords**: If the LLM is still loading or unavailable, keyword-based extraction provides instant fallback results.
4. **Embeddings-based semantic deduplication** (via the EMB model) prevents duplicate findings from appearing in the intelligence panel. Similar extractions are merged automatically.
5. Streaming LLM output appears token-by-token with a cursor blink animation. Results are validated via `StructuredOutput.extractJson()` and grouped by category.
6. After extraction completes, **on-device TTS** provides spoken voice feedback summarizing what was extracted, giving you audio confirmation without looking at the screen.
7. Click **"PAUSE CAPTURE"** to temporarily stop recording.

#### Intelligence Categories

The right panel groups findings by category with count badges. For example, a Security Audit session might show:

```
VULNERABILITIES (3)
  [14:32:05] SQL injection found in login endpoint
  [14:33:12] Default credentials on admin panel
  [14:35:44] Unpatched Apache Struts on web server

AFFECTED SYSTEMS (2)
  [14:32:05] Production web server (192.168.1.10)
  [14:35:44] Apache web server cluster

RISK ASSESSMENT (1)
  [14:33:12] Critical - default admin credentials allow full system access
```

### Step 5: End Session

Click **"END SESSION"** in the header to stop capture and view the Session Dossier.

### Step 6: Session Dossier

The dossier view presents a complete summary:

- **Stamps**: "CLASSIFIED" and "EYES ONLY" watermarks
- **Metadata Grid**: Case number, operation codename, domain, clearance level, session start time, duration, segment count, finding count
- **Raw Transcript**: Complete chronological transcript of all speech segments
- **Intelligence Extract**: All findings grouped by category

### Step 7: Save or Destroy

**Save to Vault**: Sessions are auto-saved with debounced encryption (AES-256-GCM) to your encrypted vault. You can return to previous sessions from the Case List.

**Destroy Session**:
1. Click **"DESTROY SESSION"** — a visual **countdown timer** appears, giving you a clear window to confirm or cancel
2. Click again before the countdown expires to confirm (auto-resets after timeout)
3. A cinematic burn animation plays:
   - "Wiping transcript buffer..."
   - "Purging intelligence extracts..."
   - "Zeroing session memory..."
   - "Session destroyed. No trace remains."
4. You return to the domain selection screen. All data is permanently gone.

### Voice Commands

Say **"Hey Shadow"** followed by a command:
- "Hey Shadow, delete case [name]" — Delete a case (with fuzzy matching)
- "Hey Shadow, open case [name]" — Open a specific case
- "Hey Shadow, new case" — Create a new case

---

## Keyboard Navigation & Accessibility

ShadowNotes is fully keyboard-navigable and screen-reader-friendly:

- **Tab / Shift+Tab** — move focus between all interactive elements (buttons, inputs, cards, intelligence items)
- **Enter** — activate the focused element (select a domain, begin capture, confirm actions)
- **Escape** — close modals (GlobalSearch, ExportModal) and cancel pending actions
- **Focus traps** — modals like GlobalSearch and ExportModal trap focus inside them so keyboard users stay in context
- **ARIA labels and live regions** — all controls have descriptive labels; intelligence extractions and status changes are announced to screen readers via ARIA live regions
- **Empty state guidance** — when no sessions or findings exist, helpful prompts guide you on what to do next

## Browser Tips

- **Don't close the tab accidentally** — a `beforeunload` warning will prompt you during active sessions
- **DevTools Network tab** — open it to verify zero network requests during your session
- **Multiple sessions** — after destroying one session, you can immediately start another
- **Model cache** — models persist in OPFS across browser restarts (clear via browser settings > Site Data)

---

## Troubleshooting

### "Required models not loaded"
Return to the session init screen and re-download models. This can happen if OPFS cache was cleared.

### Microphone not working
- Ensure browser has microphone permission (click the lock icon in the address bar)
- Check that no other application is using the microphone
- Try a different browser (Chrome or Edge recommended)

### Boot sequence shows error
- Ensure your browser supports WebAssembly SIMD and SharedArrayBuffer
- Check that the page is served with Cross-Origin Isolation headers (automatic with `npm run dev` or Vercel)
- Firefox may have compatibility issues with some WASM features — use Chrome or Edge

### Models fail to download
- Check internet connection (only needed for first download)
- Ensure sufficient disk space (~810MB)
- Try clearing browser site data and re-downloading

### Slow transcription or extraction
- Close other browser tabs to free memory
- Gemma 3 1B Instruct runs on CPU via WASM — larger transcripts take longer to analyze
- If your device has WebGPU support, the SDK will auto-detect and use GPU acceleration
- Ensure your device has 2GB+ free RAM

---

## Running Tests

```bash
npx vitest run        # Run all 227 tests
npm run test:watch    # Watch mode (re-runs on file changes)
npm run test:coverage # Generate coverage report
```

Test suite includes 227 tests across 17 files:
- 61 domain tests (profiles, case number generation, system prompts)
- 21 extraction tests (keyword-based intelligence extraction)
- 11 hook tests (model loader state machine)
- 69 component tests (all 10 UI components including vault, case management)
- 15 vault tests (encryption, key derivation, CRUD)
- 8 storage tests (IndexedDB operations)
- 5 crypto tests (AES-256-GCM, HKDF, PBKDF2)
- 16 voice command tests (parsing, fuzzy matching)
- 7 integration tests (full session lifecycle across domains)
- 1 auth test (WebAuthn availability)
