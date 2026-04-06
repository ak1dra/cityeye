'use client';

import { useRouter } from 'next/navigation';
import ReportTab from '../../frontend/src/tabs/ReportTab';
import { useCityEye } from './CityEyeProvider';
import { PageLayout } from './PageLayout';
import { hrefForAuthView } from '../../lib/client/routes';

export default function ReportPageClient() {
  const router = useRouter();
  const { user } = useCityEye();

  return (
    <PageLayout maxWidth="max-w-[960px]">
      <ReportTab
        user={user}
        onNewReport={() => {}}
        onRequireAuth={(view = 'sign-in', roleHint = 'citizen') => router.push(hrefForAuthView(view, roleHint))}
      />
    </PageLayout>
  );
}
