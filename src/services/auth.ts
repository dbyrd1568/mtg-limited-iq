import { supabase, isSupabaseConfigured } from './supabase';
import { UserAccount } from '../types/mtg';
import { User, Session } from '@supabase/supabase-js';
import {
  getAllUsers,
  createLocalUser,
  setActiveUser,
  updateUserAccount,
  loginWithOAuthProvider,
} from './storage';

export type OAuthProvider = 'google' | 'discord' | 'apple' | 'github';

import { isCloudUUID, isProdEnvironment } from './environment';
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
    meta.user_name ||
    user.email?.split('@')[0] ||
    'Drafter';
  const avatarUrl = meta.avatar_url || meta.picture || undefined;

  let mappedProvider: UserAccount['provider'] = 'email';
  if (provider === 'google') mappedProvider = 'google';
  else if (provider === 'discord') mappedProvider = 'discord';
  else if (provider === 'apple') mappedProvider = 'apple';
  else if (provider === 'github') mappedProvider = 'github';

  const avatarColor =
    provider === 'discord'
      ? '#5865F2'
      : provider === 'google'
      ? '#3b82f6'
      : provider === 'github'
      ? '#24292e'
      : '#8b5cf6';

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
    // Offline / Local development fallback: simulated 1-click login
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    const mockUser = loginWithOAuthProvider(provider as any, {
      id: `local_${provider}_${Date.now()}`,
      name: `${providerName} Drafter`,
      email: `drafter@${provider}.local`,
    });
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
    // Local fallback: log in immediately with local user
    const name = email.includes('@') ? email.split('@')[0] : email;
    const users = getAllUsers();
    const existing = users.find(
      (u) => (u.email && u.email.toLowerCase() === email.toLowerCase()) || u.name.toLowerCase() === email.toLowerCase()
    );
    const targetUser = existing || createLocalUser(name);
    if (!targetUser.email && email.includes('@')) {
      targetUser.email = email;
      updateUserAccount(targetUser);
    }
    setActiveUser(targetUser);
    return { user: targetUser, error: null };
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
    // Local fallback: authenticate or switch to local profile
    const users = getAllUsers();
    const clean = email.trim().toLowerCase();
    const existing = users.find(
      (u) => (u.email && u.email.toLowerCase() === clean) || u.name.toLowerCase() === clean
    );
    if (existing) {
      setActiveUser(existing);
      return { user: existing, error: null };
    }
    const name = email.includes('@') ? email.split('@')[0] : email;
    const newUser = createLocalUser(name);
    if (email.includes('@')) {
      newUser.email = email;
      updateUserAccount(newUser);
    }
    setActiveUser(newUser);
    return { user: newUser, error: null };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { user: null, error: new Error(error.message) };
    if (!data.user) return { user: null, error: new Error('No user returned.') };

    return { user: supabaseUserToUserAccount(data.user), error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

export async function signUpWithPassword(email: string, password: string, displayName?: string): Promise<{ user: UserAccount | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const name = displayName?.trim() || (email.includes('@') ? email.split('@')[0] : email);
    const newUser = createLocalUser(name);
    if (email.includes('@')) {
      newUser.email = email;
      updateUserAccount(newUser);
    }
    setActiveUser(newUser);
    return { user: newUser, error: null };
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

    return { user: supabaseUserToUserAccount(data.user), error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

export async function signOut(): Promise<{ error: Error | null }> {
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
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });
    }

    return { error: null };
  } catch (err: any) {
    return { error: err };
  }
}
