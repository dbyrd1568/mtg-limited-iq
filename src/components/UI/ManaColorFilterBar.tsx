import React, { useMemo } from 'react';
import { Card, MTGColor } from '../../types/mtg';
import {
  isRemovalSpell,
  isInteractionSpell,
  isCounterspell,
  isCombatTrick,
  isCardDrawSpell,
} from '../../services/scryfall';

export type ManaFilterColor = 'ALL' | 'W' | 'U' | 'B' | 'R' | 'G' | 'COLORLESS' | 'GOLD' | 'LANDS';

interface ManaColorFilterBarProps {
  selectedColor?: string | string[];
  selectedColors?: string[];
  onSelectColor?: (color: string) => void;
  onSelectColors?: (colors: string[]) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showAllButton?: boolean;
}

export const ManaColorFilterBar: React.FC<ManaColorFilterBarProps> = ({
  selectedColor,
  selectedColors,
  onSelectColor,
  onSelectColors,
  className = '',
  size = 'md',
  showAllButton = true,
}) => {
  // Normalize active selection array
  const activeSelection: string[] = useMemo(() => {
    if (selectedColors && Array.isArray(selectedColors)) {
      return selectedColors;
    }
    if (Array.isArray(selectedColor)) {
      return selectedColor;
    }
    if (typeof selectedColor === 'string') {
      if (selectedColor === 'ALL' || !selectedColor) return ['ALL'];
      if (selectedColor.includes(',')) return selectedColor.split(',').filter(Boolean);
      // If it's a 2-letter archetype like 'UB' or 'WR'
      if (selectedColor.length === 2 && !['ALL', 'GOLD', 'LANDS', 'MULTI', 'COLORLESS'].includes(selectedColor)) {
        return [selectedColor[0], selectedColor[1]];
      }
      return [selectedColor];
    }
    return ['ALL'];
  }, [selectedColor, selectedColors]);

  const isAllActive = activeSelection.length === 0 || activeSelection.includes('ALL');

  const handleClick = (colorId: string) => {
    if (colorId === 'ALL') {
      if (onSelectColors) onSelectColors(['ALL']);
      if (onSelectColor) onSelectColor('ALL');
      return;
    }

    const currentWithoutAll = activeSelection.filter((c) => c !== 'ALL');
    let next: string[];

    if (currentWithoutAll.includes(colorId)) {
      // Toggle off
      next = currentWithoutAll.filter((c) => c !== colorId);
      if (next.length === 0) {
        next = ['ALL'];
      }
    } else {
      // If colorId is GOLD, remove MULTI if present
      if (colorId === 'GOLD') {
        const withoutMulti = currentWithoutAll.filter((c) => c !== 'MULTI' && !c.startsWith('GOLD_'));
        next = [...withoutMulti, 'GOLD'];
      } else {
        next = [...currentWithoutAll, colorId];
      }
    }

    if (onSelectColors) {
      onSelectColors(next);
    }
    if (onSelectColor) {
      if (next.length === 0 || next.includes('ALL')) {
        onSelectColor('ALL');
      } else if (next.length === 1) {
        onSelectColor(next[0]);
      } else {
        const isAllMana = next.every((c) => ['W', 'U', 'B', 'R', 'G'].includes(c));
        if (isAllMana && next.length === 2) {
          onSelectColor(next.join(''));
        } else {
          onSelectColor(next.join(','));
        }
      }
    }
  };

  const buttonSize = size === 'sm' ? 'w-6 h-6 sm:w-7 sm:h-7' : size === 'lg' ? 'w-9 h-9 sm:w-10 sm:h-10' : 'w-7 h-7 sm:w-8 sm:h-8';
  const iconSize = size === 'sm' ? 'w-5 h-5 sm:w-6 sm:h-6' : size === 'lg' ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-6 h-6 sm:w-7 sm:h-7';

  const COLOR_BUTTONS = [
    {
      id: 'W',
      label: 'White',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/W.svg',
    },
    {
      id: 'U',
      label: 'Blue',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/U.svg',
    },
    {
      id: 'B',
      label: 'Black',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/B.svg',
    },
    {
      id: 'R',
      label: 'Red',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/R.svg',
    },
    {
      id: 'G',
      label: 'Green',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/G.svg',
    },
    {
      id: 'COLORLESS',
      label: 'Colorless',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/C.svg',
    },
    {
      id: 'GOLD',
      label: 'Gold / Multicolor',
      isGold: true,
    },
    {
      id: 'LANDS',
      label: 'Lands',
      isLand: true,
    },
  ];

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200/90 dark:border-slate-800/80 shadow-xs shrink-0 ${className}`}>
      {showAllButton && (
        <button
          type="button"
          onClick={() => handleClick('ALL')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            isAllActive
              ? 'bg-violet-600 text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
          }`}
          title="Reset to all colors"
        >
          ALL
        </button>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        {COLOR_BUTTONS.map((item) => {
          const isSelected =
            !isAllActive &&
            (activeSelection.includes(item.id) ||
              (item.id === 'GOLD' && (activeSelection.includes('MULTI') || activeSelection.some((s) => s.startsWith('GOLD')))));

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item.id)}
              className={`${buttonSize} rounded-full flex items-center justify-center transition-all cursor-pointer relative select-none ${
                isSelected
                  ? 'ring-2 ring-amber-400 dark:ring-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.85)] scale-110 z-10 opacity-100'
                  : 'opacity-50 hover:opacity-90 hover:scale-105 grayscale-[20%] hover:grayscale-0'
              }`}
              title={`Filter by ${item.label}`}
              aria-label={item.label}
              aria-pressed={isSelected}
            >
              {item.isGold ? (
                <div className={`${iconSize} rounded-full overflow-hidden flex items-center justify-center drop-shadow-md`}>
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <defs>
                      <radialGradient id="goldOuter" cx="50%" cy="50%" r="50%">
                        <stop offset="60%" stopColor="#cca03b" />
                        <stop offset="85%" stopColor="#f3d878" />
                        <stop offset="100%" stopColor="#875e18" />
                      </radialGradient>
                      <radialGradient id="goldInner" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#1a1409" />
                        <stop offset="70%" stopColor="#3d2c0e" />
                        <stop offset="100%" stopColor="#cca03b" />
                      </radialGradient>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="url(#goldOuter)" stroke="#422906" strokeWidth="4" />
                    <circle cx="50" cy="50" r="26" fill="url(#goldInner)" stroke="#f3d878" strokeWidth="3" />
                  </svg>
                </div>
              ) : item.isLand ? (
                <div className={`${iconSize} rounded-full overflow-hidden flex items-center justify-center drop-shadow-md`}>
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <defs>
                      <radialGradient id="landOuter" cx="50%" cy="50%" r="50%">
                        <stop offset="60%" stopColor="#8d949c" />
                        <stop offset="85%" stopColor="#b4bcc6" />
                        <stop offset="100%" stopColor="#4b525a" />
                      </radialGradient>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="url(#landOuter)" stroke="#272b30" strokeWidth="4" />
                    <path
                      d="M 16,70 C 22,68 30,52 38,38 C 42,30 46,38 52,50 C 56,42 62,26 68,26 C 74,26 80,55 84,70 Z"
                      fill="#0d1013"
                    />
                  </svg>
                </div>
              ) : (
                <img
                  src={item.symbolUrl}
                  alt={item.label}
                  className={`${iconSize} object-contain select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]`}
                  loading="lazy"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Evaluates whether a card matches the active additive color filters.
 */
export function cardMatchesColorFilter(c: Card, selectedColors: string[] | string): boolean {
  const activeSelection: string[] = Array.isArray(selectedColors)
    ? selectedColors
    : typeof selectedColors === 'string'
    ? selectedColors === 'ALL' || !selectedColors
      ? ['ALL']
      : selectedColors.includes(',')
      ? selectedColors.split(',').filter(Boolean)
      : selectedColors.length === 2 && !['ALL', 'GOLD', 'LANDS', 'MULTI', 'COLORLESS'].includes(selectedColors)
      ? [selectedColors[0], selectedColors[1]]
      : [selectedColors]
    : ['ALL'];

  if (!activeSelection || activeSelection.length === 0 || activeSelection.includes('ALL')) {
    return true;
  }

  // Handle specific GOLD_XX pair (e.g. 'GOLD_UB')
  const goldSpecific = activeSelection.find((s) => s.startsWith('GOLD_'));
  if (goldSpecific) {
    const pairCode = goldSpecific.replace('GOLD_', '');
    const c1 = pairCode[0] as MTGColor;
    const c2 = pairCode[1] as MTGColor;
    const colors = c.colors || [];
    return colors.length >= 2 && colors.includes(c1) && colors.includes(c2);
  }

  const manaColors = activeSelection.filter((s) => ['W', 'U', 'B', 'R', 'G'].includes(s)) as MTGColor[];
  const hasColorless = activeSelection.includes('COLORLESS');
  const hasGold = activeSelection.includes('GOLD') || activeSelection.includes('MULTI');
  const hasLands = activeSelection.includes('LANDS');

  const isLand = Boolean(c.is_land || c.type_line?.toLowerCase().includes('land'));
  const isColorlessNonLand = (c.colors.length === 0 || (c.colors.length === 1 && c.colors[0] === 'C')) && !isLand;
  const isMulticolor = (c.colors || []).length >= 2;

  // 1. If Lands selected and card is Land
  if (hasLands && isLand) return true;

  // 2. If Colorless selected and card is Colorless (non-land)
  if (hasColorless && isColorlessNonLand) return true;

  // 3. If Gold selected
  if (hasGold) {
    if (manaColors.length === 0) {
      if (isMulticolor) return true;
    } else if (manaColors.length === 1) {
      // Multicolor card containing this color
      if (isMulticolor && c.colors.includes(manaColors[0])) return true;
    } else {
      // Multicolor card within the selected mana colors
      if (isMulticolor && c.colors.every((col) => manaColors.includes(col))) return true;
    }
  }

  // 4. Mana colors selected
  if (manaColors.length > 0 && !isLand) {
    const cardColors = (c.colors || []).filter((col) => col !== 'C');
    // If user selected GOLD and multiple mana colors, they only wanted gold cards
    if (hasGold && manaColors.length >= 2) {
      // Handled in step 3
    } else {
      if (cardColors.length > 0 && cardColors.every((col) => manaColors.includes(col))) {
        return true;
      }
    }
  }

  return false;
}

export interface RoleFilterOption {
  id: string;
  label: string;
  description?: string;
}

export const DEFAULT_ROLE_FILTERS: RoleFilterOption[] = [
  { id: 'ALL', label: 'All', description: 'All cards in the set' },
  { id: 'CREATURE', label: 'Creatures', description: 'Creatures and threats on board' },
  { id: 'REMOVAL', label: 'Removal', description: 'On-board removal: destroy, exile, burn, -N/-N, auras, fight/bite' },
  { id: 'INTERACTION', label: 'Interaction', description: 'All disruption: Removal + Counters + Discard + Combat Tricks' },
  { id: 'COUNTER', label: 'Counters', description: 'Stack interaction: counterspells' },
  { id: 'TRICK', label: 'Tricks', description: 'Combat tricks: instant buffs, pumps, protection' },
  { id: 'DRAW', label: 'Card Draw', description: 'Card advantage, draw spells, selection, and impulse draw' },
  { id: 'INSTANT', label: 'Instants', description: 'Instant-speed spells and flash' },
];

/**
 * Checks if a card matches a single role or card type.
 */
export function cardMatchesRole(c: Card, roleId: string): boolean {
  if (roleId === 'ALL') return true;
  const typeLine = (c.type_line || '').toLowerCase();

  switch (roleId) {
    case 'CREATURE':
      return Boolean(typeLine.includes('creature') || c.is_creature);
    case 'REMOVAL':
      return Boolean(c.is_removal ?? isRemovalSpell(c));
    case 'INTERACTION':
      return Boolean(c.is_interaction ?? isInteractionSpell(c));
    case 'COUNTER':
    case 'COUNTERSPELL':
      return Boolean(c.is_counterspell ?? isCounterspell(c));
    case 'TRICK':
    case 'COMBAT_TRICK':
      return Boolean(c.is_combat_trick ?? isCombatTrick(c));
    case 'DRAW':
    case 'CARD_DRAW':
      return Boolean(c.is_card_draw ?? isCardDrawSpell(c));
    case 'INSTANT':
      return Boolean(typeLine.includes('instant') || c.is_instant_speed);
    case 'SORCERY':
      return Boolean(typeLine.includes('sorcery'));
    case 'ARTIFACT':
      return Boolean(typeLine.includes('artifact'));
    case 'ENCHANTMENT':
      return Boolean(typeLine.includes('enchantment'));
    case 'LAND':
      return Boolean(typeLine.includes('land') || c.is_land);
    default:
      return true;
  }
}

/**
 * Evaluates whether a card matches the active additive type / role filters (OR union).
 */
export function cardMatchesRoleFilter(c: Card, selectedRoles: string[] | string): boolean {
  const activeRoles = Array.isArray(selectedRoles)
    ? selectedRoles
    : typeof selectedRoles === 'string'
    ? selectedRoles === 'ALL' || !selectedRoles
      ? ['ALL']
      : selectedRoles.includes(',')
      ? selectedRoles.split(',').filter(Boolean)
      : [selectedRoles]
    : ['ALL'];

  if (!activeRoles || activeRoles.length === 0 || activeRoles.includes('ALL')) {
    return true;
  }
  return activeRoles.some((roleId) => cardMatchesRole(c, roleId));
}
