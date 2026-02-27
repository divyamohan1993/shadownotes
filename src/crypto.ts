import type { SessionContent } from './types';

/** HKDF salt -- used with per-case `info` parameter, so same salt is fine here. */
const HKDF_SALT = new TextEncoder().encode('shadownotes-vault-v1');

/**
 * Deterministic PBKDF2 salt for backward compatibility.
 * Includes origin + version to make pre-computed rainbow tables infeasible.
 * New vaults should use a random per-vault salt via `generateVaultSalt()`.
 */
const PBKDF2_SALT_DETERMINISTIC = new TextEncoder().encode(
  'shadownotes-vault-v1-pbkdf2-' +
    (typeof location !== 'undefined' ? location.origin : 'electron'),
);

async function importAsHkdfKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as unknown as ArrayBuffer, 'HKDF', false, ['deriveKey']);
}

function hkdfParams(info: string): HkdfParams {
  return {
    name: 'HKDF',
    hash: 'SHA-256',
    salt: HKDF_SALT,
    info: new TextEncoder().encode(info),
  };
}

const AES_GCM_KEY_PARAMS: AesKeyGenParams = { name: 'AES-GCM', length: 256 };

/**
 * Generate a cryptographically random 32-byte salt for use with PBKDF2.
 *
 * This salt should be stored alongside the vault metadata so that the same
 * passphrase can re-derive the same key. Each vault gets its own unique salt,
 * preventing identical passphrases across vaults from producing identical keys.
 *
 * @returns A random 32-byte `Uint8Array` suitable for PBKDF2 salt.
 */
export function generateVaultSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Derive an AES-256-GCM master key from raw key material (e.g. WebAuthn PRF output).
 *
 * Uses HKDF with SHA-256, a fixed application-level salt, and info label `'master'`.
 * The HKDF salt is shared across all vaults because the per-case `info` parameter
 * provides domain separation.
 *
 * @param keyMaterial - Raw key bytes, typically 32 bytes from WebAuthn PRF or random generation.
 * @returns An AES-256-GCM `CryptoKey` usable for encrypt/decrypt and exportable for sub-key derivation.
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
 *
 * Exports the master key bytes, then uses HKDF with info `'case:<caseId>'` to
 * produce a unique key for each case. This means compromising one case key does
 * not reveal the master key or other case keys.
 *
 * @param masterKey - The vault master `CryptoKey` (must be exportable).
 * @param caseId   - Unique identifier for the case, used as HKDF info.
 * @returns An AES-256-GCM `CryptoKey` scoped to the given case.
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
 * Encrypt `SessionContent` with AES-256-GCM using a random 12-byte IV.
 *
 * The returned `ArrayBuffer` has the IV (12 bytes) prepended to the ciphertext,
 * so the caller does not need to store the IV separately.
 *
 * @param key     - An AES-GCM `CryptoKey` (typically a per-case key).
 * @param content - The session content to encrypt.
 * @returns An `ArrayBuffer` containing `[IV (12 bytes) | ciphertext]`.
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
 * Decrypt an `ArrayBuffer` (IV + ciphertext) back to `SessionContent`.
 *
 * Expects the first 12 bytes to be the AES-GCM IV, with the remainder being
 * the ciphertext. Throws if decryption fails (wrong key, corrupted data, etc.).
 *
 * @param key  - The AES-GCM `CryptoKey` that was used for encryption.
 * @param data - The encrypted buffer in `[IV (12 bytes) | ciphertext]` format.
 * @returns The decrypted `SessionContent`.
 * @throws {DOMException} If the key is wrong or data is corrupted.
 */
export async function decryptContent(key: CryptoKey, data: ArrayBuffer): Promise<SessionContent> {
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const parsed = JSON.parse(new TextDecoder().decode(plaintext));

  // Schema validation: ensure decrypted content matches expected structure
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('DECRYPT_INVALID_SCHEMA: decrypted content is not an object');
  }
  if (!Array.isArray(parsed.transcripts)) {
    throw new Error('DECRYPT_INVALID_SCHEMA: missing transcripts array');
  }
  if (!Array.isArray(parsed.intelligence)) {
    throw new Error('DECRYPT_INVALID_SCHEMA: missing intelligence array');
  }

  return parsed as SessionContent;
}

/**
 * Derive an AES-256-GCM key from a passphrase using PBKDF2 with 600,000 iterations.
 *
 * If a `salt` is provided, it is used directly -- this is the recommended path for
 * new vaults (generate a random salt via `generateVaultSalt()` and persist it in
 * vault metadata). If no salt is provided, a deterministic origin-based salt is used
 * for backward compatibility with existing vaults.
 *
 * @param passphrase - The user-supplied passphrase.
 * @param salt       - Optional per-vault PBKDF2 salt. If omitted, falls back to the
 *                     deterministic origin-based salt for backward compatibility.
 * @returns An AES-256-GCM `CryptoKey` derived from the passphrase.
 */
export async function deriveKeyFromPassphrase(passphrase: string, salt?: Uint8Array): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: (salt ?? PBKDF2_SALT_DETERMINISTIC) as BufferSource,
      iterations: 600_000,
      hash: 'SHA-256',
    },
    baseKey,
    AES_GCM_KEY_PARAMS,
    true, // exportable
    ['encrypt', 'decrypt'],
  );
}
