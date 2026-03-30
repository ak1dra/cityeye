import { useState } from 'react';

/* ── Configs ── */
const SEV = {
  critical: { label: 'Критично', color: '#EF4444', stripe: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  high:     { label: 'Высокий',  color: '#F97316', stripe: '#F97316', bg: 'rgba(249,115,22,0.1)' },
  medium:   { label: 'Средний',  color: '#3B82F6', stripe: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  low:      { label: 'Низкий',   color: '#22C55E', stripe: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
};

const ST = {
  new:         { label: 'Новый',    color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  in_progress: { label: 'В работе', color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
  resolved:    { label: 'Решено',   color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  rejected:    { label: 'Отклонён', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
};

const CAT_COLOR = {
  road: '#EF4444', lighting: '#EAB308', waste: '#F97316',
  greenery: '#22C55E', utilities: '#3B82F6', other: '#94A3B8',
};

/* ── Mock data ── */
const MOCK = [
  {
    id: 'mk1', category: 'road', severity: 'critical', status: 'new',
    type: 'Незаконная парковка',
    address: 'пр. Достык 130',
    ai_comment: 'Кафе "Урюк" выставило конусы на общественной парковке, блокируя 6 машино-мест. Нарушение ПДД РК ст. 482. Требуется немедленный вывоз конусов и административный штраф заведению.',
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: 'mk2', category: 'road', severity: 'high', status: 'in_progress',
    type: 'Яма на пешеходном переходе',
    address: 'ул. Абая 45',
    ai_comment: 'Выбоина диаметром ~40 см и глубиной 12 см прямо на пешеходном переходе. Высокий риск травм, особенно для детей и пожилых граждан. Срочный ямочный ремонт в течение 24 часов.',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'mk3', category: 'lighting', severity: 'medium', status: 'new',
    type: '3 фонаря у школы №45',
    address: 'ул. Тимирязева 28',
    ai_comment: '3 фонарных столба у входа в школу №45 не работают уже 8 дней. В тёмное время суток создаётся угроза для детей. Ответственный: АО "Алматыэнергосбыт". Срок реакции: 3–5 рабочих дней.',
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: 'mk4', category: 'greenery', severity: 'low', status: 'new',
    type: 'Граффити на фасаде',
    address: 'пр. Аль-Фараби 17',
    ai_comment: 'Крупное граффити 3×2 м на фасаде жилого дома. Ухудшает вид квартала, рядом детский сад. Рекомендуется очистка или перекраска. Срок устранения — до 7 рабочих дней.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mk5', category: 'waste', severity: 'high', status: 'new',
    type: 'Незаконная свалка стройматериалов',
    address: 'ул. Розыбакиева 89',
    ai_comment: 'Стихийный сброс стройотходов: бетонные блоки, арматура, упаковка — объём ~15 м³. Нарушение экологических норм. Необходим вывоз спецтехникой и штраф нарушителю.',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

/* ── SVG Icons ── */
function Icon({ n, size = 16, color = 'currentColor', fill = 'none' }) {
  const base = { width: size, height: size, flexShrink: 0, display: 'block' };
  const sp = { stroke: color, fill, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    feed:     <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    map:      <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
    camera:   <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    building: <><rect x="3" y="9" width="18" height="13" rx="2"/><path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/></>,
    pin:      <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
    clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    heart:    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
    msg:      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    share:    <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
    road:     <><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    zap:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    pen:      <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
    wrench:   <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>,
    info:     <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
    photo:    <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
  };
  return (
    <svg style={base} viewBox="0 0 24 24" {...sp}>
      {icons[n] ?? null}
    </svg>
  );
}

/* ── Helpers ── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function fakeN(id, seed) {
  let h = seed | 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return 8 + Math.abs(h % 180);
}

const CAT_ICON = {
  road: 'road', lighting: 'zap', waste: 'trash',
  greenery: 'pen', utilities: 'wrench', other: 'info',
};

const NAV = [
  { id: 'feed',   label: 'Лента',  icon: 'feed' },
  { id: 'map',    label: 'Карта',  icon: 'map' },
  { id: 'report', label: 'Репорт', icon: 'camera' },
  { id: 'gov',    label: 'Акимат', icon: 'building' },
];

const FILTER_OPTS = [
  { id: 'all',      label: 'Все',      color: '#0f172a' },
  { id: 'critical', label: 'Критично', color: '#EF4444' },
  { id: 'high',     label: 'Высокий',  color: '#F97316' },
  { id: 'medium',   label: 'Средний',  color: '#3B82F6' },
  { id: 'resolved', label: 'Решено',   color: '#22C55E' },
];

/* ════════════════════════════════════════
   COMPONENT
════════════════════════════════════════ */
export default function FeedTab({ reports = [], onTabChange }) {
  const [filter, setFilter]   = useState('all');
  const [liked, setLiked]     = useState({});
  const [shared, setShared]   = useState(null);

  const allReports = [...MOCK, ...[...reports].reverse()];

  const filtered = allReports.filter(r => {
    if (filter === 'resolved') return r.status === 'resolved';
    if (filter !== 'all') return r.severity === filter;
    return true;
  });

  async function handleShare(report) {
    try {
      if (navigator.share) {
        await navigator.share({
          title: report.type || report.title || 'Проблема города',
          text: report.ai_comment || report.description || '',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShared(report.id);
        setTimeout(() => setShared(null), 2000);
      }
    } catch { /* user cancelled */ }
  }

  const nav = (id) => onTabChange?.(id);

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#f8f9f6',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* ── Left Sidebar ── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: '#ffffff',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          padding: '22px 18px 18px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: '#0f0f0f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon n="eye" size={18} color="#fff" />
            </div>
            <div>
              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.2,
              }}>CityEye</div>
              <div style={{ fontSize: 8, color: '#94a3b8', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Urban AI Monitor
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '14px 10px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700, padding: '0 8px', marginBottom: 8 }}>
            Навигация
          </div>
          {NAV.map(item => {
            const active = item.id === 'feed';
            return (
              <button
                key={item.id}
                onClick={() => nav(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 10px', borderRadius: 8,
                  background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
                  color: active ? '#0f172a' : '#94a3b8',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.845rem', fontWeight: active ? 600 : 400,
                  textAlign: 'left', transition: 'background 0.15s, color 0.15s',
                  marginBottom: 2,
                }}
              >
                <Icon n={item.icon} size={16} color={active ? '#0f172a' : '#94a3b8'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Filters */}
        <div style={{ padding: '20px 10px 0', flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700, padding: '0 8px', marginBottom: 8 }}>
            Фильтр
          </div>
          {FILTER_OPTS.map(f => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  background: active ? 'rgba(0,0,0,0.05)' : 'transparent',
                  color: active ? '#0f172a' : '#94a3b8',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.84rem', fontWeight: active ? 600 : 400,
                  textAlign: 'left', marginBottom: 2,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: active ? f.color : 'rgba(0,0,0,0.15)',
                  flexShrink: 0, transition: 'background 0.15s',
                }} />
                {f.label}
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#94a3b8' }}>
                  {f.id === 'all'
                    ? allReports.length
                    : f.id === 'resolved'
                      ? allReports.filter(r => r.status === 'resolved').length
                      : allReports.filter(r => r.severity === f.id).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Profile */}
        <div style={{
          margin: '12px 10px',
          padding: '12px 12px',
          background: 'rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 12,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon n="user" size={16} color="#64748b" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>Гражданин</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Алматы
              </div>
            </div>
            <button
              onClick={() => nav('report')}
              style={{
                marginLeft: 'auto', background: '#0f0f0f', border: 'none',
                borderRadius: 7, width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Icon n="plus" size={14} color="#fff" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{
          padding: '20px 28px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#ffffff',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
              Лента Алматы
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              {filtered.length} репортов · обновлено только что
            </p>
          </div>
          <button
            onClick={() => nav('report')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#0f0f0f', color: '#fff',
              border: 'none', borderRadius: 10,
              padding: '9px 16px', fontSize: '0.84rem', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon n="plus" size={14} color="#fff" />
            Сообщить
          </button>
        </div>

        {/* Cards list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px 28px', background: '#f8f9f6' }}>
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', paddingTop: 80,
            }}>
              <Icon n="info" size={40} color="rgba(0,0,0,0.1)" />
              <div style={{ marginTop: 14, fontSize: '0.9rem', fontWeight: 500, color: '#64748b' }}>
                Репорты не найдены
              </div>
              <div style={{ marginTop: 4, fontSize: '0.8rem', color: '#94a3b8' }}>
                Попробуйте другой фильтр
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(r => (
                <ReportCard
                  key={r.id}
                  r={r}
                  liked={!!liked[r.id]}
                  onLike={() => setLiked(p => ({ ...p, [r.id]: !p[r.id] }))}
                  shareLabel={shared === r.id ? 'Скопировано' : null}
                  onShare={() => handleShare(r)}
                  onPublish={() => nav('report')}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Report Card ── */
function ReportCard({ r, liked, onLike, shareLabel, onShare, onPublish }) {
  const sev = SEV[r.severity] ?? SEV.medium;
  const st  = ST[r.status]    ?? ST.new;
  const catColor = CAT_COLOR[r.category] ?? '#94A3B8';
  const catIcon  = CAT_ICON[r.category]  ?? 'info';
  const stripeColor = r.status === 'resolved' ? '#22C55E' : sev.stripe;
  const likes    = fakeN(r.id, 7);
  const comments = fakeN(r.id, 13);

  const text = r.ai_comment || r.description || '';

  return (
    <div style={{
      position: 'relative',
      background: '#ffffff',
      borderRadius: 16,
      border: '1px solid #eee',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      display: 'flex',
    }}>
      {/* Left stripe */}
      <div style={{
        width: 4, flexShrink: 0,
        background: stripeColor,
      }} />

      {/* Card body */}
      <div style={{ flex: 1, padding: '14px 16px 12px', display: 'flex', gap: 14 }}>

        {/* Photo / icon */}
        <div style={{
          width: 110, height: 110, flexShrink: 0, borderRadius: 12,
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {r.image ? (
            <img src={r.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Icon n={catIcon} size={28} color={catColor} />
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                Фото
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>

          {/* Badges + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              background: sev.bg, color: sev.color,
              borderRadius: 20, padding: '2px 9px',
              fontSize: '0.7rem', fontWeight: 700,
            }}>
              {sev.label}
            </span>
            <span style={{
              background: st.bg, color: st.color,
              borderRadius: 20, padding: '2px 9px',
              fontSize: '0.7rem', fontWeight: 600,
            }}>
              {st.label}
            </span>
            <span style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 4,
              color: '#94a3b8', fontSize: '0.72rem',
            }}>
              <Icon n="clock" size={11} color="#94a3b8" />
              {timeAgo(r.created_at)}
            </span>
          </div>

          {/* Title */}
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.3 }}>
            {r.type || r.title || 'Городская проблема'}
          </div>

          {/* AI comment */}
          <p style={{
            margin: 0, fontSize: '0.8rem',
            color: '#64748b',
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {text}
          </p>

          {/* Address */}
          {r.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: '0.75rem' }}>
              <Icon n="pin" size={11} color="#94a3b8" />
              {r.address}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(0,0,0,0.06)',
        padding: '9px 16px 9px 20px',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {/* Like */}
        <FooterBtn
          icon={<Icon n="heart" size={13} color={liked ? '#EF4444' : '#94a3b8'} fill={liked ? '#EF4444' : 'none'} />}
          label={liked ? likes + 1 : likes}
          active={liked}
          activeColor="#EF4444"
          onClick={onLike}
        />

        {/* Comments */}
        <FooterBtn
          icon={<Icon n="msg" size={13} color="#94a3b8" />}
          label={comments}
          onClick={() => {}}
        />

        {/* Share */}
        <FooterBtn
          icon={<Icon n="share" size={13} color={shareLabel ? '#22C55E' : '#94a3b8'} />}
          label={shareLabel ?? 'Поделиться'}
          active={!!shareLabel}
          activeColor="#22C55E"
          onClick={onShare}
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Publish */}
        <button
          onClick={onPublish}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0,0,0,0.05)',
            color: '#0f172a',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: 8, padding: '5px 12px',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Icon n="plus" size={12} color="#0f172a" />
          Опубликовать
        </button>
      </div>
    </div>
  );
}

function FooterBtn({ icon, label, onClick, active, activeColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'transparent', border: 'none',
        color: active ? activeColor : '#94a3b8',
        padding: '4px 8px', borderRadius: 6,
        fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
        transition: 'color 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
