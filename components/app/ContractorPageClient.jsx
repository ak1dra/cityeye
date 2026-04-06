'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { hrefForTab } from '../../lib/client/routes';
import { useCityEye } from './CityEyeProvider';
import { PageLayout } from './PageLayout';
import { ProtectedRoleGate } from './ProtectedRoleGate';
import { useReportsResource } from './useRouteData';

const BusinessDashboard = dynamic(() => import('../../frontend/src/tabs/BusinessDashboard'), {
  ssr: false,
  loading: () => <div className="min-h-[60vh] rounded-[28px] bg-white/55" />,
});

export default function ContractorPageClient() {
  const router = useRouter();
  const { user } = useCityEye();
  const accessGranted = user?.role === 'business' && user?.status === 'active';
  const { reports, refresh } = useReportsResource({
    view: 'contractor',
    responsible_role: ['business', 'shared'],
    limit: 220,
  }, { enabled: accessGranted });

  return (
    <ProtectedRoleGate role="business">
      <PageLayout maxWidth="max-w-[1480px]" contentClassName="bg-[radial-gradient(circle_at_top_left,#f4fbff_0%,#eef4ec_68%,#f7faf7_100%)]">
        <BusinessDashboard
          reports={reports}
          user={user}
          onTabChange={tabId => router.push(hrefForTab(tabId))}
          onStatusChange={() => refresh({ silent: true }).catch(() => {})}
        />
      </PageLayout>
    </ProtectedRoleGate>
  );
}
