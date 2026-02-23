import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSummary } from '../../components/SessionSummary';
import { DOMAINS } from '../../domains';
import type { SessionData } from '../../types';

function createSession(overrides?: Partial<SessionData>): SessionData {
  return {
    domain: DOMAINS[0], // Security Audit
    caseNumber: 'SN-260222-TEST',
    startTime: new Date('2026-02-22T10:00:00Z'),
    transcripts: [
      { text: 'Server room entry at 02:14 AM', timestamp: '14:30:00' },
      { text: 'Badge logs show unauthorized access', timestamp: '14:31:00' },
    ],
    intelligence: [
      { id: 'test-1', category: 'Vulnerabilities', content: 'Unauthorized badge access', timestamp: '14:30:00' },
      { id: 'test-2', category: 'Timeline', content: '02:14 AM server room entry', timestamp: '14:30:00' },
      { id: 'test-3', category: 'Evidence', content: 'Badge log records', timestamp: '14:31:00' },
    ],
    ...overrides,
  };
}

describe('SessionSummary', () => {
  const mockOnDestroy = vi.fn();
  const mockOnUpdateIntelligence = vi.fn();
  const mockOnDeleteIntelligence = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SESSION DOSSIER title', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('SESSION DOSSIER')).toBeInTheDocument();
  });

  it('renders CLASSIFIED and EYES ONLY stamps', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('CLASSIFIED')).toBeInTheDocument();
    expect(screen.getByText('EYES ONLY')).toBeInTheDocument();
  });

  it('displays case number', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('SN-260222-TEST')).toBeInTheDocument();
  });

  it('displays operation codename', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('OPERATION FIREWALL')).toBeInTheDocument();
  });

  it('displays domain name', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('Security Audit')).toBeInTheDocument();
  });

  it('displays clearance level', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('TOP SECRET')).toBeInTheDocument();
  });

  it('displays transcript count', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 segments
  });

  it('displays findings count', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 findings
  });

  it('renders RAW TRANSCRIPT section', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('RAW TRANSCRIPT')).toBeInTheDocument();
  });

  it('renders INTELLIGENCE EXTRACT section', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('INTELLIGENCE EXTRACT')).toBeInTheDocument();
  });

  it('displays transcript text', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('Server room entry at 02:14 AM')).toBeInTheDocument();
    expect(screen.getByText('Badge logs show unauthorized access')).toBeInTheDocument();
  });

  it('displays intelligence items', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('Unauthorized badge access')).toBeInTheDocument();
    expect(screen.getByText('02:14 AM server room entry')).toBeInTheDocument();
    expect(screen.getByText('Badge log records')).toBeInTheDocument();
  });

  it('groups intelligence by category', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('VULNERABILITIES')).toBeInTheDocument();
    expect(screen.getByText('TIMELINE')).toBeInTheDocument();
    expect(screen.getByText('EVIDENCE')).toBeInTheDocument();
  });

  it('shows warning about ephemeral data', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText(/Session data exists only in browser memory/)).toBeInTheDocument();
  });

  it('shows DESTROY SESSION button', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('DESTROY SESSION')).toBeInTheDocument();
  });

  it('requires confirmation before destroying', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);

    fireEvent.click(screen.getByText('DESTROY SESSION'));

    // Should show confirmation text
    expect(screen.getByText('CONFIRM: DESTROY ALL SESSION DATA')).toBeInTheDocument();
    // Should NOT have called onDestroy yet
    expect(mockOnDestroy).not.toHaveBeenCalled();
  });

  it('calls onDestroy after confirmation and burn animation', async () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);

    // First click: enter confirm mode
    fireEvent.click(screen.getByText('DESTROY SESSION'));
    // Second click: actually destroy
    fireEvent.click(screen.getByText('CONFIRM: DESTROY ALL SESSION DATA'));

    // Should show destroy animation
    expect(screen.getByText('DESTROYING SESSION DATA')).toBeInTheDocument();

    // Wait for burn animation to complete (100/2 * 30ms = 1500ms + 300ms timeout)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockOnDestroy).toHaveBeenCalledTimes(1);
  });

  it('shows burn progress messages during destroy', async () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);

    fireEvent.click(screen.getByText('DESTROY SESSION'));
    fireEvent.click(screen.getByText('CONFIRM: DESTROY ALL SESSION DATA'));

    // Initial phase
    expect(screen.getByText('Wiping transcript buffer...')).toBeInTheDocument();

    // Advance to 30% (progress: 30, needs 15 ticks * 30ms)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText('Purging intelligence extracts...')).toBeInTheDocument();
  });

  it('resets confirm state after 5 second timeout', async () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);

    fireEvent.click(screen.getByText('DESTROY SESSION'));
    expect(screen.getByText('CONFIRM: DESTROY ALL SESSION DATA')).toBeInTheDocument();

    // Advance past 5 second timeout
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    // Should be back to normal state
    expect(screen.getByText('DESTROY SESSION')).toBeInTheDocument();
  });

  it('handles empty session (no transcripts/intelligence)', () => {
    const session = createSession({
      transcripts: [],
      intelligence: [],
    });

    render(<SessionSummary session={session} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('No transcript data captured.')).toBeInTheDocument();
    expect(screen.getByText('No intelligence extracted.')).toBeInTheDocument();
  });

  it('renders for different domain types', () => {
    const legalSession = createSession({
      domain: DOMAINS[1], // Legal Deposition
      intelligence: [
        { id: 'test-legal-1', category: 'Key Statements', content: 'Witness admitted to being present', timestamp: '10:00:00' },
      ],
    });

    render(<SessionSummary session={legalSession} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('OPERATION TESTIMONY')).toBeInTheDocument();
    expect(screen.getByText('CONFIDENTIAL')).toBeInTheDocument();
    expect(screen.getByText('KEY STATEMENTS')).toBeInTheDocument();
  });

  it('displays session initiation time in ISO format', () => {
    render(<SessionSummary session={createSession()} onUpdateIntelligence={mockOnUpdateIntelligence} onDeleteIntelligence={mockOnDeleteIntelligence} onDestroy={mockOnDestroy} />);
    expect(screen.getByText('2026-02-22T10:00:00.000Z')).toBeInTheDocument();
  });
});
