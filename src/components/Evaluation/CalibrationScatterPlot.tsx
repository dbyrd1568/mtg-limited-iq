import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Card, GradeTier, UserCardEvaluation, SeventeenLandsSetData, SetInfo } from '../../types/mtg';
import {
  GRADE_TIERS,
  winRateToGradeTier,
  gradeTierToIndex,
  get17LandsCardRating,
  getOrEstimate17LandsCardRating,
  fetch17LandsSetData,
  getPreloaded17LandsData,
} from '../../services/seventeenLands';
import { fetchCardsForSet, POPULAR_LIMITED_SETS } from '../../services/scryfall';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetBadge } from '../UI/SetSymbol';
import {
  BarChart2,
  Filter,
  Download,
  Info,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Layers,
  Check,
  ChevronDown,
} from 'lucide-react';

// The visual grade spectrum exactly as shown on the reference chart axes:
// F, D-, D, D+, C-, C, C+, B-, B, B+, A-, A, A+
export const CHART_TIERS: string[] = [
  'F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'
];

export interface CalibrationScatterPoint {
  card: Card;
  cardName: string;
  collectorNumber: string;
  colors: string[];
  rarity: string;
  userGrade: GradeTier;
  userGradeIndex: number; // 0 to 12 along CHART_TIERS
  actualGrade: GradeTier;
  actualGradeIndex: number; // 0 to 12 along CHART_TIERS
  actualWinRate?: number;
  actualAlsa?: number;
  stepDelta: number; // actual - expected
  verdict: 'exact' | 'tolerance' | 'minor_trap' | 'major_trap' | 'minor_sleeper' | 'major_sleeper';
  // Plot coordinates with deterministic jitter
  plotX: number; // in chart unit space (0 to 12)
  plotY: number; // in chart unit space (0 to 12)
  dotColor: {
    fill: string;
    border: string;
    label: string;
    category: 'W' | 'U' | 'B' | 'R' | 'G' | 'MULTI' | 'COLORLESS';
  };
}

interface CalibrationScatterPlotProps {
  cards: Card[];
  currentSetCode: string;
  currentSetName: string;
  userEvaluations: Record<string, UserCardEvaluation>;
  seventeenLandsData?: SeventeenLandsSetData | null;
  onSelectCard?: (card: Card) => void;
  availableSets?: SetInfo[];
}

/**
 * Maps a standard GradeTier or sub-tier to its 0..12 index on CHART_TIERS
 */
export function tierToChartIndex(tier?: string | null): number {
  if (!tier) return 5; // default to 'C'
  const clean = tier.trim().toUpperCase();
  const idx = CHART_TIERS.indexOf(clean);
  if (idx !== -1) return idx;

  // Fallbacks for unusual values
  if (clean === 'D') return 2;
  if (clean === 'F') return 0;
  if (clean === 'A+') return 12;
  if (clean === 'A') return 11;
  if (clean === 'A-') return 10;
  if (clean === 'B+') return 9;
  if (clean === 'B') return 8;
  if (clean === 'B-') return 7;
  if (clean === 'C+') return 6;
  if (clean === 'C') return 5;
  if (clean === 'C-') return 4;
  return 5;
}

/**
 * Maps MTG Card Color to chart dot color matching reference diagram
 */
export function getCardDotColor(card: Card): {
  fill: string;
  border: string;
  label: string;
  category: 'W' | 'U' | 'B' | 'R' | 'G' | 'MULTI' | 'COLORLESS';
} {
  const colors = card.colors || [];
  if (colors.length === 0) {
    return {
      fill: '#94a3b8',
      border: '#334155',
      label: 'Colorless / Artifact',
      category: 'COLORLESS',
    };
  }
  if (colors.length > 1) {
    return {
      fill: '#d97706',
      border: '#78350f',
      label: 'Multicolor',
      category: 'MULTI',
    };
  }
  switch (colors[0]) {
    case 'W':
      return {
        fill: '#fef08a', // Cream/Pale Yellow as in reference image
        border: '#713f12',
        label: 'White',
        category: 'W',
      };
    case 'U':
      return {
        fill: '#2563eb', // Blue
        border: '#1e3a8a',
        label: 'Blue',
        category: 'U',
      };
    case 'B':
      return {
        fill: '#1e293b', // Black / Charcoal
        border: '#020617',
        label: 'Black',
        category: 'B',
      };
    case 'R':
      return {
        fill: '#dc2626', // Red
        border: '#7f1d1d',
        label: 'Red',
        category: 'R',
      };
    case 'G':
      return {
        fill: '#16a34a', // Green
        border: '#14532d',
        label: 'Green',
        category: 'G',
      };
    default:
      return {
        fill: '#94a3b8',
        border: '#334155',
        label: 'Colorless',
        category: 'COLORLESS',
      };
  }
}

/**
 * Generates deterministic jitter based on card ID and name
 * so cards with the same grade cluster organically without occluding each other
 */
export function getDeterministicJitter(id: string, name: string): { dx: number; dy: number } {
  let hash = 0;
  const str = `${id}_${name}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  // Deterministic values between -0.22 and +0.22
  const pseudo1 = Math.sin(hash * 1.618) * 0.22;
  const pseudo2 = Math.cos(hash * 2.718) * 0.22;
  return { dx: pseudo1, dy: pseudo2 };
}

export const CalibrationScatterPlot: React.FC<CalibrationScatterPlotProps> = ({
  cards: propCards,
  currentSetCode,
  currentSetName,
  userEvaluations,
  seventeenLandsData: propSeventeenLandsData,
  onSelectCard,
  availableSets = POPULAR_LIMITED_SETS,
}) => {
  // Selected set state (defaults to current set, can be switched by the user)
  const [selectedSetCode, setSelectedSetCode] = useState<string>(currentSetCode.toUpperCase());
  const [activeCards, setActiveCards] = useState<Card[]>(propCards);
  const [active17LData, setActive17LData] = useState<SeventeenLandsSetData | null>(propSeventeenLandsData || null);
  const [isLoadingSet, setIsLoadingSet] = useState<boolean>(false);

  // Filters & display options
  const [colorFilter, setColorFilter] = useState<string>('ALL');
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | 'EXACT' | 'TOLERANCE' | 'TRAPS' | 'SLEEPERS'>('ALL');
  const [hoveredPoint, setHoveredPoint] = useState<CalibrationScatterPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Sync when propSet changes
  useEffect(() => {
    setSelectedSetCode(currentSetCode.toUpperCase());
    setActiveCards(propCards);
    setActive17LData(propSeventeenLandsData || null);
  }, [currentSetCode, propCards, propSeventeenLandsData]);

  // Load other sets if selected via dropdown
  const handleSetChange = useCallback(async (newSetCode: string) => {
    setSelectedSetCode(newSetCode);
    setHoveredPoint(null);
    if (newSetCode.toUpperCase() === currentSetCode.toUpperCase()) {
      setActiveCards(propCards);
      setActive17LData(propSeventeenLandsData || null);
      return;
    }

    setIsLoadingSet(true);
    try {
      const [fetchedCards, landsData] = await Promise.all([
        fetchCardsForSet(newSetCode),
        fetch17LandsSetData(newSetCode),
      ]);
      setActiveCards(fetchedCards);
      setActive17LData(landsData || getPreloaded17LandsData(newSetCode));
    } catch (e) {
      console.error(`Failed to load data for set ${newSetCode}:`, e);
    } finally {
      setIsLoadingSet(false);
    }
  }, [currentSetCode, propCards, propSeventeenLandsData]);

  // List of all sets the user has rated cards for
  const userRatedSets = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(userEvaluations).forEach((ev) => {
      if (ev.setCode && ev.userGrade) {
        const code = ev.setCode.toUpperCase();
        counts[code] = (counts[code] || 0) + 1;
      }
    });
    return counts;
  }, [userEvaluations]);

  // Compute all scatter points for the active set
  const allPoints = useMemo<CalibrationScatterPoint[]>(() => {
    const points: CalibrationScatterPoint[] = [];

    activeCards.forEach((card) => {
      const evalKey = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
      const userEval = userEvaluations[evalKey];
      if (!userEval?.userGrade) return;

      const rating = get17LandsCardRating(card, active17LData) || getOrEstimate17LandsCardRating(card, active17LData);
      if (!rating) return;

      const actualGrade: GradeTier = (rating.tier_grade as GradeTier) || winRateToGradeTier(rating.win_rate || 0.53);
      const userGrade: GradeTier = userEval.userGrade;

      const uIdx = tierToChartIndex(userGrade);
      const aIdx = tierToChartIndex(actualGrade);

      // Delta in sub-tier steps
      const userStepIndex = gradeTierToIndex(userGrade);
      const actualStepIndex = gradeTierToIndex(actualGrade);
      const stepDelta = userStepIndex - actualStepIndex; // > 0 means User > 17Lands (Trap), < 0 means Sleeper

      let verdict: CalibrationScatterPoint['verdict'] = 'exact';
      if (stepDelta === 0) verdict = 'exact';
      else if (Math.abs(stepDelta) === 1) verdict = 'tolerance';
      else if (stepDelta === 2) verdict = 'minor_trap';
      else if (stepDelta >= 3) verdict = 'major_trap';
      else if (stepDelta === -2) verdict = 'minor_sleeper';
      else if (stepDelta <= -3) verdict = 'major_sleeper';

      const { dx, dy } = getDeterministicJitter(card.id, card.name);
      const dotColor = getCardDotColor(card);

      points.push({
        card,
        cardName: card.name,
        collectorNumber: card.collector_number,
        colors: card.colors || [],
        rarity: card.rarity,
        userGrade,
        userGradeIndex: uIdx,
        actualGrade,
        actualGradeIndex: aIdx,
        actualWinRate: rating.win_rate,
        actualAlsa: rating.avg_seen,
        stepDelta,
        verdict,
        plotX: Math.max(0, Math.min(12, uIdx + dx)),
        plotY: Math.max(0, Math.min(12, aIdx + dy)),
        dotColor,
      });
    });

    return points;
  }, [activeCards, active17LData, userEvaluations]);

  // Filter points based on color and discrepancy filters
  const filteredPoints = useMemo(() => {
    return allPoints.filter((pt) => {
      // Color Filter
      if (colorFilter !== 'ALL') {
        if (pt.dotColor.category !== colorFilter) return false;
      }
      // Discrepancy Filter
      if (discrepancyFilter === 'EXACT' && pt.verdict !== 'exact') return false;
      if (discrepancyFilter === 'TOLERANCE' && pt.verdict !== 'exact' && pt.verdict !== 'tolerance') return false;
      if (discrepancyFilter === 'TRAPS' && !pt.verdict.includes('trap')) return false;
      if (discrepancyFilter === 'SLEEPERS' && !pt.verdict.includes('sleeper')) return false;

      return true;
    });
  }, [allPoints, colorFilter, discrepancyFilter]);

  // Aggregate statistics for the current plotted set
  const stats = useMemo(() => {
    const total = allPoints.length;
    if (total === 0) {
      return {
        total: 0,
        exact: 0,
        tolerance: 0,
        accuracyPercent: 0,
        trapsCount: 0,
        sleepersCount: 0,
        correlation: 0,
      };
    }
    const exact = allPoints.filter((p) => p.verdict === 'exact').length;
    const tolerance = allPoints.filter((p) => p.verdict === 'exact' || p.verdict === 'tolerance').length;
    const trapsCount = allPoints.filter((p) => p.verdict.includes('trap')).length;
    const sleepersCount = allPoints.filter((p) => p.verdict.includes('sleeper')).length;

    // Pearson correlation r between userGradeIndex and actualGradeIndex
    const meanX = allPoints.reduce((acc, p) => acc + p.userGradeIndex, 0) / total;
    const meanY = allPoints.reduce((acc, p) => acc + p.actualGradeIndex, 0) / total;
    let num = 0;
    let denX = 0;
    let denY = 0;
    allPoints.forEach((p) => {
      const dx = p.userGradeIndex - meanX;
      const dy = p.actualGradeIndex - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    });
    const correlation = denX * denY > 0 ? num / Math.sqrt(denX * denY) : 0;

    return {
      total,
      exact,
      tolerance,
      accuracyPercent: Math.round((tolerance / total) * 100),
      trapsCount,
      sleepersCount,
      correlation: Math.max(-1, Math.min(1, correlation)),
    };
  }, [allPoints]);

  // SVG Chart Geometry Constants
  // Dimensions 720 x 720 viewBox matching the square reference aspect ratio
  const VIEW_SIZE = 720;
  const MARGIN_LEFT = 78;
  const MARGIN_RIGHT = 34;
  const MARGIN_TOP = 32;
  const MARGIN_BOTTOM = 72;

  const PLOT_WIDTH = VIEW_SIZE - MARGIN_LEFT - MARGIN_RIGHT; // 608
  const PLOT_HEIGHT = VIEW_SIZE - MARGIN_TOP - MARGIN_BOTTOM; // 616

  // Function to convert chart tier coordinates (0..12) into SVG pixels
  const toSvgX = useCallback(
    (tierCoord: number) => {
      return MARGIN_LEFT + (tierCoord / 12) * PLOT_WIDTH;
    },
    [MARGIN_LEFT, PLOT_WIDTH]
  );

  const toSvgY = useCallback(
    (tierCoord: number) => {
      // Y-axis is inverted in SVG: 12 (A+) is at TOP, 0 (F) is at BOTTOM
      return MARGIN_TOP + PLOT_HEIGHT - (tierCoord / 12) * PLOT_HEIGHT;
    },
    [MARGIN_TOP, PLOT_HEIGHT]
  );

  // SVG Polygon for Split Triangles
  const pTopLeft = `${MARGIN_LEFT},${MARGIN_TOP}`;
  const pTopRight = `${MARGIN_LEFT + PLOT_WIDTH},${MARGIN_TOP}`;
  const pBottomLeft = `${MARGIN_LEFT},${MARGIN_TOP + PLOT_HEIGHT}`;
  const pBottomRight = `${MARGIN_LEFT + PLOT_WIDTH},${MARGIN_TOP + PLOT_HEIGHT}`;

  // Sleepers Triangle: Top-Left (above diagonal line)
  const sleepersPolygon = `${pBottomLeft} ${pTopLeft} ${pTopRight}`;
  // Traps Triangle: Bottom-Right (below diagonal line)
  const trapsPolygon = `${pBottomLeft} ${pTopRight} ${pBottomRight}`;

  // Export SVG to PNG
  const handleExportPng = useCallback(() => {
    const svgEl = chartContainerRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const scale = 2; // high-res 2x
    canvas.width = VIEW_SIZE * scale;
    canvas.height = VIEW_SIZE * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `${selectedSetCode}_Grade_Calibration_Plot.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [VIEW_SIZE, selectedSetCode]);

  return (
    <div
      ref={chartContainerRef}
      className={`rounded-3xl bg-white dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 shadow-sm transition-all overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-3 z-[150] shadow-2xl max-w-none' : 'w-full'
      }`}
    >
      {/* Chart Top Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/70 dark:bg-[#050818]/80">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-violet-100 dark:bg-cyan-500/20 text-violet-700 dark:text-cyan-300">
              <BarChart2 className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Grade Calibration Scatter Plot
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700">
              Expected vs. Actual GIH WR
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visualizing evaluation accuracy against 17Lands empirical draft win rates. Points on the diagonal represent perfect calibration.
          </p>
        </div>

        {/* Set Chooser & Action Bar */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* By Set Selector */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#090e24] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">Set:</span>
            <select
              value={selectedSetCode}
              onChange={(e) => handleSetChange(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer pr-1"
            >
              <optgroup label="Sets You Have Graded">
                {Object.entries(userRatedSets).map(([code, count]) => {
                  const setInfo = availableSets.find((s) => s.code.toUpperCase() === code);
                  return (
                    <option key={code} value={code}>
                      {setInfo ? setInfo.name : code} ({count} rated)
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="Other Benchmark Sets">
                {availableSets
                  .filter((s) => !userRatedSets[s.code.toUpperCase()])
                  .map((s) => (
                    <option key={s.code} value={s.code.toUpperCase()}>
                      {s.name} ({s.code.toUpperCase()})
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Export PNG */}
          <button
            type="button"
            onClick={handleExportPng}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Download Graph as High-Res PNG"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="px-4 sm:px-6 py-2.5 bg-slate-100/60 dark:bg-[#050818]/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs font-mono">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div>
            <span className="text-slate-500 text-[11px]">Plotted: </span>
            <strong className="text-slate-900 dark:text-white font-bold">{filteredPoints.length}</strong>
            <span className="text-slate-400 text-[10px]"> / {allPoints.length} cards</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div>
            <span className="text-slate-500 text-[11px]">Accuracy (±1 Step): </span>
            <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.accuracyPercent}%</strong>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div>
            <span className="text-slate-500 text-[11px]">Exact Matches: </span>
            <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.exact}</strong>
          </div>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
          <div className="hidden sm:inline">
            <span className="text-slate-500 text-[11px]">Correlation (R): </span>
            <strong className="text-violet-600 dark:text-cyan-300 font-bold">{stats.correlation.toFixed(2)}</strong>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/60">
            {stats.sleepersCount} Sleepers
          </span>
          <span className="px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-800/60">
            {stats.trapsCount} Traps
          </span>
        </div>
      </div>

      {/* Main Interactive Plot Area */}
      <div className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden bg-slate-50/30 dark:bg-[#030612]/30">
        {isLoadingSet ? (
          <div className="py-24 text-center space-y-2">
            <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">Loading {selectedSetCode} data...</p>
          </div>
        ) : allPoints.length === 0 ? (
          <div className="py-20 text-center max-w-md space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 flex items-center justify-center mx-auto">
              <BarChart2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              No rated cards found for {selectedSetCode}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Rate cards in {selectedSetCode} under the <strong>Grade</strong> tab, or pick another set with completed evaluations from the dropdown up top!
            </p>
          </div>
        ) : (
          <div className="w-full max-w-[720px] aspect-square relative select-none">
            {/* The SVG Canvas */}
            <svg
              viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
              className="w-full h-full drop-shadow-sm font-sans"
            >
              <defs>
                {/* Subtle drop shadow for points */}
                <filter id="pointShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* 1. Background Shading: Top-Left (Sleepers) & Bottom-Right (Traps) */}
              {/* Light Green / Mint for Sleepers (where Actual > Expected) */}
              <polygon
                points={sleepersPolygon}
                className="fill-[#e8f5f0] dark:fill-emerald-950/20 transition-colors"
              />
              {/* Light Pink / Rose for Traps (where Actual < Expected) */}
              <polygon
                points={trapsPolygon}
                className="fill-[#fcf0f0] dark:fill-rose-950/20 transition-colors"
              />

              {/* Quadrant Soft Watermark Labels */}
              <text
                x={MARGIN_LEFT + 14}
                y={MARGIN_TOP + 28}
                className="text-[12px] font-bold font-mono fill-emerald-800/40 dark:fill-emerald-400/30 uppercase tracking-wider"
              >
                ▲ SLEEPERS (Underrated by You)
              </text>
              <text
                x={MARGIN_LEFT + PLOT_WIDTH - 14}
                y={MARGIN_TOP + PLOT_HEIGHT - 14}
                textAnchor="end"
                className="text-[12px] font-bold font-mono fill-rose-800/40 dark:fill-rose-400/30 uppercase tracking-wider"
              >
                ▼ TRAPS (Overrated by You)
              </text>

              {/* 2. Grid Lines for Every Tier (F to A+) */}
              {CHART_TIERS.map((tier, idx) => {
                const x = toSvgX(idx);
                const y = toSvgY(idx);
                return (
                  <g key={`grid_${tier}_${idx}`}>
                    {/* Vertical grid line */}
                    <line
                      x1={x}
                      y1={MARGIN_TOP}
                      x2={x}
                      y2={MARGIN_TOP + PLOT_HEIGHT}
                      stroke="#dbe3ea"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                      className="dark:stroke-slate-800/80"
                    />
                    {/* Horizontal grid line */}
                    <line
                      x1={MARGIN_LEFT}
                      y1={y}
                      x2={MARGIN_LEFT + PLOT_WIDTH}
                      y2={y}
                      stroke="#dbe3ea"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                      className="dark:stroke-slate-800/80"
                    />
                  </g>
                );
              })}

              {/* 3. Diagonal Reference Calibration Line (y = x) */}
              <line
                x1={MARGIN_LEFT}
                y1={MARGIN_TOP + PLOT_HEIGHT}
                x2={MARGIN_LEFT + PLOT_WIDTH}
                y2={MARGIN_TOP}
                stroke="#334155"
                strokeDasharray="5 4"
                strokeWidth="1.75"
                className="dark:stroke-slate-400"
              />

              {/* 4. Outer Chart Border Frame */}
              <rect
                x={MARGIN_LEFT}
                y={MARGIN_TOP}
                width={PLOT_WIDTH}
                height={PLOT_HEIGHT}
                fill="none"
                stroke="#334155"
                strokeWidth="1.75"
                className="dark:stroke-slate-600"
              />

              {/* 5. Axis Labels & Ticks */}
              {/* X-Axis Ticks & Labels (Bottom) */}
              {CHART_TIERS.map((tier, idx) => {
                const x = toSvgX(idx);
                return (
                  <g key={`x_label_${tier}`}>
                    <line
                      x1={x}
                      y1={MARGIN_TOP + PLOT_HEIGHT}
                      x2={x}
                      y2={MARGIN_TOP + PLOT_HEIGHT + 6}
                      stroke="#334155"
                      strokeWidth="1.5"
                      className="dark:stroke-slate-400"
                    />
                    <text
                      x={x}
                      y={MARGIN_TOP + PLOT_HEIGHT + 20}
                      textAnchor="middle"
                      className="text-[11px] font-mono font-bold fill-slate-700 dark:fill-slate-300"
                    >
                      {tier}
                    </text>
                  </g>
                );
              })}

              {/* X-Axis Title */}
              <text
                x={MARGIN_LEFT + PLOT_WIDTH / 2}
                y={VIEW_SIZE - 12}
                textAnchor="middle"
                className="text-[14px] font-serif font-bold fill-slate-900 dark:fill-white tracking-wide"
              >
                Expected Game in Hand Win Rate
              </text>

              {/* Y-Axis Ticks & Labels (Left) */}
              {CHART_TIERS.map((tier, idx) => {
                const y = toSvgY(idx);
                return (
                  <g key={`y_label_${tier}`}>
                    <line
                      x1={MARGIN_LEFT - 6}
                      y1={y}
                      x2={MARGIN_LEFT}
                      y2={y}
                      stroke="#334155"
                      strokeWidth="1.5"
                      className="dark:stroke-slate-400"
                    />
                    <text
                      x={MARGIN_LEFT - 12}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[11px] font-mono font-bold fill-slate-700 dark:fill-slate-300"
                    >
                      {tier}
                    </text>
                  </g>
                );
              })}

              {/* Y-Axis Title (Rotated) */}
              <text
                x={-(MARGIN_TOP + PLOT_HEIGHT / 2)}
                y={22}
                transform="rotate(-90)"
                textAnchor="middle"
                className="text-[14px] font-serif font-bold fill-slate-900 dark:fill-white tracking-wide"
              >
                Actual Game in Hand Win Rate
              </text>

              {/* 6. Plotted Scatter Points */}
              {filteredPoints.map((pt) => {
                const cx = toSvgX(pt.plotX);
                const cy = toSvgY(pt.plotY);
                const isHovered = hoveredPoint?.card.id === pt.card.id;

                return (
                  <g
                    key={`${pt.card.id}_${pt.card.name}`}
                    className="cursor-pointer transition-transform duration-150"
                    onMouseEnter={(e) => {
                      setHoveredPoint(pt);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const parent = chartContainerRef.current?.getBoundingClientRect();
                      if (parent) {
                        setTooltipPos({
                          x: rect.left - parent.left + rect.width / 2,
                          y: rect.top - parent.top - 10,
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => onSelectCard && onSelectCard(pt.card)}
                  >
                    {/* Outer glow ring on hover */}
                    {isHovered && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={12}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="3"
                        className="animate-pulse dark:stroke-cyan-400"
                      />
                    )}

                    {/* Dot Circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 8 : 6.5}
                      fill={pt.dotColor.fill}
                      stroke="#0f172a"
                      strokeWidth={isHovered ? 2.5 : 1.75}
                      filter="url(#pointShadow)"
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Floating Tooltip */}
            {hoveredPoint && tooltipPos && (
              <div
                style={{
                  left: `${tooltipPos.x}px`,
                  top: `${tooltipPos.y}px`,
                  transform: 'translate(-50%, -100%)',
                }}
                className="absolute z-20 pointer-events-none p-3 rounded-2xl bg-slate-900/95 dark:bg-[#090e24]/95 text-white shadow-xl border border-slate-700/80 dark:border-cyan-500/50 backdrop-blur-md min-w-[220px] max-w-[280px] space-y-1.5 animate-in fade-in zoom-in-95 duration-150 font-sans"
              >
                <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-700/60">
                  <div>
                    <h5 className="text-xs font-bold truncate">{hoveredPoint.cardName}</h5>
                    <span className="text-[10px] font-mono text-slate-400">
                      #{hoveredPoint.collectorNumber} • {hoveredPoint.rarity}
                    </span>
                  </div>
                  {hoveredPoint.card.mana_cost && (
                    <ManaCostRenderer manaCost={hoveredPoint.card.mana_cost} size="xs" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-0.5">
                  <div className="p-1.5 rounded-lg bg-slate-800/80">
                    <span className="text-[9px] uppercase block text-slate-400">Expected</span>
                    <strong className="text-violet-300 font-black">Tier {hoveredPoint.userGrade}</strong>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-800/80">
                    <span className="text-[9px] uppercase block text-slate-400">Actual (17L)</span>
                    <strong className="text-emerald-400 font-black">
                      Tier {hoveredPoint.actualGrade}
                    </strong>
                    {hoveredPoint.actualWinRate && (
                      <span className="text-[10px] block text-emerald-300">
                        {(hoveredPoint.actualWinRate * 100).toFixed(1)}% WR
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-1 text-[10px] font-mono font-bold flex items-center justify-between">
                  {hoveredPoint.stepDelta === 0 ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Exact Bullseye Match
                    </span>
                  ) : Math.abs(hoveredPoint.stepDelta) === 1 ? (
                    <span className="text-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      ±1 Step (Within Tolerance)
                    </span>
                  ) : hoveredPoint.stepDelta > 0 ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      +{hoveredPoint.stepDelta} Steps Over (Trap)
                    </span>
                  ) : (
                    <span className="text-sky-300 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {hoveredPoint.stepDelta} Steps Under (Sleeper)
                    </span>
                  )}
                  <span className="text-cyan-300 text-[9px] font-mono flex items-center gap-0.5">Inspect & 17Lands ↗</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Legend & Color Toggles */}
      <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050818] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Color Legend & Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>

          {[
            { id: 'ALL', label: 'All Colors', color: '#94a3b8' },
            { id: 'W', label: 'White', color: '#fef08a' },
            { id: 'U', label: 'Blue', color: '#2563eb' },
            { id: 'B', label: 'Black', color: '#1e293b' },
            { id: 'R', label: 'Red', color: '#dc2626' },
            { id: 'G', label: 'Green', color: '#16a34a' },
            { id: 'MULTI', label: 'Multi', color: '#d97706' },
            { id: 'COLORLESS', label: 'Colorless', color: '#94a3b8' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setColorFilter(item.id)}
              className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                colorFilter === item.id
                  ? 'bg-violet-600 text-white border-violet-500 shadow-2xs'
                  : 'bg-white dark:bg-[#090e24] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
            >
              {item.id !== 'ALL' && (
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-800 shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Verdict Quick Filters */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setDiscrepancyFilter('ALL')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              discrepancyFilter === 'ALL'
                ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Plotted
          </button>
          <button
            type="button"
            onClick={() => setDiscrepancyFilter('EXACT')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              discrepancyFilter === 'EXACT'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            🎯 Exact Only
          </button>
          <button
            type="button"
            onClick={() => setDiscrepancyFilter('TRAPS')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              discrepancyFilter === 'TRAPS'
                ? 'bg-rose-600 text-white font-bold'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            ⚠️ Traps
          </button>
          <button
            type="button"
            onClick={() => setDiscrepancyFilter('SLEEPERS')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              discrepancyFilter === 'SLEEPERS'
                ? 'bg-sky-600 text-white font-bold'
                : 'text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40'
            }`}
          >
            🧊 Sleepers
          </button>
        </div>
      </div>
    </div>
  );
};
