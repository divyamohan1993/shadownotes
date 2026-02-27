/**
 * Mock for @runanywhere/web
 */
import { vi } from 'vitest';

export const SDKEnvironment = {
  Development: 'development',
  Production: 'production',
};

export enum ModelCategory {
  Language = 'language',
  SpeechRecognition = 'speechRecognition',
  SpeechSynthesis = 'speechSynthesis',
  Audio = 'audio',
  Multimodal = 'multimodal',
}

export enum LLMFramework {
  LlamaCpp = 'llamacpp',
  ONNX = 'onnx',
}

let _loadedModels: Record<string, any> = {};
let _registeredModels: any[] = [];

export const ModelManager = {
  getLoadedModel: vi.fn((category: string) => _loadedModels[category] || null),
  getModels: vi.fn(() => _registeredModels),
  downloadModel: vi.fn(async () => {}),
  loadModel: vi.fn(async () => true),
  ensureLoaded: vi.fn(async () => {}),
  _setLoadedModel: (category: string, model: any) => { _loadedModels[category] = model; },
  _setRegisteredModels: (models: any[]) => { _registeredModels = models; },
  _reset: () => { _loadedModels = {}; _registeredModels = []; },
};

const _eventHandlers: Record<string, Function[]> = {};

export const EventBus = {
  shared: {
    on: vi.fn((event: string, handler: Function) => {
      if (!_eventHandlers[event]) _eventHandlers[event] = [];
      _eventHandlers[event].push(handler);
      return () => {
        const idx = _eventHandlers[event].indexOf(handler);
        if (idx >= 0) _eventHandlers[event].splice(idx, 1);
      };
    }),
    emit: (event: string, data: any) => {
      (_eventHandlers[event] || []).forEach((h) => h(data));
    },
    _reset: () => {
      Object.keys(_eventHandlers).forEach((k) => delete _eventHandlers[k]);
    },
  },
};

export const RunAnywhere = {
  initialize: vi.fn(async () => {}),
  registerModels: vi.fn(),
  setVLMLoader: vi.fn(),
};

export const VoicePipeline = vi.fn().mockImplementation(() => ({
  processTurn: vi.fn(),
  cancel: vi.fn(),
}));

export const VoiceAgent = {
  create: vi.fn(async () => ({
    loadModels: vi.fn(async () => {}),
    processVoiceTurn: vi.fn(async () => ({})),
    destroy: vi.fn(),
  })),
};

export const VoiceAgentSession = vi.fn();

export const AccelerationPreference = {
  Auto: 'auto',
  WebGPU: 'webgpu',
  CPU: 'cpu',
};

export class SDKLogger {
  info = vi.fn();
  warning = vi.fn();
  error = vi.fn();
}

export const detectCapabilities = vi.fn(async () => ({
  hasWebGPU: false,
  hasWASMSIMD: true,
  deviceMemoryGB: 8,
  hardwareConcurrency: 8,
}));

export class OPFSStorage {
  initialize = vi.fn(async () => true);
  hasModel = vi.fn(async () => false);
  listModels = vi.fn(async () => []);
  getFileSize = vi.fn(async () => null);
  getStorageUsage = vi.fn(async () => ({ usedBytes: 0, quotaBytes: 0 }));
}

export type CompactModelDef = any;
export type WebCapabilities = any;
export type ToolDefinition = any;
