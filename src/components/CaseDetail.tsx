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
  const [deleteSessionCountdown, setDeleteSessionCountdown] = useState(0);
  const [confirmDeleteCase, setConfirmDeleteCase] = useState(false);
  const [deleteCaseCountdown, setDeleteCaseCountdown] = useState(0);

  const refresh = useCallback(async () => {
    const list = await listSessions(caseItem.id);
    setSessions(list);
  }, [listSessions, caseItem.id]);

  useEffect(() => {
    let cancelled = false;
    listSessions(caseItem.id).then((list) => {
      if (!cancelled) setSessions(list);
    });
    return () => { cancelled = true; };
  }, [listSessions, caseItem.id]);

  // Countdown timer for session delete confirmation
  useEffect(() => {
    if (confirmDeleteSession === null) {
      setDeleteSessionCountdown(0);
      return;
    }
    setDeleteSessionCountdown(5);
    const interval = setInterval(() => {
      setDeleteSessionCountdown(prev => {
        if (prev <= 1) {
          setConfirmDeleteSession(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmDeleteSession]);

  // Countdown timer for case delete confirmation
  useEffect(() => {
    if (!confirmDeleteCase) {
      setDeleteCaseCountdown(0);
      return;
    }
    setDeleteCaseCountdown(5);
    const interval = setInterval(() => {
      setDeleteCaseCountdown(prev => {
        if (prev <= 1) {
          setConfirmDeleteCase(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmDeleteCase]);

  const handleDeleteSession = async (id: string) => {
    if (confirmDeleteSession !== id) {
      setConfirmDeleteSession(id);
      return;
    }
    await onDeleteSession(id);
    setConfirmDeleteSession(null);
    await refresh();
  };

  const handleDeleteCase = async () => {
    if (!confirmDeleteCase) {
      setConfirmDeleteCase(true);
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
          <button className="btn-back" onClick={onBack} aria-label="Back to cases">{'\u2190'} CASES</button>
          <button className="btn-voice-help" onClick={onShowVoiceHelp} aria-label="Show voice command help" title="Voice commands">?</button>
        </div>
        <div className="case-detail-title-row">
          <span className="case-shortid-large" aria-label={`Case ID: ${caseItem.shortId}`}>{caseItem.shortId}</span>
          <h1 className="case-detail-title">{caseItem.name}</h1>
        </div>
        <div className="case-detail-meta">
          <span>{domain.icon} {domain.name}</span>
          <span className="separator" aria-hidden="true">{'\u2502'}</span>
          <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          <span className="separator" aria-hidden="true">{'\u2502'}</span>
          <span>Created {new Date(caseItem.createdAt).toLocaleDateString()}</span>
        </div>
      </header>

      <div className="case-detail-actions">
        <button className="btn-new-session" onClick={onNewSession} aria-label="Start new capture session">
          <span className="rec-dot-static" aria-hidden="true" /> NEW SESSION
        </button>
        <button className="btn-export-case" onClick={onExportCase} aria-label="Export this case">
          EXPORT CASE
        </button>
        <button
          className={`btn-delete-case-detail ${confirmDeleteCase ? 'btn-delete-confirm' : ''}`}
          onClick={handleDeleteCase}
          aria-label={confirmDeleteCase ? `Confirm delete case ${caseItem.name}, resets in ${deleteCaseCountdown} seconds` : `Delete case ${caseItem.name}`}
        >
          {confirmDeleteCase ? `CONFIRM DELETE CASE (${deleteCaseCountdown}s)` : 'DELETE CASE'}
        </button>
      </div>

      <div className="session-timeline">
        <h2 className="section-heading">
          <span className="section-marker" aria-hidden="true">{'\u25B8'}</span>
          SESSION HISTORY
        </h2>

        {sessions.length === 0 && (
          <div className="empty-state-sessions" role="status">
            <p>No sessions recorded yet.</p>
            <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Start your first capture session to begin recording intelligence.</p>
          </div>
        )}

        <div role="list" aria-label="Session history">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="session-card"
              onClick={() => onOpenSession(s)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSession(s); } }}
              role="listitem"
              tabIndex={0}
              aria-label={`Session ${s.caseNumber}, ${formatDate(s.createdAt)}, ${formatDuration(s.duration)}, ${s.segmentCount} segments, ${s.findingCount} findings`}
            >
              <div className="session-card-header">
                <span className="session-card-number">{s.caseNumber}</span>
                <span className="session-card-date">{formatDate(s.createdAt)}</span>
                <button
                  className={`btn-delete-session ${confirmDeleteSession === s.id ? 'btn-delete-confirm' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                  aria-label={confirmDeleteSession === s.id ? `Confirm delete session ${s.caseNumber}, resets in ${deleteSessionCountdown} seconds` : `Delete session ${s.caseNumber}`}
                >
                  {confirmDeleteSession === s.id ? `CONFIRM (${deleteSessionCountdown}s)` : '\u2715'}
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
    </div>
  );
}
