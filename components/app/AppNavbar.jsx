'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCityEye } from './CityEyeProvider';

const NAV_ITEMS = [
  { href: '/map', label: 'Карта' },
  { href: '/feed', label: 'Лента' },
  { href: '/report', label: 'Обращение' },
  { href: '/gov', label: 'Панель управления', managed: 'government' },
  { href: '/contractor', label: 'Подрядчик', managed: 'business' },
];

function managedSubtitle(user) {
  if (user?.role === 'government') return 'Зам. акима Алматы';
  if (user?.role === 'business') return user.position ?? 'Подрядчик городской инфраструктуры';
  return null;
}

export function AppNavbar({ floating = false }) {
  const pathname = usePathname();
  const { user, logout } = useCityEye();

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.managed) return true;
    return user?.role === item.managed && user?.status === 'active';
  });

  return (
    <header
      className={
        floating
          ? 'glass-panel-matte absolute inset-x-4 top-4 z-30 flex h-[60px] items-center justify-between px-5'
          : 'glass-navbar flex items-center justify-between px-5'
      }
    >
      <Link href="/map" className="text-[15px] font-bold tracking-[-0.3px] text-city-text">
        CityEye
      </Link>

      <nav className="flex gap-1.5 rounded-full bg-white/40 px-1.5 py-1">
        {visibleItems.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-[13px] transition ${
                active
                  ? 'bg-white text-city-text shadow-matte'
                  : 'bg-transparent text-city-subtle hover:text-city-text'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5">
        {user ? (
          <>
            <div className="hidden text-right leading-[1.25] sm:block">
              <div className="text-[13px] font-semibold text-city-text">{user.name || user.full_name || user.email}</div>
              <div className="text-[11px] text-city-subtle">{managedSubtitle(user) || user.email}</div>
            </div>
            <button onClick={logout} className="glass-button-secondary px-3 py-1.5 text-[13px]">
              Выйти
            </button>
          </>
        ) : (
          <Link href="/auth/sign-in" className="glass-button-primary px-4 py-2 text-[13px]">
            Войти в кабинет
          </Link>
        )}
      </div>
    </header>
  );
}
