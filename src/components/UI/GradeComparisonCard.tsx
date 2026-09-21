import React from 'react';
import { Card, GradeTier, SeventeenLandsCardRating, UserCardEvaluation } from '../../types/mtg';
import { GRADE_TIERS, gradeTierToIndex, winRateToGradeTier, get17LandsCardUrl } from '../../services/seventeenLands';
import { getLsvRatingForCard } from '../../services/lsvRatings';
import { Scale, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Sparkles, BarChart2, Award, ExternalLink } from 'lucide-react';

interface GradeComparisonCardProps {
  card: Card;
  userEval?: UserCardEvaluation | null;
  landData?: SeventeenLandsCardRating | null;
  isBlindGrading?: boolean;
  showLsv?: boolean;
  show17L?: boolean;
  className?: string;
}

export const GradeComparisonCard: React.FC<GradeComparisonCardProps> = ({
  card,
  userEval,
  landData,
  isBlindGrading = false,
  showLsv = true,
  show17L = true,
  className = '',
}) => {
  const lsvRating = getLsvRatingForCard(card);
  const userGrade = userEval?.userGrade;
  const userIndex = userGrade ? gradeTierToIndex(userGrade) : -1;

  const actualGrade: GradeTier | null = landData
    ? ((landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate))
    : null;
  const actualIndex = actualGrade ? gradeTierToIndex(actualGrade) : -1;

  // Gap calculation (Me vs 17Lands)
  const tierDelta = (userIndex >= 0 && actualIndex >= 0) ? actualIndex - userIndex : 0;

  // Gap calculation (Me vs LSV)
  const lsvIndex = lsvRating ? gradeTierToIndex(lsvRating.grade) : -1;
  const lsvDelta = (userIndex >= 0 && lsvIndex >= 0) ? lsvIndex - userIndex : 0;

  const getDeltaBadge = () => {
    if (!userGrade) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          Rate the card to see how you compare
        </span>
      );
    }

    if (isBlindGrading) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-xs font-bold">
          Grading Mode (Hidden)
        </span>
      );
    }

    if (!landData) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          17L Data Syncing
        </span>
      );
    }

    if (tierDelta === 0) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Exact Match (Correct)</span>
        </span>
      );
    }

    if (tierDelta === 1) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>+1 Tier (Correct)</span>
        </span>
      );
    }

    if (tierDelta === -1) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>-1 Tier (Correct)</span>
        </span>
      );
    }

    if (tierDelta === 2) {
      return (
        <span className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+2 Tiers (Trap)</span>
        </span>
      );
    }

    if (tierDelta === -2) {
      return (
        <span className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>-2 Tiers (Sleeper)</span>
        </span>
      );
    }

    if (tierDelta >= 3) {
      return (
        <span className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/50">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+{tierDelta} Tiers (Trap)</span>
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-blue-100 dark:bg-blue-500/25 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/50">
        <TrendingDown className="w-3.5 h-3.5" />
        <span>{tierDelta} Tiers (Sleeper)</span>
      </span>
    );
  };

  const visibleColumnsCount = 1 + (showLsv ? 1 : 0) + (show17L ? 1 : 0);

  return (
    <div className={`p-3 rounded-xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 ${className}`}>
      {/* Header & Delta Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <Scale className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 font-mono">
            Evaluation vs 17Lands
          </h4>
        </div>
        <div className="flex items-center gap-1">
          {getDeltaBadge()}
        </div>
      </div>

      {/* Dynamic Multi-Column Triangulation Grid */}
      <div className={`grid gap-2.5 ${visibleColumnsCount === 3 ? 'grid-cols-1 sm:grid-cols-3' : visibleColumnsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* 1. ME Column (Always Visible) */}
        <div className="p-2.5 rounded-xl bg-violet-50/60 dark:bg-violet-950/25 border-2 border-violet-300 dark:border-violet-500/40 space-y-0.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-violet-800 dark:text-violet-300">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
            <span>You</span>
          </div>

          <div className="flex items-baseline gap-2 pt-0.5">
            {userGrade ? (
              <>
                <span className="text-lg font-black font-mono px-2 py-0.5 rounded-lg bg-violet-600 text-white border border-violet-400 shadow-xs">
                  {userGrade}
                </span>
                <span className="text-xs font-mono font-semibold text-violet-700 dark:text-violet-300">
                  ({userEval?.userScore?.toFixed(1)} / 5.0)
                </span>
              </>
            ) : (
              <span className="text-base font-semibold text-violet-500/80 font-mono">—</span>
            )}
          </div>
          {userEval?.pickPriority && (
            <div className="text-[10px] text-violet-700/80 dark:text-violet-300/80 pt-0.5 truncate">
              Priority: <strong className="text-slate-900 dark:text-white">{userEval.pickPriority}</strong>
            </div>
          )}
        </div>

        {/* 2. LSV Column (Togglable) */}
        {showLsv && (
          <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border-2 border-amber-300 dark:border-amber-500/40 space-y-0.5 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>LSV</span>
            </div>

            <div className="flex items-baseline gap-2 pt-0.5">
              {userGrade && !isBlindGrading && lsvRating ? (
                <>
                  <span className="text-lg font-black font-mono px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 border border-amber-400 shadow-xs">
                    {lsvRating.grade}
                  </span>
                  <span className="text-xs font-black font-mono text-amber-700 dark:text-amber-300">
                    {lsvRating.score.toFixed(1)} / 5.0
                  </span>
                </>
              ) : (
                <span className="text-base font-semibold text-amber-500/80 font-mono">
                  —
                </span>
              )}
            </div>

            <div className="text-[10px] text-amber-700/80 dark:text-amber-300/80 flex items-center justify-between pt-0.5">
              {!userGrade ? (
                <span className="italic text-slate-400 dark:text-slate-500">Rate card to reveal</span>
              ) : isBlindGrading ? (
                <span className="italic text-amber-600/70 dark:text-amber-400/70">Hidden in grading mode</span>
              ) : !lsvRating ? (
                <span className="italic text-slate-400 dark:text-slate-500">Review pending</span>
              ) : (
                <>
                  <span>{lsvRating.verdict || 'Playable'}</span>
                  {userGrade && (
                    <span className="font-mono font-semibold" title="Delta vs LSV">
                      Δ {lsvDelta > 0 ? `+${lsvDelta}` : lsvDelta < 0 ? `${lsvDelta}` : '0'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 3. 17L Column (Togglable) */}
        {show17L && (
          <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border-2 border-emerald-400 dark:border-emerald-500/50 space-y-0.5 shadow-xs">
            <div className="flex items-center justify-between gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>17Lands</span>
              </div>
              {landData && !isBlindGrading && (
                <a
                  href={get17LandsCardUrl(card.set, card, landData)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-emerald-700 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:underline flex items-center gap-0.5 font-mono font-bold"
                  title={`Open ${card.name} (${card.set.toUpperCase()}) on 17lands.com`}
                >
                  <span>17Lands ↗</span>
                </a>
              )}
            </div>

            <div className="flex items-baseline gap-2 pt-0.5">
              {userGrade && actualGrade && !isBlindGrading ? (
                <>
                  <a
                    href={get17LandsCardUrl(card.set, card, landData)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-black font-mono px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-xs transition-colors inline-flex items-center gap-1"
                    title={`View ${card.name} on 17lands.com`}
                  >
                    <span>{actualGrade}</span>
                    <ExternalLink className="w-3 h-3 text-emerald-200" />
                  </a>
                  <a
                    href={get17LandsCardUrl(card.set, card, landData)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-0.5"
                    title={`View ${card.name} win rate on 17lands.com`}
                  >
                    <span>{((landData?.win_rate || 0) * 100).toFixed(1)}% WR</span>
                  </a>
                </>
              ) : (
                <span className="text-base font-semibold text-emerald-500/80 font-mono">
                  —
                </span>
              )}
            </div>

            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 flex items-center justify-between pt-0.5">
              {!userGrade ? (
                <span className="italic text-slate-400 dark:text-slate-500">Rate card to reveal</span>
              ) : landData && !isBlindGrading ? (
                <>
                  <span>ALSA: <strong className="text-emerald-900 dark:text-white font-mono">{landData.avg_seen.toFixed(1)}</strong></span>
                  {typeof landData.iwd === 'number' && (
                    <span>IWD: <strong className="text-emerald-700 dark:text-emerald-300 font-mono">{(landData.iwd * 100).toFixed(1)}%</strong></span>
                  )}
                </>
              ) : (
                <span>{isBlindGrading ? 'Hidden in grading mode' : '17Lands data syncing'}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeComparisonCard;
