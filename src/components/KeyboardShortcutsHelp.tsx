interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: 'Ctrl + F', description: 'Search vault' },
  { keys: 'Ctrl + N', description: 'New session (from case detail)' },
  { keys: 'Ctrl + S', description: 'Save session (during capture)' },
  { keys: 'Ctrl + Enter', description: 'Submit text (in text mode)' },
  { keys: 'Escape', description: 'Go back / close overlay' },
  { keys: '?', description: 'Toggle this help' },
];

export function KeyboardShortcutsHelp({ onClose }: Props) {
  return (
    <div className="voice-help-overlay" onClick={onClose}>
      <div className="voice-help-card" onClick={(e) => e.stopPropagation()}>
        <div className="voice-help-header">
          <h3>KEYBOARD SHORTCUTS</h3>
          <button className="voice-help-close" onClick={onClose}>{'\u2715'}</button>
        </div>
        <div className="voice-help-list">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="voice-help-item">
              <span className="kbd-tag-group">
                {s.keys.split(' + ').map((k, j) => (
                  <span key={j}>
                    {j > 0 && <span className="kbd-plus">+</span>}
                    <kbd className="kbd-tag">{k}</kbd>
                  </span>
                ))}
              </span>
              <span className="voice-help-desc">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
