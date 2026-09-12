import React, { useState, useMemo, useEffect } from 'react';
import { Card, GradeTier, MTGColor, MTGRarity, SeventeenLandsSetData, UserCardEvaluation } from '../../types/mtg';
import { CardObfuscator } from '../CardObfuscator';
import { Search, Filter, Sparkles, ExternalLink, Zap, Swords, Shield, X, ShieldCheck, ChevronLeft, ChevronRight, CheckCircle2, FileText, Star, BarChart2, Trash2, Eye, EyeOff, BookOpen, Layers, Check, PlayingCardsFan, Share2 } from 'lucide-react';
import { ClearSetRatingsModal } from '../UI/ClearSetRatingsModal';
import { SimilarCardsModal } from '../Evaluation/SimilarCardsModal';
import { ExportGradesModal } from '../Evaluation/ExportGradesModal';
import { ManaCostRenderer, ManaSymbol } from '../UI/ManaSymbol';
import { parseAppUrlParams, updateAppUrlParams, findCardByUrlIdentifier } from '../../services/urlParams';
import { GRADE_TIERS, GRADE_SCORES, get17LandsSetUrl, get17LandsCardUrl, get17LandsArchetypeUrl, winRateToGradeTier, gradeTierToIndex, get17LandsCardRating } from '../../services/seventeenLands';
import { getLsvRatingForCard } from '../../services/lsvRatings';
import { GradeComparisonCard } from '../UI/GradeComparisonCard';
import { PlaneswalkerSymbol } from '../UI/PlaneswalkerSymbol';
import { SetBadge, SetSymbol } from '../UI/SetSymbol';
import { ManaColorFilterBar, cardMatchesColorFilter, cardMatchesRoleFilter } from '../UI/ManaColorFilterBar';
import { CardSearchBar } from '../Search/CardSearchBar';
import { cardMatchesQuery } from '../../services/cardSearchParser';
import { getWOTCArchetypesForSet, getSignpostsForArchetype, WOTCArchetype } from '../../services/wotcArchetypes';
import { getBlindGradingForSet, setBlindGradingForSet } from '../../services/storage';
import { SetInfo, UserAccount } from '../../types/mtg';

interface SetExplorerProps {
  cards: Card[];
  currentSetCode: string;
  currentSetName: string;
  currentSet?: SetInfo | null;
  currentUser?: UserAccount | null;
  userEvaluations?: Record<string, UserCardEvaluation>;
  seventeenLandsData: SeventeenLandsSetData | null;
  isBlindGrading?: boolean;
  onToggleBlindGrading?: () => void;
  onSaveEvaluation?: (evaluation: UserCardEvaluation) => void;
  onClearEvaluationsForSet?: (setCode: string) => void;
  onGradeCard?: (card: Card) => void;
  onPracticeCard?: (card: Card) => void;
  // Shared filter state (synced with Grading tab)
  searchQuery?: string;
  selectedColors?: string[];
  selectedRarities?: string[];
  selectedRoles?: string[];
  onSearchQueryChange?: (q: string) => void;
  onSelectedColorsChange?: (c: string[]) => void;
  onSelectedRaritiesChange?: (r: string[]) => void;
  onSelectedRolesChange?: (r: string[]) => void;
}

export const SetExplorer: React.FC<SetExplorerProps> = ({
  cards,
  currentSetCode,
  currentSetName,
  currentSet,
  currentUser,
  userEvaluations = {},
  seventeenLandsData,
  isBlindGrading: propIsBlindGrading,
  onToggleBlindGrading: propOnToggleBlindGrading,
  onSaveEvaluation,
  onClearEvaluationsForSet,
  onGradeCard,
  onPracticeCard,
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
  const [activeExplorerTab, setActiveExplorerTab] = useState<'cards' | 'archetypes'>('cards');
  const [searchQuery, setSearchQuery] = useState<string>(propSearchQuery ?? '');
  const [selectedColors, setSelectedColors] = useState<string[]>(propSelectedColors ?? ['ALL']);
  const [selectedRarities, setSelectedRarities] = useState<string[]>(propSelectedRarities ?? ['ALL']);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(propSelectedRoles ?? ['ALL']);

  useEffect(() => { if (propSearchQuery !== undefined) setSearchQuery(propSearchQuery); }, [propSearchQuery]);
  useEffect(() => { if (propSelectedColors !== undefined) setSelectedColors(propSelectedColors); }, [propSelectedColors]);
  useEffect(() => { if (propSelectedRarities !== undefined) setSelectedRarities(propSelectedRarities); }, [propSelectedRarities]);
  useEffect(() => { if (propSelectedRoles !== undefined) setSelectedRoles(propSelectedRoles); }, [propSelectedRoles]);

  const handleSearchQuery = (q: string) => { setSearchQuery(q); onSearchQueryChange?.(q); };
  const handleSelectedColors = (c: string[]) => { setSelectedColors(c); onSelectedColorsChange?.(c); };
  const handleSelectedRarities = (r: string[]) => { setSelectedRarities(r); onSelectedRaritiesChange?.(r); };
  const handleSelectedRoles = (r: string[]) => { setSelectedRoles(r); onSelectedRolesChange?.(r); };

  const [filterRatedStatus, setFilterRatedStatus] = useState<'ALL' | 'RATED' | 'UNRATED'>('ALL');
  const [sortBy, setSortBy] = useState<'number' | 'name' | 'cmc' | 'winrate'>('number');
  const [selectedCardForModal, setSelectedCardForModal] = useState<Card | null>(null);
  const [similarCardsModalCard, setSimilarCardsModalCard] = useState<Card | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);

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

  const effective17LandsData = useMemo(() => {
    if (
      seventeenLandsData &&
      seventeenLandsData.setCode?.toUpperCase() === currentSetCode.toUpperCase() &&
      (seventeenLandsData.sampleSize || 0) > 500 &&
      Object.keys(seventeenLandsData.cards || {}).length >= 5
    ) {
      const hasMatchingCards = cards.some((c) => {
        const rating = get17LandsCardRating(c, seventeenLandsData);
        return (rating?.game_count || 0) > 0;
      });
      if (hasMatchingCards) {
        return seventeenLandsData;
      }
    }
    return null;
  }, [seventeenLandsData, currentSetCode, cards]);

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

  // Blind grading state persisted per set in local storage (or controlled by parent)
  const [internalBlindGrading, setInternalBlindGrading] = useState<boolean>(() => {
    return getBlindGradingForSet(currentSetCode, undefined, cards.length);
  });

  useEffect(() => {
    setInternalBlindGrading(getBlindGradingForSet(currentSetCode, undefined, cards.length));
  }, [currentSetCode, cards.length]);

  const effectiveIsBlind = propIsBlindGrading !== undefined ? propIsBlindGrading : internalBlindGrading;

  const handleToggleBlindGrading = () => {
    if (propOnToggleBlindGrading) {
      propOnToggleBlindGrading();
    } else {
      const next = !internalBlindGrading;
      setInternalBlindGrading(next);
      setBlindGradingForSet(currentSetCode, next);
    }
  };

  // Curated WOTC Supported Archetypes for this set
  const wotcArchetypes = useMemo(() => {
    return getWOTCArchetypesForSet(currentSetCode, cards);
  }, [currentSetCode, cards]);

  const ratedCountInSet = useMemo(() => {
    return cards.filter((c) => {
      const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      return Boolean(userEvaluations[key]);
    }).length;
  }, [cards, userEvaluations]);

  // Auto-open card from URL parameter for troubleshooting / deep linking
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

  const handleSelectModalCard = (card: Card | null) => {
    setSelectedCardForModal(card);
    updateAppUrlParams({
      card: card ? card.collector_number || card.name : undefined,
    });
  };

  const handleQuickGradeInModal = (card: Card, grade: GradeTier) => {
    if (!onSaveEvaluation) return;
    const score = GRADE_SCORES[grade];
    const key = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
    const existing = userEvaluations[key];

    const updated: UserCardEvaluation = {
      cardId: card.id,
      cardName: card.name,
      setCode: card.set.toUpperCase(),
      userGrade: grade,
      userScore: score,
      pickPriority: existing?.pickPriority || 'Solid Playable',
      notes: existing?.notes || '',
      updatedAt: new Date().toISOString(),
    };

    onSaveEvaluation(updated);
  };

  const filteredAndSortedCards = useMemo(() => {
    let result = cards.filter((c) => {
      const evalKey = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      const hasEval = Boolean(userEvaluations[evalKey]);

      if (filterRatedStatus === 'RATED' && !hasEval) return false;
      if (filterRatedStatus === 'UNRATED' && hasEval) return false;

      if (searchQuery) {
        if (!cardMatchesQuery(c, searchQuery, currentSetCode)) return false;
      }

      if (!cardMatchesColorFilter(c, selectedColors)) {
        return false;
      }

      if (!selectedRarities.includes('ALL') && selectedRarities.length > 0) {
        const cardRarity = (c.rarity || '').toLowerCase();
        if (!selectedRarities.map((r) => r.toLowerCase()).includes(cardRarity)) {
          return false;
        }
      }

      if (!cardMatchesRoleFilter(c, selectedRoles)) {
        return false;
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'cmc') return a.cmc - b.cmc;
      if (sortBy === 'winrate') {
        const wrA = get17LandsCardRating(a, seventeenLandsData)?.win_rate || 0.5;
        const wrB = get17LandsCardRating(b, seventeenLandsData)?.win_rate || 0.5;
        return wrB - wrA;
      }
      return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
    });

    return result;
  }, [cards, searchQuery, selectedColors, selectedRarities, selectedRoles, filterRatedStatus, sortBy, seventeenLandsData, userEvaluations]);

  const currentModalIndex = useMemo(() => {
    if (!selectedCardForModal) return -1;
    return filteredAndSortedCards.findIndex((c) => c.id === selectedCardForModal.id);
  }, [selectedCardForModal, filteredAndSortedCards]);

  const handlePrevCard = () => {
    if (currentModalIndex > 0) {
      handleSelectModalCard(filteredAndSortedCards[currentModalIndex - 1]);
    }
  };

  const handleNextCard = () => {
    if (currentModalIndex < filteredAndSortedCards.length - 1) {
      handleSelectModalCard(filteredAndSortedCards[currentModalIndex + 1]);
    }
  };

  useEffect(() => {
    if (!selectedCardForModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevCard();
      } else if (e.key === 'ArrowRight') {
        handleNextCard();
      } else if (e.key === 'Escape') {
        handleSelectModalCard(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardForModal, currentModalIndex, filteredAndSortedCards]);

  const activeCardEval = selectedCardForModal
    ? userEvaluations[`${selectedCardForModal.set.toLowerCase()}_${selectedCardForModal.name.toLowerCase()}`]
    : undefined;

  const activeCard17LandsData = selectedCardForModal
    ? (get17LandsCardRating(selectedCardForModal, seventeenLandsData) || undefined)
    : undefined;

  const getTierBadgeStyle = (tier: GradeTier) => {
    if (tier.startsWith('A')) return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 hover:bg-amber-200 dark:hover:bg-amber-500/30 font-bold';
    if (tier.startsWith('B')) return 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 hover:bg-cyan-200 dark:hover:bg-cyan-500/30 font-bold';
    if (tier.startsWith('C')) return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold';
    if (tier === 'D') return 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40 hover:bg-orange-200 dark:hover:bg-orange-500/30 font-bold';
    return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 hover:bg-rose-200 dark:hover:bg-rose-500/30 font-bold';
  };

  return (
    <div className="max-w-[1440px] mx-auto py-4 px-3 sm:px-6 space-y-6 animate-in fade-in duration-200">
      {/* Header Banner with Sub-Tabs & Set Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SetBadge setCode={currentSetCode} />
            <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-violet-950/60 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-violet-500/30 font-mono font-semibold">
              {cards.length} Total Cards
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
              {ratedCountInSet} Graded
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
              {wotcArchetypes.length} Supported Archetypes
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-heading truncate">
            {currentSetName} ({currentSetCode.toUpperCase()})
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
            Browse the card pool, explore WOTC supported draft archetypes, and assign your personal card grades.
          </p>
        </div>

        {/* Sub-Tabs: Cards vs Supported Archetypes */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          <nav className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
            <button
              onClick={() => setActiveExplorerTab('cards')}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeExplorerTab === 'cards'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setActiveExplorerTab('archetypes')}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeExplorerTab === 'archetypes'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Supported Archetypes
            </button>
          </nav>
        </div>
      </div>

      {activeExplorerTab === 'cards' ? (
        <>
          {/* Filter & Search Bar */}
      <div className="p-3 sm:p-3.5 bg-white dark:bg-[#090e24] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          {/* Card Search Bar (Scryfall & Arena-style) */}
          <div className="flex-1">
            <CardSearchBar
              query={searchQuery}
              onChangeQuery={handleSearchQuery}
              currentSetCode={currentSetCode}
              currentSetName={currentSetName}
              matchCount={filteredAndSortedCards.length}
              totalCount={cards.length}
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-mono cursor-pointer"
            >
              <option value="number">Collector # (001 → 300)</option>
              <option value="name">Card Name (A → Z)</option>
              <option value="cmc">Mana Value (0 → 10+)</option>
              {seventeenLandsData && <option value="winrate">17Lands Win Rate (High → Low)</option>}
            </select>
          </div>
        </div>

        {/* Filters: Colors, Rarities, Status & Roles */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Mana Color Filter Bar with Official Arena Glow */}
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

          {/* Rarity Pills (Multi-Select) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            {['ALL', 'common', 'uncommon', 'rare', 'mythic'].map((rarity) => {
              const isSelected = (rarity === 'ALL' && (selectedRarities.includes('ALL') || selectedRarities.length === 0)) ||
                (rarity !== 'ALL' && selectedRarities.includes(rarity));
              return (
                <button
                  key={rarity}
                  onClick={() => {
                    if (rarity === 'ALL') {
                      handleSelectedRarities(['ALL']);
                      return;
                    }
                    const current = selectedRarities.filter((r) => r !== 'ALL');
                    if (current.includes(rarity)) {
                      const next = current.filter((r) => r !== rarity);
                      handleSelectedRarities(next.length === 0 ? ['ALL'] : next);
                    } else {
                      handleSelectedRarities([...current, rarity]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {rarity === 'ALL' ? 'All' : rarity}
                </button>
              );
            })}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'UNRATED', label: 'Ungraded' },
              { id: 'RATED', label: 'Graded' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilterRatedStatus(st.id as any)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filterRatedStatus === st.id
                    ? 'bg-violet-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
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

          {/* Grading Mode / Compare Mode Toggle (mimics state of Grade tab) */}
          {seventeenLandsData ? (
            <button
              type="button"
              onClick={handleToggleBlindGrading}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer min-w-[112px] shrink-0 whitespace-nowrap ${
                effectiveIsBlind
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
              }`}
              title={
                effectiveIsBlind
                  ? 'Grading Mode: Benchmarks hidden. Click to switch to Compare Mode'
                  : 'Compare Mode: 17Lands data visible. Click to switch to Grading Mode'
              }
            >
              {effectiveIsBlind ? (
                <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span>{effectiveIsBlind ? 'Grading Mode' : 'Compare Mode'}</span>
            </button>
          ) : (
            <div
              className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 shrink-0 flex items-center gap-1"
              title="17Lands benchmarks are available ~2 weeks after release"
            >
              <EyeOff className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Grading Mode</span>
            </div>
          )}

          {/* Export & Share Grades Button */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-violet-700 dark:text-cyan-300 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800/60 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            title="Export full comparison spreadsheet or send grades to 17Lands"
          >
            <Share2 className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
            <span>Export & Share</span>
          </button>

          {/* Clear Grades Button (if rated cards exist in this set) */}
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

          {/* Tactical Role Filters */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-2xl border border-slate-200 dark:border-slate-800 flex-wrap">
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
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
              Displaying <strong className="text-violet-700 dark:text-cyan-300 font-black">{filteredAndSortedCards.length}</strong> of <strong>{cards.length}</strong> cards
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

      {/* Cards Visual Grid */}
      {filteredAndSortedCards.length === 0 ? (
        <div className="py-16 text-center text-slate-500 bg-slate-50 dark:bg-[#090e28]/50 rounded-3xl border border-slate-200 dark:border-violet-900/30">
          <p className="text-sm">No cards match the active filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedCards.map((card) => {
            const evalKey = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
            const userEval = userEvaluations[evalKey];
            const landData = get17LandsCardRating(card, effective17LandsData) || undefined;

            return (
              <div
                key={card.id}
                onClick={() => handleSelectModalCard(card)}
                className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/60 dark:hover:border-violet-500/60 transition-all flex flex-col justify-between gap-3.5 shadow-xs hover:shadow-md cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 flex flex-col items-start w-[185px]">
                    {/* Top Bar above card: Grade badge(s) in a single horizontal non-wrapping row */}
                    <div className="w-full flex items-center justify-between mb-1.5 min-h-[22px] overflow-hidden">
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
                                  title={!hasUserGrade ? 'Rate the card to see how you compare' : (effectiveIsBlind ? 'LSV Rating (hidden in grading mode)' : lsvRating ? `LSV Rating: ${lsvRating.score.toFixed(1)} / 5.0 (${lsvRating.grade}) - ${lsvRating.verdict || 'Playable'}` : 'LSV Review pending (set not yet rated)')}
                                >
                                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-300">LSV</span>
                                  <span className="text-[11px] font-black text-amber-200">{!hasUserGrade || effectiveIsBlind ? '—' : (lsvRating ? lsvRating.grade : '—')}</span>
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
                                  title={!hasUserGrade ? 'Rate the card to see how you compare' : (actualTier ? (effectiveIsBlind ? '17Lands grade (hidden in grading mode)' : `17Lands: ${actualTier}`) : '17Lands data is available approximately 2 weeks after release')}
                                >
                                  <span className={`text-[8px] uppercase tracking-wider font-extrabold ${actualTier ? 'text-emerald-300' : 'text-slate-500'}`}>17L</span>
                                  <span className={`text-[11px] font-black ${actualTier ? 'text-emerald-200' : 'text-amber-500/80'}`}>
                                    {!hasUserGrade || effectiveIsBlind ? '—' : (actualTier || 'TBD')}
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
                    ) : effectiveIsBlind ? (
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
                              {/* 17Lands empirical metrics */}
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

                        {/* LSV Reference: Score & Verdict */}
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

                {/* Find Similar Cards Icon Button */}
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
                            handleQuickGradeInModal(card, tier);
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
      )}
        </>
      ) : (
        <div className="space-y-6">
          {/* Archetypes Subheader / Quick Metagame Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-violet-600 dark:text-cyan-400 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  WOTC Supported Archetypes • {currentSetName} ({currentSetCode.toUpperCase()})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Official design themes, mechanics, and anchor signposts designed by Wizards of the Coast. Click any card to inspect.
                </p>
              </div>
            </div>
            <a
              href={get17LandsArchetypeUrl(currentSetCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#050818] text-slate-700 dark:text-slate-200 hover:text-violet-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-center transition-colors"
              title="Open 17Lands Deck Color Data & Win Rates in new tab"
            >
              <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>17Lands Metagame</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>

          {/* Archetypes Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {wotcArchetypes.map((archetype) => {
              const signposts = getSignpostsForArchetype(archetype.code, cards);
              const [c1, c2] = archetype.colors;

              return (
                <div
                  key={archetype.code}
                  className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="space-y-4">
                    {/* Archetype Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shrink-0">
                          <ManaSymbol symbol={c1} size="md" />
                          <ManaSymbol symbol={c2} size="md" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading">
                              {archetype.name}
                            </h3>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                              {archetype.code}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-violet-600 dark:text-cyan-400 mt-0.5">
                            {archetype.headline}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Official WOTC Description */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#060a1d] border border-slate-200/70 dark:border-slate-800/70 space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <BookOpen className="w-3.5 h-3.5 text-violet-500" />
                        <span>WOTC Design Strategy</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {archetype.description}
                      </p>
                      {archetype.mechanics && archetype.mechanics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {archetype.mechanics.map((mech) => (
                            <span
                              key={mech}
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs"
                            >
                              #{mech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Signposts Uncommons / Key Cards */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Signpost Uncommons & Key Cards ({signposts.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Click card to inspect</span>
                      </div>

                      {signposts.length === 0 ? (
                        <p className="text-xs text-slate-400 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800">
                          No dedicated two-color signpost cards found in the loaded set pool.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {signposts.map((signpostCard) => {
                            const evalKey = `${signpostCard.set?.toLowerCase() || ''}_${signpostCard.name?.toLowerCase() || ''}`;
                            const signpostEval = userEvaluations[evalKey];
                            const signpostLand = get17LandsCardRating(signpostCard, seventeenLandsData);
                            const signpostActualTier: GradeTier | null =
                              signpostLand && typeof signpostLand.win_rate === 'number' && signpostLand.win_rate > 0
                                ? ((signpostLand.tier_grade as GradeTier) || winRateToGradeTier(signpostLand.win_rate))
                                : null;
                            const hasSignpostGrade = Boolean(signpostEval?.userGrade);

                            return (
                              <div
                                key={signpostCard.id}
                                onClick={() => handleSelectModalCard(signpostCard)}
                                className="group relative flex flex-col items-center p-2 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-[#060a1d] dark:hover:bg-[#0a0f2c] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/60 shadow-xs transition-all cursor-pointer text-center"
                                title={`Inspect & Grade ${signpostCard.name}`}
                              >
                                {/* Mini Top Bar: YOU & 17L Badges */}
                                <div className="w-full flex items-center justify-between gap-1 mb-1">
                                  <div className="flex items-center gap-1">
                                    <div
                                      className="px-1 py-0.2 rounded bg-violet-950/95 text-white border border-violet-400 text-[9px] font-mono font-black"
                                      title={hasSignpostGrade ? `Your Grade: ${signpostEval!.userGrade}` : 'Not graded'}
                                    >
                                      {hasSignpostGrade ? signpostEval!.userGrade : '—'}
                                    </div>
                                    <div
                                      className={`px-1 py-0.2 rounded text-[9px] font-mono font-black border ${
                                        effectiveIsBlind || !hasSignpostGrade
                                          ? 'bg-slate-900/90 text-slate-400 border-slate-700/80'
                                          : signpostActualTier
                                          ? 'bg-emerald-950/95 text-emerald-200 border-emerald-400'
                                          : 'bg-slate-900/90 text-slate-400 border-slate-700/80'
                                      }`}
                                      title={
                                        effectiveIsBlind
                                          ? '17Lands hidden in Grading Mode'
                                          : !hasSignpostGrade
                                          ? 'Rate to see how you compare'
                                          : signpostActualTier
                                          ? `17L Grade: ${signpostActualTier}`
                                          : 'TBD'
                                      }
                                    >
                                      {effectiveIsBlind || !hasSignpostGrade ? '—' : signpostActualTier || 'TBD'}
                                    </div>
                                  </div>
                                  {signpostCard.mana_cost && (
                                    <ManaCostRenderer manaCost={signpostCard.mana_cost} size="sm" />
                                  )}
                                </div>

                                {/* Thumbnail Artwork */}
                                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 relative mb-1.5">
                                  <img
                                    src={
                                      signpostCard.image_uris?.art_crop ||
                                      signpostCard.image_uris?.normal ||
                                      'https://cards.scryfall.io/back.jpg'
                                    }
                                    alt={signpostCard.name}
                                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                </div>

                                <div className="w-full text-left">
                                  <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors">
                                    {signpostCard.name}
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-0.5">
                                    <span className="capitalize">{signpostCard.rarity}</span>
                                    {!effectiveIsBlind && hasSignpostGrade && signpostLand && (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        {(signpostLand.win_rate * 100).toFixed(1)}% WR
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Archetype Card Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveExplorerTab('cards');
                        handleSelectedColors(archetype.code.toUpperCase().split(""));
                        handleSelectedRarities(["ALL"]);
                        handleSelectedRoles(["ALL"]);
                        setFilterRatedStatus('ALL');
                        handleSearchQuery('');
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-violet-800/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Explore {archetype.code} Cards</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveExplorerTab('cards');
                        handleSelectedColors(["GOLD_" + archetype.code.toUpperCase()]);
                        handleSelectedRarities(["ALL"]);
                        handleSelectedRoles(["ALL"]);
                        setFilterRatedStatus('ALL');
                        handleSearchQuery('');
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                      title={`Filter to multi-color gold ${archetype.code} cards`}
                    >
                      Gold Only
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Card Detail Modal (Large, Immersive Card Inspection with Direct Top Grade Action & 17Lands Comparison) */}
      {selectedCardForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 dark:bg-[#040711]/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-[96vw] max-w-5xl h-[88vh] min-h-[580px] max-h-[860px] bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header (With Option to Grade Card Up Top) */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060a1d] shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
                  #{selectedCardForModal.collector_number} {selectedCardForModal.set}
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading truncate">
                  {selectedCardForModal.name}
                </h2>
                <a
                  href={get17LandsCardUrl(selectedCardForModal.set, selectedCardForModal, activeCard17LandsData)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                  title="Open on 17Lands.com"
                  aria-label="Open on 17Lands.com"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {currentModalIndex !== -1 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden md:inline shrink-0">
                    ({currentModalIndex + 1} of {filteredAndSortedCards.length})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handlePrevCard}
                  disabled={currentModalIndex <= 0}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-all"
                  title="Previous Card (← Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <button
                  onClick={handleNextCard}
                  disabled={currentModalIndex >= filteredAndSortedCards.length - 1}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-all"
                  title="Next Card (→ Arrow)"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                <button
                  onClick={() => handleSelectModalCard(null)}
                  className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filtered Subset Notice Banner */}
            {filteredAndSortedCards.length < cards.length && (
              <div className="px-5 sm:px-6 py-2 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shrink-0 flex-wrap">
                <div className="flex items-center gap-2 font-medium">
                  <Filter className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    Browsing filtered subset: <strong>Card {currentModalIndex + 1} of {filteredAndSortedCards.length}</strong>{' '}
                    <span className="text-amber-700/80 dark:text-amber-300/80">
                      ({searchQuery ? `Search: "${searchQuery}"` : 'Filters active'} • {cards.length} total in set)
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSearchQuery('');
                    handleSelectedColors(["ALL"]);
                    handleSelectedRarities(["ALL"]);
                    handleSelectedRoles(["ALL"]);
                    setFilterRatedStatus('ALL');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 font-bold text-[11px] transition-colors cursor-pointer border border-amber-500/30 shrink-0"
                >
                  Clear Filter to Browse Entire Set
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: Large Visual Card Artwork */}
              <div className="md:col-span-5 flex flex-col items-center justify-center shrink-0">
                <CardObfuscator
                  card={selectedCardForModal}
                  obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                  size="lg"
                />

                {/* Under Card Pic: Set abbr / rarity / cost & Tactical Tags */}
                <div className="w-[305px] max-w-full mt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      #{selectedCardForModal.collector_number} {selectedCardForModal.set.toUpperCase()} • <span className="capitalize font-normal text-slate-500 dark:text-slate-400">{selectedCardForModal.rarity}</span>
                    </span>
                    <span>CMC {selectedCardForModal.cmc}</span>
                  </div>

                  {/* Tactical Tags: Removal Spell, Combat Trick, Instant Speed */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedCardForModal.is_combat_trick && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 font-bold flex items-center gap-1">
                        <Swords className="w-3 h-3" />
                        Combat Trick
                      </span>
                    )}
                    {selectedCardForModal.is_removal && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Removal Spell
                      </span>
                    )}
                    {selectedCardForModal.is_instant_speed && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-500/40 font-bold">
                        ⚡ Instant Speed
                      </span>
                    )}
                    {selectedCardForModal.archetype_tag && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-950/60 border border-violet-300 dark:border-violet-500/40 font-bold">
                        🛡️ {selectedCardForModal.archetype_tag}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Full Details, Interactive Grading, 17Lands Comparison & Rules */}
              <div className="md:col-span-7 flex flex-col justify-between h-full space-y-3.5 overflow-y-auto pr-1">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-heading">
                        {selectedCardForModal.name}
                      </h3>
                      {selectedCardForModal.mana_cost && (
                        <ManaCostRenderer manaCost={selectedCardForModal.mana_cost} size="md" />
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-violet-700 dark:text-cyan-300 font-mono mt-0.5">
                      {selectedCardForModal.type_line} {selectedCardForModal.power && `• ${selectedCardForModal.power}/${selectedCardForModal.toughness}`}
                    </p>
                  </div>

                  {/* 🌟 DIRECT INLINE GRADING BAR (Click to rate immediately!) */}
                  {onSaveEvaluation && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300" title="Assign draft evaluation tier: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5">
                          Grade Card:
                        </span>
                        {activeCardEval ? (
                          <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300">
                            Current Rating: <strong className="text-white px-1.5 py-0.5 bg-violet-600 rounded border border-violet-400">{activeCardEval.userGrade}</strong>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Not graded yet</span>
                        )}
                      </div>

                      <div
                        className="grid grid-cols-11 gap-1"
                        title="Assign draft evaluation tier: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5"
                      >
                        {GRADE_TIERS.map((tier) => {
                          const isSelected = activeCardEval?.userGrade === tier;
                          const color = getTierBadgeStyle(tier);
                          return (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => handleQuickGradeInModal(selectedCardForModal, tier)}
                              className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                                isSelected
                                  ? 'bg-violet-600 text-white border-violet-300 font-black shadow-md ring-2 ring-violet-400/60'
                                  : color
                              }`}
                            >
                              {tier}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 🌟 DEDICATED GRADE VS 17LANDS COMPARISON & DELTA CARD */}
                  <GradeComparisonCard
                    card={selectedCardForModal}
                    userEval={activeCardEval}
                    landData={activeCard17LandsData}
                    isBlindGrading={effectiveIsBlind}
                  />

                  {/* Oracle Rules Text Box */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Oracle Rules Text
                      </span>
                      {selectedCardForModal.scryfall_uri && (
                        <a
                          href={selectedCardForModal.scryfall_uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-cyan-400 hover:underline"
                          title="View official Scryfall & Gatherer rulings"
                        >
                          <span>Rulings</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-sans leading-relaxed whitespace-pre-line">
                      {selectedCardForModal.oracle_text || 'No oracle rules text.'}
                    </p>
                  </div>
                </div>

                {/* Bottom Bar: Scryfall, 17Lands & Practice Action */}
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <a
                      href={selectedCardForModal.scryfall_uri || `https://scryfall.com/search?q=!%22${encodeURIComponent(selectedCardForModal.name)}%22`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-600 dark:text-cyan-400 hover:text-violet-800 dark:hover:text-cyan-300 flex items-center gap-1 underline transition-colors"
                    >
                      <span>View on Scryfall</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <span className="text-slate-400 dark:text-slate-600">•</span>

                    <a
                      href={get17LandsCardUrl(selectedCardForModal.set, selectedCardForModal, activeCard17LandsData)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-600 dark:text-cyan-400 hover:text-violet-800 dark:hover:text-cyan-300 flex items-center gap-1 underline transition-colors"
                    >
                      <span>View on 17lands.com</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {onPracticeCard && (
                    <button
                      onClick={() => {
                        onPracticeCard(selectedCardForModal);
                        handleSelectModalCard(null);
                      }}
                      className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                      <span>Practice Card</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
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
            handleQuickGradeInModal(targetCard, grade);
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

export default SetExplorer;
