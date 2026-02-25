import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { extractIntelligence } from '../extraction';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { usePerfConfig } from '../perfConfig';
import type { SessionData, TranscriptEntry, IntelligenceItem, DomainProfile } from '../types';

interface Props {
  session: SessionData;
  onAddTranscript: (entry: TranscriptEntry) => void;
  onUpdateLastTranscript: (entry: TranscriptEntry) => void;
  onAddIntelligence: (items: IntelligenceItem[]) => void;
  onUpdateIntelligence: (id: string, newContent: string) => void;
  onDeleteIntelligence: (id: string) => void;
  onEndSession: () => void;
}

type CaptureState = 'idle' | 'listening';

function parseLLMResponse(response: string, categories: string[]): IntelligenceItem[] {
  const items: IntelligenceItem[] = [];
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const categorySet = new Set(categories);

  for (const line of response.split('\n')) {
    const match = line.match(/^\[([^\]]+)\]\s*(.+)/);
    if (match) {
      const [, category, content] = match;
      if (categorySet.has(category)) {
        items.push({ id: crypto.randomUUID(), category, content: content.trim(), timestamp });
      }
    }
  }

  return items;
}

export function ActiveCapture({ session, onAddTranscript, onUpdateLastTranscript, onAddIntelligence, onUpdateIntelligence, onDeleteIntelligence, onEndSession }: Props) {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { config: perfConfig } = usePerfConfig();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const captureStateRef = useRef<CaptureState>('idle');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastInterimUpdateRef = useRef(0);

  // Track last committed transcript text for text-based deduplication.
  // The Web Speech API (especially on mobile) finalizes partial utterances on
  // auto-restart, producing "I prescribed" → "I prescribed him" → etc. as
  // separate isFinal results.  We detect these by checking if the new text is
  // a superset of (or identical to) the previous final, and update-in-place.
  const lastFinalTextRef = useRef('');
  const lastFinalTimeRef = useRef(0);
  const pendingExtractionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Accumulate ALL transcript segments since last extraction so LLM gets full context
  const accumulatedTextRef = useRef('');

  // LLM model loader
  const { state: llmState, progress: llmProgress, ensure: ensureLLM } = useModelLoader(ModelCategory.Language);
  const llmReadyRef = useRef(false);

  // Mutex for LLM generation — llama.cpp KV cache crashes on concurrent calls
  const llmBusyRef = useRef(false);
  const llmGenerationIdRef = useRef(0);

  // Keep refs in sync with state so callbacks can read current value
  useEffect(() => {
    captureStateRef.current = captureState;
  }, [captureState]);

  useEffect(() => {
    llmReadyRef.current = llmState === 'ready';
  }, [llmState]);

  // Continue/complete LLM loading on mount
  useEffect(() => {
    ensureLLM();
  }, [ensureLLM]);

  // Session timer — interval controlled by perfConfig
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
      if (pendingExtractionRef.current) {
        clearTimeout(pendingExtractionRef.current);
      }
    };
  }, []);

  // LLM extraction — serialized to prevent KV cache crash from concurrent calls
  const tryLLMExtraction = useCallback(async (text: string, domain: DomainProfile): Promise<IntelligenceItem[]> => {
    // Skip if LLM disabled or another generation is already running
    if (!perfConfig.llmEnabled || llmBusyRef.current) return [];

    const myId = ++llmGenerationIdRef.current;
    llmBusyRef.current = true;
    try {
      const { text: response } = await TextGeneration.generate(
        `Transcript:\n${text}\n\nExtract key facts only:`,
        {
          systemPrompt: domain.systemPrompt,
          maxTokens: perfConfig.maxTokens,
          temperature: perfConfig.temperature,
          topP: 0.9,
        },
      );
      // Discard result if a newer request was queued while we were running
      if (llmGenerationIdRef.current !== myId) return [];
      return parseLLMResponse(response, domain.categories);
    } catch {
      return [];
    } finally {
      llmBusyRef.current = false;
    }
  }, [perfConfig.llmEnabled, perfConfig.maxTokens, perfConfig.temperature]);

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

          const now = Date.now();
          const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
          const prev = lastFinalTextRef.current;
          const elapsed = now - lastFinalTimeRef.current;

          // Detect progressive refinements: the new text starts with the
          // previous final (or vice-versa) and arrived within 3 seconds.
          // On mobile Chrome the recognition auto-restarts on silence,
          // finalizing partial utterances each time.
          const isRefinement = prev && elapsed < 3000 && (
            text.startsWith(prev) || prev.startsWith(text)
          );

          if (isRefinement) {
            // Take the longer version and update the last entry in place
            const longer = text.length >= prev.length ? text : prev;
            onUpdateLastTranscript({ text: longer, timestamp });
            lastFinalTextRef.current = longer;
          } else {
            onAddTranscript({ text, timestamp });
            lastFinalTextRef.current = text;
          }
          lastFinalTimeRef.current = now;

          // Accumulate text for batch extraction.
          // On refinement the last segment was updated in-place, so replace
          // the last accumulated segment with the longer version.
          if (isRefinement) {
            const parts = accumulatedTextRef.current.split('\n').filter(Boolean);
            parts[parts.length - 1] = lastFinalTextRef.current;
            accumulatedTextRef.current = parts.join('\n');
          } else {
            accumulatedTextRef.current += (accumulatedTextRef.current ? '\n' : '') + text;
          }

          // Wait for 3 seconds of silence, then run extraction ONCE on
          // the full accumulated transcript.
          if (pendingExtractionRef.current) {
            clearTimeout(pendingExtractionRef.current);
          }
          pendingExtractionRef.current = setTimeout(() => {
            pendingExtractionRef.current = null;
            const fullText = accumulatedTextRef.current;
            accumulatedTextRef.current = '';
            if (!fullText) return;
            if (perfConfig.llmEnabled && llmReadyRef.current) {
              tryLLMExtraction(fullText, session.domain).then(items => {
                if (items.length > 0) {
                  onAddIntelligence(items);
                } else {
                  const kwItems = extractIntelligence(fullText, session.domain.id);
                  if (kwItems.length > 0) onAddIntelligence(kwItems);
                }
              });
            } else {
              const items = extractIntelligence(fullText, session.domain.id);
              if (items.length > 0) {
                onAddIntelligence(items);
              }
            }
          }, 3000);

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
      // 'no-speech' and 'aborted' are normal — don't show to user
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in listening mode (browser stops after silence)
      if (captureStateRef.current === 'listening') {
        try {
          recognition.start();
        } catch {
          // May fail if already started — safe to ignore
        }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setCaptureState('listening');
  }, [session.domain, onAddTranscript, onUpdateLastTranscript, onAddIntelligence, tryLLMExtraction, perfConfig.llmEnabled, perfConfig.interimThrottleMs]);

  const stopCapture = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (pendingExtractionRef.current) {
      clearTimeout(pendingExtractionRef.current);
      pendingExtractionRef.current = null;
    }
    lastFinalTextRef.current = '';
    lastFinalTimeRef.current = 0;
    accumulatedTextRef.current = '';
    setCaptureState('idle');
    setLiveTranscript('');
  }, []);

  const handleEndSession = useCallback(() => {
    stopCapture();
    onEndSession();
  }, [stopCapture, onEndSession]);

  // Group intelligence by category (memoized — avoids recompute on every interim transcript render)
  const groupedIntel = useMemo(() => session.intelligence.reduce<Record<string, IntelligenceItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {}), [session.intelligence]);

  // LLM status label for header
  const llmStatusLabel = (() => {
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
      {/* Header bar */}
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
            <div className={`status-dot ${llmState === 'ready' ? 'status-secure' : 'status-loading'}`} />
            <span>{llmStatusLabel}</span>
          </div>
          <button className="btn-end" onClick={handleEndSession}>
            END SESSION
          </button>
        </div>
      </header>

      {/* Domain banner */}
      <div className="domain-banner">
        <span className="domain-banner-icon">{session.domain.icon}</span>
        <span className="domain-banner-name">{session.domain.codename}</span>
        <span className="domain-banner-type">{session.domain.name}</span>
      </div>

      {/* Main split view */}
      <div className="capture-body">
        {/* Left: Transcript panel */}
        <div className="transcript-panel">
          <div className="panel-header">
            <span className="panel-label">RAW TRANSCRIPT</span>
            <span className="transcript-count">{session.transcripts.length} segments</span>
          </div>

          <div className="transcript-list" ref={transcriptRef}>
            {session.transcripts.length === 0 && captureState === 'idle' && (
              <div className="empty-state-capture">
                <p>Begin capture to start recording</p>
              </div>
            )}
            {session.transcripts.length === 0 && captureState === 'listening' && (
              <div className="empty-state-capture">
                <p>Listening... speak now</p>
              </div>
            )}
            {session.transcripts.map((t, i) => (
              <div key={i} className="transcript-entry">
                <span className="transcript-time">[{t.timestamp}]</span>
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

          {/* Capture controls */}
          <div className="capture-controls">
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
            ) : (
              <button className="btn-capture btn-capture-active" onClick={stopCapture}>
                <span className="stop-icon" />
                PAUSE CAPTURE
              </button>
            )}
          </div>
        </div>

        {/* Right: Intelligence panel */}
        <div className="intel-panel">
          <div className="panel-header">
            <span className="panel-label">INTELLIGENCE EXTRACT</span>
            <span className="intel-count">{session.intelligence.length} findings</span>
          </div>

          <div className="intel-list">
            {session.intelligence.length === 0 && (
              <div className="empty-state-capture">
                <p>Intelligence extractions will appear here as speech is processed</p>
              </div>
            )}
            {session.domain.categories.map((cat) => {
              const items = groupedIntel[cat];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat} className="intel-category">
                  <div className="intel-category-header">
                    <span className="intel-stamp">{cat.toUpperCase()}</span>
                    <span className="intel-category-count">{items.length}</span>
                  </div>
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
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="capture-error">
          <span>[ERROR]</span> {error}
          <button onClick={() => setError(null)}>{'\u2715'}</button>
        </div>
      )}
    </div>
  );
}
