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

function deriveInitials(value, fallback = 'CE') {
  const source = toNonEmptyString(value);
  if (!source) return fallback;

  const initials = source
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return initials || fallback;
}

function buildProfilePayload(authUser, { preferredRole = 'citizen', governmentAccess = null } = {}) {
  const metadata = authUser?.user_metadata ?? {};
  const email = toNonEmptyString(authUser?.email)?.toLowerCase() ?? null;
  const fullName = governmentAccess?.name || governmentAccess?.full_name || getUserMetadataName(authUser);
  const avatarValue = getUserMetadataAvatar(authUser) || deriveInitials(fullName);

  if (preferredRole === 'government') {
    return {
      id: authUser.id,
      email,
      name: fullName,
      role: 'government',
      avatar: avatarValue,
    };
  }

  if (preferredRole === 'business') {
    const businessName =
      toNonEmptyString(metadata.organization_name)
      || toNonEmptyString(metadata.company_name)
      || fullName;

    return {
      id: authUser.id,
      email,
      name: businessName,
      role: 'business',
      avatar: avatarValue,
    };
  }

  return {
    id: authUser.id,
    email,
    name: fullName,
    role: 'citizen',
    avatar: avatarValue,
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

export async function readProfileByEmail(email) {
  const normalizedEmail = toNonEmptyString(email)?.toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function checkGovernmentAllowlist(email) {
  const profile = await readProfileByEmail(email);
  return profile?.role === 'government' ? profile : null;
}

export function mapProfileToAppUser(profile) {
  if (!profile) return null;

  const role = profile.role || 'citizen';
  const displayName = profile.name || profile.full_name || profile.organization_name || 'Пользователь';

  const baseUser = {
    id: profile.id,
    email: profile.email,
    role,
    status: profile.status || 'active',
    full_name: profile.full_name || profile.name || displayName,
    organization_name: profile.organization_name || (role === 'business' ? displayName : null),
    position: profile.position || null,
    district: profile.district || null,
    avatar_url: profile.avatar_url || null,
    avatar: profile.avatar_url || profile.avatar || null,
    name:
      role === 'business'
        ? profile.organization_name || profile.name || profile.full_name || 'Подрядчик'
        : displayName,
    initials: typeof profile.avatar === 'string' && profile.avatar.length <= 4
      ? profile.avatar
      : deriveInitials(displayName),
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
