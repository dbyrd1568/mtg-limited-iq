import {
  calculateCardSimilarity,
  extractCardFeatures,
  buildScryfallQueries,
  getCuratedBenchmarkCandidates,
  HISTORICAL_BENCHMARK_CARDS,
} from '../services/cardSimilarity';
import { Card } from '../types/mtg';

// Card definition for Apex Witchstalker (from FRA - Reality Fracture)
const apexWitchstalker: Card = {
  id: 'apex-witchstalker-fra',
  name: 'Apex Witchstalker',
  set: 'FRA',
  set_name: 'Reality Fracture',
  collector_number: '88',
  mana_cost: '{4}{B}{B}',
  cmc: 6,
  type_line: 'Creature — Wolf',
  oracle_text: 'Menace\nWhen this creature enters or dies, you gain 2 life.\nBasic landcycling {2}',
  power: '6',
  toughness: '4',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'common',
  keywords: ['Menace', 'Basic landcycling'],
};

// Candidate cards to test
const ripscalePredator: Card = {
  id: 'ripscale-predator-clu',
  name: 'Ripscale Predator',
  set: 'CLU',
  set_name: 'Ravnica: Clue Edition',
  collector_number: '144',
  mana_cost: '{4}{R}{R}',
  cmc: 6,
  type_line: 'Creature — Dinosaur',
  oracle_text: 'Menace',
  power: '6',
  toughness: '5',
  colors: ['R'],
  color_identity: ['R'],
  rarity: 'common',
  keywords: ['Menace'],
};

const trollOfKhazadDum: Card = {
  id: 'troll-of-khazad-dum-ltr',
  name: 'Troll of Khazad-dûm',
  set: 'LTR',
  set_name: 'The Lord of the Rings: Tales of Middle-earth',
  collector_number: '111',
  mana_cost: '{5}{B}',
  cmc: 6,
  type_line: 'Creature — Troll',
  oracle_text: "This creature can't be blocked except by three or more creatures.\nSwampcycling {1}",
  power: '6',
  toughness: '5',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'common',
  keywords: ['Swampcycling'],
};

const gloomfangMauler: Card = {
  id: 'gloomfang-mauler-mom',
  name: 'Gloomfang Mauler',
  set: 'MOM',
  set_name: 'March of the Machine',
  collector_number: '105',
  mana_cost: '{5}{B}{B}',
  cmc: 7,
  type_line: 'Creature — Nightmare',
  oracle_text: 'Swampcycling {2}\nBackup 2\nMenace',
  power: '5',
  toughness: '5',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'common',
  keywords: ['Backup', 'Menace', 'Swampcycling'],
};

const balefulBeholder: Card = {
  id: 'baleful-beholder-afr',
  name: 'Baleful Beholder',
  set: 'AFR',
  set_name: 'Adventures in the Forgotten Realms',
  collector_number: '85',
  mana_cost: '{4}{B}{B}',
  cmc: 6,
  type_line: 'Creature — Beholder',
  oracle_text: 'When this creature enters, choose one —\n• Antimagic Cone — Each opponent sacrifices an enchantment of their choice.\n• Fear Ray — Creatures you control gain menace until end of turn.',
  power: '6',
  toughness: '5',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'common',
  keywords: [],
};

const ogreChitterlord: Card = {
  id: 'ogre-chitterlord-woe',
  name: 'Ogre Chitterlord',
  set: 'WOE',
  set_name: 'Wilds of Eldraine',
  collector_number: '142',
  mana_cost: '{4}{R}{R}',
  cmc: 6,
  type_line: 'Creature — Ogre Warrior',
  oracle_text: 'Menace\nWhenever this creature enters or attacks, create two 1/1 black Rat creature tokens with "This token can\'t block." Then if you control five or more Rats, each Rat you control gets +2/+0 until end of turn.',
  power: '6',
  toughness: '5',
  colors: ['R'],
  color_identity: ['R'],
  rarity: 'rare',
  keywords: ['Menace'],
};

const malboro: Card = {
  id: 'malboro-fin',
  name: 'Malboro',
  set: 'FIN',
  set_name: 'Final Fantasy',
  collector_number: '100',
  mana_cost: '{4}{B}{B}',
  cmc: 6,
  type_line: 'Creature — Plant Monster',
  oracle_text: 'When this creature enters, put a -1/-1 counter on each creature target opponent controls.',
  power: '4',
  toughness: '4',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'uncommon',
  keywords: [],
};

const cemeteryDesecrator: Card = {
  id: 'cemetery-desecrator-vow',
  name: 'Cemetery Desecrator',
  set: 'VOW',
  set_name: 'Innistrad: Crimson Vow',
  collector_number: '100',
  mana_cost: '{4}{B}{B}',
  cmc: 6,
  type_line: 'Creature — Zombie',
  oracle_text: 'When this creature enters or dies, exile target card from a graveyard. If a permanent card was exiled this way, target creature gets -X/-X until end of turn, where X is the mana value of that permanent card.',
  power: '4',
  toughness: '4',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'rare',
  keywords: [],
};

const gurmagRakshasa: Card = {
  id: 'gurmag-rakshasa-frf',
  name: 'Gurmag Rakshasa',
  set: 'FRF',
  set_name: 'Fate Reforged',
  collector_number: '72',
  mana_cost: '{4}{B}{B}',
  cmc: 6,
  type_line: 'Creature — Demon',
  oracle_text: 'Morph {3}{B}{B}',
  power: '5',
  toughness: '5',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'common',
  keywords: ['Morph'],
};

console.log('=== Apex Witchstalker Similarity & Queries Verification ===\n');

// 1. Verify extractCardFeatures
const features = extractCardFeatures(apexWitchstalker);
console.log('Apex Witchstalker Features:');
console.log('  actionSubtypes:', [...features.actionSubtypes]);
console.log('  hasMenace:', features.hasMenace);
console.log('  hasLandcycling:', features.hasLandcycling);
console.log('  detectedClauses:', features.detectedClauses.map(c => c.raw));

if (!features.actionSubtypes.has('high_power_menace')) {
  throw new Error('FAILED: Apex Witchstalker must have high_power_menace action subtype');
}
if (!features.actionSubtypes.has('landcycling_creature')) {
  throw new Error('FAILED: Apex Witchstalker must have landcycling_creature action subtype');
}
console.log('✓ extractCardFeatures verified.\n');

// 2. Verify Scryfall Queries
const queries = buildScryfallQueries(apexWitchstalker, features);
console.log('Generated Scryfall Queries (First 6):');
queries.slice(0, 6).forEach((q, i) => console.log(`  Query ${i}: ${q}`));

const hasGenericEtbQuery = queries.some(q => q.includes('o:"when this creature enters"'));
if (hasGenericEtbQuery) {
  throw new Error('FAILED: Must not generate generic o:"when this creature enters" query for a 6-power menace creature!');
}

const hasMenaceQuery = queries.some(q => q.includes('o:menace') || q.includes('kw:menace'));
if (!hasMenaceQuery) {
  throw new Error('FAILED: Queries must include menace search!');
}

const hasLandcyclingQuery = queries.some(q => q.includes('o:cycling') || q.includes('o:landcycling'));
if (!hasLandcyclingQuery) {
  throw new Error('FAILED: Queries must include landcycling search!');
}
console.log('✓ Query generation verified without ETB flooding and with menace & landcycling priority.\n');

// 3. Test Similarity Scoring
const comps = [
  { card: ripscalePredator, name: 'Ripscale Predator (6/5 Menace)' },
  { card: trollOfKhazadDum, name: 'Troll of Khazad-dûm (6/5 3+ Menace, Landcycling)' },
  { card: gloomfangMauler, name: 'Gloomfang Mauler (5/5 Menace, Landcycling)' },
  { card: balefulBeholder, name: 'Baleful Beholder (6/5, Fear Ray Menace)' },
  { card: ogreChitterlord, name: 'Ogre Chitterlord (6/5 Menace)' },
  { card: malboro, name: 'Malboro (4/4 no evasion)' },
  { card: cemeteryDesecrator, name: 'Cemetery Desecrator (4/4 no evasion)' },
  { card: gurmagRakshasa, name: 'Gurmag Rakshasa (5/5 no evasion)' },
];

console.log('--- Similarity Scores against Apex Witchstalker ---');
const scoredComps = comps.map(c => {
  const result = calculateCardSimilarity(apexWitchstalker, c.card);
  console.log(`  ${c.name}: Score = ${result.score}%`);
  console.log(`    Reasons: ${result.reasons.slice(0, 3).join(' | ')}`);
  return { ...c, score: result.score, reasons: result.reasons };
});

const ripScore = scoredComps.find(c => c.card.name === 'Ripscale Predator')!.score;
const trollScore = scoredComps.find(c => c.card.name === 'Troll of Khazad-dûm')!.score;
const gloomScore = scoredComps.find(c => c.card.name === 'Gloomfang Mauler')!.score;
const malScore = scoredComps.find(c => c.card.name === 'Malboro')!.score;
const cemScore = scoredComps.find(c => c.card.name === 'Cemetery Desecrator')!.score;

if (ripScore < 70) {
  throw new Error(`FAILED: Ripscale Predator score too low (${ripScore}% < 70%)`);
}
if (trollScore < 75) {
  throw new Error(`FAILED: Troll of Khazad-dûm score too low (${trollScore}% < 75%)`);
}
if (ripScore <= malScore) {
  throw new Error(`FAILED: Ripscale Predator (${ripScore}%) must score higher than Malboro (${malScore}%)`);
}
if (trollScore <= malScore) {
  throw new Error(`FAILED: Troll of Khazad-dûm (${trollScore}%) must score higher than Malboro (${malScore}%)`);
}
if (gloomScore <= malScore) {
  throw new Error(`FAILED: Gloomfang Mauler (${gloomScore}%) must score higher than Malboro (${malScore}%)`);
}
if (malScore > 60) {
  throw new Error(`FAILED: Malboro (4/4 no evasion) score too high (${malScore}% > 60%)`);
}

console.log('\n✓ All score rankings verified! High-power menace & landcycling beaters cleanly outscore 4/4 utility creatures.');

// 4. Test Curated Benchmark Candidates ranking
const curated = getCuratedBenchmarkCandidates(apexWitchstalker, HISTORICAL_BENCHMARK_CARDS);
console.log('\nCurated Candidates for Apex Witchstalker (Top 5):');
curated.slice(0, 5).forEach((c, i) => console.log(`  ${i + 1}. ${c.name} (${c.set}) - ${c.mana_cost} ${c.power}/${c.toughness}`));

const topCuratedNames = curated.slice(0, 4).map(c => c.name);
const containsFinisher = topCuratedNames.some(n =>
  n === 'Ripscale Predator' || n === 'Troll of Khazad-dûm' || n === 'Baleful Beholder' || n === 'Gloomfang Mauler'
);

if (!containsFinisher) {
  throw new Error('FAILED: Curated benchmarks top 4 must contain at least one high-power menace/landcycling finisher');
}

console.log('\n🎉 ALL APEX WITCHSTALKER TESTS PASSED SUCCESSFULLY!');
