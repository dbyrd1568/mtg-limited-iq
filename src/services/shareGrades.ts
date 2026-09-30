import { supabase, isSupabaseConfigured } from './supabase';
import { GradeTier, UserCardEvaluation, UserArchetypeEvaluation } from '../types/mtg';

export interface SharedCardGrade {
  cardName: string;
  userGrade: GradeTier;
  userScore: number;
  pickPriority: '1st Pick Bomb' | 'Early Pick' | 'Mid Pick' | 'Late Filler' | 'Sideboard / Unplayable';
  notes?: string;
}

export interface SharedArchetypeGrade {
  archetypeCode: string;
  userGrade: GradeTier;
  userScore: number;
  role?: string;
  notes?: string;
}

export interface SharedGradeSummary {
  totalGraded: number;
  gpa: number; // e.g. 2.75 / 4.0 scale
  distribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  topBombs: string[]; // Up to 5 A/A+ cards
}

export interface PublicGradeShare {
  id: string;
  userId?: string;
  setCode: string;
  authorName: string;
  title?: string;
  includeNotes: boolean;
  grades: Record<string, SharedCardGrade>;
  archetypeGrades?: Record<string, SharedArchetypeGrade>;
  summary: SharedGradeSummary;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_SHARES_KEY = 'mtg_public_grade_shares_cache_v1';

/**
 * Strict sanitization for user-generated notes to prevent stored XSS attacks
 */
export function sanitizeNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const stripped = notes
    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: pseudo-protocol
    .replace(/data:\s*text\/html/gi, '')
    .trim();
  // Bound max length to prevent payload inflation
  return stripped.slice(0, 1000);
}

/**
 * Calculates grade point average (0.0 to 4.0) and tier distribution
 */
export function calculateGradeSummary(grades: Record<string, SharedCardGrade>): SharedGradeSummary {
  const entries = Object.values(grades).filter((g) => Boolean(g.userGrade && g.userGrade !== 'N/A'));
  const totalGraded = entries.length;

  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let scoreSum = 0;
  const topBombs: string[] = [];

  for (const item of entries) {
    const tier = item.userGrade.charAt(0) as 'A' | 'B' | 'C' | 'D' | 'F';
    if (distribution[tier] !== undefined) {
      distribution[tier]++;
    }

    if (tier === 'A') {
      topBombs.push(item.cardName);
    }

    // Map userScore (0-5) to GPA (0-4)
    scoreSum += (item.userScore / 5) * 4;
  }

  const gpa = totalGraded > 0 ? Number((scoreSum / totalGraded).toFixed(2)) : 0;

  return {
    totalGraded,
    gpa,
    distribution,
    topBombs: topBombs.slice(0, 5),
  };
}

/**
 * Creates or updates a public grade share snapshot in Supabase
 */
export async function createOrUpdateGradeShare(params: {
  userId: string;
  setCode: string;
  authorName: string;
  evaluations: Record<string, UserCardEvaluation>;
  archetypeEvaluations?: Record<string, UserArchetypeEvaluation>;
  includeNotes: boolean;
  existingShareId?: string;
}): Promise<{ share: PublicGradeShare; url: string }> {
  const {
    userId,
    setCode,
    authorName,
    evaluations,
    archetypeEvaluations = {},
    includeNotes,
    existingShareId,
  } = params;

  // Filter and sanitize card grades for this set
  const cleanGrades: Record<string, SharedCardGrade> = {};
  for (const [key, ev] of Object.entries(evaluations)) {
    if (ev.setCode.toUpperCase() === setCode.toUpperCase() && ev.userGrade && ev.userGrade !== 'N/A') {
      cleanGrades[ev.cardName] = {
        cardName: ev.cardName,
        userGrade: ev.userGrade,
        userScore: ev.userScore,
        pickPriority: ev.pickPriority,
        notes: includeNotes ? sanitizeNotes(ev.notes) : undefined,
      };
    }
  }

  // Filter archetype evaluations for this set
  const cleanArchetypes: Record<string, SharedArchetypeGrade> = {};
  for (const [key, arch] of Object.entries(archetypeEvaluations)) {
    if (arch.setCode.toUpperCase() === setCode.toUpperCase() && arch.userGrade && arch.userGrade !== 'N/A') {
      cleanArchetypes[arch.archetypeCode] = {
        archetypeCode: arch.archetypeCode,
        userGrade: arch.userGrade,
        userScore: arch.userScore,
        role: arch.roleInMetagame,
        notes: includeNotes ? sanitizeNotes(arch.notes) : undefined,
      };
    }
  }

  const summary = calculateGradeSummary(cleanGrades);
  const now = new Date().toISOString();

  // If Supabase is available and user is authenticated
  if (isSupabaseConfigured() && userId && !userId.startsWith('guest')) {
    const payload = {
      user_id: userId,
      set_code: setCode.toUpperCase(),
      author_name: authorName.trim() || 'Anonymous Drafter',
      include_notes: includeNotes,
      grades_json: cleanGrades,
      archetype_grades_json: cleanArchetypes,
      summary_json: summary,
      is_active: true,
      updated_at: now,
    };

    let resultId = existingShareId;

    if (existingShareId) {
      const { data, error } = await supabase
        .from('public_grade_shares')
        .update(payload)
        .eq('id', existingShareId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.warn('Failed to update share in Supabase, falling back to insert:', error);
      } else if (data) {
        resultId = data.id;
      }
    }

    if (!resultId) {
      const { data, error } = await supabase
        .from('public_grade_shares')
        .insert({
          ...payload,
          view_count: 0,
          created_at: now,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to create share: ${error?.message || 'No data returned'}`);
      }
      resultId = data.id;
    }

    if (!resultId) {
      throw new Error('Failed to create share ID');
    }

    const share: PublicGradeShare = {
      id: resultId,
      userId,
      setCode: setCode.toUpperCase(),
      authorName: payload.author_name,
      includeNotes,
      grades: cleanGrades,
      archetypeGrades: cleanArchetypes,
      summary,
      isActive: true,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    saveLocalShareCache(share);
    return { share, url: getShareUrl(resultId) };
  }

  // Fallback: Local Client-Side Share (for local dev or offline mode)
  const localId = existingShareId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`);
  const localShare: PublicGradeShare = {
    id: localId,
    userId,
    setCode: setCode.toUpperCase(),
    authorName: authorName.trim() || 'Anonymous Drafter',
    includeNotes,
    grades: cleanGrades,
    archetypeGrades: cleanArchetypes,
    summary,
    isActive: true,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  saveLocalShareCache(localShare);
  return { share: localShare, url: getShareUrl(localId) };
}

/**
 * Fetches a public grade share by ID (Unguessable UUID)
 */
export async function fetchGradeShareById(shareId: string): Promise<PublicGradeShare | null> {
  if (!shareId || typeof shareId !== 'string') return null;
  const cleanId = shareId.trim();

  // 1. Try fetching from Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('public_grade_shares')
        .select('id, user_id, set_code, author_name, title, include_notes, grades_json, archetype_grades_json, summary_json, is_active, view_count, created_at, updated_at')
        .eq('id', cleanId)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        // Increment view count asynchronously
        void Promise.resolve(supabase.rpc('increment_share_views', { share_id: cleanId })).catch(() => {});

        return {
          id: data.id,
          userId: data.user_id,
          setCode: data.set_code,
          authorName: data.author_name || 'Anonymous Drafter',
          title: data.title,
          includeNotes: data.include_notes ?? true,
          grades: data.grades_json || {},
          archetypeGrades: data.archetype_grades_json || {},
          summary: data.summary_json || calculateGradeSummary(data.grades_json || {}),
          isActive: data.is_active,
          viewCount: data.view_count || 0,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch (err) {
      console.warn('Error fetching share from Supabase:', err);
    }
  }

  // 2. Check local share cache
  const cached = getLocalShareCache(cleanId);
  if (cached && cached.isActive) {
    return cached;
  }

  return null;
}

/**
 * Revokes an existing grade share
 */
export async function revokeGradeShare(shareId: string, userId: string): Promise<boolean> {
  if (!shareId) return false;

  // Supabase revocation
  if (isSupabaseConfigured() && userId && !userId.startsWith('guest')) {
    const { error } = await supabase
      .from('public_grade_shares')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', shareId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to revoke share in Supabase:', error);
      return false;
    }
  }

  // Update local cache
  const cached = getLocalShareCache(shareId);
  if (cached) {
    cached.isActive = false;
    saveLocalShareCache(cached);
  }

  return true;
}

/**
 * Constructs the canonical share URL
 */
export function getShareUrl(shareId: string): string {
  if (typeof window === 'undefined') return `/?share=${shareId}`;
  const origin = window.location.origin;
  const path = window.location.pathname;
  return `${origin}${path}?share=${shareId}`;
}

/**
 * Local storage caching helpers for share links
 */
function getLocalShares(): Record<string, PublicGradeShare> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(LOCAL_STORAGE_SHARES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalShareCache(share: PublicGradeShare): void {
  try {
    if (typeof window === 'undefined') return;
    const all = getLocalShares();
    all[share.id] = share;
    localStorage.setItem(LOCAL_STORAGE_SHARES_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('Could not save share cache:', err);
  }
}

export function getLocalShareCache(shareId: string): PublicGradeShare | null {
  const all = getLocalShares();
  return all[shareId] || null;
}

export function findActiveShareForSet(userId: string, setCode: string): PublicGradeShare | null {
  const all = getLocalShares();
  const match = Object.values(all).find(
    (s) => s.setCode.toUpperCase() === setCode.toUpperCase() && s.userId === userId && s.isActive
  );
  return match || null;
}
