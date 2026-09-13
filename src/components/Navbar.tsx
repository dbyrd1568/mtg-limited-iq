import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, Link2, Sun, Moon, RefreshCw, HelpCircle, Shield, Download } from 'lucide-react';
import { SetInfo, UserProfileStats, UserAccount } from '../types/mtg';
import { getSyncStatus, subscribeSyncStatus, SyncStatus } from '../services/cloudSync';
import { getStoredTheme, toggleTheme, ThemeMode } from '../services/theme';
import { isProdEnvironment } from '../services/environment';
import { PlaneswalkerSymbol } from './UI/PlaneswalkerSymbol';
import { SetSymbol } from './UI/SetSymbol';

export type ActiveTab = 'quiz' | 'evaluation' | 'stats' | 'explorer' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentSet: SetInfo | null;
  onOpenSetSelector: () => void;
  userStats: UserProfileStats;
  currentUser: UserAccount | null;
  isAdmin?: boolean;
  onOpenAuthModal: () => void;
  onOpenWelcomeTour?: () => void;
  onOpenExportModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentSet,
  onOpenSetSelector,
  userStats,
  currentUser,
  isAdmin,
  onOpenAuthModal,
  onOpenWelcomeTour,
  onOpenExportModal,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme());

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((s) => setSyncStatus(s));
    
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeMode }>;
      if (customEvent.detail?.theme) {
        setCurrentTheme(customEvent.detail.theme);
      }
    };
    window.addEventListener('mtg-theme-change', handleThemeChange);

    return () => {
      unsubscribe();
      window.removeEventListener('mtg-theme-change', handleThemeChange);
    };
  }, []);

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setCurrentTheme(next);
  };

  const handleCopyTroubleshootLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#060919]/95 backdrop-blur-md shadow-xs transition-colors duration-200">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Brand Logo & Name: Official WOTC MTG Planeswalker Spark + MTG Limited IQ */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-500 dark:from-violet-500 dark:via-indigo-500 dark:to-cyan-400 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0 p-1.5 border border-white/20">
              <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-xs" />
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-heading font-black text-sm sm:text-base tracking-wider text-slate-900 dark:text-white">
                MTG LIMITED
              </span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50">
                IQ
              </span>
            </div>
          </div>

          {/* Navigation Tabs in Unified Pill Aesthetic */}
          <nav className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200/90 dark:border-slate-800/80 shadow-xs overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => onTabChange('evaluation')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'evaluation'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Grading
            </button>

            <button
              onClick={() => onTabChange('quiz')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'quiz'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Quiz
            </button>

            <button
              onClick={() => onTabChange('explorer')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'explorer'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Cards
            </button>

            {isAdmin && (
              <button
                onClick={() => onTabChange('admin')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-violet-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Right Side: Theme Toggle, Set Switcher, Share Link & User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Dark / Light Mode Toggle Button (Icon Only) */}
            <button
              onClick={handleToggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shrink-0 shadow-xs flex items-center justify-center"
              title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              ) : (
                <Moon className="w-4 h-4 text-violet-700 fill-violet-700/20" />
              )}
            </button>

            {/* Share / Troubleshoot Link Button (Icon Only) */}
            <button
              onClick={handleCopyTroubleshootLink}
              className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 text-slate-700 dark:text-slate-300 flex items-center justify-center"
              title="Copy shareable link to clipboard"
              aria-label="Share Link"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Link2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              )}
            </button>

            {/* Quick Tour / Help Button */}
            {onOpenWelcomeTour && (
              <button
                onClick={onOpenWelcomeTour}
                className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-cyan-300 flex items-center justify-center"
                title="Getting Started Guide"
                aria-label="Getting Started Guide"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            {/* Export Grades & Data Button (Available for ALL users) */}
            {onOpenExportModal && (
              <button
                onClick={onOpenExportModal}
                className="p-2 sm:px-3 sm:py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-cyan-300 flex items-center gap-1.5 justify-center"
                title="Export Card Grades, 17Lands Tier List & Backups (CSV / TSV / JSON)"
                aria-label="Export Grades and Backups"
              >
                <Download className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="hidden sm:inline text-xs font-semibold">Export</span>
              </button>
            )}

            {/* Set Switcher Trigger */}
            <button
              onClick={onOpenSetSelector}
              className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all shadow-xs group cursor-pointer shrink-0 whitespace-nowrap border ${
                currentSet
                  ? 'bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                  : 'bg-violet-600 hover:bg-violet-500 text-white border-violet-400 animate-pulse shadow-md shadow-violet-500/30'
              }`}
              title={currentSet ? `Switch Active MTG Set (${currentSet.name})` : 'Choose a Set to begin'}
            >
              {currentSet ? (
                <>
                  <SetSymbol setCode={currentSet.code} iconSvgUri={currentSet.icon_svg_uri} size="sm" />
                  <div className="text-left flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-violet-600 dark:text-cyan-300">{currentSet.code}</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[80px] sm:max-w-[110px] hidden md:inline">
                      {currentSet.name}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                  <span>Choose Set</span>
                </div>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-colors shrink-0 ${currentSet ? 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200' : 'text-white'}`} />
            </button>

            {/* User Profile / Auth Button with Live Cloud Sync Indicator */}
            {currentUser ? (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 sm:gap-2 pl-1 pr-2 sm:pr-2.5 py-1 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-xs cursor-pointer group shrink-0 whitespace-nowrap"
                title={`Active Profile: ${currentUser.name} • Sync: ${syncStatus}`}
              >
                <div className="relative shrink-0">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-6 h-6 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-xs font-heading shrink-0"
                      style={{ backgroundColor: currentUser.avatarColor || '#8b5cf6' }}
                    >
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Live Sync Status Indicator Dot */}
                  {syncStatus === 'synced' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#060919]" />
                  )}
                  {syncStatus === 'syncing' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-500 ring-2 ring-white dark:ring-[#060919] animate-pulse" />
                  )}
                  {syncStatus === 'offline' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#060919]" />
                  )}
                  {syncStatus === 'error' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#060919]" />
                  )}
                </div>

                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white max-w-[70px] sm:max-w-[95px] truncate">
                  {currentUser.name}
                </span>

                {isAdmin && (
                  <span className="hidden sm:inline-flex items-center text-[9px] font-mono font-bold px-1 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                    ADMIN
                  </span>
                )}

                {/* Visual Sync Badge Pill */}
                <span
                  className={`hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight border ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                      : syncStatus === 'syncing'
                      ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60 animate-pulse'
                      : syncStatus === 'offline'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                      : syncStatus === 'error'
                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
                      : isProdEnvironment()
                      ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/60'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                >
                  {syncStatus === 'synced' && 'Synced ✓'}
                  {syncStatus === 'syncing' && 'Syncing ⟳'}
                  {syncStatus === 'offline' && 'Offline ☁'}
                  {syncStatus === 'local_only' && (isProdEnvironment() ? 'Cloud Active' : 'Local 💾')}
                  {syncStatus === 'error' && 'Sync Error ⚠'}
                </span>

                {/* App Version Badge */}
                <span className="hidden sm:inline text-[9px] font-mono text-slate-400 dark:text-slate-600 shrink-0">
                  v{__APP_VERSION__}
                </span>

                {/* Sync Icon Feedback on Mobile */}
                <span className="md:hidden">
                  {syncStatus === 'syncing' ? (
                    <RefreshCw className="w-3 h-3 text-cyan-500 animate-spin shrink-0" />
                  ) : syncStatus === 'synced' ? (
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 opacity-80" />
                  ) : null}
                </span>
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
