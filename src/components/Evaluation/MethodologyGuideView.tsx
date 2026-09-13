import React, { useState } from 'react';
import {
  Calculator,
  Scale,
  Sparkles,
  BarChart2,
  TrendingUp,
  AlertTriangle,
  Award,
  HelpCircle,
  CheckCircle2,
  Zap,
  Flame,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  PieChart,
  Layers,
  Eye,
  Check,
} from 'lucide-react';
import { GradeTier } from '../../types/mtg';
import { GRADE_TIERS, GRADE_SCORES, winRateToGradeTier, gradeTierToIndex } from '../../services/seventeenLands';

interface MethodologyGuideViewProps {
  onGoToGrading?: () => void;
  onGoToForecast?: () => void;
  onGoToCalibration?: () => void;
}

export const MethodologyGuideView: React.FC<MethodologyGuideViewProps> = ({
  onGoToGrading,
  onGoToForecast,
  onGoToCalibration,
}) => {
  // Interactive Sandbox State
  const [sandboxGrade, setSandboxGrade] = useState<GradeTier>('B+');
  const [sandboxWinRate, setSandboxWinRate] = useState<number>(58.0);
  const [sandboxSimulated17LandsGrade, setSandboxSimulated17LandsGrade] = useState<GradeTier>('B');

  const simulated17LandsTier = winRateToGradeTier(sandboxWinRate);
  const userGradeIdx = gradeTierToIndex(sandboxGrade);
  const simulated17LandsIdx = gradeTierToIndex(sandboxSimulated17LandsGrade);
  const stepDelta = simulated17LandsIdx - userGradeIdx;
  const absDelta = Math.abs(stepDelta);

  let creditVerdict = {
    credit: '100% Credit (Correct)',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
    description: absDelta === 0 ? 'Bullseye exact tier match!' : 'Within single-step tolerance (±1 sub-tier). Counted as correct evaluation.',
  };
  if (absDelta === 2) {
    creditVerdict = {
      credit: '50% Partial Credit',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
      description: 'Minor miss (2 sub-tiers off). Yields 0.5 points toward your set calibration score.',
    };
  } else if (absDelta >= 3) {
    creditVerdict = {
      credit: '0% Credit (Major Discrepancy)',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border-rose-300 dark:border-rose-500/40',
      description: stepDelta > 0 ? 'Overrated card (Draft Trap).' : 'Underrated card (Draft Sleeper).',
    };
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase font-bold text-violet-700 dark:text-cyan-300 bg-violet-100 dark:bg-cyan-500/15 border border-violet-200 dark:border-cyan-400/30 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Analytics & Scoring Documentation
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                Mathematical Transparency
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white font-heading tracking-tight">
              How Card Evaluation & 17Lands Analytics Work
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
              Every formula, metric translation, and statistical model used in this application—from the 3-Source Triangulation Framework (Me vs LSV vs 17L) to 17Lands Game-In-Hand Win Rates and 2-color archetype power rankings.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Interactive Calculator / Grade Converter Sandbox */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-[#0d163a] dark:via-[#090e24] dark:to-[#0f1a44] border border-violet-200 dark:border-cyan-500/40 shadow-md space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-violet-200 dark:border-cyan-500/20">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-heading">
              Interactive Grade & Win Rate Sandbox
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Test any evaluation against 17Lands data in real-time
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Your Prediction Input */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              <span>Select Your Card Grade</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {GRADE_TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSandboxGrade(tier)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    sandboxGrade === tier
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400">Index: <strong className="text-slate-900 dark:text-white">{userGradeIdx}</strong></span>
              <span className="text-slate-500 dark:text-slate-400">Score: <strong className="text-violet-600 dark:text-cyan-400">{GRADE_SCORES[sandboxGrade].toFixed(1)} / 5.0</strong></span>
            </div>
          </div>

          {/* Middle: 17Lands Win Rate Slider */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>17Lands GIH Win Rate</span>
              </div>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                {sandboxWinRate.toFixed(1)}%
              </span>
            </div>

            <input
              type="range"
              min="44.0"
              max="66.0"
              step="0.5"
              value={sandboxWinRate}
              onChange={(e) => {
                const wr = parseFloat(e.target.value);
                setSandboxWinRate(wr);
                setSandboxSimulated17LandsGrade(winRateToGradeTier(wr));
              }}
              className="w-full accent-emerald-500 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>44% (F)</span>
              <span>55% (17Lands Avg)</span>
              <span>66% (A+)</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400">17Lands Tier:</span>
              <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                Tier {simulated17LandsTier}
              </span>
            </div>
          </div>

          {/* Right: Calculated Delta & Calibration Credit */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              <span>Calibration Result</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Step Delta (Δ):</span>
                <span className={`text-sm font-black font-mono ${stepDelta === 0 ? 'text-emerald-600 dark:text-emerald-400' : absDelta <= 1 ? 'text-emerald-600 dark:text-emerald-400' : absDelta === 2 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {stepDelta > 0 ? `+${stepDelta} (Over)` : stepDelta < 0 ? `${stepDelta} (Under)` : '0 (Exact)'}
                </span>
              </div>

              <div className={`p-2.5 rounded-xl border text-xs font-semibold ${creditVerdict.badgeClass}`}>
                <div className="font-bold font-heading">{creditVerdict.credit}</div>
                <div className="text-[11px] opacity-90 mt-0.5 font-normal">{creditVerdict.description}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. The 3-Source Triangulation Framework */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
              The 3-Source Triangulation Framework: Me vs LSV vs 17L
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Triangulating human intuition, expert theory, and big data
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          No single metric tells the full story of a Magic card in Limited. By triangulating your own evaluation against <strong>Luis Scott-Vargas's pre-release review</strong> and <strong>17Lands match logs</strong>, you can pinpoint draft traps, sleepers, and format misreads before wasting gems on MTG Arena.
        </p>

        {/* 3 Pillar Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pillar 1: Me */}
          <div className="p-4 rounded-2xl bg-violet-50/70 dark:bg-violet-950/20 border-2 border-violet-300 dark:border-violet-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-violet-900 dark:text-violet-300 text-sm">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                <span>Me (You)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200 border border-violet-300 dark:border-violet-700/60">
                Always Active
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Your personal subjective evaluation, deckbuilding notes, and pick priority. Anchors all calibration calculations.
            </p>
            <div className="p-2 rounded-xl bg-white dark:bg-[#050818] border border-violet-200 dark:border-violet-800/60 text-[11px] font-mono text-violet-800 dark:text-violet-300">
              • Scale: A+ through F (0.5 – 5.0)<br />
              • Locked permanently active (cannot be hidden)
            </div>
          </div>

          {/* Pillar 2: LSV */}
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 text-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>LSV (Expert)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60">
                Togglable [✓ LSV]
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Luis Scott-Vargas (Limited Resources) pre-release set review ratings. Built upon 15+ years of Pro Tour mastery and Quadrant Theory.
            </p>
            <div className="p-2 rounded-xl bg-white dark:bg-[#050818] border border-amber-200 dark:border-amber-800/60 text-[11px] font-mono text-amber-800 dark:text-amber-300">
              • Scale: 0.0 to 5.0 (Mapped to 11 Tiers)<br />
              • Available immediately on preview day 0
            </div>
          </div>

          {/* Pillar 3: 17L */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-300 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>17L (17Lands)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60">
                Togglable [✓ 17L]
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Arena match data across hundreds of thousands of games. Measures Game-In-Hand Win Rate (GIH WR) and ALSA pick speeds.
            </p>
            <div className="p-2 rounded-xl bg-white dark:bg-[#050818] border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
              • Scale: GIH WR (44% to 66%+)<br />
              • Synchronized as games are logged
            </div>
          </div>
        </div>

        {/* Compact Naming & Togglability Rules */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
            Compact Abbreviations & Rating Source Togglability
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="p-3 rounded-xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 space-y-1.5">
              <strong className="text-slate-900 dark:text-white font-mono block">1. Tight Space Labeling:</strong>
              To maximize card image visibility and avoid clutter, tight UI spaces (card tiles, modal headers, and table columns) use ultra-compact abbreviations:
              <ul className="list-disc pl-4 space-y-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-200 pt-1">
                <li><strong className="text-violet-600 dark:text-cyan-300">Me:</strong> Your assigned grade</li>
                <li><strong className="text-amber-600 dark:text-amber-300">LSV:</strong> Limited Resources preview score</li>
                <li><strong className="text-emerald-600 dark:text-emerald-300">17L:</strong> 17Lands grade</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 space-y-1.5">
              <strong className="text-slate-900 dark:text-white font-mono block">2. Togglable Sources System:</strong>
              You can toggle any combination of external sources using the top bar pills <code className="text-violet-600 dark:text-cyan-300 font-bold">[✓ Me] [✓ LSV] [✓ 17L]</code>:
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] pt-1">
                <li><strong>Me</strong> remains permanently locked on as the core personal grading target.</li>
                <li><strong>LSV</strong> and <strong>17L</strong> can be enabled or hidden at will and your preferences are automatically remembered in local storage.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* LSV 0.0 - 5.0 Numerical Scale Mapping Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-heading">
            LSV 0.0 – 5.0 Scale & Letter Grade Mapping Table
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  <th className="py-2 px-2.5 text-left">LSV Score</th>
                  <th className="py-2 px-2.5">Mapped Grade</th>
                  <th className="py-2 px-2.5">Tier Index</th>
                  <th className="py-2 px-2.5 text-left">Limited Resources Standard Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                <tr className="bg-amber-50/40 dark:bg-amber-500/5">
                  <td className="py-2 px-2.5 font-bold text-amber-700 dark:text-amber-300 text-left">4.8 – 5.0</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">A+</td>
                  <td className="py-2 px-2.5">0</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Unbeatable mythic bomb; wins games unilaterally</td>
                </tr>
                <tr className="bg-amber-50/20 dark:bg-amber-500/5">
                  <td className="py-2 px-2.5 font-bold text-amber-700 dark:text-amber-300 text-left">4.5 – 4.7</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">A</td>
                  <td className="py-2 px-2.5">1</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Dominant bomb rare or top unconditional removal</td>
                </tr>
                <tr className="bg-amber-50/10 dark:bg-amber-500/5">
                  <td className="py-2 px-2.5 font-bold text-amber-700 dark:text-amber-300 text-left">4.0 – 4.4</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">A-</td>
                  <td className="py-2 px-2.5">2</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Top-tier uncommon or premier premium removal</td>
                </tr>
                <tr className="bg-cyan-50/40 dark:bg-cyan-500/5">
                  <td className="py-2 px-2.5 font-bold text-cyan-700 dark:text-cyan-300 text-left">3.5 – 3.9</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">B+</td>
                  <td className="py-2 px-2.5">3</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Best common in color / signpost gold anchor</td>
                </tr>
                <tr className="bg-cyan-50/20 dark:bg-cyan-500/5">
                  <td className="py-2 px-2.5 font-bold text-cyan-700 dark:text-cyan-300 text-left">3.0 – 3.4</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">B</td>
                  <td className="py-2 px-2.5">4</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Great playable; always makes the 23-card main deck</td>
                </tr>
                <tr className="bg-cyan-50/10 dark:bg-cyan-500/5">
                  <td className="py-2 px-2.5 font-bold text-cyan-700 dark:text-cyan-300 text-left">2.5 – 2.9</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">B-</td>
                  <td className="py-2 px-2.5">5</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Solid bread-and-butter curve creature or trick</td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/30">
                  <td className="py-2 px-2.5 font-bold text-slate-700 dark:text-slate-300 text-left">2.0 – 2.4</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">C+</td>
                  <td className="py-2 px-2.5">6</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Good curve-filler with minor synergy upside</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                  <td className="py-2 px-2.5 font-bold text-slate-700 dark:text-slate-300 text-left">1.5 – 1.9</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">C</td>
                  <td className="py-2 px-2.5">7</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Average Limited baseline; 23rd card territory</td>
                </tr>
                <tr className="bg-slate-50/20 dark:bg-slate-800/10">
                  <td className="py-2 px-2.5 font-bold text-slate-700 dark:text-slate-300 text-left">1.0 – 1.4</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">C-</td>
                  <td className="py-2 px-2.5">8</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Below-average filler; cut when pool has depth</td>
                </tr>
                <tr className="bg-orange-50/40 dark:bg-orange-500/5">
                  <td className="py-2 px-2.5 font-bold text-orange-700 dark:text-orange-300 text-left">0.5 – 0.9</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">D</td>
                  <td className="py-2 px-2.5">9</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Weak filler or narrow sideboard card</td>
                </tr>
                <tr className="bg-rose-50/40 dark:bg-rose-500/5">
                  <td className="py-2 px-2.5 font-bold text-rose-700 dark:text-rose-300 text-left">0.0 – 0.4</td>
                  <td className="py-2 px-2.5 font-bold text-violet-700 dark:text-cyan-300">F</td>
                  <td className="py-2 px-2.5">10</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Unplayable in Limited draft</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Card Similarity Engine & Historical Comps Methodology */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
              Card Similarity Engine & Historical Precedents ("Comps")
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Algorithmic Pre-Release Benchmarking
          </span>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            The greatest hurdle in evaluating cards for a new or unreleased set (like pre-releases or spoiler seasons) is the <strong>cold-start problem</strong>: there are zero games logged on 17Lands.
          </p>
          <p>
            To solve this, our <strong>Similarity Engine</strong> queries hundreds of thousands of historical draft records across modern premier booster formats (such as <em>Bloomburrow</em>, <em>Outlaws of Thunder Junction</em>, <em>Wilds of Eldraine</em>, <em>March of the Machine</em>, <em>Kamigawa: Neon Dynasty</em>, and <em>Strixhaven</em>). By analyzing a new card's rules text, mana value, and typing, it surfaces functionally comparable cards and projects what the new card's draft grade <strong>MIGHT</strong> look like in practice.
          </p>
        </div>

        {/* 3 Pillars & Compatibility Gatekeeper Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-2xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/60 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-violet-900 dark:text-violet-300">
              <span>Gatekeeper</span>
              <span className="px-1.5 py-0.5 rounded bg-violet-200/60 dark:bg-violet-900/60 text-[10px]">Prerequisite</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
              Card Type is a compatibility filter, not an arbitrary point bucket. Instants &amp; Sorceries compare seamlessly, creatures compare with creatures/tokens, and auras compare with removal.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-300">
              <span>1. Functional Effect</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-[10px]">50 Pts</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
              Direct classification of the card's draft job: hard removal, direct burn, card draw, counterspells, combat tricks, and combat keyword synergies.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/60 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-cyan-900 dark:text-cyan-300">
              <span>2. Speed-Adjusted CMC</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-200/60 dark:bg-cyan-900/60 text-[10px]">30 Pts</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
              Evaluates tempo curve using the MTG <strong>Instant Speed Tax</strong> (+0.75 mana). A 3-mana Instant (<em>Murder</em>) and 2-mana Sorcery (<em>Fell</em>) achieve direct speed parity.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-300">
              <span>3. Statline &amp; Output</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 text-[10px]">20 Pts</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
              For creatures, evaluates body efficiency and the Vanilla Test (P/T ratio). For spells, evaluates output magnitude (unrestricted vs conditional targeting, damage scale).
            </p>
          </div>
        </div>

        {/* How Consensus is Calculated */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Scale className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
            <span>How the Historical Consensus ("MIGHT" Grade) is Projected</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 space-y-1">
              <strong className="text-slate-900 dark:text-white block font-mono">1. Scryfall Query Execution:</strong>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Constructs a targeted query excluding reprints and non-booster cards across 14 modern premier draft sets.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 space-y-1">
              <strong className="text-slate-900 dark:text-white block font-mono">2. 17Lands Cross-Reference:</strong>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Pulls Game-In-Hand Win Rates (GIH WR) and ALSA values from our IndexedDB cache for each matched candidate.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 space-y-1">
              <strong className="text-slate-900 dark:text-white block font-mono">3. Weighted Mean Projection:</strong>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Averages the win rates of the top comps and maps the result to our standard 11-tier letter grade system (e.g. 57.8% &rarr; Tier B+).
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-[#1a140a] border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed">
            <strong>Example in Practice:</strong> A 2-mana black removal spell with minor downside will surface historical cards like <em>Shoot the Sheriff</em> (58.2% WR, B+), <em>Go for the Throat</em> (59.1% WR, A-), and <em>Flunk</em> (55.6% WR, B-). The engine computes a <strong>Consensus Rating of B+ (57.6% Avg WR)</strong> with a range of B- to A-, giving you an immediate, data-backed baseline before you draft a single game.
          </div>
        </div>
      </div>

      {/* 17Lands Metrics Deep Dive */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <BarChart2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
            17Lands Metrics Deep Dive: What the Numbers Mean
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* GIH WR */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold flex items-center justify-center text-[10px]">GIH</span>
                GIH WR (Game In Hand Win Rate)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold">Gold Standard</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              The percentage of games won where the card was drawn into your hand at any point (opening hand or drawn during the match).
            </p>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#090e24] text-slate-700 dark:text-slate-300 font-mono text-[11px]">
              Why not Games Played (GP WR)? A card stuck in your deck without being drawn didn't impact the game. GIH isolates the card's active contribution.
            </div>
          </div>

          {/* IWD */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-cyan-300 font-mono font-bold flex items-center justify-center text-[10px]">IWD</span>
                IWD (Improvement When Drawn)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-cyan-300 font-bold">Synergy Lift</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Calculates <code className="font-mono text-violet-700 dark:text-cyan-300">GIH WR - GND WR</code> (Games Not Drawn Win Rate).
            </p>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#090e24] text-slate-700 dark:text-slate-300 font-mono text-[11px]">
              Positive IWD (+3% to +8%): Drawing this card makes your deck actively win more.<br />
              Negative IWD (-2% to -6%): The deck wins more when this card stays un-drawn (a classic trap card).
            </div>
          </div>

          {/* ALSA */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold flex items-center justify-center text-[10px]">ALSA</span>
                ALSA (Average Last Seen At)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 font-bold">Pick Priority</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              The average pick number (1.0 to 14.0) in a pack where the card is taken by human drafters.
            </p>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#090e24] text-slate-700 dark:text-slate-300 font-mono text-[11px]">
              • ALSA 1.1–2.2: First-pick bomb or premier removal.<br />
              • ALSA 7.0–12.0: Late-pack filler or niche build-around.
            </div>
          </div>

          {/* The 17Lands Baseline Problem */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-[#1a140a] border border-amber-200 dark:border-amber-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-amber-900 dark:text-amber-300 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                The 17Lands Baseline Bias (~55% Mean)
              </h3>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              17Lands users are dedicated, data-tracking players whose aggregate average win rate is <strong>~55% to 56%</strong> (not 50%).
            </p>
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#090e24] text-amber-900 dark:text-amber-300 font-mono text-[11px] border border-amber-200 dark:border-amber-500/30 font-semibold">
              Crucial: A card with a 52.0% GIH WR is performing below average (a C- or D tier card), while 58.0% is strong (B+), and &gt;62% is elite (A/A+).
            </div>
          </div>
        </div>
      </div>

      {/* Section: The Industry Landscape */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <BookOpen className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
            How Other Analytics Platforms Map This Data
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                <th className="py-2.5 px-3">Platform</th>
                <th className="py-2.5 px-3">Primary Output</th>
                <th className="py-2.5 px-3">Core Methodology</th>
                <th className="py-2.5 px-3">Key Differentiator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              <tr>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  17Lands.com (Native)
                </td>
                <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">Raw % (GIH, IWD, ALSA)</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300">Z-Score Normalization (0.33σ steps centered at 'C' set mean)</td>
                <td className="py-3 px-3 text-slate-500 dark:text-slate-400">Arena match logs across premier draft games</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  Untapped.gg (Draftsmith)
                </td>
                <td className="py-3 px-3 font-mono text-violet-600 dark:text-cyan-400">1–55 Score + 5 Badges</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300">Machine learning model trained on MTGA client logs</td>
                <td className="py-3 px-3 text-slate-500 dark:text-slate-400">Adaptive real-time rating updates based on drafted colors & curve</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Draftsim (Arena Tutor)
                </td>
                <td className="py-3 px-3 font-mono text-amber-600 dark:text-amber-400">0.0–5.0 Numerical Scale</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300">Expert human ratings tuned against draft simulator bot pick-rates</td>
                <td className="py-3 px-3 text-slate-500 dark:text-slate-400">Great baseline for Day 1 pre-release learning</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Limited Resources (LSV)
                </td>
                <td className="py-3 px-3 font-mono text-indigo-600 dark:text-indigo-400">0.0–5.0 Rating Scale</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300">Quadrant Theory (Developing, Ahead, At Parity, Behind)</td>
                <td className="py-3 px-3 text-slate-500 dark:text-slate-400">The historical standard for human set reviews and card evaluation</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  Sierkovitz / Community Data Science
                </td>
                <td className="py-3 px-3 font-mono text-cyan-600 dark:text-cyan-400">Win Rate Over Baseline (WROB)</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300">Bayesian shrinkage & IWD gap analysis to eliminate color riding</td>
                <td className="py-3 px-3 text-slate-500 dark:text-slate-400">Isolates true individual card power from overpowered archetypes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Mathematical Formulas */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Calculator className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
            Mathematical Formulas & Scoring Rubrics
          </h2>
        </div>

        {/* 11-Tier Conversion Master Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-heading">
            11-Tier Grade & 17Lands GIH Win Rate Threshold Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  <th className="py-2 px-2.5 text-left">Grade</th>
                  <th className="py-2 px-2.5">Index</th>
                  <th className="py-2 px-2.5">5.0 Score</th>
                  <th className="py-2 px-2.5">GPA Pts</th>
                  <th className="py-2 px-2.5">17Lands GIH Threshold</th>
                  <th className="py-2 px-2.5 text-left">Draft Role Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                <tr className="bg-amber-50/40 dark:bg-amber-500/5">
                  <td className="py-2 px-2.5 font-bold text-amber-700 dark:text-amber-300 text-left">A+</td>
                  <td className="py-2 px-2.5">0</td>
                  <td className="py-2 px-2.5 font-bold">5.0</td>
                  <td className="py-2 px-2.5">4.0</td>
                  <td className="py-2 px-2.5 text-emerald-600 dark:text-emerald-400 font-bold">&ge; 62.5%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Format-defining mythical bomb (P1P1 lock)</td>
                </tr>
                <tr className="bg-amber-50/20 dark:bg-amber-500/5">
                  <td className="py-2 px-2.5 font-bold text-amber-700 dark:text-amber-300 text-left">A</td>
                  <td className="py-2 px-2.5">1</td>
                  <td className="py-2 px-2.5 font-bold">4.7</td>
                  <td className="py-2 px-2.5">4.0</td>
                  <td className="py-2 px-2.5 text-emerald-600 dark:text-emerald-400 font-bold">60.5% – 62.4%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Dominant first pick / elite bomb rare</td>
                </tr>
                <tr className="bg-amber-50/10 dark:bg-amber-500/5">
                  <td className="py-2 px-2.5 font-bold text-amber-700 dark:text-amber-300 text-left">A-</td>
                  <td className="py-2 px-2.5">2</td>
                  <td className="py-2 px-2.5 font-bold">4.3</td>
                  <td className="py-2 px-2.5">3.7</td>
                  <td className="py-2 px-2.5 text-emerald-600 dark:text-emerald-400 font-bold">59.0% – 60.4%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Top-tier uncommon or premium unconditional removal</td>
                </tr>
                <tr className="bg-cyan-50/40 dark:bg-cyan-500/5">
                  <td className="py-2 px-2.5 font-bold text-cyan-700 dark:text-cyan-300 text-left">B+</td>
                  <td className="py-2 px-2.5">3</td>
                  <td className="py-2 px-2.5 font-bold">4.0</td>
                  <td className="py-2 px-2.5">3.3</td>
                  <td className="py-2 px-2.5 text-cyan-600 dark:text-cyan-400 font-bold">57.5% – 58.9%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Best common in color / signpost gold anchor</td>
                </tr>
                <tr className="bg-cyan-50/20 dark:bg-cyan-500/5">
                  <td className="py-2 px-2.5 font-bold text-cyan-700 dark:text-cyan-300 text-left">B</td>
                  <td className="py-2 px-2.5">4</td>
                  <td className="py-2 px-2.5 font-bold">3.7</td>
                  <td className="py-2 px-2.5">3.0</td>
                  <td className="py-2 px-2.5 text-cyan-600 dark:text-cyan-400 font-bold">56.0% – 57.4%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Great playable; always makes the 23-card main deck</td>
                </tr>
                <tr className="bg-cyan-50/10 dark:bg-cyan-500/5">
                  <td className="py-2 px-2.5 font-bold text-cyan-700 dark:text-cyan-300 text-left">B-</td>
                  <td className="py-2 px-2.5">5</td>
                  <td className="py-2 px-2.5 font-bold">3.3</td>
                  <td className="py-2 px-2.5">2.7</td>
                  <td className="py-2 px-2.5 text-cyan-600 dark:text-cyan-400 font-bold">54.5% – 55.9%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Solid bread-and-butter curve creature or trick</td>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800/30">
                  <td className="py-2 px-2.5 font-bold text-slate-700 dark:text-slate-300 text-left">C+</td>
                  <td className="py-2 px-2.5">6</td>
                  <td className="py-2 px-2.5 font-bold">3.0</td>
                  <td className="py-2 px-2.5">2.3</td>
                  <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400 font-bold">53.0% – 54.4%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Good curve-filler with minor synergy upside</td>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                  <td className="py-2 px-2.5 font-bold text-slate-700 dark:text-slate-300 text-left">C</td>
                  <td className="py-2 px-2.5">7</td>
                  <td className="py-2 px-2.5 font-bold">2.7</td>
                  <td className="py-2 px-2.5">2.0</td>
                  <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400 font-bold">51.5% – 52.9%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Average Limited baseline; 23rd card territory</td>
                </tr>
                <tr className="bg-slate-50/20 dark:bg-slate-800/10">
                  <td className="py-2 px-2.5 font-bold text-slate-700 dark:text-slate-300 text-left">C-</td>
                  <td className="py-2 px-2.5">8</td>
                  <td className="py-2 px-2.5 font-bold">2.3</td>
                  <td className="py-2 px-2.5">1.7</td>
                  <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400 font-bold">49.5% – 51.4%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Below-average filler; cut when pool has depth</td>
                </tr>
                <tr className="bg-orange-50/40 dark:bg-orange-500/5">
                  <td className="py-2 px-2.5 font-bold text-orange-700 dark:text-orange-300 text-left">D</td>
                  <td className="py-2 px-2.5">9</td>
                  <td className="py-2 px-2.5 font-bold">1.5</td>
                  <td className="py-2 px-2.5">1.0</td>
                  <td className="py-2 px-2.5 text-orange-600 dark:text-orange-400 font-bold">46.0% – 49.4%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Weak filler or narrow sideboard card</td>
                </tr>
                <tr className="bg-rose-50/40 dark:bg-rose-500/5">
                  <td className="py-2 px-2.5 font-bold text-rose-700 dark:text-rose-300 text-left">F</td>
                  <td className="py-2 px-2.5">10</td>
                  <td className="py-2 px-2.5 font-bold">0.5</td>
                  <td className="py-2 px-2.5">0.0</td>
                  <td className="py-2 px-2.5 text-rose-600 dark:text-rose-400 font-bold">&lt; 46.0%</td>
                  <td className="py-2 px-2.5 text-left font-sans text-slate-600 dark:text-slate-300">Unplayable in Limited draft</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Formulas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Formula: Step Delta & Tolerance */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm font-heading">
              Step Delta (Δ) & 1-Step Tolerance Rule
            </h4>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#090e24] font-mono text-[11px] text-slate-900 dark:text-white text-center font-bold border border-slate-200 dark:border-slate-800">
              Δ = Index(17Lands Grade) - Index(Your Grade)
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              In Limited draft evaluation, being within <strong>±1 sub-tier</strong> (e.g., A to A-, B- to C+) represents high-level format mastery. Thus:
            </p>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>|Δ| &le; 1 (Exact or 1-Step):</span>
                <strong>100% Credit (Counted as Correct)</strong>
              </div>
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>|Δ| = 2 (Minor Discrepancy):</span>
                <strong>50% Credit (Partial Read)</strong>
              </div>
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>|Δ| &ge; 3 (Major Divergence):</span>
                <strong>0% Credit (Trap / Sleeper Miss)</strong>
              </div>
            </div>
          </div>

          {/* Formula: Set Calibration Score */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm font-heading">
              Set Calibration Accuracy Score (%)
            </h4>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#090e24] font-mono text-[11px] text-slate-900 dark:text-white text-center font-bold border border-slate-200 dark:border-slate-800">
              Calibration Score = [ (Exact + 1-Step) + (0.5 &times; 2-Step) ] &divide; Total Rated Cards &times; 100%
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Provides your global accuracy score against 17Lands draft win rates:
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400">
                &ge; 59%: Pro Tour Caliber (LSV / Top Creators)
              </div>
              <div className="p-2 rounded bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 text-cyan-600 dark:text-cyan-400">
                49% – 58%: Diamond / Mythic Drafter
              </div>
              <div className="p-2 rounded bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 text-violet-600 dark:text-cyan-300">
                39% – 48%: Solid / Capable Drafter
              </div>
              <div className="p-2 rounded bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400">
                29% – 38%: Baseline / Developing
              </div>
            </div>
          </div>

          {/* Formula: Archetype Power Score */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm font-heading">
              2-Color Archetype Power Score (0.0 to 5.0)
            </h4>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#090e24] font-mono text-[11px] text-slate-900 dark:text-white text-center font-bold border border-slate-200 dark:border-slate-800">
              Power Score = 30% &times; (Gold Signposts) + 35% &times; (Color 1 Depth) + 35% &times; (Color 2 Depth)
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Synthesizes your individual card ratings into a predicted metagame tier list:
            </p>
            <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
              • <strong>Tier S:</strong> Score &ge; 4.0 (Dominant color pair)<br />
              • <strong>Tier A:</strong> 3.6 &le; Score &lt; 4.0 (Top tier archetype)<br />
              • <strong>Tier B:</strong> 3.2 &le; Score &lt; 3.6 (Solid playable pair)<br />
              • <strong>Tier C / D:</strong> Score &lt; 3.2 (Struggling synergy pair)
            </div>
          </div>

          {/* Formula: Meta Calibration Alignment Score */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm font-heading">
              Meta Calibration Alignment Score (%)
            </h4>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#090e24] font-mono text-[11px] text-slate-900 dark:text-white text-center font-bold border border-slate-200 dark:border-slate-800">
              Alignment = max(0, 100 - &sum; |Predicted Rank - 17Lands Rank| &times; 3.5)
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Measures how accurately your predicted top color pairs and 10 guild rankings matched 17Lands Arena win rates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
