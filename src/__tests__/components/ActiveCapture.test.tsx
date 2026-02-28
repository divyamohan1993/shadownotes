import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock useModelLoader
const mockEnsure = vi.fn(async () => true);
vi.mock('../../hooks/useModelLoader', () => ({
  useModelLoader: vi.fn(() => ({
    state: 'idle',
    progress: 0,
    error: null,
    ensure: mockEnsure,
  })),
}));

vi.mock('@runanywhere/web', () => ({
  ModelCategory: { Language: 'language' },
  LLMFramework: { LlamaCpp: 'llamacpp' },
  AccelerationPreference: { Auto: 'auto', CPU: 'cpu' },
  SDKEnvironment: { Production: 'production' },
  RunAnywhere: { initialize: vi.fn(async () => {}), registerModels: vi.fn() },
  ModelManager: { getModels: vi.fn(() => []), getLoadedModel: vi.fn(() => null), downloadModel: vi.fn(async () => {}), loadModel: vi.fn(async () => true) },
  OPFSStorage: vi.fn().mockImplementation(() => ({ initialize: vi.fn(async () => false), hasModel: vi.fn(async () => false) })),
  EventBus: { shared: { on: vi.fn(() => () => {}) } },
  SDKLogger: class { info = vi.fn(); warning = vi.fn(); error = vi.fn(); },
  detectCapabilities: vi.fn(async () => ({ hasWebGPU: false, hasWASMSIMD: true, deviceMemoryGB: 8, hardwareConcurrency: 8 })),
  VoicePipeline: vi.fn().mockImplementation(() => ({ processTurn: vi.fn(async () => ({ transcript: '' })) })),
  VoiceAgent: { create: vi.fn(async () => ({ loadModels: vi.fn(async () => {}), processVoiceTurn: vi.fn(async () => ({})), destroy: vi.fn() })) },
  VoiceAgentSession: vi.fn(),
}));

vi.mock('../../runanywhere', () => ({
  initSDK: vi.fn(async () => {}),
  getRecommendedPreset: vi.fn(() => 'high'),
  getSelectedLlmModelId: vi.fn(() => 'gemma-3-1b-it-q4_k_m'),
  getLlmModelMeta: vi.fn(() => ({ id: 'gemma-3-1b-it-q4_k_m', name: 'Gemma 3 1B', size: '~810 MB', params: '1B' })),
  LLM_MODELS: [
    { id: 'smollm2-135m-instruct-q4_k_m', name: 'SmolLM2 135M', size: '~100 MB', params: '135M' },
    { id: 'qwen2.5-0.5b-instruct-q4_k_m', name: 'Qwen2.5 0.5B', size: '~400 MB', params: '0.5B' },
    { id: 'gemma-3-1b-it-q4_k_m', name: 'Gemma 3 1B', size: '~810 MB', params: '1B' },
  ],
  switchLlmModel: vi.fn(async () => true),
  getCapabilities: vi.fn(async () => ({ hasWebGPU: false, hasWASMSIMD: true, deviceMemoryGB: 8, hardwareConcurrency: 8 })),
  createVoiceAgent: vi.fn(async () => ({
    session: { loadModels: vi.fn(), processVoiceTurn: vi.fn(), destroy: vi.fn() },
    pipeline: { processTurn: vi.fn(async () => ({ transcript: '' })) },
    destroy: vi.fn(),
  })),
  ModelManager: { getModels: vi.fn(() => []), getLoadedModel: vi.fn(() => null), downloadModel: vi.fn(async () => {}), loadModel: vi.fn(async () => true) },
  ModelCategory: { Language: 'language' },
  OPFSStorage: vi.fn().mockImplementation(() => ({ initialize: vi.fn(async () => false), hasModel: vi.fn(async () => false) })),
  EventBus: { shared: { on: vi.fn(() => () => {}) } },
  AudioCapture: vi.fn().mockImplementation(() => ({ start: vi.fn(), stop: vi.fn(), drainBuffer: vi.fn(() => new Float32Array(0)), isCapturing: false })),
}));

vi.mock('@runanywhere/web-llamacpp', () => ({
  TextGeneration: {
    generate: vi.fn(async () => ({
      text: '',
      tokensUsed: 0,
      tokensPerSecond: 0,
      latencyMs: 0,
    })),
  },
}));

vi.mock('@runanywhere/web-onnx', () => ({
  ONNX: { register: vi.fn(async () => {}) },
  STT: { isModelLoaded: false, transcribe: vi.fn() },
  TTS: { isVoiceLoaded: false, synthesize: vi.fn() },
  VAD: { isInitialized: false, onSpeechActivity: vi.fn(() => () => {}), processSamples: vi.fn(), flush: vi.fn(), popSpeechSegment: vi.fn() },
  AudioCapture: vi.fn().mockImplementation(() => ({ start: vi.fn(), stop: vi.fn(), drainBuffer: vi.fn(() => new Float32Array(0)), isCapturing: false })),
  AudioPlayback: vi.fn().mockImplementation(() => ({ play: vi.fn(), stop: vi.fn(), dispose: vi.fn(), isPlaying: false })),
  SpeechActivity: { Started: 'started', Ended: 'ended' },
  STTModelType: {},
}));

// Mock SpeechRecognition API
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockAbort = vi.fn();

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = mockStart;
  stop = mockStop;
  abort = mockAbort;
}

(globalThis as any).window = globalThis.window || {};
Object.defineProperty(window, 'SpeechRecognition', {
  value: MockSpeechRecognition,
  writable: true,
  configurable: true,
});

import { ActiveCapture } from '../../components/ActiveCapture';
import { PerfProvider } from '../../perfConfig';
import { useModelLoader } from '../../hooks/useModelLoader';
import { DOMAINS } from '../../domains';
import type { SessionData } from '../../types';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <PerfProvider>{children}</PerfProvider>;
}

function createSession(overrides?: Partial<SessionData>): SessionData {
  return {
    domain: DOMAINS[0], // Security Audit
    caseNumber: 'SN-260222-ABCD',
    startTime: new Date(),
    transcripts: [],
    intelligence: [],
    ...overrides,
  };
}

describe('ActiveCapture', () => {
  const mockAddTranscript = vi.fn();
  const mockUpdateLastTranscript = vi.fn();
  const mockAddIntelligence = vi.fn();
  const mockUpdateIntelligence = vi.fn();
  const mockDeleteIntelligence = vi.fn();
  const mockEndSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (useModelLoader as ReturnType<typeof vi.fn>).mockReturnValue({
      state: 'idle',
      progress: 0,
      error: null,
      ensure: mockEnsure,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the case number', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText(/CASE: SN-260222-ABCD/)).toBeInTheDocument();
  });

  it('renders the domain clearance stamp', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('TOP SECRET')).toBeInTheDocument();
  });

  it('renders the domain codename banner', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('OPERATION FIREWALL')).toBeInTheDocument();
  });

  it('renders AI status indicator', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('AI: PENDING')).toBeInTheDocument();
  });

  it('shows AI: ACTIVE when LLM is ready', () => {
    (useModelLoader as ReturnType<typeof vi.fn>).mockReturnValue({
      state: 'ready',
      progress: 1,
      error: null,
      ensure: mockEnsure,
    });

    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('AI: ACTIVE')).toBeInTheDocument();
  });

  it('shows AI: KEYWORDS when LLM errors', () => {
    (useModelLoader as ReturnType<typeof vi.fn>).mockReturnValue({
      state: 'error',
      progress: 0,
      error: 'Failed',
      ensure: mockEnsure,
    });

    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('AI: KEYWORDS')).toBeInTheDocument();
  });

  it('renders panel headers', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('RAW TRANSCRIPT')).toBeInTheDocument();
    expect(screen.getByText('INTELLIGENCE EXTRACT')).toBeInTheDocument();
  });

  it('shows segment count as 0 initially', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('0 segments')).toBeInTheDocument();
  });

  it('shows findings count as 0 initially', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('0 findings')).toBeInTheDocument();
  });

  it('shows BEGIN CAPTURE button in idle state', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('BEGIN CAPTURE')).toBeInTheDocument();
  });

  it('shows empty state message for transcript', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('Begin capture to start recording')).toBeInTheDocument();
  });

  it('shows empty state message for intelligence', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getAllByText(/No findings yet/).length).toBeGreaterThan(0);
  });

  it('starts SpeechRecognition when BEGIN CAPTURE clicked', async () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByText('BEGIN CAPTURE'));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('shows error when SpeechRecognition not supported', async () => {
    const origSR = window.SpeechRecognition;
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = undefined;

    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByText('BEGIN CAPTURE'));

    await waitFor(() => {
      expect(screen.getByText(/Speech recognition not supported/)).toBeInTheDocument();
    });

    // Restore
    (window as any).SpeechRecognition = origSR;
  });

  it('calls onEndSession when END SESSION clicked', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByText('END SESSION'));
    expect(mockEndSession).toHaveBeenCalledTimes(1);
  });

  it('renders transcript entries when provided', () => {
    const session = createSession({
      transcripts: [
        { text: 'Server room entry detected', timestamp: '14:30:00' },
        { text: 'Badge scan at door A3', timestamp: '14:31:00' },
      ],
    });

    render(
      <ActiveCapture
        session={session}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Server room entry detected')).toBeInTheDocument();
    expect(screen.getByText('Badge scan at door A3')).toBeInTheDocument();
    expect(screen.getByText('2 segments')).toBeInTheDocument();
  });

  it('renders intelligence items grouped by category', () => {
    const session = createSession({
      intelligence: [
        { id: 'test-1', category: 'Vulnerabilities', content: 'Open port 22 on server', timestamp: '14:30:00' },
        { id: 'test-2', category: 'Timeline', content: 'Entry at 02:14 AM', timestamp: '14:30:00' },
        { id: 'test-3', category: 'Vulnerabilities', content: 'Weak password policy', timestamp: '14:31:00' },
      ],
    });

    render(
      <ActiveCapture
        session={session}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Open port 22 on server')).toBeInTheDocument();
    expect(screen.getByText('Entry at 02:14 AM')).toBeInTheDocument();
    expect(screen.getByText('Weak password policy')).toBeInTheDocument();
    expect(screen.getByText('3 findings')).toBeInTheDocument();
  });

  it('renders session timer', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    // Timer starts at 00:00:00
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('renders 12 VAD bars', () => {
    const { container } = render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    const bars = container.querySelectorAll('.vad-bar');
    expect(bars.length).toBe(12);
  });

  it('error can be dismissed', async () => {
    const origSR = window.SpeechRecognition;
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = undefined;

    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.click(screen.getByText('BEGIN CAPTURE'));

    await waitFor(() => {
      expect(screen.getByText(/Speech recognition not supported/)).toBeInTheDocument();
    });

    // Click the dismiss button (X)
    fireEvent.click(screen.getByText('\u2715'));

    expect(screen.queryByText(/Speech recognition not supported/)).not.toBeInTheDocument();

    // Restore
    (window as any).SpeechRecognition = origSR;
  });

  it('calls ensureLLM on mount', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onUpdateIntelligence={mockUpdateIntelligence}
        onDeleteIntelligence={mockDeleteIntelligence}
        onEndSession={mockEndSession}
      />,
      { wrapper: Wrapper },
    );
    expect(mockEnsure).toHaveBeenCalled();
  });
});
