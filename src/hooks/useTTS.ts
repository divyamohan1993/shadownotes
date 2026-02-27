/**
 * useTTS - On-device text-to-speech via RunAnywhere ONNX
 *
 * Wraps TTS.synthesize() + AudioPlayback into a simple React hook.
 * Lazy-loads the TTS voice on first speak() call so the hook itself
 * is cheap to mount. Falls back gracefully when TTS models are
 * unavailable (isAvailable = false).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { TTS, AudioPlayback } from '@runanywhere/web-onnx';
import { ModelManager, ModelCategory } from '@runanywhere/web';

// ── Public Interface ────────────────────────────────────────

export interface TTSResult {
  /** Whether a TTS voice is loaded and ready. */
  isAvailable: boolean;
  /** Whether audio is currently being played. */
  isSpeaking: boolean;
  /** Synthesize text to speech and play it through the speakers. */
  speak: (text: string) => Promise<void>;
  /** Stop playback immediately. */
  stop: () => void;
}

// ── Hook ────────────────────────────────────────────────────

export function useTTS(): TTSResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const playbackRef = useRef<AudioPlayback | null>(null);
  const mountedRef = useRef(true);

  // ── Availability check ────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    const check = () => {
      try {
        if (mountedRef.current) setIsAvailable(TTS.isVoiceLoaded);
      } catch {
        if (mountedRef.current) setIsAvailable(false);
      }
    };

    check();

    // Re-check after a delay — models may still be loading during boot
    const t1 = setTimeout(check, 2_000);
    const t2 = setTimeout(check, 5_000);

    return () => {
      mountedRef.current = false;
      clearTimeout(t1);
      clearTimeout(t2);

      // Dispose playback resources on unmount
      const playback = playbackRef.current;
      if (playback) {
        playback.stop();
        playback.dispose();
        playbackRef.current = null;
      }
    };
  }, []);

  // ── Lazy playback initialization ──────────────────────────
  const getPlayback = useCallback((): AudioPlayback => {
    if (!playbackRef.current) {
      // Piper / VITS models typically output at 22 050 Hz.
      // We let AudioPlayback.play() accept a per-call sample rate override
      // from the TTS synthesis result, so the default here is a fallback.
      playbackRef.current = new AudioPlayback({ sampleRate: 22_050, volume: 1.0 });
    }
    return playbackRef.current;
  }, []);

  // ── Speak ─────────────────────────────────────────────────
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    // Check voice availability at call time; lazy-load if needed
    try {
      if (!TTS.isVoiceLoaded) {
        // Attempt lazy load via ModelManager — it handles the full lifecycle
        // (download → OPFS → sherpa-onnx FS → TTS module init).
        try {
          await ModelManager.ensureLoaded(ModelCategory.SpeechSynthesis, { coexist: true });
        } catch (loadErr) {
          console.warn('[useTTS] Lazy TTS load failed:', loadErr);
        }
        if (!TTS.isVoiceLoaded) {
          console.warn('[useTTS] No TTS voice available after load attempt.');
          return;
        }
        if (mountedRef.current) setIsAvailable(true);
      }
    } catch {
      console.warn('[useTTS] TTS extension not available (ONNX not registered).');
      return;
    }

    try {
      if (mountedRef.current) {
        setIsSpeaking(true);
        setIsAvailable(true);
      }

      // Synthesize text to PCM audio
      const result = await TTS.synthesize(text, { speed: 1.0 });

      if (!mountedRef.current) return;

      // Play the synthesized audio
      const playback = getPlayback();

      // Stop any currently playing audio before starting new playback
      if (playback.isPlaying) {
        playback.stop();
      }

      await playback.play(result.audioData, result.sampleRate);

      if (mountedRef.current) {
        setIsSpeaking(false);
      }
    } catch (err) {
      console.warn('[useTTS] Synthesis or playback failed:', err);
      if (mountedRef.current) {
        setIsSpeaking(false);
      }
    }
  }, [getPlayback]);

  // ── Stop ──────────────────────────────────────────────────
  const stop = useCallback((): void => {
    const playback = playbackRef.current;
    if (playback?.isPlaying) {
      playback.stop();
    }
    if (mountedRef.current) {
      setIsSpeaking(false);
    }
  }, []);

  return {
    isAvailable,
    isSpeaking,
    speak,
    stop,
  };
}
