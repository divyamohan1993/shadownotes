import { useState, useCallback, useRef, useEffect } from 'react';

interface Props {
  mode: 'export' | 'import';
  caseId?: string;
  exportCase: (caseId: string, password: string) => Promise<Blob>;
  importDossier: (file: File, password: string) => Promise<number>;
  onClose: () => void;
}

export function ExportModal({ mode, caseId, exportCase, importDossier, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Store the element that had focus before the modal opened, and focus first input
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    // For import mode, focus the file input first; for export, focus passphrase
    if (mode === 'import' && fileInputRef.current) {
      fileInputRef.current.focus();
    } else {
      inputRef.current?.focus();
    }
    return () => {
      triggerRef.current?.focus();
    };
  }, [mode]);

  // Focus trap: keep tab cycling within the modal
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [onClose, status]);

  const handleExport = useCallback(async () => {
    if (!caseId || !password.trim()) return;
    setStatus('working');
    setMessage('');
    try {
      const blob = await exportCase(caseId, password);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shadownotes-${Date.now()}.shadow`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('done');
      setMessage('Export complete. File downloaded.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Export failed');
    }
  }, [caseId, password, exportCase]);

  const handleImport = useCallback(async () => {
    if (!selectedFile || !password.trim()) return;
    setStatus('working');
    setMessage('');
    try {
      const count = await importDossier(selectedFile, password);
      setStatus('done');
      setMessage(`Imported ${count} session${count !== 1 ? 's' : ''} successfully.`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Import failed. Wrong passphrase?');
    }
  }, [selectedFile, password, importDossier]);

  return (
    <div className="voice-help-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
      <div className="export-modal-card" onClick={(e) => e.stopPropagation()} ref={containerRef}>
        <div className="voice-help-header">
          <h3 id="export-modal-title">{mode === 'export' ? 'EXPORT CASE' : 'IMPORT DOSSIER'}</h3>
          <button className="voice-help-close" onClick={onClose} aria-label="Close modal">{'\u2715'}</button>
        </div>

        {mode === 'import' && (
          <div className="export-field">
            <label className="export-label" htmlFor="import-file-input">SELECT .SHADOW FILE</label>
            <input
              id="import-file-input"
              ref={fileInputRef}
              type="file"
              accept=".shadow,.json"
              className="export-file-input"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              aria-label="Select shadow file to import"
            />
          </div>
        )}

        <div className="export-field">
          <label className="export-label" htmlFor="export-passphrase-input">
            {mode === 'export' ? 'EXPORT PASSPHRASE' : 'IMPORT PASSPHRASE'}
          </label>
          <input
            id="export-passphrase-input"
            ref={inputRef}
            type="password"
            className="export-passphrase-input"
            placeholder={mode === 'export' ? 'Create a passphrase for this export...' : 'Enter the export passphrase...'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (mode === 'export') { handleExport(); } else { handleImport(); }
              }
            }}
            aria-label={mode === 'export' ? 'Create a passphrase for this export' : 'Enter the export passphrase'}
          />
        </div>

        {/* Progress indicator */}
        {status === 'working' && (
          <div className="export-progress" role="status" aria-live="polite">
            <div className="export-progress-bar">
              <div className="export-progress-fill export-progress-indeterminate" />
            </div>
            <span className="export-progress-text">{mode === 'export' ? 'Encrypting and packaging...' : 'Decrypting and importing...'}</span>
          </div>
        )}

        {/* Status message */}
        <div aria-live="polite" aria-atomic="true">
          {message && (
            <div
              className={`export-message ${status === 'error' ? 'export-message-error' : status === 'done' ? 'export-message-success' : ''}`}
              role={status === 'error' ? 'alert' : 'status'}
            >
              {message}
            </div>
          )}
        </div>

        <div className="export-actions">
          <button className="btn-back-case" onClick={onClose} aria-label="Cancel and close modal">CANCEL</button>
          <button
            className="btn-export-confirm"
            onClick={mode === 'export' ? handleExport : handleImport}
            disabled={status === 'working' || !password.trim() || (mode === 'import' && !selectedFile)}
            aria-label={status === 'working' ? 'Processing...' : mode === 'export' ? 'Export case' : 'Import dossier'}
          >
            {status === 'working' ? 'PROCESSING...' : mode === 'export' ? 'EXPORT' : 'IMPORT'}
          </button>
        </div>
      </div>
    </div>
  );
}
