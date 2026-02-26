import type { SessionContent } from './types';

const SALT = new TextEncoder().encode('shadownotes-vault-v1');

async function importAsHkdfKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as unknown as ArrayBuffer, 'HKDF', false, ['deriveKey']);
}

function hkdfParams(info: string): HkdfParams {
  return {
    name: 'HKDF',
    hash: 'SHA-256',
    salt: SALT,
    info: new TextEncoder().encode(info),
  };
}

const AES_GCM_KEY_PARAMS: AesKeyGenParams = { name: 'AES-GCM', length: 256 };

/**
 * Derive an AES-256-GCM master key from raw key material (e.g. WebAuthn PRF output).
 * Uses HKDF with SHA-256, a fixed salt, and info label 'master'.
 */
export async function deriveKeyFromBytes(keyMaterial: Uint8Array): Promise<CryptoKey> {
  const hkdfKey = await importAsHkdfKey(keyMaterial);
  return crypto.subtle.deriveKey(
    hkdfParams('master'),
    hkdfKey,
    AES_GCM_KEY_PARAMS,
    true, // exportable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Derive a per-case AES-256-GCM key from the master key.
 * Exports the master key bytes, then uses HKDF with info 'case:<caseId>'.
 */
export async function deriveCaseKey(masterKey: CryptoKey, caseId: string): Promise<CryptoKey> {
  const rawMaster = new Uint8Array(await crypto.subtle.exportKey('raw', masterKey));
  const hkdfKey = await importAsHkdfKey(rawMaster);
  return crypto.subtle.deriveKey(
    hkdfParams(`case:${caseId}`),
    hkdfKey,
    AES_GCM_KEY_PARAMS,
    true, // exportable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt SessionContent with AES-GCM using a random 12-byte IV.
 * Returns IV (12 bytes) prepended to ciphertext.
 */
export async function encryptContent(key: CryptoKey, content: SessionContent): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(content));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.byteLength);
  return result.buffer;
}

/**
 * Decrypt an ArrayBuffer (IV + ciphertext) back to SessionContent.
 * First 12 bytes are the IV, remainder is the AES-GCM ciphertext.
 */
export async function decryptContent(key: CryptoKey, data: ArrayBuffer): Promise<SessionContent> {
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as SessionContent;
}

/**
 * Derive an AES-256-GCM key from a passphrase using PBKDF2 (600,000 iterations).
 * Suitable as a fallback when WebAuthn PRF is unavailable.
 */
export async function deriveKeyFromPassphrase(passphrase: string): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 600_000,
      hash: 'SHA-256',
    },
    baseKey,
    AES_GCM_KEY_PARAMS,
    true, // exportable
    ['encrypt', 'decrypt'],
  );
}
