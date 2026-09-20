import React, { useState } from 'react';
import { Card, CardObfuscationConfig } from '../types/mtg';
import { RotateCw, Sparkles, EyeOff } from 'lucide-react';
import { CardImage } from './UI/CardImage';
import { ManaCostRenderer } from './UI/ManaSymbol';

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

  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  return (
    <div className={`relative flex flex-col items-center justify-center select-none max-w-full max-h-full min-h-0 ${className}`}>
      {/* Card Outer Container */}
      <div
        style={{
          width: `min(${sizeConfig.maxW}px, 100%, 100cqw, calc(100cqh * 63 / 88))`,
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
