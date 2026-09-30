import { Card } from '../types/mtg';
import { calculateCardSimilarity } from '../services/cardSimilarity';
import { buildScryfallPrecedentQuery } from '../components/Evaluation/PrecedentCardSearch';

export const stingingVitriol: Card = {
  id: 'fra-152',
  name: 'Stinging Vitriol',
  set: 'FRA',
  set_name: 'Reality Fracture',
  collector_number: '152',
  mana_cost: '{B}{R}',
  cmc: 2,
  type_line: 'Sorcery',
  oracle_text: 'Stinging Vitriol deals 2 damage to target opponent. That player reveals their hand. You choose a nonland card from it. They discard that card.',
  colors: ['B', 'R'],
  color_identity: ['B', 'R'],
  rarity: 'rare',
  keywords: [],
};

export const blightning: Card = {
  id: 'a25-blightning',
  name: 'Blightning',
  set: 'A25',
  set_name: 'Masters 25',
  collector_number: '198',
  mana_cost: '{1}{B}{R}',
  cmc: 3,
  type_line: 'Sorcery',
  oracle_text: 'Blightning deals 3 damage to target player. That player discards two cards.',
  colors: ['B', 'R'],
  color_identity: ['B', 'R'],
  rarity: 'uncommon',
  keywords: [],
};

export const agonizingRemorse: Card = {
  id: 'thb-agonizing-remorse',
  name: 'Agonizing Remorse',
  set: 'THB',
  set_name: 'Theros Beyond Death',
  collector_number: '83',
  mana_cost: '{1}{B}',
  cmc: 2,
  type_line: 'Sorcery',
  oracle_text: 'Target opponent reveals their hand. You choose a nonland card from it or a card from their graveyard. Exile that card. You lose 1 life.',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'uncommon',
  keywords: [],
};

export const pilfer: Card = {
  id: 'dmu-pilfer',
  name: 'Pilfer',
  set: 'DMU',
  set_name: 'Dominaria United',
  collector_number: '102',
  mana_cost: '{1}{B}',
  cmc: 2,
  type_line: 'Sorcery',
  oracle_text: 'Target opponent reveals their hand. You choose a nonland card from it. That player discards that card.',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'common',
  keywords: [],
};

export const drillBit: Card = {
  id: 'rna-drill-bit',
  name: 'Drill Bit',
  set: 'RNA',
  set_name: 'Ravnica Allegiance',
  collector_number: '73',
  mana_cost: '{2}{B}',
  cmc: 3,
  type_line: 'Sorcery',
  oracle_text: 'Spectacle {B}\nTarget player reveals their hand. You choose a nonland card from it. That player discards that card.',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'uncommon',
  keywords: ['Spectacle'],
};

export const theGreatGoblin: Card = {
  id: 'hob-great-goblin',
  name: 'The Great Goblin',
  set: 'HOB',
  set_name: 'The Hobbit',
  collector_number: '200',
  mana_cost: '{2}{B}{R}',
  cmc: 4,
  type_line: 'Creature — Goblin',
  oracle_text: 'When The Great Goblin enters, it deals 2 damage to target opponent. That player reveals their hand.',
  colors: ['B', 'R'],
  color_identity: ['B', 'R'],
  power: '3',
  toughness: '3',
  rarity: 'rare',
  keywords: [],
};

export const moltenCollapse: Card = {
  id: 'lci-molten-collapse',
  name: 'Molten Collapse',
  set: 'LCI',
  set_name: 'The Lost Caverns of Ixalan',
  collector_number: '234',
  mana_cost: '{B}{R}',
  cmc: 2,
  type_line: 'Sorcery',
  oracle_text: 'Choose one. If you descended this turn, you may choose both instead.\n• Destroy target creature or planeswalker.\n• Destroy target noncreature, nonland permanent with mana value 1 or less.',
  colors: ['B', 'R'],
  color_identity: ['B', 'R'],
  rarity: 'rare',
  keywords: [],
};

export const angrathsRampage: Card = {
  id: 'war-angraths-rampage',
  name: "Angrath's Rampage",
  set: 'WAR',
  set_name: 'War of the Spark',
  collector_number: '185',
  mana_cost: '{B}{R}',
  cmc: 2,
  type_line: 'Sorcery',
  oracle_text: 'Choose one —\n• Target player sacrifices an artifact.\n• Target player sacrifices a creature.\n• Target player sacrifices a planeswalker.',
  colors: ['B', 'R'],
  color_identity: ['B', 'R'],
  rarity: 'uncommon',
  keywords: [],
};

export const corpseExplosion: Card = {
  id: 'snc-corpse-explosion',
  name: 'Corpse Explosion',
  set: 'SNC',
  set_name: 'Streets of New Capenna',
  collector_number: '179',
  mana_cost: '{1}{B}{R}',
  cmc: 3,
  type_line: 'Sorcery',
  oracle_text: 'As an additional cost to cast this spell, exile a creature card from your graveyard.\nCorpse Explosion deals damage equal to the exiled card\'s power to each creature and planeswalker.',
  colors: ['B', 'R'],
  color_identity: ['B', 'R'],
  rarity: 'rare',
  keywords: [],
};

export const fatalGrudge: Card = {
  id: 'snc-fatal-grudge',
  name: 'Fatal Grudge',
  set: 'SNC',
  set_name: 'Streets of New Capenna',
  collector_number: '187',
  mana_cost: '{B}{R}',
  cmc: 2,
  type_line: 'Sorcery',
  oracle_text: 'As an additional cost to cast this spell, sacrifice a nonland permanent.\nTarget opponent sacrifices a permanent that shares a card type with the sacrificed permanent. Then you draw a card.',
  colors: ['B', 'R'],
  color_identity: ['B', 'R'],
  rarity: 'uncommon',
  keywords: [],
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('Testing Hand Disruption and Comps Verification...');

// 1. High-tier true comps for Stinging Vitriol
const blightningRes = calculateCardSimilarity(stingingVitriol, blightning);
console.log(`Blightning score: ${blightningRes.score}% (reasons: ${blightningRes.reasons.join(', ')})`);
assert(blightningRes.score >= 80, `Expected Blightning >= 80%, got ${blightningRes.score}%`);

const agonizingRes = calculateCardSimilarity(stingingVitriol, agonizingRemorse);
console.log(`Agonizing Remorse score: ${agonizingRes.score}% (reasons: ${agonizingRes.reasons.join(', ')})`);
assert(agonizingRes.score >= 70, `Expected Agonizing Remorse >= 70%, got ${agonizingRes.score}%`);

const pilferRes = calculateCardSimilarity(stingingVitriol, pilfer);
console.log(`Pilfer score: ${pilferRes.score}% (reasons: ${pilferRes.reasons.join(', ')})`);
assert(pilferRes.score >= 70, `Expected Pilfer >= 70%, got ${pilferRes.score}%`);

const drillBitRes = calculateCardSimilarity(stingingVitriol, drillBit);
console.log(`Drill Bit score: ${drillBitRes.score}% (reasons: ${drillBitRes.reasons.join(', ')})`);
assert(drillBitRes.score >= 70, `Expected Drill Bit >= 70%, got ${drillBitRes.score}%`);

// 2. Suppression of irrelevant board removal / sacrifice spells
const moltenRes = calculateCardSimilarity(stingingVitriol, moltenCollapse);
console.log(`Molten Collapse score: ${moltenRes.score}%`);
assert(moltenRes.score <= 25, `Expected Molten Collapse <= 25%, got ${moltenRes.score}%`);

const angrathRes = calculateCardSimilarity(stingingVitriol, angrathsRampage);
console.log(`Angrath's Rampage score: ${angrathRes.score}%`);
assert(angrathRes.score <= 25, `Expected Angrath's Rampage <= 25%, got ${angrathRes.score}%`);

const corpseRes = calculateCardSimilarity(stingingVitriol, corpseExplosion);
console.log(`Corpse Explosion score: ${corpseRes.score}%`);
assert(corpseRes.score <= 25, `Expected Corpse Explosion <= 25%, got ${corpseRes.score}%`);

const fatalRes = calculateCardSimilarity(stingingVitriol, fatalGrudge);
console.log(`Fatal Grudge score: ${fatalRes.score}%`);
assert(fatalRes.score <= 25, `Expected Fatal Grudge <= 25%, got ${fatalRes.score}%`);

// 3. The Great Goblin partial match (not 0%, not high, shares exact text clause)
const goblinRes = calculateCardSimilarity(stingingVitriol, theGreatGoblin);
console.log(`The Great Goblin score: ${goblinRes.score}% (reasons: ${goblinRes.reasons.join(', ')})`);
assert(goblinRes.score > 0, `Expected The Great Goblin > 0%, got ${goblinRes.score}%`);
assert(goblinRes.score <= 28, `Expected The Great Goblin <= 28%, got ${goblinRes.score}%`);
assert(
  goblinRes.reasons.some(r => r.includes('Shares exact clause:')),
  'Expected The Great Goblin to show exact clause match reason'
);

// 4. Incompatible vanilla baseline (Murder vs Grizzly Bears is strictly 0%)
const murder: Card = {
  id: 'm1',
  name: 'Murder',
  set: 'M13',
  set_name: 'Magic 2013',
  collector_number: '101',
  mana_cost: '{1}{B}{B}',
  cmc: 3,
  type_line: 'Instant',
  oracle_text: 'Destroy target creature.',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'common',
  keywords: [],
};
const grizzlyBears: Card = {
  id: 'g1',
  name: 'Grizzly Bears',
  set: '10E',
  set_name: 'Tenth Edition',
  collector_number: '268',
  mana_cost: '{1}{G}',
  cmc: 2,
  type_line: 'Creature — Bear',
  oracle_text: '',
  colors: ['G'],
  color_identity: ['G'],
  power: '2',
  toughness: '2',
  rarity: 'common',
  keywords: [],
};
const murderRes = calculateCardSimilarity(murder, grizzlyBears);
console.log(`Murder vs Grizzly Bears score: ${murderRes.score}%`);
assert(murderRes.score === 0, `Expected Murder vs Grizzly Bears === 0%, got ${murderRes.score}%`);

// 5. Precedent query excludes MBC and Commander sets
const query = buildScryfallPrecedentQuery('target opponent discards', 'FRA');
console.log(`Scryfall Precedent Query: ${query}`);
assert(query.includes('-s:mbc'), 'Expected query to exclude -s:mbc');
assert(query.includes('-is:commander'), 'Expected query to exclude -is:commander');
assert(query.includes('(is:booster or is:premier)'), 'Expected query to prioritize boosters/premier');

console.log('✅ ALL HAND DISRUPTION & PRECEDENT QUERY CHECKS PASSED!');
