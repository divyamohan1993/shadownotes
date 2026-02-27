# ShadowNotes - Hackathon Submission Answers

## What did you build?

ShadowNotes is a Zero-Trust Investigator's Notebook — the first on-device AI notebook purpose-built for air-gapped intelligence work. It combines browser-native speech recognition with a streaming on-device LLM to capture voice and extract structured intelligence in real-time, entirely within the browser via WebAssembly.

The app deeply integrates the RunAnywhere Web SDK's LLM pipeline (`@runanywhere/web`, `@runanywhere/web-llamacpp`) — focusing on streaming generation, structured output, and intelligent model lifecycle management:

- **Streaming LLM extraction** via `TextGeneration.generateStream()` — the crown jewel. Tokens appear in real-time as the Qwen2.5 0.5B Instruct model processes transcripts through llama.cpp WASM, with domain-specific system prompts that correct speech recognition errors
- **Structured Output validation** via `StructuredOutput.extractJson()` — JSON schema-aware parsing ensures reliable extraction format when the LLM returns structured JSON
- **Model lifecycle management** via `ModelManager` + `EventBus` + `OPFSStorage` — OPFS caching (~400MB persisted across sessions), real-time download progress tracking, and model registration with the LlamaCPP framework
- **GPU-aware initialization** via `RunAnywhere.initialize()` — WebGPU detection with crash recovery and automatic CPU fallback, ensuring the LLM runs on any hardware
- **Advanced sampling control** — `topK: 40`, `topP: 0.9`, `temperature: 0.3`, `stopSequences` for factual extraction with early termination at extraction boundaries

The app supports 4 professional domains (Security Audit, Legal Deposition, Medical Notes, Incident Report), each with domain-specific system prompts that include speech-to-text error correction (e.g., "sequel injection" → SQL injection, "hay BS corpus" → habeas corpus). A keyword-based regex extraction engine provides instant fallback while the LLM loads.

All session data is encrypted with AES-256-GCM using per-case HKDF-derived keys. WebAuthn biometric authentication (Windows Hello / Touch ID) with PRF extension derives the master key material. The classified dossier UI features authentic declassified-document aesthetics with stamps, CRT effects, and a cinematic burn-destroy animation.

## The on-device AI use case your app demonstrates

ShadowNotes demonstrates the full spectrum of on-device AI capabilities through deep RunAnywhere SDK integration:

**Privacy:** ShadowNotes handles extremely sensitive information — security vulnerabilities, legal depositions, medical records, incident reports. The intelligence extraction runs entirely on-device via RunAnywhere's llama.cpp WASM backend. No API keys, no server endpoints, no telemetry. The streaming extraction pipeline (`TextGeneration.generateStream()`) processes tokens locally with real-time UI feedback — proving that on-device AI can match the streaming UX of cloud services.

**Zero Cost Overhead:** After the one-time ~455MB model download (cached in OPFS via `ModelManager`), every extraction session costs nothing. No per-token API fees, no subscriptions. This makes ShadowNotes viable for resource-constrained organizations — small law firms, independent auditors, field medics.

**Low Latency:** The hybrid architecture delivers instant results. Web Speech API provides near-instant transcription with zero model download. The streaming LLM delivers tokens in real-time (no waiting for full generation). Before the LLM finishes loading, keyword extraction provides instant results with zero latency. GPU acceleration detection (WebGPU with crash recovery) maximizes inference speed.

**SDK Depth:** Rather than shallow integration across many features, ShadowNotes goes deep on the features that matter. `TextGeneration.generateStream()` is the core extraction engine with real-time token streaming to the UI. `StructuredOutput.extractJson()` provides JSON validation fallback. `ModelManager`, `EventBus`, and `OPFSStorage` handle the full model lifecycle — download, cache, and re-use across sessions. `RunAnywhere.initialize()` with LlamaCPP framework registration handles GPU detection with crash recovery. Advanced sampling parameters (`topK`, `topP`, `temperature`, `stopSequences`) give fine-grained control over the generation process. Depth over breadth — every SDK feature we use is genuinely load-bearing in the extraction pipeline.

## Link to GitHub Repo

https://github.com/divyamohan1993/shadownotes.git

## Link to Demo Video

https://youtube.com/watch?v=qqV9ezvwY6U

## Project Description

ShadowNotes solves a problem no existing tool addresses: professionals handling classified, HIPAA-protected, or legally privileged information need AI-powered intelligence extraction but cannot transmit their data to any external service. Cloud AI tools (ChatGPT, Otter.ai) are disqualified by data sovereignty requirements. Encrypted note apps (Standard Notes) lack AI capabilities. ShadowNotes is the first tool that combines streaming on-device AI extraction with zero-network operation.

The app uses the RunAnywhere Web SDK to run Qwen2.5 0.5B Instruct on-device via llama.cpp WASM, with streaming token output (`generateStream`), structured output validation, and intelligent model lifecycle management via ModelManager with OPFS caching. A keyword-based fallback engine ensures instant results on any device. 4 domain profiles (Security, Legal, Medical, Incident) provide tailored extraction with speech error correction. All data is encrypted with AES-256-GCM and authenticated via WebAuthn biometrics. Target users include security auditors, attorneys, physicians, and incident responders operating in environments where data sovereignty is non-negotiable.
