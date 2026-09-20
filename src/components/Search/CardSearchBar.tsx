import React, { useState, useRef, useEffect } from 'react';
import { Search, X, SlidersHorizontal, Sparkles, BookOpen } from 'lucide-react';
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
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        {/* Main Search Input */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-violet-600 dark:group-focus-within:text-cyan-400 transition-colors" />

          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder || defaultPlaceholder}
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-8 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-mono transition-all shadow-xs"
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
            className="h-9 flex items-center justify-center gap-1.5 px-3 rounded-xl bg-slate-100 dark:bg-[#050818] hover:bg-violet-50 dark:hover:bg-violet-950/40 border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700/60 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-violet-700 dark:hover:text-cyan-300 transition-all cursor-pointer shadow-xs whitespace-nowrap"
            title="Open Scryfall-style visual advanced search filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
            <span>Advanced</span>
          </button>
        </div>
      </div>

      {/* Subtext under Search Bar: Search Guide Link */}
      {!isQueryActive && (
        <div className="flex items-center px-1">
          <button
            type="button"
            onClick={() => setIsCheatSheetOpen(true)}
            className="text-[11px] font-mono text-violet-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
          >
            <BookOpen className="w-3 h-3" />
            <span>Search guide →</span>
          </button>
        </div>
      )}

      {/* Active Filter Summary Pill (when query is non-empty) */}
      {isQueryActive && matchCount !== undefined && totalCount !== undefined && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-violet-50/80 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 text-[11px] text-violet-900 dark:text-cyan-200">
          <div className="flex items-center gap-1.5 font-mono truncate">
            <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 shrink-0" />
            <span className="font-bold">
              Showing {matchCount} of {totalCount} cards
            </span>
            <span className="text-slate-400 truncate hidden md:inline">
              for <code className="text-violet-700 dark:text-cyan-300 font-bold">"{query}"</code>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCheatSheetOpen(true)}
              className="text-[10px] font-mono text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-cyan-300 hover:underline cursor-pointer"
            >
              guide →
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-bold font-mono text-violet-700 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>
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
    </div>
  );
};
