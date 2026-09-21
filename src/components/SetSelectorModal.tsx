import React, { useState, useMemo } from 'react';
import { SetInfo } from '../types/mtg';
import { POPULAR_LIMITED_SETS, KNOWN_17LANDS_EXPANSIONS } from '../services/scryfall';
import { Search, X, Calendar, Check, Wand2, ShieldCheck, BarChart2 } from 'lucide-react';
import { get17LandsSetUrl, getSetDraftStatus } from '../services/seventeenLands';
import { SetSymbol, SetBadge } from './UI/SetSymbol';

interface SetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  allSets: SetInfo[];
  currentSetCode?: string;
  onSelectSet: (set: SetInfo) => void;
  isLoadingCards?: boolean;
  downloadProgress?: { loaded: number; total: number } | null;
}

export const SetSelectorModal: React.FC<SetSelectorModalProps> = ({
  isOpen,
  onClose,
  allSets,
  currentSetCode = '',
  onSelectSet,
  isLoadingCards = false,
  downloadProgress = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customCodeInput, setCustomCodeInput] = useState('');

  const setsList = allSets.length > 0 ? allSets : POPULAR_LIMITED_SETS;

  const filteredSets = useMemo(() => {
    return setsList.filter((s) => {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    });
  }, [setsList, searchQuery]);

  if (!isOpen) return null;

  const handleCustomSetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = customCodeInput.trim().toUpperCase();
    if (!code) return;

    const existing = setsList.find((s) => s.code.toUpperCase() === code);
    if (existing) {
      onSelectSet({
        ...existing,
        has_17lands_data: Boolean(existing.has_17lands_data) || KNOWN_17LANDS_EXPANSIONS.has(code),
      });
    } else {
      onSelectSet({
        code,
        name: `Set (${code})`,
        card_count: 270,
        set_type: 'expansion',
        has_17lands_data: KNOWN_17LANDS_EXPANSIONS.has(code),
      });
    }
  };

  const getSetTypeBadge = (_set: SetInfo) => {
    return (
      <span className="text-[10px] uppercase font-bold text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1">
        <ShieldCheck className="w-2.5 h-2.5" />
        Limited Set
      </span>
    );
  };

  const formatSetReleaseDate = (releasedAt?: string): string => {
    if (!releasedAt) return 'Limited';
    const parts = releasedAt.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      return `${month}/${year}`;
    }
    return releasedAt;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-slate-950/70 dark:bg-[#040711]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:w-[96vw] sm:max-w-5xl bg-white dark:bg-[#090e28] border-0 sm:border border-slate-200 dark:border-slate-800/80 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060a1d]">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-violet-100 dark:bg-violet-600/30 border border-violet-300 dark:border-violet-400/40 text-violet-700 dark:text-cyan-300 shadow-xs shrink-0">
              <Wand2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white font-heading tracking-wide truncate">
                Select MTG Limited Set
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300 truncate">
                Choose a booster set to drill combat cards & test 17Lands evaluations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls, Filters & Search */}
        <div className="p-3 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#070b22] space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-8">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search set name or code (e.g. Secrets of Strixhaven, SOS, Bloomburrow, OTJ)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#050818] border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 transition-all font-medium"
                autoFocus
              />
            </div>

            {/* Direct Set Code Form */}
            <form onSubmit={handleCustomSetSubmit} className="md:col-span-4 flex items-center gap-2">
              <input
                type="text"
                placeholder="Code e.g. SOS"
                value={customCodeInput}
                onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                maxLength={8}
                className="w-full uppercase font-mono text-xs px-3 py-2.5 bg-white dark:bg-[#050818] border border-slate-300 dark:border-slate-800 rounded-xl text-violet-700 dark:text-cyan-300 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                Load Code
              </button>
            </form>
          </div>
        </div>

        {/* Subtle Non-shifting Loading Progress Bar */}
        <div className="h-0.5 w-full bg-transparent overflow-hidden">
          {isLoadingCards && (
            <div className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-violet-500 animate-pulse w-full" />
          )}
        </div>

        {/* Set List Grid (Expansive 2-Column Full Width) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 pb-safe">
          {filteredSets.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <p className="text-sm font-semibold">No sets found matching "{searchQuery}"</p>
              <p className="text-xs text-slate-400">Try switching your filter to "All Sets" or enter the 3-letter code above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSets.map((set) => {
                const isSelected = set.code.toUpperCase() === currentSetCode.toUpperCase();
                return (
                  <button
                    key={set.code}
                    onClick={() => onSelectSet(set)}
                    className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500 shadow-sm ring-1 ring-violet-400'
                        : 'bg-white dark:bg-[#070b22]/80 hover:bg-slate-50 dark:hover:bg-[#0f163f] border-slate-200 dark:border-slate-800 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                      {/* Set Symbol / Icon */}
                      <div className="shrink-0 w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 flex items-center justify-center p-1.5 shadow-xs">
                        <SetSymbol setCode={set.code} iconSvgUri={set.icon_svg_uri} size="md" />
                      </div>

                      {/* Set Details (Full Un-truncated Name) */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-1">
                            <SetSymbol setCode={set.code} iconSvgUri={set.icon_svg_uri} size="xs" />
                            <span>{set.code}</span>
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-violet-600 dark:group-hover:text-cyan-200 transition-colors">
                            {set.name}
                          </h3>
                          {getSetDraftStatus(set.code) === 'active' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/50 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Active Draft
                            </span>
                          )}
                          {getSetDraftStatus(set.code) === 'flashback' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600/50 shadow-xs">
                              ⚡ Flashback Draft
                            </span>
                          )}
                          {getSetDraftStatus(set.code) === 'upcoming' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-600/50 shadow-xs">
                              Upcoming
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          {getSetTypeBadge(set)}
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300">
                            <Calendar className="w-3.5 h-3.5 text-violet-500" />
                            {formatSetReleaseDate(set.released_at)}
                          </span>
                          <span>•</span>
                          <span className="font-mono">{set.card_count} cards</span>
                          {set.has_17lands_data && (
                            <>
                              <span>•</span>
                              <a
                                href={get17LandsSetUrl(set.code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold flex items-center gap-1 hover:underline cursor-pointer bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-500/40 text-[11px] transition-all"
                                title={`Open ${set.code} 17Lands Premier Draft Analytics in a new tab`}
                              >
                                <BarChart2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>17Lands Analytics ↗</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Selected Checkmark & Loading Spinner */}
                    {isSelected && (
                      <div className="flex items-center gap-2 shrink-0">
                        {isLoadingCards && (
                          <div
                            className="w-4 h-4 border-2 border-violet-600 dark:border-cyan-400 border-t-transparent rounded-full animate-spin"
                            title="Loading set cards..."
                          />
                        )}
                        <div className="p-1.5 rounded-full bg-violet-600 text-white shadow-xs">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer (Fixed height status bar, prevents content jump) */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060a1d] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div>
            {isLoadingCards ? (
              <span className="flex items-center gap-2 text-violet-600 dark:text-cyan-400 font-medium">
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                {downloadProgress && downloadProgress.total > 0
                  ? `Syncing cards (${downloadProgress.loaded} / ${downloadProgress.total})...`
                  : 'Syncing Scryfall card visuals & rules...'}
              </span>
            ) : (
              <span>{filteredSets.length} sets available</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
