import { useState, useEffect, useCallback } from 'react';
import './index.css';
import YandexMap from './YandexMap';
import FeedTab from './tabs/FeedTab';
import ReportTab from './tabs/ReportTab';
import GovTab from './tabs/GovTab';
import Dashboard from './tabs/Dashboard';
import { getReports } from './api';

/* ── Glassmorphism base style ── */
const glass = {
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  borderRadius: 16,
};

/* ── Constants ── */
const TABS = [
  { id: 'map',    label: 'Карта' },
  { id: 'feed',   label: 'Лента' },
  { id: 'report', label: 'Репорт' },
  { id: 'gov',    label: 'Акимат' },
];

const FILTERS = [
  { id: 'all',      label: 'Все',      color: '#0f0f0f' },
  { id: 'critical', label: 'Критично', color: '#e53e3e' },
  { id: 'high',     label: 'Высокий',  color: '#dd6b20' },
  { id: 'medium',   label: 'Средний',  color: '#d69e2e' },
  { id: 'low',      label: 'Низкий',   color: '#38a169' },
  { id: 'resolved', label: 'Решено',   color: '#3182ce' },
];

const TYPE_GRID = [
  { id: 'road',      label: 'Дороги',    color: '#e53e3e' },
  { id: 'lighting',  label: 'Освещение', color: '#d69e2e' },
  { id: 'waste',     label: 'Мусор',     color: '#dd6b20' },
  { id: 'greenery',  label: 'Зелень',    color: '#38a169' },
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
  critical: '#e53e3e', high: '#dd6b20', medium: '#d69e2e', low: '#38a169',
};

function districtScore(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return 35 + Math.abs(h % 60);
}

/* ── Sub-components ── */
function EyeLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, background: '#0f0f0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="22" height="16" viewBox="0 0 24 16" fill="none">
          <path d="M1 8s4-7 11-7 11 7 11 7-4 7-11 7S1 8 1 8z"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="8" r="3" stroke="white" strokeWidth="2"/>
        </svg>
      </div>
      <div>
        <div style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontWeight: 800, fontSize: '1.05rem', color: '#0f0f0f', lineHeight: 1.15,
        }}>
          CityEye
        </div>
        <div style={{
          fontSize: 9, color: '#999', letterSpacing: '2px',
          textTransform: 'uppercase', lineHeight: 1.2,
        }}>
          Urban AI Monitor
        </div>
      </div>
    </div>
  );
}

function NavTabs({ tab, setTab }) {
  return (
    <nav style={{
      display: 'flex', background: 'rgba(0,0,0,0.05)',
      borderRadius: 10, padding: 3, gap: 2,
    }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          background: tab === t.id ? '#0f0f0f' : 'transparent',
          color: tab === t.id ? '#fff' : '#666',
          padding: '6px 18px', borderRadius: 8,
          fontSize: '0.84rem', fontWeight: tab === t.id ? 600 : 400,
          transition: 'background 0.2s, color 0.2s',
        }}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function Dot({ color, size = 8, round = false }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: round ? '50%' : 2,
      background: color,
    }} />
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
    <aside style={{
      ...glass,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Filters */}
        <section>
          <SectionLabel>Фильтры</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: activeFilter === f.id ? 'rgba(0,0,0,0.06)' : 'transparent',
                color: '#0f0f0f', padding: '7px 9px', borderRadius: 8,
                fontSize: '0.855rem', fontWeight: activeFilter === f.id ? 600 : 400,
                textAlign: 'left', width: '100%', transition: 'background 0.15s',
              }}>
                <Dot color={f.color} size={8} />
                <span style={{ flex: 1 }}>{f.label}</span>
                <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{count(f.id)}</span>
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
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 10, padding: '9px 10px', cursor: 'pointer',
                transition: 'background 0.15s',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, marginBottom: 6 }} />
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#222' }}>{c.label}</div>
                <div style={{ fontSize: '0.69rem', color: '#aaa', marginTop: 1 }}>
                  {reports.filter(r => r.category === c.id).length} реп.
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
              const sc = districtScore(d);
              const col = sc >= 70 ? '#38a169' : sc >= 50 ? '#dd6b20' : '#e53e3e';
              return (
                <div key={d}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.775rem', color: '#333' }}>{d}</span>
                    <span style={{ fontSize: '0.775rem', color: col, fontWeight: 700 }}>{sc}%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(0,0,0,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${sc}%`, background: col, borderRadius: 4, transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </aside>
  );
}

/* ── Right Panel ── */
function RightPanel({ reports, onReport, onDashboard }) {
  const recent = [...reports].reverse().slice(0, 6);
  const criticalCount = reports.filter(r => r.severity === 'critical' || r.severity === 'high').length;

  return (
    <aside style={{ ...glass, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
        <SectionLabel>Последние репорты</SectionLabel>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#aaa', fontSize: '0.82rem' }}>
            Нет репортов
          </div>
        ) : recent.map(r => {
          const sevColor = SEV_COLORS[r.severity] ?? '#888';
          return (
            <div key={r.id} style={{
              display: 'flex', gap: 9, alignItems: 'center',
              padding: '7px 8px', borderRadius: 10,
              background: 'rgba(0,0,0,0.02)', cursor: 'pointer',
              transition: 'background 0.12s',
            }}>
              {r.image ? (
                <img src={r.image} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,0.08)' }} />
              ) : (
                <div style={{
                  width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                  background: 'rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                }}>
                  📷
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f0f0f' }}>
                  {CATEGORY_LABEL[r.category] ?? 'Проблема'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.address ?? 'Алматы'}
                </div>
              </div>
              <span style={{
                flexShrink: 0, background: 'rgba(0,0,0,0.07)',
                color: '#444', borderRadius: 5, padding: '2px 7px',
                fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase',
              }}>
                {r.severity ?? 'new'}
              </span>
            </div>
          );
        })}
      </div>

      {/* AI Block */}
      <div style={{
        margin: '8px 10px 10px', flexShrink: 0,
        background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 12, padding: '12px 13px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#38a169',
            animation: 'pulseDot 2s ease-in-out infinite', flexShrink: 0,
          }} />
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f0f0f' }}>ИИ Ассистент</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#38a169', fontWeight: 600 }}>Онлайн</span>
        </div>
        <p style={{ margin: '0 0 11px', fontSize: '0.775rem', color: '#666', lineHeight: 1.55 }}>
          Активных репортов: <strong style={{ color: '#0f0f0f' }}>{reports.length}</strong>.
          Приоритетных: <strong style={{ color: '#e53e3e' }}>{criticalCount}</strong>.
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onReport} style={{
            flex: 1, background: '#0f0f0f', color: '#fff',
            padding: '8px 0', borderRadius: 8,
            fontSize: '0.8rem', fontWeight: 600,
          }}>
            Сообщить
          </button>
          <button onClick={onDashboard} style={{
            flex: 1, background: 'rgba(0,0,0,0.07)', color: '#333',
            padding: '8px 0', borderRadius: 8,
            fontSize: '0.8rem', fontWeight: 600,
          }}>
            Дашборд
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ── Bottom Bar ── */
function BottomBar({ reports, onReport }) {
  const stats = [
    { key: 'critical', label: 'Критично', color: '#e53e3e', count: reports.filter(r => r.severity === 'critical').length },
    { key: 'high',     label: 'Высокий',  color: '#dd6b20', count: reports.filter(r => r.severity === 'high').length },
    { key: 'medium',   label: 'Средний',  color: '#d69e2e', count: reports.filter(r => r.severity === 'medium').length },
    { key: 'resolved', label: 'Решено',   color: '#38a169', count: reports.filter(r => r.status === 'resolved').length },
  ];
  return (
    <footer style={{
      gridColumn: '1 / -1', ...glass,
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 20px',
    }}>
      <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Dot color={s.color} size={8} round />
            <span style={{ fontSize: '0.82rem', color: '#555' }}>
              {s.label}: <strong style={{ color: '#0f0f0f' }}>{s.count}</strong>
            </span>
          </div>
        ))}
      </div>
      <button onClick={onReport} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: '#0f0f0f', color: '#fff',
        padding: '10px 20px', borderRadius: 10,
        fontSize: '0.875rem', fontWeight: 600,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Сообщить о проблеме
      </button>
    </footer>
  );
}

/* ── Helpers ── */
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.69rem', fontWeight: 700, color: '#aaa',
      textTransform: 'uppercase', letterSpacing: '1.2px',
      marginBottom: 9,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />;
}

/* ── Shared Navbar ── */
function Navbar({ tab, setTab }) {
  return (
    <header style={{
      gridColumn: '1 / -1', ...glass,
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 20px',
    }}>
      <EyeLogo />
      <NavTabs tab={tab} setTab={setTab} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.04)', borderRadius: 8,
          padding: '7px 12px', border: '1px solid rgba(0,0,0,0.07)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span style={{ fontSize: '0.82rem', color: '#aaa' }}>Поиск...</span>
        </div>
        <button onClick={() => setTab('gov')} style={{
          background: '#0f0f0f', color: '#fff',
          padding: '8px 16px', borderRadius: 8,
          fontSize: '0.84rem', fontWeight: 600,
        }}>
          Акимат
        </button>
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function App() {
  const [tab, setTab] = useState('map');
  const [activeFilter, setActiveFilter] = useState('all');
  const [reports, setReports] = useState([]);

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cityeye_user')) ?? null; } catch { return null; }
  });

  function handleLogout() {
    localStorage.removeItem('cityeye_user');
    setUser(null);
    setTab('map');
  }

  const refreshReports = useCallback(async () => {
    try { setReports(await getReports()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshReports(); }, [refreshReports]);

  /* ── Full-page dark tabs ── */
  if (tab === 'feed') {
    return <FeedTab reports={reports} onTabChange={setTab} />;
  }
  if (tab === 'gov') {
    return (
      <Dashboard
        reports={reports}
        onStatusChange={refreshReports}
        onTabChange={setTab}
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  /* ── Other tabs (full-page light) ── */
  if (tab !== 'map') {
    return (
      <div style={{ minHeight: '100vh', background: '#eef0eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ margin: '10px 10px 0' }}>
          <header style={{ ...glass, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 64 }}>
            <EyeLogo />
            <NavTabs tab={tab} setTab={setTab} />
            <button onClick={() => setTab('gov')} style={{
              background: '#0f0f0f', color: '#fff',
              padding: '8px 16px', borderRadius: 8,
              fontSize: '0.84rem', fontWeight: 600,
            }}>
              Акимат
            </button>
          </header>
        </div>
        <main style={{ flex: 1, padding: '20px 10px 10px', maxWidth: 980, margin: '0 auto', width: '100%' }}>
          {tab === 'report' && <ReportTab onNewReport={refreshReports} />}
        </main>
      </div>
    );
  }

  /* ── Map dashboard (3-column grid) ── */
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr 280px',
      gridTemplateRows: '64px 1fr 56px',
      gap: 10, padding: 10,
      height: '100vh', background: '#eef0eb',
      overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <Navbar tab={tab} setTab={setTab} />

      <LeftPanel
        reports={reports}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />

      {/* Center map */}
      <main style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 28px rgba(0,0,0,0.1)' }}>
        <YandexMap reports={reports} />
      </main>

      <RightPanel
        reports={reports}
        onReport={() => setTab('report')}
        onDashboard={() => setTab('gov')}
      />

      <BottomBar reports={reports} onReport={() => setTab('report')} />
    </div>
  );
}
