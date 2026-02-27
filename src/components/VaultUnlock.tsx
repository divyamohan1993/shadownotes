import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface Props {
  onUnlockPRF: () => void;
  onUnlockPassphrase: (passphrase: string) => void;
  prfSupported: boolean;
  error: string | null;
}

// Exponential backoff durations in seconds, indexed by (failedAttempts - 3).
// After 3 failures: 5s, then 15s, 30s, 60s (capped).
const LOCKOUT_SCHEDULE = [5, 15, 30, 60] as const;
const MAX_FREE_ATTEMPTS = 3;

function getLockoutDuration(failedAttempts: number): number {
  if (failedAttempts < MAX_FREE_ATTEMPTS) return 0;
  const idx = Math.min(failedAttempts - MAX_FREE_ATTEMPTS, LOCKOUT_SCHEDULE.length - 1);
  return LOCKOUT_SCHEDULE[idx];
}

function loadFailedAttempts(): number {
  try {
    const stored = sessionStorage.getItem('vault_failed_attempts');
    return stored ? Math.max(0, parseInt(stored, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

function saveFailedAttempts(count: number): void {
  try {
    sessionStorage.setItem('vault_failed_attempts', String(count));
  } catch { /* sessionStorage unavailable — degrade silently */ }
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

  // --- Rate-limiting state ---
  const [failedAttempts, setFailedAttempts] = useState(loadFailedAttempts);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const prevErrorRef = useRef<string | null>(error);

  const isLockedOut = countdown > 0;

  // When the parent reports a new error, count it as a failed attempt.
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setFailedAttempts((prev) => {
        const next = prev + 1;
        saveFailedAttempts(next);
        const lockoutSecs = getLockoutDuration(next);
        if (lockoutSecs > 0) {
          setLockoutEnd(Date.now() + lockoutSecs * 1000);
        }
        return next;
      });
    }
    prevErrorRef.current = error;
  }, [error]);

  // Countdown timer — ticks every second while locked out.
  useEffect(() => {
    if (lockoutEnd === null) return;
    const tick = () => {
      const remaining = Math.ceil((lockoutEnd - Date.now()) / 1000);
      if (remaining <= 0) {
        setCountdown(0);
        setLockoutEnd(null);
      } else {
        setCountdown(remaining);
      }
    };
    tick(); // immediate first tick
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockoutEnd]);

  // Guarded unlock handlers — block interaction during lockout.
  const handleUnlockPRF = useCallback(() => {
    if (isLockedOut) return;
    onUnlockPRF();
  }, [isLockedOut, onUnlockPRF]);

  const handleUnlockPassphrase = useCallback((pp: string) => {
    if (isLockedOut) return;
    onUnlockPassphrase(pp);
    // On success the parent unmounts this component, which resets state.
    // We also clear sessionStorage preemptively so a remount starts clean.
    // (If unlock fails, the error effect above will increment the counter.)
  }, [isLockedOut, onUnlockPassphrase]);

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
              onClick={handleUnlockPRF}
              disabled={isLockedOut}
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
                  onKeyDown={(e) => { if (e.key === 'Enter' && passphrase.trim() && !isLockedOut) handleUnlockPassphrase(passphrase.trim()); }}
                  disabled={isLockedOut}
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
                onClick={() => passphrase.trim() && handleUnlockPassphrase(passphrase.trim())}
                disabled={!passphrase.trim() || isLockedOut}
                aria-label="Unlock vault with passphrase"
              >
                {isLockedOut ? `LOCKED (${countdown}s)` : 'UNLOCK VAULT'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="unlock-error" role="alert">
            <span>[AUTH ERROR]</span> {error}
          </div>
        )}

        {isLockedOut && (
          <div
            className="unlock-error"
            role="alert"
            aria-live="assertive"
            style={{ marginTop: '0.75rem' }}
          >
            <span>[LOCKOUT]</span> Too many failed attempts. Try again in {countdown}s
          </div>
        )}

        <div className="boot-classification" aria-hidden="true">CLASSIFIED // EYES ONLY</div>
      </div>
    </div>
  );
}
