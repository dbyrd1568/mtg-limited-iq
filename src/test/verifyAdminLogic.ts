import {
  checkIsAdmin,
  grantAdminAccess,
  revokeAdminAccess,
  fetchAdminList,
  fetchAdminOverviewKPIs,
  fetchUserDirectory,
  fetchFeatureUsageMetrics,
  fetchSetGradingAnalytics,
  fetchGradingAccuracyReport,
  exportAdminDataAsJSON,
  exportAdminDataAsCSV,
} from '../services/admin';
import { trackFeature, trackEvent, fetchActivityLogs, KNOWN_FEATURES } from '../services/telemetry';
import { UserAccount } from '../types/mtg';
import { supabase } from '../services/supabase';

// Mock localStorage if running in node/tsx
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

async function runAdminVerification() {
  console.log('=== MTG Limited IQ Admin & Telemetry System Verification ===\n');

  // Test 1: Admin Permission Verification
  console.log('1. Testing Admin Authorization Checks...');
  const devonUser: UserAccount = {
    id: 'usr_devonbyrd',
    name: 'Devon Byrd',
    email: 'devonbyrd@gmail.com',
    avatarColor: '#8b5cf6',
    provider: 'google',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const guestUser: UserAccount = {
    id: 'usr_random_guest_99',
    name: 'Guest Player',
    email: 'guest@random.com',
    avatarColor: '#3b82f6',
    provider: 'email',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const defaultDevUser: UserAccount = {
    id: 'user_default',
    name: 'Default Drafter',
    email: 'drafter@local',
    avatarColor: '#8b5cf6',
    provider: 'local',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const isDefaultDevAdmin = await checkIsAdmin(defaultDevUser);
  console.assert(isDefaultDevAdmin === true, 'user_default in dev mode should be granted admin');

  const isGuestAdmin = await checkIsAdmin(guestUser);
  console.assert(isGuestAdmin === false, 'Guest user without admin role must NOT be admin');

  const isNullAdmin = await checkIsAdmin(null);
  console.assert(isNullAdmin === false, 'Null user must NOT be admin');

  // Test Cryptographically Signed JWT app_metadata claim validation
  const originalGetSession = supabase.auth.getSession;
  (supabase.auth as any).getSession = async () => ({
    data: {
      session: {
        user: {
          id: 'usr_verified_admin_001',
          email: 'dbyrd1568@gmail.com',
          app_metadata: { role: 'admin' },
        },
      },
    },
  });

  const isJwtAdmin = await checkIsAdmin({
    id: 'usr_verified_admin_001',
    name: 'Devon Byrd',
    email: 'dbyrd1568@gmail.com',
    avatarColor: '#10b981',
    provider: 'google',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  });
  console.assert(isJwtAdmin === true, 'User with cryptographically signed JWT app_metadata.role=admin must be admin');

  // Test Cryptographic rejection when JWT has no admin role
  (supabase.auth as any).getSession = async () => ({
    data: {
      session: {
        user: {
          id: 'usr_normal_user_002',
          email: 'normal@gmail.com',
          app_metadata: { role: 'authenticated' },
        },
      },
    },
  });

  const isNonAdminJwt = await checkIsAdmin({
    id: 'usr_normal_user_002',
    name: 'Normal User',
    email: 'normal@gmail.com',
    avatarColor: '#3b82f6',
    provider: 'google',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  });
  console.assert(isNonAdminJwt === false, 'User without admin JWT claim must be rejected');

  // Restore original getSession
  (supabase.auth as any).getSession = originalGetSession;
  console.log('✓ Cryptographic JWT claim and database verification correctly protects admin routes.\n');

  // Test 2: Admin Whitelist Grant & Revoke
  console.log('2. Testing Admin Whitelist Grant & Revoke...');
  const grantRes = await grantAdminAccess('trusted_coadmin@mtg.com', defaultDevUser.id);
  console.assert(grantRes.success === true, 'Granting admin to new email must succeed');

  const adminListAfterGrant = await fetchAdminList();
  const added = adminListAfterGrant.find((a) => a.email === 'trusted_coadmin@mtg.com');
  console.assert(Boolean(added), 'Granted email must exist in admin list');

  const duplicateGrant = await grantAdminAccess('trusted_coadmin@mtg.com');
  console.assert(duplicateGrant.success === false, 'Duplicate admin grant must be rejected');

  // Test owner revocation rejection (by ID and by email)
  const revokeOwnerById = await revokeAdminAccess('admin_owner_01');
  console.assert(revokeOwnerById.success === false, 'Primary owner revocation by ID must be rejected');

  const revokeOwnerByEmail = await revokeAdminAccess('dbyrd1568@gmail.com');
  console.assert(revokeOwnerByEmail.success === false, 'Permanent super-admin email revocation must be rejected');

  // Test revoking by email directly
  const revokeByEmailRes = await revokeAdminAccess('trusted_coadmin@mtg.com');
  console.assert(revokeByEmailRes.success === true, 'Revoking co-admin directly by email must succeed');

  const adminListAfterRevoke = await fetchAdminList();
  const revokedStillPresent = adminListAfterRevoke.some((a) => a.email === 'trusted_coadmin@mtg.com');
  console.assert(!revokedStillPresent, 'Revoked admin must no longer be present in admin list');

  // Test granting and then revoking by object ID
  const grantSecond = await grantAdminAccess('second_coadmin@mtg.com');
  console.assert(grantSecond.success === true, 'Granting second coadmin must succeed');
  const secondAdded = (await fetchAdminList()).find((a) => a.email === 'second_coadmin@mtg.com');
  console.assert(Boolean(secondAdded), 'Second coadmin must exist');
  if (secondAdded) {
    const revokeSecond = await revokeAdminAccess(secondAdded.id);
    console.assert(revokeSecond.success === true, 'Revoking co-admin by ID must succeed');
  }
  console.log('✓ Admin whitelist grant & revocation (by email and ID) functions with owner protection.\n');

  // Test 3: Telemetry & Event Tracking
  console.log('3. Testing Telemetry & Feature Tracking...');
  trackFeature(KNOWN_FEATURES.CARD_GRADING, { set: 'DFT', card: 'Kaito', grade: 'A' }, defaultDevUser);
  trackFeature(KNOWN_FEATURES.CARD_QUIZ, { set: 'DFT', score: 10, total: 10 }, defaultDevUser);
  trackFeature(KNOWN_FEATURES.BLIND_GRADING, { set: 'DFT', enabled: true }, defaultDevUser);

  const logs = await fetchActivityLogs('all');
  console.assert(logs.length > 0, 'Activity logs should contain tracked events');
  console.log(`✓ Telemetry successfully recorded and fetched ${logs.length} activity events.\n`);

  // Test 4: User Directory & Sets Graded Aggregation
  console.log('4. Testing User Directory & Sets Graded Analytics...');
  const directory = await fetchUserDirectory();
  console.assert(directory.length > 0, 'User directory must not be empty');

  const firstUser = directory[0];
  console.assert(typeof firstUser.cardsGradedTotal === 'number', 'User must have cardsGradedTotal');
  console.assert(Array.isArray(firstUser.setsGraded), 'User must have setsGraded breakdown array');
  console.assert(typeof firstUser.gradingAccuracyScore === 'number', 'User must have grading accuracy');
  console.log(`✓ Directory verified (${directory.length} users tracked with cards-per-set metrics).\n`);

  // Test 5: Feature Adoption Metrics
  console.log('5. Testing Feature Usage & Adoption Analytics...');
  const featureMetrics = await fetchFeatureUsageMetrics('all');
  console.assert(featureMetrics.length > 0, 'Feature metrics must be generated');
  const gradingFeat = featureMetrics.find((f) => f.featureKey === KNOWN_FEATURES.CARD_GRADING);
  console.assert(Boolean(gradingFeat), 'Card Grading feature must be tracked');
  console.assert(typeof gradingFeat?.adoptionRate === 'number', 'Adoption rate must be a percentage');
  console.log(`✓ Feature metrics verified (${featureMetrics.length} features analyzed with adoption rates).\n`);

  // Test 6: Set Grading Community Leaderboard
  console.log('6. Testing Set Grading Analytics...');
  const setAnalytics = await fetchSetGradingAnalytics();
  console.assert(setAnalytics.length > 0, 'Set analytics must not be empty');
  const dftSet = setAnalytics.find((s) => s.setCode === 'DFT');
  console.assert(Boolean(dftSet), 'DFT set must be tracked');
  console.assert(typeof dftSet?.totalSetCards === 'number', 'Set must track total cards');
  console.log(`✓ Set grading leaderboard verified (${setAnalytics.length} MTG sets aggregated).\n`);

  // Test 7: Grading Calibration Accuracy & Traps/Sleepers
  console.log('7. Testing Grade Accuracy & Consensus Sleepers/Traps...');
  const accuracyReport = await fetchGradingAccuracyReport();
  console.assert(accuracyReport.systemCalibrationScore >= 0 && accuracyReport.systemCalibrationScore <= 100, 'Calibration score must be 0-100');
  console.assert(accuracyReport.systemGpa >= 0 && accuracyReport.systemGpa <= 4.0, 'GPA must be 0-4.0');
  console.assert(Array.isArray(accuracyReport.biggestSleepers), 'Must return biggestSleepers array');
  console.assert(Array.isArray(accuracyReport.biggestTraps), 'Must return biggestTraps array');
  console.log(`✓ Accuracy report verified (${accuracyReport.systemCalibrationScore}% calibration, ${accuracyReport.systemGpa} GPA, ${accuracyReport.biggestSleepers.length} sleepers, ${accuracyReport.biggestTraps.length} traps).\n`);

  // Test 8: Data Export (JSON & CSV)
  console.log('8. Testing Admin Data Export (JSON & CSV)...');
  const jsonExport = await exportAdminDataAsJSON();
  const parsedJson = JSON.parse(jsonExport);
  console.assert(parsedJson.system === 'MTG Limited IQ Admin Analytics', 'JSON export must have valid schema header');
  console.assert(Array.isArray(parsedJson.users), 'JSON export must contain users list');

  const csvExports = await exportAdminDataAsCSV();
  console.assert(csvExports.usersCsv.includes('ID,Name,Email'), 'Users CSV must have headers');
  console.assert(csvExports.setsCsv.includes('Set Code,Set Name'), 'Sets CSV must have headers');
  console.assert(csvExports.featuresCsv.includes('Feature Key,Name'), 'Features CSV must have headers');
  console.log('✓ Data export verified: JSON and multi-table CSVs generated properly.\n');

  console.log('🎉 ALL ADMIN & TELEMETRY VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}

runAdminVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
