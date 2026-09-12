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

      await supabase.from('user_activity_logs').insert(rows);
    } catch (err) {
      console.warn('Failed to push activity logs to Supabase:', err);
    }
  }, 2000);
}

/**
 * Retrieves activity logs from Supabase (if admin) or local fallback
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
        return data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          userName: row.user_name || 'Mage',
          eventType: row.event_type,
          featureName: row.feature_name,
          metadata: row.metadata || {},
          createdAt: row.created_at,
        }));
      }
    } catch (e) {
      console.warn('Could not query Supabase activity logs:', e);
    }
  }

  // Fallback to local logs + sample logs if empty
  const logsToFilter = localLogs.length > 0 ? localLogs : generateSampleTelemetryLogs();
  return filterLogsByTime(logsToFilter, timeRange);
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

/**
 * Generates realistic seed telemetry for initial demonstration and local offline development
 */
export function generateSampleTelemetryLogs(): UserActivityLog[] {
  const sampleUsers = [
    { name: 'Devon Byrd', id: 'usr_devon_01' },
    { name: 'Nicol Bolas', id: 'usr_bolas_02' },
    { name: 'Chandra Nalaar', id: 'usr_chandra_03' },
    { name: 'Jace Beleren', id: 'usr_jace_04' },
    { name: 'Teferi Akosa', id: 'usr_teferi_05' },
    { name: 'Liliana Vess', id: 'usr_liliana_06' },
    { name: 'Kaito Shizuki', id: 'usr_kaito_07' },
  ];

  const features = [
    { name: KNOWN_FEATURES.CARD_GRADING, event: 'grade_card', meta: { set: 'DFT', grade: 'A-' } },
    { name: KNOWN_FEATURES.BLIND_GRADING, event: 'toggle_blind', meta: { enabled: true } },
    { name: KNOWN_FEATURES.CARD_QUIZ, event: 'quiz_complete', meta: { set: 'DFT', score: 9, total: 10, pct: 90 } },
    { name: KNOWN_FEATURES.ARCHETYPE_FORECAST, event: 'forecast_view', meta: { set: 'DFT', archetype: 'WU Aerocraft' } },
    { name: KNOWN_FEATURES.SIMILAR_CARDS, event: 'similar_view', meta: { card: 'Enduring Innocence' } },
    { name: KNOWN_FEATURES.SET_EXPLORER, event: 'browse_set', meta: { set: 'FDN', filter: 'U' } },
    { name: KNOWN_FEATURES.MASTERY_STATS, event: 'view_stats', meta: { set: 'DFT' } },
    { name: KNOWN_FEATURES.SEARCH_FILTERS, event: 'syntax_search', meta: { query: 't:creature c:r o:haste' } },
  ];

  const logs: UserActivityLog[] = [];
  const now = Date.now();

  for (let i = 0; i < 45; i++) {
    const user = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
    const feat = features[Math.floor(Math.random() * features.length)];
    const minutesAgo = Math.floor(Math.random() * 4320); // within last 3 days
    const timestamp = new Date(now - minutesAgo * 60 * 1000).toISOString();

    logs.push({
      id: `sample_log_${i}`,
      userId: user.id,
      userName: user.name,
      eventType: feat.event,
      featureName: feat.name,
      metadata: feat.meta,
      createdAt: timestamp,
    });
  }

  // Sort latest first
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return logs;
}
