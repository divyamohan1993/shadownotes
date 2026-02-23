import { useState, useRef, useCallback, useEffect } from 'react';
import { extractIntelligence } from '../extraction';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import type { SessionData, TranscriptEntry, IntelligenceItem, DomainProfile } from '../types';

interface Props {
  session: SessionData;
  onAddTranscript: (entry: TranscriptEntry) => void;
  onUpdateLastTranscript: (entry: TranscriptEntry) => void;
  onAddIntelligence: (items: IntelligenceItem[]) => void;
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
        items.push({ category, content: content.trim(), timestamp });
      }
    }
  }

  return items;
}

export function ActiveCapture({ session, onAddTranscript, onUpdateLastTranscript, onAddIntelligence, onEndSession }: Props) {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const captureStateRef = useRef<CaptureState>('idle');
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Track last committed transcript text for text-based deduplication.
  // The Web Speech API (especially on mobile) finalizes partial utterances on
  // auto-restart, producing "I prescribed" → "I prescribed him" → etc. as
  // separate isFinal results.  We detect these by checking if the new text is
  // a superset of (or identical to) the previous final, and update-in-place.
  const lastFinalTextRef = useRef('');
  const lastFinalTimeRef = useRef(0);
  const pendingExtractionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExtractedTextRef = useRef('');

  // LLM model loader
  const { state: llmState, progress: llmProgress, ensure: ensureLLM } = useModelLoader(ModelCategory.Language);
  const llmReadyRef = useRef(false);

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

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Date.now() - session.startTime.getTime();
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [session.startTime]);

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

  // LLM extraction — async, non-blocking
  const tryLLMExtraction = useCallback(async (text: string, domain: DomainProfile): Promise<IntelligenceItem[]> => {
    try {
      const prompt = `${domain.systemPrompt}\n\nTranscript:\n${text}`;
      const { text: response } = await TextGeneration.generate(prompt);
      return parseLLMResponse(response, domain.categories);
    } catch {
      return [];
    }
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

          // Debounce extraction: wait for refinements to settle before extracting.
          if (pendingExtractionRef.current) {
            clearTimeout(pendingExtractionRef.current);
          }
          lastExtractedTextRef.current = lastFinalTextRef.current;
          pendingExtractionRef.current = setTimeout(() => {
            pendingExtractionRef.current = null;
            const finalText = lastExtractedTextRef.current;
            if (llmReadyRef.current) {
              tryLLMExtraction(finalText, session.domain).then(items => {
                if (items.length > 0) {
                  onAddIntelligence(items);
                } else {
                  const kwItems = extractIntelligence(finalText, session.domain.id);
                  if (kwItems.length > 0) onAddIntelligence(kwItems);
                }
              });
            } else {
              const items = extractIntelligence(finalText, session.domain.id);
              if (items.length > 0) {
                onAddIntelligence(items);
              }
            }
          }, 800);

          setLiveTranscript('');
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        setLiveTranscript(interim);
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
  }, [session.domain, onAddTranscript, onUpdateLastTranscript, onAddIntelligence, tryLLMExtraction]);

  const stopCapture = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (pendingExtractionRef.current) {
      clearTimeout(pendingExtractionRef.current);
      pendingExtractionRef.current = null;
    }
    lastFinalTextRef.current = '';
    lastFinalTimeRef.current = 0;
    lastExtractedTextRef.current = '';
    setCaptureState('idle');
    setLiveTranscript('');
  }, []);

  const handleEndSession = useCallback(() => {
    stopCapture();
    onEndSession();
  }, [stopCapture, onEndSession]);

  // Group intelligence by category
  const groupedIntel = session.intelligence.reduce<Record<string, IntelligenceItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // LLM status label for header
  const llmStatusLabel = (() => {
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
              <div className="transcript-entry transcript-live">
                <span className="transcript-time">[...]</span>
                <span className="transcript-text">{liveTranscript}</span>
              </div>
            )}
          </div>

          {/* Capture controls */}
          <div className="capture-controls">
            <div className="vad-indicator" data-state={captureState}>
              <div className="vad-bars">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className={`vad-bar ${captureState === 'listening' ? 'vad-bar-active' : ''}`}
                    style={{ animationDelay: `${i * 0.08}s` }}
                  />
                ))}
              </div>
            </div>

            {captureState === 'idle' ? (
              <button className="btn-capture" onClick={startCapture}>
                <span className="rec-dot" />
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
                  {items.map((item, i) => (
                    <div key={i} className="intel-item">
                      <span className="intel-time">[{item.timestamp}]</span>
                      <span className="intel-content">{item.content}</span>
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
