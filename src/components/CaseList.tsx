import { useState, useEffect, useCallback, useRef } from 'react';
import type { VaultCase, DomainProfile } from '../types';

interface Props {
  domain: DomainProfile;
  listCases: () => Promise<VaultCase[]>;
  onCreateCase: (name: string) => Promise<void>;
  onOpenCase: (caseItem: VaultCase) => void;
  onDeleteCase: (id: string) => Promise<void>;
  onPinCase: (id: string, pinned: boolean) => Promise<void>;
  onBack: () => void;
  onShowVoiceHelp: () => void;
  storageWarning: string | null;
}

export function CaseList({ domain, listCases, onCreateCase, onOpenCase, onDeleteCase, onPinCase, onBack, onShowVoiceHelp, storageWarning }: Props) {
  const [cases, setCases] = useState<VaultCase[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const newCaseBtnRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    const list = await listCases();
    setCases(list);
  }, [listCases]);

  useEffect(() => {
    let cancelled = false;
    listCases().then((list) => {
      if (!cancelled) setCases(list);
    });
    return () => { cancelled = true; };
  }, [listCases]);

  // Countdown timer for delete confirmation
  useEffect(() => {
    if (confirmDeleteId === null) {
      setDeleteCountdown(0);
      return;
    }
    setDeleteCountdown(5);
    const interval = setInterval(() => {
      setDeleteCountdown(prev => {
        if (prev <= 1) {
          setConfirmDeleteId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmDeleteId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateCase(newName.trim());
    setNewName('');
    setCreating(false);
    await refresh();
    // Return focus to the new case button after creating
    setTimeout(() => newCaseBtnRef.current?.focus(), 0);
  };

  const handleCancelCreate = () => {
    setCreating(false);
    setNewName('');
    // Return focus to the new case button
    setTimeout(() => newCaseBtnRef.current?.focus(), 0);
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await onDeleteCase(id);
    setConfirmDeleteId(null);
    await refresh();
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await onPinCase(id, pinned);
    await refresh();
  };

  const filtered = searchQuery
    ? cases.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.shortId.toLowerCase().includes(searchQuery.toLowerCase()))
    : cases;

  return (
    <div className="cases-screen">
      <header className="cases-header">
        <div className="cases-header-top">
          <button className="btn-back" onClick={onBack} aria-label="Back to domains">{'\u2190'} DOMAINS</button>
          <button className="btn-voice-help" onClick={onShowVoiceHelp} aria-label="Show voice command help" title="Voice commands">?</button>
        </div>
        <div className="cases-title-row">
          <span className="domain-banner-icon" aria-hidden="true">{domain.icon}</span>
          <h1 className="cases-title">{domain.codename}</h1>
          <div className="stamp stamp-small" aria-label={`Clearance level: ${domain.clearanceLevel}`}>{domain.clearanceLevel}</div>
        </div>
        <p className="cases-subtitle">{domain.name} — {cases.length} case{cases.length !== 1 ? 's' : ''}</p>
      </header>

      {storageWarning && (
        <div
          className={`storage-banner ${storageWarning.includes('nearly full') ? 'storage-critical' : 'storage-warning'}`}
          role="alert"
        >
          {'\u26A0'} {storageWarning}
        </div>
      )}

      <div className="cases-toolbar">
        <input
          className="cases-search"
          placeholder="Search cases by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search cases by name or ID"
        />
        <button
          ref={newCaseBtnRef}
          className="btn-new-case"
          onClick={() => setCreating(true)}
          aria-label="Create new case"
        >
          + NEW CASE
        </button>
      </div>

      {creating && (
        <div className="case-create-form" role="form" aria-label="Create new case">
          <input
            className="case-create-input"
            placeholder="Case name (e.g., John Doe, Server Breach Q1)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') handleCancelCreate();
            }}
            autoFocus
            aria-label="New case name"
          />
          <button className="btn-create-confirm" onClick={handleCreate} aria-label="Confirm create case">CREATE</button>
          <button className="btn-create-cancel" onClick={handleCancelCreate} aria-label="Cancel create case">{'\u2715'}</button>
        </div>
      )}

      <div className="cases-grid" role="list" aria-label="Case files">
        {filtered.length === 0 && !creating && (
          <div className="empty-state-cases" role="status">
            {searchQuery ? (
              <p>No cases match your search for "{searchQuery}". Try a different term or clear the search.</p>
            ) : (
              <div>
                <p>No cases yet in {domain.name}.</p>
                <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Click "+ NEW CASE" above to create your first case and start capturing intelligence.</p>
              </div>
            )}
          </div>
        )}
        {filtered.map((c) => (
          <div
            key={c.id}
            className={`case-card ${c.pinned ? 'case-pinned' : ''}`}
            onClick={() => onOpenCase(c)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenCase(c); } }}
            role="listitem"
            tabIndex={0}
            aria-label={`Case: ${c.name}, ID: ${c.shortId}${c.pinned ? ', pinned' : ''}, updated ${new Date(c.updatedAt).toLocaleDateString()}`}
          >
            <div className="case-card-header">
              <button
                className={`btn-pin-case ${c.pinned ? 'btn-pin-active' : ''}`}
                onClick={(e) => { e.stopPropagation(); handlePin(c.id, !c.pinned); }}
                title={c.pinned ? 'Unpin case' : 'Pin case'}
                aria-label={c.pinned ? `Unpin case ${c.name}` : `Pin case ${c.name}`}
                aria-pressed={c.pinned}
              >
                {c.pinned ? '\u2605' : '\u2606'}
              </button>
              <span className="case-shortid">{c.shortId}</span>
              <button
                className={`btn-delete-case ${confirmDeleteId === c.id ? 'btn-delete-confirm' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                title={confirmDeleteId === c.id ? `Confirm delete (${deleteCountdown}s)` : 'Delete case'}
                aria-label={confirmDeleteId === c.id ? `Confirm delete case ${c.name}, resets in ${deleteCountdown} seconds` : `Delete case ${c.name}`}
              >
                {confirmDeleteId === c.id ? `CONFIRM (${deleteCountdown}s)` : '\u2715'}
              </button>
            </div>
            <div className="case-card-name">{c.name}</div>
            <div className="case-card-meta">
              <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
