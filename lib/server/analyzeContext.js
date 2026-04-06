import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://dvwfjpqbnusjegwtpyau.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mWjsSlxFpcKVUmMwwO8UpQ_SFggnJf5';

function toStr(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

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

function toNumberOrUndefined(value) {
  if (value == null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function buildAnalyzeContext(body = {}) {
  const imageUrl =
    toStr(body.image_url)
    || toStr(body.image_data_url)
    || toStr(body.image)
    || null;

  return {
    address: toStr(body.address),
    comment: toStr(body.comment),
    problemType: body.problemType ?? body.type ?? body.category,
    reporterRole: toStr(body.reporter_role) ?? 'citizen',
    imageUrl,
    imagePresent: Boolean(body.image_present || imageUrl),
    lat: toNumberOrUndefined(body.lat),
    lng: toNumberOrUndefined(body.lng),
  };
}

export function createOptionalSupabaseClient() {
  const url = resolveEnvValue(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    DEFAULT_SUPABASE_URL
  );

  const key = resolveEnvValue(
    process.env.SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    DEFAULT_SUPABASE_ANON_KEY
  );

  if (!url || !key) return null;
  return createClient(url, key);
}
