'use client';

import Link from 'next/link';
import { useCityEye } from './CityEyeProvider';
import { PageLayout } from './PageLayout';

export function ProtectedRoleGate({ role, children }) {
  const { user, authLoading } = useCityEye();

  if (authLoading) {
    return (
      <PageLayout maxWidth="max-w-[720px]">
        <div className="glass-panel-matte rounded-[28px] px-8 py-7 text-center shadow-matte-xl">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <div className="text-sm font-semibold text-slate-900">Проверяем доступ</div>
          <div className="mt-1 text-sm text-slate-500">Загружаем профиль и роль кабинета…</div>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    const href = role === 'government' ? '/auth/gov' : '/auth/sign-in?role=business';
    return (
      <PageLayout maxWidth="max-w-[720px]">
        <div className="glass-panel-matte rounded-[28px] p-8 shadow-matte-xl">
          <div className="text-[28px] font-bold tracking-[-0.03em] text-slate-950">Доступ только по роли</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Для этого кабинета нужно войти под {role === 'government' ? 'аккаунтом акимата' : 'аккаунтом подрядчика'}.
          </p>
          <div className="mt-5 flex gap-3">
            <Link href={href} className="glass-button-primary px-5 py-3">Открыть вход</Link>
            <Link href="/map" className="glass-button-secondary px-5 py-3">На карту</Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (role === 'business' && user.status === 'pending_approval') {
    return (
      <PageLayout maxWidth="max-w-[720px]">
        <div className="glass-panel-matte rounded-[28px] p-8 shadow-matte-xl">
          <div className="text-[28px] font-bold tracking-[-0.03em] text-slate-950">Заявка подрядчика ждёт подтверждения</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Кабинет подрядчика откроется после смены статуса на <strong>active</strong>.
          </p>
          <div className="mt-5">
            <Link href="/map" className="glass-button-secondary px-5 py-3">На карту</Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (user.role !== role || user.status !== 'active') {
    return (
      <PageLayout maxWidth="max-w-[720px]">
        <div className="glass-panel-matte rounded-[28px] p-8 shadow-matte-xl">
          <div className="text-[28px] font-bold tracking-[-0.03em] text-slate-950">Недостаточно прав</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Этот маршрут доступен только для роли <strong>{role === 'government' ? 'government' : 'business'}</strong>.
          </p>
          <div className="mt-5">
            <Link href="/map" className="glass-button-secondary px-5 py-3">На карту</Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  return children;
}
