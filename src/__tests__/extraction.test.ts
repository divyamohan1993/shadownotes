import { describe, it, expect } from 'vitest';
import { extractIntelligence } from '../extraction';

describe('extractIntelligence', () => {
  describe('medical domain', () => {
    it('extracts vital signs', () => {
      const items = extractIntelligence('Blood pressure is 140 over 90.', 'medical');
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].category).toBe('Vital Signs');
    });

    it('extracts symptoms', () => {
      const items = extractIntelligence('Patient reports chest pain and nausea.', 'medical');
      expect(items.some((i) => i.category === 'Symptoms')).toBe(true);
    });

    it('extracts diagnoses', () => {
      const items = extractIntelligence('Diagnosed with hypertension and diabetes.', 'medical');
      expect(items.some((i) => i.category === 'Diagnoses')).toBe(true);
    });

    it('extracts medications', () => {
      const items = extractIntelligence('Prescribed Lisinopril 10mg daily.', 'medical');
      expect(items.some((i) => i.category === 'Medications')).toBe(true);
    });

    it('extracts follow-up actions', () => {
      const items = extractIntelligence('Schedule a follow-up appointment in two weeks.', 'medical');
      expect(items.some((i) => i.category === 'Follow-up Actions')).toBe(true);
    });

    it('returns empty for irrelevant text', () => {
      const items = extractIntelligence('The weather is nice today.', 'medical');
      expect(items.length).toBe(0);
    });
  });

  describe('security domain', () => {
    it('extracts vulnerabilities', () => {
      const items = extractIntelligence('Found an open port 22 on the server.', 'security');
      expect(items.some((i) => i.category === 'Vulnerabilities' || i.category === 'Affected Systems')).toBe(true);
    });

    it('extracts timeline entries', () => {
      const items = extractIntelligence('Unauthorized access detected at 02:14 AM.', 'security');
      expect(items.some((i) => i.category === 'Timeline')).toBe(true);
    });

    it('extracts affected systems', () => {
      const items = extractIntelligence('The database server was compromised.', 'security');
      expect(items.some((i) => i.category === 'Affected Systems')).toBe(true);
    });

    it('extracts risk assessment', () => {
      const items = extractIntelligence('This is a critical risk to the organization.', 'security');
      expect(items.some((i) => i.category === 'Risk Assessment')).toBe(true);
    });
  });

  describe('legal domain', () => {
    it('extracts key statements', () => {
      const items = extractIntelligence('The witness testified that they saw the defendant.', 'legal');
      expect(items.some((i) => i.category === 'Key Statements')).toBe(true);
    });

    it('extracts parties involved', () => {
      const items = extractIntelligence('Mr Smith is the plaintiff in this case.', 'legal');
      expect(items.some((i) => i.category === 'Parties Involved')).toBe(true);
    });
  });

  describe('incident domain', () => {
    it('extracts damage assessment', () => {
      const items = extractIntelligence('The building was severely damaged by the flood.', 'incident');
      expect(items.some((i) => i.category === 'Damage Assessment')).toBe(true);
    });

    it('extracts root cause', () => {
      const items = extractIntelligence('The failure was caused by a faulty valve.', 'incident');
      expect(items.some((i) => i.category === 'Root Cause')).toBe(true);
    });

    it('extracts next steps', () => {
      const items = extractIntelligence('We recommend immediate investigation of the area.', 'incident');
      expect(items.some((i) => i.category === 'Next Steps')).toBe(true);
    });
  });

  describe('general behavior', () => {
    it('assigns timestamps', () => {
      const items = extractIntelligence('Patient has chest pain.', 'medical');
      expect(items[0].timestamp).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('deduplicates same content in same category', () => {
      const items = extractIntelligence('Pain. Pain.', 'medical');
      expect(items.length).toBe(1);
    });

    it('handles multiple sentences across categories', () => {
      const items = extractIntelligence(
        'Blood pressure is 140 over 90. Patient reports headache. Prescribed medication 10mg daily.',
        'medical',
      );
      const categories = new Set(items.map((i) => i.category));
      expect(categories.size).toBeGreaterThanOrEqual(2);
    });

    it('returns empty for unknown domain', () => {
      const items = extractIntelligence('test text', 'unknown' as any);
      expect(items.length).toBe(0);
    });

    it('ignores very short segments', () => {
      const items = extractIntelligence('ok.', 'medical');
      expect(items.length).toBe(0);
    });
  });
});
