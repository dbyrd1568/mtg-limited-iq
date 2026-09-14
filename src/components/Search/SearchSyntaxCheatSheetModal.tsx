import React from 'react';
import { X, BookOpen, Sparkles, ArrowRight } from 'lucide-react';

interface SearchSyntaxCheatSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery?: (query: string) => void;
}

export const SearchSyntaxCheatSheetModal: React.FC<SearchSyntaxCheatSheetModalProps> = ({
  isOpen,
  onClose,
  onSelectQuery,
}) => {
  if (!isOpen) return null;

  const handleApplyExample = (exampleQuery: string) => {
    if (onSelectQuery) {
      onSelectQuery(exampleQuery);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 dark:bg-[#030612]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060a1d] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-cyan-400 flex items-center justify-center border border-violet-200 dark:border-violet-700/50 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading">
                Advanced Search Terms & Syntax Guide
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Type Scryfall and MTG Arena query syntax directly into the search bar.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
          {/* Section 1: Text Comparisons */}
          <div className="space-y-2.5">
            <h3 className="font-heading font-black text-sm uppercase tracking-wider text-violet-700 dark:text-cyan-300 flex items-center gap-1.5">
              <span>Text Comparisons</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Fields Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-[#050818]/60">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                    <tr>
                      <th className="px-3 py-1.5">Code</th>
                      <th className="px-3 py-1.5">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">NAME</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Name of Card</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">E, S</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Expansion Set Code</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">O</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Oracle, Rules Text</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">T</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Type, Subtype, or Supertype</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">C</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Color</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">ID</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Color Identity</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Operators Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-[#050818]/60">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                    <tr>
                      <th className="px-3 py-1.5">Code</th>
                      <th className="px-3 py-1.5">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">:</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Exactly (same as =)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">&gt;</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Color: More Than</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">&gt;=</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Color: Must Include</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">&lt;</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Color: Fewer Than</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">&lt;=</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Color: All Or Fewer Than</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-700 dark:text-cyan-400">""</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">For Exact Phrases</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Color Codes Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-[#050818]/60">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                    <tr>
                      <th className="px-3 py-1.5">Code</th>
                      <th className="px-3 py-1.5">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-500">W</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">White</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-cyan-400">U</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Blue</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-slate-400">B</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Black</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-rose-500">R</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Red</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-emerald-500">G</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Green</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-violet-400">C, M</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Colorless, Multicolor</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Numerical Comparisons */}
          <div className="space-y-2.5">
            <h3 className="font-heading font-black text-sm uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span>Numerical Comparisons</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Fields Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-[#050818]/60">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                    <tr>
                      <th className="px-3 py-1.5">Code</th>
                      <th className="px-3 py-1.5">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">POW</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Power</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">TOU</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Toughness</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">2/3, PT</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Power / Toughness Stats</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">{'{2}{W}'}, M</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Exact Mana Cost Symbols</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">R</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Rarity</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">MV / CMC</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Mana Value</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Operators Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-[#050818]/60">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                    <tr>
                      <th className="px-3 py-1.5">Code</th>
                      <th className="px-3 py-1.5">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">=</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Equals (same as :)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">&lt;</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Less Than</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">&gt;</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Greater Than</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">&gt;=</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Greater or Equal to</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">&lt;=</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Lesser or Equal to</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">!=</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Does Not Equal</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Rarity & Number Codes */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-[#050818]/60">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-200/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                    <tr>
                      <th className="px-3 py-1.5">Code</th>
                      <th className="px-3 py-1.5">Definition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-600 dark:text-amber-400">0-9</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Numeric Values</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-orange-500">M</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Mythic Rare</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-amber-400">R</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Rare</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-cyan-400">U</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Uncommon</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-bold text-slate-400">C</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-sans">Common</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Interactive Clickable Examples */}
          <div className="space-y-2.5">
            <h3 className="font-heading font-black text-sm uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Examples (Click any to search immediately)</span>
            </h3>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/60 dark:bg-[#050818]/60">
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {[
                  {
                    code: '{2}{W}',
                    desc: 'Search for cards with exact or partial mana cost {2}{W}',
                  },
                  {
                    code: '2/3',
                    desc: 'Search for creatures with 2 power and 3 toughness (without affecting text)',
                  },
                  {
                    code: 'flying 2/3 {2}{W}',
                    desc: 'Combines text keyword, 2/3 power/toughness, and {2}{W} mana cost',
                  },
                  {
                    code: 't:cat c<=WGB',
                    desc: 'Any cat with a mana cost that includes White, Green, Black, or Colorless',
                  },
                  {
                    code: 'r=u pow>3 c>=G',
                    desc: 'All Uncommon cards with more than 3 Power and a mana cost that includes Green',
                  },
                  {
                    code: 'c=R cmc<4 o:"damage to any target"',
                    desc: "Let's make a Mono-Red Burn deck!",
                  },
                  {
                    code: 't:creature pow>=4 mv<=3',
                    desc: 'High-power early beaters (3 or less mana value, 4+ power)',
                  },
                  {
                    code: 'is:trick c:w',
                    desc: 'White combat tricks in this limited set',
                  },
                  {
                    code: 'is:removal mv<=2',
                    desc: 'Cheap efficient removal (2 mana or less)',
                  },
                ].map((ex) => (
                  <button
                    key={ex.code}
                    onClick={() => handleApplyExample(ex.code)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors group cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <div className="font-mono font-bold text-violet-700 dark:text-cyan-300 group-hover:text-violet-600 dark:group-hover:text-cyan-200 text-xs">
                        {ex.code}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 text-[11px] font-sans">
                        {ex.desc}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-violet-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0">
                      <span>Try This</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060a1d] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
