import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Shield,
  Layers,
  Brain,
  Award,
  X,
  Calendar,
  ExternalLink,
  Flame,
  CheckCircle2,
  Clock,
  Key,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Trash2,
  AlertTriangle,
  Lock,
  Mail,
  Sparkles,
} from 'lucide-react';
import { AdminUserSummary } from '../../types/admin';
import { UserAccount } from '../../types/mtg';
import {
  grantAdminAccess,
  revokeAdminAccess,
  isPermanentSuperAdmin,
  fetchEvaluationsForUser,
  computeUserSetGradingDetails,
} from '../../services/admin';

interface AdminUsersViewProps {
  users: AdminUserSummary[];
  selectedUser: AdminUserSummary | null;
  onSelectUser: (user: AdminUserSummary | null) => void;
  currentUser?: UserAccount | null;
  onRefreshData?: () => void;
}

type SortField = 'lastLogin' | 'cardsGraded' | 'quizzes' | 'accuracy' | 'name';

function renderAuthMethodBadge(method?: string, label?: string) {
  const m = method || 'email_password';
  const displayLabel = label || (m === 'google' ? 'Google SSO' : m === 'discord' ? 'Discord SSO' : m === 'apple' ? 'Apple SSO' : m === 'local' ? 'Local Dev' : 'Email & Password');

  if (m === 'google') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-xs">
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Google SSO</span>
      </span>
    );
  }

  if (m === 'discord') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
        <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
        <span>Discord SSO</span>
      </span>
    );
  }

  if (m === 'apple') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-xs">
        <span></span>
        <span>Apple SSO</span>
      </span>
    );
  }

  if (m === 'local') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-xs">
        <Shield className="w-3 h-3 text-amber-500 shrink-0" />
        <span>Local Dev</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shadow-xs">
      <Lock className="w-3 h-3 text-purple-500 shrink-0" />
      <span>Email & Password</span>
    </span>
  );
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  users,
  selectedUser,
  onSelectUser,
  currentUser,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [authMethodFilter, setAuthMethodFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('lastLogin');
  const [sortAsc, setSortAsc] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [liveEvaluations, setLiveEvaluations] = useState<Record<string, any> | null>(null);
  const [isLoadingLiveEvals, setIsLoadingLiveEvals] = useState(false);

  useEffect(() => {
    if (!selectedUser) {
      setLiveEvaluations(null);
      return;
    }

    if (selectedUser.cardsGradedTotal === 0) {
      setIsLoadingLiveEvals(true);
      fetchEvaluationsForUser(selectedUser.id)
        .then((evals) => {
          if (evals && Object.keys(evals).length > 0) {
            setLiveEvaluations(evals);
          }
        })
        .finally(() => {
          setIsLoadingLiveEvals(false);
        });
    } else {
      setLiveEvaluations(null);
    }
  }, [selectedUser?.id]);

  const activeUser = useMemo(() => {
    if (!selectedUser) return null;
    if (liveEvaluations && Object.keys(liveEvaluations).length > 0) {
      const setsGraded = computeUserSetGradingDetails(liveEvaluations);
      const cardsGradedTotal = Object.keys(liveEvaluations).length;
      return {
        ...selectedUser,
        cardsGradedTotal,
        setsGraded,
      };
    }
    return selectedUser;
  }, [selectedUser, liveEvaluations]);

  const handleRevokeAdmin = async (user: AdminUserSummary) => {
    if (isPermanentSuperAdmin(user.email)) {
      alert('The primary owner account cannot be revoked.');
      return;
    }

    if (typeof window !== 'undefined' && window.confirm) {
      if (!window.confirm(`Are you sure you want to revoke admin privileges from ${user.name} (${user.email || user.id})?`)) {
        return;
      }
    }

    setActionLoadingId(user.id);
    const res = await revokeAdminAccess(user.email || user.id);
    setActionLoadingId(null);

    if (res.success) {
      if (selectedUser?.id === user.id) {
        onSelectUser({ ...selectedUser, isAdmin: false });
      }
      onRefreshData?.();
    } else {
      alert(res.error || 'Failed to revoke admin privileges.');
    }
  };

  const handleGrantAdmin = async (user: AdminUserSummary) => {
    const identifier = user.email || user.id;
    if (!identifier) return;

    if (typeof window !== 'undefined' && window.confirm) {
      if (!window.confirm(`Grant administrator privileges to ${user.name} (${identifier})?`)) {
        return;
      }
    }

    setActionLoadingId(user.id);
    const res = await grantAdminAccess(identifier, currentUser?.id);
    setActionLoadingId(null);

    if (res.success) {
      if (selectedUser?.id === user.id) {
        onSelectUser({ ...selectedUser, isAdmin: true });
      }
      onRefreshData?.();
    } else {
      alert(res.error || 'Failed to grant admin privileges.');
    }
  };

  // Filter & Sort Logic
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = u.name.toLowerCase().includes(q);
          const matchEmail = u.email ? u.email.toLowerCase().includes(q) : false;
          const matchId = u.id.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchId) return false;
        }

        // Auth Method filter
        if (authMethodFilter !== 'ALL' && (u.authMethodLabel || u.provider) !== authMethodFilter) {
          return false;
        }

        // Status filter
        if (statusFilter === 'ADMINS' && !u.isAdmin) return false;
        if (statusFilter === 'ACTIVE' && u.status !== 'active') return false;
        if (statusFilter === 'RECENT' && u.status !== 'recent') return false;
        if (statusFilter === 'DORMANT' && u.status !== 'dormant') return false;

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'lastLogin') {
          diff = new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime();
        } else if (sortField === 'cardsGraded') {
          diff = b.cardsGradedTotal - a.cardsGradedTotal;
        } else if (sortField === 'quizzes') {
          diff = b.totalQuizzes - a.totalQuizzes;
        } else if (sortField === 'accuracy') {
          diff = b.gradingAccuracyScore - a.gradingAccuracyScore;
        } else if (sortField === 'name') {
          diff = a.name.localeCompare(b.name);
        }
        return sortAsc ? -diff : diff;
      });
  }, [users, searchQuery, authMethodFilter, statusFilter, sortField, sortAsc]);

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Controls Header */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-emerald-600'
              }`}
            >
              Active 24h
            </button>
            <button
              onClick={() => setStatusFilter('ADMINS')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === 'ADMINS'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-violet-600'
              }`}
            >
              Admins
            </button>
          </div>

          {/* Auth Method Filter Dropdown */}
          <select
            value={authMethodFilter}
            onChange={(e) => setAuthMethodFilter(e.target.value)}
            aria-label="Filter users by authentication method"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Auth Methods</option>
            <option value="Google SSO">Google SSO</option>
            <option value="Email & Password">Email & Password</option>
            <option value="Discord SSO">Discord SSO</option>
            <option value="Apple SSO">Apple SSO</option>
            <option value="Local Dev">Local Dev</option>
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 sm:px-6">
                  <button
                    onClick={() => handleToggleSort('name')}
                    className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>User</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Auth Method</th>
                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleToggleSort('cardsGraded')}
                    className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>Cards Graded</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleToggleSort('quizzes')}
                    className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>Quizzes</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleToggleSort('accuracy')}
                    className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>Grading Accuracy</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleToggleSort('lastLogin')}
                    className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>Last Login</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No registered users found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => onSelectUser(user)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors cursor-pointer group"
                  >
                  {/* User Profile */}
                  <td className="py-3 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            const next = e.currentTarget.nextElementSibling as HTMLElement;
                            if (next) next.style.display = 'flex';
                          }}
                          className="w-8 h-8 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                        />
                      ) : null}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                        style={{
                          backgroundColor: user.avatarColor,
                          display: user.avatarUrl ? 'none' : 'flex',
                        }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-300">
                            {user.name}
                          </span>
                          {user.isAdmin && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">Lv.{user.level} • {user.xp} XP</span>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold">
                    {user.email || '—'}
                  </td>

                  {/* Auth Method Badge */}
                  <td className="py-3 px-4">
                    {renderAuthMethodBadge(user.authMethod, user.authMethodLabel || user.provider)}
                  </td>

                  {/* Cards Graded */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                        {user.cardsGradedTotal}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({user.setsGradedCount} sets)
                      </span>
                    </div>
                  </td>

                  {/* Quizzes Taken */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                        {user.totalQuizzes}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({user.quizAccuracy}%)
                      </span>
                    </div>
                  </td>

                  {/* Grading Calibration Accuracy */}
                  <td className="py-3 px-4">
                    {user.cardsGradedTotal > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {user.gradingAccuracyScore}%
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          {user.gradingGpa} GPA
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs font-mono">—</span>
                    )}
                  </td>

                  {/* Last Login */}
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                    {formatDate(user.lastLoginAt)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {user.isAdmin && !isPermanentSuperAdmin(user.email) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevokeAdmin(user);
                          }}
                          disabled={actionLoadingId === user.id}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-700 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Remove Admin Access"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                          <span>Remove Admin</span>
                        </button>
                      )}
                      {!user.isAdmin && (user.email || user.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGrantAdmin(user);
                          }}
                          disabled={actionLoadingId === user.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-violet-600 text-slate-600 hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-violet-700 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Grant Admin Access"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Make Admin</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectUser(user);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-violet-600 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Dossier
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over User Detail Modal / Drawer */}
      {selectedUser && (() => {
        const displayUser = activeUser || selectedUser;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-y-auto space-y-6 border-l border-slate-200 dark:border-slate-800">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {displayUser.avatarUrl ? (
                    <img
                      src={displayUser.avatarUrl}
                      alt={displayUser.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const next = e.currentTarget.nextElementSibling as HTMLElement;
                        if (next) next.style.display = 'flex';
                      }}
                      className="w-12 h-12 rounded-2xl object-cover border border-violet-500/40 shadow-md shrink-0"
                    />
                  ) : null}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base text-white shadow-md"
                    style={{
                      backgroundColor: displayUser.avatarColor,
                      display: displayUser.avatarUrl ? 'none' : 'flex',
                    }}
                  >
                    {displayUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                        {displayUser.name}
                      </h2>
                      {displayUser.isAdmin && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                          ADMIN
                        </span>
                      )}
                      {isLoadingLiveEvals && (
                        <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 animate-pulse">
                          Syncing evaluations...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      ID: {displayUser.id}
                    </p>
                    <div className="mt-1">
                      {renderAuthMethodBadge(displayUser.authMethod, displayUser.authMethodLabel || displayUser.provider)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSelectUser(null)}
                  aria-label="Close user dossier drawer"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* RLS Visibility / Telemetry Status Note if User Shows 0 Cards */}
              {displayUser.cardsGradedTotal === 0 && !isPermanentSuperAdmin(displayUser.email) && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      Database Telemetry Status
                    </span>
                    <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400">0 Cloud Rows</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                    No card evaluations are currently recorded in the cloud database for this user. If they graded cards in their browser, their evaluations are preserved in their device's local storage and will automatically flush to the cloud on their next visit.
                  </p>
                </div>
              )}

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Cards Graded</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white font-heading mt-0.5">
                    {displayUser.cardsGradedTotal}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Grade Accuracy</div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-heading mt-0.5">
                    {displayUser.cardsGradedTotal > 0 ? `${displayUser.gradingAccuracyScore}%` : '—'}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Evaluator GPA</div>
                  <div className="text-lg font-black text-indigo-600 dark:text-cyan-400 font-heading mt-0.5">
                    {displayUser.cardsGradedTotal > 0 ? displayUser.gradingGpa : '—'}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Quizzes Taken</div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-heading mt-0.5">
                    {displayUser.totalQuizzes}
                  </div>
                </div>
              </div>

              {/* Sets Graded Breakdown (How many sets they have graded & cards per set) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <span>Sets Graded Breakdown (Cards Per Set)</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    {displayUser.setsGraded.filter((s) => s.cardsGraded > 0).length} Sets Active
                  </span>
                </div>

                <div className="space-y-2.5">
                  {displayUser.setsGraded.map((set) => (
                    <div
                      key={set.setCode}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-violet-600 dark:text-cyan-300">
                            {set.setCode}
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {set.setName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono font-semibold">
                          <span className="text-slate-900 dark:text-white">
                            {set.cardsGraded} / {set.totalCards} cards
                          </span>
                          <span className="text-xs text-violet-600 dark:text-cyan-300">
                            ({set.percentComplete}%)
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            set.percentComplete === 100
                              ? 'bg-emerald-500'
                              : 'bg-violet-600 dark:bg-cyan-400'
                          }`}
                          style={{ width: `${set.percentComplete}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* User Profile Metadata */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Email Address:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                  {selectedUser.email || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Account Created:</span>
                <span className="font-mono text-slate-900 dark:text-slate-200">
                  {formatDate(selectedUser.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Last Seen Active:</span>
                <span className="font-mono text-slate-900 dark:text-slate-200">
                  {formatDate(selectedUser.lastLoginAt)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Evaluation Tendency / Bias:</span>
                <span className="capitalize font-semibold text-violet-600 dark:text-cyan-300">
                  {selectedUser.gradingBias} Grader
                </span>
              </div>
            </div>

            {/* Administrative Access Card */}
            <div className="p-4 rounded-2xl border text-xs space-y-3 bg-slate-50/70 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Key className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span>Administrative Access</span>
                </div>
                {selectedUser.isAdmin && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                    ADMIN
                  </span>
                )}
              </div>

              {isPermanentSuperAdmin(selectedUser.email) ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold">Permanent Super Admin (Owner)</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400">
                        Root platform owner account. Privileges cannot be revoked.
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                    Protected
                  </span>
                </div>
              ) : selectedUser.isAdmin ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-800/50">
                  <div className="space-y-0.5">
                    <div className="font-bold text-violet-950 dark:text-violet-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      <span>Authorized Administrator</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Has full access to admin analytics, activity logs, and access control.
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevokeAdmin(selectedUser)}
                    disabled={actionLoadingId === selectedUser.id}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <ShieldOff className="w-4 h-4" />
                    <span>{actionLoadingId === selectedUser.id ? 'Removing...' : 'Remove Admin Access'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-slate-400" />
                      <span>Standard User Account</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Restricted to player grading, quiz tools, and personal evaluation history.
                    </div>
                  </div>

                  <button
                    onClick={() => handleGrantAdmin(selectedUser)}
                    disabled={actionLoadingId === selectedUser.id || (!selectedUser.email && !selectedUser.id)}
                    className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{actionLoadingId === selectedUser.id ? 'Granting...' : 'Grant Admin Privileges'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

function formatDate(isoString: string): string {
  if (!isoString) return 'Never';
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
