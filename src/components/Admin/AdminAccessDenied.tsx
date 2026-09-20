import React from 'react';
import { ShieldAlert, LogIn, ArrowLeft, Lock } from 'lucide-react';
import { UserAccount } from '../../types/mtg';

interface AdminAccessDeniedProps {
  currentUser: UserAccount | null;
  onOpenAuthModal: () => void;
  onReturnHome: () => void;
}

export const AdminAccessDenied: React.FC<AdminAccessDeniedProps> = ({
  currentUser,
  onOpenAuthModal,
  onReturnHome,
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 dark:bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Security Icon Badge */}
        <div className="relative mx-auto w-20 h-20 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-lg shadow-rose-500/10">
          <ShieldAlert className="w-10 h-10" />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
          </span>
        </div>

        {/* Text Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            403 • Restricted Area
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white font-heading">
            Admin Access Required
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            This administrative screen is available only to allowed administrators.
            {currentUser ? (
              <>
                {' '}You are currently signed in as{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {currentUser.name}
                </span>{' '}
                ({currentUser.email || 'No Email'}), which does not have admin privileges.
              </>
            ) : (
              ' Please sign in with an authorized administrator account to continue.'
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onOpenAuthModal}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-md shadow-violet-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{currentUser ? 'Switch Account' : 'Sign In as Admin'}</span>
          </button>

          <button
            onClick={onReturnHome}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to App</span>
          </button>
        </div>

        {/* Security Notice */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
          Secured via Role-Based Access Control & Verification
        </div>
      </div>
    </div>
  );
};
