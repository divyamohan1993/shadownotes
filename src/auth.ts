const RP_ID = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'localhost'
  : 'shadownotes.dmj.one';
const RP_NAME = 'ShadowNotes';
const USER_ID = new TextEncoder().encode('shadownotes-vault-user-v1');
const PRF_SALT = new TextEncoder().encode('shadownotes-prf-salt-v1');

/**
 * Check whether the WebAuthn PRF extension is likely supported on this device.
 *
 * Returns `true` if the browser exposes the Web Authentication API and a
 * user-verifying platform authenticator is available. Note: actual PRF support
 * can only be confirmed after a `create()` call.
 *
 * @returns `true` if platform authenticator is available, `false` otherwise.
 */
export async function isPRFSupported(): Promise<boolean> {
  try {
    if (!navigator.credentials || !window.PublicKeyCredential) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Register a new WebAuthn credential and derive key material.
 *
 * If the authenticator supports the PRF extension, the returned `keyMaterial`
 * is the PRF output (deterministic per credential + salt). Otherwise, random
 * 32-byte key material is generated and the caller should persist it -- biometric
 * authentication gates access at unlock time.
 *
 * @returns An object containing:
 *   - `credentialId` -- Base64-encoded credential ID for future authentication.
 *   - `keyMaterial`  -- 32 bytes of key material for vault key derivation.
 *   - `prfAvailable` -- Whether the PRF extension was used.
 */
export async function registerCredential(): Promise<{ credentialId: string; keyMaterial: Uint8Array; prfAvailable: boolean }> {
  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: RP_ID },
      user: { id: USER_ID, name: 'ShadowNotes User', displayName: 'ShadowNotes User' },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential;

  const prfResults = (credential.getClientExtensionResults() as any).prf;
  if (prfResults?.results?.first) {
    return {
      credentialId: bufferToBase64(credential.rawId),
      keyMaterial: new Uint8Array(prfResults.results.first),
      prfAvailable: true,
    };
  }

  // PRF not supported -- generate random key material (biometric auth is the gate)
  const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
  return {
    credentialId: bufferToBase64(credential.rawId),
    keyMaterial,
    prfAvailable: false,
  };
}

/**
 * Authenticate with an existing WebAuthn credential and recover key material.
 *
 * Tries the PRF extension first. If the authenticator does not support PRF,
 * falls back to `storedKeyMaterial` (base64-encoded) that was persisted during
 * registration. Throws `'PRF_AUTH_FAILED'` if neither source is available.
 *
 * @param credentialId      - Base64-encoded credential ID from registration.
 * @param storedKeyMaterial - Optional base64-encoded key material persisted as fallback.
 * @returns 32 bytes of key material for vault key derivation.
 * @throws {Error} With message `'PRF_AUTH_FAILED'` if key material cannot be recovered.
 */
export async function authenticateCredential(credentialId: string, storedKeyMaterial?: string): Promise<Uint8Array> {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: RP_ID,
      allowCredentials: [{
        id: base64ToBuffer(credentialId),
        type: 'public-key',
        transports: ['internal'],
      }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential;

  // Biometric auth succeeded -- try PRF first, fall back to stored key
  const prfResults = (credential.getClientExtensionResults() as any).prf;
  if (prfResults?.results?.first) {
    return new Uint8Array(prfResults.results.first);
  }
  if (storedKeyMaterial) {
    return new Uint8Array(base64ToBuffer(storedKeyMaterial));
  }
  throw new Error('PRF_AUTH_FAILED');
}

/**
 * Convert an ArrayBuffer to a base64 string.
 *
 * Uses a chunked approach to avoid `RangeError: Maximum call stack size exceeded`
 * that occurs with `String.fromCharCode(...largeArray)` on large buffers.
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string back to an ArrayBuffer.
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
