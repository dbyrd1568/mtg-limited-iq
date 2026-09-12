import { Card, UserCardEvaluation, SeventeenLandsSetData, GradeTier } from '../types/mtg';
import { getLsvRatingForCard } from './lsvRatings';
import {
  winRateToGradeTier,
  gradeTierToIndex,
  get17LandsCardUrl,
} from './seventeenLands';

/**
 * Escapes a field for CSV format following RFC 4180.
 * Wraps values containing quotes, commas, or newlines in quotes, and escapes internal quotes.
 */
export function escapeCsvField(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Escapes a field for TSV format (for direct copy/paste into Google Sheets / Excel).
 * Replaces tabs and breaks newlines into spaces to preserve cell boundaries.
 */
export function escapeTsvField(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, ' ');
}

// ==================== 17LANDS TIER LIST FORMAT ====================

/**
 * Generates a CSV strictly compliant with 17Lands Tier List import template.
 * Header: Name,Tier,Buildaround,Synergy,Comment
 *
 * @param cards List of cards in the set
 * @param evaluations User card evaluations
 * @param options.gradedOnly If true, only exports cards that have been assigned a user grade
 */
export function generate17LandsTiersCsv(
  cards: Card[],
  evaluations: Record<string, UserCardEvaluation>,
  options: { gradedOnly?: boolean } = {}
): string {
  const { gradedOnly = false } = options;
  const header = ['Name', 'Tier', 'Buildaround', 'Synergy', 'Comment'];
  const rows: string[] = [header.join(',')];

  for (const card of cards) {
    const evalKey = `${(card.set || '').toLowerCase()}_${card.name.toLowerCase()}`;
    const userEval = evaluations[evalKey];

    if (gradedOnly && !userEval?.userGrade) {
      continue;
    }

    const name = card.name;
    const tier = userEval?.userGrade || '';

    // Buildaround heuristic: flagged if archetype role or notes indicates buildaround
    const isBuildaround = userEval?.archetypeRole?.toLowerCase().includes('build') ||
      userEval?.notes?.toLowerCase().includes('build') ||
      card.oracle_text?.toLowerCase().includes('if you control') ||
      false;

    // Synergy heuristic: flagged if marked as synergy, combat trick, or archetype piece
    const isSynergy = userEval?.archetypeRole?.toLowerCase().includes('synergy') ||
      userEval?.archetypeRole?.toLowerCase().includes('engine') ||
      card.is_combat_trick ||
      false;

    const buildaround = isBuildaround ? '1' : '0';
    const synergy = isSynergy ? '1' : '0';
    const comment = userEval?.notes?.trim() || '';

    const row = [
      escapeCsvField(name),
      escapeCsvField(tier),
      buildaround,
      synergy,
      escapeCsvField(comment),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

// ==================== FULL COMPARISON SPREADSHEET ====================

export interface FullSpreadsheetRow {
  name: string;
  setCode: string;
  collectorNumber: string;
  manaCost: string;
  cmc: number;
  colors: string;
  colorIdentity: string;
  rarity: string;
  typeLine: string;
  power: string;
  toughness: string;
  keywords: string;
  roles: string;
  oracleText: string;

  // User Evaluation
  userGrade: string;
  userScore: string;
  pickPriority: string;
  archetypeRole: string;
  userNotes: string;
  evaluatedAt: string;

  // 17Lands Benchmarks
  seventeenLandsGrade: string;
  seventeenLandsGihWrPct: string;
  seventeenLandsGihWrDecimal: string;
  seventeenLandsAlsa: string;
  seventeenLandsIwdPct: string;
  seventeenLandsSampleSize: string;
  seventeenLandsSeenCount: string;
  seventeenLandsPickRatePct: string;
  seventeenLandsOpeningHandWrPct: string;
  seventeenLandsDrawnWrPct: string;

  // LSV Review Benchmarks
  lsvGrade: string;
  lsvScore: string;
  lsvVerdict: string;

  // Comparison & Calibration Insights
  deltaVs17LandsSteps: string;
  comparisonStatusVs17Lands: string;
  deltaVsLsvSteps: string;
  calibrationAccuracyPct: string;

  // External Links
  scryfallUrl: string;
  seventeenLandsUrl: string;
}

export const FULL_SPREADSHEET_HEADERS: { key: keyof FullSpreadsheetRow; label: string }[] = [
  { key: 'name', label: 'Card Name' },
  { key: 'setCode', label: 'Set' },
  { key: 'collectorNumber', label: 'Collector #' },
  { key: 'manaCost', label: 'Mana Cost' },
  { key: 'cmc', label: 'CMC / MV' },
  { key: 'colors', label: 'Color(s)' },
  { key: 'colorIdentity', label: 'Color Identity' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'typeLine', label: 'Type Line' },
  { key: 'power', label: 'Power' },
  { key: 'toughness', label: 'Toughness' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'roles', label: 'Role Tags' },
  { key: 'userGrade', label: 'User Grade' },
  { key: 'userScore', label: 'User Score (0-5)' },
  { key: 'pickPriority', label: 'Pick Priority' },
  { key: 'archetypeRole', label: 'Archetype / Role' },
  { key: 'userNotes', label: 'User Notes' },
  { key: 'evaluatedAt', label: 'Evaluation Date' },
  { key: 'seventeenLandsGrade', label: '17Lands Tier' },
  { key: 'seventeenLandsGihWrPct', label: '17Lands GIH WR (%)' },
  { key: 'seventeenLandsGihWrDecimal', label: '17Lands GIH WR (Decimal)' },
  { key: 'seventeenLandsAlsa', label: '17Lands ALSA' },
  { key: 'seventeenLandsIwdPct', label: '17Lands IWD (%)' },
  { key: 'seventeenLandsSampleSize', label: '17Lands Games Played' },
  { key: 'seventeenLandsSeenCount', label: '17Lands Seen Count' },
  { key: 'seventeenLandsPickRatePct', label: '17Lands Pick Rate (%)' },
  { key: 'seventeenLandsOpeningHandWrPct', label: '17Lands Opening Hand WR (%)' },
  { key: 'seventeenLandsDrawnWrPct', label: '17Lands Drawn WR (%)' },
  { key: 'lsvGrade', label: 'LSV Grade' },
  { key: 'lsvScore', label: 'LSV Score (0-5)' },
  { key: 'lsvVerdict', label: 'LSV Verdict' },
  { key: 'deltaVs17LandsSteps', label: 'User vs 17Lands Delta (Steps)' },
  { key: 'comparisonStatusVs17Lands', label: '17Lands Calibration Status' },
  { key: 'deltaVsLsvSteps', label: 'User vs LSV Delta (Steps)' },
  { key: 'calibrationAccuracyPct', label: 'Calibration Accuracy (%)' },
  { key: 'scryfallUrl', label: 'Scryfall URL' },
  { key: 'seventeenLandsUrl', label: '17Lands Card URL' },
  { key: 'oracleText', label: 'Oracle Text' },
];

/**
 * Builds structured data rows containing all metadata, grades, 17Lands benchmarks, and LSV comparisons.
 */
export function buildFullSpreadsheetData(
  cards: Card[],
  evaluations: Record<string, UserCardEvaluation>,
  seventeenLandsData: SeventeenLandsSetData | null,
  setCode: string,
  options: { gradedOnly?: boolean } = {}
): FullSpreadsheetRow[] {
  const { gradedOnly = false } = options;
  const upperSet = setCode.toUpperCase();
  const rows: FullSpreadsheetRow[] = [];

  for (const card of cards) {
    const evalKey = `${(card.set || upperSet).toLowerCase()}_${card.name.toLowerCase()}`;
    const userEval = evaluations[evalKey];

    if (gradedOnly && !userEval?.userGrade) {
      continue;
    }

    // 17Lands Benchmark Data
    const landData = seventeenLandsData?.cards[card.name] ||
      seventeenLandsData?.cards[card.name.toLowerCase()] ||
      null;

    const actual17Tier: GradeTier | null = landData
      ? (landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate)
      : null;

    // LSV Benchmark Data
    const lsvRating = getLsvRatingForCard(card, upperSet);

    // Delta & Calibration Calculations
    let delta17Steps = '';
    let comparisonStatus = 'Unrated';
    let calibrationAcc = '';

    if (userEval?.userGrade && actual17Tier) {
      const userIdx = gradeTierToIndex(userEval.userGrade);
      const actualIdx = gradeTierToIndex(actual17Tier);
      const stepDiff = actualIdx - userIdx; // positive = user overrated, negative = user underrated
      delta17Steps = stepDiff > 0 ? `+${stepDiff}` : `${stepDiff}`;

      const absDiff = Math.abs(stepDiff);
      if (absDiff === 0) {
        comparisonStatus = 'Exact Match';
        calibrationAcc = '100%';
      } else if (absDiff === 1) {
        comparisonStatus = 'Close (±1 step)';
        calibrationAcc = '80%';
      } else if (stepDiff >= 2) {
        comparisonStatus = 'Trap (Overrated)';
        calibrationAcc = Math.max(0, 100 - absDiff * 25) + '%';
      } else {
        comparisonStatus = 'Sleeper (Underrated)';
        calibrationAcc = Math.max(0, 100 - absDiff * 25) + '%';
      }
    } else if (userEval?.userGrade && !actual17Tier) {
      comparisonStatus = '17Lands Pending';
    }

    let deltaLsvSteps = '';
    if (userEval?.userGrade && lsvRating?.grade) {
      const userIdx = gradeTierToIndex(userEval.userGrade);
      const lsvIdx = gradeTierToIndex(lsvRating.grade);
      const stepDiff = lsvIdx - userIdx;
      deltaLsvSteps = stepDiff > 0 ? `+${stepDiff}` : `${stepDiff}`;
    }

    // Role tags
    const roles: string[] = [];
    if (card.is_creature) roles.push('Creature');
    if (card.is_removal) roles.push('Removal');
    if (card.is_combat_trick) roles.push('Combat Trick');
    if (card.is_instant_speed) roles.push('Instant Speed');
    if (card.is_land) roles.push('Land');
    if (card.archetype_tag) roles.push(card.archetype_tag);

    rows.push({
      name: card.name,
      setCode: (card.set || upperSet).toUpperCase(),
      collectorNumber: card.collector_number || '',
      manaCost: card.mana_cost || '',
      cmc: card.cmc ?? 0,
      colors: (card.colors || []).join('') || 'Colorless',
      colorIdentity: (card.color_identity || []).join('') || 'Colorless',
      rarity: card.rarity || 'common',
      typeLine: card.type_line || '',
      power: card.power || '',
      toughness: card.toughness || '',
      keywords: (card.keywords || []).join(', '),
      roles: roles.join(', '),
      oracleText: card.oracle_text || '',

      // User Evaluation
      userGrade: userEval?.userGrade || 'Ungraded',
      userScore: userEval?.userScore !== undefined ? userEval.userScore.toFixed(1) : '',
      pickPriority: userEval?.pickPriority || '',
      archetypeRole: userEval?.archetypeRole || '',
      userNotes: userEval?.notes || '',
      evaluatedAt: userEval?.updatedAt ? new Date(userEval.updatedAt).toLocaleDateString() : '',

      // 17Lands Benchmarks
      seventeenLandsGrade: actual17Tier || (landData?.tier_grade || 'Pending'),
      seventeenLandsGihWrPct: landData && typeof landData.win_rate === 'number'
        ? `${(landData.win_rate * 100).toFixed(1)}%`
        : '',
      seventeenLandsGihWrDecimal: landData && typeof landData.win_rate === 'number'
        ? landData.win_rate.toFixed(4)
        : '',
      seventeenLandsAlsa: landData && typeof landData.avg_seen === 'number'
        ? landData.avg_seen.toFixed(2)
        : '',
      seventeenLandsIwdPct: landData && typeof landData.iwd === 'number'
        ? `${landData.iwd >= 0 ? '+' : ''}${(landData.iwd * 100).toFixed(1)}%`
        : '',
      seventeenLandsSampleSize: landData?.game_count !== undefined ? String(landData.game_count) : '',
      seventeenLandsSeenCount: landData?.seen_count !== undefined ? String(landData.seen_count) : '',
      seventeenLandsPickRatePct: landData && typeof landData.pick_rate === 'number'
        ? `${(landData.pick_rate * 100).toFixed(1)}%`
        : '',
      seventeenLandsOpeningHandWrPct: landData && typeof landData.opening_hand_win_rate === 'number'
        ? `${(landData.opening_hand_win_rate * 100).toFixed(1)}%`
        : '',
      seventeenLandsDrawnWrPct: landData && typeof landData.ever_drawn_win_rate === 'number'
        ? `${(landData.ever_drawn_win_rate * 100).toFixed(1)}%`
        : '',

      // LSV Review
      lsvGrade: lsvRating?.grade || 'Pending',
      lsvScore: lsvRating?.score !== undefined ? lsvRating.score.toFixed(1) : '',
      lsvVerdict: lsvRating?.verdict || '',

      // Comparison & Calibration Insights
      deltaVs17LandsSteps: delta17Steps,
      comparisonStatusVs17Lands: comparisonStatus,
      deltaVsLsvSteps: deltaLsvSteps,
      calibrationAccuracyPct: calibrationAcc,

      // External Links
      scryfallUrl: card.scryfall_uri || `https://scryfall.com/search?q=!"${encodeURIComponent(card.name)}"+set:${upperSet.toLowerCase()}`,
      seventeenLandsUrl: get17LandsCardUrl(upperSet, card, landData),
    });
  }

  return rows;
}

/**
 * Generates full comparison CSV formatted with UTF-8 BOM for Microsoft Excel / Numbers.
 */
export function generateFullSpreadsheetCsv(
  cards: Card[],
  evaluations: Record<string, UserCardEvaluation>,
  seventeenLandsData: SeventeenLandsSetData | null,
  setCode: string,
  options: { gradedOnly?: boolean } = {}
): string {
  const rows = buildFullSpreadsheetData(cards, evaluations, seventeenLandsData, setCode, options);
  const headerLine = FULL_SPREADSHEET_HEADERS.map((h) => escapeCsvField(h.label)).join(',');
  const lines: string[] = [headerLine];

  for (const row of rows) {
    const line = FULL_SPREADSHEET_HEADERS.map((h) => escapeCsvField(row[h.key])).join(',');
    lines.push(line);
  }

  // Prepend UTF-8 BOM to guarantee proper Unicode rendering in Microsoft Excel
  return '\uFEFF' + lines.join('\n');
}

/**
 * Generates TSV (Tab-Separated Values) ready to paste into Google Sheets.
 */
export function generateFullSpreadsheetTsv(
  cards: Card[],
  evaluations: Record<string, UserCardEvaluation>,
  seventeenLandsData: SeventeenLandsSetData | null,
  setCode: string,
  options: { gradedOnly?: boolean } = {}
): string {
  const rows = buildFullSpreadsheetData(cards, evaluations, seventeenLandsData, setCode, options);
  const headerLine = FULL_SPREADSHEET_HEADERS.map((h) => escapeTsvField(h.label)).join('\t');
  const lines: string[] = [headerLine];

  for (const row of rows) {
    const line = FULL_SPREADSHEET_HEADERS.map((h) => escapeTsvField(row[h.key])).join('\t');
    lines.push(line);
  }

  return lines.join('\n');
}

// ==================== BROWSER DOWNLOAD & CLIPBOARD UTILITIES ====================

/**
 * Triggers an immediate browser file download.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.setAttribute('download', filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Copies string text to clipboard with modern API and fallback support.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Modern clipboard write failed, using fallback:', err);
  }

  // Fallback for non-secure contexts or older browsers
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Clipboard copy fallback failed:', err);
    return false;
  }
}
