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
import { fetchCardsForSet, POPULAR_LIMITED_SETS, deduplicateCards } from '../../services/scryfall';
import { getCalibrationPlotPanelPosition, saveCalibrationPlotPanelPosition } from '../../services/storage';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { CardImage } from '../UI/CardImage';
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
  SlidersHorizontal,
  Target,
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
  userId?: string;
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

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  correlation: number; // Pearson r (-1 to +1)
  rSquared: number; // RSQ (0 to 1)
  biasDiagnosis: string;
  interceptGrade: string; // Letter grade equivalent at x = F (x = 0)
  cTierGrade: string;     // Projected actual grade at x = C (quintessential common)
  aTierGrade: string;     // Projected actual grade at x = A (bomb rare)
}

/**
 * Translates a numeric tier coordinate (0..12) into a human-readable letter grade.
 * Each 1.0 unit represents exactly one sub-tier step along the chart axis (F, D-, D, D+, C-, C, C+, B-, B, B+, A-, A, A+).
 */
export function formatGradeEquivalent(val: number): string {
  if (val < -0.3) {
    return `< F (${val.toFixed(1)} steps)`;
  }
  if (val > 12.3) {
    return `> A+ (+${(val - 12).toFixed(1)} steps)`;
  }
  const rounded = Math.max(0, Math.min(12, Math.round(val)));
  const baseTier = CHART_TIERS[rounded] || 'C';
  const delta = val - rounded;
  if (Math.abs(delta) < 0.2) {
    return baseTier;
  }
  return `${baseTier} (${delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)})`;
}

/**
 * Calculates Ordinary Least Squares (OLS) Linear Regression:
 * y = slope * x + intercept, with Pearson r and Coefficient of Determination (RSQ / R^2).
 */
export function calculateLinearRegression(points: { x: number; y: number }[]): LinearRegressionResult {
  const total = points.length;
  if (total < 2) {
    return {
      slope: 1,
      intercept: 0,
      correlation: 0,
      rSquared: 0,
      biasDiagnosis: 'Insufficient data for regression',
      interceptGrade: 'F',
      cTierGrade: 'C',
      aTierGrade: 'A',
    };
  }

  const meanX = points.reduce((acc, p) => acc + p.x, 0) / total;
  const meanY = points.reduce((acc, p) => acc + p.y, 0) / total;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const correlation = denX * denY > 0 ? num / Math.sqrt(denX * denY) : 0;
  const clampedCorr = Math.max(-1, Math.min(1, correlation));
  const rSquared = clampedCorr * clampedCorr;
  const slope = denX > 0 ? num / denX : 1;
  const intercept = meanY - slope * meanX;

  let biasDiagnosis = 'Balanced calibration (1:1 grade alignment)';
  if (total >= 5) {
    if (slope < 0.75) {
      biasDiagnosis = 'Compressed spread (underrates bombs, overrates filler)';
    } else if (slope > 1.25) {
      biasDiagnosis = 'Polarized spread (steep over-separation between tiers)';
    } else if (intercept > 0.8) {
      biasDiagnosis = 'Format pessimist (cards out-perform expectations)';
    } else if (intercept < -0.8) {
      biasDiagnosis = 'Format optimist (cards under-perform expectations)';
    }
  }

  return {
    slope,
    intercept,
    correlation: clampedCorr,
    rSquared,
    biasDiagnosis,
    interceptGrade: formatGradeEquivalent(intercept),
    cTierGrade: formatGradeEquivalent(slope * 5 + intercept), // x = 5 is 'C'
    aTierGrade: formatGradeEquivalent(slope * 11 + intercept), // x = 11 is 'A'
  };
}

/**
 * Calculates the [x1, y1] to [x2, y2] segment for the linear regression line,
 * clipped to the chart's [0, maxCoord] tier space.
 */
export function getTrendlineSegment(
  slope: number,
  intercept: number,
  maxCoord = 12
): { x1: number; y1: number; x2: number; y2: number } {
  const points: { x: number; y: number }[] = [];

  // Check left boundary (x = 0)
  const yAt0 = intercept;
  if (yAt0 >= 0 && yAt0 <= maxCoord) points.push({ x: 0, y: yAt0 });

  // Check right boundary (x = maxCoord)
  const yAtMax = slope * maxCoord + intercept;
  if (yAtMax >= 0 && yAtMax <= maxCoord) points.push({ x: maxCoord, y: yAtMax });

  // Check bottom boundary (y = 0)
  if (Math.abs(slope) > 0.00001) {
    const xAt0 = (0 - intercept) / slope;
    if (xAt0 > 0 && xAt0 < maxCoord) points.push({ x: xAt0, y: 0 });

    // Check top boundary (y = maxCoord)
    const xAtMax = (maxCoord - intercept) / slope;
    if (xAtMax > 0 && xAtMax < maxCoord) points.push({ x: xAtMax, y: maxCoord });
  }

  if (points.length < 2) {
    return {
      x1: 0,
      y1: Math.max(0, Math.min(maxCoord, intercept)),
      x2: maxCoord,
      y2: Math.max(0, Math.min(maxCoord, slope * maxCoord + intercept)),
    };
  }

  points.sort((a, b) => a.x - b.x);
  return {
    x1: points[0].x,
    y1: points[0].y,
    x2: points[points.length - 1].x,
    y2: points[points.length - 1].y,
  };
}

export const CalibrationScatterPlot: React.FC<CalibrationScatterPlotProps> = ({
  cards: propCards,
  currentSetCode,
  currentSetName,
  userEvaluations,
  seventeenLandsData: propSeventeenLandsData,
  onSelectCard,
  availableSets = POPULAR_LIMITED_SETS,
  userId,
}) => {
  // Selected set state (defaults to current set, can be switched by the user)
  const [selectedSetCode, setSelectedSetCode] = useState<string>(currentSetCode.toUpperCase());
  const [activeCards, setActiveCards] = useState<Card[]>(propCards);
  const [active17LData, setActive17LData] = useState<SeventeenLandsSetData | null>(propSeventeenLandsData || null);
  const [isLoadingSet, setIsLoadingSet] = useState<boolean>(false);

  // Filters & display options
  const [rarityFilter, setRarityFilter] = useState<'ALL' | 'common' | 'uncommon' | 'rare' | 'mythic'>('ALL');
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | 'EXACT' | 'TOLERANCE' | 'TRAPS' | 'SLEEPERS'>('ALL');
  const [hoveredPoint, setHoveredPoint] = useState<CalibrationScatterPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; placement: 'top' | 'bottom' } | null>(null);
  const [hoveredIntercept, setHoveredIntercept] = useState<boolean>(false);
  const [hoveredTrendline, setHoveredTrendline] = useState<boolean>(false);
  const [activeInfoPopup, setActiveInfoPopup] = useState<'intercept' | 'rsq' | null>(null);
  const [showTrendline, setShowTrendline] = useState<boolean>(true);
  const [panelPosition, setPanelPosition] = useState<'right' | 'left'>(() => getCalibrationPlotPanelPosition(userId));
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const plotAreaRef = useRef<HTMLDivElement>(null);

  // Sync panel position preference when active user switches
  useEffect(() => {
    setPanelPosition(getCalibrationPlotPanelPosition(userId));
  }, [userId]);

  // Persist panel docking position per user
  const handleTogglePanelPosition = useCallback(() => {
    setPanelPosition((prev) => {
      const next = prev === 'right' ? 'left' : 'right';
      saveCalibrationPlotPanelPosition(next, userId);
      return next;
    });
  }, [userId]);

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
      setActiveCards(deduplicateCards(propCards));
      setActive17LData(propSeventeenLandsData || null);
      return;
    }

    setIsLoadingSet(true);
    try {
      const [fetchedCards, landsData] = await Promise.all([
        fetchCardsForSet(newSetCode),
        fetch17LandsSetData(newSetCode),
      ]);
      setActiveCards(deduplicateCards(fetchedCards));
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
      if (!userEval?.userGrade || userEval.userGrade === 'N/A') return;

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

  // Rarity count breakdown for current plotted set
  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      mythic: 0,
    };
    allPoints.forEach((p) => {
      const r = (p.rarity || '').toLowerCase();
      if (r in counts) {
        counts[r]++;
      }
    });
    return counts;
  }, [allPoints]);

  // Filter points based on rarity and discrepancy filters
  const filteredPoints = useMemo(() => {
    return allPoints.filter((pt) => {
      // Rarity Filter
      if (rarityFilter !== 'ALL') {
        if ((pt.rarity || '').toLowerCase() !== rarityFilter) return false;
      }
      // Discrepancy Filter
      if (discrepancyFilter === 'EXACT' && pt.verdict !== 'exact') return false;
      if (discrepancyFilter === 'TOLERANCE' && pt.verdict !== 'exact' && pt.verdict !== 'tolerance') return false;
      if (discrepancyFilter === 'TRAPS' && !pt.verdict.includes('trap')) return false;
      if (discrepancyFilter === 'SLEEPERS' && !pt.verdict.includes('sleeper')) return false;

      return true;
    });
  }, [allPoints, rarityFilter, discrepancyFilter]);

  // Aggregate statistics & OLS linear regression for the current plotted set
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
        rSquared: 0,
        slope: 1,
        intercept: 0,
        biasDiagnosis: 'No rated cards plotted yet',
        interceptGrade: 'F',
        cTierGrade: 'C',
        aTierGrade: 'A',
      };
    }
    const exact = allPoints.filter((p) => p.verdict === 'exact').length;
    const tolerance = allPoints.filter((p) => p.verdict === 'exact' || p.verdict === 'tolerance').length;
    const trapsCount = allPoints.filter((p) => p.verdict.includes('trap')).length;
    const sleepersCount = allPoints.filter((p) => p.verdict.includes('sleeper')).length;

    const regression = calculateLinearRegression(
      allPoints.map((p) => ({ x: p.userGradeIndex, y: p.actualGradeIndex }))
    );

    return {
      total,
      exact,
      tolerance,
      accuracyPercent: Math.round((tolerance / total) * 100),
      trapsCount,
      sleepersCount,
      correlation: regression.correlation,
      rSquared: regression.rSquared,
      slope: regression.slope,
      intercept: regression.intercept,
      biasDiagnosis: regression.biasDiagnosis,
      interceptGrade: regression.interceptGrade,
      cTierGrade: regression.cTierGrade,
      aTierGrade: regression.aTierGrade,
    };
  }, [allPoints]);

  // Coordinates for rendering the OLS linear regression best-fit trendline on the SVG
  const trendline = useMemo(() => {
    return getTrendlineSegment(stats.slope, stats.intercept, 12);
  }, [stats.slope, stats.intercept]);

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
          <div className="hidden sm:inline" title={`Pearson Correlation Coefficient r = ${stats.correlation.toFixed(3)}`}>
            <span className="text-slate-500 text-[11px]">Correlation (R): </span>
            <strong className="text-violet-600 dark:text-cyan-300 font-bold">{stats.correlation.toFixed(2)}</strong>
          </div>
          <span className="text-slate-300 dark:text-slate-700 hidden md:inline">|</span>
          <div className="hidden md:inline cursor-help" title={`Coefficient of Determination (RSQ / R² = ${stats.rSquared.toFixed(3)}): ${(stats.rSquared * 100).toFixed(1)}% of actual 17Lands win rate variance is explained by your evaluations`}>
            <span className="text-slate-500 text-[11px]">RSQ (R²): </span>
            <strong className="text-cyan-600 dark:text-cyan-300 font-bold">{(stats.rSquared * 100).toFixed(1)}%</strong>
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

      {/* Main Interactive Plot Area with Side-by-Side Controls */}
      <div className={`flex-1 p-3 sm:p-5 lg:p-6 flex flex-col ${panelPosition === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center lg:items-start justify-center gap-6 relative bg-slate-50/30 dark:bg-[#030612]/30`}>
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
          <>
            <div ref={plotAreaRef} className="w-full max-w-[660px] 2xl:max-w-[700px] aspect-square relative select-none shrink-0">
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

              {/* 3.1 Empirical OLS Linear Regression Best-Fit Line (RSQ Trendline) */}
              {showTrendline && stats.total >= 2 && (
                <g
                  id="ols-trendline-group"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredTrendline(true)}
                  onMouseLeave={() => setHoveredTrendline(false)}
                >
                  {/* Generous invisible stroke to make hovering the line effortless */}
                  <line
                    x1={toSvgX(trendline.x1)}
                    y1={toSvgY(trendline.y1)}
                    x2={toSvgX(trendline.x2)}
                    y2={toSvgY(trendline.y2)}
                    stroke="white"
                    strokeOpacity="0"
                    pointerEvents="stroke"
                    strokeWidth="28"
                    strokeLinecap="round"
                  />
                  {/* Subtle Glow */}
                  <line
                    x1={toSvgX(trendline.x1)}
                    y1={toSvgY(trendline.y1)}
                    x2={toSvgX(trendline.x2)}
                    y2={toSvgY(trendline.y2)}
                    stroke="#06b6d4"
                    strokeWidth={hoveredTrendline ? '10' : '6'}
                    strokeOpacity={hoveredTrendline ? '0.45' : '0.25'}
                    strokeLinecap="round"
                    className="transition-all duration-150"
                  />
                  {/* Main Trendline */}
                  <line
                    x1={toSvgX(trendline.x1)}
                    y1={toSvgY(trendline.y1)}
                    x2={toSvgX(trendline.x2)}
                    y2={toSvgY(trendline.y2)}
                    stroke="#06b6d4"
                    strokeWidth={hoveredTrendline ? '4' : '2.75'}
                    strokeLinecap="round"
                    className="dark:stroke-cyan-400 transition-all duration-150"
                  />
                </g>
              )}

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

              {/* 5.1 Y-Intercept Indicator Pin on Y-Axis (Marks where trendline strikes x = 'F') */}
              {showTrendline && stats.total >= 2 && (
                <g
                  id="intercept-pin"
                  className="cursor-pointer drop-shadow-md select-none pointer-events-auto"
                  onMouseEnter={() => setHoveredIntercept(true)}
                  onMouseLeave={() => setHoveredIntercept(false)}
                  onClick={() => setHoveredIntercept((prev) => !prev)}
                >
                  {/* Generous invisible hit box covering both badge and axis pin so hovering is effortless */}
                  <rect
                    x={MARGIN_LEFT - 52}
                    y={toSvgY(Math.max(0, Math.min(12, stats.intercept))) - 22}
                    width={74}
                    height={44}
                    fill="white"
                    opacity="0"
                    pointerEvents="all"
                  />
                  {/* Glowing cross-tick on the axis */}
                  <line
                    x1={MARGIN_LEFT - 10}
                    y1={toSvgY(Math.max(0, Math.min(12, stats.intercept)))}
                    x2={MARGIN_LEFT + 8}
                    y2={toSvgY(Math.max(0, Math.min(12, stats.intercept)))}
                    stroke="#06b6d4"
                    strokeWidth={hoveredIntercept ? '4' : '2.5'}
                    strokeLinecap="round"
                    className="dark:stroke-cyan-400 transition-all"
                  />
                  {/* Axis Marker Circle */}
                  <circle
                    cx={MARGIN_LEFT}
                    cy={toSvgY(Math.max(0, Math.min(12, stats.intercept)))}
                    r={hoveredIntercept ? 6.5 : 4}
                    fill="#06b6d4"
                    className="dark:fill-cyan-400 transition-all"
                  />
                  {/* Visual outer glow ring when hovered (stationary, pulses opacity only) */}
                  {hoveredIntercept && (
                    <circle
                      cx={MARGIN_LEFT}
                      cy={toSvgY(Math.max(0, Math.min(12, stats.intercept)))}
                      r={11}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      strokeOpacity="0.8"
                      className="animate-pulse"
                    />
                  )}
                  {/* Micro badge pin on left of axis */}
                  <rect
                    x={MARGIN_LEFT - 46}
                    y={toSvgY(Math.max(0, Math.min(12, stats.intercept))) - 9}
                    width="34"
                    height="18"
                    rx="4"
                    fill={hoveredIntercept ? '#0891b2' : '#083344'}
                    stroke="#06b6d4"
                    strokeWidth="1"
                    className="transition-colors"
                  />
                  <text
                    x={MARGIN_LEFT - 29}
                    y={toSvgY(Math.max(0, Math.min(12, stats.intercept))) + 3.5}
                    textAnchor="middle"
                    className="text-[9px] font-mono font-black fill-cyan-200 pointer-events-none"
                  >
                    b={stats.intercept >= 0 ? `+${stats.intercept.toFixed(1)}` : stats.intercept.toFixed(1)}
                  </text>
                </g>
              )}

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
                      const parent = plotAreaRef.current?.getBoundingClientRect();
                      if (parent) {
                        const pointX = rect.left - parent.left + rect.width / 2;
                        const pointY = rect.top - parent.top + rect.height / 2;
                        const placement: 'top' | 'bottom' = pointY < 185 ? 'bottom' : 'top';
                        const clampedX = Math.max(185, Math.min(parent.width - 185, pointX));
                        const targetY = placement === 'top' ? pointY - 14 : pointY + 14;

                        setTooltipPos({
                          x: clampedX,
                          y: targetY,
                          placement,
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

            {/* Floating Tooltip with Card Image Preview */}
            {hoveredPoint && tooltipPos && (
              <div
                style={{
                  left: `${tooltipPos.x}px`,
                  top: `${tooltipPos.y}px`,
                  transform: tooltipPos.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0%)',
                }}
                className="absolute z-50 pointer-events-none p-3 rounded-2xl bg-slate-900/95 dark:bg-[#090e24]/95 text-white shadow-2xl border border-slate-700/80 dark:border-cyan-500/50 backdrop-blur-md w-[360px] max-w-[94vw] animate-in fade-in zoom-in-95 duration-150 font-sans"
              >
                <div className="flex gap-3 items-center">
                  {/* Card Art Thumbnail */}
                  <div className="w-[96px] aspect-[63/88] rounded-xl overflow-hidden shadow-lg border border-slate-700/80 shrink-0 bg-slate-950">
                    <CardImage card={hoveredPoint.card} alt={hoveredPoint.cardName} />
                  </div>

                  {/* Card Metadata & Calibration Stats */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-1 pb-1 border-b border-slate-700/60">
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold truncate">{hoveredPoint.cardName}</h5>
                        <span className="text-[10px] font-mono text-slate-400 capitalize">
                          #{hoveredPoint.collectorNumber} • {hoveredPoint.rarity}
                        </span>
                      </div>
                      {hoveredPoint.card.mana_cost && (
                        <div className="shrink-0 pt-0.5">
                          <ManaCostRenderer manaCost={hoveredPoint.card.mana_cost} size="xs" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                      <div className="p-1.5 rounded-lg bg-slate-800/80">
                        <span className="text-[9px] uppercase block text-slate-400">Expected</span>
                        <strong className="text-violet-300 font-black text-xs">Tier {hoveredPoint.userGrade}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-800/80">
                        <span className="text-[9px] uppercase block text-slate-400">Actual (17L)</span>
                        <strong className="text-emerald-400 font-black text-xs">
                          Tier {hoveredPoint.actualGrade}
                        </strong>
                        {hoveredPoint.actualWinRate && (
                          <span className="text-[10px] block text-emerald-300">
                            {(hoveredPoint.actualWinRate * 100).toFixed(1)}% WR
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-0.5 text-[10px] font-mono font-bold flex items-center justify-between gap-1 flex-wrap">
                      {hoveredPoint.stepDelta === 0 ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Exact Match</span>
                        </span>
                      ) : Math.abs(hoveredPoint.stepDelta) === 1 ? (
                        <span className="text-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3 shrink-0" />
                          <span>±1 Step</span>
                        </span>
                      ) : hoveredPoint.stepDelta > 0 ? (
                        <span className="text-rose-400 flex items-center gap-1 truncate">
                          <TrendingDown className="w-3 h-3 shrink-0" />
                          <span className="truncate">+{hoveredPoint.stepDelta} (Trap)</span>
                        </span>
                      ) : (
                        <span className="text-sky-300 flex items-center gap-1 truncate">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span className="truncate">{hoveredPoint.stepDelta} (Sleeper)</span>
                        </span>
                      )}
                      <span className="text-cyan-300 text-[9px] font-mono flex items-center gap-0.5 shrink-0">Inspect ↗</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Floating Y-Intercept Popover */}
            {hoveredIntercept && (
              <div
                style={{
                  left: `clamp(12px, calc(${(MARGIN_LEFT / VIEW_SIZE) * 100}% + 20px), calc(100% - 310px))`,
                  top: `${(toSvgY(Math.max(0, Math.min(12, stats.intercept))) / VIEW_SIZE) * 100}%`,
                  transform:
                    toSvgY(Math.max(0, Math.min(12, stats.intercept))) / VIEW_SIZE > 0.65
                      ? 'translateY(-80%)'
                      : toSvgY(Math.max(0, Math.min(12, stats.intercept))) / VIEW_SIZE < 0.35
                      ? 'translateY(-20%)'
                      : 'translateY(-50%)',
                }}
                className="absolute z-40 pointer-events-none p-3.5 rounded-2xl bg-slate-900/95 dark:bg-[#070b1e]/95 text-white shadow-2xl border border-cyan-500/80 dark:border-cyan-400 backdrop-blur-md w-[295px] space-y-2.5 animate-in fade-in zoom-in-95 duration-100 font-sans"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/30">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <h5 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">Y-Axis Intercept</h5>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-500/40">
                    x = 0 (Tier F)
                  </span>
                </div>

                <div className="bg-slate-800/80 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-700/50 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">Numeric Intercept:</span>
                    <strong className="text-sm font-mono font-black text-cyan-300">
                      b = {stats.intercept >= 0 ? `+${stats.intercept.toFixed(2)}` : stats.intercept.toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">Projected Actual Grade:</span>
                    <strong className="text-sm font-mono font-black text-emerald-400">
                      Tier {stats.interceptGrade}
                    </strong>
                  </div>
                  <div className="text-[10px] text-slate-300 pt-0.5 border-t border-slate-800/80 flex items-center justify-between">
                    <span>Sub-tier Offset:</span>
                    <span className="font-mono font-bold text-cyan-200">
                      {stats.intercept >= 0 ? `+${stats.intercept.toFixed(2)}` : stats.intercept.toFixed(2)} steps from F
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Each unit on the axis equals <strong>1 letter sub-tier</strong> (F → D- → D → D+ ...).
                  When you rate a card as <strong>'F'</strong>, the model predicts its true 17Lands tier is <strong>{stats.interceptGrade}</strong>.
                </p>

                <div className="pt-1 border-t border-slate-800/70 text-[10px] text-slate-400 space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Rated 'F' (x=0) → Actual:</span>
                    <span className="text-cyan-300 font-bold">{stats.interceptGrade}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Rated 'C' (x=5) → Actual:</span>
                    <span className="text-slate-200 font-bold">{stats.cTierGrade}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Rated 'A' (x=11) → Actual:</span>
                    <span className="text-slate-200 font-bold">{stats.aTierGrade}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Floating Empirical Trendline Popover */}
            {hoveredTrendline && !hoveredPoint && !hoveredIntercept && (
              <div
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute z-40 pointer-events-none p-3.5 rounded-2xl bg-slate-900/95 dark:bg-[#070b1e]/95 text-white shadow-2xl border border-cyan-500/80 backdrop-blur-md w-[295px] space-y-2 animate-in fade-in zoom-in-95 duration-100 font-sans"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/30">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <h5 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">Tendency Trendline</h5>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-500/40">
                    Best Fit
                  </span>
                </div>

                <div className="bg-slate-800/80 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-700/50 space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Equation:</span>
                    <strong className="text-cyan-300">
                      y = {stats.slope.toFixed(2)}x {stats.intercept >= 0 ? '+' : '-'} {Math.abs(stats.intercept).toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Variance Explained (R²):</span>
                    <strong className="text-emerald-400">
                      {(stats.rSquared * 100).toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Pearson Correlation (r):</span>
                    <strong className="text-sky-300">{stats.correlation.toFixed(3)}</strong>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {stats.biasDiagnosis}. The cyan line indicates your actual statistical grading relationship versus the 45° ideal parity line.
                </p>
              </div>
            )}
            </div>

            {/* Unified Side Controls & Toggles Panel */}
            <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col gap-4 bg-white/95 dark:bg-[#070b22]/95 backdrop-blur-xs border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-violet-500 dark:text-cyan-400" />
                  Graph Toggles
                </span>
                <button
                  type="button"
                  onClick={handleTogglePanelPosition}
                  className="text-[10px] font-mono text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={`Move controls to the ${panelPosition === 'right' ? 'left' : 'right'} side of the graph`}
                >
                  {panelPosition === 'right' ? 'Dock Left' : 'Dock Right'}
                </button>
              </div>

              {/* 1. Trendline Overlay Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                    Trendline (R²)
                  </span>
                  {stats.total >= 2 && (
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">
                      {(stats.rSquared * 100).toFixed(1)}% RSQ
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTrendline(!showTrendline)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center justify-between transition-all cursor-pointer ${
                    showTrendline
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-700 dark:text-cyan-300 shadow-2xs ring-1 ring-cyan-400/30'
                      : 'bg-slate-50 dark:bg-[#050818] border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                  title={showTrendline ? 'Hide Tendency Trendline' : 'Show Tendency Trendline (R²)'}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${showTrendline ? 'bg-cyan-500 animate-pulse' : 'bg-slate-400'}`} />
                    <span>Tendency Trendline</span>
                  </span>
                  <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md ${showTrendline ? 'bg-cyan-500 text-white dark:bg-cyan-400 dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                    {showTrendline ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* 2. Discrepancy & Verdict Filters */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  Verdict Filter
                </span>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDiscrepancyFilter('ALL')}
                    className={`px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                      discrepancyFilter === 'ALL'
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold border-slate-900 dark:border-slate-100 shadow-2xs'
                        : 'bg-slate-50 dark:bg-[#050818] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    <span className="text-[10px] opacity-75">All Cards</span>
                    <span className="font-bold text-xs">{allPoints.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscrepancyFilter('EXACT')}
                    className={`px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                      discrepancyFilter === 'EXACT'
                        ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 dark:bg-[#050818] border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400 hover:border-emerald-400'
                    }`}
                  >
                    <span className="text-[10px] opacity-75">🎯 Exact (0Δ)</span>
                    <span className="font-bold text-xs">{stats.exact}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscrepancyFilter('TRAPS')}
                    className={`px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                      discrepancyFilter === 'TRAPS'
                        ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-2xs'
                        : 'bg-slate-50 dark:bg-[#050818] border-slate-200 dark:border-slate-800 text-rose-700 dark:text-rose-400 hover:border-rose-400'
                    }`}
                  >
                    <span className="text-[10px] opacity-75">⚠️ Traps (+Δ)</span>
                    <span className="font-bold text-xs">{stats.trapsCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscrepancyFilter('SLEEPERS')}
                    className={`px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                      discrepancyFilter === 'SLEEPERS'
                        ? 'bg-sky-600 text-white font-bold border-sky-600 shadow-2xs'
                        : 'bg-slate-50 dark:bg-[#050818] border-slate-200 dark:border-slate-800 text-sky-700 dark:text-sky-400 hover:border-sky-400'
                    }`}
                  >
                    <span className="text-[10px] opacity-75">🧊 Sleepers (-Δ)</span>
                    <span className="font-bold text-xs">{stats.sleepersCount}</span>
                  </button>
                </div>
              </div>

              {/* 3. Rarity Filter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-violet-500 dark:text-cyan-400" />
                    Rarity Filter
                  </span>
                  {rarityFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setRarityFilter('ALL')}
                      className="text-[10px] text-violet-600 dark:text-cyan-400 hover:underline cursor-pointer lowercase"
                    >
                      reset
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setRarityFilter('ALL')}
                    className={`col-span-2 px-2.5 py-1.5 rounded-xl font-mono text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all border ${
                      rarityFilter === 'ALL'
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-2xs'
                        : 'bg-slate-50 dark:bg-[#050818] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>All Rarities</span>
                    </span>
                    <span className="text-[10px] opacity-75">{allPoints.length}</span>
                  </button>

                  {[
                    { id: 'common' as const, label: 'Common', count: rarityCounts.common, dotColor: '#94a3b8' },
                    { id: 'uncommon' as const, label: 'Uncommon', count: rarityCounts.uncommon, dotColor: '#38bdf8' },
                    { id: 'rare' as const, label: 'Rare', count: rarityCounts.rare, dotColor: '#eab308' },
                    { id: 'mythic' as const, label: 'Mythic', count: rarityCounts.mythic, dotColor: '#f97316' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRarityFilter(item.id)}
                      className={`px-2.5 py-1.5 rounded-xl font-mono text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all border ${
                        rarityFilter === item.id
                          ? 'bg-violet-600 text-white border-violet-500 shadow-2xs'
                          : 'bg-slate-50 dark:bg-[#050818] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.dotColor }}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="text-[10px] opacity-75 shrink-0 ml-1">{item.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. Statistical Modeling & Linear Regression (OLS) Bar */}
      {stats.total >= 2 && (
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100/90 dark:bg-[#040718] border-t border-slate-200 dark:border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
              OLS Regression Model:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-500 text-[11px]">Equation:</span>
              <strong className="text-slate-900 dark:text-white font-bold">
                y = {stats.slope.toFixed(2)}x {stats.intercept >= 0 ? '+' : '-'} {Math.abs(stats.intercept).toFixed(2)}
              </strong>
              {/* Interactive Intercept Badge */}
              <div
                className="relative inline-flex items-center"
                onMouseEnter={() => setActiveInfoPopup('intercept')}
                onMouseLeave={() => setActiveInfoPopup(null)}
              >
                <button
                  type="button"
                  onClick={() => setActiveInfoPopup(activeInfoPopup === 'intercept' ? null : 'intercept')}
                  className="text-[10px] text-cyan-700 dark:text-cyan-300 font-bold bg-cyan-100/80 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-300 dark:border-cyan-700/80 hover:bg-cyan-200 dark:hover:bg-cyan-900/80 cursor-pointer transition-colors flex items-center gap-1 select-none"
                >
                  <span>Intercept at 'F': {stats.interceptGrade} ({stats.intercept >= 0 ? `+${stats.intercept.toFixed(1)}` : stats.intercept.toFixed(1)} steps)</span>
                  <Info className="w-2.5 h-2.5 opacity-70" />
                </button>

                {activeInfoPopup === 'intercept' && (
                  <div className="absolute bottom-full left-0 mb-2 z-40 w-72 p-3 bg-slate-900/95 dark:bg-[#070b1e]/98 text-white rounded-xl shadow-2xl border border-cyan-500/80 backdrop-blur-md text-xs font-sans animate-in fade-in zoom-in-95 duration-100 pointer-events-none select-none">
                    <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-cyan-500/30">
                      <strong className="text-cyan-300 font-bold flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        Y-Intercept Interpretation
                      </strong>
                      <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/40">
                        b = {stats.intercept >= 0 ? `+${stats.intercept.toFixed(2)}` : stats.intercept.toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-slate-300">
                      <p>
                        The axis is stepped in 13 letter sub-tiers (<strong>F</strong> to <strong>A+</strong>). Every <strong>1.0 unit = 1 letter step</strong>.
                      </p>
                      <div className="bg-slate-800/80 p-2 rounded-lg font-mono text-[10px] space-y-1 text-slate-300 border border-slate-700/60">
                        <div className="flex justify-between">
                          <span>Rated 'F' (x=0) baseline:</span>
                          <strong className="text-emerald-400">Actual {stats.interceptGrade} ({stats.intercept >= 0 ? `+${stats.intercept.toFixed(1)}` : stats.intercept.toFixed(1)} steps)</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Rated 'C' (x=5) benchmark:</span>
                          <strong className="text-cyan-200">Actual {stats.cTierGrade}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Rated 'A' (x=11) benchmark:</span>
                          <strong className="text-cyan-200">Actual {stats.aTierGrade}</strong>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {stats.intercept > 0.5
                          ? 'Positive intercept: Your F ratings are strict — cards you discard perform higher in reality.'
                          : stats.intercept < -0.5
                          ? 'Negative intercept: Cards you rate as F perform strictly as unplayable.'
                          : 'Neutral intercept: Your baseline ratings closely mirror 17Lands reality.'}
                      </p>
                    </div>
                    {/* Downward triangle arrow */}
                    <div className="absolute -bottom-1 left-4 w-2 h-2 bg-slate-900 border-r border-b border-cyan-500/80 rotate-45" />
                  </div>
                )}
              </div>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden lg:inline">|</span>
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
              <span title="Projected 17Lands tier when you evaluate a typical common as 'C'">
                Rated 'C' → <strong className="text-slate-700 dark:text-slate-200">{stats.cTierGrade}</strong>
              </span>
              <span>•</span>
              <span title="Projected 17Lands tier when you evaluate a bomb rare as 'A'">
                Rated 'A' → <strong className="text-slate-700 dark:text-slate-200">{stats.aTierGrade}</strong>
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

            {/* Interactive RSQ Badge */}
            <div
              className="relative inline-flex items-center"
              onMouseEnter={() => setActiveInfoPopup('rsq')}
              onMouseLeave={() => setActiveInfoPopup(null)}
            >
              <button
                type="button"
                onClick={() => setActiveInfoPopup(activeInfoPopup === 'rsq' ? null : 'rsq')}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800/80 cursor-pointer transition-colors select-none"
              >
                <span className="text-slate-500 text-[11px]">RSQ:</span>
                <strong className="text-cyan-600 dark:text-cyan-300 font-bold">
                  R² = {stats.rSquared.toFixed(3)} ({(stats.rSquared * 100).toFixed(1)}%)
                </strong>
                <Info className="w-2.5 h-2.5 text-cyan-500 opacity-70" />
              </button>

              {activeInfoPopup === 'rsq' && (
                <div className="absolute bottom-full left-0 mb-2 z-40 w-72 p-3 bg-slate-900/95 dark:bg-[#070b1e]/98 text-white rounded-xl shadow-2xl border border-cyan-500/80 backdrop-blur-md text-xs font-sans animate-in fade-in zoom-in-95 duration-100 pointer-events-none select-none">
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-cyan-500/30">
                    <strong className="text-cyan-300 font-bold flex items-center gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      R² (Coefficient of Determination)
                    </strong>
                    <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/40">
                      {(stats.rSquared * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-300">
                    <p>
                      Quantifies how much of the variance in actual 17Lands win rates is directly predicted by your evaluations.
                    </p>
                    <div className="bg-slate-800/80 p-2 rounded-lg font-mono text-[10px] space-y-1 text-slate-300 border border-slate-700/60">
                      <div className="flex justify-between">
                        <span>Pearson Correlation (r):</span>
                        <strong className="text-emerald-400">{stats.correlation.toFixed(3)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Fit Quality:</span>
                        <strong className="text-cyan-200">
                          {stats.rSquared >= 0.6 ? 'Exceptional Calibration' : stats.rSquared >= 0.35 ? 'Moderate Correlation' : 'High Noise / Dispersion'}
                        </strong>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      A score of 1.0 (100%) indicates perfect linear agreement with 17Lands win rate ranks.
                    </p>
                  </div>
                  {/* Downward triangle arrow */}
                  <div className="absolute -bottom-1 left-4 w-2 h-2 bg-slate-900 border-r border-b border-cyan-500/80 rotate-45" />
                </div>
              )}
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <span className="px-2 py-0.5 rounded-full bg-violet-100/80 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 font-bold text-[11px] border border-violet-200 dark:border-violet-800/60">
              {stats.biasDiagnosis}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="inline-block w-3.5 h-0 border-b-2 border-dashed border-slate-500 dark:border-slate-400" />
              <span>Ideal Parity (y = x)</span>
            </div>
            {showTrendline && (
              <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
                <span className="inline-block w-3.5 h-0.5 bg-cyan-500 rounded-full" />
                <span>Tendency Trendline (R²)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
