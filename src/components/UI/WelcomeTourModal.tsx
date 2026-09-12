import React, { useState } from 'react';
import {
  Sparkles,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Brain,
  Scale,
  Compass,
  Zap,
  TrendingUp,
  Flame,
  ShieldCheck,
  Eye,
  EyeOff,
  Sliders,
  HelpCircle,
  Play,
  RotateCcw,
  PlayingCardsFan,
  Layers,
  BarChart2,
} from 'lucide-react';
import { PlaneswalkerSymbol } from './PlaneswalkerSymbol';

interface WelcomeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: 'evaluation' | 'quiz' | 'explorer') => void;
  onOpenSetSelector?: () => void;
}

interface TourStep {
  title: string;
  badge: string;
  tagline: string;
  description: string;
  targetTab?: 'evaluation' | 'quiz' | 'explorer';
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  visualNode?: React.ReactNode;
  bullets: {
    title: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  quickAction?: {
    label: string;
    action: () => void;
  };
}

export const WelcomeTourModal: React.FC<WelcomeTourModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenSetSelector,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('mtg_has_seen_welcome_tour_v1', 'true');
      } catch (e) {
        console.warn('Could not save welcome tour preference:', e);
      }
    }
    onClose();
  };

  const handleFinishTour = (targetTab?: 'evaluation' | 'quiz' | 'explorer') => {
    handleDismiss();
    if (targetTab && onNavigateTab) {
      onNavigateTab(targetTab);
    }
  };

  const steps: TourStep[] = [
    {
      title: 'Welcome to MTG Limited IQ',
      badge: 'Getting Started Guide',
      tagline: 'Your empirical draft workbench to evaluate cards, study 17Lands win rates, and drill format instincts.',
      description:
        'MTG Limited IQ is built for competitive Magic drafters — dense, rich, and power-user optimized. Walk through this quick guide to learn how each feature works, or select your set now to dive straight in.',
      icon: Sparkles,
      accentColor: 'from-violet-600 via-indigo-600 to-amber-500',
      visualNode: (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 text-xs shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
              <span className="px-2.5 py-1 rounded-xl bg-violet-600 text-white shadow-xs">Grading Hub</span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Quiz Drills</span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Cards Visualizer</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-violet-600 dark:text-cyan-400 font-bold bg-violet-50 dark:bg-violet-950/40 px-2 py-1 rounded-lg border border-violet-200 dark:border-violet-700/50">
              <span>Choose Set ▾</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Switch sets anytime in the top-right navbar. All tabs share your active set, filters, and personal grades.
          </p>
        </div>
      ),
      bullets: [
        {
          title: 'Three Core Workbenches',
          text: 'Grading (rate cards, compare benchmarks & calibrate), Cards (explore set catalog & syntax search), and Quiz (fast-paced tactical drills).',
          icon: Layers,
        },
        {
          title: 'Set Selector in Navbar',
          text: 'Click "Choose Set" in the top-right navbar anytime to switch between current Standard formats and historical draft sets.',
          icon: Sparkles,
        },
        {
          title: 'Dense & Feature-Rich',
          text: 'The UI packs deep empirical stats, dual-column card bodies, and direct 1-click rating. Step through this guide to master the tools!',
          icon: Sliders,
        },
      ],
      quickAction: onOpenSetSelector
        ? {
            label: 'Select Your Set to Begin',
            action: () => {
              handleDismiss();
              onOpenSetSelector();
            },
          }
        : undefined,
    },
    {
      title: '1. Card Interface & Quick Grading',
      badge: 'Card Anatomy & Rating',
      tagline: 'High-density card bodies engineered for rapid, detailed draft evaluation.',
      description:
        'Every card presents complete data at a glance: rules text, empirical stats, and instant grading without truncated text.',
      targetTab: 'evaluation',
      icon: Scale,
      accentColor: 'from-violet-600 to-cyan-500',
      visualNode: (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 text-xs shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span className="px-1.5 py-0.5 rounded-md bg-violet-950 text-white font-bold border border-violet-400">Me: A-</span>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-950 text-white font-bold border border-amber-400">LSV: 4.0</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-950 text-white font-bold border border-emerald-400">17L: B+</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">#042 • 2U</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono bg-slate-50 dark:bg-[#050818] p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
            <span>GIH WR: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">58.4%</strong></span>
            <span>ALSA: <strong>3.2</strong></span>
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              ✓ Within Tolerance
            </span>
          </div>
          <div className="pt-1 flex items-center justify-between text-[9px] font-mono text-slate-500 dark:text-slate-400">
            <span className="font-bold text-violet-700 dark:text-cyan-300">Quick Rate Strip:</span>
            <div className="flex gap-0.5">
              {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'].map((t) => (
                <span
                  key={t}
                  className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                    t === 'A-'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      ),
      bullets: [
        {
          title: 'Three Rating Badges (Me, LSV, 17L)',
          text: 'Top badges display your assigned grade (Me), pro pre-release tiers (LSV), and 17Lands win rate grades (17L). Use the "Sources" toggle in the filter bar to hide or show them.',
          icon: ShieldCheck,
        },
        {
          title: '1-Click Quick Rate Strip',
          text: 'Assign letter grades directly from the card list using the 11 buttons (A+ down to F) at the bottom of every card — no modal required.',
          icon: Zap,
        },
        {
          title: 'Full Inspection Modal',
          text: 'Click any card body to open the high-res modal. Use Left/Right Arrow keys to cycle cards, Esc to close, and type personal draft notes.',
          icon: Sliders,
        },
        {
          title: 'Uncut Rules & Mana Symbols',
          text: 'Complete oracle rules text and authentic mana symbols are rendered cleanly on the card tile for immediate reading.',
          icon: CheckCircle2,
        },
      ],
    },
    {
      title: '2. How to Compare Cards (Precedent Engine)',
      badge: 'Statistical Twins',
      tagline: 'Stuck on an unrated or previewed card? Compare it against historical statistical twins.',
      description:
        'When evaluating a new card or unfamiliar format, historical precedents show you how mechanically identical cards performed in the past.',
      targetTab: 'evaluation',
      icon: PlayingCardsFan,
      accentColor: 'from-cyan-500 to-blue-600',
      visualNode: (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#090e24] border border-violet-200 dark:border-violet-800/60 text-xs shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-violet-700 dark:text-cyan-300 flex items-center gap-1.5">
              <PlayingCardsFan className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              <span>Precedent Engine (Historical Comps)</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
              Consensus: Grade B
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 dark:text-white">Statistical Precedent #1</span>
                <span className="text-[10px] text-slate-400 font-mono">(OTJ)</span>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">57.9% WR • Grade B</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 dark:text-white">Statistical Precedent #2</span>
                <span className="text-[10px] text-slate-400 font-mono">(BLB)</span>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">56.2% WR • Grade B-</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
            Click "Use Grade (B)" or "Use Grade Average" inside the modal to adopt historical draft consensus directly.
          </p>
        </div>
      ),
      bullets: [
        {
          title: 'Click the Similar Cards Icon (🂠)',
          text: 'Found on the lower-right of every card tile (just above the F rating button). Click it to launch the Precedent Engine.',
          icon: PlayingCardsFan,
        },
        {
          title: 'Algorithmic Mechanical Comps',
          text: 'The engine compares mana cost, colors, card types, and structural mechanics (e.g. ETB value, hard removal, combat tricks, evasion, counters).',
          icon: Compass,
        },
        {
          title: 'Past 17Lands Performance',
          text: 'Inspect how predecessor cards actually performed in past formats (Game-in-Hand Win Rate % and ALSA pick order).',
          icon: TrendingUp,
        },
        {
          title: '1-Click Grade Adoption',
          text: 'Adopt the consensus grade or a specific predecessor rating with a single click using "Use Grade (X)" or "Use Grade Average (X)".',
          icon: Check,
        },
      ],
    },
    {
      title: '3. Grading Mode vs. Compare Mode',
      badge: 'Blind Testing & Verdicts',
      tagline: 'Grade without data bias, then reveal where your intuition outshines or misses 17Lands data.',
      description:
        'Test your instincts, uncover your blind spots, and learn which cards are format traps or sleepers.',
      targetTab: 'evaluation',
      icon: Eye,
      accentColor: 'from-amber-500 to-emerald-500',
      visualNode: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <EyeOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Grading Mode</span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
              17Lands data and LSV ratings are hidden so you rate cards blind with zero confirmation bias.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Compare Mode</span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Reveals empirical GIH WR %, ALSA pick order, and Traps (🔥) vs Sleepers (🧊) disparity banners.
            </p>
          </div>
        </div>
      ),
      bullets: [
        {
          title: 'Grading Mode (EyeOff)',
          text: 'Keeps 17Lands and LSV stats hidden while you rate cards so you evaluate with pure intuition.',
          icon: EyeOff,
        },
        {
          title: 'Compare Mode (Eye)',
          text: 'Unmasks 17Lands Premier Draft GIH Win Rate, ALSA (Average Last Seen At), and IWD (Improvement When Drawn).',
          icon: Eye,
        },
        {
          title: 'Traps (🔥) vs. Sleepers (🧊) Verdicts',
          text: 'Cards feature automatic disparity banners: Exact Match, Within Tolerance, Trap Card (overrated by you), or Sleeper Card (underrated hidden gem).',
          icon: Flame,
        },
        {
          title: 'Calibration & Curve Analytics',
          text: 'Check the Calibration subtab in the Grading Hub to view your personal accuracy curve, rarity breakdown, and evaluation biases.',
          icon: BarChart2,
        },
      ],
    },
    {
      title: '4. Filters, Syntax Search & Tactical Quizzes',
      badge: 'Power User Tools',
      tagline: 'Filter with surgical precision and drill tactical reflexes before drafting.',
      description:
        'Take your format mastery from theory into practice with targeted filters and flashcard drills.',
      targetTab: 'quiz',
      icon: Brain,
      accentColor: 'from-emerald-500 to-teal-500',
      visualNode: (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 text-xs shadow-xs space-y-2">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400">Tactical Filters:</span>
            <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950">Creatures</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Instants</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Tricks</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">Removal</span>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-100 dark:border-slate-800/80 font-mono text-[11px] text-slate-600 dark:text-slate-300">
            Search syntax: <code className="text-violet-600 dark:text-cyan-400 font-bold">o:flying mv&lt;=2</code> or <code className="text-violet-600 dark:text-cyan-400 font-bold">t:equipment</code>
          </div>
        </div>
      ),
      bullets: [
        {
          title: 'Tactical Role Filters',
          text: 'Filter in 1-click by Creatures, Instants, Combat Tricks, or Removal spells to analyze format interaction density.',
          icon: Sliders,
        },
        {
          title: 'Official Scryfall Syntax Search',
          text: 'Search with precision syntax: "o:flying", "t:equipment", "mv<=2", "c:wurg", or plain English card names and text.',
          icon: Sparkles,
        },
        {
          title: 'WOTC Supported Archetypes',
          text: 'View curated draft themes for all 10 color pairs with their anchor signpost uncommons and strategic game plans.',
          icon: Compass,
        },
        {
          title: 'Tactical Quiz Drills & Missed Cards',
          text: 'Drill open-mana blowouts, instant-speed tricks, and P1P1 picks. Use the Missed Cards Vault to re-test tricky cards.',
          icon: Brain,
        },
      ],
      quickAction: onOpenSetSelector
        ? {
            label: 'Select Your Set & Start Drafting',
            action: () => {
              handleDismiss();
              onOpenSetSelector();
            },
          }
        : undefined,
    },
  ];

  const currentStep = steps[currentStepIndex];
  const StepIcon = currentStep.icon;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      if (onOpenSetSelector) {
        handleDismiss();
        onOpenSetSelector();
      } else {
        handleFinishTour(currentStep.targetTab);
      }
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 dark:bg-[#030612]/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#080d26] border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Gradient Bar */}
        <div className="relative px-5 sm:px-6 pt-5 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-slate-50/80 to-white dark:from-[#0a1133]/90 dark:to-[#080d26]">
          {/* Subtle Top Accent Glow */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${currentStep.accentColor}`}
          />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br ${currentStep.accentColor} flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0 p-2 border border-white/25`}
              >
                {isFirstStep ? (
                  <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-xs" />
                ) : (
                  <StepIcon className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-cyan-300 border border-violet-200 dark:border-violet-700/50">
                    {currentStep.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Step {currentStepIndex + 1} of {steps.length}
                  </span>
                </div>
                <h2
                  id="welcome-tour-title"
                  className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading tracking-tight mt-0.5"
                >
                  {currentStep.title}
                </h2>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
              title="Close tour (Esc)"
              aria-label="Close tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Progress Dots / Tabs */}
          <div className="flex items-center gap-1.5 mt-4 pt-1">
            {steps.map((s, index) => (
              <button
                key={index}
                onClick={() => setCurrentStepIndex(index)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  index === currentStepIndex
                    ? 'w-8 bg-violet-600 dark:bg-cyan-400'
                    : index < currentStepIndex
                    ? 'w-3 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                    : 'w-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
                title={`Jump to ${s.title}`}
                aria-label={`Jump to step ${index + 1}: ${s.title}`}
              />
            ))}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* Tagline Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200/80 dark:border-slate-800/80">
            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
              {currentStep.tagline}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Visual Mockup / Demonstration for the Step */}
          {currentStep.visualNode && (
            <div className="pt-0.5">
              {currentStep.visualNode}
            </div>
          )}

          {/* Bulleted Feature Highlights */}
          <div className="space-y-2.5">
            {currentStep.bullets.map((bullet, idx) => {
              const BulletIcon = bullet.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-[#0a0f2e]/60 border border-slate-100 dark:border-slate-800/60 hover:border-violet-300 dark:hover:border-violet-700/50 transition-colors shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center text-violet-600 dark:text-cyan-400 shrink-0 mt-0.5">
                    <BulletIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {bullet.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {bullet.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action Button within Step */}
          {currentStep.quickAction && (
            <div className="pt-2">
              <button
                type="button"
                onClick={currentStep.quickAction.action}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-violet-500/20 flex items-center justify-center gap-2 cursor-pointer border border-white/10"
              >
                <span>{currentStep.quickAction.label}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#060a1f]/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none self-start sm:self-center">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 dark:text-cyan-400 border-slate-300 dark:border-slate-700 focus:ring-violet-500 cursor-pointer"
            />
            <span>Don't show this tour on startup</span>
          </label>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {isFirstStep ? (
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Skip Tour
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shadow-violet-500/20"
            >
              <span>{isLastStep ? 'Select Your Set & Start' : 'Next Step'}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeTourModal;
