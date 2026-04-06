'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { hrefForTab } from '../../lib/client/routes';
import { useCityEye } from './CityEyeProvider';
import { ProtectedRoleGate } from './ProtectedRoleGate';
import { useAnalyticsOverview, useReportsResource } from './useRouteData';

const Dashboard = dynamic(() => import('../../frontend/src/tabs/Dashboard'), {
  ssr: false,
  loading: () => <div className="min-h-[60vh] rounded-[28px] bg-white/55" />,
});

export default function GovPageClient() {
  const router = useRouter();
  const { logout, user } = useCityEye();
  const accessGranted = user?.role === 'government' && user?.status === 'active';
  const { reports, loading: reportsLoading, refresh: refreshReports } = useReportsResource(
    { limit: 220, view: 'gov' },
    { enabled: accessGranted }
  );
  const { analyticsOverview, refresh: refreshAnalytics } = useAnalyticsOverview({ enabled: accessGranted });

  async function handleRefresh() {
    await Promise.all([
      refreshReports({ silent: true }).catch(() => {}),
      refreshAnalytics({ silent: true }).catch(() => {}),
    ]);
  }

  return (
    <ProtectedRoleGate role="government">
      <Dashboard
        reports={reports}
        analyticsOverview={analyticsOverview}
        loading={reportsLoading}
        onStatusChange={handleRefresh}
        onTabChange={tabId => router.push(hrefForTab(tabId))}
        user={user}
        onLogout={logout}
      />
    </ProtectedRoleGate>
  );
}
