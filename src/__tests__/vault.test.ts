import { describe, it, expect, beforeEach } from 'vitest';
import { VaultDB } from '../vault';
import 'fake-indexeddb/auto';

describe('VaultDB', () => {
  let db: VaultDB;

  beforeEach(async () => {
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
      const id1 = await db.createCase({ domainId: 'medical', name: 'A' });
      const id2 = await db.createCase({ domainId: 'medical', name: 'B' });
      const id3 = await db.createCase({ domainId: 'security', name: 'C' });
      expect((await db.getCase(id1))!.shortId).toBe('MC-001');
      expect((await db.getCase(id2))!.shortId).toBe('MC-002');
      expect((await db.getCase(id3))!.shortId).toBe('SA-001');
    });

    it('lists cases filtered by domain', async () => {
      await db.createCase({ domainId: 'medical', name: 'A' });
      await db.createCase({ domainId: 'medical', name: 'B' });
      await db.createCase({ domainId: 'legal', name: 'C' });
      expect(await db.listCases('medical')).toHaveLength(2);
      expect(await db.listCases('legal')).toHaveLength(1);
    });

    it('deletes a case and its sessions', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'X' });
      await db.createSession({ caseId, caseNumber: 'SN-1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 100, encrypted: new ArrayBuffer(100) });
      await db.deleteCase(caseId);
      expect(await db.getCase(caseId)).toBeUndefined();
      expect(await db.listSessions(caseId)).toHaveLength(0);
    });

    it('finds case by shortId', async () => {
      const id = await db.createCase({ domainId: 'medical', name: 'Test' });
      const found = await db.findCaseByNameOrId('medical', 'MC-001');
      expect(found).toBeDefined();
      expect(found!.id).toBe(id);
    });

    it('finds case by exact name', async () => {
      await db.createCase({ domainId: 'medical', name: 'John Doe' });
      const found = await db.findCaseByNameOrId('medical', 'John Doe');
      expect(found).toBeDefined();
      expect(found!.name).toBe('John Doe');
    });

    it('finds case by fuzzy name', async () => {
      await db.createCase({ domainId: 'medical', name: 'John Doe' });
      const found = await db.findCaseByNameOrId('medical', 'John Do'); // 1 char off
      expect(found).toBeDefined();
      expect(found!.name).toBe('John Doe');
    });
  });

  describe('sessions', () => {
    it('creates and retrieves a session', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
      const sid = await db.createSession({ caseId, caseNumber: 'SN-TEST', duration: 60, segmentCount: 3, findingCount: 2, sizeBytes: 512, encrypted: new ArrayBuffer(512) });
      const s = await db.getSession(sid);
      expect(s).toBeDefined();
      expect(s!.caseId).toBe(caseId);
      expect(s!.duration).toBe(60);
    });

    it('lists sessions for a case newest first', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
      await db.createSession({ caseId, caseNumber: 'SN-1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 100, encrypted: new ArrayBuffer(100) });
      await db.createSession({ caseId, caseNumber: 'SN-2', duration: 20, segmentCount: 2, findingCount: 1, sizeBytes: 200, encrypted: new ArrayBuffer(200) });
      const sessions = await db.listSessions(caseId);
      expect(sessions).toHaveLength(2);
      expect(sessions[0].caseNumber).toBe('SN-2');
    });

    it('deleteSession updates total size', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
      const sid = await db.createSession({ caseId, caseNumber: 'SN-1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 1000, encrypted: new ArrayBuffer(1000) });
      const before = await db.getTotalSize();
      await db.deleteSession(sid);
      const after = await db.getTotalSize();
      expect(after).toBe(before - 1000);
    });

    it('getOldestSessions returns all sorted ascending', async () => {
      const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
      await db.createSession({ caseId, caseNumber: 'SN-1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 100, encrypted: new ArrayBuffer(100) });
      await db.createSession({ caseId, caseNumber: 'SN-2', duration: 20, segmentCount: 2, findingCount: 1, sizeBytes: 200, encrypted: new ArrayBuffer(200) });
      const oldest = await db.getOldestSessions();
      expect(oldest[0].caseNumber).toBe('SN-1');
    });
  });

  describe('meta', () => {
    it('sets and gets metadata', async () => {
      await db.setMeta('credential_id', 'abc123');
      expect(await db.getMeta('credential_id')).toBe('abc123');
    });

    it('returns undefined for missing key', async () => {
      expect(await db.getMeta('nonexistent')).toBeUndefined();
    });

    it('getTotalSize defaults to 0', async () => {
      expect(await db.getTotalSize()).toBe(0);
    });

    it('getMaxSize defaults to 50MB', async () => {
      expect(await db.getMaxSize()).toBe(50 * 1024 * 1024);
    });
  });
});
