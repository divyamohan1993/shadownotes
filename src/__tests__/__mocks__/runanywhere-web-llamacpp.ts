/**
 * Mock for @runanywhere/web-llamacpp
 * Covers: TextGeneration (streaming), StructuredOutput, ToolCalling, Embeddings, VLM
 */
import { vi } from 'vitest';

export const LlamaCPP = {
  register: vi.fn(async () => {}),
  isRegistered: true,
  accelerationMode: 'cpu',
};

const _mockStream = {
  async *[Symbol.asyncIterator]() {
    yield '[Vulnerabilities] Test vulnerability found\n';
    yield '[Timeline] 02:14 AM entry detected';
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
      timeToFirstTokenMs: 150,
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

export const StructuredOutput = {
  preparePrompt: vi.fn((prompt: string) => prompt),
  validate: vi.fn(() => ({ isValid: true })),
  extractJson: vi.fn((text: string) => {
    try {
      const match = text.match(/\[[\s\S]*\]/);
      return match ? match[0] : null;
    } catch { return null; }
  }),
  getSystemPrompt: vi.fn(() => 'You are an extraction assistant.'),
  hasCompleteJson: vi.fn(() => false),
};

export const ToolCalling = {
  registerTool: vi.fn(),
  unregisterTool: vi.fn(),
  getRegisteredTools: vi.fn(() => []),
  clearTools: vi.fn(),
  generateWithTools: vi.fn(async () => ({
    text: 'Tool response',
    toolCalls: [],
    toolResults: [],
    isComplete: true,
  })),
};

export const Embeddings = {
  loadModel: vi.fn(async () => {}),
  embed: vi.fn(async () => ({
    embeddings: [{ data: new Float32Array(384), dimension: 384 }],
    dimension: 384,
    processingTimeMs: 50,
  })),
  cosineSimilarity: vi.fn(() => 0.85),
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
