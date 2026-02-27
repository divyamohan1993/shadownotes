const RP_ID = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'localhost'
  : 'shadownotes.dmj.one';
const RP_NAME = 'ShadowNotes';
const USER_ID = new TextEncoder().encode('shadownotes-vault-user-v1');
const PRF_SALT = new TextEncoder().encode('shadownotes-prf-salt-v1');

export async function isPRFSupported(): Promise<boolean> {
  try {
    if (!navigator.credentials || !window.PublicKeyCredential) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

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

  // PRF not supported — generate random key material (biometric auth is the gate)
  const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
  return {
    credentialId: bufferToBase64(credential.rawId),
    keyMaterial,
    prfAvailable: false,
  };
}

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

  // Biometric auth succeeded — try PRF first, fall back to stored key
  const prfResults = (credential.getClientExtensionResults() as any).prf;
  if (prfResults?.results?.first) {
    return new Uint8Array(prfResults.results.first);
  }
  if (storedKeyMaterial) {
    return new Uint8Array(base64ToBuffer(storedKeyMaterial));
  }
  throw new Error('PRF_AUTH_FAILED');
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
