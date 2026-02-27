import { useRef, useCallback, useEffect } from 'react';
import type { SessionContent } from '../types';

interface AutoSaveConfig {
  caseId: string;
  caseNumber: string;
  startTime: Date;
  saveDraft: (caseId: string, caseNumber: string, content: SessionContent, startTime: Date) => Promise<string>;
  updateDraft: (caseId: string, sessionId: string, content: SessionContent, startTime: Date) => Promise<void>;
}

export interface AutoSaveHandle {
  saveNow: (content: SessionContent) => void;
  saveDebounced: (content: SessionContent) => void;
  getDraftId: () => string | null;
  cancel: () => void;
}

export function useAutoSave(config: AutoSaveConfig | null): AutoSaveHandle {
  const draftIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const pendingContentRef = useRef<SessionContent | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const immediateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (immediateTimerRef.current) clearTimeout(immediateTimerRef.current);
    };
  }, []);

  // Reset draft ID when config changes (new session)
  useEffect(() => {
    draftIdRef.current = null;
  }, [config?.caseId, config?.caseNumber]);

  const doSave = useCallback(async (content: SessionContent) => {
    const cfg = configRef.current;
    if (!cfg || savingRef.current) {
      pendingContentRef.current = content;
      return;
    }
    savingRef.current = true;
    try {
      if (!draftIdRef.current) {
        draftIdRef.current = await cfg.saveDraft(
          cfg.caseId, cfg.caseNumber, content, cfg.startTime,
        );
      } else {
        await cfg.updateDraft(
          cfg.caseId, draftIdRef.current, content, cfg.startTime,
        );
      }
    } catch (err) {
      console.error('[AutoSave] Save failed:', err);
    } finally {
      savingRef.current = false;
      const queued = pendingContentRef.current;
      if (queued) {
        pendingContentRef.current = null;
        doSave(queued);
      }
    }
  }, []);

  const saveNow = useCallback((content: SessionContent) => {
    if (immediateTimerRef.current) clearTimeout(immediateTimerRef.current);
    immediateTimerRef.current = setTimeout(() => doSave(content), 200);
  }, [doSave]);

  const saveDebounced = useCallback((content: SessionContent) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => doSave(content), 2000);
  }, [doSave]);

  const getDraftId = useCallback(() => draftIdRef.current, []);

  const cancel = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (immediateTimerRef.current) clearTimeout(immediateTimerRef.current);
    debounceTimerRef.current = null;
    immediateTimerRef.current = null;
    pendingContentRef.current = null;
  }, []);

  return { saveNow, saveDebounced, getDraftId, cancel };
}
