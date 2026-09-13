import React, { useState } from 'react';
import {
  Layers,
  Award,
  TrendingDown,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  SetGradingAnalytics,
  GradeAccuracyReport,
  AdminUserSummary,
} from '../../types/admin';
import { SetSymbol } from '../UI/SetSymbol';

interface AdminGradingAnalyticsViewProps {
  sets: SetGradingAnalytics[];
  accuracy: GradeAccuracyReport;
  users: AdminUserSummary[];
}

export const AdminGradingAnalyticsView: React.FC<AdminGradingAnalyticsViewProps> = ({
  sets,
  accuracy,
  users,
}) => {
  const [selectedUserForBreakdown, setSelectedUserForBreakdown] = useState<string>(
    users[0]?.id || ''
  );

  const activeUser = users.find((u) => u.id === selectedUserForBreakdown) || users[0];

  return (
    <div className="space-y-8">
      {/* 1. Accuracy & Calibration Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Master Calibration Accuracy */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Grading Calibration Accuracy
            </span>
            <Target className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-slate-900 dark:text-white font-heading">
              {accuracy.systemCalibrationScore}%
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {accuracy.systemGpa} GPA
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Measures how accurately users predict card power compared to empirical 17Lands win rates (±1 step tolerance).
          </p>
        </div>

        {/* Card 2: Accuracy Step Distribution */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Accuracy Discrepancy Breakdown
          </span>
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Exact Matches (0 Steps):
              </span>
              <span className="font-mono font-bold">{accuracy.exactMatchesPercentage}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                Within 1 Step (Correct):
              </span>
              <span className="font-mono font-bold">{accuracy.oneStepMatchesPercentage}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                2 Steps Off (Minor Miss):
              </span>
              <span className="font-mono font-bold">{accuracy.twoStepMatchesPercentage}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                3+ Steps Off (Trap/Sleeper):
              </span>
              <span className="font-mono font-bold">{accuracy.majorDiscrepanciesPercentage}%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Evaluation Bias */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Community Grading Bias
            </span>
            <Flame className="w-4.5 h-4.5 text-amber-500" />
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Optimistic (Overrated):
              </span>
              <span className="font-mono font-bold">{accuracy.optimisticBiasPercentage}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${accuracy.optimisticBiasPercentage}%` }}
              />
              <div
                className="bg-cyan-500 h-full"
                style={{ width: `${accuracy.criticalBiasPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                Critical (Underrated):
              </span>
              <span className="font-mono font-bold">{accuracy.criticalBiasPercentage}%</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 pt-1">
            Community tends slightly toward optimistic grading on splashy bomb rares.
          </p>
        </div>
      </div>

      {/* 2. Sets Graded Leaderboard & Statistics Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                MTG Sets Graded Across Community
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Number of cards graded, total set cards, unique users, and completion rates
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {sets.length} Tracked Limited Formats
          </span>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 sm:px-6">Set</th>
                  <th className="py-3.5 px-4">Total Cards in Set</th>
                  <th className="py-3.5 px-4">Cards Graded (Community)</th>
                  <th className="py-3.5 px-4">Unique Graders</th>
                  <th className="py-3.5 px-4">100% Set Graded</th>
                  <th className="py-3.5 px-4">Avg Cards / User</th>
                  <th className="py-3.5 px-4 sm:px-6">Calibration Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {sets.map((set) => (
                  <tr
                    key={set.setCode}
                    className="hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-2.5">
                        <SetSymbol setCode={set.setCode} size="sm" />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white font-mono">
                            {set.setCode}
                          </div>
                          <div className="text-[11px] text-slate-400">{set.setName}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {set.totalSetCards} cards
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-violet-600 dark:text-cyan-300">
                        <span>{set.totalCardsGraded.toLocaleString()}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {set.uniqueGradersCount} users
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        <Check className="w-3 h-3" />
                        {set.fullyGradedUsersCount} users
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {set.avgCardsGradedPerUser} cards
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {set.communityCalibrationScore}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Individual User Sets Graded Deep Dive (Per-User Cards per Set) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Per-User Set Grading Breakdown
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect how many sets and cards each individual user has completed
            </p>
          </div>

          {/* User Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Select User:</span>
            <select
              value={selectedUserForBreakdown}
              onChange={(e) => setSelectedUserForBreakdown(e.target.value)}
              aria-label="Select user to view set grading breakdown"
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.cardsGradedTotal} cards total)
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-xs"
                style={{ backgroundColor: activeUser.avatarColor }}
              >
                {activeUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeUser.name}'s Evaluated Sets
                </div>
                <div className="text-xs text-slate-400">
                  {activeUser.cardsGradedTotal} total cards evaluated across {activeUser.setsGradedCount} sets • Calibration GPA: {activeUser.gradingGpa}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {activeUser.setsGraded.map((set) => (
                <div
                  key={set.setCode}
                  className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <SetSymbol setCode={set.setCode} size="xs" />
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {set.setCode}
                      </span>
                    </div>
                    <div className="font-mono font-bold">
                      <span className="text-violet-600 dark:text-cyan-300">
                        {set.cardsGraded}
                      </span>
                      <span className="text-slate-400 font-normal"> / {set.totalCards}</span>
                      <span className="ml-1 text-[11px] text-slate-500">
                        ({set.percentComplete}%)
                      </span>
                    </div>
                  </div>

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

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>
                      {set.cardsGraded === 0
                        ? 'Not started'
                        : set.percentComplete === 100
                        ? '100% Complete ✓'
                        : `${set.totalCards - set.cardsGraded} cards remaining`}
                    </span>
                    {set.averageUserScore && (
                      <span className="font-mono">Avg Score: {set.averageUserScore}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Community Sleepers & Traps (Cross-User Heuristics) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sleepers */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <TrendingUp className="w-4.5 h-4.5 text-cyan-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                Community Consensus Sleepers
              </h3>
              <p className="text-xs text-slate-400">
                Cards users severely underrated compared to empirical 17Lands win rates
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {accuracy.biggestSleepers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No consensus sleepers identified yet. Sleepers appear as cards are evaluated.
              </div>
            ) : (
              accuracy.biggestSleepers.map((c) => (
                <div
                  key={c.cardName}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{c.cardName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      [{c.setCode}] • {c.totalEvaluations} evaluations
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        User: {c.communityGrade}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-mono px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 font-bold">
                        17L: {c.seventeenLandsGrade}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                      {Math.round((c.winRate || 0.5) * 1000) / 10}% GIH WR
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Traps */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <TrendingDown className="w-4.5 h-4.5 text-rose-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                Community Consensus Traps
              </h3>
              <p className="text-xs text-slate-400">
                Cards users severely overrated compared to empirical 17Lands win rates
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {accuracy.biggestTraps.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No consensus traps identified yet. Traps appear as cards are evaluated.
              </div>
            ) : (
              accuracy.biggestTraps.map((c) => (
                <div
                  key={c.cardName}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{c.cardName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      [{c.setCode}] • {c.totalEvaluations} evaluations
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        User: {c.communityGrade}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold">
                        17L: {c.seventeenLandsGrade}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-semibold">
                      {Math.round((c.winRate || 0.5) * 1000) / 10}% GIH WR
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
