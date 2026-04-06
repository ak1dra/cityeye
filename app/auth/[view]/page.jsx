import { Suspense } from 'react';
import AuthRouteClient from '../../../components/app/AuthRouteClient';

function PageFallback() {
  return <div className="min-h-screen bg-[#e8eeea]" />;
}

export default function AuthViewPage({ params }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuthRouteClient view={params.view} />
    </Suspense>
  );
}
