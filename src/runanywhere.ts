import {
  RunAnywhere,
  SDKEnvironment,
  ModelManager,
  ModelCategory,
  LLMFramework,
  AccelerationPreference,
  OPFSStorage,
  type CompactModelDef,
} from '@runanywhere/web';

import {
  LlamaCPP,
  TextGeneration,
  StructuredOutput,
} from '@runanywhere/web-llamacpp';

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

/** Check if the GPU supports ShaderF16 (required by the WebGPU WASM backend).
 *  Includes timeout and crash-recovery: if a previous GPU attempt crashed the
 *  tab, we remember that in sessionStorage and skip GPU on next load. */
async function detectAcceleration(): Promise<AccelerationPreference> {
  try {
    // If GPU previously crashed this session, skip entirely
    const gpuCrashFlag = 'shadownotes_gpu_crash';
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(gpuCrashFlag)) {
      console.warn('[ShadowNotes] GPU previously crashed — forcing CPU inference this session');
      return AccelerationPreference.CPU;
    }

    const gpu = (navigator as unknown as Record<string, unknown>).gpu as
      | { requestAdapter(): Promise<{ features: Set<string> } | null> }
      | undefined;
    if (!gpu) return AccelerationPreference.CPU;

    // Timeout GPU adapter request — some drivers hang indefinitely
    const adapterPromise = gpu.requestAdapter();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 5000),
    );
    const adapter = await Promise.race([adapterPromise, timeoutPromise]);

    if (!adapter || !adapter.features.has('shader-f16')) {
      console.warn('[ShadowNotes] GPU lacks shader-f16 — falling back to CPU inference');
      return AccelerationPreference.CPU;
    }

    // Mark that we're attempting GPU — if the tab crashes, the flag stays
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(gpuCrashFlag, '1');
    }

    // If we reach here successfully, clear the crash flag on next tick
    // (LlamaCPP.register will be the real test — clear after SDK init)
    return AccelerationPreference.Auto;
  } catch (err) {
    console.warn('[ShadowNotes] GPU detection error:', err);
    return AccelerationPreference.CPU;
  }
}

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

    try {
      await LlamaCPP.register();
      // GPU survived registration — clear crash flag
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('shadownotes_gpu_crash');
      }
    } catch (err) {
      console.warn('[ShadowNotes] LlamaCPP registration failed, retrying with CPU:', err);
      // GPU crashed — force CPU and retry
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

    RunAnywhere.registerModels(MODELS);
  })();

  return _initPromise;
}

// ── SDK Capability Exports ──────────────────────────────────
// Core infrastructure
export { RunAnywhere, ModelManager, ModelCategory, OPFSStorage };

// LLM capabilities (llama.cpp WASM)
export { LlamaCPP, TextGeneration, StructuredOutput };
