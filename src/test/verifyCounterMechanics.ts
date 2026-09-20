import { calculateCardSimilarity, extractCardFeatures, buildScryfallQueries } from '../services/cardSimilarity';
import { Card } from '../types/mtg';

console.log('=== Verifying Counter Mechanics & Nuances ===\n');

// 1. Graft Surgeon (Static Enters-with +1/+1 counter -> effective 3/3, Modular/Death Counter Transfer)
const graftSurgeon: Card = {
  id: 'graft-surgeon',
  name: 'Graft Surgeon',
  set: 'FRA',
  set_name: 'Final Fantasy',
  collector_number: '10',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Human Cleric',
  oracle_text: 'This creature enters with a +1/+1 counter on it.\nWhen this creature dies, put its counters on up to one target creature you control.',
  power: '2',
  toughness: '2',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: []
};

// 2. Avatar Enthusiasts (Alliance / Creature-fall triggered growth -> base 2/2, conditional trigger)
const avatarEnthusiasts: Card = {
  id: 'avatar-enthusiasts',
  name: 'Avatar Enthusiasts',
  set: 'TLA',
  set_name: 'Avatar',
  collector_number: '11',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Human Peasant Ally',
  oracle_text: 'Whenever another Ally you control enters, put a +1/+1 counter on this creature.',
  power: '2',
  toughness: '2',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: []
};

// 3. Natural 3/3 for 3 ({2}{W}) (Tempo / statline comp)
const natural33: Card = {
  id: 'natural-33',
  name: 'Alpine Watchdog 33',
  set: 'M21',
  set_name: 'Core Set 2021',
  collector_number: '2',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Dog',
  oracle_text: 'Vigilance',
  power: '3',
  toughness: '3',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: ['Vigilance']
};

// 4. 2/2 with ETB +1/+1 counter on self (effective 3/3 with counter synergy)
const etbCounter22: Card = {
  id: 'etb-counter-card',
  name: 'Steadfast Paladin',
  set: 'AFR',
  set_name: 'Adventures in the Forgotten Realms',
  collector_number: '38',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Human Knight',
  oracle_text: 'When Steadfast Paladin enters the battlefield, put a +1/+1 counter on it.',
  power: '2',
  toughness: '2',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: []
};

// 5. Star Pupil (1-drop modular / death counter transfer precedent)
const starPupil: Card = {
  id: 'star-pupil',
  name: 'Star Pupil',
  set: 'STX',
  set_name: 'Strixhaven: School of Mages',
  collector_number: '30',
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

// --- Test 1: Feature Extraction Accuracy ---
console.log('[TEST 1] Feature Extraction:');
const surgeonFeatures = extractCardFeatures(graftSurgeon);
console.log('   Graft Surgeon effective stats:', `${surgeonFeatures.power}/${surgeonFeatures.toughness}`);
console.assert(surgeonFeatures.power === 3, 'Graft Surgeon effective power must be 3 (2 printed + 1 counter)');
console.assert(surgeonFeatures.toughness === 3, 'Graft Surgeon effective toughness must be 3 (2 printed + 1 counter)');
console.assert(surgeonFeatures.actionSubtypes.has('enters_with_counters'), 'Graft Surgeon must have enters_with_counters');
console.assert(surgeonFeatures.actionSubtypes.has('death_counter_transfer'), 'Graft Surgeon must have death_counter_transfer');
console.assert(!surgeonFeatures.actionSubtypes.has('triggered_growth_other_enters'), 'Graft Surgeon must NOT have triggered_growth_other_enters');
console.log('   ✓ Graft Surgeon effective 3/3 and action subtypes verified.');

const avatarFeatures = extractCardFeatures(avatarEnthusiasts);
console.log('   Avatar Enthusiasts effective stats:', `${avatarFeatures.power}/${avatarFeatures.toughness}`);
console.assert(avatarFeatures.power === 2, 'Avatar Enthusiasts effective power must remain 2 (under-statted base)');
console.assert(avatarFeatures.toughness === 2, 'Avatar Enthusiasts effective toughness must remain 2 (under-statted base)');
console.assert(avatarFeatures.actionSubtypes.has('triggered_growth_other_enters'), 'Avatar Enthusiasts must have triggered_growth_other_enters');
console.assert(!avatarFeatures.actionSubtypes.has('enters_with_counters'), 'Avatar Enthusiasts must NOT have enters_with_counters');
console.assert(!avatarFeatures.actionSubtypes.has('death_counter_transfer'), 'Avatar Enthusiasts must NOT have death_counter_transfer');
console.log('   ✓ Avatar Enthusiasts triggered growth and base stats verified.');

// --- Test 2: Scryfall Query Generation ---
console.log('\n[TEST 2] Scryfall Query Generation for Graft Surgeon:');
const surgeonQueries = buildScryfallQueries(graftSurgeon, surgeonFeatures);
console.log('   Total queries generated:', surgeonQueries.length);
console.assert(
  surgeonQueries.some(q => q.includes('pow=3') && q.includes('tou=3')),
  'Scryfall queries must query pow=3 tou=3 for effective 3/3 Graft Surgeon'
);
console.assert(
  surgeonQueries.some(q => q.includes('o:"dies"') && q.includes('counters on')),
  'Scryfall queries must include death counter transfer queries'
);
console.assert(
  surgeonQueries.some(q => q.includes('o:"enters with"') && q.includes('o:"+1/+1 counter"')),
  'Scryfall queries must include enters with counter queries'
);
console.log('   ✓ Scryfall queries for Graft Surgeon correctly target 3/3s, enters-with counters, and death counter transfer.');

// --- Test 3: Comparison Nuances ---
console.log('\n[TEST 3] Comparison Nuances & Scores:');
const surgeonVsAvatar = calculateCardSimilarity(graftSurgeon, avatarEnthusiasts);
console.log('   Surgeon vs Avatar (Alliance trigger):', surgeonVsAvatar.score, '%');

const surgeonVsNatural33 = calculateCardSimilarity(graftSurgeon, natural33);
console.log('   Surgeon vs Natural 3/3:', surgeonVsNatural33.score, '%', surgeonVsNatural33.reasons);
console.assert(
  surgeonVsNatural33.reasons.some(r => r.includes('Exact effective P/T (3/3)')),
  'Surgeon vs Natural 3/3 must cite Exact effective P/T (3/3)'
);

const surgeonVsEtbCounter = calculateCardSimilarity(graftSurgeon, etbCounter22);
console.log('   Surgeon vs ETB Counter 2/2 (effective 3/3):', surgeonVsEtbCounter.score, '%', surgeonVsEtbCounter.reasons);
console.assert(
  surgeonVsEtbCounter.score > surgeonVsAvatar.score,
  'ETB Counter 2/2 (effective 3/3) must score higher than Avatar Enthusiasts'
);

const surgeonVsStarPupil = calculateCardSimilarity(graftSurgeon, starPupil);
console.log('   Surgeon vs Star Pupil (Modular transfer):', surgeonVsStarPupil.score, '%', surgeonVsStarPupil.reasons);
console.assert(
  surgeonVsStarPupil.reasons.some(r => r.includes('Both transfer +1/+1 counters upon death (Modular / counter bequeath)')),
  'Surgeon vs Star Pupil must cite Modular death counter transfer'
);

console.log('\n🎉 ALL COUNTER MECHANIC VERIFICATION TESTS PASSED SUCCESSFULLY!');
