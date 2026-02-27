import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { extractIntelligence, getTimestamp } from '../extraction';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelCategory } from '@runanywhere/web';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { StructuredOutput } from '@runanywhere/web-llamacpp';
import { usePerfConfig } from '../perfConfig';
import { parseVoiceCommand, type VoiceCommand } from '../voiceCommands';
import { startVoskCapture, preloadModel, type VoskSession } from '../voskEngine';
import { generateWithOllama, checkOllamaAvailability } from '../ollamaEngine';
import type { VoicePipelineCallbacks } from '../runanywhere';
import type { SessionData, TranscriptEntry, IntelligenceItem, DomainProfile } from '../types';

// RunAnywhere SDK hooks — these are created by parallel agents and may not exist yet.
// Each import is wrapped in a try-safe pattern: the hooks themselves return safe defaults
// when the underlying SDK features are unavailable, so the UI degrades gracefully.
let useAudioPipeline: () => {
  isAvailable: boolean;
  isCapturing: boolean;
  isTranscribing: boolean;
  vadActive: boolean;
  audioLevel: number;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  getInterimTranscript: () => string;
  error: string | null;
};
let useTTS: () => {
  isAvailable: boolean;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
};
let useEmbeddings: () => {
  isAvailable: boolean;
  deduplicate: (items: IntelligenceItem[], threshold?: number) => Promise<IntelligenceItem[]>;
  findSimilar: (query: string, items: IntelligenceItem[], topK?: number) => Promise<IntelligenceItem[]>;
  buildRAGContext: (query: string, priorItems: IntelligenceItem[], topK?: number) => Promise<string>;
};
let extractWithTools: (text: string, domain: DomainProfile, systemPrompt: string) => Promise<IntelligenceItem[]>;

// Graceful dynamic imports — fall back to no-op stubs if modules are not yet available
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ useAudioPipeline } = require('../hooks/useAudioPipeline'));
} catch {
  useAudioPipeline = () => ({
    isAvailable: false, isCapturing: false, isTranscribing: false,
    vadActive: false, audioLevel: 0,
    startCapture: async () => {}, stopCapture: () => {},
    getInterimTranscript: () => '', error: null,
  });
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ useTTS } = require('../hooks/useTTS'));
} catch {
  useTTS = () => ({
    isAvailable: false, isSpeaking: false,
    speak: () => {}, stop: () => {},
  });
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ useEmbeddings } = require('../hooks/useEmbeddings'));
} catch {
  useEmbeddings = () => ({
    isAvailable: false,
    deduplicate: async (items: IntelligenceItem[]) => items,
    findSimilar: async () => [],
    buildRAGContext: async () => '',
  });
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ extractWithTools } = require('../toolExtraction'));
} catch {
  extractWithTools = async () => [];
}

// Voice Agent SDK features — loaded dynamically so tests pass without ONNX WASM
let createVoiceAgent: (systemPrompt: string) => Promise<{ pipeline: { processTurn: Function; cancel: () => void }; destroy: () => void }>;
let AudioCaptureClass: new (config?: { sampleRate?: number; channels?: number }) => { start: (onChunk?: (samples: Float32Array) => void, onLevel?: (level: number) => void) => Promise<void>; stop: () => void; isCapturing: boolean };

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ra = require('../runanywhere');
  createVoiceAgent = ra.createVoiceAgent;
  AudioCaptureClass = ra.AudioCapture;
} catch {
  createVoiceAgent = async () => { throw new Error('Voice Agent requires RunAnywhere ONNX models'); };
  AudioCaptureClass = class { async start() { throw new Error('AudioCapture unavailable'); } stop() {} get isCapturing() { return false; } } as any;
}

const isElectron = !!(window as any).electronAPI?.isElectron || navigator.userAgent.includes('Electron');

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
type CaptureMode = 'voice' | 'text' | 'agent';

function parseLLMResponse(response: string, categories: string[]): IntelligenceItem[] {
  const items: IntelligenceItem[] = [];
  const timestamp = getTimestamp();

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
  const voskSessionRef = useRef<VoskSession | null>(null);
  const [voskModelLoading, setVoskModelLoading] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const captureStateRef = useRef<CaptureState>('idle');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastInterimUpdateRef = useRef(0);
  const extractionAbortRef = useRef<AbortController | null>(null);

  // Voice Agent state
  const [agentActive, setAgentActive] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const voiceAgentRef = useRef<{ destroy: () => void; pipeline: { processTurn: Function; cancel: () => void } } | null>(null);
  const agentCaptureRef = useRef<{ stop: () => void } | null>(null);
  const agentLoopRef = useRef(false);

  // Transcript deduplication refs
  const lastFinalTextRef = useRef('');
  const lastFinalTimeRef = useRef(0);
  const accumulatedTextRef = useRef('');

  // LLM model loader
  const { state: llmState, progress: llmProgress, ensure: ensureLLM } = useModelLoader(ModelCategory.Language);
  const llmReadyRef = useRef(false);

  // Streaming LLM output for real-time extraction feedback
  const [streamingText, setStreamingText] = useState('');

  // Mutex for LLM generation — llama.cpp KV cache crashes on concurrent calls
  const llmBusyRef = useRef(false);
  const llmGenerationIdRef = useRef(0);

  // --- RunAnywhere SDK hooks ---
  const audioPipeline = useAudioPipeline();
  const tts = useTTS();
  const embeddings = useEmbeddings();

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

  // Preload Vosk model in Electron (so first capture is fast)
  useEffect(() => {
    if (isElectron) {
      setVoskModelLoading(true);
      preloadModel().finally(() => setVoskModelLoading(false));
    }
  }, []);

  // Probe Ollama availability when enabled
  useEffect(() => {
    if (isElectron && perfConfig.ollamaEnabled) {
      checkOllamaAvailability().then(setOllamaAvailable);
    } else {
      setOllamaAvailable(false);
    }
  }, [perfConfig.ollamaEnabled]);

  // Cleanup on unmount — stop all capture engines, TTS, and voice agent
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      voskSessionRef.current?.stop();
      extractionAbortRef.current?.abort();
      try { tts.stop(); } catch { /* safe to ignore if TTS not initialized */ }
      try { audioPipeline.stopCapture(); } catch { /* safe to ignore */ }
      agentLoopRef.current = false;
      try { agentCaptureRef.current?.stop(); } catch { /* safe to ignore */ }
      try { voiceAgentRef.current?.destroy(); } catch { /* safe to ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the extraction prompt, optionally with prior session context.
  // When embeddings are available, uses RAG retrieval to inject only the most
  // semantically relevant prior findings instead of the full text blob.
  const buildPrompt = useCallback(async (text: string, domain: DomainProfile): Promise<{ userPrompt: string; systemPrompt: string }> => {
    const catList = domain.categories.join(', ');
    const hasPrior = !!session.priorContext;
    let userPrompt = '';

    if (hasPrior) {
      let contextBlock = session.priorContext!;

      // RAG enhancement: use semantic retrieval when embeddings are available
      if (embeddings.isAvailable) {
        try {
          // Parse prior context lines into IntelligenceItem objects for RAG ranking
          const priorItems: IntelligenceItem[] = [];
          for (const line of session.priorContext!.split('\n')) {
            const match = line.match(/^\[([^\]]+)\]\s*(.+)/);
            if (match) {
              priorItems.push({
                id: crypto.randomUUID(),
                category: match[1],
                content: match[2].trim(),
                timestamp: '',
              });
            }
          }
          if (priorItems.length > 0) {
            const ragContext = await embeddings.buildRAGContext(text, priorItems);
            if (ragContext) {
              contextBlock = ragContext;
            }
          }
        } catch (err) {
          console.warn('[ShadowNotes] RAG context retrieval failed, falling back to full text:', err);
          // Fall through to use the original priorContext text
        }
      }

      userPrompt += `Known facts from prior sessions in this case:\n${contextBlock}\n\n`;
    }

    const today = new Date().toISOString().split('T')[0];
    userPrompt += `Today's date is ${today}. Extract ${hasPrior ? 'NEW ' : ''}facts from this transcript. Use ONLY these categories: ${catList}

When dates are mentioned relatively (e.g. "after 7 days", "next week", "in 2 weeks"), convert them to actual dates using today's date.

Format each line exactly as: [Category] fact
Example:
[${domain.categories[0]}] example fact
[${domain.categories[1]}] example fact`;

    if (hasPrior) {
      userPrompt += `\n\nDo NOT repeat facts already listed above unless they have CHANGED.`;
    }

    userPrompt += `\n\nTranscript:\n${text}\n\nExtracted facts:`;

    let systemPrompt = domain.systemPrompt;
    if (hasPrior) {
      systemPrompt += '\n\nIMPORTANT: Known facts from prior sessions are provided. Do not repeat them unless they changed. Use them to resolve ambiguous references.';
    }

    return { userPrompt, systemPrompt };
  }, [session.priorContext, embeddings]);

  // Ollama extraction helper
  const tryOllamaExtraction = useCallback(async (text: string, domain: DomainProfile): Promise<IntelligenceItem[]> => {
    const { userPrompt, systemPrompt } = await buildPrompt(text, domain);
    try {
      const { text: response } = await generateWithOllama(userPrompt, systemPrompt, perfConfig.ollamaModel);
      return parseLLMResponse(response, domain.categories);
    } catch (err) {
      console.warn('[ShadowNotes] Ollama extraction failed:', err);
      return [];
    }
  }, [perfConfig.ollamaModel, buildPrompt]);

  // LLM extraction — streaming with Ollama cascade + tool extraction + embeddings dedup
  const tryLLMExtraction = useCallback(async (text: string, domain: DomainProfile): Promise<IntelligenceItem[]> => {
    if (!perfConfig.llmEnabled || llmBusyRef.current) return [];

    // Ollama primary: if enabled and available, skip embedded LLM entirely
    if (perfConfig.ollamaEnabled && ollamaAvailable) {
      const ollamaItems = await tryOllamaExtraction(text, domain);
      // Deduplicate via embeddings if available
      if (ollamaItems.length > 0 && embeddings.isAvailable) {
        try {
          return await embeddings.deduplicate(ollamaItems);
        } catch (err) {
          console.warn('[ShadowNotes] Embeddings dedup failed for Ollama results:', err);
        }
      }
      return ollamaItems;
    }

    const myId = ++llmGenerationIdRef.current;
    llmBusyRef.current = true;
    setStreamingText('');
    try {
      const { userPrompt, systemPrompt } = await buildPrompt(text, domain);

      // Use StructuredOutput to validate extraction format awareness
      const hasStructuredSupport = typeof StructuredOutput?.extractJson === 'function';

      // Streaming generation with advanced sampling parameters
      const streamHandle = await TextGeneration.generateStream(userPrompt, {
        systemPrompt,
        maxTokens: perfConfig.maxTokens,
        temperature: perfConfig.temperature,
        topP: 0.9,
        topK: 40,
        stopSequences: ['\n\n\n', '---', 'End of extraction'],
      });

      // Accumulate tokens with real-time UI feedback
      let accumulated = '';
      const timeoutId = setTimeout(() => streamHandle.cancel(), 60_000);

      for await (const token of streamHandle.stream) {
        if (llmGenerationIdRef.current !== myId) {
          streamHandle.cancel();
          break;
        }
        accumulated += token;
        setStreamingText(accumulated);
      }

      clearTimeout(timeoutId);
      setStreamingText('');

      if (llmGenerationIdRef.current !== myId) return [];

      let items: IntelligenceItem[] = [];

      // Try StructuredOutput JSON extraction if response looks like JSON
      if (hasStructuredSupport && accumulated.includes('{')) {
        try {
          const json = StructuredOutput.extractJson(accumulated);
          if (json) {
            const parsed = JSON.parse(json);
            if (Array.isArray(parsed)) {
              const typed = parsed as Array<{ category: string; content: string }>;
              const timestamp = getTimestamp();
              items = typed
                .filter(item => item.category && item.content)
                .map(item => ({
                  id: crypto.randomUUID(),
                  category: item.category,
                  content: item.content,
                  timestamp,
                }));
            }
          }
        } catch {
          // JSON extraction failed — fall through to line-based parsing
        }
      }

      // Fall back to line-based parsing if structured extraction yielded nothing
      if (items.length === 0) {
        items = parseLLMResponse(accumulated, domain.categories);
      }

      // Deduplicate via embeddings if available
      if (items.length > 0 && embeddings.isAvailable) {
        try {
          items = await embeddings.deduplicate(items);
        } catch (err) {
          console.warn('[ShadowNotes] Embeddings dedup failed:', err);
        }
      }

      return items;
    } catch (err) {
      if (err instanceof Error && err.message === 'LLM_TIMEOUT') {
        console.warn('[ShadowNotes] Embedded LLM timed out — trying Ollama fallback');
        if (ollamaAvailable) {
          const ollamaItems = await tryOllamaExtraction(text, domain);
          if (ollamaItems.length > 0) return ollamaItems;
        }
      }
      return [];
    } finally {
      llmBusyRef.current = false;
      setStreamingText('');
    }
  }, [perfConfig.llmEnabled, perfConfig.maxTokens, perfConfig.temperature, perfConfig.ollamaEnabled, ollamaAvailable, tryOllamaExtraction, buildPrompt, embeddings]);

  // Shared extraction: try LLM first, then tool extraction, then fall back to keywords
  const extractWithFallback = useCallback(async (text: string): Promise<IntelligenceItem[]> => {
    if (!text) return [];

    // Primary path: LLM streaming extraction
    if (perfConfig.llmEnabled && llmReadyRef.current) {
      const llmItems = await tryLLMExtraction(text, session.domain);
      if (llmItems.length > 0) return llmItems;
    }

    // Secondary path: tool-based extraction via RunAnywhere SDK ToolCalling
    try {
      const toolItems = await extractWithTools(text, session.domain, session.domain.systemPrompt);
      if (toolItems.length > 0) {
        // Deduplicate tool-extracted items if embeddings are available
        if (embeddings.isAvailable) {
          try {
            return await embeddings.deduplicate(toolItems);
          } catch (err) {
            console.warn('[ShadowNotes] Embeddings dedup failed for tool extraction:', err);
          }
        }
        return toolItems;
      }
    } catch (err) {
      console.warn('[ShadowNotes] Tool extraction failed:', err);
    }

    // Tertiary fallback: keyword-based extraction (always works, zero dependencies)
    return extractIntelligence(text, session.domain.id);
  }, [perfConfig.llmEnabled, tryLLMExtraction, session.domain, embeddings]);

  // TTS voice feedback after extraction completes
  const speakExtractionSummary = useCallback((itemCount: number) => {
    if (!tts.isAvailable || itemCount === 0) return;
    try {
      const noun = itemCount === 1 ? 'finding' : 'findings';
      tts.speak(`Extracted ${itemCount} ${noun}`);
    } catch (err) {
      console.warn('[ShadowNotes] TTS feedback failed:', err);
    }
  }, [tts]);

  // Voice Agent: start hands-free mode
  const startVoiceAgent = useCallback(async () => {
    setAgentError(null);
    try {
      const agent = await createVoiceAgent(session.domain.systemPrompt);
      voiceAgentRef.current = agent;

      // Set up AudioCapture to feed audio into the pipeline
      const capture = new AudioCaptureClass({ sampleRate: 16000, channels: 1 });
      agentCaptureRef.current = capture;
      agentLoopRef.current = true;

      // Callbacks for the VoicePipeline turn-based processing
      const callbacks: VoicePipelineCallbacks = {
        onTranscription: (text: string) => {
          const timestamp = getTimestamp();
          onAddTranscript({ text, timestamp });
          // Feed transcript into extraction pipeline
          extractWithFallback(text).then((items) => {
            if (items.length > 0) {
              onAddIntelligence(items);
              speakExtractionSummary(items.length);
            }
          });
        },
        onError: (err: Error) => {
          console.warn('[ShadowNotes] Voice agent pipeline error:', err);
          setAgentError(err.message);
        },
      };

      // Start audio capture; each chunk is processed through the pipeline
      await capture.start(
        async (audioData: Float32Array) => {
          if (!agentLoopRef.current) return;
          try {
            await agent.pipeline.processTurn(audioData, {
              systemPrompt: session.domain.systemPrompt,
              maxTokens: 256,
            }, callbacks);
          } catch (err) {
            console.warn('[ShadowNotes] Voice agent turn error:', err);
          }
        },
      );

      setAgentActive(true);
    } catch (err) {
      console.warn('[ShadowNotes] Voice agent failed to start:', err);
      setAgentError('Voice Agent requires RunAnywhere ONNX models');
      setAgentActive(false);
      voiceAgentRef.current = null;
      agentCaptureRef.current = null;
    }
  }, [session.domain.systemPrompt, onAddTranscript, extractWithFallback, onAddIntelligence, speakExtractionSummary]);

  // Voice Agent: stop hands-free mode
  const stopVoiceAgent = useCallback(() => {
    agentLoopRef.current = false;
    try { agentCaptureRef.current?.stop(); } catch { /* safe */ }
    agentCaptureRef.current = null;
    try { voiceAgentRef.current?.destroy(); } catch { /* safe */ }
    voiceAgentRef.current = null;
    setAgentActive(false);
    setAgentError(null);
  }, []);

  // Cleanup voice agent on unmount
  useEffect(() => {
    return () => {
      agentLoopRef.current = false;
      try { agentCaptureRef.current?.stop(); } catch { /* safe */ }
      try { voiceAgentRef.current?.destroy(); } catch { /* safe */ }
    };
  }, []);

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
      const timestamp = getTimestamp();
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

  // Handle a final speech result (shared by both engines)
  const handleFinalResult = useCallback((text: string) => {
    if (!text) return;

    const command = parseVoiceCommand(text);
    if (command) {
      onVoiceCommand?.(command);
      return;
    }

    const now = Date.now();
    const timestamp = getTimestamp();
    const prev = lastFinalTextRef.current;
    const timeSinceLast = now - lastFinalTimeRef.current;

    const isRefinement = prev && timeSinceLast < 3000 && (
      text.startsWith(prev) || prev.startsWith(text)
    );

    if (isRefinement) {
      const longer = text.length >= prev.length ? text : prev;
      onUpdateLastTranscript({ text: longer, timestamp });
      lastFinalTextRef.current = longer;
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
  }, [onAddTranscript, onUpdateLastTranscript, onVoiceCommand]);

  // Handle interim/partial speech (shared by both engines)
  const handleInterim = useCallback((text: string) => {
    const now = Date.now();
    if (perfConfig.interimThrottleMs <= 0 || now - lastInterimUpdateRef.current >= perfConfig.interimThrottleMs) {
      lastInterimUpdateRef.current = now;
      setLiveTranscript(text);
    }
  }, [perfConfig.interimThrottleMs]);

  const startCapture = useCallback(() => {
    setError(null);

    if (isElectron) {
      // Vosk local speech recognition (Electron)
      setCaptureState('listening');
      startVoskCapture({
        onResult: handleFinalResult,
        onPartial: handleInterim,
        onError: (msg) => setError(`Speech engine: ${msg}`),
        onStateChange: (state) => {
          if (state === 'loading-model') setVoskModelLoading(true);
          else setVoskModelLoading(false);
        },
      }).then((session) => {
        voskSessionRef.current = session;
      }).catch(() => {
        setCaptureState('idle');
      });
      return;
    }

    // Web Speech API (Chrome/Edge on web)
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
          handleFinalResult(result[0].transcript.trim());
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) handleInterim(interim);
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
  }, [handleFinalResult, handleInterim]);

  // DECODE INTELLIGENCE: stop mic, animate, then extract
  const decodeIntelligence = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    voskSessionRef.current?.stop();
    voskSessionRef.current = null;
    const fullText = flushAccumulated();

    setCaptureState('extracting');
    const abort = new AbortController();
    extractionAbortRef.current = abort;

    // Let animation frame render before starting heavy LLM work
    requestAnimationFrame(() => {
      setTimeout(async () => {
        const items = await extractWithFallback(fullText);
        if (!abort.signal.aborted && items.length > 0) {
          onAddIntelligence(items);
          speakExtractionSummary(items.length);
        }
        if (!abort.signal.aborted) setCaptureState('idle');
      }, 500);
    });
  }, [flushAccumulated, extractWithFallback, onAddIntelligence, speakExtractionSummary]);

  // Text mode: submit typed notes through extraction pipeline
  const handleTextSubmit = useCallback(async () => {
    const text = textInput.trim();
    if (!text) return;
    const timestamp = getTimestamp();
    onAddTranscript({ text, timestamp });
    setTextInput('');
    setIsTextExtracting(true);
    try {
      const items = await extractWithFallback(text);
      if (items.length > 0) {
        onAddIntelligence(items);
        speakExtractionSummary(items.length);
      }
    } finally {
      setIsTextExtracting(false);
    }
  }, [textInput, extractWithFallback, onAddTranscript, onAddIntelligence, speakExtractionSummary]);

  const handleEndSession = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    voskSessionRef.current?.stop();
    voskSessionRef.current = null;
    extractionAbortRef.current?.abort();
    // Stop voice agent if active
    agentLoopRef.current = false;
    try { agentCaptureRef.current?.stop(); } catch { /* safe */ }
    agentCaptureRef.current = null;
    try { voiceAgentRef.current?.destroy(); } catch { /* safe */ }
    voiceAgentRef.current = null;
    setAgentActive(false);
    // Stop TTS if speaking during session end
    try { tts.stop(); } catch { /* safe */ }
    const fullText = flushAccumulated();
    if (fullText) {
      // Await extraction before ending session to avoid post-unmount state updates
      const items = await extractWithFallback(fullText);
      if (items.length > 0) onAddIntelligence(items);
    }
    onEndSession();
  }, [flushAccumulated, extractWithFallback, onAddIntelligence, onEndSession, tts]);

  const handleDiscard = useCallback(() => {
    extractionAbortRef.current?.abort();
    agentLoopRef.current = false;
    try { agentCaptureRef.current?.stop(); } catch { /* safe */ }
    agentCaptureRef.current = null;
    try { voiceAgentRef.current?.destroy(); } catch { /* safe */ }
    voiceAgentRef.current = null;
    setAgentActive(false);
    try { tts.stop(); } catch { /* safe */ }
    onDiscardSession?.();
  }, [onDiscardSession, tts]);

  // Group intelligence by category (memoized)
  const groupedIntel = useMemo(() => session.intelligence.reduce<Record<string, IntelligenceItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {}), [session.intelligence]);

  // LLM status label — enhanced with audio pipeline awareness
  const llmStatusLabel = (() => {
    if (captureState === 'extracting' || isTextExtracting) return 'AI: DECODING...';
    if (!perfConfig.llmEnabled) return 'AI: OFF';
    if (audioPipeline.isAvailable && audioPipeline.isTranscribing) return 'AI: TRANSCRIBING';
    if (perfConfig.ollamaEnabled && ollamaAvailable) return 'AI: OLLAMA';
    switch (llmState) {
      case 'downloading': return `AI: ${Math.round(llmProgress * 100)}%`;
      case 'loading': return 'AI: LOADING';
      case 'ready': return 'AI: ACTIVE';
      case 'error': return 'AI: KEYWORDS';
      default: return 'AI: PENDING';
    }
  })();

  // Determine whether to show real audio levels from the pipeline vs CSS animation
  const useRealVAD = audioPipeline.isAvailable && captureState === 'listening';

  return (
    <div className="capture-screen" role="main" aria-label="Intelligence capture session">
      <header className="capture-header" role="banner">
        <div className="capture-header-left">
          <div className="stamp stamp-small" aria-label={`Clearance level: ${session.domain.clearanceLevel}`}>{session.domain.clearanceLevel}</div>
          <span className="case-number" aria-label={`Case number ${session.caseNumber}`}>CASE: {session.caseNumber}</span>
        </div>
        <div className="capture-header-center">
          <span className="session-timer" role="timer" aria-label={`Session duration: ${elapsed}`}>{elapsed}</span>
        </div>
        <div className="capture-header-right">
          <div className="status-indicator" role="status" aria-live="polite" aria-label={`AI status: ${llmStatusLabel}`}>
            <div className={`status-dot ${captureState === 'extracting' || isTextExtracting ? 'status-extracting' : (llmState === 'ready' || (perfConfig.ollamaEnabled && ollamaAvailable)) ? 'status-secure' : 'status-loading'}`} />
            <span>{llmStatusLabel}</span>
          </div>

          {/* SDK feature status badges */}
          <div className="sdk-status" aria-label="SDK features status">
            <span className={`sdk-badge ${llmState === 'ready' ? 'active' : ''}`} title="Language Model">LLM</span>
            <span className={`sdk-badge ${audioPipeline.isAvailable ? 'active' : ''}`} title="Speech-to-Text">STT</span>
            <span className={`sdk-badge ${audioPipeline.isAvailable ? 'active' : ''}`} title="Voice Activity Detection">VAD</span>
            <span className={`sdk-badge ${tts.isAvailable ? 'active' : ''}`} title="Text-to-Speech">TTS</span>
            <span className={`sdk-badge ${embeddings.isAvailable ? 'active' : ''}`} title="Embeddings">EMB</span>
          </div>

          {onShowVoiceHelp && (
            <button className="btn-voice-help" onClick={onShowVoiceHelp} title="Voice commands" aria-label="Show voice command help">?</button>
          )}
          {onDiscardSession && (
            <button className="btn-discard" onClick={handleDiscard} aria-label="Discard current session">DISCARD</button>
          )}
          <button className="btn-end" onClick={handleEndSession} aria-label="End capture session">
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
            {session.transcripts.length === 0 && captureMode === 'agent' && !agentActive && (
              <div className="empty-state-capture">
                <p>Start the Voice Agent for hands-free capture and extraction</p>
              </div>
            )}
            {session.transcripts.length === 0 && captureMode === 'agent' && agentActive && (
              <div className="empty-state-capture">
                <p>Voice Agent listening... speak naturally</p>
              </div>
            )}
            {session.transcripts.map((t, i) => (
              <div key={`${t.timestamp}-${i}`} className="transcript-entry">
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
              <button className={`capture-mode-btn ${captureMode === 'voice' ? 'active' : ''}`} onClick={() => { if (agentActive) stopVoiceAgent(); setCaptureMode('voice'); }}>MIC</button>
              <button className={`capture-mode-btn ${captureMode === 'text' ? 'active' : ''}`} onClick={() => { if (agentActive) stopVoiceAgent(); setCaptureMode('text'); }}>TEXT</button>
              <button className={`capture-mode-btn ${captureMode === 'agent' ? 'active' : ''}`} onClick={() => { setCaptureMode('agent'); }}>AGENT</button>
            </div>

            {captureMode === 'voice' ? (
              <>
                {perfConfig.vadBarCount > 0 && (
                  <div className="vad-indicator" data-state={captureState} aria-label={useRealVAD && audioPipeline.vadActive ? 'Voice detected' : 'Awaiting voice input'}>
                    <div className="vad-bars">
                      {Array.from({ length: perfConfig.vadBarCount }).map((_, i) => (
                        <div
                          key={i}
                          className={`vad-bar ${
                            useRealVAD
                              ? (audioPipeline.vadActive ? 'vad-bar-active' : '')
                              : (captureState === 'listening' && perfConfig.animationsEnabled ? 'vad-bar-active' : '')
                          }`}
                          style={
                            useRealVAD
                              ? { height: `${Math.min(100, audioPipeline.audioLevel * 100 * (1 + i * 0.1))}%` }
                              : (perfConfig.animationsEnabled ? { animationDelay: `${i * 0.08}s` } : undefined)
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {captureState === 'idle' ? (
                  <button className="btn-capture" onClick={startCapture} disabled={voskModelLoading}>
                    <span className={perfConfig.animationsEnabled ? 'rec-dot' : 'rec-dot-static'} />
                    {voskModelLoading ? 'LOADING SPEECH MODEL...' : 'BEGIN CAPTURE'}
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
            ) : captureMode === 'agent' ? (
              <div className="voice-agent-panel" role="region" aria-label="Voice Agent controls">
                {agentError && (
                  <div className="capture-error" role="alert" style={{ marginBottom: '0.5rem' }}>
                    <span>[AGENT]</span> {agentError}
                    <button onClick={() => setAgentError(null)} aria-label="Dismiss agent error">{'\u2715'}</button>
                  </div>
                )}

                {agentActive ? (
                  <>
                    <div className="voice-agent-status" aria-live="polite">
                      <span className={perfConfig.animationsEnabled ? 'rec-dot' : 'rec-dot-static'} />
                      <span>Voice Agent Active &mdash; Speak naturally</span>
                    </div>
                    <button className="btn-capture btn-capture-decode" onClick={stopVoiceAgent} aria-label="Stop voice agent">
                      STOP AGENT
                    </button>
                  </>
                ) : (
                  <>
                    <div className="voice-agent-status">
                      <span>Hands-free voice capture with automatic intelligence extraction</span>
                    </div>
                    <button className="btn-capture" onClick={startVoiceAgent} aria-label="Start voice agent">
                      <span className={perfConfig.animationsEnabled ? 'rec-dot' : 'rec-dot-static'} />
                      START VOICE AGENT
                    </button>
                  </>
                )}
              </div>
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
              <div className="empty-state-capture extracting-state" role="status" aria-live="polite" aria-label="AI extraction in progress">
                <div className="extracting-indicator">
                  <span className="extracting-spinner" />
                  <p>AI is decoding intelligence...</p>
                </div>
                {streamingText && (
                  <div className="streaming-output" aria-label="Live AI output">
                    <pre className="streaming-text">{streamingText}</pre>
                  </div>
                )}
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
                        aria-label={`Add new ${cat} finding`}
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
                        aria-label={`New ${cat} finding text`}
                        autoFocus
                      />
                      <div className="intel-add-actions">
                        <button className="intel-add-save" onClick={saveManualAdd} aria-label={`Save ${cat} finding`}>SAVE</button>
                        <button className="intel-add-cancel" onClick={cancelManualAdd} aria-label={`Cancel adding ${cat} finding`}>{'\u2715'}</button>
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
                          aria-label={`Editing finding: ${item.content}`}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="intel-content intel-content-editable"
                          onClick={() => startEdit(item)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(item); } }}
                          title="Click to edit"
                          role="button"
                          tabIndex={0}
                          aria-label={`Edit finding: ${item.content}`}
                        >
                          {item.content}
                        </span>
                      )}
                      <button
                        className="intel-delete-btn"
                        onClick={() => onDeleteIntelligence(item.id)}
                        title="Remove finding"
                        aria-label="Delete finding"
                      >
                        {'\u2715'}
                      </button>
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
        <div className="capture-error" role="alert">
          <span>[ERROR]</span> {error}
          <button onClick={() => setError(null)} aria-label="Dismiss error">{'\u2715'}</button>
        </div>
      )}
    </div>
  );
}
