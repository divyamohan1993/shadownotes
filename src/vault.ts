import type { DomainId, VaultCase, VaultSession } from './types';

const DOMAIN_PREFIXES: Record<DomainId, string> = {
  medical: 'MC',
  security: 'SA',
  legal: 'LD',
  incident: 'IR',
};

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Compute Levenshtein edit distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  // Use a single-row DP approach for space efficiency.
  const prev = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    let diagPrev = prev[0];
    prev[0] = i;
    for (let j = 1; j <= lb; j++) {
      const temp = prev[j];
      if (a[i - 1] === b[j - 1]) {
        prev[j] = diagPrev;
      } else {
        prev[j] = 1 + Math.min(diagPrev, prev[j - 1], prev[j]);
      }
      diagPrev = temp;
    }
  }
  return prev[lb];
}

export class VaultDB {
  private dbName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName = 'shadownotes-vault') {
    this.dbName = dbName;
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        // Cases store
        const casesStore = db.createObjectStore('cases', { keyPath: 'id' });
        casesStore.createIndex('domainId', 'domainId', { unique: false });
        casesStore.createIndex('shortId', 'shortId', { unique: true });
        casesStore.createIndex('name', 'name', { unique: false });
        casesStore.createIndex('updatedAt', 'updatedAt', { unique: false });

        // Sessions store
        const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionsStore.createIndex('caseId', 'caseId', { unique: false });
        sessionsStore.createIndex('createdAt', 'createdAt', { unique: false });

        // Meta store
        db.createObjectStore('meta', { keyPath: 'key' });
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ---- helpers ----

  private ensureDb(): IDBDatabase {
    if (!this.db) throw new Error('Database not open. Call open() first.');
    return this.db;
  }

  /**
   * Generate the next shortId for a given domain by scanning existing cases.
   */
  private async nextShortId(domainId: DomainId): Promise<string> {
    const db = this.ensureDb();
    const prefix = DOMAIN_PREFIXES[domainId];

    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readonly');
      const store = tx.objectStore('cases');
      const index = store.index('domainId');
      const request = index.getAll(domainId);

      request.onsuccess = () => {
        const cases: VaultCase[] = request.result;
        let maxNum = 0;
        for (const c of cases) {
          const match = c.shortId.match(/^[A-Z]+-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
        const next = maxNum + 1;
        const padded = String(next).padStart(3, '0');
        resolve(`${prefix}-${padded}`);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ---- Cases ----

  async createCase(input: { domainId: DomainId; name: string }): Promise<string> {
    const db = this.ensureDb();
    const id = crypto.randomUUID();
    const shortId = await this.nextShortId(input.domainId);
    const now = Date.now();

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
      const store = tx.objectStore('cases');
      const request = store.put(vaultCase);
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getCase(id: string): Promise<VaultCase | undefined> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readonly');
      const store = tx.objectStore('cases');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async listCases(domainId: DomainId): Promise<VaultCase[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readonly');
      const store = tx.objectStore('cases');
      const index = store.index('domainId');
      const request = index.getAll(domainId);
      request.onsuccess = () => {
        const cases: VaultCase[] = request.result;
        cases.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.updatedAt - a.updatedAt;
        });
        resolve(cases);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCases(): Promise<VaultCase[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readonly');
      const store = tx.objectStore('cases');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async pinCase(id: string, pinned: boolean): Promise<void> {
    const db = this.ensureDb();
    const c = await this.getCase(id);
    if (!c) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readwrite');
      const store = tx.objectStore('cases');
      store.put({ ...c, pinned });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteCase(id: string): Promise<void> {
    const db = this.ensureDb();

    // First, collect sessions to delete and their sizes
    const sessions = await this.listSessions(id);
    let sizeReduction = 0;
    for (const s of sessions) {
      sizeReduction += s.sizeBytes;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['cases', 'sessions', 'meta'], 'readwrite');
      const casesStore = tx.objectStore('cases');
      const sessionsStore = tx.objectStore('sessions');
      const metaStore = tx.objectStore('meta');

      // Delete the case
      casesStore.delete(id);

      // Delete all sessions for this case
      for (const s of sessions) {
        sessionsStore.delete(s.id);
      }

      // Update total_size
      if (sizeReduction > 0) {
        const metaReq = metaStore.get('total_size');
        metaReq.onsuccess = () => {
          const current = metaReq.result?.value ?? 0;
          const newSize = Math.max(0, (current as number) - sizeReduction);
          metaStore.put({ key: 'total_size', value: newSize });
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async findCaseByNameOrId(domainId: DomainId, query: string): Promise<VaultCase | undefined> {
    const db = this.ensureDb();

    // 1. Exact shortId match
    const byShortId = await new Promise<VaultCase | undefined>((resolve, reject) => {
      const tx = db.transaction('cases', 'readonly');
      const store = tx.objectStore('cases');
      const index = store.index('shortId');
      const request = index.get(query);
      request.onsuccess = () => {
        const result = request.result as VaultCase | undefined;
        if (result && result.domainId === domainId) {
          resolve(result);
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
    if (byShortId) return byShortId;

    // Get all cases in this domain for name matching
    const cases = await this.listCases(domainId);

    // 2. Exact name match
    const exactName = cases.find(c => c.name === query);
    if (exactName) return exactName;

    // 3. Fuzzy match via Levenshtein
    let bestCase: VaultCase | undefined;
    let bestDist = Infinity;

    for (const c of cases) {
      const maxAllowed = Math.max(2, Math.floor(c.name.length * 0.3));
      const dist = levenshtein(query, c.name);
      if (dist <= maxAllowed && dist < bestDist) {
        bestDist = dist;
        bestCase = c;
      }
    }

    return bestCase;
  }

  // ---- Sessions ----

  async createSession(input: {
    caseId: string;
    caseNumber: string;
    duration: number;
    segmentCount: number;
    findingCount: number;
    sizeBytes: number;
    encrypted: ArrayBuffer;
  }): Promise<string> {
    const db = this.ensureDb();
    const id = crypto.randomUUID();
    const now = Date.now();

    const session: VaultSession = {
      id,
      caseId: input.caseId,
      caseNumber: input.caseNumber,
      createdAt: now,
      duration: input.duration,
      segmentCount: input.segmentCount,
      findingCount: input.findingCount,
      sizeBytes: input.sizeBytes,
      encrypted: input.encrypted,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'cases', 'meta'], 'readwrite');
      const sessionsStore = tx.objectStore('sessions');
      const casesStore = tx.objectStore('cases');
      const metaStore = tx.objectStore('meta');

      // Add session
      sessionsStore.put(session);

      // Update case's updatedAt
      const caseReq = casesStore.get(input.caseId);
      caseReq.onsuccess = () => {
        const c = caseReq.result as VaultCase | undefined;
        if (c) {
          c.updatedAt = now;
          casesStore.put(c);
        }
      };

      // Update total_size in meta
      const metaReq = metaStore.get('total_size');
      metaReq.onsuccess = () => {
        const current = (metaReq.result?.value as number) ?? 0;
        metaStore.put({ key: 'total_size', value: current + input.sizeBytes });
      };

      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSession(id: string): Promise<VaultSession | undefined> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async listSessions(caseId: string): Promise<VaultSession[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const index = store.index('caseId');
      const request = index.getAll(caseId);
      request.onsuccess = () => {
        const sessions: VaultSession[] = request.result;
        sessions.sort((a, b) => b.createdAt - a.createdAt);
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateSessionFull(id: string, updates: {
    duration: number;
    segmentCount: number;
    findingCount: number;
    sizeBytes: number;
    encrypted: ArrayBuffer;
  }): Promise<void> {
    const db = this.ensureDb();
    const oldSession = await this.getSession(id);
    if (!oldSession) throw new Error(`Session ${id} not found`);
    const sizeDiff = updates.sizeBytes - oldSession.sizeBytes;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'cases', 'meta'], 'readwrite');
      const sessionsStore = tx.objectStore('sessions');
      const casesStore = tx.objectStore('cases');
      const metaStore = tx.objectStore('meta');

      const updated: VaultSession = {
        ...oldSession,
        duration: updates.duration,
        segmentCount: updates.segmentCount,
        findingCount: updates.findingCount,
        sizeBytes: updates.sizeBytes,
        encrypted: updates.encrypted,
      };
      sessionsStore.put(updated);

      // Bump case updatedAt
      const caseReq = casesStore.get(oldSession.caseId);
      caseReq.onsuccess = () => {
        const c = caseReq.result as VaultCase | undefined;
        if (c) {
          c.updatedAt = Date.now();
          casesStore.put(c);
        }
      };

      if (sizeDiff !== 0) {
        const metaReq = metaStore.get('total_size');
        metaReq.onsuccess = () => {
          const current = (metaReq.result?.value as number) ?? 0;
          metaStore.put({ key: 'total_size', value: Math.max(0, current + sizeDiff) });
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateSessionEncrypted(id: string, encrypted: ArrayBuffer, sizeBytes: number): Promise<void> {
    const db = this.ensureDb();

    // Get old session to compute size difference
    const oldSession = await this.getSession(id);
    if (!oldSession) throw new Error(`Session ${id} not found`);
    const sizeDiff = sizeBytes - oldSession.sizeBytes;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'meta'], 'readwrite');
      const sessionsStore = tx.objectStore('sessions');
      const metaStore = tx.objectStore('meta');

      // Update session
      const updated: VaultSession = { ...oldSession, encrypted, sizeBytes };
      sessionsStore.put(updated);

      // Update total_size
      if (sizeDiff !== 0) {
        const metaReq = metaStore.get('total_size');
        metaReq.onsuccess = () => {
          const current = (metaReq.result?.value as number) ?? 0;
          metaStore.put({ key: 'total_size', value: Math.max(0, current + sizeDiff) });
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteSession(id: string): Promise<void> {
    const db = this.ensureDb();

    const session = await this.getSession(id);
    if (!session) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'meta'], 'readwrite');
      const sessionsStore = tx.objectStore('sessions');
      const metaStore = tx.objectStore('meta');

      sessionsStore.delete(id);

      // Update total_size
      const metaReq = metaStore.get('total_size');
      metaReq.onsuccess = () => {
        const current = (metaReq.result?.value as number) ?? 0;
        const newSize = Math.max(0, current - session.sizeBytes);
        metaStore.put({ key: 'total_size', value: newSize });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getOldestSessions(): Promise<VaultSession[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const index = store.index('createdAt');
      const request = index.getAll();
      request.onsuccess = () => {
        const sessions: VaultSession[] = request.result;
        sessions.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSessionCount(caseId: string): Promise<number> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const index = store.index('caseId');
      const request = index.count(caseId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ---- Meta ----

  async getMeta(key: string): Promise<string | number | undefined> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const store = tx.objectStore('meta');
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.value ?? undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setMeta(key: string, value: string | number): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTotalSize(): Promise<number> {
    const val = await this.getMeta('total_size');
    return (val as number) ?? 0;
  }

  async getMaxSize(): Promise<number> {
    const val = await this.getMeta('max_size');
    return (val as number) ?? DEFAULT_MAX_SIZE;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
