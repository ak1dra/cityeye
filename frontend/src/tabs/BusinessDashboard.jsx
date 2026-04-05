import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Handshake,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { AITriagePanel } from '../components/AITriagePanel';
import { CollaborationTimeline, PartnerCommentBox } from '../components/CollaborationWidgets';
import { GlassCard, GlassPanel } from '../components/GlassPanel';
import { VerifyBadge } from '../components/VerifyBadge';
import { supabase } from '../lib/supabase';
import { updateReport, updateStatus } from '../api';
import {
  getContractorOrgName,
  getDeadlineState,
  getLiabilityNarrative,
  getNextRequiredAction,
  getProofStatusMeta,
  getResponsibilityModeMeta,
  getWorkOrderStatusMeta,
  inferProofStatus,
  inferResponsibilityMode,
  inferWorkOrderStatus,
} from '../lib/contractorModel';
import {
  buildPartnerCommentEntry,
  buildSharedRouteFields,
  getAssignedOrgName,
  getResponsibleRole,
  isSharedCase,
  isVisibleToBusiness,
  RESPONSIBILITY_LABEL,
} from '../lib/reportCollaboration';

const CATEGORY_LABEL = {
  road: 'Дороги',
  light: 'Освещение',
  lighting: 'Освещение',
  trash: 'Мусор',
  waste: 'Санитария',
  greenery: 'Озеленение',
  utilities: 'Коммуникации',
  vandal: 'Вандализм',
  parking: 'Парковка',
  other: 'Инфраструктура',
};

const SEVERITY_META = {
  critical: { label: 'Критично', variant: 'critical' },
  high: { label: 'Высокий', variant: 'high' },
  medium: { label: 'Средний', variant: 'medium' },
  low: { label: 'Низкий', variant: 'neutral' },
};

const QUEUE_META = {
  all: { label: 'Все задания', icon: Sparkles, variant: 'dark' },
  assigned: { label: 'Новые назначения', icon: ShieldAlert, variant: 'medium' },
  accepted: { label: 'В работе', icon: Wrench, variant: 'high' },
  blocked: { label: 'Ждёт акимат', icon: Handshake, variant: 'violet' },
  disputed: { label: 'Спорные', icon: CircleAlert, variant: 'critical' },
  completed: { label: 'На verify', icon: ShieldCheck, variant: 'soft-success' },
  verified: { label: 'Закрыто', icon: CheckCircle2, variant: 'success' },
};

const MODE_FILTERS = [
  { id: 'all', label: 'Все контуры', variant: 'dark' },
  { id: 'warranty_contractor', label: 'Гарантия', variant: 'success' },
  { id: 'operator', label: 'Эксплуатация', variant: 'sky' },
  { id: 'shared', label: 'Совместно', variant: 'high' },
  { id: 'disputed', label: 'Спорные', variant: 'critical' },
];

const SEVERITY_FILTERS = [
  { id: 'all', label: 'Все приоритеты', variant: 'dark' },
  { id: 'critical', label: 'Критично', variant: 'critical' },
  { id: 'high', label: 'Высокий', variant: 'high' },
  { id: 'medium', label: 'Средний', variant: 'medium' },
  { id: 'low', label: 'Низкий', variant: 'neutral' },
];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function normalizeSeverity(value) {
  if (value === 'КРИТИЧНО') return 'critical';
  if (value === 'ВЫСОКО') return 'high';
  if (value === 'СРЕДНЕ') return 'medium';
  if (value === 'НИЗКО') return 'low';
  return value ?? 'medium';
}

function getSeverityMeta(value) {
  const normalized = normalizeSeverity(value);
  return SEVERITY_META[normalized] ?? { label: value ?? '—', variant: 'neutral' };
}

function getCategoryLabel(report) {
  return CATEGORY_LABEL[report?.category] ?? CATEGORY_LABEL[report?.type] ?? 'Инфраструктура';
}

function getReportTitle(report) {
  return report?.detected_issue_title || report?.title || getCategoryLabel(report);
}

function getPrimaryImage(report) {
  return report?.image_url || report?.image || null;
}

function formatDateTime(value) {
  if (!value) return 'Не указано';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Не указано';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value) {
  if (!value) return 'Не указано';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Не указано';
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDeadlineVariant(tone) {
  if (tone === 'overdue') return 'critical';
  if (tone === 'risk') return 'high';
  if (tone === 'ok') return 'success';
  return 'neutral';
}

function getWorkOrderVariant(status) {
  if (status === 'verified') return 'success';
  if (status === 'completed') return 'soft-success';
  if (status === 'blocked') return 'violet';
  if (status === 'disputed') return 'critical';
  if (status === 'accepted') return 'high';
  return 'medium';
}

function getResponsibilityVariant(mode) {
  if (mode === 'warranty_contractor') return 'success';
  if (mode === 'operator') return 'sky';
  if (mode === 'shared') return 'high';
  if (mode === 'disputed') return 'critical';
  return 'neutral';
}

function getProofVariant(status) {
  if (status === 'verified') return 'success';
  if (status === 'uploaded') return 'medium';
  if (status === 'required') return 'high';
  return 'neutral';
}

function badgeClasses(variant = 'neutral') {
  return {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    medium: 'border-blue-200 bg-blue-50 text-blue-700',
    high: 'border-amber-200 bg-amber-50 text-amber-800',
    critical: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'soft-success': 'border-emerald-100 bg-emerald-50/70 text-emerald-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    dark: 'border-slate-900 bg-slate-900 text-white',
  }[variant] || 'border-slate-200 bg-slate-50 text-slate-700';
}

function metricClasses(tone) {
  return {
    neutral: 'border-white/85 bg-white/82 text-slate-950',
    alert: 'border-rose-100 bg-rose-50/90 text-rose-700',
    blocked: 'border-violet-100 bg-violet-50/90 text-violet-700',
    done: 'border-emerald-100 bg-emerald-50/90 text-emerald-700',
  }[tone];
}

function actionButtonClasses(kind = 'secondary') {
  return {
    primary: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45',
    secondary: 'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45',
    warning: 'inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45',
  }[kind];
}

export default function BusinessDashboard({ reports = [], user, onTabChange, onStatusChange }) {
  const [queueFilter, setQueueFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [completionFiles, setCompletionFiles] = useState({});
  const [completionPreviews, setCompletionPreviews] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});

  const fileInputs = useRef({});

  if (user?.role !== 'business' || user?.status !== 'active') {
    return <AccessDenied onBack={() => onTabChange?.('map')} />;
  }

  const ownReports = useMemo(
    () => [...reports]
      .filter(report => isVisibleToBusiness(report, user))
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()),
    [reports, user]
  );

  const filteredReports = useMemo(
    () => ownReports.filter(report => {
      const queueKey = inferWorkOrderStatus(report);
      const responsibilityMode = inferResponsibilityMode(report);
      const severityKey = normalizeSeverity(report.severity);
      const severityMatch = severityFilter === 'all' || severityKey === severityFilter;
      const queueMatch = queueFilter === 'all' || queueKey === queueFilter;
      const modeMatch = modeFilter === 'all' || responsibilityMode === modeFilter;
      return severityMatch && queueMatch && modeMatch;
    }),
    [modeFilter, ownReports, queueFilter, severityFilter]
  );

  useEffect(() => {
    if (filteredReports.length === 0) {
      if (selectedReportId !== null) setSelectedReportId(null);
      return;
    }

    if (!filteredReports.some(report => report.id === selectedReportId)) {
      setSelectedReportId(filteredReports[0].id);
    }
  }, [filteredReports, selectedReportId]);

  const selectedReport = useMemo(
    () => filteredReports.find(report => report.id === selectedReportId) ?? filteredReports[0] ?? null,
    [filteredReports, selectedReportId]
  );

  const queueCounts = useMemo(
    () => Object.keys(QUEUE_META).reduce((accumulator, key) => {
      accumulator[key] = key === 'all'
        ? ownReports.length
        : ownReports.filter(report => inferWorkOrderStatus(report) === key).length;
      return accumulator;
    }, {}),
    [ownReports]
  );

  const stats = useMemo(() => {
    const activeReports = ownReports.filter(report => ['assigned', 'accepted', 'blocked', 'disputed'].includes(inferWorkOrderStatus(report)));
    const blockedReports = ownReports.filter(report => inferWorkOrderStatus(report) === 'blocked');
    const disputedReports = ownReports.filter(report => inferWorkOrderStatus(report) === 'disputed');
    const verifyQueue = ownReports.filter(report => ['completed', 'verified'].includes(inferWorkOrderStatus(report)));
    const slaRisk = ownReports.filter(report => {
      const deadline = getDeadlineState(report);
      return deadline.tone === 'risk' || deadline.tone === 'overdue';
    });
    const verifiedCount = ownReports.filter(report => inferWorkOrderStatus(report) === 'verified').length;
    const completedCount = ownReports.filter(report => ['completed', 'verified'].includes(inferWorkOrderStatus(report))).length;
    const verifyRate = completedCount > 0 ? Math.round((verifiedCount / completedCount) * 100) : 0;

    return {
      total: ownReports.length,
      active: activeReports.length,
      slaRisk: slaRisk.length,
      blocked: blockedReports.length,
      disputed: disputedReports.length,
      verifyQueue: verifyQueue.length,
      shared: ownReports.filter(report => inferResponsibilityMode(report) === 'shared').length,
      verifyRate,
    };
  }, [ownReports]);

  function handleCompletionFileChange(reportId, event) {
    const file = event.target.files?.[0] ?? null;
    setError(null);

    setCompletionFiles(prev => {
      const next = { ...prev };
      if (file) next[reportId] = file;
      else delete next[reportId];
      return next;
    });

    if (!file) {
      setCompletionPreviews(prev => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCompletionPreviews(prev => ({ ...prev, [reportId]: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  function clearCompletionDraft(reportId) {
    setCompletionFiles(prev => {
      const next = { ...prev };
      delete next[reportId];
      return next;
    });
    setCompletionPreviews(prev => {
      const next = { ...prev };
      delete next[reportId];
      return next;
    });
    if (fileInputs.current[reportId]) fileInputs.current[reportId].value = '';
  }

  async function acceptWork(report) {
    setBusyId(report.id);
    setError(null);
    try {
      await updateStatus(report.id, 'in_progress', {
        contractor_org_name: getContractorOrgName(report) || user.name,
        work_order_status: 'accepted',
        proof_status: report.completion_image_url ? 'uploaded' : 'required',
      });
      await onStatusChange?.();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function markBlocked(report, disputed = false) {
    setBusyId(report.id);
    setError(null);
    try {
      await updateReport(report.id, {
        status: 'waiting_partner',
        work_order_status: disputed ? 'disputed' : 'blocked',
        responsibility_mode: disputed ? 'disputed' : inferResponsibilityMode(report),
      });
      await onStatusChange?.();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function resolveReport(report) {
    const completionFile = completionFiles[report.id];
    const existingCompletionImage = report.completion_image_url ?? null;

    if (!completionFile && !existingCompletionImage) {
      setError('Для передачи кейса на verify сначала загрузите итоговое фото.');
      return;
    }

    setBusyId(report.id);
    setError(null);

    try {
      let completionImageUrl = existingCompletionImage;

      if (completionFile) {
        const fileName = `completion-${report.id}-${Date.now()}-${completionFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('reports-images')
          .upload(fileName, completionFile);

        if (uploadError) throw new Error(uploadError.message);

        const { data: publicUrl } = supabase.storage
          .from('reports-images')
          .getPublicUrl(fileName);

        completionImageUrl = publicUrl.publicUrl;
      }

      await updateStatus(report.id, 'resolved', {
        completion_image_url: completionImageUrl,
        contractor_org_name: getContractorOrgName(report) || user.name,
        work_order_status: 'completed',
        proof_status: 'uploaded',
      });
      clearCompletionDraft(report.id);
      await onStatusChange?.();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function enableSharedWork(report) {
    setBusyId(report.id);
    setError(null);
    try {
      await updateReport(report.id, {
        ...buildSharedRouteFields(user.name),
        responsibility_mode: 'shared',
        work_order_status: 'blocked',
      });
      await onStatusChange?.();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusyId(null);
    }
  }

  async function savePartnerComment(report) {
    const draft = commentDrafts[report.id]?.trim();
    if (!draft) return;

    setBusyId(report.id);
    setError(null);
    try {
      await updateReport(report.id, {
        partner_comment: buildPartnerCommentEntry(report, user, draft),
      });
      setCommentDrafts(prev => {
        const next = { ...prev };
        delete next[report.id];
        return next;
      });
      await onStatusChange?.();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[1540px] px-4 py-6 xl:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] rounded-[44px] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_36%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_32%),radial-gradient(circle_at_center,rgba(255,255,255,0.96),transparent_68%)] blur-3xl" />

      <div className="relative grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <GlassPanel className="overflow-hidden rounded-[36px] border-white/85 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,248,0.84))] p-0 shadow-[0_28px_74px_rgba(15,23,42,0.06)]">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.14)]">
                  <Building2 size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Execution Workspace
                  </div>
                  <div className="mt-2 text-[26px] font-bold tracking-[-0.05em] text-slate-950">
                    {user.name}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {user.position || 'Подрядчик городской инфраструктуры'}
                  </div>
                  <div className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                    ТОО подключено к рабочему контуру акимата
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/70 bg-white/55 p-4">
              <MetricCard title="Активно" value={stats.active} hint="live work orders" tone="neutral" />
              <MetricCard title="SLA риск" value={stats.slaRisk} hint="нужна реакция" tone="alert" />
              <MetricCard title="Ждёт акимат" value={stats.blocked} hint="есть блокеры" tone="blocked" />
              <MetricCard title="Verify rate" value={`${stats.verifyRate}%`} hint="подтверждено" tone="done" />
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-[32px] border-white/85 bg-white/72 p-5 shadow-[0_20px_54px_rgba(15,23,42,0.05)]">
            <SectionLabel>Контур исполнения</SectionLabel>
            <div className="mt-3 grid gap-3">
              <RailNote
                label="Гарантия"
                text="Если актив ещё в гарантийном сроке, кейс автоматически выглядит как work order подрядчика."
                variant="success"
              />
              <RailNote
                label="Эксплуатация"
                text="После гарантии ТОО работает как сервисный оператор по своей зоне и типу актива."
                variant="sky"
              />
              <RailNote
                label="Shared-case"
                text="При спорной или общей зоне ответственности подрядчик и акимат держат единый рабочий контур."
                variant="high"
              />
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-[32px] border-white/85 bg-white/72 p-5 shadow-[0_20px_54px_rgba(15,23,42,0.05)]">
            <SectionLabel>Фокус смены</SectionLabel>
            <div className="mt-3 grid gap-3">
              <FocusItem
                label="Всего work orders"
                value={stats.total}
                hint="видно в contractor queue"
                variant="neutral"
              />
              <FocusItem
                label="Shared-case"
                value={stats.shared}
                hint="нужна синхронизация с акиматом"
                variant="high"
              />
              <FocusItem
                label="На verify / спорные"
                value={`${stats.verifyQueue} / ${stats.disputed}`}
                hint="proof и контур ответственности"
                variant="violet"
              />
            </div>
          </GlassPanel>
        </aside>

        <section className="min-w-0 space-y-5">
          <GlassPanel className="overflow-hidden rounded-[36px] border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,248,0.82))] p-0 shadow-[0_30px_82px_rgba(15,23,42,0.06)]">
            <div className="relative overflow-hidden px-5 py-6 sm:px-6">
              <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_32%)]" />
              <div className="relative flex flex-col gap-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-[840px]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Подрядчик / ТОО
                    </div>
                    <div className="mt-2 text-[30px] font-bold tracking-[-0.055em] text-slate-950 sm:text-[34px]">
                      Рабочие задания от акимата
                    </div>
                    <div className="mt-3 text-sm leading-7 text-slate-600">
                      Здесь подрядчик видит не поток жалоб, а оформленные execution tickets: SLA, контур ответственности, proof-of-execution и shared-case апдейты в одном рабочем слое.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => onStatusChange?.()} className={actionButtonClasses('secondary')}>
                      <RefreshCw size={15} />
                      Обновить
                    </button>
                    <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] font-semibold text-emerald-700">
                      {stats.shared} shared-case c акиматом
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                  <HeroMetric label="Всего заданий" value={stats.total} hint="в contractor queue" />
                  <HeroMetric label="В работе" value={stats.active} hint="назначено и принято" />
                  <HeroMetric label="SLA под риском" value={stats.slaRisk} hint="нужен апдейт или выезд" />
                  <HeroMetric label="На verify" value={stats.verifyQueue} hint="proof ждёт подтверждения" />
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-[32px] border-white/85 bg-white/72 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.05)]">
            <div className="grid gap-4">
              <div>
                <SectionLabel>Очереди</SectionLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(QUEUE_META).map(([key, meta]) => (
                    <FilterChip
                      key={key}
                      active={queueFilter === key}
                      variant={meta.variant}
                      icon={meta.icon}
                      count={queueCounts[key] ?? 0}
                      onClick={() => setQueueFilter(key)}
                    >
                      {meta.label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <SectionLabel>Контур ответственности</SectionLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MODE_FILTERS.map(filter => (
                      <FilterChip
                        key={filter.id}
                        active={modeFilter === filter.id}
                        variant={filter.variant}
                        onClick={() => setModeFilter(filter.id)}
                      >
                        {filter.label}
                      </FilterChip>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel>Приоритет</SectionLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SEVERITY_FILTERS.map(filter => (
                      <FilterChip
                        key={filter.id}
                        active={severityFilter === filter.id}
                        variant={filter.variant}
                        onClick={() => setSeverityFilter(filter.id)}
                      >
                        {filter.label}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </GlassPanel>

          {error ? (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <CircleAlert size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          {filteredReports.length === 0 ? (
            <GlassPanel className="items-center gap-3 rounded-[32px] border-white/85 bg-white/72 px-6 py-12 text-center shadow-[0_22px_60px_rgba(15,23,42,0.05)]">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-50 text-emerald-700">
                <Wrench size={28} />
              </div>
              <div className="text-[22px] font-bold tracking-[-0.03em] text-slate-950">
                В этой очереди пока пусто
              </div>
              <div className="max-w-[560px] text-sm leading-7 text-slate-600">
                Новые назначения, гарантийные кейсы и shared-case появятся здесь, когда акимат направит их в execution layer подрядчика или ТОО оставит следующий апдейт по работам.
              </div>
            </GlassPanel>
          ) : (
            <div className="grid gap-4 2xl:grid-cols-[360px_minmax(0,1fr)]">
              <GlassPanel className="rounded-[32px] border-white/85 bg-white/72 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <SectionLabel>Очередь заданий</SectionLabel>
                    <div className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-950">
                      {filteredReports.length} в текущей выборке
                    </div>
                  </div>
                  <ToneBadge variant="dark">{queueCounts[queueFilter] ?? filteredReports.length}</ToneBadge>
                </div>

                <div className="mt-4 grid gap-3 2xl:max-h-[calc(100vh-21rem)] 2xl:overflow-y-auto 2xl:pr-1">
                  {filteredReports.map(report => (
                    <TicketListItem
                      key={report.id}
                      report={report}
                      active={selectedReport?.id === report.id}
                      onClick={() => setSelectedReportId(report.id)}
                    />
                  ))}
                </div>
              </GlassPanel>

              {selectedReport ? (
                <WorkOrderDetailPanel
                  report={selectedReport}
                  user={user}
                  busy={busyId === selectedReport.id}
                  draftPreview={completionPreviews[selectedReport.id]}
                  commentDraft={commentDrafts[selectedReport.id] ?? ''}
                  onPickFile={event => handleCompletionFileChange(selectedReport.id, event)}
                  onAccept={() => acceptWork(selectedReport)}
                  onBlock={() => markBlocked(selectedReport)}
                  onDispute={() => markBlocked(selectedReport, true)}
                  onResolve={() => resolveReport(selectedReport)}
                  onEnableShared={() => enableSharedWork(selectedReport)}
                  onCommentChange={value => setCommentDrafts(prev => ({ ...prev, [selectedReport.id]: value }))}
                  onSaveComment={() => savePartnerComment(selectedReport)}
                  registerInput={node => { fileInputs.current[selectedReport.id] = node; }}
                />
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AccessDenied({ onBack }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-rose-50 text-rose-600">
        <CircleAlert size={28} />
      </div>
      <div className="text-[24px] font-bold tracking-[-0.03em] text-slate-950">
        Доступ только для подрядчика
      </div>
      <div className="max-w-[440px] text-sm leading-6 text-slate-600">
        Войдите под contractor-аккаунтом ТОО, чтобы видеть назначенные work orders, загружать proof-of-execution и синхронизировать shared-case с акиматом.
      </div>
      <button onClick={onBack} className={actionButtonClasses('primary')}>
        Вернуться на карту
      </button>
    </div>
  );
}

function TicketListItem({ report, active, onClick }) {
  const severity = getSeverityMeta(report.severity);
  const workOrder = getWorkOrderStatusMeta(report);
  const workOrderKey = inferWorkOrderStatus(report);
  const responsibilityMode = getResponsibilityModeMeta(report);
  const responsibilityModeKey = inferResponsibilityMode(report);
  const deadline = getDeadlineState(report);

  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={cx(
        'rounded-[26px] border p-4 text-left transition shadow-[0_14px_32px_rgba(15,23,42,0.04)]',
        active
          ? 'border-emerald-300 bg-emerald-50/80 text-slate-950 ring-1 ring-emerald-200/70'
          : 'border-white/85 bg-white/76 text-slate-950 hover:border-slate-200 hover:bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={cx('text-[10px] font-semibold uppercase tracking-[0.16em]', active ? 'text-emerald-700' : 'text-slate-500')}>
            {getCategoryLabel(report)}
          </div>
          <div className={cx('mt-2 text-[15px] font-bold leading-6', active ? 'text-slate-950' : 'text-slate-950')}>
            {getReportTitle(report)}
          </div>
          <div className={cx('mt-1 text-[12px] leading-5', active ? 'text-slate-600' : 'text-slate-500')}>
            {report.address || 'Алматы'}
          </div>
        </div>

        <ArrowRight size={16} className={active ? 'text-emerald-600' : 'text-slate-300'} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <CompactBadge active={active} variant={severity.variant}>{severity.label}</CompactBadge>
        <CompactBadge active={active} variant={getWorkOrderVariant(workOrderKey)}>{workOrder.label}</CompactBadge>
        <CompactBadge active={active} variant={getResponsibilityVariant(responsibilityModeKey)}>{responsibilityMode.label}</CompactBadge>
      </div>

      <div className={cx('mt-3 rounded-[18px] border px-3 py-2.5 text-[12px] leading-5', active ? 'border-emerald-200 bg-white/80 text-slate-700' : 'border-slate-100 bg-slate-50/80 text-slate-600')}>
        {deadline.label}
      </div>
    </motion.button>
  );
}

const sectionMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
};

function WorkOrderDetailPanel({
  report,
  user,
  busy,
  draftPreview,
  commentDraft,
  onPickFile,
  onAccept,
  onBlock,
  onDispute,
  onResolve,
  onEnableShared,
  onCommentChange,
  onSaveComment,
  registerInput,
}) {
  const severity = getSeverityMeta(report.severity);
  const workOrder = getWorkOrderStatusMeta(report);
  const workOrderKey = inferWorkOrderStatus(report);
  const responsibilityMode = getResponsibilityModeMeta(report);
  const responsibilityModeKey = inferResponsibilityMode(report);
  const proofStatus = getProofStatusMeta(report);
  const proofStatusKey = inferProofStatus(report);
  const deadline = getDeadlineState(report);
  const originalImage = getPrimaryImage(report);
  const completionImage = draftPreview ?? report.completion_image_url ?? null;
  const canResolve = Boolean(completionImage);
  const assignedOrg = getAssignedOrgName(report) || getContractorOrgName(report) || user.name;
  const responsibility = getResponsibleRole(report);
  const showPartnerBox = isSharedCase(report) || ['blocked', 'disputed'].includes(workOrderKey);

  return (
    <motion.div
      key={report.id}
      initial={{ opacity: 0, y: 14, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
    <GlassPanel className="rounded-[32px] border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,248,0.84))] p-0 shadow-[0_24px_64px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Execution ticket · {getCategoryLabel(report)}
            </div>
            <div className="mt-2 text-[24px] font-bold tracking-[-0.04em] text-slate-950">
              {getReportTitle(report)}
            </div>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              {report.address || 'Алматы'} · обновлено {formatDateTime(report.updated_at || report.created_at)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ToneBadge variant={severity.variant}>{severity.label}</ToneBadge>
            <ToneBadge variant={getWorkOrderVariant(workOrderKey)}>{workOrder.label}</ToneBadge>
            <ToneBadge variant={getResponsibilityVariant(responsibilityModeKey)}>{responsibilityMode.label}</ToneBadge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <SectionCard title="Почему назначено">
            <div className="text-[15px] font-semibold leading-7 text-slate-900">
              {getLiabilityNarrative(report)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <ToneBadge variant={getDeadlineVariant(deadline.tone)}>
                <Clock3 size={13} className="mr-1.5" />
                {deadline.label}
              </ToneBadge>
              <ToneBadge variant={getProofVariant(proofStatusKey)}>
                {proofStatus.label}
              </ToneBadge>
            </div>
          </SectionCard>

          <SectionCard title="Контур актива">
            <div className="flex flex-wrap gap-2">
              <ToneBadge variant={getResponsibilityVariant(responsibilityModeKey)}>{responsibilityMode.label}</ToneBadge>
              <ToneBadge variant={getWorkOrderVariant(workOrderKey)}>{workOrder.label}</ToneBadge>
              <ToneBadge variant={getProofVariant(proofStatusKey)}>{proofStatus.label}</ToneBadge>
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-600">
              {responsibilityMode.caption}
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <SideInfo label="Назначено ТОО" value={assignedOrg} />
              <SideInfo label="Контур" value={RESPONSIBILITY_LABEL[responsibility] ?? 'Акимат'} />
              <SideInfo label="Актив" value={report.asset_type || 'Городская инфраструктура'} />
              <SideInfo label="Гарантия" value={report.warranty_until ? formatDateOnly(report.warranty_until) : 'По сервисному контракту'} />
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard title="Следующий шаг">
            <div className="text-sm font-semibold leading-7 text-slate-900">
              {getNextRequiredAction(report)}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <MetaCell label="SLA дедлайн" value={deadline.dueAt ? formatDateTime(deadline.dueAt) : 'Уточняется'} />
              <MetaCell label="Зона" value={report.service_zone || report.district || 'Алматы'} />
              <MetaCell label="Владелец" value={report.asset_owner || 'Город Алматы'} />
            </div>
          </SectionCard>

          <SectionCard title="Статус исполнения">
            <div className="grid gap-2.5">
              <SideInfo label="Proof status" value={proofStatus.label} badgeVariant={getProofVariant(proofStatusKey)} />
              <SideInfo label="Создано" value={formatDateTime(report.created_at)} />
              <SideInfo label="Обновлено" value={formatDateTime(report.updated_at || report.created_at)} />
            </div>
          </SectionCard>
        </div>

        {showPartnerBox ? (
          <InfoBanner
            variant={responsibility === 'shared' ? 'high' : 'violet'}
            title={responsibility === 'shared' ? 'Shared-case активен' : 'Кейс в блокировке'}
            text={
              responsibility === 'shared'
                ? 'Подрядчик и акимат работают в одном контуре. Оставляйте рабочие апдейты, чтобы не потерять SLA и договорённости по выезду.'
                : 'Оставьте ясный апдейт для акимата: что уже сделано, что блокирует бригаду и какое решение требуется.'
            }
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Фото до" padded={false}>
            <ImageCard title={null} image={originalImage} emptyLabel="Фото обращения отсутствует" />
          </SectionCard>
          <SectionCard title="Фото после / proof" padded={false}>
            <ImageCard title={null} image={completionImage} emptyLabel="Загрузите итоговое фото после работ" />
          </SectionCard>
        </div>

        {['resolved', 'verified'].includes(report.status) && originalImage && report.completion_image_url ? (
          <SectionCard title="AI Verify">
            <VerifyBadge
              beforeUrl={originalImage}
              afterUrl={report.completion_image_url}
              type={report.type}
              description={report.detected_issue_title || report.title}
            />
          </SectionCard>
        ) : null}

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <SectionCard title="AI routing dossier" padded={false}>
            <AITriagePanel data={report} compact={false} title="AI routing dossier" showHeader={false} />
          </SectionCard>

          <SectionCard title="Ход исполнения">
            <CollaborationTimeline report={report} title="Текущий статус" />
          </SectionCard>
        </div>

        {showPartnerBox ? (
          <SectionCard title="Координация с акиматом" padded={false}>
            <PartnerCommentBox
              report={report}
              draft={commentDraft}
              onDraftChange={onCommentChange}
              onSave={onSaveComment}
              busy={busy}
              placeholder="Оставьте апдейт для акимата: что уже сделали, что блокирует бригаду, нужен ли общий выезд или уточнение контура ответственности…"
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Действия бригады">
          <div className="flex flex-wrap gap-2.5">
            {workOrderKey === 'assigned' ? (
              <button onClick={onAccept} disabled={busy} className={actionButtonClasses('primary')}>
                {busy ? 'Назначаем…' : 'Принять задание'}
                <ArrowRight size={14} />
              </button>
            ) : null}

            {['accepted', 'blocked', 'disputed'].includes(workOrderKey) ? (
              <>
                <label className={cx(actionButtonClasses('secondary'), 'cursor-pointer')}>
                  <Camera size={15} />
                  {completionImage ? 'Обновить proof' : 'Загрузить proof'}
                  <input
                    ref={registerInput}
                    type="file"
                    accept="image/*"
                    onChange={onPickFile}
                    className="hidden"
                  />
                </label>

                <button onClick={onResolve} disabled={busy || !canResolve} className={actionButtonClasses('primary')}>
                  {busy ? 'Передаём…' : 'Передать на verify'}
                  <ArrowRight size={14} />
                </button>

                <button onClick={onBlock} disabled={busy} className={actionButtonClasses('secondary')}>
                  <Handshake size={15} />
                  Ждёт акимат
                </button>

                <button onClick={onDispute} disabled={busy} className={actionButtonClasses('secondary')}>
                  <ShieldAlert size={15} />
                  Оспорить зону
                </button>

                {responsibility === 'business' ? (
                  <button onClick={onEnableShared} disabled={busy} className={actionButtonClasses('warning')}>
                    Нужен общий выезд
                  </button>
                ) : null}
              </>
            ) : null}

            {workOrderKey === 'completed' ? (
              <div className={cx('inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-semibold', badgeClasses('soft-success'))}>
                <ShieldCheck size={16} />
                Proof загружен, ждём verify
              </div>
            ) : null}

            {workOrderKey === 'verified' ? (
              <div className={cx('inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-semibold', badgeClasses('success'))}>
                <CheckCircle2 size={16} />
                Задание закрыто и подтверждено
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </GlassPanel>
    </motion.div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {children}
    </div>
  );
}

function HeroMetric({ label, value, hint }) {
  return (
    <div className="rounded-[26px] border border-white/85 bg-white/72 px-4 py-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-bold leading-none text-slate-950">
        {value}
      </div>
      <div className="mt-2 text-[12px] text-slate-500">
        {hint}
      </div>
    </div>
  );
}

function MetricCard({ title, value, hint, tone }) {
  return (
    <GlassCard className={cx('rounded-[24px] border p-4 shadow-[0_16px_34px_rgba(15,23,42,0.04)]', metricClasses(tone))}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-[28px] font-bold leading-none">
        {value}
      </div>
      <div className="mt-2 text-[12px] text-slate-500">
        {hint}
      </div>
    </GlassCard>
  );
}

function RailNote({ label, text, variant }) {
  return (
    <div className="rounded-[24px] border border-white/85 bg-white/70 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.04)]">
      <ToneBadge variant={variant}>{label}</ToneBadge>
      <div className="mt-3 text-[13px] leading-6 text-slate-600">{text}</div>
    </div>
  );
}

function FocusItem({ label, value, hint, variant }) {
  return (
    <div className="rounded-[24px] border border-white/85 bg-white/70 px-4 py-3 shadow-[0_14px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-semibold text-slate-700">{label}</div>
        <ToneBadge variant={variant}>{value}</ToneBadge>
      </div>
      <div className="mt-2 text-[12px] leading-5 text-slate-500">{hint}</div>
    </div>
  );
}

function FilterChip({ active, variant = 'neutral', children, count, icon: Icon, onClick }) {
  return (
    <motion.button
      whileHover={{ y: -1.5 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition',
        active
          ? badgeClasses(variant)
          : 'border-white/90 bg-white/78 text-slate-700 hover:bg-white'
      )}
    >
      {Icon ? <Icon size={13} /> : null}
      <span>{children}</span>
      {typeof count === 'number' ? (
        <span className={cx('text-[11px]', active ? 'opacity-70' : 'text-slate-400')}>
          {count}
        </span>
      ) : null}
    </motion.button>
  );
}

function InfoBanner({ title, text, variant }) {
  return (
    <div className={cx('rounded-[24px] border px-4 py-3.5', badgeClasses(variant))}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.14em] opacity-80">
        {title}
      </div>
      <div className="mt-1.5 text-[13px] leading-6">
        {text}
      </div>
    </div>
  );
}

function SectionCard({ title, children, padded = true }) {
  return (
    <motion.div
      variants={sectionMotion}
      initial="initial"
      animate="animate"
      className={cx(
        'rounded-[28px] border border-white/85 bg-white/76 shadow-[0_16px_34px_rgba(15,23,42,0.035)]',
        padded ? 'p-4 sm:p-5' : 'overflow-hidden'
      )}
    >
      {title ? (
        <div className={padded ? '' : 'px-4 pt-4 sm:px-5'}>
          <SectionLabel>{title}</SectionLabel>
        </div>
      ) : null}
      <div className={cx(!padded && title ? 'px-4 pb-4 pt-3 sm:px-5' : null)}>
        {children}
      </div>
    </motion.div>
  );
}

function CompactBadge({ active, variant, children }) {
  return (
    <span className={cx(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
      active
        ? 'border-white/90 bg-white text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)]'
        : badgeClasses(variant)
    )}>
      {children}
    </span>
  );
}

function MetaCell({ label, value }) {
  return (
    <div className="rounded-[22px] border border-white/85 bg-white/74 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1.5 text-[14px] font-semibold leading-6 text-slate-900">{value}</div>
    </div>
  );
}

function SideInfo({ label, value, badgeVariant }) {
  return (
    <div className="rounded-[22px] border border-white/85 bg-white/74 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      {badgeVariant ? (
        <div className="mt-2">
          <ToneBadge variant={badgeVariant}>{value}</ToneBadge>
        </div>
      ) : (
        <div className="mt-1.5 text-[14px] font-semibold leading-6 text-slate-900">{value}</div>
      )}
    </div>
  );
}

function ImageCard({ title, image, emptyLabel }) {
  return (
    <div className="group overflow-hidden rounded-[26px] border border-white/85 bg-white/78 shadow-[0_16px_34px_rgba(15,23,42,0.04)]">
      {title ? (
        <div className="border-b border-slate-100 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {title}
        </div>
      ) : null}
      {image ? (
        <motion.img
          src={image}
          alt={title || 'report image'}
          className="block aspect-[16/10] w-full object-cover"
          whileHover={{ scale: 1.018 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center px-6 text-center text-[13px] leading-6 text-slate-400">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function ToneBadge({ variant, children }) {
  return (
    <span className={cx('inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold', badgeClasses(variant))}>
      {children}
    </span>
  );
}
