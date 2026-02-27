import { useState, useEffect, useRef, useCallback } from 'react';
import { DOMAINS } from '../domains';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelCategory } from '@runanywhere/web';
import type { DomainProfile, DomainId } from '../types';

const ONBOARDING_KEY = 'shadownotes-onboarded';

const ONBOARDING_STEPS = [
  {
    title: 'WELCOME, OPERATIVE',
    body: 'Welcome to ShadowNotes \u2014 your zero-trust AI notebook. All processing happens on your device. No data ever leaves your browser.',
    icon: '\uD83D\uDD12',
  },
  {
    title: 'SELECT YOUR DOMAIN',
    body: 'Select a domain to start. Each domain has AI-tuned extraction for specific use cases: Security Audits, Legal Depositions, Medical Notes, or Incident Reports.',
    icon: '\uD83C\uDFAF',
  },
  {
    title: 'CAPTURE INTELLIGENCE',
    body: 'Speak or type your notes. The AI extracts structured intelligence in real-time. Everything is encrypted with AES-256-GCM.',
    icon: '\uD83C\uDF99\uFE0F',
  },
] as const;

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  // Focus management: focus the dialog on mount and on step change
  useEffect(() => {
    nextBtnRef.current?.focus();
  }, [step]);

  const finish = useCallback(() => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* quota */ }
    onComplete();
  }, [onComplete]);

  const advance = useCallback(() => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }, [step, finish]);

  // Keyboard: Escape to skip, Enter/Space for Next
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      }
      // Enter/Space only when the dialog itself or its children are focused
      if ((e.key === 'Enter' || e.key === ' ') && dialogRef.current?.contains(document.activeElement)) {
        // Don't double-fire if a button is focused (it handles its own click)
        if (document.activeElement?.tagName !== 'BUTTON') {
          e.preventDefault();
          advance();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance, finish]);

  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div className="onboarding-backdrop" aria-hidden="false">
      <div
        ref={dialogRef}
        className="onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Onboarding step ${step + 1} of ${ONBOARDING_STEPS.length}: ${current.title}`}
        tabIndex={-1}
      >
        <div className="onboarding-step-indicator" aria-hidden="true">
          {ONBOARDING_STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>

        <div className="onboarding-icon" aria-hidden="true">{current.icon}</div>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-body">{current.body}</p>

        <div className="onboarding-actions">
          <button className="onboarding-btn-skip" onClick={finish} aria-label="Skip onboarding">
            SKIP
          </button>
          <button
            ref={nextBtnRef}
            className="onboarding-btn-next"
            onClick={advance}
            aria-label={isLast ? 'Begin using ShadowNotes' : `Go to step ${step + 2}`}
          >
            {isLast ? 'BEGIN' : 'NEXT'}
          </button>
        </div>

        <div className="onboarding-hint" aria-hidden="true">
          ESC to skip {'\u00B7'} ENTER to continue
        </div>
      </div>
    </div>
  );
}

interface Props {
  onStart: (domain: DomainProfile) => void;
  onSearch: () => void;
  onImport: () => void;
}

export function SessionInit({ onStart, onSearch, onImport }: Props) {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem(ONBOARDING_KEY); } catch { return false; }
  });
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
    <div className="init-screen" role="main" aria-label="ShadowNotes domain selection">
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
      <div className="init-header">
        <div className="stamp stamp-classified" aria-hidden="true">CLASSIFIED</div>
        <h1 className="init-title">SHADOW NOTES</h1>
        <p className="init-desc">Select operation domain to initialize secure capture session</p>
      </div>

      <div className="domain-grid" role="radiogroup" aria-label="Select operation domain">
        {DOMAINS.map((domain) => (
          <button
            key={domain.id}
            className={`domain-card ${selected === domain.id ? 'selected' : ''}`}
            onClick={() => setSelected(domain.id)}
            role="radio"
            aria-checked={selected === domain.id}
            aria-label={`${domain.name}: ${domain.codename} — ${domain.clearanceLevel}`}
          >
            <div className="domain-icon" aria-hidden="true">{domain.icon}</div>
            <div className="domain-name">{domain.name}</div>
            <div className="domain-codename">{domain.codename}</div>
            <div className={`domain-clearance clearance-${domain.id}`}>
              {domain.clearanceLevel}
            </div>
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {selected && llmState === 'downloading' && (
          <div className="llm-status" role="status">
            <div className="llm-progress-bar" role="progressbar" aria-valuenow={Math.round(llmProgress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="AI engine download progress">
              <div className="llm-progress-fill" style={{ width: `${Math.round(llmProgress * 100)}%` }} />
            </div>
            <span className="llm-status-text">
              LOADING AI ENGINE — {Math.round(llmProgress * 100)}%
            </span>
          </div>
        )}
        {selected && llmState === 'loading' && (
          <div className="llm-status" role="status">
            <span className="llm-status-text">INITIALIZING AI ENGINE...</span>
          </div>
        )}
        {selected && llmState === 'ready' && (
          <div className="llm-status" role="status">
            <span className="llm-status-text llm-status-ready">
              {'\u2713'} AI ENGINE READY
            </span>
          </div>
        )}
        {selected && llmState === 'error' && (
          <div className="llm-status" role="alert">
            <span className="llm-status-text llm-status-error">
              AI ENGINE UNAVAILABLE — KEYWORD MODE ACTIVE
            </span>
          </div>
        )}
      </div>

      <button
        className="btn-begin"
        onClick={handleBegin}
        disabled={!selected}
        aria-label={selected ? `Open case files for ${selected} domain` : 'Select a domain first'}
      >
        OPEN CASE FILES
      </button>

      <div className="init-actions-row">
        <button className="btn-init-action" onClick={onSearch} title="Search all cases" aria-label="Search vault across all cases">
          {'\u{1F50D}'} SEARCH VAULT
        </button>
        <button className="btn-init-action" onClick={onImport} title="Import .shadow file" aria-label="Import dossier from shadow file">
          {'\u{1F4E5}'} IMPORT DOSSIER
        </button>
        <a href="/docs/field-manual.html" target="_blank" rel="noopener noreferrer" className="btn-init-action" aria-label="Open field manual in new tab">
          {'\u{1F4D6}'} FIELD MANUAL
        </a>
      </div>

      <div className="init-footer" role="status" aria-label="System status">
        <div className="status-dot status-secure" aria-hidden="true" />
        <span>AI EXTRACTION ON-DEVICE</span>
        <span className="separator" aria-hidden="true">{'\u{2502}'}</span>
        <div className="status-dot status-offline" aria-hidden="true" />
        <span>RUNANYWHERE ENGINE</span>
      </div>
    </div>
  );
}
