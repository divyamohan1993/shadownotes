# ShadowNotes — Project Guide

## What Is This

ShadowNotes is an offline-first, encrypted field intelligence app. Voice → on-device AI → structured intelligence items. Zero network transmission of user data. Built for the RunAnywhere Vibe Challenge hackathon.

**Team:** Vibe With Singularity (Divya Mohan, Kumkum Thakur) — GGSIPU, Delhi

## Quick Reference

| What | Details |
|------|---------|
| Stack | React 19 + TypeScript 5.9 + Vite 7 |
| AI | RunAnywhere SDK — Gemma 3 LLM, Whisper STT, Piper TTS, Silero VAD (all on-device WASM) |
| Security | AES-256-GCM per-case, WebAuthn PRF vault unlock |
| Storage | IndexedDB (50 MB quota) + OPFS (model cache) |
| Deploy | Vercel (web), Electron 35 (desktop) |
| Tests | 231 tests via Vitest — all passing |
| Live URL | https://shadownotes.dmj.one / https://vibe-with-singularity.vercel.app |
| Repo | https://github.com/divyamohan1993/shadownotes.git |

## Commands

```bash
npm install              # Install deps (uses legacy-peer-deps via .npmrc)
npm run dev              # Vite dev server on localhost:5173
npm run build            # TypeScript check + Vite production build → dist/
npm run test             # Run all 231 tests once
npm run test:watch       # Tests in watch mode
npm run test:coverage    # Coverage report
npm run electron:dev     # Electron dev mode
npm run electron:build   # Build Electron distribution
```

## Project Structure

```
src/
├── App.tsx               # Main app — screen navigation via useState
├── VaultContext.tsx       # React context: vault ops, encryption keys, auth state
├── vault.ts              # VaultDB: IndexedDB wrapper for cases/sessions
├── crypto.ts             # AES-256-GCM, HKDF, PBKDF2, WebAuthn PRF
├── auth.ts               # WebAuthn credential registration/authentication
├── runanywhere.ts        # RunAnywhere SDK setup, model registry, GPU recovery
├── domains.ts            # 4 domain profiles (security, legal, medical, incident)
├── extraction.ts         # Regex fallback extraction rules
├── voiceCommands.ts      # "Hey shadow" wake word + command parser
├── components/           # UI screens (VaultUnlock, SessionInit, CaseList, ActiveCapture, etc.)
├── hooks/                # useAutoSave, useModelLoader, useAudioPipeline, useTTS, useEmbeddings
├── __tests__/            # 231 unit + integration tests + mocks
└── styles/index.css      # Global stylesheet

electron/                 # Electron main + preload
public/docs/              # Field manual (static HTML) — mirrors docs/ at root
vercel.json               # Security headers, COEP/CSP, WASM caching
```

## Architecture

**State:** React Context (VaultContext) for vault/auth. Component local state for UI screens. No router — screen state enum.

**Data flow:** Auth → Domain selection → Case management → Voice capture → STT → LLM extraction → Auto-save (200ms immediate + 2s debounced) → Encrypted IndexedDB.

**Encryption:** Master key from WebAuthn PRF or passphrase (PBKDF2). Per-case keys via HKDF. AES-256-GCM authenticated encryption.

**Voice:** Wake word "hey shadow". STT via Whisper Tiny. VAD via Silero. TTS via Piper (Amy voice). LLM corrects speech recognition errors.

**Intelligence items:** Have `id`, `category`, `content`, `timestamp`. Editable inline (click to edit, X to delete).

## Important Conventions

- `public/docs/` mirrors `docs/` — keep both in sync when docs change
- `vercel.json` uses `unsafe-none` COEP on `/docs/(.*)` for YouTube embeds
- `tsconfig.json` excludes `src/__tests__` from production build
- LLM calls serialized via mutex ref to prevent KV cache crash
- System prompts instruct LLM to correct speech recognition errors
- Case numbers format: `SN-YYMMDD-XXXX`
- Storage rotation: auto-delete oldest sessions at 90%+ of 50 MB quota

## Deployment

**Vercel (primary):** `npx vercel --yes --prod` after every push. Security headers in `vercel.json`. WASM assets cached 1 year.

**Electron:** Local HTTP server for WebAuthn localhost requirement. GPU flags enabled. Packages via electron-builder.

## Testing

All 231 tests must pass before any push. Run `npm run test` to verify. Tests use jsdom + fake-indexeddb. Mocks for RunAnywhere packages live in `src/__tests__/__mocks__/`.

## Keyboard Shortcuts

- `Ctrl+F` — Global search
- `Ctrl+N` — New session (from case-detail)
- `Ctrl+S` — Save session (from capture)
- `?` — Toggle keyboard help overlay
