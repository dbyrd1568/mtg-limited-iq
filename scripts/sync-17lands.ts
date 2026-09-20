#!/usr/bin/env tsx
/**
 * ==============================================================================
 * 17LANDS UNIVERSAL TELEMETRY SYNC & FLASHBACK INGESTION ENGINE
 * ==============================================================================
 * Daily & Periodic Ingestion of MTG Arena draft telemetry from 17lands.com:
 * 
 * 1. Active Sets (Daily):
 *    Syncs sets currently active on Arena (e.g. HOB, MBC; and FRA once released).
 * 
 * 2. Flashback Sets (Daily during event):
 *    Syncs historical sets returning to Arena for Flashback drafts (e.g. via FLASHBACK_SETS=BLB).
 * 
 * 3. Historical Audit (Weekly / Periodic):
 *    Audits historical sets off Arena from their first run. Compares upstream 17Lands
 *    sample sizes with cached Supabase data. If game count increased (indicating an
 *    Arena Flashback event occurred), updates the central store and warms edge cache.
 * 
 * Usage:
 *   npx tsx scripts/sync-17lands.ts                         # Sync active sets (HOB, MBC)
 *   npx tsx scripts/sync-17lands.ts HOB                     # Sync specific set
 *   npx tsx scripts/sync-17lands.ts --flashback BLB,OTJ     # Sync explicit flashback sets
 *   npx tsx scripts/sync-17lands.ts --audit-historical      # Check all historical sets for flashback updates
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// Grade tier conversion
function winRateToGradeTier(winRate: number): string {
  const wrPercent = winRate > 1 ? winRate : winRate * 100;
  if (wrPercent >= 62.5) return 'A+';
  if (wrPercent >= 60.5) return 'A';
  if (wrPercent >= 59.0) return 'A-';
  if (wrPercent >= 57.5) return 'B+';
  if (wrPercent >= 56.0) return 'B';
  if (wrPercent >= 54.5) return 'B-';
  if (wrPercent >= 53.0) return 'C+';
  if (wrPercent >= 51.5) return 'C';
  if (wrPercent >= 49.5) return 'C-';
  if (wrPercent >= 46.0) return 'D';
  return 'F';
}

function get17LandsExpansionCode(setCode: string): string {
  const upper = (setCode || '').toUpperCase().trim();
  const aliasMap: Record<string, string> = {
    'RVR': 'RAVM',
    'RAV': 'Ravnica',
  };
  return aliasMap[upper] || upper;
}

// Configuration & Credentials
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://irxgoelllogcyoiumxup.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_QNDNrOPhb_X_29OfIg_-_Q_OB7QJuhI';

const PROD_WORKER_URL =
  process.env.CLOUDFLARE_WORKER_URL ||
  process.env.PRODUCTION_URL ||
  'https://mtg-limited-iq.byrd.workers.dev';

// Primary active Premier Draft formats & ongoing formats on MTG Arena
const PRIMARY_ACTIVE_SETS = ['HOB', 'MBC'];

// Historical sets catalog for periodic flashback auditing
const HISTORICAL_AUDIT_SETS = [
  'DFT', 'PIO', 'FDN', 'DSK', 'BLB', 'MH3', 'OTJ', 'MKM', 'RVR',
  'LCI', 'WOE', 'LTR', 'MOM', 'SIR', 'ONE', 'BRO', 'DMU', 'NEO', 'STX', 'KHM'
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dynamically resolves active draft sets based on current date
 */
function resolveCurrentActiveSets(): string[] {
  const active = [...PRIMARY_ACTIVE_SETS];
  const now = Date.now();

  // Reality Fracture (FRA) releases 2026-10-02; automatically becomes active upon release
  const fraReleaseTime = new Date('2026-10-02T00:00:00Z').getTime();
  if (now >= fraReleaseTime && !active.includes('FRA')) {
    active.push('FRA');
  }

  // Include any configured flashback sets from env
  const envFlashbacks = (process.env.FLASHBACK_SETS || '')
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  for (const fb of envFlashbacks) {
    if (!active.includes(fb)) {
      active.push(fb);
    }
  }

  return active;
}

async function fetchSetFrom17Lands(expansion: string): Promise<any[] | null> {
  const url = `https://www.17lands.com/api/card_data?expansion=${encodeURIComponent(expansion)}&event_type=PremierDraft`;
  console.log(`[17Lands Sync] Fetching upstream: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[17Lands Sync] Upstream returned HTTP ${response.status} for ${expansion}`);
      return null;
    }

    const json = await response.json();
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.data)) return json.data;
    return null;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`[17Lands Sync] Network error fetching ${expansion}:`, err?.message);
    return null;
  }
}

async function syncSet(
  supabase: ReturnType<typeof createClient>,
  setCode: string,
  options: { draftStatus?: 'active' | 'flashback' | 'historical'; onlyIfChanged?: boolean } = {}
) {
  const upperCode = setCode.toUpperCase().trim();
  const expansion = get17LandsExpansionCode(upperCode);
  const draftStatus = options.draftStatus || (PRIMARY_ACTIVE_SETS.includes(upperCode) ? 'active' : 'historical');

  console.log(`\n--------------------------------------------------`);
  console.log(`Set: ${upperCode} (expansion: ${expansion}, status: ${draftStatus})`);

  // If onlyIfChanged is requested (e.g. historical flashback audit), check existing Supabase sample size
  let existingSampleSize = 0;
  if (options.onlyIfChanged) {
    try {
      const { data: existingRow } = await supabase
        .from('seventeen_lands_cache')
        .select('sample_size, draft_status')
        .eq('set_code', upperCode)
        .maybeSingle();

      if (existingRow?.sample_size) {
        existingSampleSize = Number(existingRow.sample_size);
      }
    } catch {}
  }

  const rawCards = await fetchSetFrom17Lands(expansion);
  if (!rawCards || !Array.isArray(rawCards) || rawCards.length === 0) {
    console.warn(`[17Lands Sync] No card records found for set ${upperCode}. Skipping.`);
    return;
  }

  // Filter valid cards
  const validCards = rawCards.filter((item: any) => {
    const wr = item.ever_drawn_win_rate ?? item.game_count_win_rate ?? item.win_rate;
    return typeof wr === 'number' && wr > 0.25 && wr < 0.90;
  });

  if (validCards.length < 5) {
    console.warn(`[17Lands Sync] Only ${validCards.length} valid cards found for ${upperCode}. Skipping.`);
    return;
  }

  const cards: Record<string, any> = {};
  let totalGames = 0;

  validCards.forEach((item: any) => {
    const wr = item.ever_drawn_win_rate ?? item.game_count_win_rate ?? item.win_rate ?? 0.54;
    const games = item.game_count || item.ever_drawn_game_count || item.opening_hand_game_count || item.seen_count || 1000;
    totalGames += games;
    const name = item.name;
    const cardId = item.mtga_id ?? item.id ?? item.card_id;

    const rating = {
      name,
      color: item.color || '',
      rarity: item.rarity || 'common',
      seen_count: item.seen_count || games,
      avg_seen: typeof item.avg_seen === 'number' ? item.avg_seen : 5.0,
      pick_rate: typeof item.pick_rate === 'number' ? item.pick_rate : 0.15,
      game_count: games,
      win_rate: wr,
      iwd: typeof item.drawn_improvement_win_rate === 'number' ? item.drawn_improvement_win_rate : (item.iwd || 0.01),
      tier_grade: winRateToGradeTier(wr),
      card_id: cardId,
      mtga_id: typeof cardId === 'number' ? cardId : undefined,
    };

    cards[name] = rating;
    if (name.includes(' // ')) {
      const faceName = name.split(' // ')[0].trim();
      cards[faceName] = rating;
    }
  });

  const dataset = {
    setCode: upperCode,
    setName: upperCode,
    format: 'PremierDraft',
    sampleSize: totalGames > 0 ? totalGames : validCards.length * 2000,
    cards,
    updatedAt: new Date().toISOString(),
  };

  // If auditing historical sets, verify if new flashback draft games were recorded
  if (options.onlyIfChanged && existingSampleSize > 0) {
    const gameDelta = dataset.sampleSize - existingSampleSize;
    if (gameDelta < 500) {
      console.log(
        `[17Lands Sync] ${upperCode}: Sample size unchanged (${dataset.sampleSize} games, delta: ${gameDelta}). No flashback draft detected.`
      );
      return;
    }
    console.log(
      `[17Lands Sync] 🚨 Flashback Draft detected for ${upperCode}! Game count increased from ${existingSampleSize} to ${dataset.sampleSize} (+${gameDelta} games). Updating cache!`
    );
  } else {
    console.log(`[17Lands Sync] Processed ${Object.keys(cards).length} cards for ${upperCode} (Total games: ${dataset.sampleSize})`);
  }

  // Upsert to Supabase
  try {
    const { error } = await supabase
      .from('seventeen_lands_cache')
      .upsert(
        {
          set_code: upperCode,
          format: 'PremierDraft',
          sample_size: dataset.sampleSize,
          card_count: Object.keys(cards).length,
          dataset,
          draft_status: draftStatus,
          is_frozen: draftStatus === 'historical',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'set_code,format' }
      );

    if (error) {
      console.error(`[17Lands Sync] Supabase upsert error for ${upperCode}:`, error.message);
    } else {
      console.log(`[17Lands Sync] Successfully saved ${upperCode} [${draftStatus}] into Supabase seventeen_lands_cache!`);
    }
  } catch (err: any) {
    console.error(`[17Lands Sync] Supabase client exception for ${upperCode}:`, err?.message);
  }

  // Warm Cloudflare Edge Cache if worker URL is accessible
  if (PROD_WORKER_URL) {
    try {
      const warmUrl = `${PROD_WORKER_URL.replace(/\/$/, '')}/api/17lands/api/card_data?expansion=${encodeURIComponent(expansion)}&event_type=PremierDraft`;
      console.log(`[17Lands Sync] Warming Cloudflare edge cache: ${warmUrl}`);
      const warmRes = await fetch(warmUrl, { headers: { 'Accept': 'application/json' } });
      console.log(`[17Lands Sync] Edge cache warming status: HTTP ${warmRes.status}`);
    } catch (warmErr: any) {
      console.warn(`[17Lands Sync] Edge warming skipped (${warmErr?.message})`);
    }
  }
}

async function main() {
  console.log('==================================================');
  console.log('  17Lands Telemetry Sync & Flashback Draft Ingestion ');
  console.log('==================================================');
  console.log(`Target Supabase: ${SUPABASE_URL}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const rawArgs = process.argv.slice(2);
  const isAuditHistorical = rawArgs.includes('--audit-historical') || rawArgs.includes('--historical');
  const flashbackIndex = rawArgs.indexOf('--flashback');
  const explicitFlashbacks = flashbackIndex !== -1 && rawArgs[flashbackIndex + 1]
    ? rawArgs[flashbackIndex + 1].split(/[\s,]+/).map((s) => s.toUpperCase().trim()).filter(Boolean)
    : [];

  const explicitSets = rawArgs.filter((a) => !a.startsWith('--') && !explicitFlashbacks.includes(a.toUpperCase()));

  if (isAuditHistorical) {
    console.log(`Mode: Historical Flashback Audit (${HISTORICAL_AUDIT_SETS.length} historical sets)`);
    console.log(`Sets: ${HISTORICAL_AUDIT_SETS.join(', ')}`);

    for (let i = 0; i < HISTORICAL_AUDIT_SETS.length; i++) {
      const setCode = HISTORICAL_AUDIT_SETS[i];
      await syncSet(supabase, setCode, { draftStatus: 'historical', onlyIfChanged: true });
      if (i < HISTORICAL_AUDIT_SETS.length - 1) {
        console.log('Pausing 3s before next historical set...');
        await sleep(3000);
      }
    }
  } else if (explicitFlashbacks.length > 0) {
    console.log(`Mode: Flashback Draft Ingestion`);
    console.log(`Flashback sets: ${explicitFlashbacks.join(', ')}`);

    for (let i = 0; i < explicitFlashbacks.length; i++) {
      await syncSet(supabase, explicitFlashbacks[i], { draftStatus: 'flashback', onlyIfChanged: false });
      if (i < explicitFlashbacks.length - 1) {
        await sleep(2000);
      }
    }
  } else {
    const targetSets = explicitSets.length > 0 ? explicitSets : resolveCurrentActiveSets();
    console.log(`Mode: Daily Active Draft Telemetry Sync`);
    console.log(`Active sets: ${targetSets.join(', ')}`);

    for (let i = 0; i < targetSets.length; i++) {
      const setCode = targetSets[i];
      const isFb = Boolean(process.env.FLASHBACK_SETS?.toUpperCase().includes(setCode.toUpperCase()));
      await syncSet(supabase, setCode, {
        draftStatus: isFb ? 'flashback' : 'active',
        onlyIfChanged: false,
      });

      if (i < targetSets.length - 1) {
        console.log('Pausing 2s before next set...');
        await sleep(2000);
      }
    }
  }

  console.log('\n==================================================');
  console.log('  17Lands Sync Process Completed Successfully!     ');
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('[17Lands Sync] Fatal error:', err);
  process.exit(1);
});
