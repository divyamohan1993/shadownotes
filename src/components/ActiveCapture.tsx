import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { extractIntelligence } from '../extraction';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { usePerfConfig } from '../perfConfig';
import { parseVoiceCommand, type VoiceCommand } from '../voiceCommands';
import type { SessionData, TranscriptEntry, IntelligenceItem, DomainProfile } from '../types';

interface Props {
  session: SessionData;
  onAddTranscript: (entry: TranscriptEntry) => void;
  onUpdateLastTranscript: (entry: TranscriptEntry) => void;
  onAddIntelligence: (items: IntelligenceItem[]) => void;
  onUpdateIntelligence: (id: string, newContent: string) => void;
  onDeleteIntelligence: (id: string) => void;
  onEndSession: () => void;
  onDiscardSession?: () => void;
  onVoiceCommand?: (cmd: VoiceCommand) => void;
  onShowVoiceHelp?: () => void;
}

type CaptureState = 'idle' | 'listening' | 'extracting';
type CaptureMode = 'voice' | 'text';

function parseLLMResponse(response: string, categories: string[]): IntelligenceItem[] {
  const items: IntelligenceItem[] = [];
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];

  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(cat.toLowerCase(), cat);
  }

  for (const line of response.split('\n')) {
    const match = line.match(/^\[([^\]]+)\]\s*(.+)/);
    if (match) {
      const [, rawCategory, content] = match;
      const resolved = categoryMap.get(rawCategory.toLowerCase().trim());
      if (resolved) {
        items.push({ id: crypto.randomUUID(), category: resolved, content: content.trim(), timestamp });
      }
    }
  }

  return items;
}

function getRelativeTime(timestampStr: string, startTime: Date): string {
  const [h, m, s] = timestampStr.split(':').map(Number);
  const entrySecs = h * 3600 + m * 60 + s;
  const startSecs = startTime.getHours() * 3600 + startTime.getMinutes() * 60 + startTime.getSeconds();
  const diffS = Math.max(0, entrySecs - startSecs);
  const mm = Math.floor(diffS / 60).toString().padStart(2, '0');
  const ss = (diffS % 60).toString().padStart(2, '0');
  return `+${mm}:${ss}`;
}

export function ActiveCapture({ session, onAddTranscript, onUpdateLastTranscript, onAddIntelligence, onUpdateIntelligence, onDeleteIntelligence, onEndSession, onDiscardSession, onVoiceCommand, onShowVoiceHelp }: Props) {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('voice');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Manual add state
  const [manualAddCategory, setManualAddCategory] = useState<string | null>(null);
  const [manualAddValue, setManualAddValue] = useState('');

  // Text entry state
  const [textInput, setTextInput] = useState('');
  const [isTextExtracting, setIsTextExtracting] = useState(false);

  const { config: perfConfig } = usePerfConfig();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const captureStateRef = useRef<CaptureState>('idle');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastInterimUpdateRef = useRef(0);
  const extractionAbortRef = useRef<AbortController | null>(null);

  // Transcript deduplication refs
  const lastFinalTextRef = useRef('');
  const lastFinalTimeRef = useRef(0);
  const accumulatedTextRef = useRef('');

  // LLM model loader
  const { state: llmState, progress: llmProgress, ensure: ensureLLM } = useModelLoader(ModelCategory.Language);
  const llmReadyRef = useRef(false);

  // Mutex for LLM generation — llama.cpp KV cache crashes on concurrent calls
  const llmBusyRef = useRef(false);
  const llmGenerationIdRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { captureStateRef.current = captureState; }, [captureState]);
  useEffect(() => { llmReadyRef.current = llmState === 'ready'; }, [llmState]);
  useEffect(() => { ensureLLM(); }, [ensureLLM]);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Date.now() - session.startTime.getTime();
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }, perfConfig.timerUpdateMs);
    return () => clearInterval(interval);
  }, [session.startTime, perfConfig.timerUpdateMs]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [session.transcripts, liveTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      extractionAbortRef.current?.abort();
    };
  }, []);

  // LLM extraction — serialized with timeout
  const tryLLMExtraction = useCallback(async (text: string, domain: DomainProfile): Promise<IntelligenceItem[]> => {
    if (!perfConfig.llmEnabled || llmBusyRef.current) return [];

    const myId = ++llmGenerationIdRef.current;
    llmBusyRef.current = true;
    try {
      const catList = domain.categories.join(', ');
      const userPrompt = `Extract facts from this transcript. Use ONLY these categories: ${catList}

Format each line exactly as: [Category] fact
Example:
[${domain.categories[0]}] example fact
[${domain.categories[1]}] example fact

Transcript:
${text}

Extracted facts:`;

      const generatePromise = TextGeneration.generate(userPrompt, {
        systemPrompt: domain.systemPrompt,
        maxTokens: perfConfig.maxTokens,
        temperature: perfConfig.temperature,
        topP: 0.9,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM_TIMEOUT')), 30_000),
      );

      const { text: response } = await Promise.race([generatePromise, timeoutPromise]);
      if (llmGenerationIdRef.current !== myId) return [];
      return parseLLMResponse(response, domain.categories);
    } catch (err) {
      if (err instanceof Error && err.message === 'LLM_TIMEOUT') {
        console.warn('[ShadowNotes] LLM timed out — falling back to keyword extraction');
      }
      return [];
    } finally {
      llmBusyRef.current = false;
    }
  }, [perfConfig.llmEnabled, perfConfig.maxTokens, perfConfig.temperature]);

  // Shared extraction: try LLM first, fall back to keywords
  const extractWithFallback = useCallback(async (text: string): Promise<IntelligenceItem[]> => {
    if (!text) return [];
    if (perfConfig.llmEnabled && llmReadyRef.current) {
      const llmItems = await tryLLMExtraction(text, session.domain);
      if (llmItems.length > 0) return llmItems;
    }
    return extractIntelligence(text, session.domain.id);
  }, [perfConfig.llmEnabled, tryLLMExtraction, session.domain]);

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

  // Manual add handlers
  const startManualAdd = useCallback((category: string) => {
    setManualAddCategory(category);
    setManualAddValue('');
  }, []);

  const saveManualAdd = useCallback(() => {
    if (manualAddCategory && manualAddValue.trim()) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      onAddIntelligence([{
        id: crypto.randomUUID(),
        category: manualAddCategory,
        content: manualAddValue.trim(),
        timestamp,
      }]);
    }
    setManualAddCategory(null);
    setManualAddValue('');
  }, [manualAddCategory, manualAddValue, onAddIntelligence]);

  const cancelManualAdd = useCallback(() => {
    setManualAddCategory(null);
    setManualAddValue('');
  }, []);

  // Flush accumulated text and reset tracking refs
  const flushAccumulated = useCallback(() => {
    const text = accumulatedTextRef.current;
    accumulatedTextRef.current = '';
    lastFinalTextRef.current = '';
    lastFinalTimeRef.current = 0;
    setLiveTranscript('');
    return text;
  }, []);

  const startCapture = useCallback(() => {
    setError(null);

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition not supported in this browser. Use Chrome, Edge, or Safari.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (!text) continue;

          const command = parseVoiceCommand(text);
          if (command) {
            onVoiceCommand?.(command);
            continue;
          }

          const now = Date.now();
          const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
          const prev = lastFinalTextRef.current;
          const timeSinceLast = now - lastFinalTimeRef.current;

          const isRefinement = prev && timeSinceLast < 3000 && (
            text.startsWith(prev) || prev.startsWith(text)
          );

          if (isRefinement) {
            const longer = text.length >= prev.length ? text : prev;
            onUpdateLastTranscript({ text: longer, timestamp });
            lastFinalTextRef.current = longer;
            // Update last line in accumulated text
            const parts = accumulatedTextRef.current.split('\n').filter(Boolean);
            parts[parts.length - 1] = longer;
            accumulatedTextRef.current = parts.join('\n');
          } else {
            onAddTranscript({ text, timestamp });
            lastFinalTextRef.current = text;
            accumulatedTextRef.current += (accumulatedTextRef.current ? '\n' : '') + text;
          }
          lastFinalTimeRef.current = now;
          setLiveTranscript('');
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        const now = Date.now();
        if (perfConfig.interimThrottleMs <= 0 || now - lastInterimUpdateRef.current >= perfConfig.interimThrottleMs) {
          lastInterimUpdateRef.current = now;
          setLiveTranscript(interim);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (captureStateRef.current === 'listening') {
        try { recognition.start(); } catch { /* safe to ignore */ }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setCaptureState('listening');
  }, [session.domain, onAddTranscript, onUpdateLastTranscript, perfConfig.interimThrottleMs, onVoiceCommand]);

  // DECODE INTELLIGENCE: stop mic, animate, then extract
  const decodeIntelligence = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    const fullText = flushAccumulated();

    setCaptureState('extracting');
    const abort = new AbortController();
    extractionAbortRef.current = abort;

    // Let animation frame render before starting heavy LLM work
    requestAnimationFrame(() => {
      setTimeout(async () => {
        const items = await extractWithFallback(fullText);
        if (!abort.signal.aborted && items.length > 0) onAddIntelligence(items);
        if (!abort.signal.aborted) setCaptureState('idle');
      }, 500);
    });
  }, [flushAccumulated, extractWithFallback, onAddIntelligence]);

  // Text mode: submit typed notes through extraction pipeline
  const handleTextSubmit = useCallback(async () => {
    const text = textInput.trim();
    if (!text) return;
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    onAddTranscript({ text, timestamp });
    setTextInput('');
    setIsTextExtracting(true);
    try {
      const items = await extractWithFallback(text);
      if (items.length > 0) onAddIntelligence(items);
    } finally {
      setIsTextExtracting(false);
    }
  }, [textInput, extractWithFallback, onAddTranscript, onAddIntelligence]);

  const handleEndSession = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    extractionAbortRef.current?.abort();
    const fullText = flushAccumulated();
    if (fullText) {
      // Fire-and-forget extraction on remaining text
      extractWithFallback(fullText).then(items => {
        if (items.length > 0) onAddIntelligence(items);
      });
    }
    onEndSession();
  }, [flushAccumulated, extractWithFallback, onAddIntelligence, onEndSession]);

  const handleDiscard = useCallback(() => {
    extractionAbortRef.current?.abort();
    onDiscardSession?.();
  }, [onDiscardSession]);

  // Group intelligence by category (memoized)
  const groupedIntel = useMemo(() => session.intelligence.reduce<Record<string, IntelligenceItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {}), [session.intelligence]);

  // LLM status label
  const llmStatusLabel = (() => {
    if (captureState === 'extracting' || isTextExtracting) return 'AI: DECODING...';
    if (!perfConfig.llmEnabled) return 'AI: OFF';
    switch (llmState) {
      case 'downloading': return `AI: ${Math.round(llmProgress * 100)}%`;
      case 'loading': return 'AI: LOADING';
      case 'ready': return 'AI: ACTIVE';
      case 'error': return 'AI: KEYWORDS';
      default: return 'AI: PENDING';
    }
  })();

  return (
    <div className="capture-screen">
      <header className="capture-header">
        <div className="capture-header-left">
          <div className="stamp stamp-small">{session.domain.clearanceLevel}</div>
          <span className="case-number">CASE: {session.caseNumber}</span>
        </div>
        <div className="capture-header-center">
          <span className="session-timer">{elapsed}</span>
        </div>
        <div className="capture-header-right">
          <div className="status-indicator">
            <div className={`status-dot ${captureState === 'extracting' || isTextExtracting ? 'status-extracting' : llmState === 'ready' ? 'status-secure' : 'status-loading'}`} />
            <span>{llmStatusLabel}</span>
          </div>
          {onShowVoiceHelp && (
            <button className="btn-voice-help" onClick={onShowVoiceHelp} title="Voice commands">?</button>
          )}
          {onDiscardSession && (
            <button className="btn-discard" onClick={handleDiscard}>DISCARD</button>
          )}
          <button className="btn-end" onClick={handleEndSession}>
            END SESSION
          </button>
        </div>
      </header>

      <div className="domain-banner">
        <span className="domain-banner-icon">{session.domain.icon}</span>
        <span className="domain-banner-name">{session.domain.codename}</span>
        <span className="domain-banner-type">{session.domain.name}</span>
      </div>

      {captureState === 'listening' && captureMode === 'voice' && (
        <div className="dev-mode-banner">
          <span className="dev-mode-icon">{'\u26A0'}</span>
          <span className="dev-mode-text">
            Click <strong>DECODE INTELLIGENCE</strong> when ready. On production hardware with GPU, extraction runs live.
          </span>
        </div>
      )}

      <div className="capture-body">
        <div className="transcript-panel">
          <div className="panel-header">
            <span className="panel-label">RAW TRANSCRIPT</span>
            <span className="transcript-count">{session.transcripts.length} segments</span>
          </div>

          <div className="transcript-list" ref={transcriptRef}>
            {session.transcripts.length === 0 && captureState === 'idle' && captureMode === 'voice' && (
              <div className="empty-state-capture">
                <p>Begin capture to start recording</p>
              </div>
            )}
            {session.transcripts.length === 0 && captureState === 'listening' && (
              <div className="empty-state-capture">
                <p>Listening... speak now</p>
              </div>
            )}
            {session.transcripts.length === 0 && captureMode === 'text' && captureState === 'idle' && (
              <div className="empty-state-capture">
                <p>Type your notes below and submit to extract intelligence</p>
              </div>
            )}
            {session.transcripts.map((t, i) => (
              <div key={i} className="transcript-entry">
                <span className="transcript-time">[{t.timestamp}]</span>
                <span className="transcript-time-rel">{getRelativeTime(t.timestamp, session.startTime)}</span>
                <span className="transcript-text">{t.text}</span>
              </div>
            ))}
            {liveTranscript && (
              <div className={`transcript-entry ${perfConfig.animationsEnabled ? 'transcript-live' : ''}`}>
                <span className="transcript-time">[...]</span>
                <span className="transcript-text">{liveTranscript}</span>
              </div>
            )}
          </div>

          <div className="capture-controls">
            {/* Mode toggle */}
            <div className="capture-mode-toggle">
              <button className={`capture-mode-btn ${captureMode === 'voice' ? 'active' : ''}`} onClick={() => setCaptureMode('voice')}>MIC</button>
              <button className={`capture-mode-btn ${captureMode === 'text' ? 'active' : ''}`} onClick={() => setCaptureMode('text')}>TEXT</button>
            </div>

            {captureMode === 'voice' ? (
              <>
                {perfConfig.vadBarCount > 0 && (
                  <div className="vad-indicator" data-state={captureState}>
                    <div className="vad-bars">
                      {Array.from({ length: perfConfig.vadBarCount }).map((_, i) => (
                        <div
                          key={i}
                          className={`vad-bar ${captureState === 'listening' && perfConfig.animationsEnabled ? 'vad-bar-active' : ''}`}
                          style={perfConfig.animationsEnabled ? { animationDelay: `${i * 0.08}s` } : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {captureState === 'idle' ? (
                  <button className="btn-capture" onClick={startCapture}>
                    <span className={perfConfig.animationsEnabled ? 'rec-dot' : 'rec-dot-static'} />
                    BEGIN CAPTURE
                  </button>
                ) : captureState === 'extracting' ? (
                  <button className="btn-capture btn-capture-extracting" disabled>
                    <span className="extracting-spinner" />
                    DECODING...
                  </button>
                ) : (
                  <button className="btn-capture btn-capture-decode" onClick={decodeIntelligence}>
                    <span className="decode-icon" />
                    DECODE INTELLIGENCE
                  </button>
                )}
              </>
            ) : (
              <div className="text-input-panel">
                <textarea
                  className="text-input-area"
                  placeholder="Type or paste your notes here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleTextSubmit();
                    }
                  }}
                  rows={4}
                />
                <div className="text-input-actions">
                  <span className="text-input-hint">Ctrl+Enter to submit</span>
                  <button
                    className="btn-text-submit"
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim() || isTextExtracting}
                  >
                    {isTextExtracting ? 'DECODING...' : 'SUBMIT & DECODE'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="intel-panel">
          <div className="panel-header">
            <span className="panel-label">INTELLIGENCE EXTRACT</span>
            <span className="intel-count">{session.intelligence.length} findings</span>
          </div>

          <div className="intel-list">
            {session.intelligence.length === 0 && (captureState === 'extracting' || isTextExtracting) && (
              <div className="empty-state-capture extracting-state">
                <div className="extracting-indicator">
                  <span className="extracting-spinner" />
                  <p>AI is decoding intelligence...</p>
                </div>
              </div>
            )}

            {session.domain.categories.map((cat) => {
              const items = groupedIntel[cat] || [];
              const isAdding = manualAddCategory === cat;
              return (
                <div key={cat} className={`intel-category ${items.length === 0 && !isAdding ? 'intel-category-empty' : ''}`}>
                  <div className="intel-category-header">
                    <span className="intel-stamp">{cat.toUpperCase()}</span>
                    <span className="intel-category-count">{items.length > 0 ? items.length : ''}</span>
                    {!isAdding && (
                      <button
                        className="intel-add-btn"
                        onClick={() => startManualAdd(cat)}
                        title={`Add ${cat} finding`}
                      >
                        + ADD
                      </button>
                    )}
                  </div>

                  {isAdding && (
                    <div className="intel-manual-add">
                      <input
                        className="intel-add-input"
                        placeholder={`Add ${cat.toLowerCase()} finding...`}
                        value={manualAddValue}
                        onChange={(e) => setManualAddValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveManualAdd(); }
                          else if (e.key === 'Escape') cancelManualAdd();
                        }}
                        autoFocus
                      />
                      <div className="intel-add-actions">
                        <button className="intel-add-save" onClick={saveManualAdd}>SAVE</button>
                        <button className="intel-add-cancel" onClick={cancelManualAdd}>{'\u2715'}</button>
                      </div>
                    </div>
                  )}

                  {items.map((item) => (
                    <div key={item.id} className="intel-item">
                      <span className="intel-time">[{item.timestamp}]</span>
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
                        <span className="intel-content intel-content-editable" onClick={() => startEdit(item)} title="Click to edit">
                          {item.content}
                        </span>
                      )}
                      <button className="intel-delete-btn" onClick={() => onDeleteIntelligence(item.id)} title="Remove finding">{'\u2715'}</button>
                    </div>
                  ))}

                  {items.length === 0 && !isAdding && captureState !== 'extracting' && !isTextExtracting && (
                    <div className="intel-category-hint">
                      No findings yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="capture-error">
          <span>[ERROR]</span> {error}
          <button onClick={() => setError(null)}>{'\u2715'}</button>
        </div>
      )}
    </div>
  );
}
