import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '../../types/mtg';
import { normalizeScryfallCard, POPULAR_LIMITED_SETS } from '../../services/scryfall';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { Search, X, Loader2, Sparkles, Check, Database } from 'lucide-react';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';
 
/**
 * Transforms a user query into an optimized Scryfall search query
 * supporting oracle rules text, card names, mana costs, and creature stats.
 */
export function buildScryfallPrecedentQuery(input: string, targetSet?: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // 1. Shorthand syntax transformations:
  // - "2/3" -> "pow=2 tou=3"
  // - "{2}{W}" -> "m:{2}{W}"
  // - "2W", "1U", "3BB" -> "m:{2}{W}", "m:{1}{U}", "m:{3}{B}{B}"
  let working = trimmed
    .replace(/\b([0-9]+|\*)\/([0-9]+|\*)\b/g, 'pow=$1 tou=$2')
    .replace(/(^|\s)((?:\{[a-zA-Z0-9/]+\})+)/g, '$1m:$2');

  // Convert shorthand mana like 2W, 1U, 3BB, 1G, WW to m:{...}
  working = working.replace(/\b([0-9]+[wubrgcWUBRGC]+|[WUBRGC]{2,})\b/g, (match) => {
    const braced = match.replace(/([0-9]+|[a-zA-Z])/g, (m) => `{${m.toUpperCase()}}`);
    return `m:${braced}`;
  });

  // 2. Tokenize respecting quoted strings and key:value syntax
  const tokenRegex = /([a-zA-Z0-9_]+[:=](?:"[^"]*"|[^\s]+))|("[^"]*")|([^\s]+)/g;
  const matches = Array.from(working.matchAll(tokenRegex));

  const syntaxFilters: string[] = [];
  const freeTextTokens: string[] = [];

  for (const match of matches) {
    const rawToken = match[0];
    if (!rawToken) continue;

    // Check if token already has an explicit field operator (e.g. o:, oracle:, t:, type:, c:, pow=, m:, etc.)
    if (/^[a-zA-Z0-9_]+[:=]/.test(rawToken)) {
      syntaxFilters.push(rawToken);
    } else if (rawToken.startsWith('"') && rawToken.endsWith('"') && rawToken.length >= 2) {
      // Exact quoted phrase: search both name AND oracle text
      const unquoted = rawToken.slice(1, -1).trim();
      if (unquoted) {
        syntaxFilters.push(`("${unquoted}" or o:"${unquoted}")`);
      }
    } else {
      const cleanToken = rawToken.replace(/[,;]+$/, '');
      if (cleanToken) {
        freeTextTokens.push(cleanToken);
      }
    }
  }

  // 3. Process unadorned free text terms
  if (freeTextTokens.length > 0) {
    if (freeTextTokens.length === 1) {
      const word = freeTextTokens[0];
      // Single word: matches card name OR oracle text
      syntaxFilters.push(`("${word}" or o:"${word}")`);
    } else {
      // Multiple words:
      // Search exact phrase in name OR exact phrase in oracle text OR all individual words in oracle text
      const phrase = freeTextTokens.join(' ');
      const individualOracle = freeTextTokens.map((w) => `o:${w}`).join(' ');
      syntaxFilters.push(`("${phrase}" or o:"${phrase}" or (${individualOracle}))`);
    }
  }

  // 4. Draft sets & booster prioritization (Never compare a set to itself)
  const excludeSet = targetSet ? ` -s:${targetSet.toLowerCase()}` : '';
  const baseFilter = `(is:booster or not:funny) -layout:art_series -t:token${excludeSet}`;
  return `${syntaxFilters.join(' ')} ${baseFilter}`.trim();
}

interface PrecedentCardSearchProps {
  targetCard: Card;
  onSelectCard: (card: Card) => void;
  className?: string;
  placeholder?: string;
}

export const PrecedentCardSearch: React.FC<PrecedentCardSearchProps> = ({
  targetCard,
  onSelectCard,
  className = '',
  placeholder = 'Search name, rules text (e.g. draw a card), stats 2/3, or mana {2}{W}...',
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const targetCardRef = useRef(targetCard);
  useEffect(() => {
    targetCardRef.current = targetCard;
  }, [targetCard]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeSearchIdRef = useRef<number>(0);

  // Search execution with debouncing
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setResults([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const currentSearchId = ++activeSearchIdRef.current;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);

      try {
        const currentTarget = targetCardRef.current;
        const scryfallQuery = buildScryfallPrecedentQuery(trimmed, currentTarget.set);
        const url = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(scryfallQuery)}&order=released&dir=desc`;

        let res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        // Fallback: If expanded query didn't match, attempt literal booster query
        if (!res.ok) {
          const excludeSet = currentTarget.set ? ` -s:${currentTarget.set.toLowerCase()}` : '';
          const fallbackQuery = `${trimmed} (is:booster or not:funny) -layout:art_series -t:token${excludeSet}`;
          const fallbackUrl = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(fallbackQuery)}&order=released&dir=desc`;
          res = await fetch(fallbackUrl, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          });
        }

        if (currentSearchId !== activeSearchIdRef.current || controller.signal.aborted) {
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.data)) {
            const normalized: Card[] = data.data
              .filter((rc: any) => !rc.name.startsWith('A-') && !rc.promo_types?.includes('rebalanced'))
              .map(normalizeScryfallCard)
              // Exclude target card itself and NEVER compare a set to itself
              .filter(
                (c: Card) =>
                  c.name.toLowerCase() !== currentTarget.name.toLowerCase() &&
                  (!currentTarget.set || !c.set || c.set.toLowerCase() !== currentTarget.set.toLowerCase())
              );

            // Prioritize cards with 17lands data and unique card names
            const deduped: Card[] = [];
            const seenNames = new Set<string>();

            // First pass: prefer printings in known 17Lands sets
            for (const c of normalized) {
              const nameLower = c.name.toLowerCase();
              const has17L = POPULAR_LIMITED_SETS.some(
                (s) => s.code.toUpperCase() === c.set.toUpperCase() && s.has_17lands_data !== false
              );
              if (!seenNames.has(nameLower) && has17L) {
                seenNames.add(nameLower);
                deduped.push(c);
              }
            }

            // Second pass: include any remaining unique names
            for (const c of normalized) {
              const nameLower = c.name.toLowerCase();
              if (!seenNames.has(nameLower)) {
                seenNames.add(nameLower);
                deduped.push(c);
              }
            }

            // Prioritize exact name match at the top if present
            const exactIdx = deduped.findIndex(c => c.name.toLowerCase() === trimmed.toLowerCase());
            if (exactIdx > 0) {
              const [exactMatch] = deduped.splice(exactIdx, 1);
              deduped.unshift(exactMatch);
            }

            setResults(deduped.slice(0, 10));
            setIsOpen(deduped.length > 0);
            setSelectedIndex(-1);
          } else {
            setResults([]);
            setIsOpen(false);
          }
        } else {
          setResults([]);
          setIsOpen(false);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Scryfall card search failed:', err);
          if (currentSearchId === activeSearchIdRef.current) {
            setResults([]);
            setIsOpen(false);
          }
        }
      } finally {
        if (currentSearchId === activeSearchIdRef.current) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, targetCard?.id, targetCard?.name, targetCard?.set]);

  const handleSelect = useCallback(
    (card: Card) => {
      onSelectCard(card);
      // Keep query intact so user does not lose their search if they review or cancel
      setIsOpen(false);
      setSelectedIndex(-1);
    },
    [onSelectCard]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Bar Input */}
      <div className="relative flex items-center group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-violet-600 dark:group-focus-within:text-cyan-400 transition-colors" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 shadow-xs transition-all"
        />

        {/* Right Icon: Spinner or Clear */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <Loader2 className="w-4 h-4 text-violet-600 dark:text-cyan-400 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Quick Search Syntax Tip */}
      <div className="flex items-center gap-1.5 px-1 pt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex-wrap">
        <span className="text-violet-600 dark:text-cyan-400 font-bold">Search tip:</span>
        <span>Try:</span>
        <button
          type="button"
          onClick={() => {
            setQuery('draw a card');
            inputRef.current?.focus();
          }}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        >
          draw a card
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('destroy target');
            inputRef.current?.focus();
          }}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        >
          destroy target
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('2/3');
            inputRef.current?.focus();
          }}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        >
          2/3
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('{2}{W}');
            inputRef.current?.focus();
          }}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        >
          {'{2}{W}'}
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('flying 2/3 {2}{W}');
            inputRef.current?.focus();
          }}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
        >
          flying 2/3 {'{2}{W}'}
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-[360px] overflow-y-auto custom-scrollbar animate-in fade-in-50 duration-150">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#050818] flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select card to substitute into precedents
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {results.length} results
            </span>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {results.map((card, idx) => {
              const isSelected = idx === selectedIndex;
              const has17L = POPULAR_LIMITED_SETS.some(
                (s) => s.code.toUpperCase() === card.set.toUpperCase() && s.has_17lands_data !== false
              );
              const imgUri =
                card.image_uris?.small ||
                card.image_uris?.normal ||
                (card.card_faces && card.card_faces[0]?.image_uris?.small);

              return (
                <li
                  key={`${card.set}_${card.id}`}
                  onClick={() => handleSelect(card)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-950 dark:text-cyan-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {/* Card Thumbnail */}
                  {imgUri ? (
                    <img
                      src={imgUri}
                      alt={card.name}
                      className="w-8 h-11 rounded object-contain shadow-2xs shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-900"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const cleanFrontName = card.name.replace(/^A-/, '').split(' // ')[0].trim();
                        const gathererUrl = `https://gatherer.wizards.com/Handlers/Image.ashx?type=card&name=${encodeURIComponent(cleanFrontName)}`;
                        if (target.src !== gathererUrl) {
                          target.src = gathererUrl;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-8 h-11 rounded bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400">
                      MTG
                    </div>
                  )}

                  {/* Card Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs truncate font-heading">
                        {card.name}
                      </span>
                      {card.mana_cost && (
                        <div className="shrink-0 scale-90 origin-right">
                          <ManaCostRenderer manaCost={card.mana_cost} size="sm" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <SetSymbol setCode={card.set} size="xs" />
                        <span className="font-bold uppercase text-violet-700 dark:text-cyan-400">
                          {card.set}
                        </span>
                      </div>
                      <span>•</span>
                      <span className="capitalize">{card.rarity}</span>
                      {card.type_line && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[140px] sm:max-w-[220px]">
                            {card.type_line}
                          </span>
                        </>
                      )}
                      {card.power !== undefined && card.toughness !== undefined && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {card.power}/{card.toughness}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Oracle Rules Text Preview */}
                    {card.oracle_text && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 font-sans pt-0.5 leading-snug">
                        {card.oracle_text}
                      </p>
                    )}
                  </div>

                  {/* 17Lands telemetry indicator */}
                  {has17L && (
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1"
                      title="17Lands premier draft telemetry verified for this set"
                    >
                      <Database className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      <span>17Lands</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
