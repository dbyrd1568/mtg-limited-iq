import assert from 'node:assert';
import { Card, UserCardEvaluation } from '../types/mtg';
import {
  calculateColorRankings,
  calculateArchetypeRankings,
  aggregateScoreToGradeTier,
  aggregateScoreToArchetypeTier,
} from '../services/archetypeEvaluator';

console.log('=== STARTING COLOR & ARCHETYPE TIERING VERIFICATION TESTS ===\n');

// -------------------------------------------------------------
// Test 1: Verify Calibrated Aggregate Thresholds
// -------------------------------------------------------------
console.log('Test 1: Verifying aggregateScoreToGradeTier thresholds...');
assert.strictEqual(aggregateScoreToGradeTier(3.49), 'A-', '3.49 GPA must be A- (Top-tier color)');
assert.strictEqual(aggregateScoreToGradeTier(3.41), 'B+', '3.41 GPA must be B+ (High contender)');
assert.strictEqual(aggregateScoreToGradeTier(3.35), 'B',  '3.35 GPA must be B (Solid mid-tier)');
assert.strictEqual(aggregateScoreToGradeTier(3.28), 'B-', '3.28 GPA must be B- (Below average)');
assert.strictEqual(aggregateScoreToGradeTier(3.22), 'C+', '3.22 GPA must be C+ (Weakest color in set)');

// Extreme boundary checks
assert.strictEqual(aggregateScoreToGradeTier(3.68), 'A+', '>= 3.65 must be A+');
assert.strictEqual(aggregateScoreToGradeTier(3.55), 'A',  '>= 3.52 must be A');
assert.strictEqual(aggregateScoreToGradeTier(3.08), 'C',  '3.08 must be C');
assert.strictEqual(aggregateScoreToGradeTier(2.95), 'C-', '2.95 must be C-');
assert.strictEqual(aggregateScoreToGradeTier(2.70), 'D',  '2.70 must be D');
console.log('   ✓ aggregateScoreToGradeTier correctly maps aggregate GPAs to distinct letter tiers.\n');

// -------------------------------------------------------------
// Test 2: Verify Calibrated Archetype Tiers (S, A, B, C, D)
// -------------------------------------------------------------
console.log('Test 2: Verifying aggregateScoreToArchetypeTier thresholds...');
assert.strictEqual(aggregateScoreToArchetypeTier(3.48), 'S', '3.48 must be Tier S');
assert.strictEqual(aggregateScoreToArchetypeTier(3.38), 'A', '3.38 must be Tier A');
assert.strictEqual(aggregateScoreToArchetypeTier(3.28), 'B', '3.28 must be Tier B');
assert.strictEqual(aggregateScoreToArchetypeTier(3.18), 'C', '3.18 must be Tier C');
assert.strictEqual(aggregateScoreToArchetypeTier(3.05), 'D', '3.05 must be Tier D');
console.log('   ✓ aggregateScoreToArchetypeTier correctly maps power scores across tiers.\n');

// -------------------------------------------------------------
// Test 3: Realistic Set Simulation with 5 Colors
// -------------------------------------------------------------
console.log('Test 3: Simulating 5-Color Hierarchy in calculateColorRankings...');

// Build mock cards for 5 colors (6 cards per color to trigger aggregate tiering >= 5)
const colors = ['G', 'R', 'B', 'U', 'W'] as const;
const mockCards: Card[] = [];
const mockEvaluations: Record<string, UserCardEvaluation> = {};

// Target scores: G=3.49, R=3.41, B=3.35, U=3.28, W=3.22
const targetScores: Record<string, number> = {
  G: 3.49,
  R: 3.41,
  B: 3.35,
  U: 3.28,
  W: 3.22,
};

colors.forEach((col) => {
  for (let i = 1; i <= 6; i++) {
    const cardId = `${col.toLowerCase()}${i}`;
    const cardName = `${col} Card ${i}`;
    mockCards.push({
      id: cardId,
      name: cardName,
      set: 'SOS',
      set_name: 'Secrets of Strixhaven',
      collector_number: `${col}${i}`,
      mana_cost: `{${col}}`,
      cmc: 2,
      type_line: 'Creature',
      colors: [col],
      color_identity: [col],
      rarity: i <= 3 ? 'common' : i <= 5 ? 'uncommon' : 'rare',
      keywords: [],
    });

    const key = `sos_${cardName.toLowerCase()}`;
    mockEvaluations[key] = {
      cardId,
      cardName,
      setCode: 'SOS',
      userGrade: 'B',
      userScore: targetScores[col],
      pickPriority: 'Mid Pick',
      updatedAt: new Date().toISOString(),
    };
  }
});

const rankings = calculateColorRankings(mockCards, mockEvaluations, null, 'SOS');
const green = rankings.find((c) => c.color === 'G')!;
const red = rankings.find((c) => c.color === 'R')!;
const black = rankings.find((c) => c.color === 'B')!;
const blue = rankings.find((c) => c.color === 'U')!;
const white = rankings.find((c) => c.color === 'W')!;

console.log('   Calculated Ranks & Grades:');
console.log(`   Green: ${green.letterGrade} (${green.averageScore})`);
console.log(`   Red:   ${red.letterGrade} (${red.averageScore})`);
console.log(`   Black: ${black.letterGrade} (${black.averageScore})`);
console.log(`   Blue:  ${blue.letterGrade} (${blue.averageScore})`);
console.log(`   White: ${white.letterGrade} (${white.averageScore})`);

assert.strictEqual(green.letterGrade, 'A-', 'Green must be A-');
assert.strictEqual(red.letterGrade, 'B+',   'Red must be B+');
assert.strictEqual(black.letterGrade, 'B',  'Black must be B');
assert.strictEqual(blue.letterGrade, 'B-',  'Blue must be B-');
assert.strictEqual(white.letterGrade, 'C+', 'White must be C+');

// Verify all 5 colors have distinct letter grades
const uniqueGrades = new Set([green.letterGrade, red.letterGrade, black.letterGrade, blue.letterGrade, white.letterGrade]);
assert.strictEqual(uniqueGrades.size, 5, 'All 5 colors must receive distinct tiered grades, eliminating grade compression');

console.log('   ✓ All 5 colors successfully received distinct, non-overlapping tiered grades!\n');

console.log('🎉 ALL COLOR & ARCHETYPE TIERING TESTS PASSED SUCCESSFULLY!\n');
