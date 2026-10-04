import React, { useState, useMemo } from 'react';
import { Card, SeventeenLandsSetData } from '../../types/mtg';
import { getSetThreatCards, classifyThreat, canCastWithOpenMana, OpenManaPool, ThreatCard } from '../../services/removalThreats';
import { ManaSymbol, ManaCostRenderer } from '../UI/ManaSymbol';
import { Zap, ShieldAlert, Sparkles, Filter, RotateCcw, AlertTriangle, Eye, PlayingCardsFan, Info, ExternalLink, Check, Swords, Shield, ChevronRight } from 'lucide-react';
import { get17LandsCardRating, get17LandsCardUrl } from '../../services/seventeenLands';

interface ThreatMatrixViewProps {
  cards: Card[];
  currentSetCode: string;
  currentSetName: string;
  seventeenLandsData?: SeventeenLandsSetData | null;
  onSelectCard: (card: Card) => void;
  onOpenCompsModal?: (card: Card) => void;
}

const COLOR_SECTIONS: { id: string; name: string; pip: string; headerBg: string; borderCol: string; textCol: string }[] = [
  { id: 'W', name: 'White', pip: 'W', headerBg: 'bg-amber-500/10 dark:bg-amber-500/10', borderCol: 'border-amber-300 dark:border-amber-700/60', textCol: 'text-amber-800 dark:text-amber-300' },
  { id: 'U', name: 'Blue', pip: 'U', headerBg: 'bg-sky-500/10 dark:bg-sky-500/10', borderCol: 'border-sky-300 dark:border-sky-700/60', textCol: 'text-sky-800 dark:text-sky-300' },
  { id: 'B', name: 'Black', pip: 'B', headerBg: 'bg-purple-900/10 dark:bg-purple-950/30', borderCol: 'border-purple-300 dark:border-purple-800/60', textCol: 'text-purple-800 dark:text-purple-300' },
  { id: 'R', name: 'Red', pip: 'R', headerBg: 'bg-rose-500/10 dark:bg-rose-500/10', borderCol: 'border-rose-300 dark:border-rose-700/60', textCol: 'text-rose-800 dark:text-rose-300' },
  { id: 'G', name: 'Green', pip: 'G', headerBg: 'bg-emerald-500/10 dark:bg-emerald-500/10', borderCol: 'border-emerald-300 dark:border-emerald-700/60', textCol: 'text-emerald-800 dark:text-emerald-300' },
  { id: 'M', name: 'Multicolor / Gold', pip: 'M', headerBg: 'bg-amber-400/10 dark:bg-amber-400/10', borderCol: 'border-yellow-400 dark:border-yellow-600/60', textCol: 'text-amber-900 dark:text-amber-200' },
  { id: 'C', name: 'Colorless / Artifacts', pip: 'C', headerBg: 'bg-slate-500/10 dark:bg-slate-800/40', borderCol: 'border-slate-300 dark:border-slate-700/60', textCol: 'text-slate-700 dark:text-slate-300' },
];

export const ThreatMatrixView: React.FC<ThreatMatrixViewProps> = ({
  cards,
  currentSetCode,
  currentSetName,
  seventeenLandsData,
  onSelectCard,
  onOpenCompsModal,
}) => {
  // 1. Interactive Open Mana Pool State
  const [openMana, setOpenMana] = useState<OpenManaPool>({
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
  });

  // Filter settings
  const [speedFilter, setSpeedFilter] = useState<'instant_only' | 'all_speeds'>('instant_only');
  const [rarityFilter, setRarityFilter] = useState<'common_uncommon' | 'all_rarities'>('common_uncommon');
  const [threatTypeFilter, setThreatTypeFilter] = useState<'all' | 'removal' | 'combat_tricks' | 'counterspells' | 'bounce'>('all');
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>('ALL');

  // Compute total simulated open mana
  const totalSimulatedMana = openMana.W + openMana.U + openMana.B + openMana.R + openMana.G + openMana.C;
  const isManaFilterActive = totalSimulatedMana > 0;

  // Add / decrement mana pips
  const handleAddPip = (color: keyof OpenManaPool) => {
    setOpenMana((prev) => ({ ...prev, [color]: prev[color] + 1 }));
  };

  const handleDecrementPip = (color: keyof OpenManaPool) => {
    setOpenMana((prev) => ({ ...prev, [color]: Math.max(0, prev[color] - 1) }));
  };

  const handleResetManaPool = () => {
    setOpenMana({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  };

  const handlePresetMana = (cmc: number) => {
    // Sets generic mana equal to cmc with 0 color restrictions
    setOpenMana({ W: 0, U: 0, B: 0, R: 0, G: 0, C: cmc });
  };

  // 2. Extract and classify all threats in the set
  const allSetThreats = useMemo(() => {
    return getSetThreatCards(cards);
  }, [cards]);

  // 3. Filter threats according to active settings
  const filteredThreats = useMemo(() => {
    return allSetThreats.filter((item) => {
      const { card, classification } = item;

      // Speed filter: default to Instant & Flash only
      if (speedFilter === 'instant_only' && !classification.isInstantOrFlash) {
        return false;
      }

      // Rarity filter: default to 80/20 rule (Common & Uncommon)
      if (rarityFilter === 'common_uncommon' && !classification.isCommonOrUncommon) {
        return false;
      }

      // Threat Type filter
      if (threatTypeFilter === 'removal') {
        const isRem = card.is_removal || classification.mechanism === 'Burn' || classification.mechanism === 'Destroy' ||
          classification.mechanism === 'Exile' || classification.mechanism === '-N/-N' || classification.mechanism === 'Fight/Bite' ||
          classification.mechanism === 'Pacifism' || classification.mechanism === 'Sweeper';
        if (!isRem) return false;
      } else if (threatTypeFilter === 'combat_tricks') {
        if (classification.mechanism !== 'Combat Trick') return false;
      } else if (threatTypeFilter === 'counterspells') {
        if (classification.mechanism !== 'Counterspell') return false;
      } else if (threatTypeFilter === 'bounce') {
        if (classification.mechanism !== 'Bounce') return false;
      }

      // Color filter
      if (selectedColorFilter !== 'ALL') {
        if (selectedColorFilter === 'M' && classification.primaryColor !== 'M') return false;
        if (selectedColorFilter === 'C' && classification.primaryColor !== 'C') return false;
        if (['W', 'U', 'B', 'R', 'G'].includes(selectedColorFilter) && !(card.colors as string[])?.includes(selectedColorFilter)) {
          return false;
        }
      }

      // Open Mana simulation filter
      if (isManaFilterActive) {
        if (!canCastWithOpenMana(card, openMana)) {
          return false;
        }
      }

      return true;
    });
  }, [allSetThreats, speedFilter, rarityFilter, threatTypeFilter, selectedColorFilter, isManaFilterActive, openMana]);

  // Counts by speed and rarity
  const instantCount = allSetThreats.filter((t) => t.classification.isInstantOrFlash).length;
  const commonUncommonCount = allSetThreats.filter((t) => t.classification.isCommonOrUncommon).length;

  return (
    <div className="space-y-4">
      {/* 1. Header Tactical Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-violet-900/20 via-slate-900/40 to-rose-900/20 dark:from-violet-950/40 dark:via-[#090e24] dark:to-rose-950/30 border border-violet-500/30 dark:border-violet-500/20 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-500 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Removal to Play Around • Threat Matrix
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700">
                {currentSetCode.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              In Limited, running an attacker or combat trick into open mana is the #1 tempo blowout.
              Use this matrix to read opponent untapped lands, anticipate instant-speed removal, and know when it is safe to strike.
            </p>
          </div>

          {/* Quick Summary Pill Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#070b1f] border border-slate-200 dark:border-slate-800 text-xs font-mono flex items-center gap-2 shadow-2xs">
              <span className="text-slate-400">Live Threats:</span>
              <strong className="text-rose-600 dark:text-rose-400 font-bold">{filteredThreats.length}</strong>
              <span className="text-slate-400">/ {allSetThreats.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-[#070b1f] border border-slate-200 dark:border-slate-800 text-xs font-mono flex items-center gap-2 shadow-2xs">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-slate-400">Instant Speed:</span>
              <strong className="text-amber-600 dark:text-amber-400 font-bold">{instantCount}</strong>
            </div>
          </div>
        </div>

        {/* 2. Interactive "What Can They Have?" Open Mana Simulator */}
        <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-mono">
                <Zap className="w-3.5 h-3.5 text-violet-500" />
                <span>Simulate Opponent Open Mana:</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                (Click pips to add lands)
              </span>
            </div>

            {/* Presets & Reset */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden sm:inline">Quick Presets:</span>
              {[1, 2, 3, 4].map((cmc) => (
                <button
                  key={cmc}
                  type="button"
                  onClick={() => handlePresetMana(cmc)}
                  className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer border ${
                    openMana.C === cmc && openMana.W === 0 && openMana.U === 0 && openMana.B === 0 && openMana.R === 0 && openMana.G === 0
                      ? 'bg-violet-600 text-white border-violet-500 shadow-2xs'
                      : 'bg-white dark:bg-[#080d21] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-violet-400'
                  }`}
                  title={`Simulate opponent having any ${cmc} mana open`}
                >
                  {cmc} Mana
                </button>
              ))}

              {isManaFilterActive && (
                <button
                  type="button"
                  onClick={handleResetManaPool}
                  className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/80 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Clear open mana filter"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Clickable Mana Pips Selector */}
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-white/90 dark:bg-[#070b1f] border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-1 hidden md:inline">Add Mana:</span>
              {(['W', 'U', 'B', 'R', 'G', 'C'] as (keyof OpenManaPool)[]).map((pip) => (
                <button
                  key={pip}
                  type="button"
                  onClick={() => handleAddPip(pip)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform active:scale-95 cursor-pointer flex items-center gap-1 group"
                  title={`Add 1 ${pip === 'C' ? 'Generic / Colorless' : pip} to opponent open mana`}
                >
                  <ManaSymbol symbol={pip === 'C' ? '1' : pip} size="sm" />
                </button>
              ))}
            </div>

            {/* Active Simulated Pool Display */}
            {isManaFilterActive ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/80">
                <span className="text-[11px] font-bold text-violet-900 dark:text-violet-200 font-mono">
                  Filtering for Opponent with:
                </span>
                <div className="flex items-center gap-1">
                  {(['W', 'U', 'B', 'R', 'G', 'C'] as (keyof OpenManaPool)[]).map((pip) => {
                    const count = openMana[pip];
                    if (count === 0) return null;
                    return (
                      <button
                        key={pip}
                        type="button"
                        onClick={() => handleDecrementPip(pip)}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white dark:bg-[#080d21] border border-violet-300 dark:border-violet-700/80 hover:border-rose-400 cursor-pointer shadow-2xs group"
                        title={`Click to remove 1 ${pip === 'C' ? 'Generic' : pip} mana`}
                      >
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 group-hover:text-rose-500">
                          {count}×
                        </span>
                        <ManaSymbol symbol={pip === 'C' ? '1' : pip} size="xs" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                Showing all threats (no open mana restriction active).
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Toolbar Controls: Speed, Rarity, Mechanism, and Color */}
      <div className="p-3 bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Timing / Speed Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setSpeedFilter('instant_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                speedFilter === 'instant_only'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Show only Instant-speed spells & Flash cards that can disrupt attacks during combat"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Instant Speed Only (Combat Threats)</span>
            </button>
            <button
              type="button"
              onClick={() => setSpeedFilter('all_speeds')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                speedFilter === 'all_speeds'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Include Sorcery-speed removal and Auras"
            >
              <span>All Speeds (Sorceries & Auras)</span>
            </button>
          </div>

          {/* Rarity (80/20 Rule) Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setRarityFilter('common_uncommon')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                rarityFilter === 'common_uncommon'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Focus strictly on Commons and Uncommons (90%+ of draft blowouts happen here)"
            >
              <Sparkles className="w-3 h-3 text-yellow-300" />
              <span>Commons & Uncommons (80/20 Rule)</span>
            </button>
            <button
              type="button"
              onClick={() => setRarityFilter('all_rarities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                rarityFilter === 'all_rarities'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Include Rare and Mythic sweepers and bombs"
            >
              <span>Include Rares/Mythics</span>
            </button>
          </div>
        </div>

        {/* Threat Type Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-1 font-mono">Category:</span>
          {[
            { id: 'all', label: 'All Interaction' },
            { id: 'removal', label: 'Spot Removal & Sweepers' },
            { id: 'combat_tricks', label: 'Combat Tricks & Buffs' },
            { id: 'counterspells', label: 'Counterspells' },
            { id: 'bounce', label: 'Bounce & Tempo' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setThreatTypeFilter(cat.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                threatTypeFilter === cat.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Threat Matrix Color Grid */}
      {filteredThreats.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#090e24] border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {isManaFilterActive
              ? 'No threats can be cast with this open mana!'
              : 'No cards match the active threat filters.'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {isManaFilterActive
              ? 'Opponent cannot cast any matching interaction spells with the currently selected open mana. You are safe from instant combat blowouts!'
              : 'Try switching to All Speeds or including Rares to view additional cards.'}
          </p>
          {isManaFilterActive && (
            <button
              type="button"
              onClick={handleResetManaPool}
              className="px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-xs hover:bg-violet-700 transition-colors cursor-pointer"
            >
              Clear Open Mana Filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {COLOR_SECTIONS.map((sec) => {
            const secThreats = filteredThreats.filter((t) => {
              if (sec.id === 'M') return t.classification.primaryColor === 'M';
              if (sec.id === 'C') return t.classification.primaryColor === 'C';
              return (t.card.colors as string[])?.includes(sec.id) && t.classification.primaryColor !== 'M';
            });

            if (secThreats.length === 0) {
              return null;
            }

            return (
              <div
                key={sec.id}
                className="rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xs"
              >
                {/* Section Header */}
                <div className={`px-4 py-2.5 ${sec.headerBg} border-b ${sec.borderCol} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <ManaSymbol symbol={sec.pip} size="sm" />
                    <h3 className={`text-sm font-black ${sec.textCol} tracking-tight`}>
                      {sec.name} Threats
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/80 dark:bg-[#060a1d] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-2xs">
                      {secThreats.length} card{secThreats.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                    Sorted by CMC (Lowest to Highest)
                  </span>
                </div>

                {/* Threat Cards Grid */}
                <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {secThreats.map(({ card, classification }) => {
                    const landData = get17LandsCardRating(card, seventeenLandsData) || undefined;
                    const isInstant = classification.isInstantOrFlash;

                    return (
                      <div
                        key={card.id}
                        onClick={() => onSelectCard(card)}
                        className="p-3 rounded-xl bg-slate-50/70 dark:bg-[#060a1d]/80 border border-slate-200/90 dark:border-slate-800/80 hover:border-violet-500/60 dark:hover:border-violet-500/60 transition-all flex flex-col justify-between gap-2 shadow-2xs hover:shadow-xs cursor-pointer group"
                      >
                        {/* Top Row: Name, Mana Cost, Speed Badge */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-200 transition-colors truncate">
                              {card.name}
                            </h4>
                            <div className="shrink-0 flex items-center gap-1.5">
                              <ManaCostRenderer manaCost={card.mana_cost} size="xs" />
                            </div>
                          </div>

                          {/* Sub-header Badges: Speed, Rarity, Mechanism */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {/* Speed Badge */}
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider flex items-center gap-1 ${
                                isInstant
                                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80'
                                  : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {isInstant && <Zap className="w-2.5 h-2.5 text-amber-500" />}
                              <span>{isInstant ? 'Instant' : classification.speed}</span>
                            </span>

                            {/* Rarity Badge */}
                            <span className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                              card.rarity === 'common'
                                ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                : card.rarity === 'uncommon'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                                : card.rarity === 'rare'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            }`}>
                              {card.rarity[0].toUpperCase()}
                            </span>

                            {/* Mechanism Tag */}
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-violet-100/80 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60">
                              {classification.mechanism}
                            </span>

                            {/* Restriction Tag */}
                            {classification.restriction && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                                {classification.restriction}
                              </span>
                            )}
                          </div>

                          {/* Threat Summary Banner */}
                          <div className="p-1.5 rounded-lg bg-white dark:bg-[#0a0f28] border border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                            {classification.shortSummary}
                          </div>
                        </div>

                        {/* Bottom Row: 17Lands Telemetry & Action Buttons */}
                        <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-1 text-[10px] font-mono">
                          {landData && typeof landData.win_rate === 'number' ? (
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <span>WR: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{((landData.win_rate || 0) * 100).toFixed(1)}%</strong></span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>ALSA: <strong className="text-slate-800 dark:text-slate-200">{typeof landData.avg_seen === 'number' ? landData.avg_seen.toFixed(1) : '-'}</strong></span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">
                              {card.type_line}
                            </span>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            {onOpenCompsModal && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenCompsModal(card);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-violet-600 dark:hover:text-cyan-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="View Precedent Engine comps"
                              >
                                <PlayingCardsFan className="w-3 h-3" />
                              </button>
                            )}

                            <a
                              href={get17LandsCardUrl(card.set || currentSetCode, card, landData)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-md text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
                              title="Open on 17Lands.com"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
