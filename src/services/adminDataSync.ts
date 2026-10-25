import { SetInfo } from '../types/mtg';
import {
  POPULAR_LIMITED_SETS,
  fetchAllSets,
  fetchCardsForSet,
  deduplicateCards,
} from './scryfall';
import {
  fetch17LandsSetData,
  clear17LandsSessionCache,
  getSetDraftStatus,
} from './seventeenLands';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  loadProRatingsForSet,
  getLoadedProRatingsByCreator,
} from './lsvRatings';

export interface SyncProgressUpdate {
  phase: string;
  progress: number; // 0 to 100
  message: string;
  details?: string;
}

export type SyncProgressCallback = (update: SyncProgressUpdate) => void;

export interface SyncSetResult {
  setCode: string;
  setName: string;
  success: boolean;
  cardsProcessed: number;
  previousCount?: number;
  newCount?: number;
  sampleSize?: number;
  status: 'updated' | 'unchanged' | 'error' | 'skipped';
  error?: string;
  details?: string;
}

export interface SyncSummary {
  type: 'preview_cards' | 'seventeen_lands' | 'pro_ratings';
  startedAt: string;
  completedAt: string;
  totalSets: number;
  successfulSets: number;
  failedSets: number;
  results: SyncSetResult[];
}

/**
 * Returns sets currently considered in preview or upcoming (e.g. TRK Star Trek, MDD Marvel: Darkhold Destiny, NAU Nauctis, or sets with future release dates)
 */
export async function getPreviewSetsList(options?: { forceRefresh?: boolean }): Promise<SetInfo[]> {
  try {
    const allSets = await fetchAllSets({ forceRefresh: options?.forceRefresh ?? true });
    const now = Date.now();

    // Identify upcoming/preview sets:
    // 1. Known upcoming preview sets (MDD, NAU, TRK)
    // 2. Draft status is upcoming
    // 3. Release date in the future
    const previewSets = allSets.filter((s) => {
      const code = s.code.toUpperCase();
      if (['MDD', 'NAU', 'TRK'].includes(code)) return true;
      if (getSetDraftStatus(s) === 'upcoming') return true;
      if (s.released_at) {
        const releaseTime = new Date(s.released_at.includes('T') ? s.released_at : `${s.released_at}T00:00:00Z`).getTime();
        if (!isNaN(releaseTime) && releaseTime > now) {
          return true;
        }
      }
      return false;
    });

    // Also ensure all upcoming POPULAR_LIMITED_SETS are present
    POPULAR_LIMITED_SETS.forEach((pop) => {
      const code = pop.code.toUpperCase();
      const popTime = pop.released_at ? new Date(pop.released_at.includes('T') ? pop.released_at : `${pop.released_at}T00:00:00Z`).getTime() : 0;
      if (popTime > now || ['MDD', 'NAU', 'TRK'].includes(code)) {
        if (!previewSets.some((p) => p.code.toUpperCase() === code)) {
          previewSets.push(pop);
        }
      }
    });

    // Sort upcoming sets chronologically by release date (soonest first)
    previewSets.sort((a, b) => (a.released_at || '').localeCompare(b.released_at || ''));

    if (previewSets.length > 0) {
      return previewSets;
    }

    // Fallback: return TRK, NAU, MDD
    return POPULAR_LIMITED_SETS.filter((s) => ['TRK', 'NAU', 'MDD'].includes(s.code.toUpperCase()));
  } catch (err) {
    console.warn('[adminDataSync] Failed to fetch preview sets, using fallback:', err);
    return POPULAR_LIMITED_SETS.filter((s) => ['TRK', 'NAU', 'MDD'].includes(s.code.toUpperCase()));
  }
}

/**
 * Returns sets that are active drafts or eligible for 17Lands telemetry updates
 */
export async function get17LandsSyncableSets(): Promise<SetInfo[]> {
  try {
    const allSets = await fetchAllSets({ forceRefresh: true });

    // Sort priority:
    // 1. Currently active draft sets (HOB, MBC, FRA)
    // 2. Flashback sets
    // 3. Recent 2026/2025 sets with 17Lands data
    const activeOrSyncable = allSets.filter((s) => {
      const code = s.code.toUpperCase();
      const status = getSetDraftStatus(s);
      if (status === 'active' || status === 'flashback') return true;
      if (s.has_17lands_data) return true;
      if (code === 'FRA' || code === 'HOB' || code === 'MBC') return true;
      return false;
    });

    return activeOrSyncable;
  } catch (err) {
    console.warn('[adminDataSync] Failed to fetch syncable 17lands sets:', err);
    return POPULAR_LIMITED_SETS.filter((s) => ['HOB', 'MBC', 'FRA'].includes(s.code.toUpperCase()));
  }
}

/**
 * Syncs preview cards directly from Scryfall API for specified set or all preview sets.
 * Clears local IndexedDB card caches, downloads newest card printings/spoilers,
 * updates set release schedules, and recalculates unique card counts.
 */
export async function syncPreviewSetsAndCards(options: {
  targetSetCode?: string; // 'ALL' or specific set code like 'TRK'
  onProgress?: SyncProgressCallback;
}): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const targetCode = (options.targetSetCode || 'ALL').toUpperCase().trim();

  options.onProgress?.({
    phase: 'Initializing',
    progress: 5,
    message: 'Loading preview set registry and schedule from Scryfall & Supabase...',
  });

  const previewSets = await getPreviewSetsList({ forceRefresh: true });
  const setsToSync: SetInfo[] = targetCode === 'ALL'
    ? previewSets
    : (previewSets.filter((s) => s.code.toUpperCase() === targetCode).length > 0
        ? previewSets.filter((s) => s.code.toUpperCase() === targetCode)
        : POPULAR_LIMITED_SETS.filter((s) => s.code.toUpperCase() === targetCode));

  if (setsToSync.length === 0) {
    // If target set not found in preview list, look up across all popular sets
    const fallback = POPULAR_LIMITED_SETS.find((s) => s.code.toUpperCase() === targetCode);
    if (fallback) {
      setsToSync.push(fallback);
    }
  }

  const results: SyncSetResult[] = [];
  let successfulSets = 0;
  let failedSets = 0;

  for (let i = 0; i < setsToSync.length; i++) {
    const setInfo = setsToSync[i];
    const code = setInfo.code.toUpperCase();
    const previousCardCount = setInfo.card_count || 0;
    const progressBase = Math.round(10 + (i / setsToSync.length) * 80);

    options.onProgress?.({
      phase: `Fetching ${code}`,
      progress: progressBase,
      message: `Fetching newly spoiled & previewed cards for ${setInfo.name} (${code}) from Scryfall...`,
      details: `Requesting live card pool via Scryfall Search API...`,
    });

    try {
      // Force refresh Scryfall card data
      const freshCards = await fetchCardsForSet(
        code,
        (loaded, total) => {
          options.onProgress?.({
            phase: `Fetching ${code}`,
            progress: progressBase + Math.round((loaded / Math.max(1, total)) * 15),
            message: `Fetched ${loaded} of ${total} cards for ${setInfo.name} (${code})...`,
            details: `Page ingestion in progress...`,
          });
        },
        undefined,
        { forceRefresh: true }
      );

      const uniqueCards = deduplicateCards(freshCards);
      const newCardCount = uniqueCards.length;

      // Update in-memory POPULAR_LIMITED_SETS:
      // FRA draft pool is locked to 285 unique playable cards.
      // For other sets, only update set total if the set is largely spoiled (>= 150 unique cards),
      // protecting draft set baseline (e.g. 280) from teaser preview counts (e.g. 12 cards).
      const popMatch = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === code);
      if (popMatch) {
        if (code === 'FRA') {
          popMatch.card_count = 285;
          popMatch.total_cards = 285;
        } else if (newCardCount >= 150) {
          popMatch.card_count = newCardCount;
          popMatch.total_cards = newCardCount;
        }
        if (getSetDraftStatus(code) === 'upcoming' || newCardCount < (popMatch.total_cards || popMatch.card_count)) {
          popMatch.preview_count = newCardCount;
        }
      }

      // Update Supabase set_release_schedules if available
      if (isSupabaseConfigured()) {
        try {
          const countToPersist =
            code === 'FRA'
              ? 285
              : (popMatch?.card_count && popMatch.card_count >= 150
                  ? popMatch.card_count
                  : (newCardCount >= 150 ? newCardCount : (popMatch?.card_count || 280)));

          await supabase
            .from('set_release_schedules')
            .upsert(
              {
                set_code: code,
                set_name: setInfo.name,
                card_count: countToPersist,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'set_code' }
            );
        } catch (dbErr) {
          console.warn(`[adminDataSync] Could not update set_release_schedules for ${code}:`, dbErr);
        }
      }

      successfulSets++;
      results.push({
        setCode: code,
        setName: setInfo.name,
        success: true,
        cardsProcessed: newCardCount,
        previousCount: previousCardCount,
        newCount: newCardCount,
        status: newCardCount !== previousCardCount ? 'updated' : 'unchanged',
        details: newCardCount !== previousCardCount
          ? `Card pool updated from ${previousCardCount} to ${newCardCount} cards (+${newCardCount - previousCardCount} cards).`
          : `Card pool verified up to date with ${newCardCount} unique cards.`,
      });

      options.onProgress?.({
        phase: `Processed ${code}`,
        progress: progressBase + 20,
        message: `Successfully processed ${newCardCount} preview cards for ${setInfo.name} (${code}).`,
        details: `Caches cleared and IndexedDB updated.`,
      });
    } catch (err: any) {
      failedSets++;
      results.push({
        setCode: code,
        setName: setInfo.name,
        success: false,
        cardsProcessed: 0,
        previousCount: previousCardCount,
        status: 'error',
        error: err?.message || 'Network error fetching cards from Scryfall',
        details: `Failed to query Scryfall API: ${err?.message || 'Unknown error'}`,
      });
    }
  }

  // Refresh all sets cache so the rest of the application sees updated card counts
  try {
    await fetchAllSets({ forceRefresh: true });
  } catch {}

  options.onProgress?.({
    phase: 'Complete',
    progress: 100,
    message: `Preview card sync complete! ${successfulSets} sets processed successfully.`,
  });

  return {
    type: 'preview_cards',
    startedAt,
    completedAt: new Date().toISOString(),
    totalSets: setsToSync.length,
    successfulSets,
    failedSets,
    results,
  };
}

/**
 * Syncs 17Lands PremierDraft win rates, ALSA, IWD, and sample sizes for specified set or all active draft sets.
 * Clears session caches, fetches fresh JSON from Cloudflare proxy, writes to IndexedDB,
 * and upserts into Supabase seventeen_lands_cache.
 */
export async function sync17LandsTelemetry(options: {
  targetSetCode?: string; // 'ALL' or specific set code like 'HOB'
  onProgress?: SyncProgressCallback;
}): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const targetCode = (options.targetSetCode || 'ALL').toUpperCase().trim();

  options.onProgress?.({
    phase: 'Initializing',
    progress: 5,
    message: 'Resolving active MTG Arena draft formats & 17Lands telemetry endpoints...',
  });

  // Clear in-memory & session caches
  clear17LandsSessionCache();

  const syncableSets = await get17LandsSyncableSets();
  let setsToSync: SetInfo[] = [];

  if (targetCode === 'ALL') {
    // By default for 'ALL', sync active draft sets: HOB, MBC, and FRA
    setsToSync = syncableSets.filter((s) => {
      const code = s.code.toUpperCase();
      const status = getSetDraftStatus(code);
      return status === 'active' || status === 'flashback' || ['HOB', 'MBC', 'FRA'].includes(code);
    });
    if (setsToSync.length === 0) {
      setsToSync = syncableSets.slice(0, 3);
    }
  } else {
    const match = syncableSets.find((s) => s.code.toUpperCase() === targetCode)
      || POPULAR_LIMITED_SETS.find((s) => s.code.toUpperCase() === targetCode);
    if (match) {
      setsToSync = [match];
    } else {
      setsToSync = [{
        code: targetCode,
        name: targetCode,
        card_count: 280,
      }];
    }
  }

  const results: SyncSetResult[] = [];
  let successfulSets = 0;
  let failedSets = 0;

  for (let i = 0; i < setsToSync.length; i++) {
    const setInfo = setsToSync[i];
    const code = setInfo.code.toUpperCase();
    const progressBase = Math.round(10 + (i / setsToSync.length) * 80);

    options.onProgress?.({
      phase: `Querying ${code}`,
      progress: progressBase,
      message: `Fetching 17Lands Premier Draft telemetry for ${setInfo.name} (${code})...`,
      details: `Connecting to 17Lands edge cache proxy...`,
    });

    try {
      const freshData = await fetch17LandsSetData(code, {
        forceRefresh: true,
        ignoreEligibilityGuard: true,
      });

      if (freshData && freshData.cards && Object.keys(freshData.cards).length > 0) {
        const cardCount = Object.keys(freshData.cards).length;
        const sampleSize = freshData.sampleSize || 0;

        // Upsert to Supabase seventeen_lands_cache
        if (isSupabaseConfigured()) {
          try {
            await supabase
              .from('seventeen_lands_cache')
              .upsert(
                {
                  set_code: code,
                  format: 'PremierDraft',
                  sample_size: sampleSize,
                  card_count: cardCount,
                  dataset: freshData,
                  draft_status: getSetDraftStatus(code),
                  is_frozen: getSetDraftStatus(code) === 'historical',
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'set_code,format' }
              );

            // Also mark has_17lands_data: true in set_release_schedules if sample size > 500
            if (sampleSize >= 500) {
              await supabase
                .from('set_release_schedules')
                .update({ has_17lands_data: true, is_active_draft: true })
                .eq('set_code', code);
            }
          } catch (dbErr) {
            console.warn(`[adminDataSync] Supabase upsert error for ${code}:`, dbErr);
          }
        }

        // Update in-memory POPULAR_LIMITED_SETS
        const popMatch = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === code);
        if (popMatch) {
          popMatch.has_17lands_data = true;
        }

        successfulSets++;
        results.push({
          setCode: code,
          setName: setInfo.name,
          success: true,
          cardsProcessed: cardCount,
          sampleSize,
          status: 'updated',
          details: `Ingested telemetry for ${cardCount} cards across ${sampleSize.toLocaleString()} draft games.`,
        });

        options.onProgress?.({
          phase: `Synced ${code}`,
          progress: progressBase + 20,
          message: `Successfully updated 17Lands telemetry for ${setInfo.name} (${code})!`,
          details: `${cardCount} cards, ${sampleSize.toLocaleString()} games recorded.`,
        });
      } else {
        // No 17Lands telemetry available upstream yet
        results.push({
          setCode: code,
          setName: setInfo.name,
          success: true,
          cardsProcessed: 0,
          sampleSize: 0,
          status: 'skipped',
          details: `No Premier Draft match games recorded on 17Lands for ${code} yet (format unreleased or zero draft volume).`,
        });

        options.onProgress?.({
          phase: `Checked ${code}`,
          progress: progressBase + 20,
          message: `No active 17Lands draft telemetry available for ${code} yet.`,
        });
      }
    } catch (err: any) {
      failedSets++;
      results.push({
        setCode: code,
        setName: setInfo.name,
        success: false,
        cardsProcessed: 0,
        status: 'error',
        error: err?.message || 'Network error fetching 17lands data',
        details: `Failed to fetch 17Lands telemetry: ${err?.message || 'Unknown error'}`,
      });
    }
  }

  options.onProgress?.({
    phase: 'Complete',
    progress: 100,
    message: `17Lands sync complete! Processed ${setsToSync.length} set(s).`,
  });

  return {
    type: 'seventeen_lands',
    startedAt,
    completedAt: new Date().toISOString(),
    totalSets: setsToSync.length,
    successfulSets,
    failedSets,
    results,
  };
}

/**
 * Returns sets eligible for Pro Creator Ratings synchronization (active drafts + popular benchmark sets)
 */
export async function getProRatingsSyncableSets(): Promise<SetInfo[]> {
  try {
    const allSets = await fetchAllSets({ forceRefresh: false });
    const priorityCodes = ['FRA', 'HOB', 'MBC', 'SOS', 'BLB', 'OTJ', 'STX', 'MH3'];
    const matched = allSets.filter((s) => priorityCodes.includes(s.code.toUpperCase()));

    // Also include any other sets from POPULAR_LIMITED_SETS that are not in allSets
    POPULAR_LIMITED_SETS.forEach((pop) => {
      const code = pop.code.toUpperCase();
      if (priorityCodes.includes(code) && !matched.some((m) => m.code.toUpperCase() === code)) {
        matched.push(pop);
      }
    });

    // Sort by priority order
    matched.sort((a, b) => {
      const aIdx = priorityCodes.indexOf(a.code.toUpperCase());
      const bIdx = priorityCodes.indexOf(b.code.toUpperCase());
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    return matched;
  } catch (err) {
    console.warn('[adminDataSync] Failed to fetch pro ratings sets:', err);
    return POPULAR_LIMITED_SETS.filter((s) => ['FRA', 'HOB', 'MBC', 'SOS', 'BLB', 'OTJ', 'STX'].includes(s.code.toUpperCase()));
  }
}

/**
 * Syncs pro creator ratings across LSV, Limited Level Ups (LLU), and Draftsim (DS).
 * Clears memory and IndexedDB caches, pulls fresh rows from Supabase pro_card_ratings table,
 * maps tiers to standard scores and verdicts, and updates local cache.
 */
export async function syncProCreatorRatings(options: {
  targetSetCode?: string; // 'ALL' or specific set code like 'FRA'
  onProgress?: SyncProgressCallback;
}): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const targetCode = (options.targetSetCode || 'ALL').toUpperCase().trim();

  options.onProgress?.({
    phase: 'Initializing',
    progress: 5,
    message: 'Resolving pro creator tier lists and set reviews across LSV, Limited Level Ups, and Draftsim...',
  });

  const availableSets = await getProRatingsSyncableSets();
  let setsToSync: SetInfo[] = [];

  if (targetCode === 'ALL') {
    // Primary active/ongoing sets
    setsToSync = availableSets;
  } else {
    const match = availableSets.find((s) => s.code.toUpperCase() === targetCode)
      || POPULAR_LIMITED_SETS.find((s) => s.code.toUpperCase() === targetCode);
    if (match) {
      setsToSync = [match];
    } else {
      setsToSync = [{
        code: targetCode,
        name: targetCode,
        card_count: 280,
      }];
    }
  }

  const results: SyncSetResult[] = [];
  let successfulSets = 0;
  let failedSets = 0;

  for (let i = 0; i < setsToSync.length; i++) {
    const setInfo = setsToSync[i];
    const code = setInfo.code.toUpperCase();
    const progressBase = Math.round(10 + (i / setsToSync.length) * 80);

    options.onProgress?.({
      phase: `Syncing ${code}`,
      progress: progressBase,
      message: `Fetching fresh creator review ratings for ${setInfo.name} (${code}) from Supabase & tierlists...`,
      details: `Creators: Luis Scott-Vargas, Limited Level Ups, Draftsim...`,
    });

    try {
      // Force refresh pro ratings from Supabase
      const defaultMap = await loadProRatingsForSet(code, { forceRefresh: true });
      const byCreator = getLoadedProRatingsByCreator(code) || {};

      const lsvCount = Object.keys(byCreator['LSV'] || {}).length;
      const lluCount = Object.keys(byCreator['LLU'] || {}).length;
      const dsCount = Object.keys(byCreator['DS'] || {}).length;
      const totalUniqueCards = Object.keys(defaultMap).length;

      const creatorSummary = [
        `Draftsim (DS): ${dsCount}`,
        `Limited Level Ups (LLU): ${lluCount}`,
        `Luis Scott-Vargas (LSV): ${lsvCount}`,
      ].join(' • ');

      successfulSets++;
      results.push({
        setCode: code,
        setName: setInfo.name,
        success: true,
        cardsProcessed: totalUniqueCards,
        status: totalUniqueCards > 0 ? 'updated' : 'unchanged',
        details: `Loaded ${totalUniqueCards} unique card ratings. ${creatorSummary}`,
      });

      options.onProgress?.({
        phase: `Synced ${code}`,
        progress: progressBase + 20,
        message: `Successfully synchronized ${totalUniqueCards} pro reviews for ${setInfo.name} (${code})!`,
        details: creatorSummary,
      });
    } catch (err: any) {
      failedSets++;
      results.push({
        setCode: code,
        setName: setInfo.name,
        success: false,
        cardsProcessed: 0,
        status: 'error',
        error: err?.message || 'Error fetching pro ratings from database',
        details: `Failed to fetch pro ratings: ${err?.message || 'Unknown error'}`,
      });
    }
  }

  options.onProgress?.({
    phase: 'Complete',
    progress: 100,
    message: `Pro creator ratings sync complete! Processed ${setsToSync.length} set(s).`,
  });

  return {
    type: 'pro_ratings',
    startedAt,
    completedAt: new Date().toISOString(),
    totalSets: setsToSync.length,
    successfulSets,
    failedSets,
    results,
  };
}

