import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { VaultDB } from './vault';
import { StorageManager, formatSize, type StorageStatus } from './storage';
import { deriveKeyFromBytes, deriveCaseKey, encryptContent, decryptContent, deriveKeyFromPassphrase } from './crypto';
import { registerCredential, authenticateCredential } from './auth';
import type { VaultCase, VaultSession, DomainId, SessionContent, SearchResult, ShadowExportBundle, IntelligenceItem } from './types';

/** Maximum number of cases allowed in a single import (DoS protection). */
const IMPORT_MAX_CASES = 100;
/** Maximum total sessions allowed in a single import (DoS protection). */
const IMPORT_MAX_SESSIONS = 1000;

interface VaultContextValue {
  isUnlocked: boolean;
  authMethod: 'prf' | 'passphrase' | null;
  /** Descriptive message from the last failed vault operation, or `null` if the most recent operation succeeded. */
  lastError: string | null;
  unlock: () => Promise<void>;
  unlockWithPassphrase: (passphrase: string) => Promise<void>;
  listCases: (domainId: DomainId) => Promise<VaultCase[]>;
  createCase: (domainId: DomainId, name: string) => Promise<string>;
  deleteCase: (id: string) => Promise<void>;
  findCase: (domainId: DomainId, query: string) => Promise<VaultCase | undefined>;
  listSessions: (caseId: string) => Promise<VaultSession[]>;
  saveSession: (caseId: string, caseNumber: string, duration: number, content: SessionContent) => Promise<string>;
  loadSession: (caseId: string, sessionId: string) => Promise<SessionContent>;
  updateSession: (caseId: string, sessionId: string, content: SessionContent) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  getSessionCount: (caseId: string) => Promise<number>;
  getStorageStatus: () => Promise<StorageStatus>;
  rotateIfNeeded: (excludeSessionId?: string) => Promise<number>;
  formatSize: (bytes: number) => string;
  destroyVault: () => Promise<void>;
  lock: () => void;
  pinCase: (id: string, pinned: boolean) => Promise<void>;
  searchAll: (query: string) => Promise<SearchResult[]>;
  saveDraft: (caseId: string, caseNumber: string, content: SessionContent, startTime: Date) => Promise<string>;
  updateDraft: (caseId: string, sessionId: string, content: SessionContent, startTime: Date) => Promise<void>;
  loadPriorContext: (caseId: string) => Promise<IntelligenceItem[]>;
  exportCase: (caseId: string, exportPassword: string) => Promise<Blob>;
  importDossier: (file: File, importPassword: string) => Promise<number>;
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
  const [lastError, setLastError] = useState<string | null>(null);
  const masterKeyRef = useRef<CryptoKey | null>(null);
  const dbRef = useRef<VaultDB | null>(null);
  const storageRef = useRef<StorageManager | null>(null);

  /** Clear lastError on success, set it on failure. */
  const clearError = () => setLastError(null);
  const setError = (msg: string) => setLastError(msg);

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

  const unlock = useCallback(async () => {
    const db = ensureDB();
    const existingCredId = await db.getMeta('credential_id');
    let keyMaterial: Uint8Array;
    if (existingCredId && typeof existingCredId === 'string') {
      const storedKey = await db.getMeta('stored_key_material') as string | undefined;
      keyMaterial = await authenticateCredential(existingCredId, storedKey);
    } else {
      const result = await registerCredential();
      await db.setMeta('credential_id', result.credentialId);
      if (!result.prfAvailable) {
        // Store key material — biometric auth gates access at unlock time
        const binary = String.fromCharCode(...result.keyMaterial);
        await db.setMeta('stored_key_material', btoa(binary));
      }
      keyMaterial = result.keyMaterial;
    }
    masterKeyRef.current = await deriveKeyFromBytes(keyMaterial);
    setAuthMethod('prf');
    setIsUnlocked(true);
  }, []);

  const unlockWithPassphrase = useCallback(async (passphrase: string) => {
    masterKeyRef.current = await deriveKeyFromPassphrase(passphrase);
    setAuthMethod('passphrase');
    setIsUnlocked(true);
  }, []);

  const listCases = useCallback(async (domainId: DomainId) => ensureDB().listCases(domainId), []);
  const createCase = useCallback(async (domainId: DomainId, name: string) => ensureDB().createCase({ domainId, name }), []);
  const deleteCase = useCallback(async (id: string) => ensureDB().deleteCase(id), []);
  const findCase = useCallback(async (domainId: DomainId, query: string) => ensureDB().findCaseByNameOrId(domainId, query), []);
  const listSessions = useCallback(async (caseId: string) => ensureDB().listSessions(caseId), []);

  const saveSession = useCallback(async (caseId: string, caseNumber: string, duration: number, content: SessionContent): Promise<string> => {
    const masterKey = ensureKey();
    const caseKey = await deriveCaseKey(masterKey, caseId);
    const encrypted = await encryptContent(caseKey, content);
    const sessionId = await ensureDB().createSession({
      caseId, caseNumber, duration,
      segmentCount: content.transcripts.length,
      findingCount: content.intelligence.length,
      sizeBytes: encrypted.byteLength,
      encrypted,
    });
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

  const saveDraft = useCallback(async (caseId: string, caseNumber: string, content: SessionContent, startTime: Date): Promise<string> => {
    const masterKey = ensureKey();
    const caseKey = await deriveCaseKey(masterKey, caseId);
    const encrypted = await encryptContent(caseKey, content);
    const duration = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const sessionId = await ensureDB().createSession({
      caseId, caseNumber, duration,
      segmentCount: content.transcripts.length,
      findingCount: content.intelligence.length,
      sizeBytes: encrypted.byteLength,
      encrypted,
    });
    if (storageRef.current) await storageRef.current.rotateIfNeeded(sessionId);
    return sessionId;
  }, []);

  const updateDraft = useCallback(async (caseId: string, sessionId: string, content: SessionContent, startTime: Date): Promise<void> => {
    const masterKey = ensureKey();
    const caseKey = await deriveCaseKey(masterKey, caseId);
    const encrypted = await encryptContent(caseKey, content);
    const duration = Math.floor((Date.now() - startTime.getTime()) / 1000);
    await ensureDB().updateSessionFull(sessionId, {
      duration,
      segmentCount: content.transcripts.length,
      findingCount: content.intelligence.length,
      sizeBytes: encrypted.byteLength,
      encrypted,
    });
  }, []);

  const loadPriorContext = useCallback(async (caseId: string): Promise<IntelligenceItem[]> => {
    const masterKey = ensureKey();
    const db = ensureDB();
    const sessions = await db.listSessions(caseId);
    const caseKey = await deriveCaseKey(masterKey, caseId);
    const allIntel: IntelligenceItem[] = [];
    for (const s of sessions) {
      try {
        const content = await decryptContent(caseKey, s.encrypted);
        allIntel.push(...content.intelligence);
      } catch (e) { console.warn(`Skipping session ${s.id} — decryption failed:`, e); }
    }
    return allIntel;
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

  const lock = useCallback(() => {
    masterKeyRef.current = null;
    setIsUnlocked(false);
    setAuthMethod(null);
  }, []);

  const pinCase = useCallback(async (id: string, pinned: boolean) => {
    await ensureDB().pinCase(id, pinned);
  }, []);

  const searchAll = useCallback(async (query: string): Promise<SearchResult[]> => {
    try {
      const masterKey = ensureKey();
      const db = ensureDB();
      const allCases = await db.getAllCases();
      const results: SearchResult[] = [];
      const q = query.toLowerCase();
      let decryptionFailures = 0;

      for (const c of allCases) {
        const sessions = await db.listSessions(c.id);
        const caseKey = await deriveCaseKey(masterKey, c.id);
        for (const s of sessions) {
          try {
            const content = await decryptContent(caseKey, s.encrypted);
            for (const t of content.transcripts) {
              if (t.text.toLowerCase().includes(q)) {
                results.push({ type: 'transcript', case: c, session: s, excerpt: t.text, timestamp: t.timestamp });
              }
            }
            for (const item of content.intelligence) {
              if (item.content.toLowerCase().includes(q)) {
                results.push({ type: 'intelligence', case: c, session: s, excerpt: item.content, category: item.category, timestamp: item.timestamp });
              }
            }
          } catch (e) {
            decryptionFailures++;
            console.warn(`Skipping session ${s.id} during search -- decryption failed:`, e);
          }
        }
      }

      if (decryptionFailures > 0) {
        const msg = `Search completed with ${decryptionFailures} session(s) that could not be decrypted. These sessions may have been created with a different key.`;
        console.warn(msg);
        setError(msg);
      } else {
        clearError();
      }

      return results;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Search failed unexpectedly';
      setError(msg);
      throw e;
    }
  }, []);

  const exportCase = useCallback(async (caseId: string, exportPassword: string): Promise<Blob> => {
    const masterKey = ensureKey();
    const db = ensureDB();
    const c = await db.getCase(caseId);
    if (!c) throw new Error('Case not found');
    const exportKey = await deriveKeyFromPassphrase(exportPassword);
    const sessions = await db.listSessions(caseId);
    const caseKey = await deriveCaseKey(masterKey, caseId);
    const exportSessions = [];

    for (const s of sessions) {
      const content = await decryptContent(caseKey, s.encrypted);
      const reEncrypted = await encryptContent(exportKey, content);
      const bytes = new Uint8Array(reEncrypted);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { encrypted: _omitted, ...meta } = s;
      exportSessions.push({ meta, encrypted: btoa(binary) });
    }

    const bundle: ShadowExportBundle = {
      version: 1,
      format: 'shadow-export-v1',
      exportedAt: Date.now(),
      cases: [{ case: c, sessions: exportSessions }],
    };
    return new Blob([JSON.stringify(bundle)], { type: 'application/json' });
  }, []);

  const importDossier = useCallback(async (file: File, importPassword: string): Promise<number> => {
    try {
      const masterKey = ensureKey();
      const db = ensureDB();
      const text = await file.text();

      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error('Import file is not valid JSON');
      }

      if (!raw || typeof raw !== 'object' || !('version' in raw) || !('cases' in raw) || !Array.isArray((raw as Record<string, unknown>).cases)) {
        throw new Error('Invalid .shadow file format');
      }
      const bundle = raw as ShadowExportBundle;
      if (bundle.format !== 'shadow-export-v1') throw new Error('Unsupported .shadow file version');

      // --- DoS protection ---
      if (bundle.cases.length > IMPORT_MAX_CASES) {
        throw new Error(`Import rejected: file contains ${bundle.cases.length} cases (maximum ${IMPORT_MAX_CASES})`);
      }
      let totalSessions = 0;
      for (const ec of bundle.cases) {
        if (ec.sessions) totalSessions += ec.sessions.length;
      }
      if (totalSessions > IMPORT_MAX_SESSIONS) {
        throw new Error(`Import rejected: file contains ${totalSessions} sessions (maximum ${IMPORT_MAX_SESSIONS})`);
      }

      // --- Schema validation ---
      const validDomainIds = new Set<string>(['security', 'legal', 'medical', 'incident']);

      for (let ci = 0; ci < bundle.cases.length; ci++) {
        const ec = bundle.cases[ci];
        if (!ec.case || typeof ec.case !== 'object') {
          throw new Error(`Import validation failed: cases[${ci}].case is missing or invalid`);
        }
        if (!ec.case.domainId || !validDomainIds.has(ec.case.domainId)) {
          throw new Error(`Import validation failed: cases[${ci}].case.domainId is invalid ("${ec.case.domainId}")`);
        }
        if (!ec.case.name || typeof ec.case.name !== 'string') {
          throw new Error(`Import validation failed: cases[${ci}].case.name is missing or not a string`);
        }
        if (!ec.case.id || typeof ec.case.id !== 'string') {
          throw new Error(`Import validation failed: cases[${ci}].case.id is missing or not a string`);
        }
        if (!Array.isArray(ec.sessions)) {
          throw new Error(`Import validation failed: cases[${ci}].sessions is not an array`);
        }

        for (let si = 0; si < ec.sessions.length; si++) {
          const es = ec.sessions[si];
          if (!es.meta || typeof es.meta !== 'object') {
            throw new Error(`Import validation failed: cases[${ci}].sessions[${si}].meta is missing`);
          }
          if (!es.meta.caseId || typeof es.meta.caseId !== 'string') {
            throw new Error(`Import validation failed: cases[${ci}].sessions[${si}].meta.caseId is missing`);
          }
          if (!es.meta.caseNumber || typeof es.meta.caseNumber !== 'string') {
            throw new Error(`Import validation failed: cases[${ci}].sessions[${si}].meta.caseNumber is missing`);
          }
          if (!es.encrypted || typeof es.encrypted !== 'string') {
            throw new Error(`Import validation failed: cases[${ci}].sessions[${si}].encrypted is missing or not a string`);
          }
          // Validate base64 format (must only contain valid base64 characters)
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(es.encrypted)) {
            throw new Error(`Import validation failed: cases[${ci}].sessions[${si}].encrypted is not valid base64`);
          }
        }
      }

      // --- Import ---
      const importKey = await deriveKeyFromPassphrase(importPassword);
      let imported = 0;

      for (const exportCase of bundle.cases) {
        const caseId = await db.createCase({ domainId: exportCase.case.domainId, name: exportCase.case.name });
        const caseKey = await deriveCaseKey(masterKey, caseId);

        for (const es of exportCase.sessions) {
          const binary = atob(es.encrypted);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const content = await decryptContent(importKey, bytes.buffer);
          const encrypted = await encryptContent(caseKey, content);
          await db.createSession({
            caseId,
            caseNumber: es.meta.caseNumber,
            duration: es.meta.duration,
            segmentCount: es.meta.segmentCount,
            findingCount: es.meta.findingCount,
            sizeBytes: encrypted.byteLength,
            encrypted,
          });
          imported++;
        }
      }

      clearError();
      return imported;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed unexpectedly';
      setError(msg);
      throw e;
    }
  }, []);

  const destroyVault = useCallback(async () => {
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
      isUnlocked, authMethod, lastError, unlock, unlockWithPassphrase,
      listCases, createCase, deleteCase, findCase,
      listSessions, saveSession, loadSession, updateSession, deleteSession, getSessionCount,
      saveDraft, updateDraft, loadPriorContext,
      getStorageStatus, rotateIfNeeded, formatSize, destroyVault,
      lock, pinCase, searchAll, exportCase, importDossier,
    }}>
      {children}
    </VaultContext.Provider>
  );
}
