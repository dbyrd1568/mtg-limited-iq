import React, { useState, useEffect } from 'react';
import { PlaneswalkerSymbol } from '../UI/PlaneswalkerSymbol';
import {
  signInWithOAuth,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
  devQuickLogin,
  OAuthProvider,
} from '../../services/auth';
import { isLocalhost } from '../../services/environment';
import { UserAccount } from '../../types/mtg';
import { getStoredTheme, toggleTheme, ThemeMode } from '../../services/theme';
import { LegalModal, LegalDocType } from '../Legal/LegalModal';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BarChart3,
  Brain,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react';

interface LoginGateProps {
  onAuthenticated: (user: UserAccount) => void;
}

type AuthTab = 'oauth' | 'magic_link' | 'password';

export const LoginGate: React.FC<LoginGateProps> = ({ onAuthenticated }) => {
  const [activeTab, setActiveTab] = useState<AuthTab>('oauth');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme());
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  useEffect(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
    if (path === '/privacy' || path.startsWith('/privacy')) {
      setLegalDoc('privacy');
    } else if (path === '/terms' || path.startsWith('/terms')) {
      setLegalDoc('terms');
    }

    // Detect OAuth error query parameters from Supabase or Google redirect
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error_description') || params.get('error');
      if (err) {
        setStatusMessage({ type: 'error', text: decodeURIComponent(err.replace(/\+/g, ' ')) });
        const clean = new URL(window.location.href);
        clean.searchParams.delete('error');
        clean.searchParams.delete('error_description');
        clean.searchParams.delete('error_code');
        window.history.replaceState(null, '', clean.toString());
      }
    }
  }, []);


  const handleOpenLegal = (doc: LegalDocType) => {
    setLegalDoc(doc);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/${doc}`);
    }
  };

  const handleCloseLegal = () => {
    setLegalDoc(null);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
  };

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setCurrentTheme(next);
  };

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const { user, error } = await signInWithOAuth(provider);
      if (error) {
        setStatusMessage({ type: 'error', text: error.message });
        setIsLoading(false);
        return;
      }
      if (user) {
        onAuthenticated(user);
        setIsLoading(false);
      } else {
        // Redirect is occurring; reset loading if browser hasn't navigated after 5s
        setTimeout(() => setIsLoading(false), 5000);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Authentication failed' });
      setIsLoading(false);
    }
  };


  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);

    const { user, error } = await signInWithMagicLink(email.trim());
    setIsLoading(false);
    if (error) {
      setStatusMessage({ type: 'error', text: error.message });
      return;
    }
    if (user) {
      onAuthenticated(user);
    } else {
      setStatusMessage({
        type: 'success',
        text: `Magic link sent to ${email.trim()}! Please check your inbox and click the link to log in.`,
      });
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setStatusMessage({ type: 'error', text: 'Please provide both email and password.' });
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);

    if (authMode === 'signin') {
      const { user, error } = await signInWithPassword(email.trim(), password);
      setIsLoading(false);
      if (error) {
        setStatusMessage({ type: 'error', text: error.message });
        return;
      }
      if (user) {
        onAuthenticated(user);
      }
    } else {
      const { user, error } = await signUpWithPassword(email.trim(), password, displayName.trim());
      setIsLoading(false);
      if (error) {
        setStatusMessage({ type: 'error', text: error.message });
        return;
      }
      if (user) {
        onAuthenticated(user);
      } else {
        setStatusMessage({
          type: 'success',
          text: 'Account created! If confirmation is required, check your email for the confirmation link.',
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#030614] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Simple Header */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#060919]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-500 dark:from-violet-500 dark:via-indigo-500 dark:to-cyan-400 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0 p-1.5 border border-white/20">
            <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-xs" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-heading font-black text-base tracking-wider text-slate-900 dark:text-white">
              MTG LIMITED
            </span>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50">
              IQ
            </span>
          </div>
        </div>

        <button
          onClick={handleToggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs"
          title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {currentTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
          ) : (
            <Moon className="w-4 h-4 text-violet-700 fill-violet-700/20" />
          )}
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-5xl mx-auto w-full">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Hero Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/60 border border-violet-300 dark:border-violet-800/60 text-violet-800 dark:text-violet-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
              <span>Limited MTG Mastery Engine</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 dark:text-white font-heading tracking-tight leading-tight">
              Master MTG Draft & Sealed with Data
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Grade cards blind before spoilers, compare your evaluations directly against 17Lands GIH win rates, and drill high-discrepancy cards with active recall.
            </p>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#080d26] border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-3 text-left">
                <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-300 shrink-0">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white font-heading">Blind Card Grading</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Evaluate cards in isolation without bias before checking actual stats.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#080d26] border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-3 text-left">
                <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-300 shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white font-heading">17Lands Analytics</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Live GIH WR%, ALSA pick numbers, and automated trap/sleeper analysis.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#080d26] border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-3 text-left">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white font-heading">Mastery Drills</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Climb levels and practice targeted quizzes on cards you evaluated incorrectly.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#080d26] border border-slate-200 dark:border-slate-800 shadow-xs flex items-start gap-3 text-left">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white font-heading">Cloud Sync</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Instant cross-device synchronization of all your grades, streaks, and sets.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Auth Card Column */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
              <div className="space-y-1 mb-5">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-heading">
                  Sign In to Continue
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Log in to access all sets, evaluation tools, and draft quizzes.
                </p>
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in duration-150 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  )}
                  <span className="leading-snug">{statusMessage.text}</span>
                </div>
              )}



              {/* Auth Tab Navigation */}
              <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl gap-1 mb-5">
                <button
                  type="button"
                  onClick={() => setActiveTab('oauth')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'oauth'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Social SSO
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('magic_link')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'magic_link'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('password')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'password'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Password
                </button>
              </div>

              {/* TAB 1: OAuth SSO */}
              {activeTab === 'oauth' && (
                <div className="space-y-3">
                  <GoogleSignInButton
                    onSuccess={(user) => {
                      setStatusMessage({ type: 'success', text: `Signed in as ${user.name}!` });
                      onAuthenticated(user);
                    }}
                    onError={(err) => {
                      setStatusMessage({ type: 'error', text: err.message });
                    }}
                    onFallbackOAuth={() => handleOAuthSignIn('google')}
                    isLoading={isLoading}
                  />

                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn('discord')}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    <span>Continue with Discord</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn('apple')}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer border border-slate-700 disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2.02.6-2.66 1.34-.56.65-1.06 1.71-.93 2.73 1.01.08 2.05-.48 2.67-1.22z" />
                    </svg>
                    <span>Continue with Apple</span>
                  </button>

                  {isLocalhost() && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold text-violet-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Localhost Developer Access</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const adminUser = devQuickLogin();
                          setStatusMessage({ type: 'success', text: `Signed in as ${adminUser.name}!` });
                          onAuthenticated(adminUser);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer border border-violet-400/30"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>⚡ Dev Quick Login (Devon Byrd)</span>
                      </button>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                        Bypasses external OAuth redirects on localhost with full admin rights.
                      </p>
                    </div>
                  )}
                </div>
              )}


              {/* TAB 2: Magic Link */}
              {activeTab === 'magic_link' && (
                <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-60"
                  >
                    <span>{isLoading ? 'Sending Magic Link...' : 'Send Magic Link'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    We'll email you a password-free sign-in link.
                  </p>
                </form>
              )}

              {/* TAB 3: Password Sign In / Sign Up */}
              {activeTab === 'password' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                      className="text-xs text-violet-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
                    >
                      {authMode === 'signin' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
                    </button>
                  </div>

                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your Display Name"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-[#050818] border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-60"
                  >
                    <span>{isLoading ? 'Processing...' : (authMode === 'signin' ? 'Sign In' : 'Create Account')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {/* Legal Links Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                <button
                  type="button"
                  onClick={() => handleOpenLegal('privacy')}
                  className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleOpenLegal('terms')}
                  className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Terms of Service
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Legal Document Modal */}
      <LegalModal
        isOpen={Boolean(legalDoc)}
        initialDoc={legalDoc || 'privacy'}
        onClose={handleCloseLegal}
      />
    </div>
  );
};

export default LoginGate;
