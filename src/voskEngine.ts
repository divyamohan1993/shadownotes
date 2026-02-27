import { createModel, type KaldiRecognizer, type Model } from 'vosk-browser';
import type { RecognizerMessage } from 'vosk-browser/dist/interfaces';

const MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip';
const SAMPLE_RATE = 16000;

let modelPromise: Promise<Model> | null = null;

export type VoskState = 'idle' | 'loading-model' | 'listening' | 'error';

export interface VoskSession {
  stop: () => void;
}

export function getModelPromise(): Promise<Model> {
  if (!modelPromise) {
    modelPromise = createModel(MODEL_URL);
  }
  return modelPromise;
}

/**
 * Pre-download the Vosk model so it's cached for when the user hits "capture".
 * Call this early (e.g. on mount) to avoid delay later.
 */
export async function preloadModel(onStateChange?: (state: VoskState) => void): Promise<void> {
  onStateChange?.('loading-model');
  try {
    await getModelPromise();
    onStateChange?.('idle');
  } catch {
    modelPromise = null;
    onStateChange?.('error');
  }
}

/**
 * Start Vosk-based speech recognition.
 * Returns a VoskSession with a stop() method for cleanup.
 */
export async function startVoskCapture(callbacks: {
  onResult: (text: string) => void;
  onPartial: (text: string) => void;
  onError: (msg: string) => void;
  onStateChange?: (state: VoskState) => void;
}): Promise<VoskSession> {
  callbacks.onStateChange?.('loading-model');

  let model: Model;
  try {
    model = await getModelPromise();
  } catch (err) {
    modelPromise = null;
    const msg = err instanceof Error ? err.message : 'Failed to load speech model';
    callbacks.onError(msg);
    callbacks.onStateChange?.('error');
    throw err;
  }

  const recognizer: KaldiRecognizer = new model.KaldiRecognizer(SAMPLE_RATE);

  recognizer.on('result', (message: RecognizerMessage) => {
    const text = (message as any).result?.text?.trim();
    if (text) callbacks.onResult(text);
  });

  recognizer.on('partialresult', (message: RecognizerMessage) => {
    const partial = (message as any).result?.partial?.trim();
    if (partial) callbacks.onPartial(partial);
  });

  // Capture microphone
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, sampleRate: SAMPLE_RATE },
  });

  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    try {
      recognizer.acceptWaveform(e.inputBuffer);
    } catch { /* recognizer may have been removed */ }
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  callbacks.onStateChange?.('listening');

  return {
    stop() {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(t => t.stop());
      audioCtx.close().catch(() => {});
      try { recognizer.remove(); } catch { /* already removed */ }
    },
  };
}
