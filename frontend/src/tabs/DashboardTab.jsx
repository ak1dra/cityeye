import { useState } from 'react';
import { updateStatus } from '../api';

const SEVERITY_COLOR = {
  low:      'var(--green)',
  medium:   'var(--yellow)',
  high:     'var(--orange)',
  critical: 'var(--red)',
};

const STATUS_COLOR = {
  new:         'var(--accent)',
  in_progress: 'var(--yellow)',
  resolved:    'var(--green)',
  rejected:    'var(--text-muted)',
};

const STATUS_LABEL = {
  new:         'Новый',
  in_progress: 'В работе',
  resolved:    'Решён',
  rejected:    'Отклонён',
};

const CATEGORY_LABEL = {
  road:      'Дороги',
  lighting:  'Освещение',
  greenery:  'Озеленение',
  utilities: 'Коммуникации',
  waste:     'Мусор',
  other:     'Другое',
};

const NEXT_STATUSES = {
  new:         ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved:    [],
  rejected:    ['new'],
};

const STATUS_BTN_LABEL = {
  in_progress: 'В работу',
  resolved:    'Решить',
  rejected:    'Отклонить',
  new:         'Вернуть',
};

export default function DashboardTab({ reports, onStatusChange }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function changeStatus(id, status) {
    setBusy(id + status);
    setError(null);
    try {
      await updateStatus(id, status);
      await onStatusChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (reports.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div>Репорты пока отсутствуют</div>
        <div style={{ fontSize: '0.85rem', marginTop: 6 }}>Создайте первый на вкладке «Репорт»</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
          Дашборд
        </h2>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {reports.length} репорт{reports.length === 1 ? '' : 'ов'}
        </span>
      </div>

      {error && (
        <div style={{
          background: 'rgba(245,101,101,0.12)',
          border: '1px solid rgba(245,101,101,0.3)',
          borderRadius: 6,
          padding: '10px 14px',
          color: 'var(--red)',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...reports].reverse().map(r => (
          <div
            key={r.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 3 }}>{r.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {CATEGORY_LABEL[r.category] ?? r.category}
                  {r.address && <span> · {r.address}</span>}
                  <span> · {new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge color={SEVERITY_COLOR[r.severity] ?? 'var(--text-muted)'}>
                  {r.severity?.toUpperCase()}
                </Badge>
                <Badge color={STATUS_COLOR[r.status] ?? 'var(--text-muted)'}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              {r.description}
            </p>

            {/* Actions */}
            {NEXT_STATUSES[r.status]?.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {NEXT_STATUSES[r.status].map(s => (
                  <button
                    key={s}
                    disabled={!!busy}
                    onClick={() => changeStatus(r.id, s)}
                    style={{
                      background: s === 'rejected' ? 'var(--surface2)' : 'var(--accent)',
                      color: s === 'rejected' ? 'var(--text-muted)' : '#fff',
                      padding: '5px 14px',
                      fontSize: '0.82rem',
                    }}
                  >
                    {busy === r.id + s ? '...' : STATUS_BTN_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{
      background: `${color}22`,
      color,
      border: `1px solid ${color}55`,
      borderRadius: 5,
      padding: '2px 9px',
      fontSize: '0.78rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}
