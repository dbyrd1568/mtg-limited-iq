import assert from 'assert';
import { Card, UserCardEvaluation, GradeTier } from '../types/mtg';
import { GRADE_SCORES } from '../services/seventeenLands';

console.log('=== Testing EvaluationHub Card Sort Logic ===\n');

// Mock cards
const cards: Card[] = [
  { id: '1', name: 'Alpha Strike', collector_number: '1', set: 'TST', rarity: 'common' } as Card,
  { id: '2', name: 'Beta Beast', collector_number: '2', set: 'TST', rarity: 'uncommon' } as Card,
  { id: '3', name: 'Gamma Giant', collector_number: '3', set: 'TST', rarity: 'rare' } as Card,
  { id: '4', name: 'Delta Drake', collector_number: '4', set: 'TST', rarity: 'common' } as Card,
];

// Mock user evaluations:
// Alpha Strike: B (userScore: 3.0)
// Beta Beast: A+ (userScore: 4.3)
// Gamma Giant: D (userScore: 1.0)
// Delta Drake: Ungraded
const userEvaluations: Record<string, UserCardEvaluation> = {
  'tst_alpha strike': {
    cardId: '1',
    cardName: 'Alpha Strike',
    setCode: 'TST',
    userGrade: 'B' as GradeTier,
    userScore: 3.0,
    pickPriority: 'Mid Pick',
    updatedAt: new Date().toISOString(),
  },
  'tst_beta beast': {
    cardId: '2',
    cardName: 'Beta Beast',
    setCode: 'TST',
    userGrade: 'A+' as GradeTier,
    userScore: 4.3,
    pickPriority: '1st Pick Bomb',
    updatedAt: new Date().toISOString(),
  },
  'tst_gamma giant': {
    cardId: '3',
    cardName: 'Gamma Giant',
    setCode: 'TST',
    userGrade: 'D' as GradeTier,
    userScore: 1.0,
    pickPriority: 'Late Filler',
    updatedAt: new Date().toISOString(),
  },
};

function sortCards(list: Card[], cardListSortBy: 'grade-desc' | 'grade-asc') {
  return [...list].sort((a, b) => {
    if (cardListSortBy === 'grade-desc' || cardListSortBy === 'grade-asc') {
      const evalKeyA = `${a.set.toLowerCase()}_${a.name.toLowerCase()}`;
      const evalKeyB = `${b.set.toLowerCase()}_${b.name.toLowerCase()}`;
      const evalA = userEvaluations[evalKeyA];
      const evalB = userEvaluations[evalKeyB];

      const scoreA = evalA && typeof evalA.userScore === 'number'
        ? evalA.userScore
        : (evalA?.userGrade ? (GRADE_SCORES[evalA.userGrade as GradeTier] ?? -1) : -1);
      const scoreB = evalB && typeof evalB.userScore === 'number'
        ? evalB.userScore
        : (evalB?.userGrade ? (GRADE_SCORES[evalB.userGrade as GradeTier] ?? -1) : -1);

      const isRatedA = scoreA >= 0;
      const isRatedB = scoreB >= 0;

      // Graded cards always sort before ungraded cards in both directions
      if (isRatedA && !isRatedB) return -1;
      if (!isRatedA && isRatedB) return 1;
      if (!isRatedA && !isRatedB) {
        return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
      }

      const diff = cardListSortBy === 'grade-desc' ? scoreB - scoreA : scoreA - scoreB;
      if (diff !== 0) return diff;
      return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
    }
    return 0;
  });
}

// Test 1: Highest Grade (A+ -> F)
const sortedDesc = sortCards(cards, 'grade-desc');
console.log('Highest Grade (A+ -> F) result:', sortedDesc.map((c) => c.name));
assert.strictEqual(sortedDesc[0].name, 'Beta Beast', 'Beta Beast (A+) should be first');
assert.strictEqual(sortedDesc[1].name, 'Alpha Strike', 'Alpha Strike (B) should be second');
assert.strictEqual(sortedDesc[2].name, 'Gamma Giant', 'Gamma Giant (D) should be third');
assert.strictEqual(sortedDesc[3].name, 'Delta Drake', 'Delta Drake (Ungraded) should be last');
console.log('✓ Highest Grade (A+ -> F) verified');

// Test 2: Lowest Grade (F -> A+)
const sortedAsc = sortCards(cards, 'grade-asc');
console.log('Lowest Grade (F -> A+) result:', sortedAsc.map((c) => c.name));
assert.strictEqual(sortedAsc[0].name, 'Gamma Giant', 'Gamma Giant (D) should be first in lowest grade');
assert.strictEqual(sortedAsc[1].name, 'Alpha Strike', 'Alpha Strike (B) should be second');
assert.strictEqual(sortedAsc[2].name, 'Beta Beast', 'Beta Beast (A+) should be third');
assert.strictEqual(sortedAsc[3].name, 'Delta Drake', 'Delta Drake (Ungraded) should be at the bottom after graded cards');
console.log('✓ Lowest Grade (F -> A+) verified');

// Test 3: Grade Filter (Single Selection)
function filterCardsByGrade(list: Card[], selectedGrades: string[]) {
  const isAllGrades = selectedGrades.length === 0 || selectedGrades.includes('ALL');
  return list.filter((c) => {
    const evalKey = `${c.set.toLowerCase()}_${c.name.toLowerCase()}`;
    if (!isAllGrades) {
      const userEval = userEvaluations[evalKey];
      if (!userEval) return false;
      if (!selectedGrades.includes(userEval.userGrade)) {
        return false;
      }
    }
    return true;
  });
}

const filteredA = filterCardsByGrade(cards, ['A+']);
console.log('Filtered by [A+]:', filteredA.map((c) => c.name));
assert.strictEqual(filteredA.length, 1);
assert.strictEqual(filteredA[0].name, 'Beta Beast');
console.log('✓ Grade Filter single selection verified');

// Test 4: Grade Filter (Multi Selection: A+ and B)
const filteredMulti = filterCardsByGrade(cards, ['A+', 'B']);
console.log('Filtered by [A+, B]:', filteredMulti.map((c) => c.name));
assert.strictEqual(filteredMulti.length, 2);
assert.deepStrictEqual(filteredMulti.map((c) => c.name), ['Alpha Strike', 'Beta Beast']);
console.log('✓ Grade Filter multi-selection verified');

// Test 5: Grade Filter (ALL)
const filteredAll = filterCardsByGrade(cards, ['ALL']);
assert.strictEqual(filteredAll.length, 4);
console.log('✓ Grade Filter ALL verified');

console.log('\nAll card sort and filter tests passed successfully!');

