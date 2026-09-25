import {
  extractCardFeatures,
  findExactOracleClauseMatch,
  buildScryfallQueries,
  calculateCardSimilarity,
  generateGuaranteedFallbackResult,
} from '../services/cardSimilarity';
import { Card } from '../types/mtg';

console.log('=== Verifying Color-Hoser Counterspell Architecture (Precise Redaction vs Flashfreeze) ===\n');

// 1. Target Card: Precise Redaction (Reality Fracture - FRA)
const preciseRedaction: Card = {
  id: 'fra-precise-redaction',
  name: 'Precise Redaction',
  set: 'FRA',
  set_name: 'Reality Fracture',
  collector_number: '68',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Counter target white or black spell.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
};

// 2. Candidate Cards
const flashfreeze: Card = {
  id: 'flashfreeze',
  name: 'Flashfreeze',
  set: 'FDN',
  set_name: 'Foundations',
  collector_number: '159',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Counter target red or green spell.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
};

const changeTheEquation: Card = {
  id: 'change-the-equation',
  name: 'Change the Equation',
  set: 'MOM',
  set_name: 'March of the Machine',
  collector_number: '50',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text:
    'Choose one —\n• Counter target spell with mana value 2 or less.\n• Counter target red or green spell with mana value 6 or less.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
};

const gainsay: Card = {
  id: 'gainsay',
  name: 'Gainsay',
  set: 'THS',
  set_name: 'Theros',
  collector_number: '49',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Counter target blue spell.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
};

const jacesDefeat: Card = {
  id: 'jaces-defeat',
  name: "Jace's Defeat",
  set: 'HOU',
  set_name: 'Hour of Devastation',
  collector_number: '38',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Counter target blue spell. If it was a Jace planeswalker spell, scry 2.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
};

const itllQuenchYa: Card = {
  id: 'itll-quench-ya',
  name: "It'll Quench Ya!",
  set: 'TLA',
  set_name: 'Avatar: The Last Airbender',
  collector_number: '55',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Counter target spell unless its controller pays {2}.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'common',
  keywords: [],
};

const gloriousGale: Card = {
  id: 'glorious-gale',
  name: 'Glorious Gale',
  set: 'LTR',
  set_name: 'The Lord of the Rings: Tales of Middle-earth',
  collector_number: '51',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Counter target creature spell. If it was a legendary spell, the Ring tempts you.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
};

const spectralInterference: Card = {
  id: 'spectral-interference',
  name: 'Spectral Interference',
  set: 'DFT',
  set_name: 'Aetherdrift',
  collector_number: '68',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Counter target artifact or creature spell unless its controller pays {4}.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'common',
  keywords: [],
};

// 1. Feature Extraction Verification
console.log('1. Feature Extraction on Precise Redaction:');
const tFeatures = extractCardFeatures(preciseRedaction);
console.log('   isCounterspell:', tFeatures.isCounterspell);
console.log('   isColorHoserCounter:', tFeatures.isColorHoserCounter);
console.log('   isColorPairHoser:', tFeatures.isColorPairHoser);
console.log('   actionSubtypes:', Array.from(tFeatures.actionSubtypes));
console.log('   detectedCategories:', Array.from(tFeatures.detectedCategories));

if (!tFeatures.isCounterspell) throw new Error('FAIL: isCounterspell must be true');
if (!tFeatures.isColorHoserCounter) throw new Error('FAIL: isColorHoserCounter must be true');
if (!tFeatures.isColorPairHoser) throw new Error('FAIL: isColorPairHoser must be true');
if (!tFeatures.actionSubtypes.has('color_hoser_counter')) throw new Error('FAIL: actionSubtypes must have color_hoser_counter');
if (!tFeatures.actionSubtypes.has('color_pair_hoser')) throw new Error('FAIL: actionSubtypes must have color_pair_hoser');
console.log('   ✓ Feature extraction verified!\n');

// 2. Progressive Clause Matching
console.log('2. Progressive Clause Matching:');
const cFeaturesFlashfreeze = extractCardFeatures(flashfreeze);
const matchFlashfreeze = findExactOracleClauseMatch(preciseRedaction, flashfreeze, tFeatures, cFeaturesFlashfreeze);
console.log('   Precise Redaction vs Flashfreeze match:', matchFlashfreeze);

if (!matchFlashfreeze || matchFlashfreeze.matchType !== 'color_hoser_exact') {
  throw new Error(`FAIL: Flashfreeze should match with color_hoser_exact, got ${matchFlashfreeze?.matchType}`);
}

const cFeaturesChangeEq = extractCardFeatures(changeTheEquation);
const matchChangeEq = findExactOracleClauseMatch(preciseRedaction, changeTheEquation, tFeatures, cFeaturesChangeEq);
console.log('   Precise Redaction vs Change the Equation match:', matchChangeEq);

if (!matchChangeEq || (matchChangeEq.matchType !== 'color_hoser_relaxed' && matchChangeEq.matchType !== 'color_hoser_exact')) {
  throw new Error(`FAIL: Change the Equation should match with color_hoser_relaxed, got ${matchChangeEq?.matchType}`);
}
console.log('   ✓ Progressive clause matches verified!\n');

// 3. Scryfall Query Builder Verification
console.log('3. Scryfall Queries generated for Precise Redaction:');
const queries = buildScryfallQueries(preciseRedaction, tFeatures);
queries.forEach((q, i) => console.log(`   [${i + 1}] ${q}`));

const hasColorHoserQuery = queries.some(q => q.includes('counter target') && (q.includes('white') || q.includes('red or green')));
if (!hasColorHoserQuery) throw new Error('FAIL: Queries should include color hoser search parameters');
console.log('   ✓ Scryfall queries verified!\n');

// 4. Pairwise Similarity Scores
console.log('4. Pairwise Similarity Scores:');
const simFlashfreeze = calculateCardSimilarity(preciseRedaction, flashfreeze);
console.log(`   - Flashfreeze: ${simFlashfreeze.score}% (Reasons: ${simFlashfreeze.reasons.join('; ')})`);
if (simFlashfreeze.score < 93) {
  throw new Error(`FAIL: Flashfreeze score must be >= 93%, got ${simFlashfreeze.score}%`);
}

const simChangeEq = calculateCardSimilarity(preciseRedaction, changeTheEquation);
console.log(`   - Change the Equation: ${simChangeEq.score}% (Reasons: ${simChangeEq.reasons.join('; ')})`);
if (simChangeEq.score < 80) {
  throw new Error(`FAIL: Change the Equation score must be >= 80%, got ${simChangeEq.score}%`);
}

const simGainsay = calculateCardSimilarity(preciseRedaction, gainsay);
console.log(`   - Gainsay: ${simGainsay.score}% (Reasons: ${simGainsay.reasons.join('; ')})`);
if (simGainsay.score < 80) {
  throw new Error(`FAIL: Gainsay score must be >= 80%, got ${simGainsay.score}%`);
}

const simJacesDefeat = calculateCardSimilarity(preciseRedaction, jacesDefeat);
console.log(`   - Jace's Defeat: ${simJacesDefeat.score}% (Reasons: ${simJacesDefeat.reasons.join('; ')})`);
if (simJacesDefeat.score < 80) {
  throw new Error(`FAIL: Jace's Defeat score must be >= 80%, got ${simJacesDefeat.score}%`);
}

const simItllQuenchYa = calculateCardSimilarity(preciseRedaction, itllQuenchYa);
console.log(`   - It'll Quench Ya!: ${simItllQuenchYa.score}% (Reasons: ${simItllQuenchYa.reasons.join('; ')})`);
if (simItllQuenchYa.score >= 35) {
  throw new Error(`FAIL: It'll Quench Ya! must be suppressed (< 35%), got ${simItllQuenchYa.score}%`);
}

const simGloriousGale = calculateCardSimilarity(preciseRedaction, gloriousGale);
console.log(`   - Glorious Gale: ${simGloriousGale.score}% (Reasons: ${simGloriousGale.reasons.join('; ')})`);
if (simGloriousGale.score >= 35) {
  throw new Error(`FAIL: Glorious Gale must be suppressed (< 35%), got ${simGloriousGale.score}%`);
}

const simSpectral = calculateCardSimilarity(preciseRedaction, spectralInterference);
console.log(`   - Spectral Interference: ${simSpectral.score}% (Reasons: ${simSpectral.reasons.join('; ')})`);
if (simSpectral.score >= 35) {
  throw new Error(`FAIL: Spectral Interference must be suppressed (< 35%), got ${simSpectral.score}%`);
}
console.log('   ✓ Pairwise similarities and suppressions verified!\n');

// 5. Fallback Recommendations Pool
console.log('5. Top Fallback Comps for Precise Redaction:');
const fallbackResult = generateGuaranteedFallbackResult(preciseRedaction);
fallbackResult.matches.forEach((m, i) => {
  console.log(`   [${i + 1}] ${m.card.name} (${m.card.set}): ${m.similarityScore}% (WR: ${((m.winRate ?? 0.54) * 100).toFixed(1)}%, Tier: ${m.tierGrade})`);
  console.log(`       Reasons: ${m.matchReasons.join('; ')}`);
});

const topComp = fallbackResult.matches[0];
if (topComp.card.name !== 'Flashfreeze') {
  throw new Error(`FAIL: Top comp must be Flashfreeze, got ${topComp.card.name}`);
}
if (topComp.similarityScore < 93) {
  throw new Error(`FAIL: Top comp score should be >= 93%, got ${topComp.similarityScore}%`);
}
console.log('   ✓ Guaranteed Fallback Result verified!\n');

console.log('=== All Color-Hoser Counterspell Tests Passed Successfully! ===');
