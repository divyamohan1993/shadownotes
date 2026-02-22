import { useState, useEffect } from 'react';
import type { SessionData, IntelligenceItem } from '../types';

interface Props {
  session: SessionData;
  onDestroy: () => void;
}

export function SessionSummary({ session, onDestroy }: Props) {
  const [destroying, setDestroying] = useState(false);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [burnProgress, setBurnProgress] = useState(0);

  const handleDestroy = () => {
    if (!confirmDestroy) {
      setConfirmDestroy(true);
      return;
    }

    setDestroying(true);
    // Animated burn sequence
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setBurnProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(onDestroy, 300);
      }
    }, 30);
  };

  // Reset confirm after timeout
  useEffect(() => {
    if (confirmDestroy && !destroying) {
      const t = setTimeout(() => setConfirmDestroy(false), 5000);
      return () => clearTimeout(t);
    }
  }, [confirmDestroy, destroying]);

  const duration = () => {
    const diff = Date.now() - session.startTime.getTime();
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}m ${s}s`;
  };

  const groupedIntel = session.intelligence.reduce<Record<string, IntelligenceItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  if (destroying) {
    return (
      <div className="destroy-screen">
        <div className="destroy-overlay" style={{ opacity: burnProgress / 100 }} />
        <div className="destroy-content">
          <div className="destroy-icon">{'\u{1F525}'}</div>
          <h2>DESTROYING SESSION DATA</h2>
          <div className="destroy-bar">
            <div className="destroy-fill" style={{ width: `${burnProgress}%` }} />
          </div>
          <p className="destroy-text">
            {burnProgress < 30 && 'Wiping transcript buffer...'}
            {burnProgress >= 30 && burnProgress < 60 && 'Purging intelligence extracts...'}
            {burnProgress >= 60 && burnProgress < 90 && 'Zeroing session memory...'}
            {burnProgress >= 90 && 'Session destroyed. No trace remains.'}
          </p>
        </div>
      </div>
    );
  }

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
            <span className="meta-value">{session.caseNumber}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">OPERATION:</span>
            <span className="meta-value">{session.domain.codename}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">DOMAIN:</span>
            <span className="meta-value">{session.domain.name}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">CLEARANCE:</span>
            <span className="meta-value">{session.domain.clearanceLevel}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">INITIATED:</span>
            <span className="meta-value">{session.startTime.toISOString()}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">DURATION:</span>
            <span className="meta-value">{duration()}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">SEGMENTS:</span>
            <span className="meta-value">{session.transcripts.length}</span>
          </div>
          <div className="dossier-meta-row">
            <span className="meta-label">FINDINGS:</span>
            <span className="meta-value">{session.intelligence.length}</span>
          </div>
        </div>
      </div>

      <div className="dossier-body">
        {/* Transcript section */}
        <div className="dossier-section">
          <h2 className="section-heading">
            <span className="section-marker">{'\u{25B8}'}</span>
            RAW TRANSCRIPT
          </h2>
          <div className="dossier-transcript">
            {session.transcripts.length === 0 ? (
              <p className="dossier-empty">No transcript data captured.</p>
            ) : (
              session.transcripts.map((t, i) => (
                <div key={i} className="dossier-transcript-line">
                  <span className="transcript-time">[{t.timestamp}]</span>
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

          {session.intelligence.length === 0 ? (
            <p className="dossier-empty">No intelligence extracted.</p>
          ) : (
            session.domain.categories.map((cat) => {
              const items = groupedIntel[cat];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} className="dossier-intel-group">
                  <h3 className="dossier-intel-category">{cat.toUpperCase()}</h3>
                  {items.map((item, i) => (
                    <div key={i} className="dossier-intel-item">
                      <span className="dossier-bullet">{'\u{25CF}'}</span>
                      <span>{item.content}</span>
                      <span className="intel-time-small">[{item.timestamp}]</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Destroy button */}
      <div className="dossier-footer">
        <div className="dossier-warning">
          {'\u{26A0}'} Session data exists only in browser memory. Closing this tab will permanently erase all data.
        </div>
        <button
          className={`btn-destroy ${confirmDestroy ? 'btn-destroy-confirm' : ''}`}
          onClick={handleDestroy}
        >
          {confirmDestroy ? 'CONFIRM: DESTROY ALL SESSION DATA' : 'DESTROY SESSION'}
        </button>
      </div>
    </div>
  );
}
