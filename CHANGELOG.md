# Changelog

All notable changes to ShadowNotes are documented in this file.

## [1.3.1] - 2026-02-28

### Fixed

- **Multiple LLM Generations Firing Per Extraction** — `extractWithFallback` was cascading through up to 3 separate LLM generation paths: `TextGeneration.generateStream()` (primary), `ToolCalling.generateWithTools()` with `autoExecute: true` and `maxToolCalls: 30` (secondary, up to 30 internal generations), and an Ollama timeout-retry fallback (tertiary). Consolidated to a single LLM generation per extraction with unified parsing (StructuredOutput JSON + line-based `[Category] fact` parsing). Removed the separate `extractWithTools` import and the `tryOllamaExtraction` callback that caused cascading generations.

### Changed

- **Two-Layer Extraction Pipeline** — Extraction pipeline simplified from three-layer cascade (LLM streaming → ToolCalling → Keywords) to two-layer pipeline (single LLM generation with unified parsing → keyword regex fallback). One generation call, one response, all parsing strategies applied to that single output.
- **Unified Parsing for All Engines** — Both Ollama (Electron desktop) and embedded LLM (WASM) now share the same parsing pipeline: StructuredOutput JSON extraction → line-based `[Category] fact` parsing → embeddings deduplication. Previously Ollama had its own separate parsing path that skipped JSON extraction.

### Testing

- All 231 tests pass across 18 test files.
- TypeScript strict mode: 0 errors.
- Production build: clean.

---

## [1.3.0] - 2026-02-28

### Added

- **Global SDK Feature Readiness Tracker** — New event-driven system in `runanywhere.ts` (`getSDKFeatureStatus`, `onSDKFeatureChange`, `refreshSDKFeatureStatus`) that tracks which SDK features (LLM, STT, VAD, TTS, Embeddings) are loaded. Updated after each model load during boot, with listener-based notifications.
- **`useSDKFeatures` Hook** — Reactive hook (`hooks/useSDKFeatures.ts`) that subscribes to the global readiness tracker. Provides instant badge updates when models finish loading, plus a 3s polling safety net for 30 seconds.
- **E2E User Flow Tests** — New integration test suite (`user-flow-e2e.test.tsx`) covering the full user journey: voice capture → STT → transcript display → LLM extraction → intelligence item rendering. Verifies no streaming text UI is rendered during extraction (regression guard against render spam).

### Fixed

- **SDK Badges Not Lighting Up** — STT, VAD, TTS, and EMB badges stayed grey because the per-hook availability checks (`useAudioPipeline`, `useTTS`, `useEmbeddings`) only re-checked ONNX SDK properties at mount + 2s + 5s delays, missing the boot preload window. Badges now use global readiness state as a fallback alongside hook checks.
- **`useEmbeddings` Never Re-checking** — `useMemo(() => Embeddings.isModelLoaded, [])` with empty deps checked availability exactly once at mount. Replaced with `useState` + `useEffect` that re-checks at 2s, 5s, and 10s intervals.
- **UI Freeze During LLM Extraction** — Spinner stopped rotating and session timer froze because `for await (token of stream)` ran WASM token generation synchronously on the main thread without yielding. Now yields to the event loop every 4 tokens via `setTimeout(0)`, keeping CSS animations and timer callbacks responsive.

### Testing

- All 231 tests pass across 18 test files (4 new e2e tests added).
- TypeScript strict mode: 0 errors.
- Production build: clean.

---

## [1.2.0] - 2026-02-28

### Added

- **ONNX Model Preloading at Boot** — All audio models (VAD, STT, TTS) are now downloaded and loaded during the boot sequence via `ModelManager.ensureLoaded()`. First run downloads ~170 MB of ONNX models from HuggingFace; subsequent launches load from OPFS cache instantly.
- **ONNX Model Registry** — Registered 3 new `CompactModelDef` entries for Silero VAD (2.3 MB), Whisper Tiny English int8 STT (103 MB), and Piper English Amy TTS (63 MB) alongside the existing LLM model.
- **Boot Screen ONNX Phase** — Phase 6 in boot sequence shows per-model loading progress (VAD → STT → TTS) with spinner/checkmark indicators.

### Changed

- **`preloadONNXModels()` rewritten** — Replaced direct `VAD.init()` / `STT.loadModel()` / `TTS.loadVoice()` calls (which required manual config) with `ModelManager.ensureLoaded(category)`. The SDK's ONNXProvider loaders now handle all sherpa-onnx FS operations, archive extraction, and config creation automatically.

### Fixed

- **CORS / CSP for HuggingFace CDN** — Added `https://*.hf.co` to CSP `connect-src` in `vercel.json` for XetHub CDN compatibility.
- **Google Fonts COEP** — Added `crossorigin` attribute to font `<link>` tags in `index.html` and `docs/field-manual.html` for COEP `credentialless` compatibility.

---

## [1.1.0] - 2026-02-27

### Added

- **VoiceAgent Hands-Free Mode** — New `AGENT` capture mode in ActiveCapture using `VoicePipeline` and `VoiceAgent.create()` from `@runanywhere/web`. Provides continuous listen-process-respond loop without manual button presses. Three-button toggle: MIC | TEXT | AGENT.
- **RAG Context Injection** — `buildRAGContext()` method in `useEmbeddings` hook. Semantically retrieves the most relevant prior findings via cosine similarity and injects them into the LLM prompt for contextual priming across sessions.
- **Semantic Search Reranking** — GlobalSearch now uses `findSimilar()` from the embeddings engine to rerank results by semantic relevance. Shows `SEM` badge when active.
- **Onboarding Tutorial** — 3-step first-run walkthrough in SessionInit (Welcome, Select Domain, Capture Intelligence). ARIA-accessible with keyboard navigation (ESC to skip, Enter to advance). Persists via `localStorage`.
- **Vault Brute-Force Protection** — Exponential backoff rate limiting on passphrase unlock. Lockout schedule: 5s / 15s / 30s / 60s after 3 failed attempts. Countdown timer with `aria-live="assertive"`. Stored in `sessionStorage` to survive page refreshes within a session.
- **React Error Boundary** — `AppErrorBoundary` class component wrapping the entire app tree. Catches unhandled errors and renders a recovery UI with "ATTEMPT RECOVERY" button.
- **Schema Validation on Decrypt** — `decryptContent()` now validates that decrypted JSON contains required `transcripts` and `intelligence` arrays. Throws typed `DECRYPT_INVALID_SCHEMA` errors for corrupted data.
- **SDKLogger Integration** — Replaced all `console.warn` / `console.info` calls in `runanywhere.ts` with `SDKLogger` instance for structured, SDK-native logging.
- **Capability-Aware Performance Presets** — `getRecommendedPreset()` inspects `detectCapabilities()` result (WebGPU, RAM, cores) and auto-selects `high` / `medium` / `low` preset on first boot. Users can override manually.
- **Loading Skeleton States** — Shimmer animation skeleton bars during boot sequence. `aria-hidden="true"` for screen reader compatibility.
- **Device Detection Boot Line** — Boot screen shows `[HW] Device detected` with hardware profile when SDK init completes.

### Changed

- **ActiveCapture `buildPrompt()` is now async** — Integrates RAG context from embeddings before building the LLM prompt. Falls back gracefully to text-based context on error.
- **`toolExtraction.ts` uses `fromToolValue()`** — Tool call confidence scores are now properly deserialized via `fromToolValue()` instead of raw argument access. Console logging replaced with `SDKLogger`.
- **Performance auto-detection on mount** — `PerfProvider` imports `getRecommendedPreset()` and auto-applies the recommended preset if no saved config exists and the user hasn't manually overridden.

### Security

- **HSTS header** — `Strict-Transport-Security: max-age=31536000; includeSubDomains` added to `vercel.json`.
- **Referrer-Policy** — `strict-origin-when-cross-origin` header added.
- **Permissions-Policy** — `camera=(), geolocation=(), microphone=(self)` restricts sensor access.
- **Brute-force vault protection** — Exponential backoff prevents passphrase guessing attacks.
- **Schema validation** — Decrypted content validated before use, preventing malformed data injection.

### Testing

- All 227 tests pass across 17 test files.
- Added comprehensive mocks for `@runanywhere/web-onnx`, `@runanywhere/web` (15+ exports), and `../../runanywhere` module in test files.
- TypeScript strict mode: 0 errors.
- Production build: clean.

### Documentation

- Updated `docs/evaluation.md` with detailed scoring (9.40/10 weighted) reflecting all new features.
- Updated `docs/submission.md` with VoiceAgent, RAG, brute-force protection, and security header details.
- Updated `README.md` with VoiceAgent mode, RAG context, error boundary, security features, semantic search, and WCAG accessibility.
- Updated `docs/field-manual.html` with VoiceAgent quick-start, security features, and capability information.
- Synced `public/docs/` with `docs/` directory.

### SDK Integration Summary

All 3 RunAnywhere SDK packages with 20+ load-bearing features:

| Package | Features Used |
|---------|--------------|
| `@runanywhere/web` | `RunAnywhere.initialize()`, `ModelManager`, `ModelCategory`, `OPFSStorage`, `EventBus`, `SDKEnvironment`, `SDKLogger`, `detectCapabilities`, `VoicePipeline`, `VoiceAgent`, `VoiceAgentSession`, `AccelerationPreference`, `LLMFramework` |
| `@runanywhere/web-llamacpp` | `TextGeneration.generateStream()`, `StructuredOutput.extractJson()`, `ToolCalling.generateWithTools()`, `Embeddings`, `toToolValue`, `fromToolValue`, `getStringArg`, `getNumberArg`, `LlamaCPP.register()` |
| `@runanywhere/web-onnx` | `ONNX.register()`, `STT.transcribe()`, `TTS.synthesize()`, `VAD`, `AudioCapture`, `AudioPlayback`, `SpeechActivity` |
