import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock SDK modules
vi.mock('../../runanywhere', () => ({
  initSDK: vi.fn(async () => {}),
  getRecommendedPreset: vi.fn(() => 'medium'),
  getSelectedLlmModelId: vi.fn(() => 'gemma-3-1b-it-q4_k_m'),
  getLlmModelMeta: vi.fn(() => ({ id: 'gemma-3-1b-it-q4_k_m', name: 'Gemma 3 1B', size: '~810 MB', params: '1B' })),
  LLM_MODELS: [
    { id: 'smollm2-135m-instruct-q4_k_m', name: 'SmolLM2 135M', size: '~100 MB', params: '135M' },
    { id: 'qwen2.5-0.5b-instruct-q4_k_m', name: 'Qwen2.5 0.5B', size: '~400 MB', params: '0.5B' },
    { id: 'gemma-3-1b-it-q4_k_m', name: 'Gemma 3 1B', size: '~810 MB', params: '1B' },
  ],
  switchLlmModel: vi.fn(async () => true),
  ModelManager: {
    getModels: vi.fn(() => []),
  },
  ModelCategory: { Language: 'language' },
  OPFSStorage: vi.fn(() => ({ initialize: vi.fn(async () => false), hasModel: vi.fn(async () => false) })),
}));

vi.mock('../../hooks/useModelLoader', () => ({
  useModelLoader: vi.fn(() => ({
    state: 'idle',
    progress: 0,
    error: null,
    ensure: vi.fn(async () => true),
  })),
}));

vi.mock('@runanywhere/web', () => ({
  ModelCategory: { Language: 'language' },
  ModelManager: {
    getLoadedModel: vi.fn(() => null),
    getModels: vi.fn(() => []),
  },
  EventBus: { shared: { on: vi.fn(() => () => {}) } },
}));

vi.mock('@runanywhere/web-llamacpp', () => ({
  TextGeneration: {
    generate: vi.fn(async () => ({ text: '', tokensUsed: 0, tokensPerSecond: 0, latencyMs: 0 })),
  },
}));

// Mock auth — PRF not supported
vi.mock('../../auth', () => ({
  isPRFSupported: vi.fn(async () => false),
}));

// Mock VaultContext with a functional mock vault
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

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

(globalThis as any).window = globalThis.window || {};
Object.defineProperty(window, 'SpeechRecognition', {
  value: MockSpeechRecognition,
  writable: true,
  configurable: true,
});

import { App } from '../../App';

async function bootAndUnlock(user: ReturnType<typeof userEvent.setup>) {
  // 1. Boot sequence completes
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });

  // 2. Unlock screen — enter passphrase and unlock
  await waitFor(() => {
    expect(screen.getByText(/VAULT AUTHENTICATION REQUIRED/)).toBeInTheDocument();
  });

  const input = screen.getByPlaceholderText('Enter passphrase...');
  await user.type(input, 'testpass');

  await act(async () => {
    fireEvent.click(screen.getByText('UNLOCK VAULT'));
  });

  // 3. Should now be on init screen
  await waitFor(() => {
    expect(screen.getByText('Security Audit')).toBeInTheDocument();
  });
}

describe('Integration: Full Session Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('boots, unlocks, and reaches domain selection', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    // 1. Boot sequence
    expect(screen.getByText('SHADOW NOTES')).toBeInTheDocument();
    expect(screen.getByText('CLASSIFIED // EYES ONLY')).toBeInTheDocument();

    await bootAndUnlock(user);

    // Should see all domains
    expect(screen.getByText('Security Audit')).toBeInTheDocument();
    expect(screen.getByText('Legal Deposition')).toBeInTheDocument();
    expect(screen.getByText('Medical Notes')).toBeInTheDocument();
    expect(screen.getByText('Incident Report')).toBeInTheDocument();
  });

  it('selects domain and navigates to case list', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await bootAndUnlock(user);

    // Select Security Audit and click OPEN CASE FILES
    await user.click(screen.getByText('Security Audit'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    // Should navigate to cases screen (mocked listCases returns [])
    await waitFor(() => {
      expect(screen.getByText('OPERATION FIREWALL')).toBeInTheDocument();
      expect(screen.getByText(/0 case/)).toBeInTheDocument();
    });
  });
});

describe('Integration: Domain Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('can select Security Audit domain', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await bootAndUnlock(user);

    await user.click(screen.getByText('Security Audit'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    await waitFor(() => {
      expect(screen.getByText('OPERATION FIREWALL')).toBeInTheDocument();
    });
  });

  it('can select Legal Deposition domain', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await bootAndUnlock(user);

    await user.click(screen.getByText('Legal Deposition'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    await waitFor(() => {
      expect(screen.getByText('OPERATION TESTIMONY')).toBeInTheDocument();
    });
  });

  it('can select Medical Notes domain', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await bootAndUnlock(user);

    await user.click(screen.getByText('Medical Notes'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    await waitFor(() => {
      expect(screen.getByText('OPERATION VITALS')).toBeInTheDocument();
    });
  });

  it('can select Incident Report domain', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await bootAndUnlock(user);

    await user.click(screen.getByText('Incident Report'));
    await user.click(screen.getByText('OPEN CASE FILES'));

    await waitFor(() => {
      expect(screen.getByText('OPERATION CHRONICLE')).toBeInTheDocument();
    });
  });
});

describe('Integration: Vault Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows unlock screen before allowing access', async () => {
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText(/VAULT AUTHENTICATION REQUIRED/)).toBeInTheDocument();
    });

    // Should NOT show domain selection yet
    expect(screen.queryByText('Security Audit')).not.toBeInTheDocument();
  });
});
