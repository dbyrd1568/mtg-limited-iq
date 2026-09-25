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
    const isLand = Boolean(card.is_land || card.type_line?.toLowerCase().includes('land'));
    if (userGrade === 'N/A' || isLand) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10.5px] font-semibold">
          N/A (Excluded from math)
        </span>
      );
    }

    if (!userGrade) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10.5px] font-semibold">
          Rate card to compare
        </span>
      );
    }

    if (isBlindGrading) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-[10.5px] font-bold">
          Blind Mode
        </span>
      );
    }

    if (!landData) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10.5px] font-semibold">
          17L Syncing
        </span>
      );
    }

    if (tierDelta === 0) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-[10.5px] font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Exact Match</span>
        </span>
      );
    }

    if (tierDelta === 1) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>+1 Tier</span>
        </span>
      );
    }

    if (tierDelta === -1) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>-1 Tier</span>
        </span>
      );
    }

    if (tierDelta === 2) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold flex items-center gap-1 border bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40">
          <TrendingUp className="w-3 h-3" />
          <span>+2 Tiers (Trap)</span>
        </span>
      );
    }

    if (tierDelta === -2) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold flex items-center gap-1 border bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40">
          <TrendingDown className="w-3 h-3" />
          <span>-2 Tiers (Sleeper)</span>
        </span>
      );
    }

    if (tierDelta >= 3) {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold flex items-center gap-1 border bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/50">
          <TrendingUp className="w-3 h-3" />
          <span>+{tierDelta} Tiers (Trap)</span>
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold flex items-center gap-1 border bg-blue-100 dark:bg-blue-500/25 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/50">
        <TrendingDown className="w-3 h-3" />
        <span>{tierDelta} Tiers (Sleeper)</span>
      </span>
    );
  };

  const visibleColumnsCount = 1 + (showLsv ? 1 : 0) + (show17L ? 1 : 0);
  const gridColsClass = visibleColumnsCount === 3 ? 'grid-cols-3' : visibleColumnsCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className={`p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5 ${className}`}>
      {/* Header & Delta Badge */}
      <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
          <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
            Ratings
          </h4>
        </div>
        <div className="flex items-center gap-1">
          {getDeltaBadge()}
        </div>
      </div>

      {/* Dynamic Compact 3-Column Provider Row */}
      <div className={`grid gap-1.5 sm:gap-2 ${gridColsClass}`}>
        {/* 1. ME Column (Always Visible) */}
        <div className="p-1.5 sm:p-2 rounded-lg bg-violet-50/70 dark:bg-violet-950/25 border border-violet-200 dark:border-violet-800/50 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-bold text-violet-800 dark:text-violet-300 font-mono">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
              <span>You</span>
            </div>
            {userEval?.pickPriority && (
              <span className="hidden sm:inline text-[9px] text-violet-600 dark:text-violet-400 truncate font-normal">
                {userEval.pickPriority}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1 mt-0.5">
            {userGrade === 'N/A' ? (
              <span className="text-sm sm:text-base font-black font-mono px-1.5 py-0.2 rounded bg-slate-700 text-white shadow-2xs">
                N/A
              </span>
            ) : userGrade ? (
              <>
                <span className="text-sm sm:text-base font-black font-mono px-1.5 py-0.2 rounded bg-violet-600 text-white shadow-2xs">
                  {userGrade}
                </span>
                <span className="text-[10px] font-mono font-semibold text-violet-700 dark:text-violet-300">
                  ({userEval?.userScore?.toFixed(1)})
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-violet-500/70 font-mono leading-tight">—</span>
            )}
          </div>
        </div>

        {/* 2. LSV Column (Togglable) */}
        {showLsv && (
          <div className="p-1.5 sm:p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-800 dark:text-amber-300 font-mono">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>LSV</span>
              </div>
              {userGrade && !isBlindGrading && lsvRating && lsvDelta !== 0 && (
                <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-bold" title="Delta vs LSV">
                  Δ {lsvDelta > 0 ? `+${lsvDelta}` : lsvDelta}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1 mt-0.5">
              {userGrade && !isBlindGrading && lsvRating ? (
                <>
                  <span className="text-sm sm:text-base font-black font-mono px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 shadow-2xs">
                    {lsvRating.grade}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-300">
                    ({lsvRating.score.toFixed(1)})
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-mono leading-tight">
                  {isBlindGrading ? 'Hidden' : !userGrade ? '—' : 'Pending'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 3. 17L Column (Togglable) */}
        {show17L && (
          <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-mono">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>17L</span>
              </div>
              {landData && !isBlindGrading && (
                <a
                  href={get17LandsCardUrl(card.set, card, landData)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:underline inline-flex items-center"
                  title={`Open ${card.name} on 17lands.com`}
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            <div className="flex items-baseline gap-1 mt-0.5">
              {userGrade && actualGrade && !isBlindGrading ? (
                <>
                  <span className="text-sm sm:text-base font-black font-mono px-1.5 py-0.2 rounded bg-emerald-600 text-white shadow-2xs">
                    {actualGrade}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                    {((landData?.win_rate || 0) * 100).toFixed(1)}%
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-mono leading-tight">
                  {isBlindGrading ? 'Hidden' : !userGrade ? '—' : 'Syncing'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeComparisonCard;
