# ShadowNotes - Hackathon Submission Answers

## What did you build?

ShadowNotes is a Zero-Trust Investigator's Notebook that combines browser-native speech recognition with on-device AI intelligence extraction. It captures voice via the Web Speech API for fast, lightweight transcription, then uses the RunAnywhere Web SDK to run an on-device LLM (Qwen2.5 0.5B Instruct via llama.cpp WASM) for structured intelligence extraction — with a keyword-based fallback that works instantly on any device. The app supports 4 professional domains: Security Audit, Legal Deposition, Medical Notes, and Incident Report. Each domain has a tailored AI extraction pipeline that categorizes findings (e.g., vulnerabilities, timelines, evidence). All session data lives exclusively in browser memory — when you close the tab or click DESTROY SESSION, everything is permanently wiped. Zero persistence, zero trace. The entire UI is themed as a classified intelligence dossier with authentic declassified-document aesthetics, boot sequences, case numbers, clearance levels, and a cinematic burn-destroy animation.

## The on-device AI use case your app demonstrates

ShadowNotes demonstrates the key pillars of on-device AI:

**Privacy:** ShadowNotes handles extremely sensitive information — security vulnerabilities, legal depositions, medical records, incident reports. The intelligence extraction (the most sensitive processing step) runs entirely on-device via the RunAnywhere LLM in WebAssembly. No API keys, no server endpoints, no telemetry. Speech transcription uses the browser's built-in Web Speech API for reliability and low memory usage, while all AI analysis happens locally through the Qwen2.5 0.5B Instruct model.

**Zero Cost Overhead:** After the one-time ~400MB LLM model download (cached in the browser's private OPFS filesystem), every intelligence extraction session costs nothing. No per-token API fees, no cloud compute charges, no subscription required. This makes ShadowNotes viable for resource-constrained organizations — small law firms, independent security auditors, field medics — who cannot afford cloud AI pricing at scale.

**Low Latency:** The hybrid architecture delivers the best of both worlds. Web Speech API provides near-instant transcription with zero model download required. The on-device LLM extracts structured intelligence in 1-2 seconds. Before the LLM finishes loading, keyword-based extraction provides immediate results with zero latency. The entire pipeline is designed to start working instantly and improve as the LLM becomes available.

**On-Device Intelligence:** The RunAnywhere SDK powers the Qwen2.5 0.5B Instruct language model running in llama.cpp WASM. This model processes transcript text and extracts structured intelligence items categorized by domain (vulnerabilities, symptoms, key statements, etc.). The LLM runs entirely in the browser sandbox with no server communication, ensuring that the AI analysis of sensitive content never leaves the device.

## Link to GitHub Repo

https://github.com/divyamohan1993/shadownotes.git

## Link to Demo Video

https://youtube.com/watch?v=qqV9ezvwY6U

## Project Description

ShadowNotes solves a critical problem: professionals handling sensitive information (security audits, legal proceedings, medical documentation, incident response) need AI-powered note-taking but cannot risk sending their data analysis to cloud servers. The app uses a hybrid architecture: the browser's Web Speech API handles speech-to-text transcription (fast, zero memory, works on any device), while the RunAnywhere Web SDK runs Qwen2.5 0.5B Instruct on-device via llama.cpp WASM for intelligent extraction. A keyword-based extraction engine provides instant fallback when the LLM is still loading or unavailable. The app's data pipeline flows from microphone through the Web Speech API to transcript text, then through the on-device LLM for structured intelligence extraction. All session data exists only in React state (JavaScript heap memory) with zero persistence — no localStorage, no IndexedDB, no cookies. Closing the tab permanently destroys all data. Target users include security auditors conducting penetration test debriefs, attorneys transcribing depositions, physicians dictating clinical notes, and incident responders documenting events in real-time. The classified dossier UI theme reinforces the security-first identity with case numbers, clearance levels, declassified-document typography, and a dramatic session destruction animation.
