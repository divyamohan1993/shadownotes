import { describe, it, expect } from 'vitest';
import { deriveKeyFromBytes, deriveCaseKey, encryptContent, decryptContent } from '../crypto';

describe('crypto', () => {
  const mockKeyMaterial = new Uint8Array(32);
  crypto.getRandomValues(mockKeyMaterial);

  it('deriveKeyFromBytes produces a CryptoKey', async () => {
    const key = await deriveKeyFromBytes(mockKeyMaterial);
    expect(key).toBeInstanceOf(CryptoKey);
  });

  it('deriveCaseKey produces different key per caseId', async () => {
    const master = await deriveKeyFromBytes(mockKeyMaterial);
    const key1 = await deriveCaseKey(master, 'case-aaa');
    const key2 = await deriveCaseKey(master, 'case-bbb');
    const raw1 = new Uint8Array(await crypto.subtle.exportKey('raw', key1));
    const raw2 = new Uint8Array(await crypto.subtle.exportKey('raw', key2));
    expect(raw1).not.toEqual(raw2);
  });

  it('encrypt then decrypt round-trips correctly', async () => {
    const master = await deriveKeyFromBytes(mockKeyMaterial);
    const caseKey = await deriveCaseKey(master, 'test-case');
    const original = { transcripts: [{ text: 'hello', timestamp: '12:00:00' }], intelligence: [] };
    const encrypted = await encryptContent(caseKey, original);
    expect(encrypted).toBeInstanceOf(ArrayBuffer);
    expect(encrypted.byteLength).toBeGreaterThan(0);
    const decrypted = await decryptContent(caseKey, encrypted);
    expect(decrypted).toEqual(original);
  });

  it('decrypt with wrong key throws', async () => {
    const master = await deriveKeyFromBytes(mockKeyMaterial);
    const key1 = await deriveCaseKey(master, 'case-1');
    const key2 = await deriveCaseKey(master, 'case-2');
    const encrypted = await encryptContent(key1, { transcripts: [], intelligence: [] });
    await expect(decryptContent(key2, encrypted)).rejects.toThrow();
  });

  it('encrypted output differs for same input (random IV)', async () => {
    const master = await deriveKeyFromBytes(mockKeyMaterial);
    const caseKey = await deriveCaseKey(master, 'test');
    const data = { transcripts: [], intelligence: [] };
    const enc1 = await encryptContent(caseKey, data);
    const enc2 = await encryptContent(caseKey, data);
    expect(new Uint8Array(enc1)).not.toEqual(new Uint8Array(enc2));
  });
});
