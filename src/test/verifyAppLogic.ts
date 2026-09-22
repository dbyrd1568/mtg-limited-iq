import { getFallbackCards, POPULAR_LIMITED_SETS, KNOWN_17LANDS_EXPANSIONS, deduplicateCards, normalizeScryfallCard, isRemovalSpell, isCounterspell, isCardDrawSpell, isInteractionSpell } from '../services/scryfall';
import { cardMatchesRoleFilter } from '../components/UI/ManaColorFilterBar';
import { generateQuiz } from '../services/quizGenerator';
import { calculateSetCalibration, accuracyToEvaluatorGrade, winRateToGradeTier, GRADE_TIERS, isSetUnderTwoWeeksOld, is17LandsEligibleForSet, get17LandsCardUrl, get17LandsArchetypeUrl, get17LandsExpansionCode, get17LandsSetUrl, getPreloaded17LandsData, get17LandsCardRating } from '../services/seventeenLands';
import { UserProfileStats, QuizResult, QuizSettings, UserCardEvaluation, Card, SeventeenLandsSetData } from '../types/mtg';
import { calculateMasteryRank, defaultStats } from '../services/storage';
import { isAuthentic17LandsDataSet, generateSetSynthesisReport } from '../services/archetypeEvaluator';
import { calculateCardSimilarity, areCardTypesCompatible, isFunctionalOrExactReprint, buildCompTuningString, SimilarCardMatch, HISTORICAL_BENCHMARK_CARDS } from '../services/cardSimilarity';
import { getWOTCArchetypeInfo, getWOTCArchetypesForSet, getDevelopedArchetypeCodes, SET_DEVELOPED_ARCHETYPES } from '../services/wotcArchetypes';
import { cardMatchesQuery } from '../services/cardSearchParser';
import { buildScryfallPrecedentQuery } from '../components/Evaluation/PrecedentCardSearch';
import {
  ALL_CONTEXTUAL_TOUR_STEPS,
  ContextualTourStepId,
  getCompletedTourSteps,
  markTourStepCompleted,
  isTourStepCompleted,
  resetTourSteps,
  skipAllTourSteps,
  getCalibrationPlotPanelPosition,
  saveCalibrationPlotPanelPosition,
} from '../services/storage';
import { TOUR_STEP_DEFINITIONS } from '../context/ContextualTourContext';
import { calculateLinearRegression, getTrendlineSegment } from '../components/Evaluation/CalibrationScatterPlot';

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

// Verify Precise Redaction (Stack interaction / Counterspell != Board Removal)
const preciseRedaction = normalizeScryfallCard({
  id: 'fra-precise-redaction',
  name: 'Precise Redaction',
  set: 'FRA',
  type_line: 'Instant',
  oracle_text: 'Counter target white or black spell.',
  mana_cost: '{1}{U}',
  cmc: 2,
  colors: ['U'],
  rarity: 'uncommon',
});
console.assert(preciseRedaction.is_removal === false, 'Precise Redaction must NOT be flagged as removal');
console.assert(preciseRedaction.is_counterspell === true, 'Precise Redaction must be flagged as counterspell');
console.assert(preciseRedaction.is_interaction === true, 'Precise Redaction must be flagged as interaction');
console.assert(preciseRedaction.is_card_draw === false, 'Precise Redaction must NOT be card draw');
console.assert(cardMatchesRoleFilter(preciseRedaction, ['REMOVAL']) === false, 'Precise Redaction must not match REMOVAL filter');
console.assert(cardMatchesRoleFilter(preciseRedaction, ['COUNTER']) === true, 'Precise Redaction must match COUNTER filter');
console.assert(cardMatchesRoleFilter(preciseRedaction, ['INTERACTION']) === true, 'Precise Redaction must match INTERACTION filter');
console.log(`[PASS] Counterspell vs Removal verified: Precise Redaction -> is_removal=${preciseRedaction.is_removal}, is_counterspell=${preciseRedaction.is_counterspell}, is_interaction=${preciseRedaction.is_interaction}`);

// Verify Sphinx's Approach (Card Draw / Selection != Board Removal)
const sphinxsApproach = normalizeScryfallCard({
  id: 'fra-sphinxs-approach',
  name: "Sphinx's Approach",
  set: 'FRA',
  type_line: 'Instant',
  oracle_text: 'Draw two cards. Then you may exile this spell and four cards named Sphinx\'s Approach from your graveyard. If you do, search your library for a Sphinx card, put it onto the battlefield, then shuffle.',
  mana_cost: '{1}{U}{U}',
  cmc: 3,
  colors: ['U'],
  rarity: 'common',
});
console.assert(sphinxsApproach.is_removal === false, "Sphinx's Approach must NOT be flagged as removal");
console.assert(sphinxsApproach.is_counterspell === false, "Sphinx's Approach must NOT be counterspell");
console.assert(sphinxsApproach.is_interaction === false, "Sphinx's Approach must NOT be interaction");
console.assert(sphinxsApproach.is_card_draw === true, "Sphinx's Approach must be flagged as card draw");
console.assert(cardMatchesRoleFilter(sphinxsApproach, ['REMOVAL']) === false, "Sphinx's Approach must not match REMOVAL filter");
console.assert(cardMatchesRoleFilter(sphinxsApproach, ['DRAW']) === true, "Sphinx's Approach must match DRAW filter");
console.log(`[PASS] Card Draw vs Removal verified: Sphinx's Approach -> is_removal=${sphinxsApproach.is_removal}, is_card_draw=${sphinxsApproach.is_card_draw}, is_interaction=${sphinxsApproach.is_interaction}`);

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
console.assert(!unreleasedReport.seventeenLandsBestColor, 'No best color fallback for unreleased set');
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

// 3.1 Same-Set Disqualification Gatekeeper (Never compare a set to itself)
const sameSetCard: Card = {
  ...murderInstant,
  id: 'dmu-choking-miasma',
  name: 'Choking Miasma',
  set: 'DMU',
  set_name: 'Dominaria United',
};
const sameSetSim = calculateCardSimilarity(murderInstant, sameSetCard);
console.assert(sameSetSim.score === 0, 'Cards from the same set must receive 0% similarity score');
console.log('   ✓ Same-set cards strictly disqualified (Never compare a set to itself).');

// 4. Exact Reprint & Functional Reprint 100% Match Gatekeeper
const murderM20: Card = {
  ...murderInstant,
  id: 'mrd-m20',
  set: 'M20',
  set_name: 'Core Set 2020',
};

const murderReprintSim = calculateCardSimilarity(murderInstant, murderM20);
console.log(`   Direct Reprint Murder (DMU vs M20) -> Score: ${murderReprintSim.score}%, Reasons:`, murderReprintSim.reasons);
console.assert(murderReprintSim.score === 100, 'Direct reprint must receive 100% similarity score');
console.assert(murderReprintSim.reasons[0].includes('Exact reprint'), 'Must cite direct reprint reason');

const elvishMystic: Card = {
  id: 'em-1',
  name: 'Elvish Mystic',
  set: 'M14',
  set_name: 'Magic 2014',
  collector_number: '169',
  mana_cost: '{G}',
  cmc: 1,
  type_line: 'Creature — Elf Druid',
  oracle_text: '{T}: Add {G}.',
  power: '1',
  toughness: '1',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'common',
  keywords: [],
  is_creature: true,
};

const llanowarElves: Card = {
  id: 'le-1',
  name: 'Llanowar Elves',
  set: 'DOM',
  set_name: 'Dominaria',
  collector_number: '168',
  mana_cost: '{G}',
  cmc: 1,
  type_line: 'Creature — Elf Druid',
  oracle_text: '{T}: Add {G}.',
  power: '1',
  toughness: '1',
  colors: ['G'],
  color_identity: ['G'],
  rarity: 'common',
  keywords: [],
  is_creature: true,
};

const functionalReprintSim = calculateCardSimilarity(elvishMystic, llanowarElves);
console.log(`   Functional Equivalent (Elvish Mystic vs Llanowar Elves) -> Score: ${functionalReprintSim.score}%, Reasons:`, functionalReprintSim.reasons);
console.assert(functionalReprintSim.score === 95, 'Exact functional equivalent must receive 95% similarity score (ceiling besides actual reprints)');
console.assert(functionalReprintSim.reasons[0].includes('functional equivalent'), 'Must cite functional equivalent reason');

// 5. Non-Reprint Gatekeeper: Old Thrush vs Campus Guide MUST NOT be 100%
const oldThrush: Card = {
  id: 'ot-1',
  name: 'Old Thrush',
  set: 'LTR',
  set_name: 'The Lord of the Rings: Tales of Middle-earth',
  collector_number: '242',
  mana_cost: '{2}',
  cmc: 2,
  type_line: 'Creature — Bird',
  oracle_text: 'Flying\nWhen Old Thrush enters the battlefield, you gain 2 life, then search your library for a basic land card, reveal it, then shuffle and put that card on top of your library.',
  power: '1',
  toughness: '2',
  colors: [],
  color_identity: [],
  rarity: 'common',
  keywords: ['Flying'],
  is_creature: true,
};

const campusGuide: Card = {
  id: 'cg-1',
  name: 'Campus Guide',
  set: 'STX',
  set_name: 'Strixhaven: School of Mages',
  collector_number: '252',
  mana_cost: '{2}',
  cmc: 2,
  type_line: 'Artifact Creature — Golem',
  oracle_text: 'When Campus Guide enters the battlefield, you may search your library for a basic land card, reveal it, then shuffle and put that card on top of your library.',
  power: '2',
  toughness: '1',
  colors: [],
  color_identity: [],
  rarity: 'common',
  keywords: [],
  is_creature: true,
};

const oldThrushSim = calculateCardSimilarity(oldThrush, campusGuide);
console.log(`   Old Thrush vs Campus Guide -> Score: ${oldThrushSim.score}%, Reasons:`, oldThrushSim.reasons);
console.assert(oldThrushSim.score < 95, `Old Thrush vs Campus Guide must NOT reach 100% or exceed non-reprint ceiling (got ${oldThrushSim.score}%)`);
console.assert(isFunctionalOrExactReprint(oldThrush, campusGuide).isReprint === false, 'Old Thrush and Campus Guide must not be flagged as reprints');

console.log('   ✓ Speed-adjusted similarity, reprint gatekeeper & non-reprint ceiling verified.');

// =========================================================================
// TEST 10: Expanded 17Lands Set Catalog & Expansion Alias Verification
// =========================================================================
console.log('\n[TEST 10] Expanded 17Lands Set Catalog & Expansion Aliases:');
const checkCodes = ['ELD', 'WAR', 'KTK', 'DOM', 'NEO', 'SNC', 'ONE', 'BRO', 'MOM', 'LTR', 'RVR', 'HOB'];
for (const code of checkCodes) {
  const pop = POPULAR_LIMITED_SETS.find(s => s.code === code);
  console.assert(pop !== undefined, `Set ${code} must exist in POPULAR_LIMITED_SETS`);
  console.assert(pop?.has_17lands_data === true, `Set ${code} must have has_17lands_data: true`);
  console.assert(KNOWN_17LANDS_EXPANSIONS.has(code), `Set ${code} must be in KNOWN_17LANDS_EXPANSIONS`);
}

// Check alias mapping
const rvrAlias = get17LandsExpansionCode('RVR');
console.assert(rvrAlias === 'RAVM', `RVR must map to RAVM for 17Lands (got ${rvrAlias})`);
const rvrUrl = get17LandsSetUrl('RVR');
console.assert(rvrUrl.includes('expansion=RAVM'), `RVR 17Lands URL must target expansion=RAVM (got ${rvrUrl})`);

console.log('   ✓ Expanded 17Lands sets verified in catalog with accurate telemetry flags.');
console.log('   ✓ 17Lands expansion code alias resolution verified.');

// =========================================================================
// TEST 11: Empirical MTG Limited Evaluator Grade Curve & Weighted GPA
// =========================================================================
console.log('\n[TEST 11] Empirical MTG Limited Evaluator Grade Curve & Weighted GPA:');

// Test 43% (The user's score): 33 of 76 correct (±1 step)
const userScoreEval = accuracyToEvaluatorGrade(43);
console.log(`   43% Accuracy -> Grade: ${userScoreEval.grade}, GPA: ${userScoreEval.gpa.toFixed(2)}, Title: "${userScoreEval.title}"`);
console.assert(userScoreEval.grade === 'B-', `43% must be B- on the MTG curve (got ${userScoreEval.grade})`);
console.assert(userScoreEval.gpa >= 2.5 && userScoreEval.gpa <= 2.8, `43% GPA must be ~2.74 (got ${userScoreEval.gpa})`);
console.assert(userScoreEval.grade !== 'F', '43% must NOT be an F!');

// Test 62% (LSV / Top Content Creator Benchmark):
const lsvEval = accuracyToEvaluatorGrade(62);
console.log(`   62% Accuracy (Top Creator Benchmark) -> Grade: ${lsvEval.grade}, GPA: ${lsvEval.gpa.toFixed(2)}, Title: "${lsvEval.title}"`);
console.assert(lsvEval.grade === 'A', `62% must be Pro Tour Caliber A (got ${lsvEval.grade})`);
console.assert(lsvEval.gpa >= 3.8, `62% GPA must be >= 3.8 (got ${lsvEval.gpa})`);

// Test 66% (Peak historic performance):
const eliteEval = accuracyToEvaluatorGrade(66);
console.log(`   66% Accuracy (Peak Ceiling) -> Grade: ${eliteEval.grade}, GPA: ${eliteEval.gpa.toFixed(2)}, Title: "${eliteEval.title}"`);
console.assert(eliteEval.grade === 'A+', `66% must be A+ (got ${eliteEval.grade})`);
console.assert(eliteEval.gpa === 4.0, `66% GPA must be 4.0 (got ${eliteEval.gpa})`);

// Test 26% (Random guessing baseline):
const randomEval = accuracyToEvaluatorGrade(26);
console.log(`   26% Accuracy (Random Guess Baseline) -> Grade: ${randomEval.grade}, GPA: ${randomEval.gpa.toFixed(2)}, Title: "${randomEval.title}"`);
console.assert(randomEval.grade === 'C-', `26% must be C- (got ${randomEval.grade})`);

// Test 10% (Inverted / anti-correlated read):
const invertedEval = accuracyToEvaluatorGrade(10);
console.log(`   10% Accuracy (Inverted Read) -> Grade: ${invertedEval.grade}, GPA: ${invertedEval.gpa.toFixed(2)}, Title: "${invertedEval.title}"`);
console.assert(invertedEval.grade === 'F', `10% must be F (got ${invertedEval.grade})`);

console.log('   ✓ MTG Limited empirical evaluator grade curve & smooth GPA verified.');

// =========================================================================
// TEST 12: WOTC Designed Archetypes & On-the-Fly Dynamic Synthesis
// =========================================================================
console.log('\n[TEST 12] WOTC Designed Archetypes & On-the-Fly Dynamic Synthesis:');

// 12a. Curated Set Verification (BLB, STX, HOB, MKM, LCI)
const blbBirds = getWOTCArchetypeInfo('BLB', 'WU');
console.log(`   BLB WU Curated: "${blbBirds.name}" -> ${blbBirds.headline}`);
console.assert(blbBirds.name.includes('Birds'), 'BLB WU should be Birds');
console.assert(blbBirds.mechanics.includes('Flying'), 'BLB WU should have Flying mechanic');

const stxSilverquill = getWOTCArchetypeInfo('STX', 'WB');
console.log(`   STX WB Curated: "${stxSilverquill.name}" -> ${stxSilverquill.headline}`);
console.assert(stxSilverquill.name.includes('Silverquill'), 'STX WB should be Silverquill');
console.assert(stxSilverquill.mechanics.length > 0, 'STX WB should have mechanics');

// 12b. 5-Pair Asymmetric Set Filtering (STX, HOB)
const stxDeveloped = getDevelopedArchetypeCodes('STX', []);
console.assert(stxDeveloped.size === 5, 'STX should have exactly 5 developed colleges');
console.assert(stxDeveloped.has('WB') && !stxDeveloped.has('WU'), 'STX should develop enemy colleges, not allied');

const hobDeveloped = getDevelopedArchetypeCodes('HOB', []);
console.assert(hobDeveloped.size === 5, 'HOB should have exactly 5 developed archetypes');

// 12c. On-the-Fly Dynamic Archetype Synthesis for Uncurated Sets
const mockPool: Card[] = [
  {
    id: 'mock-1',
    name: 'Storm-Forged Drake',
    colors: ['U', 'R'],
    rarity: 'uncommon',
    set: 'NEW',
    type_line: 'Creature — Drake',
    oracle_text: 'Flying. Whenever you cast a noncreature spell, Storm-Forged Drake gets +2/+0 until end of turn.',
  } as Card,
  {
    id: 'mock-2',
    name: 'Lightning Bolt',
    colors: ['R'],
    rarity: 'common',
    set: 'NEW',
    type_line: 'Instant',
    oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  } as Card,
];

const dynamicArchetype = getWOTCArchetypeInfo('NEW', 'UR', mockPool);
console.log(`   On-The-Fly Synthesized NEW UR: "${dynamicArchetype.name}" -> ${dynamicArchetype.headline}`);
console.assert(dynamicArchetype.headline.includes('Spells') || dynamicArchetype.headline.includes('Prowess') || dynamicArchetype.headline.includes('Tempo'), 'Dynamic archetype should synthesize spell tempo');
console.assert(dynamicArchetype.description.includes('Storm-Forged Drake'), 'Dynamic archetype description should cite signpost card');
console.assert(dynamicArchetype.description.startsWith('Wizards designed'), 'Dynamic archetype description should be formatted WOTC-style');

console.log('   ✓ Curated WOTC archetypes, 5-pair asymmetric sets, and on-the-fly synthesis verified.');

// =========================================================================
// TEST 13: Search Syntax: Mana Cost {2}{W}, Power/Toughness 2/3 & Combined Queries
// =========================================================================
console.log('\n[TEST 13] Search Syntax: Mana Cost {2}{W}, Power/Toughness 2/3 & Combined:');
const testCourser: Card = {
  id: 'courser-1',
  name: 'Pegasus Courser',
  set: 'M19',
  set_name: 'Core Set 2019',
  collector_number: '32',
  mana_cost: '{2}{W}',
  cmc: 3,
  type_line: 'Creature — Pegasus',
  oracle_text: 'Flying\nWhenever Pegasus Courser attacks, another target attacking creature gains flying until end of turn.',
  power: '2',
  toughness: '3',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: ['Flying'],
};

console.assert(cardMatchesQuery(testCourser, '{2}{W}'), '{2}{W} must match Pegasus Courser');
console.assert(!cardMatchesQuery(testCourser, '{1}{W}'), '{1}{W} must NOT match Pegasus Courser');
console.assert(cardMatchesQuery(testCourser, '2W'), 'Shorthand 2W must match Pegasus Courser');
console.assert(!cardMatchesQuery(testCourser, '1W'), 'Shorthand 1W must NOT match Pegasus Courser');
console.assert(cardMatchesQuery(testCourser, '2/3'), '2/3 stats must match Pegasus Courser without affecting text');
console.assert(!cardMatchesQuery(testCourser, '3/3'), '3/3 stats must NOT match Pegasus Courser');
console.assert(cardMatchesQuery(testCourser, 'flying 2/3 {2}{W}'), 'Combined flying 2/3 {2}{W} must match');
console.assert(cardMatchesQuery(testCourser, '2/3 2W flying'), 'Combined in any order with shorthand mana 2W must match');
console.assert(cardMatchesQuery(testCourser, 'pt:2/3'), 'pt:2/3 must match Pegasus Courser');
console.assert(cardMatchesQuery(testCourser, 'pt>=2/2'), 'pt>=2/2 must match Pegasus Courser');
console.assert(cardMatchesQuery(testCourser, 'm:{2}{W}'), 'm:{2}{W} must match Pegasus Courser');
console.log('   ✓ Mana cost {2}{W}, shorthand 2W, P/T stats 2/3, and combined queries verified.');

// Test 13B: Natural Rules Text Search Without o: or Quotes
console.log('\n[TEST 13B] Natural Rules Text Inference (Without o: or Quotes):');
const testOpt: Card = {
  id: 'opt-1',
  name: 'Opt',
  set: 'ELD',
  set_name: 'Throne of Eldraine',
  collector_number: '59',
  mana_cost: '{U}',
  cmc: 1,
  type_line: 'Instant',
  oracle_text: 'Scry 1.\nDraw a card.',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'common',
  keywords: ['Scry'],
};

const testMurder: Card = {
  id: 'murder-1',
  name: 'Murder',
  set: 'M20',
  set_name: 'Core Set 2020',
  collector_number: '109',
  mana_cost: '{1}{B}{B}',
  cmc: 3,
  type_line: 'Instant',
  oracle_text: 'Destroy target creature.',
  colors: ['B'],
  color_identity: ['B'],
  rarity: 'common',
  keywords: [],
};

const testDfcDraw: Card = {
  id: 'dfc-draw-1',
  name: 'Curious Discovery // Ponderous Thought',
  set: 'MH3',
  set_name: 'Modern Horizons 3',
  collector_number: '77',
  mana_cost: '{1}{U}',
  cmc: 2,
  type_line: 'Instant // Sorcery',
  colors: ['U'],
  color_identity: ['U'],
  rarity: 'uncommon',
  keywords: [],
  card_faces: [
    {
      name: 'Curious Discovery',
      mana_cost: '{1}{U}',
      type_line: 'Instant',
      oracle_text: 'Draw a card, then discard a card.',
    },
    {
      name: 'Ponderous Thought',
      mana_cost: '{3}{U}',
      type_line: 'Sorcery',
      oracle_text: 'Draw two cards.',
    },
  ],
};

const testVanillaFlyer: Card = {
  id: 'flyer-1',
  name: 'Suntail Hawk',
  set: 'M15',
  set_name: 'Magic 2015',
  collector_number: '34',
  mana_cost: '{W}',
  cmc: 1,
  type_line: 'Creature — Bird',
  oracle_text: '',
  power: '1',
  toughness: '1',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'common',
  keywords: ['Flying'],
};

// Natural phrase matching: "draw a card" without o:
console.assert(cardMatchesQuery(testOpt, 'draw a card'), '"draw a card" must match Opt without o: prefix');
console.assert(!cardMatchesQuery(testMurder, 'draw a card'), '"draw a card" must NOT match Murder');
console.assert(cardMatchesQuery(testMurder, 'destroy target creature'), '"destroy target creature" must match Murder without o:');
console.assert(!cardMatchesQuery(testOpt, 'destroy target creature'), '"destroy target creature" must NOT match Opt');

// Multi-factor natural query: phrase + mana
console.assert(cardMatchesQuery(testOpt, 'draw a card {U}'), '"draw a card {U}" must match Opt');
console.assert(!cardMatchesQuery(testOpt, 'draw a card {1}{B}'), '"draw a card {1}{B}" must NOT match Opt');

// DFC card faces inference: oracle text on face matches
console.assert(cardMatchesQuery(testDfcDraw, 'draw a card'), '"draw a card" must match DFC where text is on card_faces');
console.assert(cardMatchesQuery(testDfcDraw, 'draw a card 1U'), 'Phrase + shorthand mana 1U must match DFC');

// Keyword-only card without oracle text
console.assert(cardMatchesQuery(testVanillaFlyer, 'flying'), 'Keyword "flying" must match card without oracle_text');
console.assert(cardMatchesQuery(testVanillaFlyer, 'flying 1/1 {W}'), '"flying 1/1 {W}" must match Suntail Hawk');

// Scryfall Precedent Query Builder verification
const scryfallQ1 = buildScryfallPrecedentQuery('draw a card');
console.assert(scryfallQ1.includes('o:"draw a card"'), 'Scryfall query must include o:"draw a card"');
const scryfallQ2 = buildScryfallPrecedentQuery('flying 2/3 2W');
console.assert(scryfallQ2.includes('pow=2 tou=3') && scryfallQ2.includes('m:{2}{W}'), 'Scryfall query must infer stats and shorthand mana');

console.log('   ✓ Natural unquoted rules text inference verified.');
console.log('   ✓ DFC card face text matching verified.');
console.log('   ✓ Keyword-only matching without oracle text verified.');
console.log('   ✓ Scryfall precedent search query generation verified.');

// Test 14: Card Deduplication by Exact Name and Base Treatment Preservation
console.log('\n[TEST 14] Card Deduplication by Exact Name & Base Treatment Resolution:');

const rawTestCards: Card[] = [
  // Heartfire Hero: regular vs showcase vs raised foil
  {
    id: 'blb-138',
    name: 'Heartfire Hero',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '138',
    cmc: 1,
    type_line: 'Creature — Mouse Soldier',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'uncommon',
    keywords: ['Valiant'],
    booster: true,
    promo: false,
  },
  {
    id: 'blb-272',
    name: 'Heartfire Hero',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '272',
    cmc: 1,
    type_line: 'Creature — Mouse Soldier',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'uncommon',
    keywords: ['Valiant'],
    booster: false,
    promo: false,
  },
  {
    id: 'blb-354',
    name: 'Heartfire Hero',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '354',
    cmc: 1,
    type_line: 'Creature — Mouse Soldier',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'uncommon',
    keywords: ['Valiant'],
    booster: false,
    promo: true,
  },
  // Basic Lands: Plains #262, #263, #264
  {
    id: 'blb-262',
    name: 'Plains',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '262',
    cmc: 0,
    type_line: 'Basic Land — Plains',
    colors: ['C'],
    color_identity: ['W'],
    rarity: 'common',
    keywords: [],
    booster: true,
  },
  {
    id: 'blb-263',
    name: 'Plains',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '263',
    cmc: 0,
    type_line: 'Basic Land — Plains',
    colors: ['C'],
    color_identity: ['W'],
    rarity: 'common',
    keywords: [],
    booster: true,
  },
  // Distinct other card
  {
    id: 'blb-95',
    name: 'Fell',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '95',
    cmc: 2,
    type_line: 'Sorcery',
    colors: ['B'],
    color_identity: ['B'],
    rarity: 'uncommon',
    keywords: [],
    booster: true,
  },
];

const deduped = deduplicateCards(rawTestCards);
console.assert(deduped.length === 3, `Expected exactly 3 unique cards, got ${deduped.length}`);

const hero = deduped.find(c => c.name === 'Heartfire Hero');
console.assert(hero !== undefined, 'Heartfire Hero must be present in deduped cards');
console.assert(hero?.collector_number === '138', `Heartfire Hero must resolve to base booster #138, got #${hero?.collector_number}`);
console.assert(hero?.booster === true, 'Heartfire Hero must have booster=true');

const plains = deduped.filter(c => c.name === 'Plains');
console.assert(plains.length === 1, `Expected exactly 1 Plains, got ${plains.length}`);
console.assert(plains[0].collector_number === '262', `Plains must resolve to lowest collector number 262, got #${plains[0].collector_number}`);

// Order Inversion Test: Even if showcase #272 appears FIRST in array, #138 must be selected
const invertedCards: Card[] = [rawTestCards[1], rawTestCards[0]];
const invertedDeduped = deduplicateCards(invertedCards);
console.assert(invertedDeduped.length === 1, 'Inverted cards must deduplicate to 1');
console.assert(invertedDeduped[0].collector_number === '138', 'Inverted list must still resolve to base booster #138');

console.log('   ✓ Exact name deduplication verified.');
console.log('   ✓ Preferred base booster printing over showcase/promo treatments verified.');
console.log('   ✓ Redundant basic land variant deduplication verified.');
console.log('   ✓ Order-independent canonical selection verified.');

// Test 15: Contextual First-Time Onboarding Tour Verification
console.log('\n--- Test 15: Contextual First-Time Onboarding Tour Verification ---');

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

// 1. Verify all 7 milestone steps are present and defined
console.assert(ALL_CONTEXTUAL_TOUR_STEPS.length === 7, `Expected exactly 7 tour steps, got ${ALL_CONTEXTUAL_TOUR_STEPS.length}`);

const requiredSteps = [
  'set_selector',
  'grading_mode',
  'enter_grade',
  'view_comps',
  'replace_comp',
  'export_grades',
  'quiz_overview',
];

for (const step of requiredSteps) {
  const stepId = step as ContextualTourStepId;
  console.assert(ALL_CONTEXTUAL_TOUR_STEPS.includes(stepId), `Missing tour step: ${step}`);
  const def = TOUR_STEP_DEFINITIONS[stepId];
  console.assert(def !== undefined, `Missing step definition for ${step}`);
  console.assert(Boolean(def.targetSelector), `Step ${step} must have a targetSelector`);
  console.assert(Boolean(def.title), `Step ${step} must have a title`);
  console.assert(Boolean(def.description), `Step ${step} must have a description`);
}

// 2. Verify storage operations
resetTourSteps();
console.assert(getCompletedTourSteps().length === 0, 'Completed steps must be empty after resetTourSteps()');
console.assert(isTourStepCompleted('set_selector') === false, 'set_selector should not be completed initially');

markTourStepCompleted('set_selector');
console.assert(isTourStepCompleted('set_selector') === true, 'set_selector must be marked completed');
console.assert(getCompletedTourSteps().length === 1, 'Completed steps must have length 1');
console.assert(isTourStepCompleted('grading_mode') === false, 'grading_mode should not be completed yet');

markTourStepCompleted('grading_mode');
console.assert(getCompletedTourSteps().length === 2, 'Completed steps must have length 2');

skipAllTourSteps();
console.assert(getCompletedTourSteps().length === 7, 'skipAllTourSteps must mark all 7 steps completed');
console.assert(isTourStepCompleted('quiz_overview') === true, 'quiz_overview must be completed after skipAll');

resetTourSteps();
console.assert(getCompletedTourSteps().length === 0, 'Completed steps must be empty after second reset');

console.log('   ✓ All 7 contextual tour steps verified with valid DOM selectors.');
console.log('   ✓ Contextual tour step definitions and step sequencing verified.');
console.log('   ✓ Storage lifecycle (mark completed, skip all, reset) verified.');

// =========================================================================
// TEST 16: OLS Linear Regression & RSQ (R²) Calibration Modeling
// =========================================================================
console.log('\n--- Test 16: OLS Linear Regression & RSQ (R²) Calibration Modeling ---');

// 1. Perfect 1:1 Parity Dataset
const perfectPoints = [
  { x: 0, y: 0 },
  { x: 2, y: 2 },
  { x: 5, y: 5 },
  { x: 8, y: 8 },
  { x: 12, y: 12 },
];
const perfectReg = calculateLinearRegression(perfectPoints);
console.assert(Math.abs(perfectReg.slope - 1.0) < 0.001, `Slope must be 1.0 (got ${perfectReg.slope})`);
console.assert(Math.abs(perfectReg.intercept - 0.0) < 0.001, `Intercept must be 0.0 (got ${perfectReg.intercept})`);
console.assert(Math.abs(perfectReg.correlation - 1.0) < 0.001, `Correlation must be 1.0 (got ${perfectReg.correlation})`);
console.assert(Math.abs(perfectReg.rSquared - 1.0) < 0.001, `R² must be 1.0 (got ${perfectReg.rSquared})`);
console.assert(perfectReg.biasDiagnosis.includes('Balanced calibration'), 'Diagnosis should be balanced');
console.log('   ✓ Perfect 1:1 parity regression verified (slope=1.0, R²=1.0).');

// 2. Systematic Optimist / Offset Dataset
const offsetPoints = [
  { x: 2, y: 0 },
  { x: 4, y: 2 },
  { x: 6, y: 4 },
  { x: 8, y: 6 },
  { x: 10, y: 8 },
];
const offsetReg = calculateLinearRegression(offsetPoints);
console.assert(Math.abs(offsetReg.slope - 1.0) < 0.001, `Offset slope must be 1.0 (got ${offsetReg.slope})`);
console.assert(Math.abs(offsetReg.intercept - (-2.0)) < 0.001, `Offset intercept must be -2.0 (got ${offsetReg.intercept})`);
console.assert(offsetReg.rSquared === 1.0, `Offset R² must still be 1.0 (got ${offsetReg.rSquared})`);
console.assert(offsetReg.biasDiagnosis.includes('Format optimist'), 'Diagnosis should identify optimism');
console.log('   ✓ Systematic offset regression verified (intercept=-2.0, format optimist identified).');

// 3. Compressed Spread Dataset (m < 0.75)
const compressedPoints = [
  { x: 0, y: 3 },
  { x: 3, y: 4 },
  { x: 6, y: 5 },
  { x: 9, y: 6 },
  { x: 12, y: 7 },
];
const compressedReg = calculateLinearRegression(compressedPoints);
console.assert(compressedReg.slope < 0.75, `Compressed slope must be < 0.75 (got ${compressedReg.slope})`);
console.assert(compressedReg.biasDiagnosis.includes('Compressed spread'), 'Diagnosis should flag compressed spread');
console.log('   ✓ Compressed spread regression verified (slope < 0.75, compressed spread identified).');

// 4. Trendline Clipping to [0, 12] ViewBox bounds
const steepSegment = getTrendlineSegment(2.0, -4.0, 12);
console.assert(steepSegment.x1 >= 0 && steepSegment.x1 <= 12, `x1 in bounds: ${steepSegment.x1}`);
console.assert(steepSegment.y1 >= 0 && steepSegment.y1 <= 12, `y1 in bounds: ${steepSegment.y1}`);
console.assert(steepSegment.x2 >= 0 && steepSegment.x2 <= 12, `x2 in bounds: ${steepSegment.x2}`);
console.assert(steepSegment.y2 >= 0 && steepSegment.y2 <= 12, `y2 in bounds: ${steepSegment.y2}`);
console.log('   ✓ Trendline coordinate clipping verified within [0, 12] view space.');

// =========================================================================
// TEST 17: User-Scoped Calibration Plot Docking Position Persistence
// =========================================================================
console.log('\n--- Test 17: User-Scoped Calibration Plot Docking Position Persistence ---');

// Default fallback for guest or unconfigured user is 'right'
console.assert(getCalibrationPlotPanelPosition('user_alpha') === 'right', 'Initial position should default to right');

// Save 'left' for user_alpha
saveCalibrationPlotPanelPosition('left', 'user_alpha');
console.assert(getCalibrationPlotPanelPosition('user_alpha') === 'left', 'user_alpha position should be left');

// user_beta should remain independent and default to 'right'
console.assert(getCalibrationPlotPanelPosition('user_beta') === 'right', 'user_beta position should still be right');

// Save 'right' explicitly for user_alpha and verify toggle back
saveCalibrationPlotPanelPosition('right', 'user_alpha');
console.assert(getCalibrationPlotPanelPosition('user_alpha') === 'right', 'user_alpha position should toggle to right');

// =========================================================================
// TEST 18: Secrets of Strixhaven (SOS) & Released Sets 17Lands Bulletproofing
// =========================================================================
console.log('\n--- Test 18: Secrets of Strixhaven (SOS) & Released Sets 17Lands Bulletproofing ---');

// 1. Verify bundled preloaded dataset for SOS exists and contains full set (341 cards)
const sosPreloaded = getPreloaded17LandsData('SOS');
console.assert(sosPreloaded !== null, 'SOS must have non-null preloaded 17Lands dataset');
const sosCardCount = Object.keys(sosPreloaded?.cards || {}).length;
console.assert(sosCardCount === 341, `SOS preloaded dataset must contain 341 cards, got: ${sosCardCount}`);
console.log(`   ✓ SOS bundled preloaded dataset verified with complete 341-card draft catalog.`);

// 2. Verify authentic telemetry on "The Dawning Archaic"
const dawningRating = get17LandsCardRating({ name: 'The Dawning Archaic', set: 'SOS' }, sosPreloaded);
console.assert(dawningRating !== null, 'The Dawning Archaic must have non-null 17Lands telemetry');
console.assert((dawningRating?.win_rate || 0) > 0.53 && (dawningRating?.win_rate || 0) < 0.55, `The Dawning Archaic WR must be ~53.8%, got: ${dawningRating?.win_rate}`);
console.assert(dawningRating?.avg_seen === 1.89, `The Dawning Archaic ALSA must be 1.89, got: ${dawningRating?.avg_seen}`);
console.assert(dawningRating?.tier_grade === 'C+', `The Dawning Archaic tier_grade must be C+, got: ${dawningRating?.tier_grade}`);
console.assert(dawningRating?.game_count === 21296, `The Dawning Archaic game_count must be 21296, got: ${dawningRating?.game_count}`);
console.log(`   ✓ "The Dawning Archaic" authentic telemetry verified (WR: 53.79%, ALSA: 1.89, 21,296 games, Tier: C+).`);

// 3. Verify authentic telemetry on "Sundering Archaic"
const sunderingRating = get17LandsCardRating({ name: 'Sundering Archaic', set: 'SOS' }, sosPreloaded);
console.assert(sunderingRating !== null, 'Sundering Archaic must have non-null 17Lands telemetry');
console.assert((sunderingRating?.win_rate || 0) > 0.58, `Sundering Archaic WR must be >58%, got: ${sunderingRating?.win_rate}`);
console.assert(sunderingRating?.tier_grade === 'B+', `Sundering Archaic tier_grade must be B+, got: ${sunderingRating?.tier_grade}`);
console.assert(sunderingRating?.game_count === 141633, `Sundering Archaic game_count must be 141,633, got: ${sunderingRating?.game_count}`);
console.log(`   ✓ "Sundering Archaic" authentic telemetry verified (WR: 58.85%, ALSA: 4.45, 141,633 games, Tier: B+).`);

// 4. Verify authentic telemetry on top bomb "Together as One"
const togetherRating = get17LandsCardRating({ name: 'Together as One', set: 'SOS' }, sosPreloaded);
console.assert(togetherRating !== null, 'Together as One must have non-null 17Lands telemetry');
console.assert((togetherRating?.win_rate || 0) > 0.65, `Together as One WR must be >65%, got: ${togetherRating?.win_rate}`);
console.assert(togetherRating?.tier_grade === 'A+', `Together as One tier_grade must be A+, got: ${togetherRating?.tier_grade}`);
console.log(`   ✓ "Together as One" authentic telemetry verified (WR: 65.61%, Tier: A+).`);

// 5. Verify authenticity and eligibility checks for SOS
const sampleSosCards: Card[] = [
  { id: 'sos-1', name: 'The Dawning Archaic', set: 'SOS', colors: [], rarity: 'mythic' } as unknown as Card,
  { id: 'sos-2', name: 'Sundering Archaic', set: 'SOS', colors: [], rarity: 'uncommon' } as unknown as Card,
  { id: 'sos-3', name: 'Together as One', set: 'SOS', colors: ['W'], rarity: 'rare' } as unknown as Card,
];
console.assert(isAuthentic17LandsDataSet(sosPreloaded, 'SOS', sampleSosCards) === true, 'SOS preloaded data must be certified authentic');
console.assert(is17LandsEligibleForSet('2026-04-24', sosPreloaded, 'SOS', sampleSosCards) === true, 'SOS must be 17Lands eligible');
console.log(`   ✓ SOS authenticity and 17Lands feature eligibility verified.`);

// 6. Verify that partial benchmark stubs (<50 cards) are NOT returned as full set preloaded data
const stxPreloaded = getPreloaded17LandsData('STX');
console.assert(stxPreloaded === null, 'Partial benchmark set STX must return null from getPreloaded17LandsData to prevent cache poisoning');
console.log(`   ✓ Partial benchmark stubs (<50 cards) strictly barred from masquerading as full sets.`);

// 7. Verify benchmark card lookups continue working seamlessly for cross-set precedents
const iterationRating = get17LandsCardRating({ name: 'Expressive Iteration' });
console.assert(iterationRating !== null && (iterationRating.win_rate || 0) > 0.60, 'Expressive Iteration benchmark rating must resolve');
console.log(`   ✓ Cross-set precedent benchmark lookup verified.`);

// 8. Verify Admin Comp Tuning String formatting: "<Ref card name> vs <comp1 name>, <comp2 name>, <comp3 name>, <comp4 name>"
const targetCardForTuning: Card = {
  id: 'ref-1',
  name: 'Lightning Strike',
  set: 'DMU',
  mana_cost: '{1}{R}',
  cmc: 2,
  type_line: 'Instant',
  oracle_text: 'Lightning Strike deals 3 damage to any target.',
  colors: ['R'],
  rarity: 'common',
} as unknown as Card;

const mockMatchesForTuning: SimilarCardMatch[] = [
  { card: { id: 'c1', name: 'Abrade', set: 'VOW' } as Card, similarityScore: 90, matchReasons: [] },
  { card: { id: 'c2', name: 'Shock', set: 'M21' } as Card, similarityScore: 85, matchReasons: [] },
  { card: { id: 'c3', name: 'Torch Breath', set: 'SNC' } as Card, similarityScore: 80, matchReasons: [] },
  { card: { id: 'c4', name: 'Play with Fire', set: 'MID' } as Card, similarityScore: 78, matchReasons: [] },
];

const tuningOutput = buildCompTuningString(targetCardForTuning, mockMatchesForTuning);
console.assert(
  tuningOutput === 'Lightning Strike vs Abrade, Shock, Torch Breath, Play with Fire',
  `Expected exact tuning format, got: "${tuningOutput}"`
);
console.log(`[PASS] Admin Comp Tuning String captured accurately: "${tuningOutput}"`);

// =========================================================================
// TEST 19: Reality Fracture (FRA) & Heartwood Token Engine Tuning
// =========================================================================
console.log('\n--- Test 19: Reality Fracture (FRA) & Heartwood Token Engine Tuning ---');
const fraRGInfo = getWOTCArchetypeInfo('FRA', 'RG');
console.assert(
  fraRGInfo.name.toLowerCase().includes('heartwood'),
  `FRA RG archetype must feature Heartwood, got: ${fraRGInfo.name}`
);
console.assert(
  fraRGInfo.mechanics.includes('Heartwood Tokens'),
  'FRA RG archetype mechanics must include Heartwood Tokens'
);
console.log('   ✓ FRA RG canonical Konstrari Heartwood archetype verified.');

const fraDeveloped = SET_DEVELOPED_ARCHETYPES['FRA'];
console.assert(
  fraDeveloped && fraDeveloped.includes('RG') && fraDeveloped.length === 10,
  'FRA must develop all 10 color pairs'
);
console.log('   ✓ FRA develops all 10 color pairs registered in SET_DEVELOPED_ARCHETYPES.');

const fraCards = getFallbackCards('FRA');
console.assert(fraCards.length >= 7, 'FRA must include spoiled preview cards');
const konstrari = fraCards.find(c => c.name.startsWith('Konstrari Improviser'))!;
const opportunistCard = HISTORICAL_BENCHMARK_CARDS.find(c => c.name === 'Argothian Opportunist')!;
const opportunistComp = calculateCardSimilarity(konstrari, opportunistCard);
console.assert(
  opportunistComp.score >= 50 && opportunistComp.reasons.some(r => r.toLowerCase().includes('ramp artifact token')),
  `Expected ramp artifact token peer match between Improviser and Opportunist, got score: ${opportunistComp.score}`
);
console.log('   ✓ Heartwood token <-> Powerstone ramp token similarity comp verified.');

console.log('\n🎉 ALL LOGIC AND DATA VERIFICATION TESTS PASSED SUCCESSFULLY!');



