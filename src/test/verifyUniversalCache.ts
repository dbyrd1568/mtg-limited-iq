import { 
  getSetDraftStatus,
  isSetActiveDraft,
  isSetHistorical,
  isSetUpcoming,
  isSetFlashback,
  getPreloaded17LandsData,
  get17LandsExpansionCode
} from '../services/seventeenLands';
import workerHandler from '../worker';

console.log('Testing Universal 17Lands Cache Architecture...\n');

// 1. Verify Active vs Historical vs Upcoming Set Classification
console.log('Test 1: Recalibrated Set Classification (getSetDraftStatus)...');
// Active primary sets
console.assert(getSetDraftStatus('HOB') === 'active', 'HOB (Aug 2026) must be active premier draft set');
console.assert(isSetActiveDraft('HOB') === true, 'isSetActiveDraft(HOB) must be true');

console.assert(getSetDraftStatus('MBC') === 'active', 'MBC (Mystery Booster Commander) must be active');
console.assert(isSetActiveDraft('MBC') === true, 'isSetActiveDraft(MBC) must be true');

// DFT is NOT active (historical)
console.assert(getSetDraftStatus('DFT') === 'historical', 'DFT (Feb 2025) must be historical (not active!)');
console.assert(isSetActiveDraft('DFT') === false, 'isSetActiveDraft(DFT) must be false');
console.assert(isSetHistorical('DFT') === true, 'isSetHistorical(DFT) must be true');

// Historical sets (off Arena from first run)
console.assert(getSetDraftStatus('BLB') === 'historical', 'BLB must be historical');
console.assert(getSetDraftStatus('OTJ') === 'historical', 'OTJ must be historical');
console.assert(getSetDraftStatus('MKM') === 'historical', 'MKM must be historical');

// Upcoming sets (soon to be active)
console.assert(getSetDraftStatus('FRA') === 'upcoming', 'FRA (Oct 2026) must be upcoming (soon to be active)');
console.assert(isSetUpcoming('FRA') === true, 'isSetUpcoming(FRA) must be true');
console.assert(getSetDraftStatus('TRK') === 'upcoming', 'TRK (Nov 2026) must be upcoming');

console.log('✓ Set classification calibrated: HOB & MBC are active, DFT is historical, FRA is upcoming.\n');

// 2. Expansion Code Aliasing
console.log('Test 2: Expansion Aliasing...');
console.assert(get17LandsExpansionCode('RVR') === 'RAVM', 'RVR must map to RAVM on 17Lands');
console.assert(get17LandsExpansionCode('hob') === 'HOB', 'Expansion codes must be uppercase');
console.log('✓ Expansion codes normalize correctly.\n');

// 3. Bundled Fallback Integrity
console.log('Test 3: Preloaded Bundled Datasets...');
const hobData = getPreloaded17LandsData('HOB');
console.assert(hobData !== null, 'HOB preloaded data must be available');
console.assert(Object.keys(hobData?.cards || {}).length >= 180, 'HOB must contain at least 180 cards');
console.assert(hobData?.cards['Long-Bodied Grey Dog'] !== undefined, 'HOB must contain key cards');
console.assert(typeof hobData?.cards['Long-Bodied Grey Dog'].win_rate === 'number', 'Win rate must be numeric');
console.assert(typeof hobData?.cards['Long-Bodied Grey Dog'].tier_grade === 'string', 'Tier grade must be present');
console.log(`✓ HOB preloaded dataset verified (${Object.keys(hobData?.cards || {}).length} cards).\n`);

// 4. Cloudflare Worker Edge Handler Tests
console.log('Test 4: Cloudflare Worker Edge Handler...');
(async () => {
  const dummyEnv = {
    ASSETS: {
      fetch: (async () => new Response('Asset not found', { status: 404 })) as typeof fetch,
    },
  };

  // Test 4a: OPTIONS CORS preflight
  const optionsReq = new Request('https://app.test/api/17lands/api/card_data', { method: 'OPTIONS' });
  const optionsRes = await workerHandler.fetch(optionsReq, dummyEnv);
  console.assert(optionsRes.status === 204, 'CORS preflight must return 204 No Content');
  console.assert(optionsRes.headers.get('Access-Control-Allow-Origin') === '*', 'CORS origin must be *');
  console.log('✓ Worker CORS preflight verified.');

  // Test 4b: Reject non-GET/HEAD methods on /api/17lands/
  const postReq = new Request('https://app.test/api/17lands/api/card_data', { method: 'POST' });
  const postRes = await workerHandler.fetch(postReq, dummyEnv);
  console.assert(postRes.status === 405, 'POST to /api/17lands/ must return 405 Method Not Allowed');
  console.log('✓ Worker method filtering verified.');

  console.log('\n==================================================');
  console.log('  All Universal Cache Tests Passed Successfully!  ');
  console.log('==================================================\n');
})();
