import { useState } from 'react';
import { DOMAINS } from '../domains';
import type { DomainProfile, DomainId } from '../types';

interface Props {
  onStart: (domain: DomainProfile) => void;
}

export function SessionInit({ onStart }: Props) {
  const [selected, setSelected] = useState<DomainId | null>(null);

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

      <button
        className="btn-begin"
        onClick={handleBegin}
        disabled={!selected}
      >
        BEGIN CAPTURE SESSION
      </button>

      <div className="init-footer">
        <div className="status-dot status-secure" />
        <span>ALL PROCESSING ON-DEVICE</span>
        <span className="separator">{'\u{2502}'}</span>
        <div className="status-dot status-offline" />
        <span>ZERO NETWORK DEPENDENCY</span>
      </div>
    </div>
  );
}
