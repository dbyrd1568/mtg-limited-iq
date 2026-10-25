import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  BarChart3,
  Award,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  ArrowRight,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { SetInfo } from '../../types/mtg';
import {
  SyncSummary,
  SyncProgressUpdate,
  getPreviewSetsList,
  get17LandsSyncableSets,
  getProRatingsSyncableSets,
  syncPreviewSetsAndCards,
  sync17LandsTelemetry,
  syncProCreatorRatings,
} from '../../services/adminDataSync';

interface AdminDataSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncType: 'preview_cards' | 'seventeen_lands' | 'pro_ratings';
  onSyncComplete?: (summary: SyncSummary) => void;
}

export const AdminDataSyncModal: React.FC<AdminDataSyncModalProps> = ({
  isOpen,
  onClose,
  syncType,
  onSyncComplete,
}) => {
  const [availableSets, setAvailableSets] = useState<SetInfo[]>([]);
  const [selectedSetCode, setSelectedSetCode] = useState<string>('ALL');
  const [isLoadingSets, setIsLoadingSets] = useState<boolean>(true);

  // Sync execution state
  const [syncState, setSyncState] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [currentDetails, setCurrentDetails] = useState<string | undefined>();
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load candidate sets when modal opens or syncType changes
  useEffect(() => {
    if (!isOpen) {
      setSyncState('idle');
      setProgress(0);
      setLogs([]);
      setSummary(null);
      return;
    }

    let isMounted = true;
    setIsLoadingSets(true);
    setSelectedSetCode('ALL');

    const loader =
      syncType === 'preview_cards'
        ? getPreviewSetsList
        : syncType === 'seventeen_lands'
        ? get17LandsSyncableSets
        : getProRatingsSyncableSets;
    loader()
      .then((sets) => {
        if (isMounted) {
          setAvailableSets(sets);
          setIsLoadingSets(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load sets for sync modal:', err);
        if (isMounted) setIsLoadingSets(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, syncType]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setSyncState('running');
    setProgress(5);
    const syncLabel =
      syncType === 'preview_cards'
        ? 'Preview Card Sync'
        : syncType === 'seventeen_lands'
        ? '17Lands Telemetry Sync'
        : 'Pro Creator Ratings Sync';
    setLogs([`[${new Date().toLocaleTimeString()}] Starting ${syncLabel} for ${selectedSetCode}...`]);

    const handleProgress = (update: SyncProgressUpdate) => {
      setProgress(update.progress);
      setCurrentPhase(update.phase);
      setCurrentMessage(update.message);
      setCurrentDetails(update.details);
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [${update.phase}] ${update.message}${update.details ? ` (${update.details})` : ''}`,
      ]);
    };

    try {
      let result: SyncSummary;
      if (syncType === 'preview_cards') {
        result = await syncPreviewSetsAndCards({
          targetSetCode: selectedSetCode,
          onProgress: handleProgress,
        });
      } else if (syncType === 'seventeen_lands') {
        result = await sync17LandsTelemetry({
          targetSetCode: selectedSetCode,
          onProgress: handleProgress,
        });
      } else {
        result = await syncProCreatorRatings({
          targetSetCode: selectedSetCode,
          onProgress: handleProgress,
        });
      }

      setSummary(result);
      setSyncState('completed');
      onSyncComplete?.(result);
    } catch (err: any) {
      setSyncState('error');
      setCurrentMessage(err?.message || 'Sync failed unexpectedly.');
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ❌ ERROR: ${err?.message || 'Unknown error'}`,
      ]);
    }
  };

  const isPreview = syncType === 'preview_cards';
  const is17L = syncType === 'seventeen_lands';
  const isPro = syncType === 'pro_ratings';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                isPreview
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20'
                  : is17L
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
                  : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20'
              }`}
            >
              {isPreview ? <Sparkles className="w-5 h-5" /> : is17L ? <BarChart3 className="w-5 h-5" /> : <Award className="w-5 h-5" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isPreview
                      ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300'
                      : is17L
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                  }`}
                >
                  {isPreview
                    ? 'Card Catalog & Spoilers • Scryfall API'
                    : is17L
                    ? 'Draft Telemetry & Win Rates • 17Lands Telemetry'
                    : 'Pro Creator Reviews • LSV • LLU • Draftsim'}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white font-heading">
                {isPreview
                  ? 'Update Preview Sets & Cards'
                  : is17L
                  ? 'Update 17Lands Data'
                  : 'Update Creator Ratings'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                {isPreview
                  ? 'Query Scryfall for newly spoiled cards in upcoming preview sets (such as Star Trek TRK). Invalidate local caches and refresh set counts.'
                  : is17L
                  ? 'Ingest Premier Draft win rates, ALSA, and sample sizes for active draft sets (HOB, MBC, FRA) into local IndexedDB and central Supabase cache.'
                  : 'Synchronize set reviews and card grades across Luis Scott-Vargas (LSV), Limited Level Ups (LLU), and Draftsim (DS). Refreshes local and Supabase databases.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={syncState === 'running'}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* IDLE VIEW: Configuration & Set Selection */}
          {syncState === 'idle' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Target Set Scope
                </label>
                <div className="relative">
                  <select
                    value={selectedSetCode}
                    onChange={(e) => setSelectedSetCode(e.target.value)}
                    disabled={isLoadingSets}
                    className="w-full appearance-none px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-violet-500 cursor-pointer"
                  >
                    <option value="ALL">
                      {isPreview
                        ? '★ All Preview & Upcoming Sets (Star Trek TRK, etc.)'
                        : is17L
                        ? '★ All Active Arena Draft Sets (HOB, MBC, FRA)'
                        : '★ All Active & Benchmark Sets (FRA, HOB, MBC, SOS, BLB...)'}
                    </option>
                    {availableSets.map((s) => {
                      const total = s.total_cards || s.card_count;
                      const countLabel = s.preview_count !== undefined && s.preview_count < total
                        ? `${s.preview_count} / ${total} cards`
                        : s.card_count ? `${s.card_count} cards` : '';
                      return (
                        <option key={s.code} value={s.code}>
                          {s.name} ({s.code.toUpperCase()}) {countLabel ? `— ${countLabel}` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isPreview
                    ? 'Scryfall spoiler search respects polite 80ms rate limits and updates canonical card variants.'
                    : is17L
                    ? 'Pulls fresh Premier Draft card data via edge proxy and synchronizes with IndexedDB and Supabase.'
                    : 'Synchronizes reviews from Supabase and tierlist feeds across Draftsim, Limited Level Ups, and LSV.'}
                </p>
              </div>

              {/* Informational Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 flex items-start gap-2.5">
                  <Database className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Multi-Tier Cache Invalidation
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      Clears session cache and rewrites persistent IndexedDB cache keys.
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 flex items-start gap-2.5">
                  <Layers className={`w-4 h-4 ${isPro ? 'text-amber-500' : 'text-emerald-500'} shrink-0 mt-0.5`} />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {isPro ? 'All 3 Pro Creators' : 'Supabase Cloud Sync'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                      {isPro
                        ? 'Synchronize set reviews and card grades across Luis Scott-Vargas (LSV), Limited Level Ups (LLU), and Draftsim (DS).'
                        : 'Upserts set schedules and telemetry into central tables when authenticated.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RUNNING VIEW: Live Progress & Logs */}
          {syncState === 'running' && (
            <div className="space-y-5">
              {/* Progress Bar Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-500" />
                    <span>{currentPhase || 'Processing...'}</span>
                  </div>
                  <span className="font-mono text-violet-600 dark:text-cyan-400 font-bold">
                    {progress}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isPreview
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {currentMessage}
                </p>
                {currentDetails && (
                  <p className="text-[11px] text-slate-400 font-mono">{currentDetails}</p>
                )}
              </div>

              {/* Live Step Logs Console */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* COMPLETED VIEW: Summary Report */}
          {syncState === 'completed' && summary && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Sync Completed Successfully
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                    {summary.successfulSets} of {summary.totalSets} set(s) processed. Caches invalidated and updated.
                  </p>
                </div>
              </div>

              {/* Set Results List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Ingestion Results
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {summary.results.map((res) => (
                    <div
                      key={res.setCode}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {res.setName} ({res.setCode})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              res.status === 'updated'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : res.status === 'unchanged'
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : res.status === 'skipped'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {res.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {res.details || res.error}
                        </p>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        {isPreview ? (
                          <div className="font-bold text-slate-900 dark:text-white">
                            {res.newCount ?? res.cardsProcessed} cards
                          </div>
                        ) : (
                          <div className="font-bold text-slate-900 dark:text-white">
                            {(res.sampleSize || 0).toLocaleString()} games
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ERROR VIEW */}
          {syncState === 'error' && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                    Sync Encountered an Error
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-300/80">
                    {currentMessage}
                  </p>
                </div>
              </div>
              <button
                onClick={handleStartSync}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Retry Sync
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Admin Data Utility</span>
          </div>

          <div className="flex items-center gap-2">
            {syncState === 'idle' ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartSync}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 cursor-pointer transition-all ${
                    isPreview
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-500/20'
                      : is17L
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/20'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {isPreview
                      ? 'Update Preview Cards'
                      : is17L
                      ? 'Update 17Lands Data'
                      : 'Update Creator Ratings'}
                  </span>
                </button>
              </>
            ) : syncState === 'completed' ? (
              <>
                <button
                  onClick={() => setSyncState('idle')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Run Another Sync
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </>
            ) : syncState === 'running' ? (
              <span className="text-xs text-slate-400 italic">
                Syncing data, please wait...
              </span>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
