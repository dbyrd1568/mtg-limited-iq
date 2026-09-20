import React, { useState } from 'react';
import { Card, SeventeenLandsSetData, UserCardEvaluation, UserArchetypeEvaluation, UserColorEvaluation, GradeTier, ArchetypeMetagameRole } from '../../types/mtg';
import { generateSetSynthesisReport, generateSetMetaSummaryMarkdown, SetSynthesisReport, ArchetypeStrength, ColorStrength } from '../../services/archetypeEvaluator';
import { GRADE_TIERS, GRADE_SCORES } from '../../services/seventeenLands';
import { Trophy, Sparkles, Copy, Check, Crown, Flame, Shield, Layers, Swords, ChevronDown, ChevronUp, Share2, Award, Zap, Activity, Info, BarChart2, CheckCircle2, TrendingUp, TrendingDown, Target, Scale, Eye, EyeOff, Clock, BookOpen, Star, Edit3, X, FileText, MessageSquare, AlertTriangle } from 'lucide-react';
import { CardObfuscator } from '../CardObfuscator';
import { ManaSymbol, ManaCostRenderer } from '../UI/ManaSymbol';
import confetti from 'canvas-confetti';

interface ArchetypeColorConfig {
  color1Hex: string;
  color2Hex: string;
  color1Name: string;
  color2Name: string;
  pips: string[];
  dualLandName: string;
}

const ARCHETYPE_COLOR_THEMES: Record<string, ArchetypeColorConfig> = {
  WU: { color1Hex: '#fef08a', color2Hex: '#0284c7', color1Name: 'White', color2Name: 'Blue', pips: ['W', 'U'], dualLandName: 'Hallowed Fountain' },
  UW: { color1Hex: '#0284c7', color2Hex: '#fef08a', color1Name: 'Blue', color2Name: 'White', pips: ['U', 'W'], dualLandName: 'Hallowed Fountain' },
  UB: { color1Hex: '#0284c7', color2Hex: '#1e293b', color1Name: 'Blue', color2Name: 'Black', pips: ['U', 'B'], dualLandName: 'Watery Grave' },
  BU: { color1Hex: '#1e293b', color2Hex: '#0284c7', color1Name: 'Black', color2Name: 'Blue', pips: ['B', 'U'], dualLandName: 'Watery Grave' },
  BR: { color1Hex: '#1e293b', color2Hex: '#dc2626', color1Name: 'Black', color2Name: 'Red', pips: ['B', 'R'], dualLandName: 'Blood Crypt' },
  RB: { color1Hex: '#dc2626', color2Hex: '#1e293b', color1Name: 'Red', color2Name: 'Black', pips: ['R', 'B'], dualLandName: 'Blood Crypt' },
  RG: { color1Hex: '#dc2626', color2Hex: '#16a34a', color1Name: 'Red', color2Name: 'Green', pips: ['R', 'G'], dualLandName: 'Stomping Ground' },
  GR: { color1Hex: '#16a34a', color2Hex: '#dc2626', color1Name: 'Green', color2Name: 'Red', pips: ['G', 'R'], dualLandName: 'Stomping Ground' },
  GW: { color1Hex: '#16a34a', color2Hex: '#fef08a', color1Name: 'Green', color2Name: 'White', pips: ['G', 'W'], dualLandName: 'Temple Garden' },
  WG: { color1Hex: '#fef08a', color2Hex: '#16a34a', color1Name: 'White', color2Name: 'Green', pips: ['W', 'G'], dualLandName: 'Temple Garden' },
  WB: { color1Hex: '#fef08a', color2Hex: '#1e293b', color1Name: 'White', color2Name: 'Black', pips: ['W', 'B'], dualLandName: 'Godless Shrine' },
  BW: { color1Hex: '#1e293b', color2Hex: '#fef08a', color1Name: 'Black', color2Name: 'White', pips: ['B', 'W'], dualLandName: 'Godless Shrine' },
  UR: { color1Hex: '#0284c7', color2Hex: '#dc2626', color1Name: 'Blue', color2Name: 'Red', pips: ['U', 'R'], dualLandName: 'Steam Vents' },
  RU: { color1Hex: '#dc2626', color2Hex: '#0284c7', color1Name: 'Red', color2Name: 'Blue', pips: ['R', 'U'], dualLandName: 'Steam Vents' },
  BG: { color1Hex: '#1e293b', color2Hex: '#16a34a', color1Name: 'Black', color2Name: 'Green', pips: ['B', 'G'], dualLandName: 'Overgrown Tomb' },
  GB: { color1Hex: '#16a34a', color2Hex: '#1e293b', color1Name: 'Green', color2Name: 'Black', pips: ['G', 'B'], dualLandName: 'Overgrown Tomb' },
  RW: { color1Hex: '#dc2626', color2Hex: '#fef08a', color1Name: 'Red', color2Name: 'White', pips: ['R', 'W'], dualLandName: 'Sacred Foundry' },
  WR: { color1Hex: '#fef08a', color2Hex: '#dc2626', color1Name: 'White', color2Name: 'Red', pips: ['R', 'W'], dualLandName: 'Sacred Foundry' },
  GU: { color1Hex: '#16a34a', color2Hex: '#0284c7', color1Name: 'Green', color2Name: 'Blue', pips: ['G', 'U'], dualLandName: 'Breeding Pool' },
  UG: { color1Hex: '#0284c7', color2Hex: '#16a34a', color1Name: 'Blue', color2Name: 'Green', pips: ['G', 'U'], dualLandName: 'Breeding Pool' },
};

const MONOCOLOR_THEMES: Record<string, { colorHex: string; pip: string; name: string }> = {
  W: { colorHex: '#e2d6b5', pip: 'W', name: 'Plains' },
  U: { colorHex: '#0284c7', pip: 'U', name: 'Island' },
  B: { colorHex: '#334155', pip: 'B', name: 'Swamp' },
  R: { colorHex: '#dc2626', pip: 'R', name: 'Mountain' },
  G: { colorHex: '#16a34a', pip: 'G', name: 'Forest' },
  C: { colorHex: '#64748b', pip: 'C', name: 'Wastes' },
};

interface ArchetypeForecastViewProps {
  cards: Card[];
  userEvaluations: Record<string, UserCardEvaluation>;
  userArchetypeEvaluations?: Record<string, UserArchetypeEvaluation>;
  userColorEvaluations?: Record<string, UserColorEvaluation>;
  onSaveArchetypeEvaluation?: (evaluation: UserArchetypeEvaluation) => void;
  onSaveColorEvaluation?: (evaluation: UserColorEvaluation) => void;
  seventeenLandsData?: SeventeenLandsSetData | null;
  isBlindGrading?: boolean;
  setCode: string;
  setName: string;
  onOpenRapidGrader: () => void;
  onSelectCard?: (card: Card) => void;
}

export const ArchetypeForecastView: React.FC<ArchetypeForecastViewProps> = ({
  cards,
  userEvaluations,
  userArchetypeEvaluations,
  userColorEvaluations,
  onSaveArchetypeEvaluation,
  onSaveColorEvaluation,
  seventeenLandsData,
  isBlindGrading = false,
  setCode,
  setName,
  onOpenRapidGrader,
  onSelectCard,
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedArchetype, setExpandedArchetype] = useState<string | null>(null);
  const [showOtherArchetypes, setShowOtherArchetypes] = useState(true);

  // Strategy Dossier & Notes Modal State
  const [activeDossierArchetype, setActiveDossierArchetype] = useState<ArchetypeStrength | null>(null);
  const [dossierNotesDraft, setDossierNotesDraft] = useState<string>('');
  const [dossierRoleDraft, setDossierRoleDraft] = useState<ArchetypeMetagameRole | undefined>(undefined);
  const [dossierSaved, setDossierSaved] = useState(false);

  // Color Notes Modal State
  const [activeColorNotesColor, setActiveColorNotesColor] = useState<ColorStrength | null>(null);
  const [colorNotesDraft, setColorNotesDraft] = useState<string>('');

  const report: SetSynthesisReport = generateSetSynthesisReport(
    cards,
    userEvaluations,
    setCode,
    setName,
    seventeenLandsData,
    userArchetypeEvaluations,
    userColorEvaluations
  );

  const monoColors = report.colorRankings.filter((c) => c.color !== 'C');
  const colorless = report.colorRankings.find((c) => c.color === 'C');
  const sorted17Colors = report.has17LandsData
    ? [...monoColors]
        .filter((c) => c.seventeenLandsAvgWinRate !== undefined)
        .sort((a, b) => (b.seventeenLandsAvgWinRate || 0) - (a.seventeenLandsAvgWinRate || 0))
    : [];

  const handleCopySummary = () => {
    const reportForExport = isBlindGrading
      ? { ...report, has17LandsData: false }
      : report;
    const md = generateSetMetaSummaryMarkdown(reportForExport);
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTriggerConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#06b6d4', '#fbbf24', '#ff4d2e', '#10b981'],
      });
    } catch (e) {}
  };

  // Counts and top ratings
  const ratedArchetypeCount = report.archetypeRankings.filter((a) => Boolean(a.userEvaluation?.userGrade)).length;
  const ratedColorCount = report.colorRankings.filter((c) => c.color !== 'C' && Boolean(c.userEvaluation?.userGrade)).length;
  const userTopArchetype = [...report.archetypeRankings]
    .filter((a) => Boolean(a.userEvaluation?.userGrade))
    .sort((a, b) => (b.userEvaluation?.userScore || 0) - (a.userEvaluation?.userScore || 0))[0];
  const userTopColor = [...report.colorRankings]
    .filter((c) => c.color !== 'C' && Boolean(c.userEvaluation?.userGrade))
    .sort((a, b) => (b.userEvaluation?.userScore || 0) - (a.userEvaluation?.userScore || 0))[0];

  const handleRateArchetype = (arch: ArchetypeStrength, grade: GradeTier) => {
    const score = GRADE_SCORES[grade] || 2.5;
    const tier: 'S' | 'A' | 'B' | 'C' | 'D' =
      grade === 'A+' || grade === 'A' ? 'S' :
      grade === 'A-' || grade === 'B+' ? 'A' :
      grade === 'B' || grade === 'B-' ? 'B' :
      grade === 'C+' || grade === 'C' || grade === 'C-' ? 'C' : 'D';

    const currentEval = arch.userEvaluation;
    onSaveArchetypeEvaluation?.({
      setCode,
      archetypeCode: arch.code,
      userGrade: grade,
      userScore: score,
      tier,
      roleInMetagame: currentEval?.roleInMetagame,
      notes: currentEval?.notes,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRateColor = (col: ColorStrength, grade: GradeTier) => {
    const score = GRADE_SCORES[grade] || 2.5;
    const currentEval = col.userEvaluation;
    onSaveColorEvaluation?.({
      setCode,
      color: col.color,
      userGrade: grade,
      userScore: score,
      notes: currentEval?.notes,
      updatedAt: new Date().toISOString(),
    });
  };

  const openDossier = (arch: ArchetypeStrength) => {
    setActiveDossierArchetype(arch);
    setDossierNotesDraft(arch.userEvaluation?.notes || '');
    setDossierRoleDraft(arch.userEvaluation?.roleInMetagame);
    setDossierSaved(false);
  };

  const handleSaveDossier = () => {
    if (!activeDossierArchetype) return;
    const currentEval = activeDossierArchetype.userEvaluation;
    const userGrade = currentEval?.userGrade || activeDossierArchetype.letterGrade;
    const userScore = currentEval?.userScore || activeDossierArchetype.powerScore;
    const tier = currentEval?.tier || activeDossierArchetype.tier;

    onSaveArchetypeEvaluation?.({
      setCode,
      archetypeCode: activeDossierArchetype.code,
      userGrade,
      userScore,
      tier,
      roleInMetagame: dossierRoleDraft,
      notes: dossierNotesDraft.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
    setDossierSaved(true);
    setTimeout(() => setDossierSaved(false), 2000);
  };

  const openColorNotes = (col: ColorStrength) => {
    setActiveColorNotesColor(col);
    setColorNotesDraft(col.userEvaluation?.notes || '');
  };

  const handleSaveColorNotes = () => {
    if (!activeColorNotesColor) return;
    const currentEval = activeColorNotesColor.userEvaluation;
    const userGrade = currentEval?.userGrade || activeColorNotesColor.letterGrade;
    const userScore = currentEval?.userScore || activeColorNotesColor.averageScore;

    onSaveColorEvaluation?.({
      setCode,
      color: activeColorNotesColor.color,
      userGrade,
      userScore,
      notes: colorNotesDraft.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
    setActiveColorNotesColor(null);
  };

  const getTierHeaderStyle = (tier: 'S' | 'A' | 'B' | 'C' | 'D') => {
    switch (tier) {
      case 'S':
        return 'bg-gradient-to-r from-amber-100 via-orange-50 to-transparent dark:from-amber-500/20 dark:via-orange-500/15 dark:to-transparent border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300 font-bold';
      case 'A':
        return 'bg-gradient-to-r from-cyan-100 via-blue-50 to-transparent dark:from-cyan-500/20 dark:via-blue-500/15 dark:to-transparent border-cyan-300 dark:border-cyan-500/40 text-cyan-900 dark:text-cyan-300 font-bold';
      case 'B':
        return 'bg-gradient-to-r from-violet-100 via-indigo-50 to-transparent dark:from-violet-500/20 dark:via-indigo-500/15 dark:to-transparent border-violet-300 dark:border-violet-500/40 text-violet-900 dark:text-violet-300 font-bold';
      case 'C':
        return 'bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/30 dark:to-transparent border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300 font-bold';
      case 'D':
        return 'bg-gradient-to-r from-rose-100 to-transparent dark:from-rose-500/20 dark:to-transparent border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300 font-bold';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Top Set Progress & Source Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-violet-500/35 shadow-md space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-950/80 px-2.5 py-0.5 rounded-md border border-violet-200 dark:border-violet-500/50 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-300" />
                👤 YOUR PERSONAL EVALUATION FORECAST
              </span>

              {report.has17LandsData ? (
                isBlindGrading ? (
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Grading Mode Active (17Lands Hidden)
                  </span>
                ) : (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    17Lands Comparison Active
                  </span>
                )
              ) : (
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  17Lands Data: TBD (Unreleased Set)
                </span>
              )}

              {report.isFullyGraded && (
                <span className="text-xs font-bold text-emerald-700 dark:text-cyan-300 bg-emerald-100 dark:bg-cyan-500/20 border border-emerald-300 dark:border-cyan-500/40 px-2.5 py-0.5 rounded-md">
                  100% Set Graded 🎉
                </span>
              )}

              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1.5 border ${
                ratedArchetypeCount === 10
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                  : 'bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-cyan-300 border-violet-300 dark:border-cyan-500/30'
              }`}>
                <Swords className="w-3.5 h-3.5 text-amber-500" />
                Archetypes Graded: {ratedArchetypeCount}/10
              </span>

              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1.5 border ${
                ratedColorCount === 5
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                  : 'bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-cyan-300 border-violet-300 dark:border-cyan-500/30'
              }`}>
                <Layers className="w-3.5 h-3.5 text-cyan-500" />
                Colors Graded: {ratedColorCount}/5
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-heading">
              {report.isFullyGraded
                ? `Your Complete Draft Meta Forecast: ${report.setName}`
                : `Your Personal Draft Meta Forecast & Archetype Synthesis`}
            </h2>

            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              <strong className="text-violet-700 dark:text-cyan-300 font-semibold">Note:</strong> This meta analysis is synthesized from <strong className="text-slate-900 dark:text-white">your personal card grades and ratings</strong> {!isBlindGrading && report.has17LandsData ? 'compared with 17Lands draft win rates' : 'into monocolor depth and archetype power rankings'}.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">

            <button
              onClick={handleCopySummary}
              className="px-4 py-2 bg-slate-100 dark:bg-[#050818] hover:bg-slate-200 dark:hover:bg-[#0f1738] border border-slate-300 dark:border-slate-700 hover:border-slate-400 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              title="Copy formatted Markdown tier list to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-600 dark:text-cyan-400" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Share / Copy Tier List'}</span>
            </button>

            {report.isFullyGraded ? (
              <button
                onClick={handleTriggerConfetti}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Celebrate 100%</span>
              </button>
            ) : (
              <button
                onClick={onOpenRapidGrader}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-white" />
                <span>Continue Grading</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 17Lands Prediction Calibration Banner */}
      {report.has17LandsData ? (
        isBlindGrading ? (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-300/60 dark:border-amber-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white">Grading Mode Active:</strong> 17Lands win rates, rank comparisons, and meta calibration alignment scores are hidden for unbiased draft practice.
              </span>
            </div>
          </div>
        ) : report.metaCalibrationScore !== undefined ? (
          <div
            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gradient-to-r dark:from-[#0d163a] dark:via-[#0b122e] dark:to-[#0d163a] border border-slate-200 dark:border-cyan-500/40 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            title={`Meta Calibration Formula:
100% - Total rank discrepancy penalty between your predicted archetype ranks and 17Lands win rate ranks = ${report.metaCalibrationScore}%`}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-violet-100 dark:bg-cyan-500/15 border border-violet-200 dark:border-cyan-400/30 text-violet-700 dark:text-cyan-300 shrink-0">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase font-bold text-violet-700 dark:text-cyan-300 tracking-wider">
                    Forecast vs 17Lands Calibration
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-violet-600 text-white border border-violet-400">
                    {report.metaCalibrationTier}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading">
                  {report.metaCalibrationScore}% Meta Calibration Alignment
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Measures how closely your draft tier list & color power predictions match real Arena draft win rates.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3 self-end sm:self-center bg-slate-100 dark:bg-[#050818] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-right font-mono">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Accuracy Score</div>
                <div className="text-lg font-black text-violet-700 dark:text-cyan-300">{report.metaCalibrationScore} / 100</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-violet-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Scale className="w-4 h-4 text-violet-600 dark:text-cyan-400 shrink-0" />
              <span className="text-slate-600 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white">17Lands Calibration Standing By:</strong> Grade at least <strong className="text-violet-700 dark:text-cyan-300 font-mono">15 cards</strong> to calculate your Meta Calibration Score (Currently <strong className="text-amber-600 dark:text-amber-300 font-mono">{report.ratedCards}/15</strong> graded).
              </span>
            </div>
            <button
              onClick={onOpenRapidGrader}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer self-start sm:self-auto"
            >
              ⚡ Continue Grading
            </button>
          </div>
        )
      ) : (
        !isBlindGrading && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-400">
                <strong className="text-slate-900 dark:text-white">17Lands Metagame: TBD</strong> — {report.setName} is an unreleased set. 17Lands data is available approximately 2 weeks after release.
              </span>
            </div>
          </div>
        )
      )}

      {/* 3. Executive KPI Highlights Grid (Your Predictions + 17Lands Comparison) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Top Color Card */}
        <div
          className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"
              title={report.bestColor ? `Average Color Score Formula:\nTotal Rating Points (${(report.bestColor.averageScore * report.bestColor.ratedCards).toFixed(1)}) ÷ ${report.bestColor.ratedCards} rated cards = ${report.bestColor.averageScore.toFixed(2)} / 5.0 (Score to Grade: A+=5.0, A=4.7, B=3.7, C=2.7, D=1.5, F=0.5)` : undefined}
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Your Top Color</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50">
              User Read
            </span>
          </div>

          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading">
              {report.bestColor?.name || 'N/A'}
            </span>
            {report.bestColor && (
              <span className={`text-xs font-mono font-bold px-1.5 py-0.2 rounded border ${report.bestColor.badgeClass}`}>
                Grade {report.bestColor.letterGrade}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Avg Score: {report.bestColor?.averageScore !== undefined ? report.bestColor.averageScore.toFixed(2) : '-'} / 5.0
          </p>

          {/* 17Lands Comparison Row */}
          {!isBlindGrading && (
            <div
              className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px] font-mono flex items-center justify-between"
              title={report.has17LandsData && report.seventeenLandsBestColor?.seventeenLandsAvgWinRate !== undefined ? "17Lands Premier Draft Game In Hand Win Rate (GIH WR) for this color" : "17Lands data pending release for this set"}
            >
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">17Lands #1 Color:</span>
              {report.has17LandsData && report.seventeenLandsBestColor?.seventeenLandsAvgWinRate !== undefined ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {report.seventeenLandsBestColor.name} ({((report.seventeenLandsBestColor.seventeenLandsAvgWinRate) * 100).toFixed(1)}%)
                </span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 font-bold">
                  TBD
                </span>
              )}
            </div>
          )}
        </div>

        {/* Top Archetype */}
        <div
          className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"
              title={report.bestArchetype ? `Archetype Power Score Formula:\n30% Gold Signpost Avg (${report.bestArchetype.signpostAvgScore.toFixed(2)}) + 35% ${report.bestArchetype.color1Name} Depth (${report.bestArchetype.color1AvgScore.toFixed(2)}) + 35% ${report.bestArchetype.color2Name} Depth (${report.bestArchetype.color2AvgScore.toFixed(2)}) = ${report.bestArchetype.powerScore.toFixed(2)} / 5.0` : undefined}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>Your #1 Archetype</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50">
              User Read
            </span>
          </div>

          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading">
              {userTopArchetype ? userTopArchetype.name : (report.bestArchetype?.name || 'N/A')}
            </span>
            {userTopArchetype?.userEvaluation?.userGrade ? (
              <span className="text-xs font-mono font-bold px-2 py-0.2 rounded bg-violet-600 text-white shadow-xs border border-violet-400 dark:border-cyan-400">
                Grade {userTopArchetype.userEvaluation.userGrade}
              </span>
            ) : report.bestArchetype ? (
              <span className="text-xs font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                Tier {report.bestArchetype.tier}
              </span>
            ) : null}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {userTopArchetype
              ? `${userTopArchetype.code} (${userTopArchetype.headline || userTopArchetype.theme})`
              : `${report.bestArchetype?.code || ''} (${report.bestArchetype?.theme || ''})`}
          </p>

          {/* 17Lands Comparison Row */}
          {!isBlindGrading && (
            <div
              className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px] font-mono flex items-center justify-between"
              title={report.has17LandsData && report.seventeenLandsBestArchetype?.seventeenLandsWinRate !== undefined ? "17Lands win rate for this 2-color archetype in Premier Draft" : "17Lands data pending release for this set"}
            >
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">17Lands #1 Pair:</span>
              {report.has17LandsData && report.seventeenLandsBestArchetype?.seventeenLandsWinRate !== undefined ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[140px]">
                  {report.seventeenLandsBestArchetype.name} ({((report.seventeenLandsBestArchetype.seventeenLandsWinRate) * 100).toFixed(1)}%)
                </span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 font-bold">
                  TBD
                </span>
              )}
            </div>
          )}
        </div>

        {/* Total Bombs Graded */}
        <div
          className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"
              title="Number of cards in this set that you evaluated with a Grade of A- (score 4.3) or higher"
            >
              <Award className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              <span>Your Graded Bombs</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50">
              User Read
            </span>
          </div>

          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-lg sm:text-xl font-black text-violet-700 dark:text-cyan-300 font-heading">
              {report.colorRankings.reduce((sum, c) => sum + c.bombs.length, 0)} Bombs
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Cards you rated A- or higher (Score ≥ 3.7)
          </p>

          {/* 17Lands Comparison Row */}
          {!isBlindGrading && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px] font-mono flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">17Lands Benchmark:</span>
              {report.has17LandsData ? (
                <span className="text-violet-700 dark:text-cyan-300 font-bold">17Lands GIH WR</span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 font-bold">TBD</span>
              )}
            </div>
          )}
        </div>

        {/* Lowest Rated Color */}
        <div
          className="p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"
              title={report.worstColor ? `Average Color Score Formula:\nTotal Rating Points (${(report.worstColor.averageScore * report.worstColor.ratedCards).toFixed(1)}) ÷ ${report.worstColor.ratedCards} rated cards = ${report.worstColor.averageScore.toFixed(2)} / 5.0` : undefined}
            >
              <Shield className="w-3.5 h-3.5 text-rose-500" />
              <span>Your Weakest Color</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50">
              User Read
            </span>
          </div>

          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-200 font-heading">
              {report.worstColor?.name || 'N/A'}
            </span>
            {report.worstColor && (
              <span className={`text-xs font-mono font-bold px-1.5 py-0.2 rounded border ${report.worstColor.badgeClass}`}>
                Grade {report.worstColor.letterGrade}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Avg Score: {report.worstColor?.averageScore !== undefined ? report.worstColor.averageScore.toFixed(2) : '-'} / 5.0
          </p>

          {/* 17Lands Comparison Row */}
          {!isBlindGrading && (
            <div
              className="pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px] font-mono flex items-center justify-between"
              title={report.has17LandsData && report.seventeenLandsWorstColor?.seventeenLandsAvgWinRate !== undefined ? "17Lands lowest average win rate color in Premier Draft" : "17Lands data pending release for this set"}
            >
              <span className="text-slate-500 dark:text-slate-400 text-[10px]">17Lands Lowest:</span>
              {report.has17LandsData && report.seventeenLandsWorstColor?.seventeenLandsAvgWinRate !== undefined ? (
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  {report.seventeenLandsWorstColor.name} ({((report.seventeenLandsWorstColor.seventeenLandsAvgWinRate) * 100).toFixed(1)}%)
                </span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 font-bold">
                  TBD
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Monocolor Power Hierarchy (Your Predictions vs 17Lands Data) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
            <span>Monocolor Power Rankings & Depth</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {report.has17LandsData && !isBlindGrading ? 'Your predicted rank vs 17Lands actual Arena rank' : 'Ranked by your average card evaluations'}
          </span>
        </div>

        {/* Content Creator Style Color Rankings Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-violet-500/35 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-violet-700 dark:text-cyan-300 bg-violet-100 dark:bg-violet-950/80 px-2.5 py-0.5 rounded-md border border-violet-200 dark:border-violet-700/50">
                Draft Power Chain
              </span>
            </div>
            {colorless && (
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5 self-start sm:self-auto bg-slate-50 dark:bg-[#050818] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                <span>Colorless ({colorless.ratedCards} of {colorless.totalCards} rated):</span>
                {colorless.ratedCards > 0 ? (
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    Grade {colorless.letterGrade} ({colorless.averageScore.toFixed(2)})
                  </span>
                ) : (
                  <span className="font-medium text-slate-400 dark:text-slate-500 italic">
                    Unrated
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Primary Row: User Read */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Your Evaluation Read</span>
              <span className="text-violet-600 dark:text-cyan-400 font-bold">• Best to Worst</span>
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-3.5 overflow-x-auto pb-2 pt-1">
              {monoColors.map((col, idx) => {
                const isLast = idx === monoColors.length - 1;
                const nextCol = monoColors[idx + 1];
                const isTied = Boolean(
                  nextCol && (
                    (col.ratedCards === 0 && nextCol.ratedCards === 0) ||
                    (col.ratedCards > 0 && nextCol.ratedCards > 0 && Math.abs(col.averageScore - nextCol.averageScore) < 0.01)
                  )
                );
                return (
                  <React.Fragment key={col.color}>
                    {/* Color Column */}
                    <div className="flex flex-col items-center gap-1.5 min-w-[64px] sm:min-w-[84px] p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#050818]/90 border border-slate-200 dark:border-slate-800/80 shadow-xs hover:border-violet-400 dark:hover:border-cyan-400/50 transition-colors">
                      {/* Mana Pip Art */}
                      <div className="relative group">
                        <ManaSymbol symbol={col.symbol} size="xl" className="w-10 h-10 sm:w-11 sm:h-11 drop-shadow-md hover:scale-110 transition-transform" />
                      </div>

                      {/* Color Name */}
                      <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 text-center">
                        {col.name}
                      </span>

                      {/* Grade Badge */}
                      <span className={`text-xs sm:text-sm font-mono font-black px-2 py-0.5 rounded-lg border shadow-xs ${col.ratedCards > 0 ? col.badgeClass : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'}`}>
                        {col.ratedCards > 0 ? col.letterGrade : '—'}
                      </span>

                      {/* Score & Rank */}
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {col.ratedCards > 0 ? `#${idx + 1} • ${col.averageScore.toFixed(2)}` : 'Unrated'}
                      </span>
                    </div>

                    {/* Separator Chevron / > or = */}
                    {!isLast && (
                      <div className="text-lg sm:text-2xl font-black text-slate-400 dark:text-slate-600 px-0.5 select-none shrink-0 self-center">
                        {isTied ? '=' : '>'}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Secondary Row: 17Lands Arena Win Rates (if available) */}
          {!isBlindGrading && (
            report.has17LandsData && sorted17Colors.length > 0 ? (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>17Lands Win Rates</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">• 17Lands GIH Win Rate Hierarchy</span>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-3.5 overflow-x-auto pb-1 pt-1">
                  {sorted17Colors.map((col, idx) => {
                    const isLast = idx === sorted17Colors.length - 1;
                    const next17 = sorted17Colors[idx + 1];
                    const is17Tied = Boolean(
                      next17 && (
                        (col.seventeenLandsAvgWinRate === undefined && next17.seventeenLandsAvgWinRate === undefined) ||
                        (col.seventeenLandsAvgWinRate !== undefined && next17.seventeenLandsAvgWinRate !== undefined &&
                         Math.abs(col.seventeenLandsAvgWinRate - next17.seventeenLandsAvgWinRate) < 0.001)
                      )
                    );
                    return (
                      <React.Fragment key={col.color}>
                        <div className="flex flex-col items-center gap-1 min-w-[64px] sm:min-w-[84px] p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 shadow-xs">
                          <div className="relative">
                            <ManaSymbol symbol={col.symbol} size="lg" className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-sm" />
                          </div>

                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            {col.name}
                          </span>

                          <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/40">
                            {col.seventeenLandsGrade || 'TBD'}
                          </span>

                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {col.seventeenLandsAvgWinRate !== undefined ? `${(col.seventeenLandsAvgWinRate * 100).toFixed(1)}% WR` : 'TBD'}
                          </span>
                        </div>

                        {!isLast && (
                          <div className="text-base sm:text-xl font-black text-emerald-400 dark:text-emerald-700/60 px-0.5 select-none shrink-0 self-center">
                            {is17Tied ? '=' : '>'}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>17Lands Win Rates</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">• 17Lands GIH Win Rate Hierarchy: TBD (Unreleased Set)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#050818]/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>17Lands data is available approximately 2 weeks after release. Color win rates will populate then.</span>
                </div>
              </div>
            )
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {report.colorRankings.map((col, idx) => {
            const mTheme = MONOCOLOR_THEMES[col.color] || {
              bgGradient: 'bg-white dark:bg-[#090e24]',
              borderColor: 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700',
              pip: 'C',
            };

            return (
              <div
                key={col.color}
                className="p-4 rounded-2xl bg-white dark:bg-[#090d20] border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-xs hover:shadow-md transition-all overflow-hidden relative"
                title={`Average Grade Score Calculation:
Total evaluation points (${(col.averageScore * col.ratedCards).toFixed(1)}) ÷ ${col.ratedCards} rated cards in ${col.name} = ${col.averageScore.toFixed(2)} / 5.0`}
              >
                {/* Monocolor Basic Land Top Pinstripe */}
                <div className="h-1.5 w-full -mx-4 -mt-4 mb-3.5 shrink-0" style={{ backgroundColor: mTheme.colorHex }} />

                {/* Header with Pip & Ranking */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#050818] border border-slate-300 dark:border-slate-800 text-xs font-bold font-mono text-violet-700 dark:text-cyan-300 flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      {col.color !== 'C' && <ManaSymbol symbol={mTheme.pip} size="md" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{col.name}</h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {col.ratedCards} / {col.totalCards} cards rated by you
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {col.userEvaluation?.userGrade && (
                        <span
                          className="px-2 py-0.5 rounded text-xs font-black font-mono bg-violet-600 text-white border border-violet-400 dark:border-cyan-400 shadow-xs flex items-center gap-1"
                          title={`Your Direct Assigned Grade for ${col.name}`}
                        >
                          <Star className="w-3 h-3 text-amber-300" />
                          {col.userEvaluation.userGrade}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-black font-mono border ${col.ratedCards > 0 ? col.badgeClass : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'}`}>
                        {col.ratedCards > 0 ? `Avg ${col.letterGrade}` : 'Unrated'}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {col.ratedCards > 0 ? `Score: ${col.averageScore.toFixed(2)}` : 'No cards rated'}
                    </div>
                  </div>
                </div>

                {/* 17Lands Comparison Strip */}
                {!isBlindGrading && col.color !== 'C' && (
                  report.has17LandsData && col.seventeenLandsAvgWinRate !== undefined ? (
                    <div
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#050818]/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono"
                      title={`17Lands Premier Draft stats: ${((col.seventeenLandsAvgWinRate || 0) * 100).toFixed(1)}% average GIH win rate across all ${col.name} monocolored cards (Rank #${col.seventeenLandsRank} in Arena metagame)`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">17Lands:</span>
                        <span className="text-emerald-700 dark:text-emerald-300 font-black text-xs">
                          {((col.seventeenLandsAvgWinRate || 0) * 100).toFixed(1)}% WR
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                          (Rank #{col.seventeenLandsRank})
                        </span>
                      </div>

                      <div>
                        {col.rankDelta === 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-bold">
                            🎯 Spot On
                          </span>
                        ) : (col.rankDelta || 0) > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-[10px] font-bold flex items-center gap-0.5">
                            <TrendingUp className="w-2.5 h-2.5" /> +{col.rankDelta} Higher
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 text-[10px] font-bold flex items-center gap-0.5">
                            <TrendingDown className="w-2.5 h-2.5" /> {col.rankDelta} Lower
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="p-2 rounded-xl bg-slate-50/70 dark:bg-[#050818]/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">17Lands:</span>
                        <span className="text-slate-600 dark:text-slate-300 font-bold text-xs">
                          TBD
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                          (Rank: TBD)
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Unreleased Set
                      </span>
                    </div>
                  )
                )}

                {/* Bombs & Key Commons */}
                <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800/70 text-xs">
                  {col.bombs.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wider block mb-1">
                        Your Top Bombs ({col.bombs.length})
                      </span>
                      <div className="space-y-1">
                        {col.bombs.slice(0, 2).map((b) => (
                          <button
                            key={b.card.id}
                            type="button"
                            onClick={() => onSelectCard?.(b.card)}
                            className="w-full flex items-center justify-between text-[11px] bg-slate-50 hover:bg-slate-100 dark:bg-[#050818]/90 dark:hover:bg-[#0d1538] px-2 py-1 rounded border border-slate-200 dark:border-slate-800/60 hover:border-violet-400 dark:hover:border-cyan-400/50 transition-colors cursor-pointer text-left group/card"
                          >
                            <span className="text-slate-800 dark:text-white truncate max-w-[170px] group-hover/card:text-violet-600 dark:group-hover/card:text-cyan-300">{b.card.name}</span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-300">{b.eval.userGrade}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {col.topCommons.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-violet-600 dark:text-cyan-300 uppercase tracking-wider block mb-1">
                        Your Key Commons ({col.topCommons.length})
                      </span>
                      <div className="space-y-1">
                        {col.topCommons.slice(0, 2).map((c) => (
                          <button
                            key={c.card.id}
                            type="button"
                            onClick={() => onSelectCard?.(c.card)}
                            className="w-full flex items-center justify-between text-[11px] bg-slate-50 hover:bg-slate-100 dark:bg-[#050818]/90 dark:hover:bg-[#0d1538] px-2 py-1 rounded border border-slate-200 dark:border-slate-800/60 hover:border-violet-400 dark:hover:border-cyan-400/50 transition-colors cursor-pointer text-left group/card"
                          >
                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[170px] group-hover/card:text-violet-600 dark:group-hover/card:text-cyan-300">{c.card.name}</span>
                            <span className="font-mono font-bold text-violet-600 dark:text-cyan-300">{c.eval.userGrade}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Monocolor Quick-Grade Strip & Notes */}
                {col.color !== 'C' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500" />
                        <span>Direct Grade</span>
                      </span>
                      {col.userEvaluation?.userGrade && (
                        <span className="text-[10px] font-mono font-bold text-violet-700 dark:text-cyan-300">
                          Assigned: {col.userEvaluation.userGrade}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                      {GRADE_TIERS.map((tier) => {
                        const isSelected = col.userEvaluation?.userGrade === tier;
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => handleRateColor(col, tier)}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-violet-600 text-white shadow-xs scale-105 ring-2 ring-violet-400 dark:ring-cyan-300 font-black'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#050818] dark:hover:bg-[#131d42] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                            }`}
                            title={`Assign grade ${tier} to ${col.name}`}
                          >
                            {tier}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => openColorNotes(col)}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#050818] dark:hover:bg-[#0f1738] border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-violet-500 dark:text-cyan-400" />
                      <span>{col.userEvaluation?.notes ? 'Edit Color Notes' : 'Add Color Strategy Notes'}</span>
                      {Boolean(col.userEvaluation?.notes) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Two-Color Archetypes (Designed for Set at Top, Other Color Pairs Below) */}
      {(() => {
        const renderArchetypeCard = (arch: ArchetypeStrength) => {
          const isExpanded = expandedArchetype === arch.code;
          const theme = ARCHETYPE_COLOR_THEMES[arch.code] || {
            color1Hex: '#64748b',
            color2Hex: '#64748b',
            color1Name: 'Color 1',
            color2Name: 'Color 2',
            pips: arch.colors,
            dualLandName: 'Dual Land',
          };
          const pips = theme.pips && theme.pips.length > 0 ? theme.pips : arch.colors;

          return (
            <div
              key={arch.code}
              className="p-4 rounded-2xl bg-white dark:bg-[#090d20] border border-slate-200 dark:border-slate-800/80 transition-all space-y-3 shadow-xs hover:shadow-md relative overflow-hidden group"
            >
              {/* Authentic MTG 50/50 Dual Land Split Bar - Left half Color 1, Right half Color 2, NO yellow in middle */}
              <div className="flex h-1.5 w-full -mx-4 -mt-4 mb-3.5 shrink-0">
                <div className="w-1/2 h-full" style={{ backgroundColor: theme.color1Hex }} title={`${arch.name} (${theme.color1Name})`} />
                <div className="w-1/2 h-full" style={{ backgroundColor: theme.color2Hex }} title={`${arch.name} (${theme.color2Name})`} />
              </div>

              {/* Header with Dual Mana Pips, Name, Badges */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Dual WOTC Mana Pips */}
                    <div className="flex items-center gap-0.5 bg-slate-100/90 dark:bg-[#050818]/90 px-1.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700/60 shadow-xs shrink-0">
                      {pips.map((p) => (
                        <ManaSymbol key={p} symbol={p} size="sm" />
                      ))}
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading tracking-wide">
                      {arch.name}
                    </h4>

                    {arch.isDevelopedForSet ? (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shrink-0">
                        🎯 Set Archetype
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700 shrink-0">
                        🧩 Off-Archetype
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-violet-600 dark:text-cyan-400 font-semibold">{arch.headline || arch.theme}</p>
                </div>

                {/* Distinctive Grade Badges (User Direct Grade, 17Lands Telemetry, Bottom-Up Power) */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {arch.userEvaluation?.userGrade && (
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {arch.userEvaluation.roleInMetagame && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/50">
                          {arch.userEvaluation.roleInMetagame}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-lg bg-violet-600 text-white font-mono font-black text-xs shadow-xs border border-violet-400 dark:border-cyan-400 flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-300" />
                        Grade {arch.userEvaluation.userGrade}
                      </span>
                    </div>
                  )}

                  {!isBlindGrading && report.has17LandsData && arch.seventeenLandsWinRate !== undefined ? (
                    <>
                      {/* 17Lands Win Rate Badge */}
                      <div
                        className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-400/60 text-emerald-800 dark:text-emerald-300 shadow-xs text-right"
                      >
                        <div
                          className="text-[9px] uppercase font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-wider text-right"
                          title={`17Lands Archetype Win Rate Formula:\n30% Gold Signpost WR + 35% ${arch.color1Name} WR + 35% ${arch.color2Name} WR = ${(arch.seventeenLandsWinRate * 100).toFixed(1)}% WR`}
                        >
                          17Lands
                        </div>
                        <div className="text-sm font-black font-mono text-slate-900 dark:text-white flex items-center gap-1.5 justify-end">
                          <span>Tier {arch.seventeenLandsTier}</span>
                          <span className="text-emerald-700 dark:text-emerald-300 text-xs">({(arch.seventeenLandsWinRate * 100).toFixed(1)}%)</span>
                        </div>
                      </div>

                      {/* 👤 YOUR PRACTICE / PREDICTED READ */}
                      <div
                        className="text-[10px] font-mono text-slate-600 dark:text-slate-400 text-right bg-slate-100/90 dark:bg-[#050818]/90 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800"
                        title={`Archetype Power Score Formula:\n30% Gold Signpost Avg (${arch.signpostAvgScore.toFixed(2)}) + 35% ${arch.color1Name} Depth (${arch.color1AvgScore.toFixed(2)}) + 35% ${arch.color2Name} Depth (${arch.color2AvgScore.toFixed(2)}) = ${arch.powerScore.toFixed(2)} / 5.0 (Predicted Grade: ${arch.letterGrade})`}
                      >
                        <span>Bottom-Up: <strong className="text-violet-700 dark:text-violet-300 font-bold">{arch.letterGrade}</strong> (Power {arch.powerScore.toFixed(2)})</span>
                      </div>
                    </>
                  ) : (
                    /* Pre-Release Prediction Mode */
                    <div
                      className="px-2.5 py-1 rounded-xl bg-violet-100 dark:bg-violet-600/30 border border-violet-300 dark:border-violet-400/50 text-right shadow-xs"
                    >
                      <div
                        className="text-[9px] uppercase font-mono font-bold text-violet-700 dark:text-cyan-300 tracking-wider text-right"
                        title={`Archetype Power Score Formula:\n30% Signpost Avg (${arch.signpostAvgScore.toFixed(2)}) + 35% ${arch.color1Name} Depth (${arch.color1AvgScore.toFixed(2)}) + 35% ${arch.color2Name} Depth (${arch.color2AvgScore.toFixed(2)}) = ${arch.powerScore.toFixed(2)} / 5.0`}
                      >
                        Bottom-Up Read
                      </div>
                      <div className="text-sm font-black font-mono text-slate-900 dark:text-white">
                        Tier {arch.tier} ({arch.letterGrade})
                      </div>
                      <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 flex items-center justify-end gap-1.5">
                        <span>Power: {arch.powerScore.toFixed(2)}</span>
                        {!isBlindGrading && (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">• 17L: TBD</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* WOTC Design Strategy & Mechanics */}
              {arch.description && (
                <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-[#060a1d]/90 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    <span>WOTC Design Strategy</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                    "{arch.description}"
                  </p>
                  {arch.mechanics && arch.mechanics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {arch.mechanics.map((mech) => (
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
              )}

              {/* 17Lands Comparison Strip */}
              {!isBlindGrading && (
                report.has17LandsData && arch.seventeenLandsWinRate !== undefined ? (
                  <div
                    className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-[#050818]/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400" title={`Delta Calibration Read: Your prediction is ${arch.tierDelta === 0 ? 'an exact match with 17Lands' : (arch.tierDelta || 0) > 0 ? `higher than 17Lands by ${arch.tierDelta} tier(s)` : `lower than 17Lands by ${Math.abs(arch.tierDelta || 0)} tier(s)`}`}>
                        Calibration Read:
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 text-xs font-bold">
                        You ({arch.letterGrade}) vs 17Lands (Tier {arch.seventeenLandsTier})
                      </span>
                    </div>

                    <div>
                      {arch.tierDelta === 0 ? (
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Exact Tier Match
                        </span>
                      ) : (arch.tierDelta || 0) > 0 ? (
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-500/40 flex items-center gap-1">
                          <TrendingUp className="w-2.5 h-2.5" />
                          Overpredicted (+{arch.tierDelta})
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/20 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-500/40 flex items-center gap-1">
                          <TrendingDown className="w-2.5 h-2.5" />
                          Underpredicted ({arch.tierDelta})
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-2 rounded-xl bg-slate-50/70 dark:bg-[#050818]/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">17Lands Calibration:</span>
                      <span className="text-slate-600 dark:text-slate-300 font-bold text-xs">
                        TBD
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      Unreleased Set
                    </span>
                  </div>
                )
              )}

              {/* Signpost & Colors Formula Subtext with Tooltips */}
              <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-50/90 dark:bg-[#050818]/80 border border-slate-200 dark:border-slate-800/60 text-center text-[10px] font-mono">
                <div className="flex flex-col items-center gap-0.5" title={`Signpost Formula (30% weight in Power Score): Average grade of the ${arch.signposts.length} gold signpost uncommons/rares in this archetype = ${arch.signpostAvgScore.toFixed(2)} / 5.0`}>
                  <span className="text-slate-500">
                    Signpost Avg (30%)
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-300">{arch.signpostAvgScore.toFixed(2)}</span>
                </div>
                <div className="flex flex-col items-center gap-0.5" title={`${arch.color1Name} Depth Formula (35% weight in Power Score): Average rating across all ${arch.color1Name} monocolor cards = ${arch.color1AvgScore.toFixed(2)} / 5.0`}>
                  <span className="text-slate-500">
                    {arch.color1Name} (35%)
                  </span>
                  <span className="font-bold text-violet-700 dark:text-cyan-300">{arch.color1AvgScore.toFixed(2)}</span>
                </div>
                <div className="flex flex-col items-center gap-0.5" title={`${arch.color2Name} Depth Formula (35% weight in Power Score): Average rating across all ${arch.color2Name} monocolor cards = ${arch.color2AvgScore.toFixed(2)} / 5.0`}>
                  <span className="text-slate-500">
                    {arch.color2Name} (35%)
                  </span>
                  <span className="font-bold text-violet-700 dark:text-cyan-300">{arch.color2AvgScore.toFixed(2)}</span>
                </div>
              </div>

              {/* Key Signpost Cards */}
              {arch.signposts.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Gold Signposts ({arch.signposts.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {arch.signposts.slice(0, 4).map((sp) => (
                      <button
                        key={sp.card.id}
                        type="button"
                        onClick={() => onSelectCard?.(sp.card)}
                        className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-[#050818]/90 dark:hover:bg-[#0d1538] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/50 px-2 py-0.5 rounded-lg text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer text-left group/sp"
                      >
                        <span className="group-hover/sp:text-violet-600 dark:group-hover/sp:text-cyan-300 font-medium">{sp.card.name}</span>
                        {sp.eval && (
                          <strong className="text-violet-700 dark:text-cyan-300 font-mono">[{sp.eval.userGrade}]</strong>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggle Card Details */}
              {arch.keyPicks.length > 0 && (
                <div className="pt-1 border-t border-slate-200 dark:border-slate-800/60">
                  <button
                    onClick={() => setExpandedArchetype(isExpanded ? null : arch.code)}
                    className="text-[11px] font-semibold text-violet-600 dark:text-cyan-400 hover:text-violet-700 dark:hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Key Cards' : `Show Top Key Picks (${arch.keyPicks.length})`}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1 animate-in fade-in duration-150">
                      {arch.keyPicks.map((pick) => (
                        <button
                          key={pick.card.id}
                          type="button"
                          onClick={() => onSelectCard?.(pick.card)}
                          className="w-full flex items-center justify-between text-[11px] bg-slate-50 hover:bg-slate-100 dark:bg-[#050818] dark:hover:bg-[#0d1538] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/50 transition-colors cursor-pointer text-left group/pick"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-800 dark:text-white font-medium truncate group-hover/pick:text-violet-600 dark:group-hover/pick:text-cyan-300">{pick.card.name}</span>
                            {pick.card.mana_cost && (
                              <ManaCostRenderer manaCost={pick.card.mana_cost} size="xs" />
                            )}
                          </div>
                          <span className="font-mono font-bold text-violet-700 dark:text-cyan-300 shrink-0 ml-2">
                            {pick.eval.userGrade}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* User Archetype Direct Rating & Strategy Dossier Row */}
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500" />
                    <span>Your Direct Grade:</span>
                    <strong className="text-violet-700 dark:text-cyan-300 font-bold ml-1">
                      {arch.userEvaluation?.userGrade || 'Unassigned'}
                    </strong>
                  </span>
                  {arch.userEvaluation?.roleInMetagame && (
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      Role: <span className="font-bold text-violet-600 dark:text-cyan-300">{arch.userEvaluation.roleInMetagame}</span>
                    </span>
                  )}
                </div>

                {/* Quick Grade Strip */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                  {GRADE_TIERS.map((tier) => {
                    const isSelected = arch.userEvaluation?.userGrade === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => handleRateArchetype(arch, tier)}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600 text-white shadow-md scale-105 ring-2 ring-violet-400 dark:ring-cyan-300 font-black'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#050818] dark:hover:bg-[#131d42] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                        title={`Directly rate ${arch.name} as ${tier}`}
                      >
                        {tier}
                      </button>
                    );
                  })}
                </div>

                {/* Strategy Dossier Button */}
                <button
                  type="button"
                  onClick={() => openDossier(arch)}
                  className="w-full py-1.5 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-700/50 text-xs font-bold text-violet-700 dark:text-cyan-300 flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                  <span>Strategy Dossier & Notes</span>
                  {Boolean(arch.userEvaluation?.notes || arch.userEvaluation?.roleInMetagame) && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-400/40 font-bold">
                      {arch.userEvaluation?.notes ? 'Has Notes' : 'Role Set'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          );
        };

        const renderTierList = (
          tierMap: Record<'S' | 'A' | 'B' | 'C' | 'D', ArchetypeStrength[]>,
          isOtherSection: boolean = false
        ) => {
          const activeTiers = (['S', 'A', 'B', 'C', 'D'] as const).filter((tier) => tierMap[tier].length > 0);

          if (activeTiers.length === 0) {
            return (
              <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                No color pairs in this tier list.
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {activeTiers.map((tier) => {
                const list = tierMap[tier];
                return (
                  <div key={tier} className="space-y-2.5">
                    <div
                      className={`px-4 py-1.5 rounded-xl border flex items-center justify-between text-xs font-bold font-mono tracking-wider ${getTierHeaderStyle(tier)}`}
                    >
                      <span>{isOtherSection ? `OFF-ARCHETYPE TIER ${tier}` : `YOUR PREDICTED TIER ${tier} ARCHETYPES`}</span>
                      <span>{list.length} Color Pairs</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {list.map((arch) => renderArchetypeCard(arch))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {/* Primary Section: Designed Set Archetypes */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Swords className="w-4 h-4 text-amber-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    {report.otherArchetypes.length > 0
                      ? `Designed Set Archetypes (${report.developedArchetypes.length} Color Pairs)`
                      : `10 Draft Archetypes Tier List`}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                    {report.otherArchetypes.length > 0 ? `Built for ${report.setCode}` : `All 10 Pairs Supported`}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {report.has17LandsData && !isBlindGrading ? 'Shaded by color identity • 17Lands win rates shown' : 'Synthesized from signpost gold + 2-color mono depth'}
                </span>
              </div>

              {renderTierList(report.developedTierList, false)}
            </div>

            {/* Secondary Section: Other Color Pairs (Off-Meta / Rogue / Splash) */}
            {report.otherArchetypes.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Layers className="w-4 h-4 text-slate-500" />
                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                        Other Color Pairs ({report.otherArchetypes.length} Pairs)
                      </h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        Off-Archetype / Splash
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Color combinations without dedicated signpost uncommons in {report.setName}.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowOtherArchetypes(!showOtherArchetypes)}
                    className="text-xs font-bold text-violet-600 dark:text-cyan-400 hover:text-violet-700 dark:hover:text-cyan-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090e24] cursor-pointer self-start sm:self-auto shadow-xs"
                  >
                    <span>{showOtherArchetypes ? 'Hide Other Color Pairs' : `Show ${report.otherArchetypes.length} Other Pairs`}</span>
                    {showOtherArchetypes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showOtherArchetypes && renderTierList(report.otherTierList, true)}
              </div>
            )}
          </div>
        );
      })()}

      {/* 6. Strategy Dossier & Detailed Notes Modal */}
      {activeDossierArchetype && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 dark:bg-[#030614]/85 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-[#090d20] border border-slate-200 dark:border-violet-500/35 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-[#050818] p-1.5 rounded-xl border border-slate-300 dark:border-slate-700">
                  {activeDossierArchetype.colors.map((c) => (
                    <ManaSymbol key={c} symbol={c} size="md" />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">
                      {activeDossierArchetype.name} Strategy Dossier
                    </h3>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-cyan-300 border border-violet-200 dark:border-violet-700/50">
                      {setCode}
                    </span>
                  </div>
                  <p className="text-xs text-violet-600 dark:text-cyan-400 font-semibold">
                    {activeDossierArchetype.headline || activeDossierArchetype.theme}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDossierArchetype(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#050818] dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* 1. Grade Strip & Metagame Role Picker */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500" />
                    <span>Assigned Grade & Tier</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-violet-700 dark:text-cyan-300">
                    {activeDossierArchetype.userEvaluation?.userGrade ? `Graded: ${activeDossierArchetype.userEvaluation.userGrade}` : 'Not yet graded'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {GRADE_TIERS.map((tier) => {
                    const isSelected = (activeDossierArchetype.userEvaluation?.userGrade || activeDossierArchetype.letterGrade) === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => {
                          handleRateArchetype(activeDossierArchetype, tier);
                          setActiveDossierArchetype((prev) => prev ? {
                            ...prev,
                            userEvaluation: {
                              ...(prev.userEvaluation || {
                                setCode,
                                archetypeCode: prev.code,
                                updatedAt: new Date().toISOString(),
                              }),
                              userGrade: tier,
                              userScore: GRADE_SCORES[tier] || 2.5,
                              tier: tier === 'A+' || tier === 'A' ? 'S' : tier === 'A-' || tier === 'B+' ? 'A' : tier === 'B' || tier === 'B-' ? 'B' : tier === 'C+' || tier === 'C' || tier === 'C-' ? 'C' : 'D',
                            }
                          } : null);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600 text-white shadow-md scale-105 ring-2 ring-violet-400 dark:ring-cyan-300'
                            : 'bg-white hover:bg-slate-100 dark:bg-[#090d20] dark:hover:bg-[#121b44] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {tier}
                      </button>
                    );
                  })}
                </div>

                {/* Metagame Role Picker */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Metagame Role
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['Premier Deck', 'Solid Contender', 'Synergy Dependent', 'Niche Buildaround', 'Trap / Underpowered'] as ArchetypeMetagameRole[]).map((role) => {
                      const isSelected = dossierRoleDraft === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setDossierRoleDraft(role)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer border flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
                              : 'bg-white hover:bg-slate-100 dark:bg-[#090d20] dark:hover:bg-[#121b44] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {role === 'Premier Deck' && <Crown className="w-3 h-3 text-amber-300 shrink-0" />}
                          {role === 'Solid Contender' && <Shield className="w-3 h-3 text-blue-300 shrink-0" />}
                          {role === 'Synergy Dependent' && <Zap className="w-3 h-3 text-cyan-300 shrink-0" />}
                          {role === 'Niche Buildaround' && <Target className="w-3 h-3 text-violet-300 shrink-0" />}
                          {role === 'Trap / Underpowered' && <AlertTriangle className="w-3 h-3 text-rose-300 shrink-0" />}
                          <span className="truncate">{role}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Official WOTC Strategy Description */}
              {activeDossierArchetype.description && (
                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Official WOTC Archetype Strategy</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed italic">
                    "{activeDossierArchetype.description}"
                  </p>
                  {activeDossierArchetype.mechanics && activeDossierArchetype.mechanics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activeDossierArchetype.mechanics.map((mech) => (
                        <span
                          key={mech}
                          className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-white dark:bg-[#090d20] text-slate-800 dark:text-slate-200 border border-amber-200 dark:border-amber-500/40 shadow-xs"
                        >
                          #{mech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Strategic Notes & Draft Game Plan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
                    <span>Your Draft Game Plan & Notes</span>
                  </label>
                  {dossierSaved && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Saved!
                    </span>
                  )}
                </div>
                <textarea
                  value={dossierNotesDraft}
                  onChange={(e) => setDossierNotesDraft(e.target.value)}
                  placeholder={`Jot down draft priorities, key commons, splash requirements, curve targets, or traps to avoid in ${activeDossierArchetype.name}...`}
                  className="w-full h-28 p-3 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-cyan-400 resize-none font-sans leading-relaxed"
                />
              </div>

              {/* 4. Signpost Uncommons & Rares */}
              {activeDossierArchetype.signposts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Gold Signpost Cards ({activeDossierArchetype.signposts.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDossierArchetype.signposts.map((sp) => (
                      <button
                        key={sp.card.id}
                        type="button"
                        onClick={() => onSelectCard?.(sp.card)}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#050818] dark:hover:bg-[#10193d] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/50 transition-colors cursor-pointer text-left group"
                      >
                        <div className="truncate mr-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-white block truncate group-hover:text-violet-600 dark:group-hover:text-cyan-300">{sp.card.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{sp.card.type_line}</span>
                        </div>
                        <span className="text-xs font-mono font-black text-violet-700 dark:text-cyan-300 px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950/80 border border-violet-200 dark:border-violet-800">
                          {sp.eval?.userGrade || 'Unrated'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Key Common Picks */}
              {activeDossierArchetype.keyPicks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Top Rated Core Commons & Uncommons ({activeDossierArchetype.keyPicks.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDossierArchetype.keyPicks.slice(0, 6).map((pick) => (
                      <button
                        key={pick.card.id}
                        type="button"
                        onClick={() => onSelectCard?.(pick.card)}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#050818] dark:hover:bg-[#10193d] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/50 transition-colors cursor-pointer text-left group"
                      >
                        <div className="truncate mr-2">
                          <span className="text-xs font-medium text-slate-800 dark:text-white block truncate group-hover:text-violet-600 dark:group-hover:text-cyan-300">{pick.card.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono capitalize">{pick.card.rarity}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                          {pick.eval.userGrade}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#060a1c] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveDossierArchetype(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveDossier}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                {dossierSaved ? <Check className="w-4 h-4 text-white" /> : <CheckCircle2 className="w-4 h-4 text-white" />}
                <span>{dossierSaved ? 'Saved to Dossier!' : 'Save Strategy Dossier'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Monocolor Notes Modal */}
      {activeColorNotesColor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 dark:bg-[#030614]/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#090d20] border border-slate-200 dark:border-violet-500/35 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ManaSymbol symbol={activeColorNotesColor.symbol} size="lg" />
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white font-heading">
                    {activeColorNotesColor.name} Strategy & Notes
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {activeColorNotesColor.ratedCards} / {activeColorNotesColor.totalCards} cards rated in {setCode}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveColorNotesColor(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#050818] dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="space-y-1.5">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Color Grade
                </span>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                  {GRADE_TIERS.map((tier) => {
                    const isSelected = (activeColorNotesColor.userEvaluation?.userGrade || activeColorNotesColor.letterGrade) === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => {
                          handleRateColor(activeColorNotesColor, tier);
                          setActiveColorNotesColor((prev) => prev ? {
                            ...prev,
                            userEvaluation: {
                              ...(prev.userEvaluation || {
                                setCode,
                                color: prev.color,
                                updatedAt: new Date().toISOString(),
                              }),
                              userGrade: tier,
                              userScore: GRADE_SCORES[tier] || 2.5,
                            }
                          } : null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600 text-white shadow-sm ring-2 ring-violet-400 dark:ring-cyan-300'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#050818] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {tier}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Notes & Draft Observations
                </label>
                <textarea
                  value={colorNotesDraft}
                  onChange={(e) => setColorNotesDraft(e.target.value)}
                  placeholder={`Notes on ${activeColorNotesColor.name} in ${setCode}: depth, key commons, splash viability, removal speed...`}
                  className="w-full h-32 p-3 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-cyan-400 resize-none font-sans"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#060a1c] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveColorNotesColor(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveColorNotes}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchetypeForecastView;
