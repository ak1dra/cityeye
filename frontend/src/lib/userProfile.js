export const GOVERNMENT_PROFILE = Object.freeze({
  name: 'Ruslan Berdenov',
  position: 'Заместитель акима Алматы',
  district: 'Алматы қаласы',
  avatar: '/ruslan-avatar.jpg',
  initials: 'RB',
});

export const BUSINESS_PROFILE = Object.freeze({
  name: 'ТОО Алматы Сервис',
  position: 'Подрядчик городской инфраструктуры',
  district: 'Алматы',
  avatar: null,
  initials: 'ТА',
});

function getManagedProfile(role) {
  if (role === 'government') return GOVERNMENT_PROFILE;
  if (role === 'business') return BUSINESS_PROFILE;
  return null;
}

function deriveInitials(value, fallback = 'CE') {
  const source = typeof value === 'string' ? value.trim() : '';
  if (!source) return fallback;

  const parts = source
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return fallback;
  return parts.join('').toUpperCase();
}

export function normalizeManagedUser(user) {
  const profile = getManagedProfile(user?.role);
  if (!profile) return user;

  if (user.role === 'business') {
    const displayName = user.organization_name || user.name || BUSINESS_PROFILE.name;
    return {
      ...user,
      name: displayName,
      position: user.position || BUSINESS_PROFILE.position,
      district: user.district || BUSINESS_PROFILE.district,
      avatar: user.avatar || user.avatar_url || BUSINESS_PROFILE.avatar,
      initials: user.initials || deriveInitials(displayName, BUSINESS_PROFILE.initials),
    };
  }

  return {
    ...user,
    ...profile,
    email: user.email,
    role: user.role,
  };
}

export function isManagedUserNormalized(user) {
  const profile = getManagedProfile(user?.role);
  if (!profile) return true;

  return user.name === profile.name
    && user.position === profile.position
    && user.district === profile.district
    && user.avatar === profile.avatar
    && user.initials === profile.initials;
}

export function normalizeGovernmentUser(user) {
  if (!user || user.role !== 'government') return user;
  return normalizeManagedUser(user);
}

export function isGovernmentUserNormalized(user) {
  if (!user || user.role !== 'government') return true;
  return isManagedUserNormalized(user);
}

export function buildGovernmentUser(email) {
  return normalizeManagedUser({
    email,
    role: 'government',
  });
}

export function buildBusinessUser(email) {
  return normalizeManagedUser({
    email,
    role: 'business',
  });
}
