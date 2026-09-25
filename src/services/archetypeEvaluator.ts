import { Card, GradeTier, MTGColor, SeventeenLandsSetData, UserCardEvaluation, UserArchetypeEvaluation, UserColorEvaluation } from '../types/mtg';
import {
  GRADE_SCORES,
  scoreToGradeTier,
  winRateToGradeTier,
  isAuthentic17LandsDataSet,
  isSetUnderTwoWeeksOld,
  is17LandsEligibleForSet,
  get17LandsCardRating,
} from './seventeenLands';

export { isAuthentic17LandsDataSet, isSetUnderTwoWeeksOld, is17LandsEligibleForSet };

export interface ColorStrength {
  color: MTGColor | 'C';
  name: string;
  symbol: string;
  badgeClass: string;
  averageScore: number;
  letterGrade: GradeTier;
  totalCards: number;
  ratedCards: number;
  ratedRatio: number;
  bombs: { card: Card; eval: UserCardEvaluation }[];
  topCommons: { card: Card; eval: UserCardEvaluation }[];
  topUncommons: { card: Card; eval: UserCardEvaluation }[];
  gradeDistribution: Record<GradeTier, number>;
  userEvaluation?: UserColorEvaluation;
  // 17Lands Data (when data is released)
  seventeenLandsAvgWinRate?: number;
  seventeenLandsRank?: number;
  seventeenLandsGrade?: GradeTier;
  rankDelta?: number; // (User rank - 17lands rank)
}

export interface ArchetypeStrength {
  colors: [MTGColor, MTGColor];
  code: string;
  name: string;
  theme: string;
  headline?: string;
  description?: string;
  mechanics?: string[];
  powerScore: number;
  letterGrade: GradeTier;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  signposts: { card: Card; eval?: UserCardEvaluation }[];
  signpostAvgScore: number;
  color1AvgScore: number;
  color2AvgScore: number;
  color1Name: string;
  color2Name: string;
  keyPicks: { card: Card; eval: UserCardEvaluation }[];
  totalSupportCards: number;
  isDevelopedForSet: boolean;
  userEvaluation?: UserArchetypeEvaluation;
  // 17Lands Data (when data is released)
  seventeenLandsWinRate?: number;
  seventeenLandsTier?: 'S' | 'A' | 'B' | 'C' | 'D';
  seventeenLandsRank?: number;
  tierDelta?: number; // 0 = exact match, positive = you rated higher than 17lands, negative = you rated lower
}

export interface SetSynthesisReport {
  setCode: string;
  setName: string;
  totalCards: number;
  ratedCards: number;
  completionPercent: number;
  isFullyGraded: boolean;
  bestColor: ColorStrength | null;
  worstColor: ColorStrength | null;
  bestArchetype: ArchetypeStrength | null;
  worstArchetype: ArchetypeStrength | null;
  colorRankings: ColorStrength[];
  archetypeRankings: ArchetypeStrength[];
  developedArchetypes: ArchetypeStrength[];
  otherArchetypes: ArchetypeStrength[];
  tierList: Record<'S' | 'A' | 'B' | 'C' | 'D', ArchetypeStrength[]>;
  developedTierList: Record<'S' | 'A' | 'B' | 'C' | 'D', ArchetypeStrength[]>;
  otherTierList: Record<'S' | 'A' | 'B' | 'C' | 'D', ArchetypeStrength[]>;
  // 17Lands Meta Verification
  has17LandsData: boolean;
  seventeenLandsBestColor?: ColorStrength | null;
  seventeenLandsWorstColor?: ColorStrength | null;
  seventeenLandsBestArchetype?: ArchetypeStrength | null;
  metaCalibrationScore?: number; // 0 - 100% alignment rating
  metaCalibrationTier?: string; // 'Spot-on Meta Oracle 🎯', 'Strong Consensus Read 💎', 'Contrarian Theorycrafter 🔮'
}

import {
  GUILD_ARCHETYPES,
  SET_DEVELOPED_ARCHETYPES,
  getDevelopedArchetypeCodes,
  getWOTCArchetypeInfo,
} from './wotcArchetypes';

export { GUILD_ARCHETYPES, SET_DEVELOPED_ARCHETYPES, getDevelopedArchetypeCodes };

const COLOR_METADATA: Record<MTGColor | 'C', { name: string; symbol: string; badgeClass: string }> = {
  W: { name: 'White', symbol: 'W', badgeClass: 'bg-amber-100/15 text-amber-200 border-amber-300/40' },
  U: { name: 'Blue', symbol: 'U', badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-400/40' },
  B: { name: 'Black', symbol: 'B', badgeClass: 'bg-violet-950/40 text-violet-300 border-violet-500/40' },
  R: { name: 'Red', symbol: 'R', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-400/40' },
  G: { name: 'Green', symbol: 'G', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40' },
  C: { name: 'Colorless', symbol: 'C', badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' },
};

function winRateToArchetypeTier(winRate: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  const wr = winRate > 1 ? winRate / 100 : winRate;
  if (wr >= 0.575) return 'S';
  if (wr >= 0.555) return 'A';
  if (wr >= 0.535) return 'B';
  if (wr >= 0.510) return 'C';
  return 'D';
}

const TIER_NUM_VAL: Record<'S' | 'A' | 'B' | 'C' | 'D', number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

export function calculateColorRankings(
  cards: Card[],
  userEvaluations: Record<string, UserCardEvaluation>,
  seventeenLandsData?: SeventeenLandsSetData | null,
  setCode?: string,
  userColorEvaluations?: Record<string, UserColorEvaluation>
): ColorStrength[] {
  const has17Lands = isAuthentic17LandsDataSet(seventeenLandsData, setCode, cards);

  const colors: (MTGColor | 'C')[] = ['W', 'U', 'B', 'R', 'G', 'C'];
  const results: ColorStrength[] = colors.map((col) => {
    const meta = COLOR_METADATA[col];
    const userEvalKey = `${(setCode || '').toLowerCase()}_${col.toUpperCase()}`;
    const userEvaluation = userColorEvaluations ? userColorEvaluations[userEvalKey] : undefined;

    // Filter cards strictly monocolored in this color (or strictly colorless)
    const colorCards = cards.filter((c) => {
      if (col === 'C') {
        return (c.colors || []).length === 0 && !c.type_line?.toLowerCase().includes('land');
      }
      return (c.colors || []).length === 1 && c.colors[0] === col;
    });

    let totalScore = 0;
    let ratedCount = 0;
    const bombs: { card: Card; eval: UserCardEvaluation }[] = [];
    const topCommons: { card: Card; eval: UserCardEvaluation }[] = [];
    const topUncommons: { card: Card; eval: UserCardEvaluation }[] = [];
    const gradeDist: Record<GradeTier, number> = {
      'A+': 0, A: 0, 'A-': 0, 'B+': 0, B: 0, 'B-': 0, 'C+': 0, C: 0, 'C-': 0, D: 0, F: 0, 'N/A': 0,
    };

    // 17Lands average win rate accumulator
    let landWrSum = 0;
    let landCardCount = 0;

    colorCards.forEach((card) => {
      const key = `${card.set?.toLowerCase() || ''}_${card.name?.toLowerCase() || ''}`;
      const evalData = userEvaluations[key];
      if (evalData) {
        ratedCount++;
        totalScore += evalData.userScore;
        if (evalData.userGrade !== 'N/A') {
          gradeDist[evalData.userGrade] = (gradeDist[evalData.userGrade] || 0) + 1;
        }

        if (evalData.userScore >= 3.7) {
          bombs.push({ card, eval: evalData });
        }
        if (card.rarity === 'common' && evalData.userScore >= 2.7) {
          topCommons.push({ card, eval: evalData });
        }
        if (card.rarity === 'uncommon' && evalData.userScore >= 3.0) {
          topUncommons.push({ card, eval: evalData });
        }
      }

      if (has17Lands) {
        const rating = get17LandsCardRating(card, seventeenLandsData);
        if (typeof rating?.win_rate === 'number') {
          landWrSum += rating.win_rate;
          landCardCount++;
        }
      }
    });

    const averageScore = ratedCount > 0 ? parseFloat((totalScore / ratedCount).toFixed(2)) : 2.5;
    const letterGrade = scoreToGradeTier(averageScore);

    // Sort top picks descending by grade score
    bombs.sort((a, b) => b.eval.userScore - a.eval.userScore);
    topCommons.sort((a, b) => b.eval.userScore - a.eval.userScore);
    topUncommons.sort((a, b) => b.eval.userScore - a.eval.userScore);

    const seventeenLandsAvgWinRate = landCardCount > 0 ? parseFloat((landWrSum / landCardCount).toFixed(3)) : undefined;
    const seventeenLandsGrade = seventeenLandsAvgWinRate !== undefined ? winRateToGradeTier(seventeenLandsAvgWinRate) : undefined;

    return {
      color: col,
      name: meta.name,
      symbol: meta.symbol,
      badgeClass: meta.badgeClass,
      averageScore,
      letterGrade,
      totalCards: colorCards.length,
      ratedCards: ratedCount,
      ratedRatio: colorCards.length > 0 ? ratedCount / colorCards.length : 0,
      bombs: bombs.slice(0, 5),
      topCommons: topCommons.slice(0, 5),
      topUncommons: topUncommons.slice(0, 5),
      gradeDistribution: gradeDist,
      userEvaluation,
      seventeenLandsAvgWinRate,
      seventeenLandsGrade,
    };
  });

  // Calculate 17Lands rankings across WUBRG (only for colors with real data)
  if (has17Lands) {
    const sortedBy17Lands = [...results.filter((c) => c.color !== 'C' && c.seventeenLandsAvgWinRate !== undefined)].sort(
      (a, b) => (b.seventeenLandsAvgWinRate || 0) - (a.seventeenLandsAvgWinRate || 0)
    );
    sortedBy17Lands.forEach((c, idx) => {
      c.seventeenLandsRank = idx + 1;
    });
  }

  // Sort by user's average score descending; unrated colors placed at the end
  results.sort((a, b) => {
    if (a.ratedCards === 0 && b.ratedCards === 0) return 0;
    if (a.ratedCards === 0) return 1;
    if (b.ratedCards === 0) return -1;
    return b.averageScore - a.averageScore;
  });

  // Compute rank delta (User rank vs 17Lands rank) only for colors you've actually rated
  results.forEach((c, userIdx) => {
    if (c.seventeenLandsRank !== undefined && c.ratedCards > 0) {
      c.rankDelta = c.seventeenLandsRank - (userIdx + 1); // e.g. you picked #1, 17Lands is #3 -> delta +2
    }
  });

  return results;
}

export function calculateArchetypeRankings(
  cards: Card[],
  userEvaluations: Record<string, UserCardEvaluation>,
  colorRankings: ColorStrength[],
  seventeenLandsData?: SeventeenLandsSetData | null,
  setCode?: string,
  userArchetypeEvaluations?: Record<string, UserArchetypeEvaluation>
): ArchetypeStrength[] {
  const developedCodes = getDevelopedArchetypeCodes(setCode || '', cards);
  const has17Lands = isAuthentic17LandsDataSet(seventeenLandsData, setCode, cards);
  const colorScoreMap = new Map<string, number>();
  const color17WrMap = new Map<string, number>();

  colorRankings.forEach((c) => {
    colorScoreMap.set(c.color, c.averageScore);
    if (c.seventeenLandsAvgWinRate !== undefined) {
      color17WrMap.set(c.color, c.seventeenLandsAvgWinRate);
    }
  });

  const results: ArchetypeStrength[] = GUILD_ARCHETYPES.map((guild) => {
    const [c1, c2] = guild.colors;
    const userEvalKey = `${(setCode || '').toLowerCase()}_${guild.code.toUpperCase()}`;
    const userEvaluation = userArchetypeEvaluations ? userArchetypeEvaluations[userEvalKey] : undefined;
    const c1Score = colorScoreMap.get(c1) || 2.5;
    const c2Score = colorScoreMap.get(c2) || 2.5;
    const c1Wr = color17WrMap.get(c1);
    const c2Wr = color17WrMap.get(c2);

    // Find gold signpost cards in this exact pair
    const goldCards = cards.filter((c) => {
      const colors = c.colors || [];
      return colors.length === 2 && colors.includes(c1) && colors.includes(c2);
    });

    let signpostTotal = 0;
    let signpostRated = 0;
    const signpostList: { card: Card; eval?: UserCardEvaluation }[] = [];

    let landSignpostWrSum = 0;
    let landSignpostCount = 0;

    goldCards.forEach((card) => {
      const key = `${card.set?.toLowerCase() || ''}_${card.name?.toLowerCase() || ''}`;
      const evalData = userEvaluations[key];
      signpostList.push({ card, eval: evalData });
      if (evalData) {
        signpostTotal += evalData.userScore;
        signpostRated++;
      }

      if (has17Lands) {
        const rating = get17LandsCardRating(card, seventeenLandsData);
        if (typeof rating?.win_rate === 'number') {
          landSignpostWrSum += rating.win_rate;
          landSignpostCount++;
        }
      }
    });

    const signpostAvg = signpostRated > 0 ? signpostTotal / signpostRated : (c1Score + c2Score) / 2;

    // Weighted Archetype formula: 30% Gold Signpost strength + 35% Color 1 mono quality + 35% Color 2 mono quality
    const powerScore = parseFloat((signpostAvg * 0.30 + c1Score * 0.35 + c2Score * 0.35).toFixed(2));
    const letterGrade = scoreToGradeTier(powerScore);

    // Find key picks for this color pair (Bombs and premium commons/uncommons in C1, C2, or Gold)
    const keyPicks: { card: Card; eval: UserCardEvaluation }[] = [];
    cards.forEach((card) => {
      const key = `${card.set?.toLowerCase() || ''}_${card.name?.toLowerCase() || ''}`;
      const evalData = userEvaluations[key];
      if (!evalData) return;

      const colors = card.colors || [];
      const isMatch =
        (colors.length === 1 && (colors[0] === c1 || colors[0] === c2)) ||
        (colors.length === 2 && colors.includes(c1) && colors.includes(c2));

      if (isMatch && evalData.userScore >= 3.2) {
        keyPicks.push({ card, eval: evalData });
      }
    });

    keyPicks.sort((a, b) => b.eval.userScore - a.eval.userScore);

    // Determine User Predicted Tier
    let tier: 'S' | 'A' | 'B' | 'C' | 'D' = 'C';
    if (powerScore >= 3.6) tier = 'S';
    else if (powerScore >= 3.2) tier = 'A';
    else if (powerScore >= 2.8) tier = 'B';
    else if (powerScore >= 2.4) tier = 'C';
    else tier = 'D';

    // 17Lands Win Rate
    let seventeenLandsWinRate: number | undefined = undefined;
    let seventeenLandsTier: 'S' | 'A' | 'B' | 'C' | 'D' | undefined = undefined;

    if (has17Lands && c1Wr !== undefined && c2Wr !== undefined) {
      const signpostWr = landSignpostCount > 0 ? landSignpostWrSum / landSignpostCount : (c1Wr + c2Wr) / 2;
      seventeenLandsWinRate = parseFloat((signpostWr * 0.30 + c1Wr * 0.35 + c2Wr * 0.35).toFixed(3));
      seventeenLandsTier = winRateToArchetypeTier(seventeenLandsWinRate);
    }

    const wotcInfo = getWOTCArchetypeInfo(setCode || '', guild.code, cards);

    return {
      colors: guild.colors,
      code: guild.code,
      name: wotcInfo.name || guild.name,
      theme: wotcInfo.headline || guild.defaultTheme,
      headline: wotcInfo.headline,
      description: wotcInfo.description,
      mechanics: wotcInfo.mechanics,
      powerScore,
      letterGrade,
      tier,
      signposts: signpostList,
      signpostAvgScore: parseFloat(signpostAvg.toFixed(2)),
      color1AvgScore: c1Score,
      color2AvgScore: c2Score,
      color1Name: COLOR_METADATA[c1].name,
      color2Name: COLOR_METADATA[c2].name,
      keyPicks: keyPicks.slice(0, 6),
      totalSupportCards: goldCards.length,
      isDevelopedForSet: developedCodes.has(guild.code),
      userEvaluation,
      seventeenLandsWinRate,
      seventeenLandsTier,
    };
  });

  // Calculate 17Lands real ranking (1 to 10) for archetypes with authentic win rate data
  if (has17Lands) {
    const sorted17 = [...results.filter((a) => a.seventeenLandsWinRate !== undefined)].sort(
      (a, b) => (b.seventeenLandsWinRate || 0) - (a.seventeenLandsWinRate || 0)
    );
    sorted17.forEach((arch, idx) => {
      arch.seventeenLandsRank = idx + 1;
    });
  }

  // Sort descending by User Predicted power score
  results.sort((a, b) => b.powerScore - a.powerScore);

  // Calculate Tier Delta
  results.forEach((arch) => {
    if (arch.seventeenLandsTier) {
      const userVal = TIER_NUM_VAL[arch.tier];
      const realVal = TIER_NUM_VAL[arch.seventeenLandsTier];
      arch.tierDelta = userVal - realVal;
    }
  });

  return results;
}

export function generateSetSynthesisReport(
  cards: Card[],
  userEvaluations: Record<string, UserCardEvaluation>,
  setCode: string,
  setName: string,
  seventeenLandsData?: SeventeenLandsSetData | null,
  userArchetypeEvaluations?: Record<string, UserArchetypeEvaluation>,
  userColorEvaluations?: Record<string, UserColorEvaluation>
): SetSynthesisReport {
  let ratedCount = 0;
  cards.forEach((c) => {
    const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
    if (userEvaluations[key]) {
      ratedCount++;
    }
  });

  const totalCards = cards.length;
  const completionPercent = totalCards > 0 ? Math.round((ratedCount / totalCards) * 100) : 0;
  const isFullyGraded = totalCards > 0 && ratedCount >= totalCards;

  const colorRankings = calculateColorRankings(cards, userEvaluations, seventeenLandsData, setCode, userColorEvaluations);
  const archetypeRankings = calculateArchetypeRankings(cards, userEvaluations, colorRankings, seventeenLandsData, setCode, userArchetypeEvaluations);

  // Partition archetypes into Developed for Set vs Other Pairs
  const developedArchetypes = archetypeRankings.filter((a) => a.isDevelopedForSet);
  const otherArchetypes = archetypeRankings.filter((a) => !a.isDevelopedForSet);

  // Group by Tier for all archetypes
  const tierList: Record<'S' | 'A' | 'B' | 'C' | 'D', ArchetypeStrength[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
  };
  archetypeRankings.forEach((arch) => {
    tierList[arch.tier].push(arch);
  });

  // Group by Tier for Developed Archetypes
  const developedTierList: Record<'S' | 'A' | 'B' | 'C' | 'D', ArchetypeStrength[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
  };
  developedArchetypes.forEach((arch) => {
    developedTierList[arch.tier].push(arch);
  });

  // Group by Tier for Other / Off-Meta Archetypes
  const otherTierList: Record<'S' | 'A' | 'B' | 'C' | 'D', ArchetypeStrength[]> = {
    S: [],
    A: [],
    B: [],
    C: [],
    D: [],
  };
  otherArchetypes.forEach((arch) => {
    otherTierList[arch.tier].push(arch);
  });

  const monocolorRankings = colorRankings.filter((c) => c.color !== 'C');
  const ratedMonocolors = monocolorRankings.filter((c) => c.ratedCards > 0);
  const has17Lands = isAuthentic17LandsDataSet(seventeenLandsData, setCode, cards);

  let seventeenLandsBestColor: ColorStrength | null = null;
  let seventeenLandsWorstColor: ColorStrength | null = null;
  let seventeenLandsBestArchetype: ArchetypeStrength | null = null;
  let metaCalibrationScore: number | undefined = undefined;
  let metaCalibrationTier: string | undefined = undefined;

  if (has17Lands) {
    const sorted17Colors = [...monocolorRankings]
      .filter((c) => c.seventeenLandsAvgWinRate !== undefined)
      .sort((a, b) => (b.seventeenLandsAvgWinRate || 0) - (a.seventeenLandsAvgWinRate || 0));
    seventeenLandsBestColor = sorted17Colors[0] || null;
    seventeenLandsWorstColor = sorted17Colors.length > 1 ? sorted17Colors[sorted17Colors.length - 1] : null;

    // Prioritize developed archetypes for 17Lands top archetype if available
    const targetArchetypePool = developedArchetypes.length > 0 ? developedArchetypes : archetypeRankings;
    const sorted17Archetypes = [...targetArchetypePool]
      .filter((a) => a.seventeenLandsWinRate !== undefined)
      .sort((a, b) => (b.seventeenLandsWinRate || 0) - (a.seventeenLandsWinRate || 0));
    seventeenLandsBestArchetype = sorted17Archetypes[0] || null;

    // Only compute prediction calibration score if user has graded a meaningful sample (>= 15 cards)
    if (ratedCount >= 15) {
      let totalPenalty = 0;
      archetypeRankings.forEach((arch, userRankIdx) => {
        const userRank = userRankIdx + 1;
        const realRank = arch.seventeenLandsRank || userRank;
        totalPenalty += Math.abs(userRank - realRank);
      });

      // Max possible penalty across 10 items is around 40
      const rawScore = Math.max(0, Math.min(100, Math.round(100 - (totalPenalty / 40) * 100)));
      metaCalibrationScore = rawScore;

      if (rawScore >= 85) metaCalibrationTier = 'Spot-on Meta Oracle 🎯';
      else if (rawScore >= 70) metaCalibrationTier = 'Strong Meta Consensus Read 💎';
      else if (rawScore >= 55) metaCalibrationTier = 'Solid Theorycraft Calibration ⚖️';
      else metaCalibrationTier = 'Contrarian / Rogue Perspective 🔮';
    }
  }

  return {
    setCode,
    setName,
    totalCards,
    ratedCards: ratedCount,
    completionPercent,
    isFullyGraded,
    bestColor: ratedMonocolors[0] || null,
    worstColor: ratedMonocolors.length > 1 ? ratedMonocolors[ratedMonocolors.length - 1] : null,
    bestArchetype: developedArchetypes[0] || archetypeRankings[0] || null,
    worstArchetype: developedArchetypes[developedArchetypes.length - 1] || archetypeRankings[archetypeRankings.length - 1] || null,
    colorRankings,
    archetypeRankings,
    developedArchetypes,
    otherArchetypes,
    tierList,
    developedTierList,
    otherTierList,
    has17LandsData: has17Lands,
    seventeenLandsBestColor,
    seventeenLandsWorstColor,
    seventeenLandsBestArchetype,
    metaCalibrationScore,
    metaCalibrationTier,
  };
}

export function generateSetMetaSummaryMarkdown(report: SetSynthesisReport): string {
  const lines: string[] = [];
  lines.push(`# 🏆 Draft Meta Forecast: ${report.setName} (${report.setCode})`);
  lines.push(`*Generated from ${report.ratedCards}/${report.totalCards} graded cards (${report.completionPercent}% Complete)*`);
  lines.push(`*Note: This synthesis is based on your personal card ratings${report.has17LandsData ? ' compared with 17Lands draft win rates' : ' (pre-release prediction mode)'}*.\n`);

  if (report.has17LandsData && report.metaCalibrationScore !== undefined) {
    lines.push(`### 📊 Prediction Calibration Score: **${report.metaCalibrationScore}%** (${report.metaCalibrationTier})\n`);
  }

  lines.push(`## 🎨 Monocolor Power Hierarchy (Draft Chain)`);
  const monoColors = report.colorRankings.filter((c) => c.color !== 'C');
  let chainPips = '';
  let chainGrades = '';
  monoColors.forEach((c, i) => {
    chainPips += c.name;
    chainGrades += `Grade ${c.letterGrade}`;
    if (i < monoColors.length - 1) {
      const next = monoColors[i + 1];
      const isTied =
        (c.ratedCards === 0 && next.ratedCards === 0) ||
        (c.ratedCards > 0 && next.ratedCards > 0 && Math.abs(c.averageScore - next.averageScore) < 0.01);
      const sep = isTied ? ' = ' : ' > ';
      chainPips += sep;
      chainGrades += sep;
    }
  });
  lines.push(`**Colors:** ${chainPips}`);
  lines.push(`**Tiers:**  ${chainGrades}\n`);

  report.colorRankings.forEach((col, idx) => {
    const seventeenStr = col.seventeenLandsAvgWinRate !== undefined ? ` • 17Lands: ${(col.seventeenLandsAvgWinRate * 100).toFixed(1)}% WR (#${col.seventeenLandsRank})` : '';
    lines.push(`${idx + 1}. **${col.name}** — Grade **${col.letterGrade}** (Your Score: ${col.averageScore.toFixed(2)}) • ${col.bombs.length} Bombs, ${col.topCommons.length} Key Commons${seventeenStr}`);
  });

  const developedCount = report.developedArchetypes.length;
  const isAsymmetricSet = developedCount > 0 && developedCount < 10;

  lines.push(`\n## 🎯 ${isAsymmetricSet ? `Designed Set Archetypes (${developedCount} Pairs)` : '2-Color Archetype Tier List'}`);
  (['S', 'A', 'B', 'C', 'D'] as const).forEach((tier) => {
    const archetypes = (isAsymmetricSet ? report.developedTierList : report.tierList)[tier];
    if (archetypes.length > 0) {
      lines.push(`### Tier ${tier}`);
      archetypes.forEach((arch) => {
        const seventeenStr = arch.seventeenLandsWinRate !== undefined ? ` [17Lands Actual: Tier ${arch.seventeenLandsTier} - ${(arch.seventeenLandsWinRate * 100).toFixed(1)}% WR]` : '';
        lines.push(`- **${arch.name} (${arch.code})**: Power ${arch.powerScore.toFixed(2)} (Grade ${arch.letterGrade}) — *${arch.theme}*${seventeenStr}`);
      });
    }
  });

  if (isAsymmetricSet && report.otherArchetypes.length > 0) {
    lines.push(`\n## 🧩 Other Color Pairs (${report.otherArchetypes.length} Pairs)`);
    lines.push(`*Off-archetype pairs not specifically supported with signposts in ${report.setName}*`);
    (['S', 'A', 'B', 'C', 'D'] as const).forEach((tier) => {
      const archetypes = report.otherTierList[tier];
      if (archetypes.length > 0) {
        lines.push(`### Tier ${tier}`);
        archetypes.forEach((arch) => {
          lines.push(`- **${arch.name} (${arch.code})**: Power ${arch.powerScore.toFixed(2)} (Grade ${arch.letterGrade}) — *${arch.theme}*`);
        });
      }
    });
  }

  lines.push(`\n---\n*Synthesized with MTG Limited IQ*`);
  return lines.join('\n');
}
