import React, { useState, useEffect } from 'react';
import { UserAccount } from '../../types/mtg';
import {
  signInWithOAuth,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  updateUserProfile,
  OAuthProvider,
  isCloudUUID,
} from '../../services/auth';
import {
  updateUserAccount,
  clearActiveUser,
} from '../../services/storage';
import {
  getSyncStatus,
  subscribeSyncStatus,
  getLastSyncError,
  retrySync,
  SyncStatus,
} from '../../services/cloudSync';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  X,
  User,
  LogOut,
  Mail,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Shield,
  Cloud,
  RefreshCw,
  Edit2,
  Check,
  Zap,
  ArrowRight,
  Info,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onUserChange: (user: UserAccount | null) => void;
  onRefreshStats: () => void;
}

export type TabType = 'oauth' | 'magic_link' | 'password' | 'profile';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  onRefreshStats,
}) => {
  const isCloudUser = Boolean(currentUser && (currentUser.provider !== 'local' || isCloudUUID(currentUser.id)));

  const [activeTab, setActiveTab] = useState<TabType>(
    isCloudUser ? 'profile' : 'oauth'
  );
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [avatarColor, setAvatarColor] = useState(currentUser?.avatarColor || '#8b5cf6');

  // Status & Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [currentUser?.avatarUrl]);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((s) => setSyncStatus(s));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentUser?.name || '');
      setAvatarUrl(currentUser?.avatarUrl || '');
      setAvatarColor(currentUser?.avatarColor || '#8b5cf6');
      setStatusMessage(null);
      setIsEditingProfile(false);
      if (isCloudUser) {
        setActiveTab('profile');
      } else {
        setActiveTab('oauth');
      }
    }
  }, [isOpen, currentUser, isCloudUser]);

  if (!isOpen) return null;

  // --- Auth Handlers ---
  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setIsLoading(true);
    setStatusMessage(null);
    const { user, error } = await signInWithOAuth(provider);
    setIsLoading(false);
    if (error) {
      setStatusMessage({ type: 'error', text: error.message });
    } else if (user) {
      setStatusMessage({ type: 'success', text: `Signed in as ${user.name}!` });
      onUserChange(user);
      onRefreshStats();
      setTimeout(() => onClose(), 800);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);
    const { user, error } = await signInWithMagicLink(email.trim());
    setIsLoading(false);

    if (error) {
      setStatusMessage({ type: 'error', text: error.message });
    } else if (user) {
      setStatusMessage({
        type: 'success',
        text: `Signed in as ${user.name}!`,
      });
      onUserChange(user);
      onRefreshStats();
      setTimeout(() => onClose(), 800);
    } else {
      setStatusMessage({
        type: 'success',
        text: `Magic login link sent to ${email}! Click the link in your email to sign in.`,
      });
      setEmail('');
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    if (authMode === 'signup') {
      const { user, error } = await signUpWithPassword(email.trim(), password.trim(), displayName.trim());
      setIsLoading(false);
      if (error) {
        setStatusMessage({ type: 'error', text: error.message });
      } else if (user) {
        setStatusMessage({
          type: 'success',
          text: 'Account created! Please check your email to verify your address.',
        });
        onUserChange(user);
        onRefreshStats();
      }
    } else {
      const { user, error } = await signInWithPassword(email.trim(), password.trim());
      setIsLoading(false);
      if (error) {
        setStatusMessage({ type: 'error', text: error.message });
      } else if (user) {
        setStatusMessage({ type: 'success', text: `Welcome back, ${user.name}!` });
        onUserChange(user);
        onRefreshStats();
        setTimeout(() => onClose(), 800);
      }
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    if (isCloudUser) {
      const { error } = await updateUserProfile(displayName.trim(), avatarUrl.trim() || undefined);
      if (error) {
        setStatusMessage({ type: 'error', text: error.message });
        setIsLoading(false);
        return;
      }
    }

    if (!currentUser) return;
    const updatedUser: UserAccount = {
      ...currentUser,
      name: displayName.trim() || 'User',
      avatarUrl: avatarUrl.trim() || undefined,
      avatarColor,
    };
    updateUserAccount(updatedUser);
    onUserChange(updatedUser);
    setIsLoading(false);
    setIsEditingProfile(false);
    setStatusMessage({ type: 'success', text: 'Profile updated!' });
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut();
    clearActiveUser();
    setIsLoading(false);
    onUserChange(null);
    onClose();
  };

  const handleSyncLocalData = async () => {
    if (!currentUser?.id) return;
    setIsLoading(true);
    setStatusMessage(null);
    const ok = await retrySync(currentUser.id);
    setIsLoading(false);
    onRefreshStats();
    if (ok) {
      setStatusMessage({ type: 'success', text: 'Local quiz history and card evaluations synced to cloud!' });
    } else {
      setStatusMessage({ type: 'error', text: getLastSyncError() || 'Sync encountered an error.' });
    }
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const AVATAR_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 dark:bg-[#040711]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-[96vw] max-w-lg bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#060a1d]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-600/20 border border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-cyan-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                {isCloudUser ? 'User Account' : 'Account Sign In'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isCloudUser
                  ? 'Manage user profile and sync settings'
                  : 'Sign in with your account to sync progress'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={`px-5 py-3 text-xs flex items-center gap-2 border-b animate-in fade-in duration-150 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span className="leading-tight">{statusMessage.text}</span>
          </div>
        )}

        {/* Authenticated Profile View */}
        {activeTab === 'profile' ? (
          <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
            {/* Active User Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {currentUser?.avatarUrl && !avatarError ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser?.name || 'User'}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      className="w-12 h-12 rounded-xl object-cover border border-violet-500/50 shadow-sm shrink-0"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white font-heading shadow-sm shrink-0"
                      style={{ backgroundColor: currentUser?.avatarColor || '#8b5cf6' }}
                    >
                      {(currentUser?.name || 'D').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser?.name || 'Account'}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{currentUser?.email || 'User Account'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-cyan-300 border border-violet-300 dark:border-violet-700/50">
                        {currentUser?.provider || 'cloud'}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Authenticated
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  title="Edit display name"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Sync Status Badge */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-violet-600 dark:text-cyan-400" />
                  Cloud Sync Status:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                      : syncStatus === 'syncing'
                      ? 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40'
                      : syncStatus === 'error'
                      ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                      : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                >
                  {syncStatus === 'synced' && '✓ Synced & Up to Date'}
                  {syncStatus === 'syncing' && '⟳ Syncing...'}
                  {syncStatus === 'offline' && '☁ Offline (Saved Locally)'}
                  {syncStatus === 'local_only' && 'Local Storage Only'}
                  {syncStatus === 'error' && '⚠ Sync Error'}
                </span>
              </div>

              {/* Sync Error Alert with 1-Click Retry */}
              {syncStatus === 'error' && (
                <div className="pt-2 border-t border-rose-200 dark:border-rose-800/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 truncate">
                    {getLastSyncError() || 'Sync interrupted. Local data is safe.'}
                  </span>
                  <button
                    type="button"
                    onClick={handleSyncLocalData}
                    disabled={isLoading}
                    className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer shrink-0 shadow-2xs"
                  >
                    Retry Sync
                  </button>
                </div>
              )}
            </div>

            {/* Edit Profile Form */}
            {isEditingProfile ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#070c26] border border-violet-300 dark:border-violet-500/40 space-y-3 animate-in fade-in duration-150">
                <div className="text-xs font-bold text-slate-900 dark:text-white font-heading">Edit Profile</div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#050818] border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Avatar URL (Optional)</label>
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-white dark:bg-[#050818] border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Avatar Color Theme</label>
                  <div className="flex items-center gap-2 pt-1">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                          avatarColor === c ? 'border-violet-600 dark:border-white scale-110 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              {isCloudUser && (
                <button
                  onClick={handleSyncLocalData}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-[#050818] hover:bg-slate-200 dark:hover:bg-[#0c1236] border border-slate-300 dark:border-slate-800 hover:border-violet-500 dark:hover:border-cyan-500/40 text-xs font-semibold text-violet-700 dark:text-cyan-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-violet-600 dark:text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Upload & Sync All Local History to Cloud</span>
                </button>
              )}

              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* Profile Switcher & Sign-in Tabs */
          <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            {/* Top link if cloud user navigated here */}
            {isCloudUser && (
              <div className="flex items-center justify-between pb-1">
                <button
                  onClick={() => setActiveTab('profile')}
                  className="text-xs text-violet-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <span>← Back to Active Profile</span>
                </button>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl gap-1">
              <button
                onClick={() => setActiveTab('oauth')}
                className={`py-1.5 px-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center truncate ${
                  activeTab === 'oauth'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                OAuth SSO
              </button>
              <button
                onClick={() => setActiveTab('magic_link')}
                className={`py-1.5 px-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center truncate ${
                  activeTab === 'magic_link'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Magic Link
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`py-1.5 px-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center truncate ${
                  activeTab === 'password'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Password
              </button>
            </div>

            {/* TAB 1: OAuth Providers */}
            {activeTab === 'oauth' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  1-Click authentication with zero passwords to remember:
                </p>

                {/* Google SSO */}
                <GoogleSignInButton
                  onSuccess={(user) => {
                    setStatusMessage({ type: 'success', text: `Signed in as ${user.name}!` });
                    onUserChange(user);
                    onRefreshStats();
                    setTimeout(() => onClose(), 800);
                  }}
                  onError={(err) => {
                    setStatusMessage({ type: 'error', text: err.message });
                  }}
                  onFallbackOAuth={() => handleOAuthSignIn('google')}
                  isLoading={isLoading}
                />

                {/* Discord SSO */}
                <button
                  onClick={() => handleOAuthSignIn('discord')}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-2xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  <span>Continue with Discord</span>
                </button>

                {/* Apple SSO */}
                <button
                  onClick={() => handleOAuthSignIn('apple')}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-2xl bg-black hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer border border-slate-700 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2.02.6-2.66 1.34-.56.65-1.06 1.71-.93 2.73 1.01.08 2.05-.48 2.67-1.22z" />
                  </svg>
                  <span>Continue with Apple</span>
                </button>
              </div>
            )}

            {/* TAB 2: Magic Link (Passwordless) */}
            {activeTab === 'magic_link' && (
              <form onSubmit={handleMagicLink} className="space-y-3.5">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Enter your email address and we'll send you an instant login link:
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#050818] border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 dark:to-cyan-600 hover:from-violet-500 hover:to-indigo-500 dark:hover:to-cyan-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Send Magic Link</span>
                </button>
              </form>
            )}

            {/* TAB 3: Email + Password */}
            {activeTab === 'password' && (
              <form onSubmit={handlePasswordAuth} className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">
                    {authMode === 'signin' ? 'Sign In With Password' : 'Create Account'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                    className="text-xs text-violet-700 dark:text-cyan-400 hover:underline cursor-pointer font-semibold"
                  >
                    {authMode === 'signin' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
                  </button>
                </div>

                {authMode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Display Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Your Name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#050818] border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#050818] border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#050818] border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 dark:to-cyan-600 hover:from-violet-500 hover:to-indigo-500 dark:hover:to-cyan-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                </button>
              </form>
            )}

            {/* Return Footnote */}
            {currentUser && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-300 font-medium cursor-pointer inline-flex items-center gap-1"
                >
                  <span>Continue playing with active account ({currentUser.name})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
