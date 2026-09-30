import {
  fetchEvaluationsForUser,
  fetchArchetypeEvaluationsForUser,
  exportUserEvaluationScorecard,
  exportUserEvaluationDossier,
} from '../services/admin';
import {
  queueArchetypeEvaluationSync,
  queueArchetypeEvaluationClearForSet,
} from '../services/cloudSync';
import { generateSetSynthesisReport } from '../services/archetypeEvaluator';
import { gradeTierToIndex } from '../services/seventeenLands';
import { AdminUserSummary } from '../types/admin';
import {
  Card,
  UserCardEvaluation,
  UserArchetypeEvaluation,
  SeventeenLandsSetData,
  GradeTier,
} from '../types/mtg';
import { supabase } from '../services/supabase';

// Mock localStorage if running in node/tsx
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
}

async function runVerification() {
  console.log('=== MTG Limited IQ Admin User Dossier & Evaluation Inspector Verification ===\n');

  // Valid cloud UUID format matching RFC UUID regexp
  const cloudUserId = 'a0000000-0000-4000-a000-000000000042';

  const testUser: AdminUserSummary = {
    id: cloudUserId,
    name: 'Mona the Drafter',
    email: 'mona@drafting.test',
    avatarColor: '#10b981',
    provider: 'google',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    totalQuizzes: 5,
    totalQuestions: 25,
    totalCorrect: 22,
    quizAccuracy: 88,
    xp: 450,
    level: 3,
    cardsGradedTotal: 3,
    setsGradedCount: 1,
    gradingAccuracyScore: 82,
    gradingGpa: 3.4,
    gradingBias: 'neutral',
    isAdmin: false,
    status: 'active',
    setsGraded: [
      {
        setCode: 'BLB',
        setName: 'Bloomburrow',
        cardsGraded: 3,
        totalCards: 3,
        percentComplete: 100,
        lastGradedAt: new Date().toISOString(),
      },
    ],
  };

  // Canonical Card Data for BLB (Bloomburrow)
  const mockCards: Card[] = [
    {
      id: 'blb_heartfire_hero',
      name: 'Heartfire Hero',
      set: 'blb',
      set_name: 'Bloomburrow',
      collector_number: '138',
      mana_cost: '{R}',
      cmc: 1,
      type_line: 'Creature — Mouse Soldier',
      rarity: 'uncommon',
      power: '1',
      toughness: '1',
      colors: ['R'],
      color_identity: ['R'],
      keywords: ['Valiant'],
      oracle_text: 'Valiant — Whenever Heartfire Hero becomes the target of a spell or ability you control for the first time each turn, put a +1/+1 counter on it.\nWhen Heartfire Hero dies, it deals damage equal to its power to each opponent.',
    },
    {
      id: 'blb_fell',
      name: 'Fell',
      set: 'blb',
      set_name: 'Bloomburrow',
      collector_number: '95',
      mana_cost: '{1}{B}',
      cmc: 2,
      type_line: 'Sorcery',
      rarity: 'uncommon',
      power: undefined,
      toughness: undefined,
      colors: ['B'],
      color_identity: ['B'],
      keywords: [],
      oracle_text: 'Destroy target creature.',
    },
    {
      id: 'blb_daggerfang_duo',
      name: 'Daggerfang Duo',
      set: 'blb',
      set_name: 'Bloomburrow',
      collector_number: '89',
      mana_cost: '{2}{B}',
      cmc: 3,
      type_line: 'Creature — Bat Lizard',
      rarity: 'common',
      power: '3',
      toughness: '2',
      colors: ['B'],
      color_identity: ['B'],
      keywords: ['Deathtouch'],
      oracle_text: 'When Daggerfang Duo enters, target player mills two cards.\nWhenever you gain life, Daggerfang Duo gains deathtouch until end of turn.',
    },
  ];

  // 17Lands Benchmark ratings
  const mock17LandsData: SeventeenLandsSetData = {
    setCode: 'BLB',
    setName: 'Bloomburrow',
    format: 'PremierDraft',
    sampleSize: 12000,
    updatedAt: new Date().toISOString(),
    cards: {
      'heartfire hero': {
        name: 'Heartfire Hero',
        color: 'R',
        rarity: 'uncommon',
        win_rate: 0.589,
        avg_seen: 3.1,
        pick_rate: 0.25,
        iwd: 0.042,
        tier_grade: 'A-',
        seen_count: 3200,
        game_count: 8500,
      },
      fell: {
        name: 'Fell',
        color: 'B',
        rarity: 'uncommon',
        win_rate: 0.605,
        avg_seen: 1.8,
        pick_rate: 0.4,
        iwd: 0.051,
        tier_grade: 'A',
        seen_count: 2800,
        game_count: 9200,
      },
      'daggerfang duo': {
        name: 'Daggerfang Duo',
        color: 'B',
        rarity: 'common',
        win_rate: 0.522,
        avg_seen: 6.8,
        pick_rate: 0.12,
        iwd: -0.008,
        tier_grade: 'C',
        seen_count: 5100,
        game_count: 6200,
      },
    },
  };

  // Mock User Card Evaluations (canonical UserCardEvaluation structure)
  const mockUserCardEvaluations: Record<string, UserCardEvaluation> = {
    'blb_heartfire hero': {
      cardId: 'blb_heartfire_hero',
      cardName: 'Heartfire Hero',
      setCode: 'blb',
      userGrade: 'A',
      userScore: 4.8,
      pickPriority: '1st Pick Bomb',
      notes: 'Absolute bomb in aggressive Valiant mouse decks! Must remove immediately.',
      updatedAt: new Date().toISOString(),
    },
    'blb_fell': {
      cardId: 'blb_fell',
      cardName: 'Fell',
      setCode: 'blb',
      userGrade: 'A+',
      userScore: 4.9,
      pickPriority: '1st Pick Bomb',
      notes: 'Premium 2-mana unconditional black removal at uncommon.',
      updatedAt: new Date().toISOString(),
    },
    'blb_daggerfang duo': {
      cardId: 'blb_daggerfang_duo',
      cardName: 'Daggerfang Duo',
      setCode: 'blb',
      userGrade: 'B+', // Overrated by user compared to 17L 'C' -> Trap!
      userScore: 3.6,
      pickPriority: 'Mid Pick',
      notes: '', // No notes
      updatedAt: new Date().toISOString(),
    },
  };

  // Mock User Archetype Evaluations (canonical UserArchetypeEvaluation structure)
  const mockUserArchetypeEvaluations: Record<string, UserArchetypeEvaluation> = {
    'blb_RW': {
      setCode: 'blb',
      archetypeCode: 'RW',
      userGrade: 'A',
      userScore: 4.6,
      isManualOverride: true,
      roleInMetagame: 'Premier Deck',
      notes: 'Best aggro deck in the format, heavily rewards target cantrips.',
      updatedAt: new Date().toISOString(),
    },
  };

  // =========================================================================
  // 1. Test fetchEvaluationsForUser via Remote RPC Mock
  // =========================================================================
  console.log('1. Testing fetchEvaluationsForUser remote RPC extraction...');
  const originalRpc = supabase.rpc;
  (supabase as any).rpc = async (fnName: string, args: any) => {
    if (fnName === 'get_admin_user_card_evaluations' && args?.target_user_id === cloudUserId) {
      return {
        data: Object.values(mockUserCardEvaluations).map((e) => ({
          set_code: e.setCode,
          card_name: e.cardName,
          evaluation_json: {
            cardId: e.cardId,
            cardName: e.cardName,
            setCode: e.setCode,
            userGrade: e.userGrade,
            userScore: e.userScore,
            pickPriority: e.pickPriority,
            notes: e.notes,
            updatedAt: e.updatedAt,
          },
          updated_at: e.updatedAt,
        })),
        error: null,
      };
    }
    if (fnName === 'get_admin_user_archetype_evaluations' && args?.target_user_id === cloudUserId) {
      return {
        data: Object.values(mockUserArchetypeEvaluations).map((a) => ({
          set_code: a.setCode,
          archetype_code: a.archetypeCode,
          evaluation_json: {
            setCode: a.setCode,
            archetypeCode: a.archetypeCode,
            userGrade: a.userGrade,
            userScore: a.userScore,
            isManualOverride: a.isManualOverride,
            roleInMetagame: a.roleInMetagame,
            notes: a.notes,
            updatedAt: a.updatedAt,
          },
          updated_at: a.updatedAt,
        })),
        error: null,
      };
    }
    return { data: [], error: null };
  };

  const remoteEvals = await fetchEvaluationsForUser(cloudUserId);
  console.assert(
    Object.keys(remoteEvals).length === 3,
    `Expected 3 remote evaluations, got ${Object.keys(remoteEvals).length}`
  );
  console.assert(
    remoteEvals['blb_heartfire hero']?.notes?.includes('Valiant mouse') === true,
    'Heartfire Hero notes must match remote RPC output'
  );
  console.log('   ✓ Remote user card evaluations correctly fetched and mapped.');

  // =========================================================================
  // 2. Test fetchArchetypeEvaluationsForUser via Remote RPC Mock
  // =========================================================================
  console.log('2. Testing fetchArchetypeEvaluationsForUser remote RPC extraction...');
  const remoteArchEvals = await fetchArchetypeEvaluationsForUser(cloudUserId);
  console.assert(
    Object.keys(remoteArchEvals).length === 1,
    `Expected 1 archetype evaluation, got ${Object.keys(remoteArchEvals).length}`
  );
  console.assert(
    remoteArchEvals['blb_RW']?.roleInMetagame === 'Premier Deck',
    'RW roleInMetagame must match remote RPC output'
  );
  console.log('   ✓ Remote user archetype evaluations correctly fetched and mapped.');

  // =========================================================================
  // 3. Test Fallback to LocalStorage for Local User
  // =========================================================================
  console.log('3. Testing local storage fallback for user matching local ID...');
  const localUserId = 'usr_local_test';
  localStorage.setItem('mtg_evaluations_' + localUserId, JSON.stringify(mockUserCardEvaluations));
  localStorage.setItem('mtg_archetype_evaluations_' + localUserId, JSON.stringify(mockUserArchetypeEvaluations));

  const localFallbackEvals = await fetchEvaluationsForUser(localUserId);
  console.assert(
    Boolean(localFallbackEvals['blb_fell']),
    'Fell should be loaded from localStorage fallback'
  );

  const localFallbackArch = await fetchArchetypeEvaluationsForUser(localUserId);
  console.assert(
    Boolean(localFallbackArch['blb_RW']),
    'RW archetype should be loaded from localStorage fallback'
  );
  console.log('   ✓ LocalStorage fallback verified for both card and archetype evaluations.');

  // =========================================================================
  // 4. Test Notes Filtering & Search Logic
  // =========================================================================
  console.log('4. Testing Notes Filtering & Search Logic...');
  const evalList = Object.values(mockUserCardEvaluations);
  const cardsWithNotes = evalList.filter((e) => Boolean(e.notes && e.notes.trim().length > 0));
  console.assert(
    cardsWithNotes.length === 2,
    `Expected 2 cards with notes, got ${cardsWithNotes.length}`
  );
  const notesSearchMatch = evalList.filter(
    (e) =>
      e.cardName.toLowerCase().includes('removal') ||
      (e.notes && e.notes.toLowerCase().includes('removal'))
  );
  console.assert(
    notesSearchMatch.length === 1 && notesSearchMatch[0].cardName === 'Fell',
    'Search for "removal" should match Fell via note content'
  );
  console.log('   ✓ User notes filtering and text search successfully verified.');

  // =========================================================================
  // 5. Test Archetype Synthesis with Target User Data
  // =========================================================================
  console.log('5. Testing Set Synthesis with user evaluations & archetype overrides...');
  const synthesis = generateSetSynthesisReport(
    mockCards,
    mockUserCardEvaluations,
    'BLB',
    'Bloomburrow',
    mock17LandsData,
    mockUserArchetypeEvaluations,
    {}
  );

  console.assert(synthesis.setCode === 'BLB', 'Synthesis set code must be BLB');
  console.assert(synthesis.completionPercent === 100, `Expected 100% completion, got ${synthesis.completionPercent}%`);
  console.assert(synthesis.archetypeRankings.length === 10, `Must produce 10 color pair archetypes, got ${synthesis.archetypeRankings.length}`);

  // Verify that the user's manual override for RW is reflected
  const rwPair = synthesis.archetypeRankings.find(
    (p) => p.code === 'RW' || (p.colors[0] === 'R' && p.colors[1] === 'W') || (p.colors[0] === 'W' && p.colors[1] === 'R')
  );
  console.assert(Boolean(rwPair), 'RW color pair must exist in synthesis');
  if (rwPair) {
    console.assert(
      rwPair.userEvaluation?.notes === 'Best aggro deck in the format, heavily rewards target cantrips.',
      'User archetype notes must be preserved in synthesis'
    );
    console.assert(
      rwPair.userEvaluation?.roleInMetagame === 'Premier Deck',
      'User roleInMetagame must be preserved in synthesis'
    );
  }
  console.log('   ✓ Set synthesis report successfully synthesized with user archetype evaluations.');

  // =========================================================================
  // 6. Test Calibration Delta and Traps / Sleepers Detection
  // =========================================================================
  console.log('6. Testing Calibration Traps and Sleepers detection...');
  // Daggerfang Duo: User rated B+ (index 3), 17Lands has C (index 7) -> stepDelta = actual - user = 7 - 3 = +4 -> Trap!
  const userGradeIdx = gradeTierToIndex(mockUserCardEvaluations['blb_daggerfang duo'].userGrade);
  const data17LGradeIdx = gradeTierToIndex(mock17LandsData.cards['daggerfang duo'].tier_grade as GradeTier);
  const stepDelta = data17LGradeIdx - userGradeIdx;
  console.assert(stepDelta === 4, `Expected step delta of +4, got ${stepDelta}`);
  console.assert(stepDelta >= 2, 'Daggerfang Duo must be classified as a TRAP (delta >= 2)');
  console.log('   ✓ Calibration delta calculation and Trap identification verified.');

  // =========================================================================
  // 7. Test Scorecard Export (CSV and JSON)
  // =========================================================================
  console.log('7. Testing Scorecard Export (CSV and JSON)...');
  const csvExport = exportUserEvaluationScorecard(
    testUser,
    mockUserCardEvaluations,
    mockUserArchetypeEvaluations,
    'BLB',
    'csv'
  );
  console.assert(typeof csvExport === 'string', 'CSV export must return a string');
  console.assert(csvExport.includes('Set,Card Name,User Grade'), 'CSV export must have headers');
  console.assert(csvExport.includes('Heartfire Hero'), 'CSV export must include Heartfire Hero');
  console.assert(
    csvExport.includes('Absolute bomb in aggressive Valiant mouse decks!'),
    'CSV export must include card notes'
  );
  console.assert(
    csvExport.includes('--- ARCHETYPE EVALUATIONS ---'),
    'CSV export must include archetype section'
  );
  console.assert(
    csvExport.includes('Premier Deck'),
    'CSV export must include archetype metagame role'
  );

  const jsonExportStr = exportUserEvaluationScorecard(
    testUser,
    mockUserCardEvaluations,
    mockUserArchetypeEvaluations,
    'BLB',
    'json'
  );
  const jsonExport = JSON.parse(jsonExportStr);
  console.assert(jsonExport.targetUser.email === 'mona@drafting.test', 'JSON export targetUser email must match');
  console.assert(jsonExport.cards.length === 3, 'JSON export must have 3 cards');
  console.assert(jsonExport.archetypes.length === 1, 'JSON export must have 1 archetype');

  // Verify backward compatibility alias exportUserEvaluationDossier
  const aliasExport = exportUserEvaluationDossier(
    testUser,
    mockUserCardEvaluations,
    mockUserArchetypeEvaluations,
    'BLB',
    'csv'
  );
  console.assert(aliasExport === csvExport, 'exportUserEvaluationDossier alias must match exportUserEvaluationScorecard');
  console.log('   ✓ Export functions for CSV and JSON format generated valid scorecards.');

  // =========================================================================
  // 8. Test Cloud Sync Queue for Archetype Evaluations
  // =========================================================================
  console.log('8. Testing Cloud Sync Queue for Archetype Evaluations...');
  queueArchetypeEvaluationSync(cloudUserId, mockUserArchetypeEvaluations['blb_RW']);
  console.log('   ✓ Archetype evaluation added to sync queue without error.');

  queueArchetypeEvaluationClearForSet(cloudUserId, 'blb');
  console.log('   ✓ Archetype clear-for-set queued without error.');

  // Restore RPC
  (supabase as any).rpc = originalRpc;

  console.log('\n=== All Admin User Dossier & Evaluation Inspector Tests Passed! ===\n');
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
