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

## ThoughtWorks and the RunAnywhere Ecosystem

**ThoughtWorks Technologies** has been instrumental in fostering the ecosystem that makes projects like ShadowNotes possible. The **RunAnywhere SDK** — the backbone of ShadowNotes' AI capabilities — represents a paradigm shift in how AI applications are built:

- **No cloud dependency** — Models run in WebAssembly inside the browser sandbox
- **Cross-platform** — Works identically on Windows, macOS, Linux, Android, and iOS
- **Model-agnostic** — Supports multiple model families (Gemma, Qwen, SmolLM) through a unified API
- **Full pipeline** — LLM text generation, structured output, embeddings, speech-to-text, text-to-speech, and voice activity detection — all through one SDK

This is the kind of infrastructure that enables India's developers to build AI applications that respect data sovereignty, work in low-connectivity environments, and cost nothing to operate at scale.

---

## The Team

**Team Vibe With Singularity**

| Member | Role | Institution |
|--------|------|-------------|
| **Divya Mohan** | Team Lead, Architecture, Full-Stack Development | GGSIPU, Delhi |
| **Kumkum Thakur** | Design, Testing, Documentation | GGSIPU, Delhi |

Built with pride in India. Built for the world.

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
