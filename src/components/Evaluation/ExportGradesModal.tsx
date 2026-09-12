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
  Table,
  Layers,
  ArrowRight,
  Bookmark,
} from 'lucide-react';
import { Card, UserCardEvaluation, SeventeenLandsSetData, SetInfo } from '../../types/mtg';
import {
  generate17LandsTiersCsv,
  generateFullSpreadsheetCsv,
  generateFullSpreadsheetTsv,
  buildFullSpreadsheetData,
  downloadFile,
  copyTextToClipboard,
} from '../../services/gradeExport';
import {
  get17LandsTierListUrl,
  save17LandsTierListUrl,
} from '../../services/storage';
import { SetSymbol } from '../UI/SetSymbol';

interface ExportGradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  evaluations: Record<string, UserCardEvaluation>;
  seventeenLandsData: SeventeenLandsSetData | null;
  currentSet: SetInfo | null;
  userId?: string;
}

export const ExportGradesModal: React.FC<ExportGradesModalProps> = ({
  isOpen,
  onClose,
  cards,
  evaluations,
  seventeenLandsData,
  currentSet,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'seventeenlands'>('spreadsheet');
  const [exportScope, setExportScope] = useState<'all' | 'graded'>('graded');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const setCode = currentSet?.code || 'SET';
  const setName = currentSet?.name || 'Current Set';

  // 17Lands Public URL state
  const [savedTierUrl, setSavedTierUrl] = useState<string>('');
  const [inputTierUrl, setInputTierUrl] = useState<string>('');
  const [isUrlSavedNotification, setIsUrlSavedNotification] = useState<boolean>(false);

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

  // Preview data (first 5 rows)
  const previewRows = useMemo(() => {
    return buildFullSpreadsheetData(
      cards.slice(0, 8),
      evaluations,
      seventeenLandsData,
      setCode,
      { gradedOnly: exportScope === 'graded' }
    ).slice(0, 5);
  }, [cards, evaluations, seventeenLandsData, setCode, exportScope]);

  if (!isOpen) return null;

  const handleDownloadFullCsv = () => {
    const csvContent = generateFullSpreadsheetCsv(
      cards,
      evaluations,
      seventeenLandsData,
      setCode,
      { gradedOnly: exportScope === 'graded' }
    );
    const filename = `${setCode.toUpperCase()}_Grades_Comparison_${exportScope === 'graded' ? 'Graded' : 'All'}.csv`;
    downloadFile(csvContent, filename);
  };

  const handleCopyFullTsv = async () => {
    const tsvContent = generateFullSpreadsheetTsv(
      cards,
      evaluations,
      seventeenLandsData,
      setCode,
      { gradedOnly: exportScope === 'graded' }
    );
    const ok = await copyTextToClipboard(tsvContent);
    if (ok) {
      setCopiedType('tsv');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const handleDownload17LandsCsv = () => {
    const csvContent = generate17LandsTiersCsv(cards, evaluations, {
      gradedOnly: exportScope === 'graded',
    });
    const filename = `17lands_tiers_${setCode.toUpperCase()}.csv`;
    downloadFile(csvContent, filename);
  };

  const handleCopy17LandsCsv = async () => {
    const csvContent = generate17LandsTiersCsv(cards, evaluations, {
      gradedOnly: exportScope === 'graded',
    });
    const ok = await copyTextToClipboard(csvContent);
    if (ok) {
      setCopiedType('17lands_csv');
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
                  <SetSymbol setCode={setCode} size="xs" />
                  <span>{setCode.toUpperCase()}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                {setName} • {gradedCount} of {cards.length} cards rated
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
        <div className="px-5 sm:px-6 pt-3 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-[#050818]/30">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('spreadsheet')}
              className={`pb-2.5 px-3 font-semibold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'spreadsheet'
                  ? 'border-violet-600 text-violet-700 dark:text-cyan-300 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Full Comparison Spreadsheet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('seventeenlands')}
              className={`pb-2.5 px-3 font-semibold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'seventeenlands'
                  ? 'border-violet-600 text-violet-700 dark:text-cyan-300 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Send to 17Lands Tier List</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
                17L Sync
              </span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* ==================== TAB 1: FULL SPREADSHEET ==================== */}
          {activeTab === 'spreadsheet' && (
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
                    All <strong>38 columns</strong>: Card Name, Mana Cost, CMC, Rarity, Type Line, P/T, Keywords, Role Tags, Oracle Text, <strong>User Grade</strong>, Score, Priority, Notes, <strong>17Lands Empirical Metrics</strong> (GIH WR %, ALSA, IWD %, Games Played, Seen Count, Pick Rate %), <strong>LSV Review</strong> (Grade, Score, Verdict), and <strong>Step Deltas / Calibration Traps & Sleepers</strong>.
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
                        <th className="px-3 py-2.5 whitespace-nowrap">LSV Grade</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">17L Delta</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                      {previewRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-slate-400 italic">
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
                            <td className="px-3 py-2 text-amber-600 dark:text-amber-400">
                              {row.lsvGrade}
                            </td>
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
          )}

          {/* ==================== TAB 2: SEND TO 17LANDS ==================== */}
          {activeTab === 'seventeenlands' && (
            <div className="space-y-6">
              {/* Introduction Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-bold font-heading text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>17Lands Public Tier List Sync</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  17Lands has a built-in Tier List Maker where drafters maintain card tiers and share public links with the community. You can export your grades from MTG Limited IQ and import them directly into 17Lands in 3 simple steps:
                </p>
              </div>

              {/* Step 1: Download 17Lands Formatted CSV */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center font-mono shrink-0">
                      1
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                      Download 17Lands Template CSV
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Columns: Name, Tier, Buildaround, Synergy, Comment
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This CSV formats your grades strictly to 17Lands's required tier upload format.
                </p>

                <div className="flex items-center gap-2.5 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={handleDownload17LandsCsv}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs font-heading shadow-md shadow-violet-500/20 transition-all flex items-center gap-2 cursor-pointer border border-violet-400/30"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download 17Lands CSV (.csv)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy17LandsCsv}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700/60"
                  >
                    {copiedType === '17lands_csv' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                    <span>{copiedType === '17lands_csv' ? 'Copied CSV!' : 'Copy to Clipboard'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Open 17Lands Tier Maker & Import */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center font-mono shrink-0">
                    2
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                    Open 17Lands and Click "Import CSV"
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                  <p>
                    On 17Lands, open your tier list for <strong>{setCode.toUpperCase()}</strong>. In the top action bar, click <strong className="text-violet-700 dark:text-cyan-300">Import CSV</strong>, choose the downloaded CSV, and click <strong className="text-emerald-700 dark:text-emerald-400">Upload</strong>.
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    17Lands will populate all your tiers, buildarounds, and comments instantly!
                  </p>
                </div>

                <div className="pt-1">
                  <a
                    href={seventeenLandsMakerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-heading shadow-md shadow-emerald-500/20 transition-all cursor-pointer border border-emerald-400/30"
                  >
                    <span>Open 17Lands Tier Maker for {setCode.toUpperCase()}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Step 3: Save & Share Your Public 17Lands Link */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center font-mono shrink-0">
                    3
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                    Save Your Public 17Lands Share Link
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Once your tiers are saved, 17Lands gives you a public share link (e.g. <code className="text-[11px] bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">https://www.17lands.com/tier_list/abc123...</code>). Paste it here to keep it saved with this set!
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
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#050818]/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-slate-400">
            {exportScope === 'graded' ? `${gradedCount} cards selected` : `${cards.length} cards selected`}
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
