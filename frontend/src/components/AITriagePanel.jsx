import { getAIDossier } from '../lib/aiTriage';

function MetaCell({ label, value }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>
        {value}
      </div>
    </div>
  );
}

function Pill({ tone, children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      borderRadius: 999,
      background: tone.bg,
      color: tone.color,
      border: `1px solid ${tone.border}`,
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

export function AITriagePanel({
  data,
  title = 'AI-досье кейса',
  compact = false,
  showHeader = true,
}) {
  const dossier = getAIDossier(data);

  if (!dossier.hasTriage) return null;

  const urgencyGradient = dossier.priorityScore >= 80
    ? 'linear-gradient(90deg, #f97316 0%, #dc2626 100%)'
    : dossier.priorityScore >= 55
      ? 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)'
      : 'linear-gradient(90deg, #2563eb 0%, #22c55e 100%)';

  return (
    <div style={{
      background: compact ? 'linear-gradient(135deg,#f8fbff,#eef4ff)' : 'linear-gradient(135deg,#f9fbff,#eef2ff)',
      border: '1px solid #c7d2fe',
      borderRadius: compact ? 14 : 16,
      padding: compact ? 14 : 18,
      marginBottom: compact ? 12 : 16,
    }}>
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
              {title}
            </div>
            <div style={{ fontSize: compact ? 15 : 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
              {dossier.diagnosisTitle}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill tone={dossier.severity}>{dossier.severity.label}</Pill>
            <Pill tone={dossier.confidence}>{dossier.confidence.shortLabel}</Pill>
            <Pill tone={dossier.suggestedRole}>{dossier.suggestedRole.shortLabel}</Pill>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            Срочность AI-triage
          </span>
          <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 700 }}>
            {dossier.priorityScore}/100
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.15)', overflow: 'hidden' }}>
          <div style={{
            width: `${dossier.priorityScore}%`,
            height: '100%',
            background: urgencyGradient,
            borderRadius: 999,
          }} />
        </div>
      </div>

      {dossier.aiComment && (
        <div style={{
          padding: compact ? '10px 12px' : '12px 14px',
          borderRadius: 12,
          background: '#fff',
          border: '1px solid #dbeafe',
          marginBottom: 12,
          fontSize: compact ? 13 : 14,
          color: '#475569',
          lineHeight: 1.65,
        }}>
          {dossier.aiComment}
        </div>
      )}

      {compact ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <MetaCell label="AI маршрут" value={dossier.suggestedRole.label} />
          <MetaCell label="Департамент" value={dossier.responsibleDept || 'Требует уточнения'} />
          <MetaCell label="Риск" value={dossier.riskFor || 'Нужна выездная проверка'} />
          <MetaCell label="Действие" value={dossier.recommendedAction || 'Назначить исполнителя и выезд'} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <MetaCell label="AI маршрут" value={dossier.suggestedRole.label} />
          <MetaCell label="Ожидаемый срок" value={dossier.estimatedFixTime || 'Требует уточнения'} />
          <MetaCell label="Риск" value={dossier.riskFor || 'Нужна дополнительная проверка'} />
          <MetaCell label="Ответственный" value={dossier.responsibleDept || 'Определяется при triage'} />
          <MetaCell label="План действий" value={dossier.recommendedAction || 'Назначить исполнителя и провести осмотр'} />
          <MetaCell label="Повтор" value={dossier.duplicateLikely ? 'Вероятно дублируется' : 'Новый кейс'} />
        </div>
      )}
    </div>
  );
}
