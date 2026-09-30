import { generate17LandsTiersCsv, generate17LandsAutoImportBookmarklet, generate17LandsConsoleScript } from '../services/gradeExport';
import { Card, UserCardEvaluation } from '../types/mtg';

console.log('=== Verifying 17Lands Tier Export & Auto-Import Tooling ===\n');

const mockCards: Card[] = [
  {
    id: 'c1',
    name: 'Virtue of Loyalty // Ardenvale Fealty',
    set: 'woe',
    collector_number: '1',
    mana_cost: '{3}{W}{W}',
    cmc: 5,
    colors: ['W'],
    type_line: 'Enchantment // Instant - Adventure',
    rarity: 'mythic',
  } as any,
  {
    id: 'c2',
    name: 'Plains',
    set: 'woe',
    collector_number: '260',
    mana_cost: '',
    cmc: 0,
    colors: [],
    type_line: 'Basic Land - Plains',
    rarity: 'common',
  } as any,
  {
    id: 'c3',
    name: 'Heartfire Hero',
    set: 'blb',
    collector_number: '138',
    mana_cost: '{R}',
    cmc: 1,
    colors: ['R'],
    type_line: 'Creature - Mouse Soldier',
    rarity: 'uncommon',
  } as any,
];

const mockEvals: Record<string, UserCardEvaluation> = {
  'woe_virtue of loyalty // ardenvale fealty': {
    userGrade: 'A',
    archetypeRole: 'buildaround bomb',
    notes: 'First pick windmill slam',
  } as any,
  'woe_plains': {
    userGrade: 'N/A',
  } as any,
  'blb_heartfire hero': {
    userGrade: 'B+',
    is_synergy: true,
  } as any,
};

const csv = generate17LandsTiersCsv(mockCards, mockEvals);

// 1. DFC front face name mapping
if (!csv.includes('Virtue of Loyalty,A,1,0,First pick windmill slam')) {
  throw new Error('Failed: Front-face name stripping or grade mapping failed');
}

// 2. N/A to SB mapping for 17Lands compatibility
if (!csv.includes('Plains,SB,0,0,')) {
  throw new Error('Failed: N/A mapping to SB failed');
}

// 3. Normal grading
if (!csv.includes('Heartfire Hero,B+,0,0,')) {
  throw new Error('Failed: Standard card grade failed');
}

// 4. Bookmarklet generation
const bm = generate17LandsAutoImportBookmarklet(csv);
if (!bm.startsWith('javascript:')) throw new Error('Invalid bookmarklet scheme');

// 5. Console script generation
const cs = generate17LandsConsoleScript(csv);
new Function(cs); // Validates JavaScript syntax

console.log('✓ Front-face DFC card name resolution verified.');
console.log('✓ Land N/A -> SB safe mapping verified.');
console.log('✓ 1-Click Bookmarklet generator verified.');
console.log('✓ 1-Click Console script generator verified.');
console.log('\n🎉 ALL 17LANDS TIER EXPORT TESTS PASSED!\n');
