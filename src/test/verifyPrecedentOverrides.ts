import { Card } from '../types/mtg';
import {
  getTargetCardKey,
  savePrecedentOverride,
  getTargetCardOverrides,
  removePrecedentOverride,
  clearTargetCardOverrides,
} from '../services/precedentOverrides';
import {
  calculateCardSimilarity,
  buildCustomPrecedentMatch,
  calculateHistoricalConsensus,
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

async function runPrecedentOverridesTests() {
  console.log('=== Precedent Engine Overrides & Search Verification ===\n');

  // Sample Target Card (Fell from Bloomburrow - 2 mana black sorcery removal)
  const fell: Card = {
    id: 'card_blb_fell_01',
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

  // Sample Candidate 1 (Murder from DMU - 3 mana instant removal)
  const murder: Card = {
    id: 'card_dmu_murder_01',
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

  // Sample Candidate 2 (Hero's Downfall from VOW - 3 mana instant removal)
  const herosDownfall: Card = {
    id: 'card_vow_downfall_01',
    name: "Hero's Downfall",
    set: 'VOW',
    set_name: 'Innistrad: Crimson Vow',
    collector_number: '120',
    mana_cost: '{1}{B}{B}',
    cmc: 3,
    type_line: 'Instant',
    oracle_text: 'Destroy target creature or planeswalker.',
    colors: ['B'],
    color_identity: ['B'],
    rarity: 'uncommon',
    keywords: [],
  };

  // Test 1: Target Card Key Generation
  console.log('1. Testing Target Card Key Normalization...');
  const key = getTargetCardKey(fell);
  console.assert(key === 'BLB_fell', `Expected BLB_fell, got ${key}`);
  console.log('✓ Target card key correctly generated:', key);

  // Test 2: Dynamic Similarity Calculation for Replacement Card
  console.log('\n2. Testing Replacement Card Similarity & Precedent Match Building...');
  const { score, reasons } = calculateCardSimilarity(fell, murder);
  console.assert(score > 70, `Expected high similarity between Fell and Murder, got ${score}%`);
  console.log(`✓ Fell vs Murder similarity score: ${score}%, Reasons:`, reasons);

  const customMatch = await buildCustomPrecedentMatch(fell, murder);
  console.assert(customMatch.card.name === 'Murder', 'Expected Murder card object');
  console.assert(customMatch.similarityScore === score, 'Expected matching similarity score');
  console.assert(customMatch.isCustomOverride === true, 'Expected isCustomOverride flag');
  console.log('✓ Custom precedent match successfully constructed with score & tier:', {
    name: customMatch.card.name,
    score: customMatch.similarityScore,
    tierGrade: customMatch.tierGrade,
    winRate: customMatch.winRate,
  });

  // Test 3: Save and Retrieve Precedent Slot Override
  console.log('\n3. Testing Precedent Slot Override Storage & Retrieval...');
  clearTargetCardOverrides(fell, 'test_user');
  let overrides = getTargetCardOverrides(fell, 'test_user');
  console.assert(Object.keys(overrides).length === 0, 'Expected no overrides initially');

  const originalMatch: SimilarCardMatch = {
    card: herosDownfall,
    similarityScore: 78,
    matchReasons: ['Both creature removal'],
    tierGrade: 'B',
    winRate: 0.57,
  };

  // Save Murder into Slot 1 (replacing Hero's Downfall)
  savePrecedentOverride(fell, 1, originalMatch, customMatch, 'test_user');
  overrides = getTargetCardOverrides(fell, 'test_user');

  console.assert(overrides[1] !== undefined, 'Expected slot 1 override to exist');
  console.assert(overrides[1].originalCardName === "Hero's Downfall", "Expected original card name to be recorded");
  console.assert(overrides[1].replacementMatch.card.name === 'Murder', 'Expected replacement card to be Murder');
  console.assert(overrides[1].replacementMatch.isCustomOverride === true, 'Expected custom override flag to persist');
  console.log('✓ Slot 1 override verified:', {
    slot: overrides[1].slotIndex,
    replaced: overrides[1].originalCardName,
    replacement: overrides[1].replacementMatch.card.name,
  });

  // Test 4: Historical Consensus Recalculation with Custom Overrides
  console.log('\n4. Testing Consensus Dynamic Update with Replaced Card...');
  const baseMatches: SimilarCardMatch[] = [
    { card: fell, similarityScore: 100, matchReasons: ['Target'], tierGrade: 'B+', winRate: 0.58 },
    originalMatch,
  ];
  const consensusBefore = calculateHistoricalConsensus(baseMatches, fell);

  const updatedMatches: SimilarCardMatch[] = [
    baseMatches[0],
    overrides[1].replacementMatch, // Replaced slot 1 with Murder
  ];
  const consensusAfter = calculateHistoricalConsensus(updatedMatches, fell);

  console.assert(consensusAfter.sampleCount === 2, 'Expected sample count of 2');
  console.log('✓ Consensus before replacement:', {
    projectedTier: consensusBefore.projectedTier,
    avgWinRate: consensusBefore.averageWinRate,
  });
  console.log('✓ Consensus after replacement:', {
    projectedTier: consensusAfter.projectedTier,
    avgWinRate: consensusAfter.averageWinRate,
  });

  // Test 5: Revert Individual Slot Override
  console.log('\n5. Testing Reversion of Specific Slot Override...');
  removePrecedentOverride(fell, 1, 'test_user');
  overrides = getTargetCardOverrides(fell, 'test_user');
  console.assert(overrides[1] === undefined, 'Expected slot 1 override to be cleared after removal');
  console.log('✓ Slot 1 successfully reverted to default.');

  // Test 6: Clear All Target Card Overrides
  console.log('\n6. Testing Clear All Overrides for Target Card...');
  savePrecedentOverride(fell, 0, null, customMatch, 'test_user');
  savePrecedentOverride(fell, 2, null, customMatch, 'test_user');
  console.assert(Object.keys(getTargetCardOverrides(fell, 'test_user')).length === 2, 'Expected 2 overrides saved');

  clearTargetCardOverrides(fell, 'test_user');
  console.assert(Object.keys(getTargetCardOverrides(fell, 'test_user')).length === 0, 'Expected 0 overrides after clear');
  console.log('✓ All slot overrides successfully cleared.');

  console.log('\n🎉 ALL PRECEDENT ENGINE OVERRIDE TESTS PASSED SUCCESSFULLY!');
}

runPrecedentOverridesTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
