import { supabase } from './supabase';
import { normalizeManagedUser } from './userProfile';

function toNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getUserMetadataName(authUser) {
  const metadata = authUser?.user_metadata ?? {};
  return (
    toNonEmptyString(metadata.full_name)
    || toNonEmptyString(metadata.name)
    || toNonEmptyString(metadata.display_name)
    || toNonEmptyString(metadata.user_name)
    || toNonEmptyString(authUser?.email?.split('@')[0])
    || 'Пользователь'
  );
}

function getUserMetadataAvatar(authUser) {
  const metadata = authUser?.user_metadata ?? {};
  return (
    toNonEmptyString(metadata.avatar_url)
    || toNonEmptyString(metadata.picture)
    || null
  );
}

function buildProfilePayload(authUser, { preferredRole = 'citizen', governmentAccess = null } = {}) {
  const metadata = authUser?.user_metadata ?? {};
  const email = toNonEmptyString(authUser?.email)?.toLowerCase() ?? null;
  const fullName = governmentAccess?.full_name || getUserMetadataName(authUser);
  const avatarUrl = getUserMetadataAvatar(authUser);

  if (preferredRole === 'government') {
    return {
      id: authUser.id,
      email,
      role: 'government',
      status: 'active',
      full_name: fullName,
      avatar_url: avatarUrl,
      organization_name: null,
      position: governmentAccess?.position ?? toNonEmptyString(metadata.position),
      district: governmentAccess?.district ?? toNonEmptyString(metadata.district),
    };
  }

  if (preferredRole === 'business') {
    return {
      id: authUser.id,
      email,
      role: 'business',
      status: 'pending_approval',
      full_name: toNonEmptyString(metadata.contact_person) || fullName,
      avatar_url: avatarUrl,
      organization_name:
        toNonEmptyString(metadata.organization_name)
        || toNonEmptyString(metadata.company_name)
        || 'Business account',
      position: toNonEmptyString(metadata.position) || 'Управляющая компания',
      district: toNonEmptyString(metadata.district),
    };
  }

  return {
    id: authUser.id,
    email,
    role: 'citizen',
    status: 'active',
    full_name: fullName,
    avatar_url: avatarUrl,
    organization_name: null,
    position: null,
    district: toNonEmptyString(metadata.district),
  };
}

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function readProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function checkGovernmentAllowlist(email) {
  if (!email) return null;

  const { data, error } = await supabase.rpc('check_gov_allowlist', {
    candidate_email: email.toLowerCase(),
  });

  if (error) throw error;

  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

export function mapProfileToAppUser(profile) {
  if (!profile) return null;

  const baseUser = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    full_name: profile.full_name,
    organization_name: profile.organization_name,
    position: profile.position,
    district: profile.district,
    avatar_url: profile.avatar_url,
    avatar: profile.avatar_url,
    name:
      profile.role === 'business'
        ? profile.organization_name || profile.full_name || 'Подрядчик'
        : profile.full_name || 'Пользователь',
  };

  return normalizeManagedUser(baseUser);
}

export async function ensureProfileForAuthUser(authUser, { preferredRole, strictGovernment = false } = {}) {
  if (!authUser?.id) return null;

  const existingProfile = await readProfile(authUser.id);
  if (existingProfile) {
    if (
      strictGovernment
      && (existingProfile.role !== 'government' || existingProfile.status !== 'active')
    ) {
      const error = new Error('Нет доступа к gov account');
      error.code = 'gov_access_denied';
      throw error;
    }
    return mapProfileToAppUser(existingProfile);
  }

  const governmentAccess = await checkGovernmentAllowlist(authUser.email);
  if (strictGovernment && !governmentAccess) {
    const error = new Error('Нет доступа к gov account');
    error.code = 'gov_access_denied';
    throw error;
  }

  let nextRole = preferredRole;
  if (!nextRole) {
    if (governmentAccess) {
      nextRole = 'government';
    } else {
      nextRole = authUser.user_metadata?.requested_role === 'business' ? 'business' : 'citizen';
    }
  }

  if (nextRole === 'government' && !governmentAccess) {
    const error = new Error('Нет доступа к gov account');
    error.code = 'gov_access_denied';
    throw error;
  }

  const payload = buildProfilePayload(authUser, {
    preferredRole: nextRole,
    governmentAccess,
  });

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return mapProfileToAppUser(data);
}
