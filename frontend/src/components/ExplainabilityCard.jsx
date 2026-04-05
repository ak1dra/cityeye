/**
 * ExplainabilityCard – visual breakdown of WHY the AI made its decision.
 */

const ROUTE_LABELS = {
  government: 'Акимат',
  business: 'Подрядчик',
  shared: 'Совместный',
};

function FactorRow({ name, present, weight }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${present ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
          {present ? '\u2713' : '\u2014'}
        </span>
        <span className={`text-[13px] font-medium ${present ? 'text-slate-900' : 'text-slate-400'}`}>
          {name}
        </span>
      </div>
      <span className={`text-xs font-bold min-w-[45px] text-right ${present ? 'text-green-600' : 'text-slate-300'}`}>
        {present ? `+${weight}%` : '0%'}
      </span>
    </div>
  );
}

function PipelineStep({ step }) {
  const icons = {
    input_ocr: '\uD83D\uDCF7',
    classify: '\uD83E\uDDE0',
    embed: '\uD83D\uDD17',
    dedup: '\uD83D\uDD0D',
    route: '\u2192',
    score: '\uD83C\uDFAF',
    explain: '\uD83D\uDCA1',
    total: '\u23F1',
  };

  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <span className="w-5 text-center">{icons[step.step] || '\u25CF'}</span>
      <span className="text-slate-600 flex-1 font-medium">{step.step}</span>
      {step.result && (
        <span className="text-indigo-500 font-semibold text-[11px]">{step.result}</span>
      )}
      {step.latency_ms != null && (
        <span className="text-slate-400 text-[11px] min-w-[50px] text-right">{step.latency_ms}ms</span>
      )}
    </div>
  );
}

export function ExplainabilityCard({ explainability, pipelineTrace }) {
  if (!explainability) return null;

  const {
    confidence_score = 0,
    confidence_factors = [],
    priority_factors = [],
    routing_reasoning = '',
    rule_route = '',
    ai_route = '',
    ai_rule_agreement = false,
    rag_used = false,
    similar_count = 0,
    ocr_text = null,
  } = explainability;

  const confidenceColor = confidence_score >= 70 ? 'text-green-600' : confidence_score >= 40 ? 'text-blue-600' : 'text-amber-500';
  const confidenceBg = confidence_score >= 70 ? 'bg-green-50 border-green-200' : confidence_score >= 40 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200';

  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-4 mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <div className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider mb-0.5">
            AI Explainability
          </div>
          <div className="text-sm font-bold text-slate-900">Почему AI решил так</div>
        </div>
        <div className={`${confidenceBg} border-[1.5px] rounded-[10px] px-3 py-1.5 text-lg font-extrabold ${confidenceColor}`}>
          {confidence_score}%
        </div>
      </div>

      {/* Confidence factors */}
      <div className="mb-3.5">
        {confidence_factors.map((f, i) => (
          <FactorRow key={i} name={f.name} present={f.present} weight={f.weight} />
        ))}
        <div className="flex justify-between items-center pt-2 mt-1 border-t-2 border-slate-200">
          <span className="text-[13px] font-bold text-slate-900">Итоговая уверенность</span>
          <span className={`text-sm font-extrabold ${confidenceColor}`}>{confidence_score}%</span>
        </div>
      </div>

      {/* Route agreement */}
      <div className={`rounded-[10px] px-3 py-2.5 mb-3 text-[13px] ${ai_rule_agreement ? 'bg-green-50 border border-green-300' : 'bg-amber-50 border border-amber-300'}`}>
        <div className="font-bold text-slate-900 mb-1">
          {ai_rule_agreement ? '\u2713 AI и правила согласны' : '\u26A0 AI и правила расходятся'}
        </div>
        <div className="text-slate-600 leading-relaxed">
          AI маршрут: <strong>{ROUTE_LABELS[ai_route] || ai_route}</strong>
          {' \u00B7 '}
          Правила: <strong>{ROUTE_LABELS[rule_route] || rule_route}</strong>
          {routing_reasoning && (
            <div className="mt-1 italic text-slate-500">{routing_reasoning}</div>
          )}
        </div>
      </div>

      {/* RAG indicator */}
      {rag_used && (
        <div className="bg-green-50 border border-green-300 rounded-[10px] px-3 py-2 mb-3 text-xs text-green-800 font-semibold flex items-center gap-1.5">
          <span className="text-sm">&#128218;</span>
          Маршрутизация усилена через RAG (Knowledge Base акимата)
        </div>
      )}

      {/* Duplicate signal */}
      {similar_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 mb-3 text-xs text-red-600 font-semibold">
          \u26A0 Найдено {similar_count} похожих кейсов в радиусе 200м — возможный дубликат
        </div>
      )}

      {/* OCR result */}
      {ocr_text && (
        <div className="bg-slate-50 border border-slate-200 rounded-[10px] px-3 py-2 mb-3 text-xs">
          <div className="font-bold text-slate-500 mb-1 text-[10px] uppercase tracking-wide">OCR с фото</div>
          <div className="text-slate-900 leading-relaxed">
            {ocr_text.slice(0, 200)}{ocr_text.length > 200 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Priority factors */}
      {priority_factors.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Факторы приоритета</div>
          <div className="flex gap-1.5 flex-wrap">
            {priority_factors.map((f, i) => (
              <div key={i} className={`rounded-lg px-2 py-1 text-[11px] border ${f.contribution > 0.1 ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-slate-500">{f.name}</span>
                <span className="text-indigo-500 font-bold ml-1">{(f.contribution * 100).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline trace */}
      {pipelineTrace && pipelineTrace.length > 0 && (
        <div>
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">AI Pipeline Trace</div>
          <div className="bg-slate-50 rounded-[10px] px-3 py-2 border border-slate-200">
            {pipelineTrace.map((step, i) => (
              <PipelineStep key={i} step={step} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
