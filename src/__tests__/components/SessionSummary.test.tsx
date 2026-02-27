import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SessionSummary } from '../../components/SessionSummary';
import { DOMAINS } from '../../domains';
import type { DomainProfile, VaultSession, SessionContent } from '../../types';

function createTestData(overrides?: {
  domain?: DomainProfile;
  vaultSession?: Partial<VaultSession>;
  content?: Partial<SessionContent>;
}) {
  const domain: DomainProfile = overrides?.domain ?? DOMAINS[0]; // Security Audit
  const vaultSession: VaultSession = {
    id: 'session-1',
    caseId: 'case-1',
    caseNumber: 'SN-260222-TEST',
    createdAt: new Date('2026-02-22T10:00:00Z').getTime(),
    duration: 300, // 5 minutes
    segmentCount: 2,
    findingCount: 3,
    sizeBytes: 1024,
    encrypted: new ArrayBuffer(0),
    ...overrides?.vaultSession,
  };
  const content: SessionContent = {
    transcripts: [
      { text: 'Server room entry at 02:14 AM', timestamp: '14:30:00' },
      { text: 'Badge logs show unauthorized access', timestamp: '14:31:00' },
    ],
    intelligence: [
      { id: 'test-1', category: 'Vulnerabilities', content: 'Unauthorized badge access', timestamp: '14:30:00' },
      { id: 'test-2', category: 'Timeline', content: '02:14 AM server room entry', timestamp: '14:30:00' },
      { id: 'test-3', category: 'Evidence', content: 'Badge log records', timestamp: '14:31:00' },
    ],
    ...overrides?.content,
  };
  return { domain, vaultSession, content };
}

describe('SessionSummary', () => {
  const mockOnDeleteSession = vi.fn(async () => {});
  const mockOnUpdateIntelligence = vi.fn();
  const mockOnDeleteIntelligence = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderSummary(overrides?: Parameters<typeof createTestData>[0]) {
    const { domain, vaultSession, content } = createTestData(overrides);
    return render(
      <SessionSummary
        domain={domain}
        vaultSession={vaultSession}
        content={content}
        onUpdateIntelligence={mockOnUpdateIntelligence}
        onDeleteIntelligence={mockOnDeleteIntelligence}
        onDeleteSession={mockOnDeleteSession}
        onBack={mockOnBack}
      />
    );
  }

  it('renders SESSION DOSSIER title', () => {
    renderSummary();
    expect(screen.getByText('SESSION DOSSIER')).toBeInTheDocument();
  });

  it('renders CLASSIFIED and EYES ONLY stamps', () => {
    renderSummary();
    expect(screen.getByText('CLASSIFIED')).toBeInTheDocument();
    expect(screen.getByText('EYES ONLY')).toBeInTheDocument();
  });

  it('displays case number', () => {
    renderSummary();
    expect(screen.getByText('SN-260222-TEST')).toBeInTheDocument();
  });

  it('displays operation codename', () => {
    renderSummary();
    expect(screen.getByText('OPERATION FIREWALL')).toBeInTheDocument();
  });

  it('displays domain name', () => {
    renderSummary();
    expect(screen.getByText('Security Audit')).toBeInTheDocument();
  });

  it('displays clearance level', () => {
    renderSummary();
    expect(screen.getByText('TOP SECRET')).toBeInTheDocument();
  });

  it('displays transcript count', () => {
    renderSummary();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 segments
  });

  it('displays findings count', () => {
    renderSummary();
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 findings
  });

  it('renders RAW TRANSCRIPT section', () => {
    renderSummary();
    expect(screen.getByText('RAW TRANSCRIPT')).toBeInTheDocument();
  });

  it('renders INTELLIGENCE EXTRACT section', () => {
    renderSummary();
    expect(screen.getByText('INTELLIGENCE EXTRACT')).toBeInTheDocument();
  });

  it('displays transcript text', () => {
    renderSummary();
    expect(screen.getByText('Server room entry at 02:14 AM')).toBeInTheDocument();
    expect(screen.getByText('Badge logs show unauthorized access')).toBeInTheDocument();
  });

  it('displays intelligence items', () => {
    renderSummary();
    expect(screen.getByText('Unauthorized badge access')).toBeInTheDocument();
    expect(screen.getByText('02:14 AM server room entry')).toBeInTheDocument();
    expect(screen.getByText('Badge log records')).toBeInTheDocument();
  });

  it('groups intelligence by category', () => {
    renderSummary();
    expect(screen.getByText('VULNERABILITIES')).toBeInTheDocument();
    expect(screen.getByText('TIMELINE')).toBeInTheDocument();
    expect(screen.getByText('EVIDENCE')).toBeInTheDocument();
  });

  it('shows warning about encrypted data', () => {
    renderSummary();
    expect(screen.getByText(/Session data is encrypted and stored locally/)).toBeInTheDocument();
  });

  it('shows DELETE SESSION button', () => {
    renderSummary();
    expect(screen.getByText('DELETE SESSION')).toBeInTheDocument();
  });

  it('requires confirmation before deleting', () => {
    renderSummary();

    fireEvent.click(screen.getByText('DELETE SESSION'));

    // Should show confirmation text
    expect(screen.getByText(/CONFIRM: DELETE SESSION/)).toBeInTheDocument();
    // Should NOT have called onDeleteSession yet
    expect(mockOnDeleteSession).not.toHaveBeenCalled();
  });

  it('calls onDeleteSession after confirmation', async () => {
    renderSummary();

    // First click: enter confirm mode
    fireEvent.click(screen.getByText('DELETE SESSION'));
    // Second click: actually delete
    await act(async () => {
      fireEvent.click(screen.getByText(/CONFIRM: DELETE SESSION/));
    });

    expect(mockOnDeleteSession).toHaveBeenCalledTimes(1);
  });

  it('shows BACK TO CASE button', () => {
    renderSummary();
    expect(screen.getByText('BACK TO CASE')).toBeInTheDocument();
  });

  it('resets confirm state after 5 second timeout', async () => {
    renderSummary();

    fireEvent.click(screen.getByText('DELETE SESSION'));
    expect(screen.getByText(/CONFIRM: DELETE SESSION/)).toBeInTheDocument();

    // Advance past 5 second timeout
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    // Should be back to normal state
    expect(screen.getByText('DELETE SESSION')).toBeInTheDocument();
  });

  it('handles empty session (no transcripts/intelligence)', () => {
    renderSummary({
      content: {
        transcripts: [],
        intelligence: [],
      },
    });
    expect(screen.getByText('No transcript data captured.')).toBeInTheDocument();
    expect(screen.getByText('No intelligence extracted.')).toBeInTheDocument();
  });

  it('renders for different domain types', () => {
    renderSummary({
      domain: DOMAINS[1], // Legal Deposition
      content: {
        transcripts: [],
        intelligence: [
          { id: 'test-legal-1', category: 'Key Statements', content: 'Witness admitted to being present', timestamp: '10:00:00' },
        ],
      },
    });
    expect(screen.getByText('OPERATION TESTIMONY')).toBeInTheDocument();
    expect(screen.getByText('CONFIDENTIAL')).toBeInTheDocument();
    expect(screen.getByText('KEY STATEMENTS')).toBeInTheDocument();
  });

  it('displays session initiation time in ISO format', () => {
    renderSummary();
    expect(screen.getByText('2026-02-22T10:00:00.000Z')).toBeInTheDocument();
  });
});
