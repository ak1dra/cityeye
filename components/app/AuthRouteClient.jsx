'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import AuthPage from '../../frontend/src/AuthPage';
import { hrefForAuthView } from '../../lib/client/routes';
import { useCityEye } from './CityEyeProvider';

const VALID_VIEWS = new Set(['sign-in', 'sign-up', 'gov']);

export default function AuthRouteClient({ view }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authError, authLoading, loginDemo, logout, user } = useCityEye();
  const safeView = VALID_VIEWS.has(view) ? view : 'sign-in';
  const roleHint = safeView === 'gov'
    ? 'government'
    : (searchParams.get('role') === 'business' ? 'business' : 'citizen');

  return (
    <AuthPage
      view={safeView}
      roleHint={roleHint}
      user={user}
      loading={authLoading}
      externalError={authError}
      onViewChange={nextView => router.push(hrefForAuthView(nextView, roleHint))}
      onRoleChange={() => {}}
      onBack={() => router.push('/map')}
      onLogout={logout}
      onDemoLogin={loginDemo}
    />
  );
}
