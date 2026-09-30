import { get, set } from 'idb-keyval';
import { Card, GradeTier } from '../types/mtg';
import { scoreToGradeTier } from './seventeenLands';
import { POPULAR_LIMITED_SETS } from './scryfall';
import { supabase, isSupabaseConfigured } from './supabase';

export interface LsvCardRating {
  score: number; // 0.0 to 5.0
  grade: GradeTier;
  verdict?: string; // e.g. "Bomb", "High Pick", "Solid Playable", "Filler"
  notes?: string;
  source?: string;
  isEstimated?: boolean;
}

// In-memory cache of live/database pro ratings per set
const LIVE_PRO_RATINGS: Record<string, Record<string, LsvCardRating> | undefined> = {};
const PENDING_PRO_RATING_FETCHES: Record<string, Promise<Record<string, LsvCardRating>> | undefined> = {};

// Convert LSV's traditional 0.0 - 5.0 scale to standard GradeTier
export function lsvScoreToGradeTier(score: number): GradeTier {
  if (score >= 4.8) return 'A+';
  if (score >= 4.5) return 'A';
  if (score >= 4.0) return 'A-';
  if (score >= 3.5) return 'B+';
  if (score >= 3.0) return 'B';
  if (score >= 2.5) return 'B-';
  if (score >= 2.0) return 'C+';
  if (score >= 1.5) return 'C';
  if (score >= 1.0) return 'C-';
  if (score >= 0.5) return 'D';
  return 'F';
}

/**
 * Loads pro card ratings for a set:
 * 1. Checks memory cache
 * 2. Checks local IndexedDB cache
 * 3. Fetches from Supabase pro_card_ratings table and updates IndexedDB
 */
export async function loadProRatingsForSet(setCode: string): Promise<Record<string, LsvCardRating>> {
  if (!setCode) return {};
  const upper = setCode.toUpperCase().trim();

  if (LIVE_PRO_RATINGS[upper] && Object.keys(LIVE_PRO_RATINGS[upper]!).length > 0) {
    return LIVE_PRO_RATINGS[upper]!;
  }

  if (PENDING_PRO_RATING_FETCHES[upper]) {
    return PENDING_PRO_RATING_FETCHES[upper]!;
  }

  const fetchPromise = (async () => {
    const idbKey = `pro_ratings_v1_${upper}`;

    // 1. Try local IndexedDB cache first for instant offline readiness
    if (typeof indexedDB !== 'undefined') {
      try {
        const cached = await get<Record<string, LsvCardRating>>(idbKey);
        if (cached && Object.keys(cached).length > 0) {
          LIVE_PRO_RATINGS[upper] = { ...cached };
        }
      } catch (e) {
        // ignore IDB errors
      }
    }

    // 2. Query Supabase if configured to get fresh / updated ratings
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('pro_card_ratings')
          .select('card_name, score, grade, verdict, notes, source')
          .eq('set_code', upper);

        if (!error && data && data.length > 0) {
          const freshMap: Record<string, LsvCardRating> = {};
          for (const row of data) {
            const sc = Number(row.score);
            freshMap[row.card_name.trim()] = {
              score: sc,
              grade: (row.grade as GradeTier) || lsvScoreToGradeTier(sc),
              verdict: row.verdict || (sc >= 4.5 ? 'Bomb' : sc >= 3.5 ? 'High Pick' : sc >= 2.5 ? 'Solid Playable' : sc >= 1.5 ? 'Filler' : 'Unplayable'),
              notes: row.notes || undefined,
              source: row.source || 'LSV',
              isEstimated: false,
            };
          }

          LIVE_PRO_RATINGS[upper] = freshMap;

          if (typeof indexedDB !== 'undefined') {
            try {
              await set(idbKey, freshMap);
            } catch (e) {}
          }

          return freshMap;
        }
      } catch (err) {
        console.warn(`[lsvRatings] Failed to fetch pro ratings from Supabase for ${upper}:`, err);
      }
    }

    // 3. Fall back to cached IDB data if Supabase failed or returned empty
    if (LIVE_PRO_RATINGS[upper] && Object.keys(LIVE_PRO_RATINGS[upper]!).length > 0) {
      return LIVE_PRO_RATINGS[upper]!;
    }

    return LIVE_PRO_RATINGS[upper] || {};
  })();

  PENDING_PRO_RATING_FETCHES[upper] = fetchPromise;
  try {
    const res = await fetchPromise;
    return res;
  } finally {
    delete PENDING_PRO_RATING_FETCHES[upper];
  }
}

/**
 * Determines whether LSV ratings can be checked for a set:
 * 1. Returns true if ratings exist in LIVE_PRO_RATINGS.
 * 2. If lsv_available_at date is set, returns true if Date.now() >= that date.
 * 3. Fallback: reviews drop during prerelease week (~4 days before Arena launch or ~7 days before tabletop).
 */
export function isLsvRatingEligible(
  setCodeOrSet: string | { code?: string; lsv_available_at?: string; arena_released_at?: string; released_at?: string }
): boolean {
  if (!setCodeOrSet) return false;
  const upper = typeof setCodeOrSet === 'string' ? setCodeOrSet.toUpperCase().trim() : (setCodeOrSet.code || '').toUpperCase().trim();

  // 1. If database data exists, always eligible
  if (LIVE_PRO_RATINGS[upper] && Object.keys(LIVE_PRO_RATINGS[upper]!).length > 0) {
    return true;
  }

  const setInfo = typeof setCodeOrSet === 'object' && setCodeOrSet.lsv_available_at
    ? setCodeOrSet
    : POPULAR_LIMITED_SETS.find((s) => s.code.toUpperCase() === upper);

  if (!setInfo) return true;

  // 2. Check lsv_available_at date
  if (setInfo.lsv_available_at) {
    const targetTime = new Date(setInfo.lsv_available_at.includes('T') ? setInfo.lsv_available_at : `${setInfo.lsv_available_at}T00:00:00Z`).getTime();
    if (!isNaN(targetTime)) {
      return Date.now() >= targetTime;
    }
  }

  // 3. Fallback: reviews drop during prerelease week (~4 days before Arena launch or ~7 days before tabletop)
  if (setInfo.arena_released_at) {
    const arenaTime = new Date(setInfo.arena_released_at.includes('T') ? setInfo.arena_released_at : `${setInfo.arena_released_at}T00:00:00Z`).getTime();
    return Date.now() >= (arenaTime - 4 * 24 * 60 * 60 * 1000);
  }

  if (setInfo.released_at) {
    const relTime = new Date(setInfo.released_at.includes('T') ? setInfo.released_at : `${setInfo.released_at}T00:00:00Z`).getTime();
    return Date.now() >= (relTime - 7 * 24 * 60 * 60 * 1000);
  }

  return true;
}

/**
 * Get LSV pre-release rating for a card.
 * Sourced from Supabase database pro_card_ratings, official Limited Resources / CFB reviews,
 * with empirical calibration fallback for released sets.
 */
export function getLsvRatingForCard(card: Card, setCode?: string): LsvCardRating | null {
  const setUpper = (setCode || card.set || '').toUpperCase().trim();
  const cardName = card.name.trim();

  // Kick off background load if not yet populated
  if (!LIVE_PRO_RATINGS[setUpper] && !PENDING_PRO_RATING_FETCHES[setUpper] && isSupabaseConfigured()) {
    loadProRatingsForSet(setUpper).catch(() => {});
  }

  // 1. Check live database / IDB cache first
  const liveSet = LIVE_PRO_RATINGS[setUpper];
  if (liveSet) {
    if (liveSet[cardName]) return liveSet[cardName];
    if (cardName.includes(' // ')) {
      const frontFace = cardName.split(' // ')[0].trim();
      if (liveSet[frontFace]) return liveSet[frontFace];
    }
    const norm = (s: string) => s.toLowerCase().replace(/['’".,\-]/g, '').trim();
    const target = norm(cardName);
    const entry = Object.entries(liveSet).find(([k]) => norm(k) === target);
    if (entry) return entry[1];
  }

  // 2. Automatically check if LSV set reviews are released based on the set schedule
  if (!isLsvRatingEligible(setUpper)) {
    return null;
  }

  // 3. Realistic empirical estimation for released sets where manual transcription is pending
  const rarity = (card.rarity || 'common').toLowerCase();
  let baseScore = 2.5;
  if (rarity === 'mythic') baseScore = 4.0;
  else if (rarity === 'rare') baseScore = 3.5;
  else if (rarity === 'uncommon') baseScore = 3.0;
  else baseScore = 2.5;

  if (card.is_removal) baseScore += 0.5;
  if (card.cmc && card.cmc <= 2 && (card.is_creature || card.is_removal)) baseScore += 0.5;
  if (card.cmc && card.cmc >= 7 && !card.is_removal) baseScore -= 0.5;

  const clamped = Math.max(1.0, Math.min(5.0, Math.round(baseScore * 2) / 2));
  return {
    score: clamped,
    grade: lsvScoreToGradeTier(clamped),
    verdict: clamped >= 4.5 ? 'Bomb' : clamped >= 3.5 ? 'High Pick' : clamped >= 2.5 ? 'Solid Playable' : clamped >= 1.5 ? 'Filler' : 'Unplayable',
    isEstimated: true,
  };
}
