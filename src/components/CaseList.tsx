import { useState, useEffect, useCallback } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateCase(newName.trim());
    setNewName('');
    setCreating(false);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 5000);
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
          <button className="btn-back" onClick={onBack}>{'\u2190'} DOMAINS</button>
          <button className="btn-voice-help" onClick={onShowVoiceHelp} title="Voice commands">?</button>
        </div>
        <div className="cases-title-row">
          <span className="domain-banner-icon">{domain.icon}</span>
          <h1 className="cases-title">{domain.codename}</h1>
          <div className="stamp stamp-small">{domain.clearanceLevel}</div>
        </div>
        <p className="cases-subtitle">{domain.name} — {cases.length} case{cases.length !== 1 ? 's' : ''}</p>
      </header>

      {storageWarning && (
        <div className={`storage-banner ${storageWarning.includes('nearly full') ? 'storage-critical' : 'storage-warning'}`}>
          {'\u26A0'} {storageWarning}
        </div>
      )}

      <div className="cases-toolbar">
        <input
          className="cases-search"
          placeholder="Search cases by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn-new-case" onClick={() => setCreating(true)}>+ NEW CASE</button>
      </div>

      {creating && (
        <div className="case-create-form">
          <input
            className="case-create-input"
            placeholder="Case name (e.g., John Doe, Server Breach Q1)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            autoFocus
          />
          <button className="btn-create-confirm" onClick={handleCreate}>CREATE</button>
          <button className="btn-create-cancel" onClick={() => { setCreating(false); setNewName(''); }}>{'\u2715'}</button>
        </div>
      )}

      <div className="cases-grid">
        {filtered.length === 0 && !creating && (
          <div className="empty-state-cases">
            <p>{searchQuery ? 'No cases match your search.' : 'No cases yet. Create one to begin.'}</p>
          </div>
        )}
        {filtered.map((c) => (
          <div key={c.id} className={`case-card ${c.pinned ? 'case-pinned' : ''}`} onClick={() => onOpenCase(c)}>
            <div className="case-card-header">
              <button
                className={`btn-pin-case ${c.pinned ? 'btn-pin-active' : ''}`}
                onClick={(e) => { e.stopPropagation(); handlePin(c.id, !c.pinned); }}
                title={c.pinned ? 'Unpin case' : 'Pin case'}
              >
                {c.pinned ? '\u2605' : '\u2606'}
              </button>
              <span className="case-shortid">{c.shortId}</span>
              <button
                className={`btn-delete-case ${confirmDeleteId === c.id ? 'btn-delete-confirm' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                title="Delete case"
              >
                {confirmDeleteId === c.id ? 'CONFIRM' : '\u2715'}
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
