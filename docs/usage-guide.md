# ShadowNotes - Usage Guide

## Prerequisites

| Requirement | Details |
|------------|---------|
| **Node.js** | Version 18 or higher ([download](https://nodejs.org)) |
| **Browser** | Chrome 96+ or Edge 96+ (required for WebAssembly SIMD + SharedArrayBuffer) |
| **Microphone** | Any working microphone for voice capture |
| **Disk Space** | ~400MB for LLM model download (one-time, cached in OPFS) |
| **RAM** | 2GB+ free (for WASM model inference) |

The app runs identically on **Windows**, **macOS**, and **Linux**. No platform-specific setup required.

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

This initializes the RunAnywhere SDK, registers the LLM model backend, and prepares the streaming extraction pipeline. It takes 1-2 seconds.

### Step 2: Select Your Domain

You'll see four domain cards. Select the one that matches your use case:

| Domain | Best For | Extracts |
|--------|----------|----------|
| **Security Audit** | Penetration test debriefs, vulnerability assessments | Vulnerabilities, Timeline, Evidence, Affected Systems, Risk Assessment |
| **Legal Deposition** | Witness statements, legal interviews | Key Statements, Timeline, Parties Involved, Contradictions, Exhibits |
| **Medical Notes** | Clinical dictation, patient encounters | Symptoms, Diagnoses, Medications, Vital Signs, Follow-up Actions |
| **Incident Report** | Accident reports, security incidents | Incident Timeline, Witnesses, Damage Assessment, Root Cause, Next Steps |

### Step 2b: Unlock Vault

Before starting a session, you'll authenticate via WebAuthn biometrics (Windows Hello / Touch ID) or a passphrase. This derives the encryption key used to protect your session data at rest.

### Step 3: Begin Session

Select a domain and click **"BEGIN CAPTURE SESSION"**. The LLM model (Qwen2.5 0.5B Instruct, ~400MB) begins downloading in the background. You can start capturing immediately — keyword-based extraction works instantly while the LLM loads.

A progress bar shows download status. The model is cached in your browser's private filesystem (OPFS), so subsequent sessions skip the download.

### Step 4: Active Capture

After models load, you enter the capture screen:

- **Header**: Shows clearance level, case number (SN-YYMMDD-XXXX), session timer, and AI status indicator (PENDING/LOADING/ACTIVE/KEYWORDS)
- **Domain Banner**: Shows the operation codename (e.g., "OPERATION FIREWALL")
- **Left Panel (RAW TRANSCRIPT)**: Shows all transcribed speech segments with timestamps
- **Right Panel (INTELLIGENCE EXTRACT)**: Shows AI-extracted findings grouped by category

#### Recording

1. Click **"BEGIN CAPTURE"** to activate your microphone via the Web Speech API
2. Speak naturally — the browser detects speech automatically
3. The 12-bar audio visualizer shows capture state
4. When you finish a phrase, the segment is automatically:
   - Transcribed by the browser's speech engine (real-time)
   - Analyzed by the streaming on-device LLM (`TextGeneration.generateStream()`) — tokens appear in real-time in the intelligence panel
   - If the LLM is still loading, keyword extraction provides instant fallback results
5. Streaming LLM output appears token-by-token with a cursor blink animation. Results are validated via `StructuredOutput.extractJson()` and grouped by category
6. Click **"PAUSE CAPTURE"** to temporarily stop recording

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
1. Click **"DESTROY SESSION"** — the button changes to **"CONFIRM: DESTROY ALL SESSION DATA"**
2. Click again within 5 seconds to confirm (auto-resets after timeout)
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

## Keyboard & Browser Tips

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
- Ensure sufficient disk space (~400MB)
- Try clearing browser site data and re-downloading

### Slow transcription or extraction
- Close other browser tabs to free memory
- Qwen2.5 0.5B Instruct runs on CPU via WASM — larger transcripts take longer to analyze
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
