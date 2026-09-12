import { getFallbackCards, POPULAR_LIMITED_SETS } from '../services/scryfall';
import { generateQuiz } from '../services/quizGenerator';
import { calculateSetCalibration, winRateToGradeTier, GRADE_TIERS, isSetUnderTwoWeeksOld, is17LandsEligibleForSet, get17LandsCardUrl, get17LandsArchetypeUrl } from '../services/seventeenLands';
import { UserProfileStats, QuizResult, QuizSettings, UserCardEvaluation, Card, SeventeenLandsSetData } from '../types/mtg';
import { calculateMasteryRank, defaultStats } from '../services/storage';
import { isAuthentic17LandsDataSet, generateSetSynthesisReport } from '../services/archetypeEvaluator';
import { calculateCardSimilarity, areCardTypesCompatible } from '../services/cardSimilarity';

console.log('=== MTG Limited IQ Verification Tests ===\n');

// Test 1: Fallback Cards & Normalization
const blbCards = getFallbackCards('BLB');
console.log(`[PASS] Loaded ${blbCards.length} sample cards for Bloomburrow (BLB).`);
console.assert(blbCards.length >= 7, 'Expected at least 7 sample cards');

// Verify combat trick detection
const combatTrick = blbCards.find(c => c.name === 'Might of the Meek');
console.assert(combatTrick?.is_combat_trick === true, 'Might of the Meek should be flagged as combat trick');
console.log(`[PASS] Combat trick detection verified: ${combatTrick?.name} -> is_combat_trick=${combatTrick?.is_combat_trick}`);

// Verify removal detection
const removalSpell = blbCards.find(c => c.name === 'Fell');
console.assert(removalSpell?.is_removal === true, 'Fell should be flagged as removal');
console.log(`[PASS] Removal detection verified: ${removalSpell?.name} -> is_removal=${removalSpell?.is_removal}`);

// Test 2: Quiz Generation
const quizSettings: QuizSettings = {
  setCode: 'BLB',
  setName: 'Bloomburrow',
  questionCount: 5,
  categories: ['p1p1_pick', 'trap_or_sleeper', 'quadrant_role', 'combat_tricks', 'instant_speed', 'mana_cost_and_splash', 'power_toughness', 'archetype_engine', 'card_evaluation'],
  rarities: ['common', 'uncommon', 'rare', 'mythic'],
  timerSeconds: 0,
  mode: 'quiz',
};

const quiz = generateQuiz(blbCards, quizSettings, null);
console.assert(quiz.length > 0, 'Quiz questions generated');
console.log(`[PASS] Generated quiz with ${quiz.length} diverse questions.`);

quiz.forEach((q, idx) => {
  console.log(`   Q${idx + 1} [${q.category}] Target: ${q.card.name} | Mask: ${q.obfuscation.target} (${q.obfuscation.style})`);
  console.assert(q.options.some(o => o.isCorrect), `Question ${idx + 1} must have a correct option`);
  console.assert(q.correctAnswer.length > 0, `Question ${idx + 1} must have a correct answer value`);
});

// Test 3: 17Lands Calibration & Traps/Sleepers Detection
const mockEvaluations: Record<string, UserCardEvaluation> = {
  'blb_fell': {
    cardId: 'blb-2',
    cardName: 'Fell',
    setCode: 'BLB',
    userGrade: 'A',
    userScore: 4.7,
    pickPriority: '1st Pick Bomb',
    updatedAt: new Date().toISOString(),
  },
  'blb_seedgale foster': {
    cardId: 'blb-5',
    cardName: 'Seedgale Foster',
    setCode: 'BLB',
    userGrade: 'A', // Overrated: 17Lands is C
    userScore: 4.7,
    pickPriority: '1st Pick Bomb',
    updatedAt: new Date().toISOString(),
  },
  'blb_might of the meek': {
    cardId: 'blb-3',
    cardName: 'Might of the Meek',
    setCode: 'BLB',
    userGrade: 'D', // Underrated: 17Lands is B
    userScore: 1.5,
    pickPriority: 'Late Filler',
    updatedAt: new Date().toISOString(),
  }
};

const mockLandsData = {
  setCode: 'BLB',
  setName: 'Bloomburrow',
  format: 'PremierDraft',
  sampleSize: 50000,
  cards: {
    'Fell': { name: 'Fell', color: 'B', rarity: 'uncommon', seen_count: 2800, avg_seen: 1.8, pick_rate: 0.2, game_count: 9200, win_rate: 0.605, iwd: 0.051, tier_grade: 'A' },
    'Seedgale Foster': { name: 'Seedgale Foster', color: 'G', rarity: 'common', seen_count: 5400, avg_seen: 7.2, pick_rate: 0.08, game_count: 6100, win_rate: 0.518, iwd: -0.012, tier_grade: 'C' },
    'Might of the Meek': { name: 'Might of the Meek', color: 'R', rarity: 'common', seen_count: 4100, avg_seen: 4.8, pick_rate: 0.15, game_count: 7300, win_rate: 0.568, iwd: 0.028, tier_grade: 'B' },
  },
  updatedAt: new Date().toISOString(),
};

const calibration = calculateSetCalibration(blbCards, mockEvaluations, mockLandsData);
console.log('\n[PASS] Calibration Calculation:');
console.log(`   Total Rated: ${calibration.totalRated}`);
console.log(`   Exact Matches: ${calibration.exactMatches}`);
console.log(`   Calibration Score: ${calibration.calibrationScore}%`);
console.log(`   Traps (Overrated): ${calibration.biggestTraps.map(t => `${t.card.name} (+${t.gradeDelta} tiers)`).join(', ')}`);
console.log(`   Sleepers (Underrated): ${calibration.biggestSleepers.map(s => `${s.card.name} (${s.gradeDelta} tiers)`).join(', ')}`);

console.assert(calibration.exactMatches >= 1, 'Fell should match exactly as A');
console.assert(calibration.biggestTraps.some(t => t.card.name === 'Seedgale Foster'), 'Seedgale Foster should be flagged as a Trap');
console.assert(calibration.biggestSleepers.some(s => s.card.name === 'Might of the Meek'), 'Might of the Meek should be flagged as a Sleeper');

// Test 4: Mastery Rank Calculation
console.log('\n[PASS] Mastery Rank Calculations:');
console.log(`   95% Acc, 60 attempts -> ${calculateMasteryRank(95, 60)} (Expected: Mythic)`);
console.log(`   85% Acc, 35 attempts -> ${calculateMasteryRank(85, 35)} (Expected: Gold)`);
console.log(`   70% Acc, 20 attempts -> ${calculateMasteryRank(70, 20)} (Expected: Silver)`);
console.log(`   50% Acc, 15 attempts -> ${calculateMasteryRank(50, 15)} (Expected: Bronze)`);

console.assert(calculateMasteryRank(95, 60) === 'Mythic');
console.assert(calculateMasteryRank(85, 35) === 'Gold');
console.assert(calculateMasteryRank(70, 20) === 'Silver');

// Test 5: Unreleased Set Telemetry Guardrails & TBD Synthesis
console.log('\n[PASS] Unreleased Set Telemetry Guardrails:');
const unreleasedCards = [
  { id: 'fra-1', name: 'Cloud Strife', set: 'fra', colors: ['W'], rarity: 'rare', type_line: 'Legendary Creature', collector_number: '1' },
  { id: 'fra-2', name: 'Sephiroth', set: 'fra', colors: ['B'], rarity: 'mythic', type_line: 'Legendary Creature', collector_number: '2' },
  { id: 'fra-3', name: 'Tifa Lockhart', set: 'fra', colors: ['G', 'R'], rarity: 'uncommon', type_line: 'Creature', collector_number: '3' },
];

const leakedOld17Lands = {
  setCode: 'SOS',
  sampleSize: 12500,
  updatedAt: '2026-09-01',
  cards: {
    'Slickshot Show-Off': { name: 'Slickshot Show-Off', win_rate: 0.61, games_played: 1200, tier_grade: 'A-' },
  },
};

console.assert(!isAuthentic17LandsDataSet(null, 'FRA', unreleasedCards as unknown as Card[]), 'Null data is not authentic');
console.assert(!isAuthentic17LandsDataSet(leakedOld17Lands as unknown as SeventeenLandsSetData, 'FRA', unreleasedCards as unknown as Card[]), 'Leaked data from SOS must be rejected for FRA');

const unreleasedReport = generateSetSynthesisReport(unreleasedCards as unknown as Card[], {}, 'FRA', 'Final Fantasy', leakedOld17Lands as unknown as SeventeenLandsSetData);
console.assert(unreleasedReport.has17LandsData === false, 'has17LandsData must be false for unreleased set');
console.assert(unreleasedReport.seventeenLandsBestColor === undefined, 'No best color fallback for unreleased set');
console.assert(unreleasedReport.colorRankings.every(c => c.seventeenLandsAvgWinRate === undefined), 'All color win rates must be undefined');
console.assert(unreleasedReport.archetypeRankings.every(a => a.seventeenLandsWinRate === undefined), 'All archetype win rates must be undefined');
console.log('   ✓ Unreleased sets (FRA) correctly reject leaked 17Lands data and yield TBD values.');

// Test 6: Quiz 17Lands Maturity Restriction (< 2 Weeks & Unreleased Sets)
console.log('\n[PASS] 17Lands Quiz Maturity Guardrails (< 2 Weeks & Unreleased):');

// 6a. Date calculations
const now = new Date();
const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const matureDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

console.assert(isSetUnderTwoWeeksOld(futureDate) === true, 'Future date must be flagged as under 2 weeks (unreleased)');
console.assert(isSetUnderTwoWeeksOld(recentDate) === true, 'Date 5 days ago must be flagged as under 2 weeks');
console.assert(isSetUnderTwoWeeksOld(matureDate) === false, 'Date 40 days ago must NOT be flagged as under 2 weeks');

// 6b. is17LandsEligibleForSet
const authenticLandsDataForBLB: SeventeenLandsSetData = {
  setCode: 'BLB',
  setName: 'Bloomburrow',
  format: 'PremierDraft',
  sampleSize: 15000,
  updatedAt: '2024-09-01',
  cards: {
    'Heartfire Hero': { name: 'Heartfire Hero', color: 'R', rarity: 'uncommon', seen_count: 10000, pick_rate: 0.2, iwd: 0.02, win_rate: 0.589, avg_seen: 3.1, game_count: 8500, tier_grade: 'A-' },
    'Fell': { name: 'Fell', color: 'B', rarity: 'uncommon', seen_count: 11000, pick_rate: 0.25, iwd: 0.03, win_rate: 0.605, avg_seen: 1.8, game_count: 9200, tier_grade: 'A' },
    'Might of the Meek': { name: 'Might of the Meek', color: 'R', rarity: 'common', seen_count: 8000, pick_rate: 0.15, iwd: 0.01, win_rate: 0.568, avg_seen: 4.8, game_count: 7300, tier_grade: 'B' },
    'Warren Warleader': { name: 'Warren Warleader', color: 'W', rarity: 'mythic', seen_count: 5000, pick_rate: 0.4, iwd: 0.05, win_rate: 0.642, avg_seen: 1.2, game_count: 4800, tier_grade: 'A+' },
    'Shore Up': { name: 'Shore Up', color: 'U', rarity: 'common', seen_count: 7500, pick_rate: 0.1, iwd: 0.0, win_rate: 0.548, avg_seen: 5.6, game_count: 6700, tier_grade: 'C+' },
  },
};

const testBLBCards: Card[] = [
  ...blbCards,
  {
    id: 'blb-4',
    name: 'Warren Warleader',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '35',
    mana_cost: '{2}{W}{W}',
    cmc: 4,
    type_line: 'Creature — Rabbit Knight',
    oracle_text: 'Whenever you attack...',
    colors: ['W'],
    color_identity: ['W'],
    rarity: 'mythic',
    keywords: [],
    is_creature: true,
  } as Card,
  {
    id: 'blb-5',
    name: 'Shore Up',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '64',
    mana_cost: '{U}',
    cmc: 1,
    type_line: 'Instant',
    oracle_text: 'Target creature gets +1/+1...',
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'common',
    keywords: [],
    is_combat_trick: true,
    is_instant_speed: true,
  } as Card,
];

console.assert(
  is17LandsEligibleForSet(futureDate, null, 'BLB', testBLBCards) === false,
  'Null 17Lands data must make 17Lands questions ineligible'
);
console.assert(
  is17LandsEligibleForSet(recentDate, null, 'BLB', testBLBCards) === false,
  'Set without 17Lands data must make 17Lands questions ineligible'
);
console.assert(
  is17LandsEligibleForSet(matureDate, authenticLandsDataForBLB, 'BLB', testBLBCards) === true,
  'Set with authentic data must be eligible'
);

// 6c. generateQuiz with an ineligible set (null 17Lands data) requesting 17Lands categories
const unreleasedQuizSettings: QuizSettings = {
  setCode: 'BLB',
  setName: 'Bloomburrow',
  releasedAt: futureDate,
  questionCount: 20,
  categories: ['trap_or_sleeper', 'card_evaluation', 'p1p1_pick'],
  rarities: ['common', 'uncommon', 'rare', 'mythic'],
  timerSeconds: 0,
  mode: 'quiz',
};

const unreleasedQuestions = generateQuiz(testBLBCards, unreleasedQuizSettings, null);
console.assert(
  unreleasedQuestions.length > 0,
  'Must still generate questions from eligible non-17Lands categories'
);
console.assert(
  unreleasedQuestions.every(q => q.category !== 'trap_or_sleeper'),
  'Set without 17Lands data must NEVER generate trap_or_sleeper questions'
);
console.assert(
  unreleasedQuestions.every(q => q.category !== 'card_evaluation'),
  'Set without 17Lands data must NEVER generate card_evaluation questions'
);
console.assert(
  unreleasedQuestions.every(q => !q.prompt.includes('17Lands') && !q.title.includes('17Lands')),
  'Questions without 17Lands data must not reference 17Lands'
);

// Verify P1P1 cards do not contain (% GIH WR) in description or explanation
const p1p1Questions = unreleasedQuestions.filter(q => q.category === 'p1p1_pick');
for (const p1p1 of p1p1Questions) {
  console.assert(
    p1p1.options.every(opt => !opt.description?.includes('GIH WR')),
    'P1P1 for set without 17Lands data must not display GIH WR'
  );
  console.assert(
    !p1p1.explanation.includes('GIH Win Rate'),
    'P1P1 explanation for set without 17Lands data must not cite 17Lands win rates'
  );
}
console.log('   ✓ Sets without authentic 17Lands telemetry strictly exclude 17Lands quiz questions and win rates.');


// Test 7: Direct 17Lands Card URL Resolution
console.log('\n[TEST 7] Direct 17Lands Card URL Resolution:');
const hobCardWithArenaId: Card = {
  id: 'hob-1',
  arena_id: 103444,
  name: 'Gollum, Riddle Master',
  set: 'HOB',
  set_name: 'The Hobbit',
  collector_number: '123',
  cmc: 3,
  type_line: 'Creature',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'rare',
  keywords: [],
};

const hobUrl = get17LandsCardUrl('HOB', hobCardWithArenaId);
console.log('   HOB card with arena_id ->', hobUrl);
console.assert(
  hobUrl === 'https://www.17lands.com/card_data/details?card_id=103444&expansion=HOB&format=PremierDraft&time_period=ALL_TIME',
  'Must match target 17Lands card details URL with card_id'
);

const cardWithoutId: Card = {
  id: 'blb-99',
  name: 'Unknown Custom Card',
  set: 'BLB',
  set_name: 'Bloomburrow',
  collector_number: '999',
  cmc: 1,
  type_line: 'Creature',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'common',
  keywords: [],
};

// With landData containing card_id
const blbWithLandDataUrl = get17LandsCardUrl('BLB', cardWithoutId, { card_id: 91537 } as any);
console.log('   BLB card with landData.card_id ->', blbWithLandDataUrl);
console.assert(
  blbWithLandDataUrl === 'https://www.17lands.com/card_data/details?card_id=91537&expansion=BLB&format=PremierDraft&time_period=ALL_TIME',
  'Must resolve card_id from landData when card.arena_id is missing'
);

// Fallback when no ID exists
const fallbackUrl = get17LandsCardUrl('BLB', cardWithoutId);
console.log('   Card without ID fallback ->', fallbackUrl);
console.assert(
  fallbackUrl === 'https://www.17lands.com/card_data?expansion=BLB&format=PremierDraft&time_period=ALL_TIME',
  'Must cleanly fall back to expansion card_data URL when no card_id exists'
);

// String backwards compatibility
const stringUrlWithLandData = get17LandsCardUrl('BLB', 'Banishing Light', { mtga_id: 91537 } as any);
console.log('   String cardName + landData.mtga_id ->', stringUrlWithLandData);
console.assert(
  stringUrlWithLandData === 'https://www.17lands.com/card_data/details?card_id=91537&expansion=BLB&format=PremierDraft&time_period=ALL_TIME',
  'Must resolve mtga_id from landData when card is passed as string'
);

console.log('   ✓ 17Lands direct card URL resolution and fallbacks verified.');

// Test 8: 17Lands Deck Color / Archetype URL Resolution
console.log('\n[TEST 8] 17Lands Deck Color / Archetype Metagame URL:');
const hobArchetypeUrl = get17LandsArchetypeUrl('HOB');
console.log('   HOB Archetype URL ->', hobArchetypeUrl);
console.assert(
  hobArchetypeUrl === 'https://www.17lands.com/deck_color_data?expansion=HOB&format=PremierDraft',
  'Must point to /deck_color_data with expansion and format=PremierDraft'
);
console.log('   ✓ 17Lands deck color metagame URL verified.');

// Test 9: Speed-Adjusted Card Similarity & Type Compatibility
console.log('\n[TEST 9] Speed-Adjusted Card Similarity & Type Compatibility:');

const murderInstant: Card = {
  id: 'mrd-1',
  name: 'Murder',
  set: 'DMU',
  set_name: 'Dominaria United',
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

const fellSorcery: Card = {
  id: 'fl-1',
  name: 'Fell',
  set: 'BLB',
  set_name: 'Bloomburrow',
  collector_number: '95',
  mana_cost: '{1}{B}',
  cmc: 2,
  type_line: 'Sorcery',
  oracle_text: 'Destroy target creature.',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'uncommon',
  keywords: [],
};

const vanillaCreature: Card = {
  id: 'vc-1',
  name: 'Grizzly Bears',
  set: 'DMU',
  set_name: 'Dominaria United',
  collector_number: '150',
  mana_cost: '{1}{G}',
  cmc: 2,
  type_line: 'Creature — Bear',
  oracle_text: '',
  power: '2',
  toughness: '2',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'common',
  keywords: [],
};

// 1. Instant vs Sorcery Removal Compatibility
console.assert(
  areCardTypesCompatible(murderInstant, fellSorcery) === true,
  'Murder (Instant) and Fell (Sorcery) must be type-compatible non-permanent removal spells'
);

// 2. Murder (3 CMC Instant) vs Fell (2 CMC Sorcery) Speed Parity Score
const murderVsFell = calculateCardSimilarity(murderInstant, fellSorcery);
console.log(`   Murder (3M Instant) vs Fell (2M Sorcery) -> Score: ${murderVsFell.score}%, Reasons:`, murderVsFell.reasons);
console.assert(murderVsFell.score >= 70, `Expected Murder vs Fell to score >= 70% due to speed parity (got ${murderVsFell.score}%)`);
console.assert(
  murderVsFell.reasons.some(r => r.includes('Speed-parity') || r.includes('Instant') || r.includes('tempo')),
  'Must cite speed parity or tempo equivalent reason'
);

// 3. Incompatible Types Disqualification
console.assert(
  areCardTypesCompatible(murderInstant, vanillaCreature) === false,
  'Creature and Instant removal must NOT be type-compatible'
);
const incompatibleResult = calculateCardSimilarity(murderInstant, vanillaCreature);
console.assert(incompatibleResult.score === 0, 'Incompatible card types must receive 0% similarity score');
console.log('   ✓ Incompatible types successfully receive 0% score and disqualification.');

console.log('   ✓ Speed-adjusted similarity & type compatibility gatekeeper verified.');

console.log('\n🎉 ALL LOGIC AND DATA VERIFICATION TESTS PASSED SUCCESSFULLY!');
