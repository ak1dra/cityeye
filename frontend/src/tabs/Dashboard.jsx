import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AkimatAssistantPanel } from '../components/AkimatAssistantPanel';
import { AITriagePanel } from '../components/AITriagePanel';
import { CollaborationTimeline, PartnerCommentBox } from '../components/CollaborationWidgets';
import { VerifyBadge } from '../components/VerifyBadge';
import { getAssistantGuidance, updateReport, updateStatus } from '../api';
import { getAIDossier } from '../lib/aiTriage';
import {
  buildPartnerCommentEntry,
  buildBusinessRouteFields,
  buildGovernmentRouteFields,
  buildSharedRouteFields,
  getAssignedOrgName,
  getReporterName,
  getReporterRole,
  getResponsibleRole,
  isSharedCase,
  REPORTER_ROLE_LABEL,
  RESPONSIBILITY_LABEL,
  RESPONSIBILITY_STYLE,
} from '../lib/reportCollaboration';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const NEXT = {
  new:         'in_progress',
  in_progress: 'resolved',
  resolved:    null,
  rejected:    'new',
};
const NEXT_LABEL = {
  new:         '▶ В работу',
  in_progress: '✓ Решено',
  rejected:    '↺ Вернуть',
};
const ST_LABEL = { new: 'Новый', in_progress: 'В работе', resolved: 'Решено', rejected: 'Отклонён' };
const ST_COLOR = { new: '#6366f1', in_progress: '#f59e0b', resolved: '#22c55e', rejected: '#94a3b8' };
const ST_BG    = {
  new: 'rgba(99,102,241,0.1)', in_progress: 'rgba(245,158,11,0.1)',
  resolved: 'rgba(34,197,94,0.1)', rejected: 'rgba(148,163,184,0.1)',
};

const SEV_LABEL = {
  КРИТИЧНО: 'Критично', ВЫСОКО: 'Высокий', СРЕДНЕ: 'Средний', НИЗКО: 'Низкий',
  critical: 'Критично', high: 'Высокий',  medium: 'Средний',  low: 'Низкий',
};
const SEV_COLOR = {
  КРИТИЧНО: '#ef4444', ВЫСОКО: '#f97316', СРЕДНЕ: '#eab308', НИЗКО: '#22c55e',
  critical: '#ef4444', high:   '#f97316', medium: '#eab308', low:   '#22c55e',
};
const SEV_BG = {
  КРИТИЧНО: 'rgba(239,68,68,0.1)', ВЫСОКО: 'rgba(249,115,22,0.1)',
  СРЕДНЕ: 'rgba(234,179,8,0.1)',   НИЗКО: 'rgba(34,197,94,0.1)',
  critical: 'rgba(239,68,68,0.1)', high: 'rgba(249,115,22,0.1)',
  medium: 'rgba(234,179,8,0.1)',   low: 'rgba(34,197,94,0.1)',
};

/** Compute district stats from real report data. */
function computeDistricts(reports) {
  const KNOWN = ['Медеуский', 'Бостандыкский', 'Алмалинский', 'Жетысуский', 'Ауэзовский', 'Турксибский', 'Алатауский', 'Наурызбайский'];
  const map = {};
  for (const r of reports) {
    const addr = r.address || '';
    const d = KNOWN.find(n => addr.toLowerCase().includes(n.toLowerCase().replace('ский', '')));
    if (!d) continue;
    if (!map[d]) map[d] = { total: 0, resolved: 0 };
    map[d].total++;
    if (r.status === 'resolved') map[d].resolved++;
  }
  return Object.entries(map)
    .map(([name, s]) => ({ name, score: s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0, total: s.total }))
    .sort((a, b) => b.score - a.score);
}

/* ── helpers ── */
function timeAgo(s) {
  if (!s) return '—';
  const m = Math.floor((Date.now() - new Date(s)) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

function buildChartData(reports) {
  const map = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    map[key] = { date: key, new: 0, resolved: 0 };
  }
  reports.forEach(r => {
    if (!r.created_at) return;
    const d = new Date(r.created_at);
    const key = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) return;
    map[key].new += 1;
    if (r.status === 'resolved') map[key].resolved += 1;
  });
  return Object.values(map);
}

/* ── Icons ── */
function Icon({ n, size = 16, color = 'currentColor' }) {
  const s = { width: size, height: size, display: 'block', flexShrink: 0 };
  const p = { stroke: color, fill: 'none', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    map:      <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
    feed:     <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    chart:    <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    pin:      <><path d="M21 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
    clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    alert:    <><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
    logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    photo:    <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    refresh:  <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
  };
  return <svg style={s} viewBox="0 0 24 24" {...p}>{paths[n]}</svg>;
}

/* ── Chart Tooltip ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div style={{ color: '#94a3b8', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#64748b' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ value, label, color, icon, sub }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon n={icon} size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1, marginBottom: 8 }}>
        {typeof value === 'number' ? value.toLocaleString('ru') : value}
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, background: `${color}12`, borderRadius: 5, padding: '2px 7px' }}>
        {sub}
      </span>
    </div>
  );
}

/* ── Report Detail Modal ── */
function ReportModal({ report: initialReport, user, onClose, onStatusChange, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [liveReport, setLiveReport] = useState(initialReport);
  const [partnerCommentDraft, setPartnerCommentDraft] = useState('');

  useEffect(() => {
    setLiveReport(initialReport);
    setPartnerCommentDraft('');
  }, [initialReport]);

  const report = liveReport;
  if (!report) return null;

  const next      = NEXT[report.status];
  const sevColor  = SEV_COLOR[report.severity] ?? '#94a3b8';
  const sevLabel  = SEV_LABEL[report.severity] ?? report.severity ?? '—';
  const stColor   = ST_COLOR[report.status]  ?? '#94a3b8';
  const stLabel   = ST_LABEL[report.status]  ?? report.status;
  const responsibility = getResponsibleRole(report);
  const reporterRole = getReporterRole(report);
  const routeStyle = RESPONSIBILITY_STYLE[responsibility];
  const assignedOrg = getAssignedOrgName(report);
  const aiDossier = getAIDossier(report);

  async function advance() {
    if (!next) return;
    setBusy(true);
    try {
      const updated = await updateStatus(report.id, next);
      if (updated) setLiveReport(updated);
      await onRefresh?.();
      onStatusChange();
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function reject() {
    setBusy(true);
    try {
      const updated = await updateStatus(report.id, 'rejected');
      if (updated) setLiveReport(updated);
      await onRefresh?.();
      onStatusChange();
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function routeTo(fields) {
    setBusy(true);
    try {
      const updated = await updateReport(report.id, fields);
      if (updated) setLiveReport(updated);
      await onRefresh?.();
      onStatusChange();
    } catch { /* ignore */ }
    setBusy(false);
  }

  async function savePartnerComment() {
    const draft = partnerCommentDraft.trim();
    if (!draft) return;

    setBusy(true);
    try {
      const updated = await updateReport(report.id, {
        partner_comment: buildPartnerCommentEntry(report, user, draft),
      });
      if (updated) setLiveReport(updated);
      setPartnerCommentDraft('');
      await onRefresh?.();
    } catch { /* ignore */ }
    setBusy(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Image */}
        {(report.image_url || report.image) ? (
          <img
            src={report.image_url || report.image}
            alt=""
            style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: '20px 20px 0 0', display: 'block' }}
          />
        ) : (
          <div style={{
            height: 120, borderRadius: '20px 20px 0 0',
            background: '#f4f5f7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon n="photo" size={32} color="#cbd5e1" />
          </div>
        )}

        <div style={{ padding: '24px 28px' }}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ background: SEV_BG[report.severity] ?? '#f1f5f9', color: sevColor, border: `1px solid ${sevColor}40`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              {sevLabel}
            </span>
            <span style={{ background: ST_BG[report.status] ?? '#f1f5f9', color: stColor, border: `1px solid ${stColor}40`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
              {stLabel}
            </span>
            <span style={{ background: routeStyle.bg, color: routeStyle.color, border: `1px solid ${routeStyle.border}`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              {RESPONSIBILITY_LABEL[responsibility]}
            </span>
          </div>

          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            {report.detected_issue_title || report.type || 'Городская проблема'}
          </h2>

          {report.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, marginBottom: 16 }}>
              <Icon n="pin" size={13} color="#94a3b8" />
              {report.address}
            </div>
          )}

          <AITriagePanel report={report} data={report} title="AI-досье кейса" />

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {report.estimated_fix_time && (
              <Cell label="Срок устранения" value={report.estimated_fix_time} />
            )}
            {report.responsible_dept && (
              <Cell label="Ответственный отдел" value={report.responsible_dept} />
            )}
            {report.recommended_action && (
              <Cell label="Рекомендация" value={report.recommended_action} />
            )}
            <Cell label="Создал" value={`${REPORTER_ROLE_LABEL[reporterRole]} · ${getReporterName(report)}`} />
            <Cell label="Контур работы" value={RESPONSIBILITY_LABEL[responsibility]} />
            {assignedOrg && <Cell label="Назначено" value={assignedOrg} />}
            <Cell label="Дата" value={new Date(report.created_at).toLocaleString('ru-RU')} />
            {report.priority_score != null && (
              <Cell label="Приоритет" value={`${report.priority_score}/100`} />
            )}
          </div>

          <CollaborationTimeline report={report} />

          {report.completion_image_url && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Фото выполнения
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: (report.image_url || report.image) ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 10 }}>
                {(report.image_url || report.image) && (
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>ДО</div>
                    <img
                      src={report.image_url || report.image}
                      alt="До"
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, border: '1px solid #fecaca' }}
                    />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginBottom: 4 }}>ПОСЛЕ</div>
                  <img
                    src={report.completion_image_url}
                    alt="После"
                    style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, border: '1px solid #86efac' }}
                  />
                </div>
              </div>
              <VerifyBadge
                beforeUrl={report.image_url || report.image}
                afterUrl={report.completion_image_url}
                type={report.type}
                description={report.title || report.description}
              />
            </div>
          )}

          {isSharedCase(report) && (
            <div style={{ marginBottom: 18 }}>
              <PartnerCommentBox
                report={report}
                draft={partnerCommentDraft}
                onDraftChange={setPartnerCommentDraft}
                onSave={savePartnerComment}
                busy={busy}
                placeholder="Напишите комментарий для подрядчика: что нужно сделать, в какие сроки, какие есть договорённости..."
              />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            {next && (
              <button
                disabled={busy}
                onClick={advance}
                style={{
                  flex: 1, background: '#6366f1', color: '#fff',
                  border: 'none', borderRadius: 10,
                  padding: '11px 0', fontSize: 14, fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                  boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
                }}
              >
                {busy ? '...' : NEXT_LABEL[report.status]}
              </button>
            )}
            {report.status !== 'rejected' && report.status !== 'resolved' && (
              <button
                disabled={busy}
                onClick={reject}
                style={{
                  background: '#fef2f2', color: '#ef4444',
                  border: '1px solid #fecaca', borderRadius: 10,
                  padding: '11px 18px', fontSize: 13, fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                Отклонить
              </button>
            )}
            <button onClick={onClose} style={{
              background: '#f4f5f7', color: '#64748b',
              border: 'none', borderRadius: 10,
              padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Закрыть
            </button>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              Маршрутизация
            </div>
            {aiDossier.hasTriage && (
              <div style={{ marginBottom: 10, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                AI рекомендует маршрут: <strong style={{ color: aiDossier.suggestedRole.color }}>{aiDossier.suggestedRole.label}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <RouteButton
                active={responsibility === 'government'}
                label="Вести акиматом"
                color="#6366f1"
                recommended={aiDossier.suggestedRoleKey === 'government'}
                onClick={() => routeTo(buildGovernmentRouteFields())}
                disabled={busy}
              />
              <RouteButton
                active={responsibility === 'business'}
                label="Передать подрядчику"
                color="#0f766e"
                recommended={aiDossier.suggestedRoleKey === 'business'}
                onClick={() => routeTo(buildBusinessRouteFields())}
                disabled={busy}
              />
              <RouteButton
                active={isSharedCase(report)}
                label="Совместно"
                color="#a16207"
                recommended={aiDossier.suggestedRoleKey === 'shared'}
                onClick={() => routeTo(buildSharedRouteFields())}
                disabled={busy}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function normalizeSeverityKey(value) {
  const source = String(value ?? '').toLowerCase();
  if (source.includes('крит') || source === 'critical') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
}

function reportAgeHours(report) {
  if (!report?.created_at) return 0;
  const createdAt = new Date(report.created_at).getTime();
  if (!Number.isFinite(createdAt)) return 0;
  return Math.max(0, Math.round((Date.now() - createdAt) / 3600000));
}

function controlPriorityScore(report) {
  const priority = Number(report?.priority_score);
  const priorityBase = Number.isFinite(priority)
    ? priority
    : normalizeSeverityKey(report?.severity) === 'critical'
      ? 95
      : normalizeSeverityKey(report?.severity) === 'high'
        ? 78
        : normalizeSeverityKey(report?.severity) === 'low'
          ? 24
          : 52;

  const statusBonus =
    report?.status === 'waiting_partner' ? 16
      : report?.status === 'new' ? 10
        : report?.status === 'in_progress' ? 4
          : 0;

  return priorityBase + statusBonus + (report?.duplicate_likely ? 4 : 0);
}

function buildTodayReactionReason(report) {
  const severity = normalizeSeverityKey(report?.severity);
  const ageHours = reportAgeHours(report);
  const responsibility = getResponsibleRole(report);

  if (report?.status === 'waiting_partner') return 'Ожидает ответа второй стороны';
  if (severity === 'critical') return 'Критичный кейс требует реакции в текущую смену';
  if (severity === 'high' && ageHours >= 12) return 'Высокий риск без подтверждённого движения';
  if (responsibility !== 'government' && !getAssignedOrgName(report)) return 'Нет назначенной организации по внешнему контуру';
  return 'Требует подтверждения маршрута и исполнителя';
}

function buildSharedStuckReason(report) {
  if (!getAssignedOrgName(report)) return 'Shared-case без назначенной организации';
  if (!report?.partner_comment) return 'Нет координационного комментария';
  if (report?.status === 'waiting_partner') return 'Кейс завис в ожидании ответа партнёра';
  return 'Нужна синхронизация между акиматом и подрядчиком';
}

function buildControlBucket(report) {
  const responsibility = getResponsibleRole(report);
  const score = controlPriorityScore(report);
  const severity = normalizeSeverityKey(report?.severity);
  const ageHours = reportAgeHours(report);
  const isReactionToday =
    report?.status !== 'resolved'
    && report?.status !== 'verified'
    && report?.status !== 'rejected'
    && (
      report?.status === 'waiting_partner'
      || severity === 'critical'
      || (severity === 'high' && (report?.status === 'new' || ageHours >= 12))
      || (responsibility !== 'government' && !getAssignedOrgName(report))
    );

  const isSharedStuck =
    isSharedCase(report)
    && report?.status !== 'resolved'
    && report?.status !== 'verified'
    && report?.status !== 'rejected'
    && (
      report?.status === 'waiting_partner'
      || !getAssignedOrgName(report)
      || !report?.partner_comment
    );

  return {
    isReactionToday,
    isSharedStuck,
    score,
    reasonToday: buildTodayReactionReason(report),
    reasonShared: buildSharedStuckReason(report),
  };
}

function ControlCaseItem({ report, reason, onOpen }) {
  const responsibility = getResponsibleRole(report);
  const routeStyle = RESPONSIBILITY_STYLE[responsibility];
  const severity = normalizeSeverityKey(report?.severity);
  const ageHours = reportAgeHours(report);
  const urgencyColor =
    severity === 'critical' ? '#dc2626'
      : severity === 'high' ? '#ea580c'
        : '#2563eb';

  return (
    <button
      onClick={() => onOpen?.(report)}
      style={{
        width: '100%',
        textAlign: 'left',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '12px 14px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.45 }}>
            {report.detected_issue_title || report.type || 'Без названия'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.55 }}>
            {report.address || 'Адрес уточняется'}
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: `${urgencyColor}12`, border: `1px solid ${urgencyColor}30`, color: urgencyColor, padding: '5px 9px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
          {ageHours > 0 ? `${ageHours}ч` : 'сейчас'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: routeStyle.bg, color: routeStyle.color, border: `1px solid ${routeStyle.border}`, padding: '5px 9px', fontSize: 11, fontWeight: 700 }}>
          {RESPONSIBILITY_LABEL[responsibility]}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: ST_BG[report.status] ?? '#f8fafc', color: ST_COLOR[report.status] ?? '#64748b', border: `1px solid ${(ST_COLOR[report.status] ?? '#cbd5e1')}40`, padding: '5px 9px', fontSize: 11, fontWeight: 700 }}>
          {ST_LABEL[report.status] ?? report.status}
        </span>
      </div>

      <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6, marginBottom: 8 }}>
        {reason}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
          {getReporterName(report)} · {REPORTER_ROLE_LABEL[getReporterRole(report)]}
        </div>
        <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700 }}>
          Открыть кейс
        </div>
      </div>
    </button>
  );
}

function ControlBoard({ reactionToday = [], stuckShared = [], onOpen }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Нужна реакция сегодня</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              Критичные и зависающие кейсы без подтверждённого движения
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, height: 34, borderRadius: 999, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 800 }}>
            {reactionToday.length}
          </span>
        </div>

        {reactionToday.length === 0 ? (
          <div style={{ borderRadius: 14, border: '1px dashed #d1d5db', background: '#f8fafc', padding: '16px 18px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            Сегодня нет кейсов, требующих немедленной реакции.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {reactionToday.map(item => (
              <ControlCaseItem key={item.report.id} report={item.report} reason={item.reason} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Зависшие shared-case</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              Совместные кейсы, где акимату нужно снять блокировку и вернуть движение
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, height: 34, borderRadius: 999, background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', fontSize: 13, fontWeight: 800 }}>
            {stuckShared.length}
          </span>
        </div>

        {stuckShared.length === 0 ? (
          <div style={{ borderRadius: 14, border: '1px dashed #d1d5db', background: '#f8fafc', padding: '16px 18px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            Сейчас нет shared-case, требующих ручной координации.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {stuckShared.map(item => (
              <ControlCaseItem key={item.report.id} report={item.report} reason={item.reason} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function Dashboard({ reports = [], analyticsOverview = null, loading = false, onStatusChange, onTabChange, user, onLogout }) {
  const [filterSev,   setFilterSev]   = useState('all');
  const [filterSt,    setFilterSt]    = useState('all');
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState(null);
  const [assistantReport, setAssistantReport] = useState(null);
  const [assistantData, setAssistantData] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState(null);
  const [assistantRouteBusy, setAssistantRouteBusy] = useState(false);
  const [activeNav,   setActiveNav]   = useState('chart');
  const [lastUpdated, setLastUpdated] = useState(null);

  const refreshReports = useCallback(async () => {
    await onStatusChange?.();
  }, [onStatusChange]);

  useEffect(() => {
    if (!loading) {
      setLastUpdated(new Date());
    }
  }, [reports, loading]);

  /* ── Access guard ── */
  if (user?.role !== 'government' || user?.status !== 'active') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', gap: 16, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon n="alert" size={28} color="#ef4444" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Доступно только для гос. органов</div>
        <div style={{ fontSize: 14, color: '#94a3b8', maxWidth: 300, textAlign: 'center' }}>
          Войдите в аккаунт государственного служащего
        </div>
        <button onClick={() => onTabChange?.('map')} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, background: '#6366f1', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
          Вернуться на карту
        </button>
      </div>
    );
  }

  /* ── Stats ── */
  const localTotal      = reports.length;
  const localNewCnt     = reports.filter(r => r.status === 'new').length;
  const localInProgCnt  = reports.filter(r => r.status === 'in_progress').length;
  const localResolvedCnt = reports.filter(r => r.status === 'resolved').length;
  const localCriticalCnt = reports.filter(r => r.severity === 'КРИТИЧНО' || r.severity === 'critical').length;

  /* ── Analytics (for gov dashboard) ── */
  const localAnalytics = useMemo(() => {
    const TYPE_LABEL = {
      road: 'Дороги', lighting: 'Освещение', waste: 'Мусор',
      greenery: 'Озеленение', utilities: 'Коммуналка', parking: 'Парковка',
      vandal: 'Вандализм', other: 'Другое',
    };
    const TYPE_COLOR = {
      road: '#ef4444', lighting: '#f59e0b', waste: '#84cc16',
      greenery: '#22c55e', utilities: '#06b6d4', parking: '#8b5cf6',
      vandal: '#ec4899', other: '#94a3b8',
    };

    // By type breakdown
    const byType = {};
    reports.forEach(r => {
      const t = r.type || 'other';
      if (!byType[t]) byType[t] = { type: t, label: TYPE_LABEL[t] || t, color: TYPE_COLOR[t] || '#94a3b8', total: 0, open: 0, resolved: 0 };
      byType[t].total += 1;
      if (r.status === 'resolved' || r.status === 'verified') byType[t].resolved += 1;
      else byType[t].open += 1;
    });
    const typeBreakdown = Object.values(byType).sort((a, b) => b.total - a.total);

    // SLA: avg time to resolve (hours)
    const resolvedReports = reports.filter(r => r.status === 'resolved' && r.created_at && r.updated_at);
    let avgResolveHours = 0;
    if (resolvedReports.length > 0) {
      const totalHours = resolvedReports.reduce((sum, r) => {
        return sum + (new Date(r.updated_at) - new Date(r.created_at)) / 3600000;
      }, 0);
      avgResolveHours = Math.round(totalHours / resolvedReports.length);
    }

    // SLA compliance (resolved within 72h)
    const slaCompliant = resolvedReports.filter(r => {
      return (new Date(r.updated_at) - new Date(r.created_at)) / 3600000 <= 72;
    }).length;
    const slaPercent = resolvedReports.length > 0 ? Math.round((slaCompliant / resolvedReports.length) * 100) : 0;

    // Shared-case stats
    const sharedCnt = reports.filter(r => r.responsible_role === 'shared' || r.shared_case).length;
    const sharedOpen = reports.filter(r => (r.responsible_role === 'shared' || r.shared_case) && r.status !== 'resolved' && r.status !== 'verified').length;
    const waitingPartner = reports.filter(r => r.status === 'waiting_partner').length;

    // Route distribution
    const govRoute = reports.filter(r => r.responsible_role === 'government' || (!r.responsible_role && !r.shared_case)).length;
    const busRoute = reports.filter(r => r.responsible_role === 'business').length;

    return { typeBreakdown, avgResolveHours, slaPercent, slaCompliant, resolvedCount: resolvedReports.length, sharedCnt, sharedOpen, waitingPartner, govRoute, busRoute };
  }, [reports]);

  const total = analyticsOverview?.total ?? localTotal;
  const newCnt = analyticsOverview?.newCnt ?? localNewCnt;
  const inProgCnt = analyticsOverview?.inProgCnt ?? localInProgCnt;
  const resolvedCnt = analyticsOverview?.resolvedCnt ?? localResolvedCnt;
  const criticalCnt = analyticsOverview?.criticalCnt ?? localCriticalCnt;
  const analytics = analyticsOverview
    ? {
        typeBreakdown: analyticsOverview.typeBreakdown ?? analyticsOverview.type_breakdown ?? [],
        avgResolveHours: analyticsOverview.avgResolveHours ?? 0,
        slaPercent: analyticsOverview.slaPercent ?? 0,
        slaCompliant: analyticsOverview.slaCompliant ?? 0,
        resolvedCount: analyticsOverview.resolvedCount ?? 0,
        sharedCnt: analyticsOverview.sharedCnt ?? 0,
        sharedOpen: analyticsOverview.sharedOpen ?? 0,
        waitingPartner: analyticsOverview.waitingPartner ?? 0,
        govRoute: analyticsOverview.govRoute ?? analyticsOverview.route_breakdown?.government ?? 0,
        busRoute: analyticsOverview.busRoute ?? analyticsOverview.route_breakdown?.business ?? 0,
        hotspots: analyticsOverview.hotspots ?? [],
      }
    : {
        ...localAnalytics,
        hotspots: [],
      };

  /* ── Filtered table ── */
  const tableRows = useMemo(() => reports.filter(r => {
    const matchSev = filterSev === 'all' || r.severity === filterSev;
    const matchSt  = filterSt  === 'all' || r.status   === filterSt;
    const q = search.toLowerCase();
    const matchSearch = !q || (r.type ?? '').toLowerCase().includes(q)
      || (r.address ?? '').toLowerCase().includes(q)
      || (r.user_name ?? '').toLowerCase().includes(q)
      || (r.reporter_org_name ?? '').toLowerCase().includes(q)
      || (r.assigned_org_name ?? '').toLowerCase().includes(q);
    return matchSev && matchSt && matchSearch;
  }), [reports, filterSev, filterSt, search]);

  useEffect(() => {
    if (!assistantReport?.id) return;
    const refreshed = reports.find(report => report.id === assistantReport.id);
    if (!refreshed) {
      setAssistantReport(null);
      return;
    }
    if (refreshed !== assistantReport) {
      setAssistantReport(refreshed);
    }
  }, [reports, assistantReport?.id]);

  useEffect(() => {
    if (!selected?.id) return;
    const refreshed = reports.find(report => report.id === selected.id);
    if (!refreshed) {
      setSelected(null);
      return;
    }
    if (refreshed !== selected) {
      setSelected(refreshed);
    }
  }, [reports, selected?.id]);

  const loadAssistant = useCallback(async (reportOverride = assistantReport) => {
    setAssistantLoading(true);
    setAssistantError(null);

    try {
      const data = await getAssistantGuidance(
        reportOverride
          ? {
              mode: 'report_guidance',
              report: reportOverride,
            }
          : {
              mode: 'dashboard_overview',
              reports: tableRows,
              filters: {
                status: filterSt,
                severity: filterSev,
                search,
              },
            }
      );

      setAssistantData(data);
    } catch (error) {
      setAssistantError(error.message);
    } finally {
      setAssistantLoading(false);
    }
  }, [assistantReport, tableRows, filterSt, filterSev, search]);

  useEffect(() => {
    if (loading) return;
    loadAssistant();
  }, [loading, loadAssistant]);

  async function applyAssistantRoute() {
    if (!assistantReport || !assistantData?.recommended_route) return;

    const route = assistantData.recommended_route;
    const patch = route === 'business'
      ? buildBusinessRouteFields()
      : route === 'shared'
        ? buildSharedRouteFields()
        : buildGovernmentRouteFields();

    setAssistantRouteBusy(true);
    try {
      const updated = await updateReport(assistantReport.id, patch);
      setAssistantReport(updated);
      if (selected?.id === updated.id) {
        setSelected(updated);
      }
      await refreshReports();
      await loadAssistant(updated);
    } catch (error) {
      setAssistantError(error.message);
    } finally {
      setAssistantRouteBusy(false);
    }
  }

  function openReportFromAssistant(reportPreview) {
    if (!reportPreview?.id) return;
    const fullReport = reports.find(report => report.id === reportPreview.id);
    if (!fullReport) return;
    setAssistantReport(fullReport);
    setSelected(fullReport);
  }

  const chartData = analyticsOverview?.trend?.length ? analyticsOverview.trend : buildChartData(reports);
  const assistantPanelData = assistantData?.mode === 'dashboard_overview' && analytics.hotspots?.length
    ? { ...assistantData, hotspots: analytics.hotspots }
    : assistantData;
  const controlBoardData = useMemo(() => {
    const buckets = reports
      .map(report => ({ report, meta: buildControlBucket(report) }))
      .sort((left, right) => right.meta.score - left.meta.score);

    const reactionToday = buckets
      .filter(item => item.meta.isReactionToday)
      .slice(0, 4)
      .map(item => ({ report: item.report, reason: item.meta.reasonToday }));

    const stuckShared = buckets
      .filter(item => item.meta.isSharedStuck)
      .slice(0, 4)
      .map(item => ({ report: item.report, reason: item.meta.reasonShared }));

    return { reactionToday, stuckShared };
  }, [reports]);

  const sideNavItems = [
    { id: 'map',   icon: 'map',   label: 'Карта' },
    { id: 'feed',  icon: 'feed',  label: 'Лента' },
    { id: 'chart', icon: 'chart', label: 'Дашборд' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: '#f4f5f7', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 72, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', background: '#fff', borderRight: '1px solid #e8eaed' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
          <Icon n="eye" size={18} color="white" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', alignItems: 'center' }}>
          {sideNavItems.map(item => (
            <button key={item.id} onClick={() => item.id === 'chart' ? setActiveNav('chart') : onTabChange?.(item.id)} title={item.label} style={{ width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeNav === item.id ? 'rgba(99,102,241,0.1)' : 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}>
              <Icon n={item.icon} size={19} color={activeNav === item.id ? '#6366f1' : '#94a3b8'} />
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onLogout} title="Выйти" style={{ width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <Icon n="logout" size={19} color="#94a3b8" />
        </button>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Navbar ── */}
        <header style={{ height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, background: '#fff', borderBottom: '1px solid #e8eaed' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Панель акимата</div>
            {lastUpdated && (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Обновлено: {lastUpdated.toLocaleTimeString('ru-RU')}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 12px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Live</span>
          </div>

          <button onClick={refreshReports} style={{ width: 36, height: 36, borderRadius: 9, background: '#f4f5f7', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon n="refresh" size={15} color="#64748b" />
          </button>

          {/* Gov profile chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fafafa', border: '1px solid #e8eaed', borderRadius: 40, padding: '5px 14px 5px 5px' }}>
            <div style={{ position: 'relative' }}>
              <img
                src={user?.avatar ?? '/ruslan-avatar.jpg'}
                alt="avatar"
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1', display: 'block' }}
                onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              />
              <div style={{ display: 'none', width: 34, height: 34, borderRadius: '50%', background: '#eef2ff', border: '2px solid #6366f1', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>
                {user?.initials ?? 'RB'}
              </div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#22c55e', border: '1.5px solid #fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{user?.name ?? 'Ruslan Berdenov'}</div>
              <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 500 }}>Зам. акима Алматы</div>
            </div>
          </div>
        </header>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 40px' }}>

          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#0f172a' }}>Сегодня</h1>
            <p style={{ margin: '5px 0 0', fontSize: 14, color: '#64748b' }}>
              {total} обращений всего · {newCnt} новых · {inProgCnt} в работе · {resolvedCnt} решено
            </p>
          </div>

          {/* ── Stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
            <StatCard value={total}       label="Всего обращений"  color="#6366f1" icon="chart"  sub="в базе" />
            <StatCard value={newCnt}      label="Новые"           color="#f97316" icon="alert"  sub="ожидают реакции" />
            <StatCard value={inProgCnt}   label="В обработке"     color="#f59e0b" icon="clock"  sub="назначены" />
            <StatCard value={resolvedCnt} label="Решено"          color="#22c55e" icon="check"  sub="закрыто" />
          </div>

          <AkimatAssistantPanel
            data={assistantPanelData}
            loading={assistantLoading}
            error={assistantError}
            focusedReport={assistantReport}
            routeApplying={assistantRouteBusy}
            onRefresh={() => loadAssistant()}
            onApplyRoute={applyAssistantRoute}
            onClearFocus={() => setAssistantReport(null)}
            onOpenReport={openReportFromAssistant}
          />

          <ControlBoard
            reactionToday={controlBoardData.reactionToday}
            stuckShared={controlBoardData.stuckShared}
            onOpen={openReportFromAssistant}
          />

          {/* ── Chart ── */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '20px 20px 12px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Динамика обращений</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>Последние 30 дней</div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[{ color: '#6366f1', label: 'Новые' }, { color: '#22c55e', label: 'Решённые' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fill: '#cbd5e1', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="new"      name="Новые"     stroke="#6366f1" strokeWidth={2} fill="url(#gNew)" dot={false} activeDot={{ r: 4, fill: '#6366f1' }} />
                <Area type="monotone" dataKey="resolved" name="Решённые"  stroke="#22c55e" strokeWidth={2} fill="url(#gRes)" dot={false} activeDot={{ r: 4, fill: '#22c55e' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Analytics Section ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

            {/* By Type Breakdown */}
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '20px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Breakdown по типам</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Распределение кейсов по категориям</div>
              {analytics.typeBreakdown.map(t => (
                <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500, flex: 1 }}>{t.label}</span>
                  <span style={{ fontSize: 12, color: '#64748b', minWidth: 30, textAlign: 'right' }}>{t.total}</span>
                  <div style={{ width: 80, height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ width: `${total > 0 ? (t.total / total) * 100 : 0}%`, height: '100%', background: t.color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, minWidth: 35, textAlign: 'right' }}>
                    {t.resolved}/{t.total}
                  </span>
                </div>
              ))}
              {analytics.typeBreakdown.length === 0 && (
                <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 20 }}>Нет данных</div>
              )}
            </div>

            {/* SLA & Route Analytics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* SLA Card */}
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '20px', flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>SLA Performance</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: analytics.slaPercent >= 70 ? '#22c55e' : analytics.slaPercent >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {analytics.slaPercent}%
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>SLA compliance (72ч)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
                      {analytics.avgResolveHours}<span style={{ fontSize: 14, color: '#94a3b8' }}>ч</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Среднее время закрытия</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                  <div style={{
                    width: `${analytics.slaPercent}%`, height: '100%', borderRadius: 3,
                    background: analytics.slaPercent >= 70 ? '#22c55e' : analytics.slaPercent >= 40 ? '#f59e0b' : '#ef4444',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  {analytics.slaCompliant} из {analytics.resolvedCount} закрыты в рамках SLA
                </div>
              </div>

              {/* Route Distribution */}
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '20px', flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Маршрутизация</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { label: 'Акимат', count: analytics.govRoute, color: '#6366f1', bg: '#eef2ff' },
                    { label: 'Shared', count: analytics.sharedCnt, color: '#a16207', bg: '#fef3c7' },
                    { label: 'Подрядчик', count: analytics.busRoute, color: '#0f766e', bg: '#ccfbf1' },
                  ].map(r => (
                    <div key={r.label} style={{
                      flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 12,
                      background: r.bg, border: `1px solid ${r.color}25`,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: r.color }}>{r.count}</div>
                      <div style={{ fontSize: 11, color: r.color, fontWeight: 600, marginTop: 2 }}>{r.label}</div>
                    </div>
                  ))}
                </div>
                {analytics.waitingPartner > 0 && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 8,
                    background: '#fef2f2', border: '1px solid #fecaca',
                    fontSize: 12, color: '#dc2626', fontWeight: 600,
                  }}>
                    {analytics.waitingPartner} кейсов ждут ответа партнёра
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Table ── */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, overflow: 'hidden' }}>
            {/* Table header + filters */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Единый реестр обращений</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{tableRows.length} из {reports.length}</div>
                </div>

                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <input
                    placeholder="Поиск по типу, адресу..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: 30, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: 200, fontFamily: 'inherit', outline: 'none', color: '#0f172a' }}
                  />
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {/* Status */}
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'new', label: 'Новые' },
                  { id: 'in_progress', label: 'В работе' },
                  { id: 'resolved', label: 'Решено' },
                  { id: 'rejected', label: 'Отклонён' },
                ].map(s => (
                  <button key={s.id} onClick={() => setFilterSt(s.id)} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: filterSt === s.id ? (ST_BG[s.id] ?? 'rgba(99,102,241,0.08)') : 'transparent',
                    color: filterSt === s.id ? (ST_COLOR[s.id] ?? '#6366f1') : '#94a3b8',
                    border: filterSt === s.id ? `1px solid ${ST_COLOR[s.id] ?? '#6366f1'}50` : '1px solid transparent',
                  }}>
                    {s.label}
                  </button>
                ))}
                <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
                {/* Severity */}
                {[
                  { id: 'all', label: 'Все приоритеты' },
                  { id: 'КРИТИЧНО', label: 'Критично' },
                  { id: 'ВЫСОКО',   label: 'Высокий' },
                  { id: 'СРЕДНЕ',   label: 'Средний' },
                  { id: 'НИЗКО',    label: 'Низкий' },
                ].map(s => (
                  <button key={s.id} onClick={() => setFilterSev(s.id)} style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: filterSev === s.id ? (SEV_BG[s.id] ?? 'rgba(99,102,241,0.08)') : 'transparent',
                    color: filterSev === s.id ? (SEV_COLOR[s.id] ?? '#6366f1') : '#94a3b8',
                    border: filterSev === s.id ? `1px solid ${SEV_COLOR[s.id] ?? '#6366f1'}50` : '1px solid transparent',
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading */}
            {loading ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                Загружаем данные...
              </div>
            ) : tableRows.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                {search || filterSev !== 'all' || filterSt !== 'all' ? 'Ничего не найдено по фильтрам' : 'Обращений пока нет'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {['Фото', 'Тип / Адрес', 'Приоритет', 'Статус', 'Контур', 'Время', 'Источник', 'Действие'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, i) => {
                      const next      = NEXT[r.status];
                      const sevColor  = SEV_COLOR[r.severity] ?? '#94a3b8';
                      const sevLabel  = SEV_LABEL[r.severity] ?? r.severity ?? '—';
                      const isLast    = i === tableRows.length - 1;
                      const responsibility = getResponsibleRole(r);
                      const routeStyle = RESPONSIBILITY_STYLE[responsibility];
                      const assignedOrg = getAssignedOrgName(r);

                      return (
                        <tr
                          key={r.id}
                          onClick={() => { setAssistantReport(r); setSelected(r); }}
                          style={{ borderBottom: isLast ? 'none' : '1px solid #f8fafc', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Photo */}
                          <td style={{ padding: '10px 14px' }}>
                            {(r.image_url || r.image) ? (
                              <img src={r.image_url || r.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid #e8eaed', display: 'block' }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f4f5f7', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon n="photo" size={14} color="#94a3b8" />
                              </div>
                            )}
                          </td>

                          {/* Type + Address */}
                          <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                              {r.detected_issue_title || r.type || '—'}
                            </div>
                            {r.address && (
                              <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <Icon n="pin" size={10} color="#94a3b8" />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.address}</span>
                              </div>
                            )}
                            {r.confidence_label && (
                              <div style={{ marginTop: 5, fontSize: 11, color: '#6366f1', fontWeight: 700 }}>
                                AI {String(r.confidence_label).toUpperCase()} · {r.priority_score ?? 0}/100
                              </div>
                            )}
                          </td>

                          {/* Severity */}
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: SEV_BG[r.severity] ?? '#f1f5f9', color: sevColor, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {sevLabel}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: ST_BG[r.status] ?? '#f1f5f9', color: ST_COLOR[r.status] ?? '#94a3b8', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {ST_LABEL[r.status] ?? r.status}
                            </span>
                          </td>

                          {/* Responsibility */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content', background: routeStyle.bg, color: routeStyle.color, border: `1px solid ${routeStyle.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {RESPONSIBILITY_LABEL[responsibility]}
                              </span>
                              {assignedOrg && (
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>{assignedOrg}</span>
                              )}
                            </div>
                          </td>

                          {/* Time */}
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Icon n="clock" size={11} color="#94a3b8" />
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgo(r.created_at)}</span>
                            </div>
                          </td>

                          {/* User */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 12, color: '#64748b' }}>{getReporterName(r)}</span>
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>{REPORTER_ROLE_LABEL[getReporterRole(r)]}</span>
                            </div>
                          </td>

                          {/* Quick action */}
                          <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                            {next && (
                              <QuickAction reportId={r.id} current={r.status} next={next} onDone={refreshReports} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Districts (computed from real data) ── */}
          {(() => {
            const districts = analyticsOverview?.districtBreakdown ?? analyticsOverview?.district_breakdown ?? computeDistricts(reports);
            if (districts.length === 0) return null;
            return (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '20px 24px', marginTop: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>Рейтинг районов</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>Эффективность устранения (% решённых от общего)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 40px' }}>
                  {districts.map((district, i) => {
                    const name = district.name ?? district.district;
                    const totalCases = district.total ?? 0;
                    const score = district.score ?? 0;
                    const color = score >= 80 ? '#22c55e' : score >= 55 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: '#64748b' }}>{name} <span style={{ fontSize: 10, color: '#cbd5e1' }}>({totalCases})</span></span>
                          <span style={{ fontSize: 11, fontWeight: 700, color }}>{score}%</span>
                        </div>
                        <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 4, transition: `width ${0.8 + i * 0.06}s ease` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      {/* ── Modal ── */}
      {selected && (
        <ReportModal
          report={selected}
          user={user}
          onClose={() => setSelected(null)}
          onStatusChange={() => { refreshReports(); setSelected(null); }}
          onRefresh={refreshReports}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

/* ── Quick action button (inline) ── */
function QuickAction({ reportId, current, next, onDone }) {
  const [busy, setBusy] = useState(false);
  const label = NEXT_LABEL[current];
  const color = next === 'resolved' ? '#22c55e' : '#6366f1';

  async function handle() {
    setBusy(true);
    await updateStatus(reportId, next);
    onDone();
    setBusy(false);
  }

  return (
    <button
      disabled={busy}
      onClick={handle}
      style={{
        background: `${color}10`, color,
        border: `1px solid ${color}30`,
        borderRadius: 8, padding: '5px 10px',
        fontSize: 11, fontWeight: 700,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {busy ? '...' : label}
    </button>
  );
}

function RouteButton({ active, label, color, onClick, disabled, recommended = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: active ? `${color}16` : recommended ? `${color}08` : '#fff',
        color,
        border: `1px solid ${active ? `${color}55` : recommended ? `${color}40` : '#e5e7eb'}`,
        borderRadius: 10,
        padding: '9px 14px',
        fontSize: 12,
        fontWeight: 700,
        boxShadow: recommended ? `0 0 0 3px ${color}12` : 'none',
      }}
    >
      {label}{recommended ? ' · AI' : ''}
    </button>
  );
}
