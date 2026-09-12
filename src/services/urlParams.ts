import { Card } from '../types/mtg';
import { ActiveTab } from '../components/Navbar';

export interface AppUrlParams {
  set?: string;
  tab?: ActiveTab;
  subtab?: 'grade' | 'forecast' | 'calibration' | 'notes' | 'methodology' | 'take' | 'stats' | 'overview' | 'users' | 'features' | 'grading' | 'access';
  quiz_subtab?: 'take' | 'stats';
  card?: string; // Collector number (e.g. '12' or '#012'), card name, or ID
  blind?: boolean;
  color?: string;
  status?: 'ALL' | 'RATED' | 'UNRATED';
  category?: string;
  mode?: 'quiz' | 'practice';
}

/**
 * Normalizes tab shorthand queries (e.g. 'grading' -> 'evaluation', 'list' -> 'explorer')
 */
export function normalizeTab(tabParam?: string | null): ActiveTab | undefined {
  if (!tabParam) return undefined;
  const t = tabParam.toLowerCase().trim();
  if (t === 'admin' || t === 'a' || t === 'dashboard') return 'admin';
  if (t === 'quiz' || t === 'q') return 'quiz';
  if (t === 'evaluation' || t === 'eval' || t === 'grading' || t === 'grade' || t === 'hub') return 'evaluation';
  if (t === 'explorer' || t === 'list' || t === 'cards' || t === 'visualizer') return 'explorer';
  if (t === 'stats' || t === 'profile' || t === 'mastery') return 'quiz';
  return undefined;
}

/**
 * Normalizes subtab query inside Card Grading Hub or Admin
 */
export function normalizeSubtab(subParam?: string | null): 'grade' | 'forecast' | 'calibration' | 'notes' | 'methodology' | 'overview' | 'users' | 'features' | 'grading' | 'access' | undefined {
  if (!subParam) return undefined;
  const s = subParam.toLowerCase().trim();
  if (s === 'overview' || s === 'home') return 'overview';
  if (s === 'users' || s === 'drafters') return 'users';
  if (s === 'features' || s === 'telemetry') return 'features';
  if (s === 'grading' || s === 'sets') return 'grading';
  if (s === 'access' || s === 'whitelist' || s === 'security') return 'access';
  if (s === 'grade' || s === 'cards') return 'grade';
  if (s === 'forecast' || s === 'archetype' || s === 'tierlist' || s === 'meta') return 'forecast';
  if (s === 'calibration' || s === 'analytics' || s === 'curve') return 'calibration';
  if (s === 'notes' || s === 'strategy') return 'notes';
  if (s === 'methodology' || s === 'math' || s === 'guide' || s === 'how-it-works' || s === 'rubric') return 'methodology';
  return undefined;
}

/**
 * Normalizes quiz subtab query (Take Quiz vs Mastery Stats)
 */
export function normalizeQuizSubtab(subParam?: string | null, rawTabParam?: string | null): 'take' | 'stats' | undefined {
  if (rawTabParam && (rawTabParam.toLowerCase().trim() === 'stats' || rawTabParam.toLowerCase().trim() === 'mastery')) {
    return 'stats';
  }
  if (!subParam) return undefined;
  const s = subParam.toLowerCase().trim();
  if (s === 'stats' || s === 'mastery' || s === 'analytics' || s === 'profile') return 'stats';
  if (s === 'take' || s === 'quiz' || s === 'play') return 'take';
  return undefined;
}

/**
 * Parse current URL query params into AppUrlParams
 */
export function parseAppUrlParams(searchString?: string): AppUrlParams {
  const search = searchString !== undefined ? searchString : (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);

  const rawTab = params.get('tab') || params.get('t');
  const set = params.get('set') || params.get('s') || undefined;
  const tab = normalizeTab(rawTab);
  const subtab = normalizeSubtab(params.get('subtab') || params.get('sub'));
  const quiz_subtab = normalizeQuizSubtab(params.get('subtab') || params.get('sub') || params.get('quiz_subtab'), rawTab);
  const card = params.get('card') || params.get('c') || undefined;
  const blindParam = params.get('blind');
  const blind = blindParam !== null ? blindParam === 'true' || blindParam === '1' : undefined;
  const color = params.get('color') || params.get('col') || undefined;
  const statusParam = params.get('status')?.toUpperCase();
  const status = statusParam === 'RATED' || statusParam === 'UNRATED' ? (statusParam as 'RATED' | 'UNRATED') : undefined;
  const category = params.get('category') || params.get('cat') || undefined;
  const mode = (params.get('mode') === 'practice' || params.get('mode') === 'quiz') ? (params.get('mode') as 'quiz' | 'practice') : undefined;

  return {
    set: set ? set.toUpperCase().trim() : undefined,
    tab,
    subtab,
    quiz_subtab,
    card: card ? card.trim() : undefined,
    blind,
    color,
    status,
    category,
    mode,
  };
}

/**
 * Updates the browser URL query params without reloading the page
 */
export function updateAppUrlParams(updates: Partial<AppUrlParams>, replace = true): void {
  try {
    if (typeof window === 'undefined') return;
    const currentParams = new URLSearchParams(window.location.search);

    // Apply or delete parameters
    Object.entries(updates).forEach(([key, value]) => {
      let paramKey = key;
      if (key === 'tab') paramKey = 'tab';
      if (key === 'subtab') paramKey = 'subtab';
      if (key === 'set') paramKey = 'set';
      if (key === 'card') paramKey = 'card';

      if (value === undefined || value === null || value === '') {
        currentParams.delete(paramKey);
      } else if (typeof value === 'boolean') {
        currentParams.set(paramKey, String(value));
      } else {
        currentParams.set(paramKey, String(value));
      }
    });

    const queryString = currentParams.toString();
    const newRelativePathQuery = window.location.pathname + (queryString ? `?${queryString}` : '');

    if (replace) {
      window.history.replaceState(null, '', newRelativePathQuery);
    } else {
      window.history.pushState(null, '', newRelativePathQuery);
    }
  } catch (err) {
    console.warn('Could not update URL search params:', err);
  }
}

/**
 * Finds a card from the set matching a URL identifier:
 * 1. By collector number (#015 or '15' or '015')
 * 2. By card name (case-insensitive)
 * 3. By Scryfall card ID
 */
export function findCardByUrlIdentifier(cards: Card[], identifier?: string | null): Card | null {
  if (!identifier || cards.length === 0) return null;

  const raw = identifier.trim();
  const cleanNumber = raw.replace(/^#/, '');

  // 1. Check exact collector number match (e.g. '015', '15')
  const byCollectorNumber = cards.find((c) => {
    if (!c.collector_number) return false;
    if (c.collector_number === raw || c.collector_number === cleanNumber) return true;
    const cNum = parseInt(c.collector_number, 10);
    const targetNum = parseInt(cleanNumber, 10);
    return !isNaN(cNum) && !isNaN(targetNum) && cNum === targetNum;
  });
  if (byCollectorNumber) return byCollectorNumber;

  // 2. Check card name match (case-insensitive)
  const normalizedName = raw.toLowerCase().replace(/['"]/g, '');
  const byName = cards.find((c) => {
    if (!c.name) return false;
    const cName = c.name.toLowerCase().replace(/['"]/g, '');
    return cName === normalizedName || cName.includes(normalizedName);
  });
  if (byName) return byName;

  // 3. Check card UUID
  const byId = cards.find((c) => c.id === raw);
  if (byId) return byId;

  return null;
}

/**
 * Builds a direct troubleshooting shareable URL
 */
export function buildTroubleshootingUrl(params: AppUrlParams): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin + window.location.pathname);
  if (params.set) url.searchParams.set('set', params.set);
  if (params.tab) url.searchParams.set('tab', params.tab);
  if (params.subtab) url.searchParams.set('subtab', params.subtab);
  if (params.card) url.searchParams.set('card', params.card);
  if (params.blind !== undefined) url.searchParams.set('blind', String(params.blind));
  if (params.color) url.searchParams.set('color', params.color);
  if (params.status) url.searchParams.set('status', params.status);
  return url.toString();
}
