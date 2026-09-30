import assert from 'assert';
import { POPULAR_LIMITED_SETS, compute17LandsAvailableDate, computeArenaReleaseDate } from '../services/scryfall';
import { canQuery17Lands, get17LandsQueryStatus, isSetUnderTwoWeeksOld } from '../services/seventeenLands';
import { isLsvRatingEligible, getLsvRatingForCard } from '../services/lsvRatings';
import { Card } from '../types/mtg';

console.log('=== MTG Set Release Schedule & Rating Eligibility Verification ===\n');

// Test 1: Date helper computations
console.log('1. Testing compute17LandsAvailableDate & computeArenaReleaseDate:');
const arenaDate = '2026-09-29';
const expected17LDate = '2026-10-13';
assert.strictEqual(compute17LandsAvailableDate(arenaDate), expected17LDate, '17Lands date must be exactly 14 days after Arena release');

const tabletopFriday = '2026-10-02';
const derivedArenaTuesday = computeArenaReleaseDate(tabletopFriday);
assert.strictEqual(derivedArenaTuesday, '2026-09-29', 'Arena Tuesday must be 3 days prior to tabletop Friday');
console.log('   ✓ Date calculations verified (+14 days for 17Lands, -3 days for Arena Tuesday).\n');

// Test 2: Set Release Metadata in POPULAR_LIMITED_SETS
console.log('2. Testing release schedule presence in POPULAR_LIMITED_SETS:');
const fra = POPULAR_LIMITED_SETS.find(s => s.code === 'FRA');
assert(fra, 'FRA must exist in catalog');
assert.strictEqual(fra.released_at, '2026-10-02', 'FRA tabletop release must be 2026-10-02');
assert.strictEqual(fra.arena_released_at, '2026-09-29', 'FRA Arena release must be 2026-09-29');
assert.strictEqual(fra.lsv_available_at, '2026-09-25', 'FRA LSV review date must be 2026-09-25');
assert.strictEqual(fra.seventeen_lands_available_at, '2026-10-13', 'FRA 17Lands date must be 2026-10-13 (2 weeks post-Arena)');
console.log('   ✓ FRA release schedule verified: Tabletop Oct 2, Arena Sep 29, LSV Sep 25, 17Lands Oct 13.\n');

// Test 3: LSV rating check eligibility for FRA
console.log('3. Testing LSV rating check eligibility:');
// As of current date 2026-09-28, FRA LSV date (2026-09-25) has arrived!
const fraLsvEligible = isLsvRatingEligible('FRA');
assert.strictEqual(fraLsvEligible, true, 'FRA LSV ratings must be eligible to check');

const mockFraCard: Card = {
  id: 'fra-1',
  name: 'Gideon\'s Memorial',
  set: 'FRA',
  set_name: 'Reality Fracture',
  collector_number: '1',
  cmc: 2,
  type_line: 'Legendary Artifact',
  colors: ['W'],
  color_identity: ['W'],
  rarity: 'rare',
  keywords: [],
};

const lsvRating = getLsvRatingForCard(mockFraCard, 'FRA');
assert(lsvRating !== null, 'getLsvRatingForCard for FRA must no longer be blocked by hardcoded unreleasedSets');
console.log(`   ✓ FRA card LSV rating checked successfully: Grade ${lsvRating?.grade} (${lsvRating?.score})`);

// Far-future set TRK (Star Trek) whose review date is 2026-10-24
const trkLsvEligible = isLsvRatingEligible('TRK');
assert.strictEqual(trkLsvEligible, false, 'TRK LSV reviews must not be eligible yet (scheduled for 2026-10-24)');
console.log('   ✓ Future unreviewed set (TRK) properly locked until lsv_available_at.\n');

// Test 4: 17Lands Query Eligibility (2 weeks post-Arena release)
console.log('4. Testing 17Lands 2-week post-Arena query gate:');
// As of 2026-09-28, FRA 17Lands available date is 2026-10-13, so querying is locked
const fra17LCanQuery = canQuery17Lands('FRA');
assert.strictEqual(fra17LCanQuery, false, 'FRA 17Lands querying must be false before 2026-10-13');

const fraStatus = get17LandsQueryStatus('FRA');
assert.strictEqual(fraStatus.isEligible, false);
assert.strictEqual(fraStatus.availableDateStr, '2026-10-13');
assert(fraStatus.daysRemaining > 0, 'Must report days remaining until query unlock');
console.log(`   ✓ FRA 17Lands query locked: unlocks on ${fraStatus.availableDateStr} (${fraStatus.daysRemaining} days remaining)`);

// Released sets (HOB, SOS, BLB) must be queryable
assert.strictEqual(canQuery17Lands('HOB'), true, 'HOB must be 17Lands queryable');
assert.strictEqual(canQuery17Lands('SOS'), true, 'SOS must be 17Lands queryable');
assert.strictEqual(canQuery17Lands('BLB'), true, 'BLB must be 17Lands queryable');
console.log('   ✓ Mature / released sets verified queryable on 17Lands.\n');

console.log('🎉 ALL RELEASE SCHEDULE & RATING ELIGIBILITY TESTS PASSED!');
