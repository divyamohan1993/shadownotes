import { useState, useEffect, useCallback } from 'react';
import type { VaultCase, VaultSession, DomainProfile } from '../types';

interface Props {
  domain: DomainProfile;
  caseItem: VaultCase;
  listSessions: (caseId: string) => Promise<VaultSession[]>;
  onNewSession: () => void;
  onOpenSession: (session: VaultSession) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onDeleteCase: () => Promise<void>;
  onExportCase: () => void;
  onBack: () => void;
  onShowVoiceHelp: () => void;
}

export function CaseDetail({ domain, caseItem, listSessions, onNewSession, onOpenSession, onDeleteSession, onDeleteCase, onExportCase, onBack, onShowVoiceHelp }: Props) {
  const [sessions, setSessions] = useState<VaultSession[]>([]);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<string | null>(null);
  const [confirmDeleteCase, setConfirmDeleteCase] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listSessions(caseItem.id);
    setSessions(list);
  }, [listSessions, caseItem.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDeleteSession = async (id: string) => {
    if (confirmDeleteSession !== id) {
      setConfirmDeleteSession(id);
      setTimeout(() => setConfirmDeleteSession(null), 5000);
      return;
    }
    await onDeleteSession(id);
    setConfirmDeleteSession(null);
    await refresh();
  };

  const handleDeleteCase = async () => {
    if (!confirmDeleteCase) {
      setConfirmDeleteCase(true);
      setTimeout(() => setConfirmDeleteCase(false), 5000);
      return;
    }
    await onDeleteCase();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="case-detail-screen">
      <header className="case-detail-header">
        <div className="case-detail-header-top">
          <button className="btn-back" onClick={onBack}>{'\u2190'} CASES</button>
          <button className="btn-voice-help" onClick={onShowVoiceHelp} title="Voice commands">?</button>
        </div>
        <div className="case-detail-title-row">
          <span className="case-shortid-large">{caseItem.shortId}</span>
          <h1 className="case-detail-title">{caseItem.name}</h1>
        </div>
        <div className="case-detail-meta">
          <span>{domain.icon} {domain.name}</span>
          <span className="separator">{'\u2502'}</span>
          <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          <span className="separator">{'\u2502'}</span>
          <span>Created {new Date(caseItem.createdAt).toLocaleDateString()}</span>
        </div>
      </header>

      <div className="case-detail-actions">
        <button className="btn-new-session" onClick={onNewSession}>
          <span className="rec-dot-static" /> NEW SESSION
        </button>
        <button className="btn-export-case" onClick={onExportCase}>
          EXPORT CASE
        </button>
        <button
          className={`btn-delete-case-detail ${confirmDeleteCase ? 'btn-delete-confirm' : ''}`}
          onClick={handleDeleteCase}
        >
          {confirmDeleteCase ? 'CONFIRM DELETE CASE' : 'DELETE CASE'}
        </button>
      </div>

      <div className="session-timeline">
        <h2 className="section-heading">
          <span className="section-marker">{'\u25B8'}</span>
          SESSION HISTORY
        </h2>

        {sessions.length === 0 && (
          <div className="empty-state-sessions">
            <p>No sessions recorded yet. Start a new session to begin.</p>
          </div>
        )}

        {sessions.map((s) => (
          <div key={s.id} className="session-card" onClick={() => onOpenSession(s)}>
            <div className="session-card-header">
              <span className="session-card-number">{s.caseNumber}</span>
              <span className="session-card-date">{formatDate(s.createdAt)}</span>
              <button
                className={`btn-delete-session ${confirmDeleteSession === s.id ? 'btn-delete-confirm' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
              >
                {confirmDeleteSession === s.id ? 'CONFIRM' : '\u2715'}
              </button>
            </div>
            <div className="session-card-stats">
              <span>{formatDuration(s.duration)}</span>
              <span>{s.segmentCount} segments</span>
              <span>{s.findingCount} findings</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
