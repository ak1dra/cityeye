import { useRef, useState } from 'react';
import { Building2, Camera, CheckCircle2, CircleAlert, LogOut, Map, Newspaper, RefreshCw, Wrench } from 'lucide-react';
import { AITriagePanel } from '../components/AITriagePanel';
import { CollaborationTimeline, PartnerCommentBox } from '../components/CollaborationWidgets';
import { GlassCard, GlassPanel } from '../components/GlassPanel';
import { supabase } from '../lib/supabase';
import { updateReport, updateStatus } from '../api';
import {
  buildPartnerCommentEntry,
  buildSharedRouteFields,
  getAssignedOrgName,
  getReporterName,
  getReporterRole,
  getResponsibleRole,
  isSharedCase,
  isVisibleToBusiness,
  REPORTER_ROLE_LABEL,
  RESPONSIBILITY_LABEL,
  RESPONSIBILITY_STYLE,
} from '../lib/reportCollaboration';

const CATEGORY_LABEL = {
  road: 'Дороги',
  light: 'Освещение',
  lighting: 'Освещение',
  trash: 'Мусор',
  waste: 'Мусор',
  greenery: 'Озеленение',
  utilities: 'Коммуникации',
  vandal: 'Вандализм',
  parking: 'Парковка',
  other: 'Другое',
};

const STATUS_META = {
  new: { label: 'Новый', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  in_progress: { label: 'В работе', color: '#d97706', bg: '#fff7ed', border: '#fed7aa' },
  resolved: { label: 'Решено', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  rejected: { label: 'Отклонён', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
};

const SEVERITY_META = {
  critical: { label: 'Критично', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  high: { label: 'Высокий', color: '#d97706', bg: '#fff7ed', border: '#fed7aa' },
  medium: { label: 'Средний', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  low: { label: 'Низкий', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  КРИТИЧНО: { label: 'Критично', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  ВЫСОКО: { label: 'Высокий', color: '#d97706', bg: '#fff7ed', border: '#fed7aa' },
  СРЕДНЕ: { label: 'Средний', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  НИЗКО: { label: 'Низкий', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
};

const NAV_ITEMS = [
  { id: 'map', label: 'Карта', icon: Map },
  { id: 'feed', label: 'Лента', icon: Newspaper },
  { id: 'report', label: 'Репорт', icon: Camera },
  { id: 'business', label: 'Бизнес', icon: Building2 },
];

export default function BusinessDashboard({ reports = [], user, onTabChange, onLogout, onStatusChange }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [completionFiles, setCompletionFiles] = useState({});
  const [completionPreviews, setCompletionPreviews] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});

  const fileInputs = useRef({});

  if (user?.role !== 'business') {
    return (
      <AccessDenied onBack={() => onTabChange?.('map')} />
    );
  }

  const ownReports = [...reports]
    .filter(report => isVisibleToBusiness(report, user))
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  const filteredReports = ownReports.filter(report => {
    const statusMatch = filterStatus === 'all' || report.status === filterStatus;
    const severityMatch = filterSeverity === 'all' || report.severity === filterSeverity;
    return statusMatch && severityMatch;
  });

  const stats = {
    total: ownReports.length,
    new: ownReports.filter(report => report.status === 'new').length,
    inProgress: ownReports.filter(report => report.status === 'in_progress').length,
    resolved: ownReports.filter(report => report.status === 'resolved').length,
  };
  const sharedCount = ownReports.filter(report => isSharedCase(report)).length;

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

  async function moveToWork(reportId) {
    setBusyId(reportId);
    setError(null);
    try {
      await updateStatus(reportId, 'in_progress');
      await onStatusChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function resolveReport(report) {
    const completionFile = completionFiles[report.id];
    const existingCompletionImage = report.completion_image_url ?? null;

    if (!completionFile && !existingCompletionImage) {
      setError('Для завершения заявки сначала загрузите фото результата.');
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
      });
      clearCompletionDraft(report.id);
      await onStatusChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function enableSharedWork(reportId) {
    setBusyId(reportId);
    setError(null);
    try {
      await updateReport(reportId, buildSharedRouteFields(user.name));
      await onStatusChange?.();
    } catch (err) {
      setError(err.message);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: '#f4f7f6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <aside style={{ width: 76, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', background: '#fff', borderRight: '1px solid #e2e8e0' }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, boxShadow: '0 8px 20px rgba(15,118,110,0.24)' }}>
          <Building2 size={18} color="#fff" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: 'center' }}>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = item.id === 'business';
            return (
              <button
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                title={item.label}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: active ? 'rgba(15,118,110,0.1)' : 'transparent',
                  border: 'none',
                  color: active ? '#0f766e' : '#94a3b8',
                }}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={onLogout} title="Выйти" style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#94a3b8' }}>
          <LogOut size={18} />
        </button>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: 72, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', background: 'rgba(255,255,255,0.92)', borderBottom: '1px solid #e2e8e0', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Кабинет частного сектора</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Свои и совместные заявки с акиматом · {sharedCount} совместных кейсов</div>
          </div>

          <div style={{ flex: 1 }} />

          <button onClick={() => onStatusChange?.()} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #d5dfdb', background: '#f8faf9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f766e' }}>
            <RefreshCw size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px 6px 6px', borderRadius: 999, border: '1px solid rgba(15,118,110,0.14)', background: 'rgba(15,118,110,0.05)' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#ccfbf1', border: '2px solid #14b8a6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f766e', fontSize: 13, fontWeight: 700 }}>
              {user.initials}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: '#0f766e', fontWeight: 600 }}>{user.position}</div>
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 36px' }}>
          {error && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', padding: '12px 14px' }}>
              <CircleAlert size={16} />
              <span style={{ fontSize: 14 }}>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 20 }}>
            <MetricCard title="Всего" value={stats.total} tone="neutral" />
            <MetricCard title="Новые" value={stats.new} tone="new" />
            <MetricCard title="В работе" value={stats.inProgress} tone="work" />
            <MetricCard title="Решены" value={stats.resolved} tone="done" />
          </div>

          <GlassPanel style={{ padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Статус</div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">Все статусы</option>
                  <option value="new">Новые</option>
                  <option value="in_progress">В работе</option>
                  <option value="resolved">Решены</option>
                  <option value="rejected">Отклонены</option>
                </select>
              </div>

              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Приоритет</div>
                <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                  <option value="all">Все приоритеты</option>
                  <option value="critical">Критично</option>
                  <option value="high">Высокий</option>
                  <option value="medium">Средний</option>
                  <option value="low">Низкий</option>
                  <option value="КРИТИЧНО">Критично (legacy)</option>
                  <option value="ВЫСОКО">Высокий (legacy)</option>
                  <option value="СРЕДНЕ">Средний (legacy)</option>
                  <option value="НИЗКО">Низкий (legacy)</option>
                </select>
              </div>

              <div style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
                {filteredReports.length} из {ownReports.length} заявок
              </div>
            </div>
          </GlassPanel>

          {filteredReports.length === 0 ? (
            <GlassPanel style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(15,118,110,0.08)', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Wrench size={28} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Заявок пока нет</div>
              <div style={{ marginTop: 6, fontSize: 14, color: '#64748b' }}>
                Здесь появятся заявки вашей компании и обращения, которые акимат передал в совместную работу.
              </div>
            </GlassPanel>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {filteredReports.map((report, index) => (
                <ReportCard
                  key={report.id}
                  delay={index * 0.03}
                  report={report}
                  draftPreview={completionPreviews[report.id]}
                  busy={busyId === report.id}
                  onPickFile={event => handleCompletionFileChange(report.id, event)}
                  onMoveToWork={() => moveToWork(report.id)}
                  onResolve={() => resolveReport(report)}
                  onEnableShared={() => enableSharedWork(report.id)}
                  commentDraft={commentDrafts[report.id] ?? ''}
                  onCommentChange={value => setCommentDrafts(prev => ({ ...prev, [report.id]: value }))}
                  onSaveComment={() => savePartnerComment(report)}
                  registerInput={node => { fileInputs.current[report.id] = node; }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ onBack }) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f4f7f6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: 68, height: 68, borderRadius: 20, background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
        <CircleAlert size={30} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Доступ только для частного сектора</div>
      <div style={{ maxWidth: 360, textAlign: 'center', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
        Войдите под business-аккаунтом управляющей компании, чтобы просматривать и закрывать только свои заявки.
      </div>
      <button onClick={onBack} style={{ padding: '10px 22px', borderRadius: 10, background: '#0f766e', color: '#fff', fontSize: 14, fontWeight: 600 }}>
        Вернуться на карту
      </button>
    </div>
  );
}

function MetricCard({ title, value, tone }) {
  const palette = {
    neutral: { color: '#0f172a', bg: '#ffffff', border: '#e2e8e0' },
    new: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    work: { color: '#d97706', bg: '#fff7ed', border: '#fed7aa' },
    done: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  }[tone];

  return (
    <GlassCard style={{ padding: 16, background: palette.bg, border: `1px solid ${palette.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: palette.color }}>{value}</div>
    </GlassCard>
  );
}

function ReportCard({
  report,
  delay,
  draftPreview,
  busy,
  onPickFile,
  onMoveToWork,
  onResolve,
  onEnableShared,
  commentDraft,
  onCommentChange,
  onSaveComment,
  registerInput,
}) {
  const status = STATUS_META[report.status] ?? STATUS_META.new;
  const severity = SEVERITY_META[report.severity] ?? { label: report.severity ?? '—', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  const originalImage = report.image_url ?? report.image ?? null;
  const completionImage = draftPreview ?? report.completion_image_url ?? null;
  const canResolve = Boolean(completionImage);
  const responsibility = getResponsibleRole(report);
  const responsibilityStyle = RESPONSIBILITY_STYLE[responsibility];
  const reporterRole = getReporterRole(report);
  const assignedOrg = getAssignedOrgName(report);

  return (
    <GlassPanel delay={delay} style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            {report.detected_issue_title ?? CATEGORY_LABEL[report.type] ?? report.type ?? 'Заявка'}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            {report.address || 'Адрес не указан'} · {new Date(report.created_at ?? Date.now()).toLocaleString('ru-RU')}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge tone={severity}>{severity.label}</Badge>
          <Badge tone={status}>{status.label}</Badge>
          <Badge tone={responsibilityStyle}>{RESPONSIBILITY_LABEL[responsibility]}</Badge>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <MetaPill label={`Создал: ${REPORTER_ROLE_LABEL[reporterRole]}`} value={getReporterName(report)} />
        {assignedOrg && <MetaPill label="Назначено" value={assignedOrg} />}
      </div>

      <AITriagePanel data={report} compact title="AI reason for routing" />

      {isSharedCase(report) && (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontSize: 13, fontWeight: 600 }}>
          Совместный кейс: заявка одновременно находится в поле зрения акимата и частного сектора.
        </div>
      )}

      <CollaborationTimeline report={report} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
        <ImageCard title="Исходное фото" image={originalImage} emptyLabel="Фото обращения отсутствует" />
        <ImageCard title="Фото результата" image={completionImage} emptyLabel="Загрузите фото после устранения" />
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {report.status === 'new' && (
          <button onClick={onMoveToWork} disabled={busy} style={{ background: '#0f766e', color: '#fff', padding: '10px 16px', borderRadius: 10, fontWeight: 600 }}>
            {busy ? 'Обновляем...' : 'В работу'}
          </button>
        )}

        {report.status === 'in_progress' && (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#f8faf9', border: '1px solid #d5dfdb', color: '#0f766e', fontSize: 13, fontWeight: 600 }}>
              <Camera size={15} />
              {completionImage ? 'Заменить фото результата' : 'Загрузить фото результата'}
              <input
                ref={registerInput}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                style={{ display: 'none' }}
              />
            </label>

            <button
              onClick={onResolve}
              disabled={busy || !canResolve}
              style={{ background: canResolve ? '#16a34a' : '#94a3b8', color: '#fff', padding: '10px 16px', borderRadius: 10, fontWeight: 600 }}
            >
              {busy ? 'Сохраняем...' : 'Завершить'}
            </button>

            {responsibility === 'business' && (
              <button
                onClick={onEnableShared}
                disabled={busy}
                style={{ background: '#fef3c7', color: '#a16207', padding: '10px 16px', borderRadius: 10, fontWeight: 700, border: '1px solid #fde68a' }}
              >
                Подключить акимат
              </button>
            )}
          </>
        )}

        {report.status === 'resolved' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 13, fontWeight: 700 }}>
            <CheckCircle2 size={15} />
            Исполнено
          </div>
        )}
      </div>

      {isSharedCase(report) && (
        <PartnerCommentBox
          report={report}
          draft={commentDraft}
          onDraftChange={onCommentChange}
          onSave={onSaveComment}
          busy={busy}
          placeholder="Напишите комментарий для акимата: что уже сделано, что требуется, какие есть ограничения..."
        />
      )}
    </GlassPanel>
  );
}

function MetaPill({ label, value }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: '#f8faf9', border: '1px solid #e2e8e0', color: '#475569', fontSize: 12 }}>
      <span style={{ color: '#94a3b8', fontWeight: 700 }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ImageCard({ title, image, emptyLabel }) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8e0', background: '#fff' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #eef2f1', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
        {title}
      </div>
      {image ? (
        <img src={image} alt={title} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#f8faf9' }}>
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function Badge({ tone, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 12, fontWeight: 700 }}>
      {children}
    </span>
  );
}
