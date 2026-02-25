import { useState, useEffect, useCallback } from 'react';
import { initSDK, ModelManager, ModelCategory, OPFSStorage } from './runanywhere';
import { EventBus } from '@runanywhere/web';
import { SessionInit } from './components/SessionInit';
import { ActiveCapture } from './components/ActiveCapture';
import { SessionSummary } from './components/SessionSummary';
import { PerfProvider, DebugPanel } from './perfConfig';
import type { AppScreen, SessionData, DomainProfile, TranscriptEntry, IntelligenceItem } from './types';
import { generateCaseNumber } from './domains';

export function App() {
  return (
    <PerfProvider>
      <AppInner />
    </PerfProvider>
  );
}

function AppInner() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [screen, setScreen] = useState<AppScreen>('init');
  const [session, setSession] = useState<SessionData | null>(null);
  const [bootPhase, setBootPhase] = useState(0);
  const [modelProgress, setModelProgress] = useState(-1); // -1 = not started, 0-1 = downloading

  // Boot sequence with real SDK init + model preload
  useEffect(() => {
    const bootSequence = async () => {
      setBootPhase(1);
      setBootPhase(2);
      setBootPhase(3);

      try {
        await initSDK();
        setBootPhase(4);

        // Download the LLM model only if not already cached in OPFS
        const models = ModelManager.getModels().filter((m) => m.modality === ModelCategory.Language);
        if (models.length > 0) {
          const model = models[0];
          // Check OPFS directly — model.status may not reflect cache yet
          const opfs = new OPFSStorage();
          const opfsOk = await opfs.initialize();
          const cached = opfsOk && await opfs.hasModel(model.id);

          if (!cached) {
            setBootPhase(5);
            setModelProgress(0);
            const unsub = EventBus.shared.on('model.downloadProgress', (evt) => {
              if (evt.modelId === model.id) {
                setModelProgress(evt.progress ?? 0);
              }
            });
            await ModelManager.downloadModel(model.id);
            unsub();
            setModelProgress(1);
          }
        }

        setSdkReady(true);
      } catch (err) {
        setSdkError(err instanceof Error ? err.message : String(err));
      }
    };

    bootSequence();
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

  const updateLastTranscript = useCallback((entry: TranscriptEntry) => {
    setSession((prev) => {
      if (!prev || prev.transcripts.length === 0) return prev;
      const updated = [...prev.transcripts];
      updated[updated.length - 1] = entry;
      return { ...prev, transcripts: updated };
    });
  }, []);

  const addIntelligence = useCallback((items: IntelligenceItem[]) => {
    setSession((prev) => prev ? { ...prev, intelligence: [...prev.intelligence, ...items] } : null);
  }, []);

  const updateIntelligence = useCallback((id: string, newContent: string) => {
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, intelligence: prev.intelligence.map((item) => item.id === id ? { ...item, content: newContent } : item) };
    });
  }, []);

  const deleteIntelligence = useCallback((id: string) => {
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, intelligence: prev.intelligence.filter((item) => item.id !== id) };
    });
  }, []);

  const endSession = useCallback(() => {
    setScreen('summary');
  }, []);

  const destroySession = useCallback(() => {
    setSession(null);
    setScreen('init');
  }, []);

  // Boot sequence screen
  if (!sdkReady) {
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
            {bootPhase >= 5 && (
              <div className={`boot-line ${modelProgress >= 1 ? 'done' : 'active'}`}>
                <span className="boot-prefix">[DL]</span>
                {modelProgress >= 1
                  ? <>Downloading AI model... <span className="boot-check">{'\u2713'}</span></>
                  : <>Downloading AI model... {Math.round(modelProgress * 100)}%</>
                }
              </div>
            )}
            {sdkError && (
              <div className="boot-line error">
                <span className="boot-prefix">[ERR]</span> {sdkError}
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
          onUpdateLastTranscript={updateLastTranscript}
          onAddIntelligence={addIntelligence}
          onUpdateIntelligence={updateIntelligence}
          onDeleteIntelligence={deleteIntelligence}
          onEndSession={endSession}
        />
      )}
      {screen === 'summary' && session && (
        <SessionSummary session={session} onUpdateIntelligence={updateIntelligence} onDeleteIntelligence={deleteIntelligence} onDestroy={destroySession} />
      )}
      <DebugPanel />
    </div>
  );
}
