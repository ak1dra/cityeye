'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Handshake, Sparkles } from 'lucide-react';
import { AITriagePanel } from '../../frontend/src/components/AITriagePanel';
import { buildGeoHotspotsFromPoints } from '../../frontend/src/lib/analytics';
import {
  getAssignedOrgName,
  getReporterName,
  getResponsibleRole,
  isSharedCase,
  REPORT_STATUS_LABEL,
  RESPONSIBILITY_LABEL,
  RESPONSIBILITY_STYLE,
} from '../../frontend/src/lib/reportCollaboration';
import { getAIDossier } from '../../frontend/src/lib/aiTriage';
import { AppNavbar } from './AppNavbar';
import { useCityEye } from './CityEyeProvider';
import { useAnalyticsOverview, useReportsResource } from './useRouteData';

const YandexMap = dynamic(() => import('../../frontend/src/YandexMap'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#dfe6df]" />,
});

const FILTERS = [
  { id: 'all', label: 'Все обращения', color: '#0f172a', icon: Sparkles },
  { id: 'priority', label: 'Срочные', color: '#dc2626', icon: CircleAlert },
  { id: 'in_progress', label: 'В работе', color: '#d97706', icon: Clock3 },
  { id: 'shared', label: 'Совместно', color: '#a16207', icon: Handshake },
  { id: 'resolved', label: 'Решено', color: '#16a34a', icon: CheckCircle2 },
];

const MAP_LAYER_MODES = [
  { id: 'pins', label: 'Пины' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'both', label: 'Оба слоя' },
];

function normalizeSeverityKey(value, status) {
  if (status === 'resolved' || status === 'verified') return 'resolved';
  const source = String(value ?? '').toLowerCase();
  if (source.includes('крит') || source === 'critical') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
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

function sortReports(list) {
  return [...list].sort((left, right) => {
    const rightDate = new Date(right?.created_at ?? 0).getTime();
    const leftDate = new Date(left?.created_at ?? 0).getTime();
    return rightDate - leftDate;
  });
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

function getReportTitle(report) {
  return report?.detected_issue_title || report?.title || report?.type || 'Проблема';
}

function getPrimaryImage(report) {
  return report?.image_url || report?.image || null;
}

function getSeverityLabel(report) {
  return {
    critical: 'Критично',
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий',
    resolved: 'Решено',
  }[normalizeSeverityKey(report?.severity, report?.status)] ?? 'Средний';
}

function SeverityBadge({ report }) {
  const level = normalizeSeverityKey(report?.severity, report?.status);
  const color = {
    critical: '#dc2626',
    high: '#d97706',
    medium: '#2563eb',
    low: '#7c3aed',
    resolved: '#16a34a',
  }[level] ?? '#64748b';

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1.5 text-[11px] font-bold shadow-sm"
      style={{ background: `${color}14`, borderColor: `${color}26`, color }}
    >
      {getSeverityLabel(report)}
    </span>
  );
}

export default function MapPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCityEye();
  const {
    reports,
    page,
  } = useReportsResource({ limit: 260, view: 'map' });
  const {
    analyticsOverview,
  } = useAnalyticsOverview();
  const [activeFilter, setActiveFilter] = useState('all');
  const [mapLayerMode, setMapLayerMode] = useState(user?.role === 'government' || user?.role === 'business' ? 'both' : 'pins');

  const selectedReportId = searchParams.get('report');
  const filteredReports = useMemo(
    () => sortReports(reports.filter(report => matchesPrimaryFilter(report, activeFilter))),
    [activeFilter, reports]
  );

  const selectedReport = useMemo(
    () => filteredReports.find(report => String(report.id) === String(selectedReportId))
      || reports.find(report => String(report.id) === String(selectedReportId))
      || null,
    [filteredReports, reports, selectedReportId]
  );

  const filteredReportIds = useMemo(
    () => new Set(filteredReports.map(report => String(report.id))),
    [filteredReports]
  );

  const filteredHeatmapPoints = useMemo(() => {
    const points = analyticsOverview?.geo_heatmap_points ?? analyticsOverview?.geoHeatmapPoints ?? [];
    if (!Array.isArray(points)) return [];
    return points.filter(point => filteredReportIds.has(String(point.id)));
  }, [analyticsOverview, filteredReportIds]);

  const filteredHotspots = useMemo(
    () => buildGeoHotspotsFromPoints(filteredHeatmapPoints),
    [filteredHeatmapPoints]
  );
  useEffect(() => {
    if (!selectedReportId) return;
    const exists = reports.some(report => String(report.id) === String(selectedReportId));
    if (!exists) {
      router.replace('/map');
    }
  }, [reports, router, selectedReportId]);

  function selectReport(report) {
    router.replace(`/map?report=${encodeURIComponent(report.id)}`, { scroll: false });
  }

  function clearSelectedReport() {
    router.replace('/map', { scroll: false });
  }

  return (
    <div className="glass-shell bg-[#dfe6df]">
      <main className="absolute inset-0">
        <YandexMap
          reports={filteredReports}
          heatmapPoints={filteredHeatmapPoints}
          hotspots={filteredHotspots}
          heatmapMode={mapLayerMode}
          selectedReportId={selectedReportId}
          onReportSelect={selectReport}
        />
      </main>

      <AppNavbar floating />

      <div className="absolute bottom-4 left-4 right-4 z-20 lg:left-1/2 lg:w-[min(1060px,calc(100%-40px))] lg:-translate-x-1/2">
        <div className="glass-panel-matte rounded-[24px] px-4 py-4 shadow-matte-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-city-subtle">Карта Алматы</div>
              <div className="mt-1 text-[16px] font-bold text-city-text">
                {filteredReports.length} обращений в обзоре
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map(filter => {
                const Icon = filter.icon;
                const active = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`rounded-full border px-3 py-2 text-[12px] font-semibold transition ${
                      active
                        ? 'border-city-text bg-city-text text-white shadow-matte'
                        : 'border-city-border bg-white/72 text-city-text hover:bg-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={13} strokeWidth={2.2} color={active ? '#ffffff' : filter.color} />
                      {filter.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {MAP_LAYER_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setMapLayerMode(mode.id)}
                  className={`rounded-full border px-3 py-2 text-[12px] font-semibold transition ${
                    mapLayerMode === mode.id
                      ? 'border-amber-200 bg-amber-50 text-amber-900 shadow-sm'
                      : 'border-city-border bg-white/72 text-city-text hover:bg-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
              <button onClick={() => router.push('/report')} className="glass-button-primary px-4 py-2 text-[13px]">
                Подать обращение
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedReport ? (
        <>
          <div className="absolute right-5 top-[92px] z-20 hidden w-[390px] lg:block">
            <div className="glass-panel-matte max-h-[calc(100vh-112px)] overflow-y-auto rounded-[26px] p-5 shadow-matte-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-city-subtle">Выбранное обращение</div>
                  <div className="mt-1 text-[20px] font-bold leading-[1.15] text-city-text">{getReportTitle(selectedReport)}</div>
                  <div className="mt-1 text-[12px] text-city-muted">
                    {selectedReport.address || 'Алматы'} · {formatRelativeTime(selectedReport.created_at)}
                  </div>
                </div>
                <button onClick={clearSelectedReport} className="glass-button-secondary px-3 py-2 text-[12px]">Закрыть</button>
              </div>

              {getPrimaryImage(selectedReport) ? (
                <img
                  src={getPrimaryImage(selectedReport)}
                  alt={getReportTitle(selectedReport)}
                  className="mt-4 h-[200px] w-full rounded-2xl border border-city-border object-cover"
                />
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <SeverityBadge report={selectedReport} />
                <span className="glass-chip">{REPORT_STATUS_LABEL[selectedReport.status] ?? 'Новый'}</span>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-bold"
                  style={{
                    background: (RESPONSIBILITY_STYLE[getResponsibleRole(selectedReport)] ?? RESPONSIBILITY_STYLE.government).bg,
                    border: `1px solid ${(RESPONSIBILITY_STYLE[getResponsibleRole(selectedReport)] ?? RESPONSIBILITY_STYLE.government).border}`,
                    color: (RESPONSIBILITY_STYLE[getResponsibleRole(selectedReport)] ?? RESPONSIBILITY_STYLE.government).color,
                  }}
                >
                  {RESPONSIBILITY_LABEL[getResponsibleRole(selectedReport)]}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <InfoCard label="Источник" value={getReporterName(selectedReport)} />
                <InfoCard label="Исполнитель" value={getAssignedOrgName(selectedReport) || 'Назначается акиматом'} />
              </div>

              {getAIDossier(selectedReport)?.hasTriage ? (
                <div className="mt-4">
                  <AITriagePanel data={selectedReport} compact title="AI summary" />
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button onClick={() => router.push('/report')} className="glass-button-secondary flex-1 px-4 py-3 text-[13px]">
                  Новое обращение
                </button>
                {(user?.role === 'government' || user?.role === 'business') ? (
                  <button
                    onClick={() => router.push(user?.role === 'business' ? '/contractor' : '/gov')}
                    className="glass-button-primary flex-1 px-4 py-3 text-[13px]"
                  >
                    Открыть кабинет <ArrowRight size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="absolute inset-x-4 top-[88px] z-20 lg:hidden">
            <div className="glass-panel-matte rounded-[24px] p-4 shadow-matte-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-city-subtle">Выбрано на карте</div>
                  <div className="mt-1 truncate text-[16px] font-bold text-city-text">{getReportTitle(selectedReport)}</div>
                  <div className="mt-1 text-[12px] text-city-muted">{selectedReport.address || 'Алматы'}</div>
                </div>
                <button onClick={clearSelectedReport} className="glass-button-secondary px-3 py-2 text-[12px]">Закрыть</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SeverityBadge report={selectedReport} />
                <span className="glass-chip">{REPORT_STATUS_LABEL[selectedReport.status] ?? 'Новый'}</span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function InfoCard({ label, value }) {
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
