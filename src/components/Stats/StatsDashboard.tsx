import React, { useState } from 'react';
import { UserProfileStats, QuestionCategory, SetMasteryStat, MissedCardRecord } from '../../types/mtg';
import { exportUserDataAsJSON, importUserDataFromJSON } from '../../services/storage';
import { BarChart3, Trophy, Flame, Zap, Award, BookOpen, Download, Upload, RotateCcw, CheckCircle2, XCircle, Sparkles, Shield, Swords, Hash, ArrowUpRight, Wand2, Target, AlertTriangle, Scale, GitCompare, ChevronDown, Info } from 'lucide-react';

interface StatsDashboardProps {
  userStats: UserProfileStats;
  onDrillMissedCards: () => void;
  onRefreshStats: () => void;
  onGoToGradingHub?: () => void;
  onTakeQuiz?: () => void;
  onSelectCardName?: (cardName: string) => void;
}

interface CategoryDetails {
  name: string;
  icon: React.ReactNode;
  tag: string;
  description: string;
  whyItMatters: string;
  proTip: string;
}

const CATEGORY_DETAILS: Record<QuestionCategory, CategoryDetails> = {
  p1p1_pick: {
    name: 'Pack 1 Pick 1 (P1P1) Priority',
    icon: <Target className="w-4 h-4 text-amber-400" />,
    tag: 'Draft Navigation',
    description: 'Evaluates pack-opening decisions and choosing the optimal first pick from 4 competitive options.',
    whyItMatters: 'P1P1 anchors your draft equity. Prioritizing flexible bombs and unconditional removal over narrow synergy keeps you open for signals.',
    proTip: 'Avoid committing to a two-color archetype in pick 1 unless the gold signpost is truly bomb tier.',
  },
  trap_or_sleeper: {
    name: '17Lands Trap vs. Sleeper Detection',
    icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    tag: '17Lands Insights',
    description: 'Identifies discrepancies between draft pick popularity (ALSA) and actual Game-In-Hand Win Rates (GIH WR).',
    whyItMatters: 'Draft Traps waste premium early picks on flashy cards that lose games. Sleeper gems reward you with high win rates on late wheels.',
    proTip: 'Look for cards with ALSA > 6.0 and GIH WR > 56.5% to pick up high-value format sleepers.',
  },
  quadrant_role: {
    name: 'Quadrant Theory (Behind & Parity)',
    icon: <Scale className="w-4 h-4 text-violet-400" />,
    tag: 'Card Evaluation',
    description: 'Brian Wong & Marshall Sutcliffe\'s Quadrant Theory: evaluating cards when Behind, at Parity, Developing, or Ahead.',
    whyItMatters: 'Prevents drafting "win-more" cards that only help when already ahead, focusing on stall-breakers and stabilization tools.',
    proTip: 'The most important cards in Limited are those that perform well when Behind (unconditional removal) and at Parity (evasive fliers).',
  },
  combat_tricks: {
    name: 'Combat Tricks & Open Mana',
    icon: <Swords className="w-4 h-4 text-emerald-400" />,
    tag: 'Combat Math',
    description: 'Anticipates opponent instant-speed pump and protection spells given their available open mana.',
    whyItMatters: 'Walking into an opponent\'s combat trick is the #1 tempo blowout in Limited. Hand reading saves creatures and games.',
    proTip: 'Before declaring blocks, check opponent\'s open colors and mana value against the known tricks in the set.',
  },
  instant_speed: {
    name: 'Instant vs. Sorcery Speed',
    icon: <Zap className="w-4 h-4 text-cyan-400" />,
    tag: 'Speed & Timing',
    description: 'Drills whether key removal and interaction spells operate at Instant or Sorcery timing.',
    whyItMatters: 'Instant speed allows holding up mana for double-spell lines, responding to pump spells, or flashing in blockers.',
    proTip: 'Sorcery-speed removal is vulnerable to haste and ETB effects; Instant removal disrupts combat and saves life totals.',
  },
  mana_cost_and_splash: {
    name: 'Mana Base Math & Splashability',
    icon: <Hash className="w-4 h-4 text-sky-400" />,
    tag: 'Deckbuilding Math',
    description: 'Tests whether a card is splashable as a 3rd color using Frank Karsten\'s mana source heuristics.',
    whyItMatters: 'Splashing double-pip cards ({C}{C}) or early 2-drops ruins mana consistency and causes color-screw game losses.',
    proTip: 'Only splash single-pip cards ({2}{C}) when you have at least 3 dedicated mana fixers/dual lands.',
  },
  power_toughness: {
    name: 'Base Stats & Combat Sizing',
    icon: <Shield className="w-4 h-4 text-indigo-400" />,
    tag: 'Combat Sizing',
    description: 'Drills creature base P/T lines for sizing combat trades, multi-blocks, and burn damage thresholds.',
    whyItMatters: 'Knowing if an attacker trades with a 2/3 or survives a 2-damage Shock enables optimal block assignments.',
    proTip: 'Always track the "toughness breakpoint" of the format (e.g. 4 toughness in formats with 3-damage burn spells).',
  },
  archetype_engine: {
    name: 'Archetype Synergy Engines',
    icon: <Sparkles className="w-4 h-4 text-yellow-300" />,
    tag: 'Draft Archetypes',
    description: 'Tests understanding of mechanical archetype engines, key payoffs, and synergy enablers.',
    whyItMatters: 'Modern draft sets are deeply synergy-driven. Identifying archetype engines allows you to assemble high-synergy 3-0 decks.',
    proTip: 'Prioritize the enablers and payoffs that bridge across overlapping color archetypes.',
  },
  card_evaluation: {
    name: '17Lands Head-to-Head Duel',
    icon: <GitCompare className="w-4 h-4 text-rose-400" />,
    tag: '17Lands Data',
    description: 'Direct 1v1 comparison of Games-In-Hand Win Rates between two cards from the set.',
    whyItMatters: 'Calibrates your subjective card evaluation against millions of real Arena draft games.',
    proTip: 'Look closely at common and uncommon win rates; top uncommons often outperform mediocre rares.',
  },
};

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  userStats,
  onDrillMissedCards,
  onRefreshStats,
  onGoToGradingHub,
  onSelectCardName,
}) => {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeTooltipCategory, setActiveTooltipCategory] = useState<QuestionCategory | null>(null);

  const missedCardsList = Object.values(userStats.missedCards || {}).sort(
    (a, b) => b.timesMissed - a.timesMissed
  );

  const setStatsList = Object.values(userStats.sets || {}).sort(
    (a, b) => b.questionsAttempted - a.questionsAttempted
  );

  const handleExport = () => {
    const json = exportUserDataAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtgdraftiq_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importUserDataFromJSON(content);
        if (success) {
          setImportStatus('Data successfully imported!');
          onRefreshStats();
          setTimeout(() => setImportStatus(null), 3000);
        } else {
          setImportStatus('Failed to parse JSON file.');
          setTimeout(() => setImportStatus(null), 3000);
        }
      }
    };
    reader.readAsText(file);
  };

  const getMasteryBadge = (rank: string) => {
    switch (rank) {
      case 'Mythic':
        return 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40 font-bold';
      case 'Gold':
        return 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 font-semibold';
      case 'Silver':
        return 'bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-400/40 font-semibold';
      case 'Bronze':
        return 'bg-violet-100 text-violet-950 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40 font-medium';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 font-normal';
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto py-4 px-3 sm:px-6 space-y-4 animate-in fade-in duration-200">
      {/* Header & KPI Summary */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-0.5 rounded border border-slate-200 dark:border-cyan-500/30">
                Level {userStats.level} Drafter
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{userStats.xp} Total XP</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading mt-0.5">
              Quiz Mastery & Category Analytics
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Track your quiz accuracy, category proficiencies, and missed card drills across draft sets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#050818] hover:bg-slate-200 dark:hover:bg-[#10163b] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              <span>Export</span>
            </button>

            <label className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#050818] hover:bg-slate-200 dark:hover:bg-[#10163b] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Import</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
        </div>

        {importStatus && (
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold text-center">
            {importStatus}
          </div>
        )}

        {/* 4 Core Stat Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className="p-4 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-center space-y-0.5"
            title={`Overall Accuracy: (${userStats.totalCorrect} correct ÷ ${userStats.totalQuestions || (userStats.totalQuizzes * 10)} attempted questions) × 100%`}
          >
            <span className="text-2xl sm:text-3xl font-black font-heading text-violet-700 dark:text-cyan-300">{userStats.overallAccuracy}%</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Overall Accuracy
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-center space-y-0.5">
            <span className="text-2xl sm:text-3xl font-black font-heading text-slate-900 dark:text-white">{userStats.totalQuizzes}</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">Quizzes Finished</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-center space-y-0.5">
            <span className="text-2xl sm:text-3xl font-black font-heading text-emerald-600 dark:text-emerald-400">{userStats.totalCorrect}</span>
            <p className="text-xs text-slate-500 dark:text-slate-400">Questions Mastered</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-center space-y-0.5">
            <div className="flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-2xl sm:text-3xl font-black font-heading text-amber-600 dark:text-amber-300">{userStats.bestStreak}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Best Quiz Streak</p>
          </div>
        </div>
      </div>

      {/* Grid: Category Breakdown with Rich Tooltips + Set Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Category Breakdown with Tooltips */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                Accuracy by Draft Skill Category
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              Click any skill for pro tips
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-xs">
            {(Object.keys(CATEGORY_DETAILS) as QuestionCategory[]).map((cat) => {
              const details = CATEGORY_DETAILS[cat];
              const stat = userStats.categories[cat] || { attempted: 0, correct: 0 };
              const acc = stat.attempted > 0 ? Math.round((stat.correct / stat.attempted) * 100) : 0;
              const isTooltipOpen = activeTooltipCategory === cat;

              return (
                <div key={cat} className="space-y-1.5">
                  <div
                    onClick={() => setActiveTooltipCategory(isTooltipOpen ? null : cat)}
                    className="flex items-center justify-between text-xs cursor-pointer group select-none hover:bg-slate-100 dark:hover:bg-slate-800/40 p-1.5 rounded-lg transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {details.icon}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors">
                        {details.name}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isTooltipOpen ? 'rotate-180 text-violet-600 dark:text-cyan-400' : 'text-slate-400 group-hover:text-violet-600 dark:group-hover:text-cyan-400'}`} />
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500 dark:text-slate-400">{stat.correct}/{stat.attempted}</span>
                      <span className="font-bold text-violet-700 dark:text-cyan-300">{acc}%</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-[#050818] rounded-full h-1.5 overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        acc >= 80 ? 'bg-emerald-500' : acc >= 60 ? 'bg-violet-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${acc}%` }}
                    />
                  </div>

                  {/* Interactive Category Tooltip / Strategy Card */}
                  {isTooltipOpen && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-700 space-y-2 text-xs text-slate-700 dark:text-slate-300 animate-in fade-in duration-200 shadow-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#090e24] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                          {details.tag}
                        </span>
                        <span className="text-slate-400">Limited Heuristic</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-sans">{details.description}</p>
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-[#090e24] border border-amber-200 dark:border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">💡 Why It Wins Drafts:</div>
                        <p className="text-[11px] text-amber-900 dark:text-slate-300 leading-relaxed">{details.whyItMatters}</p>
                      </div>
                      <div className="text-[11px] text-violet-700 dark:text-cyan-200 font-mono">
                        🔥 <strong>Pro Tip:</strong> {details.proTip}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Set Mastery Ranks */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Set Mastery Ranks
            </h2>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2.5 shadow-xs">
            {setStatsList.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Take quizzes on different sets to earn Mastery badges!
              </div>
            ) : (
              setStatsList.map((set) => (
                <div
                  key={set.setCode}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#090e24] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                        {set.setCode}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{set.setName}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {set.questionsAttempted} cards drilled • {set.accuracy}% accuracy
                    </p>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-mono border shrink-0 ${getMasteryBadge(
                      set.masteryRank
                    )}`}
                  >
                    {set.masteryRank}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Missed Cards Practice Deck */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <div>
              <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                Missed Cards Practice Deck ({missedCardsList.length} Cards)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cards you answered incorrectly are tracked here until you score 90%+ mastery on them.
              </p>
            </div>
          </div>

          {missedCardsList.length > 0 && (
            <button
              onClick={onDrillMissedCards}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-bold text-xs uppercase tracking-wider font-heading transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-violet-400/50"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Drill Missed Cards</span>
            </button>
          )}
        </div>

        {missedCardsList.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 text-center text-slate-500 dark:text-slate-400 text-xs shadow-xs">
            🎉 Your Missed Practice Deck is empty! You have zero unmastered cards.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {missedCardsList.slice(0, 12).map((item) => (
              <div
                key={`${item.setCode}_${item.cardId}`}
                onClick={() => onSelectCardName?.(item.cardName)}
                className="p-3.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-[#090e24] dark:hover:bg-[#0d1538] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/50 flex items-center justify-between gap-3 shadow-xs cursor-pointer transition-colors group"
                title="Click to view & grade card in Evaluation Hub"
              >
                <div className="overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                      {item.setCode}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors truncate">{item.cardName}</h4>
                  </div>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    Missed {item.timesMissed}x on {item.lastQuestionCategory.replace('_', ' ')}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-violet-700 dark:text-cyan-300">{item.masteryScore}%</span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Mastery</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsDashboard;
