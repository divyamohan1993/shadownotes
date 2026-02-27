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

/**
 * Preload ONNX audio models (VAD, STT, TTS) so they are ready for
 * first use without an on-demand download pause.
 *
 * Uses ModelManager.ensureLoaded() which handles the full lifecycle:
 * download from HuggingFace → store in OPFS → write to sherpa-onnx FS → load.
 * After first preload, models are cached in OPFS and loaded instantly.
 */
export async function preloadONNXModels(
  onProgress?: (step: string, done: boolean) => void,
): Promise<void> {
  // VAD: Silero Voice Activity Detection (~2.3 MB)
  try {
    onProgress?.('VAD', false);
    await ModelManager.ensureLoaded(ModelCategory.Audio, { coexist: true });
    onProgress?.('VAD', true);
  } catch (err) {
    log.warning(`VAD preload skipped: ${err}`);
    onProgress?.('VAD', true);
  }

  // STT: Whisper Tiny English (~103 MB on first run, cached after)
  try {
    onProgress?.('STT', false);
    await ModelManager.ensureLoaded(ModelCategory.SpeechRecognition, { coexist: true });
    onProgress?.('STT', true);
  } catch (err) {
    log.warning(`STT preload skipped: ${err}`);
    onProgress?.('STT', true);
  }

  // TTS: Piper English voice (~63 MB on first run, cached after)
  try {
    onProgress?.('TTS', false);
    await ModelManager.ensureLoaded(ModelCategory.SpeechSynthesis, { coexist: true });
    onProgress?.('TTS', true);
  } catch (err) {
    log.warning(`TTS preload skipped: ${err}`);
    onProgress?.('TTS', true);
  }

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
