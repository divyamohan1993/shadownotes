import { useState, useEffect, useRef, useMemo } from 'react';

interface Props {
  onUnlockPRF: () => void;
  onUnlockPassphrase: (passphrase: string) => void;
  prfSupported: boolean;
  error: string | null;
}

function calcPassphraseStrength(passphrase: string): { label: string; level: 'weak' | 'fair' | 'strong' | 'excellent'; percent: number } {
  if (!passphrase) return { label: '', level: 'weak', percent: 0 };

  // Simple entropy-based calculation
  const len = passphrase.length;
  let charsetSize = 0;
  if (/[a-z]/.test(passphrase)) charsetSize += 26;
  if (/[A-Z]/.test(passphrase)) charsetSize += 26;
  if (/[0-9]/.test(passphrase)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(passphrase)) charsetSize += 32;

  const entropy = charsetSize > 0 ? len * Math.log2(charsetSize) : 0;

  if (entropy < 28) return { label: 'WEAK', level: 'weak', percent: 20 };
  if (entropy < 36) return { label: 'FAIR', level: 'fair', percent: 45 };
  if (entropy < 60) return { label: 'STRONG', level: 'strong', percent: 70 };
  return { label: 'EXCELLENT', level: 'excellent', percent: 100 };
}

export function VaultUnlock({ onUnlockPRF, onUnlockPassphrase, prfSupported, error }: Props) {
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const passphraseInputRef = useRef<HTMLInputElement>(null);
  const prfButtonRef = useRef<HTMLButtonElement>(null);

  const strength = useMemo(() => calcPassphraseStrength(passphrase), [passphrase]);

  // Focus the first interactive element on mount
  useEffect(() => {
    if (prfSupported) {
      prfButtonRef.current?.focus();
    } else {
      passphraseInputRef.current?.focus();
    }
  }, [prfSupported]);

  return (
    <div className="unlock-screen" role="main" aria-label="Vault authentication">
      <div className="unlock-container">
        <div className="boot-logo">
          <div className="boot-lock" aria-hidden="true">{'\u{1F512}'}</div>
          <h1 className="boot-title">SHADOW NOTES</h1>
          <div className="boot-subtitle" id="vault-auth-desc">VAULT AUTHENTICATION REQUIRED</div>
        </div>

        <div className="unlock-methods" aria-describedby="vault-auth-desc">
          {prfSupported ? (
            <button
              ref={prfButtonRef}
              className="btn-unlock-prf"
              onClick={onUnlockPRF}
              aria-label="Authenticate using Windows Hello"
            >
              AUTHENTICATE via Windows Hello
            </button>
          ) : (
            <div className="unlock-passphrase">
              <p className="unlock-fallback-note" id="passphrase-instructions">Windows Hello not available. Enter vault passphrase:</p>
              <div className="unlock-input-wrapper" style={{ position: 'relative' }}>
                <input
                  ref={passphraseInputRef}
                  type={showPassphrase ? 'text' : 'password'}
                  className="unlock-input"
                  placeholder="Enter passphrase..."
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && passphrase.trim()) onUnlockPassphrase(passphrase.trim()); }}
                  aria-label="Vault passphrase"
                  aria-describedby="passphrase-instructions passphrase-strength"
                  autoComplete="current-password"
                />
                <button
                  className="btn-toggle-password"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--green)',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    fontSize: '0.75rem',
                    opacity: 0.7,
                  }}
                >
                  {showPassphrase ? 'HIDE' : 'SHOW'}
                </button>
              </div>

              {/* Passphrase strength indicator */}
              {passphrase.length > 0 && (
                <div className="passphrase-strength" id="passphrase-strength" aria-live="polite">
                  <div className="passphrase-strength-bar" style={{ height: '3px', background: 'var(--darker)', borderRadius: '2px', marginTop: '6px' }}>
                    <div
                      className={`passphrase-strength-fill strength-${strength.level}`}
                      style={{
                        height: '100%',
                        width: `${strength.percent}%`,
                        borderRadius: '2px',
                        transition: 'width 0.3s, background 0.3s',
                        background:
                          strength.level === 'weak' ? '#ff4444' :
                          strength.level === 'fair' ? '#ffaa00' :
                          strength.level === 'strong' ? '#44cc44' :
                          '#00ffaa',
                      }}
                    />
                  </div>
                  <span
                    className="passphrase-strength-label"
                    style={{
                      fontSize: '0.65rem',
                      marginTop: '2px',
                      display: 'block',
                      color:
                        strength.level === 'weak' ? '#ff4444' :
                        strength.level === 'fair' ? '#ffaa00' :
                        strength.level === 'strong' ? '#44cc44' :
                        '#00ffaa',
                    }}
                  >
                    {strength.label}
                  </span>
                </div>
              )}

              <button
                className="btn-unlock-passphrase"
                onClick={() => passphrase.trim() && onUnlockPassphrase(passphrase.trim())}
                disabled={!passphrase.trim()}
                aria-label="Unlock vault with passphrase"
              >
                UNLOCK VAULT
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="unlock-error" role="alert">
            <span>[AUTH ERROR]</span> {error}
          </div>
        )}

        <div className="boot-classification" aria-hidden="true">CLASSIFIED // EYES ONLY</div>
      </div>
    </div>
  );
}
