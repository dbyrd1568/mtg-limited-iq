import React, { useState, useEffect, useMemo } from 'react';
import { Card, GradeTier } from '../../types/mtg';
import { findSimilarCards, CardSimilarityResult, SimilarCardMatch } from '../../services/cardSimilarity';
import { GRADE_TIERS, GRADE_SCORES, scoreToGradeTier, winRateToGradeTier, gradeTierToIndex, get17LandsCardUrl } from '../../services/seventeenLands';
import { CardObfuscator } from '../CardObfuscator';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { X, Scale, Check, PlayingCardsFan, HelpCircle, Loader2, ExternalLink, Info, GitCompare } from 'lucide-react';

export interface CardPerformanceMetrics {
  winRate?: number;
  alsa?: number;
  tierGrade?: GradeTier;
}

interface SimilarCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCard: Card | null;
  currentGrade?: GradeTier;
  target17LandsData?: CardPerformanceMetrics;
  onAdoptGrade?: (card: Card, grade: GradeTier) => void;
}

export const SimilarCardsModal: React.FC<SimilarCardsModalProps> = ({
  isOpen,
  onClose,
  targetCard,
  currentGrade,
  target17LandsData,
  onAdoptGrade,
}) => {
  const [data, setData] = useState<CardSimilarityResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [adoptedSourceId, setAdoptedSourceId] = useState<string | null>(null);
  const [inspectCardMatch, setInspectCardMatch] = useState<SimilarCardMatch | null>(null);

  // Fetch comps on open or target change
  useEffect(() => {
    if (isOpen && targetCard) {
      setLoading(true);
      findSimilarCards(targetCard)
        .then((result) => {
          setData(result);
        })
        .catch((err) => {
          console.error('Failed to find similar cards:', err);
          setData(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setData(null);
      setInspectCardMatch(null);
      setAdoptedSourceId(null);
    }
  }, [isOpen, targetCard]);

  // Keyboard close on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectCardMatch) {
          setInspectCardMatch(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, inspectCardMatch, onClose]);

  if (!isOpen || !targetCard) return null;

  const handleAdopt = (grade: GradeTier, sourceId: string) => {
    if (onAdoptGrade && targetCard) {
      onAdoptGrade(targetCard, grade);
      setAdoptedSourceId(sourceId);
    }
  };

  // Only display up to top 4 highest similarity matches
  const presentedMatches = useMemo(() => {
    return data?.matches?.slice(0, 4) || [];
  }, [data]);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-[96vw] max-w-[1600px] max-h-[94vh] flex flex-col bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
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

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-9 h-9 text-violet-600 dark:text-cyan-400 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Searching historical sets & fetching 17Lands data...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Querying premier draft statistics across WOE, BLB, OTJ, MKM, LCI, DMU, and more
                </p>
              </div>
            </div>
          ) : !data || data.matches.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  No direct historical comps found
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  This card may have an unprecedented combination of mechanics, colors, or mana value in modern premier draft sets.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Compact Precedent Summary & Adoption Bar */}
              <div className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-emerald-500/10 border border-violet-400/30 dark:border-cyan-400/30 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
                {/* Metrics: Average, Median, Range */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                  {/* Grade Average */}
                  <div className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0">
                      Average:
                    </span>
                    <span className="text-xs sm:text-sm font-black font-mono px-2 py-0.5 rounded-lg bg-violet-600 text-white shadow-2xs shrink-0">
                      Tier {presentedGradeStats?.averageGrade || data.consensus.projectedTier}
                    </span>
                    {presentedGradeStats?.avgWinRate !== undefined ? (
                      <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
                        {(presentedGradeStats.avgWinRate * 100).toFixed(1)}% WR
                      </span>
                    ) : data.consensus.averageWinRate !== undefined ? (
                      <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
                        {(data.consensus.averageWinRate * 100).toFixed(1)}% WR
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
                      Tier {presentedGradeStats?.medianGrade || data.consensus.projectedTier}
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
                  ) : (data.consensus.tierRangeMin && data.consensus.tierRangeMax) ? (
                    <>
                      <span className="text-slate-300 dark:text-slate-700 font-light hidden md:inline">|</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                        Range: {data.consensus.tierRangeMin === data.consensus.tierRangeMax ? data.consensus.tierRangeMin : `${data.consensus.tierRangeMin} to ${data.consensus.tierRangeMax}`}
                      </span>
                    </>
                  ) : null}

                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden xl:inline">
                    • Based on {presentedMatches.length} comparable cards
                  </span>
                </div>

                {/* Side-by-side Adopt Buttons */}
                {onAdoptGrade && (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                    {/* Use Grade Average Button */}
                    <button
                      type="button"
                      onClick={() => handleAdopt(presentedGradeStats?.averageGrade || data.consensus.projectedTier, 'average')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border ${
                        adoptedSourceId === 'average'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
                          : 'bg-violet-600 hover:bg-violet-700 text-white border-violet-500 shadow-2xs hover:scale-[1.01]'
                      }`}
                      title={`Adopt Grade Average (${presentedGradeStats?.averageGrade || data.consensus.projectedTier})`}
                    >
                      <Check className={`w-3.5 h-3.5 ${adoptedSourceId === 'average' ? 'text-emerald-200' : 'opacity-80'}`} />
                      <span>
                        {adoptedSourceId === 'average'
                          ? `Used Average (${presentedGradeStats?.averageGrade || data.consensus.projectedTier})`
                          : `Use Grade Average (${presentedGradeStats?.averageGrade || data.consensus.projectedTier})`}
                      </span>
                    </button>

                    {/* Use Median Grade Button */}
                    <button
                      type="button"
                      onClick={() => handleAdopt(presentedGradeStats?.medianGrade || data.consensus.projectedTier, 'median')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border ${
                        adoptedSourceId === 'median'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
                          : 'bg-slate-900 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-white border-slate-700 dark:border-slate-600 shadow-2xs hover:border-indigo-400 hover:scale-[1.01]'
                      }`}
                      title={`Adopt Median Grade (${presentedGradeStats?.medianGrade || data.consensus.projectedTier})`}
                    >
                      <Check className={`w-3.5 h-3.5 ${adoptedSourceId === 'median' ? 'text-emerald-200' : 'opacity-80'}`} />
                      <span>
                        {adoptedSourceId === 'median'
                          ? `Used Median (${presentedGradeStats?.medianGrade || data.consensus.projectedTier})`
                          : `Use Median Grade (${presentedGradeStats?.medianGrade || data.consensus.projectedTier})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Target Card vs Similar Comps Flex Container */}
              <div className="flex flex-col lg:flex-row gap-5 items-start">
                {/* Target Card Column (Desktop left side, 340px width) */}
                <div className="w-full lg:w-[340px] shrink-0 p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3 lg:sticky lg:top-0">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-mono font-bold text-violet-700 dark:text-cyan-400 tracking-wider">
                      Target Card
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      #{targetCard.collector_number}
                    </span>
                  </div>

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
                    {onAdoptGrade && (presentedGradeStats?.averageGrade || data?.consensus?.projectedTier) && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdopt(presentedGradeStats?.averageGrade || data!.consensus.projectedTier, 'average')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1 cursor-pointer border shadow-2xs ${
                            adoptedSourceId === 'average'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-violet-700 dark:text-cyan-300 border-violet-200 dark:border-violet-800/60'
                          }`}
                          title={`Adopt Average Grade (${presentedGradeStats?.averageGrade || data?.consensus?.projectedTier})`}
                        >
                          <Check className={`w-3 h-3 ${adoptedSourceId === 'average' ? 'text-emerald-200' : 'opacity-70'}`} />
                          <span className="truncate">{adoptedSourceId === 'average' ? `Avg (${presentedGradeStats?.averageGrade || data?.consensus?.projectedTier})` : `Use Avg (${presentedGradeStats?.averageGrade || data?.consensus?.projectedTier})`}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdopt(presentedGradeStats?.medianGrade || data!.consensus.projectedTier, 'median')}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1 cursor-pointer border shadow-2xs ${
                            adoptedSourceId === 'median'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                          }`}
                          title={`Adopt Median Grade (${presentedGradeStats?.medianGrade || data?.consensus?.projectedTier})`}
                        >
                          <Check className={`w-3 h-3 ${adoptedSourceId === 'median' ? 'text-emerald-200' : 'opacity-70'}`} />
                          <span className="truncate">{adoptedSourceId === 'median' ? `Med (${presentedGradeStats?.medianGrade || data?.consensus?.projectedTier})` : `Use Med (${presentedGradeStats?.medianGrade || data?.consensus?.projectedTier})`}</span>
                        </button>
                      </div>
                    )}


                    {/* Quick Grade Tier Buttons Grid */}
                    <div className="grid grid-cols-6 gap-1 pt-0.5">
                      {GRADE_TIERS.map((tier) => {
                        const isSelected = currentGrade === tier;
                        let color = 'bg-white text-slate-800 border-slate-200 dark:bg-[#070b1e] dark:text-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600';
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
                            className={`py-1 rounded-md text-[11px] font-mono font-bold transition-all border cursor-pointer ${
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

                {/* Similar Cards Matches List (Desktop right side) - 2 Columns of spacious cards */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      Comparable Historical Cards ({presentedMatches.length})
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      Click any card to inspect details
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {presentedMatches.map((match) => {
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
                              <div className="relative w-full h-[293px] sm:h-[321px] rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-[#050818] shadow-md group-hover:ring-2 group-hover:ring-violet-400 dark:group-hover:ring-cyan-400 transition-all">
                                <img
                                  src={imageUri}
                                  alt={comp.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <span className="text-xs font-mono font-bold text-white bg-black/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                                    Inspect Details
                                  </span>
                                </div>
                              </div>

                              {/* 17Lands Draft Performance Record under card */}
                              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 font-mono space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">17Lands</span>
                                  <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60">
                                    Tier {match.tierGrade || 'TBD'}
                                  </span>
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
                                  <h5 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors" title={comp.name}>
                                    {comp.name}
                                  </h5>
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
                                  </div>
                                </div>
                                {comp.mana_cost && <ManaCostRenderer manaCost={comp.mana_cost} size="md" />}
                              </div>

                              {/* Match percentage & reasons */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-300 font-mono text-xs font-bold border border-cyan-200 dark:border-cyan-500/40">
                                  {match.similarityScore}% Match
                                </span>
                                {match.matchReasons.map((r, i) => (
                                  <span key={i} className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-mono text-xs border border-slate-200/60 dark:border-slate-700/60">
                                    {r}
                                  </span>
                                ))}
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
                                      {match.alsa !== undefined ? `Pick ~${match.alsa.toFixed(1)} ALSA` : 'Data Pending'}
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
                                      href={get17LandsCardUrl(comp.set, comp)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                                    >
                                      <span>17Lands</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
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
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-[#050818]/90 font-mono text-[11px] text-center sm:text-left">
          Searches Premier Draft Precedents across modern standard & booster sets
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
            className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] w-[96vw] bg-white dark:bg-[#0b1029] border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#070b1e]">
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
                      {inspectCardMatch.similarityScore}% Match
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
            <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
              
              {/* Left Column: Reference Target Card */}
              <div className="space-y-4">
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
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          17Lands Record
                        </span>
                        {target17LandsData?.tierGrade ? (
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                            Tier {target17LandsData.tierGrade}
                          </span>
                        ) : currentGrade ? (
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-violet-600 text-white shadow-2xs">
                            Tier {currentGrade}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Tier TBD
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">GIH WR</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                            {target17LandsData?.winRate !== undefined
                              ? `${(target17LandsData.winRate * 100).toFixed(1)}%`
                              : 'TBD (Unreleased)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">ALSA</span>
                          <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                            {target17LandsData?.alsa !== undefined
                              ? target17LandsData.alsa.toFixed(2)
                              : 'Pending'}
                          </span>
                        </div>
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
                          {target17LandsData?.winRate !== undefined && (
                            <a
                              href={get17LandsCardUrl(targetCard.set, targetCard)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-mono text-xs font-semibold"
                            >
                              <span>View on 17Lands</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
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

              {/* Right Column: Similar Precedent Card */}
              <div className="space-y-4 pt-6 lg:pt-0 lg:pl-6">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold font-mono uppercase tracking-wide border border-emerald-200 dark:border-emerald-800/60">
                    Similar Precedent ({inspectCardMatch.similarityScore}% Match)
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

                    {/* 17Lands Metrics Card under card */}
                    <div className="w-full p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2 font-mono">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          17Lands Record
                        </span>
                        {inspectCardMatch.tierGrade ? (
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                            Tier {inspectCardMatch.tierGrade}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Tier TBD
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">GIH WR</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                            {inspectCardMatch.winRate !== undefined ? `${(inspectCardMatch.winRate * 100).toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">ALSA</span>
                          <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                            {inspectCardMatch.alsa !== undefined ? inspectCardMatch.alsa.toFixed(2) : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {inspectCardMatch.tierGrade && onAdoptGrade && (
                        <button
                          type="button"
                          onClick={() => handleAdopt(inspectCardMatch.tierGrade!, inspectCardMatch.card.id)}
                          className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer border shadow-2xs ${
                            adoptedSourceId === inspectCardMatch.card.id
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-900 dark:bg-slate-800 hover:bg-violet-700 dark:hover:bg-violet-600 text-white border-slate-700 hover:border-violet-400'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{adoptedSourceId === inspectCardMatch.card.id ? `Used Grade (${inspectCardMatch.tierGrade})` : `Use Grade (${inspectCardMatch.tierGrade})`}</span>
                        </button>
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

                    {/* Rules Text */}
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
                        Similarity Rationale ({inspectCardMatch.similarityScore}% match to {targetCard.name})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {inspectCardMatch.matchReasons.map((r, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-3 pt-2">
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

            {/* Modal Footer */}
            <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-[#050818]/90 font-mono text-[11px] text-center sm:text-left flex items-center justify-between">
              <span>Head-to-head comparison: {targetCard.name} vs. {inspectCardMatch.card.name}</span>
              <span className="hidden sm:inline">Press Esc or ✕ to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
