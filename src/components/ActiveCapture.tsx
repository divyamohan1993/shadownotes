import { useState, useRef, useCallback, useEffect } from 'react';
import { ModelCategory, ModelManager } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { AudioCapture, VAD, SpeechActivity } from '@runanywhere/web-onnx';
import type { SessionData, TranscriptEntry, IntelligenceItem } from '../types';

interface Props {
  session: SessionData;
  onAddTranscript: (entry: TranscriptEntry) => void;
  onAddIntelligence: (items: IntelligenceItem[]) => void;
  onEndSession: () => void;
}

type CaptureState = 'idle' | 'listening' | 'processing-stt' | 'processing-llm';

export function ActiveCapture({ session, onAddTranscript, onAddIntelligence, onEndSession }: Props) {
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [processingText, setProcessingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');

  const micRef = useRef<AudioCapture | null>(null);
  const vadUnsub = useRef<(() => void) | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Audio level stored in ref — never triggers re-render
  const audioLevelRef = useRef(0);
  const barsRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  // Throttle VAD: skip chunks if main thread is overloaded
  const vadBusyRef = useRef(false);

  // Animate VAD bars via rAF — ~15fps cap to stay gentle on slow CPUs
  const lastBarUpdate = useRef(0);
  useEffect(() => {
    let running = true;
    const animate = (now: number) => {
      if (!running) return;
      // Cap bar updates to ~15fps (66ms)
      if (now - lastBarUpdate.current > 66) {
        lastBarUpdate.current = now;
        const container = barsRef.current;
        if (container) {
          const level = audioLevelRef.current;
          const bars = container.children;
          for (let i = 0; i < bars.length; i++) {
            const bar = bars[i] as HTMLElement;
            if (captureState === 'listening') {
              // Use sin-based pseudo-random so it's deterministic per-bar + time
              const phase = (now * 0.003) + (i * 0.8);
              const wave = 0.5 + 0.5 * Math.sin(phase);
              bar.style.height = `${Math.max(4, level * 40 * (0.4 + wave * 0.6))}px`;
            } else {
              bar.style.height = '4px';
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [captureState]);

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
      micRef.current?.stop();
      vadUnsub.current?.();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const processSegment = useCallback(async (audioData: Float32Array) => {
    setCaptureState('processing-stt');
    setProcessingText('Transcribing speech...');

    try {
      const { STT } = await import('@runanywhere/web-onnx');

      const sttResult = await STT.transcribe(audioData);
      const text = sttResult?.text?.trim();

      if (!text) {
        setCaptureState('listening');
        setProcessingText('');
        return;
      }

      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      const entry: TranscriptEntry = { text, timestamp };
      onAddTranscript(entry);
      setLiveTranscript('');

      // Now run LLM analysis
      setCaptureState('processing-llm');
      setProcessingText('Extracting intelligence...');

      // Cap transcript context to last 10 segments to limit LLM input size
      const recentTranscripts = [...session.transcripts, entry].slice(-10);
      const fullTranscript = recentTranscripts.map((t) => t.text).join(' ');

      const { result: resultPromise } = await TextGeneration.generateStream(
        `Transcript:\n"${fullTranscript}"\n\nExtract intelligence:`,
        {
          systemPrompt: session.domain.systemPrompt,
          maxTokens: 256,
          temperature: 0.3,
        },
      );

      const result = await resultPromise;
      const responseText = result.text || '';

      // Parse bracketed categories
      const items: IntelligenceItem[] = [];
      const lines = responseText.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        const match = line.match(/^\[([^\]]+)\]\s*(.+)/);
        if (match) {
          items.push({
            category: match[1],
            content: match[2].trim(),
            timestamp,
          });
        }
      }

      if (items.length > 0) {
        onAddIntelligence(items);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Show error but don't break capture — allow retrying on next speech segment
      setError(msg);
    }

    setCaptureState('listening');
    setProcessingText('');
  }, [session, onAddTranscript, onAddIntelligence]);

  const startCapture = useCallback(async () => {
    setError(null);

    // Verify models are loaded
    if (!ModelManager.getLoadedModel(ModelCategory.Audio)
      || !ModelManager.getLoadedModel(ModelCategory.SpeechRecognition)
      || !ModelManager.getLoadedModel(ModelCategory.Language)) {
      setError('Required models not loaded. Return to session init.');
      return;
    }

    setCaptureState('listening');

    const mic = new AudioCapture({ sampleRate: 16000 });
    micRef.current = mic;

    VAD.reset();

    vadUnsub.current = VAD.onSpeechActivity((activity) => {
      if (activity === SpeechActivity.Ended) {
        const segment = VAD.popSpeechSegment();
        if (segment && segment.samples.length > 1600) {
          processSegment(segment.samples);
        }
      }
    });

    await mic.start(
      (chunk) => {
        // Throttle: skip VAD processing if a previous chunk is still being processed
        if (vadBusyRef.current) return;
        vadBusyRef.current = true;
        try {
          VAD.processSamples(chunk);
        } finally {
          vadBusyRef.current = false;
        }
      },
      (level) => {
        // Store in ref — no React re-render, bar animation reads from ref via rAF
        audioLevelRef.current = level;
      },
    );
  }, [processSegment]);

  const stopCapture = useCallback(() => {
    micRef.current?.stop();
    vadUnsub.current?.();
    setCaptureState('idle');
    audioLevelRef.current = 0;
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
            <div className="status-dot status-secure" />
            <span>AIR-GAPPED</span>
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

          {/* VAD / Mic controls */}
          <div className="capture-controls">
            <div className="vad-indicator" data-state={captureState}>
              <div className="vad-bars" ref={barsRef}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="vad-bar"
                    style={{ height: '4px' }}
                  />
                ))}
              </div>
            </div>

            {processingText && (
              <div className="processing-status">{processingText}</div>
            )}

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
