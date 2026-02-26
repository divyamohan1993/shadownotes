# Multi-Case Vault Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ShadowNotes from ephemeral single-session to persistent, encrypted, multi-case management with voice navigation.

**Architecture:** IndexedDB stores cases and sessions with AES-256-GCM encryption. WebAuthn PRF (Windows Hello) derives the master key. Per-case sub-keys via HKDF. Voice commands via "Hey Shadow" wake prefix with regex parser and Levenshtein fuzzy matching. FIFO rotation at configurable MB limit.

**Tech Stack:** React 19, TypeScript, Web Crypto API (AES-256-GCM, HKDF, PBKDF2), WebAuthn PRF extension, IndexedDB, Web Speech API.

**Design Doc:** `docs/plans/2026-02-26-multi-case-vault-design.md`

---

## Phase 1: Types & Data Layer Foundation

### Task 1: Extend TypeScript types

**Files:**
- Modify: `src/types.ts`

**Step 1: Write the failing test**

Create `src/__tests__/vault-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { VaultCase, VaultSession, VaultMeta, AppScreen } from '../types';

describe('Vault types', () => {
  it('VaultCase has required fields', () => {
    const c: VaultCase = {
      id: crypto.randomUUID(),
      domainId: 'medical',
      name: 'John Doe',
      shortId: 'MC-001',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(c.domainId).toBe('medical');
    expect(c.shortId).toMatch(/^[A-Z]{2}-\d{3}$/);
  });

  it('VaultSession has required fields', () => {
    const s: VaultSession = {
      id: crypto.randomUUID(),
      caseId: crypto.randomUUID(),
      caseNumber: 'SN-260226-ABC1',
      createdAt: Date.now(),
      duration: 120,
      segmentCount: 5,
      findingCount: 3,
      sizeBytes: 1024,
      encrypted: new ArrayBuffer(0),
    };
    expect(s.duration).toBe(120);
  });

  it('AppScreen includes new vault screens', () => {
    const screens: AppScreen[] = ['init', 'unlock', 'cases', 'case-detail', 'capture', 'summary'];
    expect(screens).toHaveLength(6);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/vault-types.test.ts`
Expected: FAIL — `VaultCase`, `VaultSession` not exported from types.ts

**Step 3: Write the types**

Add to `src/types.ts`:

```typescript
export interface VaultCase {
  id: string;
  domainId: DomainId;
  name: string;
  shortId: string;
  createdAt: number;
  updatedAt: number;
}

export interface VaultSession {
  id: string;
  caseId: string;
  caseNumber: string;
  createdAt: number;
  duration: number;
  segmentCount: number;
  findingCount: number;
  sizeBytes: number;
  encrypted: ArrayBuffer;
}

export interface VaultMeta {
  key: string;
  value: string | number;
}

// Session content that gets encrypted
export interface SessionContent {
  transcripts: TranscriptEntry[];
  intelligence: IntelligenceItem[];
}
```

Update `AppScreen`:

```typescript
export type AppScreen = 'init' | 'unlock' | 'cases' | 'case-detail' | 'capture' | 'summary';
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/vault-types.test.ts`
Expected: PASS

**Step 5: Run all existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All 163+ tests PASS

**Step 6: Commit**

```bash
git add src/types.ts src/__tests__/vault-types.test.ts
git commit -m "feat: add vault types for cases, sessions, and new screen states"
```

---

### Task 2: Crypto module — encryption and decryption

**Files:**
- Create: `src/crypto.ts`
- Create: `src/__tests__/crypto.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { deriveKeyFromBytes, deriveCaseKey, encryptContent, decryptContent } from '../crypto';

describe('crypto', () => {
  const mockKeyMaterial = new Uint8Array(32); // all zeros for testing
  crypto.getRandomValues(mockKeyMaterial);

  it('deriveKeyFromBytes produces a CryptoKey', async () => {
    const key = await deriveKeyFromBytes(mockKeyMaterial);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('deriveCaseKey produces a different key per caseId', async () => {
    const master = await deriveKeyFromBytes(mockKeyMaterial);
    const key1 = await deriveCaseKey(master, 'case-aaa');
    const key2 = await deriveCaseKey(master, 'case-bbb');
    // Export raw to compare
    const raw1 = await crypto.subtle.exportKey('raw', key1);
    const raw2 = await crypto.subtle.exportKey('raw', key2);
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
  });

  it('encrypt then decrypt round-trips', async () => {
    const master = await deriveKeyFromBytes(mockKeyMaterial);
    const caseKey = await deriveCaseKey(master, 'test-case');
    const original = { transcripts: [{ text: 'hello', timestamp: '12:00:00' }], intelligence: [] };
    const encrypted = await encryptContent(caseKey, original);
    expect(encrypted).toBeInstanceOf(ArrayBuffer);
    expect(encrypted.byteLength).toBeGreaterThan(0);
    const decrypted = await decryptContent(caseKey, encrypted);
    expect(decrypted).toEqual(original);
  });

  it('decrypt with wrong key throws', async () => {
    const master = await deriveKeyFromBytes(mockKeyMaterial);
    const key1 = await deriveCaseKey(master, 'case-1');
    const key2 = await deriveCaseKey(master, 'case-2');
    const encrypted = await encryptContent(key1, { transcripts: [], intelligence: [] });
    await expect(decryptContent(key2, encrypted)).rejects.toThrow();
  });

  it('encrypted output differs even for same input (random IV)', async () => {
    const master = await deriveKeyFromBytes(mockKeyMaterial);
    const caseKey = await deriveCaseKey(master, 'test');
    const data = { transcripts: [], intelligence: [] };
    const enc1 = await encryptContent(caseKey, data);
    const enc2 = await encryptContent(caseKey, data);
    expect(new Uint8Array(enc1)).not.toEqual(new Uint8Array(enc2));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/crypto.test.ts`
Expected: FAIL — module not found

**Step 3: Write the crypto module**

```typescript
// src/crypto.ts
import type { SessionContent } from './types';

const SALT = new TextEncoder().encode('shadownotes-vault-v1');

// Derive a master AES-256-GCM key from raw key material (PRF output or PBKDF2 result)
export async function deriveKeyFromBytes(keyMaterial: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', keyMaterial, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode('master') },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true, // exportable so we can derive sub-keys
    ['encrypt', 'decrypt'],
  );
}

// Derive a case-specific key from the master key + caseId
export async function deriveCaseKey(masterKey: CryptoKey, caseId: string): Promise<CryptoKey> {
  const rawMaster = await crypto.subtle.exportKey('raw', masterKey);
  const baseKey = await crypto.subtle.importKey('raw', rawMaster, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode(`case:${caseId}`) },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// Encrypt SessionContent → ArrayBuffer (IV prepended)
export async function encryptContent(key: CryptoKey, content: SessionContent): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(content));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  // Prepend IV (12 bytes) to ciphertext
  const result = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.byteLength);
  return result.buffer;
}

// Decrypt ArrayBuffer → SessionContent
export async function decryptContent(key: CryptoKey, data: ArrayBuffer): Promise<SessionContent> {
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// Derive key from passphrase (fallback when WebAuthn PRF unavailable)
export async function deriveKeyFromPassphrase(passphrase: string): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: 600_000 },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  return aesKey;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/crypto.test.ts`
Expected: All 5 PASS

**Step 5: Commit**

```bash
git add src/crypto.ts src/__tests__/crypto.test.ts
git commit -m "feat: add AES-256-GCM crypto module with HKDF key derivation"
```

---

### Task 3: WebAuthn PRF authentication module

**Files:**
- Create: `src/auth.ts`
- Create: `src/__tests__/auth.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkPRFSupport, isPRFSupported } from '../auth';

// WebAuthn is browser-only, so we test the support-check logic and the API shape
describe('auth', () => {
  it('exports checkPRFSupport function', () => {
    expect(typeof checkPRFSupport).toBe('function');
  });

  it('isPRFSupported returns false when navigator.credentials is undefined', async () => {
    // jsdom has no WebAuthn
    const result = await isPRFSupported();
    expect(result).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/auth.test.ts`
Expected: FAIL — module not found

**Step 3: Write the auth module**

```typescript
// src/auth.ts

const RP_ID = 'shadownotes.dmj.one';
const RP_NAME = 'ShadowNotes';
// Deterministic user ID derived from app name (won't change)
const USER_ID = new TextEncoder().encode('shadownotes-vault-user-v1');
const PRF_SALT = new TextEncoder().encode('shadownotes-prf-salt-v1');

export async function isPRFSupported(): Promise<boolean> {
  try {
    if (!navigator.credentials || !window.PublicKeyCredential) return false;
    // Check platform authenticator availability
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function checkPRFSupport(): Promise<boolean> {
  return isPRFSupported();
}

// Register a new WebAuthn credential with PRF extension — returns credential ID + key material
export async function registerCredential(): Promise<{ credentialId: string; keyMaterial: Uint8Array }> {
  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: RP_ID },
      user: {
        id: USER_ID,
        name: 'ShadowNotes User',
        displayName: 'ShadowNotes User',
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      extensions: {
        prf: { eval: { first: PRF_SALT } },
      } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential;

  const prfResults = (credential.getClientExtensionResults() as any).prf;
  if (!prfResults?.results?.first) {
    throw new Error('PRF_NOT_SUPPORTED');
  }

  const credentialId = bufferToBase64(credential.rawId);
  const keyMaterial = new Uint8Array(prfResults.results.first);
  return { credentialId, keyMaterial };
}

// Authenticate with existing credential — returns key material
export async function authenticateCredential(credentialId: string): Promise<Uint8Array> {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: RP_ID,
      allowCredentials: [{
        id: base64ToBuffer(credentialId),
        type: 'public-key',
        transports: ['internal'],
      }],
      userVerification: 'required',
      extensions: {
        prf: { eval: { first: PRF_SALT } },
      } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential;

  const prfResults = (credential.getClientExtensionResults() as any).prf;
  if (!prfResults?.results?.first) {
    throw new Error('PRF_AUTH_FAILED');
  }
  return new Uint8Array(prfResults.results.first);
}

// Helpers
function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/auth.test.ts`
Expected: All 2 PASS

**Step 5: Commit**

```bash
git add src/auth.ts src/__tests__/auth.test.ts
git commit -m "feat: add WebAuthn PRF authentication module for Windows Hello"
```

---

### Task 4: IndexedDB vault database

**Files:**
- Create: `src/vault.ts`
- Create: `src/__tests__/vault.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/vault.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { VaultDB } from '../vault';

// Use fake-indexeddb for testing
import 'fake-indexeddb/auto';

describe('VaultDB', () => {
  let db: VaultDB;

  beforeEach(async () => {
    // Each test gets a fresh DB
    db = new VaultDB(`test-vault-${crypto.randomUUID()}`);
    await db.open();
  });

  describe('cases', () => {
    it('creates and retrieves a case', async () => {
      const id = await db.createCase({ domainId: 'medical', name: 'John Doe' });
      const c = await db.getCase(id);
      expect(c).toBeDefined();
      expect(c!.name).toBe('John Doe');
      expect(c!.domainId).toBe('medical');
      expect(c!.shortId).toMatch(/^MC-\d{3}$/);
    });

    it('generates sequential shortIds per domain', async () => {
      const id1 = await db.createCase({ domainId: 'medical', name: 'Patient A' });
      const id2 = await db.createCase({ domainId: 'medical', name: 'Patient B' });
      const id3 = await db.createCase({ domainId: 'security', name: 'Audit 1' });
      const c1 = await db.getCase(id1);
      const c2 = await db.getCase(id2);
      const c3 = await db.getCase(id3);
      expect(c1!.shortId).toBe('MC-001');
      expect(c2!.shortId).toBe('MC-002');
      expect(c3!.shortId).toBe('SA-001');
    });

    it('lists cases filtered by domain', async () => {
      await db.createCase({ domainId: 'medical', name: 'A' });
      await db.createCase({ domainId: 'medical', name: 'B' });
      await db.createCase({ domainId: 'legal', name: 'C' });
      const medical = await db.listCases('medical');
      const legal = await db.listCases('legal');
      expect(medical).toHaveLength(2);
      expect(legal).toHaveLength(1);
    });

    it('deletes a case', async () => {
      const id = await db.createCase({ domainId: 'medical', name: 'X' });
      await db.deleteCase(id);
      const c = await db.getCase(id);
      expect(c).toBeUndefined();
    });
  });

  describe('sessions', () => {
    it('creates and retrieves a session', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
      const sessionId = await db.createSession({
        caseId,
        caseNumber: 'SN-260226-TEST',
        duration: 60,
        segmentCount: 3,
        findingCount: 2,
        sizeBytes: 512,
        encrypted: new ArrayBuffer(512),
      });
      const s = await db.getSession(sessionId);
      expect(s).toBeDefined();
      expect(s!.caseId).toBe(caseId);
      expect(s!.duration).toBe(60);
    });

    it('lists sessions for a case ordered by createdAt desc', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
      await db.createSession({ caseId, caseNumber: 'SN-1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 100, encrypted: new ArrayBuffer(100) });
      await db.createSession({ caseId, caseNumber: 'SN-2', duration: 20, segmentCount: 2, findingCount: 1, sizeBytes: 200, encrypted: new ArrayBuffer(200) });
      const sessions = await db.listSessions(caseId);
      expect(sessions).toHaveLength(2);
      // Most recent first
      expect(sessions[0].caseNumber).toBe('SN-2');
    });

    it('deletes a session and updates total size', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
      const sid = await db.createSession({ caseId, caseNumber: 'SN-1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 1000, encrypted: new ArrayBuffer(1000) });
      const sizeBefore = await db.getTotalSize();
      await db.deleteSession(sid);
      const sizeAfter = await db.getTotalSize();
      expect(sizeAfter).toBe(sizeBefore - 1000);
    });

    it('deleting a case deletes all its sessions', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
      await db.createSession({ caseId, caseNumber: 'SN-1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 100, encrypted: new ArrayBuffer(100) });
      await db.createSession({ caseId, caseNumber: 'SN-2', duration: 20, segmentCount: 2, findingCount: 1, sizeBytes: 200, encrypted: new ArrayBuffer(200) });
      await db.deleteCase(caseId);
      const sessions = await db.listSessions(caseId);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('meta', () => {
    it('sets and gets metadata', async () => {
      await db.setMeta('credential_id', 'abc123');
      const val = await db.getMeta('credential_id');
      expect(val).toBe('abc123');
    });

    it('returns undefined for missing key', async () => {
      const val = await db.getMeta('nonexistent');
      expect(val).toBeUndefined();
    });
  });
});
```

**Step 2: Install fake-indexeddb for testing**

Run: `npm install -D fake-indexeddb`

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/vault.test.ts`
Expected: FAIL — VaultDB not found

**Step 4: Write the VaultDB class**

```typescript
// src/vault.ts
import type { DomainId, VaultCase, VaultSession } from './types';

const DOMAIN_PREFIXES: Record<DomainId, string> = {
  medical: 'MC',
  security: 'SA',
  legal: 'LD',
  incident: 'IR',
};

interface CreateCaseInput {
  domainId: DomainId;
  name: string;
}

interface CreateSessionInput {
  caseId: string;
  caseNumber: string;
  duration: number;
  segmentCount: number;
  findingCount: number;
  sizeBytes: number;
  encrypted: ArrayBuffer;
}

export class VaultDB {
  private db: IDBDatabase | null = null;
  private dbName: string;

  constructor(dbName = 'shadownotes-vault') {
    this.dbName = dbName;
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const cases = db.createObjectStore('cases', { keyPath: 'id' });
        cases.createIndex('domainId', 'domainId', { unique: false });
        cases.createIndex('shortId', 'shortId', { unique: true });
        cases.createIndex('name', 'name', { unique: false });
        cases.createIndex('updatedAt', 'updatedAt', { unique: false });

        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('caseId', 'caseId', { unique: false });
        sessions.createIndex('createdAt', 'createdAt', { unique: false });

        db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) throw new Error('VaultDB not opened');
    return this.db;
  }

  // --- Cases ---

  async createCase(input: CreateCaseInput): Promise<string> {
    const db = this.ensureDB();
    const id = crypto.randomUUID();
    const now = Date.now();
    const shortId = await this.nextShortId(input.domainId);
    const vaultCase: VaultCase = {
      id,
      domainId: input.domainId,
      name: input.name,
      shortId,
      createdAt: now,
      updatedAt: now,
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readwrite');
      tx.objectStore('cases').add(vaultCase);
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCase(id: string): Promise<VaultCase | undefined> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readonly');
      const req = tx.objectStore('cases').get(id);
      req.onsuccess = () => resolve(req.result ?? undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async listCases(domainId: DomainId): Promise<VaultCase[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readonly');
      const idx = tx.objectStore('cases').index('domainId');
      const req = idx.getAll(domainId);
      req.onsuccess = () => {
        const cases = req.result as VaultCase[];
        cases.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(cases);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteCase(id: string): Promise<void> {
    // Delete all sessions for this case first
    const sessions = await this.listSessions(id);
    for (const s of sessions) {
      await this.deleteSession(s.id);
    }
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readwrite');
      tx.objectStore('cases').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async findCaseByNameOrId(domainId: DomainId, query: string): Promise<VaultCase | undefined> {
    const cases = await this.listCases(domainId);
    const q = query.toLowerCase().trim();
    // Exact shortId match
    const byId = cases.find(c => c.shortId.toLowerCase() === q);
    if (byId) return byId;
    // Exact name match
    const byName = cases.find(c => c.name.toLowerCase() === q);
    if (byName) return byName;
    // Fuzzy name match — Levenshtein
    let bestMatch: VaultCase | undefined;
    let bestDist = Infinity;
    for (const c of cases) {
      const d = levenshtein(q, c.name.toLowerCase());
      if (d < bestDist && d <= Math.max(2, Math.floor(c.name.length * 0.3))) {
        bestDist = d;
        bestMatch = c;
      }
    }
    return bestMatch;
  }

  private async nextShortId(domainId: DomainId): Promise<string> {
    const prefix = DOMAIN_PREFIXES[domainId];
    const cases = await this.listCases(domainId);
    let maxNum = 0;
    for (const c of cases) {
      const match = c.shortId.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
  }

  // --- Sessions ---

  async createSession(input: CreateSessionInput): Promise<string> {
    const db = this.ensureDB();
    const id = crypto.randomUUID();
    const session: VaultSession = {
      id,
      caseId: input.caseId,
      caseNumber: input.caseNumber,
      createdAt: Date.now(),
      duration: input.duration,
      segmentCount: input.segmentCount,
      findingCount: input.findingCount,
      sizeBytes: input.sizeBytes,
      encrypted: input.encrypted,
    };
    // Update total size
    const currentSize = await this.getTotalSize();
    await this.setMeta('total_size', currentSize + input.sizeBytes);
    // Update case updatedAt
    const vaultCase = await this.getCase(input.caseId);
    if (vaultCase) {
      vaultCase.updatedAt = Date.now();
      await this.putCase(vaultCase);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').add(session);
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSession(id: string): Promise<VaultSession | undefined> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const req = tx.objectStore('sessions').get(id);
      req.onsuccess = () => resolve(req.result ?? undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async listSessions(caseId: string): Promise<VaultSession[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const idx = tx.objectStore('sessions').index('caseId');
      const req = idx.getAll(caseId);
      req.onsuccess = () => {
        const sessions = req.result as VaultSession[];
        sessions.sort((a, b) => b.createdAt - a.createdAt);
        resolve(sessions);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateSessionEncrypted(id: string, encrypted: ArrayBuffer, sizeBytes: number): Promise<void> {
    const db = this.ensureDB();
    const session = await this.getSession(id);
    if (!session) throw new Error(`Session ${id} not found`);
    const sizeDelta = sizeBytes - session.sizeBytes;
    session.encrypted = encrypted;
    session.sizeBytes = sizeBytes;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put(session);
      tx.oncomplete = async () => {
        const currentSize = await this.getTotalSize();
        await this.setMeta('total_size', currentSize + sizeDelta);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteSession(id: string): Promise<void> {
    const db = this.ensureDB();
    const session = await this.getSession(id);
    if (!session) return;
    const currentSize = await this.getTotalSize();
    await this.setMeta('total_size', Math.max(0, currentSize - session.sizeBytes));
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Get all sessions ordered by createdAt ascending (for rotation)
  async getOldestSessions(): Promise<VaultSession[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const idx = tx.objectStore('sessions').index('createdAt');
      const req = idx.getAll();
      req.onsuccess = () => resolve(req.result as VaultSession[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getSessionCount(caseId: string): Promise<number> {
    const sessions = await this.listSessions(caseId);
    return sessions.length;
  }

  // --- Meta ---

  async getMeta(key: string): Promise<string | number | undefined> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => reject(req.error);
    });
  }

  async setMeta(key: string, value: string | number): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getTotalSize(): Promise<number> {
    const val = await this.getMeta('total_size');
    return typeof val === 'number' ? val : 0;
  }

  async getMaxSize(): Promise<number> {
    const val = await this.getMeta('max_size');
    return typeof val === 'number' ? val : 50 * 1024 * 1024; // 50MB default
  }

  private async putCase(c: VaultCase): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readwrite');
      tx.objectStore('cases').put(c);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async close(): void {
    this.db?.close();
    this.db = null;
  }
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/vault.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/vault.ts src/__tests__/vault.test.ts
git commit -m "feat: add IndexedDB vault database with case/session CRUD and fuzzy search"
```

---

### Task 5: Storage rotation manager

**Files:**
- Create: `src/storage.ts`
- Create: `src/__tests__/storage.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager, StorageStatus } from '../storage';
import { VaultDB } from '../vault';
import 'fake-indexeddb/auto';

describe('StorageManager', () => {
  let db: VaultDB;
  let sm: StorageManager;

  beforeEach(async () => {
    db = new VaultDB(`test-storage-${crypto.randomUUID()}`);
    await db.open();
    sm = new StorageManager(db);
  });

  it('returns ok status when under 75%', async () => {
    // 50MB limit, 0 bytes used
    const status = await sm.getStatus();
    expect(status.level).toBe('ok');
    expect(status.usedBytes).toBe(0);
  });

  it('returns warning status at 75-90%', async () => {
    // Set total_size to 40MB (80% of 50MB)
    await db.setMeta('total_size', 40 * 1024 * 1024);
    const status = await sm.getStatus();
    expect(status.level).toBe('warning');
  });

  it('returns critical status at 90-99%', async () => {
    await db.setMeta('total_size', 47 * 1024 * 1024);
    const status = await sm.getStatus();
    expect(status.level).toBe('critical');
  });

  it('rotates oldest sessions when over limit', async () => {
    // Set a tiny 1KB limit for testing
    await db.setMeta('max_size', 1024);
    const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
    // Add 3 sessions totaling 1500 bytes (over limit)
    await db.createSession({ caseId, caseNumber: 'S1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 500, encrypted: new ArrayBuffer(500) });
    await db.createSession({ caseId, caseNumber: 'S2', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 500, encrypted: new ArrayBuffer(500) });
    await db.createSession({ caseId, caseNumber: 'S3', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 500, encrypted: new ArrayBuffer(500) });

    const rotated = await sm.rotateIfNeeded();
    expect(rotated).toBeGreaterThan(0);

    const totalAfter = await db.getTotalSize();
    const maxSize = await db.getMaxSize();
    expect(totalAfter).toBeLessThanOrEqual(maxSize * 0.95);
  });

  it('never rotates the excluded session', async () => {
    await db.setMeta('max_size', 500);
    const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
    const s1 = await db.createSession({ caseId, caseNumber: 'S1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 400, encrypted: new ArrayBuffer(400) });
    await db.createSession({ caseId, caseNumber: 'S2', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 400, encrypted: new ArrayBuffer(400) });

    // Exclude s1 (the oldest — currently being recorded)
    const rotated = await sm.rotateIfNeeded(s1);
    // S1 should still exist
    const session1 = await db.getSession(s1);
    expect(session1).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/storage.test.ts`
Expected: FAIL — module not found

**Step 3: Write the storage manager**

```typescript
// src/storage.ts
import type { VaultDB } from './vault';

export type StorageLevel = 'ok' | 'warning' | 'critical' | 'full';

export interface StorageStatus {
  level: StorageLevel;
  usedBytes: number;
  maxBytes: number;
  usedPercent: number;
}

export class StorageManager {
  constructor(private db: VaultDB) {}

  async getStatus(): Promise<StorageStatus> {
    const usedBytes = await this.db.getTotalSize();
    const maxBytes = await this.db.getMaxSize();
    const usedPercent = maxBytes > 0 ? (usedBytes / maxBytes) * 100 : 0;

    let level: StorageLevel;
    if (usedPercent >= 100) level = 'full';
    else if (usedPercent >= 90) level = 'critical';
    else if (usedPercent >= 75) level = 'warning';
    else level = 'ok';

    return { level, usedBytes, maxBytes, usedPercent };
  }

  // Returns number of sessions rotated. Pass excludeSessionId to protect active recording.
  async rotateIfNeeded(excludeSessionId?: string): Promise<number> {
    const maxBytes = await this.db.getMaxSize();
    let totalSize = await this.db.getTotalSize();

    if (totalSize <= maxBytes) return 0;

    const target = maxBytes * 0.95;
    const sessions = await this.db.getOldestSessions();
    let rotated = 0;

    for (const session of sessions) {
      if (totalSize <= target) break;
      if (session.id === excludeSessionId) continue;
      await this.db.deleteSession(session.id);
      totalSize -= session.sizeBytes;
      rotated++;
    }

    return rotated;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/storage.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/storage.ts src/__tests__/storage.test.ts
git commit -m "feat: add storage rotation manager with FIFO and threshold warnings"
```

---

## Phase 2: Voice Command System

### Task 6: Voice command parser

**Files:**
- Create: `src/voiceCommands.ts`
- Create: `src/__tests__/voiceCommands.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/voiceCommands.test.ts
import { describe, it, expect } from 'vitest';
import { parseVoiceCommand, VoiceCommand } from '../voiceCommands';

describe('parseVoiceCommand', () => {
  it('returns null for non-command speech', () => {
    expect(parseVoiceCommand('patient has a headache')).toBeNull();
    expect(parseVoiceCommand('the blood pressure is 120 over 80')).toBeNull();
  });

  it('returns null for partial wake word', () => {
    expect(parseVoiceCommand('hey open case')).toBeNull();
    expect(parseVoiceCommand('shadow open case')).toBeNull();
  });

  it('parses create case command', () => {
    const cmd = parseVoiceCommand('hey shadow create case John Doe');
    expect(cmd).toEqual({ action: 'create-case', args: 'John Doe' });
  });

  it('parses open case command', () => {
    const cmd = parseVoiceCommand('hey shadow open case MC-001');
    expect(cmd).toEqual({ action: 'open-case', args: 'MC-001' });
  });

  it('parses delete case command', () => {
    const cmd = parseVoiceCommand('Hey Shadow delete case Patient A');
    expect(cmd).toEqual({ action: 'delete-case', args: 'Patient A' });
  });

  it('parses show history', () => {
    expect(parseVoiceCommand('hey shadow show history')).toEqual({ action: 'show-history', args: '' });
  });

  it('parses open session N', () => {
    expect(parseVoiceCommand('hey shadow open session 3')).toEqual({ action: 'open-session', args: '3' });
  });

  it('parses last update', () => {
    expect(parseVoiceCommand('hey shadow last update')).toEqual({ action: 'last-update', args: '' });
  });

  it('parses new session', () => {
    expect(parseVoiceCommand('hey shadow new session')).toEqual({ action: 'new-session', args: '' });
  });

  it('parses go back', () => {
    expect(parseVoiceCommand('hey shadow go back')).toEqual({ action: 'go-back', args: '' });
  });

  it('parses list cases', () => {
    expect(parseVoiceCommand('hey shadow list cases')).toEqual({ action: 'list-cases', args: '' });
  });

  it('parses save', () => {
    expect(parseVoiceCommand('hey shadow save')).toEqual({ action: 'save', args: '' });
  });

  it('parses discard', () => {
    expect(parseVoiceCommand('hey shadow discard')).toEqual({ action: 'discard', args: '' });
  });

  it('parses confirm delete', () => {
    expect(parseVoiceCommand('hey shadow confirm delete')).toEqual({ action: 'confirm-delete', args: '' });
  });

  it('is case-insensitive', () => {
    expect(parseVoiceCommand('HEY SHADOW OPEN CASE test')).toEqual({ action: 'open-case', args: 'test' });
  });

  it('trims whitespace in args', () => {
    const cmd = parseVoiceCommand('hey shadow create case   Jane Smith   ');
    expect(cmd).toEqual({ action: 'create-case', args: 'Jane Smith' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/voiceCommands.test.ts`
Expected: FAIL — module not found

**Step 3: Write the voice command parser**

```typescript
// src/voiceCommands.ts

export type VoiceAction =
  | 'create-case'
  | 'open-case'
  | 'delete-case'
  | 'show-history'
  | 'open-session'
  | 'last-update'
  | 'new-session'
  | 'go-back'
  | 'list-cases'
  | 'save'
  | 'discard'
  | 'confirm-delete';

export interface VoiceCommand {
  action: VoiceAction;
  args: string;
}

const WAKE = /^hey\s+shadow\s+/i;

const COMMANDS: Array<{ pattern: RegExp; action: VoiceAction }> = [
  { pattern: /^create\s+case\s+(.+)$/i, action: 'create-case' },
  { pattern: /^open\s+case\s+(.+)$/i, action: 'open-case' },
  { pattern: /^delete\s+case\s+(.+)$/i, action: 'delete-case' },
  { pattern: /^show\s+history$/i, action: 'show-history' },
  { pattern: /^open\s+session\s+(.+)$/i, action: 'open-session' },
  { pattern: /^last\s+update$/i, action: 'last-update' },
  { pattern: /^new\s+session$/i, action: 'new-session' },
  { pattern: /^go\s+back$/i, action: 'go-back' },
  { pattern: /^list\s+cases$/i, action: 'list-cases' },
  { pattern: /^confirm\s+delete$/i, action: 'confirm-delete' },
  { pattern: /^save$/i, action: 'save' },
  { pattern: /^discard$/i, action: 'discard' },
];

export function parseVoiceCommand(text: string): VoiceCommand | null {
  const trimmed = text.trim();
  if (!WAKE.test(trimmed)) return null;

  const afterWake = trimmed.replace(WAKE, '').trim();

  for (const { pattern, action } of COMMANDS) {
    const match = afterWake.match(pattern);
    if (match) {
      return { action, args: (match[1] ?? '').trim() };
    }
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/voiceCommands.test.ts`
Expected: All 16 PASS

**Step 5: Commit**

```bash
git add src/voiceCommands.ts src/__tests__/voiceCommands.test.ts
git commit -m "feat: add 'Hey Shadow' voice command parser with regex matching"
```

---

## Phase 3: Vault Context Provider

### Task 7: VaultProvider React context

**Files:**
- Create: `src/VaultContext.tsx`

This is the central state manager that holds the master key, VaultDB instance, and provides actions to all components.

**Step 1: Write the vault context**

```typescript
// src/VaultContext.tsx
import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { VaultDB } from './vault';
import { StorageManager, type StorageStatus } from './storage';
import { deriveKeyFromBytes, deriveCaseKey, encryptContent, decryptContent, deriveKeyFromPassphrase } from './crypto';
import { registerCredential, authenticateCredential, isPRFSupported } from './auth';
import type { VaultCase, VaultSession, DomainId, SessionContent } from './types';

interface VaultContextValue {
  // Auth
  isUnlocked: boolean;
  authMethod: 'prf' | 'passphrase' | null;
  unlock: () => Promise<void>;
  unlockWithPassphrase: (passphrase: string) => Promise<void>;
  // Cases
  listCases: (domainId: DomainId) => Promise<VaultCase[]>;
  createCase: (domainId: DomainId, name: string) => Promise<string>;
  deleteCase: (id: string) => Promise<void>;
  findCase: (domainId: DomainId, query: string) => Promise<VaultCase | undefined>;
  // Sessions
  listSessions: (caseId: string) => Promise<VaultSession[]>;
  saveSession: (caseId: string, caseNumber: string, duration: number, content: SessionContent) => Promise<string>;
  loadSession: (caseId: string, sessionId: string) => Promise<SessionContent>;
  updateSession: (caseId: string, sessionId: string, content: SessionContent) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  getSessionCount: (caseId: string) => Promise<number>;
  // Storage
  getStorageStatus: () => Promise<StorageStatus>;
  rotateIfNeeded: (excludeSessionId?: string) => Promise<number>;
  // Destroy all
  destroyVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authMethod, setAuthMethod] = useState<'prf' | 'passphrase' | null>(null);
  const masterKeyRef = useRef<CryptoKey | null>(null);
  const dbRef = useRef<VaultDB | null>(null);
  const storageRef = useRef<StorageManager | null>(null);

  // Initialize DB on mount
  useEffect(() => {
    const db = new VaultDB();
    db.open().then(() => {
      dbRef.current = db;
      storageRef.current = new StorageManager(db);
    });
    return () => { db.close(); };
  }, []);

  const ensureDB = (): VaultDB => {
    if (!dbRef.current) throw new Error('VaultDB not initialized');
    return dbRef.current;
  };

  const ensureKey = (): CryptoKey => {
    if (!masterKeyRef.current) throw new Error('Vault is locked');
    return masterKeyRef.current;
  };

  // Unlock with Windows Hello (WebAuthn PRF)
  const unlock = useCallback(async () => {
    const db = ensureDB();
    const existingCredId = await db.getMeta('credential_id');

    let keyMaterial: Uint8Array;
    if (existingCredId && typeof existingCredId === 'string') {
      // Authenticate with existing credential
      keyMaterial = await authenticateCredential(existingCredId);
    } else {
      // First time — register new credential
      const result = await registerCredential();
      await db.setMeta('credential_id', result.credentialId);
      keyMaterial = result.keyMaterial;
    }

    masterKeyRef.current = await deriveKeyFromBytes(keyMaterial);
    setAuthMethod('prf');
    setIsUnlocked(true);
  }, []);

  // Unlock with passphrase (fallback)
  const unlockWithPassphrase = useCallback(async (passphrase: string) => {
    masterKeyRef.current = await deriveKeyFromPassphrase(passphrase);
    setAuthMethod('passphrase');
    setIsUnlocked(true);
  }, []);

  // Case operations (pass-through to DB)
  const listCases = useCallback(async (domainId: DomainId) => ensureDB().listCases(domainId), []);
  const createCase = useCallback(async (domainId: DomainId, name: string) => ensureDB().createCase({ domainId, name }), []);
  const deleteCase = useCallback(async (id: string) => ensureDB().deleteCase(id), []);
  const findCase = useCallback(async (domainId: DomainId, query: string) => ensureDB().findCaseByNameOrId(domainId, query), []);

  // Session operations (with encryption)
  const listSessions = useCallback(async (caseId: string) => ensureDB().listSessions(caseId), []);

  const saveSession = useCallback(async (caseId: string, caseNumber: string, duration: number, content: SessionContent): Promise<string> => {
    const masterKey = ensureKey();
    const caseKey = await deriveCaseKey(masterKey, caseId);
    const encrypted = await encryptContent(caseKey, content);
    const sessionId = await ensureDB().createSession({
      caseId,
      caseNumber,
      duration,
      segmentCount: content.transcripts.length,
      findingCount: content.intelligence.length,
      sizeBytes: encrypted.byteLength,
      encrypted,
    });
    // Auto-rotate if needed
    if (storageRef.current) await storageRef.current.rotateIfNeeded(sessionId);
    return sessionId;
  }, []);

  const loadSession = useCallback(async (caseId: string, sessionId: string): Promise<SessionContent> => {
    const session = await ensureDB().getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const masterKey = ensureKey();
    const caseKey = await deriveCaseKey(masterKey, caseId);
    return decryptContent(caseKey, session.encrypted);
  }, []);

  const updateSession = useCallback(async (caseId: string, sessionId: string, content: SessionContent) => {
    const masterKey = ensureKey();
    const caseKey = await deriveCaseKey(masterKey, caseId);
    const encrypted = await encryptContent(caseKey, content);
    await ensureDB().updateSessionEncrypted(sessionId, encrypted, encrypted.byteLength);
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => ensureDB().deleteSession(sessionId), []);
  const getSessionCount = useCallback(async (caseId: string) => ensureDB().getSessionCount(caseId), []);

  const getStorageStatus = useCallback(async () => {
    if (!storageRef.current) return { level: 'ok' as const, usedBytes: 0, maxBytes: 50 * 1024 * 1024, usedPercent: 0 };
    return storageRef.current.getStatus();
  }, []);

  const rotateIfNeeded = useCallback(async (excludeSessionId?: string) => {
    if (!storageRef.current) return 0;
    return storageRef.current.rotateIfNeeded(excludeSessionId);
  }, []);

  const destroyVault = useCallback(async () => {
    // Delete the entire IndexedDB database
    const db = dbRef.current;
    if (db) db.close();
    dbRef.current = null;
    storageRef.current = null;
    masterKeyRef.current = null;
    indexedDB.deleteDatabase('shadownotes-vault');
    setIsUnlocked(false);
    setAuthMethod(null);
  }, []);

  return (
    <VaultContext.Provider value={{
      isUnlocked, authMethod, unlock, unlockWithPassphrase,
      listCases, createCase, deleteCase, findCase,
      listSessions, saveSession, loadSession, updateSession, deleteSession, getSessionCount,
      getStorageStatus, rotateIfNeeded, destroyVault,
    }}>
      {children}
    </VaultContext.Provider>
  );
}
```

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All existing tests PASS (context isn't used by any component yet)

**Step 3: Commit**

```bash
git add src/VaultContext.tsx
git commit -m "feat: add VaultProvider context for encrypted case/session management"
```

---

## Phase 4: New UI Components

### Task 8: VaultUnlock screen

**Files:**
- Create: `src/components/VaultUnlock.tsx`
- Create: `src/__tests__/components/VaultUnlock.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/components/VaultUnlock.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VaultUnlock } from '../../components/VaultUnlock';

describe('VaultUnlock', () => {
  it('renders the unlock screen with Windows Hello button', () => {
    render(<VaultUnlock onUnlockPRF={vi.fn()} onUnlockPassphrase={vi.fn()} prfSupported={true} error={null} />);
    expect(screen.getByText(/AUTHENTICATE/i)).toBeDefined();
    expect(screen.getByText(/Windows Hello/i)).toBeDefined();
  });

  it('shows passphrase fallback when PRF not supported', () => {
    render(<VaultUnlock onUnlockPRF={vi.fn()} onUnlockPassphrase={vi.fn()} prfSupported={false} error={null} />);
    expect(screen.getByPlaceholderText(/passphrase/i)).toBeDefined();
  });

  it('calls onUnlockPRF when Windows Hello button clicked', async () => {
    const onUnlock = vi.fn();
    render(<VaultUnlock onUnlockPRF={onUnlock} onUnlockPassphrase={vi.fn()} prfSupported={true} error={null} />);
    await userEvent.click(screen.getByText(/Windows Hello/i));
    expect(onUnlock).toHaveBeenCalled();
  });

  it('displays error message', () => {
    render(<VaultUnlock onUnlockPRF={vi.fn()} onUnlockPassphrase={vi.fn()} prfSupported={true} error="Auth failed" />);
    expect(screen.getByText(/Auth failed/)).toBeDefined();
  });
});
```

**Step 2: Write the component**

```typescript
// src/components/VaultUnlock.tsx
import { useState } from 'react';

interface Props {
  onUnlockPRF: () => void;
  onUnlockPassphrase: (passphrase: string) => void;
  prfSupported: boolean;
  error: string | null;
}

export function VaultUnlock({ onUnlockPRF, onUnlockPassphrase, prfSupported, error }: Props) {
  const [passphrase, setPassphrase] = useState('');

  return (
    <div className="unlock-screen">
      <div className="unlock-container">
        <div className="boot-logo">
          <div className="boot-lock">{'\u{1F512}'}</div>
          <h1 className="boot-title">SHADOW NOTES</h1>
          <div className="boot-subtitle">VAULT AUTHENTICATION REQUIRED</div>
        </div>

        <div className="unlock-methods">
          {prfSupported ? (
            <button className="btn-unlock-prf" onClick={onUnlockPRF}>
              <span className="unlock-icon">{'\u{1F9B6}'}</span>
              AUTHENTICATE via Windows Hello
            </button>
          ) : (
            <div className="unlock-passphrase">
              <p className="unlock-fallback-note">Windows Hello not available. Enter vault passphrase:</p>
              <input
                type="password"
                className="unlock-input"
                placeholder="Enter passphrase..."
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && passphrase.trim()) onUnlockPassphrase(passphrase.trim());
                }}
              />
              <button
                className="btn-unlock-passphrase"
                onClick={() => passphrase.trim() && onUnlockPassphrase(passphrase.trim())}
                disabled={!passphrase.trim()}
              >
                UNLOCK VAULT
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="unlock-error">
            <span>[AUTH ERROR]</span> {error}
          </div>
        )}

        <div className="boot-classification">CLASSIFIED // EYES ONLY</div>
      </div>
    </div>
  );
}
```

**Step 3: Run test, verify pass, commit**

Run: `npx vitest run src/__tests__/components/VaultUnlock.test.tsx`

```bash
git add src/components/VaultUnlock.tsx src/__tests__/components/VaultUnlock.test.tsx
git commit -m "feat: add VaultUnlock screen with Windows Hello and passphrase fallback"
```

---

### Task 9: CaseList screen

**Files:**
- Create: `src/components/CaseList.tsx`
- Create: `src/__tests__/components/CaseList.test.tsx`

**Step 1: Write the component**

```typescript
// src/components/CaseList.tsx
import { useState, useEffect, useCallback } from 'react';
import type { VaultCase, DomainProfile } from '../types';

interface Props {
  domain: DomainProfile;
  listCases: () => Promise<VaultCase[]>;
  onCreateCase: (name: string) => Promise<void>;
  onOpenCase: (caseItem: VaultCase) => void;
  onDeleteCase: (id: string) => Promise<void>;
  onBack: () => void;
  storageWarning: string | null;
}

export function CaseList({ domain, listCases, onCreateCase, onOpenCase, onDeleteCase, onBack, storageWarning }: Props) {
  const [cases, setCases] = useState<VaultCase[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const refresh = useCallback(async () => {
    const list = await listCases();
    setCases(list);
  }, [listCases]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateCase(newName.trim());
    setNewName('');
    setCreating(false);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 5000);
      return;
    }
    await onDeleteCase(id);
    setConfirmDeleteId(null);
    await refresh();
  };

  const filtered = searchQuery
    ? cases.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.shortId.toLowerCase().includes(searchQuery.toLowerCase()))
    : cases;

  return (
    <div className="cases-screen">
      <header className="cases-header">
        <button className="btn-back" onClick={onBack}>{'\u{2190}'} DOMAINS</button>
        <div className="cases-title-row">
          <span className="domain-banner-icon">{domain.icon}</span>
          <h1 className="cases-title">{domain.codename}</h1>
          <div className="stamp stamp-small">{domain.clearanceLevel}</div>
        </div>
        <p className="cases-subtitle">{domain.name} — {cases.length} case{cases.length !== 1 ? 's' : ''}</p>
      </header>

      {storageWarning && (
        <div className={`storage-banner ${storageWarning.includes('nearly full') ? 'storage-critical' : 'storage-warning'}`}>
          {'\u{26A0}'} {storageWarning}
        </div>
      )}

      <div className="cases-toolbar">
        <input
          className="cases-search"
          placeholder="Search cases by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn-new-case" onClick={() => setCreating(true)}>
          + NEW CASE
        </button>
      </div>

      {creating && (
        <div className="case-create-form">
          <input
            className="case-create-input"
            placeholder="Case name (e.g., John Doe, Server Breach Q1)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            autoFocus
          />
          <button className="btn-create-confirm" onClick={handleCreate}>CREATE</button>
          <button className="btn-create-cancel" onClick={() => { setCreating(false); setNewName(''); }}>{'\u2715'}</button>
        </div>
      )}

      <div className="cases-grid">
        {filtered.length === 0 && !creating && (
          <div className="empty-state-cases">
            <p>{searchQuery ? 'No cases match your search.' : 'No cases yet. Create one to begin.'}</p>
          </div>
        )}
        {filtered.map((c) => (
          <div key={c.id} className="case-card" onClick={() => onOpenCase(c)}>
            <div className="case-card-header">
              <span className="case-shortid">{c.shortId}</span>
              <button
                className={`btn-delete-case ${confirmDeleteId === c.id ? 'btn-delete-confirm' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                title="Delete case"
              >
                {confirmDeleteId === c.id ? 'CONFIRM' : '\u2715'}
              </button>
            </div>
            <div className="case-card-name">{c.name}</div>
            <div className="case-card-meta">
              <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="voice-help-hint">
        <button className="btn-voice-help" title="Voice commands">?</button>
      </div>
    </div>
  );
}
```

**Step 2: Write tests (basic render + interaction)**

```typescript
// src/__tests__/components/CaseList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseList } from '../../components/CaseList';
import { DOMAINS } from '../../domains';

const medicalDomain = DOMAINS.find(d => d.id === 'medical')!;

describe('CaseList', () => {
  const defaultProps = {
    domain: medicalDomain,
    listCases: vi.fn().mockResolvedValue([]),
    onCreateCase: vi.fn().mockResolvedValue(undefined),
    onOpenCase: vi.fn(),
    onDeleteCase: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
    storageWarning: null,
  };

  it('renders domain header', async () => {
    render(<CaseList {...defaultProps} />);
    expect(screen.getByText(/OPERATION VITALS/)).toBeDefined();
    expect(screen.getByText(/Medical Notes/)).toBeDefined();
  });

  it('shows empty state when no cases', async () => {
    render(<CaseList {...defaultProps} />);
    // Wait for async refresh
    await screen.findByText(/No cases yet/);
  });

  it('shows create form when NEW CASE clicked', async () => {
    render(<CaseList {...defaultProps} />);
    await userEvent.click(screen.getByText('+ NEW CASE'));
    expect(screen.getByPlaceholderText(/Case name/)).toBeDefined();
  });

  it('renders case cards', async () => {
    const mockCases = [
      { id: '1', domainId: 'medical' as const, name: 'John Doe', shortId: 'MC-001', createdAt: Date.now(), updatedAt: Date.now() },
      { id: '2', domainId: 'medical' as const, name: 'Jane Smith', shortId: 'MC-002', createdAt: Date.now(), updatedAt: Date.now() },
    ];
    render(<CaseList {...defaultProps} listCases={vi.fn().mockResolvedValue(mockCases)} />);
    await screen.findByText('John Doe');
    expect(screen.getByText('Jane Smith')).toBeDefined();
    expect(screen.getByText('MC-001')).toBeDefined();
  });

  it('shows storage warning when provided', () => {
    render(<CaseList {...defaultProps} storageWarning="Storage: 38/50 MB used" />);
    expect(screen.getByText(/Storage: 38\/50 MB used/)).toBeDefined();
  });
});
```

**Step 3: Run tests, commit**

```bash
git add src/components/CaseList.tsx src/__tests__/components/CaseList.test.tsx
git commit -m "feat: add CaseList screen with search, create, and delete"
```

---

### Task 10: CaseDetail screen

**Files:**
- Create: `src/components/CaseDetail.tsx`
- Create: `src/__tests__/components/CaseDetail.test.tsx`

**Step 1: Write the component**

```typescript
// src/components/CaseDetail.tsx
import { useState, useEffect, useCallback } from 'react';
import type { VaultCase, VaultSession, DomainProfile } from '../types';

interface Props {
  domain: DomainProfile;
  caseItem: VaultCase;
  listSessions: (caseId: string) => Promise<VaultSession[]>;
  onNewSession: () => void;
  onOpenSession: (session: VaultSession) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onDeleteCase: () => Promise<void>;
  onBack: () => void;
}

export function CaseDetail({ domain, caseItem, listSessions, onNewSession, onOpenSession, onDeleteSession, onDeleteCase, onBack }: Props) {
  const [sessions, setSessions] = useState<VaultSession[]>([]);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<string | null>(null);
  const [confirmDeleteCase, setConfirmDeleteCase] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listSessions(caseItem.id);
    setSessions(list);
  }, [listSessions, caseItem.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDeleteSession = async (id: string) => {
    if (confirmDeleteSession !== id) {
      setConfirmDeleteSession(id);
      setTimeout(() => setConfirmDeleteSession(null), 5000);
      return;
    }
    await onDeleteSession(id);
    setConfirmDeleteSession(null);
    await refresh();
  };

  const handleDeleteCase = async () => {
    if (!confirmDeleteCase) {
      setConfirmDeleteCase(true);
      setTimeout(() => setConfirmDeleteCase(false), 5000);
      return;
    }
    await onDeleteCase();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="case-detail-screen">
      <header className="case-detail-header">
        <button className="btn-back" onClick={onBack}>{'\u{2190}'} CASES</button>
        <div className="case-detail-title-row">
          <span className="case-shortid-large">{caseItem.shortId}</span>
          <h1 className="case-detail-title">{caseItem.name}</h1>
        </div>
        <div className="case-detail-meta">
          <span>{domain.icon} {domain.name}</span>
          <span className="separator">{'\u{2502}'}</span>
          <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          <span className="separator">{'\u{2502}'}</span>
          <span>Created {new Date(caseItem.createdAt).toLocaleDateString()}</span>
        </div>
      </header>

      <div className="case-detail-actions">
        <button className="btn-new-session" onClick={onNewSession}>
          <span className="rec-dot-static" /> NEW SESSION
        </button>
        <button
          className={`btn-delete-case-detail ${confirmDeleteCase ? 'btn-delete-confirm' : ''}`}
          onClick={handleDeleteCase}
        >
          {confirmDeleteCase ? 'CONFIRM DELETE CASE' : 'DELETE CASE'}
        </button>
      </div>

      <div className="session-timeline">
        <h2 className="section-heading">
          <span className="section-marker">{'\u{25B8}'}</span>
          SESSION HISTORY
        </h2>

        {sessions.length === 0 && (
          <div className="empty-state-sessions">
            <p>No sessions recorded yet. Start a new session to begin.</p>
          </div>
        )}

        {sessions.map((s) => (
          <div key={s.id} className="session-card" onClick={() => onOpenSession(s)}>
            <div className="session-card-header">
              <span className="session-card-number">{s.caseNumber}</span>
              <span className="session-card-date">{formatDate(s.createdAt)}</span>
              <button
                className={`btn-delete-session ${confirmDeleteSession === s.id ? 'btn-delete-confirm' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
              >
                {confirmDeleteSession === s.id ? 'CONFIRM' : '\u2715'}
              </button>
            </div>
            <div className="session-card-stats">
              <span>{formatDuration(s.duration)}</span>
              <span>{s.segmentCount} segments</span>
              <span>{s.findingCount} findings</span>
            </div>
          </div>
        ))}
      </div>

      <div className="voice-help-hint">
        <button className="btn-voice-help" title="Voice commands">?</button>
      </div>
    </div>
  );
}
```

**Step 2: Write tests, run, commit**

Similar pattern to CaseList tests — render with mock props, verify header/empty state/session cards render.

```bash
git add src/components/CaseDetail.tsx src/__tests__/components/CaseDetail.test.tsx
git commit -m "feat: add CaseDetail screen with session timeline and delete actions"
```

---

### Task 11: StorageBanner component

**Files:**
- Create: `src/components/StorageBanner.tsx`

A small reusable component for the yellow/red storage warnings.

```typescript
// src/components/StorageBanner.tsx
import type { StorageStatus } from '../storage';

interface Props {
  status: StorageStatus;
  formatSize: (bytes: number) => string;
}

export function StorageBanner({ status, formatSize }: Props) {
  if (status.level === 'ok') return null;

  const message = status.level === 'critical'
    ? `Storage nearly full (${formatSize(status.usedBytes)}/${formatSize(status.maxBytes)}). Oldest sessions will be auto-rotated.`
    : `Storage: ${formatSize(status.usedBytes)}/${formatSize(status.maxBytes)} used. Consider cleaning old sessions.`;

  return (
    <div className={`storage-banner ${status.level === 'critical' ? 'storage-critical' : 'storage-warning'}`}>
      {'\u{26A0}'} {message}
    </div>
  );
}
```

```bash
git add src/components/StorageBanner.tsx
git commit -m "feat: add StorageBanner component for vault storage warnings"
```

---

### Task 12: VoiceCommandHelp overlay

**Files:**
- Create: `src/components/VoiceCommandHelp.tsx`

```typescript
// src/components/VoiceCommandHelp.tsx
import type { AppScreen } from '../types';

interface Props {
  screen: AppScreen;
  onClose: () => void;
}

const COMMANDS_BY_SCREEN: Record<string, Array<{ command: string; description: string }>> = {
  cases: [
    { command: 'Hey Shadow create case [name]', description: 'Create a new case' },
    { command: 'Hey Shadow open case [name/ID]', description: 'Open a case' },
    { command: 'Hey Shadow delete case [name/ID]', description: 'Delete a case' },
    { command: 'Hey Shadow list cases', description: 'List all cases' },
    { command: 'Hey Shadow go back', description: 'Return to domains' },
  ],
  'case-detail': [
    { command: 'Hey Shadow new session', description: 'Start recording' },
    { command: 'Hey Shadow open session [N]', description: 'Open Nth session' },
    { command: 'Hey Shadow last update', description: 'Open most recent session' },
    { command: 'Hey Shadow show history', description: 'View session timeline' },
    { command: 'Hey Shadow delete case', description: 'Delete this case' },
    { command: 'Hey Shadow go back', description: 'Return to cases' },
  ],
  capture: [
    { command: 'Hey Shadow save', description: 'Save and end session' },
    { command: 'Hey Shadow discard', description: 'Discard session' },
    { command: 'Hey Shadow go back', description: 'End and go back' },
  ],
  summary: [
    { command: 'Hey Shadow go back', description: 'Return to case' },
  ],
};

export function VoiceCommandHelp({ screen, onClose }: Props) {
  const commands = COMMANDS_BY_SCREEN[screen] || [];

  return (
    <div className="voice-help-overlay" onClick={onClose}>
      <div className="voice-help-card" onClick={(e) => e.stopPropagation()}>
        <div className="voice-help-header">
          <h3>VOICE COMMANDS</h3>
          <button className="voice-help-close" onClick={onClose}>{'\u2715'}</button>
        </div>
        <div className="voice-help-list">
          {commands.map((cmd, i) => (
            <div key={i} className="voice-help-item">
              <code className="voice-help-command">{cmd.command}</code>
              <span className="voice-help-desc">{cmd.description}</span>
            </div>
          ))}
        </div>
        <p className="voice-help-note">Say "Hey Shadow" followed by the command while microphone is active.</p>
      </div>
    </div>
  );
}
```

```bash
git add src/components/VoiceCommandHelp.tsx
git commit -m "feat: add VoiceCommandHelp overlay with context-aware commands"
```

---

## Phase 5: Wire Everything Together

### Task 13: Update App.tsx — new routing and vault integration

**Files:**
- Modify: `src/App.tsx`

This is the most complex task. App.tsx needs to:
1. Wrap everything in `VaultProvider`
2. Add unlock screen before domain selection
3. Add case list and case detail screens
4. Pass vault operations to components
5. Integrate voice command handling
6. Modify session save/end flow

**Step 1: Rewrite App.tsx**

The new AppInner manages these screens: `unlock → init → cases → case-detail → capture → summary`

Key changes:
- Add `VaultProvider` wrapper
- Add `currentDomain`, `currentCase`, `currentSessionId` state
- Route to new screens based on `AppScreen`
- `handleEndSession` now encrypts and saves to vault instead of just going to summary
- Voice command handler checks transcript text for "Hey Shadow" prefix

**Implementation**: Replace the entire AppInner function body with the new routing logic. Keep all existing hooks/callbacks but add vault integration. The session creation callbacks (`addTranscript`, `addIntelligence`, etc.) stay the same — they operate on in-memory state during recording. Only when "END SESSION" is clicked does the data get encrypted and persisted.

```typescript
// Key new state in AppInner:
const [currentDomain, setCurrentDomain] = useState<DomainProfile | null>(null);
const [currentCase, setCurrentCase] = useState<VaultCase | null>(null);
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
const [reviewSession, setReviewSession] = useState<{ session: VaultSession; content: SessionContent } | null>(null);

// Vault unlock check:
const vault = useVault();
if (!vault.isUnlocked) return <VaultUnlock ... />;

// Screen routing:
switch (screen) {
  case 'init': return <SessionInit onStart={(domain) => { setCurrentDomain(domain); setScreen('cases'); }} />;
  case 'cases': return <CaseList domain={currentDomain} ... />;
  case 'case-detail': return <CaseDetail caseItem={currentCase} ... />;
  case 'capture': return <ActiveCapture ... />; // same as before
  case 'summary': return <SessionSummary ... />; // loads from vault
}
```

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (some existing App.test.tsx tests may need updates for new screen states)

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate vault routing with unlock, cases, case-detail screens"
```

---

### Task 14: Update ActiveCapture — voice command interception

**Files:**
- Modify: `src/components/ActiveCapture.tsx`

**Changes:**
1. Import `parseVoiceCommand` from `../voiceCommands`
2. In the `recognition.onresult` handler, check each final transcript for "Hey Shadow" prefix
3. If a voice command is detected, execute it instead of adding to transcript
4. Add `onSaveSession` and `onDiscardSession` props (replacing `onEndSession` with two options)
5. Add a toast notification system for voice command feedback

**Key code change in onresult handler:**

```typescript
// After getting final text:
const command = parseVoiceCommand(text);
if (command) {
  handleVoiceCommand(command);
  return; // Don't add to transcript
}
// ... existing transcript logic
```

**Step 2: Run tests, update any broken ones, commit**

```bash
git add src/components/ActiveCapture.tsx
git commit -m "feat: add voice command interception to ActiveCapture"
```

---

### Task 15: Update SessionSummary — load from vault

**Files:**
- Modify: `src/components/SessionSummary.tsx`

**Changes:**
1. Accept `vaultSession` and `content` props (decrypted data) instead of only `session`
2. "DESTROY SESSION" becomes "DELETE SESSION" (deletes from vault) or "BACK TO CASE"
3. Editing intelligence saves back to vault (re-encrypts)
4. Remove the burn animation for delete (simpler confirm + delete)
5. Add "BACK TO CASE" button

**Step 2: Run tests, commit**

```bash
git add src/components/SessionSummary.tsx
git commit -m "feat: update SessionSummary to load from vault with save-back"
```

---

### Task 16: Update SessionInit — route to cases instead of capture

**Files:**
- Modify: `src/components/SessionInit.tsx`

**Changes:**
1. `onStart` callback now just selects domain and navigates to case list
2. Remove "BEGIN CAPTURE SESSION" — replaced with domain card click navigating to cases
3. Keep LLM status display

**Step 2: Run tests, commit**

```bash
git add src/components/SessionInit.tsx
git commit -m "feat: update SessionInit to route to case list on domain select"
```

---

## Phase 6: Styling

### Task 17: Add CSS for new screens

**Files:**
- Modify: `src/styles/index.css`

**New CSS classes to add:**

```css
/* Unlock screen */
.unlock-screen { /* same layout as .boot-screen */ }
.btn-unlock-prf { /* large green button */ }
.unlock-input { /* passphrase input, same style as other inputs */ }
.unlock-error { /* red error text */ }

/* Case list */
.cases-screen { /* full page layout */ }
.cases-header { /* domain banner + back button */ }
.cases-toolbar { /* search + new case button row */ }
.cases-search { /* search input */ }
.cases-grid { /* grid of case cards */ }
.case-card { /* clickable card with hover effect */ }
.case-card-header { /* shortId + delete button */ }
.case-card-name { /* case name */ }
.case-create-form { /* inline create form */ }

/* Case detail */
.case-detail-screen { /* full page layout */ }
.case-detail-header { /* case name + meta */ }
.session-timeline { /* list of session cards */ }
.session-card { /* clickable session entry */ }
.session-card-stats { /* duration, segments, findings */ }

/* Storage banner */
.storage-banner { /* fixed position warning bar */ }
.storage-warning { /* yellow background */ }
.storage-critical { /* red background */ }

/* Voice command help */
.voice-help-overlay { /* full screen dark overlay */ }
.voice-help-card { /* centered modal card */ }
.voice-help-command { /* monospace code styling */ }

/* Voice command toast */
.voice-toast { /* bottom-center toast notification */ }
```

All new styles should follow the existing classified-dossier theme: dark backgrounds, amber/green accents, JetBrains Mono font, noise overlay, etc.

**Step 2: Commit**

```bash
git add src/styles/index.css
git commit -m "feat: add CSS for vault unlock, case list, case detail, and voice UI"
```

---

## Phase 7: Testing & Verification

### Task 18: Update existing tests for new screen states

**Files:**
- Modify: `src/__tests__/components/App.test.tsx`
- Modify: `src/__tests__/integration/session-flow.test.tsx`

**Changes:**
- App.test.tsx: mock VaultProvider, update screen routing tests for new states
- session-flow.test.tsx: update integration flow to include case creation + session save

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (163 original + ~40 new = ~200+)

```bash
git add src/__tests__/
git commit -m "test: update existing tests for vault integration"
```

---

### Task 19: Integration test — full vault flow

**Files:**
- Create: `src/__tests__/integration/vault-flow.test.tsx`

Test the complete flow: unlock → select domain → create case → record session → save → reopen → verify content → delete.

```bash
git add src/__tests__/integration/vault-flow.test.tsx
git commit -m "test: add integration test for full vault lifecycle"
```

---

### Task 20: Final verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 2: Build**

Run: `npm run build`
Expected: Clean build, no TypeScript errors

**Step 3: Commit and push**

```bash
git add -A
git commit -m "feat: complete multi-case vault with encryption, voice nav, and storage rotation"
```

**Step 4: Deploy to Vercel**

```bash
cd r:/vibe-with-singularity && npx vercel --yes --prod
```

---

## Summary of All Files

### New files (12):
- `src/crypto.ts` — AES-256-GCM encrypt/decrypt with HKDF key derivation
- `src/auth.ts` — WebAuthn PRF registration/authentication
- `src/vault.ts` — IndexedDB VaultDB class with case/session CRUD
- `src/storage.ts` — StorageManager with rotation and status
- `src/voiceCommands.ts` — "Hey Shadow" voice command parser
- `src/VaultContext.tsx` — React context provider for vault operations
- `src/components/VaultUnlock.tsx` — Windows Hello unlock screen
- `src/components/CaseList.tsx` — Case management screen per domain
- `src/components/CaseDetail.tsx` — Session history per case
- `src/components/StorageBanner.tsx` — Storage warning banner
- `src/components/VoiceCommandHelp.tsx` — Voice command reference overlay

### Modified files (5):
- `src/types.ts` — Add VaultCase, VaultSession, SessionContent, update AppScreen
- `src/App.tsx` — VaultProvider wrapper, new screen routing, vault integration
- `src/components/SessionInit.tsx` — Route to cases instead of capture
- `src/components/ActiveCapture.tsx` — Voice command interception, save/discard props
- `src/components/SessionSummary.tsx` — Load from vault, save-back on edit
- `src/styles/index.css` — New screen styles

### New test files (7+):
- `src/__tests__/vault-types.test.ts`
- `src/__tests__/crypto.test.ts`
- `src/__tests__/auth.test.ts`
- `src/__tests__/vault.test.ts`
- `src/__tests__/storage.test.ts`
- `src/__tests__/voiceCommands.test.ts`
- `src/__tests__/components/VaultUnlock.test.tsx`
- `src/__tests__/components/CaseList.test.tsx`
- `src/__tests__/components/CaseDetail.test.tsx`
- `src/__tests__/integration/vault-flow.test.tsx`

### New dev dependency:
- `fake-indexeddb` (for testing IndexedDB in vitest/jsdom)
