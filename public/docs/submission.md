# ShadowNotes - Hackathon Submission Answers

## What did you build?

ShadowNotes is a Zero-Trust Investigator's Notebook that runs 100% on-device AI in the browser. It captures voice via microphone, transcribes speech to text using Whisper, and uses an on-device LLM (LFM2 350M) to extract structured intelligence — all without a single network request after initial model download. The app supports 4 professional domains: Security Audit, Legal Deposition, Medical Notes, and Incident Report. Each domain has a tailored AI extraction pipeline that categorizes findings (e.g., vulnerabilities, timelines, evidence). All session data lives exclusively in browser memory — when you close the tab or click DESTROY SESSION, everything is permanently wiped. Zero persistence, zero trace. The entire UI is themed as a classified intelligence dossier with authentic declassified-document aesthetics, boot sequences, case numbers, clearance levels, and a cinematic burn-destroy animation.

## The on-device AI use case your app demonstrates

ShadowNotes demonstrates all four pillars of on-device AI:

**Privacy:** ShadowNotes handles extremely sensitive information — security vulnerabilities, legal depositions, medical records, incident reports. This data must never leave the device. By running VAD, STT, and LLM entirely in the browser via WebAssembly, we guarantee zero data exfiltration. No API keys, no server endpoints, no telemetry. The app can be verified network-silent using browser DevTools Network tab after model download.

**Zero Cost Overhead:** After the one-time ~360MB model download (cached in the browser's private OPFS filesystem), every subsequent session costs nothing. No per-token API fees, no cloud compute charges, no subscription required. This makes ShadowNotes viable for resource-constrained organizations — small law firms, independent security auditors, field medics — who cannot afford cloud AI pricing at scale.

**Low Latency:** Speech segments are transcribed and analyzed instantly on-device. There is no round-trip to a remote server. VAD detects speech end within milliseconds, Whisper transcribes in under a second, and the LLM extracts intelligence in 1-2 seconds — all happening locally. The entire pipeline runs with sub-3-second end-to-end latency.

**No Internet Requirement:** After models are downloaded once, ShadowNotes works completely offline. This is critical for the app's target users: security auditors in air-gapped facilities, field investigators without connectivity, medical professionals in remote locations, and anyone operating in environments where network access is restricted or compromised.

## Link to GitHub Repo

https://github.com/divyamohan1993/shadownotes.git

## Link to Demo Video

<!-- Replace with actual YouTube URL after recording -->
https://youtube.com/watch?v=REPLACE_WITH_ACTUAL_VIDEO_ID

## Project Description

ShadowNotes solves a critical problem: professionals handling sensitive information (security audits, legal proceedings, medical documentation, incident response) need AI-powered note-taking but cannot risk sending data to cloud servers. Existing tools force a choice between AI capabilities and data privacy. ShadowNotes eliminates this trade-off by running three AI models entirely on-device via the RunAnywhere Web SDK: Silero VAD v5 for voice activity detection, Whisper Tiny English for speech-to-text transcription, and LFM2 350M for intelligent extraction. The app's data pipeline flows from microphone to VAD to STT to LLM without any network involvement. All data exists only in React state (JavaScript heap memory) with zero persistence — no localStorage, no IndexedDB, no cookies. Closing the tab permanently destroys all data. Target users include security auditors conducting penetration test debriefs, attorneys transcribing depositions, physicians dictating clinical notes, and incident responders documenting events in real-time. The classified dossier UI theme reinforces the security-first identity with case numbers, clearance levels, declassified-document typography, and a dramatic session destruction animation.
