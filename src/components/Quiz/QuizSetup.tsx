import React, { useState, useEffect, useMemo } from 'react';
import { QuestionCategory, QuizMode, QuizSettings, SetInfo, MTGRarity, SeventeenLandsSetData, Card } from '../../types/mtg';
import { Swords, Zap, Hash, Shield, BookOpen, Sparkles, Trophy, Clock, CheckSquare, Square, Layers, Flame, Wand2, ShieldCheck, Target, AlertTriangle, Scale, GitCompare, ArrowRight, Lock } from 'lucide-react';
import { SetBadge, SetSymbol } from '../UI/SetSymbol';
import { isSetUnderTwoWeeksOld, isAuthentic17LandsDataSet } from '../../services/seventeenLands';

interface QuizSetupProps {
  currentSet: SetInfo;
  onStartQuiz: (settings: QuizSettings) => void;
  onOpenSetSelector: () => void;
  availableCardsCount: number;
  missedCardsCount: number;
  seventeenLandsData?: SeventeenLandsSetData | null;
  cards?: Card[];
}


interface CategoryConfig {
  id: QuestionCategory;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: 'p1p1_pick',
    name: 'Pack 1 Pick 1 (P1P1) Priority',
    description: 'Simulate pack opening decisions and identify highest-equity first picks.',
    icon: <Target className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'trap_or_sleeper',
    name: '17Lands Trap vs. Sleeper Detection',
    description: 'Spot overrated traps (low WR, high pick cost) vs late-pack sleeper gems.',
    icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
  },
  {
    id: 'quadrant_role',
    name: 'Quadrant Theory (Behind & Parity)',
    description: 'Evaluate cards when Behind (stabilization) vs at Parity (stall-breaking).',
    icon: <Scale className="w-4 h-4 text-violet-400" />,
  },
  {
    id: 'combat_tricks',
    name: 'Combat Tricks & Open Mana',
    description: 'Anticipate opponent blowout tricks and pump spells from open mana.',
    icon: <Swords className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'instant_speed',
    name: 'Instant vs. Sorcery Speed & Timing',
    description: 'Identify interaction speed to optimize combat lines and double-spelling.',
    icon: <Zap className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'mana_cost_and_splash',
    name: 'Mana Base Math & Splashability',
    description: 'Apply 3-source heuristics to test splash viability without mana screw.',
    icon: <Hash className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'power_toughness',
    name: 'Base Stats & Combat Sizing',
    description: 'Master creature stat lines for planning multi-blocks and damage thresholds.',
    icon: <Shield className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'archetype_engine',
    name: 'Archetype Synergy Engines & Payoffs',
    description: 'Identify signpost engines and archetype enablers with text masked.',
    icon: <Sparkles className="w-4 h-4 text-yellow-300" />,
  },
  {
    id: 'card_evaluation',
    name: '17Lands Head-to-Head Duel',
    description: 'Direct 1v1 duel: pick which card achieves a higher Game-In-Hand Win Rate.',
    icon: <GitCompare className="w-4 h-4 text-rose-400" />,
  },
];

export const QuizSetup: React.FC<QuizSetupProps> = ({
  currentSet,
  onStartQuiz,
  onOpenSetSelector,
  availableCardsCount,
  missedCardsCount,
  seventeenLandsData,
  cards,
}) => {
  const is17LandsEligible = useMemo(() => {
    return isAuthentic17LandsDataSet(seventeenLandsData, currentSet.code, cards);
  }, [seventeenLandsData, currentSet.code, cards]);

  const isSetUnder2Weeks = useMemo(() => {
    if (is17LandsEligible) return false;
    return isSetUnderTwoWeeksOld(currentSet.released_at);
  }, [is17LandsEligible, currentSet.released_at]);


  const is17LandsCategory = (id: QuestionCategory) => id === 'trap_or_sleeper' || id === 'card_evaluation';

  const eligibleCategoryIds = useMemo(() => {
    return CATEGORY_CONFIGS
      .map((c) => c.id)
      .filter((id) => is17LandsEligible || !is17LandsCategory(id));
  }, [is17LandsEligible]);

  const [selectedCategories, setSelectedCategories] = useState<QuestionCategory[]>(eligibleCategoryIds);
  const [questionCount, setQuestionCount] = useState<number>(15);
  const [selectedRarities, setSelectedRarities] = useState<MTGRarity[]>(['common', 'uncommon', 'rare', 'mythic']);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [mode, setMode] = useState<QuizMode>('quiz');
  const [onlyMissedCards, setOnlyMissedCards] = useState<boolean>(false);

  // Automatically deselect 17Lands categories if current set is unreleased or ineligible
  useEffect(() => {
    if (!is17LandsEligible) {
      setSelectedCategories((prev) => {
        const filtered = prev.filter((cat) => !is17LandsCategory(cat));
        return filtered.length > 0 ? filtered : ['p1p1_pick', 'combat_tricks'];
      });
    }
  }, [is17LandsEligible, currentSet.code]);

  const toggleCategory = (cat: QuestionCategory) => {
    if (!is17LandsEligible && is17LandsCategory(cat)) return;
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) return;
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const selectAllCategories = () => {
    setSelectedCategories(eligibleCategoryIds);
  };

  const deselectAllCategories = () => {
    setSelectedCategories(['p1p1_pick', 'combat_tricks']);
  };

  const toggleRarity = (rarity: MTGRarity) => {
    if (selectedRarities.includes(rarity)) {
      if (selectedRarities.length === 1) return;
      setSelectedRarities(selectedRarities.filter((r) => r !== rarity));
    } else {
      setSelectedRarities([...selectedRarities, rarity]);
    }
  };

  const handleStart = () => {
    const finalCategories = selectedCategories.filter((cat) => is17LandsEligible || !is17LandsCategory(cat));
    onStartQuiz({
      setCode: currentSet.code,
      setName: currentSet.name,
      releasedAt: currentSet.released_at,
      questionCount,
      categories: finalCategories.length > 0 ? finalCategories : ['p1p1_pick', 'combat_tricks'],
      rarities: selectedRarities,
      timerSeconds,
      mode,
      onlyMissedCards,
    });
  };

  return (
    <div className="max-w-[1440px] mx-auto py-4 px-3 sm:px-6 space-y-4 animate-in fade-in duration-200">
      {/* Compact Set Header */}
      <div className="rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 p-3 sm:p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SetBadge setCode={currentSet.code} iconSvgUri={currentSet.icon_svg_uri} />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-heading">
              {currentSet.name} Card Quiz
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {availableCardsCount} cards loaded • Flashcard & Evaluation Drills
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSetSelector}
          className="px-3 py-1.5 bg-slate-100 dark:bg-[#050818] hover:bg-slate-200 dark:hover:bg-[#10163b] border border-slate-300 dark:border-slate-700 hover:border-violet-500 dark:hover:border-cyan-400 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-xs"
        >
          <Layers className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
          <span>Change Set</span>
        </button>
      </div>

      {/* Telemetry Status Notice for Unreleased / Under 2-Week Sets */}
      {isSetUnder2Weeks && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/90 dark:bg-[#0f1430] border border-amber-300/80 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">
              Recent / Upcoming Set Notice: 17Lands data requires ~2 weeks of draft matches post-release.
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Categories dependent on win-rate duels and ALSA trap detection are disabled for this set until match data is available. Pack 1 Pick 1 and mechanic/combat drills remain ready to play.
            </p>
          </div>
        </div>
      )}

      {/* Missed Cards Drill Notice */}
      {missedCardsCount > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 dark:bg-[#0e122b] border border-amber-300 dark:border-amber-500/30 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 flex-wrap">
                <span>{missedCardsCount} cards in your Missed Practice Deck for</span>
                <SetBadge setCode={currentSet.code} iconSvgUri={currentSet.icon_svg_uri} className="px-1.5 py-0.2 text-[10px]" size="xs" />
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Drill weak spots to build format mastery.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOnlyMissedCards(!onlyMissedCards)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              onlyMissedCards
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-xs'
                : 'bg-white dark:bg-[#050818] text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-[#141b40]'
            }`}
          >
            {onlyMissedCards ? '✓ Missed Cards Mode' : 'Practice Missed'}
          </button>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Question Categories */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                Question Categories ({selectedCategories.length}/{eligibleCategoryIds.length})
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllCategories}
                className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <button
                type="button"
                onClick={deselectAllCategories}
                className="text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CATEGORY_CONFIGS.map((cat) => {
              const is17L = is17LandsCategory(cat.id);
              const isDisabled = is17L && !is17LandsEligible;
              const isSelected = !isDisabled && selectedCategories.includes(cat.id);

              return (
                <div
                  key={cat.id}
                  onClick={() => !isDisabled && toggleCategory(cat.id)}
                  className={`p-3.5 rounded-xl border select-none transition-all flex flex-col justify-between gap-2 shadow-xs ${
                    isDisabled
                      ? 'bg-slate-100/60 dark:bg-[#050818]/40 border-slate-200/80 dark:border-slate-800/50 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-violet-50/70 dark:bg-[#090e28] border-violet-500 shadow-xs cursor-pointer'
                      : 'bg-white dark:bg-[#050818]/60 border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-700/60">
                        {cat.icon}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-1.5 flex-wrap">
                          <span>{cat.name}</span>
                          {isDisabled && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 px-1.5 py-0.5 rounded">
                              <Lock className="w-2.5 h-2.5" />
                              {isSetUnder2Weeks ? 'Pending 17Lands (~2 wks post-release)' : 'Data Unavailable'}
                            </span>
                          )}
                        </h3>
                      </div>
                    </div>
                    {isDisabled ? (
                      <Lock className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                    ) : isSelected ? (
                      <CheckSquare className="w-4 h-4 text-violet-600 dark:text-cyan-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isDisabled
                      ? isSetUnder2Weeks
                        ? '17Lands data is not available during preview or initial release (~2 weeks post-release required).'
                        : '17Lands data is not available for this set.'
                      : cat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 4 Cols: Quiz Controls & Filters */}
        <div className="lg:col-span-4 space-y-4">
          {/* Question Count */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2.5 shadow-xs">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>Question Count</span>
              <span className="text-violet-700 dark:text-cyan-300 font-mono font-bold">{questionCount} Questions</span>
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[5, 10, 15, 25].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setQuestionCount(cnt)}
                  className={`py-1.5 rounded-lg text-xs font-bold font-mono transition-all border cursor-pointer ${
                    questionCount === cnt
                      ? 'bg-violet-600 text-white border-violet-400 shadow-xs'
                      : 'bg-slate-100 dark:bg-[#050818] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity Filters */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2.5 shadow-xs">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
              Rarities
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['common', 'uncommon', 'rare', 'mythic'] as MTGRarity[]).map((r) => {
                const isSelected = selectedRarities.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRarity(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-[#050818] text-slate-900 dark:text-white border-violet-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-[#050818]/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-900'
                    }`}
                  >
                    <span>{r}s</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        r === 'mythic'
                          ? 'bg-orange-500'
                          : r === 'rare'
                          ? 'bg-amber-400'
                          : r === 'uncommon'
                          ? 'bg-cyan-400'
                          : 'bg-indigo-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timer Settings */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2.5 shadow-xs">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              <span>Timer</span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { val: 0, label: 'Untimed' },
                { val: 15, label: '15s' },
                { val: 30, label: '30s' },
              ].map((t) => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setTimerSeconds(t.val)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    timerSeconds === t.val
                      ? 'bg-violet-600 text-white border-violet-400 shadow-xs'
                      : 'bg-slate-100 dark:bg-[#050818] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* HERO PRIMARY CALL TO ACTION BUTTON */}
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-3.5 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-black text-sm uppercase tracking-wider font-heading transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-violet-400/50"
          >
            <span>Start Combat Quiz</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizSetup;
