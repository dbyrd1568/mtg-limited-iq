import React, { useState } from 'react';

interface ManaSymbolProps {
  symbol: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-3.5 h-3.5 min-w-[14px] min-h-[14px]',
  sm: 'w-4 h-4 min-w-[16px] min-h-[16px]',
  md: 'w-5 h-5 min-w-[20px] min-h-[20px]',
  lg: 'w-6 h-6 min-w-[24px] min-h-[24px]',
  xl: 'w-8 h-8 min-w-[32px] min-h-[32px]',
};

const TEXT_SIZE_MAP = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-base',
};

/**
 * Transforms MTG mana notation (e.g. "{2/G}", "{W/U}", "{G}", "{2}")
 * into the official WOTC / Scryfall SVG symbol URI.
 */
export function getManaSymbolSvgUrl(rawSymbol: string): string {
  // Strip curly braces and whitespace
  const clean = rawSymbol.replace(/[{}]/g, '').trim().toUpperCase();

  // Strip slashes for hybrid, twobrid, and phyrexian mana (e.g. "2/G" -> "2G", "W/U" -> "WU", "G/P" -> "GP")
  const formatted = clean.replace(/\//g, '');

  return `https://svgs.scryfall.io/card-symbols/${formatted}.svg`;
}

export const ManaSymbol: React.FC<ManaSymbolProps> = ({ symbol, size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const cleanSym = symbol.replace(/[{}]/g, '').toUpperCase();
  const sizeClass = SIZE_MAP[size];
  const textSizeClass = TEXT_SIZE_MAP[size];
  const svgUrl = getManaSymbolSvgUrl(symbol);

  // Fallback styling if SVG fails to load (e.g. offline)
  const getFallbackSymbolStyle = () => {
    switch (cleanSym) {
      case 'W':
        return 'bg-[#f8f6d8] text-[#554a32] border-[#e6e2b8] font-bold';
      case 'U':
        return 'bg-[#0e68ab] text-white border-[#3b93d6] font-bold';
      case 'B':
        return 'bg-[#150b00] text-[#a69f9d] border-[#3b3433] font-bold';
      case 'R':
        return 'bg-[#d3202a] text-white border-[#f35e58] font-bold';
      case 'G':
        return 'bg-[#00733e] text-white border-[#279f65] font-bold';
      case 'C':
        return 'bg-[#ccc2c0] text-[#4d4644] border-[#b0a5a3] font-bold';
      case 'X':
        return 'bg-[#797270] text-white border-[#9c9492] font-bold';
      default:
        return 'bg-[#cbc5c1] text-[#3b3433] border-[#a89f9c] font-bold';
    }
  };

  if (!imgError) {
    return (
      <img
        src={svgUrl}
        alt={cleanSym}
        onError={() => setImgError(true)}
        className={`${sizeClass} inline-block object-contain align-middle drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] select-none shrink-0 ${className}`}
        title={`{${cleanSym}}`}
        loading="lazy"
      />
    );
  }

  // Graceful fallback to styled badge
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border shadow-xs select-none ${sizeClass} ${textSizeClass} ${getFallbackSymbolStyle()} shrink-0 ${className}`}
      title={`{${cleanSym}}`}
    >
      {cleanSym}
    </span>
  );
};

export const ManaCostRenderer: React.FC<{ manaCost?: string; size?: ManaSymbolProps['size']; className?: string }> = ({
  manaCost,
  size = 'md',
  className = '',
}) => {
  if (!manaCost) return null;

  // Split faces by '//' or '/' outside curly braces (so hybrid mana like {W/U} remains intact)
  const faces = manaCost.split(/\s*(?:\/{2,}|\/(?![^{]*\}))\s*/);

  const slashSizeClasses: Record<NonNullable<ManaSymbolProps['size']>, string> = {
    xs: 'text-[11px] leading-none',
    sm: 'text-xs leading-none',
    md: 'text-sm leading-none',
    lg: 'text-base leading-none',
    xl: 'text-lg leading-none',
  };

  return (
    <div className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {faces.map((face, faceIdx) => {
        const matches = face.match(/\{[^}]+\}/g);
        return (
          <React.Fragment key={faceIdx}>
            {faceIdx > 0 && (
              <span className={`font-mono font-bold text-slate-400 dark:text-slate-500 mx-0.5 select-none ${slashSizeClasses[size]}`}>
                /
              </span>
            )}
            {matches ? (
              matches.map((sym, symIdx) => (
                <ManaSymbol key={`${sym}-${faceIdx}-${symIdx}`} symbol={sym} size={size} />
              ))
            ) : face ? (
              <span className="font-mono text-sm text-slate-300">{face}</span>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ManaSymbol;
