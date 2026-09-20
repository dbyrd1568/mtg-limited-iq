import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, GradeTier } from '../../types/mtg';
import { findSimilarCards, CardSimilarityResult, SimilarCardMatch, buildCustomPrecedentMatch, generateGuaranteedFallbackResult, getCachedSimilarCards } from '../../services/cardSimilarity';
import { GRADE_TIERS, GRADE_SCORES, scoreToGradeTier, winRateToGradeTier, gradeTierToIndex, get17LandsCardUrl, getOrEstimate17LandsCardRating } from '../../services/seventeenLands';
import { getTargetCardOverrides, savePrecedentOverride, removePrecedentOverride, clearTargetCardOverrides, PrecedentSlotOverride } from '../../services/precedentOverrides';
import { PrecedentSwapSearchModal } from './PrecedentSwapSearchModal';
import { CardObfuscator } from '../CardObfuscator';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { CardImage } from '../UI/CardImage';
import { X, Scale, Check, PlayingCardsFan, Loader2, ExternalLink, GitCompare, ChevronLeft, ChevronRight, RotateCcw, ArrowLeftRight, ArrowRight, Sparkles, Search } from 'lucide-react';
import { useContextualTour } from '../../context/ContextualTourContext';

export interface CardPerformanceMetrics {
  winRate?: number;
  alsa?: number;
  tierGrade?: GradeTier;
  iwd?: number;
}

export interface SimilarCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCard: Card | null;
  currentGrade?: GradeTier;
  target17LandsData?: CardPerformanceMetrics;
  onAdoptGrade?: (card: Card, grade: GradeTier) => void;
  allCards?: Card[];
  onSelectTargetCard?: (card: Card) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const SimilarCardsModal: React.FC<SimilarCardsModalProps> = ({
  isOpen,
  onClose,
  targetCard,
  currentGrade,
  target17LandsData,
  onAdoptGrade,
  allCards,
  onSelectTargetCard,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
}) => {
  const targetCardKey = targetCard ? `${(targetCard.set || '').toUpperCase()}_${targetCard.name.toUpperCase()}` : '';

  const [data, setData] = useState<CardSimilarityResult | null>(() => {
    return targetCard ? getCachedSimilarCards(targetCard) : null;
  });
  const [loadedCardKey, setLoadedCardKey] = useState<string | null>(() => {
    const cached = targetCard ? getCachedSimilarCards(targetCard) : null;
    return cached && targetCard ? `${(targetCard.set || '').toUpperCase()}_${targetCard.name.toUpperCase()}` : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = targetCard ? getCachedSimilarCards(targetCard) : null;
    return !cached;
  });
  const [adoptedSourceId, setAdoptedSourceId] = useState<string | null>(null);
  const [inspectCardMatch, setInspectCardMatch] = useState<SimilarCardMatch | null>(null);

  // Keep a stable ref of allCards so effect does not re-trigger on parent array mutations
  const allCardsRef = useRef(allCards);
  useEffect(() => {
    allCardsRef.current = allCards;
  }, [allCards]);

  // Synchronous cache lookup for current targetCard
  const cachedForCurrent = useMemo(() => {
    return targetCard ? getCachedSimilarCards(targetCard) : null;
  }, [targetCardKey]);

  // Current active data: state data if matching target card, or immediate synchronous cache hit
  const activeData = useMemo(() => {
    if (targetCardKey && loadedCardKey === targetCardKey && data && data.matches && data.matches.length > 0) {
      return data;
    }
    if (cachedForCurrent && cachedForCurrent.matches && cachedForCurrent.matches.length > 0) {
      return cachedForCurrent;
    }
    return null;
  }, [targetCardKey, loadedCardKey, data, cachedForCurrent]);

  const isEffectiveLoading = (loadedCardKey !== targetCardKey && !cachedForCurrent) || (loading && !cachedForCurrent);

  const isReady = Boolean(
    targetCardKey &&
    activeData &&
    activeData.matches &&
    activeData.matches.length > 0 &&
    !isEffectiveLoading
  );

  // User-customized precedent overrides state
  const [customOverrides, setCustomOverrides] = useState<Record<number, PrecedentSlotOverride>>({});
  const [isReplacingSlot, setIsReplacingSlot] = useState<boolean>(false);
  const [swapSearchSlotIndex, setSwapSearchSlotIndex] = useState<number | null>(null);
  const [learningNotice, setLearningNotice] = useState<string | null>(null);

  const { registerTrigger } = useContextualTour();

  useEffect(() => {
    if (isOpen) {
      registerTrigger('replace_comp');
    }
  }, [isOpen, registerTrigger]);

  // Guarantee target card 17lands data is resolved even if caller didn't pass it
  const effectiveTarget17L = useMemo<CardPerformanceMetrics | undefined>(() => {
    if (target17LandsData && typeof target17LandsData.winRate === 'number') {
      return target17LandsData;
    }
    if (targetCard) {
      const r = getOrEstimate17LandsCardRating(targetCard);
      if (r && typeof r.win_rate === 'number') {
        return {
          winRate: r.win_rate,
          alsa: r.avg_seen,
          tierGrade: (r.tier_grade as GradeTier) || winRateToGradeTier(r.win_rate),
          iwd: r.iwd,
        };
      }
    }
    return undefined;
  }, [targetCard, target17LandsData]);

  // Compute rich 17lands telemetry for the inspected comparable card
  const precedent17L = useMemo(() => {
    if (!inspectCardMatch) return null;
    const r = getOrEstimate17LandsCardRating(inspectCardMatch.card);
    const winRate = inspectCardMatch.winRate ?? r?.win_rate;
    const alsa = inspectCardMatch.alsa ?? r?.avg_seen;
    const tierGrade = (inspectCardMatch.tierGrade || (r?.tier_grade as GradeTier) || (typeof winRate === 'number' ? winRateToGradeTier(winRate) : 'C')) as GradeTier;
    const iwd = r?.iwd;
    return { winRate, alsa, tierGrade, iwd };
  }, [inspectCardMatch]);

  const precedentTier: GradeTier = precedent17L?.tierGrade || 'C';

  // Card sequence navigation calculation with robust fallback
  const currentCardIndex = useMemo(() => {
    if (!targetCard || !allCards || allCards.length === 0) return -1;
    
    // 1. Direct ID match
    let idx = allCards.findIndex((c) => c.id && targetCard.id && c.id === targetCard.id);
    if (idx !== -1) return idx;

    // 2. Normalized name and normalized set match (case-insensitive)
    const targetNormName = (targetCard.name || '').trim().toLowerCase();
    const targetNormSet = (targetCard.set || '').trim().toLowerCase();
    idx = allCards.findIndex((c) => {
      const cNormName = (c.name || '').trim().toLowerCase();
      const cNormSet = (c.set || '').trim().toLowerCase();
      const nameMatch = cNormName === targetNormName;
      const setMatch = !targetNormSet || !cNormSet || cNormSet === targetNormSet;
      return nameMatch && setMatch;
    });
    if (idx !== -1) return idx;

    // 3. Collector number match within set
    const targetNum = targetCard.collector_number?.replace(/^0+/, '') || targetCard.collector_number;
    if (targetNum) {
      idx = allCards.findIndex((c) => {
        const cNum = c.collector_number?.replace(/^0+/, '') || c.collector_number;
        const cNormSet = (c.set || '').trim().toLowerCase();
        const setMatch = !targetNormSet || !cNormSet || cNormSet === targetNormSet;
        return cNum === targetNum && setMatch;
      });
      if (idx !== -1) return idx;
    }

    // 4. Fallback: match by name only
    idx = allCards.findIndex((c) => (c.name || '').trim().toLowerCase() === targetNormName);
    if (idx !== -1) return idx;

    return -1;
  }, [targetCard, allCards]);

  // If card wasn't found at an exact index, resolve closest by collector number or start at 0
  const resolvedCardIndex = useMemo(() => {
    if (currentCardIndex >= 0) return currentCardIndex;
    if (!allCards || allCards.length === 0) return -1;
    if (targetCard?.collector_number) {
      const targetNum = parseInt(targetCard.collector_number, 10);
      if (!isNaN(targetNum)) {
        const sortedWithDiff = allCards.map((c, i) => {
          const cNum = parseInt(c.collector_number || '0', 10);
          return { index: i, diff: Math.abs(cNum - targetNum) };
        }).sort((a, b) => a.diff - b.diff);
        if (sortedWithDiff.length > 0) return sortedWithDiff[0].index;
      }
    }
    return 0;
  }, [currentCardIndex, allCards, targetCard]);

  const canNavigatePrev = typeof hasPrev === 'boolean'
    ? hasPrev
    : Boolean(onNavigatePrev || (onSelectTargetCard && allCards && allCards.length > 1 && resolvedCardIndex > 0));

  const canNavigateNext = typeof hasNext === 'boolean'
    ? hasNext
    : Boolean(onNavigateNext || (onSelectTargetCard && allCards && allCards.length > 1 && resolvedCardIndex >= 0 && resolvedCardIndex < allCards.length - 1));

  const showNavigationControls = Boolean(
    onSelectTargetCard || onNavigateNext || onNavigatePrev || (allCards && allCards.length > 0)
  );

  const handlePrevCard = useCallback(() => {
    if (onNavigatePrev) {
      onNavigatePrev();
    } else if (onSelectTargetCard && allCards && allCards.length > 0) {
      const targetIdx = resolvedCardIndex > 0 ? resolvedCardIndex - 1 : 0;
      if (allCards[targetIdx]) {
        onSelectTargetCard(allCards[targetIdx]);
      }
    }
  }, [onNavigatePrev, onSelectTargetCard, allCards, resolvedCardIndex]);

  const handleNextCard = useCallback(() => {
    if (onNavigateNext) {
      onNavigateNext();
    } else if (onSelectTargetCard && allCards && allCards.length > 0) {
      const targetIdx = resolvedCardIndex >= 0 && resolvedCardIndex < allCards.length - 1 ? resolvedCardIndex + 1 : resolvedCardIndex;
      if (allCards[targetIdx]) {
        onSelectTargetCard(allCards[targetIdx]);
      }
    }
  }, [onNavigateNext, onSelectTargetCard, allCards, resolvedCardIndex]);

  const cardCounterLabel = useMemo(() => {
    if (allCards && allCards.length > 0 && resolvedCardIndex >= 0) {
      return `${resolvedCardIndex + 1} / ${allCards.length}`;
    }
    return null;
  }, [resolvedCardIndex, allCards]);

  // Fetch comps on open or target change
  useEffect(() => {
    if (!isOpen || !targetCard) {
      setData(null);
      setLoadedCardKey(null);
      setLoading(false);
      setInspectCardMatch(null);
      setAdoptedSourceId(null);
      setCustomOverrides({});
      setSwapSearchSlotIndex(null);
      return;
    }

    const currentKey = `${(targetCard.set || '').toUpperCase()}_${targetCard.name.toUpperCase()}`;

    // If already loaded for this exact card, don't refetch or trigger loading state!
    if (loadedCardKey === currentKey && data && data.matches && data.matches.length > 0) {
      return;
    }

    // Check synchronous cache first
    const cached = getCachedSimilarCards(targetCard);
    if (cached) {
      setData(cached);
      setLoadedCardKey(currentKey);
      setLoading(false);
      setCustomOverrides(getTargetCardOverrides(targetCard));
      return;
    }

    // Otherwise fetch asynchronously
    setCustomOverrides(getTargetCardOverrides(targetCard));
    setSwapSearchSlotIndex(null);
    setData(null);
    setLoadedCardKey(null);
    setLoading(true);
    setInspectCardMatch(null);
    setAdoptedSourceId(null);

    let cancelled = false;

    findSimilarCards(targetCard, allCardsRef.current)
      .then((result) => {
        if (cancelled) return;
        if (result && result.matches && result.matches.length > 0) {
          setData(result);
        } else {
          setData(generateGuaranteedFallbackResult(targetCard, allCardsRef.current));
        }
        setLoadedCardKey(currentKey);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to find similar cards:', err);
        setData(generateGuaranteedFallbackResult(targetCard, allCardsRef.current));
        setLoadedCardKey(currentKey);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, targetCard?.id, targetCard?.name, targetCard?.set, targetCard?.collector_number]);

  // Keyboard navigation (Esc to close, ArrowLeft / ArrowRight to step through cards)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (swapSearchSlotIndex !== null) {
          setSwapSearchSlotIndex(null);
        } else if (inspectCardMatch) {
          setInspectCardMatch(null);
        } else {
          onClose();
        }
        return;
      }

      // Do not navigate cards if typing in an input/textarea or currently inspecting a comp detail submodal
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || inspectCardMatch || swapSearchSlotIndex !== null) return;

      if ((e.key === 'ArrowLeft' || e.key === '[') && canNavigatePrev) {
        e.preventDefault();
        handlePrevCard();
      } else if ((e.key === 'ArrowRight' || e.key === ']') && canNavigateNext) {
        e.preventDefault();
        handleNextCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, inspectCardMatch, swapSearchSlotIndex, onClose, canNavigatePrev, canNavigateNext, handlePrevCard, handleNextCard]);

  if (!isOpen || !targetCard) return null;

  const handleAdopt = (grade: GradeTier, sourceId: string) => {
    if (onAdoptGrade && targetCard) {
      onAdoptGrade(targetCard, grade);
      setAdoptedSourceId(sourceId);
    }
  };


  // Overlay user-customized slot overrides onto algorithmic matches
  const presentedMatches = useMemo(() => {
    const raw = activeData?.matches?.slice(0, 4) || [];
    if (!raw.length) return [];

    const merged = [...raw];
    for (let slot = 0; slot < 4; slot++) {
      if (customOverrides[slot]) {
        merged[slot] = customOverrides[slot].replacementMatch;
      }
    }
    return merged;
  }, [activeData, customOverrides]);

  const hasCustomOverrides = useMemo(() => {
    return Object.keys(customOverrides).length > 0;
  }, [customOverrides]);

  const handleConfirmSlotReplacement = async (slotIndex: number, chosenReplacement: Card) => {
    if (!targetCard || !chosenReplacement) return;

    setIsReplacingSlot(true);
    try {
      const repMatch = await buildCustomPrecedentMatch(targetCard, chosenReplacement);
      const rawMatches = activeData?.matches?.slice(0, 4) || [];
      const origMatch = rawMatches[slotIndex] || null;

      const delta = savePrecedentOverride(targetCard, slotIndex, origMatch, repMatch);
      setCustomOverrides(getTargetCardOverrides(targetCard));
      if (delta && delta.inferredInsights && delta.inferredInsights.length > 0) {
        setLearningNotice(delta.inferredInsights[0]);
      }
    } catch (err) {
      console.error('Failed to substitute precedent card:', err);
    } finally {
      setIsReplacingSlot(false);
      setSwapSearchSlotIndex(null);
    }
  };

  const handleRevertSlot = (slotIndex: number) => {
    if (!targetCard) return;
    removePrecedentOverride(targetCard, slotIndex);
    setCustomOverrides(getTargetCardOverrides(targetCard));
  };

  const handleResetAllSlots = () => {
    if (!targetCard) return;
    clearTargetCardOverrides(targetCard);
    setCustomOverrides({});
  };

  // Compute the average grade strictly from the comparison cards presented on screen
  const presentedGradeStats = useMemo(() => {
    if (!presentedMatches.length) return null;

    const matchesWithGrade = presentedMatches.filter((m) => Boolean(m.tierGrade));
    const matchesWithWr = presentedMatches.filter((m) => typeof m.winRate === 'number');

    if (matchesWithGrade.length === 0 && matchesWithWr.length === 0) return null;

    let averageGrade: GradeTier;
    let avgWinRate: number | undefined;

    // Average the letter grades of the cards shown
    if (matchesWithGrade.length > 0) {
      const sumScore = matchesWithGrade.reduce((acc, m) => acc + (GRADE_SCORES[m.tierGrade!] || 2.7), 0);
      const avgScore = sumScore / matchesWithGrade.length;
      averageGrade = scoreToGradeTier(avgScore);
    } else if (matchesWithWr.length > 0) {
      const sumWr = matchesWithWr.reduce((acc, m) => acc + m.winRate!, 0);
      averageGrade = winRateToGradeTier(sumWr / matchesWithWr.length);
    } else {
      averageGrade = 'C';
    }

    if (matchesWithWr.length > 0) {
      const sumWr = matchesWithWr.reduce((acc, m) => acc + m.winRate!, 0);
      avgWinRate = sumWr / matchesWithWr.length;
    }

    // Compute Median Win Rate
    let medianWinRate: number | undefined;
    if (matchesWithWr.length > 0) {
      const sortedWrs = matchesWithWr.map((m) => m.winRate!).sort((a, b) => a - b);
      const midWr = Math.floor(sortedWrs.length / 2);
      medianWinRate = sortedWrs.length % 2 !== 0
        ? sortedWrs[midWr]
        : (sortedWrs[midWr - 1] + sortedWrs[midWr]) / 2;
    }

    // Compute Median Grade Tier
    let medianGrade: GradeTier;
    if (matchesWithGrade.length > 0) {
      const sortedScores = matchesWithGrade
        .map((m) => GRADE_SCORES[m.tierGrade!] ?? 2.7)
        .sort((a, b) => a - b);
      const mid = Math.floor(sortedScores.length / 2);
      const medianScore = sortedScores.length % 2 !== 0
        ? sortedScores[mid]
        : (sortedScores[mid - 1] + sortedScores[mid]) / 2;
      medianGrade = scoreToGradeTier(medianScore);
    } else if (medianWinRate !== undefined) {
      medianGrade = winRateToGradeTier(medianWinRate);
    } else {
      medianGrade = averageGrade;
    }

    const validTiers = matchesWithGrade.map((m) => m.tierGrade!);
    const minTier = validTiers.length
      ? validTiers.reduce((min, t) => gradeTierToIndex(t) > gradeTierToIndex(min) ? t : min)
      : undefined;
    const maxTier = validTiers.length
      ? validTiers.reduce((max, t) => gradeTierToIndex(t) < gradeTierToIndex(max) ? t : max)
      : undefined;

    return {
      averageGrade,
      avgWinRate,
      medianGrade,
      medianWinRate,
      count: presentedMatches.length,
      minTier,
      maxTier,
    };
  }, [presentedMatches]);


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-[96vw] max-w-[1600px] max-h-[94vh] my-auto flex flex-col bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/80 dark:bg-[#050818]/90">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
              <PlayingCardsFan className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-heading tracking-tight">
                  Historical Comps & Similar Cards
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                  Precedent Engine
                </span>
                <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400">
                  • 17Lands Premier Draft comps
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar">
          {!isReady ? (
            <div className="py-28 px-4 flex flex-col items-center justify-center gap-4 text-center select-none animate-in fade-in duration-150">
              <div className="w-14 h-14 rounded-2xl bg-violet-100/80 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center shadow-xs">
                <Loader2 className="w-7 h-7 text-violet-600 dark:text-cyan-400 animate-spin" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <p className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  Searching Historical Precedents for {targetCard.name}...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Querying premier draft statistics across Magic sets (BLB, OTJ, MKM, LCI, WOE, DMU, and more)
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Compact Precedent Summary Banner */}
              <div className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-emerald-500/10 border border-violet-400/30 dark:border-cyan-400/30 shadow-xs flex items-center justify-between gap-2.5 sm:gap-3 flex-wrap">
                {/* Metrics: Average, Median, Range */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                  {/* Grade Average */}
                  <div className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0">
                      Average:
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono px-2 py-0.5 rounded-lg bg-violet-600 text-white shadow-2xs shrink-0">
                      Tier {presentedGradeStats?.averageGrade || activeData?.consensus.projectedTier || 'C'}
                    </span>
                    {presentedGradeStats?.avgWinRate !== undefined ? (
                      <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
                        {(presentedGradeStats.avgWinRate * 100).toFixed(1)}% WR
                      </span>
                    ) : activeData?.consensus.averageWinRate !== undefined ? (
                      <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
                        {(activeData.consensus.averageWinRate * 100).toFixed(1)}% WR
                      </span>
                    ) : null}
                  </div>

                  <span className="text-slate-300 dark:text-slate-700 font-light hidden sm:inline">|</span>

                  {/* Grade Median */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0">
                      Median:
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono px-2 py-0.5 rounded-lg bg-indigo-600 text-white shadow-2xs shrink-0">
                      Tier {presentedGradeStats?.medianGrade || activeData?.consensus.projectedTier || 'C'}
                    </span>
                    {presentedGradeStats?.medianWinRate !== undefined && (
                      <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
                        {(presentedGradeStats.medianWinRate * 100).toFixed(1)}% WR
                      </span>
                    )}
                  </div>

                  {(presentedGradeStats?.minTier && presentedGradeStats?.maxTier) ? (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 font-light hidden md:inline">|</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                        Range: {presentedGradeStats.minTier === presentedGradeStats.maxTier ? presentedGradeStats.minTier : `${presentedGradeStats.minTier} to ${presentedGradeStats.maxTier}`}
                      </span>
                    </>
                  ) : (activeData?.consensus.tierRangeMin && activeData?.consensus.tierRangeMax) ? (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 font-light hidden md:inline">|</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                        Range: {activeData.consensus.tierRangeMin === activeData.consensus.tierRangeMax ? activeData.consensus.tierRangeMin : `${activeData.consensus.tierRangeMin} to ${activeData.consensus.tierRangeMax}`}
                      </span>
                    </>
                  ) : null}
                </div>

                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden xl:inline">
                  • Based on {presentedMatches.length} comparable cards
                </span>
              </div>

              {/* Engine Learning Notification Banner */}
              {learningNotice && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-600/50 text-emerald-900 dark:text-emerald-200 text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span><strong className="font-bold">✨ Engine Learned:</strong> {learningNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLearningNotice(null)}
                    className="p-1 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 rounded text-emerald-700 dark:text-emerald-300 cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Target Card vs Similar Comps Flex Container */}
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                {/* Target Card Column (Desktop left side, 340px width) */}
                <div className="w-full lg:w-[340px] shrink-0 space-y-4 lg:sticky lg:top-0">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="px-2.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-cyan-300 text-[11px] font-bold font-mono uppercase tracking-wide border border-violet-200 dark:border-violet-800/60">
                      Target Card
                    </span>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                      <SetSymbol setCode={targetCard.set} size="xs" />
                      <span className="font-bold uppercase text-violet-700 dark:text-cyan-300">{targetCard.set}</span>
                      <span>•</span>
                      <span>#{targetCard.collector_number}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex flex-col items-center">
                      <CardObfuscator
                      card={targetCard}
                      obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                      size="lg"
                      showSublabel={false}
                    />
                  </div>

                  {/* Rating Section consistently at bottom of card */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Your Rating
                      </span>
                      {currentGrade && (
                        <span className="text-xs font-bold font-mono text-violet-600 dark:text-cyan-400">
                          Grade: {currentGrade}
                        </span>
                      )}
                    </div>

                    {/* Quick Adopt Grade Average & Median Buttons for Target Card */}
                    {onAdoptGrade && !loading && (presentedGradeStats?.averageGrade || activeData?.consensus?.projectedTier) && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdopt(presentedGradeStats?.averageGrade || activeData!.consensus.projectedTier, 'average')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1 cursor-pointer border shadow-2xs ${
                            adoptedSourceId === 'average'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-violet-600 hover:bg-violet-700 text-white border-violet-500 shadow-2xs'
                          }`}
                          title={`Adopt Average Grade (${presentedGradeStats?.averageGrade || activeData?.consensus?.projectedTier})`}
                        >
                          <Check className={`w-3 h-3 ${adoptedSourceId === 'average' ? 'text-emerald-200' : 'opacity-70'}`} />
                          <span className="truncate">{adoptedSourceId === 'average' ? `Avg (${presentedGradeStats?.averageGrade || activeData?.consensus?.projectedTier})` : `Use Avg (${presentedGradeStats?.averageGrade || activeData?.consensus?.projectedTier})`}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdopt(presentedGradeStats?.medianGrade || activeData!.consensus.projectedTier, 'median')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1 cursor-pointer border shadow-2xs ${
                            adoptedSourceId === 'median'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-900 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-white border-slate-700 dark:border-slate-600 shadow-2xs'
                          }`}
                          title={`Adopt Median Grade (${presentedGradeStats?.medianGrade || activeData?.consensus?.projectedTier})`}
                        >
                          <Check className={`w-3 h-3 ${adoptedSourceId === 'median' ? 'text-emerald-200' : 'opacity-70'}`} />
                          <span className="truncate">{adoptedSourceId === 'median' ? `Med (${presentedGradeStats?.medianGrade || activeData?.consensus?.projectedTier})` : `Use Med (${presentedGradeStats?.medianGrade || activeData?.consensus?.projectedTier})`}</span>
                        </button>
                      </div>
                    )}

                    {/* Quick Grade Tier Buttons Grid */}
                    <div className="grid grid-cols-6 gap-1 pt-0.5">
                      {GRADE_TIERS.map((tier) => {
                        const isSelected = currentGrade === tier;
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => {
                              if (onAdoptGrade) {
                                onAdoptGrade(targetCard, tier);
                                setAdoptedSourceId('manual');
                              }
                            }}
                            className={`py-1 rounded-md text-[11px] font-mono font-bold transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-violet-600 text-white border-violet-500 shadow-xs font-black ring-2 ring-violet-400'
                                : 'bg-white dark:bg-[#070b1e] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            {tier}
                          </button>
                        );
                      })}
                    </div>

                    {/* Next / Prev Card Navigation Controls */}
                    {showNavigationControls && (
                      <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={handlePrevCard}
                            disabled={!canNavigatePrev}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all border shadow-2xs ${
                              canNavigatePrev
                                ? 'bg-white dark:bg-[#0c1236] hover:bg-slate-100 dark:hover:bg-[#141e54] text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-cyan-400 cursor-pointer active:scale-[0.98]'
                                : 'opacity-30 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800'
                            }`}
                            title={canNavigatePrev ? "Previous Card (← Arrow key or [)" : "No previous card"}
                          >
                            <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                            <span>Prev</span>
                          </button>

                          {cardCounterLabel && (
                            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 px-1 whitespace-nowrap" title="Card position in sequence">
                              {cardCounterLabel}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={handleNextCard}
                            disabled={!canNavigateNext}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all border shadow-2xs ${
                              canNavigateNext
                                ? 'bg-white dark:bg-[#0c1236] hover:bg-slate-100 dark:hover:bg-[#141e54] text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-cyan-400 cursor-pointer active:scale-[0.98]'
                                : 'opacity-30 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800'
                            }`}
                            title={canNavigateNext ? "Next Card (→ Arrow key or ])" : "No next card"}
                          >
                            <span>Next</span>
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Similar Cards Matches List (Desktop right side) - 2 Columns of spacious cards */}
                <div className="flex-1 min-w-0 space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold font-mono uppercase tracking-wide border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
                      <span>Comparable Historical Cards ({presentedMatches.length})</span>
                    </span>
                    <div className="flex items-center gap-3">
                      {hasCustomOverrides && (
                        <button
                          type="button"
                          onClick={handleResetAllSlots}
                          className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 cursor-pointer bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60"
                          title="Reset all custom slot replacements back to default"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Comps</span>
                        </button>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">
                        Click any card to inspect
                      </span>
                    </div>
                  </div>

                  {/* Precedent Search & Substitute Action Banner */}
                  <div
                    id="comp-search-bar"
                    onClick={() => setSwapSearchSlotIndex(0)}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-cyan-500/10 border border-violet-300/70 dark:border-cyan-500/40 hover:border-violet-500 dark:hover:border-cyan-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                        <Search className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold font-heading text-slate-900 dark:text-white">
                            Search & Substitute Precedent Card
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-cyan-300 font-bold border border-violet-200 dark:border-violet-800/60">
                            Dedicated Visual Studio
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          Search any card across Magic history with visual card grid and side-by-side slot comparison
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-violet-600 group-hover:bg-violet-700 text-white shadow-xs transition-all flex items-center gap-1.5 shrink-0 pointer-events-none"
                    >
                      <span>Open Search</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {presentedMatches.length === 0 ? (
                    <div className="py-16 px-6 rounded-3xl bg-slate-50/70 dark:bg-[#070b1e]/70 border border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">No comparable cards found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">Use the search bar above to manually select a comparable card.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {presentedMatches.map((match, matchIdx) => {
                      const comp = match.card;
                      const imageUri = comp.image_uris?.normal ||
                        comp.image_uris?.large ||
                        (comp.card_faces && comp.card_faces[0]?.image_uris?.normal) ||
                        'https://cards.scryfall.io/back.jpg';

                      return (
                        <div
                          key={`${comp.set}_${comp.id}`}
                          onClick={() => setInspectCardMatch(match)}
                          className="group p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800/90 shadow-sm hover:border-violet-400 dark:hover:border-cyan-400 transition-all cursor-pointer hover:shadow-md"
                        >
                          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
                            {/* Left Column: Full Card Visual + 17Lands & Use Grade directly in the space below card */}
                            <div className="w-full sm:w-[210px] md:w-[230px] shrink-0 flex flex-col gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectCardMatch(match);
                                }}
                                className="relative w-full h-[293px] sm:h-[321px] rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-[#050818] shadow-md hover:ring-2 hover:ring-violet-400 dark:hover:ring-cyan-400 group-hover:ring-2 group-hover:ring-violet-400 dark:group-hover:ring-cyan-400 transition-all cursor-pointer block text-left"
                                title={`Click to view full card details for ${comp.name}`}
                              >
                                <CardImage
                                  card={comp}
                                  src={imageUri}
                                  alt={comp.name}
                                  className="w-full h-full"
                                  imageClassName="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                                  loading="eager"
                                />
                              </button>

                              {/* 17Lands Draft Performance Record under card */}
                              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 font-mono space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <a
                                    href={get17LandsCardUrl(comp.set, comp)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:underline flex items-center gap-1 group/l17"
                                    title={`Open ${comp.name} (${comp.set.toUpperCase()}) on 17lands.com`}
                                  >
                                    <span>17Lands</span>
                                    <ExternalLink className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 group-hover/l17:translate-x-0.5 transition-transform" />
                                  </a>
                                  <a
                                    href={get17LandsCardUrl(comp.set, comp)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs font-black text-emerald-900 dark:text-emerald-200 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
                                    title={`Open ${comp.name} on 17lands.com`}
                                  >
                                    Tier {match.tierGrade || 'TBD'}
                                  </a>
                                </div>

                                {(match.winRate !== undefined || match.alsa !== undefined) && (
                                  <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                                    {match.winRate !== undefined && (
                                      <div>
                                        <span className="text-slate-500 dark:text-slate-400 block text-[9px] uppercase">GIH WR</span>
                                        <span className="text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                                          {(match.winRate * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    )}
                                    {match.alsa !== undefined && (
                                      <div className="text-right">
                                        <span className="text-slate-400 dark:text-slate-500 block text-[9px] uppercase">ALSA</span>
                                        <span className="text-slate-700 dark:text-slate-200 font-semibold text-xs">
                                          {match.alsa.toFixed(1)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Use Grade button directly below card */}
                              {onAdoptGrade && match.tierGrade && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAdopt(match.tierGrade!, match.card.id);
                                  }}
                                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer border shadow-2xs ${
                                    adoptedSourceId === match.card.id
                                      ? 'bg-emerald-600 text-white border-emerald-500'
                                      : 'bg-slate-900 dark:bg-slate-800 hover:bg-violet-700 dark:hover:bg-violet-600 text-white border-slate-700 hover:border-violet-400'
                                  }`}
                                  title={`Adopt grade ${match.tierGrade} for target card`}
                                >
                                  <Check className={`w-3.5 h-3.5 ${adoptedSourceId === match.card.id ? 'text-emerald-200' : 'opacity-60'}`} />
                                  <span>{adoptedSourceId === match.card.id ? `Used Grade (${match.tierGrade})` : `Use Grade (${match.tierGrade})`}</span>
                                </button>
                              )}
                            </div>

                            {/* Right Column: Title, Badges, and Wide Roomy Oracle Text Box */}
                            <div className="flex-1 min-w-0 space-y-3.5 w-full">
                              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors" title={comp.name}>
                                      {comp.name}
                                    </h5>
                                    {match.isCustomOverride && (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-mono text-[10px] font-bold border border-amber-300/60 dark:border-amber-700/60">
                                        Custom Comp
                                      </span>
                                    )}
                                    {match.matchReasons.some(r => r.toLowerCase().startsWith('learned')) && (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono text-[10px] font-bold border border-emerald-300/60 dark:border-emerald-700/60 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        Learned Comp
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 pt-0.5 flex-wrap">
                                    <SetSymbol setCode={comp.set} size="xs" />
                                    <span className="font-bold uppercase text-violet-700 dark:text-cyan-300">{comp.set}</span>
                                    <span>•</span>
                                    <span className="capitalize">{comp.rarity}</span>
                                    {comp.type_line && (
                                      <>
                                        <span>•</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{comp.type_line}</span>
                                      </>
                                    )}
                                    {match.originalCardName && (
                                      <>
                                        <span>•</span>
                                        <span className="text-amber-700 dark:text-amber-400 italic">Replaced {match.originalCardName}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Quick Swap/Replace button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSwapSearchSlotIndex(matchIdx);
                                    }}
                                    className="px-2.5 py-1 rounded-xl text-slate-600 dark:text-slate-300 hover:text-violet-700 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold shadow-2xs"
                                    title={`Replace ${comp.name} in slot ${matchIdx + 1}`}
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
                                    <span>Swap</span>
                                  </button>

                                  {/* Revert button if this is a custom override */}
                                  {match.isCustomOverride && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRevertSlot(matchIdx);
                                      }}
                                      className="px-2.5 py-1 rounded-xl text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-amber-300/80 dark:border-amber-700/60 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold shadow-2xs"
                                      title="Revert slot back to original suggested card"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                      <span>Revert</span>
                                    </button>
                                  )}

                                  {comp.mana_cost && <ManaCostRenderer manaCost={comp.mana_cost} size="md" />}
                                </div>
                              </div>

                              {/* Match percentage & reasons */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-300 font-mono text-xs font-bold border border-cyan-200 dark:border-cyan-500/40">
                                  {match.similarityScore === 100 ? '100% (Reprint)' : `${match.similarityScore}% Match`}
                                </span>
                                {match.matchReasons.map((r, i) => {
                                  const isLearnedReason = r.toLowerCase().startsWith('learned');
                                  return (
                                    <span
                                      key={i}
                                      className={`px-2.5 py-0.5 rounded-full font-mono text-xs border ${
                                        isLearnedReason
                                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-700/80 font-semibold'
                                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                                      }`}
                                    >
                                      {r}
                                    </span>
                                  );
                                })}
                              </div>

                              {/* Wide, Roomy Oracle Rules Text Box: No narrow column, completely readable */}
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                                  Oracle Rules Text
                                </span>
                                <div className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50 dark:bg-[#050818] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 whitespace-pre-line shadow-2xs">
                                  {comp.oracle_text || 'No oracle rules text.'}
                                </div>
                              </div>

                              {/* Space Under Oracle Text: Precedent Analysis & Action Strip */}
                              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                {/* Comparison Specs & Insights Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200/60 dark:border-slate-800/60">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Curve & Stats</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {comp.cmc} CMC {comp.power !== undefined ? `• ${comp.power}/${comp.toughness}` : `• ${comp.type_line.split('—')[0].trim()}`}
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200/60 dark:border-slate-800/60">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Format Origin</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                      <SetSymbol setCode={comp.set} size="xs" />
                                      <span className="uppercase text-violet-600 dark:text-cyan-400 font-bold">{comp.set}</span>
                                      <span className="text-slate-400 capitalize">({comp.rarity})</span>
                                    </span>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200/60 dark:border-slate-800/60 col-span-2 sm:col-span-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Draft Velocity</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {match.alsa !== undefined ? `Pick ~${match.alsa.toFixed(1)} ALSA` : 'Pending'}
                                    </span>
                                  </div>
                                </div>

                                {/* Action Strip & External Links */}
                                <div className="flex items-center justify-between gap-3 pt-1 flex-wrap text-xs">
                                  <button
                                    type="button"
                                    onClick={() => setInspectCardMatch(match)}
                                    className="px-3.5 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-violet-700 dark:text-cyan-300 font-mono font-bold text-xs flex items-center gap-1.5 transition-all border border-violet-200 dark:border-violet-800/60 cursor-pointer shadow-2xs hover:scale-[1.02]"
                                  >
                                    <GitCompare className="w-3.5 h-3.5" />
                                    <span>Compare Head-to-Head</span>
                                  </button>

                                  <div className="flex items-center gap-3 font-mono text-xs ml-auto">
                                    <a
                                      href={comp.scryfall_uri || `https://scryfall.com/search?q=%21%22${encodeURIComponent(comp.name)}%22`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 text-violet-600 dark:text-cyan-400 hover:underline font-semibold"
                                    >
                                      <span>Scryfall</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-[#050818]/90 font-mono text-[11px] text-center sm:text-left">
          Searches Premier Draft Precedents across modern sets
        </div>
      </div>

      {/* Nested Card Detail Inspector Modal on Comp Click */}
      {inspectCardMatch && targetCard && (
        <div 
          onClick={() => setInspectCardMatch(null)}
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[96vw] max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#060a1d]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center text-violet-600 dark:text-cyan-400 shrink-0">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading truncate">
                      {targetCard.name} vs. {inspectCardMatch.card.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 shrink-0">
                      {inspectCardMatch.similarityScore === 100 ? '100% (Reprint)' : `${inspectCardMatch.similarityScore}% Match`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    <span>Head-to-head comparison</span>
                    <span>•</span>
                    <span className="text-violet-700 dark:text-cyan-300 font-bold uppercase">{targetCard.set}</span>
                    <span>vs</span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold uppercase">{inspectCardMatch.card.set}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectCardMatch(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body: 2-Column Side-by-Side Comparison */}
            <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 items-start">
              
              {/* Left Column: Reference Target Card */}
              <div className="space-y-4 pb-6 lg:pb-0 lg:pr-6 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="px-2.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-cyan-300 text-[11px] font-bold font-mono uppercase tracking-wide border border-violet-200 dark:border-violet-800/60">
                    Reference Card (Target)
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <SetSymbol setCode={targetCard.set} size="xs" />
                    <span className="font-bold uppercase text-violet-700 dark:text-cyan-300">{targetCard.set}</span>
                    <span>•</span>
                    <span className="capitalize">{targetCard.rarity}</span>
                    <span>•</span>
                    <span>#{targetCard.collector_number}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                  <div className="w-full sm:w-[315px] shrink-0 flex flex-col items-center gap-3">
                    <CardObfuscator
                      card={targetCard}
                      obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                      size="lg"
                      showSublabel={false}
                    />

                    {/* Grading Panel: Consistently at the bottom of the gradable card */}
                    <div className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Your Rating
                        </span>
                        {currentGrade && (
                          <span className="text-[11px] font-bold font-mono text-violet-600 dark:text-cyan-400">
                            Grade: {currentGrade}
                          </span>
                        )}
                      </div>

                      {/* Quick Grade Tier Bar */}
                      <div className="grid grid-cols-6 sm:grid-cols-11 gap-1 pt-0.5">
                        {GRADE_TIERS.map((tier) => {
                          const isSelected = currentGrade === tier;
                          let color = 'bg-white text-slate-800 border-slate-200 dark:bg-[#0b1029] dark:text-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600';
                          if (tier.startsWith('A')) color = 'bg-amber-100 text-amber-950 border-amber-300 font-bold dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 hover:bg-amber-500 hover:text-white';
                          if (tier.startsWith('B')) color = 'bg-cyan-100 text-cyan-950 border-cyan-300 font-bold dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/40 hover:bg-cyan-500 hover:text-white';
                          if (tier.startsWith('C')) color = 'bg-slate-100 text-slate-900 border-slate-300 font-bold dark:bg-slate-800/50 dark:text-slate-200 dark:border-slate-700/60 hover:bg-slate-600 hover:text-white';
                          if (tier === 'D') color = 'bg-orange-100 text-orange-950 border-orange-300 font-bold dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40 hover:bg-orange-500 hover:text-white';
                          if (tier === 'F') color = 'bg-rose-100 text-rose-950 border-rose-300 font-bold dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/40 hover:bg-rose-500 hover:text-white';

                          return (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => {
                                if (onAdoptGrade) {
                                  onAdoptGrade(targetCard, tier);
                                  setAdoptedSourceId('manual');
                                }
                              }}
                              className={`py-1 rounded text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                                isSelected ? 'ring-2 ring-violet-400 bg-violet-600 text-white font-black shadow-xs' : color
                              }`}
                            >
                              {tier}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-3.5 text-xs w-full">
                    <div className="space-y-1 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-bold text-slate-900 dark:text-white truncate">{targetCard.name}</span>
                        {targetCard.mana_cost && <ManaCostRenderer manaCost={targetCard.mana_cost} size="md" />}
                      </div>
                      <p className="font-mono text-violet-700 dark:text-cyan-300">
                        {targetCard.type_line} {targetCard.power && `• ${targetCard.power}/${targetCard.toughness}`}
                      </p>
                    </div>

                    {/* 17Lands Record Box */}
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2 font-mono">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {effectiveTarget17L?.winRate !== undefined ? (
                          <a
                            href={get17LandsCardUrl(targetCard.set, targetCard)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:underline flex items-center gap-1 group/l17"
                            title={`Open ${targetCard.name} (${targetCard.set.toUpperCase()}) on 17lands.com`}
                          >
                            <span>17Lands Record</span>
                            <ExternalLink className="w-3 h-3 text-emerald-600 dark:text-emerald-400 group-hover/l17:translate-x-0.5 transition-transform" />
                          </a>
                        ) : (
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            17Lands Record
                          </span>
                        )}
                        {effectiveTarget17L?.tierGrade ? (
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                            Tier {effectiveTarget17L.tierGrade}
                          </span>
                        ) : currentGrade ? (
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-violet-600 text-white shadow-2xs">
                            Tier {currentGrade}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Pending
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">GIH WR</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                            {effectiveTarget17L?.winRate !== undefined
                              ? `${(effectiveTarget17L.winRate * 100).toFixed(1)}%`
                              : 'Pending'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">ALSA</span>
                          <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                            {effectiveTarget17L?.alsa !== undefined
                              ? effectiveTarget17L.alsa.toFixed(2)
                              : 'Pending'}
                          </span>
                        </div>
                        {effectiveTarget17L?.iwd !== undefined && (
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">IWD</span>
                            <span className={`font-bold text-sm ${effectiveTarget17L.iwd >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'}`}>
                              {effectiveTarget17L.iwd >= 0 ? '+' : ''}{(effectiveTarget17L.iwd * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Oracle Rules Text */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Oracle Rules Text
                      </span>
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line text-sm shadow-2xs">
                        {targetCard.oracle_text || 'No oracle rules text.'}
                      </div>
                    </div>

                    {/* Card Keywords & Mechanics (mirrors Similarity Rationale on the right) */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Card Mechanics & Keywords
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {targetCard.keywords && targetCard.keywords.length > 0 ? (
                          targetCard.keywords.map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-cyan-300 font-mono text-[10px] border border-violet-200 dark:border-violet-800/60 font-semibold">
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono italic">
                            Core Limited spell / creature without evergreen keyword mechanics
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Target Evaluation Specs & Links */}
                    <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                            Set: {targetCard.set.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                            CMC: {targetCard.cmc ?? 0}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700 capitalize">
                            {targetCard.rarity}
                          </span>
                        </div>

                        {/* Links */}
                        <div className="flex items-center gap-3">
                          <a
                            href={get17LandsCardUrl(targetCard.set, targetCard)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-mono text-xs font-semibold"
                          >
                            <span>View on 17Lands</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <a
                            href={targetCard.scryfall_uri || `https://scryfall.com/search?q=%21%22${encodeURIComponent(targetCard.name)}%22`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-violet-600 dark:text-cyan-400 hover:underline font-mono text-xs font-semibold"
                          >
                            <span>View on Scryfall</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Similar Precedent Card (Symmetric to Left Column) */}
              <div className="space-y-4 pt-6 lg:pt-0 lg:pl-6">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold font-mono uppercase tracking-wide border border-emerald-200 dark:border-emerald-800/60">
                    Similar Precedent ({inspectCardMatch.similarityScore === 100 ? '100% Reprint' : `${inspectCardMatch.similarityScore}% Match`})
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <SetSymbol setCode={inspectCardMatch.card.set} size="xs" />
                    <span className="font-bold uppercase text-emerald-700 dark:text-emerald-300">{inspectCardMatch.card.set}</span>
                    <span>•</span>
                    <span className="capitalize">{inspectCardMatch.card.rarity}</span>
                    <span>•</span>
                    <span>#{inspectCardMatch.card.collector_number}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                  <div className="w-full sm:w-[315px] shrink-0 flex flex-col items-center gap-3">
                    <CardObfuscator
                      card={inspectCardMatch.card}
                      obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                      size="lg"
                      showSublabel={false}
                    />

                    {/* Precedent Benchmark Panel: Perfectly balancing "Your Rating" on the left */}
                    <div className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Precedent Benchmark
                        </span>
                        <span className="text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          Tier {precedentTier}
                        </span>
                      </div>

                      {/* Prominent Action Button to Adopt Precedent Grade */}
                      {onAdoptGrade ? (
                        <button
                          type="button"
                          onClick={() => handleAdopt(precedentTier, inspectCardMatch.card.id)}
                          className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer border shadow-2xs ${
                            adoptedSourceId === inspectCardMatch.card.id
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                              : 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white border-emerald-500 shadow-xs'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            {adoptedSourceId === inspectCardMatch.card.id
                              ? `Used Grade (${precedentTier})`
                              : `Use Precedent Grade (${precedentTier})`}
                          </span>
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-400 text-center py-1">
                          Historical reference baseline
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-3.5 text-xs w-full">
                    <div className="space-y-1 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-bold text-slate-900 dark:text-white truncate">{inspectCardMatch.card.name}</span>
                        {inspectCardMatch.card.mana_cost && <ManaCostRenderer manaCost={inspectCardMatch.card.mana_cost} size="md" />}
                      </div>
                      <p className="font-mono text-violet-700 dark:text-cyan-300">
                        {inspectCardMatch.card.type_line} {inspectCardMatch.card.power && `• ${inspectCardMatch.card.power}/${inspectCardMatch.card.toughness}`}
                      </p>
                    </div>

                    {/* 17Lands Record Box - Symmetrically placed matching left side */}
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2 font-mono">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <a
                          href={get17LandsCardUrl(inspectCardMatch.card.set, inspectCardMatch.card)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:underline flex items-center gap-1 group/l17"
                          title={`Open ${inspectCardMatch.card.name} (${inspectCardMatch.card.set.toUpperCase()}) on 17lands.com`}
                        >
                          <span>17Lands Record</span>
                          <ExternalLink className="w-3 h-3 text-emerald-600 dark:text-emerald-400 group-hover/l17:translate-x-0.5 transition-transform" />
                        </a>
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                          Tier {precedentTier}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">GIH WR</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                            {precedent17L?.winRate !== undefined
                              ? `${(precedent17L.winRate * 100).toFixed(1)}%`
                              : 'Pending'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">ALSA</span>
                          <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                            {precedent17L?.alsa !== undefined
                              ? precedent17L.alsa.toFixed(2)
                              : 'Pending'}
                          </span>
                        </div>
                        {precedent17L?.iwd !== undefined && (
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">IWD</span>
                            <span className={`font-bold text-sm ${precedent17L.iwd >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'}`}>
                              {precedent17L.iwd >= 0 ? '+' : ''}{(precedent17L.iwd * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Oracle Rules Text */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Oracle Rules Text
                      </span>
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line text-sm shadow-2xs">
                        {inspectCardMatch.card.oracle_text || 'No oracle rules text.'}
                      </div>
                    </div>

                    {/* Match rationale */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Similarity Rationale ({inspectCardMatch.similarityScore === 100 ? '100% Reprint' : `${inspectCardMatch.similarityScore}% Match`} to {targetCard.name})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {inspectCardMatch.matchReasons.map((r, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700 font-semibold">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Precedent Specs & Links - Symmetrically matching left side */}
                    <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                            Set: {inspectCardMatch.card.set.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                            CMC: {inspectCardMatch.card.cmc ?? 0}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700 capitalize">
                            {inspectCardMatch.card.rarity}
                          </span>
                        </div>

                        {/* Links */}
                        <div className="flex items-center gap-3">
                          <a
                            href={get17LandsCardUrl(inspectCardMatch.card.set, inspectCardMatch.card)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-mono text-xs font-semibold"
                          >
                            <span>View on 17Lands</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <a
                            href={inspectCardMatch.card.scryfall_uri || `https://scryfall.com/search?q=%21%22${encodeURIComponent(inspectCardMatch.card.name)}%22`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-violet-600 dark:text-cyan-400 hover:underline font-mono text-xs font-semibold"
                          >
                            <span>View on Scryfall</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-[#050818]/90 font-mono text-[11px] text-center sm:text-left flex items-center justify-between">
              <span>Head-to-head comparison: {targetCard.name} vs. {inspectCardMatch.card.name}</span>
              <span className="hidden sm:inline">Press Esc or ✕ to close</span>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Precedent Swap & Search Modal */}
      {swapSearchSlotIndex !== null && targetCard && (
        <PrecedentSwapSearchModal
          isOpen={swapSearchSlotIndex !== null}
          onClose={() => setSwapSearchSlotIndex(null)}
          targetCard={targetCard}
          currentMatches={presentedMatches}
          initialSlotIndex={swapSearchSlotIndex}
          onConfirmSlotReplacement={handleConfirmSlotReplacement}
          onRevertSlot={handleRevertSlot}
        />
      )}
    </div>
  );
};

