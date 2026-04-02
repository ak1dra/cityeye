import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from './lib/supabase';
import './index.css';
import YandexMap from './YandexMap';
import FeedTab from './tabs/FeedTab';
import ReportTab from './tabs/ReportTab';
import Dashboard from './tabs/Dashboard';
import BusinessDashboard from './tabs/BusinessDashboard';
import AuthModal from './AuthModal';
import { GlassPanel } from './components/GlassPanel';
import { isManagedUserNormalized, normalizeManagedUser } from './lib/userProfile';
import { buildCollaborationFields } from './lib/reportCollaboration';

/* ── Constants ── */
const TABS = [
  { id: 'map',    label: 'Карта' },
  { id: 'feed',   label: 'Лента' },
  { id: 'report', label: 'Репорт' },
  { id: 'gov',    label: 'Акимат' },
  { id: 'business', label: 'Бизнес' },
];

const FILTERS = [
  { id: 'all',      label: 'Все',      color: '#0f172a' },
  { id: 'critical', label: 'Критично', color: '#dc2626' },
  { id: 'high',     label: 'Высокий',  color: '#d97706' },
  { id: 'medium',   label: 'Средний',  color: '#2563eb' },
  { id: 'low',      label: 'Низкий',   color: '#7c3aed' },
  { id: 'resolved', label: 'Решено',   color: '#16a34a' },
];

const TYPE_GRID = [
  { id: 'road',     label: 'Дороги',    color: '#dc2626' },
  { id: 'lighting', label: 'Освещение', color: '#d97706' },
  { id: 'waste',    label: 'Мусор',     color: '#ea580c' },
  { id: 'greenery', label: 'Зелень',    color: '#16a34a' },
];

const DISTRICTS = [
  'Алматинский', 'Бостандыкский', 'Медеуский',
  'Алатауский', 'Ауэзовский', 'Жетысуский',
];

const CATEGORY_LABEL = {
  road: 'Дороги', lighting: 'Освещение', greenery: 'Озеленение',
  utilities: 'Коммуникации', waste: 'Мусор', other: 'Другое',
};

const SEV_COLORS = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb',
  low: '#7c3aed', resolved: '#16a34a',
};

function districtScore(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return 35 + Math.abs(h % 60);
}

function managedSubtitle(user) {
  if (user?.role === 'government') return 'Зам. акима Алматы';
  if (user?.role === 'business') return user.position ?? 'Управляющая компания';
  return null;
}

function managedAccent(user) {
  if (user?.role === 'government') {
    return { color: '#6366f1', soft: '#eef2ff', border: '#6366f1', status: '#22c55e' };
  }
  return { color: '#0f766e', soft: '#ccfbf1', border: '#14b8a6', status: '#14b8a6' };
}

/* ── Navbar ── */
function Navbar({ tab, onTabChange, user, onAuth, onLogout }) {
  const isManagedUser = user?.role === 'government' || user?.role === 'business';

  return (
    <motion.header
      className="glass-navbar"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}
    >
      {/* Logo */}
      <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', letterSpacing: '-0.3px' }}>
        CityEye
      </span>

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 6 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            style={{
              background: 'transparent',
              color: tab === t.id ? '#0f172a' : '#94a3b8',
              fontSize: 13, fontWeight: tab === t.id ? 500 : 400,
              padding: '6px 10px',
              borderBottom: tab === t.id ? '2px solid #0f172a' : '2px solid transparent',
              borderRadius: 0,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Auth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user ? (
          isManagedUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {(() => {
                const accent = managedAccent(user);
                return (
                  <>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${accent.border}` }}
                    onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div style={{
                  display: user.avatar ? 'none' : 'flex', width: 34, height: 34, borderRadius: '50%',
                  background: accent.soft, border: `2px solid ${accent.border}`,
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: accent.color,
                }}>
                  {user.initials}
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 9, height: 9, borderRadius: '50%',
                  background: accent.status, border: '1.5px solid #fff',
                }} />
              </div>
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: accent.color }}>{managedSubtitle(user)}</div>
              </div>
                  </>
                );
              })()}
              <button onClick={onLogout} style={{
                background: 'var(--surface2)', color: '#64748b',
                border: '1px solid var(--border)',
                padding: '5px 12px', fontSize: 13, borderRadius: 8, marginLeft: 4,
              }}>
                Выйти
              </button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 13, color: '#64748b' }}>{user.name}</span>
              <button onClick={onLogout} style={{
                background: 'var(--surface2)', color: '#64748b',
                border: '1px solid var(--border)',
                padding: '5px 12px', fontSize: 13, borderRadius: 8,
              }}>
                Выйти
              </button>
            </>
          )
        ) : (
          <button onClick={onAuth} style={{
            background: '#0f172a', color: '#fff',
            padding: '8px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 600,
          }}>
            Войти в кабинет
          </button>
        )}
      </div>
    </motion.header>
  );
}

/* ── Left Panel ── */
function LeftPanel({ reports, activeFilter, setActiveFilter }) {
  const count = id => {
    if (id === 'all') return reports.length;
    if (id === 'resolved') return reports.filter(r => r.status === 'resolved').length;
    return reports.filter(r => r.severity === id).length;
  };

  return (
    <GlassPanel delay={0.1} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Filters */}
        <section>
          <SectionLabel>Фильтры</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: activeFilter === f.id ? '#0f172a' : 'transparent',
                color: activeFilter === f.id ? '#fff' : '#0f172a',
                padding: '7px 10px', borderRadius: 7,
                fontSize: 13, fontWeight: activeFilter === f.id ? 500 : 400,
                textAlign: 'left', width: '100%',
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 7, height: 7,
                  borderRadius: 2, /* square dots */
                  background: activeFilter === f.id ? 'rgba(255,255,255,0.6)' : f.color,
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{f.label}</span>
                <span style={{
                  fontSize: 11,
                  color: activeFilter === f.id ? 'rgba(255,255,255,0.6)' : '#94a3b8',
                }}>
                  {count(f.id)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <Divider />

        {/* Type grid */}
        <section>
          <SectionLabel>По типу</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {TYPE_GRID.map(c => (
              <div key={c.id} style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 10px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#fff'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, marginBottom: 6 }} />
                <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>{c.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {reports.filter(r => r.type === c.id).length} реп.
                </div>
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* District ratings */}
        <section>
          <SectionLabel>Рейтинг районов</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DISTRICTS.map(d => {
              const sc  = districtScore(d);
              const col = sc >= 70 ? '#16a34a' : sc >= 50 ? '#d97706' : '#dc2626';
              return (
                <div key={d}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{d}</span>
                    <span style={{ fontSize: 12, color: col, fontWeight: 600 }}>{sc}%</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${sc}%`, background: col, borderRadius: 4, transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </GlassPanel>
  );
}

/* ── Right Panel ── */
function RightPanel({ reports, onReport, onDashboard }) {
  const recent = [...reports].reverse().slice(0, 6);
  const criticalCount = reports.filter(r => r.severity === 'critical' || r.severity === 'high').length;

  return (
    <GlassPanel delay={0.15} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <SectionLabel>Последние репорты</SectionLabel>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8', fontSize: 13 }}>
            Нет репортов
          </div>
        ) : recent.map((r, i) => {
          const sevColor = SEV_COLORS[r.severity] ?? '#64748b';
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              style={{
                display: 'flex', gap: 9, alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: sevColor, flexShrink: 0 }} />
              {r.image ? (
                <img src={r.image} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>
                  {CATEGORY_LABEL[r.type] ?? 'Проблема'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.address ?? 'Алматы'}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* AI Block */}
      <div style={{
        margin: '10px',
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 10, padding: '14px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#16a34a',
            animation: 'pulseDot 2s ease-in-out infinite', flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>ИИ Ассистент</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', fontWeight: 500 }}>Онлайн</span>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
          Активных: <strong style={{ color: '#0f172a' }}>{reports.length}</strong>.{' '}
          Приоритетных: <strong style={{ color: '#dc2626' }}>{criticalCount}</strong>.
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onReport} style={{
            flex: 1, background: '#0f172a', color: '#fff',
            padding: '7px 0', borderRadius: 7,
            fontSize: 12, fontWeight: 500,
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Сообщить
          </button>
          <button onClick={onDashboard} style={{
            flex: 1, background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: '#64748b', padding: '7px 0', borderRadius: 7,
            fontSize: 12, fontWeight: 500,
          }}>
            Дашборд
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}

/* ── Bottom Bar ── */
function BottomBar({ reports, onReport }) {
  const stats = [
    { key: 'critical', label: 'Критично', color: '#dc2626', count: reports.filter(r => r.severity === 'critical').length },
    { key: 'high',     label: 'Высокий',  color: '#d97706', count: reports.filter(r => r.severity === 'high').length },
    { key: 'medium',   label: 'Средний',  color: '#2563eb', count: reports.filter(r => r.severity === 'medium').length },
    { key: 'resolved', label: 'Решено',   color: '#16a34a', count: reports.filter(r => r.status === 'resolved').length },
  ];
  return (
    <GlassPanel
      delay={0.2}
      style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        {stats.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {s.label}: <strong style={{ color: '#0f172a', fontWeight: 600 }}>{s.count}</strong>
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onReport}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: '#0f172a', color: '#fff',
          padding: '8px 18px', borderRadius: 8,
          fontSize: 13, fontWeight: 600,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Сообщить о проблеме
      </button>
    </GlassPanel>
  );
}

/* ── Helpers ── */
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: '1.5px',
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />;
}

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function App() {
  const [tab, setTab]                   = useState('map');
  const [activeFilter, setActiveFilter] = useState('all');
  const [reports, setReports]           = useState([]);
  const [showAuth, setShowAuth]         = useState(false);

  const [user, setUser] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('cityeye_user'));
      return normalizeManagedUser(storedUser ?? null);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!user || (user.role !== 'government' && user.role !== 'business')) return;

    const normalizedUser = normalizeManagedUser(user);
    if (!isManagedUserNormalized(user)) {
      setUser(normalizedUser);
      return;
    }

    const serializedUser = JSON.stringify(normalizedUser);
    if (localStorage.getItem('cityeye_user') !== serializedUser) {
      localStorage.setItem('cityeye_user', serializedUser);
    }
  }, [user]);

  function handleTabChange(id) {
    if (id === 'gov' && (!user || user.role !== 'government')) {
      setShowAuth(true);
      return;
    }
    if (id === 'business' && !user) {
      setShowAuth(true);
      return;
    }
    setTab(id);
  }

  function handleLogout() {
    localStorage.removeItem('cityeye_user');
    setUser(null);
    setTab('map');
  }

  function handleLogin(u) {
    setUser(u);
    if (u.role === 'government') setTab('gov');
    if (u.role === 'business') setTab('business');
  }

  const refreshReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setReports(data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshReports(); }, [refreshReports]);

  /* ── Realtime ── */
  useEffect(() => {
    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        refreshReports();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [refreshReports]);

  /* ── Save report after AI analysis ── */
  const saveReport = useCallback(async (analysis, address, lat, lng) => {
    const storedUser = JSON.parse(localStorage.getItem('cityeye_user') || '{}');
    const collaborationFields = buildCollaborationFields(storedUser);
    const { data, error } = await supabase
      .from('reports')
      .insert({
        user_email: storedUser.email || 'anonymous',
        user_name:  storedUser.name  || 'Гражданин',
        type:       analysis.type,
        severity:   analysis.severity,
        priority_score:      analysis.priority_score,
        ai_comment:          analysis.ai_comment || analysis.description,
        recommended_action:  analysis.recommended_action,
        estimated_fix_time:  analysis.estimated_fix_time,
        responsible_dept:    analysis.responsible_dept,
        address,
        lat,
        lng,
        status: 'new',
        ...collaborationFields,
      })
      .select()
      .single();
    if (error) console.error('saveReport error:', error.message);
    else refreshReports();
    return data;
  }, [refreshReports]);

  const authModal = showAuth && (
    <AuthModal onClose={() => setShowAuth(false)} onLogin={handleLogin} />
  );

  /* ── Full-page tabs ── */
  if (tab === 'feed') {
    return (
      <>
        <FeedTab reports={reports} onTabChange={handleTabChange} user={user} />
        {authModal}
      </>
    );
  }
  if (tab === 'gov') {
    return (
      <>
        <Dashboard
          reports={reports}
          onStatusChange={refreshReports}
          onTabChange={handleTabChange}
          user={user}
          onLogout={handleLogout}
        />
        {authModal}
      </>
    );
  }
  if (tab === 'business') {
    return (
      <>
        <BusinessDashboard
          reports={reports}
          user={user}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          onStatusChange={refreshReports}
        />
        {authModal}
      </>
    );
  }

  /* ── Report tab ── */
  if (tab === 'report') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
          <Navbar tab={tab} onTabChange={handleTabChange} user={user} onAuth={() => setShowAuth(true)} onLogout={handleLogout} />
        </div>
        <main style={{ flex: 1, padding: '32px 20px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
          <ReportTab onNewReport={refreshReports} onSaveReport={saveReport} />
        </main>
        {authModal}
      </div>
    );
  }

  /* ── Map dashboard (3-column grid) ── */
  return (
    <div style={{
      height: '100vh', overflow: 'hidden',
      background: 'var(--bg)',
      display: 'grid',
      gridTemplateColumns: '240px 1fr 260px',
      gridTemplateRows: '52px 1fr 52px',
      gap: 8, padding: 8,
      boxSizing: 'border-box',
    }}>
      <Navbar
        tab={tab}
        onTabChange={handleTabChange}
        user={user}
        onAuth={() => setShowAuth(true)}
        onLogout={handleLogout}
      />

      <LeftPanel
        reports={reports}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />

      {/* Center map */}
      <motion.main
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        style={{
          borderRadius: 14, overflow: 'hidden',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
        }}
      >
        <YandexMap reports={reports} />
      </motion.main>

      <RightPanel
        reports={reports}
        onReport={() => handleTabChange('report')}
        onDashboard={() => handleTabChange(user?.role === 'business' ? 'business' : 'gov')}
      />

      <BottomBar reports={reports} onReport={() => handleTabChange('report')} />

      {authModal}
    </div>
  );
}
