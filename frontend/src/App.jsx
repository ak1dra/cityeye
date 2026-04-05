import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Handshake,
  Sparkles,
  X,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import './index.css';
import YandexMap from './YandexMap';
import FeedTab from './tabs/FeedTab';
import ReportTab from './tabs/ReportTab';
import Dashboard from './tabs/Dashboard';
import BusinessDashboard from './tabs/BusinessDashboard';
import AuthPage from './AuthPage';
import { AITriagePanel } from './components/AITriagePanel';
import { GlassPanel } from './components/GlassPanel';
import { getAnalyticsOverview, getReports } from './api';
import { buildClientAnalyticsOverview } from './lib/analytics';
import { ensureProfileForAuthUser } from './lib/auth';
import { getAIDossier } from './lib/aiTriage';
import { clearDemoUser, readDemoReports, readDemoUser, writeDemoUser } from './lib/demoAuth';
import {
  getAssignedOrgName,
  getReporterName,
  getResponsibleRole,
  isSharedCase,
  REPORT_STATUS_LABEL,
  RESPONSIBILITY_LABEL,
  RESPONSIBILITY_STYLE,
} from './lib/reportCollaboration';

/* ── Constants ── */
const ACTIVE_TAB_STORAGE_KEY = 'cityeye_active_tab';
const AUTH_TARGET_STORAGE_KEY = 'cityeye_auth_target';
const DEFAULT_TAB = 'map';
const HASH_PREFIX = '#/';
const AUTH_ROUTE_PREFIX = 'auth/';
const AUTH_VIEWS = ['sign-in', 'sign-up', 'gov'];

const TABS = [
  { id: 'map',    label: 'Карта' },
  { id: 'feed',   label: 'Лента' },
  { id: 'report', label: 'Репорт' },
  { id: 'gov',    label: 'Акимат' },
  { id: 'business', label: 'Подрядчик' },
];

const FILTERS = [
  { id: 'all',         label: 'Все обращения', color: '#0f172a' },
  { id: 'priority',    label: 'Срочные',       color: '#dc2626' },
  { id: 'in_progress', label: 'В работе',      color: '#d97706' },
  { id: 'shared',      label: 'Совместно',     color: '#a16207' },
  { id: 'resolved',    label: 'Решено',        color: '#16a34a' },
];

const MAP_LAYER_MODES = [
  { id: 'pins', label: 'Пины' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'both', label: 'Оба слоя' },
];

const TYPE_GRID = [
  { id: 'all',      label: 'Все типы',   color: '#0f172a' },
  { id: 'road',     label: 'Дороги',    color: '#dc2626' },
  { id: 'lighting', label: 'Освещение', color: '#d97706' },
  { id: 'waste',    label: 'Мусор',     color: '#ea580c' },
  { id: 'greenery', label: 'Зелень',    color: '#16a34a' },
  { id: 'utilities', label: 'Коммуникации', color: '#2563eb' },
];

const CATEGORY_LABEL = {
  road: 'Дороги', lighting: 'Освещение', greenery: 'Озеленение',
  utilities: 'Коммуникации', waste: 'Мусор', other: 'Другое',
};

const SEV_COLORS = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb',
  low: '#7c3aed', resolved: '#16a34a',
};

const SEV_LABEL = {
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
  resolved: 'Решено',
};

const FILTER_ICONS = {
  all: Sparkles,
  priority: CircleAlert,
  in_progress: Clock3,
  shared: Handshake,
  resolved: CheckCircle2,
};

const SEVERITY_ICONS = {
  critical: CircleAlert,
  high: CircleAlert,
  medium: Clock3,
  low: Sparkles,
  resolved: CheckCircle2,
};

function canAccessTab(tabId, user) {
  if (!TABS.some(tab => tab.id === tabId)) return false;
  if (tabId === 'gov') return user?.role === 'government' && user?.status === 'active';
  if (tabId === 'business') return user?.role === 'business' && user?.status === 'active';
  return true;
}

function getVisibleTabs(user) {
  return TABS.filter(tab => {
    if (tab.id === 'gov') return canAccessTab('gov', user);
    if (tab.id === 'business') return canAccessTab('business', user);
    return true;
  });
}

function readStoredTab() {
  try {
    const storedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return TABS.some(tab => tab.id === storedTab) ? storedTab : DEFAULT_TAB;
  } catch {
    return DEFAULT_TAB;
  }
}

function parseHashState(hash) {
  const normalizedHash = (hash || '').trim();
  if (!normalizedHash) return { tab: null, authView: null };

  const route = normalizedHash.replace(/^#\/?/, '').trim();
  if (TABS.some(tab => tab.id === route)) {
    return { tab: route, authView: null };
  }

  if (route.startsWith(AUTH_ROUTE_PREFIX)) {
    const authView = route.slice(AUTH_ROUTE_PREFIX.length);
    if (AUTH_VIEWS.includes(authView)) {
      return { tab: null, authView };
    }
  }

  return null;
}

function buildHash(tabId) {
  return `${HASH_PREFIX}${tabId}`;
}

function buildAuthHash(view) {
  return `${HASH_PREFIX}${AUTH_ROUTE_PREFIX}${view}`;
}

function resolveInitialHashState() {
  if (typeof window === 'undefined') {
    return { tab: DEFAULT_TAB, authView: null };
  }

  return parseHashState(window.location.hash) ?? { tab: readStoredTab(), authView: null };
}

function readAuthTarget() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(AUTH_TARGET_STORAGE_KEY);
}

function writeAuthTarget(target) {
  if (typeof window === 'undefined') return;
  if (!target) {
    window.sessionStorage.removeItem(AUTH_TARGET_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(AUTH_TARGET_STORAGE_KEY, target);
}

function clearAuthTarget() {
  writeAuthTarget(null);
}

function managedSubtitle(user) {
  if (user?.role === 'government') return 'Зам. акима Алматы';
  if (user?.role === 'business') return user.position ?? 'Подрядчик городской инфраструктуры';
  return null;
}

function managedAccent(user) {
  if (user?.role === 'government') {
    return { color: '#6366f1', soft: '#eef2ff', border: '#6366f1', status: '#22c55e' };
  }
  return { color: '#0f766e', soft: '#ccfbf1', border: '#14b8a6', status: '#14b8a6' };
}

function normalizeSeverityKey(value, status) {
  if (status === 'resolved' || status === 'verified') return 'resolved';
  const source = String(value ?? '').toLowerCase();
  if (source.includes('крит') || source === 'critical') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
}

function getReportType(report) {
  return report?.type ?? report?.category ?? 'other';
}

function matchesPrimaryFilter(report, filterId) {
  const severity = normalizeSeverityKey(report?.severity, report?.status);
  const status = report?.status ?? 'new';

  if (filterId === 'all') return true;
  if (filterId === 'priority') return severity === 'critical' || severity === 'high';
  if (filterId === 'in_progress') return status === 'in_progress' || status === 'waiting_partner' || status === 'triage';
  if (filterId === 'shared') return isSharedCase(report);
  if (filterId === 'resolved') return status === 'resolved' || status === 'verified';
  return true;
}

function matchesTypeFilter(report, filterId) {
  if (filterId === 'all') return true;
  return getReportType(report) === filterId;
}

function sortReports(list) {
  return [...list].sort((left, right) => {
    const rightDate = new Date(right?.created_at ?? 0).getTime();
    const leftDate = new Date(left?.created_at ?? 0).getTime();
    return rightDate - leftDate;
  });
}

function getSeverityLabel(report) {
  return SEV_LABEL[normalizeSeverityKey(report?.severity, report?.status)] ?? 'Средний';
}

function getSeverityIcon(level) {
  return SEVERITY_ICONS[level] ?? Sparkles;
}

function getFilterIcon(filterId) {
  return FILTER_ICONS[filterId] ?? Sparkles;
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Недавно';
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  return `${days} д назад`;
}

function getPrimaryImage(report) {
  return report?.image_url || report?.image || null;
}

function getReportTitle(report) {
  return report?.detected_issue_title || CATEGORY_LABEL[getReportType(report)] || 'Проблема';
}

/* ── Navbar ── */
function Navbar({ tab, onTabChange, user, onAuth, onLogout, floating = false }) {
  const isManagedUser = user?.role === 'government' || user?.role === 'business';
  const visibleTabs = getVisibleTabs(user);

  return (
    <motion.header
      className={
        floating
          ? 'glass-panel-matte absolute inset-x-4 top-4 z-30 flex h-[60px] items-center justify-between px-5'
          : 'glass-navbar flex items-center justify-between px-5'
      }
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="text-[15px] font-bold tracking-[-0.3px] text-city-text">
        CityEye
      </span>

      <nav className="flex gap-1.5 rounded-full bg-white/40 px-1.5 py-1">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`rounded-full px-3 py-1.5 text-[13px] transition ${
              tab === t.id
                ? 'bg-white text-city-text shadow-matte'
                : 'bg-transparent text-city-subtle hover:text-city-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2.5">
        {user ? (
          isManagedUser ? (
            <div className="flex items-center gap-2.5">
              {(() => {
                const accent = managedAccent(user);
                return (
                  <>
              <div className="relative shrink-0">
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
              <div className="leading-[1.25]">
                <div className="text-[13px] font-semibold text-city-text">{user.name}</div>
                <div style={{ fontSize: 11, color: accent.color }}>{managedSubtitle(user)}</div>
              </div>
                  </>
                );
              })()}
              <button onClick={onLogout} className="glass-button-secondary ml-1 px-3 py-1.5 text-[13px]">
                Выйти
              </button>
            </div>
          ) : (
            <>
              <span className="text-[13px] text-city-muted">{user.name}</span>
              <button onClick={onLogout} className="glass-button-secondary px-3 py-1.5 text-[13px]">
                Выйти
              </button>
            </>
          )
        ) : (
          <button onClick={onAuth} className="glass-button-primary px-4 py-2 text-[13px]">
            Войти в кабинет
          </button>
        )}
      </div>
    </motion.header>
  );
}

/* ── Left Panel ── */
function LeftPanel({
  reports,
  filteredReports,
  activeFilter,
  setActiveFilter,
  activeType,
  setActiveType,
  loading,
  onReset,
  compact = false,
}) {
  const count = id => {
    return reports.filter(report => matchesPrimaryFilter(report, id)).length;
  };

  const typeCount = id => {
    if (id === 'all') return reports.length;
    return reports.filter(report => matchesTypeFilter(report, id)).length;
  };

  const activeCount = reports.filter(report => !['resolved', 'verified', 'rejected'].includes(report.status)).length;
  const sharedCount = reports.filter(report => isSharedCase(report)).length;
  const resolvedCount = reports.filter(report => ['resolved', 'verified'].includes(report.status)).length;
  const hasActiveFilters = activeFilter !== 'all' || activeType !== 'all';

  return (
    <GlassPanel
      delay={0.1}
      className="glass-drawer"
      style={{ height: '100%' }}
    >
      <div className={`flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto ${compact ? 'px-[14px] py-4' : 'px-4 py-[18px]'}`}>
        <section className="rounded-3xl border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(245,248,242,0.96))] p-4 text-city-text shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-city-subtle">
            Главный экран
          </div>
          <div className={`${compact ? 'text-[17px]' : 'text-[20px]'} mt-2 font-bold leading-[1.15] text-city-text`}>
            Карта города без перегруза
          </div>
          <p className="mt-2.5 text-[12px] leading-[1.6] text-city-muted">
            Смотрите живые точки, переключайте фильтры и быстро находите нужный кейс на карте.
          </p>
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <MetricCard
              label="Показываем"
              value={loading ? '...' : filteredReports.length}
              hint={`из ${reports.length}`}
            />
            <MetricCard
              label="Срочных"
              value={reports.filter(report => matchesPrimaryFilter(report, 'priority')).length}
              hint="critical + high"
            />
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2.5">
            <SectionLabel>Показывать</SectionLabel>
            {hasActiveFilters ? (
              <button
                onClick={onReset}
                className="glass-chip px-3 py-1.5"
              >
                Сбросить
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            {FILTERS.map(f => {
              const Icon = getFilterIcon(f.id);
              const isActive = activeFilter === f.id;

              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left text-[13px] transition ${
                    isActive
                      ? 'border-city-text bg-city-text font-semibold text-white shadow-matte-lg'
                      : 'border-city-border bg-white/65 font-medium text-city-text hover:border-city-border-hover hover:bg-white/90'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                      isActive ? 'border-white/15 bg-white/10 text-white' : 'border-white/90 bg-white text-city-text shadow-sm'
                    }`}
                  >
                    <Icon size={15} strokeWidth={2.1} color={isActive ? '#ffffff' : f.color} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{f.label}</span>
                  </span>
                  <span className={`text-[11px] font-semibold ${isActive ? 'text-white/65' : 'text-city-subtle'}`}>
                    {count(f.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <SectionLabel>Тип проблемы</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_GRID.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveType(c.id)}
                className={`rounded-xl border px-2.5 py-3 text-left transition ${
                  activeType === c.id
                    ? 'border-city-text bg-city-text text-white shadow-matte'
                    : 'border-city-border bg-white/70 text-city-text hover:border-city-border-hover hover:bg-white'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${activeType === c.id ? 'border-white/15 bg-white/12' : 'border-white/90 bg-white shadow-sm'}`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeType === c.id ? 'rgba(255,255,255,0.92)' : c.color }} />
                  </span>
                </div>
                <div className={`text-[12px] font-semibold ${activeType === c.id ? 'text-white' : 'text-city-text'}`}>{c.label}</div>
                <div className="mt-0.5 text-[11px] text-city-subtle">
                  {typeCount(c.id)} реп.
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Сводка</SectionLabel>
          <div className="grid grid-cols-1 gap-2">
            <MetricCard label="Активных обращений" value={activeCount} hint="нужна реакция" />
            <MetricCard label="Совместных кейсов" value={sharedCount} hint="акимат + подрядчик" />
            <MetricCard label="Уже решено" value={resolvedCount} hint="с фотофиксацией" />
          </div>
        </section>
      </div>
    </GlassPanel>
  );
}

/* ── Right Panel ── */
function RightPanel({
  selectedReport,
  reports,
  totalReports,
  loading,
  user,
  onReport,
  onDashboard,
  onClearFilters,
  compact = false,
}) {
  const priorityCount = totalReports.filter(report => matchesPrimaryFilter(report, 'priority')).length;
  const showDashboardAction = user?.role === 'government' || user?.role === 'business';
  const primaryCtaLabel = showDashboardAction
    ? user?.role === 'business'
      ? 'Открыть подрядчика'
      : 'Открыть акимат'
    : 'Сообщить рядом';
  const selectedSeverity = selectedReport ? normalizeSeverityKey(selectedReport.severity, selectedReport.status) : null;
  const selectedResponsibility = selectedReport ? getResponsibleRole(selectedReport) : null;
  const selectedResponsibilityStyle = selectedResponsibility
    ? (RESPONSIBILITY_STYLE[selectedResponsibility] ?? RESPONSIBILITY_STYLE.government)
    : RESPONSIBILITY_STYLE.government;
  const selectedDossier = selectedReport ? getAIDossier(selectedReport) : null;

  return (
    <GlassPanel
      delay={0.15}
      className="glass-drawer"
      style={{ height: '100%' }}
    >
      <div className={`${compact ? 'px-4 pb-3 pt-4' : 'px-[18px] pb-[14px] pt-[18px]'} shrink-0 border-b border-city-border`}>
        <SectionLabel>{selectedReport ? 'Выбрано на карте' : 'Кейс на карте'}</SectionLabel>
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[16px] font-bold text-city-text">
              {selectedReport ? 'Карточка обращения' : 'Выберите метку'}
            </div>
            <div className="mt-1 text-[12px] text-city-muted">
              {selectedReport
                ? formatRelativeTime(selectedReport.created_at)
                : loading
                  ? 'Загружаем данные…'
                  : `Показываем ${reports.length} из ${totalReports.length}`}
            </div>
          </div>
          <button
            onClick={onClearFilters}
            disabled={loading}
            className="glass-chip"
          >
            Сбросить
          </button>
        </div>
      </div>

      <div className={`${compact ? 'p-4' : 'p-[18px]'} flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto`}>
        {loading ? (
          <div className="px-[18px] py-7 text-center text-[13px] text-city-subtle">
            Загружаем обращения…
          </div>
        ) : selectedReport ? (
          <>
            {(selectedReport.completion_image_url && getPrimaryImage(selectedReport)) ? (
              <div className="grid grid-cols-2 gap-2.5">
                <DetailImage title="До" src={getPrimaryImage(selectedReport)} />
                <DetailImage title="После" src={selectedReport.completion_image_url} positive />
              </div>
            ) : getPrimaryImage(selectedReport) ? (
              <DetailImage title="Фото кейса" src={getPrimaryImage(selectedReport)} tall />
            ) : null}

            <div className={`${compact ? 'p-[14px]' : 'p-4'} rounded-3xl border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(246,248,244,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`${compact ? 'text-[18px]' : 'text-[20px]'} font-bold leading-[1.2] text-city-text`}>
                    {getReportTitle(selectedReport)}
                  </div>
                  <div className="mt-1.5 text-[13px] leading-[1.5] text-city-muted">
                    {selectedReport.address || 'Алматы'}
                  </div>
                </div>
                <SeverityBadge severity={selectedSeverity} text={getSeverityLabel(selectedReport)} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <SmallBadge neutral text={REPORT_STATUS_LABEL[selectedReport.status] ?? 'Новый'} />
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-bold"
                  style={{
                    background: selectedResponsibilityStyle.bg,
                    border: `1px solid ${selectedResponsibilityStyle.border}`,
                    color: selectedResponsibilityStyle.color,
                  }}
                >
                  {RESPONSIBILITY_LABEL[selectedResponsibility]}
                </span>
              </div>

              <div className="mt-3.5 grid gap-2.5">
                <DetailInfo label="Источник" value={getReporterName(selectedReport)} />
                <DetailInfo label="Исполнитель" value={getAssignedOrgName(selectedReport) || 'Назначается акиматом'} />
                <DetailInfo label="Опубликовано" value={formatRelativeTime(selectedReport.created_at)} />
              </div>
            </div>

            {selectedDossier?.hasTriage ? (
              <AITriagePanel data={selectedReport} compact title="AI summary" />
            ) : null}
          </>
        ) : (
          <>
            <div className={`${compact ? 'p-[14px]' : 'p-4'} rounded-3xl border border-white/85 bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(246,248,244,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]`}>
              <div className="text-[18px] font-bold leading-[1.2] text-city-text">
                Нажмите на точку, чтобы увидеть кейс
              </div>
              <div className="mt-2 text-[13px] leading-[1.65] text-city-muted">
                Справа появится карточка обращения с фото, маршрутом, статусом и AI-сводкой.
              </div>
              <div className="mt-3.5 grid gap-2">
                <HintLine title="1. Выберите метку" text="Клик по пину откроет карточку кейса и центрирует внимание на проблеме." />
                <HintLine title="2. Используйте фильтры" text="Сужайте карту до срочных, решённых или совместных кейсов." />
                <HintLine title="3. Сообщите о новой проблеме" text="Если на карте нет нужного кейса, отправьте новый репорт с фото." />
              </div>
            </div>

            <div className={`${compact ? 'p-[14px]' : 'p-4'} rounded-3xl border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.86),rgba(246,248,244,0.92))]`}>
              <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-city-subtle">
                Сводка по карте
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricCard label="На карте" value={reports.length} hint={`из ${totalReports.length}`} />
                <MetricCard label="Срочных" value={priorityCount} hint="нужна реакция" />
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className={`mx-3 mb-3 shrink-0 rounded-3xl p-[14px] ${
          showDashboardAction
            ? 'border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(243,247,242,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]'
            : 'border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(243,247,242,0.92))]'
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: '#16a34a',
            animation: 'pulseDot 2s ease-in-out infinite', flexShrink: 0,
          }} />
          <span className="text-[13px] font-bold text-city-text">
            {showDashboardAction ? 'ИИ Ассистент' : 'Быстрый сценарий'}
          </span>
          <span className="ml-auto text-[11px] font-semibold text-green-600">Онлайн</span>
        </div>
        <p className="mb-3 text-[12px] leading-[1.55] text-city-muted">
          {showDashboardAction
            ? <>Активных: <strong className="text-city-text">{totalReports.length}</strong>. Приоритетных: <strong className="text-severity-critical">{priorityCount}</strong>.</>
            : 'Откройте карту, посмотрите живые обращения и сразу отправьте свой репорт с фото.'}
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={showDashboardAction ? onDashboard : onReport}
            className={`flex flex-1 items-center justify-center rounded-lg py-[7px] text-[12px] font-bold transition ${
              showDashboardAction
                ? 'bg-city-text text-white hover:opacity-90'
                : 'bg-city-text text-white hover:opacity-90'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {showDashboardAction ? primaryCtaLabel : 'Сообщить'}
              <ArrowRight size={13} strokeWidth={2.2} />
            </span>
          </button>
          {showDashboardAction ? (
            <button onClick={onReport} className="glass-button-secondary flex-1 px-0 py-[7px] text-[12px]">
              Новый кейс
            </button>
          ) : (
            <button onClick={onClearFilters} className="glass-button-secondary flex-1 px-0 py-[7px] text-[12px]">
              Все обращения
            </button>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/* ── Helpers ── */
function SectionLabel({ children }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[1.5px] text-city-subtle">
      {children}
    </div>
  );
}

function MetricCard({ label, value, hint, dark = false }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${dark ? 'border-white/10 bg-white/10' : 'border-city-border bg-city-surface2'}`}>
      <div className={`mb-1.5 text-[11px] ${dark ? 'text-white/65' : 'text-city-subtle'}`}>
        {label}
      </div>
      <div className={`text-[18px] font-bold leading-none ${dark ? 'text-white' : 'text-city-text'}`}>
        {value}
      </div>
      <div className={`mt-1.5 text-[11px] ${dark ? 'text-white/60' : 'text-city-muted'}`}>
        {hint}
      </div>
    </div>
  );
}

function SeverityBadge({ severity, text }) {
  const color = SEV_COLORS[severity] ?? '#64748b';
  const Icon = getSeverityIcon(severity);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-bold shadow-sm"
      style={{ background: `${color}14`, borderColor: `${color}26`, color }}
    >
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full"
        style={{ background: `${color}18` }}
      >
        <Icon size={12} strokeWidth={2.2} />
      </span>
      {text}
    </span>
  );
}

function DetailImage({ title, src, positive = false, tall = false }) {
  return (
    <div className="grid gap-1.5">
      <div className={`text-[10px] font-bold uppercase tracking-[0.08em] ${positive ? 'text-severity-resolved' : 'text-city-subtle'}`}>
        {title}
      </div>
      <img
        src={src}
        alt={title}
        style={{
          width: '100%',
          height: tall ? 170 : 126,
          objectFit: 'cover',
          borderRadius: 14,
          border: `1px solid ${positive ? '#bbf7d0' : '#e2e8f0'}`,
          display: 'block',
        }}
      />
    </div>
  );
}

function SmallBadge({ text, color = '#475569', neutral = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-bold shadow-sm ${
        neutral ? 'border border-slate-200 bg-slate-50 text-slate-600' : ''
      }`}
      style={neutral ? undefined : { background: `${color}14`, border: `1px solid ${color}26`, color }}
    >
      {text}
    </span>
  );
}

function DetailInfo({ label, value }) {
  return (
    <div className="rounded-xl border border-city-border bg-city-surface2/90 px-3 py-2.5">
      <div className="mb-[5px] text-[10px] font-bold uppercase tracking-[0.08em] text-city-subtle">
        {label}
      </div>
      <div className="text-[13px] font-semibold leading-[1.5] text-city-text">
        {value}
      </div>
    </div>
  );
}

function HintLine({ title, text }) {
  return (
    <div className="rounded-2xl border border-city-border bg-city-surface2/80 px-3 py-[11px]">
      <div className="mb-1 text-[12px] font-bold text-city-text">{title}</div>
      <div className="text-[12px] leading-[1.55] text-city-muted">{text}</div>
    </div>
  );
}

function MapFiltersDock({
  reports,
  filteredReports,
  activeFilter,
  setActiveFilter,
  heatmapMode,
  onHeatmapModeChange,
  heatmapAvailable,
  onReset,
  onReport,
  user,
  compact = false,
}) {
  const priorityCount = reports.filter(report => matchesPrimaryFilter(report, 'priority')).length;
  const hasActiveFilters = activeFilter !== 'all';
  const isManagedViewer = user?.role === 'government' || user?.role === 'business';

  return (
    <GlassPanel className="glass-drawer" style={{ height: 'auto' }} delay={0.1}>
      <div className={`${compact ? 'px-3 py-3' : 'px-5 py-4'} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-city-subtle">
              {isManagedViewer ? 'Фильтр обращений' : 'Карта Алматы'}
            </div>
            <div className="mt-1 text-[16px] font-bold text-city-text">
              {filteredReports.length} {isManagedViewer ? 'обращений в обзоре' : 'обращений на карте'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {hasActiveFilters ? (
              <button onClick={onReset} className="glass-chip px-3 py-1.5">
                Сбросить
              </button>
            ) : null}
            <button onClick={onReport} className="glass-button-primary px-4 py-2 text-[13px]">
              Сообщить
            </button>
          </div>
        </div>

        {isManagedViewer ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map(filter => {
                const Icon = getFilterIcon(filter.id);
                const active = activeFilter === filter.id;
                const count = reports.filter(report => matchesPrimaryFilter(report, filter.id)).length;

                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-[12px] font-semibold transition ${
                      active
                        ? 'border-city-text bg-city-text text-white shadow-matte'
                        : 'border-city-border bg-white/72 text-city-text hover:bg-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={13} strokeWidth={2.2} color={active ? '#ffffff' : filter.color} />
                      {filter.label}
                      <span className={active ? 'text-white/70' : 'text-city-subtle'}>{count}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {heatmapAvailable ? (
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {MAP_LAYER_MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => onHeatmapModeChange(mode.id)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-[12px] font-semibold transition ${
                      heatmapMode === mode.id
                        ? 'border-amber-200 bg-amber-50 text-amber-900 shadow-sm'
                        : 'border-city-border bg-white/72 text-city-text hover:bg-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-city-border bg-white/58 px-3 py-3 text-[12px] leading-[1.6] text-city-muted">
            <div>
              {priorityCount > 0
                ? `На карте ${priorityCount} срочных обращений. Выберите метку, чтобы посмотреть детали, или отправьте новый репорт.`
                : 'Выберите метку на карте, чтобы посмотреть детали, или отправьте новый репорт.'}
            </div>
            {heatmapAvailable ? (
              <button
                onClick={() => onHeatmapModeChange(heatmapMode === 'pins' ? 'both' : 'pins')}
                className="glass-chip mt-3"
              >
                {heatmapMode === 'pins' ? 'Показать heatmap' : 'Скрыть heatmap'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function SelectedReportCard({
  report,
  user,
  onClose,
  onReport,
  onDashboard,
  compact = false,
}) {
  if (!report) return null;

  const severity = normalizeSeverityKey(report.severity, report.status);
  const responsibility = getResponsibleRole(report);
  const routeStyle = RESPONSIBILITY_STYLE[responsibility] ?? RESPONSIBILITY_STYLE.government;
  const dossier = getAIDossier(report);
  const showDashboardAction = user?.role === 'government' || user?.role === 'business';
  const primaryLabel = showDashboardAction
    ? user?.role === 'business' ? 'Открыть подрядчика' : 'Открыть акимат'
    : 'Сообщить рядом';
  const aiSummary = dossier?.hasTriage
    ? dossier.aiComment
    : report.comment || 'Откройте репорт, чтобы добавить контекст и запустить AI triage.';

  return (
    <GlassPanel
      className={`glass-drawer ${compact ? '' : 'max-h-[calc(100vh-112px)] overflow-y-auto'}`}
      style={{ height: 'auto' }}
      delay={0.12}
    >
      <div className={`${compact ? 'p-4' : 'p-5'} flex flex-col gap-3`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-city-subtle">
              Выбранное обращение
            </div>
            <div className="mt-1 text-[20px] font-bold leading-[1.15] text-city-text">
              {getReportTitle(report)}
            </div>
            <div className="mt-1 text-[12px] text-city-muted">
              {report.address || 'Алматы'} · {formatRelativeTime(report.created_at)}
            </div>
          </div>

          <button onClick={onClose} className="glass-button-secondary h-10 w-10 px-0 py-0 text-[12px]">
            <X size={14} />
          </button>
        </div>

        {(report.completion_image_url && getPrimaryImage(report)) ? (
          <div className="grid grid-cols-2 gap-2.5">
            <DetailImage title="До" src={getPrimaryImage(report)} />
            <DetailImage title="После" src={report.completion_image_url} positive />
          </div>
        ) : getPrimaryImage(report) ? (
          <DetailImage title="Фото кейса" src={getPrimaryImage(report)} tall={compact} />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <SeverityBadge severity={severity} text={getSeverityLabel(report)} />
          <SmallBadge neutral text={REPORT_STATUS_LABEL[report.status] ?? 'Новый'} />
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-bold"
            style={{
              background: routeStyle.bg,
              border: `1px solid ${routeStyle.border}`,
              color: routeStyle.color,
            }}
          >
            {RESPONSIBILITY_LABEL[responsibility]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DetailInfo label="Источник" value={getReporterName(report)} />
          <DetailInfo label="Исполнитель" value={getAssignedOrgName(report) || 'Назначается акиматом'} />
        </div>

        <div className="rounded-[22px] border border-city-border bg-city-surface2/90 px-3 py-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-city-subtle">
            AI summary
          </div>
          <div className="text-[12px] leading-[1.6] text-city-muted">
            {aiSummary}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={showDashboardAction ? onDashboard : onReport} className="glass-button-primary flex-1 px-4 py-3 text-[13px]">
            {primaryLabel}
          </button>
          <button onClick={onReport} className="glass-button-secondary flex-1 px-4 py-3 text-[13px]">
            Новый репорт
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}

function MapOverlay({ reports, totalReports, loading }) {
  const showEmptyState = !loading && totalReports.length > 0 && reports.length === 0;

  if (!showEmptyState) return null;

  return (
    <div className="glass-panel-matte absolute left-1/2 top-1/2 z-[1] w-[280px] -translate-x-1/2 -translate-y-1/2 px-5 py-[18px] text-center shadow-matte-lg">
      <div className="text-[15px] font-bold text-city-text">
        Нет точек по текущим фильтрам
      </div>
      <div className="mt-2 text-[12px] leading-[1.6] text-city-muted">
        Попробуйте переключить срочность или вернуть все типы проблем.
      </div>
    </div>
  );
}

function InlineBadge({ label, color, icon: Icon = Sparkles }) {
  return (
    <span className="glass-chip">
      <span
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full"
        style={{ background: `${color}16`, color }}
      >
        <Icon size={11} strokeWidth={2.2} />
      </span>
      {label}
    </span>
  );
}

function OverlayFab({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="glass-panel-matte whitespace-nowrap rounded-2xl px-3 py-[11px] text-[12px] font-bold text-city-text shadow-matte-lg"
    >
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function App() {
  const initialHashState = resolveInitialHashState();
  const [user, setUser]                 = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [authError, setAuthError]       = useState('');
  const [tab, setTab]                   = useState(() => initialHashState.tab ?? readStoredTab());
  const [authView, setAuthView]         = useState(() => initialHashState.authView);
  const [authRoleHint, setAuthRoleHint] = useState(() => initialHashState.authView === 'gov' ? 'government' : 'citizen');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeType, setActiveType]     = useState('all');
  const [reports, setReports]           = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [analyticsOverview, setAnalyticsOverview] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [mapLayerMode, setMapLayerMode] = useState('pins');
  const [mapLayerTouched, setMapLayerTouched] = useState(false);

  const navigateToTab = useCallback((nextTab, { replace = false } = {}) => {
    if (typeof window === 'undefined') {
      setTab(nextTab);
      return;
    }

    const nextHash = buildHash(nextTab);
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;

    if (window.location.hash !== nextHash) {
      if (replace) window.history.replaceState(window.history.state, '', nextUrl);
      else window.location.hash = nextHash;
    }

    clearAuthTarget();
    setAuthView(null);
    setAuthError('');
    setTab(nextTab);
  }, []);

  const openAuth = useCallback((nextView = 'sign-in', { replace = false, roleHint = 'citizen' } = {}) => {
    if (typeof window === 'undefined') {
      setAuthView(nextView);
      setAuthRoleHint(roleHint);
      return;
    }

    const nextHash = buildAuthHash(nextView);
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;

    if (window.location.hash !== nextHash) {
      if (replace) window.history.replaceState(window.history.state, '', nextUrl);
      else window.location.hash = nextHash;
    }

    setAuthView(nextView);
    setAuthRoleHint(roleHint);
    setAuthError('');
  }, []);

  const hydrateAuthenticatedUser = useCallback(async (authUser, { strictGovernment = false } = {}) => {
    if (!authUser) {
      setUser(readDemoUser());
      setAuthError('');
      return readDemoUser();
    }

    try {
      const profileUser = await ensureProfileForAuthUser(authUser, strictGovernment
        ? { preferredRole: 'government', strictGovernment: true }
        : {}
      );
      setUser(profileUser);
      setAuthError('');
      return profileUser;
    } catch (error) {
      clearAuthTarget();
      setUser(null);
      setAuthError(error.message || 'Не удалось загрузить профиль.');
      await supabase.auth.signOut().catch(() => {});
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cityeye_user');
    }

    let active = true;
    setAuthLoading(true);

    const syncSession = async session => {
      const strictGovernment = parseHashState(window.location.hash)?.authView === 'gov';
      await hydrateAuthenticatedUser(session?.user ?? null, { strictGovernment });
      if (active) {
        setAuthLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      syncSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthLoading(true);
      syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [hydrateAuthenticatedUser]);

  useEffect(() => {
    if (authLoading || authView) return;

    if (canAccessTab(tab, user)) {
      if (localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) !== tab) {
        localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
      }
      return;
    }

    navigateToTab(DEFAULT_TAB, { replace: true });
  }, [tab, user, authLoading, authView, navigateToTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncRouteWithLocation = () => {
      const nextState = parseHashState(window.location.hash);

      if (!nextState) {
        navigateToTab(readStoredTab(), { replace: true });
        return;
      }

      if (nextState.authView) {
        setAuthView(nextState.authView);
        if (nextState.authView === 'gov') {
          setAuthRoleHint('government');
        }
        return;
      }

      setAuthView(null);
      setTab(currentTab => (currentTab === nextState.tab ? currentTab : nextState.tab));
    };

    syncRouteWithLocation();
    window.addEventListener('hashchange', syncRouteWithLocation);

    return () => window.removeEventListener('hashchange', syncRouteWithLocation);
  }, [navigateToTab]);

  useEffect(() => {
    if (authLoading || !user) return;

    const authTarget = readAuthTarget();
    if (!authTarget) return;

    if (user.role === 'business' && user.status === 'pending_approval') {
      return;
    }

    clearAuthTarget();

    if (authTarget === 'gov' && canAccessTab('gov', user)) {
      navigateToTab('gov', { replace: true });
      return;
    }

    if (authTarget === 'business' && canAccessTab('business', user)) {
      navigateToTab('business', { replace: true });
      return;
    }

    navigateToTab(DEFAULT_TAB, { replace: true });
  }, [authLoading, user, navigateToTab]);

  function handleTabChange(id) {
    if (id === 'gov' && !canAccessTab('gov', user)) {
      openAuth('gov', { roleHint: 'government' });
      return;
    }
    if (id === 'business' && !canAccessTab('business', user)) {
      openAuth('sign-in', { roleHint: 'business' });
      return;
    }
    navigateToTab(id);
  }

  async function handleLogout() {
    localStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
    clearAuthTarget();
    clearDemoUser();
    setAuthError('');
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    navigateToTab(DEFAULT_TAB, { replace: true });
  }

  const handleDemoLogin = useCallback(async (demoUser, target = 'map') => {
    clearAuthTarget();
    setAuthError('');
    writeDemoUser(demoUser);
    await supabase.auth.signOut().catch(() => {});
    setUser(demoUser);
    setAuthView(null);

    if (target === 'gov' && canAccessTab('gov', demoUser)) {
      navigateToTab('gov', { replace: true });
      return;
    }

    if (target === 'business' && canAccessTab('business', demoUser)) {
      navigateToTab('business', { replace: true });
      return;
    }

    navigateToTab(DEFAULT_TAB, { replace: true });
  }, [navigateToTab]);

  const refreshReports = useCallback(async () => {
    setReportsLoading(true);
    const [reportsResult, analyticsResult] = await Promise.allSettled([
      getReports(),
      getAnalyticsOverview(),
    ]);

    let nextReports = [];

    if (reportsResult.status === 'fulfilled') {
      nextReports = reportsResult.value || [];
      setReports(nextReports);
    }

    if (analyticsResult.status === 'fulfilled' && readDemoReports().length === 0) {
      setAnalyticsOverview(analyticsResult.value || null);
    } else if (reportsResult.status === 'fulfilled') {
      setAnalyticsOverview(buildClientAnalyticsOverview(nextReports));
    }

    setReportsLoading(false);
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isCompactLayout = viewportWidth < 1180;
  const isMobileLayout = viewportWidth < 900;
  const isManagedViewer = user?.role === 'government' || user?.role === 'business';

  const filteredReports = useMemo(() => (
    sortReports(
      reports.filter(report =>
        matchesPrimaryFilter(report, activeFilter)
      )
    )
  ), [reports, activeFilter]);

  const filteredReportIds = useMemo(
    () => new Set(filteredReports.map(report => String(report.id))),
    [filteredReports]
  );

  const filteredHeatmapPoints = useMemo(() => {
    const points = analyticsOverview?.geo_heatmap_points ?? analyticsOverview?.geoHeatmapPoints ?? [];
    if (!Array.isArray(points)) return [];
    return points.filter(point => filteredReportIds.has(String(point.id)));
  }, [analyticsOverview, filteredReportIds]);

  useEffect(() => {
    if (mapLayerTouched) return;
    setMapLayerMode(isManagedViewer ? 'both' : 'pins');
  }, [isManagedViewer, mapLayerTouched]);

  function handleMapLayerMode(nextMode) {
    setMapLayerTouched(true);
    setMapLayerMode(nextMode);
  }

  function resetMapFilters() {
    setActiveFilter('all');
    setActiveType('all');
  }

  useEffect(() => {
    if (!selectedReport) return;
    const updatedReport = filteredReports.find(report => String(report.id) === String(selectedReport.id));
    if (!updatedReport) {
      setSelectedReport(null);
      return;
    }
    if (updatedReport !== selectedReport) {
      setSelectedReport(updatedReport);
    }
  }, [filteredReports, selectedReport]);

  useEffect(() => {
    if (!isCompactLayout) {
      setShowFiltersDrawer(false);
      setShowDetailsSheet(false);
    }
  }, [isCompactLayout]);

  useEffect(() => {
    if (isCompactLayout && selectedReport) {
      setShowDetailsSheet(true);
    }
  }, [isCompactLayout, selectedReport]);

  const authOverlay = authView ? (
    <AuthPage
      view={authView}
      roleHint={authRoleHint}
      user={user}
      loading={authLoading}
      externalError={authError}
      onViewChange={nextView => openAuth(nextView, { replace: true, roleHint: nextView === 'gov' ? 'government' : authRoleHint })}
      onRoleChange={setAuthRoleHint}
      onBack={() => navigateToTab(tab, { replace: true })}
      onLogout={handleLogout}
      onDemoLogin={handleDemoLogin}
    />
  ) : null;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#f4fbff_0%,#eef4ec_72%,#f8faf8_100%)]">
        <div className="glass-panel-matte rounded-[28px] px-8 py-7 text-center shadow-matte-xl">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <div className="text-sm font-semibold text-slate-900">Проверяем сессию CityEye</div>
          <div className="mt-1 text-sm text-slate-500">Загружаем профиль и роль доступа…</div>
        </div>
      </div>
    );
  }

  /* ── Full-page tabs ── */
  if (tab === 'feed') {
    return (
      <>
        <div className="flex min-h-screen flex-col bg-city-bg">
          <div className="border-b border-city-border bg-white/80 backdrop-blur-xl">
            <Navbar tab={tab} onTabChange={handleTabChange} user={user} onAuth={() => openAuth('sign-in')} onLogout={handleLogout} />
          </div>
          <main className="flex-1 bg-[radial-gradient(circle_at_top_left,#f4fbff_0%,#eef4ec_68%,#f7faf7_100%)]">
            <FeedTab
              reports={reports}
              onTabChange={handleTabChange}
              user={user}
              onOpenReportOnMap={report => {
                setSelectedReport(report);
                handleTabChange('map');
              }}
            />
          </main>
        </div>
        {authOverlay}
      </>
    );
  }
  if (tab === 'gov') {
    return (
      <>
        <Dashboard
          reports={reports}
          analyticsOverview={analyticsOverview}
          loading={reportsLoading}
          onStatusChange={refreshReports}
          onTabChange={handleTabChange}
          user={user}
          onLogout={handleLogout}
        />
        {authOverlay}
      </>
    );
  }
  if (tab === 'business') {
    return (
      <>
        <div className="flex min-h-screen flex-col bg-city-bg">
          <div className="border-b border-city-border bg-white/80 backdrop-blur-xl">
            <Navbar tab={tab} onTabChange={handleTabChange} user={user} onAuth={() => openAuth('sign-in')} onLogout={handleLogout} />
          </div>
          <main className="flex-1 bg-[radial-gradient(circle_at_top_left,#f4fbff_0%,#eef4ec_68%,#f7faf7_100%)]">
            <BusinessDashboard
              reports={reports}
              user={user}
              onTabChange={handleTabChange}
              onLogout={handleLogout}
              onStatusChange={refreshReports}
            />
          </main>
        </div>
        {authOverlay}
      </>
    );
  }

  /* ── Report tab ── */
  if (tab === 'report') {
    return (
      <>
        <div className="flex min-h-screen flex-col bg-city-bg">
          <div className="border-b border-city-border bg-white/80 backdrop-blur-xl">
            <Navbar tab={tab} onTabChange={handleTabChange} user={user} onAuth={() => openAuth('sign-in')} onLogout={handleLogout} />
          </div>
          <main className="mx-auto w-full max-w-[960px] flex-1 px-5 py-8">
            <ReportTab
              user={user}
              onNewReport={refreshReports}
              onRequireAuth={(nextView = 'sign-in', roleHint = 'citizen') => openAuth(nextView, { roleHint })}
            />
          </main>
        </div>
        {authOverlay}
      </>
    );
  }

  /* ── Map dashboard (3-column grid) ── */
  return (
    <div className="glass-shell bg-[#dfe6df]">
      <motion.main
        initial={{ opacity: 0, scale: 0.995 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0"
      >
        <YandexMap
          reports={filteredReports}
          heatmapPoints={filteredHeatmapPoints}
          heatmapMode={mapLayerMode}
          useMockWhenEmpty={!reportsLoading && reports.length === 0}
          selectedReportId={selectedReport?.id ?? null}
          onReportSelect={setSelectedReport}
        />
      </motion.main>

      <Navbar
        floating
        tab={tab}
        onTabChange={handleTabChange}
        user={user}
        onAuth={() => openAuth('sign-in')}
        onLogout={handleLogout}
      />

      <MapOverlay reports={filteredReports} totalReports={reports} loading={reportsLoading} />

      <div
        className={`absolute z-20 ${
          isCompactLayout
            ? 'bottom-3 left-3 right-3'
            : 'bottom-5 left-1/2 w-[min(1060px,calc(100%-40px))] -translate-x-1/2'
        }`}
      >
        {isCompactLayout ? (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {selectedReport ? (
                <motion.div
                  key={selectedReport.id}
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SelectedReportCard
                    report={selectedReport}
                    user={user}
                    onClose={() => setSelectedReport(null)}
                    onReport={() => handleTabChange('report')}
                    onDashboard={() => handleTabChange(user?.role === 'business' ? 'business' : 'gov')}
                    compact
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <MapFiltersDock
              reports={reports}
              filteredReports={filteredReports}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              heatmapMode={mapLayerMode}
              onHeatmapModeChange={handleMapLayerMode}
              heatmapAvailable={filteredHeatmapPoints.length > 0}
              onReset={resetMapFilters}
              onReport={() => handleTabChange('report')}
              user={user}
              compact
            />
          </div>
        ) : (
          <div className="pointer-events-none relative">
            <div className="pointer-events-auto">
              <MapFiltersDock
                reports={reports}
                filteredReports={filteredReports}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                heatmapMode={mapLayerMode}
                onHeatmapModeChange={handleMapLayerMode}
                heatmapAvailable={filteredHeatmapPoints.length > 0}
                onReset={resetMapFilters}
                onReport={() => handleTabChange('report')}
                user={user}
              />
            </div>
          </div>
        )}
      </div>

      {!isCompactLayout ? (
        <AnimatePresence>
          {selectedReport ? (
            <motion.div
              key={selectedReport.id}
              initial={{ opacity: 0, x: 18, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 22, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto absolute right-5 top-[90px] z-20 w-[390px]"
            >
              <SelectedReportCard
                report={selectedReport}
                user={user}
                onClose={() => setSelectedReport(null)}
                onReport={() => handleTabChange('report')}
                onDashboard={() => handleTabChange(user?.role === 'business' ? 'business' : 'gov')}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : null}

      {authOverlay}
    </div>
  );
}
