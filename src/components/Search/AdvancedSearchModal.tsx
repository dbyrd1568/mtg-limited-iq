import React, { useState, useMemo } from 'react';
import { X, Search, RotateCcw, Copy, Check, BookOpen, Sparkles, Filter } from 'lucide-react';
import { MTGColor, MTGRarity } from '../../types/mtg';
import {
  AdvancedSearchFilters,
  DEFAULT_ADVANCED_FILTERS,
  buildQueryFromAdvancedFilters,
  ComparisonOperator,
} from '../../services/cardSearchParser';
import { ManaSymbol } from '../UI/ManaSymbol';
import { SetBadge } from '../UI/SetSymbol';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSetCode: string;
  currentSetName: string;
  initialQuery?: string;
  onApplyQuery: (queryString: string) => void;
  onOpenCheatSheet: () => void;
}

const PRIMARY_TYPES = [
  'Creature',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Planeswalker',
  'Land',
  'Battle',
];

const RARITIES: { value: MTGRarity; label: string; color: string }[] = [
  { value: 'common', label: 'Common', color: 'text-slate-400 border-slate-600' },
  { value: 'uncommon', label: 'Uncommon', color: 'text-cyan-400 border-cyan-500' },
  { value: 'rare', label: 'Rare', color: 'text-amber-400 border-amber-500' },
  { value: 'mythic', label: 'Mythic', color: 'text-orange-500 border-orange-500' },
];

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  currentSetCode,
  currentSetName,
  initialQuery = '',
  onApplyQuery,
  onOpenCheatSheet,
}) => {
  const [filters, setFilters] = useState<AdvancedSearchFilters>({
    ...DEFAULT_ADVANCED_FILTERS,
  });
  const [copiedQuery, setCopiedQuery] = useState<boolean>(false);

  // Generate live query string based on current form
  const generatedQuery = useMemo(() => {
    return buildQueryFromAdvancedFilters(filters);
  }, [filters]);

  if (!isOpen) return null;

  const handleToggleType = (typeName: string) => {
    setFilters((prev) => {
      const exists = prev.types.includes(typeName);
      return {
        ...prev,
        types: exists ? prev.types.filter((t) => t !== typeName) : [...prev.types, typeName],
      };
    });
  };

  const handleToggleColor = (color: MTGColor) => {
    setFilters((prev) => {
      const exists = prev.colors.includes(color);
      return {
        ...prev,
        colors: exists ? prev.colors.filter((c) => c !== color) : [...prev.colors, color],
      };
    });
  };

  const handleToggleRarity = (rarity: MTGRarity) => {
    setFilters((prev) => {
      const exists = prev.rarities.includes(rarity);
      return {
        ...prev,
        rarities: exists ? prev.rarities.filter((r) => r !== rarity) : [...prev.rarities, rarity],
      };
    });
  };

  const handleReset = () => {
    setFilters({ ...DEFAULT_ADVANCED_FILTERS });
  };

  const handleCopyQuery = () => {
    if (!generatedQuery) return;
    try {
      navigator.clipboard.writeText(generatedQuery);
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyQuery(generatedQuery);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 dark:bg-[#090a0d]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white dark:bg-[#121316] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#17181c] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600 dark:bg-cyan-500 text-white flex items-center justify-center shadow-md shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading">
                  Advanced Card Search
                </h2>
                <SetBadge setCode={currentSetCode} size="xs" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scryfall-style granular search strictly scoped to {currentSetName} ({currentSetCode.toUpperCase()}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenCheatSheet}
              className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold text-violet-600 dark:text-cyan-400 hover:bg-violet-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 border border-violet-200 dark:border-slate-700 cursor-pointer"
              title="View MTG Arena and Scryfall syntax cheat sheet"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Syntax Guide</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          {/* Card Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-heading font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Card Name
              </label>
              <label className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.nameExact}
                  onChange={(e) => setFilters((p) => ({ ...p, nameExact: e.target.checked }))}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <span>Exact phrase only</span>
              </label>
            </div>
            <input
              type="text"
              placeholder="e.g. Acrobatic Leap, Dragon, Strike..."
              value={filters.name}
              onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
            />
          </div>

          {/* Rules / Oracle Text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-heading font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Rules & Oracle Text
              </label>
              <span className="text-[11px] text-slate-400 font-mono">Matches text in card rules</span>
            </div>
            <input
              type="text"
              placeholder="e.g. flying, draw a card, counter target, destroy..."
              value={filters.oracleText}
              onChange={(e) => setFilters((p) => ({ ...p, oracleText: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
            />
            {/* Quick keywords chips */}
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[10px] text-slate-400 uppercase font-mono mr-1">Quick Add:</span>
              {['flying', 'draw', 'destroy', 'counter', 'ward', 'trample', '+1/+1'].map((kw) => (
                <button
                  type="button"
                  key={kw}
                  onClick={() =>
                    setFilters((p) => ({
                      ...p,
                      oracleText: p.oracleText ? `${p.oracleText} ${kw}` : kw,
                    }))
                  }
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-slate-700 text-[10px] font-mono transition-colors cursor-pointer"
                >
                  +{kw}
                </button>
              ))}
            </div>
          </div>

          {/* Card Types & Subtype */}
          <div className="space-y-2">
            <label className="font-heading font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Card Types & Subtypes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRIMARY_TYPES.map((t) => {
                const isSelected = filters.types.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    onClick={() => handleToggleType(t)}
                    className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-[#17181c] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="pt-1">
              <input
                type="text"
                placeholder="Subtype (e.g. Cat, Frog, Equipment, Aura, Goblin, Legend)..."
                value={filters.subtype}
                onChange={(e) => setFilters((p) => ({ ...p, subtype: e.target.value }))}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
              />
            </div>
          </div>

          {/* Colors & Mana */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="font-heading font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Colors
              </label>

              {/* Color match mode selector */}
              <select
                value={filters.colorMode}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, colorMode: e.target.value as any }))
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none"
              >
                <option value="include">Must include these colors (c&gt;=)</option>
                <option value="at_most">At most these colors (c&lt;=)</option>
                <option value="exact">Exactly these colors (c=)</option>
                <option value="identity">Color identity (id&lt;=)</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {(['W', 'U', 'B', 'R', 'G'] as MTGColor[]).map((c) => {
                const isSelected = filters.colors.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => handleToggleColor(c)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-violet-100 text-violet-900 border-violet-500 dark:bg-violet-950 dark:text-violet-200 shadow-xs scale-105'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400 opacity-60'
                    }`}
                  >
                    <ManaSymbol symbol={c} size="sm" />
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rarity */}
          <div className="space-y-1.5">
            <label className="font-heading font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Rarity
            </label>
            <div className="flex flex-wrap gap-2">
              {RARITIES.map((r) => {
                const isSelected = filters.rarities.includes(r.value);
                return (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => handleToggleRarity(r.value)}
                    className={`px-3.5 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-[#17181c] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mana Value & Combat Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Mana Value (CMC) */}
            <div className="space-y-1 p-3 rounded-2xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800">
              <label className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Mana Value (MV / CMC)
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={filters.cmcOperator}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, cmcOperator: e.target.value as ComparisonOperator }))
                  }
                  className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs cursor-pointer"
                >
                  <option value="=">=</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="!=">!=</option>
                </select>
                <input
                  type="number"
                  min="0"
                  max="16"
                  placeholder="e.g. 3"
                  value={filters.cmcValue}
                  onChange={(e) => setFilters((p) => ({ ...p, cmcValue: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                />
              </div>
            </div>

            {/* Power */}
            <div className="space-y-1 p-3 rounded-2xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800">
              <label className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Power
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={filters.powerOperator}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, powerOperator: e.target.value as ComparisonOperator }))
                  }
                  className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs cursor-pointer"
                >
                  <option value=">=">&gt;=</option>
                  <option value="=">=</option>
                  <option value="<=">&lt;=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                </select>
                <input
                  type="number"
                  min="0"
                  max="20"
                  placeholder="e.g. 4"
                  value={filters.powerValue}
                  onChange={(e) => setFilters((p) => ({ ...p, powerValue: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                />
              </div>
            </div>

            {/* Toughness */}
            <div className="space-y-1 p-3 rounded-2xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800">
              <label className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Toughness
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={filters.toughnessOperator}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, toughnessOperator: e.target.value as ComparisonOperator }))
                  }
                  className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs cursor-pointer"
                >
                  <option value=">=">&gt;=</option>
                  <option value="=">=</option>
                  <option value="<=">&lt;=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                </select>
                <input
                  type="number"
                  min="0"
                  max="20"
                  placeholder="e.g. 4"
                  value={filters.toughnessValue}
                  onChange={(e) => setFilters((p) => ({ ...p, toughnessValue: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Limited Utility Fast Tags */}
          <div className="space-y-1.5">
            <label className="font-heading font-black text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Limited Utility Tags
            </label>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(filters.isInstantSpeed)}
                  onChange={(e) => setFilters((p) => ({ ...p, isInstantSpeed: e.target.checked }))}
                  className="rounded text-violet-600"
                />
                <span>Instant Speed / Flash (is:flash)</span>
              </label>

              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(filters.isRemoval)}
                  onChange={(e) => setFilters((p) => ({ ...p, isRemoval: e.target.checked }))}
                  className="rounded text-violet-600"
                />
                <span>Removal Spells (is:removal)</span>
              </label>

              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(filters.isCombatTrick)}
                  onChange={(e) => setFilters((p) => ({ ...p, isCombatTrick: e.target.checked }))}
                  className="rounded text-violet-600"
                />
                <span>Combat Tricks (is:trick)</span>
              </label>
            </div>
          </div>

          {/* Live Query Preview Box */}
          <div className="p-3.5 rounded-2xl bg-violet-50/80 dark:bg-[#17181c] border border-violet-200 dark:border-violet-500/40 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-heading font-bold uppercase tracking-wider text-violet-900 dark:text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generated Scryfall / Arena Query:</span>
              </span>
              {generatedQuery && (
                <button
                  type="button"
                  onClick={handleCopyQuery}
                  className="text-violet-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedQuery ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedQuery ? 'Copied' : 'Copy Query'}</span>
                </button>
              )}
            </div>

            <div className="p-2 rounded-xl bg-white dark:bg-[#090a0d] border border-violet-200 dark:border-slate-800 font-mono text-xs text-violet-900 dark:text-cyan-200 break-all min-h-[36px] flex items-center">
              {generatedQuery ? (
                <span>{generatedQuery}</span>
              ) : (
                <span className="text-slate-400 italic">No filters active (browsing all cards in {currentSetCode})</span>
              )}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#17181c] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all shadow-md shadow-violet-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Search {currentSetCode.toUpperCase()} Cards</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
