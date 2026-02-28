/**
 * useSDKFeatures - Reactive hook for SDK feature readiness
 *
 * Subscribes to the global SDK readiness tracker in runanywhere.ts.
 * Returns which features (LLM, STT, VAD, TTS, EMB) are loaded and ready.
 * Updates immediately when any model finishes loading.
 */

import { useState, useEffect } from 'react';
import {
  getSDKFeatureStatus,
  onSDKFeatureChange,
  refreshSDKFeatureStatus,
  type SDKFeatureStatus,
} from '../runanywhere';

export function useSDKFeatures(): SDKFeatureStatus {
  const [status, setStatus] = useState<SDKFeatureStatus>(getSDKFeatureStatus);

  useEffect(() => {
    // Subscribe to changes
    const unsub = onSDKFeatureChange(setStatus);

    // Initial refresh in case boot has already completed
    refreshSDKFeatureStatus();

    // Periodic re-check as a safety net (every 3s for 30s)
    let checkCount = 0;
    const interval = setInterval(() => {
      refreshSDKFeatureStatus();
      checkCount++;
      if (checkCount >= 10) clearInterval(interval);
    }, 3_000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return status;
}
