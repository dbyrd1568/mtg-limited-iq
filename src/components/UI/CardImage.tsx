import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, MTGColor } from '../../types/mtg';
import { ManaCostRenderer, ManaSymbol } from './ManaSymbol';
import { SetSymbol } from './SetSymbol';
import { Swords, Zap, Sparkles, Shield, Layers, Mountain, Flame, Loader2 } from 'lucide-react';
import { POPULAR_LIMITED_SETS } from '../../services/scryfall';

export interface CardImageProps {
  card: Partial<Card> & { name: string };
  src?: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  loading?: 'lazy' | 'eager';
  showProxyFallback?: boolean;
  onLoaded?: () => void;
  onError?: () => void;
}

// Module-level Scryfall CDN failure tracking
let scryfallFailureCount = 0;
let scryfallLastFailure = 0;
let scryfallCdnOffline = false;
let scryfallCdnOfflineSince = 0;

export function markScryfallCdnOffline() {
  const now = Date.now();
  if (now - scryfallLastFailure > 10000) {
    scryfallFailureCount = 1;
  } else {
    scryfallFailureCount++;
  }
  scryfallLastFailure = now;

  // Only activate global circuit breaker if at least 5 different image requests fail within 10 seconds
  if (scryfallFailureCount >= 5 && !scryfallCdnOffline) {
    console.warn('[CardImage] Scryfall CDN failure cluster detected. Circuit breaker active: routing to Gatherer / MTG Proxy fallback.');
    scryfallCdnOffline = true;
    scryfallCdnOfflineSince = now;
  }
}

export function isScryfallCdnOffline(): boolean {
  if (!scryfallCdnOffline) return false;
  // Re-probe Scryfall CDN after 3 minutes
  if (Date.now() - scryfallCdnOfflineSince > 3 * 60 * 1000) {
    scryfallCdnOffline = false;
    scryfallFailureCount = 0;
    return false;
  }
  return true;
}

/**
 * Checks if a set is unreleased (spoiler / preview).
 * Gatherer ONLY contains physically released cards, so unreleased sets must never query Gatherer.
 */
export function isUnreleasedSet(setCode?: string): boolean {
  if (!setCode) return false;
  const upper = setCode.toUpperCase().trim();
  if (['FRA', 'TRK', 'MBC'].includes(upper)) return true;
  const known = POPULAR_LIMITED_SETS.find(s => s.code.toUpperCase() === upper);
  if (known && known.released_at) {
    const releaseTime = new Date(known.released_at).getTime();
    if (!isNaN(releaseTime) && releaseTime > Date.now()) {
      return true;
    }
  }
  return false;
}

/**
 * Builds a prioritized cascade of fallback image URLs for any MTG card.
 * Respects the Scryfall CDN circuit breaker and skips unreleased sets on Gatherer.
 */
export function getCardImageCandidateUrls(card: Partial<Card>, customSrc?: string): string[] {
  const urls: string[] = [];
  const cdnOffline = isScryfallCdnOffline();

  // 1. Explicitly provided customSrc (if not from a dead CDN)
  if (customSrc && typeof customSrc === 'string' && customSrc.trim() && !customSrc.includes('back.jpg')) {
    if (!cdnOffline || !customSrc.includes('cards.scryfall.io')) {
      urls.push(customSrc.trim());
    }
  }

  // 2. Primary Scryfall URIs (normal -> large -> small)
  if (!cdnOffline) {
    const normalUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
    const largeUrl = card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large;
    const smallUrl = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small;

    if (normalUrl && !urls.includes(normalUrl)) urls.push(normalUrl);
    if (largeUrl && !urls.includes(largeUrl)) urls.push(largeUrl);
    if (smallUrl && !urls.includes(smallUrl)) urls.push(smallUrl);
  }

  // 3. Official Gatherer Image (ONLY for released sets; Gatherer has no spoiled cards)
  const isUnreleased = isUnreleasedSet(card.set);
  if (!isUnreleased && card.name) {
    const rawName = card.name.trim();
    const cleanFrontName = rawName.replace(/^A-/, '').split(' // ')[0].trim();
    urls.push(`https://gatherer.wizards.com/Handlers/Image.ashx?type=card&name=${encodeURIComponent(cleanFrontName)}`);
    if (rawName !== cleanFrontName) {
      urls.push(`https://gatherer.wizards.com/Handlers/Image.ashx?type=card&name=${encodeURIComponent(rawName.replace(/^A-/, '').trim())}`);
    }
  }

  // Deduplicate while maintaining priority order
  return Array.from(new Set(urls.filter(Boolean)));
}

/**
 * Returns frame color classes and styling based on card colors.
 */
function getCardFrameStyling(colors?: MTGColor[]) {
  if (!colors || colors.length === 0 || (colors.length === 1 && colors[0] === 'C')) {
    return {
      border: 'border-slate-400/60 dark:border-slate-600',
      bgGradient: 'from-slate-700 via-slate-800 to-slate-900',
      text: 'text-slate-100',
      barBg: 'bg-slate-800/95 border-slate-600/60 text-slate-100',
      boxBg: 'bg-slate-900/90 border-slate-700 text-slate-200',
      accent: 'text-slate-300',
    };
  }

  if (colors.length > 1) {
    // Gold / Multicolor
    return {
      border: 'border-amber-400/70 dark:border-amber-500/60',
      bgGradient: 'from-amber-900/90 via-amber-950 to-stone-950',
      text: 'text-amber-100',
      barBg: 'bg-amber-950/95 border-amber-500/50 text-amber-100',
      boxBg: 'bg-[#18120b]/90 border-amber-600/40 text-amber-100',
      accent: 'text-amber-400',
    };
  }

  switch (colors[0]) {
    case 'W':
      return {
        border: 'border-amber-200/80 dark:border-amber-300/60',
        bgGradient: 'from-[#f5f2e8] via-[#e6dfcc] to-[#cfc6af] dark:from-[#2d2820] dark:via-[#1e1a14] dark:to-[#12100c]',
        text: 'text-amber-950 dark:text-amber-100',
        barBg: 'bg-[#faf8f2]/95 dark:bg-[#252018]/95 border-amber-300/60 dark:border-amber-600/40 text-amber-950 dark:text-amber-100',
        boxBg: 'bg-[#f8f6ee]/90 dark:bg-[#1a1712]/90 border-amber-200/70 dark:border-amber-800/50 text-amber-950 dark:text-amber-100',
        accent: 'text-amber-600 dark:text-amber-300',
      };
    case 'U':
      return {
        border: 'border-blue-400/80 dark:border-blue-500/60',
        bgGradient: 'from-blue-900 via-indigo-950 to-slate-950',
        text: 'text-blue-100',
        barBg: 'bg-blue-950/95 border-blue-500/60 text-blue-100',
        boxBg: 'bg-slate-950/90 border-blue-600/40 text-blue-100',
        accent: 'text-cyan-400',
      };
    case 'B':
      return {
        border: 'border-neutral-700 dark:border-neutral-700',
        bgGradient: 'from-neutral-900 via-stone-950 to-black',
        text: 'text-neutral-200',
        barBg: 'bg-neutral-950/95 border-neutral-700 text-neutral-200',
        boxBg: 'bg-black/90 border-neutral-800 text-neutral-300',
        accent: 'text-violet-400',
      };
    case 'R':
      return {
        border: 'border-red-500/80 dark:border-red-600/60',
        bgGradient: 'from-red-950 via-rose-950 to-neutral-950',
        text: 'text-red-100',
        barBg: 'bg-red-950/95 border-red-500/60 text-red-100',
        boxBg: 'bg-neutral-950/90 border-red-700/40 text-red-100',
        accent: 'text-rose-400',
      };
    case 'G':
      return {
        border: 'border-emerald-500/80 dark:border-emerald-600/60',
        bgGradient: 'from-emerald-950 via-green-950 to-slate-950',
        text: 'text-emerald-100',
        barBg: 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100',
        boxBg: 'bg-slate-950/90 border-emerald-700/40 text-emerald-100',
        accent: 'text-emerald-400',
      };
    default:
      return {
        border: 'border-slate-400/60 dark:border-slate-600',
        bgGradient: 'from-slate-700 via-slate-800 to-slate-900',
        text: 'text-slate-100',
        barBg: 'bg-slate-800/95 border-slate-600/60 text-slate-100',
        boxBg: 'bg-slate-900/90 border-slate-700 text-slate-200',
        accent: 'text-slate-300',
      };
  }
}

/**
 * Returns an appropriate icon based on card type.
 */
function getCardTypeIcon(typeLine: string) {
  const lower = typeLine.toLowerCase();
  if (lower.includes('creature')) return <Swords className="w-5 h-5 opacity-60" />;
  if (lower.includes('instant') || lower.includes('flash')) return <Zap className="w-5 h-5 opacity-60" />;
  if (lower.includes('sorcery')) return <Sparkles className="w-5 h-5 opacity-60" />;
  if (lower.includes('enchantment')) return <Shield className="w-5 h-5 opacity-60" />;
  if (lower.includes('artifact')) return <Layers className="w-5 h-5 opacity-60" />;
  if (lower.includes('land')) return <Mountain className="w-5 h-5 opacity-60" />;
  return <Flame className="w-5 h-5 opacity-60" />;
}

/**
 * Formats oracle text with inline mana symbols and italicized reminder text.
 */
function renderOracleTextContent(oracleText?: string) {
  if (!oracleText) {
    return <span className="text-slate-400 italic text-[9px]">No rules text.</span>;
  }

  const paragraphs = oracleText.split('\n');

  return (
    <div className="space-y-0.5 text-left leading-tight">
      {paragraphs.map((para, pIdx) => {
        const parts = para.split(/(\{[^}]+\}|\([^)]+\))/g);
        return (
          <p key={pIdx} className="text-[8.5px] sm:text-[9.5px]">
            {parts.map((part, partIdx) => {
              if (part.startsWith('{') && part.endsWith('}')) {
                return (
                  <span key={partIdx} className="inline-block mx-0.5 align-middle">
                    <ManaSymbol symbol={part} size="xs" />
                  </span>
                );
              }
              if (part.startsWith('(') && part.endsWith(')')) {
                return (
                  <span key={partIdx} className="italic opacity-70">
                    {part}
                  </span>
                );
              }
              return <span key={partIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Renders an authentic, stylish MTG Card Proxy Frame when card images are offline or unavailable.
 * Proportioned to look sharp at compact size (e.g. 185x258) as well as full view.
 */
export const CardProxyFallback: React.FC<{ card: Partial<Card> & { name: string }; className?: string }> = ({
  card,
  className = '',
}) => {
  const styling = useMemo(() => getCardFrameStyling(card.colors), [card.colors]);
  const typeIcon = useMemo(() => getCardTypeIcon(card.type_line || ''), [card.type_line]);
  const hasPT = Boolean(card.power !== undefined && card.toughness !== undefined);

  return (
    <div
      className={`relative w-full h-full rounded-2xl overflow-hidden border-2 bg-gradient-to-b ${styling.bgGradient} ${styling.border} ${styling.text} flex flex-col p-2 select-none shadow-md ${className}`}
    >
      {/* 1. Header Bar: Name & Mana Cost */}
      <div
        className={`px-1.5 py-0.5 rounded-lg border flex items-center justify-between gap-1 shadow-xs ${styling.barBg} mb-1`}
      >
        <span className="font-heading font-black text-[10.5px] sm:text-xs truncate tracking-tight">
          {card.name}
        </span>
        {card.mana_cost && (
          <div className="shrink-0 scale-85 origin-right">
            <ManaCostRenderer manaCost={card.mana_cost} size="xs" />
          </div>
        )}
      </div>

      {/* 2. Art Pane: Card Type Icon & Themed Visual Watermark */}
      <div className="relative w-full h-[26%] sm:h-[30%] rounded-md overflow-hidden border border-black/30 dark:border-white/10 bg-black/20 flex flex-col items-center justify-center mb-1 shadow-inner shrink-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none" />
        <div className="flex flex-col items-center gap-0.5 z-10">
          <div className={`${styling.accent} drop-shadow-md`}>{typeIcon}</div>
          <span className="text-[8px] font-mono uppercase tracking-wider opacity-60 font-semibold">
            {card.set ? `${card.set.toUpperCase()} Preview` : 'Card Preview'}
          </span>
        </div>
      </div>

      {/* 3. Type Line Bar: Type & Set Symbol */}
      <div
        className={`px-1.5 py-0.5 rounded-md border flex items-center justify-between gap-1 shadow-xs ${styling.barBg} mb-1 text-[9px] sm:text-[10px] font-semibold shrink-0`}
      >
        <span className="truncate">{card.type_line || 'Card'}</span>
        <div className="flex items-center gap-1 shrink-0">
          {card.set && <SetSymbol setCode={card.set} size="xs" />}
          <span className="capitalize text-[8px] opacity-75 font-mono">
            {card.rarity ? card.rarity[0].toUpperCase() : ''}
          </span>
        </div>
      </div>

      {/* 4. Oracle Rules Text Box */}
      <div
        className={`flex-1 overflow-y-auto rounded-md border p-1.5 shadow-inner ${styling.boxBg} relative custom-scrollbar flex flex-col justify-between`}
      >
        <div className="w-full">
          {renderOracleTextContent(card.oracle_text)}
        </div>

        {/* 5. Power / Toughness Badge */}
        {hasPT && (
          <div className="self-end mt-1 pt-0.5">
            <div
              className={`px-1.5 py-0.2 rounded border shadow-sm font-mono font-black text-[10px] sm:text-xs tracking-wider ${styling.barBg}`}
            >
              {card.power}/{card.toughness}
            </div>
          </div>
        )}
      </div>

      {/* 6. Micro Collector Footer */}
      <div className="mt-0.5 flex items-center justify-between text-[7.5px] font-mono opacity-50 px-0.5 shrink-0">
        <span>
          {card.set ? card.set.toUpperCase() : 'MTG'} • #{card.collector_number || '000'}
        </span>
        <span className="capitalize">{card.rarity || 'common'}</span>
      </div>
    </div>
  );
};

/**
 * Universal Card Image with multi-layer fallback & graceful MTG proxy rendering.
 * Stable identity prevents reset loops on parent re-renders.
 */
export const CardImage: React.FC<CardImageProps> = ({
  card,
  src,
  alt,
  className = '',
  imageClassName = '',
  loading = 'eager',
  showProxyFallback = true,
  onLoaded,
  onError,
}) => {
  const cardKey = `${card?.id || ''}_${card?.name || ''}_${card?.set || ''}_${src || ''}`;
  const candidateUrls = useMemo(() => getCardImageCandidateUrls(card, src), [cardKey]);

  const [sourceIdx, setSourceIdx] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasFailedAllSources, setHasFailedAllSources] = useState<boolean>(false);
  const currentKeyRef = useRef(cardKey);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Only reset when card identity changes, NOT on every re-render!
  useEffect(() => {
    if (currentKeyRef.current !== cardKey) {
      currentKeyRef.current = cardKey;
      setSourceIdx(0);
      setIsLoaded(false);
      setHasFailedAllSources(candidateUrls.length === 0);
    } else if (candidateUrls.length === 0 && !hasFailedAllSources) {
      setHasFailedAllSources(true);
    }
  }, [cardKey, candidateUrls.length, hasFailedAllSources]);

  const currentUrl = candidateUrls[sourceIdx];

  const handleImageError = useCallback(() => {
    if (currentUrl && currentUrl.includes('cards.scryfall.io')) {
      markScryfallCdnOffline();
    }

    if (sourceIdx < candidateUrls.length - 1) {
      setSourceIdx(prev => prev + 1);
      setIsLoaded(false);
    } else {
      setHasFailedAllSources(true);
      setIsLoaded(true);
      if (onError) onError();
    }
  }, [currentUrl, sourceIdx, candidateUrls.length, onError]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
    if (onLoaded) onLoaded();
  }, [onLoaded]);

  // Callback ref: Instantly detects when a cached image has already downloaded upon DOM attachment
  const setImgRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    if (node && node.complete) {
      if (node.naturalWidth > 0) {
        setIsLoaded(true);
        if (onLoaded) onLoaded();
      } else if (node.src) {
        handleImageError();
      }
    }
  }, [onLoaded, handleImageError]);

  // Effect to re-verify img.complete whenever currentUrl changes
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      if (img.naturalWidth > 0) {
        setIsLoaded(true);
        if (onLoaded) onLoaded();
      } else if (img.src) {
        handleImageError();
      }
    }
  }, [currentUrl, onLoaded, handleImageError]);

  // Watchdog Timer: Never allow any image to remain in loading state forever (max 3.5s)
  useEffect(() => {
    if (isLoaded || hasFailedAllSources) return;

    const timer = setTimeout(() => {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setIsLoaded(true);
        if (onLoaded) onLoaded();
      } else if (sourceIdx < candidateUrls.length - 1) {
        setSourceIdx(prev => prev + 1);
      } else {
        // All sources timed out: gracefully show proxy card fallback
        setHasFailedAllSources(true);
        setIsLoaded(true);
        if (onError) onError();
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [isLoaded, hasFailedAllSources, sourceIdx, candidateUrls.length, onLoaded, onError]);

  if (hasFailedAllSources || !currentUrl) {
    if (showProxyFallback) {
      return <CardProxyFallback card={card} className={className} />;
    }
    return (
      <div
        className={`w-full h-full rounded-2xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center p-3 text-center text-slate-400 ${className}`}
      >
        <span className="text-xs font-bold text-slate-200">{card.name}</span>
        <span className="text-[10px] font-mono text-slate-500 mt-1">Image unavailable</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Loading Skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#050818] flex items-center justify-center z-10 pointer-events-none">
          <Loader2 className="w-5 h-5 text-violet-500 dark:text-cyan-400 animate-spin opacity-70" />
        </div>
      )}

      <img
        ref={setImgRef}
        src={currentUrl}
        alt={alt || card.name}
        className={`${imageClassName} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading={loading}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  );
};

export default CardImage;
