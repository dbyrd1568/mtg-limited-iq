import { UserProfileStats, QuizResult, UserCardEvaluation, QuestionCategory, SetMasteryStat, UserAccount } from '../types/mtg';
import { queueStatsSync, queueEvaluationSync, queueEvaluationClearForSet } from './cloudSync';
import { POPULAR_LIMITED_SETS } from './scryfall';
import { isProdEnvironment, isCloudUUID } from './environment';

const USERS_LIST_KEY = 'mtg_users_list_v2';
const ACTIVE_USER_ID_KEY = 'mtg_active_user_id_v2';

// Legacy keys for automatic migration
const LEGACY_STATS_KEY = 'mtg_limited_user_stats_v1';
const LEGACY_EVALS_KEY = 'mtg_limited_card_evaluations_v1';
const LEGACY_LAST_SET_KEY = 'mtg_last_selected_set_code_v1';

const defaultCategories: Record<QuestionCategory, { attempted: number; correct: number }> = {
  p1p1_pick: { attempted: 0, correct: 0 },
  trap_or_sleeper: { attempted: 0, correct: 0 },
  quadrant_role: { attempted: 0, correct: 0 },
  combat_tricks: { attempted: 0, correct: 0 },
  instant_speed: { attempted: 0, correct: 0 },
  mana_cost_and_splash: { attempted: 0, correct: 0 },
  power_toughness: { attempted: 0, correct: 0 },
  archetype_engine: { attempted: 0, correct: 0 },
  card_evaluation: { attempted: 0, correct: 0 },
};

export const defaultStats: UserProfileStats = {
  totalQuizzes: 0,
  totalQuestions: 0,
  totalCorrect: 0,
  overallAccuracy: 0,
  currentStreak: 0,
  bestStreak: 0,
  xp: 0,
  level: 1,
  categories: defaultCategories,
  sets: {},
  missedCards: {},
  recentQuizzes: [],
  lastActive: new Date().toISOString(),
};

// ==================== USER ACCOUNTS MANAGEMENT ====================

export function getAllUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserAccount[];
    // Strictly filter out any unauthenticated local mock accounts ONLY in production
    if (isProdEnvironment()) {
      return parsed.filter((u) => u.provider !== 'local' || isCloudUUID(u.id));
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load users list:', e);
    return [];
  }
}

export function getActiveUser(): UserAccount | null {
  try {
    const users = getAllUsers();
    const activeId = localStorage.getItem(ACTIVE_USER_ID_KEY);
    const found = users.find((u) => u.id === activeId);
    if (found) {
      if (isProdEnvironment() && found.provider === 'local' && !isCloudUUID(found.id)) {
        return null;
      }
      return found;
    }
    // On localhost / dev: provide default Devon Byrd admin account if no active user exists
    if (!isProdEnvironment()) {
      const devUser: UserAccount = {
        id: 'admin_owner_01',
        name: 'Devon Byrd (Local Admin)',
        email: 'dbyrd1568@gmail.com',
        avatarColor: '#8b5cf6',
        provider: 'local',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      return devUser;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function clearActiveUser(): void {
  try {
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
  } catch (e) {
    console.error('Failed to clear active user:', e);
  }
}

export function setActiveUser(user: UserAccount): void {
  try {
    localStorage.setItem(ACTIVE_USER_ID_KEY, user.id);
    const users = getAllUsers();
    const exists = users.some((u) => u.id === user.id);
    const updated = exists
      ? users.map((u) => (u.id === user.id ? { ...u, lastLoginAt: new Date().toISOString() } : u))
      : [...users, { ...user, lastLoginAt: new Date().toISOString() }];
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to set active user:', e);
  }
}

export function createLocalUser(name: string, avatarColor: string = '#8b5cf6'): UserAccount {
  const users = getAllUsers();
  const newUser: UserAccount = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Mage #${users.length + 1}`,
    avatarColor,
    provider: 'local',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const updatedUsers = [...users, newUser];
  localStorage.setItem(USERS_LIST_KEY, JSON.stringify(updatedUsers));
  localStorage.setItem(ACTIVE_USER_ID_KEY, newUser.id);
  return newUser;
}

export function loginWithOAuthProvider(
  provider: 'google' | 'discord' | 'apple',
  profile: {
    id: string;
    name: string;
    email?: string;
    picture?: string;
  }
): UserAccount {
  const users = getAllUsers();
  const providerPrefix = `${provider}_${profile.id}`;
  const existing = users.find((u) => (profile.email && u.email === profile.email) || u.id === providerPrefix);

  const providerColor = provider === 'discord' ? '#5865F2' : provider === 'google' ? '#3b82f6' : '#000000';

  if (existing) {
    const updated: UserAccount = {
      ...existing,
      name: profile.name || existing.name,
      avatarUrl: profile.picture || existing.avatarUrl,
      provider,
      lastLoginAt: new Date().toISOString(),
    };
    const updatedList = users.map((u) => (u.id === updated.id ? updated : u));
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(updatedList));
    localStorage.setItem(ACTIVE_USER_ID_KEY, updated.id);
    return updated;
  }

  const newUser: UserAccount = {
    id: providerPrefix,
    name: profile.name || `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
    email: profile.email,
    avatarUrl: profile.picture,
    avatarColor: providerColor,
    provider,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const updatedList = [...users, newUser];
  localStorage.setItem(USERS_LIST_KEY, JSON.stringify(updatedList));
  localStorage.setItem(ACTIVE_USER_ID_KEY, newUser.id);
  return newUser;
}

export function loginWithGooglePayload(googleProfile: {
  id: string;
  name: string;
  email: string;
  picture?: string;
}): UserAccount {
  return loginWithOAuthProvider('google', googleProfile);
}

export function updateUserAccount(updated: UserAccount): void {
  try {
    const users = getAllUsers().map((u) => (u.id === updated.id ? updated : u));
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to update user account:', e);
  }
}

export function deleteUserAccount(userId: string): void {
  try {
    const users = getAllUsers().filter((u) => u.id !== userId);
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));
    if (users.length > 0) {
      localStorage.setItem(ACTIVE_USER_ID_KEY, users[0].id);
    } else {
      localStorage.removeItem(ACTIVE_USER_ID_KEY);
    }

    // Clean up user specific data
    localStorage.removeItem(`mtg_stats_${userId}`);
    localStorage.removeItem(`mtg_evaluations_${userId}`);
    localStorage.removeItem(`mtg_last_set_${userId}`);
  } catch (e) {
    console.error('Failed to delete user account:', e);
  }
}

function migrateLegacyDataToUser(userId: string): void {
  try {
    const legacyStats = localStorage.getItem(LEGACY_STATS_KEY);
    if (legacyStats && !localStorage.getItem(`mtg_stats_${userId}`)) {
      localStorage.setItem(`mtg_stats_${userId}`, legacyStats);
    }
    const legacyEvals = localStorage.getItem(LEGACY_EVALS_KEY);
    if (legacyEvals && !localStorage.getItem(`mtg_evaluations_${userId}`)) {
      localStorage.setItem(`mtg_evaluations_${userId}`, legacyEvals);
    }
    const legacySet = localStorage.getItem(LEGACY_LAST_SET_KEY);
    if (legacySet && !localStorage.getItem(`mtg_last_set_${userId}`)) {
      localStorage.setItem(`mtg_last_set_${userId}`, legacySet);
    }
  } catch (e) {
    console.warn('Migration of legacy data skipped:', e);
  }
}

// ==================== USER-SCOPED STATS & EVALUATIONS ====================

export function loadUserStats(userId?: string): UserProfileStats {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const raw = localStorage.getItem(`mtg_stats_${activeId}`);
    if (!raw) return defaultStats;
    const parsed = JSON.parse(raw) as Partial<UserProfileStats>;
    return {
      ...defaultStats,
      ...parsed,
      categories: {
        ...defaultCategories,
        ...(parsed.categories || {}),
      },
      sets: parsed.sets || {},
      missedCards: parsed.missedCards || {},
      recentQuizzes: parsed.recentQuizzes || [],
    };
  } catch (e) {
    console.error('Failed to load user stats:', e);
    return defaultStats;
  }
}

export function saveUserStats(stats: UserProfileStats, userId?: string): void {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    stats.lastActive = new Date().toISOString();
    stats.overallAccuracy = stats.totalQuestions > 0 ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) : 0;
    stats.level = Math.max(1, Math.floor(stats.xp / 500) + 1);
    localStorage.setItem(`mtg_stats_${activeId}`, JSON.stringify(stats));
    queueStatsSync(activeId, stats);
  } catch (e) {
    console.error('Failed to save user stats:', e);
  }
}

export function calculateMasteryRank(accuracy: number, attempts: number): 'Novice' | 'Bronze' | 'Silver' | 'Gold' | 'Mythic' {
  if (attempts < 10) return 'Novice';
  if (accuracy >= 92 && attempts >= 50) return 'Mythic';
  if (accuracy >= 80 && attempts >= 30) return 'Gold';
  if (accuracy >= 65 && attempts >= 15) return 'Silver';
  return 'Bronze';
}

export function recordQuizCompletion(result: QuizResult, userId?: string): UserProfileStats {
  const activeId = userId || getActiveUser()?.id || 'guest';
  const stats = loadUserStats(activeId);

  stats.totalQuizzes += 1;
  stats.totalQuestions += result.totalQuestions;
  stats.totalCorrect += result.score;

  // Streak logic
  if (result.percentage >= 70) {
    stats.currentStreak += 1;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
  } else {
    stats.currentStreak = 0;
  }

  // XP Calculation
  const xpEarned = result.score * 25 + (result.percentage >= 90 ? 100 : result.percentage >= 70 ? 50 : 10);
  stats.xp += xpEarned;

  // Category breakdowns
  result.questions.forEach((q) => {
    const answer = result.answers[q.id];
    const cat = q.category;
    if (cat && stats.categories[cat]) {
      stats.categories[cat].attempted += 1;
      if (answer?.isCorrect) {
        stats.categories[cat].correct += 1;
      }
    }

    // Missed Cards tracking
    if (answer && !answer.isCorrect) {
      const cardKey = `${result.setCode}_${q.card.id}`;
      const existing = stats.missedCards[cardKey];
      if (existing) {
        existing.timesMissed += 1;
        existing.timesEncountered += 1;
        existing.lastMissedAt = new Date().toISOString();
        existing.lastQuestionCategory = cat;
        existing.masteryScore = Math.max(0, existing.masteryScore - 15);
      } else {
        stats.missedCards[cardKey] = {
          cardId: q.card.id,
          cardName: q.card.name,
          setCode: result.setCode,
          timesMissed: 1,
          timesEncountered: 1,
          lastMissedAt: new Date().toISOString(),
          lastQuestionCategory: cat,
          masteryScore: 0,
        };
      }
    } else if (answer?.isCorrect) {
      const cardKey = `${result.setCode}_${q.card.id}`;
      const existing = stats.missedCards[cardKey];
      if (existing) {
        existing.timesEncountered += 1;
        existing.masteryScore = Math.min(100, existing.masteryScore + 35);
        if (existing.masteryScore >= 95) {
          delete stats.missedCards[cardKey];
        }
      }
    }
  });

  // Set Mastery Stat
  const setKey = result.setCode.toUpperCase();
  const currentSetStat = stats.sets[setKey] || {
    setCode: result.setCode,
    setName: result.setName,
    quizzesTaken: 0,
    questionsAttempted: 0,
    questionsCorrect: 0,
    accuracy: 0,
    masteryRank: 'Novice',
    lastPracticed: new Date().toISOString(),
  };

  currentSetStat.quizzesTaken += 1;
  currentSetStat.questionsAttempted += result.totalQuestions;
  currentSetStat.questionsCorrect += result.score;
  currentSetStat.accuracy = Math.round(
    (currentSetStat.questionsCorrect / currentSetStat.questionsAttempted) * 100
  );
  currentSetStat.masteryRank = calculateMasteryRank(
    currentSetStat.accuracy,
    currentSetStat.questionsAttempted
  );
  currentSetStat.lastPracticed = new Date().toISOString();
  stats.sets[setKey] = currentSetStat;

  // Recent Quizzes
  stats.recentQuizzes = [result, ...stats.recentQuizzes.slice(0, 19)];

  saveUserStats(stats, activeId);
  return stats;
}

// ==================== USER-SCOPED CARD EVALUATIONS ====================

export function loadUserEvaluations(userId?: string): Record<string, UserCardEvaluation> {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const raw = localStorage.getItem(`mtg_evaluations_${activeId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to load user card evaluations:', e);
    return {};
  }
}

export function saveUserEvaluation(evaluation: UserCardEvaluation, userId?: string): void {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const current = loadUserEvaluations(activeId);
    const key = `${evaluation.setCode.toLowerCase()}_${evaluation.cardName.toLowerCase()}`;
    current[key] = {
      ...evaluation,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`mtg_evaluations_${activeId}`, JSON.stringify(current));
    queueEvaluationSync(activeId, current[key]);
  } catch (e) {
    console.error('Failed to save card evaluation:', e);
  }
}

export function clearUserEvaluationsForSet(setCode: string, userId?: string): Record<string, UserCardEvaluation> {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const current = loadUserEvaluations(activeId);
    const prefix = `${setCode.toLowerCase()}_`;
    const updated: Record<string, UserCardEvaluation> = {};

    for (const [key, val] of Object.entries(current)) {
      if (!key.startsWith(prefix) && val.setCode?.toLowerCase() !== setCode.toLowerCase()) {
        updated[key] = val;
      }
    }

    localStorage.setItem(`mtg_evaluations_${activeId}`, JSON.stringify(updated));
    queueEvaluationClearForSet(activeId, setCode);
    return updated;
  } catch (e) {
    console.error('Failed to clear evaluations for set:', e);
    return {};
  }
}

// ==================== USER-SCOPED SET PREFERENCES ====================

export function isSetFullyGraded(setCode: string, totalCardsCount?: number, userId?: string): boolean {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const evals = loadUserEvaluations(activeId);
    const prefix = `${setCode.toLowerCase()}_`;
    const setEvals = Object.keys(evals).filter(
      k => k.startsWith(prefix) || evals[k].setCode?.toLowerCase() === setCode.toLowerCase()
    );

    // If total card count is provided, check if graded count matches or exceeds total cards
    if (typeof totalCardsCount === 'number' && totalCardsCount > 0) {
      return setEvals.length >= totalCardsCount;
    }

    // Check popular limited sets metadata for card count
    const popularMatch = POPULAR_LIMITED_SETS.find(s => s.code.toUpperCase() === setCode.toUpperCase());
    if (popularMatch && popularMatch.card_count > 0) {
      return setEvals.length >= popularMatch.card_count;
    }

    // If totalCardsCount is unknown, assume incomplete unless user has graded a substantial full set (> 250 cards)
    return setEvals.length >= 250;
  } catch (e) {
    return false;
  }
}

export function getBlindGradingForSet(setCode: string, userId?: string, totalCardsCount?: number): boolean {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const raw = localStorage.getItem(`mtg_blind_grading_${activeId}_${setCode.toUpperCase()}`);
    if (raw !== null) {
      return JSON.parse(raw);
    }
    // Default to "blind mode" (Grading Mode: true) until a set is fully graded
    const fullyGraded = isSetFullyGraded(setCode, totalCardsCount, activeId);
    return !fullyGraded;
  } catch (e) {
    return true; // Default to blind mode
  }
}

export function setBlindGradingForSet(setCode: string, isBlind: boolean, userId?: string): void {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    localStorage.setItem(`mtg_blind_grading_${activeId}_${setCode.toUpperCase()}`, JSON.stringify(isBlind));
  } catch (e) {
    console.error('Failed to save blind grading preference:', e);
  }
}

export function getLastSelectedSetCode(userId?: string): string | null {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    return localStorage.getItem(`mtg_last_set_${activeId}`) || localStorage.getItem(LEGACY_LAST_SET_KEY);
  } catch (e) {
    return null;
  }
}

export function saveLastSelectedSetCode(code: string, userId?: string): void {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    localStorage.setItem(`mtg_last_set_${activeId}`, code.toUpperCase());
    localStorage.setItem(LEGACY_LAST_SET_KEY, code.toUpperCase());
  } catch (e) {
    console.error('Failed to save last selected set code:', e);
  }
}

export function hasSeenWelcomeTour(): boolean {
  try {
    return localStorage.getItem('mtg_has_seen_welcome_tour_v1') === 'true';
  } catch (e) {
    return false;
  }
}

export function setHasSeenWelcomeTour(hasSeen: boolean): void {
  try {
    if (hasSeen) {
      localStorage.setItem('mtg_has_seen_welcome_tour_v1', 'true');
    } else {
      localStorage.removeItem('mtg_has_seen_welcome_tour_v1');
    }
  } catch (e) {
    console.error('Failed to save welcome tour preference:', e);
  }
}

// ==================== 17LANDS TIER LIST SHARING ====================

export function get17LandsTierListUrl(setCode: string, userId?: string): string | null {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const key = `mtg_17lands_tier_url_${activeId}_${setCode.toUpperCase()}`;
    return localStorage.getItem(key) || null;
  } catch (e) {
    return null;
  }
}

export function save17LandsTierListUrl(setCode: string, url: string, userId?: string): void {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const key = `mtg_17lands_tier_url_${activeId}_${setCode.toUpperCase()}`;
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(key, trimmed);
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.error('Failed to save 17Lands tier list URL:', e);
  }
}

// ==================== EXPORT & IMPORT ====================

export function exportUserDataAsJSON(userId?: string): string {
  const activeId = userId || getActiveUser()?.id || 'guest';
  const user = getActiveUser();
  const stats = loadUserStats(activeId);
  const evaluations = loadUserEvaluations(activeId);
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: '2.0',
    user,
    stats,
    evaluations,
  }, null, 2);
}

export function importUserDataFromJSON(jsonString: string, userId?: string): boolean {
  try {
    const activeId = userId || getActiveUser()?.id || 'guest';
    const data = JSON.parse(jsonString);
    if (data.stats) {
      saveUserStats(data.stats, activeId);
    }
    if (data.evaluations) {
      localStorage.setItem(`mtg_evaluations_${activeId}`, JSON.stringify(data.evaluations));
    }
    return true;
  } catch (e) {
    console.error('Failed to import user data:', e);
    return false;
  }
}
