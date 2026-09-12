import React from 'react';
import {
  Users,
  Layers,
  Award,
  Brain,
  TrendingUp,
  Activity,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  AdminOverviewKPIs,
  AdminUserSummary,
  FeatureUsageStat,
  GradeAccuracyReport,
  UserActivityLog,
  AdminSubTab,
} from '../../types/admin';

interface AdminOverviewViewProps {
  kpis: AdminOverviewKPIs;
  users: AdminUserSummary[];
  features: FeatureUsageStat[];
  accuracy: GradeAccuracyReport;
  recentLogs: UserActivityLog[];
  onSelectTab: (tab: AdminSubTab) => void;
  onSelectUser: (user: AdminUserSummary) => void;
}

export const AdminOverviewView: React.FC<AdminOverviewViewProps> = ({
  kpis,
  users,
  features,
  accuracy,
  recentLogs,
  onSelectTab,
  onSelectUser,
}) => {
  // Sort users by activity (cards graded + quizzes)
  const topUsers = [...users]
    .sort((a, b) => b.cardsGradedTotal + b.totalQuizzes - (a.cardsGradedTotal + a.totalQuizzes))
    .slice(0, 5);

  // Top 4 features
  const topFeatures = features.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 4 Master KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Users */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-violet-500/50 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Drafters
            </span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-heading">
              {kpis.totalUsers}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {kpis.activeUsers24h} active today
              </span>
              <span>•</span>
              <span>{kpis.activeUsers7d} this week</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Cards Graded Across Sets */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-500/50 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cards Evaluated
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Layers className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-heading">
              {kpis.totalCardsGraded.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {kpis.totalSetsGraded} MTG Sets
              </span>
              <span>graded across the community</span>
            </div>
          </div>
        </div>

        {/* Metric 3: System Grading Accuracy */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/50 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Grading Calibration
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Award className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white font-heading">
                {kpis.avgGradingAccuracy}%
              </span>
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {accuracy.systemGpa} GPA
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              vs 17Lands empirical tier benchmarks (±1 step)
            </div>
          </div>
        </div>

        {/* Metric 4: Quizzes Taken */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-500/50 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tactical Quizzes
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Brain className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-heading">
              {kpis.totalQuizzesTaken}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {kpis.avgQuizAccuracy}%
              </span>
              <span>avg tactical quiz accuracy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Activity Sparkline + Top Features Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interaction Activity Chart & Health (2 Columns) */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-heading">
                  System Interaction Volume
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Telemetry interactions across card evaluations, quizzes, and archetype forecasts
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/60 px-2.5 py-1 rounded-xl border border-violet-200 dark:border-violet-800/50">
              Live Stream
            </span>
          </div>

          {/* Interactive Responsive SVG Trend Graph */}
          <div className="h-44 w-full pt-4">
            <svg viewBox="0 0 600 150" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="30" x2="600" y2="30" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="600" y2="75" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="600" y2="120" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeDasharray="3 3" />

              {/* Shaded Area */}
              <path
                d="M 0 110 Q 75 40 150 70 T 300 45 T 450 85 T 600 35 L 600 140 L 0 140 Z"
                fill="url(#chartGradient)"
              />

              {/* Trend Line */}
              <path
                d="M 0 110 Q 75 40 150 70 T 300 45 T 450 85 T 600 35"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Data Points */}
              <circle cx="0" cy="110" r="4" className="fill-violet-600 dark:fill-violet-400 stroke-2 stroke-white dark:stroke-slate-900" />
              <circle cx="150" cy="70" r="4" className="fill-violet-600 dark:fill-violet-400 stroke-2 stroke-white dark:stroke-slate-900" />
              <circle cx="300" cy="45" r="5" className="fill-indigo-600 dark:fill-cyan-400 stroke-2 stroke-white dark:stroke-slate-900" />
              <circle cx="450" cy="85" r="4" className="fill-violet-600 dark:fill-violet-400 stroke-2 stroke-white dark:stroke-slate-900" />
              <circle cx="600" cy="35" r="5" className="fill-emerald-500 stroke-2 stroke-white dark:stroke-slate-900 animate-pulse" />
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>6 Days Ago</span>
            <span>4 Days Ago</span>
            <span>2 Days Ago</span>
            <span>Yesterday</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Today</span>
          </div>
        </div>

        {/* Feature Adoption Breakdown (1 Column) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  Top Features
                </h3>
              </div>
              <button
                onClick={() => onSelectTab('features')}
                className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3.5 mt-4">
              {topFeatures.map((feat) => (
                <div key={feat.featureKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {feat.name}
                    </span>
                    <span className="font-mono font-bold text-violet-600 dark:text-cyan-300">
                      {feat.adoptionRate}% adoption
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all duration-500"
                      style={{ width: `${feat.adoptionRate}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{feat.totalInteractions} events</span>
                    <span>{feat.uniqueUsers} active users</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Highest Engagement:</span>
            <span className="font-bold text-violet-700 dark:text-violet-300">
              {kpis.topActiveFeature}
            </span>
          </div>
        </div>
      </div>

      {/* Two Columns: Active Drafters Directory Snapshot & Live Telemetry Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Active Drafters Snapshot */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                Top Active Drafters
              </h3>
            </div>
            <button
              onClick={() => onSelectTab('users')}
              className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>User Directory</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {topUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 border border-slate-100 dark:border-slate-800/60 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-300">
                        {user.name}
                      </span>
                      {user.isAdmin && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {user.email || 'Local User'} • Lv.{user.level}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold font-mono text-slate-900 dark:text-slate-200">
                    {user.cardsGradedTotal} cards graded
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {user.gradingAccuracyScore}% grade accuracy
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Telemetry Activity Feed */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                Recent Telemetry Activity
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Real-time Stream</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
            {recentLogs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/50 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {log.userName}
                    </span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">
                      {formatLogAction(log)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {formatRelativeTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function formatLogAction(log: UserActivityLog): string {
  if (log.eventType === 'grade_card') {
    const set = log.metadata?.set ? `[${log.metadata.set}]` : '';
    const grade = log.metadata?.grade ? `as ${log.metadata.grade}` : '';
    return `graded card ${set} ${grade}`.trim();
  }
  if (log.eventType === 'quiz_complete') {
    const pct = log.metadata?.pct ? `(${log.metadata.pct}%)` : '';
    return `completed tactical quiz ${pct}`.trim();
  }
  if (log.eventType === 'login') {
    return 'signed in to limited IQ';
  }
  return `used ${log.featureName.replace(/_/g, ' ')}`;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
