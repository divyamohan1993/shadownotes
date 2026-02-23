import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock SDK modules
vi.mock('../../runanywhere', () => ({
  initSDK: vi.fn(async () => {}),
  ModelManager: {
    getModels: vi.fn(() => []),
  },
  ModelCategory: { Language: 'language' },
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

describe('Integration: Full Session Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes a full session: boot -> select domain -> capture screen -> end -> summary -> destroy', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    // 1. Boot sequence
    expect(screen.getByText('SHADOW NOTES')).toBeInTheDocument();
    expect(screen.getByText('CLASSIFIED // EYES ONLY')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // 2. Session Init screen
    await waitFor(() => {
      expect(screen.getByText('CLASSIFIED')).toBeInTheDocument();
      expect(screen.getByText('Security Audit')).toBeInTheDocument();
    });

    // 3. Select domain and begin — starts immediately
    await user.click(screen.getByText('Security Audit'));
    await user.click(screen.getByText('BEGIN CAPTURE SESSION'));

    // 4. Active capture screen
    await waitFor(() => {
      expect(screen.getByText(/CASE: SN-/)).toBeInTheDocument();
      expect(screen.getByText('TOP SECRET')).toBeInTheDocument();
      expect(screen.getByText('OPERATION FIREWALL')).toBeInTheDocument();
      expect(screen.getByText('RAW TRANSCRIPT')).toBeInTheDocument();
      expect(screen.getByText('INTELLIGENCE EXTRACT')).toBeInTheDocument();
    });

    // 5. End session
    fireEvent.click(screen.getByText('END SESSION'));

    // 6. Summary screen
    await waitFor(() => {
      expect(screen.getByText('SESSION DOSSIER')).toBeInTheDocument();
    });

    // 7. Destroy session (double click for confirm)
    fireEvent.click(screen.getByText('DESTROY SESSION'));
    fireEvent.click(screen.getByText('CONFIRM: DESTROY ALL SESSION DATA'));

    // Wait for burn animation
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // 8. Back to init
    await waitFor(() => {
      expect(screen.getByText('Security Audit')).toBeInTheDocument();
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

  it.each([
    ['Security Audit', 'OPERATION FIREWALL', 'TOP SECRET'],
    ['Legal Deposition', 'OPERATION TESTIMONY', 'CONFIDENTIAL'],
    ['Medical Notes', 'OPERATION VITALS', 'RESTRICTED'],
    ['Incident Report', 'OPERATION CHRONICLE', 'SECRET'],
  ])('can start a %s session', async (domainName, codename, clearance) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText(domainName)).toBeInTheDocument();
    });

    await user.click(screen.getByText(domainName));
    await user.click(screen.getByText('BEGIN CAPTURE SESSION'));

    await waitFor(() => {
      expect(screen.getByText(codename)).toBeInTheDocument();
      expect(screen.getByText(clearance)).toBeInTheDocument();
    });
  });
});

describe('Integration: Ephemeral Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('session data is completely wiped after destroy', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText('Security Audit')).toBeInTheDocument();
    });

    // Start session
    await user.click(screen.getByText('Security Audit'));
    await user.click(screen.getByText('BEGIN CAPTURE SESSION'));

    await waitFor(() => {
      expect(screen.getByText(/CASE: SN-/)).toBeInTheDocument();
    });

    // End session
    fireEvent.click(screen.getByText('END SESSION'));

    await waitFor(() => {
      expect(screen.getByText('SESSION DOSSIER')).toBeInTheDocument();
    });

    // Destroy
    fireEvent.click(screen.getByText('DESTROY SESSION'));
    fireEvent.click(screen.getByText('CONFIRM: DESTROY ALL SESSION DATA'));

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Back at init — no session data should exist
    await waitFor(() => {
      expect(screen.getByText('Security Audit')).toBeInTheDocument();
      expect(screen.queryByText('SESSION DOSSIER')).not.toBeInTheDocument();
      expect(screen.queryByText(/CASE: SN-/)).not.toBeInTheDocument();
    });
  });
});
