import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://dvwfjpqbnusjegwtpyau.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mWjsSlxFpcKVUmMwwO8UpQ_SFggnJf5';

function isPlaceholder(value) {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('your_');
}

function resolveEnvValue(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || isPlaceholder(trimmed)) continue;
    return trimmed;
  }
  return null;
}

export const SUPABASE_URL = resolveEnvValue(
  process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  DEFAULT_SUPABASE_URL
).replace(/\/$/, '');

export const SUPABASE_ANON_KEY = resolveEnvValue(
  process.env.SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_ANON_KEY
);

export function createServerSupabaseClient({ authToken = null } = {}) {
  const globalHeaders = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: globalHeaders,
    },
  });
}
