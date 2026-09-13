import { supabase, isSupabaseConfigured } from './supabase';
import { UserAccount } from '../types/mtg';
import { UserActivityLog, AdminTimeRange } from '../types/admin';
import { getActiveUser } from './storage';
import { isCloudUUID } from './auth';

const LOCAL_LOGS_KEY = 'mtg_activity_logs_v1';
const MAX_LOCAL_LOGS = 500;

// Telemetry buffer for debouncing remote writes
let pendingLogsQueue: UserActivityLog[] = [];
let logFlushTimer: any = null;

export const KNOWN_FEATURES = {
  CARD_GRADING: 'card_grading',
  BLIND_GRADING: 'blind_grading',
  CARD_QUIZ: 'card_quiz',
  SET_EXPLORER: 'set_explorer',
  ARCHETYPE_FORECAST: 'archetype_forecast',
  SIMILAR_CARDS: 'similar_cards',
  MASTERY_STATS: 'mastery_stats',
  SEARCH_FILTERS: 'search_filters',
  EXPORT_DATA: 'export_data',
  SET_SWITCHER: 'set_switcher',
  THEME_TOGGLE: 'theme_toggle',
} as const;

export function trackEvent(
  eventType: string,
  featureName: string,
  metadata: Record<string, any> = {},
  currentUser?: UserAccount | null
): void {
  try {
    const user = currentUser !== undefined ? currentUser : getActiveUser();
    const log: UserActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: user?.id || 'guest',
      userName: user?.name || 'Anonymous Mage',
      eventType,
      featureName,
      metadata,
      createdAt: new Date().toISOString(),
    };

    // 1. Save locally
    saveLogLocally(log);

    // 2. Queue for remote Supabase sync if connected
    if (isSupabaseConfigured() && user && isCloudUUID(user.id)) {
      pendingLogsQueue.push(log);
      debounceFlushLogs();
    }
  } catch (err) {
    console.warn('Telemetry track error:', err);
  }
}

export function trackFeature(
  featureKey: string,
  metadata: Record<string, any> = {},
  currentUser?: UserAccount | null
): void {
  trackEvent('feature_used', featureKey, metadata, currentUser);
}

export function trackLogin(user: UserAccount): void {
  trackEvent('login', 'auth', {
    provider: user.provider,
    email: user.email,
  }, user);
}

function saveLogLocally(log: UserActivityLog): void {
  try {
    const existing = getStoredLocalLogs();
    const updated = [log, ...existing].slice(0, MAX_LOCAL_LOGS);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(updated));
  } catch (e) {
    // ignore quota errors
  }
}

function getStoredLocalLogs(): UserActivityLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function debounceFlushLogs(): void {
  if (logFlushTimer) clearTimeout(logFlushTimer);
  logFlushTimer = setTimeout(async () => {
    if (pendingLogsQueue.length === 0) return;
    const batch = [...pendingLogsQueue];
    pendingLogsQueue = [];

    try {
      const rows = batch.map((l) => ({
        user_id: isCloudUUID(l.userId) ? l.userId : null,
        user_name: l.userName,
        event_type: l.eventType,
        feature_name: l.featureName,
        metadata: l.metadata,
        created_at: l.createdAt,
      }));

      const { error } = await supabase.from('user_activity_logs').insert(rows);
      if (error && error.code !== 'PGRST205') {
        console.warn('Telemetry sync note:', error.message);
      }
    } catch (err) {
      // Gracefully handle offline or unprovisioned schema cache
    }
  }, 2000);
}

/**
 * Retrieves authentic activity logs from Supabase (if configured) or local activity logs.
 * Strictly avoids injecting any fake mock logs.
 */
export async function fetchActivityLogs(timeRange: AdminTimeRange = 'all'): Promise<UserActivityLog[]> {
  const localLogs = getStoredLocalLogs();

  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from('user_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      const since = getSinceTimestamp(timeRange);
      if (since) {
        query = query.gte('created_at', since);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const remoteLogs: UserActivityLog[] = data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          userName: row.user_name || 'Drafter',
          eventType: row.event_type,
          featureName: row.feature_name,
          metadata: row.metadata || {},
          createdAt: row.created_at,
        }));

        // Merge with local logs not present in remote
        const remoteIds = new Set(remoteLogs.map((r) => r.id));
        const missingLocal = localLogs.filter((l) => !remoteIds.has(l.id));
        const merged = [...remoteLogs, ...missingLocal].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return filterLogsByTime(merged, timeRange);
      }
    } catch (e) {
      // Silently proceed with local real logs
    }
  }

  // Authentic local real logs
  return filterLogsByTime(localLogs, timeRange);
}

function getSinceTimestamp(timeRange: AdminTimeRange): string | null {
  const now = new Date();
  if (timeRange === 'today') {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (timeRange === '7d') {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (timeRange === '30d') {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  return null;
}

function filterLogsByTime(logs: UserActivityLog[], timeRange: AdminTimeRange): UserActivityLog[] {
  const since = getSinceTimestamp(timeRange);
  if (!since) return logs;
  const sinceDate = new Date(since).getTime();
  return logs.filter((l) => new Date(l.createdAt).getTime() >= sinceDate);
}
