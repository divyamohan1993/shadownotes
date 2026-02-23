import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// Mock SDK init
vi.mock('../../runanywhere', () => ({
  initSDK: vi.fn(async () => {}),
}));

// Mock child components to isolate App logic
vi.mock('../../components/SessionInit', () => ({
  SessionInit: ({ onStart }: any) => (
    <div data-testid="session-init">
      <button
        data-testid="start-security"
        onClick={() => onStart({
          id: 'security',
          name: 'Security Audit',
          codename: 'OPERATION FIREWALL',
          icon: '\u{1F6E1}',
          clearanceLevel: 'TOP SECRET',
          categories: ['Vulnerabilities'],
          systemPrompt: 'test prompt',
        })}
      >
        Start Security
      </button>
    </div>
  ),
}));

vi.mock('../../components/ActiveCapture', () => ({
  ActiveCapture: ({ onEndSession }: any) => (
    <div data-testid="active-capture">
      <button data-testid="end-session" onClick={onEndSession}>
        End Session
      </button>
    </div>
  ),
}));

vi.mock('../../components/SessionSummary', () => ({
  SessionSummary: ({ onDestroy }: any) => (
    <div data-testid="session-summary">
      <button data-testid="destroy-session" onClick={onDestroy}>
        Destroy
      </button>
    </div>
  ),
}));

import { App } from '../../App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows boot screen on initial load', () => {
    render(<App />);
    expect(screen.getByText('SHADOW NOTES')).toBeInTheDocument();
    expect(screen.getByText('ZERO-TRUST INTELLIGENCE SYSTEM')).toBeInTheDocument();
  });

  it('shows CLASSIFIED // EYES ONLY during boot', () => {
    render(<App />);
    expect(screen.getByText('CLASSIFIED // EYES ONLY')).toBeInTheDocument();
  });

  it('shows boot log messages progressively', async () => {
    render(<App />);

    // Phase 1 immediately
    await waitFor(() => {
      expect(screen.getByText(/Initializing secure environment/)).toBeInTheDocument();
    });

    // Advance to phase 2
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/Verifying air-gap integrity/)).toBeInTheDocument();

    // Advance to phase 3
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText(/Loading on-device inference engine/)).toBeInTheDocument();
  });

  it('transitions to SessionInit after boot completes', async () => {
    render(<App />);

    // Advance through boot sequence (400 + 300 + 300 + 200 = 1200ms)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-init')).toBeInTheDocument();
    });
  });

  it('navigates from init -> capture -> summary -> init (full lifecycle)', async () => {
    render(<App />);

    // Boot completes
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-init')).toBeInTheDocument();
    });

    // Start a session
    await act(async () => {
      screen.getByTestId('start-security').click();
    });

    expect(screen.getByTestId('active-capture')).toBeInTheDocument();

    // End session
    await act(async () => {
      screen.getByTestId('end-session').click();
    });

    expect(screen.getByTestId('session-summary')).toBeInTheDocument();

    // Destroy session
    await act(async () => {
      screen.getByTestId('destroy-session').click();
    });

    expect(screen.getByTestId('session-init')).toBeInTheDocument();
  });
});
