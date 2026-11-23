import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnvConfig {
  readonly url: string;
  readonly anonKey: string;
}

export type SupabaseClientLoader = () => Promise<SupabaseClient>;

export function resolveSupabaseConfigFromEnv(
  overrideUrl?: string,
  overrideAnonKey?: string,
): SupabaseEnvConfig | null {
  const rawUrl = overrideUrl ?? import.meta.env.VITE_SUPABASE_URL ?? '';
  const rawAnonKey =
    overrideAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

  const url = rawUrl.trim();
  const anonKey = rawAnonKey.trim();

  if (url.length === 0 || anonKey.length === 0) {
    return null;
  }

  return { url, anonKey };
}

// Dynamically import @supabase/supabase-js only when remote credentials exist so local/offline mode never downloads vendor-supabase.
export function createLazySupabaseClientLoader(
  config: SupabaseEnvConfig,
): SupabaseClientLoader {
  let clientPromise: Promise<SupabaseClient> | null = null;
  return () => {
    if (!clientPromise) {
      clientPromise = import('@supabase/supabase-js').then(
        ({ createClient }) =>
          createClient(config.url, config.anonKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
            },
          }),
      );
    }
    return clientPromise;
  };
}
