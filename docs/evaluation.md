# ShadowNotes — Internal Evaluation Report

**Date**: 2026-02-27
**Evaluator**: Enterprise-grade strict audit against RunAnywhere Vibe Challenge criteria
**Overall Weighted Score**: 6.05 / 10

---

## Evaluation Criteria (from Hackathon)

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| On-Device AI Integration | 30% | 6.5/10 | 1.95 |
| Innovation & Creativity | 25% | 5.5/10 | 1.38 |
| User Experience | 20% | 6.0/10 | 1.20 |
| Technical Implementation | 15% | 6.5/10 | 0.98 |
| Impact & Practicality | 10% | 5.5/10 | 0.55 |
| **Total** | **100%** | | **6.05** |

---

## 1. On-Device AI Integration (30%) — Score: 6.5/10

### Strengths
- **`TextGeneration.generateStream()`** — genuinely load-bearing. Streaming token-by-token extraction is the core feature
- **`StructuredOutput.extractJson()`** — JSON validation fallback used conditionally
- **`ModelManager` + `EventBus` + `OPFSStorage`** — full model lifecycle: download, cache, progress tracking
- **`RunAnywhere.initialize()`** with LlamaCPP framework — GPU detection with crash recovery
- **Advanced sampling** — `topK`, `topP`, `temperature`, `stopSequences` all configured for factual extraction

### Gaps Identified & Fixed
- **Decoration imports removed**: STT, TTS, VAD, AudioCapture, AudioPlayback, VoicePipeline, ToolCalling were imported but never genuinely called. All phantom imports were removed for honest integration
- **ToolCalling.registerTool()** had no-op callbacks — removed entirely
- Honest count: **8 genuinely-used SDK features** across 2 packages (`@runanywhere/web`, `@runanywhere/web-llamacpp`)

### Remaining Gaps
- Only 2 of 3 SDK packages used (web-onnx not integrated)
- Model is 0.5B — small for complex extraction tasks. Larger models would improve accuracy
- No fine-tuning or LoRA — using generic Qwen2.5 with prompt engineering only

---

## 2. Innovation & Creativity (25%) — Score: 5.5/10

### Strengths
- **Novel combination**: On-device LLM + voice capture + zero-trust encryption in a browser — no exact competitor exists
- **Dual-layer extraction**: Keyword fallback while LLM loads is smart UX
- **Domain-specific system prompts** with speech error correction (e.g., "sequel injection" → SQL injection)
- **Classified dossier UI** — authentic, memorable aesthetic with CRT effects, stamps, burn animation
- **Cross-session LLM context** — prior findings auto-injected for deduplication

### Gaps
- Individual components (voice notes, on-device LLM, encrypted storage) are known patterns — the innovation is in combination, not invention
- No novel AI technique (no fine-tuning, no RAG, no custom architecture)
- Speech error correction is prompt-based only — a custom decoder or confidence scoring would be more innovative
- The 0.5B model sometimes produces generic or inaccurate extractions

---

## 3. User Experience (20%) — Score: 6.0/10

### Strengths
- Clean split-panel layout (transcript left, intelligence right)
- Real-time streaming token display with cursor animation
- Inline editing of extracted findings (click to edit, X to delete)
- Session dossier summary with grouped findings
- Voice commands ("Hey Shadow, delete case...")
- Auto-save with debounced encryption
- PWA with full offline support

### Gaps Identified & Fixed
- Empty catch blocks now have console.warn for debugging
- Fire-and-forget promise in handleEndSession fixed (extraction now awaited)
- Array index React keys replaced with stable timestamp-based keys

### Remaining Gaps
- No onboarding or first-time user guidance
- No loading skeleton states — just blank panels while loading
- No undo for destructive actions (delete finding, destroy session)
- Mobile experience is functional but not optimized for one-handed use
- No keyboard shortcuts for power users
- Accessibility: ARIA labels present but focus management could be tighter

---

## 4. Technical Implementation (15%) — Score: 6.5/10

### Strengths
- TypeScript strict mode throughout
- 227 automated tests (unit + component + integration)
- AES-256-GCM encryption with per-case HKDF key derivation
- WebAuthn PRF for biometric key material
- LLM calls serialized via mutex to prevent KV cache corruption
- Clean separation: runanywhere.ts, extraction.ts, crypto.ts, vault.ts, auth.ts

### Gaps Identified & Fixed
- **PBKDF2 salt split**: Was sharing a constant with HKDF. Now origin-specific PBKDF2_SALT prevents cross-origin rainbow table attacks
- **Double JSON.parse** in ActiveCapture.tsx — parse once, reuse result
- **ESLint**: Went from 9 errors + 73 warnings to 0 errors (unused imports, Date.now() in render, empty catch blocks, setState-in-effect cascades, ternary-as-statement)
- **Dead code removed**: getAccelerationMode() never called, decoration SDK imports removed
- **Timestamp utility**: Extracted `getTimestamp()` to replace 6 duplicate expressions

### Remaining Gaps
- ActiveCapture.tsx is still ~700+ lines — could benefit from extraction into smaller components
- PBKDF2 salt is origin-specific but still deterministic (not random per-vault)
- No Content Security Policy headers
- No rate limiting on vault unlock attempts
- Test mocks still reference removed SDK features (harmless but inconsistent)

---

## 5. Impact & Practicality (10%) — Score: 5.5/10

### Strengths
- Clear target audience: security auditors, attorneys, physicians, incident responders
- Genuine privacy guarantee — zero network calls for intelligence extraction
- Zero cost after model download — no API fees, no subscriptions
- Works on any modern browser (Chrome 96+, Edge 96+)

### Gaps
- 0.5B model accuracy may frustrate users expecting GPT-4 quality
- 400MB download is a significant barrier for first-time users
- Web Speech API requires online Chrome/Edge for best accuracy (not truly air-gapped for transcription)
- No real-world user testing data
- No clear distribution strategy beyond the demo URL

---

## Summary of Fixes Applied

| Category | Fix | Impact |
|----------|-----|--------|
| SDK Honesty | Removed 7 decoration imports (STT, TTS, VAD, AudioCapture, AudioPlayback, VoicePipeline, ToolCalling) | Honest integration: 8 genuine features |
| Security | Split PBKDF2 salt to be origin-specific | Prevents cross-origin rainbow table attacks |
| Code Quality | Fixed double JSON.parse, fire-and-forget promise, stale closures | Eliminated runtime bugs |
| ESLint | Fixed all 9 errors + 73 warnings | Clean CI compliance |
| Dead Code | Removed getAccelerationMode(), phantom SDK exports | Smaller bundle, clearer codebase |
| Duplication | Extracted getTimestamp() utility, replaced 6 occurrences | DRY principle |
| Documentation | Updated all docs to reflect actual SDK usage (8 features, 2 packages) | Honest representation |

---

## Recommendation

The project demonstrates genuine depth with the RunAnywhere SDK's streaming LLM pipeline and makes a compelling case for on-device AI in privacy-sensitive domains. The main improvements to push toward a 9+/10 would be:

1. **Deeper SDK integration** — integrate web-onnx for on-device STT (replacing Web Speech API) to achieve true air-gapped operation
2. **Larger model support** — test with 1.5B or 3B models for better extraction accuracy
3. **UX polish** — onboarding flow, loading skeletons, undo support, keyboard shortcuts
4. **Novel AI technique** — custom extraction fine-tune, confidence scoring, or RAG over prior findings
5. **Real-world validation** — user testing with actual security auditors or physicians

---

*This evaluation was conducted with enterprise-grade strictness. Scores reflect honest assessment against competition-level standards, not participation-grade leniency.*
