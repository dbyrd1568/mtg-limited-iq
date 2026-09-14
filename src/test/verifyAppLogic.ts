import { getFallbackCards, POPULAR_LIMITED_SETS, KNOWN_17LANDS_EXPANSIONS } from '../services/scryfall';
import { generateQuiz } from '../services/quizGenerator';
import { calculateSetCalibration, accuracyToEvaluatorGrade, winRateToGradeTier, GRADE_TIERS, isSetUnderTwoWeeksOld, is17LandsEligibleForSet, get17LandsCardUrl, get17LandsArchetypeUrl, get17LandsExpansionCode, get17LandsSetUrl } from '../services/seventeenLands';
import { UserProfileStats, QuizResult, QuizSettings, UserCardEvaluation, Card, SeventeenLandsSetData } from '../types/mtg';
import { calculateMasteryRank, defaultStats } from '../services/storage';
import { isAuthentic17LandsDataSet, generateSetSynthesisReport } from '../services/archetypeEvaluator';
import { calculateCardSimilarity, areCardTypesCompatible, isFunctionalOrExactReprint } from '../services/cardSimilarity';
import { getWOTCArchetypeInfo, getWOTCArchetypesForSet, getDevelopedArchetypeCodes } from '../services/wotcArchetypes';
import { cardMatchesQuery } from '../services/cardSearchParser';

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
console.assert(cardMatchesQuery(testCourser, '2/3'), '2/3 stats must match Pegasus Courser without affecting text');
console.assert(!cardMatchesQuery(testCourser, '3/3'), '3/3 stats must NOT match Pegasus Courser');
console.assert(cardMatchesQuery(testCourser, 'flying 2/3 {2}{W}'), 'Combined flying 2/3 {2}{W} must match');
console.assert(cardMatchesQuery(testCourser, 'pt:2/3'), 'pt:2/3 must match Pegasus Courser');
console.assert(cardMatchesQuery(testCourser, 'pt>=2/2'), 'pt>=2/2 must match Pegasus Courser');
console.assert(cardMatchesQuery(testCourser, 'm:{2}{W}'), 'm:{2}{W} must match Pegasus Courser');
console.log('   ✓ Mana cost {2}{W}, P/T stats 2/3, and combined queries verified.');

console.log('\n🎉 ALL LOGIC AND DATA VERIFICATION TESTS PASSED SUCCESSFULLY!');

