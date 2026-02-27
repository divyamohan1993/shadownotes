import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DomainProfile, VaultSession, SessionContent, IntelligenceItem } from '../types';

interface Props {
  domain: DomainProfile;
  vaultSession: VaultSession;
  content: SessionContent;
  onUpdateIntelligence: (id: string, newContent: string) => void;
  onDeleteIntelligence: (id: string) => void;
  onDeleteSession: () => Promise<void>;
  onBack: () => void;
}

function getRelativeTime(timestampStr: string, sessionCreatedAt: number): string {
  const [h, m, s] = timestampStr.split(':').map(Number);
  const startDate = new Date(sessionCreatedAt);
  const startSecs = startDate.getHours() * 3600 + startDate.getMinutes() * 60 + startDate.getSeconds();
  const entrySecs = h * 3600 + m * 60 + s;
  const diffS = Math.max(0, entrySecs - startSecs);
  const mm = Math.floor(diffS / 60).toString().padStart(2, '0');
  const ss = (diffS % 60).toString().padStart(2, '0');
  return `+${mm}:${ss}`;
}

export function SessionSummary({ domain, vaultSession, content, onUpdateIntelligence, onDeleteIntelligence, onDeleteSession, onBack }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard API may not be available */ }
  }, []);

  const startEdit = useCallback((item: IntelligenceItem) => {
    setEditingId(item.id);
    setEditValue(item.content);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId && editValue.trim()) {
      onUpdateIntelligence(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, onUpdateIntelligence]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValue('');
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDeleteSession();
  };

  // Reset confirm after timeout
  useEffect(() => {
    if (confirmDelete) {
      const t = setTimeout(() => setConfirmDelete(false), 5000);
      return () => clearTimeout(t);
    }
  }, [confirmDelete]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const groupedIntel = useMemo(() => content.intelligence.reduce<Record<string, IntelligenceItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {}), [content.intelligence]);

  // Format full dossier text for copy
  const dossierText = useMemo(() => {
    const lines: string[] = [
      '=== SESSION DOSSIER ===',
      `CASE: ${vaultSession.caseNumber}`,
      `OPERATION: ${domain.codename}`,
      `DOMAIN: ${domain.name}`,
      `CLEARANCE: ${domain.clearanceLevel}`,
      `INITIATED: ${new Date(vaultSession.createdAt).toISOString()}`,
      `DURATION: ${formatDuration(vaultSession.duration)}`,
      '',
      'TRANSCRIPT:',
      ...content.transcripts.map(t => `[${t.timestamp}] ${t.text}`),
      '',
      'INTELLIGENCE:',
    ];
    for (const cat of domain.categories) {
      const items = groupedIntel[cat];
      if (!items || items.length === 0) continue;
      lines.push(`\n--- ${cat.toUpperCase()} ---`);
      for (const item of items) {
        lines.push(`[${item.category}] ${item.content}`);
      }
    }
    return lines.join('\n');
  }, [vaultSession, domain, content, groupedIntel]);

  return (
    <div className="summary-screen">
      {/* Dossier header */}
      <div className="dossier-header">
        <div className="dossier-stamps">
          <div className="stamp stamp-classified">CLASSIFIED</div>
          <div className="stamp stamp-eyes-only">EYES ONLY</div>
        </div>
        <h1 className="dossier-title">SESSION DOSSIER</h1>
        <div className="dossier-meta">
          <div className="dossier-meta-row">
            <span className="meta-label">CASE:</span>
            <span className="meta-value">{vaultSession.caseNumber}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">OPERATION:</span>
            <span className="meta-value">{domain.codename}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">DOMAIN:</span>
            <span className="meta-value">{domain.name}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">CLEARANCE:</span>
            <span className="meta-value">{domain.clearanceLevel}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">INITIATED:</span>
            <span className="meta-value">{new Date(vaultSession.createdAt).toISOString()}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">DURATION:</span>
            <span className="meta-value">{formatDuration(vaultSession.duration)}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">SEGMENTS:</span>
            <span className="meta-value">{content.transcripts.length}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">FINDINGS:</span>
            <span className="meta-value">{content.intelligence.length}</span>
          </div>
        </div>
      </div>

      <div className="dossier-body">
        {/* Transcript section */}
        <div className="dossier-section">
          <div className="dossier-section-header">
            <h2 className="section-heading">
              <span className="section-marker">{'\u{25B8}'}</span>
              RAW TRANSCRIPT
            </h2>
            {content.transcripts.length > 0 && (
              <button
                className={`btn-copy ${copiedId === 'transcript' ? 'copied' : ''}`}
                onClick={() => handleCopy(content.transcripts.map(t => `[${t.timestamp}] ${t.text}`).join('\n'), 'transcript')}
              >
                {copiedId === 'transcript' ? 'COPIED' : 'COPY'}
              </button>
            )}
          </div>
          <div className="dossier-transcript">
            {content.transcripts.length === 0 ? (
              <p className="dossier-empty">No transcript data captured.</p>
            ) : (
              content.transcripts.map((t, i) => (
                <div key={i} className="dossier-transcript-line">
                  <span className="transcript-time">[{t.timestamp}]</span>
                  <span className="transcript-time-rel">{getRelativeTime(t.timestamp, vaultSession.createdAt)}</span>
                  <span>{t.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Intelligence section */}
        <div className="dossier-section">
          <h2 className="section-heading">
            <span className="section-marker">{'\u{25B8}'}</span>
            INTELLIGENCE EXTRACT
          </h2>

          {content.intelligence.length === 0 ? (
            <p className="dossier-empty">No intelligence extracted.</p>
          ) : (
            domain.categories.map((cat) => {
              const items = groupedIntel[cat];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} className="dossier-intel-group">
                  <h3 className="dossier-intel-category">{cat.toUpperCase()}</h3>
                  {items.map((item) => (
                    <div key={item.id} className="dossier-intel-item">
                      <span className="dossier-bullet">{'\u{25CF}'}</span>
                      {editingId === item.id ? (
                        <input
                          className="intel-edit-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } else if (e.key === 'Escape') cancelEdit(); }}
                          onBlur={saveEdit}
                          autoFocus
                        />
                      ) : (
                        <span className="intel-content-editable" onClick={() => startEdit(item)} title="Click to edit">
                          {item.content}
                        </span>
                      )}
                      <span className="intel-time-small">[{item.timestamp}]</span>
                      <button
                        className={`btn-copy ${copiedId === item.id ? 'copied' : ''}`}
                        onClick={() => handleCopy(item.content, item.id)}
                        title="Copy finding"
                      >
                        {copiedId === item.id ? 'COPIED' : 'COPY'}
                      </button>
                      <button className="intel-delete-btn" onClick={() => onDeleteIntelligence(item.id)} title="Remove finding">{'\u2715'}</button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer with delete + back + copy */}
      <div className="dossier-footer">
        <div className="dossier-warning">
          {'\u{26A0}'} Session data is encrypted and stored locally. Deleting is permanent.
        </div>
        <div className="dossier-footer-actions">
          <button className="btn-back-case" onClick={onBack}>
            BACK TO CASE
          </button>
          <button
            className={`btn-copy-dossier ${copiedId === 'dossier' ? 'copied' : ''}`}
            onClick={() => handleCopy(dossierText, 'dossier')}
          >
            {copiedId === 'dossier' ? 'COPIED' : 'COPY DOSSIER'}
          </button>
          <button
            className={`btn-destroy ${confirmDelete ? 'btn-destroy-confirm' : ''}`}
            onClick={handleDelete}
          >
            {confirmDelete ? 'CONFIRM: DELETE SESSION' : 'DELETE SESSION'}
          </button>
        </div>
      </div>
    </div>
  );
}
