/**
 * Environment detection utility for MTG Limited IQ.
 * 
 * Distinguishes between:
 * - Development (localhost / 127.0.0.1 / npm run dev): retains offline local multi-drafter profiles
 * - Production (Cloudflare Pages / Workers / custom domain): enforces Supabase authentication and hides local drafters
 */

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  );
}

export function isDevEnvironment(): boolean {
  if (typeof window !== 'undefined') {
    // 1. Explicit query parameter override (e.g. ?env=prod or ?env=dev)
    const params = new URLSearchParams(window.location.search);
    if (params.get('env') === 'prod') return false;
    if (params.get('env') === 'dev') return true;

    // 2. Explicit localStorage override for debugging
    try {
      const stored = localStorage.getItem('mtg_environment_mode');
      if (stored === 'prod') return false;
      if (stored === 'dev') return true;
    } catch (_) {}

    // 3. If running on localhost or 127.0.0.1, it's Dev
    if (isLocalhost()) {
      return true;
    }
  }

  // 4. Vite build mode check
  return Boolean(import.meta.env?.DEV);
}

export function isProdEnvironment(): boolean {
  return !isDevEnvironment();
}

/**
 * Checks if an ID represents a valid standard UUID v1-v5 (Supabase auth user UUID).
 */
export function isCloudUUID(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
