import { useState, useEffect, useCallback } from 'react';
import { SessionInit } from './components/SessionInit';
import { ActiveCapture } from './components/ActiveCapture';
import { SessionSummary } from './components/SessionSummary';
import type { AppScreen, SessionData, DomainProfile, TranscriptEntry, IntelligenceItem } from './types';
import { generateCaseNumber } from './domains';

export function App() {
  const [booted, setBooted] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('init');
  const [session, setSession] = useState<SessionData | null>(null);
  const [bootPhase, setBootPhase] = useState(0);

  // Quick boot sequence (aesthetic only — no heavy SDK init)
  useEffect(() => {
    const boot = async () => {
      setBootPhase(1);
      await new Promise((r) => setTimeout(r, 400));
      setBootPhase(2);
      await new Promise((r) => setTimeout(r, 300));
      setBootPhase(3);
      await new Promise((r) => setTimeout(r, 300));
      setBootPhase(4);
      await new Promise((r) => setTimeout(r, 200));
      setBooted(true);
    };
    boot();
  }, []);

  // Warn on tab close during active session
  useEffect(() => {
    if (screen === 'capture') {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [screen]);

  const startSession = useCallback((domain: DomainProfile) => {
    setSession({
      domain,
      caseNumber: generateCaseNumber(),
      startTime: new Date(),
      transcripts: [],
      intelligence: [],
    });
    setScreen('capture');
  }, []);

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setSession((prev) => prev ? { ...prev, transcripts: [...prev.transcripts, entry] } : null);
  }, []);

  const addIntelligence = useCallback((items: IntelligenceItem[]) => {
    setSession((prev) => prev ? { ...prev, intelligence: [...prev.intelligence, ...items] } : null);
  }, []);

  const endSession = useCallback(() => {
    setScreen('summary');
  }, []);

  const destroySession = useCallback(() => {
    setSession(null);
    setScreen('init');
  }, []);

  // Boot sequence screen
  if (!booted) {
    return (
      <div className="boot-screen">
        <div className="boot-container">
          <div className="boot-logo">
            <div className="boot-lock">{'\u{1F512}'}</div>
            <h1 className="boot-title">SHADOW NOTES</h1>
            <div className="boot-subtitle">ZERO-TRUST INTELLIGENCE SYSTEM</div>
          </div>

          <div className="boot-log">
            {bootPhase >= 1 && (
              <div className="boot-line done">
                <span className="boot-prefix">[SYS]</span> Initializing secure environment...
                <span className="boot-check">{'\u2713'}</span>
              </div>
            )}
            {bootPhase >= 2 && (
              <div className="boot-line done">
                <span className="boot-prefix">[SEC]</span> Verifying air-gap integrity...
                <span className="boot-check">{'\u2713'}</span>
              </div>
            )}
            {bootPhase >= 3 && (
              <div className={`boot-line ${bootPhase >= 4 ? 'done' : 'active'}`}>
                <span className="boot-prefix">[AI]</span> Loading on-device inference engine...
                {bootPhase >= 4 ? <span className="boot-check">{'\u2713'}</span> : <span className="boot-spinner" />}
              </div>
            )}
          </div>

          <div className="boot-classification">CLASSIFIED // EYES ONLY</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'init' && <SessionInit onStart={startSession} />}
      {screen === 'capture' && session && (
        <ActiveCapture
          session={session}
          onAddTranscript={addTranscript}
          onAddIntelligence={addIntelligence}
          onEndSession={endSession}
        />
      )}
      {screen === 'summary' && session && (
        <SessionSummary session={session} onDestroy={destroySession} />
      )}
    </div>
  );
}
