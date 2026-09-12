import React from 'react';
import { Layers, ArrowUpRight, Sparkles, Wand2, Compass, CheckCircle2 } from 'lucide-react';
import { POPULAR_LIMITED_SETS } from '../../services/scryfall';
import { SetInfo } from '../../types/mtg';
import { SetSymbol } from './SetSymbol';
import { PlaneswalkerSymbol } from './PlaneswalkerSymbol';

interface EmptySetPlaceholderProps {
  onOpenSetSelector: () => void;
  onSelectSet: (set: SetInfo) => void;
  popularSets?: SetInfo[];
}

export const EmptySetPlaceholder: React.FC<EmptySetPlaceholderProps> = ({
  onOpenSetSelector,
  onSelectSet,
  popularSets = POPULAR_LIMITED_SETS.slice(0, 6),
}) => {
  return (
    <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-14 text-center animate-in fade-in zoom-in-95 duration-200">
      {/* Directional Callout pointing to the Top Navbar Set Selector */}
      <div className="flex justify-end mb-4 sm:mb-6 pr-2 sm:pr-8">
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-700/50 text-violet-900 dark:text-cyan-300 shadow-sm animate-pulse">
          <span className="text-xs font-bold font-mono">
            Click "Choose Set" in top bar
          </span>
          <span className="text-sm font-black text-amber-500 dark:text-amber-400 animate-bounce">↗</span>
        </div>
      </div>

      {/* Visual Arched Arrow for Medium/Large Screens */}
      <div className="hidden lg:block absolute top-2 right-12 text-violet-400/80 dark:text-cyan-400/70 pointer-events-none select-none">
        <svg className="w-24 h-16" viewBox="0 0 100 70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 10 60 Q 60 55 85 10" strokeDasharray="4 4" />
          <polyline points="72 8, 85 10, 86 23" />
        </svg>
      </div>

      {/* Visual Glowing Spark Icon */}
      <div className="relative inline-block mb-6">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-2xl shadow-violet-500/30 mx-auto p-4 border border-white/20">
          <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-md" />
        </div>
        <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-black tracking-wider uppercase border border-amber-300 shadow-md">
          Choose a Set
        </span>
      </div>

      {/* Main Headline & Prompt */}
      <div className="space-y-3 max-w-xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-heading tracking-tight">
          Select your Set
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          Choose a Magic: The Gathering draft set to load card previews, personal ratings, 17Lands benchmarks, and tactical quiz drills.
        </p>
      </div>

      {/* Primary Action Button */}
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onOpenSetSelector}
          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] transition-all cursor-pointer flex items-center gap-2.5 border border-white/10"
        >
          <Layers className="w-5 h-5" />
          <span>Select your Set</span>
          <ArrowUpRight className="w-4 h-4 opacity-70" />
        </button>
      </div>

      {/* Quick Picks from Popular Limited Formats */}
      <div className="mt-12 pt-8 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center justify-center gap-2 text-xs uppercase font-mono font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Popular Premier Draft Formats</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-2xl mx-auto">
          {popularSets.map((set) => (
            <button
              key={set.code}
              type="button"
              onClick={() => onSelectSet(set)}
              className="p-3 rounded-2xl bg-white dark:bg-[#080d26] hover:bg-violet-50/80 dark:hover:bg-violet-950/40 border border-slate-200 dark:border-slate-800/80 hover:border-violet-400 dark:hover:border-violet-600 transition-all text-left flex items-center gap-3 group cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <SetSymbol setCode={set.code} iconSvgUri={set.icon_svg_uri} size="sm" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-violet-700 dark:text-cyan-300">
                    {set.code}
                  </span>
                  {set.has_17lands_data && (
                    <span className="text-[9px] font-mono px-1 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
                      17L
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-200 font-medium truncate">
                  {set.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmptySetPlaceholder;
