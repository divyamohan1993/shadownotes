# Multi-Case Vault with Encryption & Voice Navigation

**Date**: 2026-02-26
**Status**: Approved

## Problem

ShadowNotes is currently ephemeral — all session data dies when the tab closes. Users need to:
- Manage multiple cases per category (e.g., multiple patients in Medical)
- Record multiple sessions per case over time (visit history)
- Navigate and manage cases via voice commands
- Keep data encrypted at rest on the local machine
- Handle storage limits gracefully with FIFO rotation

## Architecture

```
Windows Hello (WebAuthn PRF) → AES-256-GCM master key
    → per-case sub-keys via HKDF
    → IndexedDB encrypted storage
    → Voice commands ("Hey Shadow ...") + Touch UI
    → Existing capture/extraction pipeline (unchanged)
```

## Data Model

### IndexedDB: `shadownotes-vault`

**cases** store:
- `id`: UUID v4
- `domainId`: "security" | "legal" | "medical" | "incident"
- `name`: string (unencrypted — searchable by voice/UI)
- `shortId`: auto-generated, domain-prefixed (MC-001, SA-003, LD-001, IR-001)
- `createdAt`, `updatedAt`: timestamps (unencrypted)
- Indexes: [domainId], [shortId], [name], [updatedAt]

**sessions** store:
- `id`: UUID v4
- `caseId`: FK → cases.id
- `caseNumber`: "SN-YYMMDD-XXXX" (existing format)
- `createdAt`, `duration`, `segmentCount`, `findingCount`: unencrypted metadata
- `sizeBytes`: for rotation tracking
- `encrypted`: ArrayBuffer — AES-256-GCM encrypted JSON of transcripts + intelligence items
- Indexes: [caseId], [createdAt]

**vault_meta** store:
- Key-value pairs: credential_id, total_size, max_size, rotation_threshold

### What's Encrypted vs Unencrypted

| Field | Encrypted? | Why |
|---|---|---|
| Case name, shortId | No | Needed for voice search, UI listing |
| Case domainId, timestamps | No | Needed for filtering, sorting |
| Session transcripts | Yes | Sensitive content |
| Session intelligence items | Yes | Sensitive extracted data |
| Session metadata (duration, counts) | No | Needed for UI display without decryption |

## Encryption Architecture

### WebAuthn PRF Extension

**Registration (first launch)**:
1. `navigator.credentials.create()` with PRF extension
2. Relying Party ID: `shadownotes.dmj.one` (stable, unique, never changes)
3. Authenticator: `platform` (Windows Hello — face/fingerprint/PIN)
4. PRF output (32 bytes) → HKDF → AES-256-GCM master key
5. Credential ID stored in vault_meta (public identifier, not sensitive)
6. Master key held in memory only — never persisted

**Authentication (subsequent launches)**:
1. Read credential ID from vault_meta
2. `navigator.credentials.get()` with PRF + same salt
3. Windows Hello prompt → same PRF output → same master key

**Per-case encryption**:
- Master key + case UUID → HKDF → case-specific AES-256-GCM key
- Each session: case key + random 12-byte IV → encrypted payload
- 16-byte auth tag for integrity verification

**Fallback**: Passphrase-based (PBKDF2, 600K iterations) for browsers without WebAuthn PRF.

**Destroying data**: Clear all IndexedDB stores + credential ID. WebAuthn credential in Windows Hello becomes orphaned (harmless).

## Screen Flow

```
Boot → Windows Hello unlock
  ↓
Domain Selection (existing SessionInit, modified)
  ↓
Case List (NEW)
  ├── [+ New Case] → name input → create
  ├── [Case Card] → Case Detail (NEW)
  │     ├── Session History (timeline of past sessions)
  │     │   └── [Session] → Session Review (read-only dossier)
  │     ├── [New Session] → Active Capture (existing, saves to case)
  │     ├── [Delete Case] → confirm → delete
  │     └── [Back] → Case List
  └── [Back] → Domain Selection

Active Capture (modified)
  ├── Recording works exactly as today
  ├── "END SESSION" → encrypt + save to IndexedDB → Session Review
  └── "DISCARD" → back to Case Detail

Session Review (modified from SessionSummary)
  ├── Read-only view of saved session
  ├── Inline editing (saves back encrypted)
  └── [Back] → Case Detail
```

## Voice Command System

### Wake Prefix: "Hey Shadow"

All commands prefixed with "Hey Shadow" to distinguish from dictation.

### Command Table

| Voice Input | Action | Available On |
|---|---|---|
| hey shadow create case [name] | Create new case in current domain | Case List |
| hey shadow open case [name/ID] | Navigate to case (fuzzy match) | Case List |
| hey shadow delete case [name/ID] | Delete case (requires "confirm delete") | Case List, Case Detail |
| hey shadow show history | Show session history | Case Detail |
| hey shadow open session [N] | Open Nth most recent session | Case Detail |
| hey shadow last update | Open most recent session | Case Detail |
| hey shadow new session | Start recording | Case Detail |
| hey shadow go back | Navigate back | All screens |
| hey shadow list cases | Read out case names | Case List |
| hey shadow save | Save current session | Active Capture |
| hey shadow discard | Discard current session | Active Capture |

### Implementation Details
- **Parser**: Regex-based, extracts command verb + arguments
- **Fuzzy matching**: Levenshtein distance for name matching (handles speech errors)
- **Feedback**: Visual toast showing recognized command + audio beep
- **Help**: "?" icon per screen shows context-relevant commands
- **Activation**: During capture (mic already active) or via dedicated Voice Command button on other screens

## Storage Rotation

### Budget
- Default: 50MB, configurable up to 200MB in settings

### Warning Thresholds

| Usage | Behavior |
|---|---|
| < 75% | Normal, no warnings |
| 75-90% | Yellow banner: "Storage: X/Y MB used" |
| 90-99% | Red banner: "Oldest sessions will auto-rotate after limit" |
| ≥ 100% | FIFO: delete oldest sessions until < 95% of limit |

### Rotation Rules
1. Query sessions by createdAt ASC
2. Delete oldest, subtract sizeBytes from total
3. Repeat until under 95% threshold
4. Empty cases remain (user can see they existed)
5. Never delete a session currently being recorded

### User Controls
- Manual delete: individual sessions or entire cases
- Storage dashboard in settings: total used, limit, breakdown by domain

## Migration Strategy

Existing ephemeral flow is preserved — the capture and extraction pipeline is unchanged. New screens wrap around the existing components. No breaking changes to current functionality.

## Testing Strategy

- Unit tests: encryption/decryption, IndexedDB CRUD, voice command parser, storage rotation
- Component tests: new screens (CaseList, CaseDetail), modified screens
- Integration tests: full flow — create case → record → save → reopen → verify decrypted content
- Existing 163 tests remain passing
