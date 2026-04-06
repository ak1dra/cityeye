'use client';

import { AppNavbar } from './AppNavbar';

export function PageLayout({ children, maxWidth = 'max-w-[1320px]', contentClassName = '' }) {
  return (
    <div className="flex min-h-screen flex-col bg-city-bg">
      <div className="border-b border-city-border bg-white/80 backdrop-blur-xl">
        <AppNavbar />
      </div>
      <main className={`mx-auto w-full flex-1 px-5 py-8 ${maxWidth} ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
}
