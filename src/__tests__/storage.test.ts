import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager } from '../storage';
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

  it('returns ok when under 75%', async () => {
    const status = await sm.getStatus();
    expect(status.level).toBe('ok');
    expect(status.usedBytes).toBe(0);
  });

  it('returns warning at 75-90%', async () => {
    await db.setMeta('total_size', 40 * 1024 * 1024); // 80% of 50MB
    const status = await sm.getStatus();
    expect(status.level).toBe('warning');
  });

  it('returns critical at 90-99%', async () => {
    await db.setMeta('total_size', 47 * 1024 * 1024); // 94%
    const status = await sm.getStatus();
    expect(status.level).toBe('critical');
  });

  it('returns full at 100%+', async () => {
    await db.setMeta('total_size', 55 * 1024 * 1024); // over 50MB
    const status = await sm.getStatus();
    expect(status.level).toBe('full');
  });

  it('rotates oldest sessions when over limit', async () => {
    await db.setMeta('max_size', 1024); // 1KB limit
    const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
    await db.createSession({ caseId, caseNumber: 'S1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 500, encrypted: new ArrayBuffer(500) });
    await db.createSession({ caseId, caseNumber: 'S2', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 500, encrypted: new ArrayBuffer(500) });
    await db.createSession({ caseId, caseNumber: 'S3', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 500, encrypted: new ArrayBuffer(500) });
    const rotated = await sm.rotateIfNeeded();
    expect(rotated).toBeGreaterThan(0);
    const totalAfter = await db.getTotalSize();
    expect(totalAfter).toBeLessThanOrEqual(1024 * 0.95);
  });

  it('never rotates the excluded session', async () => {
    await db.setMeta('max_size', 500);
    const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
    const s1 = await db.createSession({ caseId, caseNumber: 'S1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 400, encrypted: new ArrayBuffer(400) });
    await db.createSession({ caseId, caseNumber: 'S2', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 400, encrypted: new ArrayBuffer(400) });
    await sm.rotateIfNeeded(s1);
    const session1 = await db.getSession(s1);
    expect(session1).toBeDefined();
  });

  it('does not rotate when under limit', async () => {
    const caseId = await db.createCase({ domainId: 'medical', name: 'P' });
    await db.createSession({ caseId, caseNumber: 'S1', duration: 10, segmentCount: 1, findingCount: 0, sizeBytes: 100, encrypted: new ArrayBuffer(100) });
    const rotated = await sm.rotateIfNeeded();
    expect(rotated).toBe(0);
  });

  it('formatSize formats correctly', () => {
    expect(sm.formatSize(500)).toBe('500 B');
    expect(sm.formatSize(1024)).toBe('1.0 KB');
    expect(sm.formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(sm.formatSize(50 * 1024 * 1024)).toBe('50.0 MB');
  });
});
