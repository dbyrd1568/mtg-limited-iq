import React, { useState, useMemo, useEffect } from 'react';
import { Card, MTGColor, MTGRarity, SeventeenLandsSetData, UserCardEvaluation, UserArchetypeEvaluation, UserColorEvaluation, GradeTier, SetCalibrationSummary, SetInfo, UserAccount, ProCreatorSource, PRO_CREATORS } from '../../types/mtg';
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
  getOrEstimate17LandsCardRating,
  get17LandsCardUrl,
  get17LandsQueryStatus,
} from '../../services/seventeenLands';
import { getBlindGradingForSet, setBlindGradingForSet, getPreferredCreators } from '../../services/storage';
import { getLsvRatingForCard, getProRatingForCard } from '../../services/lsvRatings';
import { CardObfuscator } from '../CardObfuscator';
import { QuickRateModal } from './QuickRateModal';
import { SimilarCardsModal } from './SimilarCardsModal';
import { ClearSetRatingsModal } from '../UI/ClearSetRatingsModal';
import { ArchetypeForecastView } from './ArchetypeForecastView';
import { MethodologyGuideView } from './MethodologyGuideView';
import { deduplicateCards } from '../../services/scryfall';
import { CalibrationScatterPlot, BenchmarkTarget } from './CalibrationScatterPlot';
import { Trophy, Award, Filter, Search, Check, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, ChevronRight, BarChart2, ShieldCheck, FileText, Eye, EyeOff, Scale, BookOpen, Activity, Calculator, ChevronDown, ChevronUp, X, Trash2, Target, PlayingCardsFan, Share2, Layers, ExternalLink, Link2, ArrowUp, ArrowDown, ArrowUpDown, Clock } from 'lucide-react';
import { ExportGradesModal } from './ExportGradesModal';
import { ManaCostRenderer, ManaSymbol } from '../UI/ManaSymbol';
import { parseAppUrlParams, updateAppUrlParams, findCardByUrlIdentifier } from '../../services/urlParams';
import { SetBadge, SetSymbol } from '../UI/SetSymbol';
import { ManaColorFilterBar, cardMatchesColorFilter, cardMatchesRoleFilter, DEFAULT_ROLE_FILTERS } from '../UI/ManaColorFilterBar';
import { CardSearchBar } from '../Search/CardSearchBar';
import { cardMatchesQuery } from '../../services/cardSearchParser';
import { useContextualTour } from '../../context/ContextualTourContext';

export type ComparisonSortColumn =
  | 'number'
  | 'name'
  | 'rarity'
  | 'me'
  | 'lsv'
  | 'llu'
  | 'ds'
  | '17l'
  | 'winrate'
  | 'alsa'
  | 'verdict';

interface EvaluationHubProps {
  cards: Card[];
  currentSetCode: string;
  currentSetName: string;
  currentSet?: SetInfo | null;
  currentUser?: UserAccount | null;
  userEvaluations: Record<string, UserCardEvaluation>;
  userArchetypeEvaluations?: Record<string, UserArchetypeEvaluation>;
  userColorEvaluations?: Record<string, UserColorEvaluation>;
  onSaveArchetypeEvaluation?: (evaluation: UserArchetypeEvaluation) => void;
  onDeleteArchetypeEvaluation?: (setCode: string, archetypeCode: string) => void;
  onSaveColorEvaluation?: (evaluation: UserColorEvaluation) => void;
  onDeleteColorEvaluation?: (setCode: string, color: string) => void;
  seventeenLandsData: SeventeenLandsSetData | null;
  isBlindGrading?: boolean;
  onToggleBlindGrading?: () => void;
  onSaveEvaluation: (evaluation: UserCardEvaluation) => void;
  onDeleteEvaluation?: (setCode: string, cardName: string) => void;
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
  availableSets?: SetInfo[];
  isAdmin?: boolean;
  onPracticeCard?: (card: Card) => void;
}

export const EvaluationHub: React.FC<EvaluationHubProps> = ({
  cards: rawCards,
  currentSetCode,
  currentSetName,
  currentSet,
  currentUser,
  isAdmin,
  userEvaluations,
  userArchetypeEvaluations,
  userColorEvaluations,
  onSaveArchetypeEvaluation,
  onDeleteArchetypeEvaluation,
  onSaveColorEvaluation,
  onDeleteColorEvaluation,
  seventeenLandsData,
  isBlindGrading: propIsBlindGrading,
  onToggleBlindGrading: propOnToggleBlindGrading,
  onSaveEvaluation,
  onDeleteEvaluation,
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
  availableSets,
  onPracticeCard,
}) => {
  const cards = useMemo(() => deduplicateCards(rawCards), [rawCards]);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportModalTab, setExportModalTab] = useState<'spreadsheet' | 'seventeenlands' | 'share' | 'backup'>('spreadsheet');
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
  const [preferredCreators, setPreferredCreatorsState] = useState<ProCreatorSource[]>(() =>
    getPreferredCreators()
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ProCreatorSource[]>;
      if (custom.detail && Array.isArray(custom.detail)) {
        setPreferredCreatorsState(custom.detail);
      } else {
        setPreferredCreatorsState(getPreferredCreators());
      }
    };
    window.addEventListener('mtg_preferred_creators_changed', handler);
    return () => window.removeEventListener('mtg_preferred_creators_changed', handler);
  }, []);

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
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);

  const isAllGrades = selectedGrades.length === 0 || selectedGrades.includes('ALL');

  const handleToggleGrade = (tier: string) => {
    if (filterRatedStatus === 'UNRATED') {
      setFilterRatedStatus('ALL');
    }
    if (tier === 'ALL') {
      setSelectedGrades([]);
      return;
    }
    setSelectedGrades((prev) => {
      const filtered = prev.filter((g) => g !== 'ALL');
      if (filtered.includes(tier)) {
        return filtered.filter((g) => g !== tier);
      } else {
        return [...filtered, tier];
      }
    });
  };
  const [comparisonSelectedColor, setComparisonSelectedColor] = useState<string>('ALL');
  const [comparisonVerdictFilter, setComparisonVerdictFilter] = useState<string>('ALL');
  const [selectedCardForModal, setSelectedCardForModal] = useState<Card | null>(null);
  const [similarCardsModalCard, setSimilarCardsModalCard] = useState<Card | null>(null);
  const [cardListSortBy, setCardListSortBy] = useState<'number' | 'name' | 'color' | 'rarity' | 'grade-desc' | 'grade-asc' | 'lsv-desc' | 'llu-desc' | 'ds-desc' | 'winrate'>('number');
  const [comparisonSortColumn, setComparisonSortColumn] = useState<ComparisonSortColumn>('number');
  const [comparisonSortDirection, setComparisonSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showMathExplainer, setShowMathExplainer] = useState<boolean>(false);

  const handleToggleComparisonSort = (col: ComparisonSortColumn) => {
    if (comparisonSortColumn === col) {
      setComparisonSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setComparisonSortColumn(col);
      if (col === 'number' || col === 'name' || col === 'rarity' || col === 'alsa') {
        setComparisonSortDirection('asc');
      } else {
        setComparisonSortDirection('desc');
      }
    }
  };

  const renderSortableHeader = (
    col: ComparisonSortColumn,
    label: string,
    align: 'left' | 'center' | 'right' = 'left',
    className: string = ''
  ) => {
    const isActive = comparisonSortColumn === col;
    return (
      <th
        key={col}
        onClick={() => handleToggleComparisonSort(col)}
        className={`py-2 px-3 cursor-pointer select-none group transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60 ${
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
        } ${isActive ? 'text-violet-700 dark:text-cyan-300 font-bold bg-violet-100/40 dark:bg-violet-950/30' : ''} ${className}`}
        title={`Sort by ${label} (${
          isActive
            ? comparisonSortDirection === 'asc'
              ? 'ascending, click for descending'
              : 'descending, click for ascending'
            : 'click to sort'
        })`}
      >
        <button
          type="button"
          className={`inline-flex items-center gap-1 w-full whitespace-nowrap cursor-pointer focus:outline-hidden ${
            align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
          }`}
        >
          <span>{label}</span>
          {isActive ? (
            comparisonSortDirection === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-violet-600 dark:text-cyan-400 shrink-0" />
            ) : (
              <ArrowDown className="w-3 h-3 text-violet-600 dark:text-cyan-400 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </button>
      </th>
    );
  };
  const [showMe, setShowMe] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_show_me');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [showLsv, setShowLsv] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_show_lsv');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [showLlu, setShowLlu] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_show_llu');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [showDs, setShowDs] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_show_ds') ?? localStorage.getItem('mtg_show_lol');
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

  const handleToggleMe = () => {
    setShowMe((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mtg_show_me', String(next));
      }
      return next;
    });
  };

  const handleToggleLsv = () => {
    setShowLsv((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mtg_show_lsv', String(next));
      }
      return next;
    });
  };

  const handleToggleLlu = () => {
    setShowLlu((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mtg_show_llu', String(next));
      }
      return next;
    });
  };

  const handleToggleDs = () => {
    setShowDs((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mtg_show_ds', String(next));
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

  const [analyticsViewMode, setAnalyticsViewMode] = useState<'both' | 'plot' | 'ledger'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_analytics_view_mode');
      if (saved === 'both' || saved === 'plot' || saved === 'ledger') {
        return saved;
      }
    }
    return 'both';
  });

  const handleSetAnalyticsViewMode = (mode: 'both' | 'plot' | 'ledger') => {
    setAnalyticsViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mtg_analytics_view_mode', mode);
    }
  };

  // Sync activeSubTab to URL params
  useEffect(() => {
    updateAppUrlParams({ subtab: activeSubTab });
  }, [activeSubTab]);

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

  const [activeBenchmarkTarget, setActiveBenchmarkTarget] = useState<BenchmarkTarget>('17L');

  // Compute total count of cards the user has rated (excluding lands and N/A)
  const userRatedCount = useMemo(() => {
    return cards.filter((c) => {
      const isLand = Boolean(c.is_land || c.type_line?.toLowerCase().includes('land'));
      if (isLand) return false;
      const key = `${c.set.toLowerCase()}_${c.name.toLowerCase()}`;
      return Boolean(userEvaluations[key]?.userGrade && userEvaluations[key]?.userGrade !== 'N/A');
    }).length;
  }, [cards, userEvaluations]);

  const benchmarkGetter = useMemo(() => {
    return (card: Card) => {
      if (activeBenchmarkTarget === 'LSV') {
        return getLsvRatingForCard(card) || getProRatingForCard(card, 'LSV', card.set);
      }
      if (activeBenchmarkTarget === 'LLU') {
        return getProRatingForCard(card, 'LLU', card.set);
      }
      if (activeBenchmarkTarget === 'DS') {
        return getProRatingForCard(card, 'DS', card.set);
      }
      return null;
    };
  }, [activeBenchmarkTarget]);

  const benchmarkDisplayName = useMemo(() => {
    switch (activeBenchmarkTarget) {
      case '17L':
        return '17Lands';
      case 'LSV':
        return 'LSV';
      case 'LLU':
        return 'Lords of Limited';
      case 'DS':
        return 'Draftsim';
      default:
        return '17Lands';
    }
  }, [activeBenchmarkTarget]);

  // Compute calibration summary using effective 17lands data or the active independent benchmark target
  const calibrationSummary: SetCalibrationSummary = useMemo(() => {
    return calculateSetCalibration(
      cards,
      userEvaluations,
      activeBenchmarkTarget === '17L' ? effective17LandsData : null,
      benchmarkGetter,
      benchmarkDisplayName
    );
  }, [cards, userEvaluations, effective17LandsData, benchmarkGetter, benchmarkDisplayName, activeBenchmarkTarget]);

  // Compute advanced color analytics
  const colorAnalytics = useMemo(() => {
    return calculateColorAccuracyAnalytics(
      cards,
      userEvaluations,
      activeBenchmarkTarget === '17L' ? effective17LandsData : null,
      benchmarkGetter,
      activeBenchmarkTarget !== '17L'
    );
  }, [cards, userEvaluations, effective17LandsData, benchmarkGetter, activeBenchmarkTarget]);

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

      if (!isAllGrades) {
        const userEval = userEvaluations[evalKey];
        if (!userEval) return false;
        if (!selectedGrades.includes(userEval.userGrade)) {
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
      if (cardListSortBy === 'grade-desc' || cardListSortBy === 'grade-asc') {
        const evalKeyA = `${a.set.toLowerCase()}_${a.name.toLowerCase()}`;
        const evalKeyB = `${b.set.toLowerCase()}_${b.name.toLowerCase()}`;
        const evalA = userEvaluations[evalKeyA];
        const evalB = userEvaluations[evalKeyB];

        const scoreA = evalA && typeof evalA.userScore === 'number'
          ? evalA.userScore
          : (evalA?.userGrade ? (GRADE_SCORES[evalA.userGrade as GradeTier] ?? -1) : -1);
        const scoreB = evalB && typeof evalB.userScore === 'number'
          ? evalB.userScore
          : (evalB?.userGrade ? (GRADE_SCORES[evalB.userGrade as GradeTier] ?? -1) : -1);

        const isRatedA = scoreA >= 0;
        const isRatedB = scoreB >= 0;

        // Graded cards always sort before ungraded cards in both directions
        if (isRatedA && !isRatedB) return -1;
        if (!isRatedA && isRatedB) return 1;
        if (!isRatedA && !isRatedB) {
          return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
        }

        const diff = cardListSortBy === 'grade-desc' ? scoreB - scoreA : scoreA - scoreB;
        if (diff !== 0) return diff;
        return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
      }
      if (cardListSortBy === 'lsv-desc' || cardListSortBy === 'llu-desc' || cardListSortBy === 'ds-desc') {
        const creatorKey: ProCreatorSource = cardListSortBy === 'llu-desc' ? 'LLU' : cardListSortBy === 'ds-desc' ? 'DS' : 'LSV';
        const ratingA = getProRatingForCard(a, creatorKey, a.set);
        const ratingB = getProRatingForCard(b, creatorKey, b.set);
        const scoreA = ratingA ? ratingA.score : -1;
        const scoreB = ratingB ? ratingB.score : -1;

        if (scoreA >= 0 && scoreB < 0) return -1;
        if (scoreA < 0 && scoreB >= 0) return 1;
        if (scoreA < 0 && scoreB < 0) {
          return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
        }

        const diff = scoreB - scoreA;
        if (diff !== 0) return diff;
        return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
      }
      if (cardListSortBy === 'winrate') {
        const wrA = get17LandsCardRating(a, effective17LandsData)?.win_rate || 0.5;
        const wrB = get17LandsCardRating(b, effective17LandsData)?.win_rate || 0.5;
        return wrB - wrA;
      }
      return 0;
    });

    return result;
  }, [cards, searchQuery, selectedColors, selectedRarities, selectedRoles, selectedGrades, filterRatedStatus, userEvaluations, cardListSortBy, effective17LandsData]);

  const { registerTrigger, isStepCompleted } = useContextualTour();

  useEffect(() => {
    if (activeSubTab === 'grade' && filteredCards.length > 0) {
      if (!isStepCompleted('grading_mode')) {
        registerTrigger('grading_mode');
      } else if (!isStepCompleted('enter_grade')) {
        registerTrigger('enter_grade');
      } else if (!isStepCompleted('view_comps')) {
        registerTrigger('view_comps');
      } else if (!isStepCompleted('export_grades')) {
        registerTrigger('export_grades');
      }
    }
  }, [activeSubTab, filteredCards.length, registerTrigger, isStepCompleted]);

  // Comparison Matrix for Analytics Tab
  const comparisonList = useMemo(() => {
    const list = cards.map((card) => {
      const evalKey = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
      const userEval = userEvaluations[evalKey];
      const landData = get17LandsCardRating(card, effective17LandsData);

      let tierGap = 0;
      let actualTier: GradeTier | null = null;

      if (landData && typeof landData.win_rate === 'number') {
        actualTier = (landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate);
      }

      const isLand = Boolean(card.is_land || card.type_line?.toLowerCase().includes('land'));
      const isNA = isLand || userEval?.userGrade === 'N/A';

      // Benchmark tier based on activeBenchmarkTarget
      let benchmarkTier: GradeTier | null = null;
      if (activeBenchmarkTarget === '17L') {
        benchmarkTier = actualTier;
      } else if (activeBenchmarkTarget === 'LSV') {
        const proRating = getLsvRatingForCard(card) || getProRatingForCard(card, 'LSV', card.set);
        benchmarkTier = proRating?.grade || null;
      } else if (activeBenchmarkTarget === 'LLU') {
        const proRating = getProRatingForCard(card, 'LLU', card.set);
        benchmarkTier = proRating?.grade || null;
      } else if (activeBenchmarkTarget === 'DS') {
        const proRating = getProRatingForCard(card, 'DS', card.set);
        benchmarkTier = proRating?.grade || null;
      }

      if (userEval && benchmarkTier && !isNA) {
        const userIndex = gradeTierToIndex(userEval.userGrade);
        const benchmarkIndex = gradeTierToIndex(benchmarkTier);
        tierGap = benchmarkIndex - userIndex;
      }

      return {
        card,
        userEval,
        landData,
        tierGap: (isNA || !benchmarkTier) ? 0 : tierGap,
        userGrade: userEval?.userGrade,
        actualTier,
        benchmarkTier,
        winRate: landData?.win_rate,
        isRated: Boolean(userEval),
        isNA,
        isLand,
      };
    });

    list.sort((a, b) => {
      let diff = 0;

      switch (comparisonSortColumn) {
        case 'number': {
          const numA = parseInt(a.card.collector_number || '0', 10);
          const numB = parseInt(b.card.collector_number || '0', 10);
          diff = comparisonSortDirection === 'asc' ? numA - numB : numB - numA;
          break;
        }
        case 'name': {
          diff = comparisonSortDirection === 'asc'
            ? a.card.name.localeCompare(b.card.name)
            : b.card.name.localeCompare(a.card.name);
          break;
        }
        case 'rarity': {
          const rA = getRaritySortIndex(a.card.rarity);
          const rB = getRaritySortIndex(b.card.rarity);
          diff = comparisonSortDirection === 'asc' ? rA - rB : rB - rA;
          break;
        }
        case 'me': {
          const scoreA = a.userEval && typeof a.userEval.userScore === 'number'
            ? a.userEval.userScore
            : (a.userGrade ? (GRADE_SCORES[a.userGrade as GradeTier] ?? -1) : -1);
          const scoreB = b.userEval && typeof b.userEval.userScore === 'number'
            ? b.userEval.userScore
            : (b.userGrade ? (GRADE_SCORES[b.userGrade as GradeTier] ?? -1) : -1);

          if (scoreA >= 0 && scoreB < 0) return -1;
          if (scoreA < 0 && scoreB >= 0) return 1;
          if (scoreA < 0 && scoreB < 0) {
            return parseInt(a.card.collector_number || '0', 10) - parseInt(b.card.collector_number || '0', 10);
          }
          diff = comparisonSortDirection === 'desc' ? scoreB - scoreA : scoreA - scoreB;
          break;
        }
        case 'lsv':
        case 'llu':
        case 'ds': {
          const creatorKey: ProCreatorSource = comparisonSortColumn === 'lsv' ? 'LSV' : comparisonSortColumn === 'llu' ? 'LLU' : 'DS';
          const ratingA = comparisonSortColumn === 'lsv' ? getLsvRatingForCard(a.card) : getProRatingForCard(a.card, creatorKey, a.card.set);
          const ratingB = comparisonSortColumn === 'lsv' ? getLsvRatingForCard(b.card) : getProRatingForCard(b.card, creatorKey, b.card.set);
          const scoreA = ratingA ? ratingA.score : -1;
          const scoreB = ratingB ? ratingB.score : -1;

          if (scoreA >= 0 && scoreB < 0) return -1;
          if (scoreA < 0 && scoreB >= 0) return 1;
          if (scoreA < 0 && scoreB < 0) {
            return parseInt(a.card.collector_number || '0', 10) - parseInt(b.card.collector_number || '0', 10);
          }
          diff = comparisonSortDirection === 'desc' ? scoreB - scoreA : scoreA - scoreB;
          break;
        }
        case '17l': {
          const scoreA = a.actualTier ? (GRADE_SCORES[a.actualTier] ?? -1) : -1;
          const scoreB = b.actualTier ? (GRADE_SCORES[b.actualTier] ?? -1) : -1;

          if (scoreA >= 0 && scoreB < 0) return -1;
          if (scoreA < 0 && scoreB >= 0) return 1;
          if (scoreA < 0 && scoreB < 0) {
            return parseInt(a.card.collector_number || '0', 10) - parseInt(b.card.collector_number || '0', 10);
          }
          diff = comparisonSortDirection === 'desc' ? scoreB - scoreA : scoreA - scoreB;
          break;
        }
        case 'winrate': {
          const wrA = a.winRate !== undefined ? a.winRate : (a.landData?.win_rate ?? -1);
          const wrB = b.winRate !== undefined ? b.winRate : (b.landData?.win_rate ?? -1);

          if (wrA >= 0 && wrB < 0) return -1;
          if (wrA < 0 && wrB >= 0) return 1;
          if (wrA < 0 && wrB < 0) {
            return parseInt(a.card.collector_number || '0', 10) - parseInt(b.card.collector_number || '0', 10);
          }
          diff = comparisonSortDirection === 'desc' ? wrB - wrA : wrA - wrB;
          break;
        }
        case 'alsa': {
          const alsaA = a.landData?.avg_seen;
          const alsaB = b.landData?.avg_seen;

          if (alsaA !== undefined && alsaB === undefined) return -1;
          if (alsaA === undefined && alsaB !== undefined) return 1;
          if (alsaA === undefined && alsaB === undefined) {
            return parseInt(a.card.collector_number || '0', 10) - parseInt(b.card.collector_number || '0', 10);
          }
          const valA = alsaA ?? 999;
          const valB = alsaB ?? 999;
          diff = comparisonSortDirection === 'asc' ? valA - valB : valB - valA;
          break;
        }
        case 'verdict': {
          const hasVerdictA = a.isRated && !a.isNA;
          const hasVerdictB = b.isRated && !b.isNA;

          if (hasVerdictA && !hasVerdictB) return -1;
          if (!hasVerdictA && hasVerdictB) return 1;
          if (!hasVerdictA && !hasVerdictB) {
            return parseInt(a.card.collector_number || '0', 10) - parseInt(b.card.collector_number || '0', 10);
          }
          diff = comparisonSortDirection === 'desc' ? b.tierGap - a.tierGap : a.tierGap - b.tierGap;
          break;
        }
        default:
          diff = 0;
      }

      if (diff !== 0) return diff;
      return parseInt(a.card.collector_number || '0', 10) - parseInt(b.card.collector_number || '0', 10);
    });

    return list;
  }, [cards, userEvaluations, effective17LandsData, comparisonSortColumn, comparisonSortDirection, preferredCreators, activeBenchmarkTarget]);

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

  const handleQuickGrade = (card: Card, tier: GradeTier | 'N/A') => {
    const evalKey = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
    const existingEval = userEvaluations[evalKey];

    // Toggle off: if user clicks the currently assigned grade, remove it!
    if (existingEval && existingEval.userGrade === tier) {
      onDeleteEvaluation?.(card.set, card.name);
      return;
    }

    const priority = tier === 'N/A'
      ? 'Sideboard / Unplayable'
      : tier.startsWith('A')
      ? '1st Pick Bomb'
      : tier.startsWith('B')
      ? 'Early Pick'
      : tier.startsWith('C')
      ? 'Mid Pick'
      : tier === 'D'
      ? 'Late Filler'
      : 'Sideboard / Unplayable';

    const evaluation: UserCardEvaluation = {
      cardId: card.id,
      cardName: card.name,
      setCode: card.set,
      userGrade: tier,
      userScore: GRADE_SCORES[tier] ?? 0,
      pickPriority: priority,
      notes: existingEval?.notes,
      updatedAt: new Date().toISOString(),
    };

    onSaveEvaluation(evaluation);
  };

  const isFilteredActive = Boolean(
    (!selectedColors.includes('ALL') && selectedColors.length > 0) ||
    (!selectedRarities.includes('ALL') && selectedRarities.length > 0) ||
    (!selectedRoles.includes('ALL') && selectedRoles.length > 0) ||
    selectedGrades.length > 0 ||
    filterRatedStatus !== 'ALL' ||
    searchQuery.trim() !== ''
  );

  const handleResetFilters = () => {
    handleSelectedColors(['ALL']);
    handleSelectedRarities(['ALL']);
    handleSelectedRoles(['ALL']);
    setSelectedGrades([]);
    setFilterRatedStatus('ALL');
    handleSearchQuery('');
  };

  const formatTierGapVerdict = (gap: number, isNA?: boolean) => {
    if (isNA) {
      return { text: 'N/A (Excluded from math)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700', isCorrect: true };
    }
    if (gap === 0) {
      return { text: 'Exact Match (Correct)', color: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 font-bold', isCorrect: true };
    }
    if (gap === 1) {
      return { text: '+1 Tier (Correct)', color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 font-semibold', isCorrect: true };
    }
    if (gap === -1) {
      return { text: '-1 Tier (Correct)', color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 font-semibold', isCorrect: true };
    }
    if (gap === 2) {
      return { text: '+2 Tiers (Trap)', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 font-semibold', isCorrect: false };
    }
    if (gap === -2) {
      return { text: '-2 Tiers (Sleeper)', color: 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 font-semibold', isCorrect: false };
    }
    if (gap >= 3) {
      return { text: `+${gap} Tiers (Trap)`, color: 'bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/50 font-bold', isCorrect: false };
    }
    return { text: `${gap} Tiers (Sleeper)`, color: 'bg-blue-100 dark:bg-blue-500/25 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/50 font-bold', isCorrect: false };
  };

  const getTierBadgeColor = (tier: GradeTier | 'N/A') => {
    if (tier === 'N/A') return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-bold';
    if (tier.startsWith('A')) return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 font-bold';
    if (tier.startsWith('B')) return 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold';
    if (tier.startsWith('C')) return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-bold';
    if (tier === 'D') return 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40 font-bold';
    return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 font-bold';
  };

  return (
    <div className="max-w-[1440px] mx-auto pb-4 px-3 sm:px-6 space-y-4 animate-in fade-in duration-200">
      {/* UNIFIED TOP-DOCKED CONTROL BAR (Compact, responsive, frozen/sticky on scroll) */}
      <div className="sticky top-14 sm:top-16 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 bg-slate-100/95 dark:bg-[#030614]/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 transition-colors">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-1.5 sm:p-2 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs">
        {/* Left: Sub-tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-[#060a1d] p-1 rounded-xl border border-slate-200/90 dark:border-slate-800/80 shadow-xs shrink-0">
            <button
              onClick={() => setActiveSubTab('grade')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'grade'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Grade
            </button>

            <button
              onClick={() => setActiveSubTab('forecast')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'forecast'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
              title="Evaluation Results & Archetype Forecast"
            >
              Results
            </button>

            <button
              onClick={() => setActiveSubTab('calibration')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'calibration'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              {effective17LandsData ? '17Lands' : 'Benchmarks'}
            </button>

            <button
              onClick={() => setActiveSubTab('notes')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'notes'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Notes
            </button>

            <button
              onClick={() => setActiveSubTab('methodology')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === 'methodology'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Guide
            </button>
          </div>
        </div>

        {/* Right: Export, Clear, Blind Mode Toggle */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap">
          <button
            id="export-grades-btn"
            type="button"
            onClick={() => {
              setExportModalTab('share');
              setIsExportModalOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-violet-700 dark:text-cyan-300 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 border border-violet-200 dark:border-violet-800/60 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
            title="Share public link or export your grades"
          >
            <Share2 className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
            <span>Share/Export</span>
          </button>

          {onClearEvaluationsForSet && ratedCountInSet > 0 && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title={`Clear all your grades for ${currentSetCode.toUpperCase()}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Clear ({ratedCountInSet})</span>
            </button>
          )}

          <button
            id="mode-toggle-btn"
            type="button"
            onClick={handleToggleBlindGrading}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
              isBlindGrading
                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
            }`}
            title={
              isBlindGrading
                ? 'Grading Mode: Benchmarks hidden. Click to switch to Compare Mode'
                : 'Compare Mode: Creator & 17Lands data visible. Click to switch to Blind Grading Mode'
            }
          >
            {isBlindGrading ? (
              <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span>{isBlindGrading ? 'Blind' : 'Compare'}</span>
            {!effective17LandsData && (
              <span className="text-[10px] font-mono opacity-70 ml-0.5">(17L: TBD)</span>
            )}
          </button>
        </div>
      </div>
    </div>

      {/* SUBTAB 1: Grade Cards List & Filter */}
      {activeSubTab === 'grade' && (
        <div className="space-y-3.5">
          {/* Streamlined 2-Row Filter Toolbar */}
          <div className="p-3 bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xs space-y-2">
            {/* Row 1: Search, Sort, Status, and Benchmarks */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-2.5">
              {/* Card Search Bar */}
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

              {/* Right Controls: Sort, Status, and Benchmarks */}
              <div className="flex items-center flex-wrap gap-2.5 shrink-0">
                {/* Sort By */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Sort:
                  </span>
                  <select
                    value={cardListSortBy}
                    onChange={(e) => setCardListSortBy(e.target.value as any)}
                    className="h-9 px-2.5 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 cursor-pointer font-mono"
                  >
                    <option value="number">Card # (#001 → #300)</option>
                    <option value="name">Card Name (A → Z)</option>
                    <option value="color">Color (WUBRG Order)</option>
                    <option value="rarity">Rarity (Mythic → Common)</option>
                    <option value="grade-desc">Highest Grade (A+ → F)</option>
                    <option value="grade-asc">Lowest Grade (F → A+)</option>
                    {showLsv && <option value="lsv-desc">LSV Grade (Highest First)</option>}
                    {showLlu && <option value="llu-desc">LLU Grade (Highest First)</option>}
                    {showDs && <option value="ds-desc">DS Grade (Highest First)</option>}
                    {effective17LandsData && <option value="winrate">17Lands Win Rate</option>}
                  </select>
                </div>

                {/* Evaluation Status Filter */}
                <div className="h-9 flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'UNRATED', label: 'Ungraded' },
                    { id: 'RATED', label: 'Graded' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setFilterRatedStatus(st.id as any)}
                      className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                        filterRatedStatus === st.id
                          ? 'bg-violet-600 text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Benchmark Data Toggles (Me, LSV, LLU, DS, 17Lands) */}
                <div className="h-9 flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 px-1.5 hidden sm:inline">
                    Benchmarks:
                  </span>

                  {/* Me (Togglable) */}
                  <button
                    type="button"
                    onClick={handleToggleMe}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      showMe
                        ? 'bg-violet-600 text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border border-transparent'
                    }`}
                    title="Toggle Personal Grade (Me)"
                  >
                    {showMe && <Check className="w-3 h-3 text-white" />}
                    <span>Me</span>
                  </button>

                  {/* LSV (Togglable) */}
                  <button
                    type="button"
                    onClick={handleToggleLsv}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      showLsv
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/50 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border border-transparent'
                    }`}
                    title="Toggle LSV (Limited Resources / Expert Pre-release) rating"
                  >
                    {showLsv && <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
                    <span>LSV</span>
                  </button>

                  {/* LLU (Togglable) */}
                  <button
                    type="button"
                    onClick={handleToggleLlu}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      showLlu
                        ? 'bg-pink-500/15 text-pink-800 dark:text-pink-300 border border-pink-400/50 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border border-transparent'
                    }`}
                    title="Toggle Limited Level Ups (Alex Nikolic) rating"
                  >
                    {showLlu && <Check className="w-3 h-3 text-pink-600 dark:text-pink-400" />}
                    <span>LLU</span>
                  </button>

                  {/* DS (Togglable) */}
                  <button
                    type="button"
                    onClick={handleToggleDs}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      showDs
                        ? 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-400/50 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border border-transparent'
                    }`}
                    title="Toggle Draftsim (Draftsim.com) rating"
                  >
                    {showDs && <Check className="w-3 h-3 text-sky-600 dark:text-sky-400" />}
                    <span>DS</span>
                  </button>

                  {/* 17L (Togglable) */}
                  <button
                    type="button"
                    onClick={handleToggle17L}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      show17L
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/50 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-transparent border border-transparent'
                    }`}
                    title="Toggle 17Lands draft telemetry"
                  >
                    {show17L && <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                    <span className="hidden sm:inline">17Lands</span>
                    <span className="sm:hidden">17L</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Colors, Rarities, Roles, and Inline Reset */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
              {/* Mana Color Filter Bar */}
              <ManaColorFilterBar selectedColors={selectedColors} onSelectColors={handleSelectedColors} />

              {/* Active Archetype Filter Pill */}
              {(() => {
                const isArchetype =
                  selectedColors.some((s) => s.startsWith('GOLD_')) ||
                  (selectedColors.length === 2 && selectedColors.every((c) => ['W', 'U', 'B', 'R', 'G'].includes(c)));
                if (!isArchetype) return null;
                const label = selectedColors.some((s) => s.startsWith('GOLD_'))
                  ? `Gold ${selectedColors.find((s) => s.startsWith('GOLD_'))!.replace('GOLD_', '')}`
                  : selectedColors.join('');
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-violet-100 dark:bg-violet-950/70 border border-violet-300 dark:border-violet-700/60 text-violet-800 dark:text-violet-200 shadow-xs">
                    <span>Archetype: {label}</span>
                    <button
                      type="button"
                      onClick={() => handleSelectedColors(["ALL"])}
                      className="p-0.5 rounded-md hover:bg-violet-200 dark:hover:bg-violet-800 text-violet-600 dark:text-violet-300 cursor-pointer"
                      title="Clear Archetype Filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })()}

              {/* Rarity Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
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

              {/* Grade Tier Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 px-1.5 hidden sm:inline">
                  Grade{selectedGrades.length > 1 ? ` (${selectedGrades.length})` : ''}:
                </span>
                {['ALL', ...GRADE_TIERS, 'N/A'].map((tier) => {
                  const isSelected = tier === 'ALL' ? isAllGrades : selectedGrades.includes(tier);
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => handleToggleGrade(tier)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-violet-600 text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {tier}
                    </button>
                  );
                })}
              </div>

              {/* Tactical Roles (Clean neutral active state) */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
                {DEFAULT_ROLE_FILTERS.map((role) => {
                  const isSelected = (role.id === 'ALL' && (selectedRoles.includes('ALL') || selectedRoles.length === 0)) ||
                    (role.id !== 'ALL' && selectedRoles.includes(role.id));
                  return (
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
                      title={role.description}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>

              {/* Inline Reset Button */}
              {isFilteredActive && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 text-xs font-mono text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors flex items-center gap-1 cursor-pointer font-semibold border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50"
                  title="Clear all search and category filters"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}

              {/* Card Count Display */}
              <div className="px-2 py-1 text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center whitespace-nowrap">
                <span className="font-bold text-slate-800 dark:text-slate-200">{filteredCards.length}</span>
                <span className="text-slate-400 dark:text-slate-500 font-normal">/{cards.length}</span>
                <span className="ml-1 text-slate-500 dark:text-slate-400">cards</span>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCards.map((card, cardIndex) => {
              const evalKey = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
              const userEval = userEvaluations[evalKey];
              const landData = get17LandsCardRating(card, effective17LandsData) || getOrEstimate17LandsCardRating(card, effective17LandsData) || undefined;

              return (
                <div
                  key={card.id}
                  onClick={() => handleSelectCardForModal(card)}
                  className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/60 dark:hover:border-violet-500/60 transition-all flex flex-col justify-between gap-3.5 shadow-xs hover:shadow-md cursor-pointer group"
                >
                  {/* Top Bar above card: Grade badge(s) in a dedicated full-width header */}
                  <div className="w-full flex items-center justify-between gap-2 pb-2.5 mb-0.5 border-b border-slate-100 dark:border-slate-800/80 min-h-[26px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        const actualTier: GradeTier | null = landData
                          ? ((landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate))
                          : null;
                        const hasUserGrade = Boolean(userEval?.userGrade);

                        return (
                          <>
                            {/* 1. Me Badge */}
                            {showMe && (
                              <div
                                className="px-2 py-0.5 rounded-lg bg-violet-950/95 text-white border border-violet-400/80 shadow-xs flex items-center gap-1.5 font-mono shrink-0 whitespace-nowrap"
                                title="Your assigned grade"
                              >
                                <span className="text-[9px] uppercase tracking-wider font-extrabold text-violet-300">Me</span>
                                <span className="text-xs font-black">{hasUserGrade ? userEval!.userGrade : '—'}</span>
                              </div>
                            )}

                            {/* 2. Pro Creator Badges */}
                            {preferredCreators.map((c) => {
                              const isShown = c === 'LSV' ? showLsv : c === 'LLU' ? showLlu : showDs;
                              if (!isShown) return null;
                              const meta = PRO_CREATORS[c] || PRO_CREATORS.LSV;
                              const rating = getProRatingForCard(card, c, card.set);
                              return (
                                <div
                                  key={c}
                                  className={`px-2 py-0.5 rounded-lg text-white shadow-xs flex items-center gap-1.5 font-mono shrink-0 whitespace-nowrap ${
                                    c === 'LLU'
                                      ? 'bg-pink-950/95 border border-pink-400/80'
                                      : c === 'DS'
                                      ? 'bg-sky-950/95 border border-sky-400/80'
                                      : 'bg-amber-950/95 border border-amber-400/80'
                                  }`}
                                  title={
                                    isBlindGrading && !hasUserGrade
                                      ? 'Rate the card or switch to Compare Mode to view creator rating'
                                      : isBlindGrading
                                      ? `${meta.shortName} Rating (hidden in grading mode)`
                                      : rating
                                      ? `${meta.shortName} Rating: ${rating.score.toFixed(1)} / 5.0 (${rating.grade}) - ${rating.verdict || 'Playable'}`
                                      : `${meta.shortName} Review pending (set not yet rated)`
                                  }
                                >
                                  <span className={`text-[9px] uppercase tracking-wider font-extrabold ${
                                    c === 'LLU' ? 'text-pink-300' : c === 'DS' ? 'text-sky-300' : 'text-amber-300'
                                  }`}>
                                    {meta.shortName}
                                  </span>
                                  <span className={`text-xs font-black ${
                                    c === 'LLU' ? 'text-pink-200' : c === 'DS' ? 'text-sky-200' : 'text-amber-200'
                                  }`}>
                                    {isBlindGrading && !hasUserGrade ? '—' : (rating ? rating.grade : '—')}
                                  </span>
                                </div>
                              );
                            })}

                            {/* 3. 17L Badge (Togglable) */}
                            {show17L && (
                              <div
                                className={`px-2 py-0.5 rounded-lg shadow-xs flex items-center gap-1.5 font-mono shrink-0 whitespace-nowrap ${
                                  actualTier
                                    ? 'bg-emerald-950/95 text-white border border-emerald-400/80'
                                    : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                                }`}
                                title={isBlindGrading && !hasUserGrade ? 'Rate the card or switch to Compare Mode' : (actualTier ? (isBlindGrading ? '17Lands grade (hidden in grading mode)' : `17Lands: ${actualTier}`) : '17Lands data is available approximately 2 weeks after release')}
                              >
                                <span className={`text-[9px] uppercase tracking-wider font-extrabold ${actualTier ? 'text-emerald-300' : 'text-slate-500'}`}>17L</span>
                                <span className={`text-xs font-black ${actualTier ? 'text-emerald-200' : 'text-amber-500/80'}`}>
                                  {isBlindGrading && !hasUserGrade ? '—' : (actualTier || 'TBD')}
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <a
                      href={get17LandsCardUrl(card.set, card, landData)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0"
                      title="Open on 17Lands.com"
                      aria-label={`Open ${card.name} on 17Lands.com`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5">
                    <div className="shrink-0 flex flex-col items-center sm:items-start w-full sm:w-[185px] relative z-20">
                      <CardObfuscator
                        card={card}
                        obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                        size="sm"
                      />
                    </div>

                    <div className="space-y-1 w-full sm:flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-200 transition-colors truncate">{card.name}</h3>
                      <p className="text-[11px] text-violet-700 dark:text-cyan-300 font-mono">{card.type_line}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        {card.oracle_text || 'No oracle text.'}
                      </p>

                      {/* Evaluation Verdict & 17Lands Stats */}
                      {isBlindGrading && !userEval?.userGrade ? (
                        /* Card is Ungraded in Blind Mode: Simple invite */
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
                          title="Click to switch to Compare Mode and reveal benchmarks"
                        >
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 shrink-0 whitespace-nowrap">
                            <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Grading Mode</span>
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 text-right leading-tight">
                            Compare Mode reveals creator & 17L data
                          </span>
                        </div>
                      ) : (
                        /* Compare Mode: Clean single-panel display */
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                          {landData && userEval?.userGrade ? (() => {
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
                          })() : landData ? (
                            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                              <span>
                                GIH WR: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{((landData.win_rate || 0) * 100).toFixed(1)}%</strong>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>
                                ALSA: <strong className="font-bold text-slate-900 dark:text-white">{typeof landData.avg_seen === 'number' ? landData.avg_seen.toFixed(1) : '-'}</strong>
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {(() => {
                                const status = get17LandsQueryStatus(currentSetCode);
                                return (
                                  <span>
                                    17Lands:{' '}
                                    <strong
                                      className="text-amber-600 dark:text-amber-400 font-semibold"
                                      title={status.availableDateStr ? `Queries 17Lands on ${status.availableDateStr} (2 weeks post-Arena release)` : undefined}
                                    >
                                      {status.daysRemaining > 0 ? `Unlocks in ${status.daysRemaining}d` : 'Data Pending'}
                                    </strong>
                                  </span>
                                );
                              })()}
                            </div>
                          )}

                          {/* Pro Creator Reference(s): Score & Verdict */}
                          {preferredCreators.map((c) => {
                            const isShown = c === 'LSV' ? showLsv : c === 'LLU' ? showLlu : showDs;
                            if (!isShown) return null;
                            const meta = PRO_CREATORS[c] || PRO_CREATORS.LSV;
                            const rating = getProRatingForCard(card, c, card.set);
                            return (
                              <div
                                key={c}
                                className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 font-mono"
                              >
                                <span>{meta.shortName}: <strong>{rating ? `${rating.score.toFixed(1)} / 5.0` : 'Pending'}</strong></span>
                                <span className="italic truncate font-sans">{rating?.verdict || 'Review pending'}</span>
                              </div>
                            );
                          })}
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

                  {/* Quick Grade Selector Bar with Inline Precedent Comps Action */}
                  <div
                    id={cardIndex === 0 ? 'rate-card-bar' : undefined}
                    onClick={(e) => e.stopPropagation()}
                    className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold">
                      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                        <span>Rate Card</span>
                      </span>

                      <button
                        id={cardIndex === 0 ? 'comps-action-btn' : undefined}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSimilarCardsModalCard(card);
                        }}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-slate-400 hover:text-violet-600 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-[10px] font-mono font-medium"
                        title="Find similar cards & historical comps (Precedent Engine)"
                      >
                        <PlayingCardsFan className="w-3 h-3" />
                        <span>Comps</span>
                      </button>
                    </div>

                    {(() => {
                      const isCardLand = Boolean(card.is_land || card.type_line?.toLowerCase().includes('land'));
                      return (
                        <div
                          className={`grid gap-1 sm:gap-1 ${isCardLand ? 'grid-cols-6 sm:grid-cols-12' : 'grid-cols-6 sm:grid-cols-11'}`}
                          title="Grade Point Values: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5"
                        >
                          {GRADE_TIERS.map((tier) => {
                            const isSelected = userEval?.userGrade === tier;
                            return (
                              <button
                                key={tier}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickGrade(card, tier);
                                }}
                                className={`py-1.5 px-0.5 rounded-lg text-xs sm:text-[11px] font-mono font-bold transition-all cursor-pointer border min-h-[34px] sm:min-h-[28px] flex items-center justify-center ${
                                  tier === 'F' && !isCardLand ? 'col-span-2 sm:col-span-1' : ''
                                } ${
                                  isSelected
                                    ? 'bg-violet-600 text-white border-violet-500 shadow-xs font-black ring-1 ring-violet-400'
                                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                                }`}
                              >
                                {tier}
                              </button>
                            );
                          })}
                          {isCardLand && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickGrade(card, 'N/A');
                              }}
                              className={`py-1.5 px-0.5 rounded-lg text-xs sm:text-[11px] font-mono font-bold transition-all cursor-pointer border min-h-[34px] sm:min-h-[28px] flex items-center justify-center ${
                                userEval?.userGrade === 'N/A'
                                  ? 'bg-slate-700 text-white border-slate-500 shadow-xs font-black ring-1 ring-slate-400'
                                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                              }`}
                              title="Mark land as N/A (Excluded from math)"
                            >
                              N/A
                            </button>
                          )}
                        </div>
                      );
                    })()}
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
          userArchetypeEvaluations={userArchetypeEvaluations}
          userColorEvaluations={userColorEvaluations}
          onSaveArchetypeEvaluation={onSaveArchetypeEvaluation}
          onDeleteArchetypeEvaluation={onDeleteArchetypeEvaluation}
          onSaveColorEvaluation={onSaveColorEvaluation}
          onDeleteColorEvaluation={onDeleteColorEvaluation}
          seventeenLandsData={effective17LandsData}
          isBlindGrading={isBlindGrading}
          setCode={currentSetCode}
          setName={currentSetName}
          onSelectCard={handleSelectCardForModal}
        />
      )}

      {/* SUBTAB 3: In-Depth Grade vs 17Lands & Creator Benchmarks Analytics */}
      {activeSubTab === 'calibration' && (
        <div className="space-y-6">
          {/* Status Banner when awaiting 17Lands data */}
          {activeBenchmarkTarget === '17L' && !effective17LandsData && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <SetBadge setCode={currentSetCode} size="xs" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      {userRatedCount > 0
                        ? `You have evaluated ${userRatedCount} cards in ${currentSetCode.toUpperCase()}! 17Lands telemetry awaiting Arena release.`
                        : '17Lands Match Telemetry Pending'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    {(() => {
                      const status = get17LandsQueryStatus(currentSetCode);
                      if (status.availableDateStr) {
                        return `Arena draft volume unlocks on ${status.availableDateStr} (${status.daysRemaining}d remaining). In the meantime, switch benchmarks to compare against Pro Graders (LSV, Lords of Limited, Draftsim).`;
                      }
                      return `17Lands empirical data unlocks ~2 weeks after Arena release. In the meantime, switch benchmarks to compare your grades against Pro Graders (LSV, Lords of Limited, Draftsim).`;
                    })()}
                  </p>
                </div>
              </div>

              {userRatedCount > 0 && (
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Compare against:</span>
                  <button
                    type="button"
                    onClick={() => setActiveBenchmarkTarget('LSV')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-xs transition-colors"
                  >
                    Me vs LSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBenchmarkTarget('LLU')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-xs transition-colors"
                  >
                    Me vs LLU
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBenchmarkTarget('DS')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-xs transition-colors"
                  >
                    Me vs Draftsim
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Overall Evaluator Report Card Banner (only shown when benchmark data is available) */}
          {!(activeBenchmarkTarget === '17L' && !effective17LandsData) && (
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-[#090e24] dark:via-[#060919] dark:to-[#040612] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              {/* Left: Overall Accuracy Scores & Difference Explainer */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    Evaluation Accuracy ({activeBenchmarkTarget === '17L' ? 'vs 17Lands' : `vs ${benchmarkDisplayName}`})
                  </span>
                </div>

                {/* Score Cards: Strict % and Weighted % */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  {/* Strict Accuracy */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#050818] border-2 border-emerald-500/40 dark:border-emerald-500/50 shadow-md min-w-[170px]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {calibrationSummary.totalRated > 0 ? `${calibrationSummary.calibrationScore}%` : '—'}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                        Strict
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      Exact or ±1 Sub-tier
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {calibrationSummary.totalRated > 0
                        ? `${calibrationSummary.correctCount} of ${calibrationSummary.totalRated} Correct`
                        : `Awaiting 17L Data (${userRatedCount} Graded)`}
                    </div>
                  </div>

                  {/* Weighted Accuracy */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#050818] border-2 border-violet-500/40 dark:border-cyan-500/50 shadow-md min-w-[170px]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black font-mono text-violet-700 dark:text-cyan-300">
                        {calibrationSummary.totalRated > 0
                          ? `${calibrationSummary.weightedScore !== undefined ? calibrationSummary.weightedScore : calibrationSummary.calibrationScore}%`
                          : '—'}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                        Weighted
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      +50% Credit (±2 Sub-tiers)
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {calibrationSummary.totalRated > 0
                        ? 'Partial Credit for Near-Misses'
                        : `Awaiting 17L Data (${userRatedCount} Graded)`}
                    </div>
                  </div>
                </div>

                {/* Explaining the Difference */}
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                  <strong className="text-slate-900 dark:text-white">Difference between scores: </strong>
                  <strong>Strict Accuracy ({calibrationSummary.totalRated > 0 ? `${calibrationSummary.calibrationScore}%` : 'Pending'})</strong> counts only exact tier matches or evaluations within single-step tolerance (±1 sub-tier, e.g. <span className="font-mono font-semibold">B vs B+</span>).
                  {' '}<strong>Weighted Accuracy ({calibrationSummary.totalRated > 0 ? `${calibrationSummary.weightedScore !== undefined ? calibrationSummary.weightedScore : calibrationSummary.calibrationScore}%` : 'Pending'})</strong> adds <strong>50% partial credit</strong> for close evaluations within ±2 sub-tiers (e.g. <span className="font-mono font-semibold">B- vs B+</span>), acknowledging near-misses without penalizing them as total failures.
                </p>
              </div>

              {/* Right: Actions */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-2.5 shrink-0">
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
                          <span>|Δ| ≥ 3 (Trap / Sleeper):</span>
                          <strong>0% Credit</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Evaluator Grade & GPA Rubric Table */}
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                        <span className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-600/30 text-amber-700 dark:text-amber-300 font-mono font-bold flex items-center justify-center text-[11px]">3</span>
                        Curved MTG Limited Evaluator Grade & GPA Rubric
                      </h5>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Calibrated to 17Lands set review data (LSV / Sierkovitz ~60-65% pro benchmark)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Pre-release draft grading is high-variance forecasting. Top Pro Tour competitors and premier Limited creators average <strong>58%–65% accuracy</strong> within ±1 step. Pure random guessing across 11 tiers is <strong>~25%</strong>. Evaluator grades and GPA are curved to reward true format intuition rather than an unrealistic 100% academic scale:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-emerald-300 dark:border-emerald-600/40">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">A+ (4.0 GPA)</span>
                        <p className="text-[10px] text-slate-500">&ge; 64% (Pro Tour Peak)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-emerald-200 dark:border-emerald-700/40">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">A (3.8–4.0)</span>
                        <p className="text-[10px] text-slate-500">59% – 63% (Top Creator)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-cyan-600 dark:text-cyan-400">A- (3.5–3.8)</span>
                        <p className="text-[10px] text-slate-500">54% – 58% (Mythic Tier)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-sky-600 dark:text-sky-400">B+ (3.2–3.5)</span>
                        <p className="text-[10px] text-slate-500">49% – 53% (Diamond Tier)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-sky-600 dark:text-sky-400">B (2.8–3.2)</span>
                        <p className="text-[10px] text-slate-500">44% – 48% (Strong Drafter)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-300 dark:border-violet-700/50">
                        <span className="font-bold text-violet-700 dark:text-cyan-300">B- (2.5–2.8)</span>
                        <p className="text-[10px] text-slate-500">39% – 43% (Capable Drafter)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-slate-700 dark:text-slate-300">C+ (2.2–2.5)</span>
                        <p className="text-[10px] text-slate-500">34% – 38% (Developing)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-slate-700 dark:text-slate-300">C (1.8–2.2)</span>
                        <p className="text-[10px] text-slate-500">29% – 33% (Baseline)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-amber-600 dark:text-amber-400">C- (1.5–1.8)</span>
                        <p className="text-[10px] text-slate-500">24% – 28% (~Random Base)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-amber-600 dark:text-amber-400">D (1.0–1.5)</span>
                        <p className="text-[10px] text-slate-500">18% – 23% (Misread)</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090e24] border border-rose-300 dark:border-rose-800/60 col-span-2 sm:col-span-2">
                        <span className="font-bold text-rose-600 dark:text-rose-400">F (0.0–1.0 GPA)</span>
                        <p className="text-[10px] text-slate-500">&lt; 18% (Inverted read only)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

            {/* Benchmark Target Switcher & View Mode Toggle Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200 dark:border-slate-800/80">
              {/* Independent Benchmark Sub-Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#090e24] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex-wrap">
                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 px-2 uppercase tracking-wider flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-violet-500" />
                  Benchmark:
                </span>
                <button
                  type="button"
                  onClick={() => setActiveBenchmarkTarget('17L')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeBenchmarkTarget === '17L'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Benchmark against 17Lands empirical win rates (default)"
                >
                  <span>17Lands (Data)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBenchmarkTarget('LSV')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeBenchmarkTarget === 'LSV'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Independent comparison: You vs LSV"
                >
                  <span>Me vs LSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBenchmarkTarget('LLU')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeBenchmarkTarget === 'LLU'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Independent comparison: You vs Lords of Limited"
                >
                  <span>Me vs Lords of Limited</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBenchmarkTarget('DS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeBenchmarkTarget === 'DS'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Independent comparison: You vs Draftsim"
                >
                  <span>Me vs Draftsim</span>
                </button>
              </div>

              {/* View Mode Controls & Set Indicator */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#090e24] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <button
                    type="button"
                    onClick={() => handleSetAnalyticsViewMode('both')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      analyticsViewMode === 'both'
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Show both the calibration scatter plot and detailed data ledger"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Dashboard (All)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAnalyticsViewMode('plot')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      analyticsViewMode === 'plot'
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="View only the 2D calibration scatter plot comparing expected vs actual win rates"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Scatter Plot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAnalyticsViewMode('ledger')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      analyticsViewMode === 'ledger'
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="View color accuracy breakdown, distribution curve, and card-by-card comparison ledger"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Ledger</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-2 font-mono">
                  <span>Active Set: <strong className="text-violet-700 dark:text-cyan-300">{currentSetCode.toUpperCase()}</strong></span>
                  <span>•</span>
                  <span>{calibrationSummary.totalRated > 0 ? `${calibrationSummary.totalRated} Compared` : `${userRatedCount} Graded`}</span>
                </div>
              </div>
            </div>

            {/* When 17Lands is selected but data is not yet available, do not continue showing data below */}
            {activeBenchmarkTarget === '17L' && !effective17LandsData ? (
              <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 text-center max-w-2xl mx-auto space-y-5 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                  <EyeOff className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <SetBadge setCode={currentSetCode} size="sm" />
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                      17Lands Match Telemetry Pending
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mx-auto">
                    {userRatedCount > 0 ? (
                      <>
                        You have evaluated <strong className="text-violet-700 dark:text-cyan-300 font-bold">{userRatedCount} cards</strong> in {currentSetCode.toUpperCase()}! 17Lands empirical game-in-hand win rate data unlocks ~2 weeks after set release on MTG Arena.
                      </>
                    ) : (
                      <>
                        17Lands empirical win rate data for {currentSetCode.toUpperCase()} unlocks ~2 weeks after set release on MTG Arena.
                      </>
                    )}
                  </p>
                  {(() => {
                    const status = get17LandsQueryStatus(currentSetCode);
                    if (status.availableDateStr) {
                      return (
                        <p className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          Arena draft volume unlocks on {status.availableDateStr} ({status.daysRemaining} days remaining).
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold">
                    Compare your evaluations against independent pro reviewers in the meantime:
                  </p>
                  <div className="flex items-center justify-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveBenchmarkTarget('LSV')}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>Compare Me vs LSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBenchmarkTarget('LLU')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>Compare Me vs Lords of Limited</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBenchmarkTarget('DS')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>Compare Me vs Draftsim</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 2D Calibration Scatter Plot Graph */}
                {(analyticsViewMode === 'both' || analyticsViewMode === 'plot') && (
              <CalibrationScatterPlot
                cards={cards}
                currentSetCode={currentSetCode}
                currentSetName={currentSetName}
                userEvaluations={userEvaluations}
                seventeenLandsData={effective17LandsData}
                onSelectCard={handleSelectCardForModal}
                availableSets={availableSets}
                userId={currentUser?.id}
                benchmarkTarget={activeBenchmarkTarget}
                onBenchmarkTargetChange={setActiveBenchmarkTarget}
              />
            )}

            {/* Detailed Analytics, Distribution Curve, Traps/Sleepers & Card Comparison Ledger */}
            {(analyticsViewMode === 'both' || analyticsViewMode === 'ledger') && (
              <>
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
                    title={`Color Accuracy for ${stat.label}: ${stat.correctCount} of ${stat.totalRated} cards exact or within 1 step = ${stat.accuracyRate}% Accuracy (Avg step delta: ${stat.avgDelta > 0 ? `+${stat.avgDelta} steps over` : stat.avgDelta < 0 ? `${stat.avgDelta} steps under` : '0.0'})`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ManaSymbol symbol={stat.color === 'COLORLESS' ? 'C' : stat.color} size="sm" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {stat.label}
                        </span>
                      </div>
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
                          {comp.seventeenLandsData ? (
                            <a
                              href={get17LandsCardUrl(comp.card.set || currentSetCode, comp.card, comp.seventeenLandsData)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline font-bold"
                              title={`Open ${comp.card.name} on 17lands.com`}
                            >
                              <span>17Lands: {comp.seventeenLandsData?.tier_grade || 'C'} ({((comp.seventeenLandsData?.win_rate || 0.5) * 100).toFixed(1)}%)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              {benchmarkDisplayName}: {benchmarkGetter(comp.card)?.grade || 'C'}
                            </span>
                          )}
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
                          {comp.seventeenLandsData ? (
                            <a
                              href={get17LandsCardUrl(comp.card.set || currentSetCode, comp.card, comp.seventeenLandsData)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                              title={`Open ${comp.card.name} on 17lands.com`}
                            >
                              <span>17Lands: {comp.seventeenLandsData?.tier_grade || 'B'} ({((comp.seventeenLandsData?.win_rate || 0.55) * 100).toFixed(1)}%)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {benchmarkDisplayName}: {benchmarkGetter(comp.card)?.grade || 'B'}
                            </span>
                          )}
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
                  value={
                    comparisonSortColumn === 'verdict'
                      ? (comparisonSortDirection === 'desc' ? 'delta_desc' : 'delta_asc')
                      : `${comparisonSortColumn}_${comparisonSortDirection}`
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'delta_desc') {
                      setComparisonSortColumn('verdict');
                      setComparisonSortDirection('desc');
                    } else if (val === 'delta_asc') {
                      setComparisonSortColumn('verdict');
                      setComparisonSortDirection('asc');
                    } else {
                      const [col, dir] = val.split('_') as [ComparisonSortColumn, 'asc' | 'desc'];
                      setComparisonSortColumn(col);
                      setComparisonSortDirection(dir || 'asc');
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 cursor-pointer font-mono"
                >
                  <option value="number_asc">Card Number (#001 → #300)</option>
                  <option value="number_desc">Card Number (#300 → #001)</option>
                  <option value="name_asc">Card Name (A → Z)</option>
                  <option value="name_desc">Card Name (Z → A)</option>
                  <option value="rarity_asc">Rarity (Mythic → Common)</option>
                  <option value="rarity_desc">Rarity (Common → Mythic)</option>
                  {showMe && <option value="me_desc">My Grade (Highest First)</option>}
                  {showMe && <option value="me_asc">My Grade (Lowest First)</option>}
                  {showLsv && <option value="lsv_desc">LSV Rating (Highest First)</option>}
                  {showLsv && <option value="lsv_asc">LSV Rating (Lowest First)</option>}
                  {showLlu && <option value="llu_desc">LLU Rating (Highest First)</option>}
                  {showLlu && <option value="llu_asc">LLU Rating (Lowest First)</option>}
                  {showDs && <option value="ds_desc">Draftsim Rating (Highest First)</option>}
                  {showDs && <option value="ds_asc">Draftsim Rating (Lowest First)</option>}
                  {show17L && <option value="17l_desc">17Lands Tier (Highest First)</option>}
                  {show17L && <option value="17l_asc">17Lands Tier (Lowest First)</option>}
                  <option value="winrate_desc">17Lands Win Rate (Highest First)</option>
                  <option value="winrate_asc">17Lands Win Rate (Lowest First)</option>
                  <option value="alsa_asc">ALSA (Earliest Picked First)</option>
                  <option value="alsa_desc">ALSA (Latest Picked First)</option>
                  <option value="delta_desc">Biggest Over-Evaluations (Traps First)</option>
                  <option value="delta_asc">Biggest Under-Evaluations (Sleepers First)</option>
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
                    {renderSortableHeader('number', '#')}
                    {renderSortableHeader('name', 'Card Name')}
                    {renderSortableHeader('rarity', 'Rarity')}
                    {showMe && renderSortableHeader('me', 'Me')}
                    {showLsv && renderSortableHeader('lsv', 'LSV')}
                    {showLlu && renderSortableHeader('llu', 'LLU')}
                    {showDs && renderSortableHeader('ds', 'DS')}
                    {show17L && renderSortableHeader('17l', '17L')}
                    {renderSortableHeader('winrate', 'GIH WR')}
                    {renderSortableHeader('alsa', 'ALSA')}
                    {renderSortableHeader('verdict', 'Accuracy Verdict')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-900 font-sans">
                  {filteredComparisonList.map((row) => {
                    const verdict = formatTierGapVerdict(row.tierGap, row.isNA);
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
                        {showMe && (
                          <td className="py-2 px-3">
                            {row.userGrade === 'N/A' ? (
                              <span className="font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                                N/A
                              </span>
                            ) : row.userGrade ? (
                              <span className="font-mono font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950/60 px-2 py-0.5 rounded border border-violet-300 dark:border-violet-800/80">
                                {row.userGrade}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-mono italic">Ungraded</span>
                            )}
                          </td>
                        )}
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
                        {showLlu && (() => {
                          const lluRating = getProRatingForCard(row.card, 'LLU', row.card.set);
                          return (
                            <td className="py-2 px-3 font-mono">
                              {!row.userGrade ? (
                                <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                              ) : isBlindGrading ? (
                                <span className="font-bold text-pink-700 dark:text-pink-300 bg-pink-100 dark:bg-pink-950/60 px-2 py-0.5 rounded border border-pink-300 dark:border-pink-800/80 flex items-center gap-1 w-fit">
                                  —
                                </span>
                              ) : !lluRating ? (
                                <span className="text-slate-400 dark:text-slate-500 font-mono text-xs italic">
                                  Pending
                                </span>
                              ) : (
                                <span
                                  className="font-bold text-pink-700 dark:text-pink-300 bg-pink-100 dark:bg-pink-950/60 px-2 py-0.5 rounded border border-pink-300 dark:border-pink-800/80 flex items-center gap-1 w-fit"
                                  title={`LLU: ${lluRating.score.toFixed(1)} / 5.0 (${lluRating.grade}) - ${lluRating.verdict || 'Playable'}`}
                                >
                                  <span>{lluRating.grade}</span>
                                  <span className="text-[10px] text-pink-600/80 dark:text-pink-400/80 font-normal">({lluRating.score.toFixed(1)})</span>
                                </span>
                              )}
                            </td>
                          );
                        })()}
                        {showDs && (() => {
                          const dsRating = getProRatingForCard(row.card, 'DS', row.card.set);
                          return (
                            <td className="py-2 px-3 font-mono">
                              {!row.userGrade ? (
                                <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>
                              ) : isBlindGrading ? (
                                <span className="font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-800/80 flex items-center gap-1 w-fit">
                                  —
                                </span>
                              ) : !dsRating ? (
                                <span className="text-slate-400 dark:text-slate-500 font-mono text-xs italic">
                                  Pending
                                </span>
                              ) : (
                                <span
                                  className="font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-800/80 flex items-center gap-1 w-fit"
                                  title={`DS: ${dsRating.score.toFixed(1)} / 5.0 (${dsRating.grade}) - ${dsRating.verdict || 'Playable'}`}
                                >
                                  <span>{dsRating.grade}</span>
                                  <span className="text-[10px] text-sky-600/80 dark:text-sky-400/80 font-normal">({dsRating.score.toFixed(1)})</span>
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
                              <a
                                href={get17LandsCardUrl(row.card.set || currentSetCode, row.card, row.landData)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800/80 transition-colors inline-flex items-center gap-1 group/l17"
                                title={`Open ${row.card.name} on 17lands.com`}
                              >
                                <span>{isBlindGrading ? '—' : row.actualTier}</span>
                                {!isBlindGrading && <ExternalLink className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 opacity-60 group-hover/l17:opacity-100 transition-opacity" />}
                              </a>
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
                            <a
                              href={get17LandsCardUrl(row.card.set || currentSetCode, row.card, row.landData)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline font-bold inline-flex items-center gap-1 group/wr"
                              title={`View ${row.card.name} win rate on 17lands.com`}
                            >
                              <span>{(row.winRate * 100).toFixed(1)}%</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover/wr:opacity-100 transition-opacity" />
                            </a>
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
                            ) : verdict && row.userGrade ? (
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${verdict.color}`} title="Accuracy vs Creator benchmark">
                                {verdict.text} <span className="opacity-75 font-normal">(vs Creator)</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 font-semibold">
                                TBD (Pending)
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
              </>
            )}
          </>
        )}
        </div>
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
                    onClick={() => handleSelectCardForModal(card)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectCardForModal(card);
                      }
                    }}
                    className="group p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/60 dark:hover:border-cyan-500/60 space-y-2 shadow-xs hover:shadow-md cursor-pointer transition-all duration-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-400">#{card.collector_number}</span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-400 transition-colors">{card.name}</h4>
                        {card.mana_cost && <ManaCostRenderer manaCost={card.mana_cost} size="xs" />}
                      </div>
                      <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                        Grade: {evalData.userGrade}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 italic leading-relaxed group-hover:border-slate-300 dark:group-hover:border-slate-700 transition-colors">
                      "{evalData.notes}"
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono pt-0.5">
                      <span>Priority: <strong className="text-violet-700 dark:text-cyan-300">{evalData.pickPriority}</strong></span>
                      <span className="flex items-center gap-1 group-hover:text-violet-600 dark:group-hover:text-cyan-400 transition-colors">
                        Updated: {new Date(evalData.updatedAt).toLocaleDateString()}
                        <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-1 font-sans font-medium text-violet-600 dark:text-cyan-400">
                          (Click to edit)
                        </span>
                      </span>
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
      {selectedCardForModal && (() => {
        // Determine card pool for modal: if outside 'grade' subtab, or if clicked card isn't in filteredCards, use full cards list
        const isGradeTab = activeSubTab === 'grade';
        const isInFiltered = isGradeTab && filteredCards.some(
          (c) =>
            c.id === selectedCardForModal.id ||
            (c.name.toLowerCase() === selectedCardForModal.name.toLowerCase() &&
              (c.set || '').toLowerCase() === (selectedCardForModal.set || '').toLowerCase())
        );
        const modalCards = isInFiltered ? filteredCards : cards;

        return (
          <QuickRateModal
            isOpen={Boolean(selectedCardForModal)}
            onClose={() => handleSelectCardForModal(null)}
            cards={modalCards}
            card={selectedCardForModal}
            onSelectCard={handleSelectCardForModal}
            userEvaluations={userEvaluations}
            seventeenLandsData={effective17LandsData}
            isBlindGrading={isBlindGrading}
            onToggleBlindGrading={handleToggleBlindGrading}
            showMe={showMe}
            showLsv={showLsv}
            showLlu={showLlu}
            showDs={showDs}
            show17L={show17L}
            onToggleMe={handleToggleMe}
            onToggleLsv={handleToggleLsv}
            onToggleLlu={handleToggleLlu}
            onToggleDs={handleToggleDs}
            onToggle17L={handleToggle17L}
            gradeDisplayMode={gradeDisplayMode}
            onChangeGradeDisplayMode={handleSetGradeDisplayMode}
            onSaveEvaluation={onSaveEvaluation}
            onDeleteEvaluation={onDeleteEvaluation}
            isFiltered={isGradeTab && isInFiltered && filteredCards.length < cards.length}
            filterDescription={searchQuery ? `Search: "${searchQuery}"` : 'Filters active'}
            totalSetCardsCount={cards.length}
            onClearFilter={() => {
              setSearchQuery('');
              setSelectedColors(['ALL']);
              setSelectedRarities(['ALL']);
              setSelectedRoles(['ALL']);
              setFilterRatedStatus('ALL');
            }}
            onPracticeCard={onPracticeCard}
          />
        );
      })()}

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
          allCards={filteredCards && filteredCards.length > 1 ? filteredCards : cards}
          onSelectTargetCard={(card) => setSimilarCardsModalCard(card)}
          currentGrade={userEvaluations[`${similarCardsModalCard.set.toLowerCase()}_${similarCardsModalCard.name.toLowerCase()}`]?.userGrade}
          target17LandsData={
            (() => {
              const rating = get17LandsCardRating(similarCardsModalCard, effective17LandsData)
                || getOrEstimate17LandsCardRating(similarCardsModalCard, effective17LandsData);
              if (rating && typeof rating.win_rate === 'number') {
                return {
                  winRate: rating.win_rate,
                  alsa: rating.avg_seen,
                  tierGrade: (rating.tier_grade as GradeTier) || winRateToGradeTier(rating.win_rate),
                };
              }
              return undefined;
            })()
          }
          onAdoptGrade={(targetCard, grade) => {
            handleQuickGrade(targetCard, grade);
          }}
          isAdmin={isAdmin}
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
          initialTab={exportModalTab}
        />
      )}

    </div>
  );
};

export default EvaluationHub;
