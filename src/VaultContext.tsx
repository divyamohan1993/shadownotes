import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { VaultDB } from './vault';
import { StorageManager, formatSize, type StorageStatus } from './storage';
import { deriveKeyFromBytes, deriveCaseKey, encryptContent, decryptContent, deriveKeyFromPassphrase } from './crypto';
import { registerCredential, authenticateCredential } from './auth';
import type { VaultCase, VaultSession, DomainId, SessionContent } from './types';

interface VaultContextValue {
  isUnlocked: boolean;
  authMethod: 'prf' | 'passphrase' | null;
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
      keyMaterial = await authenticateCredential(existingCredId);
    } else {
      const result = await registerCredential();
      await db.setMeta('credential_id', result.credentialId);
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
      getStorageStatus, rotateIfNeeded, formatSize, destroyVault,
    }}>
      {children}
    </VaultContext.Provider>
  );
}
