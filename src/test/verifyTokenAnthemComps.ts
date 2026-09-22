import {
  calculateCardSimilarity,
  extractCardFeatures,
  findExactOracleClauseMatch,
  buildScryfallQueries,
  generateGuaranteedFallbackResult,
} from '../services/cardSimilarity';
import { Card } from '../types/mtg';

console.log('=== Verifying Progressive Oracle Clause Decomposition & Token Anthem (Gideon\'s Memorial) ===\n');

// Target card: Gideon's Memorial (FRA, Rare #198, {1}{W} Legendary Artifact)
const gideonsMemorial: Card = {
  id: 'gideons-memorial',
  name: "Gideon's Memorial",
  set: 'FRA',
  set_name: 'Reality Fracture',
  collector_number: '198',
  mana_cost: '{1}{W}',
  cmc: 2,
  type_line: 'Legendary Artifact',
  oracle_text:
    'Creature tokens you control get +1/+0 and have vigilance.\n{T}: Add one mana of any color. Spend this mana only to cast a planeswalker spell.\n{1}{W}, Discard this card: It deals 4 damage to target attacking or blocking creature.',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'rare',
  keywords: [],
};

// 1. Feature Extraction Verification
console.log('1. Gideon\'s Memorial Feature Extraction:');
const tFeatures = extractCardFeatures(gideonsMemorial);
console.log('   isTokenAnthem:', tFeatures.isTokenAnthem);
console.log('   isTeamAnthem:', tFeatures.isTeamAnthem);
console.log('   isDiscardRemoval:', tFeatures.isDiscardRemoval);
console.log('   has mana_rock:', tFeatures.actionSubtypes.has('mana_rock'));
console.log('   actionSubtypes:', Array.from(tFeatures.actionSubtypes));

if (!tFeatures.isTokenAnthem) throw new Error('FAIL: Gideon\'s Memorial should be flagged as isTokenAnthem');
if (!tFeatures.isDiscardRemoval) throw new Error('FAIL: Gideon\'s Memorial should be flagged as isDiscardRemoval');
if (tFeatures.actionSubtypes.has('mana_rock')) {
  throw new Error('FAIL: Planeswalker-restricted mana should NOT be classified as mana_rock');
}
console.log('   ✓ Feature extraction verified!\n');

// 2. Candidate Cards
const intangibleVirtue: Card = {
  id: 'intangible-virtue',
  name: 'Intangible Virtue',
  set: 'EMA',
  set_name: 'Eternal Masters',
  collector_number: '15',
  mana_cost: '{1}{W}',
  cmc: 2,
  type_line: 'Enchantment',
  oracle_text: 'Creature tokens you control get +1/+1 and have vigilance.',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'uncommon',
  keywords: [],
};

const flowering: Card = {
  id: 'flowering-of-the-white-tree',
  name: 'Flowering of the White Tree',
  set: 'LTR',
  set_name: 'The Lord of the Rings: Tales of Middle-earth',
  collector_number: '15',
  mana_cost: '{W}{W}',
  cmc: 2,
  type_line: 'Legendary Enchantment',
  oracle_text:
    'Legendary creatures you control get +2/+1 and have ward {1}.\nNonlegendary creatures you control get +1/+1.',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'rare',
  keywords: [],
};

const fabricationFoundry: Card = {
  id: 'fabrication-foundry',
  name: 'Fabrication Foundry',
  set: 'LCI',
  set_name: 'The Lost Caverns of Ixalan',
  collector_number: '12',
  mana_cost: '{1}{W}',
  cmc: 2,
  type_line: 'Artifact',
  oracle_text:
    '{T}: Add {W}. Spend this mana only to cast an artifact spell or activate an ability of an artifact source.\n{2}{W}, {T}, Exile one or more other artifacts you control with total mana value X: Return target artifact card with mana value X or less from your graveyard to the battlefield. Activate only as a sorcery.',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'rare',
  keywords: [],
};

// 3. Progressive Clause Match Verification
console.log('2. Progressive Clause Matching:');
const cFeaturesVirtue = extractCardFeatures(intangibleVirtue);
const matchVirtue = findExactOracleClauseMatch(gideonsMemorial, intangibleVirtue, tFeatures, cFeaturesVirtue);
console.log('   Gideon vs Intangible Virtue match:', matchVirtue);
if (!matchVirtue || matchVirtue.matchType !== 'template') {
  throw new Error(`FAIL: Intangible Virtue should match on 'template', got ${matchVirtue?.matchType}`);
}
console.log('   ✓ Parameterized template match verified!\n');

// 4. Scryfall Query Generation
console.log('3. Scryfall Queries generated for Gideon\'s Memorial:');
const queries = buildScryfallQueries(gideonsMemorial, tFeatures);
queries.slice(0, 6).forEach((q, i) => console.log(`   [${i + 1}] ${q}`));

const hasTokenQuery = queries.some(q => q.includes('tokens you control get') || q.includes('creature tokens you control get'));
const hasDiscardQuery = queries.some(q => q.includes('deals 4 damage to target attacking or blocking creature'));
if (!hasTokenQuery) throw new Error('FAIL: Queries should include token anthem search');
if (!hasDiscardQuery) throw new Error('FAIL: Queries should include discard removal search');
console.log('   ✓ Scryfall queries verified!\n');

// 5. Pairwise Similarity Scoring
console.log('4. Pairwise Similarity Scores:');
const simVirtue = calculateCardSimilarity(gideonsMemorial, intangibleVirtue);
console.log(`   - Intangible Virtue: ${simVirtue.score}% (Reasons: ${simVirtue.reasons.join('; ')})`);
if (simVirtue.score < 88) {
  throw new Error(`FAIL: Intangible Virtue similarity should be >= 88%, got ${simVirtue.score}%`);
}

const simFlowering = calculateCardSimilarity(gideonsMemorial, flowering);
console.log(`   - Flowering of the White Tree: ${simFlowering.score}% (Reasons: ${simFlowering.reasons.join('; ')})`);
if (simFlowering.score < 70) {
  throw new Error(`FAIL: Flowering of the White Tree similarity should be >= 70%, got ${simFlowering.score}%`);
}

const simFoundry = calculateCardSimilarity(gideonsMemorial, fabricationFoundry);
console.log(`   - Fabrication Foundry: ${simFoundry.score}% (Reasons: ${simFoundry.reasons.join('; ')})`);
if (simFoundry.score >= 40) {
  throw new Error(`FAIL: Fabrication Foundry must be suppressed (< 40%), got ${simFoundry.score}%`);
}
console.log('   ✓ Pairwise similarities verified!\n');

// 6. Fallback Recommendations Pool
console.log('5. Top Fallback Comps for Gideon\'s Memorial:');
const fallbackResult = generateGuaranteedFallbackResult(gideonsMemorial);
fallbackResult.matches.forEach((m, i) => {
  console.log(`   [${i + 1}] ${m.card.name} (${m.card.set}): ${m.similarityScore}% (WR: ${((m.winRate ?? 0.54) * 100).toFixed(1)}%, Tier: ${m.tierGrade})`);
  console.log(`       Reasons: ${m.matchReasons.join('; ')}`);
});

const top1 = fallbackResult.matches[0];
if (top1.card.name !== 'Intangible Virtue') {
  throw new Error(`FAIL: Intangible Virtue must be the #1 comp, got ${top1.card.name}`);
}
if (top1.similarityScore < 88) {
  throw new Error(`FAIL: Top comp score should be >= 88%, got ${top1.similarityScore}%`);
}
console.log('   ✓ Guaranteed Fallback Result verified!\n');

console.log('=== All Progressive Oracle Clause & Token Anthem Tests Passed Successfully! ===');
