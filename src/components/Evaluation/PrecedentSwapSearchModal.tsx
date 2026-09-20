import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card } from '../../types/mtg';
import { SimilarCardMatch, calculateCardSimilarity } from '../../services/cardSimilarity';
import { normalizeScryfallCard, POPULAR_LIMITED_SETS } from '../../services/scryfall';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { CardImage } from '../UI/CardImage';
import { CardObfuscator } from '../CardObfuscator';
import {
  X,
  Search,
  Loader2,
  ArrowRight,
  ArrowLeftRight,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { buildScryfallPrecedentQuery } from './PrecedentCardSearch';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';

const QUICK_SUGGESTION_CHIPS = [
  'draw a card',
  'destroy target',
  'counter target',
  'flying',
  '2/3',
  '{2}{W}',
  'exile target',
  'create a 1/1',
];

const COLOR_OPTIONS: { id: string; label: string; bg: string; text: string }[] = [
  { id: 'ALL', label: 'All', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
  { id: 'W', label: 'W', bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-800 dark:text-amber-200' },
  { id: 'U', label: 'U', bg: 'bg-sky-50 dark:bg-sky-950/50', text: 'text-sky-800 dark:text-sky-200' },
  { id: 'B', label: 'B', bg: 'bg-violet-50 dark:bg-violet-950/50', text: 'text-violet-800 dark:text-violet-200' },
  { id: 'R', label: 'R', bg: 'bg-rose-50 dark:bg-rose-950/50', text: 'text-rose-800 dark:text-rose-200' },
  { id: 'G', label: 'G', bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-800 dark:text-emerald-200' },
  { id: 'C', label: 'C', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
  { id: 'M', label: 'Multi', bg: 'bg-amber-100/60 dark:bg-amber-900/40', text: 'text-amber-900 dark:text-amber-300' },
];

const RARITY_OPTIONS = ['ALL', 'common', 'uncommon', 'rare', 'mythic'];

const TYPE_OPTIONS = ['ALL', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker'];

interface PrecedentSwapSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCard: Card;
  currentMatches: SimilarCardMatch[];
  initialSlotIndex?: number;
  onConfirmSlotReplacement: (slotIndex: number, chosenCard: Card) => void;
  onRevertSlot?: (slotIndex: number) => void;
}

export const PrecedentSwapSearchModal: React.FC<PrecedentSwapSearchModalProps> = ({
  isOpen,
  onClose,
  targetCard,
  currentMatches,
  initialSlotIndex = 0,
  onConfirmSlotReplacement,
  onRevertSlot,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [query, setQuery] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'similarity' | 'name' | 'cmc-asc' | 'cmc-desc'>('similarity');

  const [results, setResults] = useState<Card[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showTargetDetails, setShowTargetDetails] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync initial slot index
  useEffect(() => {
    if (typeof initialSlotIndex === 'number' && initialSlotIndex >= 0 && initialSlotIndex < 4) {
      setSelectedSlot(initialSlotIndex);
    } else {
      setSelectedSlot(0);
    }
  }, [initialSlotIndex, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // The card currently in the active slot
  const currentSlotMatch = currentMatches[selectedSlot] || null;
  const currentSlotCard = currentSlotMatch?.card || null;

  // Build extended search query combining text and visual filter pills
  const fullSearchQuery = useMemo(() => {
    const parts: string[] = [];
    if (query.trim()) {
      parts.push(query.trim());
    }

    if (selectedColor !== 'ALL') {
      if (selectedColor === 'C') {
        parts.push('c:c');
      } else if (selectedColor === 'M') {
        parts.push('c:m');
      } else {
        parts.push(`c:${selectedColor.toLowerCase()}`);
      }
    }

    if (selectedRarity !== 'ALL') {
      parts.push(`r:${selectedRarity.toLowerCase()}`);
    }

    if (selectedType !== 'ALL') {
      parts.push(`t:${selectedType.toLowerCase()}`);
    }

    return parts.join(' ');
  }, [query, selectedColor, selectedRarity, selectedType]);

  // Keep stable reference of target card to avoid spurious re-triggers
  const targetCardRef = useRef(targetCard);
  useEffect(() => {
    targetCardRef.current = targetCard;
  }, [targetCard]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeSearchIdRef = useRef<number>(0);

  // Core search executor with multiple tiers of fallback
  const executeSearch = useCallback(async (searchQuery: string) => {
    const currentSearchId = ++activeSearchIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentTarget = targetCardRef.current;
    const trimmed = searchQuery.trim();
    let effectiveQuery = trimmed;

    if (!trimmed) {
      // Default: fetch candidates matching target card color and type from premier sets
      const targetColors = currentTarget.colors?.length ? currentTarget.colors.join('') : '';
      const mainType = currentTarget.type_line?.split('—')[0]?.trim() || '';
      const firstType = mainType.split(' ').pop() || '';
      const colorClause = targetColors ? `c<=${targetColors.toLowerCase()}` : '';
      const typeClause = firstType ? `t:${firstType.toLowerCase()}` : '';
      effectiveQuery = `${colorClause} ${typeClause}`.trim() || 'r:uncommon';
    }

    setLoading(true);

    try {
      const scryfallQuery = buildScryfallPrecedentQuery(effectiveQuery, currentTarget.set);
      const url = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(scryfallQuery)}&order=released&dir=desc`;

      let res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      // Fallback 1: If primary query was non-ok, attempt relaxed booster query
      if (!res.ok && trimmed) {
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

      // Fallback 2: If multiple words and still failed, try plain oracle word search
      if (!res.ok && trimmed && trimmed.includes(' ')) {
        const excludeSet = currentTarget.set ? ` -s:${currentTarget.set.toLowerCase()}` : '';
        const words = trimmed.split(/\s+/).filter((w) => w.length > 2 && !w.includes(':')).slice(0, 3);
        if (words.length > 0) {
          const wordsQuery = words.map((w) => `o:"${w}"`).join(' ');
          const secondFallbackUrl = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(`${wordsQuery} (is:booster or not:funny) -layout:art_series -t:token${excludeSet}`)}&order=released&dir=desc`;
          res = await fetch(secondFallbackUrl, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          });
        }
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
            .filter(
              (c: Card) =>
                c.name.toLowerCase() !== currentTarget.name.toLowerCase() &&
                (!currentTarget.set || !c.set || c.set.toLowerCase() !== currentTarget.set.toLowerCase())
            );

          // Deduplicate unique card names, prioritizing 17Lands-supported sets
          const deduped: Card[] = [];
          const seenNames = new Set<string>();

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

          for (const c of normalized) {
            const nameLower = c.name.toLowerCase();
            if (!seenNames.has(nameLower)) {
              seenNames.add(nameLower);
              deduped.push(c);
            }
          }

          setResults(deduped.slice(0, 36));
        } else {
          setResults([]);
        }
      } else {
        setResults([]);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Precedent search error:', err);
        if (currentSearchId === activeSearchIdRef.current) {
          setResults([]);
        }
      }
    } finally {
      if (currentSearchId === activeSearchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced search trigger whenever query or filters change
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(fullSearchQuery);
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fullSearchQuery, targetCard?.id, targetCard?.name, targetCard?.set, isOpen, executeSearch]);

  // Compute similarity and sort candidate results
  const evaluatedResults = useMemo(() => {
    const list = results.map((card) => {
      const sim = calculateCardSimilarity(targetCard, card);
      const is17LSupported = POPULAR_LIMITED_SETS.some(
        (s) => s.code.toUpperCase() === card.set.toUpperCase() && s.has_17lands_data !== false
      );
      return {
        card,
        similarityScore: sim.score,
        reasons: sim.reasons,
        is17LSupported,
      };
    });

    if (sortBy === 'similarity') {
      list.sort((a, b) => b.similarityScore - a.similarityScore);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.card.name.localeCompare(b.card.name));
    } else if (sortBy === 'cmc-asc') {
      list.sort((a, b) => (a.card.cmc ?? 0) - (b.card.cmc ?? 0));
    } else if (sortBy === 'cmc-desc') {
      list.sort((a, b) => (b.card.cmc ?? 0) - (a.card.cmc ?? 0));
    }

    return list;
  }, [results, targetCard, sortBy]);

  if (!isOpen) return null;

  const handleSelectCard = (candidateCard: Card) => {
    onConfirmSlotReplacement(selectedSlot, candidateCard);
    onClose();
  };

  const handleChipClick = (chip: string) => {
    setQuery(chip);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    executeSearch(chip);
    inputRef.current?.focus();
  };

  const handleClearSearch = () => {
    setQuery('');
    setSelectedColor('ALL');
    setSelectedRarity('ALL');
    setSelectedType('ALL');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    executeSearch('');
    inputRef.current?.focus();
  };

  const isFiltersActive =
    Boolean(query.trim()) ||
    selectedColor !== 'ALL' ||
    selectedRarity !== 'ALL' ||
    selectedType !== 'ALL';

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[96vw] max-w-[1550px] h-[92vh] max-h-[92vh] bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/90 dark:bg-[#050818]/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-700 dark:text-cyan-400 shrink-0">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
                  Substitute Precedent Card
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-cyan-300 font-bold border border-violet-200 dark:border-violet-800/60">
                  Target: {targetCard.name} ({targetCard.set.toUpperCase()})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                View the card being swapped on the left, search and visualize candidate cards on the right
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 2-Column Split Layout */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* ========================================================= */}
          {/* LEFT COLUMN: Card Being Swapped (Width ~360px)            */}
          {/* ========================================================= */}
          <div className="w-full md:w-[360px] lg:w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#070b1e]/60 flex flex-col overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
            {/* Slot Selector Tabs */}
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Select Slot to Replace:
                </span>
                <span className="text-[10px] font-mono font-bold text-violet-600 dark:text-cyan-400">
                  Slot {selectedSlot + 1} of 4
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-200/70 dark:bg-[#050818] rounded-2xl border border-slate-200 dark:border-slate-800">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const isCur = selectedSlot === slotIdx;
                  const match = currentMatches[slotIdx];
                  const hasCustom = match?.isCustomOverride;

                  return (
                    <button
                      key={slotIdx}
                      type="button"
                      onClick={() => setSelectedSlot(slotIdx)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                        isCur
                          ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-500/40'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span>Slot {slotIdx + 1}</span>
                      {hasCustom && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isCur ? 'bg-amber-300' : 'bg-amber-500'
                          }`}
                          title="Custom comp override"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Slot Card Details Box */}
            <div className="p-4 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex-1 flex flex-col justify-between">
              {currentSlotCard ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Card Being Replaced</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {currentSlotMatch?.tierGrade && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-900/90 dark:bg-slate-800 text-white font-mono font-black text-xs border border-slate-700 shadow-xs">
                          Tier {currentSlotMatch.tierGrade}
                        </span>
                      )}
                      {currentSlotMatch?.isCustomOverride && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 font-bold">
                          Custom Comp
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Artwork (Rendered with CardObfuscator size="lg" to match Target Card on previous screen) */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative inline-flex flex-col items-center">
                      <CardObfuscator
                        card={currentSlotCard}
                        obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                        size="lg"
                        showSublabel={false}
                      />
                    </div>
                  </div>

                  {/* Title & Mana */}
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate font-heading" title={currentSlotCard.name}>
                        {currentSlotCard.name}
                      </h4>
                      {currentSlotCard.mana_cost && (
                        <div className="scale-90 origin-right shrink-0">
                          <ManaCostRenderer manaCost={currentSlotCard.mana_cost} size="sm" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex-wrap pt-1">
                      <div className="flex items-center gap-1">
                        <SetSymbol setCode={currentSlotCard.set} size="xs" />
                        <span className="font-bold uppercase text-violet-700 dark:text-cyan-400">
                          {currentSlotCard.set}
                        </span>
                      </div>
                      <span>•</span>
                      <span className="capitalize">{currentSlotCard.rarity}</span>
                      {currentSlotCard.power !== undefined && currentSlotCard.toughness !== undefined && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {currentSlotCard.power}/{currentSlotCard.toughness}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate pt-0.5">
                      {currentSlotCard.type_line}
                    </div>
                  </div>

                  {/* 17Lands Telemetry & Similarity */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200/80 dark:border-slate-800 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Precedent Match</span>
                      <span className="font-bold text-violet-700 dark:text-cyan-400">
                        {currentSlotMatch?.similarityScore}% Match
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">17Lands GIH WR</span>
                      {currentSlotMatch?.winRate !== undefined ? (
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          {(currentSlotMatch.winRate * 100).toFixed(1)}% WR
                        </span>
                      ) : (
                        <span className="text-slate-400">17L Pending</span>
                      )}
                    </div>
                  </div>

                  {/* Oracle Rules Text */}
                  {currentSlotCard.oracle_text && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        Oracle Rules Text:
                      </span>
                      <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#050818]/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px] font-sans text-slate-700 dark:text-slate-300 leading-snug max-h-24 overflow-y-auto custom-scrollbar">
                        {currentSlotCard.oracle_text}
                      </div>
                    </div>
                  )}

                  {/* Revert Button if Custom Override */}
                  {currentSlotMatch?.isCustomOverride && onRevertSlot && (
                    <button
                      type="button"
                      onClick={() => onRevertSlot(selectedSlot)}
                      className="w-full py-1.5 px-3 rounded-xl text-xs font-mono font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Revert Slot to Original</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs font-mono text-slate-400 flex flex-col items-center justify-center gap-2">
                  <span>Slot {selectedSlot + 1} is currently empty</span>
                </div>
              )}

              {/* Target Card Reference Collapsible */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTargetDetails((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs font-mono font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
                    <span>Target Card: {targetCard.name}</span>
                  </span>
                  {showTargetDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showTargetDetails && (
                  <div className="mt-2 p-2.5 rounded-2xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/60 text-xs space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{targetCard.name}</span>
                      {targetCard.mana_cost && <ManaCostRenderer manaCost={targetCard.mana_cost} size="xs" />}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {targetCard.type_line}
                    </div>
                    {targetCard.oracle_text && (
                      <div className="text-[11px] font-sans text-slate-700 dark:text-slate-300 leading-snug p-2 rounded-xl bg-white/70 dark:bg-[#050818]/60 border border-violet-100 dark:border-violet-900/40">
                        {targetCard.oracle_text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: Robust Search & Visual Card Grid            */}
          {/* ========================================================= */}
          <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-[#090e24] overflow-hidden">
            {/* Search Toolbar (Main Screen Style) */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0 bg-slate-50/50 dark:bg-[#060a1d]/50">
              {/* Row 1: Search Input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 group">
                  <button
                    type="button"
                    onClick={() => {
                      if (debounceTimerRef.current) {
                        clearTimeout(debounceTimerRef.current);
                      }
                      executeSearch(fullSearchQuery);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-violet-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                    title="Search candidates immediately (Enter)"
                  >
                    <Search className="w-4 h-4" />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (debounceTimerRef.current) {
                          clearTimeout(debounceTimerRef.current);
                        }
                        executeSearch(fullSearchQuery);
                      }
                    }}
                    placeholder="Search by card name, rules text (e.g. 'draw a card'), stats 2/3, or mana {2}{W}..."
                    className="w-full h-10 pl-10 pr-9 bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 shadow-xs transition-all"
                  />

                  {/* Clear / Spinner icon */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {loading ? (
                      <Loader2 className="w-4 h-4 text-violet-600 dark:text-cyan-400 animate-spin" />
                    ) : query ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          if (debounceTimerRef.current) {
                            clearTimeout(debounceTimerRef.current);
                          }
                          executeSearch('');
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Clear search input"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {isFiltersActive && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="h-10 px-3 rounded-2xl text-xs font-mono font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Reset all filters and search text"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Row 2: Visual Filter Pills Toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Color Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
                    Color:
                  </span>
                  {COLOR_OPTIONS.map((c) => {
                    const isSelected = selectedColor === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedColor(c.id)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-violet-600 text-white border-violet-500 shadow-2xs ring-1 ring-violet-400'
                            : `${c.bg} ${c.text} border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600`
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                {/* Rarity & Type Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Rarity select */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
                      Rarity:
                    </span>
                    <select
                      value={selectedRarity}
                      onChange={(e) => setSelectedRarity(e.target.value)}
                      className="h-7 px-2 bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 cursor-pointer capitalize"
                    >
                      {RARITY_OPTIONS.map((r) => (
                        <option key={r} value={r} className="capitalize">
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Type select */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
                      Type:
                    </span>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="h-7 px-2 bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 cursor-pointer"
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort By */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
                      Sort:
                    </span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="h-7 px-2 bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="similarity">Similarity % (High → Low)</option>
                      <option value="name">Card Name (A → Z)</option>
                      <option value="cmc-asc">Mana Value (Low → High)</option>
                      <option value="cmc-desc">Mana Value (High → Low)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 3: Quick suggestion chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-500 dark:text-cyan-400" />
                  <span>Tips:</span>
                </span>
                {QUICK_SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-white dark:bg-[#050818] hover:bg-violet-50 dark:hover:bg-violet-950/40 text-slate-600 dark:text-slate-300 hover:text-violet-700 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-800 hover:border-violet-300 transition-colors cursor-pointer shadow-2xs"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Counter Bar */}
            <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50/30 dark:bg-[#050818]/30 shrink-0">
              <div className="flex items-center gap-2">
                <span>
                  Found <span className="font-bold text-slate-800 dark:text-slate-200">{evaluatedResults.length}</span> candidates
                </span>
                {!query.trim() && (
                  <span className="text-[11px] text-violet-600 dark:text-cyan-400 italic">
                    (Showing initial recommendations for {targetCard.name})
                  </span>
                )}
              </div>

              <div className="text-[11px]">
                Click <span className="font-bold text-violet-700 dark:text-cyan-400">"Swap into Slot {selectedSlot + 1}"</span> to substitute
              </div>
            </div>

            {/* Visual Card Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-3xl bg-slate-50 dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 animate-pulse space-y-3"
                    >
                      <div className="w-full aspect-[63/88] max-h-[350px] bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2" />
                      <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : evaluatedResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {evaluatedResults.map(({ card, similarityScore, reasons }) => {
                    const imageUri =
                      card.image_uris?.png ||
                      card.image_uris?.normal ||
                      card.image_uris?.large ||
                      card.image_uris?.small ||
                      (card.card_faces && (card.card_faces[0]?.image_uris?.png || card.card_faces[0]?.image_uris?.normal)) ||
                      (card.card_faces && card.card_faces[0]?.image_uris?.small);

                    return (
                      <div
                        key={`${card.set}_${card.id}`}
                        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b1e] hover:border-violet-400 dark:hover:border-cyan-400/60 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 group gap-3"
                      >
                        <div className="space-y-3">
                          {/* Top Header: Set & Similarity Score (Moved off the card image) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-mono">
                              <SetSymbol setCode={card.set} size="sm" />
                              <span className="font-bold uppercase text-slate-600 dark:text-slate-300">
                                {card.set}
                              </span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 font-mono font-bold text-xs border border-cyan-300 dark:border-cyan-800/80 shadow-xs">
                              {similarityScore}% Match
                            </span>
                          </div>

                          {/* Card Thumbnail Artwork (Enlarged & clean, no overlay badges) */}
                          <div className="w-full aspect-[63/88] max-h-[350px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#050818] shadow-xs relative shrink-0 flex items-center justify-center">
                            <CardImage
                              card={card}
                              src={imageUri}
                              alt={card.name}
                              className="w-full h-full"
                              imageClassName="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                          </div>

                          {/* Card Title & Mana */}
                          <div>
                            <div className="flex items-center justify-between gap-1.5">
                              <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate font-heading" title={card.name}>
                                {card.name}
                              </h5>
                              {card.mana_cost && (
                                <div className="scale-90 origin-right shrink-0">
                                  <ManaCostRenderer manaCost={card.mana_cost} size="sm" />
                                </div>
                              )}
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex-wrap pt-1">
                              <span className="capitalize font-medium">{card.rarity}</span>
                              {card.power !== undefined && card.toughness !== undefined && (
                                <>
                                  <span>•</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {card.power}/{card.toughness}
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <span className="truncate">{card.type_line}</span>
                            </div>
                          </div>

                          {/* Rules / Oracle Text Box */}
                          {card.oracle_text ? (
                            <div
                              className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#050818]/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px] font-sans text-slate-700 dark:text-slate-300 leading-snug line-clamp-3 min-h-[58px]"
                              title={card.oracle_text}
                            >
                              {card.oracle_text}
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#050818]/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px] font-sans text-slate-400 italic min-h-[58px] flex items-center justify-center">
                              (No rules text)
                            </div>
                          )}

                          {/* Match Reasons Tags */}
                          {reasons.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {reasons.slice(0, 2).map((r, ri) => (
                                <span
                                  key={ri}
                                  className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-cyan-300 border border-violet-200/60 dark:border-violet-800/40 truncate max-w-full"
                                  title={r}
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Substitution Action Button */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleSelectCard(card)}
                            className="w-full py-2 px-3 rounded-xl text-xs font-mono font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <span>Swap into Slot {selectedSlot + 1}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {query.trim() ? `No precedent cards found for "${query.trim()}"` : 'No precedent cards found'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Try searching with fewer terms, or search by rules text phrase (e.g. <span className="font-bold text-violet-600 dark:text-cyan-400">"draw a card"</span>), creature stats (e.g. <span className="font-bold text-violet-600 dark:text-cyan-400">"2/3"</span>), or mana (e.g. <span className="font-bold text-violet-600 dark:text-cyan-400">"2W"</span>).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-violet-800 cursor-pointer"
                  >
                    Reset Search & Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/90 dark:bg-[#050818]/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>Target Card:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {targetCard.name}
            </span>
            <span>• Active Slot:</span>
            <span className="font-bold text-violet-700 dark:text-cyan-300">
              Slot {selectedSlot + 1} ({currentSlotCard?.name || 'Empty'})
            </span>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Click any card's "Swap into Slot {selectedSlot + 1}" button to replace
          </div>
        </div>
      </div>
    </div>
  );
};
