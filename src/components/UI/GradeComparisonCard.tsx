import React, { useState, useEffect } from 'react';
import { Card, GradeTier, SeventeenLandsCardRating, UserCardEvaluation, ProCreatorSource, PRO_CREATORS } from '../../types/mtg';
import { GRADE_TIERS, gradeTierToIndex, winRateToGradeTier, get17LandsCardUrl } from '../../services/seventeenLands';
import { getProRatingForCard } from '../../services/lsvRatings';
import { getPreferredCreators } from '../../services/storage';
import { Scale, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Sparkles, BarChart2, Award, ExternalLink } from 'lucide-react';

interface GradeComparisonCardProps {
  card: Card;
  userEval?: UserCardEvaluation | null;
  landData?: SeventeenLandsCardRating | null;
  isBlindGrading?: boolean;
  showMe?: boolean;
  showLsv?: boolean;
  showLlu?: boolean;
  showDs?: boolean;
  showLol?: boolean; // legacy alias
  show17L?: boolean;
  preferredCreators?: ProCreatorSource[];
  className?: string;
}

export const GradeComparisonCard: React.FC<GradeComparisonCardProps> = ({
  card,
  userEval,
  landData,
  isBlindGrading = false,
  showMe = true,
  showLsv = true,
  showLlu = true,
  showDs: explicitShowDs,
  showLol: legacyShowLol,
  show17L = true,
  preferredCreators: explicitCreators,
  className = '',
}) => {
  const showDs = explicitShowDs !== undefined ? explicitShowDs : legacyShowLol !== undefined ? legacyShowLol : true;
  const [activeCreators, setActiveCreators] = useState<ProCreatorSource[]>(() =>
    explicitCreators || getPreferredCreators()
  );

  useEffect(() => {
    if (explicitCreators) {
      setActiveCreators(explicitCreators);
      return;
    }
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ProCreatorSource[]>;
      if (custom.detail && Array.isArray(custom.detail)) {
        setActiveCreators(custom.detail);
      } else {
        setActiveCreators(getPreferredCreators());
      }
    };
    window.addEventListener('mtg_preferred_creators_changed', handler);
    return () => window.removeEventListener('mtg_preferred_creators_changed', handler);
  }, [explicitCreators]);

  const userGrade = userEval?.userGrade;
  const userIndex = userGrade ? gradeTierToIndex(userGrade) : -1;

  const actualGrade: GradeTier | null = landData
    ? ((landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate))
    : null;
  const actualIndex = actualGrade ? gradeTierToIndex(actualGrade) : -1;

  // Gap calculation (Me vs 17Lands)
  const tierDelta = (userIndex >= 0 && actualIndex >= 0) ? actualIndex - userIndex : 0;

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

  const isCreatorVisible = (creator: ProCreatorSource) => {
    if (creator === 'LSV') return showLsv;
    if (creator === 'LLU') return showLlu;
    if (creator === 'DS') return showDs;
    return true;
  };
  const creatorsToShow = activeCreators.filter(isCreatorVisible);
  const visibleColumnsCount = (showMe ? 1 : 0) + creatorsToShow.length + (show17L ? 1 : 0);
  const gridColsClass =
    visibleColumnsCount >= 5
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      : visibleColumnsCount === 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : visibleColumnsCount === 3
      ? 'grid-cols-3'
      : visibleColumnsCount === 2
      ? 'grid-cols-2'
      : 'grid-cols-1';

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

      {/* Dynamic 5-Column Grid: Me + Pro Creators (LSV, LLU, DS) + 17Lands */}
      <div className={`grid gap-1.5 sm:gap-2 ${gridColsClass}`}>
        {/* 1. ME Column */}
        {showMe && (
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
        )}

        {/* 2. Pro Creator Columns (LSV, LLU, DS) */}
        {creatorsToShow.map((creator) => {
            const meta = PRO_CREATORS[creator] || PRO_CREATORS.LSV;
            const rating = getProRatingForCard(card, creator, card.set);
            const creatorIndex = rating ? gradeTierToIndex(rating.grade) : -1;
            const creatorDelta = (userIndex >= 0 && creatorIndex >= 0) ? creatorIndex - userIndex : 0;

            return (
              <div
                key={creator}
                className={`p-1.5 sm:p-2 rounded-lg ${meta.badgeBg} border ${meta.badgeBorder} flex flex-col justify-between`}
              >
                <div className={`flex items-center justify-between text-[10px] font-bold ${meta.badgeText} font-mono`}>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor} shrink-0`} />
                    <span>{meta.shortName}</span>
                  </div>
                  {userGrade && !isBlindGrading && rating && creatorDelta !== 0 && (
                    <span className="text-[9px] font-mono opacity-80 font-bold" title={`Delta vs ${meta.shortName}`}>
                      Δ {creatorDelta > 0 ? `+${creatorDelta}` : creatorDelta}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mt-0.5">
                  {rating && (!isBlindGrading || userGrade) ? (
                    <>
                      <span className={`text-sm sm:text-base font-black font-mono px-1.5 py-0.2 rounded ${meta.dotColor} text-white shadow-2xs`}>
                        {rating.grade}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold ${meta.badgeText}`}>
                        ({rating.score.toFixed(1)})
                      </span>
                    </>
                  ) : (
                    <span className={`text-[10px] font-mono leading-tight opacity-70 ${meta.badgeText}`}>
                      {isBlindGrading && !userGrade ? '—' : isBlindGrading ? 'Hidden' : 'Pending'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

        {/* 4. 17L Column (Always 4th Static Column) */}
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
              {actualGrade && (!isBlindGrading || userGrade) ? (
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
                  {isBlindGrading && !userGrade ? '—' : isBlindGrading ? 'Hidden' : landData ? 'Syncing' : 'Pending'}
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

