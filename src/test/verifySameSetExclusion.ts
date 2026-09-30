import {
  isSameOrCompanionSet,
  getCompanionSetCodes,
  calculateCardSimilarity,
  generateGuaranteedFallbackResult,
  buildScryfallQueries,
  extractCardFeatures,
} from '../services/cardSimilarity';
import { buildScryfallPrecedentQuery } from '../components/Evaluation/PrecedentCardSearch';
import { Card } from '../types/mtg';

console.log('=== Verifying Same Set & Companion Set Comp Exclusion Architecture ===\n');

// 1. Test isSameOrCompanionSet
console.log('1. Testing isSameOrCompanionSet:');
const companionPairs: [string, string][] = [
  ['MSH', 'MSH'],
  ['MSH', 'MSC'],
  ['MSC', 'MSH'],
  ['msh', 'msc'],
  ['MSH', 'TMSH'],
  ['BLB', 'BLC'],
  ['BLC', 'BLB'],
  ['BLB', 'Y25BLB'],
  ['SOS', 'SOC'],
  ['SOC', 'SOS'],
  ['SOS', 'TSOS'],
  ['SOS', 'Y26SOS'],
  ['OTJ', 'BIG'],
  ['OTJ', 'OTP'],
  ['OTJ', 'OTC'],
  ['BIG', 'OTJ'],
  ['MKM', 'MKC'],
  ['MKM', 'SPG'],
  ['LCI', 'LCC'],
  ['MH3', 'M3C'],
  ['M3C', 'MH3'],
  ['SNC', 'NCC'],
  ['NCC', 'SNC'],
  ['STX', 'STA'],
  ['STX', 'C21'],
  ['ECL', 'ECC'],
  ['TDM', 'TDC'],
  ['FIN', 'FIC'],
  ['DFT', 'DFC'],
  ['FDN', 'FDC'],
  ['DSK', 'DSC'],
  ['WOE', 'WOC'],
  ['WOE', 'WOT'],
  ['MOM', 'MOC'],
  ['MOM', 'MUL'],
  ['ONE', 'ONC'],
  ['BRO', 'BRC'],
  ['BRO', 'BRR'],
  ['DMU', 'DMC'],
  ['NEO', 'NEC'],
  ['VOW', 'VOC'],
  ['MID', 'MIC'],
];

for (const [a, b] of companionPairs) {
  const result = isSameOrCompanionSet(a, b);
  console.assert(result === true, `Expected isSameOrCompanionSet('${a}', '${b}') to be true, got ${result}`);
}
console.log(`   ✓ All ${companionPairs.length} companion/same-set pairs correctly recognized as true!`);

const nonCompanionPairs: [string, string][] = [
  ['MSH', 'BLB'],
  ['MSH', 'STX'],
  ['MSH', 'AFR'],
  ['SOS', 'STX'], // STX is historical precedent for SOS (different historical sets)
  ['SOS', 'BLB'],
  ['BLB', 'WOE'],
  ['ECL', 'DFT'],
  ['TDM', 'KTK'],
  ['FIN', 'ONE'],
  ['MKM', 'MID'],
];

for (const [a, b] of nonCompanionPairs) {
  const result = isSameOrCompanionSet(a, b);
  console.assert(result === false, `Expected isSameOrCompanionSet('${a}', '${b}') to be false, got ${result}`);
}
console.log(`   ✓ All ${nonCompanionPairs.length} distinct historical set pairs correctly recognized as false!\n`);

// 2. Test getCompanionSetCodes
console.log('2. Testing getCompanionSetCodes:');
const mshComps = getCompanionSetCodes('MSH');
console.assert(mshComps.includes('MSH'), 'getCompanionSetCodes(MSH) must include MSH');
console.assert(mshComps.includes('MSC'), 'getCompanionSetCodes(MSH) must include MSC');
console.assert(mshComps.includes('TMSH'), 'getCompanionSetCodes(MSH) must include TMSH');

const sosComps = getCompanionSetCodes('SOS');
console.assert(sosComps.includes('SOS'), 'getCompanionSetCodes(SOS) must include SOS');
console.assert(sosComps.includes('SOC'), 'getCompanionSetCodes(SOS) must include SOC');

const otjComps = getCompanionSetCodes('OTJ');
console.assert(otjComps.includes('BIG'), 'getCompanionSetCodes(OTJ) must include BIG');
console.assert(otjComps.includes('OTP'), 'getCompanionSetCodes(OTJ) must include OTP');
console.assert(otjComps.includes('OTC'), 'getCompanionSetCodes(OTJ) must include OTC');
console.log('   ✓ Companion set codes extraction verified!\n');

// 3. Test calculateCardSimilarity Precedent Gatekeeper
console.log('3. Testing calculateCardSimilarity Hard Rule (Never use same set/companion set to comp):');
const agent13: Card = {
  id: 'msh-agent-13',
  name: 'Agent 13, Sharon Carter',
  set: 'MSH',
  set_name: 'Marvel Super Heroes',
  collector_number: '1',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Human Soldier Hero',
  oracle_text: 'When Agent 13 enters, draw a card.',
  power: '2',
  toughness: '2',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: [],
};

const heroInTrainingMSC: Card = {
  id: 'msc-hero-in-training',
  name: 'Hero in Training',
  set: 'MSC',
  set_name: 'Marvel Super Heroes Commander',
  collector_number: '12',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Human Hero',
  oracle_text: 'When Hero in Training enters the battlefield, draw a card. If you control another Hero, you gain 2 life.',
  power: '2',
  toughness: '2',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: [],
};

const sameSetCardMSH: Card = {
  id: 'msh-captain-america',
  name: 'Steve Rogers',
  set: 'MSH',
  set_name: 'Marvel Super Heroes',
  collector_number: '2',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Human Soldier',
  oracle_text: 'When Steve Rogers enters, draw a card.',
  power: '2',
  toughness: '2',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'uncommon',
  keywords: [],
};

const historicalCompAFR: Card = {
  id: 'afr-priest-of-ancient-lore',
  name: 'Priest of Ancient Lore',
  set: 'AFR',
  set_name: 'Adventures in the Forgotten Realms',
  collector_number: '35',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Dwarf Cleric',
  oracle_text: 'When Priest of Ancient Lore enters the battlefield, you gain 1 life and draw a card.',
  power: '2',
  toughness: '1',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: [],
};

// Sharon Carter vs Hero in Training (MSC) MUST score 0%
const simSharonVsHero = calculateCardSimilarity(agent13, heroInTrainingMSC);
console.log(`   - Sharon Carter (MSH) vs Hero in Training (MSC): ${simSharonVsHero.score}%`);
console.assert(
  simSharonVsHero.score === 0,
  `Sharon Carter vs Hero in Training (MSC) MUST score 0%! Got: ${simSharonVsHero.score}%`
);

// Sharon Carter vs Steve Rogers (MSH) MUST score 0%
const simSharonVsSteve = calculateCardSimilarity(agent13, sameSetCardMSH);
console.log(`   - Sharon Carter (MSH) vs Steve Rogers (MSH): ${simSharonVsSteve.score}%`);
console.assert(
  simSharonVsSteve.score === 0,
  `Sharon Carter vs Steve Rogers (MSH) MUST score 0%! Got: ${simSharonVsSteve.score}%`
);

// Sharon Carter vs Priest of Ancient Lore (AFR) SHOULD score high
const simSharonVsPriest = calculateCardSimilarity(agent13, historicalCompAFR);
console.log(`   - Sharon Carter (MSH) vs Priest of Ancient Lore (AFR): ${simSharonVsPriest.score}%`);
console.assert(
  simSharonVsPriest.score >= 80,
  `Sharon Carter vs Priest of Ancient Lore (AFR) must score >= 80%! Got: ${simSharonVsPriest.score}%`
);
console.log('   ✓ calculateCardSimilarity gatekeeper strictly enforces 0% on same or companion set!\n');

// 4. Test generateGuaranteedFallbackResult
console.log('4. Testing generateGuaranteedFallbackResult set exclusion:');
const mshFallback = generateGuaranteedFallbackResult(agent13);
console.log('   Top fallback comps for Sharon Carter (MSH):');
mshFallback.matches.forEach((m, i) => {
  console.log(`     [${i + 1}] ${m.card.name} (${m.card.set}): ${m.similarityScore}%`);
  console.assert(
    !isSameOrCompanionSet(agent13.set, m.card.set),
    `Fallback comp ${m.card.name} (${m.card.set}) belongs to same/companion set as target (${agent13.set})!`
  );
  console.assert(
    m.similarityScore > 0,
    `Fallback comp ${m.card.name} must have a positive similarity score! Got: ${m.similarityScore}`
  );
});
console.log('   ✓ Sharon Carter fallback comps contain ZERO MSH or MSC cards!\n');

// 5. Test buildScryfallQueries companion exclusion
console.log('5. Testing buildScryfallQueries companion exclusion:');
const agent13Features = extractCardFeatures(agent13);
const queries = buildScryfallQueries(agent13, agent13Features);

console.assert(queries.length > 0, 'Must generate at least 1 Scryfall query');
for (const q of queries) {
  console.assert(q.includes('-s:msh'), `Query must negate -s:msh! Got: ${q}`);
  console.assert(q.includes('-s:msc'), `Query must negate -s:msc! Got: ${q}`);
}
console.log('   ✓ buildScryfallQueries negates both -s:msh and -s:msc!\n');

// 6. Test buildScryfallPrecedentQuery companion exclusion
console.log('6. Testing buildScryfallPrecedentQuery companion exclusion:');
const precedentQuery = buildScryfallPrecedentQuery('draw a card 2/2', 'MSH');
console.log(`   Precedent Query for MSH: "${precedentQuery}"`);
console.assert(precedentQuery.includes('-s:msh'), `Precedent query must negate -s:msh! Got: ${precedentQuery}`);
console.assert(precedentQuery.includes('-s:msc'), `Precedent query must negate -s:msc! Got: ${precedentQuery}`);
console.log('   ✓ buildScryfallPrecedentQuery negates both -s:msh and -s:msc!\n');

console.log('=== All Same-Set & Companion-Set Exclusion Tests Passed Successfully! ===');
