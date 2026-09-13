import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { AdminUserSummary } from '../../types/admin';

interface AdminUsersViewProps {
  users: AdminUserSummary[];
  selectedUser: AdminUserSummary | null;
  onSelectUser: (user: AdminUserSummary | null) => void;
}

type SortField = 'lastLogin' | 'cardsGraded' | 'quizzes' | 'accuracy' | 'name';

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  users,
  selectedUser,
  onSelectUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('lastLogin');
  const [sortAsc, setSortAsc] = useState(false);

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

        // Provider filter
        if (providerFilter !== 'ALL' && u.provider !== providerFilter) {
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
  }, [users, searchQuery, providerFilter, statusFilter, sortField, sortAsc]);

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
            placeholder="Search drafters by name, email, or ID..."
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

          {/* Provider Filter Dropdown */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            aria-label="Filter drafters by auth provider"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Providers</option>
            <option value="google">Google</option>
            <option value="discord">Discord</option>
            <option value="apple">Apple</option>
            <option value="email">Email</option>
            <option value="local">Local</option>
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
                    <span>Drafter</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4">Contact / Email</th>
                <th className="py-3.5 px-4">Provider</th>
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
                    No registered drafters found matching the criteria.
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
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                        style={{ backgroundColor: user.avatarColor }}
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
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {user.email || 'Local User'}
                  </td>

                  {/* Provider Badge */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {user.provider}
                    </span>
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {user.gradingAccuracyScore}%
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {user.gradingGpa} GPA
                      </span>
                    </div>
                  </td>

                  {/* Last Login */}
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                    {formatDate(user.lastLoginAt)}
                  </td>

                  {/* Inspect Button */}
                  <td className="py-3 px-4 sm:px-6 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectUser(user);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-violet-600 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Dossier
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over User Detail Modal / Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-y-auto space-y-6 border-l border-slate-200 dark:border-slate-800">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base text-white shadow-md"
                  style={{ backgroundColor: selectedUser.avatarColor }}
                >
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
                      {selectedUser.name}
                    </h2>
                    {selectedUser.isAdmin && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {selectedUser.id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onSelectUser(null)}
                aria-label="Close drafter dossier drawer"
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Cards Graded</div>
                <div className="text-lg font-black text-slate-900 dark:text-white font-heading mt-0.5">
                  {selectedUser.cardsGradedTotal}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Grade Accuracy</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-heading mt-0.5">
                  {selectedUser.gradingAccuracyScore}%
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Evaluator GPA</div>
                <div className="text-lg font-black text-indigo-600 dark:text-cyan-400 font-heading mt-0.5">
                  {selectedUser.gradingGpa}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">Quizzes Taken</div>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-heading mt-0.5">
                  {selectedUser.totalQuizzes}
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
                  {selectedUser.setsGraded.filter((s) => s.cardsGraded > 0).length} Sets Active
                </span>
              </div>

              <div className="space-y-2.5">
                {selectedUser.setsGraded.map((set) => (
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

            {/* Drafter Profile Metadata */}
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
          </div>
        </div>
      )}
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
