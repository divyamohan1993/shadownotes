import { useState } from 'react';

interface Props {
  onUnlockPRF: () => void;
  onUnlockPassphrase: (passphrase: string) => void;
  prfSupported: boolean;
  error: string | null;
}

export function VaultUnlock({ onUnlockPRF, onUnlockPassphrase, prfSupported, error }: Props) {
  const [passphrase, setPassphrase] = useState('');

  return (
    <div className="unlock-screen">
      <div className="unlock-container">
        <div className="boot-logo">
          <div className="boot-lock">{'\u{1F512}'}</div>
          <h1 className="boot-title">SHADOW NOTES</h1>
          <div className="boot-subtitle">VAULT AUTHENTICATION REQUIRED</div>
        </div>

        <div className="unlock-methods">
          {prfSupported ? (
            <button className="btn-unlock-prf" onClick={onUnlockPRF}>
              AUTHENTICATE via Windows Hello
            </button>
          ) : (
            <div className="unlock-passphrase">
              <p className="unlock-fallback-note">Windows Hello not available. Enter vault passphrase:</p>
              <input
                type="password"
                className="unlock-input"
                placeholder="Enter passphrase..."
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && passphrase.trim()) onUnlockPassphrase(passphrase.trim()); }}
              />
              <button
                className="btn-unlock-passphrase"
                onClick={() => passphrase.trim() && onUnlockPassphrase(passphrase.trim())}
                disabled={!passphrase.trim()}
              >
                UNLOCK VAULT
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="unlock-error">
            <span>[AUTH ERROR]</span> {error}
          </div>
        )}

        <div className="boot-classification">CLASSIFIED // EYES ONLY</div>
      </div>
    </div>
  );
}
