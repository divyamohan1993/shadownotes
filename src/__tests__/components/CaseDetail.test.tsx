import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaseDetail } from '../../components/CaseDetail';
import { DOMAINS } from '../../domains';

const medicalDomain = DOMAINS.find(d => d.id === 'medical')!;
const mockCase = { id: 'c1', domainId: 'medical' as const, name: 'John Doe', shortId: 'MC-001', createdAt: Date.now(), updatedAt: Date.now() };

describe('CaseDetail', () => {
  const defaults = {
    domain: medicalDomain,
    caseItem: mockCase,
    listSessions: vi.fn().mockResolvedValue([]),
    onNewSession: vi.fn(),
    onOpenSession: vi.fn(),
    onDeleteSession: vi.fn().mockResolvedValue(undefined),
    onDeleteCase: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
  };

  it('renders case header', () => {
    render(<CaseDetail {...defaults} />);
    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('MC-001')).toBeDefined();
  });

  it('shows empty sessions state', async () => {
    render(<CaseDetail {...defaults} />);
    await screen.findByText(/No sessions recorded/);
  });

  it('renders session cards', async () => {
    const mockSessions = [{
      id: 's1', caseId: 'c1', caseNumber: 'SN-TEST', createdAt: Date.now(),
      duration: 120, segmentCount: 5, findingCount: 3, sizeBytes: 1024, encrypted: new ArrayBuffer(0),
    }];
    render(<CaseDetail {...defaults} listSessions={vi.fn().mockResolvedValue(mockSessions)} />);
    await screen.findByText('SN-TEST');
    expect(screen.getByText(/2m 0s/)).toBeDefined();
  });

  it('has NEW SESSION button', () => {
    render(<CaseDetail {...defaults} />);
    expect(screen.getByText(/NEW SESSION/)).toBeDefined();
  });
});
