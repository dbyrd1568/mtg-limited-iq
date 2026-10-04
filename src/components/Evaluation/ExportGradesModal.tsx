import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  ExternalLink,
  Share2,
  Sparkles,
  Info,
  CheckCircle2,
  Layers,
  ArrowRight,
  Bookmark,
  FileCode,
  ShieldCheck,
  Link2,
  Globe,
  Trash2,
  Lock,
  Zap,
  Upload,
  Terminal,
  MousePointer,
} from 'lucide-react';
import { Card, UserCardEvaluation, SeventeenLandsSetData, SetInfo } from '../../types/mtg';
import {
  generate17LandsTiersCsv,
  generate17LandsAutoImportBookmarklet,
  generate17LandsConsoleScript,
  generateFullSpreadsheetCsv,
  generateFullSpreadsheetTsv,
  buildFullSpreadsheetData,
  getFullSpreadsheetHeaders,
  downloadFile,
  copyTextToClipboard,
} from '../../services/gradeExport';
import {
  getAvailableReviewersForSet,
  loadProRatingsForSet,
  AvailableReviewer,
} from '../../services/lsvRatings';
import {
  get17LandsTierListUrl,
  save17LandsTierListUrl,
  loadUserStats,
  loadUserEvaluations,
  getActiveUser,
} from '../../services/storage';
import {
  createOrUpdateGradeShare,
  revokeGradeShare,
  findActiveShareForSet,
  getShareUrl,
  PublicGradeShare,
} from '../../services/shareGrades';
import { SetSymbol } from '../UI/SetSymbol';

interface ExportGradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  evaluations: Record<string, UserCardEvaluation>;
  seventeenLandsData: SeventeenLandsSetData | null;
  currentSet: SetInfo | null;
  userId?: string;
  initialTab?: 'spreadsheet' | 'seventeenlands' | 'share' | 'backup';
}

export const ExportGradesModal: React.FC<ExportGradesModalProps> = ({
  isOpen,
  onClose,
  cards,
  evaluations,
  seventeenLandsData,
  currentSet,
  userId,
  initialTab = 'spreadsheet',
}) => {
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'seventeenlands' | 'share' | 'backup'>(() => initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [exportScope, setExportScope] = useState<'all' | 'graded'>('graded');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const setCode = currentSet?.code || 'SET';
  const setName = currentSet?.name || 'Current Set';

  // 17Lands Public URL state
  const [savedTierUrl, setSavedTierUrl] = useState<string>('');
  const [inputTierUrl, setInputTierUrl] = useState<string>('');
  const [isUrlSavedNotification, setIsUrlSavedNotification] = useState<boolean>(false);

  // Public Share Link State
  const activeUser = getActiveUser();
  const [activeShare, setActiveShare] = useState<PublicGradeShare | null>(null);
  const [includeNotesInShare, setIncludeNotesInShare] = useState<boolean>(true);
  const [authorDisplayName, setAuthorDisplayName] = useState<string>(() => {
    return activeUser?.name || activeUser?.email?.split('@')[0] || 'Anonymous Drafter';
  });
  const [isGeneratingShare, setIsGeneratingShare] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // User & Cross-Set Backup Data
  const activeUserId = userId || getActiveUser()?.id || 'guest';
  const userProfileStats = useMemo(() => loadUserStats(activeUserId), [activeUserId, isOpen]);
  const allUserEvaluations = useMemo(() => loadUserEvaluations(activeUserId), [activeUserId, isOpen]);

  // Load existing share on open
  useEffect(() => {
    if (isOpen && setCode) {
      const existing = findActiveShareForSet(activeUserId, setCode);
      if (existing) {
        setActiveShare(existing);
        setIncludeNotesInShare(existing.includeNotes);
        setAuthorDisplayName(existing.authorName);
      }
    }
  }, [isOpen, setCode, activeUserId]);

  const handleGenerateShare = async () => {
    if (!currentSet) return;
    setIsGeneratingShare(true);
    setShareError(null);
    try {
      const { share, url } = await createOrUpdateGradeShare({
        userId: activeUserId,
        setCode,
        authorName: authorDisplayName,
        evaluations,
        includeNotes: includeNotesInShare,
        existingShareId: activeShare?.id,
      });
      setActiveShare(share);
      await copyTextToClipboard(url);
      setCopiedType('share_url');
      setTimeout(() => setCopiedType(null), 3000);
    } catch (err: any) {
      console.error('Error generating share link:', err);
      setShareError(err?.message || 'Failed to create share link. Please try again.');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!activeShare) return;
    try {
      await revokeGradeShare(activeShare.id, activeUserId);
      setActiveShare(null);
    } catch (err) {
      console.error('Failed to revoke share:', err);
    }
  };

  const totalGradedAllSets = useMemo(() => {
    return Object.values(allUserEvaluations).filter((ev) => Boolean(ev.userGrade)).length;
  }, [allUserEvaluations]);

  const uniqueSetsGraded = useMemo(() => {
    const setCodes = new Set<string>();
    for (const ev of Object.values(allUserEvaluations)) {
      if (ev.userGrade && ev.setCode) {
        setCodes.add(ev.setCode.toUpperCase());
      }
    }
    return Array.from(setCodes).sort();
  }, [allUserEvaluations]);

  const backupJsonObject = useMemo(() => {
    return {
      application: 'MTG Limited IQ',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      userId: activeUserId,
      summary: {
        totalCardsGraded: totalGradedAllSets,
        uniqueSetsCount: uniqueSetsGraded.length,
        gradedSets: uniqueSetsGraded,
        totalQuizzesCompleted: userProfileStats.totalQuizzes,
        overallQuizAccuracy: `${userProfileStats.overallAccuracy}%`,
        userLevel: userProfileStats.level,
        xp: userProfileStats.xp,
      },
      evaluations: allUserEvaluations,
      stats: userProfileStats,
    };
  }, [activeUserId, totalGradedAllSets, uniqueSetsGraded, userProfileStats, allUserEvaluations]);

  const backupJsonString = useMemo(() => {
    return JSON.stringify(backupJsonObject, null, 2);
  }, [backupJsonObject]);

  // Load saved 17Lands Tier List URL whenever set changes
  useEffect(() => {
    if (currentSet?.code) {
      const existing = get17LandsTierListUrl(currentSet.code, userId) || '';
      setSavedTierUrl(existing);
      setInputTierUrl(existing);
    }
  }, [currentSet?.code, userId]);

  // Counts
  const gradedCount = useMemo(() => {
    const upperSet = setCode.toLowerCase();
    return cards.filter(
      (c) => Boolean(evaluations[`${(c.set || upperSet).toLowerCase()}_${c.name.toLowerCase()}`]?.userGrade)
    ).length;
  }, [cards, evaluations, setCode]);

  const [proRatingsLoaded, setProRatingsLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && currentSet?.code) {
      loadProRatingsForSet(currentSet.code).then(() => {
        setProRatingsLoaded(true);
      });
    }
  }, [isOpen, currentSet?.code]);

  const availableReviewers = useMemo<AvailableReviewer[]>(() => {
    return getAvailableReviewersForSet(setCode, cards);
  }, [setCode, cards, proRatingsLoaded]);

  const spreadsheetHeaders = useMemo(() => {
    return getFullSpreadsheetHeaders(availableReviewers);
  }, [availableReviewers]);

  // Preview data (first 5 rows)
  const previewRows = useMemo(() => {
    return buildFullSpreadsheetData(
      cards.slice(0, 8),
      evaluations,
      seventeenLandsData,
      setCode,
      { gradedOnly: exportScope === 'graded', reviewers: availableReviewers }
    ).slice(0, 5);
  }, [cards, evaluations, seventeenLandsData, setCode, exportScope, availableReviewers]);

  if (!isOpen) return null;

  const handleDownloadFullCsv = async () => {
    await loadProRatingsForSet(setCode);
    const csvContent = generateFullSpreadsheetCsv(
      cards,
      evaluations,
      seventeenLandsData,
      setCode,
      { gradedOnly: exportScope === 'graded', reviewers: availableReviewers }
    );
    const filename = `${setCode.toUpperCase()}_Grades_Comparison_${exportScope === 'graded' ? 'Graded' : 'All'}.csv`;
    downloadFile(csvContent, filename);
  };

  const handleCopyFullTsv = async () => {
    await loadProRatingsForSet(setCode);
    const tsvContent = generateFullSpreadsheetTsv(
      cards,
      evaluations,
      seventeenLandsData,
      setCode,
      { gradedOnly: exportScope === 'graded', reviewers: availableReviewers }
    );
    const ok = await copyTextToClipboard(tsvContent);
    if (ok) {
      setCopiedType('tsv');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const [syncTriggered, setSyncTriggered] = useState<boolean>(false);
  const [showConsoleScript, setShowConsoleScript] = useState<boolean>(false);

  const parsedReviewId = useMemo(() => {
    const target = inputTierUrl || savedTierUrl;
    if (!target) return null;
    const match = target.match(/\/(?:tier_list|card_tiers)\/([^/?#]+)/);
    return match ? match[1] : null;
  }, [inputTierUrl, savedTierUrl]);

  const directImportUrl = useMemo(() => {
    if (parsedReviewId) {
      return `https://www.17lands.com/tier_list/${encodeURIComponent(parsedReviewId)}/import`;
    }
    return null;
  }, [parsedReviewId]);

  const seventeenLandsCsvContent = useMemo(() => {
    return generate17LandsTiersCsv(cards, evaluations, {
      gradedOnly: exportScope === 'graded',
    });
  }, [cards, evaluations, exportScope]);

  const bookmarkletHref = useMemo(() => {
    return generate17LandsAutoImportBookmarklet(seventeenLandsCsvContent);
  }, [seventeenLandsCsvContent]);

  const consoleScriptCode = useMemo(() => {
    return generate17LandsConsoleScript(seventeenLandsCsvContent);
  }, [seventeenLandsCsvContent]);

  const handleDownload17LandsCsv = () => {
    const filename = `17lands_tiers_${setCode.toUpperCase()}.csv`;
    downloadFile(seventeenLandsCsvContent, filename);
  };

  const handleCopy17LandsCsv = async () => {
    const ok = await copyTextToClipboard(seventeenLandsCsvContent);
    if (ok) {
      setCopiedType('17lands_csv');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const handleExportAndOpen17Lands = async () => {
    const filename = `17lands_tiers_${setCode.toUpperCase()}.csv`;
    downloadFile(seventeenLandsCsvContent, filename);
    await copyTextToClipboard(seventeenLandsCsvContent);
    setCopiedType('17lands_auto');
    setSyncTriggered(true);

    const targetUrl = directImportUrl || seventeenLandsMakerUrl;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyConsoleScript = async () => {
    const ok = await copyTextToClipboard(consoleScriptCode);
    if (ok) {
      setCopiedType('console_script');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const handleDownloadProfileJson = () => {
    const cleanDate = new Date().toISOString().slice(0, 10);
    const filename = `mtg_limited_iq_backup_${activeUserId}_${cleanDate}.json`;
    downloadFile(backupJsonString, filename, 'application/json;charset=utf-8;');
  };

  const handleCopyProfileJson = async () => {
    const ok = await copyTextToClipboard(backupJsonString);
    if (ok) {
      setCopiedType('backup_json');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const handleSaveTierUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSet?.code) return;
    save17LandsTierListUrl(currentSet.code, inputTierUrl, userId);
    setSavedTierUrl(inputTierUrl.trim());
    setIsUrlSavedNotification(true);
    setTimeout(() => setIsUrlSavedNotification(false), 3000);
  };

  const handleCopySavedTierUrl = async () => {
    if (!savedTierUrl) return;
    const ok = await copyTextToClipboard(savedTierUrl);
    if (ok) {
      setCopiedType('share_url');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const seventeenLandsMakerUrl = `https://www.17lands.com/card_tiers/${encodeURIComponent(setCode.toUpperCase())}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#080d26] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#050818]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-heading">
                  Export & Share Grades
                </h2>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 text-violet-800 dark:text-cyan-300 font-mono text-[11px] font-bold">
                  {currentSet ? (
                    <>
                      <SetSymbol setCode={setCode} size="xs" />
                      <span>{setCode.toUpperCase()}</span>
                    </>
                  ) : (
                    <span>ALL DATA</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                {currentSet
                  ? `${setName} • ${gradedCount} of ${cards.length} cards rated`
                  : `${totalGradedAllSets} total cards rated across ${uniqueSetsGraded.length} sets`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 sm:px-6 py-3 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-[#050818]/40">
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-900/90 rounded-xl border border-slate-300/50 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('spreadsheet')}
              className={`py-2 px-1 text-center font-bold text-xs rounded-lg transition-all cursor-pointer truncate ${
                activeTab === 'spreadsheet'
                  ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-xs border border-slate-200/80 dark:border-transparent'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Spreadsheet
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('seventeenlands')}
              className={`py-2 px-1 text-center font-bold text-xs rounded-lg transition-all cursor-pointer truncate ${
                activeTab === 'seventeenlands'
                  ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-xs border border-slate-200/80 dark:border-transparent'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              17Lands Sync
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('share')}
              className={`py-2 px-1 text-center font-bold text-xs rounded-lg transition-all cursor-pointer truncate ${
                activeTab === 'share'
                  ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-xs border border-slate-200/80 dark:border-transparent'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Public Link
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className={`py-2 px-1 text-center font-bold text-xs rounded-lg transition-all cursor-pointer truncate ${
                activeTab === 'backup'
                  ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-xs border border-slate-200/80 dark:border-transparent'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              JSON Backup
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* ==================== TAB 1: FULL SPREADSHEET ==================== */}
          {activeTab === 'spreadsheet' && (
            cards.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-center space-y-3 my-4">
                <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  No Active Set Selected
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  To export a set-specific spreadsheet or 17Lands comparison, select a set from the top navigation. You can also switch to the <strong className="text-violet-600 dark:text-cyan-300">Personal Backup (JSON)</strong> tab to export your complete grades and history across all sets.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('backup')}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs cursor-pointer transition-all shadow-xs"
                >
                  Go to Personal Backup (JSON)
                </button>
              </div>
            ) : (
            <div className="space-y-6">
              {/* Summary Metrics & Scope Filter */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono mb-1">
                    Export Scope
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose whether to include all set cards or only cards you've rated.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setExportScope('graded')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                      exportScope === 'graded'
                        ? 'bg-white dark:bg-violet-950/70 text-violet-900 dark:text-cyan-300 shadow-xs border border-slate-200 dark:border-violet-700/50'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Graded Only ({gradedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportScope('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                      exportScope === 'all'
                        ? 'bg-white dark:bg-violet-950/70 text-violet-900 dark:text-cyan-300 shadow-xs border border-slate-200 dark:border-violet-700/50'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All Cards ({cards.length})
                  </button>
                </div>
              </div>

              {/* Main Download / Copy Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleDownloadFullCsv}
                  className="p-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 transition-all flex items-center justify-between cursor-pointer border border-white/10 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                    <div className="text-left">
                      <div className="font-heading">Download Full CSV</div>
                      <div className="text-[11px] font-normal text-violet-100">
                        Excel & Numbers ready (UTF-8 BOM)
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-black/20 px-2 py-1 rounded-lg">.csv</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyFullTsv}
                  className="p-4 rounded-2xl bg-white dark:bg-[#050818] hover:bg-slate-50 dark:hover:bg-violet-950/30 border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-600 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                      {copiedType === 'tsv' ? (
                        <Check className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Copy className="w-5 h-5 group-hover:scale-105 transition-transform" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-900 dark:text-white font-heading text-sm">
                        {copiedType === 'tsv' ? 'Copied to Clipboard!' : 'Copy for Google Sheets'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Paste directly into Google Sheets (TSV)
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg">
                    {copiedType === 'tsv' ? '✓ Copied' : 'Cmd+V'}
                  </span>
                </button>
              </div>

              {/* Comprehensive Column Specs Info Pill */}
              <div className="p-3.5 rounded-2xl bg-violet-50/70 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/40 flex items-start gap-3">
                <Info className="w-4 h-4 text-violet-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-violet-900 dark:text-slate-300 space-y-1">
                  <div className="font-bold">What is included in this spreadsheet?</div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    All <strong>{spreadsheetHeaders.length} columns</strong>: Card Name, Mana Cost, CMC, Rarity, Type Line, P/T, Keywords, Role Tags, Oracle Text, <strong>User Grade</strong>, Score, Priority, Notes, <strong>17Lands Empirical Metrics</strong> (GIH WR %, ALSA, IWD %, Games Played, Seen Count, Pick Rate %), <strong>Pro Creator Reviews</strong> ({availableReviewers.map((r) => r.shortName).join(', ')}: Grade, Score, Verdict, and Step Deltas), and <strong>Calibration Status & Accuracy</strong>.
                  </p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span className="font-bold uppercase tracking-wider">Data Preview (Sample Rows)</span>
                  <span>{previewRows.length} sample cards</span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto bg-white dark:bg-[#050818]">
                  <table className="w-full text-left text-xs font-mono divide-y divide-slate-200 dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-bold">
                      <tr>
                        <th className="px-3 py-2.5 whitespace-nowrap">Card Name</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">User Grade</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">17Lands Tier</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">17L GIH WR</th>
                        {availableReviewers.map((rev) => (
                          <th key={rev.id} className="px-3 py-2.5 whitespace-nowrap">{rev.shortName} Grade</th>
                        ))}
                        <th className="px-3 py-2.5 whitespace-nowrap">17L Delta</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                      {previewRows.length === 0 ? (
                        <tr>
                          <td colSpan={6 + availableReviewers.length} className="px-3 py-6 text-center text-slate-400 italic">
                            No cards match the selected scope. Rate some cards to preview data.
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="px-3 py-2 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {row.name}
                            </td>
                            <td className="px-3 py-2 font-bold text-violet-700 dark:text-cyan-300">
                              {row.userGrade}
                            </td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                              {row.seventeenLandsGrade}
                            </td>
                            <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400">
                              {row.seventeenLandsGihWrPct || '—'}
                            </td>
                            {availableReviewers.map((rev) => {
                              const val = (row as any)[`${rev.id.toLowerCase()}Grade`] || '—';
                              return (
                                <td key={rev.id} className="px-3 py-2 font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                  {val}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                              {row.deltaVs17LandsSteps || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                              {row.comparisonStatusVs17Lands}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )
          )}

          {/* ==================== TAB 2: SEND TO 17LANDS ==================== */}
          {activeTab === 'seventeenlands' && (
            cards.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-center space-y-3 my-4">
                <Share2 className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  No Active Set Selected
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  To export your grades into 17Lands Tier List CSV format, please select an active set from the top navigation bar.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('backup')}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs cursor-pointer transition-all shadow-xs"
                >
                  Go to Personal Backup (JSON)
                </button>
              </div>
            ) : (
            <div className="space-y-6">
              {/* Introduction & Technical Clarification Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 border border-indigo-200 dark:border-indigo-800/50 space-y-2">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 font-bold font-heading text-sm">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>17Lands Public Tier List Sync</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  17Lands is protected by secure user session authentication on <code>17lands.com</code>; external websites cannot remotely write card grades to your account via standard URLs. To place all graded cards into their exact spots, use the <strong>Automated CSV Export</strong> below or the <strong>⚡ 1-Click Instant Auto-Apply</strong>.
                </p>
              </div>

              {/* Method 1: Automated CSV Download & Open 17Lands */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center font-mono shrink-0">
                      1
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                      Auto-Export CSV & Open 17Lands Tier Maker
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {exportScope === 'graded' ? `${gradedCount} cards` : `${cards.length} cards`}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Clicking below automatically downloads your <code>17lands_tiers_{setCode.toUpperCase()}.csv</code>, copies the formatted tiers to your clipboard, and launches 17Lands.
                </p>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportAndOpen17Lands}
                    className="px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs font-heading transition-all shadow-md shadow-violet-500/20 flex items-center gap-2 cursor-pointer border border-violet-400/30"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV & Open 17Lands ({setCode.toUpperCase()})</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload17LandsCsv}
                    className="px-3.5 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Download CSV file only"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy17LandsCsv}
                    className="px-3.5 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedType === '17lands_csv' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{copiedType === '17lands_csv' ? 'Copied CSV!' : 'Copy CSV'}</span>
                  </button>
                </div>

                {/* Visual Guide for 17Lands Import CSV button */}
                <div className={`p-4 rounded-xl border transition-all ${
                  syncTriggered
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/60 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                } space-y-2.5`}>
                  <div className="flex items-center gap-2">
                    {syncTriggered ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <MousePointer className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {syncTriggered
                        ? `✅ File downloaded! Final Step on 17Lands:`
                        : `Next Step on 17Lands:`}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    On your 17Lands tab, click the <strong className="text-violet-600 dark:text-violet-300">[Import CSV]</strong> button in the top toolbar and select <code>17lands_tiers_{setCode.toUpperCase()}.csv</code>:
                  </p>

                  {/* Mock toolbar illustration */}
                  <div className="p-2.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 flex items-center gap-2 flex-wrap text-xs select-none">
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px]">+ New copy</span>
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px]">Download CSV</span>
                    <span className="px-2.5 py-1 rounded bg-violet-600 text-white font-bold border border-violet-400 text-[11px] ring-2 ring-amber-400 shadow-sm flex items-center gap-1 animate-pulse">
                      <span>👉 Import CSV 👈</span>
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[11px]">SealedDeck</span>
                  </div>
                </div>
              </div>

              {/* Method 2: ⚡ 1-Click Instant Auto-Apply (Zero File Picking) */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/5 via-violet-500/5 to-cyan-500/5 border border-amber-200 dark:border-amber-900/40 space-y-4">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold font-heading text-sm">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>⚡ 1-Click Instant Auto-Apply (No File Dialog Required)</span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Already have your 17Lands Tier List page open in another tab? You can inject your grades directly without picking files:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Tool A: Draggable Bookmarklet */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#050818] border border-amber-200 dark:border-amber-800/40 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Option A: Bookmarklet
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Drag this button to your browser bookmarks bar. When viewing 17Lands, click the bookmark:
                    </p>
                    <a
                      href={bookmarkletHref}
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`⭐ Drag this button to your browser's Bookmarks bar (Cmd+Shift+B on Mac, Ctrl+Shift+B on Windows).\n\nThen switch to your 17Lands tab and click it!`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-xs cursor-grab active:cursor-grabbing border border-amber-600/30"
                      title="Drag to bookmarks bar, then click while viewing 17Lands tier list"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>⭐ Apply {setCode.toUpperCase()} Grades</span>
                    </a>
                  </div>

                  {/* Tool B: Console 1-Liner Script */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#050818] border border-amber-200 dark:border-amber-800/40 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Option B: Browser Console
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Copy the script, open DevTools Console (<code>F12</code> or <code>Cmd+Opt+J</code>) on your 17Lands tab, paste, and press Enter:
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyConsoleScript}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 font-bold text-xs font-mono transition-all border border-slate-700 cursor-pointer shadow-xs"
                    >
                      {copiedType === 'console_script' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Terminal className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedType === 'console_script' ? 'Copied Script!' : 'Copy 1-Click Script'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Save & Track Your Public 17Lands Tier List URL */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-600 text-white font-bold text-xs flex items-center justify-center font-mono shrink-0">
                    3
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                    Save Your Shareable 17Lands Tier List URL
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Once your tiers are placed on 17Lands, paste your tier list URL here. We'll store it with your profile so you can quickly access or share your public 17Lands view anytime.
                </p>

                <form onSubmit={handleSaveTierUrl} className="flex items-center gap-2 flex-wrap">
                  <input
                    type="url"
                    value={inputTierUrl}
                    onChange={(e) => setInputTierUrl(e.target.value)}
                    placeholder="https://www.17lands.com/tier_list/..."
                    className="flex-1 min-w-[240px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs font-heading transition-all shadow-xs cursor-pointer border border-violet-400/30 shrink-0"
                  >
                    Save Link
                  </button>
                </form>

                {directImportUrl && (
                  <div className="pt-2 flex items-center gap-2">
                    <a
                      href={directImportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-violet-800 text-xs font-semibold cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Open Direct 17Lands File Upload Page</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  </div>
                )}

                {isUrlSavedNotification && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Your 17Lands Tier List URL was saved successfully!</span>
                  </div>
                )}

                {/* If saved, provide quick share buttons */}
                {savedTierUrl && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleCopySavedTierUrl}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedType === 'share_url' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>{copiedType === 'share_url' ? 'Copied Share Link!' : 'Copy Share Link'}</span>
                    </button>

                    <a
                      href={savedTierUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-800 dark:text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-violet-200 dark:border-violet-800/50"
                    >
                      <span>Open Public 17Lands View</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href="https://www.17lands.com/tier_comparison"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>17Lands Tier Comparison</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
            )
          )}

          {/* ==================== TAB 3: PUBLIC SHARE LINK ==================== */}
          {activeTab === 'share' && (
            cards.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 text-center space-y-3 my-4">
                <Link2 className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                  No Active Set Selected
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  To generate a public share link, please select an active set from the top navigation bar.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Introduction & Security Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800/50 space-y-2">
                  <div className="flex items-center gap-2 text-violet-900 dark:text-cyan-300 font-bold font-heading text-sm">
                    <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-cyan-400 shrink-0" />
                    <span>Secure Public Link</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Generate an unguessable direct link to share your card evaluations for <strong>{setName}</strong>.
                    Recipients see a lightweight, fast, distraction-free view with zero login required. Your email, account ID, and other sets remain strictly private.
                  </p>
                </div>

                {/* Configuration Options */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Sharing Preferences
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Display Name Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        <span>Author Moniker</span>
                      </label>
                      <input
                        type="text"
                        value={authorDisplayName}
                        onChange={(e) => setAuthorDisplayName(e.target.value)}
                        placeholder="e.g. LSV, TheDraftChamp, or Anonymous"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                        maxLength={50}
                      />
                      <span className="text-[11px] text-slate-400">
                        The public name displayed at the top of the shared page.
                      </span>
                    </div>

                    {/* Include Notes Checkbox */}
                    <div className="space-y-1.5 flex flex-col justify-center">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={includeNotesInShare}
                          onChange={(e) => setIncludeNotesInShare(e.target.checked)}
                          className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Include Card Strategy Notes
                        </span>
                      </label>
                      <span className="text-[11px] text-slate-400 pl-6">
                        When enabled, custom card notes you entered will be visible to viewers.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Share Link Generation / Active Status */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
                      <span className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                        {activeShare ? 'Active Share Link' : 'Generate Public Link'}
                      </span>
                    </div>
                    {activeShare && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>LIVE SNAPSHOT</span>
                      </span>
                    )}
                  </div>

                  {activeShare ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={getShareUrl(activeShare.id)}
                          className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-200 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            copyTextToClipboard(getShareUrl(activeShare.id));
                            setCopiedType('active_share_url');
                            setTimeout(() => setCopiedType(null), 2500);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        >
                          {copiedType === 'active_share_url' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedType === 'active_share_url' ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <a
                          href={getShareUrl(activeShare.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
                        >
                          <span>Preview Public View</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>

                        <button
                          type="button"
                          onClick={handleGenerateShare}
                          disabled={isGeneratingShare}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
                        >
                          <span>Update / Re-sync Snapshot</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRevokeShare}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800/40 ml-auto"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Revoke Link</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        You have graded <strong>{gradedCount}</strong> of {cards.length} cards in {setName}. Generating a share link creates a frozen snapshot accessible to anyone with the link.
                      </p>

                      {shareError && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                          {shareError}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleGenerateShare}
                        disabled={isGeneratingShare || gradedCount === 0}
                        className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs font-heading transition-all shadow-md shadow-violet-500/20 flex items-center gap-2 cursor-pointer border border-violet-400/30"
                      >
                        <Link2 className="w-4 h-4" />
                        <span>{isGeneratingShare ? 'Generating...' : 'Create & Copy Share Link'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Security Guarantee Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818]/60 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Lock className="w-3.5 h-3.5 text-violet-500" />
                    <span>Security & Anti-Scraping Guarantees</span>
                  </div>
                  <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-4">
                    <li>Share IDs use 128-bit unguessable UUIDv4 tokens (zero sequential ID enumeration).</li>
                    <li>Row-Level Security (RLS) restricts database queries strictly to the shared row.</li>
                    <li>No personal credentials, email addresses, or billing data are ever exposed.</li>
                    <li>Notes are strictly sanitized against HTML and cross-site scripting (XSS).</li>
                  </ul>
                </div>
              </div>
            )
          )}

          {/* ==================== TAB 4: PERSONAL BACKUP (JSON) ==================== */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Graded</div>
                  <div className="text-2xl font-black text-violet-600 dark:text-cyan-300 font-heading mt-0.5">
                    {totalGradedAllSets}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Cards with grades</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Sets Graded</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white font-heading mt-0.5">
                    {uniqueSetsGraded.length}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={uniqueSetsGraded.join(', ')}>
                    {uniqueSetsGraded.length > 0 ? uniqueSetsGraded.join(', ') : 'None yet'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Quizzes Taken</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white font-heading mt-0.5">
                    {userProfileStats.totalQuizzes}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {userProfileStats.overallAccuracy}% accuracy
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Profile Level</div>
                  <div className="text-2xl font-black text-amber-500 dark:text-amber-400 font-heading mt-0.5">
                    Lv {userProfileStats.level}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {userProfileStats.xp} Total XP
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleDownloadProfileJson}
                  className="p-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 transition-all flex items-center justify-between cursor-pointer border border-white/10 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                    <div className="text-left">
                      <div className="font-heading">Download Backup JSON</div>
                      <div className="text-[11px] font-normal text-violet-100">
                        Complete profile, grades & quiz history
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-black/20 px-2 py-1 rounded-lg">.json</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyProfileJson}
                  className="p-4 rounded-2xl bg-white dark:bg-[#050818] hover:bg-slate-50 dark:hover:bg-violet-950/30 border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-600 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                      {copiedType === 'backup_json' ? (
                        <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-900 dark:text-white font-heading">
                        {copiedType === 'backup_json' ? 'Copied JSON to Clipboard!' : 'Copy Backup JSON'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Paste into notes or another backup
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400">JSON</span>
                </button>
              </div>

              {/* JSON Structure Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-violet-500" />
                    <span>Backup Payload Preview</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {Object.keys(allUserEvaluations).length} evaluation records
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900 dark:bg-[#030614] border border-slate-800 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
                  <pre className="text-[11px]">
                    {backupJsonString.split('\n').slice(0, 30).join('\n')}
                    {backupJsonString.split('\n').length > 30 && '\n  ... [truncated for preview, full payload will be downloaded]'}
                  </pre>
                </div>
              </div>

              {/* Security & Data Portability Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300">
                    Your Data Stays With You
                  </div>
                  <p>
                    MTG Limited IQ is built offline-first. Your ratings, notes, quiz streaks, and tier rankings are stored locally in your browser and synced securely to your cloud account when logged in. You can download and keep this complete JSON archive at any time.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#050818]/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-slate-400">
            {activeTab === 'backup'
              ? `${totalGradedAllSets} cards evaluated • ${uniqueSetsGraded.length} sets in database`
              : exportScope === 'graded'
              ? `${gradedCount} cards selected`
              : `${cards.length} cards selected`}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportGradesModal;
