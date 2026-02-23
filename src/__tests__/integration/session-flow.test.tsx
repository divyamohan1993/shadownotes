import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

    // 3. Select domain and begin — starts immediately (no model download)
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
