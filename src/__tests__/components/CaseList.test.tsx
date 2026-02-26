import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseList } from '../../components/CaseList';
import { DOMAINS } from '../../domains';

const medicalDomain = DOMAINS.find(d => d.id === 'medical')!;

describe('CaseList', () => {
  const defaults = {
    domain: medicalDomain,
    listCases: vi.fn().mockResolvedValue([]),
    onCreateCase: vi.fn().mockResolvedValue(undefined),
    onOpenCase: vi.fn(),
    onDeleteCase: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
    storageWarning: null,
  };

  it('renders domain header', () => {
    render(<CaseList {...defaults} />);
    expect(screen.getByText(/OPERATION VITALS/)).toBeDefined();
  });

  it('shows empty state', async () => {
    render(<CaseList {...defaults} />);
    await screen.findByText(/No cases yet/);
  });

  it('shows create form', async () => {
    render(<CaseList {...defaults} />);
    await userEvent.click(screen.getByText('+ NEW CASE'));
    expect(screen.getByPlaceholderText(/Case name/)).toBeDefined();
  });

  it('renders case cards', async () => {
    const mockCases = [
      { id: '1', domainId: 'medical' as const, name: 'John Doe', shortId: 'MC-001', createdAt: Date.now(), updatedAt: Date.now() },
    ];
    render(<CaseList {...defaults} listCases={vi.fn().mockResolvedValue(mockCases)} />);
    await screen.findByText('John Doe');
    expect(screen.getByText('MC-001')).toBeDefined();
  });

  it('shows storage warning', () => {
    render(<CaseList {...defaults} storageWarning="Storage: 38/50 MB used" />);
    expect(screen.getByText(/38\/50 MB/)).toBeDefined();
  });
});
