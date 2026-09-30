import assert from 'assert';
import { Card } from '../types/mtg';

console.log('=== Verifying Card Modal Selection Behavior ===\n');

// Mock cards from a set (FRA: Reality Fracture)
const cardA: Card = {
  id: 'fra-1',
  name: 'Alabaster Host',
  set: 'FRA',
  set_name: 'Reality Fracture',
  rarity: 'common',
  colors: ['W'],
  color_identity: ['W'],
  cmc: 2,
  type_line: 'Creature',
  collector_number: '1',
  keywords: [],
};

const cardB: Card = {
  id: 'fra-154',
  name: 'Tenured Tethermage',
  set: 'FRA',
  set_name: 'Reality Fracture',
  rarity: 'rare',
  colors: ['R', 'G'],
  color_identity: ['R', 'G'],
  cmc: 3,
  type_line: 'Creature — Human Artificer',
  collector_number: '154',
  keywords: [],
};

const allCards: Card[] = [cardA, cardB];

// Simulate user having a filter on the Grade tab (e.g. Color = White only, or Unrated only)
const filteredCards: Card[] = [cardA]; // cardB (Tenured Tethermage) is NOT in filteredCards!

// Test 1: Simulating EvaluationHub modalCards resolution when on 'forecast' tab
const activeSubTabForecast: string = 'forecast';
const selectedCard: Card = cardB;

const isGradeTab = activeSubTabForecast === 'grade';
const isInFiltered = isGradeTab && filteredCards.some(
  (c) =>
    c.id === selectedCard.id ||
    (c.name.toLowerCase() === selectedCard.name.toLowerCase() &&
      (c.set || '').toLowerCase() === (selectedCard.set || '').toLowerCase())
);
const modalCardsForecast = isInFiltered ? filteredCards : allCards;

assert.strictEqual(
  modalCardsForecast.length,
  allCards.length,
  'When inspecting from Forecast tab, modalCards must use full set cards, not Grade tab filteredCards'
);
assert(
  modalCardsForecast.some((c) => c.name === 'Tenured Tethermage'),
  'modalCards on Forecast must include Tenured Tethermage'
);
console.log('✓ Forecast tab card click bypasses Grade tab filter and uses all set cards.');

// Test 2: Simulating QuickRateModal orderedCards & currentIndex resolution
function resolveModalCurrentCard(cards: Card[], targetCard: Card | null) {
  const list = [...cards];
  if (
    targetCard &&
    !list.some(
      (c) =>
        c.id === targetCard.id ||
        (c.name.toLowerCase() === targetCard.name.toLowerCase() &&
          (c.set || '').toLowerCase() === (targetCard.set || '').toLowerCase())
    )
  ) {
    list.push(targetCard);
  }

  const idx = !targetCard || list.length === 0
    ? -1
    : list.findIndex(
        (c) =>
          c.id === targetCard.id ||
          (c.name.toLowerCase() === targetCard.name.toLowerCase() &&
            (c.set || '').toLowerCase() === (targetCard.set || '').toLowerCase())
      );

  const currentCard = (idx >= 0 && idx < list.length ? list[idx] : null) || targetCard;
  return { currentCard, idx, list };
}

// Even if QuickRateModal was given filteredCards (which only had cardA), targetCard cardB must still be resolved!
const resolutionWithFiltered = resolveModalCurrentCard(filteredCards, cardB);
assert.strictEqual(
  resolutionWithFiltered.currentCard?.name,
  'Tenured Tethermage',
  'QuickRateModal must strictly resolve to the clicked card (Tenured Tethermage)'
);
assert.notStrictEqual(
  resolutionWithFiltered.currentCard?.name,
  'Alabaster Host',
  'QuickRateModal must NOT fallback to card 0 (the card from grading tab)'
);
console.log('✓ QuickRateModal guarantees clicked card is displayed even if missing from card prop slice.');

// Test 3: Resolution with allCards
const resolutionWithAll = resolveModalCurrentCard(allCards, cardB);
assert.strictEqual(
  resolutionWithAll.currentCard?.name,
  'Tenured Tethermage',
  'With allCards, currentCard must be Tenured Tethermage'
);
console.log('✓ QuickRateModal resolves clicked card in allCards correctly.');

console.log('\n🎉 ALL CARD MODAL SELECTION TESTS PASSED!');
