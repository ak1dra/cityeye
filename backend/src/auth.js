const DEFAULT_SUPABASE_URL = 'https://dvwfjpqbnusjegwtpyau.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mWjsSlxFpcKVUmMwwO8UpQ_SFggnJf5';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

function getBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function buildSupabaseHeaders(token, extraHeaders = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function supabaseFetch(path, { token, method = 'GET', body, headers } = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: buildSupabaseHeaders(token, headers),
    body,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const message =
      payload?.message
      || payload?.error_description
      || payload?.hint
      || payload?.details
      || payload?.error
      || 'Supabase auth request failed';

    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function fetchAuthUser(token) {
  return supabaseFetch('/auth/v1/user', { token });
}

async function fetchOwnProfile(token, userId) {
  const rows = await supabaseFetch(`/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`, {
    token,
  });

  return Array.isArray(rows) ? rows[0] ?? null : rows ?? null;
}

export function buildReportAuthorFields(profile) {
  const reporterRole = profile.role;
  const isBusiness = reporterRole === 'business';
  const userName = isBusiness
    ? profile.organization_name || profile.full_name || 'Подрядчик'
    : profile.full_name || 'Пользователь';

  return {
    user_email: profile.email,
    user_name: userName,
    reporter_role: reporterRole,
    reporter_org_name: isBusiness ? (profile.organization_name || userName) : null,
  };
}

export async function requireAuthenticatedProfile(req, res, next) {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const authUser = await fetchAuthUser(token);
    const profile = await fetchOwnProfile(token, authUser.id);

    if (!profile) {
      return res.status(403).json({ error: 'Profile not found for authenticated user' });
    }

    req.auth = {
      token,
      user: authUser,
      profile,
    };

    next();
  } catch (error) {
    const statusCode = error.statusCode || 401;
    return res.status(statusCode).json({ error: error.message || 'Failed to verify session' });
  }
}

export function requireManagedRole(req, res, next) {
  const profile = req.auth?.profile;
  if (!profile) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (profile.status !== 'active') {
    return res.status(403).json({ error: 'Account is not active' });
  }

  if (!['government', 'business'].includes(profile.role)) {
    return res.status(403).json({ error: 'Only business and government accounts can update reports' });
  }

  next();
}

export function requireReportCreator(req, res, next) {
  const profile = req.auth?.profile;
  if (!profile) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (profile.status === 'disabled') {
    return res.status(403).json({ error: 'Account is disabled' });
  }

  next();
}
