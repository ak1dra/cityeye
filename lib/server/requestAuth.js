import { createServerSupabaseClient } from './supabaseServer.js';

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function fetchAuthUser(token) {
  const supabase = createServerSupabaseClient({ authToken: token });
  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    throw createHttpError(error.message || 'Supabase auth request failed', error.status || 401);
  }
  return data.user ?? null;
}

async function fetchOwnProfile(token, userId) {
  const supabase = createServerSupabaseClient({ authToken: token });
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw createHttpError(error.message || 'Failed to load profile', 500);
  }

  return data ?? null;
}

async function fetchProfileByEmail(email) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalized) {
    throw createHttpError('Demo profile email is required', 401);
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();

  if (error) {
    throw createHttpError(error.message || 'Failed to load demo profile', 500);
  }

  return data ?? null;
}

export function buildReportAuthorFields(profile) {
  const reporterRole = profile.role;
  const isBusiness = reporterRole === 'business';
  const baseName = profile.full_name || profile.name || profile.organization_name || 'Пользователь';
  const userName = isBusiness
    ? profile.organization_name || profile.name || profile.full_name || 'Подрядчик'
    : baseName;

  return {
    user_email: profile.email,
    user_name: userName,
    reporter_role: reporterRole,
    reporter_org_name: isBusiness ? (profile.organization_name || userName) : null,
  };
}

export async function requireAuthenticatedRequest(request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (token) {
    const authUser = await fetchAuthUser(token);
    if (!authUser?.id) {
      throw createHttpError('Failed to verify session', 401);
    }
    const profile = await fetchOwnProfile(token, authUser.id);

    if (!profile) {
      throw createHttpError('Profile not found for authenticated user', 403);
    }

    return {
      token,
      user: authUser,
      profile,
      demo: false,
    };
  }

  const demoEmail = request.headers.get('x-cityeye-demo-user');
  if (!demoEmail) {
    throw createHttpError('Authentication required', 401);
  }

  const profile = await fetchProfileByEmail(demoEmail);

  if (!profile) {
    throw createHttpError('Demo profile not found', 403);
  }

  return {
    token: null,
    user: null,
    profile,
    demo: true,
  };
}

export function assertManagedRole(auth) {
  if (!auth?.profile) {
    throw createHttpError('Authentication required', 401);
  }

  const status = auth.profile.status ?? 'active';
  if (status !== 'active') {
    throw createHttpError('Account is not active', 403);
  }

  if (!['government', 'business'].includes(auth.profile.role)) {
    throw createHttpError('Only business and government accounts can update reports', 403);
  }
}

export function assertReportCreator(auth) {
  if (!auth?.profile) {
    throw createHttpError('Authentication required', 401);
  }

  const status = auth.profile.status ?? 'active';
  if (status === 'disabled') {
    throw createHttpError('Account is disabled', 403);
  }
}
