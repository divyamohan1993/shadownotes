import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock SDK modules
vi.mock('@runanywhere/web', () => import('../__mocks__/runanywhere-web'));
vi.mock('@runanywhere/web-llamacpp', () => import('../__mocks__/runanywhere-web-llamacpp'));
vi.mock('@runanywhere/web-onnx', () => import('../__mocks__/runanywhere-web-onnx'));

import { ActiveCapture } from '../../components/ActiveCapture';
import { ModelManager, ModelCategory } from '@runanywhere/web';
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
  const mockAddIntelligence = vi.fn();
  const mockEndSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the case number', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
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
        onAddIntelligence={mockAddIntelligence}
        onEndSession={mockEndSession}
      />,
    );
    expect(screen.getByText('OPERATION FIREWALL')).toBeInTheDocument();
  });

  it('renders AIR-GAPPED status', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onAddIntelligence={mockAddIntelligence}
        onEndSession={mockEndSession}
      />,
    );
    expect(screen.getByText('AIR-GAPPED')).toBeInTheDocument();
  });

  it('renders panel headers', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
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
        onAddIntelligence={mockAddIntelligence}
        onEndSession={mockEndSession}
      />,
    );
    expect(screen.getByText(/Intelligence extractions will appear/)).toBeInTheDocument();
  });

  it('shows error when models not loaded and BEGIN CAPTURE clicked', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);

    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onAddIntelligence={mockAddIntelligence}
        onEndSession={mockEndSession}
      />,
    );

    fireEvent.click(screen.getByText('BEGIN CAPTURE'));

    await waitFor(() => {
      expect(screen.getByText(/Required models not loaded/)).toBeInTheDocument();
    });
  });

  it('calls onEndSession when END SESSION clicked', () => {
    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
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
        onAddIntelligence={mockAddIntelligence}
        onEndSession={mockEndSession}
      />,
    );
    const bars = container.querySelectorAll('.vad-bar');
    expect(bars.length).toBe(12);
  });

  it('error can be dismissed', async () => {
    (ModelManager.getLoadedModel as any).mockReturnValue(null);

    render(
      <ActiveCapture
        session={createSession()}
        onAddTranscript={mockAddTranscript}
        onAddIntelligence={mockAddIntelligence}
        onEndSession={mockEndSession}
      />,
    );

    fireEvent.click(screen.getByText('BEGIN CAPTURE'));

    await waitFor(() => {
      expect(screen.getByText(/Required models not loaded/)).toBeInTheDocument();
    });

    // Click the dismiss button (X)
    fireEvent.click(screen.getByText('\u2715'));

    expect(screen.queryByText(/Required models not loaded/)).not.toBeInTheDocument();
  });
});
