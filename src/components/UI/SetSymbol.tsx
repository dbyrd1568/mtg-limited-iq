import React, { useState, useEffect } from 'react';
import { Layers, Sparkles, Crown, Shield } from 'lucide-react';
import { MTGRarity } from '../../types/mtg';
import { PREBUNDLED_SET_SVGS, SetSvgData } from '../../services/setSvgData';

export type SetSymbolRarity = MTGRarity | 'common' | 'uncommon' | 'rare' | 'mythic' | 'bonus' | 'special';

interface SetSymbolProps {
  setCode: string;
  iconSvgUri?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
  rarity?: SetSymbolRarity | string;
}

// Runtime cache for sets fetched dynamically on the fly (beyond the prebundled sets)
const dynamicSvgCache = new Map<string, SetSvgData>();
const pendingFetches = new Map<string, Promise<SetSvgData | null>>();

async function fetchAndParseSetSvg(src: string): Promise<SetSvgData | null> {
  if (dynamicSvgCache.has(src)) return dynamicSvgCache.get(src)!;
  if (pendingFetches.has(src)) return pendingFetches.get(src)!;

  const promise = (async () => {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const text = await res.text();
      const vbMatch = text.match(/viewBox="([^"]+)"/i);
      const viewBox = vbMatch ? vbMatch[1] : '0 0 100 100';
      const innerMatch = text.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      if (!innerMatch) return null;

      // Clean existing fills so parent / group fill applies cleanly
      const innerHtml = innerMatch[1]
        .replace(/\s+fill="[^"]*"/gi, '')
        .replace(/\s+fill:[^;"]+;?/gi, '')
        .trim();

      const parsed: SetSvgData = { viewBox, innerHtml };
      dynamicSvgCache.set(src, parsed);
      return parsed;
    } catch {
      return null;
    } finally {
      pendingFetches.delete(src);
    }
  })();

  pendingFetches.set(src, promise);
  return promise;
}

const RARITY_GRADIENTS: Record<
  string,
  {
    stops: Array<{ offset: string; color: string; opacity?: number }>;
    textClass: string;
    fallback: (sizeCls: string, extraCls: string) => React.ReactNode;
  }
> = {
  mythic: {
    stops: [
      { offset: '0%', color: '#f59e0b' },
      { offset: '40%', color: '#ea580c' },
      { offset: '100%', color: '#dc2626' },
    ],
    textClass: 'text-orange-500',
    fallback: (sizeCls, extraCls) => <Sparkles className={`${sizeCls} ${extraCls} text-orange-500 shrink-0`} />,
  },
  rare: {
    stops: [
      { offset: '0%', color: '#fef08a' },
      { offset: '40%', color: '#f59e0b' },
      { offset: '100%', color: '#b45309' },
    ],
    textClass: 'text-amber-500',
    fallback: (sizeCls, extraCls) => <Crown className={`${sizeCls} ${extraCls} text-amber-500 shrink-0`} />,
  },
  uncommon: {
    stops: [
      { offset: '0%', color: '#e0f2fe' },
      { offset: '40%', color: '#38bdf8' },
      { offset: '100%', color: '#0284c7' },
    ],
    textClass: 'text-cyan-500',
    fallback: (sizeCls, extraCls) => <Layers className={`${sizeCls} ${extraCls} text-cyan-500 shrink-0`} />,
  },
  common: {
    stops: [
      { offset: '0%', color: '#f8fafc' },
      { offset: '45%', color: '#cbd5e1' },
      { offset: '100%', color: '#64748b' },
    ],
    textClass: 'text-slate-400',
    fallback: (sizeCls, extraCls) => <Shield className={`${sizeCls} ${extraCls} text-slate-400 shrink-0`} />,
  },
  bonus: {
    stops: [
      { offset: '0%', color: '#f5d0fe' },
      { offset: '40%', color: '#c084fc' },
      { offset: '100%', color: '#7e22ce' },
    ],
    textClass: 'text-purple-500',
    fallback: (sizeCls, extraCls) => <Sparkles className={`${sizeCls} ${extraCls} text-purple-500 shrink-0`} />,
  },
  special: {
    stops: [
      { offset: '0%', color: '#f5d0fe' },
      { offset: '40%', color: '#c084fc' },
      { offset: '100%', color: '#7e22ce' },
    ],
    textClass: 'text-purple-500',
    fallback: (sizeCls, extraCls) => <Sparkles className={`${sizeCls} ${extraCls} text-purple-500 shrink-0`} />,
  },
};

export const SetSymbol: React.FC<SetSymbolProps> = ({
  setCode,
  iconSvgUri,
  className = '',
  size = 'sm',
  alt,
  rarity,
}) => {
  const code = (setCode || '').toLowerCase().trim();
  const normRarity = rarity ? rarity.toLowerCase().trim() : undefined;
  const src = iconSvgUri || (code ? `https://svgs.scryfall.io/sets/${code}.svg` : '');
  const reactId = React.useId().replace(/:/g, '');

  // Synchronous resolution if pre-bundled in PREBUNDLED_SET_SVGS or cached
  const prebundled = PREBUNDLED_SET_SVGS[code] || (src ? dynamicSvgCache.get(src) : undefined);

  const [svgData, setSvgData] = useState<SetSvgData | null>(prebundled || null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    // If already prebundled for this code, update synchronously
    const ready = PREBUNDLED_SET_SVGS[code] || (src ? dynamicSvgCache.get(src) : undefined);
    if (ready) {
      setSvgData(ready);
      setLoadFailed(false);
      return;
    }

    if (!src) {
      setSvgData(null);
      setLoadFailed(true);
      return;
    }

    let isMounted = true;
    fetchAndParseSetSvg(src).then((data) => {
      if (!isMounted) return;
      if (data) {
        setSvgData(data);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [code, src]);

  const sizeCls = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  }[size];

  const rarityConfig = normRarity ? (RARITY_GRADIENTS[normRarity] || RARITY_GRADIENTS.common) : undefined;

  // Fallback while loading unknown sets or on error
  if (!svgData || loadFailed) {
    if (rarityConfig) {
      return rarityConfig.fallback(sizeCls, className);
    }
    return (
      <img
        src={src}
        alt={alt || `${setCode} set symbol`}
        onError={() => setLoadFailed(true)}
        className={`${sizeCls} ${className} object-contain dark:filter dark:invert opacity-90 hover:opacity-100 transition-opacity shrink-0 inline-block`}
        loading="lazy"
      />
    );
  }

  // Non-rarity display (e.g. Set dropdown, Navbar, Search chips)
  if (!rarityConfig) {
    return (
      <svg
        viewBox={svgData.viewBox}
        className={`${sizeCls} ${className} shrink-0 inline-block overflow-visible`}
        fill="currentColor"
        role="img"
        aria-label={alt || `${setCode.toUpperCase()} set symbol`}
      >
        <g dangerouslySetInnerHTML={{ __html: svgData.innerHtml }} />
      </svg>
    );
  }

  // Authentic MTG Rarity Gradient with crisp outline & shadow
  const gradId = `set-grad-${code || 'mtg'}-${normRarity}-${reactId}`;

  return (
    <svg
      viewBox={svgData.viewBox}
      className={`${sizeCls} ${className} shrink-0 inline-block overflow-visible drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.5)]`}
      role="img"
      aria-label={alt || `${setCode.toUpperCase()} ${normRarity} set symbol`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          {rarityConfig.stops.map((stop, i) => (
            <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity ?? 1} />
          ))}
        </linearGradient>
      </defs>
      <g
        fill={`url(#${gradId})`}
        dangerouslySetInnerHTML={{ __html: svgData.innerHtml }}
      />
    </svg>
  );
};

interface SetBadgeProps {
  setCode: string;
  iconSvgUri?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  suffix?: string;
  rarity?: SetSymbolRarity | string;
}

export const SetBadge: React.FC<SetBadgeProps> = ({
  setCode,
  iconSvgUri,
  className = '',
  size = 'sm',
  suffix,
  rarity,
}) => {
  const code = (setCode || '').toUpperCase();

  return (
    <span
      className={`font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-cyan-500/30 flex items-center gap-1.5 shadow-xs shrink-0 ${className}`}
      title={`${code} MTG Set`}
    >
      <SetSymbol setCode={code} iconSvgUri={iconSvgUri} size={size === 'md' ? 'md' : size === 'xs' ? 'xs' : 'sm'} rarity={rarity} />
      <span className="font-black">{code}</span>
      {suffix && <span className="text-slate-700 dark:text-slate-300 font-semibold">{suffix}</span>}
    </span>
  );
};
