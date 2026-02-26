import { describe, it, expect } from 'vitest';
import type { VaultCase, VaultSession, VaultMeta, SessionContent, AppScreen } from '../types';

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

  it('SessionContent holds transcripts and intelligence', () => {
    const content: SessionContent = {
      transcripts: [{ text: 'test', timestamp: '12:00:00' }],
      intelligence: [{ id: '1', category: 'Symptoms', content: 'headache', timestamp: '12:00:01' }],
    };
    expect(content.transcripts).toHaveLength(1);
    expect(content.intelligence).toHaveLength(1);
  });

  it('AppScreen includes new vault screens', () => {
    const screens: AppScreen[] = ['init', 'unlock', 'cases', 'case-detail', 'capture', 'summary'];
    expect(screens).toHaveLength(6);
  });
});
