import { Suspense } from 'react';
import FeedPageClient from '../../components/app/FeedPageClient';

function PageFallback() {
  return <div className="min-h-screen bg-[#e8eeea]" />;
}

export default function FeedPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <FeedPageClient />
    </Suspense>
  );
}
