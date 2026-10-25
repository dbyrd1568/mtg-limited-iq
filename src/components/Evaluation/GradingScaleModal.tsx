import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, GripVertical } from 'lucide-react';
import { GradeTier } from '../../types/mtg';

interface GradingScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlightTier?: GradeTier | 'N/A' | null;
}

const COMPACT_SCALE: {
  tier: GradeTier;
  text: string;
  badge: string;
}[] = [
  { tier: 'A+', text: 'Unbeatable bomb; wins on its own', badge: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40' },
  { tier: 'A',  text: 'Dominant bomb or elite removal', badge: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40' },
  { tier: 'A-', text: 'Top uncommon or premier removal', badge: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40' },
  { tier: 'B+', text: 'Best common or archetype anchor', badge: 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-500/40' },
  { tier: 'B',  text: 'Strong staple; always makes the cut', badge: 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-500/40' },
  { tier: 'B-', text: 'Solid playable; reliable curve piece', badge: 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-500/40' },
  { tier: 'C+', text: 'Good filler with synergy upside', badge: 'bg-slate-200 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600' },
  { tier: 'C',  text: 'Average playable; standard 23rd card', badge: 'bg-slate-200 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600' },
  { tier: 'C-', text: 'Below-average filler; first to cut', badge: 'bg-slate-200 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600' },
  { tier: 'D',  text: 'Situational sideboard; avoid maindeck', badge: 'bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-500/40' },
  { tier: 'F',  text: 'Unplayable in Limited', badge: 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40' },
];

const STORAGE_KEY = 'mtg_iq_grading_scale_pos_v1';

export const GradingScaleModal: React.FC<GradingScaleModalProps> = ({
  isOpen,
  onClose,
  highlightTier,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cachedDimsRef = useRef<{ width: number; height: number }>({ width: 320, height: 440 });
  const rafIdRef = useRef<number | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 100, y: 100 };
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const width = window.innerWidth < 640 ? 288 : 320;
          const height = 440;
          return {
            x: Math.max(8, Math.min(window.innerWidth - width - 8, parsed.x)),
            y: Math.max(8, Math.min(window.innerHeight - height - 8, parsed.y)),
          };
        }
      }
    } catch {
      // Fallback
    }
    const width = window.innerWidth < 640 ? 288 : 320;
    const height = 440;
    return {
      x: Math.max(8, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(8, Math.round((window.innerHeight - height) / 2)),
    };
  });

  // Keep currentPosRef in sync with state
  useEffect(() => {
    currentPosRef.current = position;
  }, [position]);

  // Center or clamp position when modal opens
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setPosition((prev) => {
        const width = modalRef.current?.offsetWidth || (window.innerWidth < 640 ? 288 : 320);
        const height = modalRef.current?.offsetHeight || 440;
        const clampedX = Math.max(8, Math.min(window.innerWidth - width - 8, prev.x));
        const clampedY = Math.max(8, Math.min(window.innerHeight - height - 8, prev.y));
        return { x: clampedX, y: clampedY };
      });
    }
  }, [isOpen]);

  // Keep modal inside viewport when window is resized
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      setPosition((prev) => {
        const width = modalRef.current?.offsetWidth || (window.innerWidth < 640 ? 288 : 320);
        const height = modalRef.current?.offsetHeight || 440;
        const clampedX = Math.max(8, Math.min(window.innerWidth - width - 8, prev.x));
        const clampedY = Math.max(8, Math.min(window.innerHeight - height - 8, prev.y));
        if (clampedX === prev.x && clampedY === prev.y) return prev;
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // Unified Pointer-based Dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with primary click/touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button[aria-label="Close"]')) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = modalRef.current?.getBoundingClientRect();
    cachedDimsRef.current = {
      width: rect ? rect.width : (window.innerWidth < 640 ? 288 : 320),
      height: rect ? rect.height : 440,
    };

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: currentPosRef.current.x,
      posY: currentPosRef.current.y,
    };

    isDraggingRef.current = true;
    setIsDragging(true);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();

      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const { width, height } = cachedDimsRef.current;

      const nextX = Math.max(8, Math.min(window.innerWidth - width - 8, dragStartRef.current.posX + dx));
      const nextY = Math.max(8, Math.min(window.innerHeight - height - 8, dragStartRef.current.posY + dy));

      currentPosRef.current = { x: nextX, y: nextY };

      // High-performance RAF throttle: update transform directly on the DOM without re-rendering React
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (modalRef.current) {
            modalRef.current.style.transform = `translate3d(${currentPosRef.current.x}px, ${currentPosRef.current.y}px, 0)`;
          }
          rafIdRef.current = null;
        });
      }
    };

    const handlePointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setIsDragging(false);

      const finalPos = currentPosRef.current;
      setPosition(finalPos);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
      } catch {
        // Ignore storage error
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  if (!isOpen) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[240] bg-black/25 animate-in fade-in duration-100"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Draggable Modal Container with GPU-accelerated translate3d */}
      <div
        ref={modalRef}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          willChange: isDragging ? 'transform' : 'auto',
        }}
        className={`fixed top-0 left-0 z-[250] w-72 sm:w-80 bg-white dark:bg-[#16171b] border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl overflow-hidden select-none animate-in fade-in duration-100 ${
          isDragging ? 'ring-2 ring-violet-500/50 shadow-violet-500/10' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title, Drag Handle & Close Button */}
        <div
          onPointerDown={handlePointerDown}
          className={`flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1c1d22] cursor-grab active:cursor-grabbing touch-none ${
            isDragging ? 'cursor-grabbing' : ''
          }`}
          title="Drag to move on screen"
        >
          <span className="font-bold text-xs text-slate-800 dark:text-slate-100 pointer-events-none">
            Grading Scale
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors cursor-grab active:cursor-grabbing touch-none"
              title="Drag to move"
              aria-label="Drag to move"
              onPointerDown={handlePointerDown}
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-1.5 space-y-0.5">
          {COMPACT_SCALE.map((t) => {
            const isHighlighted = highlightTier === t.tier;
            return (
              <div
                key={t.tier}
                className={`flex items-center gap-2.5 px-2 py-1 rounded-lg ${
                  isHighlighted
                    ? 'bg-violet-500/15 ring-1 ring-violet-500/50'
                    : ''
                }`}
              >
                <span
                  className={`w-6 h-5 rounded flex items-center justify-center font-mono font-bold text-[11px] shrink-0 border ${t.badge}`}
                >
                  {t.tier}
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-200 leading-tight truncate">
                  {t.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
