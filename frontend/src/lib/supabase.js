import { createClient } from '@supabase/supabase-js';

function isPlaceholder(value) {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('your_');
}

function resolveEnvValue(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || isPlaceholder(trimmed)) return fallback;
  return trimmed;
}

export const SUPABASE_URL =
  resolveEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    'https://dvwfjpqbnusjegwtpyau.supabase.co'
  );

export const SUPABASE_ANON_KEY =
  resolveEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'sb_publishable_mWjsSlxFpcKVUmMwwO8UpQ_SFggnJf5'
  );

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
