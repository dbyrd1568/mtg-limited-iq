import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertOctagon, Flame, X, Check, ShieldCheck, ArrowRight, Trash2 } from 'lucide-react';

interface ClearSetRatingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  setCode: string;
  setName: string;
  ratedCount: number;
  onConfirmClear: (setCode: string) => void;
}

export const ClearSetRatingsModal: React.FC<ClearSetRatingsModalProps> = ({
  isOpen,
  onClose,
  setCode,
  setName,
  ratedCount,
  onConfirmClear,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isAcknowledged, setIsAcknowledged] = useState<boolean>(false);
  const [typedConfirmation, setTypedConfirmation] = useState<string>('');
  const [isDone, setIsDone] = useState<boolean>(false);

  // Reset state whenever modal opens or set changes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIsAcknowledged(false);
      setTypedConfirmation('');
      setIsDone(false);
    }
  }, [isOpen, setCode]);

  if (!isOpen) return null;

  const expectedPhrase = `CLEAR ${setCode.toUpperCase()}`;
  const isPhraseMatched = typedConfirmation.trim().toUpperCase() === expectedPhrase;

  const handleExecuteClear = () => {
    onConfirmClear(setCode);
    setIsDone(true);
    setTimeout(() => {
      onClose();
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-[#090a0d]/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1c1d22] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#17181c]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
              Clear Set Grades • Step {step} of 3
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1.5 flex">
          <div
            className={`h-full transition-all duration-300 ${
              step === 1 ? 'w-1/3 bg-amber-500' : step === 2 ? 'w-2/3 bg-rose-500' : 'w-full bg-rose-600'
            }`}
          />
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* STEP 1: Scope & Impact Warning */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 border border-amber-300 dark:border-amber-500/30">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Clear grades for {setName}?
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    You currently have <strong className="text-amber-600 dark:text-amber-400 font-bold">{ratedCount}</strong> card evaluation{ratedCount === 1 ? '' : 's'} recorded for <span className="font-mono font-bold text-violet-700 dark:text-cyan-300">[{setCode.toUpperCase()}]</span>.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Selected Set Only Guarantee:</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pl-6">
                  This action will <strong className="text-slate-900 dark:text-white">ONLY</strong> remove grades and notes for <strong className="text-violet-600 dark:text-cyan-300 font-mono">{setCode.toUpperCase()}</strong> cards. Your evaluations for other MTG sets will remain 100% untouched.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Continue to Confirmation (1/3)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Irreversible Acknowledgment */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 border border-rose-300 dark:border-rose-500/30">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Confirmation Step 2: Irreversible Action
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Once cleared, all letter grades, pick priorities, and notes for <span className="font-mono font-bold text-rose-500">{setCode.toUpperCase()}</span> will be permanently deleted and cannot be recovered.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 cursor-pointer hover:bg-rose-500/15 transition-colors">
                <input
                  type="checkbox"
                  checked={isAcknowledged}
                  onChange={(e) => setIsAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed font-semibold">
                  I understand that clearing my evaluations for {setCode.toUpperCase()} is permanent and cannot be undone.
                </span>
              </label>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!isAcknowledged}
                    onClick={() => setStep(3)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Proceed to Final Verification (2/3)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Final Type-to-Verify Security Check */}
          {step === 3 && !isDone && (
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-2xl bg-rose-600 text-white shrink-0 shadow-md shadow-rose-600/30">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Final Verification (Step 3 of 3)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    To prevent accidental deletion, please type <strong className="text-rose-600 dark:text-rose-400 font-mono font-black">{expectedPhrase}</strong> below:
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  autoFocus
                  placeholder={`Type "${expectedPhrase}" to confirm`}
                  value={typedConfirmation}
                  onChange={(e) => setTypedConfirmation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tracking-wider bg-slate-50 dark:bg-[#17181c] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 dark:focus:border-rose-400"
                />
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Target phrase: {expectedPhrase}</span>
                  {isPhraseMatched ? (
                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Phrase matched
                    </span>
                  ) : (
                    <span className="text-slate-400">Case-insensitive</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!isPhraseMatched}
                    onClick={handleExecuteClear}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Clear {setCode.toUpperCase()} Grades</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {isDone && (
            <div className="py-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-300 dark:border-emerald-500/40">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                All {setCode.toUpperCase()} Grades Cleared
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {ratedCount} evaluations removed for {setCode.toUpperCase()} only. Other sets remain intact.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
