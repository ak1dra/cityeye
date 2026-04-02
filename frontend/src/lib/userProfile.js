export const GOVERNMENT_PROFILE = Object.freeze({
  name: 'Ruslan Berdenov',
  position: 'Заместитель акима Алматы',
  district: 'Алматы қаласы',
  avatar: '/ruslan-avatar.jpg',
  initials: 'RB',
});

export const BUSINESS_PROFILE = Object.freeze({
  name: 'УК Алматы Сервис',
  position: 'Управляющая компания',
  district: 'Алматы',
  avatar: null,
  initials: 'УК',
});

function getManagedProfile(role) {
  if (role === 'government') return GOVERNMENT_PROFILE;
  if (role === 'business') return BUSINESS_PROFILE;
  return null;
}

export function normalizeManagedUser(user) {
  const profile = getManagedProfile(user?.role);
  if (!profile) return user;

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
