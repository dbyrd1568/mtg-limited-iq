import React, { useState, useEffect, useMemo } from 'react';
import { Card, GradeTier, SeventeenLandsSetData, UserCardEvaluation } from '../../types/mtg';
import { GRADE_TIERS, GRADE_SCORES, getColorSortIndex, getRaritySortIndex, winRateToGradeTier, get17LandsCardRating, getOrEstimate17LandsCardRating } from '../../services/seventeenLands';
import { getLsvRatingForCard } from '../../services/lsvRatings';
import { CardObfuscator } from '../CardObfuscator';
import { X, ChevronLeft, ChevronRight, Zap, FileText, Check, Eye, EyeOff, Scale, ArrowUpDown, PlayingCardsFan, ArrowRight, CheckCircle2, ExternalLink, BarChart2, Filter } from 'lucide-react';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { GradeComparisonCard } from '../UI/GradeComparisonCard';
import { SimilarCardsModal } from './SimilarCardsModal';
import confetti from 'canvas-confetti';

export type GradingSortOrder = 'number' | 'color' | 'rarity_asc' | 'rarity_desc' | 'unrated_first' | 'alpha';
export type GraderNavMode = 'all' | 'ungraded';

interface QuickRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  card: Card | null;
  onSelectCard: (card: Card) => void;
  userEvaluations: Record<string, UserCardEvaluation>;
  seventeenLandsData?: SeventeenLandsSetData | null;
  isBlindGrading?: boolean;
  onToggleBlindGrading?: () => void;
  showLsv?: boolean;
  show17L?: boolean;
  onToggleLsv?: () => void;
  onToggle17L?: () => void;
  gradeDisplayMode?: 'my_grade' | '17lands' | 'side_by_side';
  onChangeGradeDisplayMode?: (mode: 'my_grade' | '17lands' | 'side_by_side') => void;
  onSaveEvaluation: (evalData: UserCardEvaluation) => void;
  isFiltered?: boolean;
  filterDescription?: string;
  totalSetCardsCount?: number;
  onClearFilter?: () => void;
}

export const QuickRateModal: React.FC<QuickRateModalProps> = ({
  isOpen,
  onClose,
  cards,
  card,
  onSelectCard,
  userEvaluations,
  seventeenLandsData,
  isBlindGrading = false,
  onToggleBlindGrading,
  showLsv = true,
  show17L = true,
  onToggleLsv,
  onToggle17L,
  gradeDisplayMode = 'side_by_side',
  onChangeGradeDisplayMode,
  onSaveEvaluation,
  isFiltered = false,
  filterDescription,
  totalSetCardsCount,
  onClearFilter,
}) => {
  const [sortOrder, setSortOrder] = useState<GradingSortOrder>('number');
  const [navMode, setNavMode] = useState<GraderNavMode>(() => {
    try {
      const saved = localStorage.getItem('mtg_grader_nav_mode');
      if (saved === 'all' || saved === 'ungraded') return saved;
    } catch (e) {}
    return 'all';
  });

  const handleToggleNavMode = (mode: GraderNavMode) => {
    setNavMode(mode);
    try {
      localStorage.setItem('mtg_grader_nav_mode', mode);
    } catch (e) {}
  };

  const [noteText, setNoteText] = useState<string>('');
  const [isSimilarModalOpen, setIsSimilarModalOpen] = useState<boolean>(false);

  // Sorted cards list according to chosen grading sequence
  const orderedCards = useMemo(() => {
    const list = [...cards];

    switch (sortOrder) {
      case 'number':
        list.sort((a, b) => parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0'));
        break;
      case 'color':
        list.sort((a, b) => {
          const cDiff = getColorSortIndex(a) - getColorSortIndex(b);
          if (cDiff !== 0) return cDiff;
          return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
        });
        break;
      case 'rarity_asc': // Commons first -> Uncommons -> Rares -> Mythics
        list.sort((a, b) => {
          const rDiff = getRaritySortIndex(b.rarity) - getRaritySortIndex(a.rarity);
          if (rDiff !== 0) return rDiff;
          return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
        });
        break;
      case 'rarity_desc': // Mythics first
        list.sort((a, b) => {
          const rDiff = getRaritySortIndex(a.rarity) - getRaritySortIndex(b.rarity);
          if (rDiff !== 0) return rDiff;
          return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
        });
        break;
      case 'unrated_first':
        list.sort((a, b) => {
          const aKey = `${a.set?.toLowerCase() || ''}_${a.name?.toLowerCase() || ''}`;
          const bKey = `${b.set?.toLowerCase() || ''}_${b.name?.toLowerCase() || ''}`;
          const aRated = Boolean(userEvaluations[aKey]);
          const bRated = Boolean(userEvaluations[bKey]);
          if (!aRated && bRated) return -1;
          if (aRated && !bRated) return 1;
          return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
        });
        break;
      case 'alpha':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return list;
  }, [cards, sortOrder]);

  // Ungraded count across the current set
  const ungradedCount = useMemo(() => {
    return cards.filter((c) => {
      const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      return !userEvaluations[key];
    }).length;
  }, [cards, userEvaluations]);

  // Find index of current card in the sorted sequence
  const currentIndex = useMemo(() => {
    if (!card || orderedCards.length === 0) return 0;
    const idx = orderedCards.findIndex((c) => c.id === card.id);
    return idx !== -1 ? idx : 0;
  }, [card, orderedCards]);

  const currentCard = orderedCards[currentIndex] || card;
  const evalKey = currentCard ? `${currentCard.set?.toLowerCase() || ''}_${currentCard.name?.toLowerCase() || ''}` : '';
  const currentEval = userEvaluations[evalKey];
  const landData = get17LandsCardRating(currentCard, seventeenLandsData) || getOrEstimate17LandsCardRating(currentCard, seventeenLandsData);

  // Rated count strictly across the current set
  const ratedCountInSet = useMemo(() => {
    if (!currentCard?.set) return 0;
    const targetSet = currentCard.set.toLowerCase();
    return cards.filter((c) => {
      const key = `${(c.set || targetSet).toLowerCase()}_${c.name.toLowerCase()}`;
      return Boolean(userEvaluations[key]);
    }).length;
  }, [cards, userEvaluations, currentCard?.set]);

  // Sync note text when active card changes or modal opens
  useEffect(() => {
    if (isOpen && currentCard) {
      const key = `${currentCard.set?.toLowerCase() || ''}_${currentCard.name?.toLowerCase() || ''}`;
      setNoteText(userEvaluations[key]?.notes || '');
    }
  }, [isOpen, currentCard?.id]);

  // Rate active card and strictly advance to next unrated card
  const handleRate = (tier: GradeTier) => {
    if (!currentCard) return;

    const priority = tier.startsWith('A')
      ? '1st Pick Bomb'
      : tier.startsWith('B')
      ? 'Early Pick'
      : tier.startsWith('C')
      ? 'Mid Pick'
      : tier === 'D'
      ? 'Late Filler'
      : 'Sideboard / Unplayable';

    const evaluation: UserCardEvaluation = {
      cardId: currentCard.id,
      cardName: currentCard.name,
      setCode: currentCard.set,
      userGrade: tier,
      userScore: GRADE_SCORES[tier] || 2.5,
      pickPriority: priority,
      notes: noteText.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSaveEvaluation(evaluation);

    if (navMode === 'ungraded') {
      // Find the NEXT UNGRADED card strictly forward first
      let nextUnrated: Card | null = null;
      for (let i = currentIndex + 1; i < orderedCards.length; i++) {
        const c = orderedCards[i];
        const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
        if (c.id !== currentCard.id && !userEvaluations[key]) {
          nextUnrated = c;
          break;
        }
      }

      // Wrap around from beginning if not found forward
      if (!nextUnrated) {
        for (let i = 0; i < currentIndex; i++) {
          const c = orderedCards[i];
          const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
          if (c.id !== currentCard.id && !userEvaluations[key]) {
            nextUnrated = c;
            break;
          }
        }
      }

      if (nextUnrated) {
        onSelectCard(nextUnrated);
      } else {
        // 100% Set Evaluation Complete! 🎉
        try {
          confetti({
            particleCount: 160,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#8b5cf6', '#06b6d4', '#fbbf24', '#ff4d2e', '#10b981'],
          });
        } catch (e) {}
      }
    } else {
      // 'all' mode: advance to next card in sequence if available
      if (currentIndex < orderedCards.length - 1) {
        onSelectCard(orderedCards[currentIndex + 1]);
      }

      // Check if all cards in set are now graded
      const remainingUngraded = cards.filter((c) => {
        if (c.id === currentCard.id) return false;
        const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
        return !userEvaluations[key];
      }).length;
      if (remainingUngraded === 0) {
        try {
          confetti({
            particleCount: 160,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#8b5cf6', '#06b6d4', '#fbbf24', '#ff4d2e', '#10b981'],
          });
        } catch (e) {}
      }
    }
  };

  // Next card based on current navMode (all vs ungraded)
  const nextCard = useMemo(() => {
    if (!currentCard || orderedCards.length === 0) return null;

    if (navMode === 'all') {
      if (currentIndex < orderedCards.length - 1) {
        return orderedCards[currentIndex + 1];
      }
      return null;
    }

    // Ungraded mode: find next ungraded card forward first
    for (let i = currentIndex + 1; i < orderedCards.length; i++) {
      const c = orderedCards[i];
      const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      if (c.id !== currentCard.id && !userEvaluations[key]) {
        return c;
      }
    }
    // Wrap around to start if not found forward
    for (let i = 0; i < currentIndex; i++) {
      const c = orderedCards[i];
      const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      if (c.id !== currentCard.id && !userEvaluations[key]) {
        return c;
      }
    }
    return null;
  }, [currentCard, currentIndex, orderedCards, navMode, userEvaluations]);

  // Previous card based on current navMode (all vs ungraded)
  const prevCard = useMemo(() => {
    if (!currentCard || orderedCards.length === 0) return null;

    if (navMode === 'all') {
      if (currentIndex > 0) {
        return orderedCards[currentIndex - 1];
      }
      return null;
    }

    // Ungraded mode: find prev ungraded card backward first
    for (let i = currentIndex - 1; i >= 0; i--) {
      const c = orderedCards[i];
      const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      if (c.id !== currentCard.id && !userEvaluations[key]) {
        return c;
      }
    }
    // Wrap around to end if not found backward
    for (let i = orderedCards.length - 1; i > currentIndex; i--) {
      const c = orderedCards[i];
      const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      if (c.id !== currentCard.id && !userEvaluations[key]) {
        return c;
      }
    }
    return null;
  }, [currentCard, currentIndex, orderedCards, navMode, userEvaluations]);

  const isNextDisabled = !nextCard;
  const isPrevDisabled = !prevCard;

  const handleNext = () => {
    if (nextCard) {
      onSelectCard(nextCard);
    }
  };

  const handlePrev = () => {
    if (prevCard) {
      onSelectCard(prevCard);
    }
  };

  // Keyboard navigation for Next (→), Prev (←), Close (Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger arrows if user is typing notes in textarea
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        if (nextCard) onSelectCard(nextCard);
      } else if (e.key === 'ArrowLeft') {
        if (prevCard) onSelectCard(prevCard);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextCard, prevCard, onClose, onSelectCard]);

  const handleNoteChange = (newText: string) => {
    if (!currentCard) return;
    setNoteText(newText);
    const evaluation: UserCardEvaluation = {
      cardId: currentCard.id,
      cardName: currentCard.name,
      setCode: currentCard.set,
      userGrade: currentEval?.userGrade || 'C',
      userScore: currentEval?.userScore || 2.5,
      pickPriority: currentEval?.pickPriority || 'Mid Pick',
      notes: newText,
      updatedAt: new Date().toISOString(),
    };
    onSaveEvaluation(evaluation);
  };

  const handleBlur = () => {
    if (!currentCard) return;
    const trimmed = noteText.trim();
    if (trimmed !== noteText) {
      setNoteText(trimmed);
      const evaluation: UserCardEvaluation = {
        cardId: currentCard.id,
        cardName: currentCard.name,
        setCode: currentCard.set,
        userGrade: currentEval?.userGrade || 'C',
        userScore: currentEval?.userScore || 2.5,
        pickPriority: currentEval?.pickPriority || 'Mid Pick',
        notes: trimmed || undefined,
        updatedAt: new Date().toISOString(),
      };
      onSaveEvaluation(evaluation);
    }
  };

  if (!isOpen || !currentCard) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 dark:bg-[#040711]/90 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      {/* Fixed Dimension Modal Container (Constant size across all cards) */}
      <div className="relative w-[96vw] max-w-5xl h-[88vh] max-h-[840px] my-auto bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Fixed Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#060a1d]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-600/20 border border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-cyan-300 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-heading truncate">Card Evaluation</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Card {currentIndex + 1} of {orderedCards.length} {orderedCards.length < 100 ? '(Preview / Spoiled Cards)' : 'in set'} • {ratedCountInSet} of {orderedCards.length} rated in {currentCard.set?.toUpperCase()} • {navMode === 'ungraded' ? 'Ungraded Only' : 'All Cards'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Sequence Order Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-xl text-xs shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as GradingSortOrder)}
                className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="number">🔢 Card Number (#001 → #300)</option>
                <option value="color">🎨 By Color (WUBRG Order)</option>
                <option value="rarity_asc">💎 Commons First → Mythics</option>
                <option value="rarity_desc">👑 Mythics First → Commons</option>
                <option value="unrated_first">⏳ Ungraded Cards First</option>
                <option value="alpha">🔤 Alphabetical (A → Z)</option>
              </select>
            </div>

            {/* Ratings Source Toggles: [✓ Me (locked)] [✓ LSV] [✓ 17L] */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#050818] p-0.5 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 hidden md:inline">Ratings:</span>
              <span className="px-2 py-0.5 rounded-lg bg-violet-600 text-white font-bold flex items-center gap-1 shadow-xs cursor-default text-[11px]" title="Your personal grade (always shown)">
                <Check className="w-3 h-3" />
                <span>Me</span>
              </span>

              {onToggleLsv && (
                <button
                  type="button"
                  onClick={onToggleLsv}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer text-[11px] ${
                    showLsv
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Toggle LSV Pre-Release Expert Ratings"
                >
                  {showLsv && <Check className="w-3 h-3" />}
                  <span>LSV</span>
                </button>
              )}

              {onToggle17L && (
                <button
                  type="button"
                  onClick={onToggle17L}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer text-[11px] ${
                    show17L
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Toggle 17Lands Match Win Rate Ratings"
                >
                  {show17L && <Check className="w-3 h-3" />}
                  <span>17L</span>
                </button>
              )}
            </div>

            {/* Blind Grading Toggle */}
            {onToggleBlindGrading && (
              <button
                type="button"
                onClick={onToggleBlindGrading}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isBlindGrading
                    ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                }`}
                title={isBlindGrading ? 'Grading Mode: Benchmarks hidden. Click to switch to Compare Mode' : 'Compare Mode: 17Lands data visible. Click to switch to Grading Mode'}
              >
                {isBlindGrading ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                <span>{isBlindGrading ? 'Grading Mode' : 'Compare Mode'}</span>
              </button>
            )}



            {/* Pinned Close Button: Never wraps, always floated right */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shrink-0"
              title="Close card evaluator"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filtered Subset Alert Banner */}
        {isFiltered && (
          <div className="shrink-0 px-6 py-2 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-violet-500/10 border-b border-violet-200 dark:border-violet-500/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-violet-900 dark:text-cyan-300">
              <Filter className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
              <span>
                Grading Active Filter: <strong>{filterDescription || 'Filtered Subset'}</strong> ({orderedCards.length} of {totalSetCardsCount || cards.length} total set cards)
              </span>
            </div>
            {onClearFilter && (
              <button
                type="button"
                onClick={onClearFilter}
                className="text-violet-700 dark:text-cyan-400 hover:underline font-bold text-[11px] cursor-pointer"
              >
                Clear Filter (Show All Cards)
              </button>
            )}
          </div>
        )}

        {/* Fixed Content Layout (Grid split: Left Card Art, Right Grading Controls) */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 lg:gap-5 p-4 sm:p-5 overflow-hidden">
          {/* Left: Card Visual (Fixed width column) */}
          <div className="w-full md:w-[280px] lg:w-[305px] shrink-0 flex flex-col items-center justify-between min-h-0">
            <div className="w-full flex items-center justify-between gap-2 px-1 text-xs font-mono text-slate-500 dark:text-slate-400 mb-1 shrink-0">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                #{currentCard.collector_number} • <span className="capitalize font-normal text-slate-500 dark:text-slate-400">{currentCard.rarity}</span>
              </span>
              <span>CMC {currentCard.cmc}</span>
            </div>

            <div className="flex-1 min-h-0 w-full flex items-center justify-center [container-type:size]">
              <CardObfuscator
                card={currentCard}
                obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                size="md"
                showSublabel={false}
              />
            </div>

            {/* Find Similar Cards Button below visual */}
            <button
              type="button"
              onClick={() => setIsSimilarModalOpen(true)}
              className="w-full mt-2 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer group shrink-0"
              title="Find functionally similar cards in past sets to project a historical rating"
            >
              <PlayingCardsFan className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors shrink-0" />
              <span>Find Similar Cards</span>
            </button>
          </div>

          {/* Right: Full Rules Text, 17Lands Comparison & Notes Field (Constant layout) */}
          <div className="space-y-2.5 flex-1 min-w-0 w-full flex flex-col justify-between min-h-0 overflow-y-auto pr-1">
            {/* Title & Mana */}
            <div className="space-y-0.5 shrink-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading">{currentCard.name}</h3>
                {currentCard.mana_cost && (
                  <ManaCostRenderer manaCost={currentCard.mana_cost} size="md" />
                )}
              </div>
              <p className="text-xs text-violet-700 dark:text-cyan-300 font-mono">
                {currentCard.type_line} {currentCard.power && `• ${currentCard.power}/${currentCard.toughness}`}
              </p>
            </div>

            {/* Grade & 17Lands Live Comparison Panel */}
            <GradeComparisonCard
              card={currentCard}
              userEval={currentEval}
              landData={landData}
              isBlindGrading={isBlindGrading}
              showLsv={showLsv}
              show17L={show17L}
            />

            {/* Complete Oracle Rules Text (Internal scroll for long cards, keeps modal static) */}
            <div className="flex-1 min-h-[75px] max-h-[150px] overflow-y-auto p-3 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line">
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1 sticky top-0 bg-slate-50 dark:bg-[#050818] z-10">
                Oracle Rules Text
              </div>
              {currentCard.oracle_text || 'No oracle rules text.'}
            </div>

            {/* Strategy Notes Field */}
            <div className="shrink-0 space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
                  Notes & Strategic Thoughts
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 lowercase font-normal">Auto-saved</span>
              </label>
              <textarea
                rows={2}
                value={noteText}
                onChange={(e) => handleNoteChange(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Write thoughts on this card (e.g., 'Bomb P1P1', 'Key payoff for spells', 'Too slow vs aggro')..."
                className="w-full p-2 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 resize-none transition-all leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Grade Tier Buttons & Navigation (Pinned at constant position at bottom) */}
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#060a1d] space-y-2">
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center flex items-center justify-center gap-1" title="Grade Tier Score Mapping: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5">
            <span>Assign Limited Grade</span>
          </div>
          <div
            className="grid grid-cols-11 gap-1 max-w-4xl mx-auto"
            title="Grade Tier Score Mapping: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5"
          >
            {GRADE_TIERS.map((tier) => {
              const isSelected = currentEval?.userGrade === tier;
              let color = 'bg-white text-slate-800 border-slate-300 dark:bg-[#050818] dark:text-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600';
              if (tier.startsWith('A')) color = 'bg-amber-100 text-amber-950 border-amber-300 font-bold dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 hover:bg-amber-500 hover:text-white';
              if (tier.startsWith('B')) color = 'bg-cyan-100 text-cyan-950 border-cyan-300 font-bold dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/40 hover:bg-cyan-500 hover:text-white';
              if (tier.startsWith('C')) color = 'bg-slate-100 text-slate-900 border-slate-300 font-bold dark:bg-slate-800/50 dark:text-slate-200 dark:border-slate-700/60 hover:bg-slate-600 hover:text-white';
              if (tier === 'D') color = 'bg-orange-100 text-orange-950 border-orange-300 font-bold dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40 hover:bg-orange-500 hover:text-white';
              if (tier === 'F') color = 'bg-rose-100 text-rose-950 border-rose-300 font-bold dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/40 hover:bg-rose-500 hover:text-white';

              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => handleRate(tier)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                    isSelected ? 'ring-2 ring-violet-400 bg-violet-600 text-white font-black shadow-xs' : color
                  }`}
                >
                  {tier}
                </button>
              );
            })}
          </div>

          {/* Prev / Next Navigation & Ungraded / All Filter Toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
            <button
              type="button"
              onClick={handlePrev}
              disabled={isPrevDisabled}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isPrevDisabled
                  ? 'opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-600'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
              title={
                navMode === 'ungraded'
                  ? isPrevDisabled
                    ? 'No previous ungraded cards'
                    : 'Previous Ungraded Card (←)'
                  : isPrevDisabled
                  ? 'First card in sequence'
                  : 'Previous Card (←)'
              }
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {/* Segmented Toggle: All Cards vs Ungraded Only */}
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/80 dark:bg-[#050818] border border-slate-300/80 dark:border-slate-800 text-xs font-semibold shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleToggleNavMode('all')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                    navMode === 'all'
                      ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title="Navigate through all cards sequentially"
                >
                  All Cards
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleNavMode('ungraded')}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                    navMode === 'ungraded'
                      ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title="Navigate only through cards you haven't graded yet"
                >
                  <span>Ungraded Only</span>
                  {ungradedCount > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-tight ${
                        navMode === 'ungraded'
                          ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-cyan-300 font-bold'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {ungradedCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-400 hidden md:inline">
                  Card {currentIndex + 1} of {orderedCards.length}
                </span>
                {ungradedCount === 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    100% Graded
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isNextDisabled
                  ? 'opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-600'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
              title={
                navMode === 'ungraded'
                  ? isNextDisabled
                    ? 'No more ungraded cards'
                    : 'Next Ungraded Card (→)'
                  : isNextDisabled
                  ? 'Last card in sequence'
                  : 'Next Card (→)'
              }
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Similar Cards & Historical Comps Modal */}
      {isSimilarModalOpen && currentCard && (
        <SimilarCardsModal
          isOpen={isSimilarModalOpen}
          onClose={() => setIsSimilarModalOpen(false)}
          targetCard={currentCard}
          allCards={orderedCards}
          onSelectTargetCard={onSelectCard}
          onNavigatePrev={handlePrev}
          onNavigateNext={handleNext}
          hasPrev={!isPrevDisabled}
          hasNext={!isNextDisabled}
          currentGrade={currentEval?.userGrade}
          target17LandsData={
            landData
              ? {
                  winRate: landData.win_rate,
                  alsa: landData.avg_seen,
                  tierGrade: landData.tier_grade as GradeTier,
                }
              : undefined
          }
          onAdoptGrade={(target, grade) => {
            const priority = grade.startsWith('A')
              ? '1st Pick Bomb'
              : grade.startsWith('B')
              ? 'Early Pick'
              : grade.startsWith('C')
              ? 'Mid Pick'
              : grade === 'D'
              ? 'Late Filler'
              : 'Sideboard / Unplayable';

            const evaluation: UserCardEvaluation = {
              cardId: target.id,
              cardName: target.name,
              setCode: target.set,
              userGrade: grade,
              userScore: GRADE_SCORES[grade] || 2.5,
              pickPriority: priority,
              notes: noteText.trim() || undefined,
              updatedAt: new Date().toISOString(),
            };

            onSaveEvaluation(evaluation);
          }}
        />
      )}
    </div>
  );
};

export default QuickRateModal;
