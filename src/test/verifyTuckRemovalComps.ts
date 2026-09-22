import {
  calculateCardSimilarity,
  extractCardFeatures,
  findExactOracleClauseMatch,
  buildScryfallQueries,
  generateGuaranteedFallbackResult,
} from '../services/cardSimilarity';
import { Card } from '../types/mtg';

console.log('=== Verifying Tuck Removal & Noncreature Spellslinger Engine (Plan for All Outcomes) ===\n');

// Target card: Plan for All Outcomes (FRA, Uncommon #66, {3}{U} Enchantment)
const planForAllOutcomes: Card = {
  id: 'fra-plan-for-all-outcomes',
  name: 'Plan for All Outcomes',
  set: 'FRA',
  set_name: 'Reality Fracture',
  collector_number: '66',
  mana_cost: '{3}{U}',
  cmc: 4,
  type_line: 'Enchantment',
  oracle_text:
    'When this enchantment enters, the owner of up to one other target nonland permanent puts it on their choice of the top or bottom of their library.\nWhenever you cast your first noncreature spell each turn, empower Jace 1. (Put a loyalty counter on a Jace token you control. If you don\'t control one, first create a blue Jace planeswalker token with "[−1]: Surveil 1" and "[−3]: Draw a card.")',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
};

// 1. Feature Extraction Verification
console.log('1. Plan for All Outcomes Feature Extraction:');
const tFeatures = extractCardFeatures(planForAllOutcomes);
console.log('   isTuckRemoval:', tFeatures.isTuckRemoval);
console.log('   isEtbTuckRemoval:', tFeatures.isEtbTuckRemoval);
console.log('   isRemoval:', tFeatures.isRemoval);
console.log('   hasEmpowerJace:', tFeatures.hasEmpowerJace);
console.log('   has noncreature_surveil_engine:', tFeatures.actionSubtypes.has('noncreature_surveil_engine'));
console.log('   actionSubtypes:', Array.from(tFeatures.actionSubtypes));

if (!tFeatures.isTuckRemoval) throw new Error('FAIL: Plan for All Outcomes should be flagged as isTuckRemoval');
if (!tFeatures.isEtbTuckRemoval) throw new Error('FAIL: Plan for All Outcomes should be flagged as isEtbTuckRemoval');
if (!tFeatures.isRemoval) throw new Error('FAIL: Plan for All Outcomes should be flagged as isRemoval');
if (!tFeatures.actionSubtypes.has('noncreature_surveil_engine')) {
  throw new Error('FAIL: Plan for All Outcomes should have noncreature_surveil_engine');
}
console.log('   ✓ Feature extraction verified!\n');

// 2. Candidate Cards
const desynchronize: Card = {
  id: 'desynchronize',
  name: 'Desynchronize',
  set: 'BRO',
  set_name: 'The Brothers\' War',
  collector_number: '46',
  mana_cost: '{4}{U}',
  cmc: 5,
  type_line: 'Instant',
  oracle_text: "Target nonland permanent's owner puts it on their choice of the top or bottom of their library. Scry 2.",
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'common',
  keywords: ['Scry'],
};

const direDowndraft: Card = {
  id: 'dire-downdraft',
  name: 'Dire Downdraft',
  set: 'BLB',
  set_name: 'Bloomburrow',
  collector_number: '46',
  mana_cost: '{3}{U}',
  cmc: 4,
  type_line: 'Instant',
  oracle_text:
    "This spell costs {1} less to cast if it targets an attacking or tapped creature.\nTarget creature's owner puts it on their choice of the top or bottom of their library.",
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'common',
  keywords: [],
};

const runAground: Card = {
  id: 'run-aground',
  name: 'Run Aground',
  set: 'XLN',
  set_name: 'Ixalan',
  collector_number: '72',
  mana_cost: '{3}{U}',
  cmc: 4,
  type_line: 'Instant',
  oracle_text: "Put target artifact or creature on top of its owner's library.",
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'common',
  keywords: [],
};

const cruelWitness: Card = {
  id: 'cruel-witness',
  name: 'Cruel Witness',
  set: 'VOW',
  set_name: 'Innistrad: Crimson Vow',
  collector_number: '55',
  mana_cost: '{2}{U}{U}',
  cmc: 4,
  type_line: 'Creature — Bird Horror',
  oracle_text: 'Flying\nWhenever you cast a noncreature spell, surveil 1.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'common',
  keywords: ['Flying', 'Surveil'],
};

const underwaterTunnel: Card = {
  id: 'underwater-tunnel',
  name: 'Underwater Tunnel // Slimy Aquarium',
  set: 'DSK',
  set_name: 'Duskmourn: House of Horror',
  collector_number: '80',
  mana_cost: '{U} // {3}{U}',
  cmc: 5,
  type_line: 'Enchantment — Room',
  oracle_text:
    'Look at the top three cards of your library. Put one into your hand and the rest into your graveyard. // When you unlock this door, mill three cards, then put a creature card from your graveyard onto the battlefield.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
};

const omenOfTheSea: Card = {
  id: 'omen-of-the-sea',
  name: 'Omen of the Sea',
  set: 'THB',
  set_name: 'Theros Beyond Death',
  collector_number: '58',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Enchantment',
  oracle_text: 'Flash\nWhen Omen of the Sea enters the battlefield, scry 2, then draw a card.\n{2}{U}, Sacrifice Omen of the Sea: Scry 2.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'common',
  keywords: ['Flash'],
};

const kuruk: Card = {
  id: 'the-legend-of-kuruk',
  name: 'The Legend of Kuruk // Avatar Kuruk',
  set: 'TLA',
  set_name: 'Avatar: The Last Airbender',
  collector_number: '60',
  mana_cost: '{3}{U}',
  cmc: 4,
  type_line: 'Enchantment — Saga',
  oracle_text: 'I — Draw two cards.\nII — Tap target creature.\nIII — Exile this Saga, then return it to the battlefield transformed under your control.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'rare',
  keywords: [],
};

// 3. Progressive Clause Match Verification
console.log('2. Progressive Clause Matching:');
const cFeaturesDesync = extractCardFeatures(desynchronize);
const matchDesync = findExactOracleClauseMatch(planForAllOutcomes, desynchronize, tFeatures, cFeaturesDesync);
console.log('   Plan vs Desynchronize match:', matchDesync);

if (!matchDesync || matchDesync.matchType !== 'tuck_exact') {
  throw new Error(`FAIL: Desynchronize should match with tuck_exact, got ${matchDesync?.matchType}`);
}

const cFeaturesDowndraft = extractCardFeatures(direDowndraft);
const matchDowndraft = findExactOracleClauseMatch(planForAllOutcomes, direDowndraft, tFeatures, cFeaturesDowndraft);
console.log('   Plan vs Dire Downdraft match:', matchDowndraft);

if (!matchDowndraft || (matchDowndraft.matchType !== 'tuck_relaxed' && matchDowndraft.matchType !== 'tuck_exact')) {
  throw new Error(`FAIL: Dire Downdraft should match with tuck_relaxed or tuck_exact, got ${matchDowndraft?.matchType}`);
}
console.log('   ✓ Progressive tuck clause matches verified!\n');

// 4. Scryfall Query Builder Verification
console.log('3. Scryfall Queries generated for Plan for All Outcomes:');
const queries = buildScryfallQueries(planForAllOutcomes, tFeatures);
queries.forEach((q, i) => console.log(`   [${i + 1}] ${q}`));

const hasTuckQuery = queries.some(q => q.includes('top or bottom of their library') || q.includes('puts it on their choice of the top or bottom') || q.includes('target nonland permanent'));
if (!hasTuckQuery) throw new Error('FAIL: Queries should include tuck removal search parameters');
console.log('   ✓ Scryfall queries verified!\n');

// 5. Pairwise Similarity Scores
console.log('4. Pairwise Similarity Scores:');
const simDesync = calculateCardSimilarity(planForAllOutcomes, desynchronize);
console.log(`   - Desynchronize: ${simDesync.score}% (Reasons: ${simDesync.reasons.join('; ')})`);
if (simDesync.score < 85) {
  throw new Error(`FAIL: Desynchronize score must be >= 85%, got ${simDesync.score}%`);
}

const simDowndraft = calculateCardSimilarity(planForAllOutcomes, direDowndraft);
console.log(`   - Dire Downdraft: ${simDowndraft.score}% (Reasons: ${simDowndraft.reasons.join('; ')})`);
if (simDowndraft.score < 80) {
  throw new Error(`FAIL: Dire Downdraft score must be >= 80%, got ${simDowndraft.score}%`);
}

const simRunAground = calculateCardSimilarity(planForAllOutcomes, runAground);
console.log(`   - Run Aground: ${simRunAground.score}% (Reasons: ${simRunAground.reasons.join('; ')})`);
if (simRunAground.score < 80) {
  throw new Error(`FAIL: Run Aground score must be >= 80%, got ${simRunAground.score}%`);
}

const simTunnel = calculateCardSimilarity(planForAllOutcomes, underwaterTunnel);
console.log(`   - Underwater Tunnel: ${simTunnel.score}% (Reasons: ${simTunnel.reasons.join('; ')})`);
if (simTunnel.score >= 38) {
  throw new Error(`FAIL: Underwater Tunnel must be suppressed (< 38%), got ${simTunnel.score}%`);
}

const simOmen = calculateCardSimilarity(planForAllOutcomes, omenOfTheSea);
console.log(`   - Omen of the Sea: ${simOmen.score}% (Reasons: ${simOmen.reasons.join('; ')})`);
if (simOmen.score >= 38) {
  throw new Error(`FAIL: Omen of the Sea must be suppressed (< 38%), got ${simOmen.score}%`);
}

const simKuruk = calculateCardSimilarity(planForAllOutcomes, kuruk);
console.log(`   - The Legend of Kuruk: ${simKuruk.score}% (Reasons: ${simKuruk.reasons.join('; ')})`);
if (simKuruk.score >= 38) {
  throw new Error(`FAIL: The Legend of Kuruk must be suppressed (< 38%), got ${simKuruk.score}%`);
}
console.log('   ✓ Pairwise similarities and suppressions verified!\n');

// 6. Fallback Recommendations Pool
console.log('5. Top Fallback Comps for Plan for All Outcomes:');
const fallbackResult = generateGuaranteedFallbackResult(planForAllOutcomes);
fallbackResult.matches.forEach((m, i) => {
  console.log(`   [${i + 1}] ${m.card.name} (${m.card.set}): ${m.similarityScore}% (WR: ${((m.winRate ?? 0.54) * 100).toFixed(1)}%, Tier: ${m.tierGrade})`);
  console.log(`       Reasons: ${m.matchReasons.join('; ')}`);
});

const topComp = fallbackResult.matches[0];
if (!['Desynchronize', 'Dire Downdraft', 'Run Aground', 'Out of Sight'].includes(topComp.card.name)) {
  throw new Error(`FAIL: Top comp must be a library-tuck removal spell, got ${topComp.card.name}`);
}
if (topComp.similarityScore < 85) {
  throw new Error(`FAIL: Top comp score should be >= 85%, got ${topComp.similarityScore}%`);
}
console.log('   ✓ Guaranteed Fallback Result verified!\n');

console.log('=== All Tuck Removal & Spellslinger Engine Tests Passed Successfully! ===');
