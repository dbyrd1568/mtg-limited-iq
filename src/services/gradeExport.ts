import { Card, UserCardEvaluation, SeventeenLandsSetData, GradeTier, ProCreatorSource } from '../types/mtg';
import {
  getLsvRatingForCard,
  getProRatingForCard,
  getAvailableReviewersForSet,
  AvailableReviewer,
} from './lsvRatings';
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
  const VALID_17LANDS_TIERS = new Set(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'SB', 'TBD', '-']);

  for (const card of cards) {
    const evalKey = `${(card.set || '').toLowerCase()}_${card.name.toLowerCase()}`;
    const userEval = evaluations[evalKey];

    if (gradedOnly && !userEval?.userGrade) {
      continue;
    }

    const rawName = card.name.trim();
    // 17Lands catalogs multi-faced cards (DFCs, adventures, battles) by front-face name
    const name = rawName.includes(' // ') ? rawName.split(' // ')[0].trim() : rawName;
    
    const rawTier = userEval?.userGrade || '';
    let tier: string = rawTier;
    if (rawTier === 'N/A') {
      // Lands and cards marked N/A are excluded from draft grading. 17Lands rejects 'N/A' as a bad row;
      // map to 'SB' (Sideboard) so it imports cleanly into 17Lands.
      tier = 'SB';
    } else if (rawTier && !VALID_17LANDS_TIERS.has(rawTier)) {
      tier = '';
    }

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

/**
 * Generates an executable JavaScript bookmarklet that, when clicked on a 17Lands tier list page,
 * automatically uploads the user's grades directly to 17Lands' upload API and refreshes the page,
 * placing every card in its assigned tier without needing to touch a file picker.
 */
export function generate17LandsAutoImportBookmarklet(csvContent: string): string {
  const code = `(function(){
    var m = window.location.pathname.match(/\\/(?:tier_list|card_tiers)\\/([^/?#]+)/);
    if (!m) {
      alert('Please open your 17Lands Tier List page (e.g. https://www.17lands.com/tier_list/...) before clicking this bookmarklet.');
      return;
    }
    var reviewId = m[1];
    var csv = ${JSON.stringify(csvContent)};
    var formData = new FormData();
    formData.append('file', new Blob([csv], { type: 'text/csv' }), 'grades.csv');
    fetch('/card_tiers/data/' + reviewId + '/upload', {
      method: 'POST',
      body: formData
    }).then(function(res) {
      if (res.ok) {
        window.location.href = '/tier_list/' + reviewId;
      } else {
        alert('17Lands returned an error importing tiers. Please verify you are logged in to 17Lands.');
      }
    }).catch(function(err) {
      alert('Failed to send grades to 17Lands: ' + err);
    });
  })()`;
  return `javascript:${encodeURIComponent(code)}`;
}

/**
 * Generates a JavaScript snippet that can be pasted directly into the browser DevTools console
 * on 17Lands to instantly apply all card grades to the active tier list.
 */
export function generate17LandsConsoleScript(csvContent: string): string {
  return `(function() {
  const m = window.location.pathname.match(/\\/(?:tier_list|card_tiers)\\/([^/?#]+)/);
  if (!m) {
    alert('Please open your 17Lands Tier List page before running this script.');
    return;
  }
  const reviewId = m[1];
  const csv = ${JSON.stringify(csvContent)};
  const formData = new FormData();
  formData.append('file', new Blob([csv], { type: 'text/csv' }), 'grades.csv');
  console.log('⚡ Applying grades to 17Lands tier list:', reviewId);
  fetch('/card_tiers/data/' + reviewId + '/upload', {
    method: 'POST',
    body: formData
  }).then(res => {
    if (res.ok) {
      console.log('✅ Grades applied successfully! Refreshing...');
      window.location.href = '/tier_list/' + reviewId;
    } else {
      alert('17Lands upload failed. Make sure you are logged in on 17Lands.');
    }
  }).catch(err => alert('Error: ' + err));
})();`;
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

  // Reviewer Benchmarks (LSV, LLU, DS, etc.)
  lsvGrade?: string;
  lsvScore?: string;
  lsvVerdict?: string;
  lluGrade?: string;
  lluScore?: string;
  lluVerdict?: string;
  dsGrade?: string;
  dsScore?: string;
  dsVerdict?: string;

  // Comparison & Calibration Insights
  deltaVs17LandsSteps: string;
  comparisonStatusVs17Lands: string;
  deltaVsLsvSteps?: string;
  deltaVsLluSteps?: string;
  deltaVsDsSteps?: string;
  calibrationAccuracyPct: string;

  // External Links
  scryfallUrl: string;
  seventeenLandsUrl: string;

  // Index signature for dynamic reviewer columns
  [key: string]: any;
}

export interface SpreadsheetHeader {
  key: string;
  label: string;
}

/**
 * Returns dynamic spreadsheet headers including all reviewers that have data.
 */
export function getFullSpreadsheetHeaders(reviewers: AvailableReviewer[]): SpreadsheetHeader[] {
  const headers: SpreadsheetHeader[] = [
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
  ];

  // Pro Creator Review Benchmarks (Grade, Score, Verdict) for each reviewer with data
  for (const rev of reviewers) {
    const prefix = rev.shortName;
    const idKey = rev.id.toLowerCase();
    headers.push(
      { key: `${idKey}Grade`, label: `${prefix} Grade` },
      { key: `${idKey}Score`, label: `${prefix} Score (0-5)` },
      { key: `${idKey}Verdict`, label: `${prefix} Verdict` },
    );
  }

  // 17Lands calibration deltas
  headers.push(
    { key: 'deltaVs17LandsSteps', label: 'User vs 17Lands Delta (Steps)' },
    { key: 'comparisonStatusVs17Lands', label: '17Lands Calibration Status' },
  );

  // Pro Creator Step Deltas
  for (const rev of reviewers) {
    const prefix = rev.shortName;
    headers.push(
      { key: `deltaVs${rev.id === 'LSV' ? 'Lsv' : rev.id}Steps`, label: `User vs ${prefix} Delta (Steps)` }
    );
  }

  headers.push(
    { key: 'calibrationAccuracyPct', label: 'Calibration Accuracy (%)' },
    { key: 'scryfallUrl', label: 'Scryfall URL' },
    { key: 'seventeenLandsUrl', label: '17Lands Card URL' },
    { key: 'oracleText', label: 'Oracle Text' },
  );

  return headers;
}

export const DEFAULT_REVIEWERS: AvailableReviewer[] = [
  { id: 'LSV', shortName: 'LSV', name: 'Luis Scott-Vargas', sourceLabel: 'Limited Resources' },
  { id: 'LLU', shortName: 'LLU', name: 'Limited Level Ups', sourceLabel: 'Alex Nikolic' },
  { id: 'DS', shortName: 'DS', name: 'Draftsim', sourceLabel: 'Draftsim.com' },
];

export const FULL_SPREADSHEET_HEADERS: { key: keyof FullSpreadsheetRow | string; label: string }[] =
  getFullSpreadsheetHeaders(DEFAULT_REVIEWERS);

/**
 * Builds structured data rows containing all metadata, grades, 17Lands benchmarks, and pro reviewer comparisons.
 */
export function buildFullSpreadsheetData(
  cards: Card[],
  evaluations: Record<string, UserCardEvaluation>,
  seventeenLandsData: SeventeenLandsSetData | null,
  setCode: string,
  options: { gradedOnly?: boolean; reviewers?: AvailableReviewer[] } = {}
): FullSpreadsheetRow[] {
  const { gradedOnly = false } = options;
  const upperSet = setCode.toUpperCase();
  const reviewers = options.reviewers || getAvailableReviewersForSet(setCode, cards);
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

    // Delta & Calibration Calculations vs 17Lands
    let delta17Steps = '';
    let comparisonStatus = 'Unrated';
    let calibrationAcc = '';

    if (userEval?.userGrade && actual17Tier) {
      const userIdx = gradeTierToIndex(userEval.userGrade);
      const actualIdx = gradeTierToIndex(actual17Tier);
      const stepDiff = actualIdx - userIdx;
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

    // Role tags
    const roles: string[] = [];
    if (card.is_creature) roles.push('Creature');
    if (card.is_removal) roles.push('Removal');
    if (card.is_combat_trick) roles.push('Combat Trick');
    if (card.is_instant_speed) roles.push('Instant Speed');
    if (card.is_land) roles.push('Land');
    if (card.archetype_tag) roles.push(card.archetype_tag);

    const row: FullSpreadsheetRow = {
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

      // Comparison & Calibration Insights
      deltaVs17LandsSteps: delta17Steps,
      comparisonStatusVs17Lands: comparisonStatus,
      calibrationAccuracyPct: calibrationAcc,

      // External Links
      scryfallUrl: card.scryfall_uri || `https://scryfall.com/search?q=!"${encodeURIComponent(card.name)}"+set:${upperSet.toLowerCase()}`,
      seventeenLandsUrl: get17LandsCardUrl(upperSet, card, landData),
    };

    // Reviewer Ratings & Deltas
    for (const rev of reviewers) {
      const rating = getProRatingForCard(card, rev.id as ProCreatorSource, upperSet);
      const idKey = rev.id.toLowerCase();
      row[`${idKey}Grade`] = rating?.grade || 'Pending';
      row[`${idKey}Score`] = rating?.score !== undefined ? rating.score.toFixed(1) : '';
      row[`${idKey}Verdict`] = rating?.verdict || '';

      let deltaSteps = '';
      if (userEval?.userGrade && rating?.grade) {
        const userIdx = gradeTierToIndex(userEval.userGrade);
        const revIdx = gradeTierToIndex(rating.grade);
        if (userIdx >= 0 && revIdx >= 0) {
          const stepDiff = revIdx - userIdx;
          deltaSteps = stepDiff > 0 ? `+${stepDiff}` : `${stepDiff}`;
        }
      }
      const camelId = rev.id.charAt(0).toUpperCase() + rev.id.slice(1).toLowerCase();
      row[`deltaVs${rev.id}Steps`] = deltaSteps;
      row[`deltaVs${camelId}Steps`] = deltaSteps;
    }

    // Backward-compatibility aliases for LSV
    if (!row.lsvGrade && row['lsvGrade']) row.lsvGrade = row['lsvGrade'];
    if (!row.lsvScore && row['lsvScore']) row.lsvScore = row['lsvScore'];
    if (!row.lsvVerdict && row['lsvVerdict']) row.lsvVerdict = row['lsvVerdict'];
    if (!row.deltaVsLsvSteps && row['deltaVsLsvSteps']) row.deltaVsLsvSteps = row['deltaVsLsvSteps'];

    rows.push(row);
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
  options: { gradedOnly?: boolean; reviewers?: AvailableReviewer[] } = {}
): string {
  const reviewers = options.reviewers || getAvailableReviewersForSet(setCode, cards);
  const headers = getFullSpreadsheetHeaders(reviewers);
  const rows = buildFullSpreadsheetData(cards, evaluations, seventeenLandsData, setCode, { ...options, reviewers });
  const headerLine = headers.map((h) => escapeCsvField(h.label)).join(',');
  const lines: string[] = [headerLine];

  for (const row of rows) {
    const line = headers.map((h) => escapeCsvField(row[h.key])).join(',');
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
  options: { gradedOnly?: boolean; reviewers?: AvailableReviewer[] } = {}
): string {
  const reviewers = options.reviewers || getAvailableReviewersForSet(setCode, cards);
  const headers = getFullSpreadsheetHeaders(reviewers);
  const rows = buildFullSpreadsheetData(cards, evaluations, seventeenLandsData, setCode, { ...options, reviewers });
  const headerLine = headers.map((h) => escapeTsvField(h.label)).join('\t');
  const lines: string[] = [headerLine];

  for (const row of rows) {
    const line = headers.map((h) => escapeTsvField(row[h.key])).join('\t');
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
