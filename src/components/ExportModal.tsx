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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleExport = useCallback(async () => {
    if (!caseId || !password.trim()) return;
    setStatus('working');
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
    <div className="voice-help-overlay" onClick={onClose}>
      <div className="export-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="voice-help-header">
          <h3>{mode === 'export' ? 'EXPORT CASE' : 'IMPORT DOSSIER'}</h3>
          <button className="voice-help-close" onClick={onClose}>{'\u2715'}</button>
        </div>

        {mode === 'import' && (
          <div className="export-field">
            <label className="export-label">SELECT .SHADOW FILE</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".shadow,.json"
              className="export-file-input"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        <div className="export-field">
          <label className="export-label">
            {mode === 'export' ? 'EXPORT PASSPHRASE' : 'IMPORT PASSPHRASE'}
          </label>
          <input
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
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        {message && (
          <div className={`export-message ${status === 'error' ? 'export-message-error' : status === 'done' ? 'export-message-success' : ''}`}>
            {message}
          </div>
        )}

        <div className="export-actions">
          <button className="btn-back-case" onClick={onClose}>CANCEL</button>
          <button
            className="btn-export-confirm"
            onClick={mode === 'export' ? handleExport : handleImport}
            disabled={status === 'working' || !password.trim() || (mode === 'import' && !selectedFile)}
          >
            {status === 'working' ? 'PROCESSING...' : mode === 'export' ? 'EXPORT' : 'IMPORT'}
          </button>
        </div>
      </div>
    </div>
  );
}
