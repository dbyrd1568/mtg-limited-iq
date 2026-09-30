import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileCode,
  Check,
  AlertTriangle,
  Layers,
  Target,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Award,
  ExternalLink,
  LayoutGrid,
  List,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  AdminUserSummary,
  UserSetGradingDetail,
} from '../../types/admin';
import {
  Card,
  GradeTier,
  UserCardEvaluation,
  UserArchetypeEvaluation,
  SeventeenLandsSetData,
  SetInfo,
} from '../../types/mtg';
import {
  fetchEvaluationsForUser,
  fetchArchetypeEvaluationsForUser,
  exportUserEvaluationScorecard,
  isPermanentSuperAdmin,
} from '../../services/admin';
import {
  fetch17LandsSetData,
  get17LandsCardRating,
  gradeTierToIndex,
  winRateToGradeTier,
  GRADE_TIERS,
  GRADE_SCORES,
} from '../../services/seventeenLands';
import { fetchCardsForSet, POPULAR_LIMITED_SETS } from '../../services/scryfall';
import { getLsvRatingForCard } from '../../services/lsvRatings';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { CardImage } from '../UI/CardImage';
import { CalibrationScatterPlot } from '../Evaluation/CalibrationScatterPlot';
import { QuickRateModal } from '../Evaluation/QuickRateModal';
import { ArchetypeForecastView } from '../Evaluation/ArchetypeForecastView';

export interface AdminUserEvaluationInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUserSummary | null;
  initialSetCode?: string;
  allSets?: SetInfo[];
}

type InspectorSubTab = 'cards' | 'archetypes' | 'calibration';
export type EvaluatedCardSortField =
  | 'card'
  | 'set'
  | 'grade'
  | 'priority'
  | 'notes'
  | 'tier'
  | 'winrate'
  | 'delta'
  | 'date';

export type SortDirection = 'asc' | 'desc';

export const AdminUserEvaluationInspectorModal: React.FC<AdminUserEvaluationInspectorModalProps> = ({
  isOpen,
  onClose,
  user,
  initialSetCode,
  allSets = POPULAR_LIMITED_SETS,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<InspectorSubTab>('cards');
  const [selectedSetCode, setSelectedSetCode] = useState<string>('ALL');

  // Evaluation Data
  const [evaluations, setEvaluations] = useState<Record<string, UserCardEvaluation>>({});
  const [archetypeEvaluations, setArchetypeEvaluations] = useState<Record<string, UserArchetypeEvaluation>>({});
  const [isLoadingEvals, setIsLoadingEvals] = useState(false);

  // Set-Specific Cards and 17Lands Data
  const [setCardsMap, setSetCardsMap] = useState<Record<string, Card[]>>({});
  const [seventeenLandsDataMap, setSeventeenLandsDataMap] = useState<Record<string, SeventeenLandsSetData | null>>({});
  const [isLoadingSetData, setIsLoadingSetData] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedCardForModal, setSelectedCardForModal] = useState<Card | null>(null);
  const [onlyNotes, setOnlyNotes] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'exact' | 'close' | 'traps' | 'sleepers'>('ALL');
  const [rarityFilter, setRarityFilter] = useState<string>('ALL');
  const [colorFilter, setColorFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<EvaluatedCardSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);
  const setDropdownRef = useRef<HTMLDivElement>(null);

  // Close Set dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (setDropdownRef.current && !setDropdownRef.current.contains(event.target as Node)) {
        setIsSetDropdownOpen(false);
      }
    }
    if (isSetDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSetDropdownOpen]);

  // Initialize selected set code when modal opens or initialSetCode changes
  useEffect(() => {
    if (!isOpen || !user) return;

    if (initialSetCode && initialSetCode !== 'ALL') {
      setSelectedSetCode(initialSetCode.toUpperCase());
    } else {
      const activeSets = user.setsGraded?.filter((s) => s.cardsGraded > 0) || [];
      if (activeSets.length > 0) {
        setSelectedSetCode(activeSets[0].setCode.toUpperCase());
      } else {
        setSelectedSetCode('ALL');
      }
    }
  }, [isOpen, user?.id, initialSetCode]);

  // Load User Evaluations (both cards & archetypes)
  useEffect(() => {
    if (!isOpen || !user) {
      setEvaluations({});
      setArchetypeEvaluations({});
      return;
    }

    setIsLoadingEvals(true);
    Promise.all([
      fetchEvaluationsForUser(user.id),
      fetchArchetypeEvaluationsForUser(user.id),
    ])
      .then(([cardEvals, archEvals]) => {
        setEvaluations(cardEvals || {});
        setArchetypeEvaluations(archEvals || {});
      })
      .catch((err) => {
        console.error('Failed to load user evaluations for inspector:', err);
      })
      .finally(() => {
        setIsLoadingEvals(false);
      });
  }, [isOpen, user?.id]);

  // User sets that have at least 1 evaluation
  const userActiveSets = useMemo(() => {
    const setMap = new Map<string, { setCode: string; setName: string; cardsGraded: number }>();
    if (user?.setsGraded) {
      user.setsGraded.forEach((s) => {
        if (s.cardsGraded > 0) {
          setMap.set(s.setCode.toUpperCase(), {
            setCode: s.setCode.toUpperCase(),
            setName: s.setName || s.setCode.toUpperCase(),
            cardsGraded: s.cardsGraded,
          });
        }
      });
    }
    // Also tally from actual evaluations in case user.setsGraded is pending sync
    const evalTally: Record<string, number> = {};
    Object.values(evaluations).forEach((ev) => {
      if (ev.setCode) {
        const code = ev.setCode.toUpperCase();
        evalTally[code] = (evalTally[code] || 0) + 1;
      }
    });
    Object.entries(evalTally).forEach(([code, count]) => {
      const existing = setMap.get(code);
      if (existing) {
        existing.cardsGraded = Math.max(existing.cardsGraded, count);
      } else {
        const popular = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === code);
        setMap.set(code, {
          setCode: code,
          setName: popular?.name || code,
          cardsGraded: count,
        });
      }
    });

    return Array.from(setMap.values()).sort((a, b) => b.cardsGraded - a.cardsGraded);
  }, [user, evaluations]);

  // Load Set Cards Catalog and 17Lands Data when selectedSetCode or active sets change
  useEffect(() => {
    if (!isOpen) return;

    const setCodesToLoad: string[] = [];
    if (selectedSetCode !== 'ALL') {
      setCodesToLoad.push(selectedSetCode.toUpperCase());
    } else {
      const fromEvals = Object.values(evaluations).map((e) => e.setCode?.toUpperCase()).filter(Boolean);
      const fromSets = userActiveSets.map((s) => s.setCode.toUpperCase());
      const unique = Array.from(new Set([...fromSets, ...fromEvals]));
      setCodesToLoad.push(...unique);
    }

    const missingCards = setCodesToLoad.filter((s) => !setCardsMap[s]);
    const missing17L = setCodesToLoad.filter((s) => seventeenLandsDataMap[s] === undefined);

    if (missingCards.length === 0 && missing17L.length === 0) return;

    setIsLoadingSetData(true);
    const promises: Promise<any>[] = [];

    missingCards.forEach((s) => {
      promises.push(
        fetchCardsForSet(s)
          .then((cards: Card[]) => {
            setSetCardsMap((prev) => ({ ...prev, [s]: cards }));
          })
          .catch((err: unknown) => {
            console.warn(`Could not load cards for set ${s}:`, err);
            setSetCardsMap((prev) => ({ ...prev, [s]: [] }));
          })
      );
    });

    missing17L.forEach((s) => {
      promises.push(
        fetch17LandsSetData(s)
          .then((data: SeventeenLandsSetData | null) => {
            setSeventeenLandsDataMap((prev) => ({ ...prev, [s]: data }));
          })
          .catch((err: unknown) => {
            console.warn(`Could not load 17Lands data for set ${s}:`, err);
            setSeventeenLandsDataMap((prev) => ({ ...prev, [s]: null }));
          })
      );
    });

    Promise.all(promises).finally(() => {
      setIsLoadingSetData(false);
    });
  }, [isOpen, selectedSetCode, userActiveSets, evaluations, setCardsMap, seventeenLandsDataMap]);

  // Flat list of evaluations filtered by the active set
  const filteredEvaluationsList = useMemo(() => {
    const list = Object.values(evaluations);
    if (selectedSetCode === 'ALL') {
      return list;
    }
    return list.filter((ev) => ev.setCode?.toUpperCase() === selectedSetCode.toUpperCase());
  }, [evaluations, selectedSetCode]);

  // Total cards with notes
  const notesCount = useMemo(() => {
    return filteredEvaluationsList.filter((ev) => Boolean(ev.notes && ev.notes.trim().length > 0)).length;
  }, [filteredEvaluationsList]);

  // Enrich evaluations with 17Lands metrics and Scryfall card data
  const enrichedEvaluations = useMemo(() => {
    return filteredEvaluationsList.map((ev) => {
      const setCode = ev.setCode.toUpperCase();
      const cardsInSet = setCardsMap[setCode] || [];
      const cardObj = cardsInSet.find((c) => c.name.toLowerCase() === ev.cardName.toLowerCase()) || null;
      const seventeenLandsData = seventeenLandsDataMap[setCode] || null;

      let landRating = cardObj && seventeenLandsData ? get17LandsCardRating(cardObj, seventeenLandsData) : undefined;
      if (!landRating && seventeenLandsData?.cards) {
        landRating = seventeenLandsData.cards[ev.cardName];
      }

      let actualTier: GradeTier | null = null;
      if (landRating && typeof landRating.win_rate === 'number') {
        actualTier = (landRating.tier_grade as GradeTier) || winRateToGradeTier(landRating.win_rate);
      }

      const isNA = ev.userGrade === 'N/A';
      const userIdx = !isNA ? gradeTierToIndex(ev.userGrade) : -1;
      const actualIdx = actualTier ? gradeTierToIndex(actualTier) : -1;

      let stepDelta: number | null = null;
      let status: 'exact' | 'close' | 'trap' | 'sleeper' | 'unrated' = 'unrated';

      if (userIdx >= 0 && actualIdx >= 0) {
        // Delta: positive = user gave higher grade (Trap), negative = user underrated (Sleeper)
        stepDelta = actualIdx - userIdx;
        const absDiff = Math.abs(stepDelta);
        if (absDiff === 0) status = 'exact';
        else if (absDiff === 1) status = 'close';
        else if (stepDelta >= 2) status = 'trap';
        else status = 'sleeper';
      }

      return {
        eval: ev,
        card: cardObj,
        landRating,
        actualTier,
        stepDelta,
        status,
        isNA,
      };
    });
  }, [filteredEvaluationsList, setCardsMap, seventeenLandsDataMap]);

  const isAllGrades = selectedGrades.length === 0 || selectedGrades.includes('ALL');

  const handleToggleGrade = (tier: string) => {
    if (tier === 'ALL') {
      setSelectedGrades([]);
      return;
    }
    setSelectedGrades((prev) => {
      if (prev.includes(tier)) {
        return prev.filter((g) => g !== tier);
      } else {
        return [...prev, tier];
      }
    });
  };

  // Filtered & Sorted Card Evaluations
  const displayedCardRows = useMemo(() => {
    let result = enrichedEvaluations.filter((item) => {
      const { eval: ev, card } = item;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = ev.cardName?.toLowerCase().includes(q);
        const notesMatch = ev.notes?.toLowerCase().includes(q);
        const oracleMatch = card?.oracle_text?.toLowerCase().includes(q);
        if (!nameMatch && !notesMatch && !oracleMatch) return false;
      }

      // Grade Filter (supports multi-selection)
      if (!isAllGrades && !selectedGrades.includes(ev.userGrade)) {
        return false;
      }

      // Only Cards with Notes
      if (onlyNotes && (!ev.notes || ev.notes.trim().length === 0)) {
        return false;
      }

      // Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'exact' && item.status !== 'exact') return false;
        if (statusFilter === 'close' && item.status !== 'close') return false;
        if (statusFilter === 'traps' && item.status !== 'trap') return false;
        if (statusFilter === 'sleepers' && item.status !== 'sleeper') return false;
      }

      // Rarity Filter
      if (rarityFilter !== 'ALL' && card) {
        if (card.rarity?.toLowerCase() !== rarityFilter.toLowerCase()) return false;
      }

      // Color Filter
      if (colorFilter !== 'ALL' && card) {
        const colors = card.colors || [];
        if (colorFilter === 'C' && colors.length > 0) return false;
        if (colorFilter === 'M' && colors.length < 2) return false;
        if (['W', 'U', 'B', 'R', 'G'].includes(colorFilter) && !colors.includes(colorFilter as any)) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;

      if (sortField === 'card') {
        cmp = a.eval.cardName.localeCompare(b.eval.cardName);
        if (sortDirection === 'desc') cmp = -cmp;
      } else if (sortField === 'set') {
        cmp = a.eval.setCode.localeCompare(b.eval.setCode);
        if (sortDirection === 'desc') cmp = -cmp;
      } else if (sortField === 'grade') {
        const scoreA = typeof a.eval.userScore === 'number' ? a.eval.userScore : (GRADE_SCORES[a.eval.userGrade as GradeTier] ?? -1);
        const scoreB = typeof b.eval.userScore === 'number' ? b.eval.userScore : (GRADE_SCORES[b.eval.userGrade as GradeTier] ?? -1);
        cmp = sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      } else if (sortField === 'priority') {
        const PRIORITY_WEIGHTS: Record<string, number> = {
          '1st Pick Bomb': 5,
          'Early Pick': 4,
          'Mid Pick': 3,
          'Late Filler': 2,
          'Sideboard / Unplayable': 1,
        };
        const prioA = PRIORITY_WEIGHTS[a.eval.pickPriority || ''] ?? (a.eval.pickPriority ? 2.5 : 0);
        const prioB = PRIORITY_WEIGHTS[b.eval.pickPriority || ''] ?? (b.eval.pickPriority ? 2.5 : 0);
        cmp = sortDirection === 'asc' ? prioA - prioB : prioB - prioA;
      } else if (sortField === 'notes') {
        const notesA = (a.eval.notes || '').trim();
        const notesB = (b.eval.notes || '').trim();
        if (notesA && !notesB) cmp = sortDirection === 'asc' ? 1 : -1;
        else if (!notesA && notesB) cmp = sortDirection === 'asc' ? -1 : 1;
        else cmp = sortDirection === 'asc' ? notesA.localeCompare(notesB) : notesB.localeCompare(notesA);
      } else if (sortField === 'tier') {
        const tierA = a.actualTier ? (GRADE_SCORES[a.actualTier] ?? -1) : -1;
        const tierB = b.actualTier ? (GRADE_SCORES[b.actualTier] ?? -1) : -1;
        cmp = sortDirection === 'asc' ? tierA - tierB : tierB - tierA;
      } else if (sortField === 'winrate') {
        const wrA = typeof a.landRating?.win_rate === 'number' ? a.landRating.win_rate : -1;
        const wrB = typeof b.landRating?.win_rate === 'number' ? b.landRating.win_rate : -1;
        cmp = sortDirection === 'asc' ? wrA - wrB : wrB - wrA;
      } else if (sortField === 'delta') {
        // Delta: positive = Trap, negative = Sleeper
        const deltaA = a.stepDelta ?? (sortDirection === 'asc' ? 999 : -999);
        const deltaB = b.stepDelta ?? (sortDirection === 'asc' ? 999 : -999);
        cmp = sortDirection === 'asc' ? deltaA - deltaB : deltaB - deltaA;
      } else if (sortField === 'date') {
        const timeA = a.eval.updatedAt ? new Date(a.eval.updatedAt).getTime() : 0;
        const timeB = b.eval.updatedAt ? new Date(b.eval.updatedAt).getTime() : 0;
        cmp = sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (cmp !== 0) return cmp;
      return a.eval.cardName.localeCompare(b.eval.cardName);
    });

    return result;
  }, [enrichedEvaluations, searchQuery, selectedGrades, isAllGrades, onlyNotes, statusFilter, rarityFilter, colorFilter, sortField, sortDirection]);

  // Modal Cards List ensuring selectedCardForModal is included for smooth navigation
  const modalCardsList = useMemo(() => {
    if (!selectedCardForModal) return [];
    const setCode = selectedCardForModal.set?.toUpperCase();
    const setCards = setCode ? setCardsMap[setCode] : undefined;
    if (setCards && setCards.length > 0) {
      const hasCard = setCards.some(
        (c) => c.id === selectedCardForModal.id || c.name.toLowerCase() === selectedCardForModal.name.toLowerCase()
      );
      if (hasCard) return setCards;
      return [selectedCardForModal, ...setCards];
    }
    const displayedCards = displayedCardRows.map((r) => r.card).filter(Boolean) as Card[];
    const hasCard = displayedCards.some(
      (c) => c.id === selectedCardForModal.id || c.name.toLowerCase() === selectedCardForModal.name.toLowerCase()
    );
    if (hasCard) return displayedCards;
    return [selectedCardForModal, ...displayedCards];
  }, [selectedCardForModal, setCardsMap, displayedCardRows]);

  // Open Card QuickRateModal
  const handleOpenCardModal = (item: { eval: UserCardEvaluation; card: Card | null }) => {
    const setCode = item.eval.setCode.toUpperCase();

    // Ensure 17Lands data for this set is fetched if not yet in cache
    if (seventeenLandsDataMap[setCode] === undefined) {
      fetch17LandsSetData(setCode)
        .then((data) => {
          setSeventeenLandsDataMap((prev) => ({ ...prev, [setCode]: data }));
        })
        .catch(() => {
          setSeventeenLandsDataMap((prev) => ({ ...prev, [setCode]: null }));
        });
    }

    if (item.card) {
      setSelectedCardForModal(item.card);
    } else {
      const fallback: Card = {
        id: `card_${item.eval.setCode}_${item.eval.cardName}`,
        name: item.eval.cardName,
        set: item.eval.setCode.toLowerCase(),
        set_name: item.eval.setCode.toUpperCase(),
        collector_number: '1',
        rarity: 'common',
        type_line: 'Card',
        oracle_text: '',
        mana_cost: '',
        cmc: 0,
        colors: [],
        color_identity: [],
        keywords: [],
        image_uris: {
          normal: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(item.eval.cardName)}&set=${encodeURIComponent(item.eval.setCode)}&format=image`,
          large: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(item.eval.cardName)}&set=${encodeURIComponent(item.eval.setCode)}&format=image&version=large`,
          small: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(item.eval.cardName)}&set=${encodeURIComponent(item.eval.setCode)}&format=image&version=small`,
          art_crop: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(item.eval.cardName)}&set=${encodeURIComponent(item.eval.setCode)}&format=image&version=art_crop`,
        },
      };
      setSelectedCardForModal(fallback);

      fetchCardsForSet(setCode)
        .then((fetchedCards) => {
          setSetCardsMap((prev) => ({ ...prev, [setCode]: fetchedCards }));
          const match = fetchedCards.find((c) => c.name.toLowerCase() === item.eval.cardName.toLowerCase());
          if (match) {
            setSelectedCardForModal(match);
          }
        })
        .catch(() => {});
    }
  };

  const handleToggleSort = (field: EvaluatedCardSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Default to ascending for names/sets, descending for grades/priority/metrics/dates
      if (field === 'card' || field === 'set') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
    }
  };

  const getDropdownSortValue = (): string => {
    if (sortField === 'date' && sortDirection === 'desc') return 'recent';
    if (sortField === 'date' && sortDirection === 'asc') return 'date-asc';
    if (sortField === 'delta' && sortDirection === 'desc') return 'gap-traps';
    if (sortField === 'delta' && sortDirection === 'asc') return 'gap-sleepers';
    if (sortField === 'grade' && sortDirection === 'desc') return 'grade-desc';
    if (sortField === 'grade' && sortDirection === 'asc') return 'grade-asc';
    if (sortField === 'card' && sortDirection === 'asc') return 'name-asc';
    if (sortField === 'card' && sortDirection === 'desc') return 'name-desc';
    if (sortField === 'winrate' && sortDirection === 'desc') return 'wr-desc';
    if (sortField === 'winrate' && sortDirection === 'asc') return 'wr-asc';
    if (sortField === 'tier' && sortDirection === 'desc') return 'tier-desc';
    if (sortField === 'priority' && sortDirection === 'desc') return 'priority-desc';
    if (sortField === 'notes' && sortDirection === 'desc') return 'notes-desc';
    if (sortField === 'set' && sortDirection === 'asc') return 'set-asc';
    return `${sortField}-${sortDirection}`;
  };

  const handleDropdownSortChange = (value: string) => {
    switch (value) {
      case 'recent':
        setSortField('date');
        setSortDirection('desc');
        break;
      case 'date-asc':
        setSortField('date');
        setSortDirection('asc');
        break;
      case 'gap-traps':
        setSortField('delta');
        setSortDirection('desc');
        break;
      case 'gap-sleepers':
        setSortField('delta');
        setSortDirection('asc');
        break;
      case 'grade-desc':
        setSortField('grade');
        setSortDirection('desc');
        break;
      case 'grade-asc':
        setSortField('grade');
        setSortDirection('asc');
        break;
      case 'name-asc':
      case 'name':
        setSortField('card');
        setSortDirection('asc');
        break;
      case 'name-desc':
        setSortField('card');
        setSortDirection('desc');
        break;
      case 'wr-desc':
        setSortField('winrate');
        setSortDirection('desc');
        break;
      case 'wr-asc':
        setSortField('winrate');
        setSortDirection('asc');
        break;
      case 'tier-desc':
        setSortField('tier');
        setSortDirection('desc');
        break;
      case 'priority-desc':
        setSortField('priority');
        setSortDirection('desc');
        break;
      case 'notes-desc':
        setSortField('notes');
        setSortDirection('desc');
        break;
      case 'set-asc':
        setSortField('set');
        setSortDirection('asc');
        break;
      default:
        break;
    }
  };

  const renderSortHeader = (
    field: EvaluatedCardSortField,
    label: string,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleToggleSort(field)}
        className={`py-2.5 px-3 cursor-pointer select-none group transition-colors hover:bg-slate-200/80 dark:hover:bg-slate-800 ${
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
        } ${isActive ? 'text-violet-700 dark:text-cyan-300 font-bold bg-violet-100/50 dark:bg-violet-950/30' : ''}`}
        title={`Sort by ${label} (${isActive ? (sortDirection === 'asc' ? 'currently ascending, click for descending' : 'currently descending, click for ascending') : 'click to sort'})`}
      >
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 w-full cursor-pointer focus:outline-hidden ${
            align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
          }`}
        >
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-violet-600 dark:text-cyan-400 shrink-0" />
            ) : (
              <ArrowDown className="w-3 h-3 text-violet-600 dark:text-cyan-400 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </button>
      </th>
    );
  };

  // Top Traps and Sleepers for Active Set
  const topTraps = useMemo(() => {
    return enrichedEvaluations
      .filter((item) => (item.stepDelta ?? 0) >= 2)
      .sort((a, b) => (b.stepDelta ?? 0) - (a.stepDelta ?? 0))
      .slice(0, 5);
  }, [enrichedEvaluations]);

  const topSleepers = useMemo(() => {
    return enrichedEvaluations
      .filter((item) => (item.stepDelta ?? 0) <= -2)
      .sort((a, b) => (a.stepDelta ?? 0) - (b.stepDelta ?? 0))
      .slice(0, 5);
  }, [enrichedEvaluations]);

  if (!isOpen || !user) return null;

  const handleExport = (format: 'csv' | 'json') => {
    setIsExportMenuOpen(false);
    exportUserEvaluationScorecard(
      user,
      evaluations,
      archetypeEvaluations,
      selectedSetCode === 'ALL' ? undefined : selectedSetCode,
      format
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-7xl h-[92vh] max-h-[960px] bg-white dark:bg-[#080d21] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* ==================== 1. MODAL HEADER ==================== */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#050818]/90 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* User Identity & Badges */}
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base text-white shadow-md shrink-0 ring-2 ring-violet-500/30"
                style={{ backgroundColor: user.avatarColor || '#6366f1' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black font-heading text-slate-900 dark:text-white truncate">
                    {user.name}
                  </h2>
                  {user.isAdmin && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                      ADMIN
                    </span>
                  )}
                  {isPermanentSuperAdmin(user.email) && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      OWNER
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                  <span>{user.email || user.id}</span>
                  <span>•</span>
                  <span>Auth: {user.authMethodLabel || user.provider}</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar & Export Menu */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-400">Graded: </span>
                  <strong className="text-violet-600 dark:text-cyan-300">{filteredEvaluationsList.length}</strong>
                </div>
                <div className="text-slate-300 dark:text-slate-700">|</div>
                <div>
                  <span className="text-slate-400">GPA: </span>
                  <strong className="text-slate-900 dark:text-white">{user.gradingGpa || '—'}</strong>
                </div>
                <div className="text-slate-300 dark:text-slate-700">|</div>
                <div>
                  <span className="text-slate-400">Notes: </span>
                  <strong className="text-emerald-600 dark:text-emerald-400">{notesCount}</strong>
                </div>
              </div>

              {/* Export Menu Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold font-mono bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/60 dark:hover:bg-violet-900/60 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-violet-800 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {isExportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleExport('csv')}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      <span>Export as CSV (.csv)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('json')}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <FileCode className="w-4 h-4 text-violet-500" />
                      <span>Export as JSON (.json)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close inspector modal"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Set Selector Strip & Subtab Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/60">
            {/* Set Selector Dropdown (styled like main header) */}
            <div className="relative shrink-0" ref={setDropdownRef}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 uppercase font-bold shrink-0">
                  Set:
                </span>
                <button
                  type="button"
                  onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all shadow-xs group cursor-pointer shrink-0 whitespace-nowrap border bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  title="Switch inspected MTG set"
                >
                  {selectedSetCode === 'ALL' ? (
                    <>
                      <div className="w-5 h-5 rounded-md bg-violet-600/20 text-violet-400 border border-violet-500/40 flex items-center justify-center font-mono text-[9px] font-black">
                        ALL
                      </div>
                      <span className="font-mono text-xs font-bold text-violet-600 dark:text-cyan-300">All Sets</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({Object.keys(evaluations).length})
                      </span>
                    </>
                  ) : (
                    <>
                      <SetSymbol setCode={selectedSetCode} size="xs" />
                      <span className="font-mono text-xs font-bold text-violet-600 dark:text-cyan-300">
                        {selectedSetCode}
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[130px] hidden sm:inline">
                        {userActiveSets.find((s) => s.setCode === selectedSetCode)?.setName || selectedSetCode}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({userActiveSets.find((s) => s.setCode === selectedSetCode)?.cardsGraded ?? filteredEvaluationsList.length})
                      </span>
                    </>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 ${isSetDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Floating Dropdown Menu */}
              {isSetDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-1.5 space-y-1 scrollbar-thin">
                  {/* Option: All Sets */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSetCode('ALL');
                      setIsSetDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                      selectedSetCode === 'ALL'
                        ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-cyan-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-violet-600/20 text-violet-500 border border-violet-500/30 flex items-center justify-center text-[9px] font-black">
                        ALL
                      </div>
                      <span>All Evaluated Sets</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">({Object.keys(evaluations).length})</span>
                      {selectedSetCode === 'ALL' && <Check className="w-4 h-4 text-violet-600 dark:text-cyan-400" />}
                    </div>
                  </button>

                  {/* Divider */}
                  <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                    Sets Graded by User ({userActiveSets.length})
                  </div>

                  {userActiveSets.map((s) => {
                    const isSelected = selectedSetCode === s.setCode;
                    return (
                      <button
                        key={s.setCode}
                        type="button"
                        onClick={() => {
                          setSelectedSetCode(s.setCode);
                          setIsSetDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-cyan-300 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <SetSymbol setCode={s.setCode} size="sm" />
                          <div className="text-left min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white leading-tight">
                              {s.setCode}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                              {s.setName}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {s.cardsGraded} cards
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-violet-600 dark:text-cyan-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subtab Switcher */}
            <div className="flex items-center bg-slate-200/60 dark:bg-slate-900 p-0.5 rounded-xl text-xs font-mono shrink-0">
              <button
                type="button"
                onClick={() => setActiveSubTab('cards')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === 'cards'
                    ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-cyan-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Card Grades & Notes ({filteredEvaluationsList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('archetypes')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === 'archetypes'
                    ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-cyan-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Archetypes & Colors</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('calibration')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === 'calibration'
                    ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-cyan-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Calibration & Bias</span>
              </button>
            </div>
          </div>
        </div>

        {/* ==================== 2. MAIN CONTENT BODY ==================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoadingEvals ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-violet-600" />
              <span>Fetching user evaluations and cloud grades...</span>
            </div>
          ) : filteredEvaluationsList.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs text-center max-w-md mx-auto">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No evaluations recorded for {selectedSetCode === 'ALL' ? 'this user' : `set ${selectedSetCode}`}.
              </p>
              <p className="text-xs text-slate-500">
                Card grades and notes appear here once the user evaluates cards in the Evaluation Hub.
              </p>
            </div>
          ) : (
            <>
              {/* ==================== SUBTAB 1: CARD GRADES & NOTES ==================== */}
              {activeSubTab === 'cards' && (
                <div className="space-y-4">
                  {/* Filter & Search Toolbar */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Search Bar */}
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search card name, rules text, or user note text..."
                          className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Only Notes Toggle & View Layout Switcher */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setOnlyNotes(!onlyNotes)}
                          className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            onlyNotes
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Only Cards with Notes ({notesCount})</span>
                        </button>

                        <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            title="Dense Table View"
                            className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                              viewMode === 'table'
                                ? 'bg-violet-600 text-white shadow-2xs'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            <List className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            title="Visual Card Grid View"
                            className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                              viewMode === 'grid'
                                ? 'bg-violet-600 text-white shadow-2xs'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            <LayoutGrid className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Filter Pills: Grade, Status, Sort */}
                    <div className="flex items-center justify-between gap-3 flex-wrap pt-1 text-xs font-mono">
                      {/* Grade Tier Filter */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px] text-slate-400 font-bold uppercase mr-1">
                          Grade{selectedGrades.length > 1 ? ` (${selectedGrades.length})` : ''}:
                        </span>
                        {['ALL', ...GRADE_TIERS, 'N/A'].map((tier) => {
                          const isSelected = tier === 'ALL' ? isAllGrades : selectedGrades.includes(tier);
                          return (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => handleToggleGrade(tier)}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-violet-600 text-white border-violet-500 shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {tier}
                            </button>
                          );
                        })}
                      </div>

                      {/* Status / Discrepancy Filter */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-bold uppercase mr-1">Status:</span>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="exact">Exact Matches (0 Steps)</option>
                          <option value="close">Within 1 Step (Close)</option>
                          <option value="traps">Traps (Overrated 2+ Steps)</option>
                          <option value="sleepers">Sleepers (Underrated 2+ Steps)</option>
                        </select>

                        {/* Sort Dropdown */}
                        <select
                          value={getDropdownSortValue()}
                          onChange={(e) => handleDropdownSortChange(e.target.value)}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                        >
                          <option value="recent">Most Recently Graded</option>
                          <option value="date-asc">Oldest Graded First</option>
                          <option value="gap-traps">Biggest Traps First (+Δ)</option>
                          <option value="gap-sleepers">Biggest Sleepers First (-Δ)</option>
                          <option value="grade-desc">Highest Grade (A+ &rarr; F)</option>
                          <option value="grade-asc">Lowest Grade (F &rarr; A+)</option>
                          <option value="name-asc">Card Name (A &rarr; Z)</option>
                          <option value="name-desc">Card Name (Z &rarr; A)</option>
                          <option value="wr-desc">GIH Win Rate (Highest First)</option>
                          <option value="wr-asc">GIH Win Rate (Lowest First)</option>
                          <option value="tier-desc">17Lands Tier (Highest First)</option>
                          <option value="priority-desc">Pick Priority (Highest First)</option>
                          <option value="notes-desc">User Notes (Has Notes First)</option>
                          <option value="set-asc">Set Code (A &rarr; Z)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Results Count Banner */}
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                    <span>Showing {displayedCardRows.length} of {filteredEvaluationsList.length} cards evaluated</span>
                    {searchQuery && (
                      <span>Search query: "{searchQuery}"</span>
                    )}
                  </div>

                  {/* ==================== DENSE TABLE VIEW ==================== */}
                  {viewMode === 'table' ? (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950/60 shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-slate-100/80 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              {renderSortHeader('card', 'Card', 'left')}
                              {renderSortHeader('set', 'Set', 'left')}
                              {renderSortHeader('grade', 'User Grade', 'center')}
                              {renderSortHeader('priority', 'Pick Priority', 'center')}
                              {renderSortHeader('notes', 'User Notes', 'left')}
                              {renderSortHeader('tier', '17Lands Tier', 'center')}
                              {renderSortHeader('winrate', 'GIH WR', 'center')}
                              {renderSortHeader('delta', 'Calibration Delta', 'center')}
                              {renderSortHeader('date', 'Graded At', 'right')}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {displayedCardRows.map(({ eval: ev, card, actualTier, landRating, stepDelta, status, isNA }) => {
                              const hasNotes = Boolean(ev.notes && ev.notes.trim().length > 0);

                              return (
                                <tr
                                  key={`${ev.setCode}_${ev.cardName}`}
                                  className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors ${
                                    hasNotes ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                                  }`}
                                >
                                  {/* Card Name & Mana */}
                                  <td
                                    onClick={() => handleOpenCardModal({ eval: ev, card })}
                                    className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white max-w-[200px] truncate cursor-pointer hover:text-violet-600 dark:hover:text-cyan-300 transition-colors group"
                                    title={`Click to inspect ${ev.cardName}`}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      {card?.mana_cost && (
                                        <div className="flex items-center shrink-0">
                                          <ManaCostRenderer manaCost={card.mana_cost} size="xs" />
                                        </div>
                                      )}
                                      <span className="truncate group-hover:underline underline-offset-2">{ev.cardName}</span>
                                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity shrink-0 ml-0.5 text-violet-500 dark:text-cyan-400" />
                                    </div>
                                  </td>

                                  {/* Set Code */}
                                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-bold uppercase">
                                    <div className="flex items-center gap-1">
                                      <SetSymbol setCode={ev.setCode} size="xs" />
                                      <span>{ev.setCode}</span>
                                    </div>
                                  </td>

                                  {/* User Grade & Score */}
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-cyan-300 border border-violet-200 dark:border-violet-800">
                                      {ev.userGrade}
                                      {typeof ev.userScore === 'number' && !isNA && (
                                        <span className="opacity-70 text-[10px]">({ev.userScore.toFixed(1)})</span>
                                      )}
                                    </span>
                                  </td>

                                  {/* Pick Priority */}
                                  <td className="py-2.5 px-3 text-center text-[11px] text-slate-600 dark:text-slate-400">
                                    {ev.pickPriority || '—'}
                                  </td>

                                  {/* User Notes */}
                                  <td className="py-2.5 px-3 max-w-[320px]">
                                    {hasNotes ? (
                                      <div
                                        className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-800/60 text-[11px] font-sans text-emerald-900 dark:text-emerald-200 leading-snug line-clamp-2"
                                        title={ev.notes}
                                      >
                                        <span className="font-bold font-mono text-[10px] text-emerald-700 dark:text-emerald-400 uppercase mr-1">
                                          Note:
                                        </span>
                                        {ev.notes}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700 text-[11px] italic">No notes</span>
                                    )}
                                  </td>

                                  {/* 17Lands Tier */}
                                  <td className="py-2.5 px-3 text-center">
                                    {actualTier ? (
                                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                                        {actualTier}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[11px]">—</span>
                                    )}
                                  </td>

                                  {/* GIH WR */}
                                  <td className="py-2.5 px-3 text-center font-bold">
                                    {typeof landRating?.win_rate === 'number' ? (
                                      <span className="text-emerald-600 dark:text-emerald-400">
                                        {(landRating.win_rate * 100).toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-normal">—</span>
                                    )}
                                  </td>

                                  {/* Calibration Delta */}
                                  <td className="py-2.5 px-3 text-center">
                                    {isNA ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                        N/A (Excluded)
                                      </span>
                                    ) : status === 'exact' ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                        Exact Match (0)
                                      </span>
                                    ) : status === 'close' ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                                        Close ({stepDelta && stepDelta > 0 ? `+${stepDelta}` : stepDelta})
                                      </span>
                                    ) : status === 'trap' ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                        Trap (+{stepDelta})
                                      </span>
                                    ) : status === 'sleeper' ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                                        Sleeper ({stepDelta})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">—</span>
                                    )}
                                  </td>

                                  {/* Updated At */}
                                  <td className="py-2.5 px-3 text-right text-[10px] text-slate-400">
                                    {ev.updatedAt ? new Date(ev.updatedAt).toLocaleDateString() : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* ==================== VISUAL CARD GRID VIEW ==================== */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {displayedCardRows.map(({ eval: ev, card, actualTier, landRating, stepDelta, status, isNA }) => {
                        const hasNotes = Boolean(ev.notes && ev.notes.trim().length > 0);
                        const displayCard: Card = card || {
                          id: `card_${ev.setCode}_${ev.cardName}`,
                          name: ev.cardName,
                          set: ev.setCode.toLowerCase(),
                          set_name: ev.setCode.toUpperCase(),
                          collector_number: '1',
                          rarity: 'common',
                          type_line: 'Card',
                          oracle_text: '',
                          mana_cost: '',
                          cmc: 0,
                          colors: [],
                          color_identity: [],
                          keywords: [],
                          image_uris: {
                            normal: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(ev.cardName)}&set=${encodeURIComponent(ev.setCode)}&format=image`,
                            large: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(ev.cardName)}&set=${encodeURIComponent(ev.setCode)}&format=image&version=large`,
                            small: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(ev.cardName)}&set=${encodeURIComponent(ev.setCode)}&format=image&version=small`,
                            art_crop: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(ev.cardName)}&set=${encodeURIComponent(ev.setCode)}&format=image&version=art_crop`,
                          },
                        };
                        const lsvRating = getLsvRatingForCard(displayCard, ev.setCode);

                        return (
                          <div
                            key={`${ev.setCode}_${ev.cardName}`}
                            onClick={() => handleOpenCardModal({ eval: ev, card: displayCard })}
                            className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer group hover:border-violet-500/70 dark:hover:border-violet-400/70 hover:shadow-xl hover:-translate-y-1 active:scale-[0.99] ${
                              hasNotes
                                ? 'bg-emerald-50/20 dark:bg-emerald-950/15 border-emerald-300/80 dark:border-emerald-700/60 shadow-xs'
                                : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="space-y-2">
                              {/* Top Header Strip: Benchmarks (User, LSV, 17L) above the card */}
                              <div className="flex items-center gap-1.5 min-h-[26px] overflow-hidden flex-nowrap">
                                {/* 1. User Grade Badge */}
                                <div
                                  className="px-1.5 py-0.5 rounded-md bg-violet-950/95 text-white border border-violet-400 shadow-xs flex items-center gap-1 font-mono shrink-0 whitespace-nowrap"
                                  title={`User Grade: ${ev.userGrade || '—'}${typeof ev.userScore === 'number' && !isNA ? ` (${ev.userScore.toFixed(1)})` : ''}`}
                                >
                                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-violet-300">User</span>
                                  <span className="text-[11px] font-black">{ev.userGrade || '—'}</span>
                                  {typeof ev.userScore === 'number' && !isNA && (
                                    <span className="opacity-80 text-[10px] font-normal">({ev.userScore.toFixed(1)})</span>
                                  )}
                                </div>

                                {/* 2. LSV Badge */}
                                <div
                                  className="px-1.5 py-0.5 rounded-md bg-amber-950/95 text-white border border-amber-400 shadow-xs flex items-center gap-1 font-mono shrink-0 whitespace-nowrap"
                                  title={lsvRating ? `LSV Rating: ${lsvRating.score.toFixed(1)} / 5.0 (${lsvRating.grade}) - ${lsvRating.verdict || 'Playable'}` : 'LSV review pending for this card'}
                                >
                                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-300">LSV</span>
                                  <span className="text-[11px] font-black text-amber-200">{lsvRating ? lsvRating.grade : '—'}</span>
                                </div>

                                {/* 3. 17L Badge */}
                                <div
                                  className={`px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 font-mono shrink-0 whitespace-nowrap ${
                                    actualTier
                                      ? 'bg-emerald-950/95 text-white border border-emerald-400'
                                      : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                                  }`}
                                  title={actualTier ? `17Lands: ${actualTier}${typeof landRating?.win_rate === 'number' ? ` (${(landRating.win_rate * 100).toFixed(1)}% GIH WR)` : ''}` : '17Lands data pending for this set'}
                                >
                                  <span className={`text-[8px] uppercase tracking-wider font-extrabold ${actualTier ? 'text-emerald-300' : 'text-slate-500'}`}>17L</span>
                                  <span className={`text-[11px] font-black ${actualTier ? 'text-emerald-200' : 'text-amber-500/80'}`}>
                                    {actualTier || '—'}
                                  </span>
                                </div>
                              </div>

                              {/* Card Image */}
                              <div className="relative aspect-[2.5/3.5] w-full rounded-xl overflow-hidden shadow-md bg-slate-100 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center group-hover:shadow-lg transition-shadow">
                                <CardImage
                                  card={displayCard}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>

                              {/* Card Title & Mana */}
                              <div className="flex items-center justify-between gap-1 pt-0.5">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors" title={ev.cardName}>
                                  {ev.cardName}
                                </h4>
                                {displayCard.mana_cost && (
                                  <div className="shrink-0 scale-90 origin-right">
                                    <ManaCostRenderer manaCost={displayCard.mana_cost} size="xs" />
                                  </div>
                                )}
                              </div>

                              {/* 17Lands Comparison Block */}
                              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 space-y-1 text-xs font-mono">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">17Lands:</span>
                                  <strong className="text-slate-900 dark:text-white font-bold">
                                    {actualTier || '—'} {typeof landRating?.win_rate === 'number' ? `(${(landRating.win_rate * 100).toFixed(1)}%)` : ''}
                                  </strong>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-400">Delta:</span>
                                  {isNA ? (
                                    <span className="font-bold text-slate-500">N/A</span>
                                  ) : status === 'exact' ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Exact Match (0)</span>
                                  ) : status === 'close' ? (
                                    <span className="font-bold text-cyan-600 dark:text-cyan-400">±1 Step ({stepDelta && stepDelta > 0 ? `+${stepDelta}` : stepDelta})</span>
                                  ) : status === 'trap' ? (
                                    <span className="font-bold text-rose-600 dark:text-rose-400">Trap (+{stepDelta})</span>
                                  ) : status === 'sleeper' ? (
                                    <span className="font-bold text-amber-600 dark:text-amber-400">Sleeper ({stepDelta})</span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </div>
                              </div>

                              {/* User Notes Callout */}
                              {hasNotes && (
                                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 text-xs font-sans text-emerald-900 dark:text-emerald-200 space-y-1">
                                  <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                    <MessageSquare className="w-3 h-3" />
                                    <span>User Note</span>
                                  </div>
                                  <p className="leading-snug text-[11px] italic line-clamp-2">"{ev.notes}"</p>
                                </div>
                              )}
                            </div>

                            {/* Card Footer: Timestamp & Action */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                              <span>Graded: {ev.updatedAt ? new Date(ev.updatedAt).toLocaleDateString() : '—'}</span>
                              <span className="text-violet-600 dark:text-cyan-300 font-bold flex items-center gap-1 group-hover:underline">
                                View Card <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ==================== SUBTAB 2: ARCHETYPES & COLORS ==================== */}
              {activeSubTab === 'archetypes' && (
                <div className="space-y-6">
                  {selectedSetCode === 'ALL' ? (
                    <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-3 max-w-lg mx-auto">
                      <Layers className="w-8 h-8 text-violet-500 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                        Select a Specific Set to Inspect Archetypes
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Archetype synthesis evaluates the 10 color pairs and 5 mono colors of an individual limited set. Please choose one of {user.name}'s evaluated sets above (e.g., {userActiveSets[0]?.setCode || 'TLA'}).
                      </p>
                    </div>
                  ) : !setCardsMap[selectedSetCode.toUpperCase()] || setCardsMap[selectedSetCode.toUpperCase()].length === 0 ? (
                    <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-3 max-w-lg mx-auto">
                      <RefreshCw className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
                      <p className="text-xs font-mono text-slate-400">
                        Loading cards catalog and computing archetype synthesis for {selectedSetCode}...
                      </p>
                    </div>
                  ) : (
                    <ArchetypeForecastView
                      cards={setCardsMap[selectedSetCode.toUpperCase()] || []}
                      userEvaluations={evaluations}
                      userArchetypeEvaluations={archetypeEvaluations}
                      onSaveArchetypeEvaluation={(evalData) => {
                        const key = `${evalData.setCode.toLowerCase()}_${evalData.archetypeCode.toUpperCase()}`;
                        setArchetypeEvaluations((prev) => ({ ...prev, [key]: evalData }));
                      }}
                      onDeleteArchetypeEvaluation={(setCode, archCode) => {
                        const key = `${setCode.toLowerCase()}_${archCode.toUpperCase()}`;
                        setArchetypeEvaluations((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }}
                      seventeenLandsData={seventeenLandsDataMap[selectedSetCode.toUpperCase()] || null}
                      isBlindGrading={false}
                      setCode={selectedSetCode.toUpperCase()}
                      setName={allSets.find((s) => s.code.toUpperCase() === selectedSetCode.toUpperCase())?.name || selectedSetCode}
                      onSelectCard={(c) => setSelectedCardForModal(c)}
                      zIndex="z-[130]"
                      userPerspectiveName={user.name}
                      readOnly={true}
                    />
                  )}
                </div>
              )}

              {/* ==================== SUBTAB 3: CALIBRATION & BIAS ==================== */}
              {activeSubTab === 'calibration' && (
                <div className="space-y-6">
                  {/* Top Traps and Sleepers High-Contrast Overview */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Biggest Traps */}
                    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                            Top Traps (Overrated by {user.name})
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Cards graded much higher than actual 17Lands win rates
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {topTraps.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 font-mono">
                            No significant traps identified yet (all within ±1 step tolerance).
                          </div>
                        ) : (
                          topTraps.map(({ eval: ev, actualTier, landRating, stepDelta }) => (
                            <div
                              key={`${ev.setCode}_${ev.cardName}`}
                              className="p-3 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex items-center justify-between text-xs font-mono"
                            >
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{ev.cardName}</div>
                                <div className="text-[10px] text-slate-400">[{ev.setCode}]</div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="font-bold text-violet-700 dark:text-cyan-300">User: {ev.userGrade}</span>
                                  <span className="text-slate-400">&rarr;</span>
                                  <span className="font-bold text-rose-600 dark:text-rose-400">17L: {actualTier}</span>
                                </div>
                                <div className="text-[10px] text-rose-600 font-bold">
                                  +{stepDelta} Steps Overrated
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Biggest Sleepers */}
                    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                            Top Sleepers (Underrated by {user.name})
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Cards graded much lower than actual 17Lands win rates
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {topSleepers.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400 font-mono">
                            No significant sleepers identified yet.
                          </div>
                        ) : (
                          topSleepers.map(({ eval: ev, actualTier, landRating, stepDelta }) => (
                            <div
                              key={`${ev.setCode}_${ev.cardName}`}
                              className="p-3 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between text-xs font-mono"
                            >
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{ev.cardName}</div>
                                <div className="text-[10px] text-slate-400">[{ev.setCode}]</div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="font-bold text-violet-700 dark:text-cyan-300">User: {ev.userGrade}</span>
                                  <span className="text-slate-400">&rarr;</span>
                                  <span className="font-bold text-amber-600 dark:text-amber-400">17L: {actualTier}</span>
                                </div>
                                <div className="text-[10px] text-amber-600 font-bold">
                                  {stepDelta} Steps Underrated
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Calibration Scatter Plot for Active Set */}
                  {selectedSetCode !== 'ALL' && (setCardsMap[selectedSetCode.toUpperCase()]?.length || 0) > 0 && (
                    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-violet-500" />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                            Personal Calibration Scatter Plot ({selectedSetCode})
                          </h4>
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                          Target: {user.name}
                        </span>
                      </div>

                      <CalibrationScatterPlot
                        cards={setCardsMap[selectedSetCode.toUpperCase()] || []}
                        userEvaluations={evaluations}
                        seventeenLandsData={seventeenLandsDataMap[selectedSetCode.toUpperCase()] || undefined}
                        currentSetCode={selectedSetCode.toUpperCase()}
                        currentSetName={allSets.find((s) => s.code.toUpperCase() === selectedSetCode.toUpperCase())?.name || selectedSetCode}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ==================== 3. MODAL FOOTER ==================== */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#050818]/90 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span>Viewing: <strong className="text-slate-900 dark:text-white">{user.name}</strong></span>
            <span>•</span>
            <span>Set: <strong className="text-violet-600 dark:text-cyan-300">{selectedSetCode}</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold font-mono bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>

      {/* Card Detail & Quick Rate Modal */}
      {selectedCardForModal && (
        <QuickRateModal
          isOpen={Boolean(selectedCardForModal)}
          onClose={() => setSelectedCardForModal(null)}
          card={selectedCardForModal}
          cards={modalCardsList}
          onSelectCard={(c) => setSelectedCardForModal(c)}
          userEvaluations={evaluations}
          seventeenLandsData={seventeenLandsDataMap[selectedCardForModal.set?.toUpperCase()] || null}
          isBlindGrading={false}
          showLsv={true}
          show17L={true}
          onSaveEvaluation={(evalData) => {
            const key = `${evalData.setCode.toLowerCase()}_${evalData.cardName.toLowerCase()}`;
            setEvaluations((prev) => ({ ...prev, [key]: evalData }));
          }}
          zIndex="z-[130]"
          readOnly={true}
        />
      )}
    </div>
  );
};
