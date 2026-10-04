// Mock localStorage for Node environment
const memoryStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => (key in memoryStorage ? memoryStorage[key] : null),
  setItem: (key: string, value: string) => {
    memoryStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete memoryStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(memoryStorage)) {
      delete memoryStorage[key];
    }
  },
  get length() {
    return Object.keys(memoryStorage).length;
  },
  key: (index: number) => Object.keys(memoryStorage)[index] || null,
};

import assert from 'node:assert';
import { PRO_CREATORS, ProCreatorSource, Card } from '../types/mtg';
import { getPreferredCreators, setPreferredCreators, DEFAULT_PREFERRED_CREATORS } from '../services/storage';
import { loadProRatingsForSet, getProRatingForCard, getLsvRatingForCard } from '../services/lsvRatings';

console.log('=== MTG Pro Creators & Multi-Column Rating Verification ===\n');

// 1. Test PRO_CREATORS metadata
console.log('1. Testing PRO_CREATORS definitions:');
const expectedCreators: ProCreatorSource[] = ['LSV', 'LLU', 'DS'];
for (const c of expectedCreators) {
  assert(PRO_CREATORS[c], `PRO_CREATORS must define ${c}`);
  assert(PRO_CREATORS[c].shortName === c, `shortName must match ${c}`);
  assert(PRO_CREATORS[c].dotColor, `dotColor must be defined for ${c}`);
}
assert(PRO_CREATORS.DS.shortName === 'DS', 'Draftsim shortName must be DS');
assert(PRO_CREATORS.DS.dotColor === 'bg-sky-500', 'Draftsim dotColor must match sky blue');
assert(PRO_CREATORS.LLU.dotColor === 'bg-pink-500', 'LLU dotColor must match pink');
console.log('   ✓ PRO_CREATORS definitions verified for LSV, LLU, DS (with distinct pink and sky blue dotColors).');

// 2. Test Preferred Creators Storage
console.log('\n2. Testing preferred creator limits & sanitization in storage:');
const initial = getPreferredCreators('test-user');
assert(Array.isArray(initial), 'Initial preferred creators must be an array');
assert(initial.length <= 3, 'Initial preferred creators must not exceed 3');

// Setting 3 creators preserves all 3
const threeCreators = setPreferredCreators(['LSV', 'LLU', 'DS'], 'test-user');
assert(threeCreators.length === 3, `setPreferredCreators must support 3 creators, got ${threeCreators.length}`);
assert(threeCreators[0] === 'LSV' && threeCreators[1] === 'LLU' && threeCreators[2] === 'DS', 'Must preserve all three');

// Setting 4 creators must clamp to 3
const clamped = setPreferredCreators(['LSV', 'LLU', 'DS', 'LSV'], 'test-user');
assert(clamped.length === 3, `setPreferredCreators must clamp to 3 creators, got ${clamped.length}`);

// Legacy LOL sanitization: Setting ['LOL'] in storage maps to ['DS']
localStorage.setItem('mtg_preferred_creators_test-user', JSON.stringify(['LOL']));
const sanitized = getPreferredCreators('test-user');
assert(sanitized.includes('DS'), 'Legacy LOL in storage must automatically sanitize to DS');
assert(!sanitized.includes('LOL' as any), 'Legacy LOL must not be present');

// Reset to default
setPreferredCreators(DEFAULT_PREFERRED_CREATORS, 'test-user');
console.log('   ✓ Storage supports all 3 creators, sanitizes legacy LOL to DS, and limits to maximum 3.');

// 3. Test Pro Ratings Loading & Resolution for FRA & BLB (LLU, LSV, DS)
console.log('\n3. Testing pro ratings retrieval:');
async function testRatings() {
  await loadProRatingsForSet('FRA');

  const mockCard: Card = {
    id: 'mock-graft-surgeon',
    name: 'Graft Surgeon',
    set: 'FRA',
    set_name: 'Reality Fracture',
    collector_number: '10',
    cmc: 3,
    type_line: 'Creature — Cleric Human',
    colors: ['W'],
    color_identity: ['W'],
    rarity: 'common',
    keywords: [],
  };

  const lluRating = getProRatingForCard(mockCard, 'LLU', 'FRA');
  console.log('   LLU rating for Graft Surgeon:', lluRating);
  assert(lluRating !== null, 'LLU rating for Graft Surgeon in FRA must be populated');
  assert(lluRating.grade === 'D', `LLU grade for Graft Surgeon should be D, got ${lluRating.grade}`);

  const lsvRating = getLsvRatingForCard(mockCard, 'FRA');
  console.log('   LSV rating for Graft Surgeon:', lsvRating);
  assert(lsvRating !== null, 'LSV rating for Graft Surgeon must be eligible or populated');

  const dsRating = getProRatingForCard(mockCard, 'DS', 'FRA');
  console.log('   DS rating for Graft Surgeon:', dsRating);
  assert(dsRating !== null, 'DS rating for Graft Surgeon in FRA must be populated');
  assert(dsRating.score === 1.5, `DS score for Graft Surgeon should be 1.5, got ${dsRating.score}`);

  console.log('   ✓ Pro ratings query verified across creators (LLU, LSV, DS).');

  // Test DS on BLB
  await loadProRatingsForSet('BLB');
  const mockHeartfire: Card = {
    id: 'mock-heartfire-hero',
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
  };
  const dsHeartfire = getProRatingForCard(mockHeartfire, 'DS', 'BLB');
  console.log('   DS rating for Heartfire Hero:', dsHeartfire);
  assert(dsHeartfire !== null, 'DS rating for Heartfire Hero in BLB must be populated');
  assert(dsHeartfire.score === 3.5, `DS score for Heartfire Hero should be 3.5, got ${dsHeartfire.score}`);
  console.log('   ✓ DS pro ratings query verified for BLB.');

  // Test live LSV rating on BLB (Kastral)
  const mockKastral: Card = {
    id: 'mock-kastral',
    name: 'Kastral, the Windcrested',
    set: 'BLB',
    set_name: 'Bloomburrow',
    collector_number: '219',
    cmc: 5,
    type_line: 'Legendary Creature — Bird Soldier',
    colors: ['W', 'U'],
    color_identity: ['W', 'U'],
    rarity: 'rare',
    keywords: ['Flying'],
  };
  const lsvKastral = getProRatingForCard(mockKastral, 'LSV', 'BLB');
  console.log('   LSV rating for Kastral, the Windcrested:', lsvKastral);
  assert(lsvKastral !== null, 'LSV rating for Kastral must be populated');
  assert(lsvKastral.score === 4.5, `LSV score for Kastral should be 4.5, got ${lsvKastral.score}`);
  assert(lsvKastral.isEstimated === false, 'LSV rating must be authentic (not estimated)');
  console.log('   ✓ LSV live pro ratings query verified for BLB with authentic 4.5 grade.');
}

testRatings().then(() => {
  console.log('\n🎉 ALL PRO CREATOR TESTS PASSED SUCCESSFULLY!');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
