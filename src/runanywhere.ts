import {
  RunAnywhere,
  SDKEnvironment,
  ModelManager,
  ModelCategory,
  LLMFramework,
  AccelerationPreference,
  type CompactModelDef,
} from '@runanywhere/web';

import { LlamaCPP } from '@runanywhere/web-llamacpp';

// Only register the LLM — STT and VAD are handled by Web Speech API
const MODELS: CompactModelDef[] = [
  {
    id: 'lfm2-350m-q4_k_m',
    name: 'LFM2 350M Q4_K_M',
    repo: 'LiquidAI/LFM2-350M-GGUF',
    files: ['LFM2-350M-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 250_000_000,
  },
];

/** Check if the GPU supports ShaderF16 (required by the WebGPU WASM backend). */
async function detectAcceleration(): Promise<AccelerationPreference> {
  try {
    const gpu = (navigator as unknown as Record<string, unknown>).gpu as
      | { requestAdapter(): Promise<{ features: Set<string> } | null> }
      | undefined;
    if (!gpu) return AccelerationPreference.CPU;
    const adapter = await gpu.requestAdapter();
    if (!adapter || !adapter.features.has('shader-f16')) {
      console.warn('[ShadowNotes] GPU lacks shader-f16 — falling back to CPU inference');
      return AccelerationPreference.CPU;
    }
    return AccelerationPreference.Auto;
  } catch {
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

    await LlamaCPP.register();

    RunAnywhere.registerModels(MODELS);
  })();

  return _initPromise;
}

export function getAccelerationMode(): string | null {
  return LlamaCPP.isRegistered ? LlamaCPP.accelerationMode : null;
}

export { RunAnywhere, ModelManager, ModelCategory };
