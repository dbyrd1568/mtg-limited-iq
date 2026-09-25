import assert from 'node:assert';
import { Card, UserCardEvaluation } from '../types/mtg';
import { calculateColorRankings, generateSetSynthesisReport } from '../services/archetypeEvaluator';
import { cardMatchesQuery } from '../services/cardSearchParser';

console.log('=== STARTING COLORLESS CARD COUNT & REPORT VERIFICATION ===\n');

// Sample cards representing typical Scryfall normalized output
const sampleCards: Card[] = [
  // White card
  {
    id: 'w1',
    name: 'Savannah Lions',
    set: 'SOS',
    set_name: 'Secrets of Strixhaven',
    collector_number: '1',
    mana_cost: '{W}',
    cmc: 1,
    type_line: 'Creature — Cat',
    colors: ['W'],
    color_identity: ['W'],
    rarity: 'common',
    keywords: [],
  },
  // Colorless Artifact Creature (Scryfall normalizer sets colors: ['C'])
  {
    id: 'c1',
    name: 'Patchwork Banner',
    set: 'SOS',
    set_name: 'Secrets of Strixhaven',
    collector_number: '200',
    mana_cost: '{3}',
    cmc: 3,
    type_line: 'Artifact',
    colors: ['C'],
    color_identity: [],
    rarity: 'uncommon',
    keywords: [],
  },
  // Colorless Artifact Creature with empty colors array (legacy mock format)
  {
    id: 'c2',
    name: 'Three Tree Mascot',
    set: 'SOS',
    set_name: 'Secrets of Strixhaven',
    collector_number: '201',
    mana_cost: '{2}',
    cmc: 2,
    type_line: 'Artifact Creature — Construct',
    colors: [],
    color_identity: [],
    rarity: 'common',
    keywords: [],
  },
  // Colorless Eldrazi Spell
  {
    id: 'c3',
    name: 'Sundering Archaic',
    set: 'SOS',
    set_name: 'Secrets of Strixhaven',
    collector_number: '202',
    mana_cost: '{5}',
    cmc: 5,
    type_line: 'Creature — Archaic',
    colors: ['C'],
    color_identity: [],
    rarity: 'rare',
    keywords: [],
  },
  // Basic Land (colorless land, must NOT be counted in Colorless spell pool)
  {
    id: 'l1',
    name: 'Plains',
    set: 'SOS',
    set_name: 'Secrets of Strixhaven',
    collector_number: '250',
    mana_cost: '',
    cmc: 0,
    type_line: 'Basic Land — Plains',
    is_land: true,
    colors: ['C'],
    color_identity: ['W'],
    rarity: 'common',
    keywords: [],
  },
  // Nonbasic Utility Land (colorless land, must NOT be counted in Colorless spell pool)
  {
    id: 'l2',
    name: 'Unknown Shores',
    set: 'SOS',
    set_name: 'Secrets of Strixhaven',
    collector_number: '251',
    mana_cost: '',
    cmc: 0,
    type_line: 'Land',
    is_land: true,
    colors: ['C'],
    color_identity: [],
    rarity: 'common',
    keywords: [],
  },
];

// User evaluations: evaluate 1 of the 3 colorless cards
const mockEvaluations: Record<string, UserCardEvaluation> = {
  'sos_patchwork banner': {
    cardId: 'c1',
    cardName: 'Patchwork Banner',
    setCode: 'SOS',
    userGrade: 'B+',
    userScore: 3.5,
    pickPriority: 'Early Pick',
    updatedAt: new Date().toISOString(),
  },
};

console.log('Test 1: calculateColorRankings correctly detects colorless cards...');
const colorRankings = calculateColorRankings(sampleCards, mockEvaluations, null, 'SOS');
const colorless = colorRankings.find((c) => c.color === 'C');

assert(Boolean(colorless), 'Colorless entry must exist in colorRankings');
console.log(`   Colorless totalCards: ${colorless!.totalCards}`);
console.log(`   Colorless ratedCards: ${colorless!.ratedCards}`);
console.log(`   Colorless letterGrade: ${colorless!.letterGrade} (${colorless!.averageScore})`);

assert.strictEqual(colorless!.totalCards, 3, 'Must detect 3 non-land colorless cards (c1, c2, c3)');
assert.strictEqual(colorless!.ratedCards, 1, 'Must detect 1 rated colorless card');
assert.strictEqual(colorless!.letterGrade, 'B', 'Grade must reflect evaluated card (3.5 = B)');
assert.strictEqual(colorless!.averageScore, 3.5, 'Average score must be 3.5');
console.log('   ✓ calculateColorRankings correctly counted colorless non-land cards.\n');

console.log('Test 2: generateSetSynthesisReport integrates colorless correctly...');
const report = generateSetSynthesisReport(sampleCards, mockEvaluations, 'SOS', 'Secrets of Strixhaven');
const reportColorless = report.colorRankings.find((c) => c.color === 'C');

assert(Boolean(reportColorless), 'Report must contain Colorless ranking');
assert.strictEqual(reportColorless!.totalCards, 3, 'Report must have 3 total colorless cards');
assert.strictEqual(reportColorless!.ratedCards, 1, 'Report must have 1 rated colorless card');
console.log('   ✓ generateSetSynthesisReport correctly propagated colorless stats.\n');

console.log('Test 3: Search parser matches c:c / color:colorless for cards with colors: [\'C\']...');
const matchedCards = sampleCards.filter((c) => cardMatchesQuery(c, 'c:c', 'SOS'));
const matchedNames = matchedCards.map((c) => c.name);

console.log('   Matched cards for c:c:', matchedNames);
assert(matchedNames.includes('Patchwork Banner'), 'Must match Patchwork Banner (colors: [\'C\'])');
assert(matchedNames.includes('Three Tree Mascot'), 'Must match Three Tree Mascot (colors: [])');
assert(matchedNames.includes('Sundering Archaic'), 'Must match Sundering Archaic (colors: [\'C\'])');
assert(!matchedNames.includes('Savannah Lions'), 'Must NOT match Savannah Lions (colors: [\'W\'])');
console.log('   ✓ Search parser c:c accurately matches all colorless cards.\n');

console.log('🎉 ALL COLORLESS VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
