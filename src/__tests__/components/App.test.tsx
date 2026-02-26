import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// Mock SDK init
vi.mock('../../runanywhere', () => ({
  initSDK: vi.fn(async () => {}),
  ModelManager: {
    getModels: vi.fn(() => []),
  },
  ModelCategory: { Language: 'language' },
  OPFSStorage: vi.fn(() => ({ initialize: vi.fn(async () => false), hasModel: vi.fn(async () => false) })),
}));

vi.mock('@runanywhere/web', () => ({
  EventBus: { shared: { on: vi.fn(() => () => {}) } },
}));

// Mock auth — PRF not supported so unlock screen shows passphrase
vi.mock('../../auth', () => ({
  isPRFSupported: vi.fn(async () => false),
}));

// Mock VaultContext
const mockVault = {
  isUnlocked: false,
  authMethod: null,
  unlock: vi.fn(async () => {}),
  unlockWithPassphrase: vi.fn(async () => {}),
  listCases: vi.fn(async () => []),
  createCase: vi.fn(async () => 'case-1'),
  deleteCase: vi.fn(async () => {}),
  findCase: vi.fn(async () => undefined),
  listSessions: vi.fn(async () => []),
  saveSession: vi.fn(async () => 'session-1'),
  loadSession: vi.fn(async () => ({ transcripts: [], intelligence: [] })),
  updateSession: vi.fn(async () => {}),
  deleteSession: vi.fn(async () => {}),
  getSessionCount: vi.fn(async () => 0),
  getStorageStatus: vi.fn(async () => ({ level: 'ok' as const, usedBytes: 0, maxBytes: 50 * 1024 * 1024, usedPercent: 0 })),
  rotateIfNeeded: vi.fn(async () => 0),
  formatSize: vi.fn((b: number) => `${b} B`),
  destroyVault: vi.fn(async () => {}),
};

vi.mock('../../VaultContext', () => ({
  VaultProvider: ({ children }: any) => <div>{children}</div>,
  useVault: () => mockVault,
}));

// Mock child components to isolate App logic
vi.mock('../../components/VaultUnlock', () => ({
  VaultUnlock: ({ onUnlockPassphrase }: any) => (
    <div data-testid="vault-unlock">
      <button
        data-testid="unlock-btn"
        onClick={() => onUnlockPassphrase('test')}
      >
        Unlock
      </button>
    </div>
  ),
}));

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

vi.mock('../../components/CaseList', () => ({
  CaseList: ({ onBack }: any) => (
    <div data-testid="case-list">
      <button data-testid="back-to-init" onClick={onBack}>Back</button>
    </div>
  ),
}));

vi.mock('../../components/CaseDetail', () => ({
  CaseDetail: ({ onBack }: any) => (
    <div data-testid="case-detail">
      <button data-testid="back-to-cases" onClick={onBack}>Back</button>
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
  SessionSummary: ({ onBack }: any) => (
    <div data-testid="session-summary">
      <button data-testid="back-to-case" onClick={onBack}>
        Back
      </button>
    </div>
  ),
}));

vi.mock('../../components/VoiceCommandHelp', () => ({
  VoiceCommandHelp: () => null,
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

    // All boot phases appear immediately (no artificial delays)
    await waitFor(() => {
      expect(screen.getByText(/Initializing secure environment/)).toBeInTheDocument();
      expect(screen.getByText(/Verifying air-gap integrity/)).toBeInTheDocument();
      expect(screen.getByText(/Loading on-device inference engine/)).toBeInTheDocument();
    });
  });

  it('transitions to unlock screen after boot completes', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('vault-unlock')).toBeInTheDocument();
    });
  });

  it('navigates from unlock -> init after authentication', async () => {
    render(<App />);

    // Boot completes
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('vault-unlock')).toBeInTheDocument();
    });

    // Unlock vault
    await act(async () => {
      screen.getByTestId('unlock-btn').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-init')).toBeInTheDocument();
    });
  });
});
