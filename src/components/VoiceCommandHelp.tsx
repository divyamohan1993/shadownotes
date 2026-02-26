import type { AppScreen } from '../types';

interface Props {
  screen: AppScreen;
  onClose: () => void;
}

const COMMANDS_BY_SCREEN: Record<string, Array<{ command: string; description: string }>> = {
  cases: [
    { command: 'Hey Shadow create case [name]', description: 'Create a new case' },
    { command: 'Hey Shadow open case [name/ID]', description: 'Open a case' },
    { command: 'Hey Shadow delete case [name/ID]', description: 'Delete a case' },
    { command: 'Hey Shadow list cases', description: 'List all cases' },
    { command: 'Hey Shadow go back', description: 'Return to domains' },
  ],
  'case-detail': [
    { command: 'Hey Shadow new session', description: 'Start recording' },
    { command: 'Hey Shadow open session [N]', description: 'Open Nth session' },
    { command: 'Hey Shadow last update', description: 'Open most recent session' },
    { command: 'Hey Shadow show history', description: 'View session timeline' },
    { command: 'Hey Shadow delete case', description: 'Delete this case' },
    { command: 'Hey Shadow go back', description: 'Return to cases' },
  ],
  capture: [
    { command: 'Hey Shadow save', description: 'Save and end session' },
    { command: 'Hey Shadow discard', description: 'Discard session' },
    { command: 'Hey Shadow go back', description: 'End and go back' },
  ],
  summary: [
    { command: 'Hey Shadow go back', description: 'Return to case' },
  ],
};

export function VoiceCommandHelp({ screen, onClose }: Props) {
  const commands = COMMANDS_BY_SCREEN[screen] || [];
  if (commands.length === 0) return null;

  return (
    <div className="voice-help-overlay" onClick={onClose}>
      <div className="voice-help-card" onClick={(e) => e.stopPropagation()}>
        <div className="voice-help-header">
          <h3>VOICE COMMANDS</h3>
          <button className="voice-help-close" onClick={onClose}>{'\u2715'}</button>
        </div>
        <div className="voice-help-list">
          {commands.map((cmd, i) => (
            <div key={i} className="voice-help-item">
              <code className="voice-help-command">{cmd.command}</code>
              <span className="voice-help-desc">{cmd.description}</span>
            </div>
          ))}
        </div>
        <p className="voice-help-note">Say "Hey Shadow" followed by the command while microphone is active.</p>
      </div>
    </div>
  );
}
