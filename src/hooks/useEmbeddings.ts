/**
 * useEmbeddings -- Semantic deduplication and similarity search hook.
 *
 * Wraps the RunAnywhere Embeddings extension to provide:
 *   - deduplicate()  -- remove near-duplicate intelligence items
 *   - findSimilar()  -- rank items by semantic similarity to a query
 *
 * Embeddings are cached in a Map keyed by content string so repeated calls
 * (e.g. after each new transcript chunk) don't recompute vectors for items
 * the model has already seen.
 *
 * Graceful fallback: when the embeddings model is not loaded, both functions
 * return the input unchanged.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Embeddings } from '@runanywhere/web-llamacpp';
import type { IntelligenceItem } from '../types';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface EmbeddingsResult {
  /** Whether the embeddings model is currently available. */
  isAvailable: boolean;
  /**
   * Remove near-duplicate items based on cosine similarity.
   * Items whose embeddings are above `threshold` similarity to an
   * already-accepted item are dropped.  First occurrence wins.
   *
   * @param items     - Intelligence items to deduplicate
   * @param threshold - Cosine similarity threshold (default 0.85)
   */
  deduplicate: (
    items: IntelligenceItem[],
    threshold?: number,
  ) => Promise<IntelligenceItem[]>;
  /**
   * Return the top-K items most semantically similar to `query`.
   *
   * @param query - Free-text search query
   * @param items - Pool of items to search
   * @param topK  - Number of results to return (default 5)
   */
  findSimilar: (
    query: string,
    items: IntelligenceItem[],
    topK?: number,
  ) => Promise<IntelligenceItem[]>;
  /**
   * Build RAG context by semantically retrieving the most relevant prior findings
   * for a given transcript chunk. Uses embeddings to find the top-K most relevant
   * prior items, ranked by cosine similarity.
   *
   * @param query      - Current transcript text to find relevant context for
   * @param priorItems - Pool of prior intelligence items to search
   * @param topK       - Number of results to return (default 5)
   * @returns Formatted string of the top-K most relevant prior findings
   */
  buildRAGContext: (
    query: string,
    priorItems: IntelligenceItem[],
    topK?: number,
  ) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const DEFAULT_TOP_K = 5;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEmbeddings(): EmbeddingsResult {
  // Persistent cache: content string -> Float32Array vector
  const cacheRef = useRef<Map<string, Float32Array>>(new Map());

  // ------- helpers -------

  /** Get the embedding vector for a single text, with caching. */
  const getVector = useCallback(async (text: string): Promise<Float32Array | null> => {
    const cached = cacheRef.current.get(text);
    if (cached) return cached;

    try {
      const result = await Embeddings.embed(text);
      if (result.embeddings.length > 0) {
        const vec = result.embeddings[0].data;
        cacheRef.current.set(text, vec);
        return vec;
      }
    } catch {
      // Model may not be loaded -- handled by caller
    }
    return null;
  }, []);

  /**
   * Batch-embed an array of texts, returning vectors in order.
   * Texts already present in the cache are skipped in the batch request
   * to minimise WASM work.
   */
  const getVectors = useCallback(
    async (texts: string[]): Promise<(Float32Array | null)[]> => {
      const results: (Float32Array | null)[] = new Array(texts.length).fill(null);

      // Separate cached from uncached
      const uncachedIndices: number[] = [];
      const uncachedTexts: string[] = [];

      for (let i = 0; i < texts.length; i++) {
        const cached = cacheRef.current.get(texts[i]);
        if (cached) {
          results[i] = cached;
        } else {
          uncachedIndices.push(i);
          uncachedTexts.push(texts[i]);
        }
      }

      // Batch-embed the uncached texts
      if (uncachedTexts.length > 0) {
        try {
          const batchResult = await Embeddings.embedBatch(uncachedTexts);
          for (let j = 0; j < uncachedTexts.length; j++) {
            if (j < batchResult.embeddings.length) {
              const vec = batchResult.embeddings[j].data;
              cacheRef.current.set(uncachedTexts[j], vec);
              results[uncachedIndices[j]] = vec;
            }
          }
        } catch {
          // Fallback: attempt individual embeds (slower but more resilient)
          for (let j = 0; j < uncachedTexts.length; j++) {
            const vec = await getVector(uncachedTexts[j]);
            results[uncachedIndices[j]] = vec;
          }
        }
      }

      return results;
    },
    [getVector],
  );

  // ------- public API -------

  const deduplicate = useCallback(
    async (
      items: IntelligenceItem[],
      threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
    ): Promise<IntelligenceItem[]> => {
      if (items.length <= 1) return items;

      // Guard: embeddings not available -- return unchanged
      if (!Embeddings.isModelLoaded) return items;

      const texts = items.map((it) => it.content);
      const vectors = await getVectors(texts);

      // If we couldn't compute any vectors, return unchanged
      if (vectors.every((v) => v === null)) return items;

      const accepted: IntelligenceItem[] = [];
      const acceptedVecs: Float32Array[] = [];

      for (let i = 0; i < items.length; i++) {
        const vec = vectors[i];
        if (!vec) {
          // Can't compute vector -- keep the item to be safe
          accepted.push(items[i]);
          continue;
        }

        let isDuplicate = false;
        for (const existingVec of acceptedVecs) {
          const sim = Embeddings.cosineSimilarity(vec, existingVec);
          if (sim >= threshold) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          accepted.push(items[i]);
          acceptedVecs.push(vec);
        }
      }

      return accepted;
    },
    [getVectors],
  );

  const findSimilar = useCallback(
    async (
      query: string,
      items: IntelligenceItem[],
      topK: number = DEFAULT_TOP_K,
    ): Promise<IntelligenceItem[]> => {
      if (items.length === 0) return [];

      // Guard: embeddings not available -- return first topK items unchanged
      if (!Embeddings.isModelLoaded) return items.slice(0, topK);

      const queryVec = await getVector(query);
      if (!queryVec) return items.slice(0, topK);

      const texts = items.map((it) => it.content);
      const vectors = await getVectors(texts);

      // Build scored list
      const scored: { item: IntelligenceItem; score: number }[] = [];

      for (let i = 0; i < items.length; i++) {
        const vec = vectors[i];
        // Items without vectors get a neutral score
        const score = vec ? Embeddings.cosineSimilarity(queryVec, vec) : 0;
        scored.push({ item: items[i], score });
      }

      // Sort descending by similarity
      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, topK).map((s) => s.item);
    },
    [getVector, getVectors],
  );

  const buildRAGContext = useCallback(
    async (
      query: string,
      priorItems: IntelligenceItem[],
      topK: number = DEFAULT_TOP_K,
    ): Promise<string> => {
      if (priorItems.length === 0) return '';

      // Use findSimilar to rank prior items by semantic relevance to the query
      const relevant = await findSimilar(query, priorItems, topK);

      if (relevant.length === 0) return '';

      const lines = relevant.map((item) => `[${item.category}] ${item.content}`);
      return `Semantically relevant prior findings (RAG retrieval):\n${lines.join('\n')}`;
    },
    [findSimilar],
  );

  const [isAvailable, setIsAvailable] = useState(() => {
    try { return Embeddings.isModelLoaded; } catch { return false; }
  });

  // Re-check availability — the embeddings model loads with the LLM and may
  // not be ready when this hook first mounts.
  useEffect(() => {
    let mounted = true;
    const check = () => {
      try {
        const ready = Embeddings.isModelLoaded;
        if (mounted) setIsAvailable(ready);
      } catch {
        if (mounted) setIsAvailable(false);
      }
    };
    check();
    const t1 = setTimeout(check, 2_000);
    const t2 = setTimeout(check, 5_000);
    const t3 = setTimeout(check, 10_000);
    return () => { mounted = false; clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return { isAvailable, deduplicate, findSimilar, buildRAGContext };
}
