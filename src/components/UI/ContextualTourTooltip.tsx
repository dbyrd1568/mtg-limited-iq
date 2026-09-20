import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, ArrowRight, X, Info } from 'lucide-react';
import { useContextualTour } from '../../context/ContextualTourContext';

export const ContextualTourTooltip: React.FC = () => {
  const { activeStep, dismissActiveStep, skipAll } = useContextualTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
    placement: 'bottom' | 'top';
    arrowLeft: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Smoothly scroll target into view when step becomes active
  useEffect(() => {
    if (!activeStep) return;
    const el = document.querySelector(activeStep.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeStep]);

  // Update target element positioning and arrow offset
  const updatePosition = useCallback(() => {
    if (!activeStep) {
      setTargetRect(null);
      setTooltipPos(null);
      return;
    }

    const el = document.querySelector(activeStep.targetSelector);
    if (!el) {
      setTargetRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return;
    }

    setTargetRect(rect);

    const tooltipWidth = 340;
    const estimatedHeight = 240;
    const gap = 14;
    const margin = 16;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Center horizontally relative to target
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // Clamp horizontal position within viewport
    if (left < margin) left = margin;
    if (left + tooltipWidth > viewportWidth - margin) {
      left = Math.max(margin, viewportWidth - tooltipWidth - margin);
    }

    // Determine vertical placement (below or above)
    let top = 0;
    let actualPlacement: 'bottom' | 'top' = activeStep.preferredPlacement === 'top' ? 'top' : 'bottom';

    if (activeStep.preferredPlacement === 'bottom') {
      if (rect.bottom + gap + estimatedHeight < viewportHeight - margin) {
        top = rect.bottom + gap;
        actualPlacement = 'bottom';
      } else if (rect.top - gap - estimatedHeight > margin) {
        top = rect.top - gap - estimatedHeight;
        actualPlacement = 'top';
      } else {
        top = Math.max(margin, rect.bottom + gap);
        actualPlacement = 'bottom';
      }
    } else {
      // Preferred top
      if (rect.top - gap - estimatedHeight > margin) {
        top = rect.top - gap - estimatedHeight;
        actualPlacement = 'top';
      } else if (rect.bottom + gap + estimatedHeight < viewportHeight - margin) {
        top = rect.bottom + gap;
        actualPlacement = 'bottom';
      } else {
        top = Math.max(margin, rect.top - gap - estimatedHeight);
        actualPlacement = 'top';
      }
    }

    // Calculate relative arrow horizontal position pointing directly at target center
    const targetCenterX = rect.left + rect.width / 2;
    const arrowLeft = Math.max(20, Math.min(tooltipWidth - 28, targetCenterX - left - 8));

    setTooltipPos({ top, left, placement: actualPlacement, arrowLeft });
  }, [activeStep]);

  useEffect(() => {
    updatePosition();

    // Polling handles async rendered items (like cards fetched from Scryfall)
    const interval = setInterval(updatePosition, 300);

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissActiveStep();
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [updatePosition, dismissActiveStep]);

  if (!activeStep || !targetRect || !tooltipPos) {
    return null;
  }

  return (
    <>
      {/* Target element highlight ring & pulsing beacon (NO dark fullscreen backdrop!) */}
      <div
        className="fixed rounded-xl ring-2 ring-violet-500 shadow-[0_0_25px_rgba(139,92,246,0.65)] pointer-events-none transition-all duration-150 z-[90]"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
        }}
      >
        {/* Pulsing beacon indicator */}
        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-80" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-violet-600 border border-white" />
        </span>
      </div>

      {/* Tour Tooltip Card with directional arrow */}
      <div
        ref={tooltipRef}
        className="fixed z-[100] w-[340px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#0b102b] border border-violet-400/80 dark:border-violet-500/60 rounded-2xl shadow-2xl p-4 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
        }}
      >
        {/* Directional Arrow pointing to the target element */}
        {tooltipPos.placement === 'bottom' ? (
          <div
            className="absolute -top-2 w-4 h-4 bg-white dark:bg-[#0b102b] border-t border-l border-violet-400/80 dark:border-violet-500/60 rotate-45"
            style={{ left: `${tooltipPos.arrowLeft}px` }}
          />
        ) : (
          <div
            className="absolute -bottom-2 w-4 h-4 bg-white dark:bg-[#0b102b] border-b border-r border-violet-400/80 dark:border-violet-500/60 rotate-45"
            style={{ left: `${tooltipPos.arrowLeft}px` }}
          />
        )}

        {/* Header with organic badge & dismiss button (NO numbered counters like 2 of 7) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-cyan-300 text-[11px] font-mono font-bold tracking-wide border border-violet-200 dark:border-violet-700/50">
              <Sparkles className="w-3 h-3 text-violet-600 dark:text-cyan-400 shrink-0" />
              <span>{activeStep.badge}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={dismissActiveStep}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            title="Dismiss tip (Esc)"
            aria-label="Close tip"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
          {activeStep.title}
        </h4>

        {/* Description */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
          {activeStep.description}
        </p>

        {/* Contextual Note Box (e.g. unreleased set 17Lands explanation) */}
        {activeStep.secondaryNote && (
          <div className="mb-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>{activeStep.secondaryNote}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={skipAll}
            className="text-[11px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            Skip Tour
          </button>

          <button
            type="button"
            onClick={dismissActiveStep}
            className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold font-mono tracking-wide shadow-xs shadow-violet-600/30 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Got it</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
};
