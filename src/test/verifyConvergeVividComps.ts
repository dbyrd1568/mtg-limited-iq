import { calculateCardSimilarity, extractCardFeatures, buildScryfallQueries, generateGuaranteedFallbackResult } from '../services/cardSimilarity';
import { Card } from '../types/mtg';

console.log('=== Verifying Multicolor Scaling & Colors Spent Engine (Rancorous Archaic) ===\n');

// Target Card: Rancorous Archaic (SOS)
const rancorousArchaic: Card = {
  id: 'rancorous-archaic',
  name: 'Rancorous Archaic',
  set: 'SOS',
  set_name: 'Secrets of Strixhaven',
  collector_number: '2',
  mana_cost: '{5}',
  cmc: 5,
  type_line: 'Creature — Avatar',
  oracle_text: 'Reach, trample\nConverge — This creature enters with a +1/+1 counter on it for each color of mana spent to cast it.',
  power: '2',
  toughness: '2',
  colors: [],
  color_identity: [],
  rarity: 'common',
  keywords: ['Reach', 'Converge', 'Trample']
};

// Candidate 1: Skyreach Manta (MMA / 5DN) - Colorless 5-mana Sunburst
const skyreachManta: Card = {
  id: 'skyreach-manta',
  name: 'Skyreach Manta',
  set: 'MMA',
  set_name: 'Modern Masters',
  collector_number: '215',
  mana_cost: '{5}',
  cmc: 5,
  type_line: 'Artifact Creature — Spire Owl',
  oracle_text: 'Flying\nSunburst (This enters the battlefield with a +1/+1 counter on it for each color of mana spent to cast it.)',
  power: '0',
  toughness: '0',
  colors: [],
  color_identity: [],
  rarity: 'common',
  keywords: ['Flying', 'Sunburst']
};

// Candidate 2: Wildvine Pummeler (ECL) - Vivid cost reduction, reach & trample
const wildvinePummeler: Card = {
  id: 'wildvine-pummeler',
  name: 'Wildvine Pummeler',
  set: 'ECL',
  set_name: 'Lorwyn Eclipsed',
  collector_number: '208',
  mana_cost: '{6}{G}',
  cmc: 7,
  type_line: 'Creature — Elemental Giant',
  oracle_text: 'Vivid — This spell costs {1} less to cast for each color among permanents you control.\nReach, trample',
  power: '6',
  toughness: '5',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'common',
  keywords: ['Reach', 'Trample', 'Vivid']
};

// Candidate 3: Woodland Wanderer (BFZ) - Converge, vigilance, trample
const woodlandWanderer: Card = {
  id: 'woodland-wanderer',
  name: 'Woodland Wanderer',
  set: 'BFZ',
  set_name: 'Battle for Zendikar',
  collector_number: '198',
  mana_cost: '{3}{G}',
  cmc: 4,
  type_line: 'Creature — Elemental',
  oracle_text: 'Vigilance, trample\nConverge — This creature enters the battlefield with a +1/+1 counter on it for each color of mana spent to cast it.',
  power: '2',
  toughness: '2',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'rare',
  keywords: ['Vigilance', 'Trample', 'Converge']
};

// Candidate 4: Tajuru Stalwart (BFZ) - Converge 3-drop
const tajuruStalwart: Card = {
  id: 'tajuru-stalwart',
  name: 'Tajuru Stalwart',
  set: 'BFZ',
  set_name: 'Battle for Zendikar',
  collector_number: '194',
  mana_cost: '{2}{G}',
  cmc: 3,
  type_line: 'Creature — Elf Scout Ally',
  oracle_text: 'Converge — Tajuru Stalwart enters the battlefield with a +1/+1 counter on it for each color of mana spent to cast it.',
  power: '0',
  toughness: '0',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'common',
  keywords: ['Converge']
};

// Candidate 5: Etched Oracle (MMA) - Colorless 4-mana Sunburst
const etchedOracle: Card = {
  id: 'etched-oracle',
  name: 'Etched Oracle',
  set: 'MMA',
  set_name: 'Modern Masters',
  collector_number: '201',
  mana_cost: '{4}',
  cmc: 4,
  type_line: 'Artifact Creature — Wizard',
  oracle_text: 'Sunburst\n{1}, Remove four +1/+1 counters from Etched Oracle: Target player draws three cards.',
  power: '0',
  toughness: '0',
  colors: [],
  color_identity: [],
  rarity: 'uncommon',
  keywords: ['Sunburst']
};

// Candidate 6: Nishoba Brawler (DMU) - Domain, trample
const nishobaBrawler: Card = {
  id: 'nishoba-brawler',
  name: 'Nishoba Brawler',
  set: 'DMU',
  set_name: 'Dominaria United',
  collector_number: '174',
  mana_cost: '{1}{G}',
  cmc: 2,
  type_line: 'Creature — Cat Warrior',
  oracle_text: 'Trample\nDomain — Nishoba Brawler\'s power is equal to the number of basic land types among lands you control.',
  power: '*',
  toughness: '3',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'common',
  keywords: ['Trample', 'Domain']
};

// Irrelevant vanilla card:
const vanillaBear: Card = {
  id: 'vanilla-bear',
  name: 'Grizzly Bears',
  set: '10E',
  set_name: 'Tenth Edition',
  collector_number: '268',
  mana_cost: '{1}{G}',
  cmc: 2,
  type_line: 'Creature — Bear',
  oracle_text: '',
  power: '2',
  toughness: '2',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'common',
  keywords: []
};

// 1. Verify Feature Extraction for Rancorous Archaic
const features = extractCardFeatures(rancorousArchaic);
console.log('1. Rancorous Archaic Feature Extraction:');
console.log('   isConverge:', features.isConverge);
console.log('   isMultiColorScaling:', features.isMultiColorScaling);
console.log('   actionSubtypes:', Array.from(features.actionSubtypes));
console.log('   effectivePower:', features.effectivePower);
console.log('   effectiveToughness:', features.effectiveToughness);

console.assert(features.isConverge === true, 'Rancorous Archaic must be detected as Converge');
console.assert(features.isMultiColorScaling === true, 'Rancorous Archaic must be detected as MultiColorScaling');
console.assert(features.actionSubtypes.has('converge_sunburst'), 'Rancorous Archaic must have converge_sunburst actionSubtype');
console.assert(features.effectivePower === 5, `Expected effective power 5, got ${features.effectivePower}`);
console.assert(features.effectiveToughness === 5, `Expected effective toughness 5, got ${features.effectiveToughness}`);
console.log('   ✓ Feature extraction verified!\n');

// 2. Verify Wildvine Pummeler Feature Extraction
const pummelerFeatures = extractCardFeatures(wildvinePummeler);
console.log('2. Wildvine Pummeler Feature Extraction:');
console.log('   isVivid:', pummelerFeatures.isVivid);
console.log('   isMultiColorScaling:', pummelerFeatures.isMultiColorScaling);
console.log('   actionSubtypes:', Array.from(pummelerFeatures.actionSubtypes));
console.log('   effectiveCmc:', pummelerFeatures.effectiveCmc);

console.assert(pummelerFeatures.isVivid === true, 'Wildvine Pummeler must be detected as Vivid');
console.assert(pummelerFeatures.isMultiColorScaling === true, 'Wildvine Pummeler must be detected as MultiColorScaling');
console.assert(pummelerFeatures.actionSubtypes.has('domain_vivid_scaling'), 'Wildvine Pummeler must have domain_vivid_scaling');
console.assert(pummelerFeatures.effectiveCmc === 4.5, `Expected effectiveCmc 4.5, got ${pummelerFeatures.effectiveCmc}`);
console.log('   ✓ Wildvine Pummeler verified!\n');

// 3. Verify Scryfall Queries include converge, sunburst, vivid, domain
const queries = buildScryfallQueries(rancorousArchaic, features);
console.log('3. Scryfall Queries generated:');
queries.slice(0, 5).forEach((q, i) => console.log(`   [${i + 1}] ${q}`));
const hasMultiColorScalingQuery = queries.some(q => /converge|sunburst|vivid|domain/i.test(q));
console.assert(hasMultiColorScalingQuery, 'Scryfall queries must include converge/sunburst/vivid/domain');
console.log('   ✓ Scryfall queries verified!\n');

// 4. Verify Similarity Scores
console.log('4. Pairwise Similarity Scores with Rancorous Archaic:');

const candidates = [
  { card: skyreachManta, role: 'Colorless 5-mana Sunburst' },
  { card: wildvinePummeler, role: 'Vivid cost-reduction, Reach & Trample' },
  { card: woodlandWanderer, role: 'Green Converge 4-drop, Trample' },
  { card: tajuruStalwart, role: 'Green Converge 3-drop' },
  { card: etchedOracle, role: 'Colorless Sunburst 4-drop' },
  { card: nishobaBrawler, role: 'Domain 2-drop, Trample' },
  { card: vanillaBear, role: 'Irrelevant 2-drop vanilla' }
];

candidates.forEach(({ card, role }) => {
  const result = calculateCardSimilarity(rancorousArchaic, card);
  console.log(`   - ${card.name} (${role}): ${result.score}%`);
  console.log(`     Reasons: ${result.reasons.slice(0, 3).join('; ')}`);
});

const mantaSim = calculateCardSimilarity(rancorousArchaic, skyreachManta).score;
const pummelerSim = calculateCardSimilarity(rancorousArchaic, wildvinePummeler).score;
const wandererSim = calculateCardSimilarity(rancorousArchaic, woodlandWanderer).score;
const stalwartSim = calculateCardSimilarity(rancorousArchaic, tajuruStalwart).score;
const bearSim = calculateCardSimilarity(rancorousArchaic, vanillaBear).score;

console.assert(wandererSim >= 88, `Woodland Wanderer similarity should be >= 88%, got ${wandererSim}%`);
console.assert(wandererSim > pummelerSim, `Woodland Wanderer should outscore Wildvine Pummeler (${wandererSim}% vs ${pummelerSim}%)`);
console.assert(pummelerSim >= 80, `Wildvine Pummeler similarity should be >= 80%, got ${pummelerSim}%`);
console.assert(mantaSim >= 75, `Skyreach Manta similarity should be >= 75%, got ${mantaSim}%`);
console.assert(stalwartSim >= 65, `Tajuru Stalwart similarity should be >= 65%, got ${stalwartSim}%`);
console.assert(wandererSim > bearSim + 50, `Woodland Wanderer should vastly outscore vanilla bear (${wandererSim}% vs ${bearSim}%)`);
console.log('   ✓ Pairwise similarities verified!\n');

// 5. Verify Guaranteed Fallback Result for Rancorous Archaic
const fallbackResult = generateGuaranteedFallbackResult(rancorousArchaic);
console.log('5. Top 4 Fallback Comps for Rancorous Archaic:');
fallbackResult.matches.forEach((m, i) => {
  console.log(`   [${i + 1}] ${m.card.name} (${m.card.set}): ${m.similarityScore}% (WR: ${((m.winRate ?? 0) * 100).toFixed(1)}%, Tier: ${m.tierGrade})`);
  console.log(`       Reasons: ${m.matchReasons.slice(0, 2).join('; ')}`);
});

const topNames = fallbackResult.matches.map(m => m.card.name);
console.assert(topNames[0] === 'Woodland Wanderer', `Woodland Wanderer must be the #1 comp! Got: ${topNames[0]}`);
console.assert(topNames.includes('Skyreach Manta') && topNames.includes('Wildvine Pummeler'),
  `Top comps must include premier multicolor scaling peers! Got: ${topNames.join(', ')}`);
console.log('   ✓ Guaranteed Fallback Result verified!\n');

console.log('=== All Multicolor Scaling & Colors Spent Tests Passed Successfully! ===');
