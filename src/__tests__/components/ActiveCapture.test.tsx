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
import { useModelLoader } from '../../hooks/useModelLoader';
import { DOMAINS } from '../../domains';
import type { SessionData } from '../../types';

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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
    );
    expect(screen.getByText(/Intelligence extractions will appear/)).toBeInTheDocument();
  });

  it('starts SpeechRecognition when BEGIN CAPTURE clicked', async () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
    );

    expect(screen.getByText('Server room entry detected')).toBeInTheDocument();
    expect(screen.getByText('Badge scan at door A3')).toBeInTheDocument();
    expect(screen.getByText('2 segments')).toBeInTheDocument();
  });

  it('renders intelligence items grouped by category', () => {
    const session = createSession({
      intelligence: [
        { category: 'Vulnerabilities', content: 'Open port 22 on server', timestamp: '14:30:00' },
        { category: 'Timeline', content: 'Entry at 02:14 AM', timestamp: '14:30:00' },
        { category: 'Vulnerabilities', content: 'Weak password policy', timestamp: '14:31:00' },
      ],
    });

    render(
      <ActiveCapture
        session={session}
        onAddTranscript={mockAddTranscript}
        onUpdateLastTranscript={mockUpdateLastTranscript}
        onAddIntelligence={mockAddIntelligence}
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
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
        onEndSession={mockEndSession}
      />,
    );
    expect(mockEnsure).toHaveBeenCalled();
  });
});
