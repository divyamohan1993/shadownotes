import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult } from '../types';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    try {
      const r = await searchAll(q.trim());
      setResults(r);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, [searchAll]);

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
    <div className="search-overlay" onClick={onClose}>
      <div className="search-container" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <h2 className="search-title">VAULT SEARCH</h2>
          <button className="search-close" onClick={onClose}>{'\u2715'}</button>
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
          />
        </div>

        {isSearching && (
          <div className="search-status">SEARCHING VAULT...</div>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className="search-status">NO MATCHES FOUND</div>
        )}

        {!isSearching && hasSearched && results.length > 0 && (
          <div className="search-status">{results.length} RESULT{results.length !== 1 ? 'S' : ''} FOUND</div>
        )}

        <div className="search-results">
          {results.map((r, i) => (
            <div key={i} className="search-result-card" onClick={() => onNavigate(r)}>
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
