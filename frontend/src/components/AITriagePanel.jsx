import { getAIDossier } from '../lib/aiTriage';
import { ExplainabilityCard } from './ExplainabilityCard';

function MetaCell({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[13px] font-semibold text-slate-900 leading-relaxed">{value}</div>
    </div>
  );
}

function Pill({ tone, children }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
      style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
    >
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
    ? 'from-orange-500 to-red-600'
    : dossier.priorityScore >= 55
      ? 'from-amber-400 to-orange-500'
      : 'from-blue-500 to-green-500';

  return (
    <div className={`bg-gradient-to-br from-slate-50 to-indigo-50 border border-indigo-300 ${compact ? 'rounded-[14px] p-3.5 mb-3' : 'rounded-2xl p-[18px] mb-4'}`}>
      {showHeader && (
        <div className="flex items-start justify-between gap-2.5 mb-3 flex-wrap">
          <div>
            <div className="text-[11px] text-indigo-500 font-extrabold uppercase tracking-wider mb-1">{title}</div>
            <div className={`font-extrabold text-slate-900 leading-tight ${compact ? 'text-[15px]' : 'text-lg'}`}>
              {dossier.diagnosisTitle}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Pill tone={dossier.severity}>{dossier.severity.label}</Pill>
            <Pill tone={dossier.confidence}>{dossier.confidence.shortLabel}</Pill>
            <Pill tone={dossier.suggestedRole}>{dossier.suggestedRole.shortLabel}</Pill>
          </div>
        </div>
      )}

      {/* Priority bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Срочность AI-triage</span>
          <span className="text-xs text-slate-900 font-bold">{dossier.priorityScore}/100</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200/40 overflow-hidden">
          <div className={`h-full bg-gradient-to-r ${urgencyGradient} rounded-full`} style={{ width: `${dossier.priorityScore}%` }} />
        </div>
      </div>

      {/* AI Comment */}
      {dossier.aiComment && (
        <div className={`bg-white border border-blue-100 rounded-xl mb-3 text-slate-600 leading-relaxed ${compact ? 'px-3 py-2.5 text-[13px]' : 'px-3.5 py-3 text-sm'}`}>
          {dossier.aiComment}
        </div>
      )}

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {compact ? (
          <>
            <MetaCell label="AI маршрут" value={dossier.suggestedRole.label} />
            <MetaCell label="Департамент" value={dossier.responsibleDept || 'Требует уточнения'} />
            <MetaCell label="Риск" value={dossier.riskFor || 'Нужна выездная проверка'} />
            <MetaCell label="Действие" value={dossier.recommendedAction || 'Назначить исполнителя и выезд'} />
          </>
        ) : (
          <>
            <MetaCell label="AI маршрут" value={dossier.suggestedRole.label} />
            <MetaCell label="Ожидаемый срок" value={dossier.estimatedFixTime || 'Требует уточнения'} />
            <MetaCell label="Риск" value={dossier.riskFor || 'Нужна дополнительная проверка'} />
            <MetaCell label="Ответственный" value={dossier.responsibleDept || 'Определяется при triage'} />
            <MetaCell label="План действий" value={dossier.recommendedAction || 'Назначить исполнителя и провести осмотр'} />
            <MetaCell label="Повтор" value={dossier.duplicateLikely ? 'Вероятно дублируется' : 'Новый кейс'} />
          </>
        )}
      </div>

      {/* Explainability */}
      {data?.explainability && (
        <ExplainabilityCard explainability={data.explainability} pipelineTrace={data.ai_pipeline_trace} />
      )}
    </div>
  );
}
