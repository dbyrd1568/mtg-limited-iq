import React, { useEffect, useMemo } from 'react';
import {
  X,
  HelpCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Target,
  Info,
  Lightbulb,
  AlertTriangle,
  Flame,
  Award,
} from 'lucide-react';
import { Card, GradeTier } from '../../types/mtg';
import { LinearRegressionResult, CalibrationScatterPoint, CHART_TIERS } from './CalibrationScatterPlot';

interface TrendlineExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: LinearRegressionResult;
  benchmarkDisplayName: string;
  selectedSetCode: string;
  selectedSetName?: string;
  points?: CalibrationScatterPoint[];
  onSelectCard?: (card: Card) => void;
}

export const TrendlineExplanationModal: React.FC<TrendlineExplanationModalProps> = ({
  isOpen,
  onClose,
  stats,
  benchmarkDisplayName,
  selectedSetCode,
  selectedSetName,
  points = [],
  onSelectCard,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const slope = stats.slope;
  const intercept = stats.intercept;
  const r2Percent = (stats.rSquared * 100).toFixed(1);
  const r = stats.correlation.toFixed(3);

  // Interpretation helpers tailored to this user's regression
  const isCompressed = slope < 0.75;
  const isPolarized = slope > 1.25;
  const isBalancedSlope = !isCompressed && !isPolarized;

  const isPessimist = intercept > 0.8;
  const isOptimist = intercept < -0.8;

  // Calculate real set card breakdowns from this user's evaluations
  const setAnalysis = useMemo(() => {
    if (!points || points.length === 0) return null;

    const totalEvaluated = points.length;
    const exactMatches = points.filter((p) => p.stepDelta === 0);
    const withinTolerance = points.filter((p) => Math.abs(p.stepDelta) <= 1);
    const traps = points.filter((p) => p.stepDelta >= 2).sort((a, b) => b.stepDelta - a.stepDelta);
    const sleepers = points.filter((p) => p.stepDelta <= -2).sort((a, b) => a.stepDelta - b.stepDelta);

    // Group cards by user tier
    const aCards = points.filter((p) => p.userGrade.startsWith('A'));
    const bCards = points.filter((p) => p.userGrade.startsWith('B'));
    const cCards = points.filter((p) => p.userGrade.startsWith('C'));
    const lowCards = points.filter((p) => p.userGrade.startsWith('D') || p.userGrade === 'F');

    const computeAvgActualTier = (cardList: CalibrationScatterPoint[]): string => {
      if (cardList.length === 0) return '—';
      const sum = cardList.reduce((acc, p) => acc + p.actualGradeIndex, 0);
      const avgIdx = Math.max(0, Math.min(12, Math.round(sum / cardList.length)));
      return CHART_TIERS[avgIdx] || 'C';
    };

    return {
      totalEvaluated,
      exactMatches,
      exactMatchRate: Math.round((exactMatches.length / totalEvaluated) * 100),
      toleranceRate: Math.round((withinTolerance.length / totalEvaluated) * 100),
      traps,
      sleepers,
      aCards: {
        count: aCards.length,
        avgActual: computeAvgActualTier(aCards),
        cards: aCards,
        sample: aCards[0],
      },
      bCards: {
        count: bCards.length,
        avgActual: computeAvgActualTier(bCards),
      },
      cCards: {
        count: cCards.length,
        avgActual: computeAvgActualTier(cCards),
        cards: cCards,
        sample: cCards[0],
      },
      lowCards: {
        count: lowCards.length,
        avgActual: computeAvgActualTier(lowCards),
        cards: lowCards,
        sample: lowCards[0],
      },
    };
  }, [points]);

  if (!isOpen) return null;

  // Clean tier names and compute whole-number integer step deltas
  const cleanGradeTier = (gradeStr: string): string => {
    return gradeStr.split(' ')[0].replace(/[()]/g, '').trim().toUpperCase();
  };

  const getWholeStepDelta = (baseTier: string, targetTierStr: string) => {
    const targetTier = cleanGradeTier(targetTierStr);
    const targetIdx = CHART_TIERS.indexOf(targetTier);
    const baseIdx = CHART_TIERS.indexOf(baseTier.toUpperCase());

    if (targetIdx === -1 || baseIdx === -1) {
      return { delta: 0, label: '0 steps', shortLabel: '0 steps', tier: targetTier };
    }

    const delta = targetIdx - baseIdx;
    const absDelta = Math.abs(delta);
    const stepWord = absDelta === 1 ? 'step' : 'steps';

    if (delta === 0) {
      return { delta: 0, label: 'Exact match (0 steps)', shortLabel: '0 steps (Exact)', tier: targetTier };
    }

    const directionWord = delta > 0 ? 'higher' : 'lower';
    const sign = delta > 0 ? '+' : '-';
    return {
      delta,
      tier: targetTier,
      label: `${sign}${absDelta} ${stepWord} (${absDelta} ${stepWord} ${directionWord})`,
      shortLabel: `${sign}${absDelta} ${stepWord}`,
    };
  };

  const fPrediction = getWholeStepDelta('F', stats.interceptGrade);
  const cPrediction = getWholeStepDelta('C', stats.cTierGrade);
  const aPrediction = getWholeStepDelta('A', stats.aTierGrade);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 dark:bg-[#13141a] border border-cyan-500/50 rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 text-white max-h-[92vh] overflow-y-auto font-sans relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-cyan-500/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Your Tendency Line & Bias Breakdown
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Tailored evaluation of your grading for{' '}
              <strong className="text-cyan-300 font-mono">
                {selectedSetName ? `${selectedSetName} (${selectedSetCode})` : selectedSetCode}
              </strong>{' '}
              vs <strong className="text-slate-200">{benchmarkDisplayName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Snapshot Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-800/70 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-700/60 space-y-0.5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Grading Tendency</span>
            <strong className="text-xs sm:text-sm font-mono font-bold text-cyan-300 block truncate">
              Slope: {slope.toFixed(2)}x
            </strong>
            <span className="text-[9px] text-slate-400 block font-mono">
              {slope < 0.75 ? 'Flatter (Compressed)' : slope > 1.25 ? 'Steeper (Polarized)' : '1:1 Balanced'}
            </span>
          </div>

          <div className="bg-slate-800/70 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-700/60 space-y-0.5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Predictability (R²)</span>
            <strong className="text-xs sm:text-sm font-mono font-bold text-emerald-400 block">
              {r2Percent}%
            </strong>
            <span className="text-[9px] text-slate-400 block">Variance explained</span>
          </div>

          <div className="bg-slate-800/70 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-700/60 space-y-0.5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Rank Agreement (r)</span>
            <strong className="text-xs sm:text-sm font-mono font-bold text-sky-300 block">
              {r}
            </strong>
            <span className="text-[9px] text-slate-400 block">Pearson rank score</span>
          </div>

          <div className="bg-slate-800/70 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-700/60 space-y-0.5">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Set Accuracy</span>
            <strong className="text-xs sm:text-sm font-bold text-violet-300 block">
              {setAnalysis ? `${setAnalysis.toleranceRate}%` : '—'}
            </strong>
            <span className="text-[9px] text-slate-400 block">Within ±1 sub-tier</span>
          </div>
        </div>

        {/* 1. What the Lines Mean */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            1. The Two Lines on Your Plot
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-1">
              <div className="flex items-center gap-2 font-mono font-bold text-slate-300">
                <span className="inline-block w-4 h-0 border-b-2 border-dashed border-slate-400" />
                <span>Dashed White (Ideal 1:1 Parity)</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Represents exact consensus agreement. When you grade a card <code className="text-violet-300">B+</code>, it performs in reality as a <code className="text-emerald-300">B+</code>.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-1">
              <div className="flex items-center gap-2 font-mono font-bold text-cyan-300">
                <span className="inline-block w-4 h-0.5 bg-cyan-400 rounded-full" />
                <span>Solid Cyan (Your Actual Trendline)</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                The best-fit trajectory across your {setAnalysis?.totalEvaluated || 'rated'} cards in {selectedSetCode}. It unmasks your subconscious tendencies (whether you overrate filler or under-separate bombs).
              </p>
            </div>
          </div>
        </div>

        {/* 2. Personalized Tier Calibration Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              2. What Happens When You Grade Cards in {selectedSetCode}
            </h4>
            <span className="text-[10px] font-mono text-slate-400">Stepped across letter tiers</span>
          </div>

          <div className="border border-slate-700/80 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/90 text-[10px] font-mono uppercase text-slate-400 border-b border-slate-700">
                  <th className="p-2.5">When You Grade A Card...</th>
                  <th className="p-2.5">Trendline Prediction</th>
                  <th className="p-2.5">Your Real Data in {selectedSetCode}</th>
                  <th className="p-2.5">Practical Draft Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-sans text-[11px]">
                {/* Low Tiers (F/D) */}
                <tr className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-bold text-rose-300">
                    Tier F <span className="block font-normal text-[10px] text-slate-400 font-sans">Unplayable</span>
                  </td>
                  <td className="p-2.5">
                    <span className="font-bold text-emerald-400 block font-mono text-xs">
                      Tier {fPrediction.tier}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 block">
                      {fPrediction.shortLabel}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-300">
                    {setAnalysis && setAnalysis.lowCards.count > 0 ? (
                      <div>
                        <span>{setAnalysis.lowCards.count} cards rated F/D</span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          Avg actual: <strong>Tier {setAnalysis.lowCards.avgActual}</strong>
                        </span>
                        {setAnalysis.lowCards.sample && (
                          <span className="block text-[10px] text-cyan-300 truncate max-w-[150px]" title={setAnalysis.lowCards.sample.cardName}>
                            e.g. {setAnalysis.lowCards.sample.cardName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No F/D ratings yet</span>
                    )}
                  </td>
                  <td className="p-2.5 text-slate-300 leading-relaxed">
                    {isPessimist
                      ? 'You are too dismissive of situational cards. Cards you toss out as unplayable often perform as solid D+ or C- roleplayers.'
                      : isOptimist
                      ? 'You accurately identify truly cuttable unplayables.'
                      : 'Accurate baseline calibration on emergency filler.'}
                  </td>
                </tr>

                {/* Middle Tier (C) */}
                <tr className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-bold text-amber-300">
                    Tier C <span className="block font-normal text-[10px] text-slate-400 font-sans">Solid Common Playable</span>
                  </td>
                  <td className="p-2.5">
                    <span className="font-bold text-emerald-400 block font-mono text-xs">
                      Tier {cPrediction.tier}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 block">
                      {cPrediction.shortLabel}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-300">
                    {setAnalysis && setAnalysis.cCards.count > 0 ? (
                      <div>
                        <span>{setAnalysis.cCards.count} cards rated C</span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          Avg actual: <strong>Tier {setAnalysis.cCards.avgActual}</strong>
                        </span>
                        {setAnalysis.cCards.sample && (
                          <span className="block text-[10px] text-cyan-300 truncate max-w-[150px]" title={setAnalysis.cCards.sample.cardName}>
                            e.g. {setAnalysis.cCards.sample.cardName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No C ratings yet</span>
                    )}
                  </td>
                  <td className="p-2.5 text-slate-300 leading-relaxed">
                    Your baseline for quintessential 23rd-card commons tracks closely to format reality.
                  </td>
                </tr>

                {/* Bomb Tier (A) */}
                <tr className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-bold text-emerald-300">
                    Tier A <span className="block font-normal text-[10px] text-slate-400 font-sans">Format Bomb</span>
                  </td>
                  <td className="p-2.5">
                    <span className="font-bold text-emerald-400 block font-mono text-xs">
                      Tier {aPrediction.tier}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 block">
                      {aPrediction.shortLabel}
                    </span>
                  </td>
                  <td className="p-2.5 text-slate-300">
                    {setAnalysis && setAnalysis.aCards.count > 0 ? (
                      <div>
                        <span>{setAnalysis.aCards.count} cards rated A</span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          Avg actual: <strong>Tier {setAnalysis.aCards.avgActual}</strong>
                        </span>
                        {setAnalysis.aCards.sample && (
                          <span className="block text-[10px] text-cyan-300 truncate max-w-[150px]" title={setAnalysis.aCards.sample.cardName}>
                            e.g. {setAnalysis.aCards.sample.cardName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No A ratings yet</span>
                    )}
                  </td>
                  <td className="p-2.5 text-slate-300 leading-relaxed">
                    {isCompressed
                      ? `Cards you grade as bombs perform around Tier ${aPrediction.tier}. You may be handing out 'A' grades to flashy rares that are really just solid B-tier cards.`
                      : isPolarized
                      ? 'You gatekeep bombs very strictly and accurately separate true game-breakers.'
                      : 'Well-calibrated recognition of format-defining cards.'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Real Standout Cards in This Specific Set */}
        {setAnalysis && (setAnalysis.traps.length > 0 || setAnalysis.sleepers.length > 0) && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              3. Your Standout Divergences in {selectedSetCode}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Biggest Traps */}
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-2">
                <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Top Traps (You Overrated)</span>
                </div>
                {setAnalysis.traps.length > 0 ? (
                  <div className="space-y-1.5 font-mono text-[10px]">
                    {setAnalysis.traps.slice(0, 2).map((trap) => (
                      <div
                        key={trap.cardName}
                        onClick={() => onSelectCard && onSelectCard(trap.card)}
                        className={`flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-rose-500/30 ${
                          onSelectCard ? 'cursor-pointer hover:border-rose-400 transition-colors' : ''
                        }`}
                      >
                        <span className="truncate max-w-[140px] font-bold text-white font-sans" title={trap.cardName}>
                          {trap.cardName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-violet-300">You: {trap.userGrade}</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-rose-400 font-bold">{trap.actualGrade}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-rose-900/80 text-rose-200">
                            +{trap.stepDelta}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No major traps detected in this set!</p>
                )}
              </div>

              {/* Biggest Sleepers */}
              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/40 space-y-2">
                <div className="flex items-center gap-1.5 text-sky-300 font-bold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Top Sleepers (You Underrated)</span>
                </div>
                {setAnalysis.sleepers.length > 0 ? (
                  <div className="space-y-1.5 font-mono text-[10px]">
                    {setAnalysis.sleepers.slice(0, 2).map((sleeper) => (
                      <div
                        key={sleeper.cardName}
                        onClick={() => onSelectCard && onSelectCard(sleeper.card)}
                        className={`flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-sky-500/30 ${
                          onSelectCard ? 'cursor-pointer hover:border-sky-400 transition-colors' : ''
                        }`}
                      >
                        <span className="truncate max-w-[140px] font-bold text-white font-sans" title={sleeper.cardName}>
                          {sleeper.cardName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-violet-300">You: {sleeper.userGrade}</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-emerald-400 font-bold">{sleeper.actualGrade}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-sky-900/80 text-sky-200">
                            {sleeper.stepDelta}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No major sleepers detected in this set!</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. Actionable Drafting Takeaways */}
        <div className="p-3.5 rounded-xl bg-violet-950/40 border border-violet-500/40 space-y-2 text-xs">
          <h4 className="font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5 text-xs">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            Actionable Drafting Advice For {selectedSetCode}
          </h4>
          <ul className="space-y-1.5 text-[11px] text-slate-200">
            {isCompressed && (
              <>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>
                    <strong>Be stingier with 'A' grades:</strong> Reserve 'A' strictly for format-warping game-winners. In {selectedSetCode}, cards you evaluate as bombs perform on average as <strong>Tier {setAnalysis?.aCards.avgActual && setAnalysis.aCards.avgActual !== '—' ? setAnalysis.aCards.avgActual : aPrediction.tier}</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>
                    <strong>Don’t instantly discard situational cards as 'F':</strong> In modern Limited formats like {selectedSetCode}, cards you rate as F perform at an average baseline of <strong>Tier {setAnalysis?.lowCards.avgActual && setAnalysis.lowCards.avgActual !== '—' ? setAnalysis.lowCards.avgActual : fPrediction.tier}</strong>. Look for archetype niches where they thrive.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>
                    <strong>Stretch your grading scale:</strong> Your tendency curve (slope: {slope.toFixed(2)}) is flatter than 1:1 parity, showing a tendency to bunch grades around the middle.
                  </span>
                </li>
              </>
            )}
            {isPolarized && (
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>
                  <strong>Watch for over-separation:</strong> Your slope ({slope.toFixed(2)}) is steep — you may be viewing cards as either broken or trash without seeing the fine gradations in between.
                </span>
              </li>
            )}
            {isBalancedSlope && (
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>
                  <strong>Excellent tier sensitivity:</strong> Your grade step intervals (slope: {slope.toFixed(2)}) match real-world format deltas closely!
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer active:scale-95"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
