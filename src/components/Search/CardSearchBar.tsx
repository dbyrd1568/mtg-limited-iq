import React, { useState, useRef, useEffect } from 'react';
import { Search, X, SlidersHorizontal, Sparkles } from 'lucide-react';
import { AdvancedSearchModal } from './AdvancedSearchModal';
import { SearchSyntaxCheatSheetModal } from './SearchSyntaxCheatSheetModal';

interface CardSearchBarProps {
  query: string;
  onChangeQuery: (query: string) => void;
  currentSetCode: string;
  currentSetName: string;
  matchCount?: number;
  totalCount?: number;
  placeholder?: string;
  className?: string;
}

export const CardSearchBar: React.FC<CardSearchBarProps> = ({
  query,
  onChangeQuery,
  currentSetCode,
  currentSetName,
  matchCount,
  totalCount,
  placeholder,
  className = '',
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultPlaceholder = `Search cards, rules text (e.g. draw a card), stats 2/3, mana {2}{W}...`;

  // Pressing '/' or 'Ctrl+K' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    onChangeQuery('');
    inputRef.current?.focus();
  };

  const isQueryActive = Boolean(query.trim());

  return (
    <>
      <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${className}`}>
        {/* Main Search Input */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-violet-600 dark:group-focus-within:text-cyan-400 transition-colors" />

          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder || defaultPlaceholder}
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-mono transition-all shadow-xs"
          />

          {/* Right Action: Clear (x) button */}
          {isQueryActive && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Button: Advanced Search */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#050818] hover:bg-violet-50 dark:hover:bg-violet-950/40 border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700/60 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-violet-700 dark:hover:text-cyan-300 transition-all cursor-pointer shadow-xs whitespace-nowrap"
            title="Open Scryfall-style visual advanced search filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
            <span>Advanced</span>
          </button>
        </div>
      </div>

      {/* Quick Search Syntax Tip Bar */}
      {!isQueryActive && (
        <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex-wrap">
          <span className="text-violet-600 dark:text-cyan-400 font-bold">Search tip:</span>
          <span>Try</span>
          <button
            type="button"
            onClick={() => onChangeQuery('draw a card')}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Search for cards that draw a card in rules text"
          >
            draw a card
          </button>
          <span>for rules text,</span>
          <button
            type="button"
            onClick={() => onChangeQuery('2/3')}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Search for creatures with 2/3 power and toughness"
          >
            2/3
          </button>
          <span>for stats,</span>
          <button
            type="button"
            onClick={() => onChangeQuery('{2}{W}')}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Search for cards with mana cost {2}{W}"
          >
            {'{2}{W}'}
          </button>
          <span>for mana,</span>
          <button
            type="button"
            onClick={() => onChangeQuery('flying 2/3 {2}{W}')}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Search for flying creatures with 2/3 stats costing {2}{W}"
          >
            flying 2/3 {'{2}{W}'}
          </button>
          <span>or</span>
          <button
            type="button"
            onClick={() => setIsCheatSheetOpen(true)}
            className="text-violet-600 dark:text-cyan-400 hover:underline font-bold cursor-pointer"
          >
            syntax guide →
          </button>
        </div>
      )}

      {/* Active Filter Summary Pill (when query is non-empty) */}
      {isQueryActive && matchCount !== undefined && totalCount !== undefined && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-violet-50/80 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 text-xs text-violet-900 dark:text-cyan-200">
          <div className="flex items-center gap-1.5 font-mono truncate">
            <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
            <span className="font-bold">
              Showing {matchCount} of {totalCount} cards
            </span>
            <span className="text-slate-400 truncate hidden md:inline">
              matching query <code className="text-violet-700 dark:text-cyan-300 font-bold">"{query}"</code>
            </span>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-bold font-mono text-violet-700 dark:text-cyan-400 hover:underline cursor-pointer shrink-0 ml-2"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
        currentSetCode={currentSetCode}
        currentSetName={currentSetName}
        initialQuery={query}
        onApplyQuery={(newQuery) => onChangeQuery(newQuery)}
        onOpenCheatSheet={() => {
          setIsAdvancedOpen(false);
          setIsCheatSheetOpen(true);
        }}
      />

      {/* Syntax Cheat Sheet Modal */}
      <SearchSyntaxCheatSheetModal
        isOpen={isCheatSheetOpen}
        onClose={() => setIsCheatSheetOpen(false)}
        onSelectQuery={(exampleQuery) => onChangeQuery(exampleQuery)}
      />
    </>
  );
};
