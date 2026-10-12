import React, { useEffect, useState } from 'react';
import { QuizResult, QuizQuestion } from '../../types/mtg';
import confetti from 'canvas-confetti';
import { Trophy, Award, Flame, Clock, CheckCircle2, XCircle, RotateCcw, ArrowRight, Eye, ChevronDown, ChevronUp, Sparkles, BookOpen, Wand2 } from 'lucide-react';
import { CardObfuscator } from '../CardObfuscator';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetBadge, SetSymbol } from '../UI/SetSymbol';

interface QuizSummaryProps {
  result: QuizResult;
  onRetakeQuiz: () => void;
  onPracticeMissed: () => void;
  onGoToEvaluation: () => void;
  onGoToStats: () => void;
}

export const QuizSummary: React.FC<QuizSummaryProps> = ({
  result,
  onRetakeQuiz,
  onPracticeMissed,
  onGoToEvaluation,
  onGoToStats,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const isHighScorer = result.percentage >= 75;
  const incorrectQuestions = result.questions.filter((q) => !result.answers[q.id]?.isCorrect);
  const xpEarned = result.score * 25 + (result.percentage >= 90 ? 100 : result.percentage >= 70 ? 50 : 10);

  useEffect(() => {
    if (isHighScorer) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#8b5cf6', '#06b6d4', '#fbbf24', '#ff4d2e', '#ffffff'],
        });
      } catch (e) {}
    }
  }, [isHighScorer]);

  const getScoreGrade = (percentage: number) => {
    if (percentage >= 95) return { grade: 'A+', text: 'Mythic Draft Archmage!', color: 'text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-400/50 bg-amber-100 dark:bg-amber-500/15 shadow-[0_0_25px_rgba(251,191,36,0.35)]' };
    if (percentage >= 85) return { grade: 'A', text: 'Limited Expert!', color: 'text-cyan-900 dark:text-cyan-300 border-cyan-300 dark:border-cyan-400/50 bg-cyan-100 dark:bg-cyan-500/15 shadow-[0_0_25px_rgba(6,182,212,0.35)]' };
    if (percentage >= 70) return { grade: 'B', text: 'Solid Set Recall!', color: 'text-violet-900 dark:text-violet-300 border-violet-300 dark:border-violet-400/50 bg-violet-100 dark:bg-violet-500/15' };
    if (percentage >= 50) return { grade: 'C', text: 'Good Progress, Keep Drilling!', color: 'text-indigo-900 dark:text-indigo-300 border-indigo-300 dark:border-indigo-400/50 bg-indigo-100 dark:bg-indigo-500/15' };
    return { grade: 'D', text: 'Needs More Practice!', color: 'text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-400/50 bg-rose-100 dark:bg-rose-500/15' };
  };

  const scoreInfo = getScoreGrade(result.percentage);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Scorecard */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#121316] border border-slate-200 dark:border-slate-800/80 p-6 sm:p-10 shadow-lg text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 rounded-3xl bg-violet-100 dark:bg-violet-600/30 border border-violet-300 dark:border-violet-400/40 text-violet-700 dark:text-cyan-300 shadow-xs">
            <Trophy className="w-8 h-8" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <SetBadge setCode={result.setCode} suffix="Card Quiz Complete" size="md" />
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-heading mt-1">
              {scoreInfo.text}
            </h1>
          </div>
        </div>

        {/* Score Radial / Badges */}
        <div className="flex items-center justify-center gap-6 py-4 flex-wrap">
          {/* Accuracy Score */}
          <div className="flex flex-col items-center">
            <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-md ${scoreInfo.color}`}>
              <span className="text-3xl font-black font-heading text-slate-900 dark:text-white">{result.percentage}%</span>
              <span className="text-xs font-mono font-bold text-violet-700 dark:text-cyan-300">{scoreInfo.grade} Tier</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Overall Accuracy</span>
          </div>

          {/* Correct Questions */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-3xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center shadow-xs">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {result.score} / {result.totalQuestions}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-500">Correct</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Score</span>
          </div>

          {/* XP Gained */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-3xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center shadow-xs">
              <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-300">+{xpEarned}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500">Draft XP</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Experience</span>
          </div>

          {/* Time Spent */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-3xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center shadow-xs">
              <span className="text-2xl font-bold font-mono text-violet-700 dark:text-cyan-300">{result.timeSpentSeconds}s</span>
              <span className="text-[10px] uppercase font-bold text-slate-500">Duration</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">Time Taken</span>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
          <button
            onClick={onRetakeQuiz}
            className="px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider font-heading transition-all shadow-md flex items-center gap-2 cursor-pointer border border-violet-400/40"
          >
            <RotateCcw className="w-4 h-4 text-violet-200" />
            <SetSymbol setCode={result.setCode} size="xs" />
            <span>Retake {result.setCode} Quiz</span>
          </button>

          {incorrectQuestions.length > 0 && (
            <button
              onClick={onPracticeMissed}
              className="px-5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-orange-900/50 border border-amber-300 dark:border-orange-500/50 text-amber-900 dark:text-orange-200 font-bold text-xs uppercase tracking-wider font-heading transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Flame className="w-4 h-4 text-amber-500 dark:text-orange-400" />
              <span>Drill Missed Cards ({incorrectQuestions.length})</span>
            </button>
          )}

          <button
            onClick={onGoToEvaluation}
            className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-[#17181c] hover:bg-slate-200 dark:hover:bg-[#101538] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Award className="w-4 h-4 text-amber-500 dark:text-amber-300" />
            <span>Card Grading Hub</span>
          </button>

          <button
            onClick={onGoToStats}
            className="px-5 py-2.5 rounded-2xl bg-slate-100 dark:bg-[#17181c] hover:bg-slate-200 dark:hover:bg-[#101538] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span>Mastery Stats</span>
            <ArrowRight className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Detailed Question Review List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
            <span>Question Review & Tactical Analysis</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Click any card to view detailed breakdown</span>
        </div>

        <div className="space-y-3">
          {result.questions.map((q, idx) => {
            const answer = result.answers[q.id];
            const isCorrect = answer?.isCorrect;
            const isExpanded = expandedIndex === idx;

            return (
              <div
                key={q.id}
                className={`rounded-3xl border transition-all overflow-hidden shadow-xs ${
                  isCorrect
                    ? 'bg-white dark:bg-[#121316]/70 border-slate-200 dark:border-slate-800'
                    : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30'
                }`}
              >
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 select-none"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="shrink-0">
                      {isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300">Q{idx + 1}</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{q.card.name}</span>
                        {q.card.mana_cost && (
                          <ManaCostRenderer manaCost={q.card.mana_cost} size="xs" />
                        )}
                        <span className="text-[10px] font-mono uppercase bg-slate-100 dark:bg-[#17181c] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-violet-700 dark:text-violet-300 font-semibold">
                          {q.category.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{q.prompt}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                      {Math.round((answer?.timeSpentMs || 0) / 1000)}s
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Card Details & Explanation */}
                {isExpanded && (
                  <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#17181c]/90 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-4 flex justify-center">
                      <CardObfuscator
                        card={q.card}
                        obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                        size="sm"
                      />
                    </div>
                    <div className="md:col-span-8 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-violet-700 dark:text-cyan-300 uppercase tracking-wider">
                          Tactical Explanation
                        </h4>
                        <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">{q.explanation}</p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#121316] border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="text-[11px] font-bold text-violet-700 dark:text-violet-300 uppercase">Oracle Rules Text</div>
                        <p className="text-xs text-slate-700 dark:text-slate-200 font-sans leading-relaxed">
                          {q.card.oracle_text || 'No oracle rules text.'}
                        </p>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-4">
                        <span>Type: <strong className="text-slate-800 dark:text-white">{q.card.type_line}</strong></span>
                        {q.card.power && (
                          <span>P/T: <strong className="text-violet-700 dark:text-cyan-300">{q.card.power}/{q.card.toughness}</strong></span>
                        )}
                        <span>Rarity: <strong className="text-amber-600 dark:text-amber-300 capitalize">{q.card.rarity}</strong></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuizSummary;
