import { Suspense } from 'react';
import GovPageClient from '../../components/app/GovPageClient';

function PageFallback() {
  return <div className="min-h-screen bg-[#e8eeea]" />;
}

export default function GovPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <GovPageClient />
    </Suspense>
  );
}
