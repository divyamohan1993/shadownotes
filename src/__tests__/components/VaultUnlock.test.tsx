import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VaultUnlock } from '../../components/VaultUnlock';

describe('VaultUnlock', () => {
  it('renders Windows Hello button when PRF supported', () => {
    render(<VaultUnlock onUnlockPRF={vi.fn()} onUnlockPassphrase={vi.fn()} prfSupported={true} error={null} />);
    expect(screen.getByText(/Windows Hello/i)).toBeDefined();
  });

  it('renders passphrase input when PRF not supported', () => {
    render(<VaultUnlock onUnlockPRF={vi.fn()} onUnlockPassphrase={vi.fn()} prfSupported={false} error={null} />);
    expect(screen.getByPlaceholderText(/passphrase/i)).toBeDefined();
  });

  it('calls onUnlockPRF when button clicked', async () => {
    const fn = vi.fn();
    render(<VaultUnlock onUnlockPRF={fn} onUnlockPassphrase={vi.fn()} prfSupported={true} error={null} />);
    await userEvent.click(screen.getByText(/Windows Hello/i));
    expect(fn).toHaveBeenCalled();
  });

  it('shows error message', () => {
    render(<VaultUnlock onUnlockPRF={vi.fn()} onUnlockPassphrase={vi.fn()} prfSupported={true} error="Auth failed" />);
    expect(screen.getByText(/Auth failed/)).toBeDefined();
  });
});
