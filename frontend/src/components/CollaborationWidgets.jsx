import { getPartnerComment, getReportTimeline } from '../lib/reportCollaboration';

const STEP_STYLE = {
  complete: {
    dotBg: '#dcfce7',
    dotColor: '#15803d',
    border: '#bbf7d0',
    title: '#166534',
    caption: '#4d7c0f',
    line: '#86efac',
  },
  current: {
    dotBg: '#eef2ff',
    dotColor: '#4338ca',
    border: '#c7d2fe',
    title: '#4338ca',
    caption: '#6366f1',
    line: '#c7d2fe',
  },
  upcoming: {
    dotBg: '#f8fafc',
    dotColor: '#94a3b8',
    border: '#e2e8f0',
    title: '#64748b',
    caption: '#94a3b8',
    line: '#e2e8f0',
  },
};

export function CollaborationTimeline({ report, title = 'Ход заявки' }) {
  const steps = getReportTimeline(report);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: 10 }}>
        {steps.map((step, index) => {
          const tone = STEP_STYLE[step.state] ?? STEP_STYLE.upcoming;
          return (
            <div key={step.id} style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: tone.dotBg,
                  color: tone.dotColor,
                  border: `1px solid ${tone.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  flexShrink: 0,
                }}>
                  {step.state === 'complete' ? '✓' : index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div style={{ height: 2, flex: 1, background: tone.line, borderRadius: 999 }} />
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: tone.title, marginBottom: 4, lineHeight: 1.35 }}>
                {step.label}
              </div>
              <div style={{ fontSize: 11, color: tone.caption, lineHeight: 1.45 }}>
                {step.caption}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PartnerCommentBox({
  report,
  draft,
  onDraftChange,
  onSave,
  busy = false,
  placeholder = 'Напишите комментарий для второй стороны...',
}) {
  const comment = getPartnerComment(report);
  const canSave = draft.trim().length > 0;

  return (
    <div style={{ marginTop: 14, borderRadius: 14, border: '1px solid #dbeafe', background: '#f8fbff', padding: 14 }}>
      <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
        Координационный комментарий
      </div>

      <div style={{
        borderRadius: 12,
        border: '1px solid #dbeafe',
        background: '#fff',
        padding: '12px 14px',
        minHeight: 76,
        marginBottom: 10,
        fontSize: 13,
        color: comment ? '#334155' : '#94a3b8',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {comment || 'Комментарий между акиматом и частным сектором ещё не добавлен.'}
      </div>

      <textarea
        rows={3}
        value={draft}
        onChange={event => onDraftChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          resize: 'vertical',
          boxSizing: 'border-box',
          borderRadius: 12,
          border: '1px solid #bfdbfe',
          background: '#fff',
          padding: '10px 12px',
          fontFamily: 'inherit',
          fontSize: 13,
          color: '#0f172a',
          lineHeight: 1.6,
          outline: 'none',
          marginBottom: 10,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Сообщение увидят обе стороны совместной заявки.
        </div>
        <button
          onClick={onSave}
          disabled={busy || !canSave}
          style={{
            background: canSave ? '#2563eb' : '#94a3b8',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '9px 14px',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {busy ? 'Сохраняем...' : 'Сохранить комментарий'}
        </button>
      </div>
    </div>
  );
}
