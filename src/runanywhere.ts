import {
  RunAnywhere,
  SDKEnvironment,
  ModelManager,
  ModelCategory,
  LLMFramework,
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

let _initPromise: Promise<void> | null = null;

export async function initSDK(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    await RunAnywhere.initialize({
      environment: SDKEnvironment.Development,
      debug: true,
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
