import { Suspense } from 'react';
import ReportPageClient from '../../components/app/ReportPageClient';

function PageFallback() {
  return <div className="min-h-screen bg-[#e8eeea]" />;
}

export default function ReportPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ReportPageClient />
    </Suspense>
  );
}
