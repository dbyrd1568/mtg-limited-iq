import { supabase, isSupabaseConfigured } from './supabase';
import { UserAccount } from '../types/mtg';
import { User, Session } from '@supabase/supabase-js';
import {
  setActiveUser,
  clearActiveUser,
} from './storage';

export type OAuthProvider = 'google' | 'discord' | 'apple';

import { isCloudUUID, isProdEnvironment, isLocalhost } from './environment';
export { isCloudUUID };

export interface AuthState {
  user: UserAccount | null;
  session: Session | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isLoading: boolean;
}

export function supabaseUserToUserAccount(user: User): UserAccount {
  const meta = user.user_metadata || {};
  const provider = (user.app_metadata?.provider as any) || 'email';
  const name =
    meta.full_name ||
    meta.name ||
    user.email?.split('@')[0] ||
    'Drafter';

  const avatarUrl = meta.avatar_url || meta.picture || undefined;

  // Generate a consistent vibrant color from user ID
  const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
  let hash = 0;
  for (let i = 0; i < user.id.length; i++) {
    hash = (hash << 5) - hash + user.id.charCodeAt(i);
  }
  const avatarColor = colors[Math.abs(hash) % colors.length];

  const mappedProvider: 'google' | 'discord' | 'apple' | 'email' =
    provider === 'google' || provider === 'discord' || provider === 'apple'
      ? provider
      : 'email';

  return {
    id: user.id,
    name,
    email: user.email,
    avatarUrl,
    avatarColor,
    provider: mappedProvider,
    createdAt: user.created_at,
    lastLoginAt: new Date().toISOString(),
  };
}

export async function signInWithOAuth(provider: OAuthProvider): Promise<{ user?: UserAccount; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    // Offline development fallback: simulated 1-click login without Supabase credentials
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    const isGoogleAdmin = provider === 'google';
    const mockUser: UserAccount = {
      id: isGoogleAdmin ? 'admin_owner_01' : `local_${provider}_${Date.now()}`,
      name: isGoogleAdmin ? 'Devon Byrd (Local Admin)' : `${providerName} User`,
      email: isGoogleAdmin ? 'dbyrd1568@gmail.com' : `user@${provider}.local`,
      avatarColor: provider === 'discord' ? '#5865F2' : provider === 'google' ? '#3b82f6' : '#1c1c1e',
      provider,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    setActiveUser(mockUser);
    return { user: mockUser, error: null };
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error ? new Error(error.message) : null };
  } catch (err: any) {
    return { error: err };
  }
}

export async function signInWithMagicLink(email: string): Promise<{ user?: UserAccount; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const name = email.includes('@') ? email.split('@')[0] : email;
    const isDevon = email.trim().toLowerCase() === 'dbyrd1568@gmail.com';
    const localUser: UserAccount = {
      id: isDevon ? 'admin_owner_01' : `local_user_${Date.now()}`,
      name: isDevon ? 'Devon Byrd (Local Admin)' : name,
      email: email.trim(),
      avatarColor: '#8b5cf6',
      provider: 'email',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    setActiveUser(localUser);
    return { user: localUser, error: null };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error ? new Error(error.message) : null };
  } catch (err: any) {
    return { error: err };
  }
}

export async function signInWithPassword(email: string, password: string): Promise<{ user: UserAccount | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const name = email.includes('@') ? email.split('@')[0] : email;
    const isDevon = email.trim().toLowerCase() === 'dbyrd1568@gmail.com';
    const localUser: UserAccount = {
      id: isDevon ? 'admin_owner_01' : `local_user_${Date.now()}`,
      name: isDevon ? 'Devon Byrd (Local Admin)' : name,
      email: email.trim(),
      avatarColor: '#8b5cf6',
      provider: 'email',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    setActiveUser(localUser);
    return { user: localUser, error: null };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { user: null, error: new Error(error.message) };
    if (!data.user) return { user: null, error: new Error('No user returned.') };

    const account = supabaseUserToUserAccount(data.user);
    setActiveUser(account);
    return { user: account, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

export async function signUpWithPassword(email: string, password: string, displayName?: string): Promise<{ user: UserAccount | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const name = displayName?.trim() || (email.includes('@') ? email.split('@')[0] : email);
    const localUser: UserAccount = {
      id: `local_user_${Date.now()}`,
      name,
      email: email.trim(),
      avatarColor: '#8b5cf6',
      provider: 'email',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    setActiveUser(localUser);
    return { user: localUser, error: null };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName?.trim() || email.split('@')[0],
        },
      },
    });
    if (error) return { user: null, error: new Error(error.message) };
    if (!data.user) return { user: null, error: new Error('No user returned.') };

    const account = supabaseUserToUserAccount(data.user);
    setActiveUser(account);
    return { user: account, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

export async function signOut(): Promise<{ error: Error | null }> {
  clearActiveUser();
  if (!isSupabaseConfigured()) {
    return { error: null };
  }
  try {
    const { error } = await supabase.auth.signOut();
    return { error: error ? new Error(error.message) : null };
  } catch (err: any) {
    return { error: err };
  }
}

export async function getCurrentUser(): Promise<UserAccount | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user ? supabaseUserToUserAccount(user) : null;
  } catch (e) {
    return null;
  }
}

export async function updateUserProfile(displayName?: string, avatarUrl?: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) return { error: null };
  try {
    const updates: any = {};
    if (displayName) updates.full_name = displayName;
    if (avatarUrl) updates.avatar_url = avatarUrl;

    const { error: authErr } = await supabase.auth.updateUser({
      data: updates,
    });
    if (authErr) return { error: new Error(authErr.message) };

    const { data: { user } } = await supabase.auth.getUser();
    if (user && isCloudUUID(user.id)) {
      await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: displayName,
          email: user.email,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });
    }

    return { error: null };
  } catch (err: any) {
    return { error: err };
  }
}
