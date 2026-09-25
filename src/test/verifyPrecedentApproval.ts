import { Card, UserAccount } from '../types/mtg';
import {
  buildCardSnapshot,
  submitPrecedentProposal,
  fetchPrecedentProposals,
  approvePrecedentProposal,
  rejectPrecedentProposal,
  getStoredCanonicalPrecedents,
  exportCanonicalCompsJSON,
  getTargetCardKey,
} from '../services/precedentApprovalService';
import {
  calculateCardSimilarity,
  buildCustomPrecedentMatch,
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

async function runPrecedentApprovalTests() {
  console.log('=== Precedent Approval Workflow & Canonical Engine Verification ===\n');

  // Test admin and user accounts
  const regularUser: UserAccount = {
    id: 'user_drafter_42',
    name: 'Pro Drafter Alex',
    email: 'alex@example.com',
    avatarColor: 'indigo',
    provider: 'local',
    isAdmin: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const adminUser: UserAccount = {
    id: 'admin_master_01',
    name: 'Lead Admin Sarah',
    email: 'admin@limited-iq.test',
    avatarColor: 'emerald',
    provider: 'local',
    isAdmin: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  // Sample cards
  const targetCard: Card = {
    id: 'target_sos_spectral_censor',
    name: 'Spectral Censor',
    set: 'SOS',
    set_name: 'Secrets of Strixhaven',
    collector_number: '55',
    mana_cost: '{1}{U}{U}',
    cmc: 3,
    type_line: 'Creature — Spirit Wizard',
    oracle_text: 'Flash\nFlying\nWhen Spectral Censor enters the battlefield, counter target noncreature spell unless its controller pays {2}.',
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'uncommon',
    power: '2',
    toughness: '1',
    keywords: ['Flash', 'Flying'],
  };

  const originalCompCard: Card = {
    id: 'comp_blb_pondering_mage',
    name: 'Mind Spiral',
    set: 'LCI',
    set_name: 'The Lost Caverns of Ixalan',
    collector_number: '64',
    mana_cost: '{3}{U}{U}',
    cmc: 5,
    type_line: 'Instant',
    oracle_text: 'Tap up to two target creatures. Put a stun counter on each of them. Draw three cards.',
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'uncommon',
    keywords: [],
  };

  const replacementCompCard: Card = {
    id: 'comp_stx_test_of_talents',
    name: 'Mage\'s Attendant',
    set: 'SNC',
    set_name: 'Streets of New Capenna',
    collector_number: '21',
    mana_cost: '{1}{W}{U}',
    cmc: 3,
    type_line: 'Creature — Cat Wizard',
    oracle_text: 'When Mage\'s Attendant enters the battlefield, create a 1/1 blue Wizard creature token with "Tap, Sacrifice this creature: Counter target noncreature spell unless its controller pays {1}."',
    colors: ['W', 'U'],
    color_identity: ['W', 'U'],
    rarity: 'uncommon',
    power: '3',
    toughness: '2',
    keywords: [],
  };

  // Test 1: Snapshot generation
  console.log('Test 1: Card Snapshot Generation');
  const snapTarget = buildCardSnapshot(targetCard);
  if (!snapTarget.oracleText || snapTarget.cmc !== 3 || snapTarget.set !== 'SOS') {
    throw new Error(`Test 1 Failed: Snapshot missing vital data: ${JSON.stringify(snapTarget)}`);
  }
  console.log('✓ Snapshot captured full oracle text, mana cost, and set details successfully.');

  // Test 2: Submitting a proposal
  console.log('\nTest 2: User Comp Swap Proposal Submission');
  const origMatch: SimilarCardMatch = {
    card: originalCompCard,
    similarityScore: 62,
    matchReasons: ['Similar blue instant role'],
  };
  const repMatch = await buildCustomPrecedentMatch(targetCard, replacementCompCard);

  const proposal = await submitPrecedentProposal(
    targetCard,
    1,
    origMatch,
    repMatch,
    ['User prioritized spell-taxing creature body over draw spell'],
    'soft_counter_creature',
    regularUser
  );

  if (!proposal.id || proposal.status !== 'pending') {
    throw new Error(`Test 2 Failed: Proposal state invalid: ${JSON.stringify(proposal)}`);
  }
  if (proposal.submittedBy.userName !== 'Pro Drafter Alex') {
    throw new Error(`Test 2 Failed: Submitter username mismatch: ${proposal.submittedBy.userName}`);
  }
  if (!proposal.originalComp || !proposal.chosenComp) {
    throw new Error(`Test 2 Failed: Missing card snapshots in proposal`);
  }
  console.log(`✓ Proposal created [${proposal.id}] with status '${proposal.status}' by '${proposal.submittedBy.userName}'.`);

  // Test 3: Fetching proposals with filters
  console.log('\nTest 3: Fetching Proposals with Filtering');
  const allProposals = await fetchPrecedentProposals({ status: 'all' });
  if (allProposals.length === 0) throw new Error('Test 3 Failed: No proposals returned');

  const pendingSos = await fetchPrecedentProposals({ status: 'pending', setCode: 'SOS' });
  if (pendingSos.length === 0) throw new Error('Test 3 Failed: Expected pending SOS proposals');

  const searched = await fetchPrecedentProposals({ search: 'Spectral Censor' });
  if (searched.length === 0) throw new Error('Test 3 Failed: Expected search match for Spectral Censor');
  console.log(`✓ Fetched ${allProposals.length} proposal(s), correctly filtered by set and search.`);

  // Test 4: Approving a proposal as Admin
  console.log('\nTest 4: Admin Proposal Approval & Canonical Registration');
  const approvedProposal = await approvePrecedentProposal(
    proposal.id,
    adminUser,
    'Excellent comparison — fits the spell-taxing body role accurately.'
  );

  if (!approvedProposal || approvedProposal.status !== 'approved') {
    throw new Error(`Test 4 Failed: Proposal not marked approved`);
  }
  if (approvedProposal.reviewedBy?.adminName !== 'Lead Admin Sarah') {
    throw new Error(`Test 4 Failed: Reviewer metadata mismatch: ${JSON.stringify(approvedProposal.reviewedBy)}`);
  }

  const canonicalStore = getStoredCanonicalPrecedents();
  const targetKey = getTargetCardKey('SOS', 'Spectral Censor');
  const slotEntry = canonicalStore[targetKey]?.[1];
  if (!slotEntry || slotEntry.precedentCardName !== 'Mage\'s Attendant') {
    throw new Error(`Test 4 Failed: Canonical comp not registered in slot 1: ${JSON.stringify(slotEntry)}`);
  }
  console.log(`✓ Proposal approved by ${approvedProposal.reviewedBy.adminName}, slot 1 registered with '${slotEntry.precedentCardName}'.`);

  // Test 5: Verify similarity engine uses canonical comp
  console.log('\nTest 5: Similarity Scoring with Canonical Comp');
  const simResult = calculateCardSimilarity(targetCard, replacementCompCard);
  if (simResult.score < 85) {
    throw new Error(`Test 5 Failed: Expected canonical score boost, received ${simResult.score}`);
  }
  console.log(`✓ Approved precedent received similarity score ${simResult.score}% with reasons: [${simResult.reasons.join(', ')}].`);

  // Test 6: Rejection workflow
  console.log('\nTest 6: Proposal Rejection Workflow');
  const proposal2 = await submitPrecedentProposal(
    targetCard,
    2,
    origMatch,
    origMatch, // silly swap
    [],
    undefined,
    regularUser
  );

  const rejectedProposal = await rejectPrecedentProposal(
    proposal2.id,
    adminUser,
    'Identical card or inappropriate archetype match.'
  );

  if (!rejectedProposal || rejectedProposal.status !== 'rejected') {
    throw new Error(`Test 6 Failed: Proposal not marked rejected`);
  }
  console.log(`✓ Proposal [${rejectedProposal.id}] rejected with note: "${rejectedProposal.reviewedBy?.notes}".`);

  // Test 7: Export canonical JSON
  console.log('\nTest 7: Canonical JSON Export');
  const jsonExport = exportCanonicalCompsJSON();
  const parsed = JSON.parse(jsonExport);
  if (!parsed[targetKey] || !parsed[targetKey][1]) {
    throw new Error(`Test 7 Failed: Exported JSON does not contain approved precedent`);
  }
  console.log('✓ Successfully exported canonical comps to valid JSON ready for src/data/canonicalComps.json.');

  console.log('\n=== ALL PRECEDENT APPROVAL TESTS PASSED ===\n');
}

runPrecedentApprovalTests().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
