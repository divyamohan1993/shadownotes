import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

import { SessionInit } from '../../components/SessionInit';
import { useModelLoader } from '../../hooks/useModelLoader';

describe('SessionInit', () => {
  const mockOnStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useModelLoader as ReturnType<typeof vi.fn>).mockReturnValue({
      state: 'idle',
      progress: 0,
      error: null,
      ensure: mockEnsure,
    });
  });

  it('renders the title', () => {
    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText('SHADOW NOTES')).toBeInTheDocument();
  });

  it('renders the CLASSIFIED stamp', () => {
    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText('CLASSIFIED')).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText(/Select operation domain/)).toBeInTheDocument();
  });

  it('renders all 4 domain cards', () => {
    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText('Security Audit')).toBeInTheDocument();
    expect(screen.getByText('Legal Deposition')).toBeInTheDocument();
    expect(screen.getByText('Medical Notes')).toBeInTheDocument();
    expect(screen.getByText('Incident Report')).toBeInTheDocument();
  });

  it('renders all domain codenames', () => {
    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText('OPERATION FIREWALL')).toBeInTheDocument();
    expect(screen.getByText('OPERATION TESTIMONY')).toBeInTheDocument();
    expect(screen.getByText('OPERATION VITALS')).toBeInTheDocument();
    expect(screen.getByText('OPERATION CHRONICLE')).toBeInTheDocument();
  });

  it('renders all clearance levels', () => {
    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText('TOP SECRET')).toBeInTheDocument();
    expect(screen.getByText('CONFIDENTIAL')).toBeInTheDocument();
    expect(screen.getByText('RESTRICTED')).toBeInTheDocument();
    expect(screen.getByText('SECRET')).toBeInTheDocument();
  });

  it('shows the begin button as disabled when no domain selected', () => {
    render(<SessionInit onStart={mockOnStart} />);
    const btn = screen.getByText('OPEN CASE FILES');
    expect(btn).toBeDisabled();
  });

  it('enables the begin button after selecting a domain', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Security Audit'));
    const btn = screen.getByText('OPEN CASE FILES');
    expect(btn).not.toBeDisabled();
  });

  it('calls onStart with the correct domain immediately', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Security Audit'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    expect(mockOnStart).toHaveBeenCalledTimes(1);
    const calledDomain = mockOnStart.mock.calls[0][0];
    expect(calledDomain.id).toBe('security');
    expect(calledDomain.name).toBe('Security Audit');
  });

  it('renders status footer with privacy indicators', () => {
    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText('AI EXTRACTION ON-DEVICE')).toBeInTheDocument();
    expect(screen.getByText('RUNANYWHERE ENGINE')).toBeInTheDocument();
  });

  it('can select different domain cards', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Medical Notes'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    expect(mockOnStart).toHaveBeenCalled();
    expect(mockOnStart.mock.calls[0][0].id).toBe('medical');
  });

  it('starts a Legal Deposition session', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Legal Deposition'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    expect(mockOnStart.mock.calls[0][0].id).toBe('legal');
  });

  it('starts an Incident Report session', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Incident Report'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    expect(mockOnStart.mock.calls[0][0].id).toBe('incident');
  });

  it('does nothing if begin clicked without selection', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    const btn = screen.getByText('OPEN CASE FILES');
    expect(btn).toBeDisabled();
    expect(mockOnStart).not.toHaveBeenCalled();
  });

  it('triggers model download when domain is selected', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Security Audit'));

    expect(mockEnsure).toHaveBeenCalled();
  });

  it('shows AI ENGINE READY when model is loaded', async () => {
    (useModelLoader as ReturnType<typeof vi.fn>).mockReturnValue({
      state: 'ready',
      progress: 1,
      error: null,
      ensure: mockEnsure,
    });

    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Security Audit'));

    expect(screen.getByText(/AI ENGINE READY/)).toBeInTheDocument();
  });

  it('shows keyword mode message when LLM fails', async () => {
    (useModelLoader as ReturnType<typeof vi.fn>).mockReturnValue({
      state: 'error',
      progress: 0,
      error: 'Model load failed',
      ensure: mockEnsure,
    });

    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Security Audit'));

    expect(screen.getByText(/KEYWORD MODE ACTIVE/)).toBeInTheDocument();
  });
});
