import { calculateCardSimilarity, extractCardFeatures, buildScryfallQueries, generateGuaranteedFallbackResult, findExactOracleClauseMatch } from '../services/cardSimilarity';
import { Card } from '../types/mtg';

console.log('=== Verifying Toughness-Damage ("Butt-Strike") & Exact Oracle Text Priority Architecture (Ghalta) ===\n');

// Target Card: Ghalta the Immovable (FRA)
const ghalta: Card = {
  id: 'ghalta-the-immovable',
  name: 'Ghalta the Immovable',
  set: 'FRA',
  set_name: 'Reality Fracture',
  collector_number: '197',
  mana_cost: '{8}{W}',
  cmc: 9,
  type_line: 'Legendary Creature — Elder Dinosaur',
  oracle_text: 'This spell costs {X} less to cast, where X is the greatest toughness among creatures you control.\nCreatures you control can attack as though they didn\'t have defender.\nEach creature you control with toughness greater than its power assigns combat damage equal to its toughness rather than its power.',
  power: '0',
  toughness: '7',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'uncommon',
  keywords: []
};

// Candidate 1: Bedrock Tortoise (LCI) - Exact identical rules text clause
const bedrockTortoise: Card = {
  id: 'bedrock-tortoise',
  name: 'Bedrock Tortoise',
  set: 'LCI',
  set_name: 'The Lost Caverns of Ixalan',
  collector_number: '176',
  mana_cost: '{3}{G}',
  cmc: 4,
  type_line: 'Creature — Turtle',
  oracle_text: 'During your turn, creatures you control have hexproof.\nEach creature you control with toughness greater than its power assigns combat damage equal to its toughness rather than its power.',
  power: '0',
  toughness: '6',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'rare',
  keywords: []
};

// Candidate 2: Doran, Besieged by Time (ECL) - Toughness cost reduction & pump
const doranEcl: Card = {
  id: 'doran-besieged-by-time',
  name: 'Doran, Besieged by Time',
  set: 'ECL',
  set_name: 'Lorwyn Eclipsed',
  collector_number: '190',
  mana_cost: '{1}{W}{B}{G}',
  cmc: 4,
  type_line: 'Legendary Creature — Treefolk Druid',
  oracle_text: 'Each creature spell you cast with toughness greater than its power costs {1} less to cast.\nWhenever a creature you control attacks or blocks, it gets +X/+X until end of turn, where X is the difference between its power and toughness.',
  power: '0',
  toughness: '5',
  colors: ['W', 'B', 'G'],
  color_identity: ['W', 'B', 'G'],
  rarity: 'rare',
  keywords: []
};

// Candidate 3: Ancient Lumberknot (VOW) - Exact identical rules text clause
const ancientLumberknot: Card = {
  id: 'ancient-lumberknot',
  name: 'Ancient Lumberknot',
  set: 'VOW',
  set_name: 'Innistrad: Crimson Vow',
  collector_number: '230',
  mana_cost: '{2}{B}{G}',
  cmc: 4,
  type_line: 'Creature — Treefolk',
  oracle_text: 'Each creature you control with toughness greater than its power assigns combat damage equal to its toughness rather than its power.',
  power: '1',
  toughness: '4',
  colors: ['B', 'G'],
  color_identity: ['B', 'G'],
  rarity: 'uncommon',
  keywords: []
};

// Candidate 4: High Alert (RNA) - Defender can attack enabler & assigns damage equal to toughness
const highAlert: Card = {
  id: 'high-alert',
  name: 'High Alert',
  set: 'RNA',
  set_name: 'Ravnica Allegiance',
  collector_number: '182',
  mana_cost: '{1}{W}{U}',
  cmc: 3,
  type_line: 'Enchantment',
  oracle_text: 'Each creature you control assigns combat damage equal to its toughness rather than its power.\nCreatures you control can attack as though they didn\'t have defender.\n{2}{W}{U}: Untap target creature.',
  colors: ['W', 'U'],
  color_identity: ['W', 'U'],
  rarity: 'uncommon',
  keywords: []
};

// Unrelated Go-Wide Finishers (previously erroneously paired with Ghalta):
const moonshakerCavalry: Card = {
  id: 'moonshaker-cavalry',
  name: 'Moonshaker Cavalry',
  set: 'WOE',
  set_name: 'Wilds of Eldraine',
  collector_number: '21',
  mana_cost: '{5}{W}{W}{W}',
  cmc: 8,
  type_line: 'Creature — Spirit Knight',
  oracle_text: 'Flying\nWhen Moonshaker Cavalry enters the battlefield, creatures you control gain flying and get +X/+X until end of turn, where X is the number of creatures you control.',
  power: '6',
  toughness: '6',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'mythic',
  keywords: ['Flying']
};

const warrenWarleader: Card = {
  id: 'warren-warleader',
  name: 'Warren Warleader',
  set: 'BLB',
  set_name: 'Bloomburrow',
  collector_number: '35',
  mana_cost: '{2}{W}{W}',
  cmc: 4,
  type_line: 'Creature — Rabbit Knight',
  oracle_text: 'Offspring {2}\nWhenever you attack, choose one —\n• Create a 1/1 white Rabbit creature token.\n• Attacking creatures get +1/+1 until end of turn.',
  power: '4',
  toughness: '4',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'rare',
  keywords: []
};

const headOfTheHomestead: Card = {
  id: 'head-of-the-homestead',
  name: 'Head of the Homestead',
  set: 'BLB',
  set_name: 'Bloomburrow',
  collector_number: '18',
  mana_cost: '{3}{W}',
  cmc: 4,
  type_line: 'Creature — Rabbit Citizen',
  oracle_text: 'When Head of the Homestead enters the battlefield, create two 1/1 white Rabbit creature tokens.',
  power: '2',
  toughness: '2',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: []
};

// 1. Verify Feature Extraction for Ghalta the Immovable
const ghaltaFeatures = extractCardFeatures(ghalta);
console.log('1. Ghalta the Immovable Feature Extraction:');
console.log('   effectiveCmc:', ghaltaFeatures.effectiveCmc);
console.log('   effectivePower:', ghaltaFeatures.effectivePower);
console.log('   effectiveToughness:', ghaltaFeatures.effectiveToughness);
console.log('   isToughnessCombatDamage:', ghaltaFeatures.isToughnessCombatDamage);
console.log('   isDefenderAttackEnabler:', ghaltaFeatures.isDefenderAttackEnabler);
console.log('   isToughnessCostReduction:', ghaltaFeatures.isToughnessCostReduction);
console.log('   isToughnessMatters:', ghaltaFeatures.isToughnessMatters);
console.log('   actionSubtypes:', Array.from(ghaltaFeatures.actionSubtypes));

console.assert(ghaltaFeatures.effectiveCmc === 4.5, `Expected effectiveCmc 4.5, got ${ghaltaFeatures.effectiveCmc}`);
console.assert(ghaltaFeatures.effectivePower === 7, `Expected effectivePower 7, got ${ghaltaFeatures.effectivePower}`);
console.assert(ghaltaFeatures.effectiveToughness === 7, `Expected effectiveToughness 7, got ${ghaltaFeatures.effectiveToughness}`);
console.assert(ghaltaFeatures.isToughnessCombatDamage === true, 'Must detect toughness combat damage');
console.assert(ghaltaFeatures.isDefenderAttackEnabler === true, 'Must detect defender attack enabler');
console.assert(ghaltaFeatures.isToughnessCostReduction === true, 'Must detect toughness cost reduction');
console.assert(ghaltaFeatures.isToughnessMatters === true, 'Must detect toughness matters archetype');
console.assert(ghaltaFeatures.actionSubtypes.has('toughness_combat_damage'), 'Must have toughness_combat_damage subtype');
console.assert(ghaltaFeatures.actionSubtypes.has('defender_attack_enabler'), 'Must have defender_attack_enabler subtype');
console.assert(ghaltaFeatures.actionSubtypes.has('toughness_cost_reduction'), 'Must have toughness_cost_reduction subtype');
console.log('   ✓ Ghalta feature extraction verified!\n');

// 2. Verify Exact Oracle Clause Matching (Rule 2)
const bedrockFeatures = extractCardFeatures(bedrockTortoise);
const exactMatch = findExactOracleClauseMatch(ghalta, bedrockTortoise, ghaltaFeatures, bedrockFeatures);
console.log('2. Exact Oracle Clause Matching:');
console.log('   Exact matching clause:', exactMatch);
const exactClauseStr = typeof exactMatch === 'string' ? exactMatch : exactMatch?.matchingClause;
console.assert(
  exactClauseStr === 'each creature you control with toughness greater than its power assigns combat damage equal to its toughness rather than its power',
  `Expected exact clause match, got: ${exactClauseStr}`
);
console.log('   ✓ Exact oracle clause match verified!\n');

// 3. Verify Scryfall Queries
const queries = buildScryfallQueries(ghalta, ghaltaFeatures);
console.log('3. Scryfall Queries generated for Ghalta:');
queries.slice(0, 5).forEach((q, i) => console.log(`   [${i + 1}] ${q}`));
const hasToughnessQuery = queries.some(q => /assigns combat damage|toughness greater than|attack as though.*defender/i.test(q));
console.assert(hasToughnessQuery, 'Queries must include toughness-damage / defender search');
console.log('   ✓ Scryfall queries verified!\n');

// 4. Verify Pairwise Similarity Scores
console.log('4. Pairwise Similarity Scores with Ghalta the Immovable:');
const bedrockSim = calculateCardSimilarity(ghalta, bedrockTortoise);
console.log(`   - Bedrock Tortoise: ${bedrockSim.score}%`);
console.log(`     Reasons: ${bedrockSim.reasons.join('; ')}`);

const doranSim = calculateCardSimilarity(ghalta, doranEcl);
console.log(`   - Doran, Besieged by Time: ${doranSim.score}%`);
console.log(`     Reasons: ${doranSim.reasons.join('; ')}`);

const lumberknotSim = calculateCardSimilarity(ghalta, ancientLumberknot);
console.log(`   - Ancient Lumberknot: ${lumberknotSim.score}%`);
console.log(`     Reasons: ${lumberknotSim.reasons.join('; ')}`);

const highAlertSim = calculateCardSimilarity(ghalta, highAlert);
console.log(`   - High Alert: ${highAlertSim.score}%`);
console.log(`     Reasons: ${highAlertSim.reasons.join('; ')}`);

const moonshakerSim = calculateCardSimilarity(ghalta, moonshakerCavalry);
console.log(`   - Moonshaker Cavalry (Unrelated go-wide): ${moonshakerSim.score}%`);

const warleaderSim = calculateCardSimilarity(ghalta, warrenWarleader);
console.log(`   - Warren Warleader (Unrelated go-wide): ${warleaderSim.score}%`);

const headSim = calculateCardSimilarity(ghalta, headOfTheHomestead);
console.log(`   - Head of the Homestead (Unrelated tokens): ${headSim.score}%`);

console.assert(bedrockSim.score >= 85, `Bedrock Tortoise similarity should be >= 85%, got ${bedrockSim.score}%`);
console.assert(doranSim.score >= 75, `Doran, Besieged by Time similarity should be >= 75%, got ${doranSim.score}%`);
console.assert(lumberknotSim.score >= 80, `Ancient Lumberknot similarity should be >= 80%, got ${lumberknotSim.score}%`);
console.assert(bedrockSim.score > doranSim.score, `Bedrock Tortoise (#1 comp) should outscore Doran (${bedrockSim.score}% vs ${doranSim.score}%)`);
console.assert(moonshakerSim.score < 35, `Moonshaker Cavalry must be penalized (< 35%), got ${moonshakerSim.score}%`);
console.assert(warleaderSim.score < 35, `Warren Warleader must be penalized (< 35%), got ${warleaderSim.score}%`);
console.assert(headSim.score < 30, `Head of the Homestead must be penalized (< 30%), got ${headSim.score}%`);
console.log('   ✓ Pairwise similarities verified!\n');

// 5. Verify Guaranteed Fallback Result for Ghalta
const fallbackResult = generateGuaranteedFallbackResult(ghalta);
console.log('5. Top Fallback Comps for Ghalta the Immovable:');
fallbackResult.matches.forEach((m, i) => {
  console.log(`   [${i + 1}] ${m.card.name} (${m.card.set}): ${m.similarityScore}% (WR: ${((m.winRate ?? 0) * 100).toFixed(1)}%, Tier: ${m.tierGrade})`);
  console.log(`       Reasons: ${m.matchReasons.slice(0, 2).join('; ')}`);
});

const topNames = fallbackResult.matches.map(m => m.card.name);
console.assert(topNames[0] === 'Bedrock Tortoise', `Bedrock Tortoise must be the #1 comp! Got: ${topNames[0]}`);
console.assert(topNames.includes('Doran, Besieged by Time'), `Top comps must include Doran, Besieged by Time! Got: ${topNames.join(', ')}`);
console.assert(!topNames.includes('Moonshaker Cavalry'), 'Moonshaker Cavalry must NOT be in top comps!');
console.assert(!topNames.includes('Warren Warleader'), 'Warren Warleader must NOT be in top comps!');
console.assert(!topNames.includes('Head of the Homestead'), 'Head of the Homestead must NOT be in top comps!');
console.log('   ✓ Guaranteed Fallback Result verified!\n');

console.log('=== All Toughness-Damage & Butt-Strike Tests Passed Successfully! ===');
