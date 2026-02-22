# ShadowNotes - Usage Guide

## Prerequisites

| Requirement | Details |
|------------|---------|
| **Node.js** | Version 18 or higher ([download](https://nodejs.org)) |
| **Browser** | Chrome 96+ or Edge 96+ (required for WebAssembly SIMD + SharedArrayBuffer) |
| **Microphone** | Any working microphone for voice capture |
| **Disk Space** | ~360MB for AI model download (one-time, cached) |
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

This initializes the RunAnywhere SDK and registers AI model backends. It takes 1-2 seconds.

### Step 2: Select Your Domain

You'll see four domain cards. Select the one that matches your use case:

| Domain | Best For | Extracts |
|--------|----------|----------|
| **Security Audit** | Penetration test debriefs, vulnerability assessments | Vulnerabilities, Timeline, Evidence, Affected Systems, Risk Assessment |
| **Legal Deposition** | Witness statements, legal interviews | Key Statements, Timeline, Parties Involved, Contradictions, Exhibits |
| **Medical Notes** | Clinical dictation, patient encounters | Symptoms, Diagnoses, Medications, Vital Signs, Follow-up Actions |
| **Incident Report** | Accident reports, security incidents | Incident Timeline, Witnesses, Damage Assessment, Root Cause, Next Steps |

### Step 3: Download AI Models

Click **"DOWNLOAD SECURE MODULES & BEGIN"**. Three models download sequentially:

1. **VAD Module** (Silero VAD v5) — ~5MB — Voice activity detection
2. **STT Module** (Whisper Tiny English) — ~105MB — Speech-to-text
3. **LLM Module** (LFM2 350M) — ~250MB — Intelligence extraction

A progress bar shows download status. Models are cached in your browser's private filesystem (OPFS), so subsequent sessions skip this step.

If models are already cached, the button reads **"BEGIN CAPTURE SESSION"** instead.

### Step 4: Active Capture

After models load, you enter the capture screen:

- **Header**: Shows clearance level, case number (SN-YYMMDD-XXXX), session timer, and "AIR-GAPPED" status indicator
- **Domain Banner**: Shows the operation codename (e.g., "OPERATION FIREWALL")
- **Left Panel (RAW TRANSCRIPT)**: Shows all transcribed speech segments with timestamps
- **Right Panel (INTELLIGENCE EXTRACT)**: Shows AI-extracted findings grouped by category

#### Recording

1. Click **"BEGIN CAPTURE"** to activate your microphone
2. Speak naturally — VAD automatically detects when you start and stop speaking
3. The 12-bar audio visualizer shows real-time audio levels
4. When you stop speaking, the segment is automatically:
   - Transcribed by Whisper (status: "Transcribing speech...")
   - Analyzed by the LLM (status: "Extracting intelligence...")
5. Results appear in both panels immediately
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

### Step 7: Destroy Session

1. Click **"DESTROY SESSION"** — the button changes to **"CONFIRM: DESTROY ALL SESSION DATA"**
2. Click again within 5 seconds to confirm (auto-resets after timeout)
3. A cinematic burn animation plays:
   - "Wiping transcript buffer..."
   - "Purging intelligence extracts..."
   - "Zeroing session memory..."
   - "Session destroyed. No trace remains."
4. You return to the domain selection screen. All data is permanently gone.

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
- Ensure sufficient disk space (~360MB)
- Try clearing browser site data and re-downloading

### Slow transcription or extraction
- Close other browser tabs to free memory
- LFM2 350M runs on CPU via WASM — larger transcripts take longer to analyze
- Ensure your device has 2GB+ free RAM

---

## Running Tests

```bash
npm test              # Run all 137 tests
npm run test:watch    # Watch mode (re-runs on file changes)
npm run test:coverage # Generate coverage report
```

Test suite includes:
- 60 unit tests (domain profiles, case number generation)
- 11 hook tests (model loader state machine)
- 53 component tests (all UI components)
- 6 integration tests (full session lifecycle)
