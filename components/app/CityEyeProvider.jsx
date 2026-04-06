'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../frontend/src/lib/supabase';
import { ensureProfileForAuthUser } from '../../frontend/src/lib/auth';
import { clearDemoUser, readDemoUser, writeDemoUser } from '../../frontend/src/lib/demoAuth';

const AUTH_TARGET_STORAGE_KEY = 'cityeye_auth_target';
const CityEyeContext = createContext(null);

function readAuthTarget() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(AUTH_TARGET_STORAGE_KEY);
}

function clearAuthTarget() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(AUTH_TARGET_STORAGE_KEY);
}

function canAccessGov(user) {
  return user?.role === 'government' && user?.status === 'active';
}

function canAccessContractor(user) {
  return user?.role === 'business' && user?.status === 'active';
}

function resolveAuthTargetHref(target, user) {
  if (target === 'gov' && canAccessGov(user)) return '/gov';
  if (target === 'business' && canAccessContractor(user)) return '/contractor';
  return '/map';
}

export function CityEyeProvider({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const hydrateAuthenticatedUser = useCallback(async (authUser, { strictGovernment = false } = {}) => {
    if (!authUser) {
      const demoUser = readDemoUser();
      setUser(demoUser);
      setAuthError('');
      return demoUser;
    }

    try {
      const profileUser = await ensureProfileForAuthUser(authUser, strictGovernment
        ? { preferredRole: 'government', strictGovernment: true }
        : {}
      );
      setUser(profileUser);
      setAuthError('');
      return profileUser;
    } catch (error) {
      clearAuthTarget();
      setUser(null);
      setAuthError(error.message || 'Не удалось загрузить профиль.');
      await supabase.auth.signOut().catch(() => {});
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    setAuthLoading(true);

    const syncSession = async session => {
      const strictGovernment = pathname === '/gov' || pathname === '/auth/gov';
      await hydrateAuthenticatedUser(session?.user ?? null, { strictGovernment });
      if (active) setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      syncSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthLoading(true);
      syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [hydrateAuthenticatedUser, pathname]);

  useEffect(() => {
    if (authLoading || !user) return;

    const authTarget = readAuthTarget();
    if (!authTarget) return;

    if (user.role === 'business' && user.status === 'pending_approval') {
      return;
    }

    clearAuthTarget();
    router.push(resolveAuthTargetHref(authTarget, user));
  }, [authLoading, router, user]);

  const logout = useCallback(async () => {
    clearAuthTarget();
    clearDemoUser();
    setAuthError('');
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    router.push('/map');
  }, [router]);

  const loginDemo = useCallback(async (demoUser, target = 'map') => {
    clearAuthTarget();
    setAuthError('');
    writeDemoUser(demoUser);
    await supabase.auth.signOut().catch(() => {});
    setUser(demoUser);
    router.push(resolveAuthTargetHref(target, demoUser));
  }, [router]);

  const value = useMemo(() => ({
    user,
    authLoading,
    authError,
    logout,
    loginDemo,
    canAccessGov: canAccessGov(user),
    canAccessContractor: canAccessContractor(user),
  }), [
    authError,
    authLoading,
    loginDemo,
    logout,
    user,
  ]);

  return (
    <CityEyeContext.Provider value={value}>
      {children}
    </CityEyeContext.Provider>
  );
}

export function useCityEye() {
  const value = useContext(CityEyeContext);
  if (!value) {
    throw new Error('useCityEye must be used within CityEyeProvider');
  }
  return value;
}
