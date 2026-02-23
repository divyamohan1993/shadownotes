import { useState, useEffect } from 'react';
import { DOMAINS } from '../domains';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelCategory } from '@runanywhere/web';
import type { DomainProfile, DomainId } from '../types';

interface Props {
  onStart: (domain: DomainProfile) => void;
}

export function SessionInit({ onStart }: Props) {
  const [selected, setSelected] = useState<DomainId | null>(null);
  const { state: llmState, progress: llmProgress, ensure: ensureLLM } = useModelLoader(ModelCategory.Language);

  // Start model download as soon as a domain is selected
  useEffect(() => {
    if (selected) {
      ensureLLM();
    }
  }, [selected, ensureLLM]);

  const handleBegin = () => {
    if (!selected) return;
    const domain = DOMAINS.find((d) => d.id === selected)!;
    onStart(domain);
  };

  return (
    <div className="init-screen">
      <div className="init-header">
        <div className="stamp stamp-classified">CLASSIFIED</div>
        <h1 className="init-title">SHADOW NOTES</h1>
        <p className="init-desc">Select operation domain to initialize secure capture session</p>
      </div>

      <div className="domain-grid">
        {DOMAINS.map((domain) => (
          <button
            key={domain.id}
            className={`domain-card ${selected === domain.id ? 'selected' : ''}`}
            onClick={() => setSelected(domain.id)}
          >
            <div className="domain-icon">{domain.icon}</div>
            <div className="domain-name">{domain.name}</div>
            <div className="domain-codename">{domain.codename}</div>
            <div className={`domain-clearance clearance-${domain.id}`}>
              {domain.clearanceLevel}
            </div>
          </button>
        ))}
      </div>

      {selected && llmState === 'downloading' && (
        <div className="llm-status">
          <div className="llm-progress-bar">
            <div className="llm-progress-fill" style={{ width: `${Math.round(llmProgress * 100)}%` }} />
          </div>
          <span className="llm-status-text">
            LOADING AI ENGINE — {Math.round(llmProgress * 100)}%
          </span>
        </div>
      )}
      {selected && llmState === 'loading' && (
        <div className="llm-status">
          <span className="llm-status-text">INITIALIZING AI ENGINE...</span>
        </div>
      )}
      {selected && llmState === 'ready' && (
        <div className="llm-status">
          <span className="llm-status-text llm-status-ready">
            {'\u2713'} AI ENGINE READY
          </span>
        </div>
      )}
      {selected && llmState === 'error' && (
        <div className="llm-status">
          <span className="llm-status-text llm-status-error">
            AI ENGINE UNAVAILABLE — KEYWORD MODE ACTIVE
          </span>
        </div>
      )}

      <button
        className="btn-begin"
        onClick={handleBegin}
        disabled={!selected}
      >
        BEGIN CAPTURE SESSION
      </button>

      <div className="init-footer">
        <div className="status-dot status-secure" />
        <span>AI EXTRACTION ON-DEVICE</span>
        <span className="separator">{'\u{2502}'}</span>
        <div className="status-dot status-offline" />
        <span>RUNANYWHERE ENGINE</span>
      </div>
    </div>
  );
}
