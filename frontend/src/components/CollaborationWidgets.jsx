import { getPartnerComment, getReportTimeline } from '../lib/reportCollaboration';

const STEP_CLS = {
  complete: { dot: 'bg-green-100 text-green-700 border-green-300', title: 'text-green-800', caption: 'text-green-600', line: 'bg-green-300' },
  current:  { dot: 'bg-indigo-50 text-indigo-700 border-indigo-300', title: 'text-indigo-700', caption: 'text-indigo-400', line: 'bg-indigo-200' },
  upcoming: { dot: 'bg-slate-50 text-slate-400 border-slate-200', title: 'text-slate-500', caption: 'text-slate-400', line: 'bg-slate-200' },
};

export function CollaborationTimeline({ report, title = 'Ход заявки' }) {
  const steps = getReportTimeline(report);

  return (
    <div className="mb-3.5">
      <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2.5">{title}</div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, i) => {
          const t = STEP_CLS[step.state] || STEP_CLS.upcoming;
          return (
            <div key={step.id} className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-extrabold shrink-0 ${t.dot}`}>
                  {step.state === 'complete' ? '\u2713' : i + 1}
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 flex-1 rounded-full ${t.line}`} />}
              </div>
              <div className={`text-xs font-bold mb-1 leading-tight ${t.title}`}>{step.label}</div>
              <div className={`text-[11px] leading-snug ${t.caption}`}>{step.caption}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PartnerCommentBox({ report, draft, onDraftChange, onSave, busy = false, placeholder = 'Напишите комментарий для второй стороны...' }) {
  const comment = getPartnerComment(report);
  const canSave = draft.trim().length > 0;

  return (
    <div className="mt-3.5 rounded-[14px] border border-blue-100 bg-blue-50/30 p-3.5">
      <div className="text-[11px] text-blue-600 font-bold uppercase tracking-wider mb-2.5">
        Координационный комментарий
      </div>

      <div className={`rounded-xl border border-blue-100 bg-white px-3.5 py-3 min-h-[76px] mb-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${comment ? 'text-slate-700' : 'text-slate-400'}`}>
        {comment || 'Комментарий между акиматом и подрядчиком ещё не добавлен.'}
      </div>

      <textarea
        rows={3}
        value={draft}
        onChange={e => onDraftChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-2.5"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-slate-500">Сообщение увидят обе стороны совместной заявки.</span>
        <button
          onClick={onSave}
          disabled={busy || !canSave}
          className={`px-3.5 py-2 rounded-[10px] text-xs font-bold text-white transition ${canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400'}`}
        >
          {busy ? 'Сохраняем...' : 'Сохранить комментарий'}
        </button>
      </div>
    </div>
  );
}
