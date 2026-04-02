import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const SEV_CONFIG = {
  critical: { label: 'Критично',  color: '#dc2626', avatarBg: 'rgba(220,38,38,0.1)',   avatarColor: '#dc2626' },
  high:     { label: 'Высокий',   color: '#d97706', avatarBg: 'rgba(217,119,6,0.1)',   avatarColor: '#d97706' },
  medium:   { label: 'Средний',   color: '#2563eb', avatarBg: 'rgba(37,99,235,0.1)',   avatarColor: '#2563eb' },
  low:      { label: 'Низкий',    color: '#7c3aed', avatarBg: 'rgba(124,58,237,0.1)',  avatarColor: '#7c3aed' },
  resolved: { label: 'Решено',    color: '#16a34a', avatarBg: 'rgba(22,163,74,0.1)',   avatarColor: '#16a34a' },
};

const ST_CONFIG = {
  new:         { label: 'Новый',    color: '#2563eb' },
  in_progress: { label: 'В работе', color: '#d97706' },
  resolved:    { label: 'Решено',   color: '#16a34a' },
  rejected:    { label: 'Отклонён', color: '#94a3b8' },
};

const CAT_LABEL = {
  road: 'Дороги', lighting: 'Освещение', greenery: 'Озеленение',
  utilities: 'Коммуникации', waste: 'Мусор', other: 'Другое',
};

const CAT_HANDLE = {
  road: '@dorogi', lighting: '@osveschenie', waste: '@ekologiya',
  greenery: '@zelenye', utilities: '@kommunalka', other: '@gorod',
};

const CAT_INITIALS = {
  road: 'ДР', lighting: 'ОС', waste: 'МС',
  greenery: 'ЗЛ', utilities: 'КМ', other: 'ГР',
};

const HOTSPOTS = [
  { district: 'Медеуский',     count: 12, color: '#dc2626' },
  { district: 'Бостандыкский', count: 9,  color: '#d97706' },
  { district: 'Алмалинский',   count: 7,  color: '#d97706' },
  { district: 'Жетысуский',    count: 5,  color: '#2563eb' },
  { district: 'Ауэзовский',    count: 4,  color: '#2563eb' },
];

const FILTERS = [
  { id: 'all',      label: 'Все' },
  { id: 'critical', label: 'Критично' },
  { id: 'high',     label: 'Высокий' },
  { id: 'resolved', label: 'Решено' },
  { id: 'near',     label: 'Рядом' },
  { id: 'news',     label: 'Новости' },
];

const NEWS_POSTS = [
  {
    id: 'news-1',
    author: 'Ruslan Berdenov',
    position: 'Заместитель акима Алматы',
    avatar: '/ruslan-avatar.jpg',
    initials: 'RB',
    isOfficial: true,
    time: '2 часа назад',
    title: '✅ Убрали 47 незаконных рекламных щитов букмекеров',
    content: 'За последние 2 недели наша команда демонтировала 47 незаконных рекламных конструкций букмекерских контор вблизи школ и детских площадок. Это прямое нарушение закона РК. Работа продолжается — следующий рейд в Ауэзовском районе.',
    stats: { likes: 234, comments: 67, shares: 89 },
    tags: ['реклама', 'законность', 'дети'],
    severity: 'resolved',
    beforeAfter: true,
  },
  {
    id: 'news-2',
    author: 'Ruslan Berdenov',
    position: 'Заместитель акима Алматы',
    avatar: '/ruslan-avatar.jpg',
    initials: 'RB',
    isOfficial: true,
    time: '1 день назад',
    title: '🚧 Отремонтировали 12 км дорог в Бостандыкском районе',
    content: 'Благодаря системе CityEye выявили и устранили 89 ям на ул. Аль-Фараби и Достык. Граждане сообщали через платформу — мы реагировали в течение 24 часов. Среднее время устранения снизилось с 18 до 6 дней.',
    stats: { likes: 456, comments: 123, shares: 201 },
    tags: ['дороги', 'Бостандык', 'ремонт'],
    severity: 'resolved',
    metric: '89 ям устранено',
  },
  {
    id: 'news-3',
    author: 'Ruslan Berdenov',
    position: 'Заместитель акима Алматы',
    avatar: '/ruslan-avatar.jpg',
    initials: 'RB',
    isOfficial: true,
    time: '3 дня назад',
    title: '💡 Восстановили освещение в 5 микрорайонах',
    content: 'Через CityEye граждане сообщили о 34 неработающих фонарях. Все устранены за 3 дня. Особое внимание уделили улицам вблизи школ — безопасность детей в приоритете. АО АлматыЭнергосбыт отработал оперативно.',
    stats: { likes: 312, comments: 45, shares: 78 },
    tags: ['освещение', 'безопасность', 'дети'],
    severity: 'resolved',
    metric: '34 фонаря',
  },
  {
    id: 'news-4',
    author: 'Ruslan Berdenov',
    position: 'Заместитель акима Алматы',
    avatar: '/ruslan-avatar.jpg',
    initials: 'RB',
    isOfficial: true,
    time: '5 дней назад',
    title: '🏗️ Снесли 23 незаконные постройки у дорог',
    content: 'Совместно с прокуратурой демонтировали 23 самовольные постройки которые создавали опасность на дорогах и закрывали видимость знаков. Все объекты внесены в реестр нарушений через CityEye.',
    stats: { likes: 189, comments: 34, shares: 56 },
    tags: ['самострой', 'безопасность', 'дороги'],
    severity: 'resolved',
    metric: '23 объекта',
  },
  {
    id: 'news-5',
    author: 'Ruslan Berdenov',
    position: 'Заместитель акима Алматы',
    avatar: '/ruslan-avatar.jpg',
    initials: 'RB',
    isOfficial: true,
    time: '1 неделю назад',
    title: '🎯 CityEye — наш главный инструмент работы с гражданами',
    content: 'За первый месяц работы с платформой CityEye: получено 1,204 репорта от граждан, решено 843 проблемы, среднее время реакции снизилось с 21 до 6 дней. Каждый гражданин и предприниматель может сообщить о проблеме — мы реагируем. Алматы становится умным городом.',
    stats: { likes: 891, comments: 234, shares: 445 },
    tags: ['CityEye', 'smartcity', 'Алматы'],
    severity: 'resolved',
    metric: '843 решено',
  },
];

const NAV = [
  { id: 'feed',   label: 'Лента',   icon: 'feed' },
  { id: 'map',    label: 'Карта',   icon: 'map' },
  { id: 'report', label: 'Репорт',  icon: 'camera' },
  { id: 'gov',    label: 'Дашборд', icon: 'building' },
  { id: 'business', label: 'Бизнес', icon: 'building' },
];

const MOCK = [
  {
    id: 'mk1', type: 'road', severity: 'critical', status: 'new',
    label: 'Незаконная парковка',
    address: 'пр. Достык 130',
    ai_comment: 'Кафе "Урюк" выставило конусы на общественной парковке, блокируя 6 машино-мест. Нарушение ПДД РК ст. 482. Требуется немедленный вывоз конусов и штраф.',
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: 'mk2', type: 'road', severity: 'high', status: 'in_progress',
    address: 'ул. Абая 45',
    ai_comment: 'Выбоина диаметром ~40 см и глубиной 12 см прямо на пешеходном переходе. Высокий риск травм для детей и пожилых. Срочный ямочный ремонт в течение 24 часов.',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'mk3', type: 'lighting', severity: 'medium', status: 'new',
    address: 'ул. Тимирязева 28',
    ai_comment: '3 фонарных столба у входа в школу №45 не работают уже 8 дней. Угроза для детей в тёмное время. Срок реакции: 3–5 рабочих дней.',
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: 'mk4', type: 'greenery', severity: 'low', status: 'resolved',
    address: 'пр. Аль-Фараби 17',
    ai_comment: 'Граффити 3×2 м устранено силами управляющей компании. Фасад перекрашен. Проблема закрыта.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mk5', type: 'waste', severity: 'high', status: 'new',
    address: 'ул. Розыбакиева 89',
    ai_comment: 'Стихийный сброс стройотходов объёмом ~15 м³. Нарушение экологических норм. Необходим вывоз спецтехникой.',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'mk6', type: 'utilities', severity: 'critical', status: 'in_progress',
    address: 'ул. Байзакова 31',
    ai_comment: 'Прорыв водопроводной трубы диаметром 150 мм. Затоплено дорожное полотно ~20 м². Ремонтная бригада выехала.',
    created_at: new Date(Date.now() - 20 * 60000).toISOString(),
  },
];

function fakeN(id, seed) {
  let h = seed | 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return 4 + Math.abs(h % 120);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ч`;
  return `${Math.floor(h / 24)}д`;
}

/* ══════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════ */
function Ic({ n, size = 16, color = 'currentColor', fill = 'none' }) {
  const s = { width: size, height: size, flexShrink: 0, display: 'block' };
  const p = { stroke: color, fill, strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const d = {
    feed:     <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    map:      <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
    camera:   <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    building: <><rect x="3" y="9" width="18" height="13" rx="2"/><path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/></>,
    pin:      <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
    heart:    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
    msg:      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
    repeat:   <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
    share:    <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    photo:    <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
  };
  return <svg style={s} viewBox="0 0 24 24" {...p}>{d[n] ?? null}</svg>;
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{   opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, fontWeight: 500, color: '#0f172a',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Ic n="check" size={11} color="#16a34a" />
      </div>
      {message}
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function FeedTab({ reports = [], onTabChange, user }) {
  const [filter, setFilter] = useState('all');
  const [liked, setLiked]   = useState({});
  const [toast, setToast]   = useState(null);

  const allReports = [...MOCK, ...[...reports].reverse()];
  const isNews     = filter === 'news';
  const filtered   = isNews ? [] : allReports.filter(r => {
    if (filter === 'resolved') return r.status === 'resolved';
    if (filter === 'near')     return true;
    if (filter !== 'all')      return r.severity === filter;
    return true;
  });

  const stats = {
    critical: allReports.filter(r => r.severity === 'critical').length,
    high:     allReports.filter(r => r.severity === 'high').length,
    resolved: allReports.filter(r => r.status === 'resolved').length,
    total:    allReports.length,
  };

  async function handleShare(report) {
    try {
      if (navigator.share) {
        await navigator.share({ title: report.type || 'Проблема города', text: report.ai_comment || '', url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setToast('Ссылка скопирована!');
      }
    } catch { /* cancelled */ }
  }

  const nav = id => onTabChange?.(id);

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--bg)',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* ── LEFT SIDEBAR ── */}
      <Sidebar onNav={nav} user={user} />

      {/* ── CENTER FEED ── */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
        borderLeft: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
      }}>
        {/* Sticky header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'rgba(238,240,235,0.85)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {isNews ? 'Новости акимата' : 'Лента Алматы'}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                {isNews ? `${NEWS_POSTS.length} публикаций` : `${filtered.length} репортов`}
              </p>
            </div>
            <button
              onClick={() => nav('report')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#0f172a', color: '#fff',
                borderRadius: 20, padding: '7px 16px',
                fontSize: 13, fontWeight: 600, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Ic n="plus" size={13} color="#fff" />
              Сообщить
            </button>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', padding: '10px 20px 0' }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                background: 'transparent', border: 'none',
                color: filter === f.id ? '#0f172a' : '#94a3b8',
                padding: '8px 14px', fontSize: 13,
                fontWeight: filter === f.id ? 500 : 400,
                cursor: 'pointer',
                borderBottom: filter === f.id ? '2px solid #0f172a' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)' }}>
          {isNews ? (
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {NEWS_POSTS.map((post, i) => (
                <NewsPost key={post.id} post={post} index={i}
                  liked={!!liked[post.id]}
                  onLike={() => setLiked(p => ({ ...p, [post.id]: !p[post.id] }))}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100 }}>
              <Ic n="feed" size={32} color="#e2e8e0" />
              <div style={{ marginTop: 14, fontSize: 14, color: '#94a3b8' }}>Нет репортов</div>
            </div>
          ) : (
            <div>
              {filtered.map((r, i) => (
                <Post
                  key={r.id} r={r} index={i}
                  liked={!!liked[r.id]}
                  onLike={() => setLiked(p => ({ ...p, [r.id]: !p[r.id] }))}
                  onShare={() => handleShare(r)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── RIGHT PANEL ── */}
      <RightPanel reports={allReports} stats={stats} onNav={nav} />

      <AnimatePresence>
        {toast && <Toast key="toast" message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════ */
function Sidebar({ onNav, user }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: 240, flexShrink: 0,
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', letterSpacing: '-0.3px' }}>CityEye</span>
        <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 2 }}>
          Алматы
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 10px', flex: 1 }}>
        {NAV.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 + 0.1, duration: 0.3 }}
            onClick={() => onNav(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 10px', borderRadius: 8,
              background: item.id === 'feed' ? 'rgba(0,0,0,0.06)' : 'transparent',
              color: item.id === 'feed' ? '#0f172a' : '#64748b',
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: item.id === 'feed' ? 500 : 400,
              textAlign: 'left', marginBottom: 2, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (item.id !== 'feed') e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
            onMouseLeave={e => { if (item.id !== 'feed') e.currentTarget.style.background = 'transparent'; }}
          >
            <Ic n={item.icon} size={16} color={item.id === 'feed' ? '#0f172a' : '#94a3b8'} />
            {item.label}
          </motion.button>
        ))}
      </nav>

      {/* User */}
      {user?.role === 'government' ? (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(99,102,241,0.04)' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={user.avatar}
              alt={user.name}
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1', display: 'block' }}
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
            <div style={{
              display: 'none', width: 36, height: 36, borderRadius: '50%',
              background: '#eef2ff', border: '2px solid #6366f1',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#6366f1',
            }}>
              {user.initials}
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#22c55e', border: '1.5px solid #fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#6366f1' }}>Зам. акима Алматы</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 500 }}>Онлайн</span>
          </div>
        </div>
      ) : user?.role === 'business' ? (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(15,118,110,0.15)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(15,118,110,0.04)' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#ccfbf1', border: '2px solid #14b8a6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#0f766e', flexShrink: 0,
          }}>
            {user.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#0f766e' }}>{user.position}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#14b8a6' }} />
            <span style={{ fontSize: 10, color: '#0f766e', fontWeight: 500 }}>Бизнес</span>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Ic n="user" size={14} color="#94a3b8" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>Гражданин</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Алматы</div>
          </div>
          <button onClick={() => onNav('report')} style={{
            width: 26, height: 26, borderRadius: '50%',
            background: '#0f172a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Ic n="plus" size={13} color="#fff" />
          </button>
        </div>
      )}
    </motion.aside>
  );
}

/* ══════════════════════════════════════════
   POST
══════════════════════════════════════════ */
function Post({ r, index, liked, onLike, onShare }) {
  const sev      = SEV_CONFIG[r.status === 'resolved' ? 'resolved' : r.severity] ?? SEV_CONFIG.medium;
  const st       = ST_CONFIG[r.status] ?? ST_CONFIG.new;
  const initials = CAT_INITIALS[r.type] ?? 'ГО';
  const handle   = CAT_HANDLE[r.type]   ?? '@gorod';
  const likes    = fakeN(r.id, 7);
  const comments = fakeN(r.id, 13);
  const reposts  = fakeN(r.id, 17);
  const isCritical = r.severity === 'critical' && r.status !== 'resolved';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 14,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      whileHover={{ backgroundColor: 'rgba(0,0,0,0.015)' }}
    >
      {/* Avatar column */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <motion.div
          animate={isCritical ? { boxShadow: ['0 0 0 0 rgba(220,38,38,0.35)', '0 0 0 8px rgba(220,38,38,0)', '0 0 0 0 rgba(220,38,38,0)'] } : {}}
          transition={isCritical ? { duration: 2, repeat: Infinity, ease: 'easeOut' } : {}}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: sev.avatarBg,
            border: `1px solid ${sev.avatarColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: sev.avatarColor, letterSpacing: '-0.5px' }}>
            {initials}
          </span>
        </motion.div>
        <div style={{ width: 1.5, flex: 1, minHeight: 20, background: 'var(--border)', marginTop: 8 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            {CAT_LABEL[r.type] ?? r.type ?? 'Городская проблема'}
          </span>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>{handle}</span>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: st.color, flexShrink: 0, marginLeft: 2 }} />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            {timeAgo(r.created_at)}
          </span>
        </div>

        {/* Title */}
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 5, lineHeight: 1.4 }}>
          {r.type || r.title || 'Городская проблема'}
        </div>

        {/* Text */}
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#64748b', lineHeight: 1.65 }}>
          {r.ai_comment || r.description || ''}
        </p>

        {/* Photo */}
        {(r.image_url || r.image) ? (
          <img
            src={r.image_url || r.image}
            alt=""
            style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 10, display: 'block' }}
          />
        ) : (
          <div style={{
            height: 120, borderRadius: 10,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 10,
          }}>
            <Ic n="photo" size={26} color="#c8d4c4" />
          </div>
        )}

        {/* Address */}
        {r.address && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
            <Ic n="pin" size={11} color="#94a3b8" />
            {r.address}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 4 }}>
          <ActionBtn
            icon={
              <motion.div whileTap={{ scale: 1.3 }} transition={{ duration: 0.15 }}>
                <Ic n="heart" size={17} color={liked ? '#dc2626' : '#94a3b8'} fill={liked ? '#dc2626' : 'none'} />
              </motion.div>
            }
            label={liked ? likes + 1 : likes}
            active={liked} activeColor="#dc2626" onClick={onLike}
          />
          <ActionBtn icon={<Ic n="msg" size={17} color="#94a3b8" />} label={comments} onClick={() => {}} />
          <ActionBtn icon={<Ic n="repeat" size={17} color="#94a3b8" />} label={reposts} onClick={() => {}} />
          <div style={{ flex: 1 }} />
          <ActionBtn icon={<Ic n="share" size={16} color="#94a3b8" />} label="Поделиться" onClick={onShare} />
        </div>
      </div>
    </motion.div>
  );
}

function ActionBtn({ icon, label, onClick, active, activeColor }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: 'transparent', border: 'none',
      color: active ? activeColor : '#94a3b8',
      padding: '5px 8px', borderRadius: 8,
      fontSize: 13, fontWeight: 400, cursor: 'pointer', transition: 'color 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.color = active ? activeColor : '#0f172a'; }}
      onMouseLeave={e => { e.currentTarget.style.color = active ? activeColor : '#94a3b8'; }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════
   NEWS POST  (Threads-style)
══════════════════════════════════════════ */
function NewsPost({ post, index, liked, onLike }) {
  const [imgError, setImgError] = useState(false);
  const [commentHover, setCommentHover] = useState(false);
  const [shareHover, setShareHover]     = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ padding: '20px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 14 }}
    >
      {/* Left column — avatar + thread line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 44 }}>
        <div style={{ position: 'relative' }}>
          {!imgError ? (
            <img
              src={post.avatar}
              alt={post.author}
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1', display: 'block' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eef2ff', border: '2px solid #6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#6366f1' }}>
              {post.initials}
            </div>
          )}
          {/* Online dot */}
          <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
        </div>
        {/* Thread line */}
        <div style={{ width: 2, flex: 1, minHeight: 24, background: 'linear-gradient(to bottom, #e0e0e0 0%, transparent 100%)', marginTop: 6, borderRadius: 2 }} />
      </div>

      {/* Right column — content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>

        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a', letterSpacing: '-0.2px' }}>{post.author}</span>
          {/* Verified check */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#6366f1" style={{ flexShrink: 0 }}>
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, background: '#eef2ff', color: '#6366f1', padding: '2px 8px', borderRadius: 20, letterSpacing: '0.2px' }}>Официально</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#b0b8c4', flexShrink: 0 }}>{post.time}</span>
        </div>

        {/* Sub-line */}
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>{post.position}</div>

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.45, marginBottom: 9 }}>
          {post.title}
        </div>

        {/* Body text */}
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 14 }}>
          {post.content}
        </div>

        {/* Metric pill */}
        {post.metric && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '8px 16px', marginBottom: 14 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{post.metric}</span>
          </div>
        )}

        {/* Tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{ fontSize: 13, color: '#6366f1', fontWeight: 500 }}>#{tag}</span>
          ))}
        </div>

        {/* Action row — Threads style icon buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>

          {/* Like */}
          <motion.button
            onClick={onLike}
            whileTap={{ scale: 1.2 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: liked ? '#e11d48' : '#9ca3af',
              padding: '6px 10px 6px 0', fontSize: 13, fontWeight: 500,
              transition: 'color 0.15s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? '#e11d48' : 'none'} stroke={liked ? '#e11d48' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>{liked ? post.stats.likes + 1 : post.stats.likes}</span>
          </motion.button>

          {/* Comment */}
          <button
            onMouseEnter={() => setCommentHover(true)}
            onMouseLeave={() => setCommentHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: commentHover ? '#0f172a' : '#9ca3af',
              padding: '6px 10px', fontSize: 13, fontWeight: 500,
              transition: 'color 0.15s',
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{post.stats.comments}</span>
          </button>

          {/* Share */}
          <button
            onMouseEnter={() => setShareHover(true)}
            onMouseLeave={() => setShareHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: shareHover ? '#0f172a' : '#9ca3af',
              padding: '6px 10px', fontSize: 13, fontWeight: 500,
              transition: 'color 0.15s',
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>{post.stats.shares}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   RIGHT PANEL
══════════════════════════════════════════ */
function RightPanel({ reports, stats, onNav }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: 300, flexShrink: 0,
        padding: '24px 18px',
        overflowY: 'auto',
        borderLeft: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Stats grid */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          Статистика
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Всего',    value: stats.total,    color: '#0f172a' },
            { label: 'Критично', value: stats.critical,  color: '#dc2626' },
            { label: 'Высокий',  value: stats.high,      color: '#d97706' },
            { label: 'Решено',   value: stats.resolved,  color: '#16a34a' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 + 0.2 }}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 600, color: s.color, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Hotspots */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          Горячие точки
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {HOTSPOTS.map((h, i) => (
            <motion.div
              key={h.district}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 + 0.25 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: `${h.color}12`,
                border: `1px solid ${h.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Ic n="pin" size={13} color={h.color} />
              </div>
              <span style={{ flex: 1, fontSize: 13, color: '#64748b' }}>{h.district}</span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: h.color,
                background: `${h.color}12`, borderRadius: 20, padding: '2px 8px',
              }}>
                {h.count}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <motion.button
        onClick={() => onNav('report')}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', marginTop: 20,
          background: '#0f172a', color: '#fff',
          border: 'none', borderRadius: 10,
          padding: '10px 0', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <Ic n="plus" size={14} color="#fff" />
        Сообщить о проблеме
      </motion.button>
    </motion.aside>
  );
}
