import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock SDK modules
vi.mock('@runanywhere/web', () => import('../__mocks__/runanywhere-web'));
vi.mock('@runanywhere/web-llamacpp', () => import('../__mocks__/runanywhere-web-llamacpp'));
vi.mock('@runanywhere/web-onnx', () => import('../__mocks__/runanywhere-web-onnx'));

// Mock useModelLoader to control loading behavior
const mockEnsure = vi.fn(async () => true);
vi.mock('../../hooks/useModelLoader', () => ({
  useModelLoader: vi.fn(() => ({
    state: 'idle' as const,
    progress: 0,
    error: null,
    ensure: mockEnsure,
  })),
}));

import { SessionInit } from '../../components/SessionInit';
import { useModelLoader } from '../../hooks/useModelLoader';

describe('SessionInit', () => {
  const mockOnStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsure.mockResolvedValue(true);
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
    const btn = screen.getByText(/DOWNLOAD SECURE MODULES/);
    expect(btn).toBeDisabled();
  });

  it('enables the begin button after selecting a domain', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Security Audit'));
    const btn = screen.getByText(/DOWNLOAD SECURE MODULES/);
    expect(btn).not.toBeDisabled();
  });

  it('calls onStart with the correct domain after loading models', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Security Audit'));
    await user.click(screen.getByText(/DOWNLOAD SECURE MODULES/));

    await waitFor(() => {
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    const calledDomain = mockOnStart.mock.calls[0][0];
    expect(calledDomain.id).toBe('security');
    expect(calledDomain.name).toBe('Security Audit');
  });

  it('loads models in correct order: VAD -> STT -> LLM', async () => {
    const callOrder: string[] = [];
    const mockedUseModelLoader = useModelLoader as any;

    // Track which category is loaded when
    mockedUseModelLoader.mockImplementation((category: string) => ({
      state: 'idle',
      progress: 0,
      error: null,
      ensure: vi.fn(async () => {
        callOrder.push(category);
        return true;
      }),
    }));

    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Legal Deposition'));
    await user.click(screen.getByText(/DOWNLOAD SECURE MODULES/));

    await waitFor(() => {
      expect(mockOnStart).toHaveBeenCalled();
    }, { timeout: 3000 });

    // VAD (audio) should load first, then STT (speechRecognition), then LLM (language)
    expect(callOrder[0]).toBe('audio');
    expect(callOrder[1]).toBe('speechRecognition');
    expect(callOrder[2]).toBe('language');
  });

  it('stops loading if VAD model fails', async () => {
    const mockedUseModelLoader = useModelLoader as any;
    mockedUseModelLoader.mockImplementation((category: string) => ({
      state: 'idle',
      progress: 0,
      error: null,
      ensure: vi.fn(async () => {
        if (category === 'audio') return false;
        return true;
      }),
    }));

    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    await user.click(screen.getByText('Security Audit'));
    await user.click(screen.getByText(/DOWNLOAD SECURE MODULES/));

    // Wait a bit, onStart should NOT have been called
    await new Promise((r) => setTimeout(r, 1000));
    expect(mockOnStart).not.toHaveBeenCalled();
  });

  it('renders status footer with privacy indicators', () => {
    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText('ALL PROCESSING ON-DEVICE')).toBeInTheDocument();
    expect(screen.getByText('ZERO NETWORK DEPENDENCY')).toBeInTheDocument();
  });

  it('shows BEGIN CAPTURE SESSION when all models are ready', () => {
    const mockedUseModelLoader = useModelLoader as any;
    mockedUseModelLoader.mockReturnValue({
      state: 'ready',
      progress: 1,
      error: null,
      ensure: mockEnsure,
    });

    render(<SessionInit onStart={mockOnStart} />);
    expect(screen.getByText('BEGIN CAPTURE SESSION')).toBeInTheDocument();
  });

  it('can select different domain cards', async () => {
    const user = userEvent.setup();
    render(<SessionInit onStart={mockOnStart} />);

    // Click Medical Notes
    await user.click(screen.getByText('Medical Notes'));
    await user.click(screen.getByText(/DOWNLOAD SECURE MODULES|BEGIN CAPTURE/));

    await waitFor(() => {
      expect(mockOnStart).toHaveBeenCalled();
    }, { timeout: 3000 });

    expect(mockOnStart.mock.calls[0][0].id).toBe('medical');
  });
});
