import { describe, it, expect } from 'vitest';
import { checkPRFSupport, isPRFSupported } from '../auth';

describe('auth', () => {
  it('exports checkPRFSupport function', () => {
    expect(typeof checkPRFSupport).toBe('function');
  });

  it('isPRFSupported returns false in jsdom (no WebAuthn)', async () => {
    const result = await isPRFSupported();
    expect(result).toBe(false);
  });

  it('checkPRFSupport delegates to isPRFSupported', async () => {
    const result = await checkPRFSupport();
    expect(result).toBe(false);
  });
});
