import { Suspense } from 'react';
import ContractorPageClient from '../../components/app/ContractorPageClient';

function PageFallback() {
  return <div className="min-h-screen bg-[#e8eeea]" />;
}

export default function ContractorPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ContractorPageClient />
    </Suspense>
  );
}
