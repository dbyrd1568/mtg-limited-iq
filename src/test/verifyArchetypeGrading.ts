// Mock localStorage for Node environment before importing storage
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

import { POPULAR_LIMITED_SETS } from '../services/scryfall';
import { getWOTCArchetypeInfo, getWOTCArchetypesForSet, getDevelopedArchetypeCodes } from '../services/wotcArchetypes';
import {
  saveUserArchetypeEvaluation,
  loadUserArchetypeEvaluations,
  deleteUserArchetypeEvaluation,
  clearUserArchetypeEvaluationsForSet,
  saveUserColorEvaluation,
  loadUserColorEvaluations,
  clearUserColorEvaluationsForSet,
  exportUserDataAsJSON,
  importUserDataFromJSON,
} from '../services/storage';
import { generateSetSynthesisReport } from '../services/archetypeEvaluator';
import { Card, UserCardEvaluation, UserArchetypeEvaluation, UserColorEvaluation } from '../types/mtg';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

console.log('=== STARTING ARCHETYPE & COLOR GRADING VERIFICATION TESTS ===\n');

// -------------------------------------------------------------
// Test 1: Comprehensive WOTC Archetype Catalog Coverage
// -------------------------------------------------------------
console.log('Test 1: Verifying WOTC Archetype Descriptions for Key Sets...');

const testSets = ['DFT', 'HOB', 'MBC', 'FRA', 'MID', 'SNC', 'KTK', 'DOM', 'WAR', 'ELD', 'BLB', 'MH3'];

for (const setCode of testSets) {
  const archetypes = getWOTCArchetypesForSet(setCode, []);
  assert(Array.isArray(archetypes), `Set ${setCode} should return an array of archetypes`);
  assert(archetypes.length >= 5, `Set ${setCode} should have at least 5 defined archetypes (found ${archetypes.length})`);

  for (const arch of archetypes) {
    assert(Boolean(arch.code), `Archetype in ${setCode} must have a code`);
    assert(Boolean(arch.name), `Archetype ${setCode} ${arch.code} must have a name`);
    assert(Boolean(arch.headline), `Archetype ${setCode} ${arch.code} must have a headline`);
    assert(Boolean(arch.description) && arch.description.length > 20, `Archetype ${setCode} ${arch.code} must have an official strategy description`);
    assert(Array.isArray(arch.mechanics) && arch.mechanics.length > 0, `Archetype ${setCode} ${arch.code} must have mechanics tags`);
  }
}

// Check Mystery Booster Commander (MBC) specifically
const mbcGW = getWOTCArchetypeInfo('MBC', 'GW');
assert(mbcGW.headline.includes('+1/+1 Counters') || mbcGW.headline.includes('Tokens'), `MBC GW should reflect tokens/counters`);
assert(mbcGW.description.length > 20, 'MBC GW should have rich strategy description');

// Check Reality Fracture (FRA) specifically
const fraUR = getWOTCArchetypeInfo('FRA', 'UR');
assert(fraUR.headline.length > 0 && fraUR.description.length > 20, 'FRA UR should have rich strategy description');

console.log('   ✓ Verified authentic WOTC archetype descriptions, headlines, and mechanics for test sets.');

// -------------------------------------------------------------
// Test 2: User Archetype Evaluation CRUD
// -------------------------------------------------------------
console.log('\nTest 2: Verifying Archetype Evaluation Storage CRUD...');

const testUser = 'tester_123';

const wuEval: UserArchetypeEvaluation = {
  setCode: 'DFT',
  archetypeCode: 'WU',
  userGrade: 'A-',
  userScore: 4.3,
  isManualOverride: true,
  roleInMetagame: 'Premier Deck',
  notes: 'High synergy with vehicle tokens and aerodynamic creatures.',
  updatedAt: new Date().toISOString(),
};

saveUserArchetypeEvaluation(wuEval, testUser);

let userArchEvals = loadUserArchetypeEvaluations(testUser);
assert(Boolean(userArchEvals['dft_WU']), 'WU evaluation must exist under key dft_WU');
assert(userArchEvals['dft_WU'].userGrade === 'A-', 'User grade must be A-');
assert(userArchEvals['dft_WU'].userScore === 4.3, 'User score must be 4.3');
assert(userArchEvals['dft_WU'].roleInMetagame === 'Premier Deck', 'Role must be Premier Deck');
assert(userArchEvals['dft_WU'].notes === 'High synergy with vehicle tokens and aerodynamic creatures.', 'Notes must match');

// Save a second archetype for another set
const midUB: UserArchetypeEvaluation = {
  setCode: 'MID',
  archetypeCode: 'UB',
  userGrade: 'A+',
  userScore: 5.0,
  isManualOverride: true,
  roleInMetagame: 'Premier Deck',
  notes: 'Zombies decayed sacrifice engine is Tier 0 in MID limited.',
  updatedAt: new Date().toISOString(),
};
saveUserArchetypeEvaluation(midUB, testUser);

userArchEvals = loadUserArchetypeEvaluations(testUser);
assert(Boolean(userArchEvals['mid_UB']), 'MID UB must exist');
assert(Object.keys(userArchEvals).length === 2, 'Total saved archetype evaluations should be 2');

// Test single archetype delete (Reset to Auto)
deleteUserArchetypeEvaluation('MID', 'UB', testUser);
userArchEvals = loadUserArchetypeEvaluations(testUser);
assert(!userArchEvals['mid_UB'], 'MID UB should have been individually deleted by deleteUserArchetypeEvaluation');
assert(Boolean(userArchEvals['dft_WU']), 'DFT WU should still exist after deleting MID UB');

// Re-save MID UB for clear test
saveUserArchetypeEvaluation(midUB, testUser);

// Test clear for DFT
clearUserArchetypeEvaluationsForSet('DFT', testUser);
userArchEvals = loadUserArchetypeEvaluations(testUser);
assert(!userArchEvals['dft_WU'], 'DFT WU should have been cleared');
assert(Boolean(userArchEvals['mid_UB']), 'MID UB should still exist after clearing DFT');

console.log('   ✓ Archetype evaluation save, retrieve, single delete (Reset to Auto), and set-scoped clear verified.');

// -------------------------------------------------------------
// Test 3: User Color Evaluation CRUD
// -------------------------------------------------------------
console.log('\nTest 3: Verifying Monocolor Evaluation Storage CRUD...');

const wEval: UserColorEvaluation = {
  setCode: 'DFT',
  color: 'W',
  userGrade: 'B+',
  userScore: 4.0,
  notes: 'White has exceptional 2-drops and cheap interaction.',
  updatedAt: new Date().toISOString(),
};

saveUserColorEvaluation(wEval, testUser);

let userColorEvals = loadUserColorEvaluations(testUser);
assert(Boolean(userColorEvals['dft_W']), 'Color evaluation must exist under key dft_W');
assert(userColorEvals['dft_W'].userGrade === 'B+', 'User color grade must be B+');
assert(userColorEvals['dft_W'].userScore === 4.0, 'User color score must be 4.0');
assert(Boolean(userColorEvals['dft_W'].notes?.includes('exceptional 2-drops')), 'Color notes must match');

// Save color for another set
const midB: UserColorEvaluation = {
  setCode: 'MID',
  color: 'B',
  userGrade: 'A+',
  userScore: 5.0,
  notes: 'Black is the best color in MID by far.',
  updatedAt: new Date().toISOString(),
};
saveUserColorEvaluation(midB, testUser);

userColorEvals = loadUserColorEvaluations(testUser);
assert(Object.keys(userColorEvals).length === 2, 'Total saved color evaluations should be 2');

// Clear DFT colors
clearUserColorEvaluationsForSet('DFT', testUser);
userColorEvals = loadUserColorEvaluations(testUser);
assert(!userColorEvals['dft_W'], 'DFT W color should be cleared');
assert(Boolean(userColorEvals['mid_B']), 'MID B color should be preserved');

console.log('   ✓ Monocolor evaluation save, retrieve, and set-scoped clear verified.');

// -------------------------------------------------------------
// Test 4: Set Synthesis Report with User Archetype & Color Evaluations
// -------------------------------------------------------------
console.log('\nTest 4: Verifying Set Synthesis Report Integration...');

const mockCards: Card[] = [
  {
    id: 'c1',
    name: 'Aethertide Raider',
    set: 'dft',
    set_name: 'Aetherdrift',
    collector_number: '1',
    cmc: 2,
    colors: ['W', 'U'],
    color_identity: ['W', 'U'],
    rarity: 'uncommon',
    type_line: 'Creature — Human Pilot',
    keywords: [],
  },
  {
    id: 'c2',
    name: 'Skystreak Ace',
    set: 'dft',
    set_name: 'Aetherdrift',
    collector_number: '2',
    cmc: 2,
    colors: ['W'],
    color_identity: ['W'],
    rarity: 'common',
    type_line: 'Creature — Pilot',
    keywords: [],
  },
  {
    id: 'c3',
    name: 'Velocity Surge',
    set: 'dft',
    set_name: 'Aetherdrift',
    collector_number: '3',
    cmc: 1,
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'common',
    type_line: 'Instant',
    keywords: [],
  },
];

const mockCardEvals: Record<string, UserCardEvaluation> = {
  dft_aethertide_raider: {
    cardId: 'c1',
    cardName: 'Aethertide Raider',
    setCode: 'DFT',
    userGrade: 'B+',
    userScore: 4.0,
    pickPriority: 'Early Pick',
    updatedAt: new Date().toISOString(),
  },
  dft_skystreak_ace: {
    cardId: 'c2',
    cardName: 'Skystreak Ace',
    setCode: 'DFT',
    userGrade: 'B',
    userScore: 3.7,
    pickPriority: 'Mid Pick',
    updatedAt: new Date().toISOString(),
  },
};

const mockArchEvals: Record<string, UserArchetypeEvaluation> = {
  dft_WU: {
    setCode: 'DFT',
    archetypeCode: 'WU',
    userGrade: 'A',
    userScore: 4.7,
    isManualOverride: true,
    roleInMetagame: 'Premier Deck',
    notes: 'Premier archetype',
    updatedAt: new Date().toISOString(),
  },
};

const mockColorEvals: Record<string, UserColorEvaluation> = {
  dft_W: {
    setCode: 'DFT',
    color: 'W',
    userGrade: 'A-',
    userScore: 4.3,
    notes: 'Great depth',
    updatedAt: new Date().toISOString(),
  },
};

const report = generateSetSynthesisReport(
  mockCards,
  mockCardEvals,
  'DFT',
  'Aetherdrift',
  null,
  mockArchEvals,
  mockColorEvals
);

const wuArch = report.archetypeRankings.find((a) => a.code === 'WU');
assert(Boolean(wuArch), 'WU archetype must be in report');
assert(Boolean(wuArch?.userEvaluation), 'WU archetype must have userEvaluation attached');
assert(wuArch?.userEvaluation?.userGrade === 'A', 'Attached userGrade must be A');
assert(wuArch?.userEvaluation?.roleInMetagame === 'Premier Deck', 'Attached role must be Premier Deck');
assert(wuArch?.letterGrade === 'A', 'Effective letterGrade must be overridden to A');
assert(wuArch?.isOverridden === true, 'WU archetype must be marked as overridden');
assert(wuArch?.gradeBand === 'A', 'WU archetype grade band must be A');
assert(Boolean(report.gradeList.A), 'report.gradeList must contain grade band A');
assert(Boolean(report.developedGradeList.A), 'report.developedGradeList must contain grade band A');

const wColor = report.colorRankings.find((c) => c.color === 'W');
assert(Boolean(wColor), 'W color must be in report');
assert(Boolean(wColor?.userEvaluation), 'W color must have userEvaluation attached');
assert(wColor?.userEvaluation?.userGrade === 'A-', 'Attached user color grade must be A-');

console.log('   ✓ SetSynthesisReport correctly integrates user archetype and color evaluations.');

// -------------------------------------------------------------
// Test 5: Export / Import JSON Round-Trip
// -------------------------------------------------------------
console.log('\nTest 5: Verifying Backup Export and Import Round-Trip...');

// Save items in storage
saveUserArchetypeEvaluation(
  {
    setCode: 'BLB',
    archetypeCode: 'GW',
    userGrade: 'A-',
    userScore: 4.3,
    isManualOverride: true,
    roleInMetagame: 'Solid Contender',
    notes: 'Rabbits token swarm',
    updatedAt: new Date().toISOString(),
  },
  testUser
);

saveUserColorEvaluation(
  {
    setCode: 'BLB',
    color: 'G',
    userGrade: 'B',
    userScore: 3.7,
    notes: 'Solid green beef and ramp',
    updatedAt: new Date().toISOString(),
  },
  testUser
);

// Export JSON
const exportedJsonString = exportUserDataAsJSON(testUser);
const parsedExport = JSON.parse(exportedJsonString);

assert(parsedExport.version === '2.1', `Export version must be 2.1, got ${parsedExport.version}`);
assert(Boolean(parsedExport.archetypeEvaluations), 'Export must contain archetypeEvaluations');
assert(Boolean(parsedExport.archetypeEvaluations['blb_GW']), 'Export must contain blb_GW');
assert(Boolean(parsedExport.colorEvaluations), 'Export must contain colorEvaluations');
assert(Boolean(parsedExport.colorEvaluations['blb_G']), 'Export must contain blb_G');

// Clear storage for tester
(global as any).localStorage.clear();
assert(Object.keys(loadUserArchetypeEvaluations(testUser)).length === 0, 'Storage must be empty');

// Import JSON
const importResult = importUserDataFromJSON(exportedJsonString, testUser);
assert(importResult === true, `Import must return true`);

const restoredArch = loadUserArchetypeEvaluations(testUser);
assert(Boolean(restoredArch['blb_GW']), 'Restored archetype blb_GW must exist');
assert(restoredArch['blb_GW'].userGrade === 'A-', 'Restored grade must match A-');
assert(restoredArch['blb_GW'].roleInMetagame === 'Solid Contender', 'Restored role must match');

const restoredColor = loadUserColorEvaluations(testUser);
assert(Boolean(restoredColor['blb_G']), 'Restored color blb_G must exist');
assert(restoredColor['blb_G'].userGrade === 'B', 'Restored color grade must match B');

console.log('   ✓ Export/Import JSON (v2.1) successfully preserves all archetype and color evaluations.');

console.log('\n🎉 ALL ARCHETYPE & COLOR GRADING VERIFICATION TESTS PASSED!');
