import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Landmark,
  LoaderCircle,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './lib/supabase';
import { DEMO_ACCOUNTS, authenticateDemoUser } from './lib/demoAuth';

const AUTH_TARGET_STORAGE_KEY = 'cityeye_auth_target';
const DEMO_PRESETS = {
  citizen: { email: 'user@cityeye.kz', password: 'User2026' },
  business: { email: 'business@cityeye.kz', password: 'Business2026' },
  government: { email: 'gov@cityeye.kz', password: 'CityEye2026' },
};

const ROLE_META = {
  citizen: {
    label: 'Гражданин',
    subtitle: 'Сообщить о проблеме и следить за статусом',
    icon: UserRound,
    accent: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  business: {
    label: 'Подрядчик',
    subtitle: 'ТОО и подрядчики получают рабочие задания от акимата',
    icon: Building2,
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  government: {
    label: 'Акимат',
    subtitle: 'Отдельный gov-flow для сотрудников',
    icon: Landmark,
    accent: 'bg-violet-50 text-violet-700 border-violet-200',
  },
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.23 1.25-.94 2.3-2 3.01l3.24 2.52c1.89-1.74 2.98-4.31 2.98-7.37 0-.7-.06-1.37-.18-2.02H12z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.24-2.52c-.9.6-2.06.95-3.37.95-2.59 0-4.79-1.75-5.58-4.11H3.08v2.58A9.99 9.99 0 0012 22z" />
      <path fill="#4A90E2" d="M6.42 13.89A5.99 5.99 0 016.1 12c0-.66.11-1.3.32-1.89V7.53H3.08A9.99 9.99 0 002 12c0 1.6.38 3.11 1.08 4.47l3.34-2.58z" />
      <path fill="#FBBC05" d="M12 6a5.43 5.43 0 013.85 1.5l2.89-2.89C16.95 2.96 14.69 2 12 2a9.99 9.99 0 00-8.92 5.53l3.34 2.58C7.21 7.75 9.41 6 12 6z" />
    </svg>
  );
}

function RoleSwitch({ role, onChange, onGov }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {['citizen', 'business'].map(currentRole => {
        const meta = ROLE_META[currentRole];
        const Icon = meta.icon;

        return (
          <button
            key={currentRole}
            type="button"
            onClick={() => onChange(currentRole)}
            className={`rounded-2xl border px-3 py-2.5 text-left transition ${
              role === currentRole
                ? 'border-slate-900 bg-slate-900 text-white shadow-matte-lg'
                : 'border-white/80 bg-white/70 text-slate-700 shadow-matte hover:bg-white'
            }`}
          >
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${role === currentRole ? 'bg-white/10' : meta.accent}`}>
              <Icon size={16} />
            </span>
            <div className="mt-2 text-sm font-semibold">{meta.label}</div>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onGov}
        className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 text-left text-slate-700 shadow-matte transition hover:bg-white"
      >
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${ROLE_META.government.accent}`}>
          <Landmark size={16} />
        </span>
        <div className="mt-2 text-sm font-semibold">{ROLE_META.government.label}</div>
      </button>
    </div>
  );
}

function Field({ label, icon: Icon, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon size={16} />
        </span>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-2xl border border-white/80 bg-white/75 pl-10 pr-4 text-sm text-slate-900 shadow-matte outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
        />
      </div>
    </label>
  );
}

function DemoCard({ role, onPick }) {
  const meta = ROLE_META[role];
  const creds = DEMO_PRESETS[role];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={() => onPick(role)}
      className="rounded-2xl border border-white/80 bg-white/72 p-3 text-left shadow-matte transition hover:bg-white"
    >
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${meta.accent}`}>
          <Icon size={15} />
        </span>
        <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-500">
        <div>{creds.email}</div>
        <div>{creds.password}</div>
      </div>
    </button>
  );
}

function PendingApprovalCard({ user, onLogout, onClose }) {
  return (
    <div className="grid gap-4">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <ShieldCheck size={22} />
      </div>
      <div>
        <h2 className="text-[26px] font-bold tracking-[-0.03em] text-slate-950">
          Заявка подрядчика отправлена
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Аккаунт <strong>{user?.email}</strong> создан. Кабинет подрядчика откроется после смены статуса на <strong>active</strong>.
        </p>
      </div>

      <div className="rounded-2xl border border-white/80 bg-white/70 p-4 text-sm leading-6 text-slate-700">
        В текущем проекте contractor-профили проходят через <strong>pending_approval</strong>. Пока можно вернуться к карте или выйти из сессии.
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onClose} className="glass-button-primary px-5 py-3">
          Вернуться
        </button>
        <button type="button" onClick={onLogout} className="glass-button-secondary px-5 py-3">
          Выйти
        </button>
      </div>
    </div>
  );
}

async function fetchAuthSettings() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default function AuthPage({
  view,
  roleHint = 'citizen',
  user,
  loading = false,
  externalError,
  onViewChange,
  onRoleChange,
  onBack,
  onLogout,
  onDemoLogin,
}) {
  const [selectedRole, setSelectedRole] = useState(roleHint);
  const [formMode, setFormMode] = useState(view === 'sign-up' ? 'sign-up' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [district, setDistrict] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authSettings, setAuthSettings] = useState(null);

  useEffect(() => {
    fetchAuthSettings().then(setAuthSettings);
  }, []);

  useEffect(() => {
    if (view === 'gov') {
      setSelectedRole('government');
      return;
    }
    setSelectedRole(roleHint === 'government' ? 'citizen' : roleHint);
  }, [roleHint, view]);

  useEffect(() => {
    setFormMode(view === 'sign-up' ? 'sign-up' : 'sign-in');
    setError('');
    setNotice('');
  }, [view]);

  const googleEnabled = authSettings?.external?.google === true;
  const emailConfirmationRequired = authSettings?.mailer_autoconfirm === false;
  const showPendingBusiness = user?.role === 'business' && user?.status === 'pending_approval';
  const activeRole = view === 'gov' ? 'government' : selectedRole;
  const activeMeta = useMemo(() => ROLE_META[activeRole], [activeRole]);
  const ActiveIcon = activeMeta.icon;

  function writeAuthTarget(target) {
    if (typeof window === 'undefined') return;
    if (!target) {
      window.sessionStorage.removeItem(AUTH_TARGET_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(AUTH_TARGET_STORAGE_KEY, target);
  }

  function setDemoCredentials(role) {
    const demo = DEMO_PRESETS[role];
    setSelectedRole(role === 'government' ? 'citizen' : role);
    setEmail(demo.email);
    setPassword(demo.password);
    setError('');
    setNotice(
      role === 'government'
        ? 'Подставлены demo-реквизиты для gov-flow. Если вход не проходит, этот аккаунт ещё не создан в Supabase Auth.'
        : 'Подставлены demo-реквизиты. Если вход не проходит, demo-аккаунт не создан в текущем Supabase Auth-проекте.'
    );

    if (role === 'government') {
      onViewChange('gov');
    } else {
      onRoleChange?.(role);
      onViewChange('sign-in');
    }
  }

  function mapKnownAuthError(authError, role) {
    const message = authError?.message || 'Не удалось выполнить вход.';
    const normalized = message.toLowerCase();
    const isDemoEmail = Object.keys(DEMO_ACCOUNTS).includes(email.trim().toLowerCase());

    if (normalized.includes('invalid login credentials') && isDemoEmail) {
      return 'Demo-аккаунт не найден в текущем Supabase Auth. Его нужно создать и подтвердить отдельно.';
    }

    if (normalized.includes('email not confirmed')) {
      return 'Email ещё не подтверждён. Завершите подтверждение в письме и войдите снова.';
    }

    if (role === 'government' && normalized.includes('invalid login credentials')) {
      return 'Gov-flow не прошёл: либо аккаунт не создан в Auth, либо пароль неверный.';
    }

    return message;
  }

  async function handleGoogleAuth() {
    if (!googleEnabled) {
      setError('Google login выключен в текущем Supabase-проекте. Включите Google provider в Supabase Auth.');
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      writeAuthTarget('map');
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });

      if (authError) throw authError;
    } catch (authError) {
      writeAuthTarget(null);
      setError(mapKnownAuthError(authError, 'citizen'));
      setSubmitting(false);
    }
  }

  async function handleCitizenOrBusinessSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      if (formMode === 'sign-in') {
        const demoUser = authenticateDemoUser(email, password);
        if (demoUser) {
          onDemoLogin?.(
            demoUser,
            demoUser.role === 'business'
              ? 'business'
              : demoUser.role === 'government'
                ? 'gov'
                : 'map'
          );
          setNotice('Выполняем demo-вход…');
          return;
        }

        writeAuthTarget(selectedRole === 'business' ? 'business' : 'map');
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (authError) throw authError;
        setNotice('Подключаем сессию…');
        return;
      }

      const metadata = selectedRole === 'business'
        ? {
            requested_role: 'business',
            organization_name: organizationName.trim(),
            company_name: organizationName.trim(),
            contact_person: contactPerson.trim(),
            full_name: contactPerson.trim(),
            district: district.trim(),
          }
        : {
            requested_role: 'citizen',
            full_name: fullName.trim(),
          };

      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: metadata,
        },
      });

      if (authError) throw authError;
      writeAuthTarget(selectedRole === 'business' ? 'business' : 'map');

      if (!data.session) {
        setNotice(
          emailConfirmationRequired
            ? 'Регистрация прошла. В текущем Supabase-проекте нужно подтвердить email, только после этого вход станет активным.'
            : 'Аккаунт создан. Войдите с указанными реквизитами.'
        );
      } else {
        setNotice(selectedRole === 'business' ? 'Заявка подрядчика отправлена на подтверждение.' : 'Аккаунт создан. Подключаем сессию…');
      }
    } catch (authError) {
      writeAuthTarget(null);
      setError(mapKnownAuthError(authError, selectedRole));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGovernmentSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const demoUser = authenticateDemoUser(email, password);
      if (demoUser?.role === 'government') {
        onDemoLogin?.(demoUser, 'gov');
        setNotice('Выполняем demo-вход акимата…');
        return;
      }

      writeAuthTarget('gov');
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) throw authError;
      setNotice('Проверяем gov-доступ…');
    } catch (authError) {
      writeAuthTarget(null);
      setError(mapKnownAuthError(authError, 'government'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/28 p-4 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onBack} />

      <div className="relative z-[1] w-full max-w-[520px]">
        <div className="glass-panel-matte max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[28px] p-4 shadow-matte-xl sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {view === 'gov' ? 'Gov auth' : formMode === 'sign-up' ? 'Регистрация' : 'Вход'}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${activeMeta.accent}`}>
                  <ActiveIcon size={18} />
                </span>
                <div>
                  <h1 className="text-[28px] font-bold tracking-[-0.03em] text-slate-950">
                    {view === 'gov' ? 'Вход для акимата' : 'Войти в CityEye'}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {view === 'gov'
                      ? 'Компактный gov-flow без отдельной страницы.'
                      : activeMeta.subtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {view === 'gov' ? (
                <button type="button" onClick={() => onViewChange('sign-in')} className="glass-button-secondary px-3 py-2 text-[13px]">
                  <ArrowLeft size={14} />
                  Назад
                </button>
              ) : null}
              <button type="button" onClick={onBack} className="glass-button-secondary px-3 py-2 text-[13px]">
                <X size={14} />
                Закрыть
              </button>
            </div>
          </div>

          {showPendingBusiness ? (
            <PendingApprovalCard user={user} onLogout={onLogout} onClose={onBack} />
          ) : (
            <div className="grid gap-4">
              {view !== 'gov' ? (
                <>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/80 bg-white/60 p-1 shadow-matte">
                    {['sign-in', 'sign-up'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onViewChange(mode)}
                        className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                          formMode === mode ? 'bg-slate-900 text-white shadow-matte' : 'text-slate-600 hover:bg-white/80'
                        }`}
                      >
                        {mode === 'sign-in' ? 'Вход' : 'Регистрация'}
                      </button>
                    ))}
                  </div>

                  <RoleSwitch
                    role={selectedRole}
                    onChange={role => {
                      setSelectedRole(role);
                      onRoleChange?.(role);
                    }}
                    onGov={() => onViewChange('gov')}
                  />
                </>
              ) : null}

              <div className="rounded-2xl border border-white/80 bg-white/65 p-3.5 shadow-matte">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Быстрый тест
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <DemoCard role="citizen" onPick={setDemoCredentials} />
                  <DemoCard role="business" onPick={setDemoCredentials} />
                  <DemoCard role="government" onPick={setDemoCredentials} />
                </div>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/65 p-3.5 text-[13px] leading-6 text-slate-600 shadow-matte">
                <span className="font-semibold text-slate-900">Supabase:</span>{' '}
                Google <strong>{googleEnabled ? 'on' : 'off'}</strong>, email confirmation <strong>{emailConfirmationRequired ? 'on' : 'off'}</strong>
              </div>

              {(error || externalError || notice) ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${
                  error || externalError
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                  {error || externalError || notice}
                </div>
              ) : null}

              {view === 'gov' ? (
                <form onSubmit={handleGovernmentSubmit} className="grid gap-4">
                  <Field
                    label="Gov email"
                    icon={Mail}
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="gov@cityeye.kz"
                    autoComplete="email"
                  />
                  <Field
                    label="Пароль"
                    icon={ShieldCheck}
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                  />

                  <button type="submit" disabled={submitting || loading} className="glass-button-primary h-12 rounded-2xl">
                    {submitting || loading ? <LoaderCircle className="animate-spin" size={16} /> : <Landmark size={16} />}
                    Войти
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCitizenOrBusinessSubmit} className="grid gap-4">
                  {selectedRole === 'citizen' ? (
                    <button
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={submitting || loading || !googleEnabled}
                      className={`glass-button-secondary h-12 rounded-2xl border-white/80 bg-white/85 text-slate-800 ${!googleEnabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {submitting || loading ? <LoaderCircle className="animate-spin" size={16} /> : <GoogleIcon />}
                      {googleEnabled ? 'Войти через Google' : 'Google сейчас недоступен'}
                    </button>
                  ) : null}

                  {formMode === 'sign-up' && selectedRole === 'citizen' ? (
                    <Field
                      label="Ваше имя"
                      icon={UserRound}
                      value={fullName}
                      onChange={event => setFullName(event.target.value)}
                      placeholder="Имя и фамилия"
                      autoComplete="name"
                    />
                  ) : null}

                  {formMode === 'sign-up' && selectedRole === 'business' ? (
                    <>
                      <Field
                        label="Название компании"
                        icon={Building2}
                        value={organizationName}
                        onChange={event => setOrganizationName(event.target.value)}
                        placeholder="Название компании"
                        autoComplete="organization"
                      />
                      <Field
                        label="Контактное лицо"
                        icon={UserRound}
                        value={contactPerson}
                        onChange={event => setContactPerson(event.target.value)}
                        placeholder="Имя ответственного"
                        autoComplete="name"
                      />
                      <Field
                        label="Район"
                        icon={ShieldCheck}
                        value={district}
                        onChange={event => setDistrict(event.target.value)}
                        placeholder="Алматы"
                        autoComplete="address-level2"
                      />
                    </>
                  ) : null}

                  <Field
                    label="Email"
                    icon={Mail}
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="you@cityeye.kz"
                    autoComplete="email"
                  />
                  <Field
                    label="Пароль"
                    icon={ShieldCheck}
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Введите пароль"
                    autoComplete={formMode === 'sign-up' ? 'new-password' : 'current-password'}
                  />

                  <button type="submit" disabled={submitting || loading} className="glass-button-primary h-12 rounded-2xl">
                    {submitting || loading ? <LoaderCircle className="animate-spin" size={16} /> : <Mail size={16} />}
                    {formMode === 'sign-up' ? 'Создать аккаунт' : 'Войти'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
