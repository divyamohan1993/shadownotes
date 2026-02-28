import { useState, useEffect, useCallback, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { initSDK, ModelManager, ModelCategory, OPFSStorage, preloadONNXModels, refreshSDKFeatureStatus, getSelectedLlmModelId, getLlmModelMeta, type OnnxPreloadEvent, type OnnxModelState } from './runanywhere';
import { EventBus } from '@runanywhere/web';
import { SessionInit } from './components/SessionInit';
import { ActiveCapture } from './components/ActiveCapture';
import { SessionSummary } from './components/SessionSummary';
import { VaultUnlock } from './components/VaultUnlock';
import { CaseList } from './components/CaseList';
import { CaseDetail } from './components/CaseDetail';
import { VoiceCommandHelp } from './components/VoiceCommandHelp';
import { GlobalSearch } from './components/GlobalSearch';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { ExportModal } from './components/ExportModal';
import { PerfProvider, DebugPanel } from './perfConfig';
import { VaultProvider, useVault } from './VaultContext';
import { isPRFSupported } from './auth';
import { DOMAINS } from './domains';
import { type VoiceCommand } from './voiceCommands';
import { generateCaseNumber } from './domains';
import { useAutoSave } from './hooks/useAutoSave';
import type { AppScreen, SessionData, SessionContent, DomainProfile, TranscriptEntry, IntelligenceItem, VaultCase, VaultSession, SearchResult } from './types';

interface ReviewState {
  sessionId: string;
  content: SessionContent;
  session: VaultSession;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ShadowNotes] Unhandled error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="boot-screen" role="alert">
          <div className="boot-container">
            <div className="boot-logo">
              <div className="boot-lock">{'\u26A0'}</div>
              <h1 className="boot-title">SYSTEM ERROR</h1>
              <div className="boot-subtitle">RECOVERY REQUIRED</div>
            </div>
            <div className="boot-log">
              <div className="boot-line error">
                <span className="boot-prefix">[ERR]</span> {this.state.error?.message || 'Unknown error'}
              </div>
              <div className="boot-line">
                <span className="boot-prefix">[SYS]</span> The AI engine encountered an unexpected error.
              </div>
            </div>
            <button
              className="btn-begin"
              onClick={this.handleReset}
              style={{ marginTop: '1.5rem' }}
            >
              ATTEMPT RECOVERY
            </button>
            <div className="boot-classification">CLASSIFIED // EYES ONLY</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <AppErrorBoundary>
      <PerfProvider>
        <VaultProvider>
          <AppInner />
        </VaultProvider>
      </PerfProvider>
    </AppErrorBoundary>
  );
}

const MAX_PRIOR_CONTEXT_CHARS = 2000;

function buildPriorContextString(items: IntelligenceItem[]): string {
  // Deduplicate by category + normalized content
  const seen = new Map<string, IntelligenceItem>();
  for (const item of items) {
    const key = `${item.category}::${item.content.toLowerCase().trim()}`;
    seen.set(key, item);
  }

  const lines: string[] = [];
  let totalChars = 0;
  for (const item of seen.values()) {
    const line = `[${item.category}] ${item.content}`;
    if (totalChars + line.length + 1 > MAX_PRIOR_CONTEXT_CHARS) break;
    lines.push(line);
    totalChars += line.length + 1;
  }
  return lines.join('\n');
}

function AppInner() {
  const vault = useVault();

  // SDK / boot state
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [bootPhase, setBootPhase] = useState(0);
  const [bootElapsed, setBootElapsed] = useState(0);

  // Unified per-model boot status (LLM + ONNX all use the same shape)
  interface BootModelStatus { state: OnnxModelState; progress: number; name: string; size: string; cached: boolean; error?: string }
  const [llmStatus, setLlmStatus] = useState<BootModelStatus>(() => {
    const meta = getLlmModelMeta(getSelectedLlmModelId());
    return { state: 'pending', progress: 0, name: meta.name + ' Instruct', size: meta.size, cached: false };
  });
  const [vadStatus, setVadStatus] = useState<BootModelStatus>({ state: 'pending', progress: 0, name: 'Silero VAD', size: '2.3 MB', cached: false });
  const [sttStatus, setSttStatus] = useState<BootModelStatus>({ state: 'pending', progress: 0, name: 'Whisper Tiny English', size: '103 MB', cached: false });
  const [ttsStatus, setTtsStatus] = useState<BootModelStatus>({ state: 'pending', progress: 0, name: 'Piper English (Lessac)', size: '64 MB', cached: false });

  // Navigation state
  const [screen, setScreen] = useState<AppScreen>('unlock');
  const [currentDomain, setCurrentDomain] = useState<DomainProfile | null>(null);
  const [currentCase, setCurrentCase] = useState<VaultCase | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);

  // Auth state
  const [prfSupported, setPrfSupported] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active session state (in-memory during recording)
  const [session, setSession] = useState<SessionData | null>(null);

  // Auto-save
  const saveHintRef = useRef<'immediate' | 'debounced' | null>(null);
  const autoSave = useAutoSave(
    session && currentCase ? {
      caseId: currentCase.id,
      caseNumber: session.caseNumber,
      startTime: session.startTime,
      saveDraft: vault.saveDraft,
      updateDraft: vault.updateDraft,
    } : null,
  );

  // Storage warning
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Voice help + keyboard help + search
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Export modal
  const [exportModal, setExportModal] = useState<{ mode: 'export' | 'import'; caseId?: string } | null>(null);

  // Voice delete confirmation
  const [pendingVoiceDelete, setPendingVoiceDelete] = useState<string | null>(null);

  // Auto-lock timer
  const [autoLockMs, setAutoLockMs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('shadownotes-autolock');
      return saved ? parseInt(saved, 10) : 300_000;
    } catch (e) { console.warn('localStorage unavailable:', e); return 300_000; }
  });
  const lastActivityRef = useRef<number | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check PRF support on mount
  useEffect(() => {
    isPRFSupported().then(setPrfSupported);
  }, []);

  // Auto-lock timer
  useEffect(() => {
    if (!vault.isUnlocked || autoLockMs === 0) return;
    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        vault.lock();
        setScreen('unlock');
        setCurrentCase(null);
        setCurrentDomain(null);
        setReview(null);
      }, autoLockMs);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [vault.isUnlocked, autoLockMs, vault]);

  // Persist auto-lock setting
  useEffect(() => {
    try { localStorage.setItem('shadownotes-autolock', String(autoLockMs)); } catch (e) { console.warn('localStorage unavailable:', e); }
  }, [autoLockMs]);

  // Boot elapsed timer — ticks every second so the user sees continuous activity
  useEffect(() => {
    if (sdkReady) return;
    const id = setInterval(() => setBootElapsed(s => s + 1), 1_000);
    return () => clearInterval(id);
  }, [sdkReady]);

  // Yield to main thread so UI repaints between heavy async ops
  const yieldToMain = (): Promise<void> => new Promise(r => setTimeout(r, 0));

  // Boot sequence — phases 1-3 are instant (cosmetic), real async starts at SDK init
  useEffect(() => {
    const bootSequence = async () => {
      setBootPhase(3);
      try {
        await initSDK();
        setBootPhase(4);
        // Phase 5: Load all models — LLM first, then ONNX audio models
        setBootPhase(5);
        await yieldToMain();

        // ── LLM ──────────────────────────────────────────────
        const langModels = ModelManager.getModels().filter((m) => m.modality === ModelCategory.Language);
        if (langModels.length > 0) {
          const selectedId = getSelectedLlmModelId();
          const model = langModels.find(m => m.id === selectedId) ?? langModels[0];

          // Check OPFS cache
          setLlmStatus(s => ({ ...s, state: 'checking' }));
          await yieldToMain();
          const opfs = new OPFSStorage();
          const opfsOk = await opfs.initialize();
          const llmCached = opfsOk && await opfs.hasModel(model.id);
          await yieldToMain();

          if (llmCached) {
            setLlmStatus(s => ({ ...s, state: 'cached', cached: true, progress: 1 }));
            await yieldToMain();
          } else {
            // Download with live progress via EventBus
            setLlmStatus(s => ({ ...s, state: 'downloading', progress: 0 }));
            await yieldToMain();
            const unsub = EventBus.shared.on('model.downloadProgress', (evt) => {
              if (evt.modelId === model.id) {
                setLlmStatus(s => ({ ...s, progress: evt.progress ?? 0 }));
              }
            });
            await ModelManager.downloadModel(model.id);
            unsub();
            await yieldToMain();
          }

          // Load into RAM / GPU
          setLlmStatus(s => ({ ...s, state: 'loading', progress: 1 }));
          await yieldToMain();
          if (!ModelManager.getLoadedModel(ModelCategory.Language)) {
            await ModelManager.loadModel(model.id, { coexist: true });
            await yieldToMain();
          }
          refreshSDKFeatureStatus();
          setLlmStatus(s => ({ ...s, state: 'done' }));
          await yieldToMain();
        }

        // ── ONNX audio models (VAD, STT, TTS) ───────────────
        setBootPhase(6);
        await yieldToMain();
        await preloadONNXModels((event: OnnxPreloadEvent) => {
          const status: BootModelStatus = {
            state: event.state,
            progress: event.progress,
            name: event.modelName,
            size: event.modelSize,
            cached: event.cached,
            error: event.error,
          };
          switch (event.model) {
            case 'VAD': setVadStatus(status); break;
            case 'STT': setSttStatus(status); break;
            case 'TTS': setTtsStatus(status); break;
          }
        });

        setSdkReady(true);
      } catch (err) {
        setSdkError(err instanceof Error ? err.message : String(err));
        setSdkReady(true);
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

  // Start new recording session (loads prior context from previous sessions)
  const handleNewSession = useCallback(async () => {
    if (!currentDomain || !currentCase) return;
    let priorContext: string | undefined;
    try {
      const priorItems = await vault.loadPriorContext(currentCase.id);
      if (priorItems.length > 0) {
        priorContext = buildPriorContextString(priorItems);
      }
    } catch (e) { console.warn('Failed to load prior context:', e); }
    setSession({
      domain: currentDomain,
      caseNumber: generateCaseNumber(),
      startTime: new Date(),
      transcripts: [],
      intelligence: [],
      priorContext,
    });
    setScreen('capture');
  }, [currentDomain, currentCase, vault]);

  // Session data handlers (in-memory + auto-save hints)
  const addTranscript = useCallback((entry: TranscriptEntry) => {
    saveHintRef.current = 'immediate';
    setSession((prev) => prev ? { ...prev, transcripts: [...prev.transcripts, entry] } : null);
  }, []);

  const updateLastTranscript = useCallback((entry: TranscriptEntry) => {
    saveHintRef.current = 'immediate';
    setSession((prev) => {
      if (!prev || prev.transcripts.length === 0) return prev;
      const updated = [...prev.transcripts];
      updated[updated.length - 1] = entry;
      return { ...prev, transcripts: updated };
    });
  }, []);

  const addIntelligence = useCallback((items: IntelligenceItem[]) => {
    saveHintRef.current = 'immediate';
    setSession((prev) => prev ? { ...prev, intelligence: [...prev.intelligence, ...items] } : null);
  }, []);

  const updateIntelligence = useCallback((id: string, newContent: string) => {
    saveHintRef.current = 'debounced';
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, intelligence: prev.intelligence.map((item) => item.id === id ? { ...item, content: newContent } : item) };
    });
  }, []);

  const deleteIntelligence = useCallback((id: string) => {
    saveHintRef.current = 'debounced';
    setSession((prev) => {
      if (!prev) return null;
      return { ...prev, intelligence: prev.intelligence.filter((item) => item.id !== id) };
    });
  }, []);

  // Auto-save: triggered by saveHintRef on session state changes
  useEffect(() => {
    if (!session || !saveHintRef.current) return;
    const content: SessionContent = {
      transcripts: session.transcripts,
      intelligence: session.intelligence,
    };
    if (content.transcripts.length === 0 && content.intelligence.length === 0) return;
    if (saveHintRef.current === 'immediate') {
      autoSave.saveNow(content);
    } else {
      autoSave.saveDebounced(content);
    }
    saveHintRef.current = null;
  }, [session, autoSave]);

  // Save session to vault (finalize draft or create new)
  const handleSaveSession = useCallback(async () => {
    if (!session || !currentCase) return;
    autoSave.cancel();
    const content: SessionContent = {
      transcripts: session.transcripts,
      intelligence: session.intelligence,
    };
    let sessionId = autoSave.getDraftId();
    if (sessionId) {
      // Final update to existing draft
      await vault.updateDraft(currentCase.id, sessionId, content, session.startTime);
    } else {
      // No draft yet — create normally
      const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
      sessionId = await vault.saveSession(currentCase.id, session.caseNumber, duration, content);
    }
    const savedSession = await vault.listSessions(currentCase.id).then(ss => ss.find(s => s.id === sessionId));
    setReview(savedSession ? { sessionId: sessionId!, content, session: savedSession } : null);
    setSession(null);
    setScreen('summary');
    await refreshStorageWarning();
  }, [session, currentCase, vault, autoSave, refreshStorageWarning]);

  // Discard session (delete draft if exists)
  const handleDiscardSession = useCallback(async () => {
    autoSave.cancel();
    const draftId = autoSave.getDraftId();
    if (draftId) {
      await vault.deleteSession(draftId);
    }
    setSession(null);
    setScreen('case-detail');
  }, [autoSave, vault]);

  // Open a saved session for review
  const handleOpenSession = useCallback(async (vaultSession: VaultSession) => {
    if (!currentCase) return;
    try {
      const content = await vault.loadSession(currentCase.id, vaultSession.id);
      setReview({ sessionId: vaultSession.id, content, session: vaultSession });
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
    if (!review || !currentCase) return;
    const updated = {
      ...review.content,
      intelligence: review.content.intelligence.map(item =>
        item.id === id ? { ...item, content: newContent } : item
      ),
    };
    setReview({ ...review, content: updated });
    await vault.updateSession(currentCase.id, review.sessionId, updated);
  }, [review, currentCase, vault]);

  const handleDeleteSavedIntelligence = useCallback(async (id: string) => {
    if (!review || !currentCase) return;
    const updated = {
      ...review.content,
      intelligence: review.content.intelligence.filter(item => item.id !== id),
    };
    setReview({ ...review, content: updated });
    await vault.updateSession(currentCase.id, review.sessionId, updated);
  }, [review, currentCase, vault]);

  // Pin/unpin a case
  const handlePinCase = useCallback(async (id: string, pinned: boolean) => {
    await vault.pinCase(id, pinned);
  }, [vault]);

  // Navigate to a search result
  const handleSearchNavigate = useCallback(async (result: SearchResult) => {
    const domain = DOMAINS.find(d => d.id === result.case.domainId);
    if (!domain) return;
    setCurrentDomain(domain);
    setCurrentCase(result.case);
    try {
      const content = await vault.loadSession(result.case.id, result.session.id);
      setReview({ sessionId: result.session.id, content, session: result.session });
      setScreen('summary');
    } catch (e) {
      console.warn('Failed to load session for search result:', e);
      setScreen('case-detail');
    }
    setShowSearch(false);
  }, [vault]);

  // Back from summary to case detail
  const clearReview = useCallback(() => {
    setReview(null);
    setScreen('case-detail');
  }, []);

  // Voice command handler
  const handleVoiceCommand = useCallback(async (cmd: VoiceCommand) => {
    switch (cmd.action) {
      case 'go-back':
        if (screen === 'capture') handleDiscardSession();
        else if (screen === 'summary') clearReview();
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
        if (screen === 'cases' && currentDomain && cmd.args) {
          const found = await vault.findCase(currentDomain.id, cmd.args);
          if (found) setPendingVoiceDelete(found.id);
        }
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
        if (screen !== 'cases' && currentDomain) {
          setScreen('cases');
        }
        break;
      case 'show-history':
        if (screen !== 'case-detail' && currentCase) {
          setScreen('case-detail');
        }
        break;
      case 'confirm-delete':
        if (pendingVoiceDelete) {
          await vault.deleteCase(pendingVoiceDelete);
          setPendingVoiceDelete(null);
          await refreshStorageWarning();
        }
        break;
    }
  }, [screen, currentDomain, currentCase, vault, handleCreateCase, handleOpenCase, handleNewSession, handleOpenSession, handleSaveSession, handleDiscardSession, clearReview, pendingVoiceDelete, refreshStorageWarning]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      } else if (ctrl && e.key === 'n') {
        e.preventDefault();
        if (screen === 'case-detail') handleNewSession();
      } else if (ctrl && e.key === 's') {
        e.preventDefault();
        if (screen === 'capture') handleSaveSession();
      } else if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); return; }
        if (showVoiceHelp) { setShowVoiceHelp(false); return; }
        if (showKeyboardHelp) { setShowKeyboardHelp(false); return; }
        if (exportModal) { setExportModal(null); return; }
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        setShowKeyboardHelp(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [screen, showSearch, showVoiceHelp, showKeyboardHelp, exportModal, handleNewSession, handleSaveSession]);

  // Helper: render a single model line on the boot screen
  const BootModelLine = ({ prefix, s }: { prefix: string; s: BootModelStatus }) => {
    const cls = s.state === 'done' ? 'done' : s.state === 'error' ? 'error' : (s.state === 'pending' ? '' : 'active');
    return (
      <div className={`boot-line ${cls}`}>
        <span className="boot-prefix">[{prefix}]</span>
        <span>{s.name}</span>
        <span className="boot-size">({s.size})</span>
        {s.state === 'pending' && <span className="boot-dim">waiting...</span>}
        {s.state === 'checking' && <><span className="boot-dim">Checking cache...</span> <span className="boot-spinner" /></>}
        {s.state === 'cached' && <span className="boot-cached">CACHED</span>}
        {s.state === 'downloading' && (
          <>
            <span className="boot-progress-bar"><span className="boot-progress-fill" style={{ width: `${Math.round(s.progress * 100)}%` }} /></span>
            <span className="boot-pct">{Math.round(s.progress * 100)}%</span>
          </>
        )}
        {s.state === 'loading' && <><span className="boot-dim">Loading into memory...</span> <span className="boot-spinner" /></>}
        {s.state === 'done' && (
          <>
            {s.cached && <span className="boot-cached">CACHED</span>}
            <span className="boot-check">{'\u2713'}</span>
          </>
        )}
        {s.state === 'error' && <span className="boot-err-label">FAILED</span>}
      </div>
    );
  };

  // Count how many models are fully loaded
  const modelsDone = [llmStatus, vadStatus, sttStatus, ttsStatus].filter(s => s.state === 'done').length;
  const modelsTotal = 4;

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
            {bootPhase < 1 && (
              <div className="skeleton-shimmer skeleton-shimmer-line" style={{ width: '75%' }} aria-hidden="true" />
            )}
            {bootPhase >= 2 && (
              <div className="boot-line done">
                <span className="boot-prefix">[SEC]</span> Verifying air-gap integrity...
                <span className="boot-check">{'\u2713'}</span>
              </div>
            )}
            {bootPhase >= 1 && bootPhase < 2 && (
              <div className="skeleton-shimmer skeleton-shimmer-line" style={{ width: '70%' }} aria-hidden="true" />
            )}
            {bootPhase >= 3 && (
              <div className={`boot-line ${bootPhase >= 4 ? 'done' : 'active'}`}>
                <span className="boot-prefix">[AI]</span> Loading on-device inference engine...
                {bootPhase >= 4 ? <span className="boot-check">{'\u2713'}</span> : <span className="boot-spinner" />}
              </div>
            )}
            {bootPhase >= 2 && bootPhase < 3 && (
              <div className="skeleton-shimmer skeleton-shimmer-line" style={{ width: '80%' }} aria-hidden="true" />
            )}
            {bootPhase >= 4 && (
              <div className="boot-line done" style={{ opacity: 0.6 }}>
                <span className="boot-prefix">[HW]</span> Device detected
                <span className="boot-check">{'\u2713'}</span>
              </div>
            )}
            {bootPhase >= 5 && (
              <>
                <div className="boot-model-header">
                  <span className="boot-prefix">[DL]</span>
                  <span>Loading AI models ({modelsDone}/{modelsTotal})</span>
                </div>
                <BootModelLine prefix="LLM" s={llmStatus} />
              </>
            )}
            {bootPhase >= 6 && (
              <>
                <BootModelLine prefix="VAD" s={vadStatus} />
                <BootModelLine prefix="STT" s={sttStatus} />
                <BootModelLine prefix="TTS" s={ttsStatus} />
              </>
            )}
            {sdkError && (
              <div className="boot-line error">
                <span className="boot-prefix">[ERR]</span> {sdkError}
              </div>
            )}
          </div>
          <div className="boot-footer">
            <div className="boot-elapsed">{bootElapsed}s elapsed</div>
            <div className="boot-classification">CLASSIFIED // EYES ONLY</div>
          </div>
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
        <SessionInit
          onStart={handleSelectDomain}
          onSearch={() => setShowSearch(true)}
          onImport={() => setExportModal({ mode: 'import' })}
        />
      )}

      {screen === 'cases' && currentDomain && (
        <CaseList
          domain={currentDomain}
          listCases={() => vault.listCases(currentDomain.id)}
          onCreateCase={handleCreateCase}
          onOpenCase={handleOpenCase}
          onDeleteCase={handleDeleteCase}
          onPinCase={handlePinCase}
          onBack={() => setScreen('init')}
          onShowVoiceHelp={() => setShowVoiceHelp(true)}
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
          onExportCase={() => setExportModal({ mode: 'export', caseId: currentCase.id })}
          onBack={() => { setCurrentCase(null); setScreen('cases'); }}
          onShowVoiceHelp={() => setShowVoiceHelp(true)}
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
          onShowVoiceHelp={() => setShowVoiceHelp(true)}
        />
      )}

      {screen === 'summary' && review && currentDomain && (
        <SessionSummary
          domain={currentDomain}
          vaultSession={review.session}
          content={review.content}
          onUpdateIntelligence={handleUpdateSavedIntelligence}
          onDeleteIntelligence={handleDeleteSavedIntelligence}
          onDeleteSession={async () => {
            await vault.deleteSession(review.sessionId);
            clearReview();
          }}
          onBack={clearReview}
        />
      )}

      {showVoiceHelp && (
        <VoiceCommandHelp screen={screen} onClose={() => setShowVoiceHelp(false)} />
      )}

      {showKeyboardHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowKeyboardHelp(false)} />
      )}

      {showSearch && (
        <GlobalSearch
          searchAll={vault.searchAll}
          onNavigate={handleSearchNavigate}
          onClose={() => setShowSearch(false)}
        />
      )}

      {exportModal && (
        <ExportModal
          mode={exportModal.mode}
          caseId={exportModal.caseId}
          exportCase={vault.exportCase}
          importDossier={vault.importDossier}
          onClose={() => setExportModal(null)}
        />
      )}

      <DebugPanel autoLockMs={autoLockMs} onAutoLockChange={setAutoLockMs} />
    </div>
  );
}
