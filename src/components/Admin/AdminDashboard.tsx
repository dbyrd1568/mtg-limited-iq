import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  BarChart3,
  Users,
  Sparkles,
  Layers,
  Key,
  Download,
  RefreshCw,
  ChevronDown,
  Lock,
  ArrowLeft,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import {
  AdminSubTab,
  AdminTimeRange,
  AdminOverviewKPIs,
  AdminUserSummary,
  FeatureUsageStat,
  SetGradingAnalytics,
  GradeAccuracyReport,
  AdminAccessRecord,
  UserActivityLog,
} from '../../types/admin';
import { UserAccount } from '../../types/mtg';
import {
  fetchAdminOverviewKPIs,
  fetchUserDirectory,
  fetchFeatureUsageMetrics,
  fetchSetGradingAnalytics,
  fetchGradingAccuracyReport,
  fetchAdminList,
  exportAdminDataAsJSON,
  exportAdminDataAsCSV,
} from '../../services/admin';
import { fetchActivityLogs } from '../../services/telemetry';
import { isSupabaseConfigured } from '../../services/supabase';

// Subtab views
import { AdminOverviewView } from './AdminOverviewView';
import { AdminUsersView } from './AdminUsersView';
import { AdminFeatureUsageView } from './AdminFeatureUsageView';
import { AdminGradingAnalyticsView } from './AdminGradingAnalyticsView';
import { AdminAccessControlView } from './AdminAccessControlView';

interface AdminDashboardProps {
  currentUser: UserAccount | null;
  onOpenAuthModal: () => void;
  onReturnHome: () => void;
  initialSubTab?: AdminSubTab;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onOpenAuthModal,
  onReturnHome,
  initialSubTab = 'overview',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>(initialSubTab);
  const [timeRange, setTimeRange] = useState<AdminTimeRange>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Admin Data State
  const [kpis, setKpis] = useState<AdminOverviewKPIs>({
    totalUsers: 0,
    activeUsers7d: 0,
    activeUsers24h: 0,
    totalSetsGraded: 0,
    totalCardsGraded: 0,
    totalQuizzesTaken: 0,
    avgGradingAccuracy: 85,
    avgQuizAccuracy: 82,
    topActiveFeature: 'Card Grading',
    mostGradedSet: 'DFT',
  });
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [features, setFeatures] = useState<FeatureUsageStat[]>([]);
  const [sets, setSets] = useState<SetGradingAnalytics[]>([]);
  const [accuracy, setAccuracy] = useState<GradeAccuracyReport>({
    totalEvaluationsEvaluated: 0,
    systemCalibrationScore: 84,
    systemGpa: 3.3,
    exactMatchesCount: 0,
    exactMatchesPercentage: 35,
    oneStepMatchesCount: 0,
    oneStepMatchesPercentage: 48,
    twoStepMatchesCount: 0,
    twoStepMatchesPercentage: 12,
    majorDiscrepanciesCount: 0,
    majorDiscrepanciesPercentage: 5,
    optimisticBiasPercentage: 55,
    criticalBiasPercentage: 45,
    biggestSleepers: [],
    biggestTraps: [],
  });
  const [adminList, setAdminList] = useState<AdminAccessRecord[]>([]);
  const [recentLogs, setRecentLogs] = useState<UserActivityLog[]>([]);
  const [selectedUserForDossier, setSelectedUserForDossier] = useState<AdminUserSummary | null>(null);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        kpisData,
        usersData,
        featuresData,
        setsData,
        accuracyData,
        adminsData,
        logsData,
      ] = await Promise.all([
        fetchAdminOverviewKPIs(timeRange),
        fetchUserDirectory(),
        fetchFeatureUsageMetrics(timeRange),
        fetchSetGradingAnalytics(),
        fetchGradingAccuracyReport(),
        fetchAdminList(),
        fetchActivityLogs(timeRange),
      ]);

      setKpis(kpisData);
      setUsers(usersData);
      setFeatures(featuresData);
      setSets(setsData);
      setAccuracy(accuracyData);
      setAdminList(adminsData);
      setRecentLogs(logsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Export handlers
  const handleExportJSON = async () => {
    setIsExportMenuOpen(false);
    const jsonStr = await exportAdminDataAsJSON();
    downloadFile(jsonStr, `mtg_limited_iq_admin_export_${Date.now()}.json`, 'application/json');
  };

  const handleExportCSV = async () => {
    setIsExportMenuOpen(false);
    const { usersCsv, setsCsv, featuresCsv } = await exportAdminDataAsCSV();
    downloadFile(usersCsv, `mtg_limited_iq_users_${Date.now()}.csv`, 'text/csv');
    setTimeout(() => {
      downloadFile(setsCsv, `mtg_limited_iq_sets_graded_${Date.now()}.csv`, 'text/csv');
    }, 500);
    setTimeout(() => {
      downloadFile(featuresCsv, `mtg_limited_iq_feature_usage_${Date.now()}.csv`, 'text/csv');
    }, 1000);
  };

  const isCloud = isSupabaseConfigured();

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Admin Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <button
              onClick={onReturnHome}
              className="hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>MTG Limited IQ</span>
            </button>
            <span>/</span>
            <span className="text-violet-600 dark:text-cyan-300 font-semibold">Admin Console</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-heading">
                  Administrative Intelligence
                </h1>
                {/* Environment Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-tight border ${
                    isCloud
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCloud ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {isCloud ? 'Cloud RLS Secured' : 'Local Dev Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                User logins, feature adoption, set evaluations, and grading calibration benchmarks.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Time Range, Export, and Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                timeRange === 'today'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                timeRange === '7d'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                timeRange === '30d'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                timeRange === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 text-xs space-y-1">
                <button
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-600 transition-colors cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-violet-500" />
                  <span>Export JSON Report</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>Export CSV Spreadsheets</span>
                </button>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh All Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-violet-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Modern Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'overview'
              ? 'bg-violet-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'users'
              ? 'bg-violet-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Drafters & Users ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('features')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'features'
              ? 'bg-violet-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Feature Adoption</span>
        </button>

        <button
          onClick={() => setActiveSubTab('grading')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'grading'
              ? 'bg-violet-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Grading & Sets</span>
        </button>

        <button
          onClick={() => setActiveSubTab('access')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'access'
              ? 'bg-violet-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Access Control ({adminList.length})</span>
        </button>
      </div>

      {/* Main View Area */}
      <div>
        {activeSubTab === 'overview' && (
          <AdminOverviewView
            kpis={kpis}
            users={users}
            features={features}
            accuracy={accuracy}
            recentLogs={recentLogs}
            onSelectTab={setActiveSubTab}
            onSelectUser={(u) => {
              setSelectedUserForDossier(u);
              setActiveSubTab('users');
            }}
          />
        )}

        {activeSubTab === 'users' && (
          <AdminUsersView
            users={users}
            selectedUser={selectedUserForDossier}
            onSelectUser={setSelectedUserForDossier}
          />
        )}

        {activeSubTab === 'features' && (
          <AdminFeatureUsageView features={features} />
        )}

        {activeSubTab === 'grading' && (
          <AdminGradingAnalyticsView sets={sets} accuracy={accuracy} users={users} />
        )}

        {activeSubTab === 'access' && (
          <AdminAccessControlView
            adminList={adminList}
            currentUser={currentUser}
            onRefreshAdmins={loadAllData}
          />
        )}
      </div>
    </div>
  );
};

function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
