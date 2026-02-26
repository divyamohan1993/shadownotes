import { describe, it, expect } from 'vitest';
import { isPRFSupported } from '../auth';

describe('auth', () => {
  it('isPRFSupported returns false in jsdom (no WebAuthn)', async () => {
    const result = await isPRFSupported();
    expect(result).toBe(false);
  });
});
