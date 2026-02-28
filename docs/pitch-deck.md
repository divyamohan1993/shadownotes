# ShadowNotes — Pitch

*The Aatmnirbhar pitch.*

---

## Slide 1: Title

**SHADOWNOTES**
*Speak. Extract. Destroy.*

The first on-device AI notebook for air-gapped intelligence work.

- **Team**: Vibe With Singularity (dmj.one)
- **Members**: Divya Mohan & Kumkum Thakur | Shoolini University, Himachal Pradesh
- **Orchestrated by**: Claude (Anthropic)
- **Hackathon**: RunAnywhere Vibe Challenge | ThoughtWorks Technologies
- **Vision**: Atmanirbhar Bharat | #India2047

[shadownotes.dmj.one](https://shadownotes.dmj.one) | [GitHub](https://github.com/divyamohan1993/shadownotes)

---

## Slide 2: Problem

**India's sensitive professionals are locked out of AI.**

- **1.3M+ doctors** dictate patient notes — but cloud AI violates DPDPA 2023
- **300K+ security professionals** document vulnerabilities — but cloud AI leaks findings
- **1.7M+ lawyers** transcribe depositions — but cloud AI breaks attorney-client privilege
- **2.8M+ police/emergency responders** capture incident details — but often have no internet

**The cruel irony**: The professionals who need AI the most are the ones who can't use it. Cloud AI requires internet, costs money per query, and sends data to foreign servers. India's data must stay in India — on the device.

*No existing product solves this. ChatGPT, Otter.ai, Dragon — all require cloud. Standard Notes has no AI. There is a gap.*

---

## Slide 3: Solution

**ShadowNotes: Every byte of AI runs on YOUR device.**

Voice → On-device AI → Structured intelligence → Encrypted vault → Zero trace.

- **Speak** into your microphone — on-device Whisper STT transcribes
- **Watch** as a streaming on-device LLM extracts structured intelligence in real-time
- **Review** findings grouped by category (medications, vulnerabilities, witnesses...)
- **Export** professional PDFs branded with Hindi names (Sanjeevani, Kavach, Nyaaya, Prahari)
- **Destroy** all data with zero trace when done

**Zero cloud. Zero API keys. Zero cost. Zero network transmission. Ever.**

Works offline after first model download. Runs in any browser. Desktop via Electron.

---

## Slide 4: Market Opportunity

**6M+ professionals in India alone. $50B+ global market by 2030.**

| Sector | India Professionals | Global |
|--------|-------------------|--------|
| Healthcare | 1.3M+ doctors (600K+ rural) | 12M+ physicians |
| Cybersecurity | 300K+ professionals | 4M+ practitioners |
| Legal | 1.7M+ advocates | 5M+ lawyers |
| Law Enforcement | 2.8M+ personnel | 15M+ globally |

**ShadowNotes occupies a category of one**: the intersection of on-device AI + structured extraction + military-grade encryption + zero-network operation.

No competitor addresses all four requirements simultaneously.

---

## Slide 5: Why Now

Five forces converge **today**:

1. **WebAssembly maturity** — 1B-parameter LLMs now run at usable speeds in the browser via llama.cpp WASM. Impossible 2 years ago.

2. **Small model revolution** — Gemma 3 1B delivers extraction quality that needed 70B+ models 3 years ago. 50x improvement in intelligence-per-parameter.

3. **DPDPA 2023** — India's data protection law makes cloud AI legally risky for sensitive domains. On-device is the compliant path.

4. **Bengio's call** — Prof. Yoshua Bengio (Turing Award) at the AI Impact Summit: privacy by design, data governance, democratization. ShadowNotes is the answer.

5. **Browser APIs ready** — WebAuthn PRF, OPFS, WebGPU, SharedArrayBuffer — the full stack for encrypted, offline, GPU-accelerated AI apps is finally mature.

---

## Slide 6: Business Model

**Built by humans, built for humans, for the spirit of making India an Aatmnirbhar Bharat.**

**Core product: Free forever. Open source. MIT License.**

- Zero server costs (no servers exist)
- Zero per-query costs (no API keys)
- Zero data monetization (no data collected)

**Sustainability paths (if scaled):**

| Path | Model |
|------|-------|
| Enterprise customization | Custom domain profiles for hospitals, law firms, government |
| Training & deployment | Air-gapped setup for organizations |
| Premium domain packs | Specialized verticals (radiology, tax law, HAZMAT) |
| Government partnerships | Digital India / Aatmnirbhar Bharat funding alignment |

*Revenue comes from services around the product, never from the user's data.*

---

## Slide 7: Traction

**Working product, not a prototype.**

| Proof Point | Detail |
|-------------|--------|
| Live at [shadownotes.dmj.one](https://shadownotes.dmj.one) | Fully functional, publicly accessible |
| 231 tests, 100% passing | 5.5s test execution across 18 test files |
| 9,748 lines of code | 58 source files — TypeScript strict mode, zero type errors |
| 6 on-device AI models | 3 LLMs + Whisper STT + Silero VAD + Piper TTS |
| 20+ SDK features | Deepest RunAnywhere integration across all 3 packages |
| 4 professional domains | Tailored extraction with speech error correction |
| In-browser vector search | Embeddings + cosine similarity + RAG — no vector DB needed |
| Military-grade encryption | AES-256-GCM + HKDF + PBKDF2 + WebAuthn PRF |
| 7.7s production build | Vite 7 + PWA service worker + WASM bundling |
| Zero-infrastructure deployment | Vercel (web) + Electron 35 (desktop) — no servers to manage |
| WCAG 2.2 accessible | 172+ ARIA attributes, full keyboard navigation |
| Built in <1 week | AI-augmented development velocity with Claude |

---

## Slide 8: Competition

**Nobody else does this.**

| | Cloud AI (ChatGPT, Otter) | Encrypted Notes (Standard Notes) | ShadowNotes |
|---|---|---|---|
| **AI extraction** | Yes (cloud) | No | Yes (on-device) |
| **Privacy** | Data sent to servers | End-to-end encrypted | Zero network transmission |
| **Offline** | No | Yes | Yes |
| **Structured extraction** | General purpose | None | 4 specialized domains |
| **Encryption** | No | AES-256 | AES-256-GCM + WebAuthn |
| **Cost** | $20-200/mo | $0-10/mo | Free forever |
| **Data sovereignty** | Foreign servers | User's cloud sync | User's device only |

**Competitive moat:**
1. Privacy is an architectural guarantee, not a policy — zero `fetch()` or `WebSocket` calls in the codebase
2. Complete on-device voice pipeline (wake word → VAD → STT → LLM → TTS)
3. In-browser vector intelligence — `Embeddings.embed()` + `cosineSimilarity()` powers RAG retrieval and semantic dedup at 0.85 cosine threshold — no external vector DB required
4. Two-layer extraction pipeline — streaming LLM with unified parsing cascading to regex fallback, ensuring results at every capability level
5. Indian-first design (Hindi names, DPDPA compliance, rural-ready)

---

## Slide 9: Team

**Team Vibe With Singularity** | **dmj.one**

| Who | Role | Why |
|-----|------|-----|
| **Divya Mohan** | Team Lead, Architecture, Full-Stack | Deep web tech expertise. Creator of dmj.one. Visionary behind the Aatmnirbhar approach. |
| **Kumkum Thakur** | Design, Testing, UX, Documentation | Ensures accessibility, testing rigour, and user experience quality. |
| **Claude (Anthropic)** | AI Development Partner | Orchestrated architecture, implementation, testing, and docs. Enabled 10x development velocity. |

**Why this team wins:**
- Two students from Shoolini University + AI orchestration built what traditionally needs 10+ engineers over months
- This IS the Aatmnirbhar model — Indian talent + AI tools = world-class output
- dmj.one's mission: "Dream Manifest and Journey Together as One"

---

## Slide 10: The Ask

**We are not asking for funding. We are asking for the opportunity to serve.**

| What We Need | Purpose | Impact |
|--------------|---------|--------|
| **Recognition** | RunAnywhere challenge validation | Credibility for institutional adoption |
| **User testing** | Field trials with real doctors, auditors, lawyers | Domain-specific refinement |
| **Model optimization** | Fine-tuned models for Indian terminology | 2-3x better extraction accuracy |
| **Localization** | Hindi, Tamil, Bengali, Marathi STT models | Serve India's 22 official languages |
| **Institutional partnerships** | Government hospitals, Bar Council, CERT-In | Real-world deployment at scale |

**The technology is ready. India's 6M+ professionals are waiting.**

*ShadowNotes: Because some notes should never exist anywhere but your memory — and some technology should never depend on anyone but your own device.*

**Built by humans. Orchestrated by Claude. Built for humans. Aatmnirbhar Bharat. #India2047**

---

*Pitch structure follows Guy Kawasaki's 10/20/30 rule: 10 slides, 20 minutes, 30-point font.*
*Full vision document: [vision-india2047.md](vision-india2047.md)*
