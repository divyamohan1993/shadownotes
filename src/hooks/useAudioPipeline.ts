/**
 * useAudioPipeline - On-device speech-to-text via RunAnywhere ONNX
 *
 * Integrates AudioCapture, VAD, and STT into a single React hook:
 *   1. AudioCapture grabs mic PCM at 16 kHz
 *   2. VAD detects speech segments in real-time
 *   3. Speech segments are fed to STT for transcription
 *
 * Falls back gracefully when ONNX models are unavailable.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  AudioCapture,
  VAD,
  STT,
  SpeechActivity,
} from '@runanywhere/web-onnx';
import type {
  AudioChunkCallback,
  AudioLevelCallback,
} from '@runanywhere/web-onnx';

// ── Public Interface ────────────────────────────────────────

export interface AudioPipelineResult {
  /** Whether the ONNX STT pipeline is available (models registered). */
  isAvailable: boolean;
  /** Whether the microphone is actively capturing audio. */
  isCapturing: boolean;
  /** Whether STT is currently transcribing a segment. */
  isTranscribing: boolean;
  /** Whether VAD is currently detecting speech. */
  vadActive: boolean;
  /** Normalized mic level 0-1, updated per animation frame. */
  audioLevel: number;
  /** Start capturing microphone audio and processing speech. */
  startCapture: () => Promise<void>;
  /** Stop capturing and return the final accumulated transcript. */
  stopCapture: () => Promise<string>;
  /** Read the interim (in-progress) transcript without stopping. */
  getInterimTranscript: () => string;
  /** Latest error message, or null. */
  error: string | null;
}

// ── Constants ───────────────────────────────────────────────

/** STT and VAD expect 16 kHz mono audio. */
const SAMPLE_RATE = 16_000;

/**
 * Minimum accumulated speech samples before we attempt transcription.
 * 0.3 s at 16 kHz = 4 800 samples -- avoids transcribing tiny clicks.
 */
const MIN_SPEECH_SAMPLES = 4_800;

// ── Hook ────────────────────────────────────────────────────

export function useAudioPipeline(): AudioPipelineResult {
  // Reactive state exposed to the component
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [vadActive, setVadActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mutable refs for objects that must survive re-renders
  const captureRef = useRef<AudioCapture | null>(null);
  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const vadUnsubRef = useRef<(() => void) | null>(null);
  const speechBufferRef = useRef<Float32Array[]>([]);
  const mountedRef = useRef(true);

  // ── Availability check ────────────────────────────────────
  // We consider the pipeline "available" when the ONNX backend is registered
  // and an STT model is loaded. Checked once on mount.
  useEffect(() => {
    mountedRef.current = true;

    const check = () => {
      try {
        // STT.isModelLoaded throws if ONNX was never registered
        const sttReady = STT.isModelLoaded;
        const vadReady = VAD.isInitialized;
        setIsAvailable(sttReady && vadReady);
      } catch {
        setIsAvailable(false);
      }
    };

    check();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Transcribe a speech segment ───────────────────────────
  const transcribeSegment = useCallback(async (samples: Float32Array) => {
    if (samples.length < MIN_SPEECH_SAMPLES) return;

    if (!mountedRef.current) return;
    setIsTranscribing(true);

    try {
      const result = await STT.transcribe(samples, { sampleRate: SAMPLE_RATE });
      const text = result.text.trim();
      if (text) {
        transcriptRef.current += (transcriptRef.current ? ' ' : '') + text;
        interimRef.current = transcriptRef.current;
      }
    } catch (err) {
      console.warn('[useAudioPipeline] STT transcription failed:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setIsTranscribing(false);
      }
    }
  }, []);

  // ── Start capture ─────────────────────────────────────────
  const startCapture = useCallback(async () => {
    setError(null);

    // Re-check availability at call time
    try {
      if (!STT.isModelLoaded || !VAD.isInitialized) {
        setError('STT or VAD model not loaded. Load models before capturing.');
        return;
      }
    } catch {
      setError('ONNX backend not registered. Audio pipeline unavailable.');
      return;
    }

    // Prevent double-start
    if (captureRef.current?.isCapturing) return;

    try {
      // Fresh state
      transcriptRef.current = '';
      interimRef.current = '';
      speechBufferRef.current = [];

      // Create a new AudioCapture instance
      const capture = new AudioCapture({ sampleRate: SAMPLE_RATE, channels: 1 });
      captureRef.current = capture;

      // VAD callback: when speech ends, collect the segment for STT
      const unsubVad = VAD.onSpeechActivity((activity: SpeechActivity) => {
        if (!mountedRef.current) return;

        if (activity === SpeechActivity.Started) {
          setVadActive(true);
          // Clear buffer for new speech segment
          speechBufferRef.current = [];
        } else if (activity === SpeechActivity.Ended) {
          setVadActive(false);

          // Collect all speech segments queued by VAD
          let segment = VAD.popSpeechSegment();
          while (segment) {
            void transcribeSegment(segment.samples);
            segment = VAD.popSpeechSegment();
          }

          // Fallback: if VAD didn't produce segments, use our accumulated buffer
          if (speechBufferRef.current.length > 0) {
            const totalLen = speechBufferRef.current.reduce((n, c) => n + c.length, 0);
            const merged = new Float32Array(totalLen);
            let offset = 0;
            for (const chunk of speechBufferRef.current) {
              merged.set(chunk, offset);
              offset += chunk.length;
            }
            speechBufferRef.current = [];
            void transcribeSegment(merged);
          }
        }
        // SpeechActivity.Ongoing -- VAD is tracking, nothing to do
      });
      vadUnsubRef.current = unsubVad;

      // Audio chunk callback: feed each chunk to VAD for speech detection
      const onChunk: AudioChunkCallback = (samples: Float32Array) => {
        try {
          const isSpeech = VAD.processSamples(samples);
          if (isSpeech) {
            // Accumulate speech samples as fallback for segment assembly
            speechBufferRef.current.push(new Float32Array(samples));
          }
        } catch (err) {
          console.warn('[useAudioPipeline] VAD processSamples error:', err);
        }
      };

      // Audio level callback: update reactive state
      const onLevel: AudioLevelCallback = (level: number) => {
        if (mountedRef.current) {
          setAudioLevel(level);
        }
      };

      await capture.start(onChunk, onLevel);
      if (mountedRef.current) {
        setIsCapturing(true);
        setIsAvailable(true);
      }
    } catch (err) {
      console.error('[useAudioPipeline] Failed to start capture:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setIsCapturing(false);
      }
    }
  }, [transcribeSegment]);

  // ── Stop capture ──────────────────────────────────────────
  const stopCapture = useCallback(async (): Promise<string> => {
    // Unsubscribe VAD listener
    if (vadUnsubRef.current) {
      vadUnsubRef.current();
      vadUnsubRef.current = null;
    }

    const capture = captureRef.current;
    if (!capture) return transcriptRef.current;

    // Flush VAD to detect any trailing speech
    try {
      VAD.flush();
      let segment = VAD.popSpeechSegment();
      while (segment) {
        await transcribeSegment(segment.samples);
        segment = VAD.popSpeechSegment();
      }
    } catch {
      // VAD may not be initialized -- that's fine
    }

    // If there are remaining buffered speech samples, transcribe them
    if (speechBufferRef.current.length > 0) {
      const totalLen = speechBufferRef.current.reduce((n, c) => n + c.length, 0);
      if (totalLen >= MIN_SPEECH_SAMPLES) {
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const chunk of speechBufferRef.current) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        await transcribeSegment(merged);
      }
      speechBufferRef.current = [];
    }

    // Also transcribe whatever remains in the AudioCapture buffer
    const remaining = capture.drainBuffer();
    if (remaining.length >= MIN_SPEECH_SAMPLES) {
      await transcribeSegment(remaining);
    }

    // Stop the capture and release mic
    capture.stop();
    captureRef.current = null;

    if (mountedRef.current) {
      setIsCapturing(false);
      setVadActive(false);
      setAudioLevel(0);
    }

    return transcriptRef.current;
  }, [transcribeSegment]);

  // ── Interim transcript accessor ───────────────────────────
  const getInterimTranscript = useCallback((): string => {
    return interimRef.current;
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false;

      // Tear down VAD subscription
      if (vadUnsubRef.current) {
        vadUnsubRef.current();
        vadUnsubRef.current = null;
      }

      // Stop capture if still running
      const capture = captureRef.current;
      if (capture?.isCapturing) {
        capture.stop();
      }
      captureRef.current = null;
    };
  }, []);

  return {
    isAvailable,
    isCapturing,
    isTranscribing,
    vadActive,
    audioLevel,
    startCapture,
    stopCapture,
    getInterimTranscript,
    error,
  };
}
