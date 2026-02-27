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
// Primary LLM for intelligence extraction
const MODELS: CompactModelDef[] = [
  {
    id: 'qwen2.5-0.5b-instruct-q4_k_m',
    name: 'Qwen2.5 0.5B Instruct Q4_K_M',
    repo: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
    files: ['Qwen2.5-0.5B-Instruct-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 400_000_000,
  },
];

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

// ── GPU Acceleration Detection ──────────────────────────────

/** Check if the GPU supports ShaderF16 (required by the WebGPU WASM backend).
 *  Includes timeout and crash-recovery: if a previous GPU attempt crashed the
 *  tab, we remember that in sessionStorage and skip GPU on next load. */
async function detectAcceleration(): Promise<AccelerationPreference> {
  try {
    // If GPU previously crashed this session, skip entirely
    const gpuCrashFlag = 'shadownotes_gpu_crash';
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(gpuCrashFlag)) {
      console.warn('[ShadowNotes] GPU previously crashed -- forcing CPU inference this session');
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
      console.warn('[ShadowNotes] GPU lacks shader-f16 -- falling back to CPU inference');
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
    console.warn('[ShadowNotes] GPU detection error:', err);
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
      console.warn('[ShadowNotes] LlamaCPP registration failed, retrying with CPU:', err);
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
      console.warn('[ShadowNotes] ONNX registration failed (audio features unavailable):', err);
    }

    // Register model definitions with the SDK
    RunAnywhere.registerModels(MODELS);

    // Detect and cache device capabilities
    _capabilities = await detectCapabilities();
    console.info(
      '[ShadowNotes] SDK initialized | WebGPU:',
      _capabilities.hasWebGPU,
      '| SIMD:',
      _capabilities.hasWASMSIMD,
      '| Memory:',
      _capabilities.deviceMemoryGB + 'GB',
      '| Cores:',
      _capabilities.hardwareConcurrency,
    );
  })();

  return _initPromise;
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
