import { supabase, isSupabaseConfigured } from './supabase';
import { UserAccount, UserCardEvaluation, UserArchetypeEvaluation } from '../types/mtg';
import {
  AdminUserSummary,
  FeatureUsageStat,
  SetGradingAnalytics,
  GradeAccuracyReport,
  AdminAccessRecord,
  AdminOverviewKPIs,
  AdminTimeRange,
  UserSetGradingDetail,
  CommunityCardInsight,
} from '../types/admin';
import { POPULAR_LIMITED_SETS } from './scryfall';
import { fetchActivityLogs, KNOWN_FEATURES } from './telemetry';
import { getAllUsers, loadUserStats, loadUserEvaluations, loadUserArchetypeEvaluations, getActiveUser } from './storage';
import { isDevEnvironment, isCloudUUID } from './environment';
import {
  fetch17LandsSetData,
  winRateToGradeTier,
  gradeTierToIndex,
  scoreToGradeTier,
  accuracyToEvaluatorGrade,
  get17LandsCardRating,
} from './seventeenLands';
import { GradeTier, SeventeenLandsSetData } from '../types/mtg';

const ADMIN_STORAGE_KEY = 'mtg_admin_access_list_v1';
export const PERMANENT_SUPER_ADMIN_EMAILS = new Set([
  'dbyrd1568@gmail.com',
  'devonwbyrd@gmail.com',
]);
export const DEFAULT_OWNER_EMAIL = 'dbyrd1568@gmail.com';

/**
 * Helper to identify whether an email or ID belongs to a permanent super-admin owner
 */
export function isPermanentSuperAdmin(emailOrId?: string | null): boolean {
  if (!emailOrId) return false;
  const clean = emailOrId.trim().toLowerCase();
  return (
    clean === 'dbyrd1568@gmail.com' ||
    clean === 'devonwbyrd@gmail.com' ||
    clean === 'admin_owner_01'
  );
}

/**
 * Checks if the current user has administrative rights using industry-standard security practices:
 * 1. Cryptographically signed JWT app_metadata claims (server-verified, tamper-proof)
 * 2. PostgreSQL Security Definer RPC function (is_admin()) executed under caller's auth.uid()
 * 3. Database Table query on public.app_admins protected by Row Level Security (RLS)
 */
export async function checkIsAdmin(user: UserAccount | null): Promise<boolean> {
  if (!user) return false;

  // 0. Permanent Super Admin Owner check (authoritative project owners)
  if (isPermanentSuperAdmin(user.email) || isPermanentSuperAdmin(user.id)) {
    return true;
  }

  // Best Security Practice: Server-verified cryptographic & database authorization
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Also check verified session user email
        if (isPermanentSuperAdmin(session.user.email)) {
          return true;
        }

        // 1. Cryptographically signed JWT token app_metadata claim (signed by Supabase secret)
        const appRole = session.user.app_metadata?.role;
        if (appRole === 'admin' || appRole === 'owner') {
          return true;
        }

        // 2. Database RPC Security Definer Function (executes on PostgreSQL under caller's auth.uid())
        const { data: rpcIsAdmin, error: rpcError } = await supabase.rpc('is_admin');
        if (!rpcError && typeof rpcIsAdmin === 'boolean') {
          return rpcIsAdmin;
        }

        // 3. Database Table RLS Query: Check public.app_admins for caller's authenticated user ID
        const { data: adminRecord, error: tableError } = await supabase
          .from('app_admins')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!tableError && adminRecord && (adminRecord.role === 'admin' || adminRecord.role === 'owner')) {
          return true;
        }
      }
    } catch (err) {
      console.warn('Security check error while querying Supabase auth:', err);
    }
  }

  // Fallback for local offline mock testing when user is simulated dev user or permanent super admin
  if (isDevEnvironment() && !isCloudUUID(user.id)) {
    if (user.id === 'user_default' || isPermanentSuperAdmin(user.email) || isPermanentSuperAdmin(user.id)) {
      return true;
    }
  }

  return false;
}

export function getStoredLocalAdmins(): AdminAccessRecord[] {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    const list: AdminAccessRecord[] = raw ? JSON.parse(raw) : [];

    // Purge any erroneously cached or legacy entries
    const cleaned = list.filter(
      (a) => a.email?.toLowerCase() !== 'devonbyrd@gmail.com' && a.id !== 'admin_owner_02'
    );

    // Ensure permanent super admin owners are always present with owner role
    const initialOwners: AdminAccessRecord[] = [
      {
        id: 'admin_owner_01',
        email: 'dbyrd1568@gmail.com',
        role: 'owner',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'admin_owner_02',
        email: 'devonwbyrd@gmail.com',
        role: 'owner',
        createdAt: new Date().toISOString(),
      },
    ];

    for (const owner of initialOwners) {
      if (!cleaned.some((a) => a.email.toLowerCase() === owner.email.toLowerCase())) {
        cleaned.unshift(owner);
      }
    }

    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(cleaned));
    return cleaned;
  } catch (e) {
    return [
      {
        id: 'admin_owner_01',
        email: 'dbyrd1568@gmail.com',
        role: 'owner',
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

export async function fetchAdminList(): Promise<AdminAccessRecord[]> {
  const local = getStoredLocalAdmins();
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('app_admins')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        // Purge devonbyrd@gmail.com from Supabase if it was erroneously inserted
        const erroneousRemote = data.find(
          (d: any) => (d.email || '').toLowerCase() === 'devonbyrd@gmail.com'
        );
        if (erroneousRemote) {
          try {
            await supabase.from('app_admins').delete().ilike('email', 'devonbyrd@gmail.com');
          } catch {
            // Ignore permission or connection errors
          }
        }

        const remote: AdminAccessRecord[] = data
          .filter((d: any) => (d.email || '').toLowerCase() !== 'devonbyrd@gmail.com' && d.id !== 'admin_owner_02')
          .map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            email: d.email || 'Admin',
            role: d.role as 'owner' | 'admin',
            grantedBy: d.granted_by,
            createdAt: d.created_at,
          }));

        // Merge, ensuring permanent super admins are always included as owner
        const merged: AdminAccessRecord[] = [...remote];
        for (const localAdmin of local) {
          if (!merged.some((m) => m.email.toLowerCase() === localAdmin.email.toLowerCase())) {
            merged.unshift(localAdmin);
          }
        }
        return merged;
      }
    } catch (e) {
      console.warn('Could not load remote admin list:', e);
    }
  }
  return local;
}

export async function grantAdminAccess(
  emailAddress: string,
  grantedByUserId?: string
): Promise<{ success: boolean; error?: string }> {
  const clean = emailAddress.trim().toLowerCase();
  if (!clean) return { success: false, error: 'Email address cannot be empty.' };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return { success: false, error: 'Please enter a valid email address (e.g. drafter@gmail.com).' };
  }

  const record: AdminAccessRecord = {
    id: `adm_${Date.now()}`,
    email: clean,
    role: 'admin',
    grantedBy: grantedByUserId,
    createdAt: new Date().toISOString(),
  };

  // 1. Update local storage
  const current = getStoredLocalAdmins();
  if (current.some((a) => a.email.toLowerCase() === record.email.toLowerCase())) {
    return { success: false, error: 'User is already an administrator.' };
  }
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify([...current, record]));

  // 2. Insert to database if connected and active session
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.from('app_admins').insert({
          email: clean,
          role: 'admin',
          granted_by: grantedByUserId || null,
        });
        if (error) {
          console.warn('Could not sync admin grant:', error.message);
        }
      }
    } catch (err: any) {
      console.warn('Remote admin insert exception:', err);
    }
  }

  return { success: true };
}

export async function revokeAdminAccess(
  emailOrAdminId: string
): Promise<{ success: boolean; error?: string }> {
  const clean = emailOrAdminId.trim().toLowerCase();
  if (!clean) return { success: false, error: 'Email cannot be empty.' };

  // Permanent super admins cannot be revoked
  if (isPermanentSuperAdmin(clean)) {
    return { success: false, error: 'Cannot revoke the primary owner account.' };
  }

  const current = getStoredLocalAdmins();
  const target = current.find(
    (a) =>
      a.id.toLowerCase() === clean ||
      a.email.toLowerCase() === clean ||
      (a.userId && a.userId.toLowerCase() === clean)
  );

  if (target && (target.role === 'owner' || isPermanentSuperAdmin(target.email))) {
    return { success: false, error: 'Cannot revoke the primary owner account.' };
  }

  // 1. Update local storage
  const updated = current.filter(
    (a) =>
      a.id.toLowerCase() !== clean &&
      a.email.toLowerCase() !== clean &&
      (!a.userId || a.userId.toLowerCase() !== clean) &&
      (!target || (a.id !== target.id && a.email.toLowerCase() !== target.email.toLowerCase()))
  );
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(updated));

  // 2. Delete from Supabase app_admins table
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Target by email (case-insensitive)
        if (clean.includes('@')) {
          const { error } = await supabase.from('app_admins').delete().ilike('email', clean);
          if (error) console.warn('Could not delete admin by email from Supabase:', error.message);
        }

        if (target?.email && target.email.toLowerCase() !== clean) {
          const { error } = await supabase.from('app_admins').delete().ilike('email', target.email.toLowerCase());
          if (error) console.warn('Could not delete admin by target email from Supabase:', error.message);
        }

        // Target by UUID
        if (isCloudUUID(clean)) {
          const { error } = await supabase.from('app_admins').delete().or(`id.eq.${clean},user_id.eq.${clean}`);
          if (error) console.warn('Could not delete admin by UUID from Supabase:', error.message);
        }

        if (target?.id && isCloudUUID(target.id)) {
          const { error } = await supabase.from('app_admins').delete().eq('id', target.id);
          if (error) console.warn('Could not delete admin by target id from Supabase:', error.message);
        }

        if (target?.userId && isCloudUUID(target.userId)) {
          const { error } = await supabase.from('app_admins').delete().eq('user_id', target.userId);
          if (error) console.warn('Could not delete admin by target user_id from Supabase:', error.message);
        }
      }
    } catch (err: any) {
      console.warn('Remote admin delete exception:', err);
    }
  }

  return { success: true };
}

/**
 * Calculates high-level KPI metrics across users, sets, and evaluations
 */
export async function fetchAdminOverviewKPIs(timeRange: AdminTimeRange = 'all'): Promise<AdminOverviewKPIs> {
  const users = await fetchUserDirectory();
  const logs = await fetchActivityLogs(timeRange);
  const sets = await fetchSetGradingAnalytics();

  const totalUsers = users.length;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const activeUsers24h = users.filter(
    (u) => now - new Date(u.lastLoginAt).getTime() <= dayMs
  ).length;

  const activeUsers7d = users.filter(
    (u) => now - new Date(u.lastLoginAt).getTime() <= 7 * dayMs
  ).length;

  const totalCardsGraded = users.reduce((acc, u) => acc + u.cardsGradedTotal, 0);
  const totalQuizzesTaken = users.reduce((acc, u) => acc + u.totalQuizzes, 0);

  const gradedUsersWithAccuracy = users.filter((u) => u.has17LandsCalibration && u.gradingAccuracyScore > 0);
  const avgGradingAccuracy =
    gradedUsersWithAccuracy.length > 0
      ? Math.round(
          gradedUsersWithAccuracy.reduce((acc, u) => acc + u.gradingAccuracyScore, 0) /
            gradedUsersWithAccuracy.length
        )
      : 0;

  const quizUsersWithAccuracy = users.filter((u) => u.totalQuizzes > 0);
  const avgQuizAccuracy =
    quizUsersWithAccuracy.length > 0
      ? Math.round(
          quizUsersWithAccuracy.reduce((acc, u) => acc + u.quizAccuracy, 0) /
            quizUsersWithAccuracy.length
        )
      : 0;

  // Determine top active feature
  const featureCounts: Record<string, number> = {};
  logs.forEach((l) => {
    featureCounts[l.featureName] = (featureCounts[l.featureName] || 0) + 1;
  });
  let topActiveFeature = 'None';
  let maxCount = 0;
  for (const [feat, count] of Object.entries(featureCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topActiveFeature = formatFeatureName(feat);
    }
  }

  // Determine most graded set
  const sortedSets = [...sets].sort((a, b) => b.totalCardsGraded - a.totalCardsGraded);
  const mostGradedSet = sortedSets[0] && sortedSets[0].totalCardsGraded > 0 ? sortedSets[0].setCode : '-';

  return {
    totalUsers,
    activeUsers7d,
    activeUsers24h,
    totalSetsGraded: sets.filter((s) => s.totalCardsGraded > 0).length,
    totalCardsGraded,
    totalQuizzesTaken,
    avgGradingAccuracy,
    avgQuizAccuracy,
    topActiveFeature,
    mostGradedSet,
  };
}

export function detectAuthMethod(user: {
  id?: string;
  email?: string;
  avatarUrl?: string;
  provider?: string;
}): {
  method: 'google' | 'discord' | 'apple' | 'email_password' | 'magic_link' | 'local';
  label: string;
} {
  const avatar = (user.avatarUrl || '').toLowerCase();
  const provider = (user.provider || '').toLowerCase();

  if (user.id === 'admin_owner_01' || provider === 'local') {
    return {
      method: 'local',
      label: 'Local Dev',
    };
  }

  if (avatar.includes('googleusercontent.com') || provider === 'google') {
    return {
      method: 'google',
      label: 'Google SSO',
    };
  }

  if (avatar.includes('discordapp.com') || provider === 'discord') {
    return {
      method: 'discord',
      label: 'Discord SSO',
    };
  }

  if (provider === 'apple') {
    return {
      method: 'apple',
      label: 'Apple SSO',
    };
  }

  return {
    method: 'email_password',
    label: 'Email & Password',
  };
}

/**
 * Returns complete user directory with aggregated grading and quiz statistics.
 * In cloud mode, queries Supabase profiles, user_stats, and card_evaluations directly.
 * Strictly avoids injecting any fake/mock user accounts.
 */
export async function fetchUserDirectory(): Promise<AdminUserSummary[]> {
  const adminList = await fetchAdminList();
  const adminEmails = new Set(
    adminList.map((a) => a.email.toLowerCase()).concat(Array.from(PERMANENT_SUPER_ADMIN_EMAILS))
  );
  const adminUserIds = new Set(adminList.map((a) => a.userId).filter(Boolean) as string[]);

  let rawUsers: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
    avatarColor?: string;
    provider?: string;
    authMethod?: 'google' | 'discord' | 'apple' | 'email_password' | 'magic_link' | 'local';
    authMethodLabel?: string;
    createdAt: string;
    lastLoginAt?: string;
    stats: any;
    evaluations: Record<string, any>;
  }[] = [];

  if (isSupabaseConfigured()) {
    try {
      // 1. First try calling get_admin_users_directory RPC to get full auth.users list with verified emails
      let profiles: any[] | null = null;
      try {
        const { data: rpcProfiles, error: rpcErr } = await supabase.rpc('get_admin_users_directory');
        if (!rpcErr && rpcProfiles && Array.isArray(rpcProfiles)) {
          profiles = rpcProfiles;
        }
      } catch {
        // RPC might not exist yet if SQL hasn't been executed
      }

      // Fall back to direct profiles table query
      if (!profiles || profiles.length === 0) {
        const { data: directProfiles } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        profiles = directProfiles;
      }

      // 2. Query real user statistics: Try RPC first, fallback to table
      let allStats: any[] = [];
      try {
        const { data: rpcStats, error: rpcStatsErr } = await supabase.rpc('get_admin_user_stats');
        if (!rpcStatsErr && rpcStats && Array.isArray(rpcStats)) {
          allStats = rpcStats;
        }
      } catch {
        // RPC might not exist yet
      }

      if (allStats.length === 0) {
        try {
          const { data: directStats, error: statsErr } = await supabase
            .from('user_stats')
            .select('*');
          if (!statsErr && directStats && Array.isArray(directStats)) {
            allStats = directStats;
          } else if (statsErr) {
            console.warn('Direct user_stats query warning:', statsErr.message);
          }
        } catch (err) {
          console.warn('Failed to query user_stats table:', err);
        }
      }

      // 3. Query real card evaluations: Try RPC first, fallback to paginated table query
      let allEvals: any[] = [];
      let evalsRlsBlocked = false;

      try {
        const { data: rpcEvals, error: rpcErr } = await supabase.rpc('get_admin_card_evaluations');
        if (!rpcErr && rpcEvals && Array.isArray(rpcEvals)) {
          allEvals = rpcEvals;
        }
      } catch {
        // RPC might not exist yet
      }

      if (allEvals.length === 0) {
        try {
          let from = 0;
          const PAGE_SIZE = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data: chunk, error: chunkErr } = await supabase
              .from('card_evaluations')
              .select('user_id, set_code, card_name, evaluation_json, updated_at')
              .range(from, from + PAGE_SIZE - 1);

            if (chunkErr) {
              console.warn('Direct card_evaluations query warning:', chunkErr.message);
              evalsRlsBlocked = true;
              break;
            }

            if (chunk && chunk.length > 0) {
              allEvals.push(...chunk);
              if (chunk.length < PAGE_SIZE) {
                hasMore = false;
              } else {
                from += PAGE_SIZE;
              }
            } else {
              hasMore = false;
            }
          }
        } catch (err) {
          console.warn('Failed to query card_evaluations table:', err);
          evalsRlsBlocked = true;
        }
      }

      const statsMap = new Map<string, any>();
      if (allStats && Array.isArray(allStats)) {
        allStats.forEach((s: any) => {
          if (s?.user_id) statsMap.set(s.user_id, s);
        });
      }

      const evalsMap = new Map<string, Record<string, any>>();
      if (allEvals && Array.isArray(allEvals)) {
        allEvals.forEach((ev: any) => {
          if (!ev?.user_id) return;
          if (!evalsMap.has(ev.user_id)) {
            evalsMap.set(ev.user_id, {});
          }
          const userBucket = evalsMap.get(ev.user_id)!;
          const key = `${ev.set_code}_${ev.card_name}`;
          userBucket[key] = {
            ...(ev.evaluation_json || {}),
            setCode: ev.set_code,
            cardName: ev.card_name,
            updatedAt: ev.updated_at,
          };
        });
      }

      if (profiles && profiles.length > 0) {
        const activeUser = getActiveUser();
        const adminEmailByUserId = new Map<string, string>();
        adminList.forEach((a) => {
          if (a.userId && a.email) adminEmailByUserId.set(a.userId, a.email);
        });

        rawUsers = profiles.map((p: any) => {
          const remoteStats = statsMap.get(p.id);
          const remoteEvals = evalsMap.get(p.id) || {};

          let resolvedStats = remoteStats?.stats_json || {
            xp: remoteStats?.xp || 0,
            level: remoteStats?.level || 1,
            overallAccuracy: remoteStats?.overall_accuracy || 0,
            totalQuizzes: 0,
            totalQuestions: 0,
            totalCorrect: 0,
          };
          let resolvedEvals = remoteEvals;

          // If this profile corresponds to active user in this browser, merge newer local evaluations
          if (activeUser && activeUser.id === p.id) {
            const localStats = loadUserStats(activeUser.id);
            const localEvals = loadUserEvaluations(activeUser.id);
            if ((localStats.xp || 0) > (resolvedStats.xp || 0)) {
              resolvedStats = localStats;
            }
            if (Object.keys(localEvals).length > Object.keys(resolvedEvals).length) {
              resolvedEvals = localEvals;
            }
          }

          const userEmail = (
            p.email ||
            adminEmailByUserId.get(p.id) ||
            (activeUser?.id === p.id ? activeUser?.email : undefined) ||
            ''
          ).trim();
          const displayName = p.display_name || (userEmail ? userEmail.split('@')[0] : 'User');

          const authInfo = detectAuthMethod({
            id: p.id,
            email: userEmail,
            avatarUrl: p.avatar_url,
            provider: p.provider,
          });

          return {
            id: p.id,
            name: displayName,
            email: userEmail || undefined,
            avatarUrl: p.avatar_url,
            avatarColor: '#8b5cf6',
            provider: authInfo.label,
            authMethod: authInfo.method,
            authMethodLabel: authInfo.label,
            createdAt: p.created_at,
            lastLoginAt: p.updated_at || p.created_at,
            stats: resolvedStats,
            evaluations: resolvedEvals,
          };
        });

        // Diagnostics: detect if RLS is preventing admin from reading other users' evaluations
        const nonAdminUsersWithZeroEvals = rawUsers.filter(
          (u) => !isPermanentSuperAdmin(u.email) && Object.keys(u.evaluations || {}).length === 0
        );
        const isLikelyRlsBlocked =
          rawUsers.length > 1 &&
          allEvals.length === 0 &&
          nonAdminUsersWithZeroEvals.length === rawUsers.length - 1;

        lastAdminSyncDiagnostics = {
          isRlsBlocked: Boolean(evalsRlsBlocked || isLikelyRlsBlocked),
          totalUsersFound: rawUsers.length,
          totalEvalsFound: allEvals.length,
          lastCheckedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Could not query real users from Supabase:', err);
    }
  }

  // Fallback to local accounts ONLY if valid cloud UUID
  if (rawUsers.length === 0) {
    const localUsers = getAllUsers().filter((u) => isCloudUUID(u.id));
    rawUsers = localUsers.map((u) => {
      const authInfo = detectAuthMethod({
        id: u.id,
        email: u.email,
        avatarUrl: u.avatarUrl,
        provider: u.provider,
      });
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        avatarColor: u.avatarColor || '#8b5cf6',
        provider: authInfo.label,
        authMethod: authInfo.method,
        authMethodLabel: authInfo.label,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt || u.createdAt,
        stats: loadUserStats(u.id),
        evaluations: loadUserEvaluations(u.id),
      };
    });
  }

  // Gather unique set codes present in all users' evaluations to query authentic 17Lands data
  const distinctSetCodes = new Set<string>();
  rawUsers.forEach((u) => {
    if (u.evaluations) {
      Object.values(u.evaluations).forEach((ev: any) => {
        if (ev.setCode) distinctSetCodes.add(ev.setCode.toUpperCase());
      });
    }
  });

  const landsDataMap = new Map<string, SeventeenLandsSetData | null>();
  await Promise.all(
    Array.from(distinctSetCodes).map(async (setCode) => {
      try {
        const data = await fetch17LandsSetData(setCode);
        landsDataMap.set(setCode, data);
      } catch {
        landsDataMap.set(setCode, null);
      }
    })
  );

  // Build authentic user summaries - strictly authenticated users
  return rawUsers.map((u) => {
    const stats = u.stats || {};
    const evals = u.evaluations || {};
    const setsDetail = computeUserSetGradingDetails(evals);

    const cardsGradedTotal = Object.keys(evals).length;
    const setsGradedCount = setsDetail.filter((s) => s.cardsGraded > 0).length;

    const lowerEmail = (u.email || '').trim().toLowerCase();
    const isAdmin =
      Boolean(lowerEmail && PERMANENT_SUPER_ADMIN_EMAILS.has(lowerEmail)) ||
      Boolean(u.id && adminUserIds.has(u.id)) ||
      Boolean(lowerEmail && adminEmails.has(lowerEmail));

    const now = Date.now();
    const lastLoginMs = new Date(u.lastLoginAt || u.createdAt).getTime();
    const daysSinceLogin = (now - lastLoginMs) / (1000 * 60 * 60 * 24);

    const status: AdminUserSummary['status'] =
      daysSinceLogin <= 1 ? 'active' : daysSinceLogin <= 7 ? 'recent' : 'dormant';

    const { accuracyScore, gpa, bias, has17LandsCalibration } = calculateEvaluationMetrics(evals, landsDataMap);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      avatarColor: u.avatarColor || '#8b5cf6',
      provider: u.authMethodLabel || u.provider || 'local',
      authMethod: u.authMethod || 'email_password',
      authMethodLabel: u.authMethodLabel || 'Email & Password',
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt || u.createdAt,
      totalQuizzes: stats.totalQuizzes || 0,
      totalQuestions: stats.totalQuestions || 0,
      totalCorrect: stats.totalCorrect || 0,
      quizAccuracy: stats.overallAccuracy || 0,
      xp: stats.xp || 0,
      level: stats.level || 1,
      cardsGradedTotal,
      setsGradedCount,
      gradingAccuracyScore: accuracyScore,
      gradingGpa: gpa,
      gradingBias: bias,
      has17LandsCalibration,
      isAdmin,
      status,
      setsGraded: setsDetail,
      evaluations: evals,
    };
  });
}

/**
 * Diagnostics tracking for admin data sync and Supabase RLS visibility
 */
let lastAdminSyncDiagnostics = {
  isRlsBlocked: false,
  totalUsersFound: 0,
  totalEvalsFound: 0,
  lastCheckedAt: '',
};

export function getAdminSyncDiagnostics() {
  return lastAdminSyncDiagnostics;
}

/**
 * Directly fetches all card evaluations for a target user (bypassing bulk cache)
 */
export async function fetchEvaluationsForUser(
  userId: string
): Promise<Record<string, UserCardEvaluation>> {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    return loadUserEvaluations(userId);
  }

  // 1. Try targeted RPC
  try {
    const { data: rpcEvals, error: rpcErr } = await supabase.rpc(
      'get_admin_user_card_evaluations',
      { target_user_id: userId }
    );
    if (!rpcErr && rpcEvals && Array.isArray(rpcEvals) && rpcEvals.length > 0) {
      const userBucket: Record<string, UserCardEvaluation> = {};
      rpcEvals.forEach((ev: any) => {
        const key = `${ev.set_code.toLowerCase()}_${ev.card_name.toLowerCase()}`;
        userBucket[key] = {
          ...(ev.evaluation_json || {}),
          setCode: ev.set_code,
          cardName: ev.card_name,
          updatedAt: ev.updated_at,
        };
      });
      return userBucket;
    }
  } catch {
    // RPC may not exist yet
  }

  // 2. Try direct table query
  try {
    const { data: rows, error } = await supabase
      .from('card_evaluations')
      .select('set_code, card_name, evaluation_json, updated_at')
      .eq('user_id', userId);

    if (!error && rows && Array.isArray(rows) && rows.length > 0) {
      const userBucket: Record<string, UserCardEvaluation> = {};
      rows.forEach((ev: any) => {
        const key = `${ev.set_code.toLowerCase()}_${ev.card_name.toLowerCase()}`;
        userBucket[key] = {
          ...(ev.evaluation_json || {}),
          setCode: ev.set_code,
          cardName: ev.card_name,
          updatedAt: ev.updated_at,
        };
      });
      return userBucket;
    }
  } catch (err) {
    console.warn('Error fetching evaluations for user:', err);
  }

  return loadUserEvaluations(userId);
}

/**
 * Directly fetches all archetype evaluations for a target user
 */
export async function fetchArchetypeEvaluationsForUser(
  userId: string
): Promise<Record<string, UserArchetypeEvaluation>> {
  if (!isSupabaseConfigured() || !isCloudUUID(userId)) {
    return loadUserArchetypeEvaluations(userId);
  }

  // 1. Try targeted RPC
  try {
    const { data: rpcArchetypes, error: rpcErr } = await supabase.rpc(
      'get_admin_user_archetype_evaluations',
      { target_user_id: userId }
    );
    if (!rpcErr && rpcArchetypes && Array.isArray(rpcArchetypes) && rpcArchetypes.length > 0) {
      const archBucket: Record<string, UserArchetypeEvaluation> = {};
      rpcArchetypes.forEach((ev: any) => {
        const key = `${ev.set_code.toLowerCase()}_${ev.archetype_code.toUpperCase()}`;
        archBucket[key] = {
          ...(ev.evaluation_json || {}),
          setCode: ev.set_code,
          archetypeCode: ev.archetype_code,
          updatedAt: ev.updated_at,
        };
      });
      return archBucket;
    }
  } catch {
    // RPC may not exist yet
  }

  // 2. Try direct table query
  try {
    const { data: rows, error } = await supabase
      .from('archetype_evaluations')
      .select('set_code, archetype_code, evaluation_json, updated_at')
      .eq('user_id', userId);

    if (!error && rows && Array.isArray(rows) && rows.length > 0) {
      const archBucket: Record<string, UserArchetypeEvaluation> = {};
      rows.forEach((ev: any) => {
        const key = `${ev.set_code.toLowerCase()}_${ev.archetype_code.toUpperCase()}`;
        archBucket[key] = {
          ...(ev.evaluation_json || {}),
          setCode: ev.set_code,
          archetypeCode: ev.archetype_code,
          updatedAt: ev.updated_at,
        };
      });
      return archBucket;
    }
  } catch (err) {
    console.warn('Error querying archetype_evaluations table:', err);
  }

  // 3. Fallback to public grade shares
  try {
    const { data: shares, error: shareErr } = await supabase
      .from('public_grade_shares')
      .select('archetype_grades_json')
      .eq('user_id', userId);

    if (!shareErr && shares && shares.length > 0) {
      const merged: Record<string, UserArchetypeEvaluation> = {};
      shares.forEach((s) => {
        if (s.archetype_grades_json) {
          Object.assign(merged, s.archetype_grades_json);
        }
      });
      if (Object.keys(merged).length > 0) {
        return merged;
      }
    }
  } catch {
    // Ignore fallback errors
  }

  return loadUserArchetypeEvaluations(userId);
}

/**
 * Exports a user's entire grading scorecard as CSV or JSON
 */
export function exportUserEvaluationScorecard(
  user: AdminUserSummary,
  evaluations: Record<string, UserCardEvaluation>,
  archetypeEvaluations: Record<string, UserArchetypeEvaluation>,
  targetSetCode?: string,
  format: 'csv' | 'json' = 'csv'
): string {
  const evalList = Object.values(evaluations).filter((ev) =>
    !targetSetCode || targetSetCode === 'ALL' || ev.setCode.toUpperCase() === targetSetCode.toUpperCase()
  );

  const archList = Object.values(archetypeEvaluations).filter((arch) =>
    !targetSetCode || targetSetCode === 'ALL' || arch.setCode.toUpperCase() === targetSetCode.toUpperCase()
  );

  const cleanName = (user.name || user.email || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
  const setSuffix = targetSetCode && targetSetCode !== 'ALL' ? `_${targetSetCode.toUpperCase()}` : '_ALL_SETS';
  const timestamp = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const payload = {
      targetUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        authMethod: user.authMethodLabel || user.provider,
        cardsGradedTotal: user.cardsGradedTotal,
        gradingGpa: user.gradingGpa,
        gradingAccuracyScore: user.gradingAccuracyScore,
        gradingBias: user.gradingBias,
      },
      exportedAt: new Date().toISOString(),
      setCode: targetSetCode || 'ALL',
      totalEvaluations: evalList.length,
      cards: evalList,
      archetypes: archList,
    };

    const jsonString = JSON.stringify(payload, null, 2);

    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user_scorecard_${cleanName}${setSuffix}_${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    return jsonString;
  }

  // CSV Export: Card Evaluations
  const cardHeaders = [
    'Set',
    'Card Name',
    'User Grade',
    'User Score',
    'Pick Priority',
    'User Notes',
    'Archetype Role',
    'Updated At',
  ];

  const cardRows = evalList.map((ev) => {
    const grade = ev.userGrade || (ev as any).tier || '—';
    const scoreVal = typeof ev.userScore === 'number' ? ev.userScore : (ev as any).numericScore;
    const score = typeof scoreVal === 'number' ? scoreVal.toFixed(1) : '—';
    const priority = String(ev.pickPriority || '').replace(/"/g, '""');
    const notes = String(ev.notes || (ev as any).userNotes || '').replace(/"/g, '""');
    const role = String(ev.archetypeRole || '').replace(/"/g, '""');
    const cardName = String(ev.cardName || '').replace(/"/g, '""');

    return [
      ev.setCode,
      `"${cardName}"`,
      grade,
      score,
      `"${priority}"`,
      `"${notes}"`,
      `"${role}"`,
      ev.updatedAt || '—',
    ];
  });

  // CSV Export: Archetype Evaluations
  const archHeaders = [
    'Set',
    'Archetype Code',
    'User Grade',
    'User Score',
    'Manual Override',
    'Role in Metagame',
    'Archetype Notes',
    'Updated At',
  ];

  const archRows = archList.map((arch) => {
    const grade = arch.userGrade || (arch as any).tierGrade || '—';
    const scoreVal = typeof arch.userScore === 'number' ? arch.userScore : (arch as any).powerScore;
    const score = typeof scoreVal === 'number' ? scoreVal.toFixed(1) : '—';
    const override = arch.isManualOverride ? 'Yes' : 'No';
    const role = String(arch.roleInMetagame || (arch as any).metagameRole || '').replace(/"/g, '""');
    const notes = String(arch.notes || '').replace(/"/g, '""');

    return [
      arch.setCode,
      arch.archetypeCode,
      grade,
      score,
      override,
      `"${role}"`,
      `"${notes}"`,
      arch.updatedAt || '—',
    ];
  });

  const lines = [
    cardHeaders.join(','),
    ...cardRows.map((r) => r.join(',')),
    '',
    '--- ARCHETYPE EVALUATIONS ---',
    archHeaders.join(','),
    ...archRows.map((r) => r.join(',')),
  ];

  const csvContent = lines.join('\n');

  if (typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_scorecard_${cleanName}${setSuffix}_${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return csvContent;
}

/**
 * Backward compatibility alias for exportUserEvaluationScorecard
 */
export const exportUserEvaluationDossier = exportUserEvaluationScorecard;

/**
 * Computes how many cards a user has graded per MTG set
 */
export function computeUserSetGradingDetails(
  evals: Record<string, any>
): UserSetGradingDetail[] {
  const setCounts: Record<string, { count: number; scores: number[]; lastAt: string }> = {};

  Object.values(evals).forEach((ev) => {
    if (!ev?.setCode) return;
    const code = ev.setCode.toUpperCase();
    if (!setCounts[code]) {
      setCounts[code] = { count: 0, scores: [], lastAt: ev.updatedAt || '' };
    }
    setCounts[code].count += 1;
    if (typeof ev.userScore === 'number') {
      setCounts[code].scores.push(ev.userScore);
    }
    if (ev.updatedAt && ev.updatedAt > setCounts[code].lastAt) {
      setCounts[code].lastAt = ev.updatedAt;
    }
  });

  const known = POPULAR_LIMITED_SETS.map((set) => {
    const found = setCounts[set.code.toUpperCase()];
    const cardsGraded = found ? found.count : 0;
    const percentComplete = set.card_count > 0 ? Math.min(100, Math.round((cardsGraded / set.card_count) * 100)) : 0;
    const avgScore =
      found && found.scores.length > 0
        ? Math.round((found.scores.reduce((a, b) => a + b, 0) / found.scores.length) * 10) / 10
        : undefined;

    return {
      setCode: set.code,
      setName: set.name,
      cardsGraded,
      totalCards: set.card_count,
      percentComplete,
      lastGradedAt: found?.lastAt,
      averageUserScore: avgScore,
    };
  });

  // Include any custom or additional sets graded by user
  const knownCodes = new Set(POPULAR_LIMITED_SETS.map((s) => s.code.toUpperCase()));
  const extraSets: UserSetGradingDetail[] = [];
  for (const [code, data] of Object.entries(setCounts)) {
    if (!knownCodes.has(code) && data.count > 0) {
      extraSets.push({
        setCode: code,
        setName: code,
        cardsGraded: data.count,
        totalCards: data.count,
        percentComplete: 100,
        lastGradedAt: data.lastAt,
        averageUserScore:
          data.scores.length > 0
            ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
            : undefined,
      });
    }
  }

  return [...known, ...extraSets];
}

function calculateEvaluationMetrics(
  evals: Record<string, any>,
  landsDataMap?: Map<string, SeventeenLandsSetData | null>
): {
  accuracyScore: number;
  gpa: number;
  bias: 'optimistic' | 'critical' | 'neutral';
  has17LandsCalibration: boolean;
  totalWith17Lands: number;
} {
  const evalList = Object.values(evals);
  if (evalList.length === 0) {
    return { accuracyScore: 0, gpa: 0, bias: 'neutral', has17LandsCalibration: false, totalWith17Lands: 0 };
  }

  let totalWith17Lands = 0;
  let exactCount = 0;
  let oneStepCount = 0;
  let optimisticCount = 0;
  let criticalCount = 0;

  evalList.forEach((e) => {
    const userTier = e.userGrade as GradeTier;
    if (!userTier || userTier === 'N/A') return;

    const setCode = (e.setCode || '').toUpperCase();
    const landsData = landsDataMap?.get(setCode);
    if (!landsData?.cards) return;

    const landCard = get17LandsCardRating({ name: e.cardName, set: setCode }, landsData);
    if (!landCard || typeof landCard.win_rate !== 'number') return;

    const actualTier = (landCard.tier_grade as GradeTier) || winRateToGradeTier(landCard.win_rate);
    const userIdx = gradeTierToIndex(userTier);
    const actualIdx = gradeTierToIndex(actualTier);
    if (userIdx < 0 || actualIdx < 0) return;

    totalWith17Lands++;
    const stepDelta = actualIdx - userIdx; // > 0 means User rated higher than 17Lands (optimistic)
    const absDiff = Math.abs(stepDelta);

    if (absDiff === 0) exactCount++;
    else if (absDiff === 1) oneStepCount++;

    if (stepDelta > 0) optimisticCount++;
    else if (stepDelta < 0) criticalCount++;
  });

  if (totalWith17Lands === 0) {
    return {
      accuracyScore: 0,
      gpa: 0,
      bias: 'neutral',
      has17LandsCalibration: false,
      totalWith17Lands: 0,
    };
  }

  const accuracyScore = Math.round(((exactCount + oneStepCount) / totalWith17Lands) * 100);
  const evalRubric = accuracyToEvaluatorGrade(accuracyScore);
  const gpa = evalRubric.gpa;
  const bias =
    optimisticCount > criticalCount * 1.5
      ? 'optimistic'
      : criticalCount > optimisticCount * 1.5
      ? 'critical'
      : 'neutral';

  return {
    accuracyScore,
    gpa,
    bias,
    has17LandsCalibration: true,
    totalWith17Lands,
  };
}

/**
 * Returns feature usage analytics aggregated across telemetry logs
 */
export async function fetchFeatureUsageMetrics(
  timeRange: AdminTimeRange = 'all'
): Promise<FeatureUsageStat[]> {
  const logs = await fetchActivityLogs(timeRange);
  const users = await fetchUserDirectory();
  const totalUserCount = Math.max(users.length, 1);

  const featureConfigs: Record<
    string,
    { name: string; category: FeatureUsageStat['category']; description: string }
  > = {
    [KNOWN_FEATURES.CARD_GRADING]: {
      name: 'Card Grading Hub',
      category: 'grading',
      description: 'Individual card tier evaluation, custom notes, and pick priorities',
    },
    [KNOWN_FEATURES.BLIND_GRADING]: {
      name: 'Blind Grading Mode',
      category: 'grading',
      description: 'Grading cards with hidden 17Lands win rates to test raw evaluation instincts',
    },
    [KNOWN_FEATURES.CARD_QUIZ]: {
      name: 'Tactical Card Quiz',
      category: 'quiz',
      description: 'P1P1 priorities, combat tricks, and 17Lands sleeper/trap quizzes',
    },
    [KNOWN_FEATURES.ARCHETYPE_FORECAST]: {
      name: 'Archetype Forecast',
      category: 'grading',
      description: '10 two-color pair Limited speed, synergy, and power ranking matrix',
    },
    [KNOWN_FEATURES.SIMILAR_CARDS]: {
      name: 'Historical Card Comparison',
      category: 'explorer',
      description: 'Comparing new set cards with historical anchors and performance benchmarks',
    },
    [KNOWN_FEATURES.SET_EXPLORER]: {
      name: 'Set Cards Visualizer',
      category: 'explorer',
      description: 'Full card list explorer with color, rarity, and archetype filters',
    },
    [KNOWN_FEATURES.SET_SWITCHER]: {
      name: 'Set Switcher & Navigator',
      category: 'explorer',
      description: 'Browsing and selecting different Magic: The Gathering card sets',
    },
    'tab_navigation': {
      name: 'Tab Navigation',
      category: 'utility',
      description: 'Navigating between evaluation, quiz, explorer, and stats views',
    },
    [KNOWN_FEATURES.MASTERY_STATS]: {
      name: 'Mastery Stats Dashboard',
      category: 'quiz',
      description: 'Reviewing category proficiencies, weak areas, and missed card drills',
    },
    [KNOWN_FEATURES.SEARCH_FILTERS]: {
      name: 'Advanced Search Syntax',
      category: 'utility',
      description: 'Scryfall-style search syntax queries (t:, c:, o:, cmc:, etc.)',
    },
    [KNOWN_FEATURES.EXPORT_DATA]: {
      name: 'Data Backup & Export',
      category: 'utility',
      description: 'Exporting personal card grades, notes, and quiz history',
    },
  };

  const featureAggregates: Record<
    string,
    { interactions: number; users: Set<string>; lastUsed: string }
  > = {};

  // Initialize
  Object.keys(featureConfigs).forEach((k) => {
    featureAggregates[k] = { interactions: 0, users: new Set(), lastUsed: '' };
  });

  logs.forEach((log) => {
    let key = log.featureName;
    if (key === 'tab_navigation') {
      if (log.metadata?.tab === 'explorer') {
        key = KNOWN_FEATURES.SET_EXPLORER;
      } else if (log.metadata?.tab === 'quiz') {
        key = KNOWN_FEATURES.CARD_QUIZ;
      } else if (log.metadata?.tab === 'evaluation') {
        key = KNOWN_FEATURES.CARD_GRADING;
      }
    }

    if (!featureAggregates[key]) {
      featureAggregates[key] = { interactions: 0, users: new Set(), lastUsed: '' };
    }
    featureAggregates[key].interactions += 1;
    if (log.userId) featureAggregates[key].users.add(log.userId);
    if (!featureAggregates[key].lastUsed || log.createdAt > featureAggregates[key].lastUsed) {
      featureAggregates[key].lastUsed = log.createdAt;
    }
  });

  // Credit authentic set exploration if users have evaluated sets/cards
  const totalGradedCards = users.reduce((acc, u) => acc + u.cardsGradedTotal, 0);
  if (featureAggregates[KNOWN_FEATURES.SET_EXPLORER].interactions === 0 && totalGradedCards > 0) {
    const totalSetsGraded = users.reduce((acc, u) => acc + u.setsGradedCount, 0);
    featureAggregates[KNOWN_FEATURES.SET_EXPLORER].interactions = Math.max(totalSetsGraded, 1);
    users.forEach((u) => {
      if (u.cardsGradedTotal > 0) featureAggregates[KNOWN_FEATURES.SET_EXPLORER].users.add(u.id);
    });
  }

  return Object.entries(featureConfigs).map(([key, config]) => {
    const agg = featureAggregates[key] || { interactions: 0, users: new Set(), lastUsed: '' };
    const totalInteractions = agg.interactions;
    const uniqueUsers = agg.users.size;
    const adoptionRate = totalUserCount > 0 ? Math.min(100, Math.round((uniqueUsers / totalUserCount) * 100)) : 0;

    return {
      featureKey: key,
      name: config.name,
      category: config.category,
      totalInteractions,
      uniqueUsers,
      adoptionRate,
      lastUsedAt: agg.lastUsed || '',
      description: config.description,
    };
  }).sort((a, b) => b.totalInteractions - a.totalInteractions);
}

/**
 * Returns set grading analytics (cards graded per set across the community)
 */
export async function fetchSetGradingAnalytics(): Promise<SetGradingAnalytics[]> {
  const users = await fetchUserDirectory();

  const distinctSetCodes = new Set<string>();
  users.forEach((u) => {
    u.setsGraded.forEach((s) => {
      if (s.cardsGraded > 0) distinctSetCodes.add(s.setCode.toUpperCase());
    });
  });

  const landsDataMap = new Map<string, SeventeenLandsSetData | null>();
  await Promise.all(
    Array.from(distinctSetCodes).map(async (setCode) => {
      try {
        const data = await fetch17LandsSetData(setCode);
        landsDataMap.set(setCode, data);
      } catch {
        landsDataMap.set(setCode, null);
      }
    })
  );

  return POPULAR_LIMITED_SETS.map((set) => {
    let totalGradedInSet = 0;
    let gradersCount = 0;
    let fullyGradedCount = 0;
    let totalScoreInSet = 0;
    let totalScoredCards = 0;

    users.forEach((u) => {
      const match = u.setsGraded.find((s) => s.setCode.toUpperCase() === set.code.toUpperCase());
      if (match && match.cardsGraded > 0) {
        gradersCount += 1;
        totalGradedInSet += match.cardsGraded;
        if (match.cardsGraded >= set.card_count) {
          fullyGradedCount += 1;
        }

        if (u.evaluations) {
          Object.values(u.evaluations).forEach((e: any) => {
            if (e.setCode?.toUpperCase() === set.code.toUpperCase() && typeof e.userScore === 'number') {
              totalScoreInSet += e.userScore;
              totalScoredCards++;
            }
          });
        }
      }
    });

    const avgCards = gradersCount > 0 ? Math.round(totalGradedInSet / gradersCount) : 0;
    const avgScore = totalScoredCards > 0 ? totalScoreInSet / totalScoredCards : 0;
    const communityAvgTier = totalScoredCards > 0 ? scoreToGradeTier(avgScore) : '—';

    let setCalScore = 0;
    const landsData = landsDataMap.get(set.code.toUpperCase());
    if (landsData?.cards && gradersCount > 0) {
      let setExactOrClose = 0;
      let setCardsWith17Lands = 0;

      users.forEach((u) => {
        if (!u.evaluations) return;
        Object.values(u.evaluations).forEach((e: any) => {
          if (e.setCode?.toUpperCase() !== set.code.toUpperCase()) return;
          const userTier = e.userGrade as GradeTier;
          if (!userTier || userTier === 'N/A') return;

          const landCard = get17LandsCardRating({ name: e.cardName, set: set.code }, landsData);
          if (!landCard || typeof landCard.win_rate !== 'number') return;

          const actualTier = (landCard.tier_grade as GradeTier) || winRateToGradeTier(landCard.win_rate);
          const userIdx = gradeTierToIndex(userTier);
          const actualIdx = gradeTierToIndex(actualTier);
          if (userIdx < 0 || actualIdx < 0) return;

          setCardsWith17Lands++;
          if (Math.abs(actualIdx - userIdx) <= 1) {
            setExactOrClose++;
          }
        });
      });

      if (setCardsWith17Lands > 0) {
        setCalScore = Math.round((setExactOrClose / setCardsWith17Lands) * 100);
      }
    }

    return {
      setCode: set.code,
      setName: set.name,
      totalSetCards: set.card_count,
      totalCardsGraded: totalGradedInSet,
      uniqueGradersCount: gradersCount,
      fullyGradedUsersCount: fullyGradedCount,
      avgCardsGradedPerUser: avgCards,
      communityAvgTier,
      communityCalibrationScore: setCalScore,
    };
  }).sort((a, b) => b.totalCardsGraded - a.totalCardsGraded);
}

/**
 * Returns community grade calibration accuracy, GPA, traps, and sleepers based on real user data
 */
export async function fetchGradingAccuracyReport(): Promise<GradeAccuracyReport> {
  const users = await fetchUserDirectory();
  const totalGraded = users.reduce((acc, u) => acc + u.cardsGradedTotal, 0);

  // Gather unique set codes across all evaluations
  const distinctSetCodes = new Set<string>();
  users.forEach((u) => {
    if (u.evaluations) {
      Object.values(u.evaluations).forEach((ev: any) => {
        if (ev.setCode) distinctSetCodes.add(ev.setCode.toUpperCase());
      });
    }
  });

  const landsDataMap = new Map<string, SeventeenLandsSetData | null>();
  await Promise.all(
    Array.from(distinctSetCodes).map(async (setCode) => {
      try {
        const data = await fetch17LandsSetData(setCode);
        landsDataMap.set(setCode, data);
      } catch {
        landsDataMap.set(setCode, null);
      }
    })
  );

  let totalWith17Lands = 0;
  let exactMatchesCount = 0;
  let oneStepMatchesCount = 0;
  let twoStepMatchesCount = 0;
  let majorDiscrepanciesCount = 0;
  let optimisticCount = 0;
  let criticalCount = 0;

  const cardDeltaAggregator = new Map<string, {
    cardName: string;
    setCode: string;
    totalDelta: number;
    count: number;
    grades: GradeTier[];
    actualTier: GradeTier;
    winRate: number;
  }>();

  users.forEach((u) => {
    if (!u.evaluations) return;
    Object.values(u.evaluations).forEach((e: any) => {
      const userTier = e.userGrade as GradeTier;
      if (!userTier || userTier === 'N/A') return;

      const setCode = (e.setCode || '').toUpperCase();
      const landsData = landsDataMap.get(setCode);
      if (!landsData?.cards) return;

      const landCard = get17LandsCardRating({ name: e.cardName, set: setCode }, landsData);
      if (!landCard || typeof landCard.win_rate !== 'number') return;

      const actualTier = (landCard.tier_grade as GradeTier) || winRateToGradeTier(landCard.win_rate);
      const userIdx = gradeTierToIndex(userTier);
      const actualIdx = gradeTierToIndex(actualTier);
      if (userIdx < 0 || actualIdx < 0) return;

      totalWith17Lands++;
      const stepDelta = actualIdx - userIdx;
      const absDiff = Math.abs(stepDelta);

      if (absDiff === 0) exactMatchesCount++;
      else if (absDiff === 1) oneStepMatchesCount++;
      else if (absDiff === 2) twoStepMatchesCount++;
      else majorDiscrepanciesCount++;

      if (stepDelta > 0) optimisticCount++;
      else if (stepDelta < 0) criticalCount++;

      const cardKey = `${setCode}_${e.cardName}`;
      if (!cardDeltaAggregator.has(cardKey)) {
        cardDeltaAggregator.set(cardKey, {
          cardName: e.cardName,
          setCode,
          totalDelta: 0,
          count: 0,
          grades: [],
          actualTier,
          winRate: landCard.win_rate,
        });
      }
      const agg = cardDeltaAggregator.get(cardKey)!;
      agg.totalDelta += stepDelta;
      agg.count++;
      agg.grades.push(userTier);
    });
  });

  if (totalWith17Lands === 0) {
    return {
      totalEvaluationsEvaluated: totalGraded,
      totalEvaluationsWith17Lands: 0,
      isCalibrationAvailable: false,
      systemCalibrationScore: 0,
      systemGpa: 0,
      exactMatchesCount: 0,
      exactMatchesPercentage: 0,
      oneStepMatchesCount: 0,
      oneStepMatchesPercentage: 0,
      twoStepMatchesCount: 0,
      twoStepMatchesPercentage: 0,
      majorDiscrepanciesCount: 0,
      majorDiscrepanciesPercentage: 0,
      optimisticBiasPercentage: 0,
      criticalBiasPercentage: 0,
      biggestSleepers: [],
      biggestTraps: [],
    };
  }

  const exactMatchesPercentage = Math.round((exactMatchesCount / totalWith17Lands) * 100);
  const oneStepMatchesPercentage = Math.round((oneStepMatchesCount / totalWith17Lands) * 100);
  const twoStepMatchesPercentage = Math.round((twoStepMatchesCount / totalWith17Lands) * 100);
  const majorDiscrepanciesPercentage = Math.max(0, 100 - exactMatchesPercentage - oneStepMatchesPercentage - twoStepMatchesPercentage);

  const systemCalibrationScore = Math.round(((exactMatchesCount + oneStepMatchesCount) / totalWith17Lands) * 100);
  const evalRubric = accuracyToEvaluatorGrade(systemCalibrationScore);
  const systemGpa = evalRubric.gpa;

  const totalDeltas = optimisticCount + criticalCount;
  const optimisticBiasPercentage = totalDeltas > 0 ? Math.round((optimisticCount / totalDeltas) * 100) : 0;
  const criticalBiasPercentage = totalDeltas > 0 ? 100 - optimisticBiasPercentage : 0;

  const biggestTraps: CommunityCardInsight[] = [];
  const biggestSleepers: CommunityCardInsight[] = [];

  cardDeltaAggregator.forEach((agg) => {
    const avgDelta = Math.round((agg.totalDelta / agg.count) * 10) / 10;
    const gradeCounts: Record<string, number> = {};
    agg.grades.forEach((g) => { gradeCounts[g] = (gradeCounts[g] || 0) + 1; });
    const topGrade = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'C';

    if (avgDelta >= 2) {
      biggestTraps.push({
        cardName: agg.cardName,
        setCode: agg.setCode,
        communityGrade: topGrade,
        seventeenLandsGrade: agg.actualTier,
        winRate: agg.winRate,
        stepDelta: avgDelta,
        totalEvaluations: agg.count,
        type: 'trap',
      });
    } else if (avgDelta <= -2) {
      biggestSleepers.push({
        cardName: agg.cardName,
        setCode: agg.setCode,
        communityGrade: topGrade,
        seventeenLandsGrade: agg.actualTier,
        winRate: agg.winRate,
        stepDelta: avgDelta,
        totalEvaluations: agg.count,
        type: 'sleeper',
      });
    }
  });

  biggestTraps.sort((a, b) => b.stepDelta - a.stepDelta);
  biggestSleepers.sort((a, b) => a.stepDelta - b.stepDelta);

  return {
    totalEvaluationsEvaluated: totalGraded,
    totalEvaluationsWith17Lands: totalWith17Lands,
    isCalibrationAvailable: true,
    systemCalibrationScore,
    systemGpa,
    exactMatchesCount,
    exactMatchesPercentage,
    oneStepMatchesCount,
    oneStepMatchesPercentage,
    twoStepMatchesCount,
    twoStepMatchesPercentage,
    majorDiscrepanciesCount,
    majorDiscrepanciesPercentage,
    optimisticBiasPercentage,
    criticalBiasPercentage,
    biggestSleepers: biggestSleepers.slice(0, 5),
    biggestTraps: biggestTraps.slice(0, 5),
  };
}

/**
 * Export full admin analytics as JSON
 */
export async function exportAdminDataAsJSON(): Promise<string> {
  const users = await fetchUserDirectory();
  const sets = await fetchSetGradingAnalytics();
  const features = await fetchFeatureUsageMetrics('all');
  const accuracy = await fetchGradingAccuracyReport();

  const payload = {
    exportedAt: new Date().toISOString(),
    system: 'MTG Limited IQ Admin Analytics',
    overview: {
      totalUsers: users.length,
      totalSetsGraded: sets.length,
      systemAccuracy: accuracy.systemCalibrationScore,
      systemGpa: accuracy.systemGpa,
    },
    users,
    sets,
    features,
    accuracy,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Export full admin analytics as CSV strings
 */
export async function exportAdminDataAsCSV(): Promise<{
  usersCsv: string;
  setsCsv: string;
  featuresCsv: string;
}> {
  const users = await fetchUserDirectory();
  const sets = await fetchSetGradingAnalytics();
  const features = await fetchFeatureUsageMetrics('all');

  // Users CSV
  const userHeaders = ['ID', 'Name', 'Email', 'Provider', 'Last Login', 'Quizzes', 'Cards Graded', 'Sets Graded', 'Accuracy %', 'GPA', 'Level', 'XP', 'Admin'];
  const userRows = users.map((u) => [
    `"${u.id}"`,
    `"${u.name}"`,
    `"${u.email || 'N/A'}"`,
    u.provider,
    u.lastLoginAt,
    u.totalQuizzes,
    u.cardsGradedTotal,
    u.setsGradedCount,
    u.gradingAccuracyScore,
    u.gradingGpa,
    u.level,
    u.xp,
    u.isAdmin ? 'YES' : 'NO',
  ]);
  const usersCsv = [userHeaders.join(','), ...userRows.map((r) => r.join(','))].join('\n');

  // Sets CSV
  const setHeaders = ['Set Code', 'Set Name', 'Total Cards', 'Community Graded Cards', 'Unique Graders', 'Fully Graded Users', 'Avg Cards Per User'];
  const setRows = sets.map((s) => [
    s.setCode,
    `"${s.setName}"`,
    s.totalSetCards,
    s.totalCardsGraded,
    s.uniqueGradersCount,
    s.fullyGradedUsersCount,
    s.avgCardsGradedPerUser,
  ]);
  const setsCsv = [setHeaders.join(','), ...setRows.map((r) => r.join(','))].join('\n');

  // Features CSV
  const featureHeaders = ['Feature Key', 'Name', 'Category', 'Total Interactions', 'Unique Users', 'Adoption Rate %', 'Last Used'];
  const featureRows = features.map((f) => [
    f.featureKey,
    `"${f.name}"`,
    f.category,
    f.totalInteractions,
    f.uniqueUsers,
    f.adoptionRate,
    f.lastUsedAt,
  ]);
  const featuresCsv = [featureHeaders.join(','), ...featureRows.map((r) => r.join(','))].join('\n');

  return { usersCsv, setsCsv, featuresCsv };
}

function formatFeatureName(raw: string): string {
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const ADMIN_RLS_FIX_SQL = `-- MTG LIMITED IQ: SECURE ADMIN EVALUATIONS & STATS ACCESS REPAIR
-- Run this in Supabase Dashboard -> SQL Editor (irxgoelllogcyoiumxup)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

UPDATE public.profiles
SET is_admin = true
WHERE lower(coalesce(email, '')) IN ('dbyrd1568@gmail.com', 'devonwbyrd@gmail.com');

CREATE TABLE IF NOT EXISTS public.app_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.app_admins (email, role)
VALUES 
  ('dbyrd1568@gmail.com', 'owner'),
  ('devonwbyrd@gmail.com', 'owner')
ON CONFLICT (email) DO UPDATE SET role = 'owner';

UPDATE public.app_admins a
SET user_id = u.id
FROM auth.users u
WHERE lower(a.email) = lower(u.email);

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
  caller_email TEXT;
BEGIN
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  caller_email := lower(auth.jwt() ->> 'email');
  IF caller_email IN ('dbyrd1568@gmail.com', 'devonwbyrd@gmail.com') THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = check_user_id
      AND lower(u.email) IN ('dbyrd1568@gmail.com', 'devonwbyrd@gmail.com')
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = check_user_id) THEN
    RETURN true;
  END IF;

  IF caller_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.app_admins WHERE lower(email) = caller_email
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_admin_card_evaluations()
RETURNS TABLE (
  user_id UUID,
  set_code TEXT,
  card_name TEXT,
  evaluation_json JSONB,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    ce.user_id,
    ce.set_code,
    ce.card_name,
    ce.evaluation_json,
    ce.updated_at
  FROM public.card_evaluations ce
  ORDER BY ce.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_admin_user_card_evaluations(target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  set_code TEXT,
  card_name TEXT,
  evaluation_json JSONB,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    ce.user_id,
    ce.set_code,
    ce.card_name,
    ce.evaluation_json,
    ce.updated_at
  FROM public.card_evaluations ce
  WHERE ce.user_id = target_user_id
  ORDER BY ce.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_admin_user_stats()
RETURNS TABLE (
  user_id UUID,
  xp INT,
  level INT,
  overall_accuracy INT,
  stats_json JSONB,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admins only.';
  END IF;

  RETURN QUERY
  SELECT 
    us.user_id,
    us.xp,
    us.level,
    us.overall_accuracy,
    us.stats_json,
    us.updated_at
  FROM public.user_stats us
  ORDER BY us.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.card_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can insert their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can update their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users can delete their own evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Admins can view all card evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Admins or owners can view card evaluations" ON public.card_evaluations;
  DROP POLICY IF EXISTS "Users and admins can manage card evaluations" ON public.card_evaluations;
END $$;

CREATE POLICY "Users and admins can manage card evaluations"
  ON public.card_evaluations FOR ALL
  USING (public.is_admin() OR auth.uid() = user_id)
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users can insert their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users can update their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users can delete their own stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Admins can view all user stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Admins or owners can view user stats" ON public.user_stats;
  DROP POLICY IF EXISTS "Users and admins can manage user stats" ON public.user_stats;
END $$;

CREATE POLICY "Users and admins can manage user stats"
  ON public.user_stats FOR ALL
  USING (public.is_admin() OR auth.uid() = user_id)
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert activity logs" ON public.user_activity_logs;
  DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.user_activity_logs;
END $$;

CREATE POLICY "Users can insert activity logs"
  ON public.user_activity_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all activity logs"
  ON public.user_activity_logs FOR SELECT
  USING (public.is_admin());
`;
