import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { QuizQuestion, AnswerSubmission, QuizResult, Card } from '../../types/mtg';
import { CardObfuscator } from '../CardObfuscator';
import { CheckCircle2, XCircle, Clock, Flame, ArrowRight, Lightbulb, Volume2, VolumeX, Sparkles, Wand2, Shield, Swords, ZoomIn, X } from 'lucide-react';
import { ManaCostRenderer } from '../UI/ManaSymbol';

interface QuizActiveProps {
  questions: QuizQuestion[];
  cards?: Card[];
  setCode: string;
  setName: string;
  timerSeconds: number;
  onFinishQuiz: (result: QuizResult) => void;
  onExitQuiz: () => void;
}

export const QuizActive: React.FC<QuizActiveProps> = ({
  questions,
  cards,
  setCode,
  setName,
  timerSeconds,
  onFinishQuiz,
  onExitQuiz,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<string, AnswerSubmission>>({});
  const [timeLeft, setTimeLeft] = useState<number>(timerSeconds);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [quizStartTime] = useState<number>(Date.now());
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [zoomedCard, setZoomedCard] = useState<{ card: Card; label?: string; optionId?: string } | null>(null);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const isHeadToHead = currentQuestion.type === 'head_to_head' && Boolean(currentQuestion.comparisonCard);

  const cardMap = useMemo(() => {
    const map: Record<string, Card> = {};
    if (cards) {
      cards.forEach((c) => {
        map[c.id] = c;
      });
    }
    return map;
  }, [cards]);

  // Handle escape key to close zoom modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomedCard) {
        setZoomedCard(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedCard]);

  // Reset timer and zoom on question change
  useEffect(() => {
    setTimeLeft(timerSeconds);
    setStartTime(Date.now());
    setSelectedOptionId(null);
    setIsAnswerSubmitted(false);
    setZoomedCard(null);
  }, [currentIndex, timerSeconds]);

  // Audio cues
  const playSound = useCallback((isCorrect: boolean) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isCorrect) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(739.99, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(174.61, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {}
  }, [soundEnabled]);

  const handleSelectOption = useCallback((optionId: string) => {
    if (isAnswerSubmitted) return;

    const timeSpentMs = Date.now() - startTime;
    const isCorrect = optionId === currentQuestion.correctAnswer;

    setSelectedOptionId(optionId);
    setIsAnswerSubmitted(true);

    if (isCorrect) {
      setCurrentStreak(prev => prev + 1);
    } else {
      setCurrentStreak(0);
    }

    playSound(isCorrect);

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        selectedAnswer: optionId,
        isCorrect,
        timeSpentMs,
      },
    }));
  }, [isAnswerSubmitted, startTime, currentQuestion, playSound]);

  // Timer countdown
  useEffect(() => {
    if (timerSeconds <= 0 || isAnswerSubmitted) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!isAnswerSubmitted) {
            handleSelectOption('TIMEOUT');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerSeconds, isAnswerSubmitted, handleSelectOption]);

  const handleNext = () => {
    if (isLastQuestion) {
      const totalScore = Object.values(answers).filter(a => a.isCorrect).length;
      const percentage = Math.round((totalScore / totalQuestions) * 100);
      const totalTimeSpent = Math.round((Date.now() - quizStartTime) / 1000);

      const result: QuizResult = {
        id: `quiz_${Date.now()}`,
        setCode,
        setName,
        date: new Date().toISOString(),
        score: totalScore,
        totalQuestions,
        percentage,
        timeSpentSeconds: totalTimeSpent,
        questions,
        answers,
      };

      onFinishQuiz(result);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswerSubmitted) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      } else {
        if (['1', '2', '3', '4'].includes(e.key)) {
          const index = parseInt(e.key, 10) - 1;
          if (currentQuestion.options && currentQuestion.options[index]) {
            handleSelectOption(currentQuestion.options[index].id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswerSubmitted, currentQuestion, handleSelectOption, isLastQuestion]);

  const currentAnswer = answers[currentQuestion.id];
  const isCorrect = currentAnswer?.isCorrect;

  return (
    <div className="max-w-[1440px] mx-auto py-4 px-3 sm:px-6 space-y-4 animate-in fade-in duration-200">
      {/* Top Header Bar: Progress, Timer, Audio & Exit */}
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onExitQuiz}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            ← Exit Quiz
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-violet-700 dark:text-cyan-300">
              Q{currentIndex + 1}/{totalQuestions}
            </span>
            <div className="w-24 sm:w-32 h-2 rounded-full bg-slate-100 dark:bg-[#050818] overflow-hidden border border-slate-200 dark:border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Timer */}
          {timerSeconds > 0 && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                timeLeft <= 5
                  ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/50'
                  : 'bg-slate-100 dark:bg-[#050818] text-violet-700 dark:text-cyan-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{timeLeft}s</span>
            </div>
          )}

          {/* Streak */}
          {currentStreak > 1 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 dark:text-amber-300 text-xs font-bold">
              <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{currentStreak} Streak</span>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute Audio Cues' : 'Unmute Audio Cues'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-violet-600 dark:text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Main Split Grid: Card Arena (Left) vs Question & Options (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Card Visual Arena */}
        <div className={`${isHeadToHead ? 'lg:col-span-6' : 'lg:col-span-5'} flex flex-col items-center justify-center space-y-3 min-w-0`}>
          {isHeadToHead && currentQuestion.comparisonCard ? (
            /* 17Lands Duel Arena (2 Cards Side-by-Side without overlap) */
            <div className="w-full bg-white dark:bg-[#080d24] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-mono font-bold text-violet-700 dark:text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-amber-500" />
                  17Lands Head-to-Head Duel
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Click card to pick • Click Zoom to inspect</span>
              </div>

              <div className="flex flex-row items-center justify-center gap-2 sm:gap-4 overflow-hidden">
                {/* Option A Card */}
                <div
                  onClick={() => !isAnswerSubmitted && handleSelectOption(currentQuestion.card.id)}
                  className={`flex flex-col items-center cursor-pointer transition-all p-2 rounded-2xl relative group select-none ${
                    selectedOptionId === currentQuestion.card.id
                      ? 'bg-violet-100 dark:bg-violet-950/60 ring-2 ring-violet-500 dark:ring-cyan-400'
                      : 'hover:bg-slate-100 dark:hover:bg-[#0c1236]'
                  }`}
                  title="Click card to choose Option A"
                >
                  <div className="flex items-center justify-between w-full mb-1.5 px-0.5">
                    <span className="text-xs font-mono font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                      Option A (1)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedCard({ card: currentQuestion.card, label: 'Option A', optionId: currentQuestion.card.id });
                      }}
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-[#050818] hover:bg-violet-100 dark:hover:bg-violet-900/60 text-slate-600 dark:text-cyan-300 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1 transition-all cursor-pointer hover:scale-105 shadow-xs"
                      title="Enlarge Option A (without choosing answer)"
                    >
                      <ZoomIn className="w-3 h-3 text-violet-600 dark:text-cyan-400" />
                      <span>Zoom</span>
                    </button>
                  </div>

                  <div className="relative">
                    <CardObfuscator
                      card={currentQuestion.card}
                      obfuscation={{ target: 'none', style: 'blur', isRevealed: isAnswerSubmitted }}
                      size="sm"
                    />
                    {/* Quick corner zoom button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedCard({ card: currentQuestion.card, label: 'Option A', optionId: currentQuestion.card.id });
                      }}
                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-cyan-300 hover:text-white border border-violet-500/40 backdrop-blur-xs transition-all shadow-md hover:scale-110 cursor-pointer"
                      title="Enlarge card without choosing"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* VS Badge */}
                <div className="shrink-0 flex flex-col items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#0e1438] border border-slate-300 dark:border-cyan-400/50 text-slate-800 dark:text-cyan-200 font-bold text-xs flex items-center justify-center font-mono shadow-xs">
                    VS
                  </div>
                </div>

                {/* Option B Card */}
                <div
                  onClick={() => !isAnswerSubmitted && handleSelectOption(currentQuestion.comparisonCard!.id)}
                  className={`flex flex-col items-center cursor-pointer transition-all p-2 rounded-2xl relative group select-none ${
                    selectedOptionId === currentQuestion.comparisonCard.id
                      ? 'bg-violet-100 dark:bg-violet-950/60 ring-2 ring-violet-500 dark:ring-cyan-400'
                      : 'hover:bg-slate-100 dark:hover:bg-[#0c1236]'
                  }`}
                  title="Click card to choose Option B"
                >
                  <div className="flex items-center justify-between w-full mb-1.5 px-0.5">
                    <span className="text-xs font-mono font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                      Option B (2)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedCard({ card: currentQuestion.comparisonCard!, label: 'Option B', optionId: currentQuestion.comparisonCard!.id });
                      }}
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-[#050818] hover:bg-violet-100 dark:hover:bg-violet-900/60 text-slate-600 dark:text-cyan-300 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1 transition-all cursor-pointer hover:scale-105 shadow-xs"
                      title="Enlarge Option B (without choosing answer)"
                    >
                      <ZoomIn className="w-3 h-3 text-violet-600 dark:text-cyan-400" />
                      <span>Zoom</span>
                    </button>
                  </div>

                  <div className="relative">
                    <CardObfuscator
                      card={currentQuestion.comparisonCard}
                      obfuscation={{ target: 'none', style: 'blur', isRevealed: isAnswerSubmitted }}
                      size="sm"
                    />
                    {/* Quick corner zoom button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedCard({ card: currentQuestion.comparisonCard!, label: 'Option B', optionId: currentQuestion.comparisonCard!.id });
                      }}
                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-cyan-300 hover:text-white border border-violet-500/40 backdrop-blur-xs transition-all shadow-md hover:scale-110 cursor-pointer"
                      title="Enlarge card without choosing"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Single Card Arena */
            <div className="flex flex-col items-center">
              <div
                className="relative group cursor-zoom-in"
                onClick={() => setZoomedCard({ card: currentQuestion.card })}
                title="Click to view card larger"
              >
                <CardObfuscator
                  card={currentQuestion.card}
                  obfuscation={{
                    ...currentQuestion.obfuscation,
                    isRevealed: isAnswerSubmitted,
                  }}
                  size="lg"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomedCard({ card: currentQuestion.card });
                  }}
                  className="absolute bottom-3 right-3 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#050818]/90 hover:bg-[#090e28] text-cyan-300 border border-violet-500/50 flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all hover:scale-105 cursor-pointer opacity-90 group-hover:opacity-100"
                  title="View card larger"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>View Larger</span>
                </button>
              </div>
            </div>
          )}

          {/* Category Tag */}
          <span className="px-3 py-1 rounded-full bg-white dark:bg-[#080d24] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs shadow-xs">
            {currentQuestion.title}
          </span>
        </div>

        {/* Right Column: Question Prompt, Options & Feedback */}
        <div className={`${isHeadToHead ? 'lg:col-span-6' : 'lg:col-span-7'} space-y-4 min-w-0`}>
          {/* Question Prompt Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading leading-snug">
              {currentQuestion.prompt}
            </h2>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{currentQuestion.tacticalContext}</p>
            </div>
          </div>

          {/* Multiple Choice Options */}
          <div className="space-y-2">
            {currentQuestion.options?.map((option, idx) => {
              const isSelected = selectedOptionId === option.id;
              const isOptionCorrect = option.id === currentQuestion.correctAnswer;
              const optionCard = cardMap[option.id];

              let buttonStyle = 'bg-white dark:bg-[#090e24] hover:bg-slate-50 dark:hover:bg-[#10163b] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200';

              if (isAnswerSubmitted) {
                if (isOptionCorrect) {
                  buttonStyle = 'bg-emerald-50 text-emerald-950 border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-400 dark:text-emerald-100 ring-1 ring-emerald-400';
                } else if (isSelected && !isOptionCorrect) {
                  buttonStyle = 'bg-rose-50 text-rose-950 border-rose-500 dark:bg-rose-950/40 dark:border-rose-500 dark:text-rose-200 ring-1 ring-rose-500';
                } else {
                  buttonStyle = 'bg-slate-50 dark:bg-[#050818]/30 border-slate-200 dark:border-slate-900 text-slate-400 dark:text-slate-600 opacity-50';
                }
              }

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={isAnswerSubmitted}
                  onClick={() => handleSelectOption(option.id)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer select-none shadow-xs ${buttonStyle}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="overflow-hidden min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{option.label}</span>
                        {option.manaCost && (
                          <ManaCostRenderer manaCost={option.manaCost} size="xs" />
                        )}
                      </div>
                      {option.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{option.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {optionCard && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedCard({ card: optionCard, label: option.label, optionId: option.id });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={`Enlarge "${option.label}" without choosing`}
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    )}

                    {isAnswerSubmitted && (
                      <div className="shrink-0">
                        {isOptionCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                        ) : isSelected ? (
                          <XCircle className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                        ) : null}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feedback Card & Primary NEXT QUESTION Action */}
          {isAnswerSubmitted && (
            <div
              className={`p-5 rounded-2xl border space-y-3.5 animate-in fade-in duration-200 shadow-sm ${
                isCorrect
                  ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/25 dark:border-emerald-500/40'
                  : 'bg-rose-50 border-rose-300 dark:bg-rose-950/25 dark:border-rose-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                      Correct Evaluation! +25 Draft XP
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    <span className="text-sm font-bold text-rose-800 dark:text-rose-200">
                      Incorrect — Logged in Missed Practice Deck
                    </span>
                  </>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-300">
                <p className="leading-relaxed font-sans">{currentQuestion.explanation}</p>
              </div>

              {/* HIGH CONTRAST NEXT ACTION BUTTON */}
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3.5 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-black text-sm uppercase tracking-wider font-heading transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-violet-400/50"
              >
                <span>{isLastQuestion ? 'Finish Quiz & View Results' : 'Next Question'}</span>
                <ArrowRight className="w-4 h-4" />
                <span className="text-[10px] font-mono opacity-80">(Enter)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card Inspection / Zoom Lightbox Modal */}
      {zoomedCard && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setZoomedCard(null)}
        >
          <div
            className="relative max-w-md sm:max-w-lg w-full max-h-[94vh] overflow-y-auto bg-white dark:bg-[#070b24] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 flex flex-col items-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Card Title, Set/Rarity & Close Button */}
            <div className="w-full flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 overflow-hidden min-w-0">
                <div className="p-1.5 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-cyan-400 shrink-0">
                  <ZoomIn className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate font-heading">
                      {zoomedCard.card.name}
                    </h3>
                    {zoomedCard.label && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/90 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-violet-800 shrink-0">
                        {zoomedCard.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                    <span className="uppercase font-bold text-violet-600 dark:text-cyan-300">{zoomedCard.card.set}</span>
                    <span>•</span>
                    <span className="capitalize">{zoomedCard.card.rarity}</span>
                    {zoomedCard.card.mana_cost && (
                      <>
                        <span>•</span>
                        <ManaCostRenderer manaCost={zoomedCard.card.mana_cost} size="xs" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setZoomedCard(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                title="Close zoom view (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Enlarge Card Image Arena (Respects active question masking) */}
            <div className="flex flex-col items-center justify-center my-1">
              <CardObfuscator
                card={zoomedCard.card}
                obfuscation={
                  zoomedCard.card.id === currentQuestion.card.id
                    ? { ...currentQuestion.obfuscation, isRevealed: isAnswerSubmitted }
                    : { target: 'none', style: 'blur', isRevealed: isAnswerSubmitted }
                }
                size="2xl"
              />
            </div>

            {/* Footer Navigation & Choice Actions */}
            <div className="w-full flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setZoomedCard(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close (Keep Thinking)
              </button>

              {zoomedCard.optionId && !isAnswerSubmitted ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectOption(zoomedCard.optionId!);
                    setZoomedCard(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Choose as Answer</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setZoomedCard(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizActive;
