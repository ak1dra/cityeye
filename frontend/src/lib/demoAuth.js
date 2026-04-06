import { buildBusinessUser, buildGovernmentUser } from './userProfile';

export const DEMO_USER_STORAGE_KEY = 'cityeye_demo_user';

export const DEMO_PRESETS = {
  citizen: {
    role: 'citizen',
    label: 'Житель',
    email: 'user@cityeye.kz',
    password: 'User2026',
    name: 'Аскар Нурланов',
  },
  business: {
    role: 'business',
    label: 'Подрядчик',
    email: 'business@cityeye.kz',
    password: 'Business2026',
    name: 'Кафе Урюк',
  },
  government: {
    role: 'government',
    label: 'Акимат',
    email: 'gov@cityeye.kz',
    password: 'CityEye2026',
    name: 'Акимат Алматы',
  },
};

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function buildDemoUser(role) {
  const preset = DEMO_PRESETS[role];
  if (!preset) return null;

  if (role === 'government') {
    return {
      ...buildGovernmentUser(preset.email),
      id: `demo:${preset.email}`,
      email: preset.email,
      role: 'government',
      status: 'active',
      demo: true,
      name: preset.name,
    };
  }

  if (role === 'business') {
    return {
      ...buildBusinessUser(preset.email),
      id: `demo:${preset.email}`,
      email: preset.email,
      role: 'business',
      status: 'active',
      demo: true,
      name: preset.name,
      organization_name: preset.name,
    };
  }

  return {
    id: `demo:${preset.email}`,
    email: preset.email,
    role: 'citizen',
    status: 'active',
    demo: true,
    name: preset.name,
    full_name: preset.name,
    initials: 'АН',
  };
}

export function readDemoUser() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed?.email && parsed?.role ? parsed : null;
}

export function writeDemoUser(user) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearDemoUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
}

export function isDemoUser(user) {
  return Boolean(user?.demo);
}
