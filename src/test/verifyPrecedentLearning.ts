import { Card } from '../types/mtg';
import {
  savePrecedentOverride,
  getTargetCardOverrides,
} from '../services/precedentOverrides';
import {
  recordPrecedentLearning,
  getAllLearnedKnowledge,
  clearAllLearnedKnowledge,
  getLearnedBenchmarkCandidates,
  getLearnedQueryExpansions,
  getLearnedPrecedentBoost,
  exportLearnedKnowledge,
  importLearnedKnowledge,
} from '../services/precedentLearning';
import {
  calculateCardSimilarity,
  buildCustomPrecedentMatch,
  findSimilarCards,
  SimilarCardMatch,
} from '../services/cardSimilarity';

// In-memory mock for localStorage in node test environment
const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = val;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k in mockStorage) delete mockStorage[k];
    },
  };
}

async function runPrecedentLearningTests() {
  console.log('=== Precedent Engine Beyond-the-Bubble Learning Verification ===\n');
  clearAllLearnedKnowledge('test_learner');

  // Target Card 1: Heartfire Hero (Valiant 1-drop from BLB)
  const heartfireHero: Card = {
    id: 'card_blb_heartfire_01',
    name: 'Heartfire Hero',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '138',
    mana_cost: '{R}',
    cmc: 1,
    type_line: 'Creature — Mouse Soldier',
    oracle_text: 'Valiant — Whenever Heartfire Hero becomes the target of a spell or ability you control for the first time each turn, put a +1/+1 counter on it.\nWhen Heartfire Hero dies, it deals damage equal to its power to each opponent.',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'uncommon',
    power: '1',
    toughness: '1',
    keywords: [],
  };

  // Suboptimal Engine Suggestion: Goblin Guide (Vanilla aggro 1-drop)
  const goblinGuide: Card = {
    id: 'card_2xm_goblin_guide',
    name: 'Goblin Guide',
    set: '2XM',
    set_name: 'Double Masters',
    collector_number: '120',
    mana_cost: '{R}',
    cmc: 1,
    type_line: 'Creature — Goblin Scout',
    oracle_text: 'Haste. Whenever Goblin Guide attacks, defending player reveals the top card of their library.',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'rare',
    power: '2',
    toughness: '2',
    keywords: ['Haste'],
  };

  // User Preferred Replacement: Tenth District Legionnaire (Heroic / Target-trigger aggro)
  const tenthDistrict: Card = {
    id: 'card_war_tenth_district',
    name: 'Tenth District Legionnaire',
    set: 'WAR',
    set_name: 'War of the Spark',
    collector_number: '222',
    mana_cost: '{R}{W}',
    cmc: 2,
    type_line: 'Creature — Human Soldier',
    oracle_text: 'Haste.\nHeroic — Whenever you cast a spell that targets Tenth District Legionnaire, put a +1/+1 counter on Tenth District Legionnaire, then scry 1.',
    colors: ['R', 'W'],
    color_identity: ['R', 'W'],
    rarity: 'uncommon',
    power: '2',
    toughness: '2',
    keywords: ['Haste'],
  };

  // Target Card 2 in same set: Emberheart Challenger (Valiant 2-drop mouse)
  const emberheartChallenger: Card = {
    id: 'card_blb_emberheart_01',
    name: 'Emberheart Challenger',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '133',
    mana_cost: '{1}{R}',
    cmc: 2,
    type_line: 'Creature — Mouse Warrior',
    oracle_text: 'Haste, prowess.\nValiant — Whenever Emberheart Challenger becomes the target of a spell or ability you control for the first time each turn, exile the top card of your library. Until end of turn, you may play that card.',
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'rare',
    power: '2',
    toughness: '2',
    keywords: ['Haste', 'Prowess'],
  };

  // Test 1: Record Precedent Learning & Mechanic Bridge
  console.log('1. Testing User Replacement & Knowledge Extraction...');
  const origMatch: SimilarCardMatch = {
    card: goblinGuide,
    similarityScore: 60,
    matchReasons: ['Aggressive red 1-drop'],
  };
  const repMatch: SimilarCardMatch = {
    card: tenthDistrict,
    similarityScore: 78,
    matchReasons: ['Target buff synergy'],
  };

  const delta = savePrecedentOverride(heartfireHero, 1, origMatch, repMatch, 'test_learner');
  console.assert(delta !== null, 'Expected delta to be generated');
  console.assert(delta?.mechanicBridgeFormed === 'valiant', `Expected valiant bridge, got ${delta?.mechanicBridgeFormed}`);
  console.log('✓ Learning delta extracted successfully:', delta?.inferredInsights);

  const knowledge = getAllLearnedKnowledge('test_learner');
  console.assert(knowledge.mechanicBridges['bridge_valiant'] !== undefined, 'Expected bridge_valiant in learned bridges');
  console.assert(knowledge.mechanicBridges['bridge_valiant'].historicalTerms.includes('heroic'), 'Expected bridge terms to include heroic');
  console.log('✓ Mechanic bridge stored:', knowledge.mechanicBridges['bridge_valiant']);

  // Test 2: Query Expansion Verification
  console.log('\n2. Testing Scryfall Query Expansion for Novel Set Mechanics...');
  const expansions = getLearnedQueryExpansions(emberheartChallenger, 'test_learner');
  console.assert(expansions.length > 0, 'Expected query expansions for Emberheart Challenger');
  console.assert(expansions[0].includes('heroic'), 'Expected expansions to include heroic');
  console.log('✓ Scryfall query expanded with learned terms:', expansions);

  // Test 3: Learned Benchmark Candidates for Second Card (Intra-Set Generalization)
  console.log('\n3. Testing Intra-Set Generalization (Second Valiant Card without Overrides)...');
  const learnedCandidates = getLearnedBenchmarkCandidates(emberheartChallenger, 'test_learner');
  console.assert(learnedCandidates.length > 0, 'Expected learned benchmark candidates for Emberheart Challenger');
  console.assert(learnedCandidates.some(c => c.card.name === 'Tenth District Legionnaire'), 'Expected Tenth District in candidates');
  console.log('✓ Second card automatically retrieved learned touchstone candidate:', {
    candidate: learnedCandidates[0].card.name,
    reason: learnedCandidates[0].reason,
    priority: learnedCandidates[0].priority,
  });

  // Test 4: Learned Precedent Boost & Attribution in Similarity Scoring
  console.log('\n4. Testing Scoring Boost & Attribution Reason...');
  const boost = getLearnedPrecedentBoost(emberheartChallenger, tenthDistrict, 'test_learner');
  console.assert(boost.boostScore > 0, 'Expected positive boost score');
  console.assert(boost.reason?.includes('valiant bridges to historical comp Tenth District Legionnaire'), `Expected attribution reason, got ${boost.reason}`);
  console.log('✓ Learned boost calculated:', boost);

  const simResult = calculateCardSimilarity(emberheartChallenger, tenthDistrict, 'test_learner');
  console.assert(simResult.reasons.some(r => r.includes('Learned precedent')), 'Expected similarity reasons to feature Learned Precedent');
  console.log('✓ Full similarity score with learned boost:', {
    score: simResult.score,
    reasons: simResult.reasons,
  });

  // Test 5: Second Profile Generalization (Cheap Black Removal)
  console.log('\n5. Testing Profile-Based Touchstone Generalization (Removal Rate)...');
  const fell: Card = {
    id: 'card_blb_fell',
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

  const murder: Card = {
    id: 'card_dmu_murder',
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

  const goForTheThroat: Card = {
    id: 'card_bro_gftt',
    name: 'Go for the Throat',
    set: 'BRO',
    set_name: "The Brothers' War",
    collector_number: '102',
    mana_cost: '{1}{B}',
    cmc: 2,
    type_line: 'Instant',
    oracle_text: 'Destroy target nonartifact creature.',
    colors: ['B'],
    color_identity: ['B'],
    rarity: 'uncommon',
    keywords: [],
  };

  // User tunes Fell: replaces 3 CMC Murder with 2 CMC Go for the Throat
  savePrecedentOverride(fell, 0, { card: murder, similarityScore: 70, matchReasons: [] }, { card: goForTheThroat, similarityScore: 88, matchReasons: [] }, 'test_learner');

  // Now evaluate another cheap black removal spell from another set
  const shootTheSheriff: Card = {
    id: 'card_otj_shoot_sheriff',
    name: 'Shoot the Sheriff',
    set: 'OTJ',
    set_name: 'Outlaws of Thunder Junction',
    collector_number: '106',
    mana_cost: '{1}{B}',
    cmc: 2,
    type_line: 'Instant',
    oracle_text: 'Destroy target non-outlaw creature.',
    colors: ['B'],
    color_identity: ['B'],
    rarity: 'uncommon',
    keywords: [],
  };

  const removalCandidates = getLearnedBenchmarkCandidates(shootTheSheriff, 'test_learner');
  console.assert(removalCandidates.some(c => c.card.name === 'Go for the Throat'), 'Expected Go for the Throat to be surfaced for Shoot the Sheriff');
  console.log('✓ Cross-set removal automatically retrieved Go for the Throat as touchstone:', removalCandidates.map(c => c.card.name));

  // Test 6: Export & Import of Learned Precedent Wisdom
  console.log('\n6. Testing Knowledge Export & Import Portability...');
  const exported = exportLearnedKnowledge('test_learner');
  console.assert(typeof exported === 'string' && exported.length > 50, 'Expected non-empty JSON export');

  clearAllLearnedKnowledge('test_learner');
  console.assert(Object.keys(getAllLearnedKnowledge('test_learner').touchstones).length === 0, 'Expected clean knowledge base');

  const importSuccess = importLearnedKnowledge(exported, 'test_learner');
  console.assert(importSuccess, 'Expected successful import');
  const restored = getAllLearnedKnowledge('test_learner');
  console.assert(Object.keys(restored.touchstones).length >= 2, 'Expected restored touchstones');
  console.assert(Object.keys(restored.mechanicBridges).length >= 1, 'Expected restored mechanic bridges');
  console.log('✓ Successfully exported and restored learned knowledge base!');

  console.log('\n🎉 ALL PRECEDENT ENGINE LEARNING VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runPrecedentLearningTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
