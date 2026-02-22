import { useState } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { useModelLoader } from '../hooks/useModelLoader';
import { DOMAINS } from '../domains';
import type { DomainProfile, DomainId } from '../types';

interface Props {
  onStart: (domain: DomainProfile) => void;
}

export function SessionInit({ onStart }: Props) {
  const [selected, setSelected] = useState<DomainId | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadStep, setLoadStep] = useState('');

  const llmLoader = useModelLoader(ModelCategory.Language, true);
  const sttLoader = useModelLoader(ModelCategory.SpeechRecognition, true);
  const vadLoader = useModelLoader(ModelCategory.Audio, true);

  const handleBegin = async () => {
    if (!selected) return;
    const domain = DOMAINS.find((d) => d.id === selected)!;

    setLoadingModels(true);

    setLoadStep('Loading VAD module...');
    const vadOk = await vadLoader.ensure();
    if (!vadOk) { setLoadingModels(false); return; }

    setLoadStep('Loading STT module...');
    const sttOk = await sttLoader.ensure();
    if (!sttOk) { setLoadingModels(false); return; }

    setLoadStep('Loading LLM module...');
    const llmOk = await llmLoader.ensure();
    if (!llmOk) { setLoadingModels(false); return; }

    setLoadStep('All modules loaded. Initiating session...');
    await new Promise((r) => setTimeout(r, 500));

    onStart(domain);
  };

  const allReady = llmLoader.state === 'ready' && sttLoader.state === 'ready' && vadLoader.state === 'ready';

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
            disabled={loadingModels}
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

      {loadingModels && (
        <div className="init-loading">
          <div className="init-loading-bar">
            <div className="init-loading-fill" style={{
              width: `${(
                (vadLoader.state === 'ready' ? 33 : vadLoader.progress * 33) +
                (sttLoader.state === 'ready' ? 33 : sttLoader.progress * 33) +
                (llmLoader.state === 'ready' ? 34 : llmLoader.progress * 34)
              )}%`
            }} />
          </div>
          <div className="init-loading-text">{loadStep}</div>
        </div>
      )}

      {!loadingModels && (
        <button
          className="btn-begin"
          onClick={handleBegin}
          disabled={!selected}
        >
          {allReady ? 'BEGIN CAPTURE SESSION' : 'DOWNLOAD SECURE MODULES & BEGIN'}
        </button>
      )}

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
