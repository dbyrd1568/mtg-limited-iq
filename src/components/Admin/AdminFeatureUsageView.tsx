import React, { useState } from 'react';
import {
  Sparkles,
  Award,
  Brain,
  Search,
  Layers,
  EyeOff,
  BarChart3,
  Download,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { FeatureUsageStat } from '../../types/admin';

interface AdminFeatureUsageViewProps {
  features: FeatureUsageStat[];
}

export const AdminFeatureUsageView: React.FC<AdminFeatureUsageViewProps> = ({ features }) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const filteredFeatures = categoryFilter === 'ALL'
    ? features
    : features.filter((f) => f.category === categoryFilter);

  // Category Aggregates
  const categoryStats = {
    grading: features.filter((f) => f.category === 'grading').reduce((a, b) => a + b.totalInteractions, 0),
    quiz: features.filter((f) => f.category === 'quiz').reduce((a, b) => a + b.totalInteractions, 0),
    explorer: features.filter((f) => f.category === 'explorer').reduce((a, b) => a + b.totalInteractions, 0),
    utility: features.filter((f) => f.category === 'utility').reduce((a, b) => a + b.totalInteractions, 0),
  };

  const totalInteractionsAll = features.reduce((a, b) => a + b.totalInteractions, 0);

  return (
    <div className="space-y-6">
      {/* Category Engagement Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Grading & Forecasts</span>
            <Award className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-heading mt-2">
            {categoryStats.grading}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalInteractionsAll > 0 ? Math.round((categoryStats.grading / totalInteractionsAll) * 100) : 0}% of all interactions
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Tactical Quizzes</span>
            <Brain className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-heading mt-2">
            {categoryStats.quiz}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalInteractionsAll > 0 ? Math.round((categoryStats.quiz / totalInteractionsAll) * 100) : 0}% of all interactions
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Set Exploration</span>
            <Layers className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-heading mt-2">
            {categoryStats.explorer}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalInteractionsAll > 0 ? Math.round((categoryStats.explorer / totalInteractionsAll) * 100) : 0}% of all interactions
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Search & Utilities</span>
            <Search className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-heading mt-2">
            {categoryStats.utility}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalInteractionsAll > 0 ? Math.round((categoryStats.utility / totalInteractionsAll) * 100) : 0}% of all interactions
          </p>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              categoryFilter === 'ALL'
                ? 'bg-violet-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Features ({features.length})
          </button>
          <button
            onClick={() => setCategoryFilter('grading')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              categoryFilter === 'grading'
                ? 'bg-violet-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Grading Tools
          </button>
          <button
            onClick={() => setCategoryFilter('quiz')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              categoryFilter === 'quiz'
                ? 'bg-violet-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Quiz & Mastery
          </button>
          <button
            onClick={() => setCategoryFilter('explorer')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              categoryFilter === 'explorer'
                ? 'bg-violet-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Exploration
          </button>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Sorted by total telemetry volume
        </span>
      </div>

      {/* Feature Usage Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredFeatures.map((feat) => {
          const Icon = getFeatureIcon(feat.featureKey);

          return (
            <div
              key={feat.featureKey}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-violet-500/50 transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-violet-600 dark:text-cyan-300 flex items-center justify-center border border-slate-200 dark:border-slate-700/60 shadow-xs group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {feat.category}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    {feat.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>

              {/* Metrics & Adoption Meter */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Adoption Rate</span>
                  <span className="font-mono font-bold text-violet-600 dark:text-cyan-300">
                    {feat.adoptionRate}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all duration-500"
                    style={{ width: `${feat.adoptionRate}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                  <span>{feat.totalInteractions} total uses</span>
                  <span>{feat.uniqueUsers} unique drafters</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function getFeatureIcon(key: string): React.FC<{ className?: string }> {
  switch (key) {
    case 'card_grading':
      return Award;
    case 'blind_grading':
      return EyeOff;
    case 'card_quiz':
      return Brain;
    case 'archetype_forecast':
      return BarChart3;
    case 'similar_cards':
      return Sparkles;
    case 'set_explorer':
      return Layers;
    case 'mastery_stats':
      return Flame;
    case 'search_filters':
      return Search;
    case 'export_data':
      return Download;
    default:
      return Sparkles;
  }
}
