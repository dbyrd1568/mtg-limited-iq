import { supabase } from './supabase';
import { supabaseUserToUserAccount, signInWithOAuth } from './auth';
import { setActiveUser } from './storage';
import { UserAccount } from '../types/mtg';

export const GOOGLE_CLIENT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
  '887571958598-8apf1m4sv9mdva72ii8oqmh2vunt8e93.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (notification?: any) => void;
          cancel: () => void;
        };
      };
    };
  }
}

/**
 * Ensures the Google Identity Services (gsi) script is loaded in the DOM.
 */
export function ensureGoogleScriptLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.accounts?.id) return resolve();

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      // Fallback check in case it already loaded
      setTimeout(() => resolve(), 1000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * Exchanges a Google ID Token (JWT) with Supabase for a verified session.
 * If Supabase lacks Authorized Client IDs for native token verification,
 * seamlessly falls back to standard Supabase OAuth redirect.
 */
export async function authenticateWithGoogleIdToken(idToken: string): Promise<{ user: UserAccount | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.warn('Google ID token verification failed with Supabase, falling back to OAuth redirect:', error.message);
      const oauthResult = await signInWithOAuth('google');
      if (oauthResult.error) {
        return { user: null, error: new Error(error.message) };
      }
      return { user: oauthResult.user || null, error: null };
    }
    if (!data.user) {
      return { user: null, error: new Error('No user returned from Google sign-in.') };
    }

    const account = supabaseUserToUserAccount(data.user);
    setActiveUser(account);
    return { user: account, error: null };
  } catch (err: any) {
    return { user: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Renders the official native Google Sign-In button into a DOM element.
 */
export async function renderGoogleButton(
  element: HTMLElement,
  onSuccess: (user: UserAccount) => void,
  onError: (err: Error) => void,
  theme: 'outline' | 'filled_black' | 'filled_blue' = 'filled_black'
): Promise<void> {
  await ensureGoogleScriptLoaded();

  if (!window.google?.accounts?.id) {
    onError(new Error('Google Identity Services library failed to load.'));
    return;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        if (!response.credential) {
          onError(new Error('No credential received from Google.'));
          return;
        }
        const { user, error } = await authenticateWithGoogleIdToken(response.credential);
        if (error) {
          onError(error);
        } else if (user) {
          onSuccess(user);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Clear element before rendering
    element.innerHTML = '';

    const parentWidth = element.clientWidth || element.parentElement?.clientWidth || 320;
    window.google.accounts.id.renderButton(element, {
      type: 'standard',
      shape: 'pill',
      theme,
      text: 'continue_with',
      size: 'large',
      logo_alignment: 'left',
      width: Math.max(240, Math.min(400, parentWidth)),
    });
  } catch (err: any) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

