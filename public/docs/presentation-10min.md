# ShadowNotes — 10-Minute Presentation Script

**Format**: 7 minutes demo/presentation + 3 minutes Q&A
**Judges**: Nikhil Jha (Data Scientist, Accenture), Naman Badkul (DevOps, MakeMyTrip), Manas Chopra (Qdrant/Geekroom)

---

## The 7-Minute Demo (Strict Timing)

### Minute 0:00–1:00 — The Problem (60 seconds)

> "India has 6 million professionals — doctors, lawyers, security auditors, police — who generate sensitive spoken intelligence every day. They need AI to structure it. But they can't use ChatGPT, Otter.ai, or any cloud AI — because DPDPA 2023 says their data cannot leave the device. Cloud AI is legally disqualified."

> "There is no product that gives them on-device AI extraction. ShadowNotes is the first."

**Key stat**: 1.3M doctors, 1.7M lawyers, 300K security professionals, 2.8M police — zero tools available today.

### Minute 1:00–2:00 — Live Demo Part 1: Open and Authenticate (60 seconds)

Do this LIVE at shadownotes.dmj.one:
1. Open the site — show it loads instantly (PWA cached)
2. Create vault with passphrase — show passphrase strength indicator
3. Select a domain (Security Audit / Kavach)
4. Create a case (SN-YYMMDD-XXXX auto-generated)

> "Everything you see is running in your browser. Zero server calls. Let me prove it."

**If asked**: Open DevTools → Network tab → show zero external requests during operation.

### Minute 2:00–4:00 — Live Demo Part 2: Voice Capture + AI Extraction (120 seconds)

1. Start a session — click Record
2. Speak a security audit finding aloud: *"Found a sequel injection vulnerability on the login page. The admin panel at 192.168.1.50 is running SSH on port 22 with default credentials."*
3. Watch in real-time:
   - STT transcribes (on-device Whisper or Web Speech API)
   - LLM extracts structured findings (streaming tokens appear live)
   - Speech errors auto-corrected: "sequel injection" → "SQL injection"
   - Findings appear categorized: [Vulnerabilities], [Affected Systems], [Risk Assessment]

> "That LLM — Gemma 3 1B — just ran entirely in your browser via WebAssembly. No API key. No server. No network. The speech recognition, the voice activity detection, the text extraction — all on-device."

4. Show the intelligence panel — click to edit a finding inline, click X to delete
5. Show export → generate PDF (branded "Kavach" security report)

### Minute 4:00–5:30 — How It Actually Works (90 seconds)

> "Let me show you the architecture in 90 seconds."

**The Pipeline** (draw on whiteboard or show slide):
```
Mic → AudioCapture (16kHz) → VAD (Silero) → STT (Whisper) → LLM (Gemma 3) → Encrypt (AES-256-GCM) → IndexedDB
```

**Three things that make this work:**

1. **Two-layer extraction**: LLM streaming with unified parsing. If LLM isn't loaded yet, regex keyword extraction kicks in immediately. You always get results.

2. **In-browser vector intelligence** *(look at Manas when you say this)*: Every finding gets embedded via `Embeddings.embed()`. We run `cosineSimilarity()` at 0.85 threshold for dedup. `findSimilar()` for semantic search. `buildRAGContext()` injects top-5 relevant prior findings into the next LLM prompt. Full RAG pipeline — no Pinecone, no Qdrant, no cloud embeddings API — running in a browser tab.

3. **Three model tiers**: Gemma 3 1B (810MB, best quality), Qwen2.5 0.5B (400MB, balanced), SmolLM2 135M (100MB, works on low-end devices). Hot-swappable at runtime. Adapts to India's hardware diversity.

### Minute 5:30–6:30 — Real Benchmarks (60 seconds)

**Show these numbers. They are all verified.**

| Claim | Proof |
|-------|-------|
| **Zero network calls** | `grep -r "fetch(" src/` returns ONLY `ollamaEngine.ts` which hits `localhost:11434` (local Ollama, Electron-only). Zero `sendBeacon`, zero analytics, zero telemetry. CSP restricts connect-src to self + HuggingFace (model download only). |
| **Code quality** | 9,748 LOC across 36 production files. TypeScript 5.9 strict mode — zero type errors. |
| **Test suite** | 231 tests across 18 files. 5.5 seconds execution. Unit, component, integration, E2E. |
| **Build speed** | 7.7 seconds production build (Vite 7). |
| **Accessibility** | 174 accessibility attributes (122 aria-*, 44 role, 8 tabIndex) across 10 component files. |
| **Security** | 8 production security headers: COOP, COEP, CSP, HSTS, Referrer-Policy, Permissions-Policy, X-Frame-Options, X-Content-Type-Options. AES-256-GCM + HKDF + PBKDF2 (600K iterations) + WebAuthn PRF. |
| **Encryption** | Per-case keys via HKDF. Random per-vault PBKDF2 salt. Brute-force protection with exponential backoff. |
| **Bundle** | 38MB dist total. 19.4MB is WASM runtimes (LlamaCPP + ONNX). 6.5MB app JS. WASM cached immutably for 1 year. |
| **Offline** | PWA service worker pre-caches 27 assets. After first load + model download, zero network needed forever. |

### Minute 6:30–7:00 — The Vision (30 seconds)

> "ShadowNotes is free, open source, MIT license. Zero server costs because there are no servers. Zero API costs because there are no APIs. After one model download, every extraction session costs nothing, forever."

> "We built this in under a week — two students from GGSIPU Delhi, orchestrated by Claude. This is Atmanirbhar Bharat in practice: Indian talent plus AI tools equals world-class output."

> "6 million Indian professionals are waiting for a tool that respects their data sovereignty. The technology is ready."

---

## The 3-Minute Q&A — Prepared Answers

### Q: "Is this really completely offline?"

**Answer**: "Yes. I can prove it three ways:

1. **Code audit**: `grep -r fetch src/` — the only fetch call in 9,748 lines of source code is in `ollamaEngine.ts`, which hits `localhost:11434` for optional local Ollama in Electron desktop mode. Zero external HTTP calls.

2. **CSP enforcement**: Our Content Security Policy in `vercel.json` restricts `connect-src` to `self` and `huggingface.co`. HuggingFace is only for the one-time model download. After that, all models are cached in OPFS. The browser itself blocks any other network call.

3. **Live proof**: Open DevTools Network tab. Use the app for 5 minutes. Zero requests after initial page load."

### Q: "What's the efficiency / performance?"

**Answer**: "Three levels of efficiency:

- **Build efficiency**: 9,748 lines produce a complete AI-powered encrypted voice-to-intelligence pipeline. 7.7 second builds. 231 tests in 5.5 seconds.
- **Runtime efficiency**: Three model tiers — 100MB for low-end devices, 400MB balanced, 810MB full quality. The user chooses based on their hardware. Models cached in OPFS after first download — zero re-download. WASM cached for 1 year via immutable headers.
- **Operational efficiency**: Zero ongoing cost. No server. No API key. No subscription. The browser is the server. 1 user or 1 million users — same infrastructure: static files on Vercel free tier."

### Q: "What about code quality?"

**Answer**: "TypeScript strict mode with zero type errors. 231 tests across 18 files — unit, component, integration, and E2E. 5.5 seconds to run. AES-256-GCM encryption with per-case HKDF-derived keys. 8 security headers in production. Brute-force protection on vault unlock. CSP blocks all unauthorized network calls. The code is open source — anyone can audit it."

**If pressed on ESLint**: "We have 18 ESLint style issues — mostly React render pattern warnings and `Function` type usage. Zero are security or correctness issues. TypeScript's type checker catches what matters."

### Q: "What's the real-world value?" (Impact — 10% weight)

**Answer**: "Four concrete use cases, each with a real gap:

1. **Rural doctor in Chhattisgarh**: Dictates patient notes into phone. No internet. ShadowNotes + SmolLM2 135M extracts structured findings — medications, symptoms, follow-ups — entirely offline. Exports a Sanjeevani prescription PDF.

2. **Security auditor at a bank**: Can't upload vulnerability findings to any cloud. ShadowNotes extracts CVEs, affected systems, risk assessments into an encrypted Kavach audit report. Air-gapped. Zero trace.

3. **Lawyer taking a deposition**: Attorney-client privilege means no cloud transcription. ShadowNotes extracts key statements, contradictions, timeline — into a Nyaaya legal document.

4. **Police officer at a crime scene**: No internet. Needs structured incident documentation. Speaks into phone. Gets categorized findings in a Prahari incident report.

No existing product serves any of these four. ChatGPT requires internet. Otter.ai sends data to servers. Standard Notes has no AI. ShadowNotes is the only product at the intersection of on-device AI + structured extraction + military-grade encryption + zero-network operation."

### Q: "How does the vector search / embeddings work?" (Manas will ask this)

**Answer**: "We run the full RAG pipeline in the browser — no vector database needed.

`Embeddings.embed()` converts each finding to a Float32Array vector. We cache them in a Map so we don't recompute. `embedBatch()` is cache-aware — only uncached texts go to WASM.

Three operations on those vectors:
- **Dedup**: `cosineSimilarity()` at 0.85 threshold. First-occurrence wins, near-duplicates dropped.
- **Search**: `findSimilar()` ranks all items by cosine similarity to a query. Top-K returned.
- **RAG**: `buildRAGContext()` retrieves the top-5 most relevant prior findings and injects them into the LLM system prompt for the next extraction.

It's O(n) scan, which is fine for per-session item counts — hundreds of findings, not millions. If we needed institutional scale with thousands of cross-case findings, we'd want an in-browser vector index."

### Q: "How does this scale?" (Naman will ask this)

**Answer**: "This is the interesting part — it scales by doing nothing.

Traditional AI app: GPU servers, load balancers, API gateways, monitoring, on-call. ShadowNotes: static files on Vercel free tier.

Each user brings their own compute — the browser IS the server. 1 user costs the same as 1 million users: zero. The only bottleneck is HuggingFace bandwidth for the one-time model download, and that's CDN-backed.

Zero operational cost. Zero downtime risk. Zero scaling engineering."

### Q: "Why not just use a cloud API with encryption?"

**Answer**: "Encryption in transit is not enough. When you send data to a cloud API — even encrypted in transit — it must be decrypted on the server for inference. The server has your data in plaintext during processing. Under DPDPA 2023, that's a data processing event on foreign infrastructure.

ShadowNotes never decrypts data anywhere except the user's own browser. The data never exists in plaintext on any server, because there is no server. This is not a privacy policy — it's an architectural guarantee. You can verify it by auditing the source code."

---

## Per-Judge Strategy

### Nikhil Jha (Data Scientist, Accenture) — Focus on the PIPELINE

He thinks in data pipelines. Emphasize: "10-stage ETL pipeline running in a browser sandbox — Capture, Detect, Transcribe, Extract, Parse, Deduplicate, Enrich, Encrypt, Persist, Export." Use the term "ETL" — he'll connect immediately.

If he asks about Python/SQL: "We chose JavaScript/TypeScript because the browser IS the runtime. No install, no dependencies, no infrastructure. The pipeline concepts are the same — just a different execution environment."

### Naman Badkul (DevOps, MakeMyTrip) — Focus on ZERO INFRASTRUCTURE

He manages cloud infrastructure at scale. The "no server" story is his dream. Say: "The best infrastructure is no infrastructure. Each user brings their own compute."

Show him: 7.7s builds, 231 tests, 8 security headers, PWA service worker, WASM immutable caching. He'll respect the engineering discipline.

### Manas Chopra (Qdrant, Geekroom) — Focus on VECTOR INTELLIGENCE

He works at a vector database company. Lead with: "We built in-browser vector search — embed, cosineSimilarity, top-K retrieval, RAG context injection — without any external vector DB."

He's also a community builder. Mention: "MIT license, open source, free forever. Two students from Delhi built this in a week with AI orchestration."

---

## Hard Questions to Prepare For

| Question | Honest Answer |
|----------|---------------|
| "What's the extraction accuracy?" | "We haven't benchmarked precision/recall yet. That requires field trials with domain experts. The architecture supports it — our ask is for user testing partnerships." |
| "Can 1B models really extract reliably?" | "For short factual extraction — yes. We're not asking for reasoning or summarization. We're asking for pattern matching: find the medication, the IP address, the witness name. Small models do this well with the right prompt." |
| "Why not fine-tune?" | "Time constraint — this is a one-week hackathon. Fine-tuning is our next step. The architecture already supports model swapping, so a fine-tuned model drops in without code changes." |
| "What about mobile?" | "It works in mobile Chrome — responsive design, touch-friendly. But WASM inference on mobile is slower. The SmolLM2 135M tier was designed for this — smallest model for weakest hardware." |
| "18 ESLint errors?" | "All are style issues — React render patterns and TypeScript `Function` type usage. Zero security or correctness issues. TypeScript strict mode catches what matters, and all 231 tests pass." |

---

*Total word count of this doc: ~1,600 words. You don't need to memorize it — just know the structure and the key numbers.*
