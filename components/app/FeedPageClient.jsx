'use client';

import { useRouter } from 'next/navigation';
import FeedTab from '../../frontend/src/tabs/FeedTab';
import { useCityEye } from './CityEyeProvider';
import { PageLayout } from './PageLayout';
import { hrefForTab } from '../../lib/client/routes';
import { useReportsResource } from './useRouteData';

export default function FeedPageClient() {
  const router = useRouter();
  const { user } = useCityEye();
  const { reports } = useReportsResource({ limit: 120, view: 'feed' });

  return (
    <PageLayout maxWidth="max-w-[1440px]" contentClassName="bg-[radial-gradient(circle_at_top_left,#f4fbff_0%,#eef4ec_68%,#f7faf7_100%)]">
      <FeedTab
        reports={reports}
        user={user}
        onTabChange={tabId => router.push(hrefForTab(tabId))}
        onOpenReportOnMap={report => router.push(`/map?report=${encodeURIComponent(report.id)}`)}
      />
    </PageLayout>
  );
}
