import { useMemo, useState } from 'react';
import { AI_ROUTE_META } from '../lib/aiTriage';

const RISK_META = {
  critical: { label: 'Критичный риск', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  high: { label: 'Высокий риск', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  medium: { label: 'Средний риск', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  low: { label: 'Низкий риск', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
};

const CONFIDENCE_META = {
  high: { label: 'High confidence', color: '#166534', bg: '#dcfce7', border: '#86efac' },
  medium: { label: 'Medium confidence', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  low: { label: 'Low confidence', color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
};

function Badge({ tone, children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
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

function MetaCell({ label, value }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>
        {value || '—'}
      </div>
    </div>
  );
}

export function AkimatAssistantPanel({
  data,
  loading = false,
  error = null,
  focusedReport = null,
  routeApplying = false,
  onRefresh,
  onApplyRoute,
  onClearFocus,
  onOpenReport,
}) {
  const [copied, setCopied] = useState(false);

  const routeTone = useMemo(() => {
    if (!data?.recommended_route) return null;
    return AI_ROUTE_META[data.recommended_route] ?? null;
  }, [data]);

  const riskTone = RISK_META[data?.risk_level] ?? RISK_META.medium;
  const confidenceTone = CONFIDENCE_META[data?.confidence_label] ?? CONFIDENCE_META.medium;
  const assistantSource = data?.source === 'ai' ? 'AI live' : 'Rule-assisted fallback';

  async function copySummary() {
    if (!data) return;

    const lines = [
      'AI-ассистент акимата',
      '',
      data.executive_summary,
      '',
      data.recommended_department ? `Департамент: ${data.recommended_department}` : null,
      data.recommended_route ? `Маршрут: ${AI_ROUTE_META[data.recommended_route]?.label ?? data.recommended_route}` : null,
      data.next_actions?.length ? `Следующие действия: ${data.next_actions.join(' | ')}` : null,
      data.oversight_flags?.length ? `Риски: ${data.oversight_flags.join(' | ')}` : null,
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
            AI-ассистент акимата
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
            {focusedReport ? 'Рекомендация по выбранному кейсу' : 'Обзор operational control'}
          </div>
          <div style={{ marginTop: 5, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            {focusedReport
              ? `Фокус на кейсе: ${focusedReport.detected_issue_title || focusedReport.type || 'без названия'}`
              : 'Агрегированная AI-сводка по текущему контуру заявок'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {focusedReport && (
            <button onClick={onClearFocus} style={secondaryButtonStyle}>
              Показать обзор
            </button>
          )}
          <button onClick={copySummary} disabled={!data} style={secondaryButtonStyle}>
            {copied ? 'Скопировано' : 'Скопировать сводку'}
          </button>
          <button onClick={onRefresh} disabled={loading} style={primaryButtonStyle}>
            {loading ? 'Обновляем...' : 'Обновить AI-анализ'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', padding: '12px 14px', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!error && loading && !data && (
        <div style={{ borderRadius: 14, border: '1px solid #dbeafe', background: '#f8fbff', padding: '16px 18px', color: '#1d4ed8', fontSize: 14, fontWeight: 600 }}>
          AI-ассистент собирает управленческую сводку...
        </div>
      )}

      {!loading && !error && !data && (
        <div style={{ borderRadius: 14, border: '1px solid #e2e8f0', background: '#f8fafc', padding: '16px 18px', color: '#64748b', fontSize: 14 }}>
          Для assistant-summary нужны текущие заявки или выбранный кейс.
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Badge tone={riskTone}>{riskTone.label}</Badge>
            <Badge tone={confidenceTone}>{confidenceTone.label}</Badge>
            {routeTone && <Badge tone={routeTone}>{routeTone.label}</Badge>}
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: 12, fontWeight: 700 }}>
              {data.priority_label}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', fontSize: 12, fontWeight: 700 }}>
              {assistantSource}
            </span>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(135deg,#f8fbff,#eef4ff)', border: '1px solid #c7d2fe', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Executive summary
            </div>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.75 }}>
              {data.executive_summary}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
            <MetaCell label="Рекомендуемый департамент" value={data.recommended_department || 'Не требуется'} />
            <MetaCell label="Рекомендуемый маршрут" value={routeTone?.label || 'Нет маршрута'} />
            <MetaCell label="Причина" value={data.reasoning} />
            <MetaCell label="Confidence" value={confidenceTone.label} />
          </div>

          {focusedReport && routeTone && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={onApplyRoute} disabled={routeApplying} style={primaryButtonStyle}>
                {routeApplying ? 'Применяем...' : 'Применить AI-маршрут'}
              </button>
              <button onClick={() => onOpenReport?.(focusedReport)} style={secondaryButtonStyle}>
                Открыть кейс
              </button>
            </div>
          )}

          {data.next_actions?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                Следующие действия
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {data.next_actions.map(action => (
                  <div key={action} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, color: '#0f172a', lineHeight: 1.6 }}>
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.oversight_flags?.length > 0 && (
            <div style={{ marginBottom: data.spotlight_reports?.length ? 14 : 0 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                Oversight flags
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.oversight_flags.map(flag => (
                  <span key={flag} style={{ display: 'inline-flex', padding: '7px 10px', borderRadius: 999, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 12, fontWeight: 700 }}>
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.spotlight_reports?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                Spotlight cases
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {data.spotlight_reports.map(report => {
                  const spotlightTone = AI_ROUTE_META[report.recommended_route] ?? AI_ROUTE_META.government;
                  return (
                    <div key={report.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', padding: '12px 14px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 220, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                          {report.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                          {report.address} · {report.priority_label}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Badge tone={spotlightTone}>{spotlightTone.shortLabel}</Badge>
                        <button onClick={() => onOpenReport?.(report)} style={secondaryButtonStyle}>
                          Открыть кейс
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const primaryButtonStyle = {
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  background: '#fff',
  color: '#475569',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};
