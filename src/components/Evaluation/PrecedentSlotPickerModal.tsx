import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '../../types/mtg';
import { SimilarCardMatch, calculateCardSimilarity } from '../../services/cardSimilarity';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { CardImage } from '../UI/CardImage';
import { X, ArrowRight, Check, Sparkles, RefreshCw, HelpCircle } from 'lucide-react';

interface PrecedentSlotPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCard: Card;
  replacementCard: Card | null;
  currentMatches: SimilarCardMatch[];
  preselectedSlotIndex?: number | null;
  onConfirmSlotReplacement: (slotIndex: number) => void;
}

export const PrecedentSlotPickerModal: React.FC<PrecedentSlotPickerModalProps> = ({
  isOpen,
  onClose,
  targetCard,
  replacementCard,
  currentMatches,
  preselectedSlotIndex = null,
  onConfirmSlotReplacement,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<number>(0);

  // Set initial selected slot when opened
  useEffect(() => {
    if (typeof preselectedSlotIndex === 'number' && preselectedSlotIndex >= 0 && preselectedSlotIndex < 4) {
      setSelectedSlot(preselectedSlotIndex);
    } else {
      setSelectedSlot(0);
    }
  }, [preselectedSlotIndex, isOpen]);

  // Calculate live similarity preview of replacement card vs target card
  const previewSimilarity = useMemo(() => {
    if (!targetCard || !replacementCard) return null;
    return calculateCardSimilarity(targetCard, replacementCard);
  }, [targetCard, replacementCard]);

  if (!isOpen || !replacementCard) return null;

  const handleConfirm = () => {
    onConfirmSlotReplacement(selectedSlot);
    onClose();
  };

  const repImageUri =
    replacementCard.image_uris?.normal ||
    replacementCard.image_uris?.small ||
    (replacementCard.card_faces && replacementCard.card_faces[0]?.image_uris?.normal);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#050818]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-700 dark:text-cyan-400">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                Substitute Precedent Card
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Select which comparable slot to replace with your chosen card
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Card to Add Preview Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-cyan-500/10 border border-violet-300/40 dark:border-cyan-500/30">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-700 dark:text-cyan-300 block mb-2">
              New Precedent to Introduce
            </span>

            <div className="flex items-start gap-3.5">
              <div className="w-16 h-22 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
                <CardImage
                  card={replacementCard}
                  src={repImageUri}
                  alt={replacementCard.name}
                  className="w-full h-full"
                  imageClassName="w-full h-full object-cover"
                  loading="eager"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">
                    {replacementCard.name}
                  </h4>
                  {replacementCard.mana_cost && (
                    <ManaCostRenderer manaCost={replacementCard.mana_cost} size="sm" />
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <SetSymbol setCode={replacementCard.set} size="xs" />
                  <span className="font-bold uppercase text-violet-700 dark:text-cyan-400">
                    {replacementCard.set}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{replacementCard.rarity}</span>
                  <span>•</span>
                  <span className="truncate">{replacementCard.type_line}</span>
                </div>

                {/* Similarity score preview */}
                {previewSimilarity && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                      {previewSimilarity.score}% Match vs {targetCard.name}
                    </span>
                    {previewSimilarity.reasons.slice(0, 2).map((reason, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate max-w-[200px]"
                        title={reason}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Destination Slot Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Choose Destination Slot to Replace:
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Click any slot below
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((slotIdx) => {
                const existingMatch = currentMatches[slotIdx];
                const isSelected = selectedSlot === slotIdx;
                const existingCard = existingMatch?.card;

                return (
                  <div
                    key={slotIdx}
                    onClick={() => setSelectedSlot(slotIdx)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                      isSelected
                        ? 'bg-violet-50/80 dark:bg-violet-950/40 border-violet-500 dark:border-cyan-400 ring-2 ring-violet-400/50 dark:ring-cyan-400/50 shadow-md'
                        : 'bg-white dark:bg-[#070b1e] border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Slot {slotIdx + 1}
                      </span>

                      {isSelected && (
                        <span className="flex items-center gap-1 text-xs font-mono font-bold text-violet-700 dark:text-cyan-300">
                          <Check className="w-3.5 h-3.5" />
                          <span>Selected</span>
                        </span>
                      )}
                    </div>

                    {existingCard ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {existingCard.name}
                          </span>
                          {existingMatch.tierGrade && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              Tier {existingMatch.tierGrade}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <SetSymbol setCode={existingCard.set} size="xs" />
                          <span>{existingCard.set}</span>
                          <span>•</span>
                          <span>{existingMatch.similarityScore}% match</span>
                        </div>

                        {existingMatch.isCustomOverride && (
                          <span className="inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60">
                            Custom Comp
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="py-2 text-center text-xs font-mono text-slate-400">
                        (Empty Slot)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#050818]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl text-xs font-bold font-mono bg-violet-600 hover:bg-violet-700 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Replace Slot {selectedSlot + 1}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
