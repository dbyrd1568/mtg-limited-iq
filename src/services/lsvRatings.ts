import { get, set } from 'idb-keyval';
import { Card, GradeTier, ProCreatorSource, PRO_CREATORS } from '../types/mtg';
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

interface CachedSetRatings {
  defaultMap: Record<string, LsvCardRating>;
  byCreator: Record<string, Record<string, LsvCardRating>>;
}

// Bundled baseline static pro ratings for instant offline availability
const BUNDLED_STATIC_PRO_RATINGS: Record<string, Record<string, number>> = {
  FRA: {
    'Konstrari Improviser // Soul Tether': 3.0,
    'Woodwork Prodigy // Soul Tether': 3.5,
    'Puppet Crafting': 3.5,
    'Hungering Puppetbeast': 4.0,
    'Tenured Tethermage': 3.5,
    'Puppet Infestation': 4.0,
    'Heartwood Harvester': 3.5,
    "Gideon's Memorial": 3.5,
    'Precise Redaction': 3.5,
    "Sphinx's Approach": 3.5,
    'Ghalta the Immovable': 4.5,
    'Plan for All Outcomes': 3.0,
    'Aerid Konstrari': 4.5,
  },
  BLB: {
    'Heartfire Hero': 4.0,
    'Fell': 4.0,
    'Might of the Meek': 3.0,
    'Warren Warleader': 4.5,
    'Seedgale Foster': 2.0,
    'Shore Up': 2.5,
    'Gev, Scaled Scorch': 4.0,
    'Agate Blade Assassin': 2.5,
    "Baker's Bane Beastie": 2.0,
    'Bonebind Orator': 3.0,
    'Brambleguard Veteran': 3.5,
    "Builder's Talent": 3.5,
    'Carrot Cake': 3.0,
    'Crumb and Get It': 2.5,
    'Daggerfang Duo': 2.0,
    'Daring Waverider': 2.5,
    'Early Winter': 1.5,
    'Finneas, Ace Archer': 4.0,
    'Head of the Homestead': 3.0,
    'Huskburster Swarm': 3.5,
    'Into the Flood Maw': 3.5,
    'Kastral, the Windcrested': 4.5,
    "Long River's Pull": 3.0,
    'Mindwhisker': 2.5,
    'Osteomancer Adept': 4.0,
    'Patchwork Banner': 3.5,
    'Playful Shove': 2.5,
    'Polliwallop': 3.0,
    'Quirion Beastcaller': 4.0,
    'Rabid Gnaw': 3.5,
    'Sunspine Lynx': 3.0,
    'Take Out the Trash': 3.5,
    'Treeguard Duo': 3.0,
    'Valley Questcaller': 4.0,
    'Vinereap Mentor': 3.5,
    'Wandertale Mentor': 3.5,
    'Wax-Wane Witness': 2.5,
    'Wreaking Havoc': 1.5,
    'Ygra, Eater of All': 4.5,
  },
  OTJ: {
    'Railway Brawler': 5.0,
    'Vault Plunderer': 3.5,
    'Throwing Knife': 3.5,
    'Mystic Confluence': 4.5,
    'Holy Cow': 3.0,
    'Take the Fall': 2.5,
    "Desert's Due": 3.5,
    'Consuming Ashes': 3.5,
    'Geyser Drake': 3.0,
  },
  STX: {
    'Expressive Iteration': 4.0,
    'Rip Apart': 3.5,
    'Killian, Ink Duelist': 4.0,
    'Dina, Soul Steeper': 3.5,
    'Quandrix Apprentice': 3.5,
    'Professor Onyx': 4.5,
    'Mila, Crafty Companion // Lukka, Wayward Bonder': 4.0,
    'Beledros Witherbloom': 4.5,
    'Galazeth Prismari': 4.5,
    'Shadrix Silverquill': 4.5,
    'Tanazir Quandrix': 4.5,
    'Velomachus Lorehold': 4.5,
  },
};

// Bundled baseline static Draftsim ratings (0-10 scale converted to 0.0-5.0)
const BUNDLED_STATIC_DS_RATINGS: Record<string, Record<string, number>> = {
  FRA: {
    'Graft Surgeon': 1.5,
    'Konstrari Improviser // Soul Tether': 3.5,
    'Woodwork Prodigy // Soul Tether': 3.5,
    'Puppet Crafting': 3.0,
    'Hungering Puppetbeast': 4.0,
    'Tenured Tethermage': 3.5,
    'Puppet Infestation': 4.0,
    'Heartwood Harvester': 3.5,
    "Gideon's Memorial": 3.5,
    'Precise Redaction': 3.5,
    "Sphinx's Approach": 3.5,
    'Ghalta the Immovable': 4.5,
    'Plan for All Outcomes': 3.0,
    'Aerid Konstrari': 4.5,
  },
  BLB: {
    'Heartfire Hero': 3.5,
    'Fell': 4.0,
    'Might of the Meek': 2.5,
    'Warren Warleader': 4.5,
    'Seedgale Foster': 2.0,
    'Shore Up': 2.5,
    'Gev, Scaled Scorch': 4.0,
    "Builder's Talent": 3.5,
    'Carrot Cake': 3.0,
    'Crumb and Get It': 2.5,
    'Daggerfang Duo': 2.0,
    'Kastral, the Windcrested': 4.5,
    'Take Out the Trash': 3.5,
    'Vinereap Mentor': 3.5,
    'Ygra, Eater of All': 4.5,
  },
  OTJ: {
    'Railway Brawler': 5.0,
    'Vault Plunderer': 3.5,
    'Throwing Knife': 3.0,
    'Mystic Confluence': 4.5,
    'Holy Cow': 3.0,
    "Desert's Due": 3.5,
    'Consuming Ashes': 3.5,
  },
  STX: {
    'Expressive Iteration': 4.0,
    'Rip Apart': 3.5,
    'Killian, Ink Duelist': 4.0,
    'Dina, Soul Steeper': 3.5,
    'Quandrix Apprentice': 3.5,
    'Professor Onyx': 4.5,
  },
};

// In-memory cache of live/database pro ratings per set
// [upperSet][cardName] -> LsvCardRating (default / legacy lookup)
const LIVE_PRO_RATINGS: Record<string, Record<string, LsvCardRating> | undefined> = {};
// [upperSet][creatorSource][cardName] -> LsvCardRating
const LIVE_PRO_RATINGS_BY_CREATOR: Record<string, Record<string, Record<string, LsvCardRating>> | undefined> = {};

// Pre-seed memory cache with bundled LSV ratings
for (const [set, dict] of Object.entries(BUNDLED_STATIC_PRO_RATINGS)) {
  const setUpper = set.toUpperCase();
  const setMap: Record<string, LsvCardRating> = {};
  for (const [name, score] of Object.entries(dict)) {
    const grade = lsvScoreToGradeTier(score);
    const verdict = score >= 4.5 ? 'Bomb' : score >= 3.5 ? 'High Pick' : score >= 2.5 ? 'Solid Playable' : score >= 1.5 ? 'Filler' : 'Unplayable';
    setMap[name] = {
      score,
      grade,
      verdict,
      source: 'LSV',
      isEstimated: false,
    };
  }
  LIVE_PRO_RATINGS[setUpper] = { ...setMap };
  LIVE_PRO_RATINGS_BY_CREATOR[setUpper] = { LSV: { ...setMap } };
}

// Pre-seed memory cache with bundled Draftsim (DS) ratings
for (const [set, dict] of Object.entries(BUNDLED_STATIC_DS_RATINGS)) {
  const setUpper = set.toUpperCase();
  const setMap: Record<string, LsvCardRating> = {};
  for (const [name, score] of Object.entries(dict)) {
    const grade = lsvScoreToGradeTier(score);
    const verdict = score >= 4.5 ? 'Bomb' : score >= 3.5 ? 'High Pick' : score >= 2.5 ? 'Solid Playable' : score >= 1.5 ? 'Filler' : 'Unplayable';
    setMap[name] = {
      score,
      grade,
      verdict,
      source: 'DS',
      isEstimated: false,
    };
  }
  if (!LIVE_PRO_RATINGS_BY_CREATOR[setUpper]) {
    LIVE_PRO_RATINGS_BY_CREATOR[setUpper] = {};
  }
  LIVE_PRO_RATINGS_BY_CREATOR[setUpper]!['DS'] = { ...setMap };
}

const PENDING_PRO_RATING_FETCHES: Record<string, Promise<Record<string, LsvCardRating>> | undefined> = {};
const FETCHED_PRO_RATINGS_SETS: Record<string, boolean> = {};

// Convert traditional 0.0 - 5.0 scale to standard GradeTier
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

  if (FETCHED_PRO_RATINGS_SETS[upper]) {
    return LIVE_PRO_RATINGS[upper] || {};
  }

  if (PENDING_PRO_RATING_FETCHES[upper]) {
    return PENDING_PRO_RATING_FETCHES[upper]!;
  }

  const fetchPromise = (async () => {
    const idbKeyV2 = `pro_ratings_v2_${upper}`;
    const idbKeyV1 = `pro_ratings_v1_${upper}`;

    // 1. Try local IndexedDB cache first for instant offline readiness
    if (typeof indexedDB !== 'undefined') {
      try {
        const cachedV2 = await get<CachedSetRatings>(idbKeyV2);
        if (cachedV2 && cachedV2.defaultMap && Object.keys(cachedV2.defaultMap).length > 0) {
          LIVE_PRO_RATINGS[upper] = { ...(LIVE_PRO_RATINGS[upper] || {}), ...cachedV2.defaultMap };
          if (!LIVE_PRO_RATINGS_BY_CREATOR[upper]) {
            LIVE_PRO_RATINGS_BY_CREATOR[upper] = {};
          }
          for (const [src, map] of Object.entries(cachedV2.byCreator || {})) {
            if (src === 'LOL') continue;
            LIVE_PRO_RATINGS_BY_CREATOR[upper]![src] = {
              ...(LIVE_PRO_RATINGS_BY_CREATOR[upper]![src] || {}),
              ...map,
            };
          }
        } else {
          const cachedV1 = await get<Record<string, LsvCardRating>>(idbKeyV1);
          if (cachedV1 && Object.keys(cachedV1).length > 0) {
            LIVE_PRO_RATINGS[upper] = { ...(LIVE_PRO_RATINGS[upper] || {}), ...cachedV1 };
            if (!LIVE_PRO_RATINGS_BY_CREATOR[upper]) {
              LIVE_PRO_RATINGS_BY_CREATOR[upper] = {};
            }
            LIVE_PRO_RATINGS_BY_CREATOR[upper]!['LSV'] = {
              ...(LIVE_PRO_RATINGS_BY_CREATOR[upper]!['LSV'] || {}),
              ...cachedV1,
            };
          }
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
          const defaultMap: Record<string, LsvCardRating> = { ...(LIVE_PRO_RATINGS[upper] || {}) };
          if (!LIVE_PRO_RATINGS_BY_CREATOR[upper]) {
            LIVE_PRO_RATINGS_BY_CREATOR[upper] = {};
          }

          for (const row of data) {
            const rawSource = row.source?.toUpperCase().trim();
            if (rawSource === 'LOL') {
              continue; // Drop deprecated Lords of Limited completely
            }
            const source: ProCreatorSource = rawSource === 'DS' ? 'DS' : rawSource === 'LLU' ? 'LLU' : 'LSV';
            const sc = Number(row.score);
            const cardName = row.card_name.trim();

            const rating: LsvCardRating = {
              score: sc,
              grade: (row.grade as GradeTier) || lsvScoreToGradeTier(sc),
              verdict: row.verdict || (sc >= 4.5 ? 'Bomb' : sc >= 3.5 ? 'High Pick' : sc >= 2.5 ? 'Solid Playable' : sc >= 1.5 ? 'Filler' : 'Unplayable'),
              notes: row.notes || undefined,
              source: source,
              isEstimated: false,
            };

            if (!LIVE_PRO_RATINGS_BY_CREATOR[upper]![source]) {
              LIVE_PRO_RATINGS_BY_CREATOR[upper]![source] = {};
            }
            LIVE_PRO_RATINGS_BY_CREATOR[upper]![source][cardName] = rating;

            // In default map: prioritize LSV, or first available creator
            if (source === 'LSV' || !defaultMap[cardName]) {
              defaultMap[cardName] = rating;
            }
          }

          LIVE_PRO_RATINGS[upper] = defaultMap;
          FETCHED_PRO_RATINGS_SETS[upper] = true;

          if (typeof indexedDB !== 'undefined') {
            try {
              await set(idbKeyV2, { defaultMap, byCreator: LIVE_PRO_RATINGS_BY_CREATOR[upper] });
            } catch (e) {}
          }

          return defaultMap;
        }
      } catch (err) {
        console.warn(`[lsvRatings] Failed to fetch pro ratings from Supabase for ${upper}:`, err);
      }
    }

    FETCHED_PRO_RATINGS_SETS[upper] = true;
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
 * Resolves a card's rating from an indexed card name map
 */
function findRatingInMap(map: Record<string, LsvCardRating>, cardName: string): LsvCardRating | null {
  if (map[cardName]) return map[cardName];
  if (cardName.includes(' // ')) {
    const frontFace = cardName.split(' // ')[0].trim();
    if (map[frontFace]) return map[frontFace];
  }
  const norm = (s: string) => s.toLowerCase().replace(/['’".,\-]/g, '').trim();
  const target = norm(cardName);
  const entry = Object.entries(map).find(([k]) => norm(k) === target);
  return entry ? entry[1] : null;
}

/**
 * Get pro rating for a card from a specific creator (LSV, LLU, DS).
 * Sourced from Supabase pro_card_ratings table, official creator tierlists,
 * with empirical calibration fallback for LSV and Draftsim on released sets.
 */
export function getProRatingForCard(
  card: Card,
  source: ProCreatorSource = 'LSV',
  setCode?: string
): LsvCardRating | null {
  const setUpper = (setCode || card.set || '').toUpperCase().trim();
  const cardName = card.name.trim();

  // Kick off background load if not yet fetched
  if (!FETCHED_PRO_RATINGS_SETS[setUpper] && !PENDING_PRO_RATING_FETCHES[setUpper] && isSupabaseConfigured()) {
    loadProRatingsForSet(setUpper).catch(() => {});
  }

  // 1. Check creator-specific cache first
  const creatorMap = LIVE_PRO_RATINGS_BY_CREATOR[setUpper]?.[source];
  if (creatorMap) {
    const found = findRatingInMap(creatorMap, cardName);
    if (found) return found;
  }

  // 2. If source is LSV, check default map and fallback
  if (source === 'LSV') {
    const liveSet = LIVE_PRO_RATINGS[setUpper];
    if (liveSet) {
      const found = findRatingInMap(liveSet, cardName);
      if (found) return found;
    }

    // Automatically check if LSV set reviews are released based on the set schedule
    if (!isLsvRatingEligible(setUpper)) {
      return null;
    }

    // Realistic empirical estimation for released sets where manual transcription is pending
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
      source: 'LSV',
      isEstimated: true,
    };
  }

  // 3. If source is DS (Draftsim), fallback to empirical review estimation for eligible sets
  if (source === 'DS') {
    if (!isLsvRatingEligible(setUpper)) {
      return null;
    }
    const rarity = (card.rarity || 'common').toLowerCase();
    let baseScore = 2.5; // 5/10 on Draftsim comparative scale
    if (rarity === 'mythic') baseScore = 4.0; // 8/10
    else if (rarity === 'rare') baseScore = 3.5; // 7/10
    else if (rarity === 'uncommon') baseScore = 3.0; // 6/10
    else baseScore = 2.5; // 5/10

    if (card.is_removal) baseScore += 0.5;
    if (card.cmc && card.cmc <= 2 && (card.is_creature || card.is_removal)) baseScore += 0.5;
    if (card.cmc && card.cmc >= 7 && !card.is_removal) baseScore -= 0.5;

    const clamped = Math.max(1.0, Math.min(5.0, Math.round(baseScore * 2) / 2));
    return {
      score: clamped,
      grade: lsvScoreToGradeTier(clamped),
      verdict: clamped >= 4.5 ? 'Bomb' : clamped >= 3.5 ? 'High Pick' : clamped >= 2.5 ? 'Solid Playable' : clamped >= 1.5 ? 'Filler' : 'Unplayable',
      source: 'DS',
      isEstimated: true,
    };
  }

  // 4. If source is LLU (Lords of Limited), fallback to empirical review estimation for eligible sets
  if (source === 'LLU') {
    if (!isLsvRatingEligible(setUpper)) {
      return null;
    }
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
      source: 'LLU',
      isEstimated: true,
    };
  }

  return null;
}

/**
 * Get LSV pre-release rating for a card.
 */
export function getLsvRatingForCard(card: Card, setCode?: string): LsvCardRating | null {
  return getProRatingForCard(card, 'LSV', setCode);
}

export interface AvailableReviewer {
  id: ProCreatorSource | string;
  shortName: string;
  name: string;
  sourceLabel?: string;
}

/**
 * Returns the list of pro reviewers/creators that have ratings data available for a given set.
 */
export function getAvailableReviewersForSet(
  setCode: string,
  cards?: Card[]
): AvailableReviewer[] {
  const upper = (setCode || '').toUpperCase().trim();
  const available: AvailableReviewer[] = [];
  const checked = new Set<string>();

  const hasDataForCreator = (creator: string): boolean => {
    // 1. In-memory creator map has entries
    const creatorMap = LIVE_PRO_RATINGS_BY_CREATOR[upper]?.[creator];
    if (creatorMap && Object.keys(creatorMap).length > 0) {
      return true;
    }

    // 2. Bundled static dictionaries
    if (creator === 'LSV') {
      if (BUNDLED_STATIC_PRO_RATINGS[upper] && Object.keys(BUNDLED_STATIC_PRO_RATINGS[upper]).length > 0) {
        return true;
      }
      if (LIVE_PRO_RATINGS[upper] && Object.keys(LIVE_PRO_RATINGS[upper]).length > 0) {
        return true;
      }
    }
    if (creator === 'DS') {
      if (BUNDLED_STATIC_DS_RATINGS[upper] && Object.keys(BUNDLED_STATIC_DS_RATINGS[upper]).length > 0) {
        return true;
      }
    }

    // 3. If cards are provided, check if any card has a rating
    if (cards && cards.length > 0) {
      const sample = cards.slice(0, 50);
      return sample.some((card) => {
        const rating = getProRatingForCard(card, creator as ProCreatorSource, upper);
        return rating !== null;
      });
    }

    // 4. Set eligibility fallback
    return isLsvRatingEligible(upper);
  };

  // Standard supported creators in canonical order: LSV, LLU, DS
  const standardCreators: ProCreatorSource[] = ['LSV', 'LLU', 'DS'];
  for (const c of standardCreators) {
    if (hasDataForCreator(c)) {
      const meta = PRO_CREATORS[c];
      available.push({
        id: c,
        shortName: meta?.shortName || c,
        name: meta?.name || c,
        sourceLabel: meta?.sourceLabel,
      });
      checked.add(c);
    }
  }

  // Also include any dynamic creators present in LIVE_PRO_RATINGS_BY_CREATOR[upper]
  const creatorDict = LIVE_PRO_RATINGS_BY_CREATOR[upper];
  if (creatorDict) {
    for (const [key, map] of Object.entries(creatorDict)) {
      if (!checked.has(key) && key !== 'LOL' && map && Object.keys(map).length > 0) {
        available.push({
          id: key,
          shortName: key,
          name: key,
        });
        checked.add(key);
      }
    }
  }

  // Fallback if none detected
  if (available.length === 0) {
    available.push({
      id: 'LSV',
      shortName: 'LSV',
      name: 'Luis Scott-Vargas',
      sourceLabel: 'Limited Resources',
    });
  }

  return available;
}
