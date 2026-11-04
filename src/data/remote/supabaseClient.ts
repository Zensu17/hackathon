import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseClientFromEnv(
  overrideUrl?: string,
  overrideAnonKey?: string,
): SupabaseClient | null {
  const rawUrl = overrideUrl ?? import.meta.env.VITE_SUPABASE_URL ?? '';
  const rawAnonKey =
    overrideAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

  const url = rawUrl.trim();
  const anonKey = rawAnonKey.trim();

  if (url.length === 0 || anonKey.length === 0) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
