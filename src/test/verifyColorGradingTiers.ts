import assert from 'node:assert';
import { Card, UserCardEvaluation } from '../types/mtg';
import {
  calculateColorRankings,
  calculateArchetypeRankings,
  aggregateScoreToGradeTier,
  gradeTierToGradeBand,
} from '../services/archetypeEvaluator';

console.log('=== STARTING COLOR & ARCHETYPE TIERING VERIFICATION TESTS ===\n');

// -------------------------------------------------------------
// Test 1: Verify Calibrated Aggregate Thresholds (Balanced 0.15 Steps)
// -------------------------------------------------------------
console.log('Test 1: Verifying aggregateScoreToGradeTier thresholds...');
assert.strictEqual(aggregateScoreToGradeTier(3.75), 'A+', '>= 3.75 must be A+');
assert.strictEqual(aggregateScoreToGradeTier(3.60), 'A',  '>= 3.60 must be A');
assert.strictEqual(aggregateScoreToGradeTier(3.49), 'A-', '3.49 GPA must be A- (Top-tier color/archetype)');
assert.strictEqual(aggregateScoreToGradeTier(3.41), 'B+', '3.41 GPA must be B+ (Strong contender)');
assert.strictEqual(aggregateScoreToGradeTier(3.35), 'B+', '3.35 GPA must be B+ (Naturally ties with 3.41)');
assert.strictEqual(aggregateScoreToGradeTier(3.28), 'B',  '3.28 GPA must be B (Solid middle-tier)');
assert.strictEqual(aggregateScoreToGradeTier(3.22), 'B',  '3.22 GPA must be B (Naturally ties with 3.28)');
assert.strictEqual(aggregateScoreToGradeTier(3.08), 'B-', '3.08 GPA must be B- (Viable below average)');
assert.strictEqual(aggregateScoreToGradeTier(2.90), 'C+', '2.90 GPA must be C+ (Underpowered pool)');
assert.strictEqual(aggregateScoreToGradeTier(2.75), 'C',  '2.75 GPA must be C (Struggling pool)');
assert.strictEqual(aggregateScoreToGradeTier(2.55), 'C-', '2.55 GPA must be C- (Unfavorable / trap)');
assert.strictEqual(aggregateScoreToGradeTier(2.10), 'D',  '2.10 GPA must be D (Failing pool)');
assert.strictEqual(aggregateScoreToGradeTier(1.80), 'F',  '< 2.00 GPA must be F');
console.log('   ✓ aggregateScoreToGradeTier correctly maps aggregate GPAs to natural, balanced grade tiers.\n');

// -------------------------------------------------------------
// Test 2: Verify Calibrated Grade Bands (A, B, C, D, F)
// -------------------------------------------------------------
console.log('Test 2: Verifying gradeTierToGradeBand mappings...');
assert.strictEqual(gradeTierToGradeBand('A+'), 'A', 'A+ must be in Grade Band A');
assert.strictEqual(gradeTierToGradeBand('A'),  'A', 'A must be in Grade Band A');
assert.strictEqual(gradeTierToGradeBand('A-'), 'A', 'A- must be in Grade Band A');
assert.strictEqual(gradeTierToGradeBand('B+'), 'B', 'B+ must be in Grade Band B');
assert.strictEqual(gradeTierToGradeBand('B'),  'B', 'B must be in Grade Band B');
assert.strictEqual(gradeTierToGradeBand('B-'), 'B', 'B- must be in Grade Band B');
assert.strictEqual(gradeTierToGradeBand('C+'), 'C', 'C+ must be in Grade Band C');
assert.strictEqual(gradeTierToGradeBand('C'),  'C', 'C must be in Grade Band C');
assert.strictEqual(gradeTierToGradeBand('C-'), 'C', 'C- must be in Grade Band C');
assert.strictEqual(gradeTierToGradeBand('D'),  'D', 'D must be in Grade Band D');
assert.strictEqual(gradeTierToGradeBand('F'),  'F', 'F must be in Grade Band F');
console.log('   ✓ gradeTierToGradeBand correctly maps letter grades to standard grade bands.\n');

// -------------------------------------------------------------
// Test 3: Realistic Set Simulation with 5 Colors (Natural Ties Allowed)
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

assert.strictEqual(green.letterGrade, 'A-', 'Green must be A- (Top standalone)');
assert.strictEqual(red.letterGrade, 'B+',   'Red must be B+ (High contender)');
assert.strictEqual(black.letterGrade, 'B+',  'Black must be B+ (Naturally ties with Red at B+)');
assert.strictEqual(blue.letterGrade, 'B',   'Blue must be B (Solid middle)');
assert.strictEqual(white.letterGrade, 'B',  'White must be B (Naturally ties with Blue at B)');

// Verify that ties are allowed (neither forced unique nor all compressed to B-)
assert.strictEqual(red.letterGrade, black.letterGrade, 'Red and Black should tie at B+');
assert.strictEqual(blue.letterGrade, white.letterGrade, 'Blue and White should tie at B');
assert.notStrictEqual(green.letterGrade, red.letterGrade, 'Green must be distinguished from Red');
assert.notStrictEqual(red.letterGrade, blue.letterGrade, 'Red must be distinguished from Blue');

console.log('   ✓ Colors naturally tie when within same balanced grade band, without forced separation or universal collapse!\n');

// -------------------------------------------------------------
// Test 4: Archetype Auto-Grading & Tie Handling
// -------------------------------------------------------------
console.log('Test 4: Verifying Archetype Auto-Grading and Natural Ties...');

const archRankings = calculateArchetypeRankings(mockCards, mockEvaluations, rankings, null, 'SOS');
assert(archRankings.length === 10, 'Must calculate 10 color pairs');

// RG power score: signposts unrated, so (R=3.41 * 0.35 + G=3.49 * 0.35 + avg * 0.30) = ~3.45 -> A-
const rg = archRankings.find((a) => a.code === 'RG')!;
assert(rg.powerScore >= 3.44 && rg.powerScore <= 3.46, `RG power score should be ~3.45, got ${rg.powerScore}`);
assert.strictEqual(rg.autoGrade, 'A-', 'RG archetype should be auto-graded A-');

// Check that archetypes can share grades
const gradeCounts: Record<string, number> = {};
archRankings.forEach((a) => {
  gradeCounts[a.autoGrade] = (gradeCounts[a.autoGrade] || 0) + 1;
});
console.log('   Archetype Grade Distribution:', gradeCounts);
const hasTiedArchetypes = Object.values(gradeCounts).some((count) => count > 1);
assert(hasTiedArchetypes, 'Archetypes must be able to naturally tie in autoGrade');

console.log('   ✓ Archetypes auto-grade cleanly and naturally tie where appropriate.\n');

console.log('🎉 ALL COLOR & ARCHETYPE TIERING TESTS PASSED SUCCESSFULLY!\n');
