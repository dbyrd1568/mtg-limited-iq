import assert from 'assert';
import { getFallbackCards } from '../services/scryfall';
import { classifyThreat, canCastWithOpenMana, getSetThreatCards, isCardThreat } from '../services/removalThreats';
import { generateQuiz } from '../services/quizGenerator';
import { QuizSettings, Card } from '../types/mtg';

console.log('=== Verifying Removal to Play Around & Threat Matrix Engine ===\n');

// 1. Test Threat Classification on Known Real Cards
const blbCards = getFallbackCards('BLB');
console.log(`Loaded ${blbCards.length} sample cards for BLB.`);

const fell = blbCards.find((c) => c.name === 'Fell')!;
assert.ok(fell, 'Fell must exist in BLB sample');
const fellClass = classifyThreat(fell);
console.log('Fell Classification:', fellClass);
assert.strictEqual(fellClass.speed, 'Sorcery', 'Fell must be Sorcery speed');
assert.strictEqual(fellClass.mechanism, 'Destroy', 'Fell must be hard Destroy');
assert.strictEqual(fellClass.isInstantOrFlash, false, 'Fell cannot be cast at instant speed');
assert.strictEqual(fellClass.isCommonOrUncommon, true, 'Fell is Uncommon');

const banishingLight = blbCards.find((c) => c.name === 'Banishing Light')!;
assert.ok(banishingLight, 'Banishing Light must exist in BLB sample');
const blClass = classifyThreat(banishingLight);
console.log('Banishing Light Classification:', blClass);
assert.strictEqual(blClass.mechanism, 'Exile', 'Banishing Light must be Exile');
assert.strictEqual(blClass.isInstantOrFlash, false, 'Banishing Light is not instant speed');

const mightOfTheMeek = blbCards.find((c) => c.name === 'Might of the Meek')!;
assert.ok(mightOfTheMeek, 'Might of the Meek must exist');
const mightClass = classifyThreat(mightOfTheMeek);
console.log('Might of the Meek Classification:', mightClass);
assert.strictEqual(mightClass.speed, 'Instant', 'Might of the Meek is Instant');
assert.strictEqual(mightClass.mechanism, 'Combat Trick', 'Might of the Meek is Combat Trick');
assert.strictEqual(mightClass.isInstantOrFlash, true, 'Might of the Meek is Instant or Flash');

console.log('✓ Card threat classifications verified.');

// 2. Test Open Mana Simulator Logic
console.log('\nTesting Open Mana Pool simulation:');

// Fell costs {1}{B} (2 CMC, requires 1 Black)
assert.strictEqual(
  canCastWithOpenMana(fell, { W: 0, U: 0, B: 1, R: 0, G: 0, C: 1 }),
  true,
  'Fell can be cast with 1 Black + 1 Generic'
);
assert.strictEqual(
  canCastWithOpenMana(fell, { W: 0, U: 0, B: 2, R: 0, G: 0, C: 0 }),
  true,
  'Fell can be cast with 2 Black'
);
assert.strictEqual(
  canCastWithOpenMana(fell, { W: 1, U: 1, B: 0, R: 0, G: 0, C: 0 }),
  false,
  'Fell CANNOT be cast without Black mana'
);
assert.strictEqual(
  canCastWithOpenMana(fell, { W: 0, U: 0, B: 1, R: 0, G: 0, C: 0 }),
  false,
  'Fell CANNOT be cast with only 1 mana (costs 2)'
);

// Might of the Meek costs {R} (1 CMC, requires 1 Red)
assert.strictEqual(
  canCastWithOpenMana(mightOfTheMeek, { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 }),
  true,
  'Might of the Meek can be cast with 1 Red'
);
assert.strictEqual(
  canCastWithOpenMana(mightOfTheMeek, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 2 }),
  false,
  'Might of the Meek CANNOT be cast with only generic mana'
);

console.log('✓ canCastWithOpenMana correctly enforces colored pips and total CMC.');

// 3. Test Synthetic Mock Cards for Specific Threat Mechanisms
const testBurnCard: Card = {
  id: 'test_burn_1',
  name: 'Lightning Strike',
  set: 'TST',
  set_name: 'Test Set',
  collector_number: '1',
  mana_cost: '{1}{R}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Lightning Strike deals 3 damage to any target.',
  colors: ['R'],
  color_identity: ['R'],
  keywords: [],
  rarity: 'common',
};
const burnClass = classifyThreat(testBurnCard);
assert.strictEqual(burnClass.mechanism, 'Burn');
assert.strictEqual(burnClass.damageAmount, 3);
assert.strictEqual(burnClass.isInstantOrFlash, true);
assert.strictEqual(burnClass.shortSummary, 'Deals 3 damage to any target');

const testMinusCard: Card = {
  id: 'test_minus_1',
  name: 'Disfigure',
  set: 'TST',
  set_name: 'Test Set',
  collector_number: '2',
  mana_cost: '{B}',
  cmc: 1,
  type_line: 'Instant',
  oracle_text: 'Target creature gets -2/-2 until end of turn.',
  colors: ['B'],
  color_identity: ['B'],
  keywords: [],
  rarity: 'uncommon',
};
const minusClass = classifyThreat(testMinusCard);
assert.strictEqual(minusClass.mechanism, '-N/-N');
assert.strictEqual(minusClass.statMod, '-2/-2');
assert.strictEqual(minusClass.shortSummary, 'Target creature gets -2/-2');

const testCounterCard: Card = {
  id: 'test_counter_1',
  name: 'Essence Scatter',
  set: 'TST',
  set_name: 'Test Set',
  collector_number: '3',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Counter target creature spell.',
  colors: ['U'],
  color_identity: ['U'],
  keywords: [],
  rarity: 'common',
};
const counterClass = classifyThreat(testCounterCard);
assert.strictEqual(counterClass.mechanism, 'Counterspell');
assert.strictEqual(counterClass.shortSummary, 'Counter target creature spell');

const testFightCard: Card = {
  id: 'test_fight_1',
  name: 'Bite Down',
  set: 'TST',
  set_name: 'Test Set',
  collector_number: '4',
  mana_cost: '{1}{G}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Target creature you control deals damage equal to its power to target creature you don\'t control.',
  colors: ['G'],
  color_identity: ['G'],
  keywords: [],
  rarity: 'common',
};
const fightClass = classifyThreat(testFightCard);
assert.strictEqual(fightClass.mechanism, 'Fight/Bite');

const testConditionalKill: Card = {
  id: 'test_cond_1',
  name: 'Smite the Monstrous',
  set: 'TST',
  set_name: 'Test Set',
  collector_number: '5',
  mana_cost: '{3}{W}',
  cmc: 4,
  type_line: 'Instant',
  oracle_text: 'Destroy target creature with power 4 or greater.',
  colors: ['W'],
  color_identity: ['W'],
  keywords: [],
  rarity: 'common',
};
const condClass = classifyThreat(testConditionalKill);
assert.strictEqual(condClass.mechanism, 'Destroy');
assert.strictEqual(condClass.restriction, 'Power ≥ 4');

console.log('✓ Mechanism parsers (Burn, -N/-N, Counterspell, Fight/Bite, Conditionals) verified.');

// 4. Test "Removal to Play Around" Quiz Generation
console.log('\nTesting "Removal to Play Around" Quiz Generation:');
const testCards: Card[] = [
  fell,
  banishingLight,
  mightOfTheMeek,
  testBurnCard,
  testMinusCard,
  testCounterCard,
  testFightCard,
  testConditionalKill,
  ...blbCards,
];

const quizSettings: QuizSettings = {
  setCode: 'TST',
  setName: 'Test Set',
  questionCount: 6,
  categories: ['removal_to_play_around'],
  rarities: ['common', 'uncommon'],
  timerSeconds: 0,
  mode: 'quiz',
};

const questions = generateQuiz(testCards, quizSettings, null);
console.log(`Generated ${questions.length} questions for category 'removal_to_play_around'.`);
assert.ok(questions.length > 0, 'Must generate at least 1 question for removal_to_play_around');

for (const q of questions) {
  assert.strictEqual(q.category, 'removal_to_play_around');
  assert.ok(q.title.includes('Removal to Play Around'), 'Title must contain Removal to Play Around');
  assert.ok(q.prompt.length > 10, 'Prompt must be descriptive');
  assert.ok(q.tacticalContext.length > 15, 'Tactical context must be provided');
  assert.ok(q.options.length >= 2, 'Must have at least 2 options');
  assert.ok(q.options.some((o) => o.isCorrect), 'At least one option must be correct');
  assert.ok(q.explanation.length > 10, 'Explanation must be informative');
  console.log(`   [Q] ${q.title} | ${q.prompt.slice(0, 70)}... -> Correct: ${q.correctAnswer}`);
}

console.log('✓ Removal to Play Around quiz generation fully verified.');
console.log('\n🎉 ALL REMOVAL TO PLAY AROUND & THREAT MATRIX TESTS PASSED!');
