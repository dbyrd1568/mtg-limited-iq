import {
  escapeCsvField,
  escapeTsvField,
  generate17LandsTiersCsv,
  generateFullSpreadsheetCsv,
  generateFullSpreadsheetTsv,
  buildFullSpreadsheetData,
  FULL_SPREADSHEET_HEADERS,
} from '../services/gradeExport';
import { Card, UserCardEvaluation, SeventeenLandsSetData } from '../types/mtg';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- RUNNING GRADE EXPORT & 17LANDS VERIFICATION TESTS ---');

// Mock Card Data
const mockCards: Card[] = [
  {
    id: 'c1',
    name: 'Lightning Strike',
    set: 'dft',
    set_name: 'Aetherdrift',
    collector_number: '123',
    mana_cost: '{1}{R}',
    cmc: 2,
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'uncommon',
    type_line: 'Instant',
    oracle_text: 'Lightning Strike deals 3 damage to any target.',
    keywords: [],
    is_removal: true,
    is_instant_speed: true,
  },
  {
    id: 'c2',
    name: 'Colossal Dreadmaw, the Mighty',
    set: 'dft',
    set_name: 'Aetherdrift',
    collector_number: '124',
    mana_cost: '{4}{G}{G}',
    cmc: 6,
    colors: ['G'],
    color_identity: ['G'],
    rarity: 'common',
    type_line: 'Creature — Dinosaur',
    power: '6',
    toughness: '6',
    oracle_text: 'Trample\n"If you feel the ground quake, run."',
    keywords: ['Trample'],
    is_creature: true,
  },
  {
    id: 'c3',
    name: 'Ungraded Mystery Card',
    set: 'dft',
    set_name: 'Aetherdrift',
    collector_number: '125',
    mana_cost: '{2}{U}',
    cmc: 3,
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'rare',
    type_line: 'Enchantment',
    keywords: [],
  },
];

// Mock User Evaluations
const mockEvaluations: Record<string, UserCardEvaluation> = {
  'dft_lightning strike': {
    cardId: 'c1',
    cardName: 'Lightning Strike',
    setCode: 'dft',
    userGrade: 'A-',
    userScore: 4.0,
    pickPriority: 'Early Pick',
    archetypeRole: 'Premium Removal',
    notes: 'Premier red removal; snaps pick 1 in most packs.',
    updatedAt: '2026-09-12T10:00:00.000Z',
  },
  'dft_colossal dreadmaw, the mighty': {
    cardId: 'c2',
    cardName: 'Colossal Dreadmaw, the Mighty',
    setCode: 'dft',
    userGrade: 'C+',
    userScore: 2.5,
    pickPriority: 'Mid Pick',
    archetypeRole: 'Green Stompy Engine',
    notes: 'Solid top-end for dinosaur synergy decks.',
    updatedAt: '2026-09-12T10:00:00.000Z',
  },
};

// Mock 17Lands Set Data
const mock17LandsData: SeventeenLandsSetData = {
  setCode: 'DFT',
  setName: 'Aetherdrift',
  format: 'PremierDraft',
  sampleSize: 25000,
  updatedAt: '2026-09-12T00:00:00.000Z',
  cards: {
    'Lightning Strike': {
      name: 'Lightning Strike',
      color: 'R',
      rarity: 'uncommon',
      seen_count: 14200,
      avg_seen: 2.8,
      pick_rate: 0.88,
      game_count: 18500,
      win_rate: 0.584,
      iwd: 0.042,
      tier_grade: 'A-',
    },
    'Colossal Dreadmaw, the Mighty': {
      name: 'Colossal Dreadmaw, the Mighty',
      color: 'G',
      rarity: 'common',
      seen_count: 8500,
      avg_seen: 5.4,
      pick_rate: 0.42,
      game_count: 9200,
      win_rate: 0.542,
      iwd: -0.015,
      tier_grade: 'C',
    },
  },
};

// ==================== TEST 1: CSV Escaping ====================
console.log('Test 1: CSV & TSV Escaping...');
assert(escapeCsvField('Normal') === 'Normal', 'Plain text escaping');
assert(escapeCsvField('Hello, World') === '"Hello, World"', 'Comma wrapping');
assert(escapeCsvField('Quotes "Inside"') === '"Quotes ""Inside"""', 'Quote doubling');
assert(escapeCsvField('Line 1\nLine 2') === '"Line 1\nLine 2"', 'Newline wrapping');
assert(escapeTsvField('Line 1\nLine 2') === 'Line 1 Line 2', 'TSV newline stripping');
assert(escapeTsvField('Col\t1') === 'Col 1', 'TSV tab stripping');
console.log('✓ Test 1 Passed!');

// ==================== TEST 2: 17Lands CSV Export ====================
console.log('Test 2: 17Lands Tier List CSV Export...');
const seventeenLandsCsvAll = generate17LandsTiersCsv(mockCards, mockEvaluations, { gradedOnly: false });
const seventeenLandsLines = seventeenLandsCsvAll.split('\n');

assert(seventeenLandsLines[0] === 'Name,Tier,Buildaround,Synergy,Comment', '17Lands header matches schema');
assert(seventeenLandsLines.length === 4, '1 header + 3 cards');

// Check Lightning Strike row
const rowLightning = seventeenLandsLines.find((l) => l.startsWith('Lightning Strike'));
assert(Boolean(rowLightning), 'Lightning Strike present in 17Lands CSV');
assert(rowLightning!.includes('A-'), 'Lightning Strike user grade mapped to Tier');

// Check card with commas in name: Colossal Dreadmaw, the Mighty
const rowDreadmaw = seventeenLandsLines.find((l) => l.startsWith('"Colossal Dreadmaw, the Mighty"'));
assert(Boolean(rowDreadmaw), 'Escaped comma in name');
assert(rowDreadmaw!.includes('C+'), 'Dreadmaw user grade mapped');
assert(rowDreadmaw!.includes('1'), 'Synergy/buildaround detected from role/notes');

// Check Graded Only scope
const seventeenLandsGradedOnly = generate17LandsTiersCsv(mockCards, mockEvaluations, { gradedOnly: true });
const gradedOnlyLines = seventeenLandsGradedOnly.split('\n');
assert(gradedOnlyLines.length === 3, '1 header + 2 graded cards (ungraded card omitted)');
console.log('✓ Test 2 Passed!');

// ==================== TEST 3: Full Comparison Spreadsheet Data ====================
console.log('Test 3: Full Comparison Spreadsheet (CSV / TSV)...');
const fullRows = buildFullSpreadsheetData(mockCards, mockEvaluations, mock17LandsData, 'DFT', { gradedOnly: false });

assert(fullRows.length === 3, '3 full rows built');
assert(FULL_SPREADSHEET_HEADERS.length === 39, '39 total comparison and metadata columns');

const lightningRow = fullRows.find((r) => r.name === 'Lightning Strike')!;
assert(lightningRow.userGrade === 'A-', 'User grade present');
assert(lightningRow.seventeenLandsGrade === 'A-', '17Lands tier grade present');
assert(lightningRow.seventeenLandsGihWrPct === '58.4%', 'GIH WR formatted as percentage');
assert(lightningRow.seventeenLandsGihWrDecimal === '0.5840', 'GIH WR decimal formatted');
assert(lightningRow.seventeenLandsAlsa === '2.80', 'ALSA formatted');
assert(lightningRow.seventeenLandsIwdPct === '+4.2%', 'IWD formatted with sign');
assert(lightningRow.comparisonStatusVs17Lands === 'Exact Match', 'Exact tier match detection');
assert(lightningRow.deltaVs17LandsSteps === '0', 'Zero delta steps');
assert(lightningRow.calibrationAccuracyPct === '100%', '100% calibration score');

const dreadmawRow = fullRows.find((r) => r.name === 'Colossal Dreadmaw, the Mighty')!;
// User C+ (idx 6), 17Lands C (idx 7): delta +1 step
assert(dreadmawRow.deltaVs17LandsSteps === '+1', 'Delta calculation (+1 step)');
assert(dreadmawRow.comparisonStatusVs17Lands === 'Close (±1 step)', 'Close step detection');

// Verify CSV output with UTF-8 BOM
const fullCsv = generateFullSpreadsheetCsv(mockCards, mockEvaluations, mock17LandsData, 'DFT', { gradedOnly: false });
assert(fullCsv.startsWith('\uFEFF'), 'CSV begins with UTF-8 BOM for Microsoft Excel');
assert(fullCsv.includes('Card Name'), 'Contains Card Name header');
assert(fullCsv.includes('17Lands GIH WR (%)'), 'Contains 17Lands GIH WR column');
assert(fullCsv.includes('LSV Grade'), 'Contains LSV Grade column');
assert(fullCsv.includes('User vs 17Lands Delta (Steps)'), 'Contains Delta column');

// Verify TSV output
const fullTsv = generateFullSpreadsheetTsv(mockCards, mockEvaluations, mock17LandsData, 'DFT', { gradedOnly: false });
assert(fullTsv.includes('\t'), 'TSV contains tab separators');
assert(!fullTsv.startsWith('\uFEFF'), 'TSV does not have BOM so paste is clean');
const tsvLines = fullTsv.split('\n');
assert(tsvLines[0].split('\t').length === FULL_SPREADSHEET_HEADERS.length, 'TSV column count matches headers');
console.log('✓ Test 3 Passed!');

console.log('--- ALL GRADE EXPORT TESTS PASSED SUCCESSFULLY! ---');
