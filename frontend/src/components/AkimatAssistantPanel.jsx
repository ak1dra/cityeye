import { useMemo, useState } from 'react';
import { AI_ROUTE_META } from '../lib/aiTriage';

const RISK_META = {
  critical: { label: 'Критичный риск', cls: 'bg-red-50 text-red-700 border-red-200' },
  high:     { label: 'Высокий риск',   cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  medium:   { label: 'Средний риск',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  low:      { label: 'Низкий риск',    cls: 'bg-green-50 text-green-700 border-green-200' },
};

const CONFIDENCE_META = {
  high:   { label: 'Высокая уверенность', cls: 'bg-green-100 text-green-800 border-green-300' },
  medium: { label: 'Средняя уверенность', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  low:    { label: 'Низкая уверенность',  cls: 'bg-amber-100 text-amber-800 border-amber-300' },
};

function Badge({ tone, className = '', children }) {
  if (tone?.cls) {
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${tone.cls} ${className}`}>{children}</span>;
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${className}`}
      style={{ background: tone?.bg, color: tone?.color, border: `1px solid ${tone?.border}` }}>
      {children}
    </span>
  );
}

function MetaCell({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[13px] font-semibold text-slate-900 leading-relaxed">{value || '\u2014'}</div>
    </div>
  );
}

export function AkimatAssistantPanel({
  data, loading = false, error = null, focusedReport = null,
  routeApplying = false, onRefresh, onApplyRoute, onClearFocus, onOpenReport,
}) {
  const [copied, setCopied] = useState(false);

  const routeTone = useMemo(() => data?.recommended_route ? (AI_ROUTE_META[data.recommended_route] ?? null) : null, [data]);
  const riskTone = RISK_META[data?.risk_level] ?? RISK_META.medium;
  const confTone = CONFIDENCE_META[data?.confidence_label] ?? CONFIDENCE_META.medium;
  const source = data?.source === 'ai' ? 'Живой AI-режим' : 'Rule-engine fallback';

  async function copySummary() {
    if (!data) return;
    const lines = [
      'AI-ассистент акимата', '', data.executive_summary, '',
      data.recommended_department ? `Департамент: ${data.recommended_department}` : null,
      data.recommended_route ? `Маршрут: ${AI_ROUTE_META[data.recommended_route]?.label ?? data.recommended_route}` : null,
      data.sla_target ? `SLA: ${data.sla_target}` : null,
      data.next_actions?.length ? `Действия: ${data.next_actions.join(' | ')}` : null,
    ].filter(Boolean);
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-[18px] mb-5">
      {/* Header */}
      <div className="flex justify-between gap-3.5 items-start mb-3.5 flex-wrap">
        <div>
          <div className="text-[11px] text-indigo-500 font-extrabold uppercase tracking-wider mb-1">AI-ассистент акимата</div>
          <div className="text-lg font-extrabold text-slate-900 leading-tight">
            {focusedReport ? 'Рекомендация по выбранному кейсу' : 'Обзор оперативного контроля'}
          </div>
          <div className="mt-1 text-xs text-slate-500 leading-relaxed">
            {focusedReport
              ? `Фокус: ${focusedReport.detected_issue_title || focusedReport.type || 'кейс'}`
              : 'Агрегированная AI-сводка по текущему контуру заявок'}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {focusedReport && <button onClick={onClearFocus} className="px-3.5 py-2 rounded-[10px] border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">Показать обзор</button>}
          <button onClick={copySummary} disabled={!data} className="px-3.5 py-2 rounded-[10px] border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">{copied ? 'Скопировано' : 'Скопировать'}</button>
          <button onClick={onRefresh} disabled={loading} className="px-3.5 py-2 rounded-[10px] bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600">{loading ? 'Обновляем...' : 'Обновить AI'}</button>
        </div>
      </div>

      {/* States */}
      {error && <div className="mb-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3.5 py-3 text-[13px]">{error}</div>}
      {!error && loading && !data && <div className="rounded-[14px] border border-blue-100 bg-blue-50/40 px-4 py-4 text-blue-700 text-sm font-semibold">AI-ассистент собирает сводку...</div>}
      {!loading && !error && !data && <div className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-4 text-slate-500 text-sm">Нужны заявки или выбранный кейс.</div>}

      {data && (
        <>
          {/* Badges */}
          <div className="flex gap-2 flex-wrap mb-3.5">
            <Badge tone={riskTone}>{riskTone.label}</Badge>
            <Badge tone={confTone}>{confTone.label}</Badge>
            {routeTone && <Badge tone={routeTone}>{routeTone.label}</Badge>}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold">{data.priority_label}</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">{source}</span>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50 border border-indigo-200 rounded-[14px] px-4 py-3.5 mb-3.5">
            <div className="text-sm font-bold text-slate-900 mb-2">Executive summary</div>
            <div className="text-sm text-slate-600 leading-relaxed">{data.executive_summary}</div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            <MetaCell label="Департамент" value={data.recommended_department || 'Не требуется'} />
            <MetaCell label="Маршрут" value={routeTone?.label || 'Нет'} />
            <MetaCell label="Очередь" value={data.department_queue || 'Не задана'} />
            <MetaCell label="Контроль" value={data.control_mode || 'Не задан'} />
            <MetaCell label="SLA" value={data.sla_target || 'Не задан'} />
            <MetaCell label="Эскалация" value={data.escalation_owner || 'Не требуется'} />
            <MetaCell label="Причина" value={data.reasoning} />
            <MetaCell label="Уверенность" value={confTone.label} />
          </div>

          {/* Apply route */}
          {focusedReport && routeTone && (
            <div className="flex gap-2.5 flex-wrap mb-3.5">
              <button onClick={onApplyRoute} disabled={routeApplying} className="px-3.5 py-2 rounded-[10px] bg-indigo-500 text-white text-xs font-bold">{routeApplying ? 'Применяем...' : 'Применить AI-маршрут'}</button>
              <button onClick={() => onOpenReport?.(focusedReport)} className="px-3.5 py-2 rounded-[10px] border border-slate-200 bg-white text-slate-600 text-xs font-bold">Открыть кейс</button>
            </div>
          )}

          {/* Actions */}
          {data.next_actions?.length > 0 && (
            <div className="mb-3.5">
              <div className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider mb-2">Следующие действия</div>
              <div className="grid gap-2">
                {data.next_actions.map(a => (
                  <div key={a} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 leading-relaxed">{a}</div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {data.oversight_flags?.length > 0 && (
            <div className="mb-3.5">
              <div className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider mb-2">Контрольные риски</div>
              <div className="flex gap-2 flex-wrap">
                {data.oversight_flags.map(f => (
                  <span key={f} className="inline-flex px-2.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Hotspots */}
          {data.hotspots?.length > 0 && (
            <div className="mb-3.5">
              <div className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider mb-2">Горячие зоны</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {data.hotspots.map(h => (
                  <div key={`${h.label}-${h.count}`} className="rounded-[14px] border border-slate-200 bg-white px-3.5 py-3">
                    <div className="flex justify-between gap-2 items-start mb-2">
                      <div className="text-sm font-bold text-slate-900 leading-tight">{h.label}</div>
                      <span className="text-xs font-extrabold text-indigo-500 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">{h.count}</span>
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed mb-2">{h.summary}</div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="inline-flex px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold">{h.pressure_label}</span>
                      {h.route_hint && AI_ROUTE_META[h.route_hint] && <Badge tone={AI_ROUTE_META[h.route_hint]}>{AI_ROUTE_META[h.route_hint].shortLabel}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spotlight */}
          {data.spotlight_reports?.length > 0 && (
            <div>
              <div className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider mb-2">Кейсы под контролем</div>
              <div className="grid gap-2.5">
                {data.spotlight_reports.map(r => {
                  const rt = AI_ROUTE_META[r.recommended_route] ?? AI_ROUTE_META.government;
                  return (
                    <div key={r.id} className="flex justify-between gap-3.5 items-center rounded-[14px] border border-slate-200 bg-white px-3.5 py-3 flex-wrap">
                      <div className="min-w-[220px] flex-1">
                        <div className="text-sm font-bold text-slate-900 mb-1">{r.title}</div>
                        <div className="text-xs text-slate-500">{r.address} · {r.priority_label}</div>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Badge tone={rt}>{rt.shortLabel}</Badge>
                        <button onClick={() => onOpenReport?.(r)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">Открыть</button>
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
