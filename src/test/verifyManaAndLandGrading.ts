import assert from 'node:assert';
import { Card, UserCardEvaluation, SeventeenLandsSetData } from '../types/mtg';
import { calculateSetCalibration, GRADE_SCORES, gradeTierToIndex } from '../services/seventeenLands';

console.log('=== Verifying Mana Cost Splitting & Land N/A Math Exclusion ===\n');

// 1. Verify Regex for Multi-Face Mana Cost Splitting
console.log('Test 1: Mana Cost Splitting (Stapled spells, split cards, adventures)...');
const splitRegex = /\s*(?:\/{2,}|\/(?![^{]*\}))\s*/;

const pyreRhymerMana = '{1}{R}{R} // {R}';
const pyreFaces = pyreRhymerMana.split(splitRegex);
assert.deepStrictEqual(pyreFaces, ['{1}{R}{R}', '{R}'], 'Pyre Rhymer // Molten Tide must split into 2 faces');

const hybridMana = '{W/U}{R}';
const hybridFaces = hybridMana.split(splitRegex);
assert.deepStrictEqual(hybridFaces, ['{W/U}{R}'], 'Hybrid mana {W/U} must not be split by slash inside braces');

const hybridSplitMana = '{2/W}{U/B} // {R/G}';
const hybridSplitFaces = hybridSplitMana.split(splitRegex);
assert.deepStrictEqual(hybridSplitFaces, ['{2/W}{U/B}', '{R/G}'], 'Hybrid split cards must split faces while keeping symbols intact');

console.log('✓ Multi-face mana cost splitting verified.\n');

// 2. Verify Land & N/A Exclusion from Calibration Math
console.log('Test 2: Land & N/A Exclusion from Calibration Math...');

const sampleCards: Card[] = [
  {
    id: 'c1',
    name: 'Pyre Rhymer // Molten Tide',
    set: 'FRA',
    set_name: 'Reality Fracture',
    collector_number: '91',
    mana_cost: '{1}{R}{R} // {R}',
    cmc: 3,
    type_line: 'Creature — Elemental Sorcerer // Instant',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'rare',
    keywords: ['Prowess', 'Prepared'],
  },
  {
    id: 'c2',
    name: 'Lightning Strike',
    set: 'FRA',
    set_name: 'Reality Fracture',
    collector_number: '92',
    mana_cost: '{1}{R}',
    cmc: 2,
    type_line: 'Instant',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'common',
    keywords: [],
  },
  {
    id: 'c3',
    name: 'Mountain Valley Dual',
    set: 'FRA',
    set_name: 'Reality Fracture',
    collector_number: '250',
    mana_cost: '',
    cmc: 0,
    type_line: 'Land',
    is_land: true,
    colors: [],
    color_identity: ['R', 'G'],
    rarity: 'common',
    keywords: [],
  },
  {
    id: 'c4',
    name: 'Basic Mountain',
    set: 'FRA',
    set_name: 'Reality Fracture',
    collector_number: '251',
    mana_cost: '',
    cmc: 0,
    type_line: 'Basic Land — Mountain',
    is_land: true,
    colors: [],
    color_identity: ['R'],
    rarity: 'common',
    keywords: [],
  },
];

const mock17LData: SeventeenLandsSetData = {
  setCode: 'FRA',
  setName: 'Reality Fracture',
  format: 'PremierDraft',
  sampleSize: 5000,
  updatedAt: new Date().toISOString(),
  cards: {
    'Pyre Rhymer // Molten Tide': {
      name: 'Pyre Rhymer // Molten Tide',
      color: 'R',
      rarity: 'rare',
      pick_rate: 0.5,
      iwd: 0.02,
      win_rate: 0.585,
      tier_grade: 'A-',
      avg_seen: 2.5,
      seen_count: 1000,
      game_count: 5000,
    },
    'Lightning Strike': {
      name: 'Lightning Strike',
      color: 'R',
      rarity: 'common',
      pick_rate: 0.5,
      iwd: 0.02,
      win_rate: 0.58,
      tier_grade: 'A-',
      avg_seen: 2.8,
      seen_count: 2000,
      game_count: 6000,
    },
    'Mountain Valley Dual': {
      name: 'Mountain Valley Dual',
      color: 'R',
      rarity: 'common',
      pick_rate: 0.5,
      iwd: 0.0,
      win_rate: 0.52,
      tier_grade: 'C+',
      avg_seen: 6.0,
      seen_count: 3000,
      game_count: 7000,
    },
    'Basic Mountain': {
      name: 'Basic Mountain',
      color: 'R',
      rarity: 'common',
      pick_rate: 0.5,
      iwd: 0.0,
      win_rate: 0.50,
      tier_grade: 'C-',
      avg_seen: 9.0,
      seen_count: 5000,
      game_count: 10000,
    },
  },
};

const userEvaluations: Record<string, UserCardEvaluation> = {
  'fra_pyre rhymer // molten tide': {
    cardId: 'c1',
    cardName: 'Pyre Rhymer // Molten Tide',
    setCode: 'FRA',
    userGrade: 'A', // 1 step off from A- (counts as correct)
    userScore: GRADE_SCORES['A'],
    pickPriority: '1st Pick Bomb',
    updatedAt: new Date().toISOString(),
  },
  'fra_lightning strike': {
    cardId: 'c2',
    cardName: 'Lightning Strike',
    setCode: 'FRA',
    userGrade: 'A-', // Exact match
    userScore: GRADE_SCORES['A-'],
    pickPriority: '1st Pick Bomb',
    updatedAt: new Date().toISOString(),
  },
  'fra_mountain valley dual': {
    cardId: 'c3',
    cardName: 'Mountain Valley Dual',
    setCode: 'FRA',
    userGrade: 'N/A', // Marked N/A
    userScore: GRADE_SCORES['N/A'],
    pickPriority: 'Sideboard / Unplayable',
    updatedAt: new Date().toISOString(),
  },
  'fra_basic mountain': {
    cardId: 'c4',
    cardName: 'Basic Mountain',
    setCode: 'FRA',
    userGrade: 'F', // Even if someone had given it an F, as a land it must not muddy the math
    userScore: GRADE_SCORES['F'],
    pickPriority: 'Sideboard / Unplayable',
    updatedAt: new Date().toISOString(),
  },
};

const summary = calculateSetCalibration(sampleCards, userEvaluations, mock17LData);

console.log('Calibration Summary Output:');
console.log(`- Total Rated: ${summary.totalRated} (Expected: 2, non-lands only)`);
console.log(`- Total Gradable Cards: ${summary.totalCards} (Expected: 2, non-lands)`);
console.log(`- Exact Matches: ${summary.exactMatches} (Expected: 1)`);
console.log(`- One Step Matches: ${summary.oneStepMatches} (Expected: 1)`);
console.log(`- Calibration Score: ${summary.calibrationScore}% (Expected: 100%)`);
console.log(`- Traps Count: ${summary.biggestTraps.length} (Expected: 0)`);
console.log(`- Sleepers Count: ${summary.biggestSleepers.length} (Expected: 0)`);

assert.strictEqual(summary.totalRated, 2, 'Only non-lands should be counted in totalRated');
assert.strictEqual(summary.calibrationScore, 100, 'Calibration score must be 100% since both spells were <= 1 step off');
assert.strictEqual(summary.biggestTraps.length, 0, 'Basic mountain must NOT appear as a trap despite F vs C-');
assert.strictEqual(summary.biggestSleepers.length, 0, 'Lands must NOT appear in sleepers');

// Verify N/A grade score mapping
assert.strictEqual(GRADE_SCORES['N/A'], 0, 'N/A grade score must be 0');
assert.strictEqual(gradeTierToIndex('N/A'), -1, 'N/A tier index must be -1');

console.log('\n🎉 ALL MANA SPLITTING AND LAND N/A MATH TESTS PASSED!');
