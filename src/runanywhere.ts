/**
 * ShadowNotes - RunAnywhere SDK Integration
 *
 * Registers all three backend packages and exports every SDK feature
 * that the rest of the app may need:
 *
 *   @runanywhere/web          - Core infrastructure (pure TS, no WASM)
 *   @runanywhere/web-llamacpp - LLM, structured output, tool calling, embeddings
 *   @runanywhere/web-onnx     - STT, TTS, VAD, audio capture/playback
 */

// ── @runanywhere/web ────────────────────────────────────────
import {
  RunAnywhere,
  ModelManager,
  ModelCategory,
  LLMFramework,
  AccelerationPreference,
  OPFSStorage,
  SDKEnvironment,
  EventBus,
  VoicePipeline,
  VoiceAgent,
  VoiceAgentSession,
  SDKLogger,
  detectCapabilities,
  type CompactModelDef,
  type WebCapabilities,
} from '@runanywhere/web';

// ── @runanywhere/web-llamacpp ───────────────────────────────
import {
  LlamaCPP,
  TextGeneration,
  StructuredOutput,
  ToolCalling,
  Embeddings,
  toToolValue,
  fromToolValue,
  getStringArg,
  getNumberArg,
} from '@runanywhere/web-llamacpp';

// ── @runanywhere/web-onnx ───────────────────────────────────
import {
  ONNX,
  STT,
  TTS,
  VAD,
  AudioCapture,
  AudioPlayback,
  STTModelType,
  SpeechActivity,
} from '@runanywhere/web-onnx';

// ── Model Registry ──────────────────────────────────────────
const MODELS: CompactModelDef[] = [
  // LLM — primary intelligence extraction engine
  {
    id: 'qwen2.5-0.5b-instruct-q4_k_m',
    name: 'Qwen2.5 0.5B Instruct Q4_K_M',
    repo: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
    files: ['Qwen2.5-0.5B-Instruct-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 400_000_000,
  },
  // VAD — Silero Voice Activity Detection (~2.3 MB)
  {
    id: 'silero-vad',
    name: 'Silero VAD',
    repo: 'deepghs/silero-vad-onnx',
    files: ['silero_vad.onnx'],
    framework: LLMFramework.ONNX,
    modality: ModelCategory.Audio,
    memoryRequirement: 3_000_000,
  },
  // STT — Whisper Tiny English int8 (~103 MB)
  {
    id: 'whisper-tiny-en',
    name: 'Whisper Tiny English',
    repo: 'csukuangfj/sherpa-onnx-whisper-tiny.en',
    files: ['tiny.en-encoder.int8.onnx', 'tiny.en-decoder.int8.onnx', 'tiny.en-tokens.txt'],
    framework: LLMFramework.OpenAIWhisper,
    modality: ModelCategory.SpeechRecognition,
    memoryRequirement: 110_000_000,
  },
  // TTS — Piper English voice (~63 MB)
  {
    id: 'piper-tts-en-amy-low',
    name: 'Piper English (Amy)',
    repo: 'csukuangfj/vits-piper-en_US-amy-low',
    files: ['en_US-amy-low.onnx', 'tokens.txt'],
    framework: LLMFramework.PiperTTS,
    modality: ModelCategory.SpeechSynthesis,
    memoryRequirement: 70_000_000,
  },
];

// ── SDK Logger Instance ─────────────────────────────────────
const log = new SDKLogger('ShadowNotes');

// ── Device Capabilities Cache ───────────────────────────────
let _capabilities: WebCapabilities | null = null;

/**
 * Return the cached device capabilities detected during SDK init.
 * If called before init completes, runs detection on-demand.
 */
export async function getCapabilities(): Promise<WebCapabilities> {
  if (_capabilities) return _capabilities;
  _capabilities = await detectCapabilities();
  return _capabilities;
}

/**
 * Get recommended performance settings based on device capabilities.
 * Uses detectCapabilities() to adapt AI features for the hardware.
 */
export function getRecommendedPreset(): 'high' | 'medium' | 'low' {
  if (!_capabilities) return 'medium';

  const { deviceMemoryGB, hardwareConcurrency, hasWebGPU } = _capabilities;

  // High: WebGPU + 8GB+ RAM + 8+ cores
  if (hasWebGPU && deviceMemoryGB >= 8 && hardwareConcurrency >= 8) return 'high';

  // Low: <4GB RAM or <4 cores (mobile/low-end)
  if (deviceMemoryGB < 4 || hardwareConcurrency < 4) return 'low';

  return 'medium';
}

// ── GPU Acceleration Detection ──────────────────────────────

/** Check if the GPU supports ShaderF16 (required by the WebGPU WASM backend).
 *  Includes timeout and crash-recovery: if a previous GPU attempt crashed the
 *  tab, we remember that in sessionStorage and skip GPU on next load. */
async function detectAcceleration(): Promise<AccelerationPreference> {
  try {
    // If GPU previously crashed this session, skip entirely
    const gpuCrashFlag = 'shadownotes_gpu_crash';
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(gpuCrashFlag)) {
      log.warning('GPU previously crashed -- forcing CPU inference this session');
      return AccelerationPreference.CPU;
    }

    const gpu = (navigator as unknown as Record<string, unknown>).gpu as
      | { requestAdapter(): Promise<{ features: Set<string> } | null> }
      | undefined;
    if (!gpu) return AccelerationPreference.CPU;

    // Timeout GPU adapter request -- some drivers hang indefinitely
    const adapterPromise = gpu.requestAdapter();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 5000),
    );
    const adapter = await Promise.race([adapterPromise, timeoutPromise]);

    if (!adapter || !adapter.features.has('shader-f16')) {
      log.warning('GPU lacks shader-f16 -- falling back to CPU inference');
      return AccelerationPreference.CPU;
    }

    // Mark that we're attempting GPU -- if the tab crashes, the flag stays
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(gpuCrashFlag, '1');
    }

    // If we reach here successfully, clear the crash flag on next tick
    // (LlamaCPP.register will be the real test -- clear after SDK init)
    return AccelerationPreference.Auto;
  } catch (err) {
    log.warning(`GPU detection error: ${err}`);
    return AccelerationPreference.CPU;
  }
}

// ── SDK Initialization ──────────────────────────────────────

let _initPromise: Promise<void> | null = null;

export async function initSDK(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const acceleration = await detectAcceleration();

    await RunAnywhere.initialize({
      environment: SDKEnvironment.Production,
      debug: false,
      acceleration,
    });

    // Register LlamaCPP backend (LLM, structured output, tool calling, embeddings)
    try {
      await LlamaCPP.register();
      // GPU survived registration -- clear crash flag
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('shadownotes_gpu_crash');
      }
    } catch (err) {
      log.warning(`LlamaCPP registration failed, retrying with CPU: ${err}`);
      // GPU crashed -- force CPU and retry
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('shadownotes_gpu_crash', '1');
      }
      await RunAnywhere.initialize({
        environment: SDKEnvironment.Production,
        debug: false,
        acceleration: AccelerationPreference.CPU,
      });
      await LlamaCPP.register();
    }

    // Register ONNX backend (STT, TTS, VAD -- audio features)
    try {
      await ONNX.register();
    } catch (err) {
      log.warning(`ONNX registration failed (audio features unavailable): ${err}`);
    }

    // Register model definitions with the SDK
    RunAnywhere.registerModels(MODELS);

    // Detect and cache device capabilities
    _capabilities = await detectCapabilities();
    log.info(`SDK initialized | WebGPU: ${_capabilities.hasWebGPU} | SIMD: ${_capabilities.hasWASMSIMD} | Memory: ${_capabilities.deviceMemoryGB}GB | Cores: ${_capabilities.hardwareConcurrency}`);
  })();

  return _initPromise;
}

// ── ONNX Model Preloading ────────────────────────────────────

/** Check whether the high-level ONNX module for a given category is ready. */
function isModuleReady(category: ModelCategory): boolean {
  try {
    if (category === ModelCategory.Audio) return VAD.isInitialized;
    if (category === ModelCategory.SpeechRecognition) return STT.isModelLoaded;
    if (category === ModelCategory.SpeechSynthesis) return TTS.isVoiceLoaded;
  } catch { /* module not available */ }
  return false;
}

/** State reported per-model during preload. */
export type OnnxModelState = 'pending' | 'checking' | 'downloading' | 'loading' | 'done' | 'error';

/** Progress event emitted for each ONNX model during preload. */
export interface OnnxPreloadEvent {
  model: 'VAD' | 'STT' | 'TTS';
  modelName: string;
  modelSize: string;
  state: OnnxModelState;
  progress: number; // 0-1 for download
  error?: string;
}

/** Model metadata used during preload display. */
const ONNX_MODEL_META: Record<string, { label: 'VAD' | 'STT' | 'TTS'; name: string; size: string; category: ModelCategory }> = {
  'silero-vad': { label: 'VAD', name: 'Silero Voice Activity Detection', size: '2.3 MB', category: ModelCategory.Audio },
  'whisper-tiny-en': { label: 'STT', name: 'Whisper Tiny English', size: '103 MB', category: ModelCategory.SpeechRecognition },
  'piper-tts-en-amy-low': { label: 'TTS', name: 'Piper English (Amy)', size: '63 MB', category: ModelCategory.SpeechSynthesis },
};

/**
 * Download and load a single ONNX model with granular progress reporting.
 * Uses explicit download + load (mirroring LLM boot pattern) instead of
 * ensureLoaded, so we can subscribe to EventBus download progress events.
 */
async function downloadAndLoadOnnxModel(
  category: ModelCategory,
  onProgress?: (event: OnnxPreloadEvent) => void,
): Promise<void> {
  const models = ModelManager.getModels().filter(m => m.modality === category);
  if (models.length === 0) {
    log.warning(`No ${category} model registered — skipping`);
    return;
  }

  const model = models[0];
  const meta = ONNX_MODEL_META[model.id] ?? { label: 'ONNX' as const, name: model.name, size: '?', category };
  const emit = (state: OnnxModelState, progress: number, error?: string) => {
    onProgress?.({ model: meta.label, modelName: meta.name, modelSize: meta.size, state, progress, error });
  };

  emit('checking', 0);

  // Check OPFS cache directly — model.status may lag behind actual cache state
  const opfs = new OPFSStorage();
  const opfsOk = await opfs.initialize();
  const cached = opfsOk && await opfs.hasModel(model.id);

  if (!cached && model.status !== 'downloaded' && model.status !== 'loaded') {
    // Download with progress tracking via EventBus
    emit('downloading', 0);
    const unsub = EventBus.shared.on('model.downloadProgress', (evt: { modelId?: string; progress?: number }) => {
      if (evt.modelId === model.id) {
        emit('downloading', evt.progress ?? 0);
      }
    });
    try {
      await ModelManager.downloadModel(model.id);
    } finally {
      unsub();
    }
  }

  // Load into inference engine
  emit('loading', 1);
  if (!ModelManager.getLoadedModel(category)) {
    await ModelManager.loadModel(model.id, { coexist: true });
  }

  // Verify the high-level module actually reports as ready.
  // If loadModel succeeded at the ModelManager level but the module
  // state wasn't set (e.g. loader didn't run), force a reload.
  if (!isModuleReady(category)) {
    log.warning(`${meta.label} module not ready after loadModel — retrying`);
    await ModelManager.loadModel(model.id, { coexist: true });
  }

  refreshSDKFeatureStatus();

  if (isModuleReady(category)) {
    emit('done', 1);
    log.info(`${meta.label} (${meta.name}) loaded successfully`);
  } else {
    emit('error', 1, `${meta.label} module not ready after load`);
    log.warning(`${meta.label} module not ready after all attempts`);
  }
}

/**
 * Preload ONNX audio models (VAD, STT, TTS) so they are ready for
 * first use without an on-demand download pause.
 *
 * Reports granular per-model download + load progress via callback.
 */
export async function preloadONNXModels(
  onProgress?: (event: OnnxPreloadEvent) => void,
): Promise<void> {
  // VAD: Silero Voice Activity Detection (~2.3 MB)
  try {
    await downloadAndLoadOnnxModel(ModelCategory.Audio, onProgress);
  } catch (err) {
    log.warning(`VAD preload failed: ${err}`);
    onProgress?.({ model: 'VAD', modelName: 'Silero VAD', modelSize: '2.3 MB', state: 'error', progress: 0, error: String(err) });
  }

  // STT: Whisper Tiny English (~103 MB on first run, cached after)
  try {
    await downloadAndLoadOnnxModel(ModelCategory.SpeechRecognition, onProgress);
  } catch (err) {
    log.warning(`STT preload failed: ${err}`);
    onProgress?.({ model: 'STT', modelName: 'Whisper Tiny English', modelSize: '103 MB', state: 'error', progress: 0, error: String(err) });
  }

  // TTS: Piper English voice (~63 MB on first run, cached after)
  try {
    await downloadAndLoadOnnxModel(ModelCategory.SpeechSynthesis, onProgress);
  } catch (err) {
    log.warning(`TTS preload failed: ${err}`);
    onProgress?.({ model: 'TTS', modelName: 'Piper English (Amy)', modelSize: '63 MB', state: 'error', progress: 0, error: String(err) });
  }

  // Final refresh to capture all states
  refreshSDKFeatureStatus();
  log.info('ONNX audio models preloaded (VAD + STT + TTS)');
}

// ── Voice Agent Factory ──────────────────────────────────────

/**
 * Create a pre-configured VoiceAgent for hands-free operation.
 * Uses VoicePipeline to orchestrate AudioCapture -> VAD -> STT -> LLM -> TTS.
 *
 * Returns a VoiceAgentSession that callers can use to process voice turns,
 * or throws if the SDK's ONNX models are not available.
 */
export async function createVoiceAgent(systemPrompt: string): Promise<{
  session: InstanceType<typeof VoiceAgentSession>;
  pipeline: VoicePipeline;
  destroy: () => void;
}> {
  // Create the high-level VoicePipeline for streaming turns
  const pipeline = new VoicePipeline();

  // Create the lower-level VoiceAgentSession for model management
  const session = await VoiceAgent.create();

  return {
    session,
    pipeline,
    /** Convenience: tear down both session and pipeline. */
    destroy() {
      try { pipeline.cancel(); } catch { /* safe */ }
      try { session.destroy(); } catch { /* safe */ }
    },
  };
}

export type {
  VoicePipelineCallbacks,
  VoicePipelineOptions,
  VoicePipelineTurnResult,
} from '@runanywhere/web';

// ── SDK Feature Readiness Tracking ──────────────────────────
// Global readiness state that persists after boot. Hooks and UI components
// can poll this synchronously to determine which SDK features are available,
// without depending on delayed re-checks or ONNX property getters.

export interface SDKFeatureStatus {
  llm: boolean;
  stt: boolean;
  vad: boolean;
  tts: boolean;
  embeddings: boolean;
}

const _sdkFeatures: SDKFeatureStatus = {
  llm: false,
  stt: false,
  vad: false,
  tts: false,
  embeddings: false,
};

type SDKFeatureListener = (status: SDKFeatureStatus) => void;
const _featureListeners = new Set<SDKFeatureListener>();

/** Get a snapshot of which SDK features are loaded and ready. */
export function getSDKFeatureStatus(): SDKFeatureStatus {
  return { ..._sdkFeatures };
}

/** Subscribe to SDK feature readiness changes. Returns unsubscribe function. */
export function onSDKFeatureChange(listener: SDKFeatureListener): () => void {
  _featureListeners.add(listener);
  return () => { _featureListeners.delete(listener); };
}

/** Re-check all SDK feature readiness flags and notify listeners if changed. */
export function refreshSDKFeatureStatus(): void {
  let changed = false;
  const check = (key: keyof SDKFeatureStatus, value: boolean) => {
    if (_sdkFeatures[key] !== value) {
      _sdkFeatures[key] = value;
      changed = true;
    }
  };

  // LLM: check if a language model is loaded
  try {
    check('llm', !!ModelManager.getLoadedModel(ModelCategory.Language));
  } catch { check('llm', false); }

  // ONNX features
  try { check('vad', VAD.isInitialized); } catch { check('vad', false); }
  try { check('stt', STT.isModelLoaded); } catch { check('stt', false); }
  try { check('tts', TTS.isVoiceLoaded); } catch { check('tts', false); }

  // Embeddings (LlamaCPP)
  try { check('embeddings', Embeddings.isModelLoaded); } catch { check('embeddings', false); }

  if (changed) {
    const snapshot = { ..._sdkFeatures };
    for (const fn of _featureListeners) {
      try { fn(snapshot); } catch { /* listener error */ }
    }
  }
}

// ── Re-exports ──────────────────────────────────────────────
// Every symbol that other files in the app may need, grouped by package.

// Core infrastructure (@runanywhere/web)
export {
  RunAnywhere,
  ModelManager,
  ModelCategory,
  OPFSStorage,
  SDKEnvironment,
  EventBus,
  VoicePipeline,
  VoiceAgent,
  VoiceAgentSession,
  SDKLogger,
  LLMFramework,
  AccelerationPreference,
  detectCapabilities,
};

// LLM capabilities (@runanywhere/web-llamacpp)
export {
  LlamaCPP,
  TextGeneration,
  StructuredOutput,
  ToolCalling,
  Embeddings,
  toToolValue,
  fromToolValue,
  getStringArg,
  getNumberArg,
};

// Audio / speech capabilities (@runanywhere/web-onnx)
export {
  ONNX,
  STT,
  TTS,
  VAD,
  AudioCapture,
  AudioPlayback,
  STTModelType,
  SpeechActivity,
};

// Re-export key types so consumers don't need to import from SDK packages directly
export type { CompactModelDef, WebCapabilities } from '@runanywhere/web';
export type {
  ToolValue,
  ToolDefinition,
  ToolCall,
  ToolCallingResult,
} from '@runanywhere/web-llamacpp';
export type {
  AudioCaptureConfig,
  AudioChunkCallback,
  AudioLevelCallback,
} from '@runanywhere/web-onnx';
export type {
  PlaybackConfig,
  PlaybackCompleteCallback,
} from '@runanywhere/web-onnx';
export type {
  STTModelConfig,
  STTTranscriptionResult,
  STTTranscribeOptions,
  STTStreamingSession,
} from '@runanywhere/web-onnx';
export type {
  TTSVoiceConfig,
  TTSSynthesisResult,
  TTSSynthesizeOptions,
} from '@runanywhere/web-onnx';
export type {
  VADModelConfig,
  SpeechActivityCallback,
  SpeechSegment,
} from '@runanywhere/web-onnx';
