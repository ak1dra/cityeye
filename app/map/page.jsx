import { Suspense } from 'react';
import MapPageClient from '../../components/app/MapPageClient';

function PageFallback() {
  return <div className="min-h-screen bg-[#e8eeea]" />;
}

export default function MapPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <MapPageClient />
    </Suspense>
  );
}
