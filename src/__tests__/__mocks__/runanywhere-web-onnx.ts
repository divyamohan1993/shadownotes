/**
 * Mock for @runanywhere/web-onnx
 */
import { vi } from 'vitest';

export const ONNX = {
  register: vi.fn(async () => {}),
};

export const STT = {
  transcribe: vi.fn(async () => ({
    text: 'The server room access logs show unauthorized entry at 02:14 AM',
  })),
};

export const TTS = {
  synthesize: vi.fn(async () => ({
    audioData: new Float32Array(1600),
    sampleRate: 16000,
  })),
};

export enum SpeechActivity {
  Started = 'started',
  Ended = 'ended',
}

let _speechCallback: ((activity: SpeechActivity) => void) | null = null;
let _speechSegment: { samples: Float32Array } | null = null;

export const VAD = {
  reset: vi.fn(),
  onSpeechActivity: vi.fn((cb: (activity: SpeechActivity) => void) => {
    _speechCallback = cb;
    return () => { _speechCallback = null; };
  }),
  processSamples: vi.fn(),
  popSpeechSegment: vi.fn(() => _speechSegment),
  // Test helpers
  _triggerSpeechEnd: () => {
    _speechCallback?.(SpeechActivity.Ended);
  },
  _setSpeechSegment: (segment: { samples: Float32Array } | null) => {
    _speechSegment = segment;
  },
  _reset: () => {
    _speechCallback = null;
    _speechSegment = null;
  },
};

let _audioStartCallback: ((chunk: Float32Array) => void) | null = null;
let _audioLevelCallback: ((level: number) => void) | null = null;

export const AudioCapture = vi.fn().mockImplementation(() => ({
  start: vi.fn(async (onChunk: Function, onLevel: Function) => {
    _audioStartCallback = onChunk as any;
    _audioLevelCallback = onLevel as any;
  }),
  stop: vi.fn(),
  // Test helpers
  _simulateChunk: (chunk: Float32Array) => _audioStartCallback?.(chunk),
  _simulateLevel: (level: number) => _audioLevelCallback?.(level),
}));

export const AudioPlayback = vi.fn().mockImplementation(() => ({
  play: vi.fn(async () => {}),
  dispose: vi.fn(),
}));
