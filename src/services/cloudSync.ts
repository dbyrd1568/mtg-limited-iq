import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfileStats, UserCardEvaluation } from '../types/mtg';
import { loadUserStats, saveUserStats, loadUserEvaluations, getActiveUser } from './storage';
import { isCloudUUID } from './auth';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'local_only' | 'error';

type SyncListener = (status: SyncStatus) => void;
const syncListeners: Set<SyncListener> = new Set();
let currentSyncStatus: SyncStatus = !isSupabaseConfigured()
  ? 'local_only'
  : typeof navigator !== 'undefined' && !navigator.onLine
  ? 'offline'
  : 'synced';

let lastSyncErrorMessage: string | null = null;

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function getLastSyncError(): string | null {
  return lastSyncErrorMessage;
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncListeners.delete(listener);
  };
}

function setSyncStatus(status: SyncStatus, errorMessage?: string | null): void {
  currentSyncStatus = status;
  if (errorMessage !== undefined) {
    lastSyncErrorMessage = errorMessage;
  } else if (status === 'synced') {
    lastSyncErrorMessage = null;
  }
  syncListeners.forEach((l) => l(status));
}

// ==================== REAL-TIME CONNECTIVITY LISTENER ====================

let pendingStatsSync: { userId: string; stats: UserProfileStats } | null = null;
const evalSyncQueue: Map<string, { userId: string; evaluation: UserCardEvaluation }> = new Map();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (!isSupabaseConfigured()) {
      setSyncStatus('local_only');
      return;
    }
    setSyncStatus('synced');
    flushPendingSyncs();
  });

  window.addEventListener('offline', () => {
    setSyncStatus('offline');
  });
}

function flushPendingSyncs(): void {
  if (pendingStatsSync) {
    const { userId, stats } = pendingStatsSync;
    pendingStatsSync = null;
    queueStatsSync(userId, stats);
  }

  if (evalSyncQueue.size > 0) {
    const sampleItem = evalSyncQueue.values().next().value;
    if (sampleItem) {
      triggerEvaluationBatchSync(sampleItem.userId);
    }
  }
}

// ==================== DEBOUNCED SYNC ENGINE ====================

let statsSyncTimer: any = null;
let evalSyncTimer: any = null;

export function queueStatsSync(userId: string, stats: UserProfileStats): void {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    setSyncStatus('local_only');
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    pendingStatsSync = { userId, stats };
    setSyncStatus('offline');
    return;
  }

  setSyncStatus('syncing');
  if (statsSyncTimer) clearTimeout(statsSyncTimer);

  statsSyncTimer = setTimeout(async () => {
    try {
      // Ensure there is an active session matching userId before making authenticated requests
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== userId) {
        // Session not ready or mismatch; defer rather than causing 42501 RLS error
        return;
      }

      const xp = Number.isFinite(stats.xp) ? Math.round(stats.xp) : 0;
      const level = Number.isFinite(stats.level) ? Math.max(1, Math.round(stats.level)) : 1;
      const accuracy = Number.isFinite(stats.overallAccuracy)
        ? Math.max(0, Math.min(100, Math.round(stats.overallAccuracy)))
        : stats.totalQuestions > 0
        ? Math.max(0, Math.min(100, Math.round((stats.totalCorrect / stats.totalQuestions) * 100)))
        : 0;

      const { error } = await supabase.from('user_stats').upsert(
        {
          user_id: userId,
          xp,
          level,
          overall_accuracy: accuracy,
          stats_json: stats,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        console.warn('Failed to sync stats to Supabase:', error);
        setSyncStatus('error', error.message);
      } else {
        setSyncStatus('synced');
        pendingStatsSync = null;
      }
    } catch (e: any) {
      console.warn('Network error while syncing stats:', e);
      setSyncStatus(navigator.onLine ? 'error' : 'offline', e?.message || 'Network error');
    }
  }, 1200);
}

export function queueEvaluationSync(userId: string, evaluation: UserCardEvaluation): void {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    setSyncStatus('local_only');
    return;
  }

  const key = `${evaluation.setCode.toUpperCase()}_${evaluation.cardName.toLowerCase()}`;
  evalSyncQueue.set(key, { userId, evaluation });

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setSyncStatus('offline');
    return;
  }

  setSyncStatus('syncing');
  if (evalSyncTimer) clearTimeout(evalSyncTimer);

  evalSyncTimer = setTimeout(() => {
    triggerEvaluationBatchSync(userId);
  }, 1200);
}

async function triggerEvaluationBatchSync(userId: string): Promise<void> {
  const itemsToSync = Array.from(evalSyncQueue.values()).filter((item) => item.userId === userId);
  if (itemsToSync.length === 0) return;

  // Verify active session before upserting
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) {
    return;
  }

  // Deduplicate batch by user_id + set_code + card_name to prevent Postgres ON CONFLICT DO UPDATE errors
  const deduplicatedMap = new Map<string, any>();
  for (const { evaluation } of itemsToSync) {
    if (!evaluation?.cardName || !evaluation?.setCode) continue;
    const key = `${evaluation.setCode.toUpperCase()}:::${evaluation.cardName.toLowerCase()}`;
    deduplicatedMap.set(key, {
      user_id: userId,
      set_code: evaluation.setCode.toUpperCase(),
      card_name: evaluation.cardName,
      evaluation_json: evaluation,
      updated_at: evaluation.updatedAt || new Date().toISOString(),
    });
  }

  const batch = Array.from(deduplicatedMap.values());
  if (batch.length === 0) return;

  // Clear queued keys
  itemsToSync.forEach(({ evaluation }) => {
    if (evaluation?.cardName && evaluation?.setCode) {
      const key = `${evaluation.setCode.toUpperCase()}_${evaluation.cardName.toLowerCase()}`;
      evalSyncQueue.delete(key);
    }
  });

  try {
    const { error } = await supabase.from('card_evaluations').upsert(batch, {
      onConflict: 'user_id,set_code,card_name',
    });

    if (error) {
      console.warn('Failed to sync evaluations to Supabase:', error);
      setSyncStatus('error', error.message);
    } else {
      setSyncStatus('synced');
    }
  } catch (e: any) {
    console.warn('Network error while syncing evaluations:', e);
    setSyncStatus(navigator.onLine ? 'error' : 'offline', e?.message || 'Network error');
  }
}

export async function queueEvaluationClearForSet(userId: string, setCode: string): Promise<void> {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    return;
  }
  try {
    const { error } = await supabase
      .from('card_evaluations')
      .delete()
      .eq('user_id', userId)
      .eq('set_code', setCode.toUpperCase());

    if (error) {
      console.warn('Failed to clear evaluations on Supabase:', error);
    }
  } catch (err) {
    console.warn('Error clearing evaluations on Supabase:', err);
  }
}

// ==================== PULL & MERGE ON LOGIN ====================

export async function pullRemoteUserData(userId: string): Promise<{
  stats: UserProfileStats | null;
  evaluations: Record<string, UserCardEvaluation>;
}> {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    return { stats: null, evaluations: {} };
  }

  // Ensure active session before requesting user data
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) {
    return { stats: null, evaluations: {} };
  }

  setSyncStatus('syncing');

  try {
    // 1. Fetch Remote Stats
    const { data: statsRow, error: statsErr } = await supabase
      .from('user_stats')
      .select('stats_json')
      .eq('user_id', userId)
      .maybeSingle();

    if (statsErr) {
      console.warn('Error fetching remote stats:', statsErr);
    }

    let remoteStats: UserProfileStats | null = null;
    if (statsRow?.stats_json && Object.keys(statsRow.stats_json).length > 0) {
      remoteStats = statsRow.stats_json as UserProfileStats;
      // Persist locally without triggering a redundant queueStatsSync
      localStorage.setItem(`mtg_stats_${userId}`, JSON.stringify(remoteStats));
    }

    // 2. Fetch Remote Evaluations
    const { data: evalRows, error: evalErr } = await supabase
      .from('card_evaluations')
      .select('set_code, card_name, evaluation_json')
      .eq('user_id', userId);

    if (evalErr) {
      console.warn('Error fetching remote evaluations:', evalErr);
    }

    const remoteEvals: Record<string, UserCardEvaluation> = {};
    if (evalRows && evalRows.length > 0) {
      evalRows.forEach((row) => {
        const key = `${row.set_code.toLowerCase()}_${row.card_name.toLowerCase()}`;
        remoteEvals[key] = row.evaluation_json as UserCardEvaluation;
      });
      localStorage.setItem(`mtg_evaluations_${userId}`, JSON.stringify(remoteEvals));
    }

    setSyncStatus('synced');
    return { stats: remoteStats, evaluations: remoteEvals };
  } catch (err: any) {
    console.error('Failed to pull remote data from Supabase:', err);
    setSyncStatus('error', err?.message || 'Failed to pull cloud data');
    return { stats: null, evaluations: {} };
  }
}

export async function migrateLocalDataToCloud(
  cloudUserId: string,
  localGuestId: string = 'user_default'
): Promise<void> {
  if (!isSupabaseConfigured() || !isCloudUUID(cloudUserId)) {
    return;
  }

  // Ensure active session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== cloudUserId) {
    console.warn('Skipping migration: No active session for', cloudUserId);
    return;
  }

  try {
    setSyncStatus('syncing');

    // 1. Merge & Upload Stats
    const localStats = loadUserStats(localGuestId);
    if (localStats.totalQuestions > 0 || localStats.xp > 0) {
      const { data: remoteRow } = await supabase
        .from('user_stats')
        .select('stats_json')
        .eq('user_id', cloudUserId)
        .maybeSingle();

      const remoteStats = (remoteRow?.stats_json as UserProfileStats) || null;

      const mergedStats: UserProfileStats = remoteStats
        ? {
            ...remoteStats,
            xp: Math.max(remoteStats.xp || 0, localStats.xp || 0),
            level: Math.max(remoteStats.level || 1, localStats.level || 1),
            totalQuizzes: Math.max(remoteStats.totalQuizzes || 0, localStats.totalQuizzes || 0),
            totalQuestions: Math.max(remoteStats.totalQuestions || 0, localStats.totalQuestions || 0),
            totalCorrect: Math.max(remoteStats.totalCorrect || 0, localStats.totalCorrect || 0),
            bestStreak: Math.max(remoteStats.bestStreak || 0, localStats.bestStreak || 0),
            currentStreak: localStats.currentStreak || remoteStats.currentStreak || 0,
            overallAccuracy: Math.max(remoteStats.overallAccuracy || 0, localStats.overallAccuracy || 0),
            missedCards: { ...(localStats.missedCards || {}), ...(remoteStats.missedCards || {}) },
            sets: { ...(localStats.sets || {}), ...(remoteStats.sets || {}) },
            recentQuizzes: [
              ...(remoteStats.recentQuizzes || []),
              ...(localStats.recentQuizzes || []),
            ].slice(0, 20),
            lastActive: new Date().toISOString(),
          }
        : localStats;

      const accuracy = Number.isFinite(mergedStats.overallAccuracy)
        ? Math.max(0, Math.min(100, Math.round(mergedStats.overallAccuracy)))
        : mergedStats.totalQuestions > 0
        ? Math.max(0, Math.min(100, Math.round((mergedStats.totalCorrect / mergedStats.totalQuestions) * 100)))
        : 0;

      const { error: statsErr } = await supabase.from('user_stats').upsert(
        {
          user_id: cloudUserId,
          xp: Math.round(mergedStats.xp) || 0,
          level: Math.round(mergedStats.level) || 1,
          overall_accuracy: accuracy,
          stats_json: mergedStats,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (statsErr) {
        console.warn('Failed to upsert merged stats:', statsErr);
        setSyncStatus('error', statsErr.message);
        return;
      }

      localStorage.setItem(`mtg_stats_${cloudUserId}`, JSON.stringify(mergedStats));
    }

    // 2. Merge & Upload Evaluations
    const localEvals = loadUserEvaluations(localGuestId);
    const localEvalEntries = Object.values(localEvals);

    if (localEvalEntries.length > 0) {
      const deduplicatedMap = new Map<string, any>();
      for (const ev of localEvalEntries) {
        if (!ev?.cardName || !ev?.setCode) continue;
        const key = `${ev.setCode.toUpperCase()}:::${ev.cardName.toLowerCase()}`;
        deduplicatedMap.set(key, {
          user_id: cloudUserId,
          set_code: ev.setCode.toUpperCase(),
          card_name: ev.cardName,
          evaluation_json: ev,
          updated_at: ev.updatedAt || new Date().toISOString(),
        });
      }

      const batch = Array.from(deduplicatedMap.values());
      if (batch.length > 0) {
        const { error: evalErr } = await supabase.from('card_evaluations').upsert(batch, {
          onConflict: 'user_id,set_code,card_name',
        });

        if (evalErr) {
          console.warn('Failed to upsert merged evaluations:', evalErr);
          setSyncStatus('error', evalErr.message);
          return;
        }
      }

      const existingCloudEvals = loadUserEvaluations(cloudUserId);
      const mergedEvals = { ...existingCloudEvals, ...localEvals };
      localStorage.setItem(`mtg_evaluations_${cloudUserId}`, JSON.stringify(mergedEvals));
    }

    setSyncStatus('synced');
  } catch (err: any) {
    console.warn('Migration to Supabase encountered an error:', err);
    setSyncStatus('error', err?.message || 'Migration error');
  }
}

export async function retrySync(userId?: string): Promise<boolean> {
  const activeId = userId || getActiveUser()?.id || 'anonymous';
  if (!isCloudUUID(activeId)) {
    setSyncStatus('local_only');
    return false;
  }

  setSyncStatus('syncing');

  try {
    const { stats } = await pullRemoteUserData(activeId);
    if (!stats) {
      await migrateLocalDataToCloud(activeId, 'user_default');
    }
    setSyncStatus('synced');
    return true;
  } catch (e: any) {
    setSyncStatus('error', e?.message || 'Retry failed');
    return false;
  }
}
