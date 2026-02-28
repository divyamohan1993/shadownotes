# ShadowNotes — The Hackathon, the Vision, and the Future

## The RunAnywhere Vibe Challenge

ShadowNotes was built for the **RunAnywhere Vibe Challenge** hackathon — a global competition focused on demonstrating the power of on-device AI running entirely in the browser via WebAssembly. The challenge, facilitated by **ThoughtWorks Technologies**, called on developers to build applications that push the boundaries of what's possible with local AI inference — no cloud, no servers, no data leaving the device.

The hackathon's problem statement resonated deeply with us: *How do we bring the power of AI to environments where data sovereignty, privacy, and offline operation are non-negotiable?*

---

## Atmanirbhar Bharat — Self-Reliant India

ShadowNotes is built with the spirit of **Atmanirbhar Bharat** (Self-Reliant India) at its core. The principle is simple but profound: *critical technologies that handle sensitive data must not depend on foreign cloud infrastructure.*

India's professionals — physicians in rural clinics, security auditors protecting national infrastructure, legal practitioners handling privileged cases, and incident responders at disaster sites — deserve AI-powered tools that:

- **Work without internet** — because connectivity is not guaranteed in field conditions across India's diverse geography
- **Keep data on-device** — because patient records under India's Digital Personal Data Protection Act (DPDPA 2023), legal depositions, and security audit findings must never leave Indian soil, let alone the device
- **Run on modest hardware** — because not every practitioner has a high-end workstation; ShadowNotes offers 3 model tiers (135M, 0.5B, 1B parameters) to match device capability
- **Cost nothing to operate** — because after the one-time model download, every extraction session is free forever — no API keys, no per-token fees, no subscriptions

This is technology self-reliance in practice: a fully functional AI-powered intelligence extraction system that runs entirely within the browser sandbox, with zero dependency on any external service for its core operation.

---

## India 2047 — The Vision

As India approaches the centenary of its independence in **2047**, the nation envisions becoming a developed, self-reliant, and technologically sovereign state. ShadowNotes contributes to this vision by demonstrating that:

1. **On-device AI is production-ready today** — Gemma 3, Whisper, Silero VAD, and Piper TTS all run at usable speeds in WebAssembly, entirely in the browser
2. **Data sovereignty is achievable without sacrificing capability** — ShadowNotes delivers streaming AI extraction, semantic search, voice agents, and RAG context injection — all features that typically require cloud infrastructure — running 100% locally
3. **Indian developers can build world-class AI applications** — This project, built by students from GGSIPU Delhi, integrates 20+ SDK features across 3 packages, 231 passing tests, military-grade encryption, and WCAG 2.2 accessibility
4. **The future of sensitive AI is local** — As Prof. Yoshua Bengio (Turing Award laureate, Université de Montréal) emphasized at the AI Impact Summit, the responsible deployment of AI requires careful attention to data governance, privacy, and the societal impact of AI systems. On-device AI is the natural answer for applications handling classified, medical, legal, or law enforcement data

### India's Domains, India's Names

ShadowNotes honours its Indian roots through domain-specific branding with Sanskrit/Hindi names, each carrying deep cultural significance:

| Domain | Hindi Name | Meaning | Significance |
|--------|-----------|---------|--------------|
| Medical Notes | **Sanjeevani** (संजीवनी) | The Life-Giving Herb | From the Ramayana — the mythical herb that restored life. Represents healing and the sacred duty of medicine. |
| Security Audit | **Kavach** (कवच) | The Divine Shield | The protective armour from Indian mythology. Represents defence, protection, and cyber security. |
| Legal Deposition | **Nyaaya** (न्याय) | The Path of Justice | One of the six schools of Hindu philosophy, focused on logic, epistemology, and justice. |
| Incident Report | **Prahari** (प्रहरी) | The Vigilant Sentinel | The watchful guardian. Represents alertness, emergency response, and protection of the people. |

These names appear in the PDF export system (via jsPDF), where each domain generates professionally branded documents — e.g., "dmj.one CSR Hospital — Sanjeevani" for medical prescriptions.

---

## The AI Impact Summit Context

At the **AI Impact Summit**, **Prof. Yoshua Bengio** (Turing Award 2018, Université de Montréal) highlighted critical themes that directly inform ShadowNotes' architecture:

- **AI Safety and Governance** — AI systems handling sensitive data must have robust safeguards. ShadowNotes addresses this with AES-256-GCM encryption, WebAuthn biometric authentication, brute-force protection, and zero-network data transmission.
- **Democratization of AI** — Advanced AI capabilities should be accessible to all, not just those who can afford cloud API subscriptions. ShadowNotes runs on any modern browser with zero ongoing cost.
- **Privacy by Design** — AI systems should be designed from the ground up to protect user privacy. ShadowNotes' architecture ensures that no user data — voice, transcripts, intelligence findings — ever leaves the device. This is not a privacy policy; it is an architectural guarantee verified by the absence of any `fetch()`, `XMLHttpRequest`, or `WebSocket` calls in the application source code.
- **Responsible AI Deployment** — AI should serve humanity's needs, particularly in high-stakes domains. ShadowNotes targets exactly these domains: medical care, legal proceedings, security auditing, and incident response.

---

## The Technology — Built in India, Built for the World

### Complete Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Frontend** | React 19 + TypeScript 5.9 (strict) | UI framework with hooks-based state management |
| **Build** | Vite 7 + ESLint 10 | Development server, production bundling, code quality |
| **AI SDK (Core)** | @runanywhere/web 0.1.0-beta.9 | RunAnywhere.initialize(), ModelManager, EventBus, OPFSStorage, SDKLogger, VoicePipeline, VoiceAgent, detectCapabilities() |
| **AI SDK (LLM)** | @runanywhere/web-llamacpp 0.1.0-beta.9 | TextGeneration.generateStream(), StructuredOutput, ToolCalling, Embeddings — all via llama.cpp WASM |
| **AI SDK (Audio)** | @runanywhere/web-onnx 0.1.0-beta.9 | STT (Whisper), TTS (Piper), VAD (Silero), AudioCapture, AudioPlayback — all via ONNX WASM |
| **LLM Models** | Gemma 3 1B, Qwen2.5 0.5B, SmolLM2 135M | 3-tier model selection: users choose based on device capability and extraction quality needs |
| **STT Model** | Whisper Tiny English (int8) | On-device speech-to-text (~103 MB), ONNX runtime |
| **VAD Model** | Silero VAD | On-device voice activity detection (~2.3 MB), ONNX runtime |
| **TTS Model** | Piper (Lessac, Medium) | On-device text-to-speech (~64 MB), ONNX runtime |
| **Encryption** | AES-256-GCM + HKDF + PBKDF2 (600K iterations) | Per-case encryption keys, random per-vault salt, WebCrypto API |
| **Authentication** | WebAuthn with PRF extension | Biometric auth (Windows Hello, Touch ID, Face ID) with key material derivation |
| **PDF Export** | jsPDF 4.2 | Domain-specific professional documents with Hindi branding (Sanjeevani, Kavach, Nyaaya, Prahari) |
| **Storage** | IndexedDB (encrypted vault) + OPFS (model cache) + localStorage (settings only) | 50 MB vault quota with auto-rotation |
| **Desktop** | Electron 35 + electron-builder | Cross-platform desktop app with GPU flags, local HTTP server for WebAuthn |
| **PWA** | vite-plugin-pwa + Workbox | Full offline support, installable on desktop and mobile |
| **Testing** | Vitest 4 + Testing Library | 231 tests across 18 files — unit, component, integration, and e2e |
| **Deployment** | Vercel (web) + Electron (desktop) | Security headers (COOP/COEP/CSP/HSTS), WASM caching |

### Browser APIs Leveraged

| API | Usage |
|-----|-------|
| **WebAuthn** | Biometric authentication with PRF for key derivation |
| **WebCrypto** | AES-256-GCM, HKDF, PBKDF2, crypto.getRandomValues() |
| **Web Audio** | AudioCapture (16 kHz mono), AudioPlayback (PCM synthesis) |
| **IndexedDB** | Encrypted vault storage |
| **OPFS** | Origin Private File System for AI model caching |
| **SharedArrayBuffer** | Multi-threaded WASM inference (requires COOP/COEP headers) |
| **WebGPU** | GPU-accelerated LLM inference with shader-f16 |
| **Service Workers** | Workbox-powered offline caching |
| **getUserMedia** | Microphone access for voice capture |

---

## Market Opportunity

### The Problem is Massive and Underserved

Every day, millions of India's professionals generate sensitive spoken intelligence that needs AI-powered structuring — but cannot use cloud AI due to data sovereignty requirements:

| Sector | India Professionals | Pain Point | Regulation |
|--------|-------------------|------------|------------|
| **Healthcare** | 1.3M+ registered doctors, 600K+ in rural areas | Dictation → structured notes with zero internet | DPDPA 2023, patient confidentiality |
| **Cybersecurity** | 300K+ security professionals | Air-gapped vulnerability documentation | IT Act 2000, CERT-In directives |
| **Legal** | 1.7M+ advocates (Bar Council of India) | Privileged deposition transcription | Advocate-client privilege, Evidence Act |
| **Law Enforcement & Emergency** | 2.8M+ police personnel, disaster response teams | Real-time incident documentation in field | Official Secrets Act, state regulations |

### Total Addressable Market

- **India alone**: 6M+ professionals in sensitive domains who need AI tools but cannot use cloud services
- **Global**: Healthcare (12M+ physicians), legal (5M+ lawyers), security (4M+ practitioners) — the on-device AI tools market is projected to reach $50B+ by 2030
- **The gap**: No existing product offers streaming on-device AI extraction for these verticals. ShadowNotes is first-to-market.

### Why India First

India has the world's largest population of professionals in these sensitive domains, the most aggressive data protection regulation (DPDPA 2023), and the most diverse connectivity landscape — from metro 5G to rural areas with no internet. If ShadowNotes works for India, it works for the world.

---

## Why Now

Five forces converge to make ShadowNotes possible today — not two years ago, not two years from now:

1. **WebAssembly maturity** — llama.cpp WASM now runs 1B-parameter LLMs at usable speeds in the browser. Two years ago, this was impossible. The RunAnywhere SDK by ThoughtWorks makes this accessible.

2. **Model quality at small scale** — Gemma 3 1B, Qwen2.5 0.5B, and SmolLM2 135M deliver extraction quality that was only possible with 70B+ models three years ago. The intelligence-per-parameter ratio has improved 50x.

3. **India's DPDPA 2023** — India's Digital Personal Data Protection Act creates legal obligations for data localization and consent that make cloud AI tools legally risky for sensitive professional domains. On-device is the compliant path.

4. **AI Impact Summit momentum** — Prof. Yoshua Bengio's call for responsible AI deployment, privacy by design, and democratization of AI has shifted global discourse toward exactly the architecture ShadowNotes implements.

5. **Browser API readiness** — WebAuthn PRF, OPFS, WebGPU, SharedArrayBuffer, and Service Workers are now mature across Chrome and Edge. The full stack of browser APIs needed for an encrypted, offline, GPU-accelerated AI app is finally available.

---

## Traction & Proof Points

| Metric | Value | Significance |
|--------|-------|--------------|
| **Test Coverage** | 231 tests across 18 files, 100% passing | Production-quality engineering |
| **SDK Integration** | 20+ load-bearing features across 3 packages | Deepest RunAnywhere integration in the hackathon |
| **AI Models** | 6 on-device models (3 LLMs + VAD + STT + TTS) | Complete on-device AI pipeline |
| **Domains** | 4 professional verticals with tailored extraction | Real-world applicability |
| **Encryption** | AES-256-GCM + HKDF + PBKDF2 (600K iter) + WebAuthn PRF | Military-grade security |
| **Accessibility** | 172+ ARIA attributes, WCAG 2.2, keyboard navigation | Inclusive design |
| **PDF Export** | 4 domain-specific professional documents | Tangible, shareable output |
| **Platforms** | Web (Vercel) + Desktop (Electron 35) | Cross-platform from single codebase |
| **Live Demo** | [shadownotes.dmj.one](https://shadownotes.dmj.one) | Working product, not a prototype |
| **Development** | Built in <1 week, orchestrated by Claude AI | Demonstrates AI-augmented development velocity |

### What the Tests Prove

231 tests are not vanity metrics — they verify:
- Encryption/decryption round-trip integrity (AES-256-GCM)
- Complete session lifecycle across all 4 domains
- HKDF key derivation correctness
- Vault CRUD with proper per-case isolation
- Voice command parsing with fuzzy matching
- Component rendering across all 10 UI screens
- E2E user flows from voice capture to intelligence extraction

---

## Competition — Why Nothing Else Exists

| Product | AI | Privacy | Offline | Extraction | Encryption | Verdict |
|---------|-----|---------|---------|------------|------------|---------|
| **ChatGPT / GPT-4** | Cloud LLM | Data sent to OpenAI servers | No | General purpose | No | Disqualified by data sovereignty |
| **Otter.ai** | Cloud STT + summarization | Data sent to Otter servers | No | Meeting notes only | No | Disqualified by data sovereignty |
| **Standard Notes** | None | End-to-end encrypted | Yes | None — just storage | AES-256 | No AI capability |
| **Apple Dictation** | On-device STT only | Apple ecosystem | Partial | None — raw text only | Platform-dependent | No intelligence extraction |
| **Dragon Medical** | Cloud-hybrid | Some on-device | Partial | Medical dictation only | Varies | Single domain, expensive, cloud-dependent |
| **ShadowNotes** | On-device LLM + STT + TTS + VAD + Embeddings | Zero network transmission | Full offline | 4 domains with structured extraction | AES-256-GCM + WebAuthn | **Only complete solution** |

**ShadowNotes occupies a category of one**: the intersection of on-device AI, structured intelligence extraction, military-grade encryption, and zero-network operation. No competitor addresses all four requirements simultaneously.

### Competitive Moat

1. **Architectural guarantee** — Privacy is not a policy; it is enforced by the absence of network calls in the codebase
2. **Multi-domain extraction** — 4 specialized domains with speech error correction, not generic summarization
3. **Complete voice pipeline** — Wake word → VAD → STT → LLM → TTS, all on-device
4. **Semantic intelligence** — RAG context injection and embeddings-based dedup, running locally
5. **Indian roots** — Hindi domain names, DPDPA compliance, designed for India's connectivity reality

---

## In-Browser Vector Intelligence — No Vector DB Required

ShadowNotes implements a complete vector intelligence pipeline running entirely in the browser — no external vector database, no cloud embeddings API, no server:

### The Pipeline

```
Intelligence Item (text)
    ↓
Embeddings.embed() / embedBatch()    ← on-device WASM, cache-aware
    ↓
Float32Array vector                  ← stored in Map<string, Float32Array>
    ↓
Three operations:
    ├── Deduplication     → cosineSimilarity() at 0.85 threshold
    ├── Semantic Search   → findSimilar() with top-K ranking
    └── RAG Retrieval     → buildRAGContext() → injected into LLM prompt
```

### How It Works

| Operation | SDK API | Purpose |
|-----------|---------|---------|
| **Single embed** | `Embeddings.embed(text)` | Convert text to vector, cached in `Map<string, Float32Array>` |
| **Batch embed** | `Embeddings.embedBatch(texts)` | Cache-aware: only uncached texts are sent to WASM, minimising compute |
| **Cosine similarity** | `Embeddings.cosineSimilarity(vecA, vecB)` | Pairwise comparison returning [-1, 1] similarity score |
| **Deduplication** | `deduplicate(items, 0.85)` | First-occurrence-wins: items above threshold are dropped as near-duplicates |
| **Semantic search** | `findSimilar(query, items, topK)` | Ranks all items by cosine similarity to query, returns top-K |
| **RAG context** | `buildRAGContext(transcript, priorItems, topK)` | Retrieves semantically relevant prior findings, formats as context string for LLM system prompt |

### Why This Matters

Traditional RAG requires: Cloud embeddings API (OpenAI, Cohere) → Vector database (Pinecone, Qdrant, Weaviate) → Cloud LLM for generation. ShadowNotes collapses this entire stack into the browser:

- **Embeddings**: On-device via llama.cpp WASM (same model generates text and embeddings)
- **Vector store**: In-memory `Map<string, Float32Array>` with cache-aware batch embedding
- **Similarity search**: Direct `cosineSimilarity()` computation — O(n) scan, sufficient for per-session item counts
- **Generation**: On-device LLM with RAG context injected into system prompt

**Zero infrastructure. Zero API costs. Zero data leaving the device.** The entire retrieval-augmented generation pipeline — from embedding to retrieval to generation — runs in a single browser tab.

### Real Usage in ShadowNotes

1. **During extraction** (`ActiveCapture.tsx`): Every LLM extraction result is passed through `deduplicate()` to remove semantically similar findings
2. **In global search** (`GlobalSearch.tsx`): `findSimilar()` ranks decrypted search results by semantic relevance to the query
3. **For RAG context** (`ActiveCapture.tsx`): `buildRAGContext()` retrieves the top-5 most relevant prior findings and injects them into the LLM system prompt, making each extraction session aware of earlier discoveries

---

## Data Intelligence Pipeline — Voice to Structured Data

ShadowNotes transforms unstructured voice input into structured, queryable intelligence through a multi-stage data pipeline:

```
[1] CAPTURE        Microphone → AudioCapture (16kHz mono PCM)
        ↓
[2] DETECT         VAD.processSamples() → speech activity detection
        ↓
[3] TRANSCRIBE     STT.transcribe() → raw text (or Web Speech API fallback)
        ↓
[4] EXTRACT        TextGeneration.generateStream() → domain-specific structured output
        ↓                  ↓ (fallback)
        ↓           extractIntelligence() → regex keyword matching
        ↓
[5] PARSE          Unified parser: StructuredOutput.extractJson() + line regex
        ↓
[6] DEDUPLICATE    Embeddings.cosineSimilarity() at 0.85 threshold
        ↓
[7] ENRICH         RAG context from prior findings injected into next extraction
        ↓
[8] ENCRYPT        AES-256-GCM with per-case HKDF-derived keys
        ↓
[9] PERSIST        IndexedDB (encrypted blobs) — auto-save every 2s
        ↓
[10] EXPORT        jsPDF → domain-branded PDF (Sanjeevani/Kavach/Nyaaya/Prahari)
```

**Every stage runs on-device.** No network call at any point in the pipeline. This is a complete ETL pipeline — Extract (voice), Transform (AI structuring + dedup), Load (encrypted storage) — running in WebAssembly inside a browser sandbox.

---

## Engineering Quality Metrics

| Metric | Value |
|--------|-------|
| **Source lines of code** | 9,748 across 58 TypeScript files |
| **Test suite** | 231 tests across 18 files, 100% passing |
| **Test execution time** | 5.5 seconds |
| **Production build time** | 7.7 seconds (Vite 7) |
| **Type safety** | TypeScript 5.9 strict mode — zero type errors |
| **PWA precache** | 27 entries for full offline support |
| **Security headers** | COOP, COEP, CSP, HSTS, Referrer-Policy, Permissions-Policy, X-Frame-Options, X-Content-Type-Options |
| **Zero-infrastructure deployment** | Vercel (web) + Electron 35 (desktop) — no servers to provision, monitor, or scale |
| **WASM caching** | OPFS with immutable 1-year cache headers — zero re-download on repeat visits |

### Why Zero Infrastructure Scales

Traditional AI apps require: GPU servers → load balancers → API gateways → monitoring → on-call engineers. ShadowNotes requires: a static file host (Vercel free tier).

- **1 user or 1 million users** — same infrastructure (static files)
- **Zero operational cost** — no compute, no bandwidth for AI inference
- **Zero downtime risk** — no server to crash
- **Global CDN** — Vercel edge network serves static assets worldwide
- **Each user brings their own compute** — the browser IS the server

This is the DevOps endgame: the best infrastructure is no infrastructure.

---

## ThoughtWorks and the RunAnywhere Ecosystem

**ThoughtWorks Technologies** has been instrumental in fostering the ecosystem that makes projects like ShadowNotes possible. The **RunAnywhere SDK** — the backbone of ShadowNotes' AI capabilities — represents a paradigm shift in how AI applications are built:

- **No cloud dependency** — Models run in WebAssembly inside the browser sandbox
- **Cross-platform** — Works identically on Windows, macOS, Linux, Android, and iOS
- **Model-agnostic** — Supports multiple model families (Gemma, Qwen, SmolLM) through a unified API
- **Full pipeline** — LLM text generation, structured output, embeddings, speech-to-text, text-to-speech, and voice activity detection — all through one SDK

This is the kind of infrastructure that enables India's developers to build AI applications that respect data sovereignty, work in low-connectivity environments, and cost nothing to operate at scale.

---

## The Team

**Team Vibe With Singularity** | **dmj.one**

| Member | Role | Institution |
|--------|------|-------------|
| **Divya Mohan** | Team Lead, Architecture, Full-Stack Development, Vision | GGSIPU, Delhi |
| **Kumkum Thakur** | Design, Testing, Documentation, UX | GGSIPU, Delhi |

### Development Orchestration

ShadowNotes was **orchestrated by Claude** (Anthropic's AI) — demonstrating the power of AI-augmented development. The entire application — 231 tests, 20+ SDK integrations, military-grade encryption, 4 domain profiles, PDF export system, Electron desktop, WCAG accessibility — was architected and built in under a week through human-AI collaboration.

This is not AI replacing developers. This is AI empowering developers to build at 10x velocity — exactly the kind of democratization that makes Aatmnirbhar Bharat possible. Two students from GGSIPU Delhi, working with Claude, built what would traditionally require a team of 10+ engineers over months.

### Why This Team

- **Divya Mohan** — Deep expertise in web technologies, security architecture, and AI integration. Creator of dmj.one, a platform dedicated to education and social impact.
- **Kumkum Thakur** — Focus on user experience, testing rigour, and documentation quality that ensures the product is accessible and reliable.
- **Claude (Anthropic)** — AI development partner that enabled rapid iteration across architecture, implementation, testing, and documentation.

Built by humans, orchestrated by AI, built for humans. Built with pride in India. Built for the world.

---

## Revenue Model — Or Lack Thereof

**Built by humans, built for humans, for the spirit of making India an Aatmnirbhar Bharat.**

ShadowNotes is not built to extract revenue — it is built to empower. The architecture itself ensures this:

- **Zero server costs** — There are no servers. All AI runs on the user's device via WebAssembly. There is no cloud infrastructure to bill for.
- **Zero per-query costs** — No API keys, no token billing, no subscriptions. Once the model is downloaded (~100–810 MB depending on selection), every extraction session is free, forever.
- **Zero data monetization** — No user data is collected, transmitted, or stored anywhere except the user's own browser. There is nothing to monetize.
- **Open source (MIT License)** — The entire codebase is freely available for anyone to use, modify, and distribute.

This is a deliberate choice. India's physicians, security professionals, legal practitioners, and incident responders deserve world-class AI tools without being held hostage to cloud subscriptions, data harvesting, or vendor lock-in.

The value ShadowNotes creates is measured not in revenue, but in:
- **Lives protected** through better medical documentation in rural clinics
- **National security strengthened** through air-gapped vulnerability auditing
- **Justice served** through accurate, private deposition records
- **Communities safeguarded** through systematic incident response

This is the Aatmnirbhar model: self-reliant technology that costs nothing to operate, depends on no external service, and serves the people who need it most.

### Future Sustainability Paths (If Needed)

While ShadowNotes is built as a public good, the platform's architecture enables sustainable paths without compromising the core mission:

- **Enterprise customization** — Organizations (hospitals, law firms, government agencies) can commission custom domain profiles, extraction pipelines, and compliance integrations
- **Training & deployment services** — Helping organizations set up air-gapped ShadowNotes instances on their own infrastructure
- **Premium domain packs** — Specialized extraction profiles for niche verticals (radiology, tax law, HAZMAT response) — community edition remains free
- **Government partnerships** — Indian government's Digital India and Aatmnirbhar Bharat initiatives actively fund projects aligned with data sovereignty

The core product will always remain free, open source, and on-device. Revenue, if pursued, comes from services around the product, never from the user's data.

---

## The Ask — What We Need to Scale

ShadowNotes is a working product. To take it from hackathon to India-scale impact:

| Need | Purpose | Impact |
|------|---------|--------|
| **Recognition** | Validation from the RunAnywhere challenge | Credibility for institutional adoption |
| **User testing** | Field trials with real physicians, auditors, lawyers | Domain-specific refinement |
| **Model optimization** | Fine-tuned models for Indian medical/legal terminology | 2-3x better extraction accuracy |
| **Localization** | Hindi, Tamil, Bengali, Marathi STT models | Serve India's linguistic diversity |
| **Institutional partnerships** | Government hospitals, Bar Council, CERT-In | Real-world deployment at scale |

We are not asking for funding. We are asking for the opportunity to serve. The technology is ready. India's professionals are waiting.

---

## Links

| Resource | URL |
|----------|-----|
| Live Demo | [shadownotes.dmj.one](https://shadownotes.dmj.one) |
| Alternate URL | [vibe-with-singularity.vercel.app](https://vibe-with-singularity.vercel.app) |
| GitHub | [github.com/divyamohan1993/shadownotes](https://github.com/divyamohan1993/shadownotes) |
| Demo Video | [YouTube](https://youtube.com/watch?v=qqV9ezvwY6U) |
| Field Manual | [shadownotes.dmj.one/docs/field-manual.html](https://shadownotes.dmj.one/docs/field-manual.html) |

---

*"The best technology is the one that empowers without dependency." — ShadowNotes is technology sovereignty made real.*
