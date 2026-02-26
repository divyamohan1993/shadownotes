export type VoiceAction =
  | 'create-case' | 'open-case' | 'delete-case'
  | 'show-history' | 'open-session' | 'last-update' | 'new-session'
  | 'go-back' | 'list-cases' | 'save' | 'discard' | 'confirm-delete';

export interface VoiceCommand {
  action: VoiceAction;
  args: string;
}

const WAKE = /^hey\s+shadow\s+/i;

const COMMANDS: Array<{ pattern: RegExp; action: VoiceAction }> = [
  { pattern: /^create\s+case\s+(.+)$/i, action: 'create-case' },
  { pattern: /^open\s+case\s+(.+)$/i, action: 'open-case' },
  { pattern: /^delete\s+case\s+(.+)$/i, action: 'delete-case' },
  { pattern: /^show\s+history$/i, action: 'show-history' },
  { pattern: /^open\s+session\s+(.+)$/i, action: 'open-session' },
  { pattern: /^last\s+update$/i, action: 'last-update' },
  { pattern: /^new\s+session$/i, action: 'new-session' },
  { pattern: /^go\s+back$/i, action: 'go-back' },
  { pattern: /^list\s+cases$/i, action: 'list-cases' },
  { pattern: /^confirm\s+delete$/i, action: 'confirm-delete' },
  { pattern: /^save$/i, action: 'save' },
  { pattern: /^discard$/i, action: 'discard' },
];

export function parseVoiceCommand(text: string): VoiceCommand | null {
  const trimmed = text.trim();
  if (!WAKE.test(trimmed)) return null;
  const afterWake = trimmed.replace(WAKE, '').trim();
  for (const { pattern, action } of COMMANDS) {
    const match = afterWake.match(pattern);
    if (match) {
      return { action, args: (match[1] ?? '').trim() };
    }
  }
  return null;
}
