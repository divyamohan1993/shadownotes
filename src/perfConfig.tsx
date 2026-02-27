import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';

export interface PerfConfig {
  // LLM
  llmEnabled: boolean;
  maxTokens: number;
  temperature: number;
  extractionDebounceMs: number;
  // Ollama (Electron only)
  ollamaEnabled: boolean;
  ollamaModel: string;
  // Speech
  interimThrottleMs: number;
  // Rendering
  animationsEnabled: boolean;
  vadBarCount: number;
  timerUpdateMs: number;
}

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

export const PERF_PRESETS: Record<string, PerfConfig> = {
  High: {
    llmEnabled: true,
    maxTokens: 150,
    temperature: 0.3,
    extractionDebounceMs: 800,
    ollamaEnabled: false,
    ollamaModel: 'gemma3:1b',
    interimThrottleMs: 0,
    animationsEnabled: true,
    vadBarCount: 12,
    timerUpdateMs: 1000,
  },
  Medium: {
    llmEnabled: true,
    maxTokens: 100,
    temperature: 0.3,
    extractionDebounceMs: 1500,
    ollamaEnabled: false,
    ollamaModel: 'gemma3:1b',
    interimThrottleMs: 200,
    animationsEnabled: true,
    vadBarCount: 4,
    timerUpdateMs: 1000,
  },
  Low: {
    llmEnabled: false,
    maxTokens: 0,
    temperature: 0.3,
    extractionDebounceMs: 2000,
    ollamaEnabled: false,
    ollamaModel: 'gemma3:1b',
    interimThrottleMs: 500,
    animationsEnabled: false,
    vadBarCount: 0,
    timerUpdateMs: 5000,
  },
};

const STORAGE_KEY = 'shadownotes-perf';

function loadConfig(): PerfConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...PERF_PRESETS.High, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return PERF_PRESETS.High;
}

function saveConfig(config: PerfConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

interface PerfContextValue {
  config: PerfConfig;
  setConfig: (config: PerfConfig) => void;
  applyPreset: (name: string) => void;
  activePreset: string | null;
}

const PerfContext = createContext<PerfContextValue | null>(null);

export function PerfProvider({ children }: { children: ReactNode }) {
  const [config, setConfigRaw] = useState<PerfConfig>(loadConfig);

  const setConfig = useCallback((c: PerfConfig) => {
    setConfigRaw(c);
    saveConfig(c);
  }, []);

  const applyPreset = useCallback((name: string) => {
    const preset = PERF_PRESETS[name];
    if (preset) setConfig(preset);
  }, [setConfig]);

  const activePreset = useMemo(() => {
    for (const [name, preset] of Object.entries(PERF_PRESETS)) {
      if (Object.keys(preset).every((k) => config[k as keyof PerfConfig] === preset[k as keyof PerfConfig])) {
        return name;
      }
    }
    return null;
  }, [config]);

  const value = useMemo(() => ({ config, setConfig, applyPreset, activePreset }), [config, setConfig, applyPreset, activePreset]);

  return <PerfContext.Provider value={value}>{children}</PerfContext.Provider>;
}

export function usePerfConfig(): PerfContextValue {
  const ctx = useContext(PerfContext);
  if (!ctx) throw new Error('usePerfConfig must be used within PerfProvider');
  return ctx;
}

/* ─── Debug Panel Component ─── */

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 60_000, label: '1 min' },
  { value: 300_000, label: '5 min' },
  { value: 900_000, label: '15 min' },
  { value: 1_800_000, label: '30 min' },
];

export function DebugPanel({ autoLockMs, onAutoLockChange }: { autoLockMs?: number; onAutoLockChange?: (ms: number) => void }) {
  const { config, setConfig, applyPreset, activePreset } = usePerfConfig();
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const update = <K extends keyof PerfConfig>(key: K, value: PerfConfig[K]) => {
    setConfig({ ...config, [key]: value });
  };

  return (
    <>
      <button
        className="debug-toggle"
        onClick={() => setOpen(!open)}
        title="Performance Settings"
        aria-label="Performance Settings"
      >
        {'\u2699'}
      </button>

      {open && (
        <div className="debug-panel">
          <div className="debug-panel-header">
            <span className="debug-panel-title">PERF CONFIG</span>
            <button className="debug-panel-close" onClick={() => setOpen(false)}>{'\u2715'}</button>
          </div>

          {/* Presets */}
          <div className="debug-section">
            <div className="debug-label">PRESET</div>
            <div className="debug-presets">
              {Object.keys(PERF_PRESETS).map((name) => (
                <button
                  key={name}
                  className={`debug-preset-btn ${activePreset === name ? 'debug-preset-active' : ''}`}
                  onClick={() => applyPreset(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* LLM */}
          <div className="debug-section">
            <div className="debug-section-heading">LLM</div>
            <label className="debug-row">
              <span>AI Extraction</span>
              <input type="checkbox" checked={config.llmEnabled} onChange={(e) => update('llmEnabled', e.target.checked)} />
            </label>
            <label className="debug-row">
              <span>Max Tokens</span>
              <input type="range" min={0} max={500} step={25} value={config.maxTokens} onChange={(e) => update('maxTokens', +e.target.value)} />
              <span className="debug-value">{config.maxTokens}</span>
            </label>
            <label className="debug-row">
              <span>Temperature</span>
              <input type="range" min={0} max={1} step={0.1} value={config.temperature} onChange={(e) => update('temperature', +e.target.value)} />
              <span className="debug-value">{config.temperature.toFixed(1)}</span>
            </label>
            <label className="debug-row">
              <span>Extraction Debounce</span>
              <input type="range" min={200} max={5000} step={100} value={config.extractionDebounceMs} onChange={(e) => update('extractionDebounceMs', +e.target.value)} />
              <span className="debug-value">{config.extractionDebounceMs}ms</span>
            </label>
            {isElectron && (
              <>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.4rem 0' }} />
                <label className="debug-row">
                  <span>Ollama (Local)</span>
                  <input type="checkbox" checked={config.ollamaEnabled} onChange={(e) => update('ollamaEnabled', e.target.checked)} />
                </label>
                {config.ollamaEnabled && (
                  <label className="debug-row">
                    <span>Model</span>
                    <select className="debug-select" value={config.ollamaModel} onChange={(e) => update('ollamaModel', e.target.value)}>
                      <option value="gemma3:1b">gemma3:1b</option>
                      <option value="gemma3:4b">gemma3:4b</option>
                      <option value="gemma3:12b">gemma3:12b</option>
                      <option value="deepseek-r1:8b">deepseek-r1:8b</option>
                    </select>
                  </label>
                )}
              </>
            )}
          </div>

          {/* Speech */}
          <div className="debug-section">
            <div className="debug-section-heading">SPEECH</div>
            <label className="debug-row">
              <span>Interim Throttle</span>
              <input type="range" min={0} max={1000} step={50} value={config.interimThrottleMs} onChange={(e) => update('interimThrottleMs', +e.target.value)} />
              <span className="debug-value">{config.interimThrottleMs}ms</span>
            </label>
          </div>

          {/* Security */}
          {onAutoLockChange && (
            <div className="debug-section">
              <div className="debug-section-heading">SECURITY</div>
              <label className="debug-row">
                <span>Auto-Lock</span>
                <select
                  className="debug-select"
                  value={autoLockMs ?? 300_000}
                  onChange={(e) => onAutoLockChange(+e.target.value)}
                >
                  {AUTO_LOCK_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Rendering */}
          <div className="debug-section">
            <div className="debug-section-heading">RENDERING</div>
            <label className="debug-row">
              <span>Animations</span>
              <input type="checkbox" checked={config.animationsEnabled} onChange={(e) => update('animationsEnabled', e.target.checked)} />
            </label>
            <label className="debug-row">
              <span>VAD Bars</span>
              <input type="range" min={0} max={12} step={1} value={config.vadBarCount} onChange={(e) => update('vadBarCount', +e.target.value)} />
              <span className="debug-value">{config.vadBarCount}</span>
            </label>
            <label className="debug-row">
              <span>Timer Interval</span>
              <input type="range" min={1000} max={10000} step={1000} value={config.timerUpdateMs} onChange={(e) => update('timerUpdateMs', +e.target.value)} />
              <span className="debug-value">{(config.timerUpdateMs / 1000).toFixed(0)}s</span>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
