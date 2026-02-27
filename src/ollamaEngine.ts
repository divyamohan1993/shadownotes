const OLLAMA_BASE = 'http://localhost:11434';

export interface OllamaResponse {
  text: string;
  model: string;
}

/** Check if Ollama is reachable (3s probe). */
export async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Generate text via local Ollama. 60s timeout, no streaming. */
export async function generateWithOllama(
  prompt: string,
  systemPrompt: string,
  model = 'gemma3:1b',
): Promise<OllamaResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, system: systemPrompt, stream: false }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);

    const data = await res.json();
    return { text: data.response ?? '', model: data.model ?? model };
  } finally {
    clearTimeout(timeoutId);
  }
}
