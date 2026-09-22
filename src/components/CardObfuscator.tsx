import React, { useState } from 'react';
import { Card, CardObfuscationConfig, MTGColor } from '../types/mtg';
import { RotateCw, Sparkles, EyeOff } from 'lucide-react';
import { CardImage } from './UI/CardImage';
import { ManaCostRenderer, ManaSymbol } from './UI/ManaSymbol';

/**
 * Extracts self-referential name patterns for a card (full name, shortened legendary name, possessives).
 */
export function getCardSelfReferentialNames(cardName?: string, typeLine?: string): string[] {
  if (!cardName) return [];
  const patterns = new Set<string>();
  const cleanName = cardName.trim();
  patterns.add(cleanName);

  // Strip DFC separator if present
  if (cleanName.includes(' // ')) {
    cleanName.split(' // ').forEach(part => {
      const p = part.trim();
      if (p.length >= 3) patterns.add(p);
    });
  }

  // Strip comma (e.g. "Teyo, Diamondblade Mage" -> "Teyo")
  if (cleanName.includes(',')) {
    const primary = cleanName.split(',')[0].trim();
    if (primary.length >= 3) {
      patterns.add(primary);
    }
  }

  // If legendary or planeswalker, often referred to by first word (e.g. "Fblthp the Lost" -> "Fblthp")
  const isLegendary = (typeLine || '').includes('Legendary') || (typeLine || '').includes('Planeswalker');
  if (isLegendary) {
    const firstWord = cleanName.split(/[\s,]+/)[0].trim();
    const commonTitles = ['The', 'Lord', 'Lady', 'Saint', 'Sir', 'Baron', 'Count', 'King', 'Queen', 'Master'];
    if (firstWord.length >= 3 && !commonTitles.includes(firstWord)) {
      patterns.add(firstWord);
    }
  }

  // Include possessive forms ("Teyo's", "Teyo’s")
  const result: string[] = [];
  patterns.forEach(p => {
    result.push(p);
    result.push(`${p}'s`);
    result.push(`${p}’s`);
  });

  // Sort descending by length so longer patterns match first
  return result.sort((a, b) => b.length - a.length);
}

/**
 * Checks if the oracle rules text contains any self-referential name patterns.
 */
export function oracleContainsCardName(oracleText?: string, namePatterns: string[] = []): boolean {
  if (!oracleText || namePatterns.length === 0) return false;
  return namePatterns.some(pat => {
    const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(oracleText);
  });
}

/**
 * Returns frame background and border styles for text box overlays matching card colors.
 */
export function getFrameTextboxStyle(colors?: MTGColor[]) {
  if (!colors || colors.length === 0 || (colors.length === 1 && colors[0] === 'C')) {
    return {
      bg: 'bg-[#deddd9]/95 dark:bg-[#1a1c24]/95',
      border: 'border-slate-400/50 dark:border-slate-700/70',
      text: 'text-slate-900 dark:text-slate-100',
    };
  }
  if (colors.length > 1) {
    return {
      bg: 'bg-[#f4eedd]/95 dark:bg-[#201c14]/95',
      border: 'border-amber-500/50 dark:border-amber-700/60',
      text: 'text-amber-950 dark:text-amber-100',
    };
  }
  switch (colors[0]) {
    case 'W':
      return {
        bg: 'bg-[#f7f3ea]/95 dark:bg-[#24211b]/95',
        border: 'border-amber-300/60 dark:border-amber-700/60',
        text: 'text-stone-900 dark:text-stone-100',
      };
    case 'U':
      return {
        bg: 'bg-[#eaf1f7]/95 dark:bg-[#141e28]/95',
        border: 'border-blue-300/60 dark:border-blue-700/60',
        text: 'text-slate-900 dark:text-slate-100',
      };
    case 'B':
      return {
        bg: 'bg-[#e0dfdc]/95 dark:bg-[#181a22]/95',
        border: 'border-stone-500/60 dark:border-stone-700/70',
        text: 'text-neutral-900 dark:text-neutral-100',
      };
    case 'R':
      return {
        bg: 'bg-[#f7ece8]/95 dark:bg-[#251816]/95',
        border: 'border-red-300/60 dark:border-red-800/60',
        text: 'text-stone-900 dark:text-stone-100',
      };
    case 'G':
      return {
        bg: 'bg-[#edf4eb]/95 dark:bg-[#152216]/95',
        border: 'border-emerald-300/60 dark:border-emerald-800/60',
        text: 'text-stone-900 dark:text-stone-100',
      };
    default:
      return {
        bg: 'bg-[#deddd9]/95 dark:bg-[#1a1c24]/95',
        border: 'border-slate-400/50 dark:border-slate-700/70',
        text: 'text-slate-900 dark:text-slate-100',
      };
  }
}

/**
 * Tokenizes oracle text and replaces occurrences of self-referential card names with a [Concealed] badge.
 */
export function tokenizeAndSanitizeOracleText(
  text: string,
  namePatterns: string[],
  size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'lg'
): React.ReactNode[] {
  if (!text) return [];

  const escapedPatterns = namePatterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const combinedRegex = new RegExp(`(\\{[^}]+\\}|\\([^)]+\\)|\\b(?:${escapedPatterns})\\b)`, 'gi');

  const parts = text.split(combinedRegex);
  const nameSet = new Set(namePatterns.map(p => p.toLowerCase()));

  const pillSizeClass =
    size === 'sm'
      ? 'text-[7px] px-1 py-0.2'
      : size === 'md'
      ? 'text-[8px] px-1.5 py-0.2'
      : size === '2xl'
      ? 'text-[10px] px-2 py-0.5'
      : 'text-[8.5px] px-1.5 py-0.2';

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('{') && part.endsWith('}')) {
      return (
        <span key={idx} className="inline-block mx-0.5 align-middle">
          <ManaSymbol symbol={part} size="xs" />
        </span>
      );
    }

    if (part.startsWith('(') && part.endsWith(')')) {
      return (
        <span key={idx} className="italic opacity-70">
          {part}
        </span>
      );
    }

    if (nameSet.has(part.toLowerCase())) {
      return (
        <span
          key={idx}
          className={`inline-flex items-center gap-0.5 mx-0.5 rounded bg-[#050818] text-cyan-300 font-mono font-bold border border-cyan-400/50 shadow-xs align-baseline select-none ${pillSizeClass}`}
          title="Card name concealed for quiz deduction"
        >
          <EyeOff className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
          <span>[Concealed]</span>
        </span>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

interface CardObfuscatorProps {
  card: Card;
  obfuscation?: CardObfuscationConfig;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showDetailsOnHover?: boolean;
  className?: string;
  allowManualPeek?: boolean;
  showSublabel?: boolean;
}

const SIZE_CONFIGS = {
  sm: { maxW: 185, maxH: 258 },
  md: { maxW: 245, maxH: 342 },
  lg: { maxW: 305, maxH: 426 },
  xl: { maxW: 345, maxH: 482 },
  '2xl': { maxW: 410, maxH: 572 },
};

export const CardObfuscator: React.FC<CardObfuscatorProps> = ({
  card,
  obfuscation = { target: 'none', style: 'blur', isRevealed: false },
  size = 'lg',
  className = '',
  showSublabel = true,
}) => {
  const [faceIndex, setFaceIndex] = useState<number>(0);

  if (!card) return null;

  // Only true double-faced cards (Transform, Modal DFC) with separate front & back images can be flipped
  const isTransformCard = Boolean(
    card?.card_faces &&
    card.card_faces.length > 1 &&
    card.card_faces[0]?.image_uris?.normal &&
    card.card_faces[1]?.image_uris?.normal
  );
  const currentFace = isTransformCard && card.card_faces ? card.card_faces[faceIndex] : null;
  const activeCardData = currentFace ? { ...card, ...currentFace } : card;

  const artCropUri = currentFace?.image_uris?.art_crop ||
    card.image_uris?.art_crop ||
    currentFace?.image_uris?.normal ||
    card?.image_uris?.normal;

  const isArtOnly = obfuscation.target === 'art_only';
  const isMasked = obfuscation.target !== 'none' && !obfuscation.isRevealed;
  const isManaCostMasked = (obfuscation.target === 'mana_cost' || obfuscation.target === 'name_and_cost') && !obfuscation.isRevealed;

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'mythic':
        return 'border-orange-500/80 shadow-[0_0_30px_rgba(255,77,46,0.45)] ring-1 ring-orange-400/40';
      case 'rare':
        return 'border-amber-400/80 shadow-[0_0_25px_rgba(251,191,36,0.4)] ring-1 ring-amber-300/30';
      case 'uncommon':
        return 'border-cyan-400/70 shadow-[0_0_20px_rgba(6,182,212,0.35)] ring-1 ring-cyan-300/30';
      default:
        return 'border-violet-900/40 shadow-md shadow-black/60';
    }
  };

  const getMaskStyle = (style: string) => {
    switch (style) {
      case 'whiteout':
        return 'bg-slate-100/95 text-slate-900 border-2 border-dashed border-slate-400 font-mono';
      case 'blackout':
        return 'bg-[#050818]/95 text-cyan-200 border border-violet-500/50 font-mono';
      case 'scratch':
        return 'backdrop-blur-xl bg-violet-950/85 border border-cyan-400/50 text-cyan-200';
      default:
        // Arcane blur
        return 'backdrop-blur-md bg-[#070b22]/85 border border-violet-400/40 text-violet-200 shadow-inner';
    }
  };

  const renderObfuscationOverlay = () => {
    if (obfuscation.target === 'none' || isArtOnly || obfuscation.isRevealed || !isMasked) {
      return null;
    }

    let positionStyles: string = '';
    let label = obfuscation.customOverlayText || 'HIDDEN';

    switch (obfuscation.target) {
      case 'mana_cost':
        positionStyles = 'top-[3.2%] right-[3.8%] w-[42%] h-[6.8%] rounded-sm';
        label = obfuscation.customOverlayText || '??? Mana';
        break;
      case 'name_and_cost':
        positionStyles = 'top-[3.0%] left-[3.5%] right-[3.5%] w-[93%] h-[7.2%] rounded-sm';
        label = obfuscation.customOverlayText || '??? [Name & Mana Concealed]';
        break;
      case 'type_line':
        positionStyles = 'top-[54.8%] left-[3.5%] right-[3.5%] w-[93%] h-[6.2%] rounded-sm';
        label = obfuscation.customOverlayText || '??? [Type Line Concealed]';
        break;
      case 'oracle_text':
        positionStyles = 'top-[62.0%] left-[4.5%] right-[4.5%] w-[91%] bottom-[7.5%] h-[30.5%] rounded-md';
        label = obfuscation.customOverlayText || '??? [Rules & Ability Text Concealed]';
        break;
      case 'power_toughness':
        positionStyles = 'bottom-[2.8%] right-[3.8%] w-[25%] h-[7.2%] rounded-sm';
        label = obfuscation.customOverlayText || '? / ?';
        break;
    }

    return (
      <div
        className={`absolute ${positionStyles} z-20 transition-all duration-300 flex flex-col items-center justify-center p-1 text-center shadow-xl ${getMaskStyle(obfuscation.style)}`}
      >
        <span className="text-[11px] font-bold tracking-wider uppercase drop-shadow flex items-center gap-1">
          <EyeOff className="w-3 h-3 text-cyan-400 animate-pulse" />
          {label}
        </span>
      </div>
    );
  };

  const renderSanitizedOracleOverlay = () => {
    if (!isMasked || obfuscation.isRevealed) {
      return null;
    }
    // Only sanitize rules text when the card's name is concealed
    if (obfuscation.target !== 'name_and_cost' && (obfuscation.target as string) !== 'name') {
      return null;
    }

    const oracleText = activeCardData.oracle_text || card.oracle_text;
    if (!oracleText || !oracleText.trim()) {
      return null;
    }

    const cardName = activeCardData.name || card.name || '';
    const typeLine = activeCardData.type_line || card.type_line || '';
    const namePatterns = getCardSelfReferentialNames(cardName, typeLine);
    if (!oracleContainsCardName(oracleText, namePatterns)) {
      return null;
    }

    const frameStyle = getFrameTextboxStyle(activeCardData.colors || card.colors);
    const hasPT = Boolean(
      (activeCardData.power !== undefined && activeCardData.toughness !== undefined) ||
      (card.power !== undefined && card.toughness !== undefined)
    );
    const power = activeCardData.power ?? card.power;
    const toughness = activeCardData.toughness ?? card.toughness;

    const fontSizeClass =
      size === 'sm'
        ? 'text-[7px] sm:text-[7.5px] leading-tight'
        : size === 'md'
        ? 'text-[8px] sm:text-[8.5px] leading-tight'
        : size === '2xl'
        ? 'text-[11px] sm:text-[12px] leading-relaxed'
        : 'text-[9px] sm:text-[9.5px] leading-snug';

    return (
      <>
        {/* Sanitized Oracle Text Box Overlay */}
        <div
          className={`absolute top-[61.6%] left-[4.5%] right-[4.5%] w-[91%] h-[30.4%] z-20 rounded-[5px] border ${frameStyle.bg} ${frameStyle.border} ${frameStyle.text} shadow-md p-1.5 sm:p-2 overflow-y-auto custom-scrollbar flex flex-col justify-between select-none animate-in fade-in duration-200`}
        >
          <div className={`space-y-0.5 sm:space-y-1 text-left ${hasPT ? 'pr-[20%]' : ''}`}>
            {oracleText.split('\n').map((para, pIdx) => (
              <p key={pIdx} className={`${fontSizeClass} font-sans`}>
                {tokenizeAndSanitizeOracleText(para, namePatterns, size)}
              </p>
            ))}
          </div>

          <div className="flex items-center justify-between text-[7px] sm:text-[7.5px] font-mono opacity-65 pt-0.5 mt-auto border-t border-black/10 dark:border-white/10">
            <span className="flex items-center gap-1">
              <EyeOff className="w-2.5 h-2.5 text-cyan-500" />
              <span>Name concealed in rules text</span>
            </span>
          </div>
        </div>

        {/* Crisp Power / Toughness badge re-anchored on top if creature */}
        {hasPT && (
          <div className="absolute bottom-[2.5%] right-[3.8%] z-30 px-2 py-0.5 rounded-md bg-[#deddd9] dark:bg-[#181a24] border border-slate-700/80 font-mono font-black text-[10.5px] sm:text-xs text-slate-900 dark:text-white shadow-md">
            {power}/{toughness}
          </div>
        )}
      </>
    );
  };

  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  return (
    <div className={`relative flex flex-col items-center justify-center select-none max-w-full max-h-full min-h-0 ${className}`}>
      {/* Card Outer Container */}
      <div
        style={{
          width: `min(${sizeConfig.maxW}px, 100%)`,
          aspectRatio: '63 / 88',
          maxHeight: '100%',
          maxWidth: '100%',
        }}
        className={`relative rounded-[16px] overflow-hidden border-2 transition-all duration-300 bg-[#070a1c] card-foil-sheen shrink-0 ${getRarityGlow(card.rarity)}`}
      >
        {/* Art Only Mask Mode */}
        {isArtOnly && !obfuscation.isRevealed ? (
          <div className="relative w-full h-full flex flex-col bg-[#050818] p-2">
            <div className="relative w-full h-full rounded-xl overflow-hidden border border-violet-500/40 shadow-inner">
              <CardImage
                card={activeCardData}
                src={artCropUri}
                alt={card.name}
                className="w-full h-full"
                imageClassName="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                loading="eager"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#050818] via-[#050818]/80 to-transparent p-2 text-center pointer-events-none z-10">
                <span className="text-xs font-bold text-cyan-300 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Recognize this artwork?
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Full Card Art with Mask Overlays */
          <div className="relative w-full h-full rounded-[4.75%/3.4%] overflow-hidden">
            <CardImage
              card={activeCardData}
              src={currentFace?.image_uris?.png || card?.image_uris?.png || currentFace?.image_uris?.normal || card?.image_uris?.normal}
              alt={card.name}
              className="w-full h-full"
              imageClassName="w-full h-full object-contain rounded-[4.75%/3.4%]"
              loading="eager"
            />

            {/* Targeted Obfuscation Mask */}
            {renderObfuscationOverlay()}

            {/* Sanitized Oracle Text Overlay (covers card name in rules text) */}
            {renderSanitizedOracleOverlay()}
          </div>
        )}

        {/* Dual Face Flip Control Button (Only for actual two-sided transform/modal cards) */}
        {isTransformCard && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFaceIndex(prev => (prev === 0 ? 1 : 0));
            }}
            className="absolute top-2.5 right-2.5 z-30 bg-[#06091d]/90 hover:bg-[#0e1438] border border-violet-400/60 text-cyan-300 p-1.5 rounded-full shadow-xl transition-all cursor-pointer hover:scale-110"
            title={`Transform card (Showing face ${faceIndex + 1} of 2)`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Rarity & Collector Info Sub-label */}
      {showSublabel && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono shrink-0 flex-wrap">
          {card.collector_number && (
            <span className="font-bold text-slate-400 dark:text-slate-400">
              #{card.collector_number}
            </span>
          )}
          <span className="uppercase font-bold text-cyan-300 bg-[#06091d] px-1.5 py-0.2 rounded border border-violet-500/30">
            {card.set}
          </span>
          <span>•</span>
          <span className="capitalize text-slate-300">{card.rarity}</span>
          {!isManaCostMasked && (activeCardData.mana_cost || card.mana_cost) && (
            <>
              <span>•</span>
              <ManaCostRenderer manaCost={activeCardData.mana_cost || card.mana_cost} size="xs" />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CardObfuscator;
