import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getAIDossier, normalizeConfidenceLabel } from '../lib/aiTriage';
import {
  getAssignedOrgName,
  getReporterName,
  getReporterRole,
  getResponsibleRole,
  REPORT_STATUS_LABEL,
  REPORTER_ROLE_LABEL,
  RESPONSIBILITY_LABEL,
  RESPONSIBILITY_STYLE,
  isSharedCase,
} from '../lib/reportCollaboration';
import { readFeedComments, readFeedLikes, writeFeedComments, writeFeedLikes } from '../lib/feedSocial';

const VIEW_TABS = [
  { id: 'reports', label: 'Обращения' },
  { id: 'news', label: 'Новости акимата' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'urgent', label: 'Срочные' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'shared', label: 'Совместно' },
  { id: 'resolved', label: 'Решено' },
];

const CATEGORY_META = {
  road: { label: 'Дороги', color: '#dc2626', initials: 'ДР' },
  lighting: { label: 'Освещение', color: '#d97706', initials: 'ОС' },
  waste: { label: 'Мусор', color: '#ea580c', initials: 'МС' },
  greenery: { label: 'Озеленение', color: '#16a34a', initials: 'ЗЛ' },
  utilities: { label: 'Коммуникации', color: '#2563eb', initials: 'КМ' },
  parking: { label: 'Парковка', color: '#0f766e', initials: 'ПР' },
  vandal: { label: 'Вандализм', color: '#8b5cf6', initials: 'ВД' },
  other: { label: 'Город', color: '#64748b', initials: 'ГО' },
};

const SEVERITY_META = {
  critical: { label: 'Критично', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' },
  high: { label: 'Высокий', color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' },
  medium: { label: 'Средний', color: '#2563eb', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)' },
  low: { label: 'Низкий', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.18)' },
  resolved: { label: 'Решено', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.18)' },
};

const NEWS_POSTS = [
  {
    id: 'news-1',
    title: 'Убрали 47 незаконных рекламных щитов',
    content: 'За последние две недели демонтировали 47 незаконных рекламных конструкций вблизи школ и детских площадок. Работа продолжается в Медеуском и Ауэзовском районах.',
    time: '2 часа назад',
    tags: ['законность', 'безопасность', 'Алматы'],
    metric: '47 объектов демонтировано',
    stats: { shares: 18 },
  },
  {
    id: 'news-2',
    title: 'Отремонтировали 12 км дорог в Бостандыкском районе',
    content: 'Через CityEye получили повторяющиеся сигналы по дорожным дефектам на Аль-Фараби и Достык. На основе этих данных ускорили ремонт и закрыли критические участки.',
    time: '1 день назад',
    tags: ['дороги', 'ремонт', 'Бостандык'],
    metric: '89 дефектов устранено',
    stats: { shares: 26 },
  },
  {
    id: 'news-3',
    title: 'Восстановили освещение в пяти микрорайонах',
    content: 'После серии обращений через платформу заменили неработающие светильники и восстановили линии питания в зонах возле школ и остановок.',
    time: '3 дня назад',
    tags: ['освещение', 'безопасность'],
    metric: '34 фонаря восстановлено',
    stats: { shares: 12 },
  },
];

const MOCK_REPORTS = [
  {
    id: 'mk1',
    type: 'road',
    category: 'road',
    severity: 'critical',
    status: 'new',
    address: 'пр. Достык 130',
    ai_comment: 'Кафе заняло общественную парковку конусами и блокирует несколько машино-мест. Нужен выезд и демонтаж препятствий.',
    created_at: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: 'mk2',
    type: 'utilities',
    category: 'utilities',
    severity: 'critical',
    status: 'in_progress',
    address: 'ул. Байзакова 31',
    ai_comment: 'Прорыв трубы затапливает проезжую часть. Бригада уже направлена на место, но движение всё ещё затруднено.',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'mk3',
    type: 'lighting',
    category: 'lighting',
    severity: 'high',
    status: 'new',
    address: 'ул. Тимирязева 28',
    ai_comment: 'Фонари возле школы не работают больше недели. Вечером участок остаётся неосвещённым.',
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
];

function Ic({ n, size = 16, color = 'currentColor', fill = 'none' }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill,
    stroke: color,
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  const icons = {
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </>
    ),
    heart: <path d="M20.8 4.7a5.4 5.4 0 0 0-7.6 0L12 5.9l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.5 1.2-1.2a5.4 5.4 0 0 0 0-7.6z" />,
    msg: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4" />
        <path d="M15.4 6.5l-6.8 4" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
      </>
    ),
    official: (
      <>
        <path d="M12 2l7 4v6c0 5-3.1 8-7 10-3.9-2-7-5-7-10V6l7-4z" />
        <path d="M9.5 12.5l1.7 1.7 3.6-4" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="8.3" cy="9" r="1.4" />
        <path d="M21 15l-4.2-4.2L7 20" />
      </>
    ),
    check: <path d="M20 6L9 17l-5-5" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  };

  return <svg {...props}>{icons[n] ?? null}</svg>;
}

function safeTimeAgo(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'сейчас';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'сейчас';
  if (minutes < 60) return `${minutes}м`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ч`;
  const days = Math.floor(hours / 24);
  return `${days}д`;
}

function normalizeCategoryKey(value) {
  const source = String(value ?? '').toLowerCase();
  if (source.includes('road') || source.includes('яма') || source.includes('дорог') || source.includes('park')) return 'road';
  if (source.includes('light') || source.includes('осв')) return 'lighting';
  if (source.includes('waste') || source.includes('мусор') || source.includes('trash')) return 'waste';
  if (source.includes('green') || source.includes('зелен')) return 'greenery';
  if (source.includes('util') || source.includes('коммун') || source.includes('water')) return 'utilities';
  if (source.includes('vandal') || source.includes('графф') || source.includes('ванд')) return 'vandal';
  return 'other';
}

function normalizeSeverityKey(value, status) {
  if (status === 'resolved' || status === 'verified') return 'resolved';
  const source = String(value ?? '').toLowerCase();
  if (source.includes('крит') || source === 'critical') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
}

function hashCount(id, seed) {
  let hash = seed;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash % 90) + 3;
}

function buildViewer(user) {
  const role = user?.role || 'citizen';
  const name =
    user?.name
    || user?.full_name
    || user?.organization_name
    || (role === 'government' ? 'Сотрудник акимата' : role === 'business' ? 'Представитель подрядчика' : 'Житель Алматы');

  const initials = String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'ГА';

  return {
    name,
    role,
    roleLabel: REPORTER_ROLE_LABEL[role] || 'Гражданин',
    initials,
  };
}

function filterReports(reports, statusFilter, typeFilter, query) {
  const q = query.trim().toLowerCase();
  return reports.filter(report => {
    const severity = normalizeSeverityKey(report.severity, report.status);
    const category = normalizeCategoryKey(report.category ?? report.type);
    const shared = isSharedCase(report);

    if (statusFilter === 'urgent' && !['critical', 'high'].includes(severity)) return false;
    if (statusFilter === 'in_progress' && !['in_progress', 'waiting_partner'].includes(report.status)) return false;
    if (statusFilter === 'shared' && !shared) return false;
    if (statusFilter === 'resolved' && !['resolved', 'verified'].includes(report.status)) return false;
    if (typeFilter !== 'all' && category !== typeFilter) return false;

    if (!q) return true;
    const haystack = [
      report.detected_issue_title,
      report.title,
      report.address,
      report.ai_comment,
      report.description,
      report.comment,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

function FilterChip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]'
          : 'border-white/70 bg-white/72 text-slate-600 backdrop-blur-xl hover:border-slate-200 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function ThreadComposer({ draft, onDraftChange, onSubmit, submitLabel = 'Опубликовать' }) {
  return (
    <div className="glass-panel-matte mt-4 rounded-[22px] px-4 py-4 shadow-matte-md">
      <textarea
        value={draft}
        onChange={event => onDraftChange(event.target.value)}
        placeholder="Добавьте комментарий по кейсу…"
        className="min-h-[84px] w-full resize-none rounded-2xl border border-city-border bg-white/80 px-4 py-3 text-[14px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-[12px] text-slate-400">Комментарии сохраняются и остаются после обновления страницы.</div>
        <button onClick={onSubmit} className="glass-button-primary px-4 py-2 text-[13px]">
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function CommentList({ comments }) {
  if (comments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-city-border bg-white/55 px-4 py-4 text-[13px] text-slate-500">
        Пока нет комментариев. Начните обсуждение под обращением.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map(comment => (
        <div key={comment.id} className="rounded-2xl border border-white/75 bg-white/74 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700">
              {comment.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-slate-900">{comment.author_name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {comment.author_role_label}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">{safeTimeAgo(comment.created_at)}</div>
            </div>
          </div>
          <div className="mt-3 text-[14px] leading-6 text-slate-700">{comment.body}</div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({ icon, label, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[13px] font-semibold transition ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ReportThread({
  report,
  threadId,
  liked,
  comments,
  commentsOpen,
  draft,
  onToggleLike,
  onToggleComments,
  onDraftChange,
  onSubmitComment,
  onShare,
  onOpenMap,
}) {
  const severityKey = normalizeSeverityKey(report.severity, report.status);
  const severity = SEVERITY_META[severityKey] ?? SEVERITY_META.medium;
  const status = REPORT_STATUS_LABEL[report.status] || 'Новый';
  const category = normalizeCategoryKey(report.category ?? report.type);
  const categoryMeta = CATEGORY_META[category] ?? CATEGORY_META.other;
  const title = report.detected_issue_title || report.title || categoryMeta.label;
  const route = getResponsibleRole(report);
  const routeStyle = RESPONSIBILITY_STYLE[route] ?? RESPONSIBILITY_STYLE.government;
  const routeLabel = RESPONSIBILITY_LABEL[route] ?? 'Акимат';
  const reporterLabel = REPORTER_ROLE_LABEL[getReporterRole(report)] ?? 'Гражданин';
  const reporterName = getReporterName(report);
  const assignedOrg = getAssignedOrgName(report);
  const ai = getAIDossier(report);
  const confidence = normalizeConfidenceLabel(report.confidence_label, 'medium');
  const baseLikes = hashCount(threadId, 9);
  const beforeImage = report.image_url || report.image || null;
  const afterImage = report.completion_image_url || null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-city-border/70 px-5 py-5 last:border-b-0 sm:px-7"
    >
      <div className="flex gap-4">
        <div className="flex w-11 flex-shrink-0 flex-col items-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full border text-[12px] font-bold shadow-[0_10px_22px_rgba(15,23,42,0.08)]"
            style={{ borderColor: `${categoryMeta.color}33`, color: categoryMeta.color, background: `${categoryMeta.color}12` }}
          >
            {categoryMeta.initials}
          </div>
          <div className="mt-3 h-full w-px min-h-8 bg-gradient-to-b from-slate-200 via-slate-100 to-transparent" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
                <span className="font-semibold text-slate-900">{categoryMeta.label}</span>
                <span>{reporterLabel}: {reporterName}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{safeTimeAgo(report.created_at)}</span>
              </div>
              <div className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-slate-950">{title}</div>
            </div>
            <div
              className="rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ background: severity.bg, borderColor: severity.border, color: severity.color }}
            >
              {severity.label}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="rounded-full border px-3 py-1 text-[11px] font-semibold"
              style={{ background: routeStyle.bg, borderColor: routeStyle.border, color: routeStyle.color }}
            >
              {routeLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
              {status}
            </span>
            {isSharedCase(report) ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                Shared-case
              </span>
            ) : null}
            {report.confidence_label ? (
              <span
                className="rounded-full border px-3 py-1 text-[11px] font-semibold"
                style={{
                  background: ai.confidence.bg,
                  borderColor: ai.confidence.border,
                  color: ai.confidence.color,
                }}
              >
                AI {String(confidence).toUpperCase()}
              </span>
            ) : null}
          </div>

          <div className="mt-4 text-[15px] leading-7 text-slate-700">
            {report.ai_comment || report.description || report.comment || 'Описание пока не добавлено.'}
          </div>

          <div className="mt-4 grid gap-3 text-[13px] text-slate-500 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/70 bg-white/72 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Источник</div>
              <div className="mt-2 font-semibold text-slate-900">{reporterName}</div>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/72 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Исполнитель</div>
              <div className="mt-2 font-semibold text-slate-900">{assignedOrg || routeLabel}</div>
            </div>
          </div>

          {beforeImage || afterImage ? (
            <div className={`mt-4 grid gap-3 ${beforeImage && afterImage ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
              {beforeImage ? (
                <div className="overflow-hidden rounded-[22px] border border-city-border bg-white/70">
                  <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">До</div>
                  <img src={beforeImage} alt="До" className="mt-2 h-52 w-full object-cover" />
                </div>
              ) : null}
              {afterImage ? (
                <div className="overflow-hidden rounded-[22px] border border-emerald-200 bg-emerald-50/70">
                  <div className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">После</div>
                  <img src={afterImage} alt="После" className="mt-2 h-52 w-full object-cover" />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
            {report.address ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2">
                <Ic n="pin" size={14} color="#64748b" />
                {report.address}
              </span>
            ) : null}
            {report.partner_comment ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-amber-700">
                <Ic n="spark" size={14} color="#c2410c" />
                Есть координационный комментарий
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ActionButton
              active={liked}
              onClick={onToggleLike}
              icon={<Ic n="heart" size={16} color={liked ? '#ffffff' : '#94a3b8'} fill={liked ? '#ffffff' : 'none'} />}
              label={liked ? `${baseLikes + 1}` : `${baseLikes}`}
            />
            <ActionButton
              active={commentsOpen}
              onClick={onToggleComments}
              icon={<Ic n="msg" size={16} color={commentsOpen ? '#ffffff' : '#94a3b8'} />}
              label={`${comments.length}`}
            />
            <ActionButton onClick={onOpenMap} icon={<Ic n="pin" size={16} color="#94a3b8" />} label="На карте" />
            <ActionButton onClick={onShare} icon={<Ic n="share" size={16} color="#94a3b8" />} label="Поделиться" />
          </div>

          <AnimatePresence initial={false}>
            {commentsOpen ? (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 18 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 rounded-[24px] border border-city-border/70 bg-[#f7faf7]/95 px-4 py-4">
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <Ic n="msg" size={14} color="#94a3b8" />
                    Обсуждение кейса
                  </div>
                  <CommentList comments={comments} />
                  <ThreadComposer
                    draft={draft}
                    onDraftChange={onDraftChange}
                    onSubmit={onSubmitComment}
                    submitLabel="Добавить комментарий"
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

function NewsThread({
  post,
  threadId,
  comments,
  commentsOpen,
  draft,
  liked,
  onToggleLike,
  onToggleComments,
  onDraftChange,
  onSubmitComment,
  onShare,
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-city-border/70 px-5 py-5 last:border-b-0 sm:px-7"
    >
      <div className="flex gap-4">
        <div className="flex w-11 flex-shrink-0 flex-col items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 shadow-[0_10px_22px_rgba(99,102,241,0.12)]">
            <Ic n="official" size={18} color="#6366f1" />
          </div>
          <div className="mt-3 h-full w-px min-h-8 bg-gradient-to-b from-indigo-200 via-slate-100 to-transparent" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
            <span className="font-semibold text-slate-900">Ruslan Berdenov</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
              Официально
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{post.time}</span>
          </div>
          <div className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-slate-950">{post.title}</div>
          <div className="mt-4 text-[15px] leading-7 text-slate-700">{post.content}</div>

          {post.metric ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700">
              <Ic n="check" size={14} color="#16a34a" />
              {post.metric}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span key={tag} className="rounded-full bg-white/70 px-3 py-1 text-[12px] font-semibold text-slate-500">
                #{tag}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ActionButton
              active={liked}
              onClick={onToggleLike}
              icon={<Ic n="heart" size={16} color={liked ? '#ffffff' : '#94a3b8'} fill={liked ? '#ffffff' : 'none'} />}
              label={liked ? `${(post.stats?.shares ?? 12) + 1}` : `${post.stats?.shares ?? 12}`}
            />
            <ActionButton
              active={commentsOpen}
              onClick={onToggleComments}
              icon={<Ic n="msg" size={16} color={commentsOpen ? '#ffffff' : '#94a3b8'} />}
              label={`${comments.length}`}
            />
            <ActionButton onClick={onShare} icon={<Ic n="share" size={16} color="#94a3b8" />} label="Поделиться" />
          </div>

          <AnimatePresence initial={false}>
            {commentsOpen ? (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 18 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 rounded-[24px] border border-city-border/70 bg-[#f7faf7]/95 px-4 py-4">
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    <Ic n="msg" size={14} color="#94a3b8" />
                    Обсуждение публикации
                  </div>
                  <CommentList comments={comments} />
                  <ThreadComposer
                    draft={draft}
                    onDraftChange={onDraftChange}
                    onSubmit={onSubmitComment}
                    submitLabel="Ответить"
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

export default function FeedTab({ reports = [], onTabChange, user, onOpenReportOnMap }) {
  const [view, setView] = useState('reports');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openComments, setOpenComments] = useState({});
  const [drafts, setDrafts] = useState({});
  const [commentsMap, setCommentsMap] = useState(() => readFeedComments());
  const [likesMap, setLikesMap] = useState(() => readFeedLikes());
  const [toast, setToast] = useState(null);

  useEffect(() => {
    writeFeedComments(commentsMap);
  }, [commentsMap]);

  useEffect(() => {
    writeFeedLikes(likesMap);
  }, [likesMap]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const feedReports = useMemo(() => {
    const base = reports.length > 0 ? reports : MOCK_REPORTS;
    return [...base].sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
  }, [reports]);

  const typeOptions = useMemo(() => {
    const set = new Set(feedReports.map(report => normalizeCategoryKey(report.category ?? report.type)));
    return ['all', ...set];
  }, [feedReports]);

  const filteredReports = useMemo(
    () => filterReports(feedReports, statusFilter, typeFilter, query),
    [feedReports, statusFilter, typeFilter, query]
  );

  const viewer = useMemo(() => buildViewer(user), [user]);

  function toggleLike(threadId) {
    setLikesMap(current => ({
      ...current,
      [threadId]: !current[threadId],
    }));
  }

  function toggleComments(threadId) {
    setOpenComments(current => ({
      ...current,
      [threadId]: !current[threadId],
    }));
  }

  function handleSubmitComment(threadId) {
    const draft = String(drafts[threadId] ?? '').trim();
    if (!draft) return;

    const nextComment = {
      id: `${threadId}-${Date.now()}`,
      body: draft,
      author_name: viewer.name,
      author_role: viewer.role,
      author_role_label: viewer.roleLabel,
      initials: viewer.initials,
      created_at: new Date().toISOString(),
    };

    setCommentsMap(current => ({
      ...current,
      [threadId]: [...(current[threadId] ?? []), nextComment],
    }));
    setDrafts(current => ({ ...current, [threadId]: '' }));
    setOpenComments(current => ({ ...current, [threadId]: true }));
    setToast('Комментарий добавлен');
  }

  async function handleShare(item, type) {
    const shareUrl = window.location.href;
    const title = type === 'news' ? item.title : (item.detected_issue_title || item.title || 'Городская проблема');

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: item.ai_comment || item.content || '',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setToast('Ссылка скопирована');
      }
    } catch {
      /* ignore cancelled share */
    }
  }

  function handleOpenMap(report) {
    onOpenReportOnMap?.(report);
    if (!onOpenReportOnMap) {
      onTabChange?.('map');
    }
  }

  const visibleItems = view === 'reports' ? filteredReports : NEWS_POSTS;

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel-matte relative overflow-hidden rounded-[30px] px-5 py-5 shadow-matte-xl sm:px-6"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-0 h-28 w-40 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,rgba(59,130,246,0)_72%)]" />
          <div className="absolute right-0 top-0 h-32 w-44 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.12)_0%,rgba(16,185,129,0)_74%)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        </div>

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] font-semibold tracking-[-0.05em] text-slate-950">Лента Алматы</h1>
                <span className="glass-chip border-white/80 bg-white/75 px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-none">
                  {view === 'reports' ? `${filteredReports.length} кейсов` : `${NEWS_POSTS.length} публикации`}
                </span>
              </div>
              <div className="mt-1 text-[13px] text-slate-400">
                {view === 'reports' ? 'Городские обращения, совместные кейсы и фотофиксация результата.' : 'Официальные обновления и отчёты по городу.'}
              </div>
            </div>
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <span className="hidden rounded-full border border-white/80 bg-white/70 px-3 py-2 text-[12px] font-semibold text-slate-500 md:inline-flex">
                Алматы
              </span>
              <button onClick={() => onTabChange?.('report')} className="glass-button-primary px-5 py-3 text-[14px]">
                <span className="inline-flex items-center gap-2">
                  <Ic n="plus" size={16} color="#ffffff" />
                  Сообщить
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/70 pt-4">
          <div className="flex flex-wrap gap-2">
            {VIEW_TABS.map(tab => (
              <FilterChip key={tab.id} active={view === tab.id} onClick={() => setView(tab.id)}>
                {tab.label}
              </FilterChip>
            ))}
          </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1 max-w-[420px]">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                  <Ic n="search" size={16} color="#94a3b8" />
              </div>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Поиск по адресу, диагнозу или описанию"
                className="w-full rounded-full border border-white/75 bg-white/78 py-3 pl-11 pr-4 text-[14px] text-slate-700 outline-none backdrop-blur-xl placeholder:text-slate-400 focus:border-slate-300"
              />
            </div>

              {view === 'reports' ? (
                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map(item => (
                    <FilterChip key={item.id} active={statusFilter === item.id} onClick={() => setStatusFilter(item.id)}>
                      {item.label}
                    </FilterChip>
                  ))}
                </div>
              ) : null}
            </div>

            {view === 'reports' ? (
              <div className="flex flex-wrap gap-2">
                {typeOptions.map(type => {
                  const meta = CATEGORY_META[type] ?? CATEGORY_META.other;
                  return (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                        typeFilter === type
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-white/75 bg-white/72 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: typeFilter === type ? 'rgba(255,255,255,0.85)' : meta.color }}
                      />
                      {type === 'all' ? 'Все типы' : meta.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </motion.section>

      <div className="mt-6 overflow-hidden rounded-[30px] border border-city-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.84)_0%,rgba(248,250,248,0.92)_100%)] shadow-matte-xl backdrop-blur-xl">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <div className="glass-chip mb-3">
              <Ic n="spark" size={14} color="#64748b" />
              Лента пустая
            </div>
            <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">Ничего не найдено по текущим фильтрам</h2>
            <p className="mt-2 max-w-[440px] text-[14px] leading-6 text-slate-500">
              Сбросьте часть фильтров или воспользуйтесь поиском, чтобы посмотреть больше обращений по городу.
            </p>
          </div>
        ) : view === 'reports' ? (
          filteredReports.map(report => {
            const threadId = `report:${report.id}`;
            return (
              <ReportThread
                key={threadId}
                report={report}
                threadId={threadId}
                liked={Boolean(likesMap[threadId])}
                comments={commentsMap[threadId] ?? []}
                commentsOpen={Boolean(openComments[threadId])}
                draft={drafts[threadId] ?? ''}
                onToggleLike={() => toggleLike(threadId)}
                onToggleComments={() => toggleComments(threadId)}
                onDraftChange={value => setDrafts(current => ({ ...current, [threadId]: value }))}
                onSubmitComment={() => handleSubmitComment(threadId)}
                onShare={() => handleShare(report, 'report')}
                onOpenMap={() => handleOpenMap(report)}
              />
            );
          })
        ) : (
          NEWS_POSTS.map(post => {
            const threadId = `news:${post.id}`;
            return (
              <NewsThread
                key={threadId}
                post={post}
                threadId={threadId}
                liked={Boolean(likesMap[threadId])}
                comments={commentsMap[threadId] ?? []}
                commentsOpen={Boolean(openComments[threadId])}
                draft={drafts[threadId] ?? ''}
                onToggleLike={() => toggleLike(threadId)}
                onToggleComments={() => toggleComments(threadId)}
                onDraftChange={value => setDrafts(current => ({ ...current, [threadId]: value }))}
                onSubmitComment={() => handleSubmitComment(threadId)}
                onShare={() => handleShare(post, 'news')}
              />
            );
          })
        )}
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="glass-panel-matte fixed bottom-6 right-6 z-50 rounded-2xl px-4 py-3 shadow-matte-lg"
          >
            <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
              <Ic n="check" size={14} color="#16a34a" />
              {toast}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
