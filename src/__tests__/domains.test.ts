import { describe, it, expect, vi } from 'vitest';
import { DOMAINS, generateCaseNumber } from '../domains';
import type { DomainId } from '../types';

describe('DOMAINS', () => {
  it('has exactly 4 domain profiles', () => {
    expect(DOMAINS).toHaveLength(4);
  });

  it('has unique IDs for each domain', () => {
    const ids = DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique codenames for each domain', () => {
    const codenames = DOMAINS.map((d) => d.codename);
    expect(new Set(codenames).size).toBe(codenames.length);
  });

  it('contains the expected domain IDs', () => {
    const ids = DOMAINS.map((d) => d.id);
    expect(ids).toContain('security');
    expect(ids).toContain('legal');
    expect(ids).toContain('medical');
    expect(ids).toContain('incident');
  });

  describe.each(DOMAINS)('domain "$name"', (domain) => {
    it('has a non-empty name', () => {
      expect(domain.name.length).toBeGreaterThan(0);
    });

    it('has a non-empty codename starting with OPERATION', () => {
      expect(domain.codename).toMatch(/^OPERATION /);
    });

    it('has a non-empty icon', () => {
      expect(domain.icon.length).toBeGreaterThan(0);
    });

    it('has a clearance level', () => {
      expect(domain.clearanceLevel.length).toBeGreaterThan(0);
    });

    it('has at least 3 extraction categories', () => {
      expect(domain.categories.length).toBeGreaterThanOrEqual(3);
    });

    it('has exactly 5 extraction categories', () => {
      expect(domain.categories).toHaveLength(5);
    });

    it('has a non-empty system prompt', () => {
      expect(domain.systemPrompt.length).toBeGreaterThan(50);
    });

    it('system prompt contains all its categories in square brackets', () => {
      for (const cat of domain.categories) {
        expect(domain.systemPrompt).toContain(`[${cat}]`);
      }
    });

    it('system prompt includes extraction rules', () => {
      expect(domain.systemPrompt).toContain('Rules:');
      expect(domain.systemPrompt).toContain('Correct obvious speech recognition errors');
      expect(domain.systemPrompt).toContain('square brackets');
    });

    it('has unique categories within the domain', () => {
      const cats = domain.categories;
      expect(new Set(cats).size).toBe(cats.length);
    });
  });

  describe('Security Audit domain', () => {
    const security = DOMAINS.find((d) => d.id === 'security')!;

    it('has TOP SECRET clearance', () => {
      expect(security.clearanceLevel).toBe('TOP SECRET');
    });

    it('includes Vulnerabilities category', () => {
      expect(security.categories).toContain('Vulnerabilities');
    });

    it('includes Risk Assessment category', () => {
      expect(security.categories).toContain('Risk Assessment');
    });
  });

  describe('Legal Deposition domain', () => {
    const legal = DOMAINS.find((d) => d.id === 'legal')!;

    it('has CONFIDENTIAL clearance', () => {
      expect(legal.clearanceLevel).toBe('CONFIDENTIAL');
    });

    it('includes Contradictions category', () => {
      expect(legal.categories).toContain('Contradictions');
    });
  });

  describe('Medical Notes domain', () => {
    const medical = DOMAINS.find((d) => d.id === 'medical')!;

    it('has RESTRICTED clearance', () => {
      expect(medical.clearanceLevel).toBe('RESTRICTED');
    });

    it('includes Medications category', () => {
      expect(medical.categories).toContain('Medications');
    });
  });

  describe('Incident Report domain', () => {
    const incident = DOMAINS.find((d) => d.id === 'incident')!;

    it('has SECRET clearance', () => {
      expect(incident.clearanceLevel).toBe('SECRET');
    });

    it('includes Root Cause category', () => {
      expect(incident.categories).toContain('Root Cause');
    });
  });
});

describe('generateCaseNumber', () => {
  it('returns a string', () => {
    expect(typeof generateCaseNumber()).toBe('string');
  });

  it('starts with SN- prefix', () => {
    expect(generateCaseNumber()).toMatch(/^SN-/);
  });

  it('matches the expected format SN-YYMMDD-XXXX', () => {
    const cn = generateCaseNumber();
    expect(cn).toMatch(/^SN-\d{6}-[A-Z0-9]{4}$/);
  });

  it('generates unique case numbers', () => {
    const numbers = new Set(Array.from({ length: 100 }, () => generateCaseNumber()));
    // With 4 random chars (36^4 = 1.6M possibilities), 100 should all be unique
    expect(numbers.size).toBe(100);
  });

  it('contains the current date in YYMMDD format', () => {
    const cn = generateCaseNumber();
    const date = new Date();
    const expected = date.toISOString().slice(2, 10).replace(/-/g, '');
    expect(cn).toContain(expected);
  });

  it('uses uppercase letters in the sequence', () => {
    const cn = generateCaseNumber();
    const seq = cn.split('-')[2];
    expect(seq).toBe(seq.toUpperCase());
  });

  it('produces a consistent length', () => {
    for (let i = 0; i < 20; i++) {
      const cn = generateCaseNumber();
      // SN-YYMMDD-XXXX = 2 + 1 + 6 + 1 + 4 = 14
      expect(cn.length).toBe(14);
    }
  });
});
