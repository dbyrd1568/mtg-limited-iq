import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '../../types/mtg';
import { SimilarCardMatch, calculateCardSimilarity } from '../../services/cardSimilarity';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { CardImage } from '../UI/CardImage';
import { PrecedentCardSearch } from './PrecedentCardSearch';
import { X, ArrowRight, Check, RefreshCw, Sparkles, Database, Search } from 'lucide-react';

interface PrecedentSlotPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCard: Card;
  replacementCard: Card | null;
  currentMatches: SimilarCardMatch[];
  preselectedSlotIndex?: number | null;
  onConfirmSlotReplacement: (slotIndex: number, chosenCard?: Card) => void;
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
  const [candidateCard, setCandidateCard] = useState<Card | null>(replacementCard);
  const [isSearchingAnother, setIsSearchingAnother] = useState<boolean>(false);

  // Sync candidate card if replacementCard prop changes
  useEffect(() => {
    setCandidateCard(replacementCard);
    setIsSearchingAnother(false);
  }, [replacementCard]);

  const activeCandidate = candidateCard || replacementCard;

  // Set initial selected slot when opened
  useEffect(() => {
    if (typeof preselectedSlotIndex === 'number' && preselectedSlotIndex >= 0 && preselectedSlotIndex < 4) {
      setSelectedSlot(preselectedSlotIndex);
    } else {
      setSelectedSlot(0);
    }
  }, [preselectedSlotIndex, isOpen]);

  // Calculate live similarity preview of active candidate card vs target card
  const previewSimilarity = useMemo(() => {
    if (!targetCard || !activeCandidate) return null;
    return calculateCardSimilarity(targetCard, activeCandidate);
  }, [targetCard, activeCandidate]);

  if (!isOpen || !activeCandidate) return null;

  const handleConfirm = () => {
    onConfirmSlotReplacement(selectedSlot, activeCandidate);
    onClose();
  };

  const repImageUri =
    activeCandidate.image_uris?.png ||
    activeCandidate.image_uris?.normal ||
    activeCandidate.image_uris?.large ||
    activeCandidate.image_uris?.small ||
    (activeCandidate.card_faces && (activeCandidate.card_faces[0]?.image_uris?.png || activeCandidate.card_faces[0]?.image_uris?.normal)) ||
    (activeCandidate.card_faces && activeCandidate.card_faces[0]?.image_uris?.small);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[96vw] max-w-[1550px] max-h-[94vh] bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/90 dark:bg-[#050818]/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-700 dark:text-cyan-400 shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
                  Substitute Precedent Card
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-cyan-300 font-bold border border-violet-200 dark:border-violet-800/60">
                  Target: {targetCard.name} ({targetCard.set.toUpperCase()})
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Compare your candidate card with all 4 current slots and choose which one to replace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {/* New Precedent to Introduce Banner Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-cyan-500/10 border-2 border-violet-300/60 dark:border-cyan-500/40 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-violet-600 text-white font-mono text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                  New Precedent
                </span>
                <span className="text-xs font-mono font-bold text-violet-900 dark:text-cyan-200">
                  Candidate card to substitute into precedent engine
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSearchingAnother((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
                  <span>{isSearchingAnother ? 'Close Search' : 'Search Different Card'}</span>
                </button>

                {previewSimilarity && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 shrink-0">
                    {previewSimilarity.score}% Match vs {targetCard.name}
                  </span>
                )}
              </div>
            </div>

            {/* Inline search bar if user wants to change candidate without leaving modal */}
            {isSearchingAnother && (
              <div className="mb-4 p-3.5 rounded-2xl bg-white/95 dark:bg-[#070b1e]/95 border border-violet-300/80 dark:border-cyan-800/80 shadow-lg animate-in fade-in slide-in-from-top-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    Search Any Magic Card to Preview:
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Selecting a card updates the candidate preview immediately
                  </span>
                </div>
                <PrecedentCardSearch
                  targetCard={targetCard}
                  onSelectCard={(newCard) => {
                    setCandidateCard(newCard);
                    setIsSearchingAnother(false);
                  }}
                  placeholder="Search by card name, oracle text (e.g. 'draw a card'), stats 2/3, or mana {2}{W}..."
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
              {/* Card Thumbnail */}
              <div className="w-[110px] sm:w-[130px] h-[154px] sm:h-[182px] rounded-2xl overflow-hidden shadow-md border border-slate-300 dark:border-slate-700 shrink-0 bg-[#050818]">
                <CardImage
                  card={activeCandidate}
                  src={repImageUri}
                  alt={activeCandidate.name}
                  className="w-full h-full"
                  imageClassName="w-full h-full object-contain"
                  loading="eager"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-bold text-base sm:text-xl text-slate-900 dark:text-white font-heading">
                    {activeCandidate.name}
                  </h4>
                  {activeCandidate.mana_cost && (
                    <div className="scale-105 origin-right">
                      <ManaCostRenderer manaCost={activeCandidate.mana_cost} size="sm" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 flex-wrap">
                  <div className="flex items-center gap-1">
                    <SetSymbol setCode={activeCandidate.set} size="xs" />
                    <span className="font-bold uppercase text-violet-700 dark:text-cyan-400">
                      {activeCandidate.set}
                    </span>
                  </div>
                  <span>•</span>
                  <span className="capitalize">{activeCandidate.rarity}</span>
                  <span>•</span>
                  <span className="font-medium">{activeCandidate.type_line}</span>
                  {activeCandidate.power !== undefined && activeCandidate.toughness !== undefined && (
                    <>
                      <span>•</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {activeCandidate.power}/{activeCandidate.toughness}
                      </span>
                    </>
                  )}
                </div>

                {/* Oracle Rules Text */}
                {activeCandidate.oracle_text && (
                  <div className="p-3 rounded-2xl bg-white/80 dark:bg-[#060a1d]/80 border border-slate-200/80 dark:border-slate-800 text-xs font-sans text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line max-h-24 overflow-y-auto custom-scrollbar shadow-2xs">
                    {activeCandidate.oracle_text}
                  </div>
                )}

                {/* Similarity Reasons */}
                {previewSimilarity && previewSimilarity.reasons.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Match reasons:</span>
                    {previewSimilarity.reasons.slice(0, 4).map((reason, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-cyan-300 border border-violet-200 dark:border-violet-800/60"
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

          {/* Destination Slot Selection (4-Card Grid) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Choose Destination Slot to Replace:
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Click any slot below to select which current precedent card will be substituted by <span className="font-bold text-slate-800 dark:text-slate-200">{activeCandidate.name}</span>
                </span>
              </div>
              <span className="text-xs font-mono text-violet-600 dark:text-cyan-400 font-bold px-2.5 py-1 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60">
                Slot {selectedSlot + 1} Selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {[0, 1, 2, 3].map((slotIdx) => {
                const existingMatch = currentMatches[slotIdx];
                const isSelected = selectedSlot === slotIdx;
                const comp = existingMatch?.card;
                const compImageUri =
                  comp?.image_uris?.png ||
                  comp?.image_uris?.normal ||
                  comp?.image_uris?.large ||
                  comp?.image_uris?.small ||
                  (comp?.card_faces && (comp?.card_faces[0]?.image_uris?.png || comp?.card_faces[0]?.image_uris?.normal)) ||
                  (comp?.card_faces && comp?.card_faces[0]?.image_uris?.small);

                return (
                  <div
                    key={slotIdx}
                    onClick={() => setSelectedSlot(slotIdx)}
                    className={`rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between overflow-hidden relative shadow-sm hover:shadow-md ${
                      isSelected
                        ? 'bg-violet-50/90 dark:bg-[#0d1436] border-violet-600 dark:border-cyan-400 ring-2 ring-violet-500/40 dark:ring-cyan-400/40 shadow-xl'
                        : 'bg-white dark:bg-[#070b1e] border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Slot Header Bar */}
                    <div
                      className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-violet-100/90 dark:bg-violet-950/70 border-violet-200 dark:border-cyan-900/60'
                          : 'bg-slate-50 dark:bg-[#050818] border-slate-100 dark:border-slate-800/80'
                      }`}
                    >
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-200">
                        Slot {slotIdx + 1}
                      </span>

                      {isSelected ? (
                        <span className="flex items-center gap-1 text-xs font-mono font-black text-violet-700 dark:text-cyan-300 animate-in fade-in">
                          <Check className="w-3.5 h-3.5" />
                          <span>Selected</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                          Click to select
                        </span>
                      )}
                    </div>

                    {/* Card Content */}
                    {comp ? (
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        {/* Card Image Thumbnail */}
                        <div className="w-full h-[220px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#050818] shadow-sm relative shrink-0 group">
                          <CardImage
                            card={comp}
                            src={compImageUri}
                            alt={comp.name}
                            className="w-full h-full"
                            imageClassName="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                            loading="eager"
                          />

                          {/* Overlaid Tier Grade badge */}
                          {existingMatch.tierGrade && (
                            <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-lg bg-slate-900/90 backdrop-blur-xs text-white font-mono font-black text-xs border border-slate-700 shadow-md">
                              Tier {existingMatch.tierGrade}
                            </div>
                          )}
                        </div>

                        {/* Title & Mana */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate font-heading" title={comp.name}>
                              {comp.name}
                            </h5>
                            {comp.mana_cost && (
                              <div className="shrink-0 scale-90 origin-right">
                                <ManaCostRenderer manaCost={comp.mana_cost} size="sm" />
                              </div>
                            )}
                          </div>

                          {/* Meta details */}
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex-wrap">
                            <div className="flex items-center gap-1">
                              <SetSymbol setCode={comp.set} size="xs" />
                              <span className="font-bold uppercase text-violet-700 dark:text-cyan-400">{comp.set}</span>
                            </div>
                            <span>•</span>
                            <span className="capitalize">{comp.rarity}</span>
                            {comp.power !== undefined && comp.toughness !== undefined && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {comp.power}/{comp.toughness}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {comp.type_line}
                          </div>
                        </div>

                        {/* 17Lands & Similarity Row */}
                        <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-200/80 dark:border-slate-800 text-[11px] font-mono">
                          <span className="font-bold text-violet-700 dark:text-cyan-400">
                            {existingMatch.similarityScore}% Match
                          </span>
                          {existingMatch.winRate !== undefined ? (
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                              {(existingMatch.winRate * 100).toFixed(1)}% WR
                            </span>
                          ) : (
                            <span className="text-slate-400">17L Pending</span>
                          )}
                        </div>

                        {/* Rules / Oracle Text Box */}
                        {comp.oracle_text ? (
                          <div
                            className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#050818]/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px] font-sans text-slate-700 dark:text-slate-300 leading-snug line-clamp-3 min-h-[58px]"
                            title={comp.oracle_text}
                          >
                            {comp.oracle_text}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#050818]/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px] font-sans text-slate-400 italic min-h-[58px] flex items-center justify-center">
                            (No rules text)
                          </div>
                        )}

                        {/* Custom override tag if applicable */}
                        {existingMatch.isCustomOverride && (
                          <div className="text-center">
                            <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 font-bold">
                              Custom Comp {existingMatch.originalCardName ? `(Replaced ${existingMatch.originalCardName})` : ''}
                            </span>
                          </div>
                        )}

                        {/* Selection Button */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSlot(slotIdx);
                            }}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                              isSelected
                                ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Replace This Slot</span>
                              </>
                            ) : (
                              <span>Choose Slot {slotIdx + 1}</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 flex-1 flex flex-col items-center justify-center text-center gap-2 text-slate-400 font-mono text-xs">
                        <span>(Empty Slot)</span>
                        <button
                          type="button"
                          onClick={() => setSelectedSlot(slotIdx)}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold cursor-pointer"
                        >
                          Choose Slot {slotIdx + 1}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/90 dark:bg-[#050818]/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>Substituting:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Slot {selectedSlot + 1} ({currentMatches[selectedSlot]?.card?.name || 'Empty'})
            </span>
            <span>with</span>
            <span className="font-bold text-violet-700 dark:text-cyan-300">
              {activeCandidate.name}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl text-xs font-bold font-mono bg-violet-600 hover:bg-violet-700 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Replace Slot {selectedSlot + 1}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
