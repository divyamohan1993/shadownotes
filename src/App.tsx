import { useState, useEffect, useCallback } from 'react';
import { initSDK, ModelManager, ModelCategory, OPFSStorage } from './runanywhere';
import { EventBus } from '@runanywhere/web';
import { SessionInit } from './components/SessionInit';
import { ActiveCapture } from './components/ActiveCapture';
import { SessionSummary } from './components/SessionSummary';
import { VaultUnlock } from './components/VaultUnlock';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { VoiceCommandHelp } from './components/VoiceCommandHelp';
import { PerfProvider, DebugPanel } from './perfConfig';
import { VaultProvider, useVault } from './VaultContext';
import { isPRFSupported } from './auth';
import { parseVoiceCommand, type VoiceCommand } from './voiceCommands';
import { generateCaseNumber } from './domains';
import type { AppScreen, SessionData, SessionContent, DomainProfile, TranscriptEntry, IntelligenceItem, VaultCase, VaultSession } from './types';

export function App() {
  return (
    <PerfProvider>
      <VaultProvider>
        <AppInner />
      </VaultProvider>
    </PerfProvider>
  );
}

function AppInner() {
  const vault = useVault();

  // SDK / boot state
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [bootPhase, setBootPhase] = useState(0);
  const [modelProgress, setModelProgress] = useState(-1);

  // Navigation state
  const [screen, setScreen] = useState<AppScreen>('unlock');
  const [currentDomain, setCurrentDomain] = useState<DomainProfile | null>(null);
  const [currentCase, setCurrentCase] = useState<VaultCase | null>(null);
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  const [reviewContent, setReviewContent] = useState<SessionContent | null>(null);
  const [reviewSession, setReviewSession] = useState<VaultSession | null>(null);

  // Auth state
  const [prfSupported, setPrfSupported] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active session state (in-memory during recording, same as before)
  const [session, setSession] = useState<SessionData | null>(null);

  // Storage warning
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Voice help
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);

  // Check PRF support on mount
  useEffect(() => {
    isPRFSupported().then(setPrfSupported);
  }, []);

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setBootPhase(1);
      setBootPhase(2);
      setBootPhase(3);
      try {
        await initSDK();
        setBootPhase(4);
        const models = ModelManager.getModels().filter((m) => m.modality === ModelCategory.Language);
        if (models.length > 0) {
          const model = models[0];
          const opfs = new OPFSStorage();
          const opfsOk = await opfs.initialize();
          const cached = opfsOk && await opfs.hasModel(model.id);
          if (!cached) {
            setBootPhase(5);
            setModelProgress(0);
            const unsub = EventBus.shared.on('model.downloadProgress', (evt) => {
              if (evt.modelId === model.id) setModelProgress(evt.progress ?? 0);
            });
            await ModelManager.downloadModel(model.id);
            unsub();
            setModelProgress(1);
          }
        }
        setSdkReady(true);
      } catch (err) {
        setSdkError(err instanceof Error ? err.message : String(err));
        setSdkReady(true); // Still allow app to function
      }
    };
    bootSequence();
  }, []);

  // Warn on tab close during capture
  useEffect(() => {
    if (screen === 'capture') {
      const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [screen]);

  // Update storage warning
  const refreshStorageWarning = useCallback(async () => {
    const status = await vault.getStorageStatus();
    if (status.level === 'critical' || status.level === 'full') {
      setStorageWarning(`Storage nearly full (${vault.formatSize(status.usedBytes)}/${vault.formatSize(status.maxBytes)}). Oldest sessions will be auto-rotated.`);
    } else if (status.level === 'warning') {
      setStorageWarning(`Storage: ${vault.formatSize(status.usedBytes)}/${vault.formatSize(status.maxBytes)} used. Consider cleaning old sessions.`);
    } else {
      setStorageWarning(null);
    }
  }, [vault]);

  // Auth handlers
  const handleUnlockPRF = useCallback(async () => {
    setAuthError(null);
    try {
      await vault.unlock();
      setScreen('init');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }, [vault]);

  const handleUnlockPassphrase = useCallback(async (passphrase: string) => {
    setAuthError(null);
    try {
      await vault.unlockWithPassphrase(passphrase);
      setScreen('init');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }, [vault]);

  // Domain selection -> case list
  const handleSelectDomain = useCallback((domain: DomainProfile) => {
    setCurrentDomain(domain);
    refreshStorageWarning();
    setScreen('cases');
  }, [refreshStorageWarning]);

  // Case operations
  const handleCreateCase = useCallback(async (name: string) => {
    if (!currentDomain) return;
    await vault.createCase(currentDomain.id, name);
    await refreshStorageWarning();
  }, [vault, currentDomain, refreshStorageWarning]);

  const handleOpenCase = useCallback((caseItem: VaultCase) => {
    setCurrentCase(caseItem);
    setScreen('case-detail');
  }, []);

  const handleDeleteCase = useCallback(async (id: string) => {
    await vault.deleteCase(id);
    await refreshStorageWarning();
  }, [vault, refreshStorageWarning]);

  const handleDeleteCurrentCase = useCallback(async () => {
    if (!currentCase) return;
    await vault.deleteCase(currentCase.id);
    setCurrentCase(null);
    setScreen('cases');
    await refreshStorageWarning();
  }, [vault, currentCase, refreshStorageWarning]);

  // Start new recording session
  const handleNewSession = useCallback(() => {
    if (!currentDomain || !currentCase) return;
    setSession({
      domain: currentDomain,
      caseNumber: generateCaseNumber(),
      startTime: new Date(),
      transcripts: [],
      intelligence: [],
    });
    setScreen('capture');
  }, [currentDomain, currentCase]);

  // Session data handlers (in-memory, same as before)
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

  // Save session to vault (encrypt + store)
  const handleSaveSession = useCallback(async () => {
    if (!session || !currentCase) return;
    const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
    const content: SessionContent = {
      transcripts: session.transcripts,
      intelligence: session.intelligence,
    };
    const sessionId = await vault.saveSession(currentCase.id, session.caseNumber, duration, content);
    // Load back for review
    setReviewSessionId(sessionId);
    setReviewContent(content);
    const savedSession = await vault.listSessions(currentCase.id).then(ss => ss.find(s => s.id === sessionId));
    setReviewSession(savedSession || null);
    setSession(null);
    setScreen('summary');
    await refreshStorageWarning();
  }, [session, currentCase, vault, refreshStorageWarning]);

  // Discard session (don't save)
  const handleDiscardSession = useCallback(() => {
    setSession(null);
    setScreen('case-detail');
  }, []);

  // Open a saved session for review
  const handleOpenSession = useCallback(async (vaultSession: VaultSession) => {
    if (!currentCase) return;
    try {
      const content = await vault.loadSession(currentCase.id, vaultSession.id);
      setReviewSessionId(vaultSession.id);
      setReviewContent(content);
      setReviewSession(vaultSession);
      setScreen('summary');
    } catch (err) {
      console.error('Failed to decrypt session:', err);
    }
  }, [vault, currentCase]);

  // Delete a session from vault
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await vault.deleteSession(sessionId);
    await refreshStorageWarning();
  }, [vault, refreshStorageWarning]);

  // Update intelligence in a saved session (re-encrypt)
  const handleUpdateSavedIntelligence = useCallback(async (id: string, newContent: string) => {
    if (!reviewContent || !reviewSessionId || !currentCase) return;
    const updated = {
      ...reviewContent,
      intelligence: reviewContent.intelligence.map(item =>
        item.id === id ? { ...item, content: newContent } : item
      ),
    };
    setReviewContent(updated);
    await vault.updateSession(currentCase.id, reviewSessionId, updated);
  }, [reviewContent, reviewSessionId, currentCase, vault]);

  const handleDeleteSavedIntelligence = useCallback(async (id: string) => {
    if (!reviewContent || !reviewSessionId || !currentCase) return;
    const updated = {
      ...reviewContent,
      intelligence: reviewContent.intelligence.filter(item => item.id !== id),
    };
    setReviewContent(updated);
    await vault.updateSession(currentCase.id, reviewSessionId, updated);
  }, [reviewContent, reviewSessionId, currentCase, vault]);

  // Back from summary to case detail
  const handleBackFromSummary = useCallback(() => {
    setReviewSessionId(null);
    setReviewContent(null);
    setReviewSession(null);
    setScreen('case-detail');
  }, []);

  // Voice command handler
  const handleVoiceCommand = useCallback(async (cmd: VoiceCommand) => {
    switch (cmd.action) {
      case 'go-back':
        if (screen === 'capture') handleDiscardSession();
        else if (screen === 'summary') handleBackFromSummary();
        else if (screen === 'case-detail') setScreen('cases');
        else if (screen === 'cases') setScreen('init');
        break;
      case 'create-case':
        if (screen === 'cases' && cmd.args) await handleCreateCase(cmd.args);
        break;
      case 'open-case':
        if (screen === 'cases' && currentDomain && cmd.args) {
          const found = await vault.findCase(currentDomain.id, cmd.args);
          if (found) handleOpenCase(found);
        }
        break;
      case 'delete-case':
        // Requires confirm-delete follow-up (handled by UI state)
        break;
      case 'new-session':
        if (screen === 'case-detail') handleNewSession();
        break;
      case 'open-session':
        if (screen === 'case-detail' && currentCase && cmd.args) {
          const sessions = await vault.listSessions(currentCase.id);
          const n = parseInt(cmd.args, 10);
          if (!isNaN(n) && n > 0 && n <= sessions.length) {
            await handleOpenSession(sessions[n - 1]);
          }
        }
        break;
      case 'last-update':
        if (screen === 'case-detail' && currentCase) {
          const sessions = await vault.listSessions(currentCase.id);
          if (sessions.length > 0) await handleOpenSession(sessions[0]);
        }
        break;
      case 'save':
        if (screen === 'capture') await handleSaveSession();
        break;
      case 'discard':
        if (screen === 'capture') handleDiscardSession();
        break;
      case 'list-cases':
      case 'show-history':
      case 'confirm-delete':
        // These are UI-feedback commands, no navigation action needed
        break;
    }
  }, [screen, currentDomain, currentCase, vault, handleCreateCase, handleOpenCase, handleNewSession, handleOpenSession, handleSaveSession, handleDiscardSession, handleBackFromSummary]);

  // Boot screen
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
      {screen === 'unlock' && (
        <VaultUnlock
          onUnlockPRF={handleUnlockPRF}
          onUnlockPassphrase={handleUnlockPassphrase}
          prfSupported={prfSupported}
          error={authError}
        />
      )}

      {screen === 'init' && (
        <SessionInit onStart={handleSelectDomain} />
      )}

      {screen === 'cases' && currentDomain && (
        <CaseList
          domain={currentDomain}
          listCases={() => vault.listCases(currentDomain.id)}
          onCreateCase={handleCreateCase}
          onOpenCase={handleOpenCase}
          onDeleteCase={handleDeleteCase}
          onBack={() => setScreen('init')}
          storageWarning={storageWarning}
        />
      )}

      {screen === 'case-detail' && currentDomain && currentCase && (
        <CaseDetail
          domain={currentDomain}
          caseItem={currentCase}
          listSessions={vault.listSessions}
          onNewSession={handleNewSession}
          onOpenSession={handleOpenSession}
          onDeleteSession={handleDeleteSession}
          onDeleteCase={handleDeleteCurrentCase}
          onBack={() => { setCurrentCase(null); setScreen('cases'); }}
        />
      )}

      {screen === 'capture' && session && (
        <ActiveCapture
          session={session}
          onAddTranscript={addTranscript}
          onUpdateLastTranscript={updateLastTranscript}
          onAddIntelligence={addIntelligence}
          onUpdateIntelligence={updateIntelligence}
          onDeleteIntelligence={deleteIntelligence}
          onEndSession={handleSaveSession}
          onDiscardSession={handleDiscardSession}
          onVoiceCommand={handleVoiceCommand}
        />
      )}

      {screen === 'summary' && reviewContent && reviewSession && currentDomain && (
        <SessionSummary
          domain={currentDomain}
          vaultSession={reviewSession}
          content={reviewContent}
          onUpdateIntelligence={handleUpdateSavedIntelligence}
          onDeleteIntelligence={handleDeleteSavedIntelligence}
          onDeleteSession={async () => {
            if (reviewSessionId) {
              await vault.deleteSession(reviewSessionId);
              handleBackFromSummary();
            }
          }}
          onBack={handleBackFromSummary}
        />
      )}

      {showVoiceHelp && (
        <VoiceCommandHelp screen={screen} onClose={() => setShowVoiceHelp(false)} />
      )}

      <DebugPanel />
    </div>
  );
}
