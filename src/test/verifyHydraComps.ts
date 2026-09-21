import { calculateCardSimilarity, extractCardFeatures, buildScryfallQueries, generateGuaranteedFallbackResult } from '../services/cardSimilarity';
import { Card } from '../types/mtg';

console.log('=== Verifying Scalable X-Cost & Team Counter Distributor Engine (Guiding Hydra) ===\n');

// Target Card: Guiding Hydra
const guidingHydra: Card = {
  id: 'guiding-hydra',
  name: 'Guiding Hydra',
  set: 'FRA',
  set_name: 'Final Fantasy',
  collector_number: '11',
  mana_cost: '{X}{W}',
  cmc: 1,
  type_line: 'Creature — Hydra Horror',
  oracle_text: 'This creature enters with X +1/+1 counters on it.\nAt the beginning of combat on your turn, you may remove a +1/+1 counter from this creature. If you do, put a +1/+1 counter on each other creature you control.',
  power: '1',
  toughness: '0',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'rare',
  keywords: []
};

// 1. Fixed 1-Drops (Previously incorrect comps)
const starPupil: Card = {
  id: 'star-pupil',
  name: 'Star Pupil',
  set: 'STX',
  set_name: 'Strixhaven',
  collector_number: '33',
  mana_cost: '{W}',
  cmc: 1,
  type_line: 'Creature — Human Wizard',
  oracle_text: 'Star Pupil enters the battlefield with a +1/+1 counter on it.\nWhen Star Pupil dies, put its counters on target creature you control.',
  power: '0',
  toughness: '0',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: []
};

const monkOfTheOpenHand: Card = {
  id: 'monk-of-the-open-hand',
  name: 'Monk of the Open Hand',
  set: 'AFR',
  set_name: 'Adventures in the Forgotten Realms',
  collector_number: '25',
  mana_cost: '{W}',
  cmc: 1,
  type_line: 'Creature — Elf Monk',
  oracle_text: 'Whenever you cast your second spell each turn, put a +1/+1 counter on Monk of the Open Hand.',
  power: '1',
  toughness: '1',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'uncommon',
  keywords: []
};

const flourishingFox: Card = {
  id: 'flourishing-fox',
  name: 'Flourishing Fox',
  set: 'IKO',
  set_name: 'Ikoria',
  collector_number: '13',
  mana_cost: '{W}',
  cmc: 1,
  type_line: 'Creature — Fox',
  oracle_text: 'Whenever you cycle another card, put a +1/+1 counter on Flourishing Fox.\nCycling {1}',
  power: '1',
  toughness: '1',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'uncommon',
  keywords: ['Cycling']
};

const venerableKnight: Card = {
  id: 'venerable-knight',
  name: 'Venerable Knight',
  set: 'ELD',
  set_name: 'Throne of Eldraine',
  collector_number: '35',
  mana_cost: '{W}',
  cmc: 1,
  type_line: 'Creature — Human Knight',
  oracle_text: 'When Venerable Knight dies, put a +1/+1 counter on target Knight you control.',
  power: '2',
  toughness: '1',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'uncommon',
  keywords: []
};

// 2. Premier Benchmark Comparable Cards
const mikaeusTheLunarch: Card = {
  id: 'mikaeus-the-lunarch',
  name: 'Mikaeus, the Lunarch',
  set: 'ISD',
  set_name: 'Innistrad',
  collector_number: '23',
  mana_cost: '{X}{W}',
  cmc: 1,
  type_line: 'Legendary Creature — Human Cleric',
  oracle_text: 'Mikaeus, the Lunarch enters the battlefield with X +1/+1 counters on it.\n{T}: Put a +1/+1 counter on Mikaeus.\n{T}, Remove a +1/+1 counter from Mikaeus: Put a +1/+1 counter on each other creature you control.',
  power: '0',
  toughness: '0',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'mythic',
  keywords: []
};

const stonecoilSerpent: Card = {
  id: 'stonecoil-serpent',
  name: 'Stonecoil Serpent',
  set: 'ELD',
  set_name: 'Throne of Eldraine',
  collector_number: '235',
  mana_cost: '{X}',
  cmc: 0,
  type_line: 'Artifact Creature — Snake',
  oracle_text: 'Reach, trample, protection from multicolored\nStonecoil Serpent enters the battlefield with X +1/+1 counters on it.',
  power: '0',
  toughness: '0',
  colors: [],
  color_identity: [],
  rarity: 'rare',
  keywords: ['Reach', 'Trample']
};

const goldveinHydra: Card = {
  id: 'goldvein-hydra',
  name: 'Goldvein Hydra',
  set: 'OTJ',
  set_name: 'Outlaws of Thunder Junction',
  collector_number: '167',
  mana_cost: '{X}{G}',
  cmc: 1,
  type_line: 'Creature — Plant Hydra',
  oracle_text: 'Vigilance, trample, haste\nGoldvein Hydra enters the battlefield with X +1/+1 counters on it.\nWhen Goldvein Hydra dies, create X tapped Treasure tokens, where X is its power.',
  power: '0',
  toughness: '0',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'mythic',
  keywords: ['Vigilance', 'Trample', 'Haste']
};

const luminarchAspirant: Card = {
  id: 'luminarch-aspirant',
  name: 'Luminarch Aspirant',
  set: 'ZNR',
  set_name: 'Zendikar Rising',
  collector_number: '24',
  mana_cost: '{1}{W}',
  cmc: 2,
  type_line: 'Creature — Human Cleric',
  oracle_text: 'At the beginning of combat on your turn, put a +1/+1 counter on target creature you control.',
  power: '1',
  toughness: '1',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'rare',
  keywords: []
};

const siegeVeteran: Card = {
  id: 'siege-veteran',
  name: 'Siege Veteran',
  set: 'BRO',
  set_name: 'The Brothers\' War',
  collector_number: '25',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Human Soldier',
  oracle_text: 'At the beginning of combat on your turn, put a +1/+1 counter on target creature you control.\nWhenever another nontoken Soldier you control dies, create a 1/1 colorless Soldier artifact creature token.',
  power: '2',
  toughness: '2',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'rare',
  keywords: []
};

// TEST 1: Feature Extraction Verification
console.log('--- Test 1: Feature Extraction ---');
const hydraFeatures = extractCardFeatures(guidingHydra);
console.log('Guiding Hydra Features:');
console.log('  hasXCost:', hydraFeatures.hasXCost);
console.log('  isHydra:', hydraFeatures.isHydra);
console.log('  costProfile:', hydraFeatures.costProfile);
console.log('  effectiveCmc:', hydraFeatures.effectiveCmc);
console.log('  actionSubtypes:', Array.from(hydraFeatures.actionSubtypes));

if (!hydraFeatures.hasXCost) throw new Error('FAIL: hasXCost not detected!');
if (!hydraFeatures.isHydra) throw new Error('FAIL: isHydra not detected!');
if (hydraFeatures.costProfile !== 'x_cost') throw new Error(`FAIL: costProfile is ${hydraFeatures.costProfile}, expected x_cost!`);
if (!hydraFeatures.actionSubtypes.has('enters_with_x_counters')) throw new Error('FAIL: enters_with_x_counters subtype missing!');
if (!hydraFeatures.actionSubtypes.has('team_counter_distributor')) throw new Error('FAIL: team_counter_distributor subtype missing!');
if (!hydraFeatures.actionSubtypes.has('combat_counter_distributor')) throw new Error('FAIL: combat_counter_distributor subtype missing!');
if (!hydraFeatures.actionSubtypes.has('counter_transfer_distributor')) throw new Error('FAIL: counter_transfer_distributor subtype missing!');
console.log('PASS: Feature extraction successful!\n');

// TEST 2: Scryfall Query Generation
console.log('--- Test 2: Scryfall Query Generation ---');
const queries = buildScryfallQueries(guidingHydra, hydraFeatures);
console.log(`Generated ${queries.length} queries. Sample queries:`);
queries.slice(0, 5).forEach((q, i) => console.log(`  [${i+1}] ${q}`));

const hasXCmcQuery = queries.some(q => q.includes('cmc=1') || q.includes('pow=1 tou=0'));
const hasXQuery = queries.some(q => q.includes('m:{X}'));
const hasTeamQuery = queries.some(q => q.includes('put a +1/+1 counter on each other creature you control'));

if (hasXCmcQuery) throw new Error('FAIL: Scryfall query generated cmc=1 or pow=1 tou=0 for X spell!');
if (!hasXQuery) throw new Error('FAIL: Scryfall query did not generate m:{X} query!');
if (!hasTeamQuery) throw new Error('FAIL: Scryfall query did not generate team counter distributor query!');
console.log('PASS: Scryfall queries properly targeted for X-spells and team counter distributor!\n');

// TEST 3: Penalty against Fixed 1-Drops
console.log('--- Test 3: Fixed 1-Drop Disqualification ---');
const simStarPupil = calculateCardSimilarity(guidingHydra, starPupil);
console.log(`Guiding Hydra vs Star Pupil: ${simStarPupil.score}% (Reasons: ${simStarPupil.reasons.join('; ')})`);
if (simStarPupil.score >= 30) throw new Error(`FAIL: Star Pupil scored ${simStarPupil.score}%, expected < 30%!`);

const simMonk = calculateCardSimilarity(guidingHydra, monkOfTheOpenHand);
console.log(`Guiding Hydra vs Monk of the Open Hand: ${simMonk.score}% (Reasons: ${simMonk.reasons.join('; ')})`);
if (simMonk.score >= 25) throw new Error(`FAIL: Monk scored ${simMonk.score}%, expected < 25%!`);

const simFox = calculateCardSimilarity(guidingHydra, flourishingFox);
console.log(`Guiding Hydra vs Flourishing Fox: ${simFox.score}% (Reasons: ${simFox.reasons.join('; ')})`);
if (simFox.score >= 25) throw new Error(`FAIL: Fox scored ${simFox.score}%, expected < 25%!`);

const simKnight = calculateCardSimilarity(guidingHydra, venerableKnight);
console.log(`Guiding Hydra vs Venerable Knight: ${simKnight.score}% (Reasons: ${simKnight.reasons.join('; ')})`);
if (simKnight.score >= 25) throw new Error(`FAIL: Knight scored ${simKnight.score}%, expected < 25%!`);
console.log('PASS: All fixed 1-drops disqualified with < 30% score!\n');

// TEST 4: Premier Benchmarks Match
console.log('--- Test 4: Premier Benchmark Scoring ---');
const simMikaeus = calculateCardSimilarity(guidingHydra, mikaeusTheLunarch);
console.log(`Guiding Hydra vs Mikaeus, the Lunarch: ${simMikaeus.score}% (Reasons: ${simMikaeus.reasons.join('; ')})`);
if (simMikaeus.score < 90) throw new Error(`FAIL: Mikaeus scored ${simMikaeus.score}%, expected >= 90%!`);

const simStonecoil = calculateCardSimilarity(guidingHydra, stonecoilSerpent);
console.log(`Guiding Hydra vs Stonecoil Serpent: ${simStonecoil.score}% (Reasons: ${simStonecoil.reasons.join('; ')})`);
if (simStonecoil.score < 60) throw new Error(`FAIL: Stonecoil Serpent scored ${simStonecoil.score}%, expected >= 60%!`);

const simGoldvein = calculateCardSimilarity(guidingHydra, goldveinHydra);
console.log(`Guiding Hydra vs Goldvein Hydra: ${simGoldvein.score}% (Reasons: ${simGoldvein.reasons.join('; ')})`);
if (simGoldvein.score < 65) throw new Error(`FAIL: Goldvein Hydra scored ${simGoldvein.score}%, expected >= 65%!`);

const simLuminarch = calculateCardSimilarity(guidingHydra, luminarchAspirant);
console.log(`Guiding Hydra vs Luminarch Aspirant: ${simLuminarch.score}% (Reasons: ${simLuminarch.reasons.join('; ')})`);
if (simLuminarch.score < 55) throw new Error(`FAIL: Luminarch Aspirant scored ${simLuminarch.score}%, expected >= 55%!`);

const simSiege = calculateCardSimilarity(guidingHydra, siegeVeteran);
console.log(`Guiding Hydra vs Siege Veteran: ${simSiege.score}% (Reasons: ${simSiege.reasons.join('; ')})`);
if (simSiege.score < 55) throw new Error(`FAIL: Siege Veteran scored ${simSiege.score}%, expected >= 55%!`);
console.log('PASS: Premier benchmarks correctly score high!\n');

// TEST 5: Fallback Recommendation Verification
console.log('--- Test 5: Fallback Recommendation Pool ---');
const fallbackResult = generateGuaranteedFallbackResult(guidingHydra);
console.log('Top 4 Fallback Comps for Guiding Hydra:');
fallbackResult.matches.forEach((m, idx) => {
  console.log(`  [${idx+1}] ${m.card.name} (${m.card.set}) - Score: ${m.similarityScore}% | Tier: ${m.tierGrade} | WinRate: {${((m.winRate ?? 0.54)*100).toFixed(1)}%}`);
  console.log(`      Reasons: ${m.matchReasons.join('; ')}`);
});

const topNames = fallbackResult.matches.map(m => m.card.name);
if (topNames.includes('Star Pupil') || topNames.includes('Monk of the Open Hand') || topNames.includes('Flourishing Fox') || topNames.includes('Venerable Knight')) {
  throw new Error(`FAIL: One of the rejected 1-drops appeared in top comps: ${topNames.join(', ')}`);
}
if (!topNames.includes('Mikaeus, the Lunarch')) {
  throw new Error(`FAIL: Mikaeus, the Lunarch did not appear in top comps: ${topNames.join(', ')}`);
}
console.log('PASS: Guaranteed fallback result produces authentic X-spells and team distributors!\n');

console.log('=== ALL TESTS PASSED SUCCESSFULLY! ===');
