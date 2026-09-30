import assert from 'assert';
import { Card, UserCardEvaluation, GradeTier } from '../types/mtg';
import { GRADE_SCORES, get17LandsCardRating } from '../services/seventeenLands';

console.log('=== Testing Top Cards by Rarity Logic ===\n');

// Mock cards with distinct rarities
const sampleCards: Card[] = [
  // Mythics
  { id: 'm1', name: 'Mythic Behemoth', set: 'TST', rarity: 'mythic', mana_cost: '{4}{G}{G}', type_line: 'Creature — Beast' } as Card,
  { id: 'm2', name: 'Mythic Dragon', set: 'TST', rarity: 'mythic', mana_cost: '{5}{R}{R}', type_line: 'Creature — Dragon' } as Card,
  // Rares
  { id: 'r1', name: 'Rare Wrath', set: 'TST', rarity: 'rare', mana_cost: '{2}{W}{W}', type_line: 'Sorcery' } as Card,
  { id: 'r2', name: 'Rare Tutor', set: 'TST', rarity: 'rare', mana_cost: '{1}{B}', type_line: 'Sorcery' } as Card,
  // Uncommons
  { id: 'u1', name: 'Signpost Mage', set: 'TST', rarity: 'uncommon', mana_cost: '{1}{U}{R}', type_line: 'Creature — Human Wizard' } as Card,
  { id: 'u2', name: 'Premium Removal', set: 'TST', rarity: 'uncommon', mana_cost: '{1}{B}', type_line: 'Instant' } as Card,
  // Commons
  { id: 'c1', name: 'Shock Trooper', set: 'TST', rarity: 'common', mana_cost: '{R}', type_line: 'Instant' } as Card,
  { id: 'c2', name: 'Bears', set: 'TST', rarity: 'common', mana_cost: '{1}{G}', type_line: 'Creature — Bear' } as Card,
  { id: 'c3', name: 'Divination Variant', set: 'TST', rarity: 'common', mana_cost: '{2}{U}', type_line: 'Sorcery' } as Card,
];

// Mock user evaluations
const userEvaluations: Record<string, UserCardEvaluation> = {
  // Mythic: m1 is A (4.0), m2 is A+ (4.33)
  'tst_mythic behemoth': { cardId: 'm1', cardName: 'Mythic Behemoth', setCode: 'TST', userGrade: 'A' as GradeTier, userScore: 4.0, pickPriority: '1st Pick Bomb', updatedAt: '' },
  'tst_mythic dragon': { cardId: 'm2', cardName: 'Mythic Dragon', setCode: 'TST', userGrade: 'A+' as GradeTier, userScore: 4.33, pickPriority: '1st Pick Bomb', notes: 'Best dragon in the set', updatedAt: '' },
  // Rare: r1 is A (4.0), r2 is B+ (3.67)
  'tst_rare wrath': { cardId: 'r1', cardName: 'Rare Wrath', setCode: 'TST', userGrade: 'A' as GradeTier, userScore: 4.0, pickPriority: '1st Pick Bomb', updatedAt: '' },
  'tst_rare tutor': { cardId: 'r2', cardName: 'Rare Tutor', setCode: 'TST', userGrade: 'B+' as GradeTier, userScore: 3.67, pickPriority: 'Early Pick', updatedAt: '' },
  // Uncommon: u1 and u2 tied at B+ (3.67)
  'tst_signpost mage': { cardId: 'u1', cardName: 'Signpost Mage', setCode: 'TST', userGrade: 'B+' as GradeTier, userScore: 3.67, pickPriority: 'Early Pick', updatedAt: '' },
  'tst_premium removal': { cardId: 'u2', cardName: 'Premium Removal', setCode: 'TST', userGrade: 'B+' as GradeTier, userScore: 3.67, pickPriority: 'Early Pick', updatedAt: '' },
  // Commons: c1 is B (3.0), c2 is C+ (2.67), c3 is ungraded
  'tst_shock trooper': { cardId: 'c1', cardName: 'Shock Trooper', setCode: 'TST', userGrade: 'B' as GradeTier, userScore: 3.0, pickPriority: 'Mid Pick', notes: 'Top common burn spell', updatedAt: '' },
  'tst_bears': { cardId: 'c2', cardName: 'Bears', setCode: 'TST', userGrade: 'C+' as GradeTier, userScore: 2.67, pickPriority: 'Mid Pick', updatedAt: '' },
};

function computeTopCardByRarity(cards: Card[], evals: Record<string, UserCardEvaluation>) {
  const rarities = ['mythic', 'rare', 'uncommon', 'common'] as const;
  const result: Record<string, any> = {};

  rarities.forEach((rarity) => {
    const rarityCards = cards.filter((c) => (c.rarity || '').toLowerCase() === rarity);
    const seenNames = new Set<string>();
    const evaluated: Array<{ card: Card; eval: UserCardEvaluation }> = [];

    rarityCards.forEach((c) => {
      if (seenNames.has(c.name)) return;
      seenNames.add(c.name);
      const evalKey = `${c.set.toLowerCase()}_${c.name.toLowerCase()}`;
      const userEval = evals[evalKey];
      if (userEval && userEval.userGrade && userEval.userGrade !== 'N/A' && typeof userEval.userScore === 'number' && userEval.userScore > 0) {
        evaluated.push({ card: c, eval: userEval });
      }
    });

    evaluated.sort((a, b) => {
      if (b.eval.userScore !== a.eval.userScore) {
        return b.eval.userScore - a.eval.userScore;
      }
      return a.card.name.localeCompare(b.card.name);
    });

    const topScore = evaluated.length > 0 ? evaluated[0].eval.userScore : 0;
    const tiedTopCards = evaluated.filter((item) => Math.abs(item.eval.userScore - topScore) < 0.001);

    result[rarity] = {
      total: rarityCards.length,
      gradedCount: evaluated.length,
      topCard: evaluated[0] || null,
      tiedTopCards,
    };
  });

  return result;
}

const res = computeTopCardByRarity(sampleCards, userEvaluations);

// Test 1: Mythic
assert.strictEqual(res.mythic.topCard.card.name, 'Mythic Dragon', 'Top Mythic should be Mythic Dragon (A+)');
assert.strictEqual(res.mythic.tiedTopCards.length, 1, 'Only 1 top mythic');
console.log('✓ Top Mythic verified:', res.mythic.topCard.card.name, `(${res.mythic.topCard.eval.userGrade})`);

// Test 2: Rare
assert.strictEqual(res.rare.topCard.card.name, 'Rare Wrath', 'Top Rare should be Rare Wrath (A)');
assert.strictEqual(res.rare.tiedTopCards.length, 1, 'Only 1 top rare');
console.log('✓ Top Rare verified:', res.rare.topCard.card.name, `(${res.rare.topCard.eval.userGrade})`);

// Test 3: Uncommon with Ties
assert.strictEqual(res.uncommon.tiedTopCards.length, 2, 'Uncommons should have 2 tied top cards at B+');
const tiedNames = res.uncommon.tiedTopCards.map((t: any) => t.card.name);
assert.ok(tiedNames.includes('Signpost Mage') && tiedNames.includes('Premium Removal'), 'Both tied cards identified');
console.log('✓ Top Uncommon with ties verified:', tiedNames.join(' & '));

// Test 4: Common
assert.strictEqual(res.common.topCard.card.name, 'Shock Trooper', 'Top Common should be Shock Trooper (B)');
assert.strictEqual(res.common.gradedCount, 2, '2 of 3 commons graded');
console.log('✓ Top Common verified:', res.common.topCard.card.name, `(${res.common.topCard.eval.userGrade})`);

// Test 5: Empty Rarity Handling
const emptyRes = computeTopCardByRarity(sampleCards, {});
assert.strictEqual(emptyRes.mythic.topCard, null);
assert.strictEqual(emptyRes.rare.topCard, null);
assert.strictEqual(emptyRes.uncommon.topCard, null);
assert.strictEqual(emptyRes.common.topCard, null);
console.log('✓ Empty evaluation state handling verified cleanly');

console.log('\n🎉 ALL TOP CARDS BY RARITY TESTS PASSED!');
