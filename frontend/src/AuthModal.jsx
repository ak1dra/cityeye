import { useState } from 'react';
import { buildBusinessUser, buildGovernmentUser } from './lib/userProfile';

const ACCOUNTS = {
  'gov@cityeye.kz':  { password: 'CityEye2026', role: 'government' },
  'user@cityeye.kz': { password: 'User2026',    role: 'citizen' },
  'business@cityeye.kz': { password: 'Business2026', role: 'business' },
};

const ROLE_LABEL = {
  citizen: 'Гражданин',
  government: 'Гос. служащий',
  business: 'Подрядчик',
};

export default function AuthModal({ onClose, onLogin }) {
  const [step, setStep]         = useState(1);
  const [role, setRole]         = useState(null);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  function selectRole(r) {
    setRole(r);
    setStep(2);
    setError('');
  }

  function handleLogin(e) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const acc = ACCOUNTS[normalizedEmail];
    if (!acc || acc.password !== password) {
      setError('Неверный email или пароль');
      return;
    }
    const user = acc.role === 'government'
      ? buildGovernmentUser(normalizedEmail)
      : acc.role === 'business'
        ? buildBusinessUser(normalizedEmail)
        : {
            email: normalizedEmail,
            role: 'citizen',
            name: 'Гражданин',
          };
    localStorage.setItem('cityeye_user', JSON.stringify(user));
    onLogin(user);
    onClose();
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '32px 28px',
        width: 500, maxWidth: '92vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        position: 'relative',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,0,0,0.06)', border: 'none',
            borderRadius: 8, width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#666', fontSize: 16,
          }}
        >
          ×
        </button>

        {step === 1 ? (
          <>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f0f0f', marginBottom: 6 }}>
              Войти в аккаунт
            </div>
            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 24 }}>
              Выберите тип аккаунта
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {/* Гражданин */}
              <RoleCard
                label="Гражданин"
                iconColor="#3B82F6"
                iconBg="rgba(59,130,246,0.1)"
                onClick={() => selectRole('citizen')}
                icon={
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                }
              />
              {/* Гос. служащий */}
              <RoleCard
                label="Гос. служащий"
                iconColor="#16a34a"
                iconBg="rgba(34,197,94,0.1)"
                onClick={() => selectRole('government')}
                icon={
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="9" width="18" height="13" rx="2"/>
                    <path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/>
                  </svg>
                }
              />

              {/* Подрядчик */}
              <RoleCard
                label="Подрядчик"
                iconColor="#0f766e"
                iconBg="rgba(15,118,110,0.1)"
                onClick={() => selectRole('business')}
                icon={
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18" />
                    <path d="M5 21V7l8-4 6 4v14" />
                    <path d="M9 9h.01" />
                    <path d="M9 13h.01" />
                    <path d="M9 17h.01" />
                    <path d="M15 9h.01" />
                    <path d="M15 13h.01" />
                    <path d="M15 17h.01" />
                  </svg>
                }
              />
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => { setStep(1); setError(''); }}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: '#888', fontSize: '0.82rem', marginBottom: 18,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Назад
            </button>

            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f0f0f', marginBottom: 4 }}>
              {ROLE_LABEL[role] ?? 'Гражданин'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 22 }}>
              Введите данные для входа
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                required
                style={{
                  padding: '12px 14px', borderRadius: 10,
                  border: '1.5px solid rgba(0,0,0,0.1)',
                  fontSize: '0.9rem', outline: 'none',
                  background: '#f8f9f6', width: '100%',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                required
                style={{
                  padding: '12px 14px', borderRadius: 10,
                  border: '1.5px solid rgba(0,0,0,0.1)',
                  fontSize: '0.9rem', outline: 'none',
                  background: '#f8f9f6', width: '100%',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              {error && (
                <div style={{ fontSize: '0.82rem', color: '#e53e3e', marginTop: -4 }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                style={{
                  background: '#0f0f0f', color: '#fff',
                  padding: '13px', borderRadius: 10,
                  fontSize: '0.9rem', fontWeight: 700,
                  marginTop: 4, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Войти
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function RoleCard({ label, icon, iconBg, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `2px solid ${hovered ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 14, padding: '18px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        background: hovered ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.01)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f0f0f', textAlign: 'center' }}>{label}</div>
    </button>
  );
}
