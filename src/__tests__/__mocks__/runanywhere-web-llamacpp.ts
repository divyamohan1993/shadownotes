/**
 * Mock for @runanywhere/web-llamacpp
 */
import { vi } from 'vitest';

export const LlamaCPP = {
  register: vi.fn(async () => {}),
  isRegistered: true,
  accelerationMode: 'cpu',
};

const _mockStream = {
  async *[Symbol.asyncIterator]() {
    yield 'Hello';
    yield ' world';
  },
};

export const TextGeneration = {
  generateStream: vi.fn(async () => ({
    stream: _mockStream,
    result: Promise.resolve({
      text: '[Vulnerabilities] Test vulnerability found\n[Timeline] 02:14 AM entry detected',
      tokensUsed: 25,
      tokensPerSecond: 10.5,
      latencyMs: 2400,
    }),
    cancel: vi.fn(),
  })),
  generate: vi.fn(async () => ({
    text: 'Test response',
    tokensUsed: 10,
    tokensPerSecond: 10.5,
    latencyMs: 1000,
  })),
};

export const VLMWorkerBridge = {
  shared: {
    workerUrl: '',
    isInitialized: false,
    isModelLoaded: false,
    init: vi.fn(),
    loadModel: vi.fn(),
    unloadModel: vi.fn(),
    process: vi.fn(),
  },
};

export const VideoCapture = vi.fn();
