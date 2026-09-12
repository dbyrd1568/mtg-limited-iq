import React, { useState, useMemo, useEffect } from 'react';
import { Card, MTGColor, MTGRarity, SeventeenLandsSetData, UserCardEvaluation, GradeTier, SetCalibrationSummary, SetInfo, UserAccount } from '../../types/mtg';
import {
  GRADE_TIERS,
  GRADE_SCORES,
  calculateSetCalibration,
  calculateColorAccuracyAnalytics,
  calculateRarityAccuracyAnalytics,
  calculateGradeDistribution,
  winRateToGradeTier,
  gradeTierToIndex,
  getColorSortIndex,
  getRaritySortIndex,
  get17LandsCardRating,
} from '../../services/seventeenLands';
import { getBlindGradingForSet, setBlindGradingForSet } from '../../services/storage';
import { getLsvRatingForCard } from '../../services/lsvRatings';
import { CardObfuscator } from '../CardObfuscator';
import { QuickRateModal } from './QuickRateModal';
import { SimilarCardsModal } from './SimilarCardsModal';
import { ClearSetRatingsModal } from '../UI/ClearSetRatingsModal';
import { ArchetypeForecastView } from './ArchetypeForecastView';
import { MethodologyGuideView } from './MethodologyGuideView';
import { Trophy, Award, Filter, Search, Zap, Check, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, ChevronRight, BarChart2, ShieldCheck, FileText, Eye, EyeOff, Scale, BookOpen, Activity, Calculator, ChevronDown, ChevronUp, X, Trash2, Target, PlayingCardsFan, Share2 } from 'lucide-react';
import { ExportGradesModal } from './ExportGradesModal';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { parseAppUrlParams, updateAppUrlParams, findCardByUrlIdentifier } from '../../services/urlParams';
import { SetBadge, SetSymbol } from '../UI/SetSymbol';
import { ManaColorFilterBar, cardMatchesColorFilter, cardMatchesRoleFilter } from '../UI/ManaColorFilterBar';
import { CardSearchBar } from '../Search/CardSearchBar';
import { cardMatchesQuery } from '../../services/cardSearchParser';

interface EvaluationHubProps {
  cards: Card[];
  currentSetCode: string;
  currentSetName: string;
  currentSet?: SetInfo | null;
  currentUser?: UserAccount | null;
  userEvaluations: Record<string, UserCardEvaluation>;
  seventeenLandsData: SeventeenLandsSetData | null;
  isBlindGrading?: boolean;
  onToggleBlindGrading?: () => void;
  onSaveEvaluation: (evaluation: UserCardEvaluation) => void;
  onClearEvaluationsForSet?: (setCode: string) => void;
  onOpenSetSelector: () => void;
  // Shared filter state (synced with Cards tab)
  searchQuery?: string;
  selectedColors?: string[];
  selectedRarities?: string[];
  selectedRoles?: string[];
  onSearchQueryChange?: (q: string) => void;
  onSelectedColorsChange?: (c: string[]) => void;
  onSelectedRaritiesChange?: (r: string[]) => void;
  onSelectedRolesChange?: (r: string[]) => void;
}

export const EvaluationHub: React.FC<EvaluationHubProps> = ({
  cards,
  currentSetCode,
  currentSetName,
  currentSet,
  currentUser,
  userEvaluations,
  seventeenLandsData,
  isBlindGrading: propIsBlindGrading,
  onToggleBlindGrading: propOnToggleBlindGrading,
  onSaveEvaluation,
  onClearEvaluationsForSet,
  onOpenSetSelector,
  searchQuery: propSearchQuery,
  selectedColors: propSelectedColors,
  selectedRarities: propSelectedRarities,
  selectedRoles: propSelectedRoles,
  onSearchQueryChange,
  onSelectedColorsChange,
  onSelectedRaritiesChange,
  onSelectedRolesChange,
}) => {
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  // Only use authentic 17Lands data with sufficient sample size and matching setCode
  const effective17LandsData = useMemo(() => {
    if (
      seventeenLandsData &&
      seventeenLandsData.setCode?.toUpperCase() === currentSetCode.toUpperCase() &&
      (seventeenLandsData.sampleSize || 0) > 500 &&
      Object.keys(seventeenLandsData.cards || {}).length >= 5
    ) {
      const hasMatchingCards = cards.length === 0 || cards.some((c) => {
        const rating = get17LandsCardRating(c, seventeenLandsData);
        return (rating?.game_count || 0) > 0;
      });
      if (hasMatchingCards) {
        return seventeenLandsData;
      }
    }
    return null;
  }, [seventeenLandsData, currentSetCode, cards]);


  const [activeSubTab, setActiveSubTab] = useState<'grade' | 'forecast' | 'calibration' | 'notes' | 'methodology'>(() => {
    const params = parseAppUrlParams();
    if (params.subtab === 'forecast' || params.subtab === 'calibration' || params.subtab === 'notes' || params.subtab === 'methodology') {
      return params.subtab;
    }
    return 'grade';
  });
  const [searchQuery, setSearchQuery] = useState<string>(propSearchQuery ?? '');
  const [selectedColors, setSelectedColors] = useState<string[]>(propSelectedColors ?? ['ALL']);
  const [selectedRarities, setSelectedRarities] = useState<string[]>(propSelectedRarities ?? ['ALL']);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(propSelectedRoles ?? ['ALL']);

  // Keep local state in sync with prop changes (tab switch carries filters over)
  useEffect(() => { if (propSearchQuery !== undefined) setSearchQuery(propSearchQuery); }, [propSearchQuery]);
  useEffect(() => { if (propSelectedColors !== undefined) setSelectedColors(propSelectedColors); }, [propSelectedColors]);
  useEffect(() => { if (propSelectedRarities !== undefined) setSelectedRarities(propSelectedRarities); }, [propSelectedRarities]);
  useEffect(() => { if (propSelectedRoles !== undefined) setSelectedRoles(propSelectedRoles); }, [propSelectedRoles]);

  // Proxy setters — update local state and notify parent
  const handleSearchQuery = (q: string) => { setSearchQuery(q); onSearchQueryChange?.(q); };
  const handleSelectedColors = (c: string[]) => { setSelectedColors(c); onSelectedColorsChange?.(c); };
  const handleSelectedRarities = (r: string[]) => { setSelectedRarities(r); onSelectedRaritiesChange?.(r); };
  const handleSelectedRoles = (r: string[]) => { setSelectedRoles(r); onSelectedRolesChange?.(r); };

  const [filterRatedStatus, setFilterRatedStatus] = useState<'ALL' | 'RATED' | 'UNRATED'>('ALL');
  const [comparisonSelectedColor, setComparisonSelectedColor] = useState<string>('ALL');
  const [comparisonVerdictFilter, setComparisonVerdictFilter] = useState<string>('ALL');
  const [selectedCardForModal, setSelectedCardForModal] = useState<Card | null>(null);
  const [similarCardsModalCard, setSimilarCardsModalCard] = useState<Card | null>(null);
  const [cardListSortBy, setCardListSortBy] = useState<'number' | 'name' | 'color' | 'rarity' | 'winrate'>('number');
  const [comparisonSortBy, setComparisonSortBy] = useState<'number' | 'delta_desc' | 'delta_asc' | 'winrate' | 'name'>('number');
  const [showMathExplainer, setShowMathExplainer] = useState<boolean>(false);
  const [showLsv, setShowLsv] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_show_lsv');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [show17L, setShow17L] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_show_17l');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const handleToggleLsv = () => {
    setShowLsv((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mtg_show_lsv', String(next));
      }
      return next;
    });
  };

  const handleToggle17L = () => {
    setShow17L((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mtg_show_17l', String(next));
      }
      return next;
    });
  };

  const [gradeDisplayMode, setGradeDisplayMode] = useState<'my_grade' | '17lands' | 'side_by_side'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_grade_display_mode');
      if (saved === 'my_grade' || saved === '17lands' || saved === 'side_by_side') {
        return saved;
      }
    }
    return 'side_by_side';
  });
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);

  const handleSetGradeDisplayMode = (mode: 'my_grade' | '17lands' | 'side_by_side') => {
    setGradeDisplayMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mtg_grade_display_mode', mode);
    }
  };

  // Sync activeSubTab to URL params
  useEffect(() => {
    updateAppUrlParams({ subtab: activeSubTab });
  }, [activeSubTab]);

  // If set has no 17Lands data and user is on calibration tab, fallback to grade tab
  useEffect(() => {
    if (!effective17LandsData && activeSubTab === 'calibration') {
      setActiveSubTab('grade');
    }
  }, [effective17LandsData, activeSubTab]);

  // Deep-link / troubleshooting: auto-open card specified in URL query
  useEffect(() => {
    if (cards.length === 0) return;
    const params = parseAppUrlParams();
    if (params.card && !selectedCardForModal) {
      const matched = findCardByUrlIdentifier(cards, params.card);
      if (matched) {
        setSelectedCardForModal(matched);
      }
    }
  }, [cards]);

  const handleSelectCardForModal = (card: Card | null) => {
    setSelectedCardForModal(card);
    updateAppUrlParams({
      card: card ? card.collector_number || card.name : undefined,
    });
  };

  // Blind grading state persisted per set in local storage (or controlled by parent)
  const [internalBlindGrading, setInternalBlindGrading] = useState<boolean>(() => {
    return getBlindGradingForSet(currentSetCode, undefined, cards.length);
  });

  // Sync internal blind grading preference when set changes
  useEffect(() => {
    setInternalBlindGrading(getBlindGradingForSet(currentSetCode, undefined, cards.length));
  }, [currentSetCode, cards.length]);

  const isBlindGrading = propIsBlindGrading !== undefined ? propIsBlindGrading : internalBlindGrading;

  const handleToggleBlindGrading = () => {
    if (propOnToggleBlindGrading) {
      propOnToggleBlindGrading();
    } else {
      const nextState = !internalBlindGrading;
      setInternalBlindGrading(nextState);
      setBlindGradingForSet(currentSetCode, nextState);
    }
  };

  // Compute calibration summary using effective 17lands data
  const calibrationSummary: SetCalibrationSummary = useMemo(() => {
    return calculateSetCalibration(cards, userEvaluations, effective17LandsData);
  }, [cards, userEvaluations, effective17LandsData]);

  // Compute advanced color analytics
  const colorAnalytics = useMemo(() => {
    return calculateColorAccuracyAnalytics(cards, userEvaluations, effective17LandsData);
  }, [cards, userEvaluations, effective17LandsData]);

  // Compute grade distribution curve
  const gradeDistribution = useMemo(() => {
    return calculateGradeDistribution(cards, userEvaluations, effective17LandsData);
  }, [cards, userEvaluations, effective17LandsData]);

  // Filter and sort cards for Grade tab
  const filteredCards = useMemo(() => {
    let result = cards.filter((c) => {
      const evalKey = `${c.set.toLowerCase()}_${c.name.toLowerCase()}`;
      const hasEval = Boolean(userEvaluations[evalKey]);

      if (filterRatedStatus === 'RATED' && !hasEval) return false;
      if (filterRatedStatus === 'UNRATED' && hasEval) return false;

      if (searchQuery) {
        if (!cardMatchesQuery(c, searchQuery, currentSetCode, userEvaluations[evalKey]?.notes)) return false;
      }

      if (!cardMatchesColorFilter(c, selectedColors)) return false;

      if (!selectedRarities.includes('ALL') && selectedRarities.length > 0) {
        const cardRarity = (c.rarity || '').toLowerCase();
        if (!selectedRarities.map((r) => r.toLowerCase()).includes(cardRarity)) {
          return false;
        }
      }

      if (!cardMatchesRoleFilter(c, selectedRoles)) return false;

      return true;
    });

    result.sort((a, b) => {
      if (cardListSortBy === 'number') {
        return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
      }
      if (cardListSortBy === 'name') return a.name.localeCompare(b.name);
      if (cardListSortBy === 'color') {
        const diff = getColorSortIndex(a) - getColorSortIndex(b);
        if (diff !== 0) return diff;
        return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
      }
      if (cardListSortBy === 'rarity') {
        const diff = getRaritySortIndex(a.rarity) - getRaritySortIndex(b.rarity);
        if (diff !== 0) return diff;
        return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
      }
      if (cardListSortBy === 'winrate') {
        const wrA = effective17LandsData?.cards[a.name]?.win_rate || 0.5;
        const wrB = effective17LandsData?.cards[b.name]?.win_rate || 0.5;
        return wrB - wrA;
      }
      return 0;
    });

    return result;
  }, [cards, searchQuery, selectedColors, selectedRarities, selectedRoles, filterRatedStatus, userEvaluations, cardListSortBy, effective17LandsData]);

  // Comparison Matrix for Analytics Tab
  const comparisonList = useMemo(() => {
    const list = cards.map((card) => {
      const evalKey = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
      const userEval = userEvaluations[evalKey];
      const landData = effective17LandsData?.cards ? effective17LandsData.cards[card.name] : undefined;

      let tierGap = 0;
      let actualTier: GradeTier | null = null;

      if (landData && typeof landData.win_rate === 'number') {
        actualTier = (landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate);
      }

      if (userEval && actualTier) {
        const userIndex = gradeTierToIndex(userEval.userGrade);
        const seventeenIndex = gradeTierToIndex(actualTier);
        tierGap = seventeenIndex - userIndex;
      }

      return {
        card,
        userEval,
        landData,
        tierGap,
        userGrade: userEval?.userGrade,
        actualTier,
        winRate: landData?.win_rate,
        isRated: Boolean(userEval),
      };
    });

    list.sort((a, b) => {
      if (comparisonSortBy === 'number') {
        return parseInt(a.card.collector_number || '0') - parseInt(b.card.collector_number || '0');
      }
      if (comparisonSortBy === 'delta_desc') return b.tierGap - a.tierGap;
      if (comparisonSortBy === 'delta_asc') return a.tierGap - b.tierGap;
      if (comparisonSortBy === 'winrate') return (b.winRate || 0) - (a.winRate || 0);
      return a.card.name.localeCompare(b.card.name);
    });

    return list;
  }, [cards, userEvaluations, effective17LandsData, comparisonSortBy]);

  const filteredComparisonList = useMemo(() => {
    return comparisonList.filter((item) => {
      const c = item.card;
      if (comparisonSelectedColor !== 'ALL') {
        if (comparisonSelectedColor === 'GOLD' || comparisonSelectedColor === 'MULTI') {
          if (c.colors.length <= 1) return false;
        } else if (comparisonSelectedColor === 'COLORLESS') {
          if (c.colors.length > 0 || c.type_line?.toLowerCase().includes('land')) return false;
        } else if (comparisonSelectedColor === 'LANDS') {
          if (!c.type_line?.toLowerCase().includes('land')) return false;
        } else {
          if (c.colors.length !== 1 || !c.colors.includes(comparisonSelectedColor as MTGColor)) return false;
        }
      }

      if (comparisonVerdictFilter !== 'ALL') {
        if (comparisonVerdictFilter === 'EXACT' && item.tierGap !== 0) return false;
        if (comparisonVerdictFilter === 'TOLERANCE' && Math.abs(item.tierGap) > 1) return false;
        if (comparisonVerdictFilter === 'MINOR' && Math.abs(item.tierGap) !== 2) return false;
        if (comparisonVerdictFilter === 'TRAPS' && item.tierGap < 2) return false;
        if (comparisonVerdictFilter === 'SLEEPERS' && item.tierGap > -2) return false;
        if (comparisonVerdictFilter === 'RATED' && !item.isRated) return false;
        if (comparisonVerdictFilter === 'UNRATED' && item.isRated) return false;
      }

      return true;
    });
  }, [comparisonList, comparisonSelectedColor, comparisonVerdictFilter]);

  const ratedCountInSet = cards.filter(
    (c) => userEvaluations[`${c.set.toLowerCase()}_${c.name.toLowerCase()}`]
  ).length;

  const ratedPercentage = cards.length > 0 ? Math.round((ratedCountInSet / cards.length) * 100) : 0;

  const handleQuickGrade = (card: Card, tier: GradeTier) => {
    const priority = tier.startsWith('A')
      ? '1st Pick Bomb'
      : tier.startsWith('B')
      ? 'Early Pick'
      : tier.startsWith('C')
      ? 'Mid Pick'
      : tier === 'D'
      ? 'Late Filler'
      : 'Sideboard / Unplayable';

    const evalKey = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
    const existingEval = userEvaluations[evalKey];

    const evaluation: UserCardEvaluation = {
      cardId: card.id,
      cardName: card.name,
      setCode: card.set,
      userGrade: tier,
      userScore: GRADE_SCORES[tier] || 2.5,
      pickPriority: priority,
      notes: existingEval?.notes,
      updatedAt: new Date().toISOString(),
    };

    onSaveEvaluation(evaluation);
  };

  const formatTierGapVerdict = (gap: number) => {
    if (gap === 0) {
      return { text: '🎯 Exact Match vs 17Lands', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 font-bold', isCorrect: true };
    }
    if (gap === 1) {
      return { text: '✓ +1 Step Over 17Lands (Within Tolerance)', color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 font-semibold', isCorrect: true };
    }
    if (gap === -1) {
      return { text: '✓ -1 Step Under 17Lands (Within Tolerance)', color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 font-semibold', isCorrect: true };
    }
    if (gap === 2) {
      return { text: '+2 Over 17Lands (Minor Trap)', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 font-semibold', isCorrect: false };
    }
    if (gap === -2) {
      return { text: '-2 Under 17Lands (Minor Sleeper)', color: 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 font-semibold', isCorrect: false };
    }
    if (gap >= 3) {
      return { text: `+${gap} Over 17Lands (Major Trap 🔥)`, color: 'bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/50 font-bold', isCorrect: false };
    }
    return { text: `${gap} Under 17Lands (Major Sleeper 🧊)`, color: 'bg-blue-100 dark:bg-blue-500/25 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/50 font-bold', isCorrect: false };
  };

  const getTierBadgeColor = (tier: GradeTier) => {
    if (tier.startsWith('A')) return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 font-bold';
    if (tier.startsWith('B')) return 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold';
    if (tier.startsWith('C')) return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-bold';
    if (tier === 'D') return 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40 font-bold';
    return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 font-bold';
  };

  return (
    <div className="max-w-[1440px] mx-auto py-4 px-3 sm:px-6 space-y-4 animate-in fade-in duration-200">
      {/* UNIFIED TOP-DOCKED CONTROL BAR (Single row, no-wrap, responsive) */}
      <div className="flex flex-row items-center justify-between gap-2.5 p-2.5 sm:p-3.5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-x-auto no-scrollbar">
        {/* Left: Sub-tabs (No icons, text-only pills) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#060a1d] p-1 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-xs shrink-0">
            <button
              onClick={() => setActiveSubTab('grade')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'grade'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Grade Cards
            </button>

            <button
              onClick={() => setActiveSubTab('forecast')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'forecast'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Archetype Forecast
            </button>

            {effective17LandsData && (
              <button
                onClick={() => setActiveSubTab('calibration')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSubTab === 'calibration'
                    ? 'bg-violet-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                Grade vs 17Lands {calibrationSummary.totalRated > 0 ? `(${calibrationSummary.calibrationScore}%)` : ''}
              </button>
            )}

            <button
              onClick={() => setActiveSubTab('notes')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'notes'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Draft Notes
            </button>

            <button
              onClick={() => setActiveSubTab('methodology')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'methodology'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Analytics & Math Guide
            </button>
          </div>
        </div>

        {/* Right: Export & Share, Clear Grades, Blind Mode Toggle & Rapid Grader Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-violet-700 dark:text-cyan-300 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800/60 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            title="Export comparison spreadsheet or send grades to 17Lands"
          >
            <Share2 className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
            <span>Export & Share</span>
          </button>

          {onClearEvaluationsForSet && ratedCountInSet > 0 && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title={`Clear all your grades for ${currentSetCode.toUpperCase()}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Clear Grades ({ratedCountInSet})</span>
            </button>
          )}

          {effective17LandsData ? (
            <button
              type="button"
              onClick={handleToggleBlindGrading}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer min-w-[112px] shrink-0 whitespace-nowrap ${
                isBlindGrading
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
              }`}
              title={isBlindGrading ? 'Grading Mode: Benchmarks hidden. Click to switch to Compare Mode' : 'Compare Mode: 17Lands data visible. Click to switch to Grading Mode'}
            >
              {isBlindGrading ? <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
              <span>{isBlindGrading ? 'Grading Mode' : 'Compare Mode'}</span>
            </button>
          ) : (
            <div
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-[#050818] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 shrink-0 whitespace-nowrap flex items-center gap-1.5"
              title="17Lands data is available approximately 2 weeks after release"
            >
              <EyeOff className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
              <span>17L Data: TBD</span>
            </div>
          )}

          <button
            onClick={() => {
              const firstUngraded = cards.find(
                (c) => !userEvaluations[`${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`]
              );
              handleSelectCardForModal(firstUngraded || cards[0] || null);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider font-heading transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border border-violet-400/40 shrink-0 whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5 fill-white shrink-0" />
            <span>Rapid Grader</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: Grade Cards List & Filter */}
      {activeSubTab === 'grade' && (
        <div className="space-y-4">
          {/* Comprehensive Filter Toolbar */}
          <div className="p-3 sm:p-3.5 bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xs space-y-2.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              {/* Card Search Bar (Scryfall & Arena-style) */}
              <div className="flex-1 max-w-xl">
                <CardSearchBar
                  query={searchQuery}
                  onChangeQuery={handleSearchQuery}
                  currentSetCode={currentSetCode}
                  currentSetName={currentSetName}
                  matchCount={filteredCards.length}
                  totalCount={cards.length}
                  placeholder="Search cards (e.g. flying, t:creature, c<=rg)..."
                />
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Sort:
                </span>
                <select
                  value={cardListSortBy}
                  onChange={(e) => setCardListSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 cursor-pointer font-mono"
                >
                  <option value="number">Card # (#001 → #300)</option>
                  <option value="name">Card Name (A → Z)</option>
                  <option value="color">Color (WUBRG Order)</option>
                  <option value="rarity">Rarity (Mythic → Common)</option>
                  {effective17LandsData && <option value="winrate">17Lands Win Rate</option>}
                </select>
              </div>

              {/* Evaluation Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'UNRATED', label: 'Ungraded' },
                  { id: 'RATED', label: 'Graded' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setFilterRatedStatus(st.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      filterRatedStatus === st.id
                        ? 'bg-violet-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Rating Source Toggle Controls (Me, LSV, 17L) */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 px-1 hidden md:inline">
                  Sources:
                </span>

                {/* 1. Me (Always Active / Locked) */}
                <button
                  type="button"
                  disabled
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-600 text-white shadow-xs border border-violet-400/40 flex items-center gap-1 cursor-default"
                  title="Your personal grade (Always active)"
                >
                  <Check className="w-3 h-3 text-white" />
                  <span>Me</span>
                </button>

                {/* 2. LSV (Togglable) */}
                <button
                  type="button"
                  onClick={handleToggleLsv}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    showLsv
                      ? 'bg-amber-500 text-slate-950 shadow-xs border border-amber-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border border-transparent'
                  }`}
                  title="Toggle LSV (Limited Resources / Expert Pre-release) rating"
                >
                  {showLsv && <Check className="w-3 h-3 text-slate-950" />}
                  <span>LSV</span>
                </button>

                {/* 3. 17L (Togglable) */}
                <button
                  type="button"
                  onClick={handleToggle17L}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    show17L
                      ? 'bg-emerald-600 text-white shadow-xs border border-emerald-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border border-transparent'
                  }`}
                  title="Toggle 17Lands draft data"
                >
                  {show17L && <Check className="w-3 h-3 text-white" />}
                  <span>17L</span>
                </button>
              </div>
            </div>

            {/* Colors, Roles, and Rarities Filter Row */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Mana Color Filter Bar with Official Arena Glow */}
              <ManaColorFilterBar selectedColors={selectedColors} onSelectColors={handleSelectedColors} />

              {/* Rarity Filter Pills (Multi-Select) */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                {['ALL', 'common', 'uncommon', 'rare', 'mythic'].map((rar) => {
                  const isSelected = (rar === 'ALL' && (selectedRarities.includes('ALL') || selectedRarities.length === 0)) ||
                    (rar !== 'ALL' && selectedRarities.includes(rar));
                  return (
                    <button
                      key={rar}
                      onClick={() => {
                        if (rar === 'ALL') {
                          handleSelectedRarities(['ALL']);
                          return;
                        }
                        const current = selectedRarities.filter((r) => r !== 'ALL');
                        if (current.includes(rar)) {
                          const next = current.filter((r) => r !== rar);
                          handleSelectedRarities(next.length === 0 ? ['ALL'] : next);
                        } else {
                          handleSelectedRarities([...current, rar]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-violet-600 text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {rar === 'ALL' ? 'All' : rar}
                    </button>
                  );
                })}
              </div>

              {/* Tactical Roles */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'CREATURE', label: 'Creatures' },
                  { id: 'INSTANT', label: 'Instants' },
                  { id: 'TRICK', label: 'Tricks' },
                  { id: 'REMOVAL', label: 'Removal' },
                ].map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      if (role.id === 'ALL') { handleSelectedRoles(['ALL']); return; }
                      const current = selectedRoles.filter(r => r !== 'ALL');
                      if (current.includes(role.id)) {
                        const next = current.filter(r => r !== role.id);
                        handleSelectedRoles(next.length === 0 ? ['ALL'] : next);
                      } else {
                        handleSelectedRoles([...current, role.id]);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      (role.id === 'ALL' && (selectedRoles.includes('ALL') || selectedRoles.length === 0)) ||
                      (role.id !== 'ALL' && selectedRoles.includes(role.id))
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Persistent Filter Display Counter */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Displaying <strong className="text-violet-700 dark:text-cyan-300 font-black">{filteredCards.length}</strong> of <strong>{cards.length}</strong> cards
                </span>
                {(!selectedColors.includes('ALL') || !selectedRarities.includes('ALL') || !selectedRoles.includes('ALL') || filterRatedStatus !== 'ALL' || searchQuery.trim() !== '') && (
                  <span className="text-violet-600 dark:text-cyan-400 font-semibold">
                    (filtered)
                  </span>
                )}
              </div>

              {(!selectedColors.includes('ALL') || !selectedRarities.includes('ALL') || !selectedRoles.includes('ALL') || filterRatedStatus !== 'ALL' || searchQuery.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectedColors(['ALL']);
                    handleSelectedRarities(['ALL']);
                    handleSelectedRoles(['ALL']);
                    setFilterRatedStatus('ALL');
                    handleSearchQuery('');
                  }}
                  className="text-[11px] font-mono text-violet-700 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCards.map((card) => {
              const evalKey = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
              const userEval = userEvaluations[evalKey];
              const landData = get17LandsCardRating(card, effective17LandsData) || undefined;

              return (
                <div
                  key={card.id}
                  onClick={() => handleSelectCardForModal(card)}
                  className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/60 dark:hover:border-violet-500/60 transition-all flex flex-col justify-between gap-3.5 shadow-xs hover:shadow-md cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 flex flex-col items-start w-[185px]">
                      {/* Top Bar above card: Grade badge(s) in a single horizontal non-wrapping row */}
                      <div className="w-full flex items-center gap-1 mb-1.5 min-h-[22px] overflow-hidden">
                        <div className="flex items-center gap-1 flex-nowrap whitespace-nowrap">
                          {(() => {
                            const actualTier: GradeTier | null = landData
                              ? ((landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate))
                              : null;
                            const hasUserGrade = Boolean(userEval?.userGrade);
                            const lsvRating = getLsvRatingForCard(card);

                            return (
                              <>
                                {/* 1. Me Badge (Always Visible) */}
                                <div
                                  className="px-1.5 py-0.5 rounded-md bg-violet-950/95 text-white border border-violet-400 shadow-xs flex items-center gap-1 font-mono shrink-0 whitespace-nowrap"
                                  title="Your assigned grade"
                                >
                                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-violet-300">Me</span>
                                  <span className="text-[11px] font-black">{hasUserGrade ? userEval!.userGrade : '—'}</span>
                                </div>

                                {/* 2. LSV Badge (Togglable) */}
                                {showLsv && (
                                  <div
                                    className="px-1.5 py-0.5 rounded-md bg-amber-950/95 text-white border border-amber-400 shadow-xs flex items-center gap-1 font-mono shrink-0 whitespace-nowrap"
                                    title={!hasUserGrade ? 'Rate the card to see how you compare' : (isBlindGrading ? 'LSV Rating (hidden in grading mode)' : lsvRating ? `LSV Rating: ${lsvRating.score.toFixed(1)} / 5.0 (${lsvRating.grade}) - ${lsvRating.verdict || 'Playable'}` : 'LSV Review pending (set not yet rated)')}
                                  >
                                    <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-300">LSV</span>
                                    <span className="text-[11px] font-black text-amber-200">{!hasUserGrade || isBlindGrading ? '—' : (lsvRating ? lsvRating.grade : '—')}</span>
                                  </div>
                                )}

                                {/* 3. 17L Badge (Togglable) */}
                                {show17L && (
                                  <div
                                    className={`px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 font-mono shrink-0 whitespace-nowrap ${
                                      actualTier
                                        ? 'bg-emerald-950/95 text-white border border-emerald-400'
                                        : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                                    }`}
                                    title={!hasUserGrade ? 'Rate the card to see how you compare' : (actualTier ? (isBlindGrading ? '17Lands grade (hidden in grading mode)' : `17Lands: ${actualTier}`) : '17Lands data is available approximately 2 weeks after release')}
                                  >
                                    <span className={`text-[8px] uppercase tracking-wider font-extrabold ${actualTier ? 'text-emerald-300' : 'text-slate-500'}`}>17L</span>
                                    <span className={`text-[11px] font-black ${actualTier ? 'text-emerald-200' : 'text-amber-500/80'}`}>
                                      {!hasUserGrade || isBlindGrading ? '—' : (actualTier || 'TBD')}
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <CardObfuscator
                        card={card}
                        obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                        size="sm"
                      />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-200 transition-colors truncate">{card.name}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold">
                            #{card.collector_number}
                          </span>
                          {card.mana_cost && (
                            <ManaCostRenderer manaCost={card.mana_cost} size="xs" />
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-violet-700 dark:text-cyan-300 font-mono">{card.type_line}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        {card.oracle_text || 'No oracle text.'}
                      </p>

                      {/* Evaluation Verdict & 17Lands Stats */}
                      {!userEval?.userGrade ? (
                        /* Card is Ungraded: Simple invite */
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-dashed border-slate-200 dark:border-slate-800 text-center">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Rate the card to see how you compare
                          </span>
                        </div>
                      ) : isBlindGrading ? (
                        /* Graded in Grading Mode */
                        <div
                          onClick={handleToggleBlindGrading}
                          className="mt-2 px-3 py-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 border border-amber-200/60 dark:border-amber-500/30 text-xs font-mono flex items-center justify-between gap-4 cursor-pointer transition-colors"
                          title="Click to switch to Compare Mode and reveal 17Lands benchmarks"
                        >
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 shrink-0 whitespace-nowrap">
                            <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Grading Mode</span>
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 text-right leading-tight">
                            Compare Mode reveals 17Lands data
                          </span>
                        </div>
                      ) : (
                        /* Graded in Compare Mode: Clean single-panel display */
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                          {landData ? (() => {
                            const actualTier: GradeTier = (landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate);
                            const gap = gradeTierToIndex(actualTier) - gradeTierToIndex(userEval.userGrade);
                            const verdict = formatTierGapVerdict(gap);

                            return (
                              <>
                                {/* 17Lands empirical metrics (no redundant tier grade, as it's in the top badge) */}
                                <div className="flex items-center justify-between gap-1 text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                                  <span>
                                    GIH WR: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{((landData.win_rate || 0) * 100).toFixed(1)}%</strong>
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700">•</span>
                                  <span>
                                    ALSA: <strong className="font-bold text-slate-900 dark:text-white">{typeof landData.avg_seen === 'number' ? landData.avg_seen.toFixed(1) : '-'}</strong>
                                  </span>
                                  {typeof landData.iwd === 'number' && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-700">•</span>
                                      <span>
                                        IWD: <strong className={`font-bold ${landData.iwd >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{landData.iwd >= 0 ? '+' : ''}{(landData.iwd * 100).toFixed(1)}%</strong>
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Comparison Verdict Banner */}
                                <div className={`px-2 py-1 rounded-lg text-[10px] font-bold border text-center ${verdict.color}`}>
                                  {verdict.text}
                                </div>
                              </>
                            );
                          })() : (
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>17Lands: <strong className="text-amber-600 dark:text-amber-400 font-semibold">Data Pending</strong></span>
                            </div>
                          )}

                          {/* LSV Reference: Score & Verdict (grade already in top badge) */}
                          {showLsv && (() => {
                            const lsvRating = getLsvRatingForCard(card);
                            return (
                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 font-mono">
                                <span>LSV: <strong>{lsvRating ? `${lsvRating.score.toFixed(1)} / 5.0` : 'Pending'}</strong></span>
                                <span className="italic truncate font-sans">{lsvRating?.verdict || 'Review pending'}</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* User Notes Snippet */}
                      {userEval?.notes && (
                        <div className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-cyan-200/90 flex items-start gap-1.5">
                          <FileText className="w-3 h-3 text-violet-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 italic leading-relaxed">"{userEval.notes}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Find Similar Cards Icon Button - Sitting right above the HR lined up with F */}
                  <div className="flex justify-end -mb-2 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSimilarCardsModalCard(card);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-violet-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                      title="Find similar cards (Precedent Engine)"
                    >
                      <PlayingCardsFan className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Grade Selector Bar */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold">
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold" title="Grade Point Values: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                        <span>Rate Card:</span>
                      </span>
                    </div>

                    <div
                      className="grid grid-cols-11 gap-0.5"
                      title="Grade Point Values: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5"
                    >
                      {GRADE_TIERS.map((tier) => {
                        const isSelected = userEval?.userGrade === tier;
                        let color = 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-[#050818] dark:text-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600';
                        if (tier.startsWith('A')) color = 'bg-amber-100 text-amber-950 border-amber-300 font-bold dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 hover:bg-amber-500 hover:text-white';
                        if (tier.startsWith('B')) color = 'bg-cyan-100 text-cyan-950 border-cyan-300 font-bold dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30 hover:bg-cyan-500 hover:text-white';
                        if (tier.startsWith('C')) color = 'bg-slate-100 text-slate-900 border-slate-300 font-bold dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/50 hover:bg-slate-600 hover:text-white';
                        if (tier === 'D') color = 'bg-orange-100 text-orange-950 border-orange-300 font-bold dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30 hover:bg-orange-500 hover:text-white';
                        if (tier === 'F') color = 'bg-rose-100 text-rose-950 border-rose-300 font-bold dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30 hover:bg-rose-500 hover:text-white';

                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickGrade(card, tier);
                            }}
                            className={`py-1 rounded-md text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-violet-600 text-white border-violet-400 font-black shadow-xs'
                                : color
                            }`}
                          >
                            {tier}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: Archetype & Color Power Synthesis Forecast */}
      {activeSubTab === 'forecast' && (
        <ArchetypeForecastView
          cards={cards}
          userEvaluations={userEvaluations}
          seventeenLandsData={effective17LandsData}
          isBlindGrading={isBlindGrading}
          setCode={currentSetCode}
          setName={currentSetName}
          onSelectCard={handleSelectCardForModal}
          onOpenRapidGrader={() => {
            const firstUngraded = cards.find(
              (c) => !userEvaluations[`${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`]
            );
            handleSelectCardForModal(firstUngraded || cards[0] || null);
          }}
        />
      )}

      {/* SUBTAB 3: In-Depth Grade vs 17Lands Analytics */}
      {activeSubTab === 'calibration' && (
        !effective17LandsData ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 text-center space-y-4 shadow-xs max-w-xl mx-auto my-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <EyeOff className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <SetBadge setCode={currentSetCode} />
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  17Lands Calibration is TBD for {currentSetName}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
                17Lands data is available approximately 2 weeks after release. Once match data is recorded, this tab will activate to compare your evaluations against live Game-In-Hand win rates.
              </p>
            </div>
            <button
              onClick={() => setActiveSubTab('grade')}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Back to Card Grading
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Evaluator Report Card Banner */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-[#090e24] dark:via-[#060919] dark:to-[#040612] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                {/* Left: Overall Grade Badge & Title */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#050818] border-2 border-violet-500/40 dark:border-cyan-500/50 shadow-md min-w-[90px] sm:min-w-[105px] text-center">
                    <span className="text-3xl sm:text-4xl font-black font-mono text-violet-700 dark:text-cyan-300 tracking-tight">
                      {calibrationSummary.overallGrade}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      {calibrationSummary.gpa.toFixed(2)} / 4.0 GPA
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        Overall Evaluator Report Card
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-heading">
                      {calibrationSummary.overallTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                      {calibrationSummary.overallDescription}
                    </p>
                  </div>
                </div>

                {/* Right: Summary Accuracy Stats & Math Button */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {calibrationSummary.calibrationScore}%
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {calibrationSummary.correctCount} of {calibrationSummary.totalRated} Correct (±1 Step)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setIsExportModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/50 dark:hover:bg-violet-900/50 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-violet-800/60 text-xs font-bold transition-all cursor-pointer shadow-xs"
                      title="Export full comparison spreadsheet or send grades to 17Lands"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Export Spreadsheet ↗</span>
                    </button>

                    <button
                      onClick={() => setShowMathExplainer(!showMathExplainer)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-cyan-500/30 text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>{showMathExplainer ? 'Hide Math Breakdown' : 'Quick Math Summary'}</span>
                      {showMathExplainer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => setActiveSubTab('methodology')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                      title="Read full guide on 17Lands metrics, normal distribution, and scoring rubrics"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Full Methodology Guide ↗</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step Precision Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <div
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-emerald-200 dark:border-emerald-500/30 text-center"
                  title="Cards where your assigned grade exactly matched 17Lands grade (0 steps off)"
                >
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{calibrationSummary.exactMatches}</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                    🎯 Exact Matches (0 Steps)
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">100% Bullseye</span>
                </div>

                <div
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-emerald-200 dark:border-emerald-500/30 text-center"
                  title="Cards where your grade was within ±1 sub-tier (e.g. A to A-, B- to C+) - Counts as Correct!"
                >
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{calibrationSummary.oneStepMatches}</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                    ✓ 1-Step Off (±1 Sub-tier)
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Counts as Correct</span>
                </div>

                <div
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-amber-200 dark:border-amber-500/30 text-center"
                  title="Cards with a 2-step grade delta (e.g. A to B+, B to C+)"
                >
                  <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{calibrationSummary.twoStepMatches}</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                    ±2 Steps Off
                  </p>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">Minor Discrepancy</span>
                </div>

                <div
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-rose-200 dark:border-rose-500/30 text-center"
                  title="Cards with 3 or more steps delta (Major overvaluation trap or undervaluation sleeper)"
                >
                  <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">{calibrationSummary.largeDiscrepancies}</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                    3+ Steps Off
                  </p>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">
                    {calibrationSummary.averageStepDelta > 0 ? `Avg +${calibrationSummary.averageStepDelta} Over` : calibrationSummary.averageStepDelta < 0 ? `Avg ${calibrationSummary.averageStepDelta} Under` : 'Major Misses'}
                  </span>
                </div>
              </div>

              {/* Mathematical Breakdown & Rubric Panel */}
              {showMathExplainer && (
                <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#050818] border border-violet-200 dark:border-cyan-500/40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                        Mathematical Rubric: How Evaluator Grades Are Calculated
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">17Lands Statistical Calibration Model</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Step Delta Formula */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 space-y-2">
                      <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-violet-100 dark:bg-violet-600/30 text-violet-700 dark:text-cyan-300 font-mono font-bold flex items-center justify-center text-[11px]">1</span>
                        Step Delta Calculation (Δ)
                      </h5>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Every grade is indexed across the 11-tier spectrum: <code className="font-mono text-[11px] text-violet-700 dark:text-cyan-300">A+ (0), A (1), A- (2) ... F (10)</code>.
                      </p>
                      <div className="p-2.5 rounded bg-slate-100 dark:bg-[#050818] font-mono text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 text-center font-bold">
                        Δ = Index(17Lands Grade) - Index(Your Grade)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        • Δ &gt; 0: Overrated (Optimistic read / Trap)<br />
                        • Δ &lt; 0: Underrated (Conservative read / Sleeper)
                      </p>
                    </div>

                    {/* Single-Step Tolerance Rule */}
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 space-y-2">
                      <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 font-mono font-bold flex items-center justify-center text-[11px]">2</span>
                        Single-Step Tolerance Rule (≤ 1 Step = Correct)
                      </h5>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        In competitive limited draft, being within 1 sub-tier (e.g. <strong>A to A-</strong>, <strong>B- to C+</strong>) represents accurate format calibration and counts as <strong>100% Correct</strong>:
                      </p>
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>|Δ| = 0 (Bullseye Exact Match):</span>
                          <strong>100% Credit</strong>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>|Δ| = 1 (Within 1-Step Tolerance):</span>
                          <strong>100% Credit (Correct)</strong>
                        </div>
                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                          <span>|Δ| = 2 (Minor Miss):</span>
                          <strong>50% Partial Credit</strong>
                        </div>
                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                          <span>|Δ| ≥ 3 (Major Trap / Sleeper):</span>
                          <strong>0% Credit</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Evaluator Grade & GPA Rubric Table */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                      <span className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-600/30 text-amber-700 dark:text-amber-300 font-mono font-bold flex items-center justify-center text-[11px]">3</span>
                      Overall Evaluator Grade & GPA Curve
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">A+ (4.0 GPA)</span>
                        <p className="text-[10px] text-slate-500">≥ 93% Accuracy</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">A (4.0 GPA)</span>
                        <p className="text-[10px] text-slate-500">88% - 92% Accuracy</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-cyan-600 dark:text-cyan-400">A- (3.7 GPA)</span>
                        <p className="text-[10px] text-slate-500">83% - 87% Accuracy</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-sky-600 dark:text-sky-400">B+ (3.3 GPA)</span>
                        <p className="text-[10px] text-slate-500">78% - 82% Accuracy</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-sky-600 dark:text-sky-400">B (3.0 GPA)</span>
                        <p className="text-[10px] text-slate-500">73% - 77% Accuracy</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-slate-700 dark:text-slate-300">C+ & Under</span>
                        <p className="text-[10px] text-slate-500">≤ 72% Accuracy</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Color Breakdown */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Color Evaluation Accuracy & Bias Breakdown (±1 Step Tolerance)
                  </h3>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Identifies color blindspots</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {colorAnalytics.map((stat) => (
                  <div
                    key={stat.color}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between"
                    title={`Color Accuracy for ${stat.badge}: ${stat.correctCount} of ${stat.totalRated} cards exact or within 1 step = ${stat.accuracyRate}% Accuracy (Avg step delta: ${stat.avgDelta > 0 ? `+${stat.avgDelta} steps over` : stat.avgDelta < 0 ? `${stat.avgDelta} steps under` : '0.0'})`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {stat.badge}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{stat.accuracyRate}%</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>{stat.correctCount}/{stat.totalRated} Correct</span>
                        <span>
                          <strong className={stat.avgDelta > 0 ? 'text-amber-600 dark:text-amber-400' : stat.avgDelta < 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300'}>
                            {stat.avgDelta > 0 ? `+${stat.avgDelta} Over` : stat.avgDelta < 0 ? `${stat.avgDelta} Under` : 'Exact'}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                        <span>🎯 {stat.exactCount} Bullseye</span>
                        <span>✓ {stat.oneStepCount} 1-Step</span>
                        <span>⚠️ {stat.missCount} Misses</span>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                      {stat.bias === 'overrated' ? (
                        <span className="text-amber-600 dark:text-amber-400">⚠️ Skews High (+{stat.avgDelta})</span>
                      ) : stat.bias === 'underrated' ? (
                        <span className="text-sky-600 dark:text-sky-400">🧊 Skews Low ({stat.avgDelta})</span>
                      ) : stat.bias === 'accurate' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">✓ Well Calibrated</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">Unrated</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete 11-Tier Grade Distribution Spectrum */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Full 11-Tier Grade Distribution Spectrum (All Tiers A+ to F)
                  </h3>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Your Curve vs 17Lands</span>
              </div>

              <div className="space-y-1.5">
                {gradeDistribution.map((point) => (
                  <div
                    key={point.tier}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    title={`Tier ${point.tier} (${point.score.toFixed(1)} pts): You assigned ${point.userCount} cards (${point.userPercent}%) vs 17Lands ${point.actualCount} cards (${point.actualPercent}%)`}
                  >
                    <div className="flex items-center gap-2.5 min-w-[120px]">
                      <span className={`px-2 py-0.5 rounded font-mono font-black text-xs border ${getTierBadgeColor(point.tier)}`}>
                        {point.tier}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        ({point.score.toFixed(1)} pts)
                      </span>
                    </div>

                    <div className="flex items-center gap-4 font-mono text-xs flex-wrap">
                      <span className="text-slate-900 dark:text-slate-100 font-semibold">
                        You: <strong className="text-violet-700 dark:text-cyan-300">{point.userCount}</strong> ({point.userPercent}%)
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        17Lands: <strong>{point.actualCount}</strong> ({point.actualPercent}%)
                      </span>
                      {point.countDelta !== 0 ? (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          point.countDelta > 0
                            ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                            : 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30'
                        }`}>
                          {point.countDelta > 0 ? `+${point.countDelta} Over` : `${point.countDelta} Under`}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
                          ✓ Balanced
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          {/* Biggest Traps vs Sleepers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Traps */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-rose-200 dark:border-rose-500/25 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <TrendingDown className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Biggest Traps (Cards You Overrated)
                </h3>
              </div>

              {calibrationSummary.biggestTraps.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs bg-slate-50 dark:bg-[#050818] rounded-xl">
                  No major over-evaluations detected!
                </div>
              ) : (
                <div className="space-y-2">
                  {calibrationSummary.biggestTraps.map((comp) => (
                    <div
                      key={comp.card.id}
                      onClick={() => handleSelectCardForModal(comp.card)}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#050818] dark:hover:bg-[#0d1538] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/50 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                    >
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-violet-700 dark:text-cyan-300">#{comp.card.collector_number}</span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors truncate">{comp.card.name}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>Your Grade: <strong className="text-amber-700 dark:text-amber-300">{comp.userEvaluation?.userGrade}</strong></span>
                          <span>•</span>
                          <span>17Lands: <strong className="text-rose-600 dark:text-rose-400">{comp.seventeenLandsData?.tier_grade || 'C'} ({((comp.seventeenLandsData?.win_rate || 0.5) * 100).toFixed(1)}%)</strong></span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/10 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-500/30 shrink-0">
                        +{comp.gradeDelta} Sub-tiers Over
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sleepers */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-emerald-200 dark:border-emerald-500/25 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Biggest Sleepers (Cards You Underrated)
                </h3>
              </div>

              {calibrationSummary.biggestSleepers.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs bg-slate-50 dark:bg-[#050818] rounded-xl">
                  No major under-evaluations detected!
                </div>
              ) : (
                <div className="space-y-2">
                  {calibrationSummary.biggestSleepers.map((comp) => (
                    <div
                      key={comp.card.id}
                      onClick={() => handleSelectCardForModal(comp.card)}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#050818] dark:hover:bg-[#0d1538] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/50 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                    >
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-violet-700 dark:text-cyan-300">#{comp.card.collector_number}</span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors truncate">{comp.card.name}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>Your Grade: <strong className="text-amber-700 dark:text-amber-300">{comp.userEvaluation?.userGrade}</strong></span>
                          <span>•</span>
                          <span>17Lands: <strong className="text-emerald-600 dark:text-emerald-400">{comp.seventeenLandsData?.tier_grade || 'B'} ({((comp.seventeenLandsData?.win_rate || 0.55) * 100).toFixed(1)}%)</strong></span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 shrink-0">
                        {comp.gradeDelta} Sub-tiers Under
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Full Card-by-Card Comparison Ledger */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  Card-by-Card Comparison Ledger
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Examine your grade delta and 17Lands win rate.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Sort:
                </span>
                <select
                  value={comparisonSortBy}
                  onChange={(e) => setComparisonSortBy(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 cursor-pointer font-mono"
                >
                  <option value="number">Card Number (#001 → #300)</option>
                  <option value="delta_desc">Biggest Over-Evaluations (Traps First)</option>
                  <option value="delta_asc">Biggest Under-Evaluations (Sleepers First)</option>
                  <option value="winrate">17Lands Win Rate</option>
                  <option value="name">Card Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Comparison Color & Verdict Filter Row */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Mana Color Filter Bar with Official Arena Glow */}
              <ManaColorFilterBar selectedColor={comparisonSelectedColor} onSelectColor={setComparisonSelectedColor} />

              {/* Verdict Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'EXACT', label: 'Exact Match' },
                  { id: 'TOLERANCE', label: '±1 Step Correct' },
                  { id: 'MINOR', label: '±2 Minor Miss' },
                  { id: 'TRAPS', label: 'Traps (Over)' },
                  { id: 'SLEEPERS', label: 'Sleepers (Under)' },
                ].map((vf) => (
                  <button
                    key={vf.id}
                    onClick={() => setComparisonVerdictFilter(vf.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      comparisonVerdictFilter === vf.id
                        ? 'bg-violet-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {vf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Persistent Filter Display Counter */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Displaying <strong className="text-violet-700 dark:text-cyan-300 font-black">{filteredComparisonList.length}</strong> of <strong>{cards.length}</strong> cards
                </span>
                {(comparisonSelectedColor !== 'ALL' || comparisonVerdictFilter !== 'ALL') && (
                  <span className="text-violet-600 dark:text-cyan-400 font-semibold">
                    (filtered)
                  </span>
                )}
              </div>

              {(comparisonSelectedColor !== 'ALL' || comparisonVerdictFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setComparisonSelectedColor('ALL');
                    setComparisonVerdictFilter('ALL');
                  }}
                  className="text-[11px] font-mono text-violet-700 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Card Name</th>
                    <th className="py-2 px-3">Rarity</th>
                    <th className="py-2 px-3">Me</th>
                    {showLsv && <th className="py-2 px-3">LSV</th>}
                    {show17L && <th className="py-2 px-3">17L</th>}
                    <th className="py-2 px-3">GIH WR</th>
                    <th className="py-2 px-3">ALSA</th>
                    <th className="py-2 px-3">Accuracy Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-900 font-sans">
                  {filteredComparisonList.map((row) => {
                    const verdict = formatTierGapVerdict(row.tierGap);
                    return (
                      <tr
                        key={row.card.id}
                        onClick={() => handleSelectCardForModal(row.card)}
                        className="hover:bg-slate-100 dark:hover:bg-[#0c1338] transition-colors cursor-pointer group"
                      >
                        <td className="py-2 px-3 font-mono text-violet-700 dark:text-cyan-400 font-bold">
                          #{row.card.collector_number}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors">{row.card.name}</span>
                              {row.card.mana_cost && (
                                <ManaCostRenderer manaCost={row.card.mana_cost} size="xs" />
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 capitalize font-mono text-slate-500 dark:text-slate-400">
                          {row.card.rarity}
                        </td>
                        <td className="py-2 px-3">
                          {row.userGrade ? (
                            <span className="font-mono font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950/60 px-2 py-0.5 rounded border border-violet-300 dark:border-violet-800/80">
                              {row.userGrade}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 font-mono italic">Ungraded</span>
                          )}
                        </td>
                        {showLsv && (() => {
                          const lsvRating = getLsvRatingForCard(row.card);
                          return (
                            <td className="py-2 px-3 font-mono">
                              {!row.userGrade ? (
                                <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                              ) : isBlindGrading ? (
                                <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800/80 flex items-center gap-1 w-fit">
                                  —
                                </span>
                              ) : !lsvRating ? (
                                <span className="text-slate-400 dark:text-slate-500 font-mono text-xs italic">
                                  Pending
                                </span>
                              ) : (
                                <span
                                  className="font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800/80 flex items-center gap-1 w-fit"
                                  title={`LSV: ${lsvRating.score.toFixed(1)} / 5.0 (${lsvRating.grade}) - ${lsvRating.verdict || 'Playable'}`}
                                >
                                  <span>{lsvRating.grade}</span>
                                  <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-normal">({lsvRating.score.toFixed(1)})</span>
                                </span>
                              )}
                            </td>
                          );
                        })()}
                        {show17L && (
                          <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-200">
                            {!row.userGrade ? (
                              <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                            ) : row.actualTier ? (
                              <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800/80">
                                {isBlindGrading ? '—' : row.actualTier}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">TBD</span>
                            )}
                          </td>
                        )}
                        <td className="py-2 px-3 font-mono">
                          {!row.userGrade ? (
                            <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                          ) : isBlindGrading ? (
                            <span className="text-slate-400 dark:text-slate-500 font-mono">???</span>
                          ) : row.winRate !== undefined ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(row.winRate * 100).toFixed(1)}%</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">TBD</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-violet-700 dark:text-cyan-300">
                          {!row.userGrade ? (
                            <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                          ) : isBlindGrading ? (
                            <span className="text-slate-400 dark:text-slate-500 font-mono">???</span>
                          ) : row.landData ? (
                            row.landData.avg_seen.toFixed(1)
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-mono">TBD</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {!row.userGrade ? (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                              Rate the card to see how you compare
                            </span>
                          ) : isBlindGrading ? (
                            <span className="px-2 py-0.5 rounded text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-mono">
                              Grading Mode
                            </span>
                          ) : row.isRated ? (
                            row.actualTier ? (
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${verdict.color}`}>
                                {verdict.text}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 font-semibold">
                                TBD (Unreleased)
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )
      )}

      {/* SUBTAB 3: Notes & Draft Playbook */}
      {activeSubTab === 'notes' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-1 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Personal Draft Notes & Set Strategy Playbook</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All strategic thinking, synergies, and evaluations you recorded during rating sessions for {currentSetName}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {cards
              .filter((c) => userEvaluations[`${c.set.toLowerCase()}_${c.name.toLowerCase()}`]?.notes)
              .map((card) => {
                const evalData = userEvaluations[`${card.set.toLowerCase()}_${card.name.toLowerCase()}`];
                return (
                  <div
                    key={card.id}
                    className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-400">#{card.collector_number}</span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{card.name}</h4>
                        {card.mana_cost && <ManaCostRenderer manaCost={card.mana_cost} size="xs" />}
                      </div>
                      <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                        Grade: {evalData.userGrade}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 italic leading-relaxed">
                      "{evalData.notes}"
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono pt-0.5">
                      <span>Priority: <strong className="text-violet-700 dark:text-cyan-300">{evalData.pickPriority}</strong></span>
                      <span>Updated: {new Date(evalData.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* SUBTAB 4: Analytics & Math Guide */}
      {activeSubTab === 'methodology' && (
        <MethodologyGuideView
          onGoToGrading={() => setActiveSubTab('grade')}
          onGoToForecast={() => setActiveSubTab('forecast')}
          onGoToCalibration={() => setActiveSubTab('calibration')}
        />
      )}

      {/* Quick Rate / Card Inspector Modal */}
      {selectedCardForModal && (
        <QuickRateModal
          isOpen={Boolean(selectedCardForModal)}
          onClose={() => handleSelectCardForModal(null)}
          cards={filteredCards.length < cards.length ? filteredCards : cards}
          card={selectedCardForModal}
          onSelectCard={handleSelectCardForModal}
          userEvaluations={userEvaluations}
          seventeenLandsData={effective17LandsData}
          isBlindGrading={isBlindGrading}
          onToggleBlindGrading={handleToggleBlindGrading}
          showLsv={showLsv}
          show17L={show17L}
          onToggleLsv={handleToggleLsv}
          onToggle17L={handleToggle17L}
          gradeDisplayMode={gradeDisplayMode}
          onChangeGradeDisplayMode={handleSetGradeDisplayMode}
          onSaveEvaluation={onSaveEvaluation}
          isFiltered={filteredCards.length < cards.length}
          filterDescription={searchQuery ? `Search: "${searchQuery}"` : 'Filters active'}
          totalSetCardsCount={cards.length}
          onClearFilter={() => {
            setSearchQuery('');
            setSelectedColors(['ALL']);
            setSelectedRarities(['ALL']);
            setSelectedRoles(['ALL']);
            setFilterRatedStatus('ALL');
          }}
        />
      )}

      {/* Clear Set Ratings Modal with Multi-Step Confirmation */}
      {isClearModalOpen && onClearEvaluationsForSet && (
        <ClearSetRatingsModal
          isOpen={isClearModalOpen}
          onClose={() => setIsClearModalOpen(false)}
          setCode={currentSetCode}
          setName={currentSetName}
          ratedCount={ratedCountInSet}
          onConfirmClear={(code) => {
            onClearEvaluationsForSet(code);
          }}
        />
      )}

      {/* Similar Cards Modal (Precedent Engine) */}
      {similarCardsModalCard && (
        <SimilarCardsModal
          isOpen={Boolean(similarCardsModalCard)}
          onClose={() => setSimilarCardsModalCard(null)}
          targetCard={similarCardsModalCard}
          currentGrade={userEvaluations[`${similarCardsModalCard.set.toLowerCase()}_${similarCardsModalCard.name.toLowerCase()}`]?.userGrade}
          target17LandsData={
            effective17LandsData?.cards?.[similarCardsModalCard.name]
              ? {
                  winRate: effective17LandsData.cards[similarCardsModalCard.name].win_rate,
                  alsa: effective17LandsData.cards[similarCardsModalCard.name].avg_seen,
                  tierGrade: effective17LandsData.cards[similarCardsModalCard.name].tier_grade as GradeTier,
                }
              : undefined
          }
          onAdoptGrade={(targetCard, grade) => {
            handleQuickGrade(targetCard, grade);
          }}
        />
      )}

      {/* Export & Send to 17Lands Modal */}
      {isExportModalOpen && (
        <ExportGradesModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          cards={cards}
          evaluations={userEvaluations}
          seventeenLandsData={seventeenLandsData}
          currentSet={currentSet || { code: currentSetCode, name: currentSetName, card_count: cards.length }}
          userId={currentUser?.id}
        />
      )}

    </div>
  );
};

export default EvaluationHub;
