import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult, IntelligenceItem } from '../types';

// ---------------------------------------------------------------------------
// Graceful dynamic import for embeddings (same pattern as ActiveCapture.tsx)
// ---------------------------------------------------------------------------
let useEmbeddings: () => {
  isAvailable: boolean;
  findSimilar: (query: string, items: IntelligenceItem[], topK?: number) => Promise<IntelligenceItem[]>;
};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ useEmbeddings } = require('../hooks/useEmbeddings'));
} catch {
  useEmbeddings = () => ({
    isAvailable: false,
    findSimilar: async (_q: string, items: IntelligenceItem[]) => items,
  });
}

interface Props {
  searchAll: (query: string) => Promise<SearchResult[]>;
  onNavigate: (result: SearchResult) => void;
  onClose: () => void;
}

export function GlobalSearch({ searchAll, onNavigate, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [semanticRanked, setSemanticRanked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const embeddings = useEmbeddings();

  // Store the element that had focus before the modal opened
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    inputRef.current?.focus();
    return () => {
      // Return focus to trigger element on unmount
      triggerRef.current?.focus();
    };
  }, []);

  // Focus trap: keep tab cycling within the modal
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [results]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      setSemanticRanked(false);
      return;
    }
    setIsSearching(true);
    setSemanticRanked(false);
    try {
      const r = await searchAll(q.trim());
      setResults(r);
      setHasSearched(true);

      // Semantic reranking: if embeddings are available, reorder results by
      // semantic similarity to the query. The text-based search remains the
      // primary filter; embeddings only reorder for better relevance.
      if (embeddings.isAvailable && r.length > 1) {
        try {
          // Create temporary IntelligenceItem proxies keyed by index so
          // findSimilar can compute similarity on the excerpt text.
          const proxyItems: IntelligenceItem[] = r.map((res, idx) => ({
            id: String(idx),
            category: res.category || res.type,
            content: res.excerpt,
            timestamp: res.timestamp,
          }));

          const ranked = await embeddings.findSimilar(q.trim(), proxyItems, r.length);

          // Map proxy items back to original SearchResult objects
          const reordered = ranked.map((proxy) => r[Number(proxy.id)]);
          setResults(reordered);
          setSemanticRanked(true);
        } catch {
          // Semantic ranking failed silently -- keep text-based order
        }
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchAll, embeddings]);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  }, [doSearch]);

  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return (
      <>
        {before}<span className="search-result-highlight">{match}</span>{after}
      </>
    );
  };

  return (
    <div className="search-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Vault search">
      <div className="search-container" onClick={(e) => e.stopPropagation()} ref={containerRef}>
        <div className="search-header">
          <h2 className="search-title" id="search-dialog-title">VAULT SEARCH</h2>
          <button
            ref={closeButtonRef}
            className="search-close"
            onClick={onClose}
            aria-label="Close search"
          >
            {'\u2715'}
          </button>
        </div>

        <div className="search-input-row">
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search across all cases and sessions..."
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter') doSearch(query);
            }}
            aria-label="Search across all cases and sessions"
            aria-describedby="search-results-status"
          />
        </div>

        <div aria-live="polite" aria-atomic="true" id="search-results-status">
          {isSearching && (
            <div className="search-status" role="status">SEARCHING VAULT...</div>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <div className="search-status" role="status">NO MATCHES FOUND</div>
          )}

          {!isSearching && hasSearched && results.length > 0 && (
            <div className="search-status" role="status">
              {results.length} RESULT{results.length !== 1 ? 'S' : ''} FOUND
              {semanticRanked && (
                <span className="sdk-badge active" title="Semantic ranking active" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>SEM</span>
              )}
            </div>
          )}
        </div>

        <div className="search-results" role="list" aria-label="Search results">
          {results.map((r, i) => (
            <div
              key={i}
              className="search-result-card"
              onClick={() => onNavigate(r)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(r); } }}
              role="listitem"
              tabIndex={0}
              aria-label={`${r.type === 'transcript' ? 'Transcript' : 'Intel'} result in case ${r.case.shortId} ${r.case.name}${r.category ? `, category: ${r.category}` : ''}: ${r.excerpt.substring(0, 80)}`}
            >
              <div className="search-result-meta">
                <span className="search-result-type">{r.type === 'transcript' ? 'TRANSCRIPT' : 'INTEL'}</span>
                <span className="search-result-case">{r.case.shortId} — {r.case.name}</span>
                {r.category && <span className="search-result-cat">[{r.category}]</span>}
              </div>
              <div className="search-result-excerpt">
                {highlightMatch(r.excerpt, query)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
