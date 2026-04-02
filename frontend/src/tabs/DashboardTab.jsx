import { useState } from 'react';
import { updateStatus } from '../api';
import { GlassPanel } from '../components/GlassPanel';

const SEVERITY_COLOR = {
  critical: '#ff4444', high: '#ff8c00', medium: '#3b82f6', low: '#8b5cf6',
};
const STATUS_COLOR = {
  new: '#3b82f6', in_progress: '#ff8c00', resolved: '#22c55e', rejected: '#555',
};
const STATUS_LABEL = {
  new: 'Новый', in_progress: 'В работе', resolved: 'Решён', rejected: 'Отклонён',
};
const CATEGORY_LABEL = {
  road: 'Дороги', lighting: 'Освещение', greenery: 'Озеленение',
  utilities: 'Коммуникации', waste: 'Мусор', other: 'Другое',
};
const NEXT_STATUSES = {
  new: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: [],
  rejected: ['new'],
};
const STATUS_BTN_LABEL = {
  in_progress: 'В работу', resolved: 'Решить',
  rejected: 'Отклонить', new: 'Вернуть',
};

export default function DashboardTab({ reports, onStatusChange }) {
  const [busy, setBusy]   = useState(null);
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
      <div style={{ textAlign: 'center', color: '#555', marginTop: 80 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 16px', display: 'block' }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#555' }}>Репорты пока отсутствуют</div>
        <div style={{ fontSize: 12, color: '#444', marginTop: 6 }}>Создайте первый на вкладке «Репорт»</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#ededed' }}>
          Дашборд
        </h2>
        <span style={{ color: '#555', fontSize: 13 }}>
          {reports.length} репорт{reports.length === 1 ? '' : 'ов'}
        </span>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,68,68,0.08)',
          border: '1px solid rgba(255,68,68,0.2)',
          borderRadius: 8, padding: '10px 14px',
          color: '#ff4444', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...reports].reverse().map((r, i) => (
          <GlassPanel key={r.id} delay={i * 0.05} style={{ padding: 16 }}>
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: '#ededed', marginBottom: 3 }}>
                  {r.title}
                </div>
                <div style={{ color: '#555', fontSize: 12 }}>
                  {CATEGORY_LABEL[r.type] ?? r.type}
                  {r.address && <span> · {r.address}</span>}
                  <span> · {new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge color={SEVERITY_COLOR[r.severity] ?? '#555'}>
                  {r.severity?.toUpperCase()}
                </Badge>
                <Badge color={STATUS_COLOR[r.status] ?? '#555'}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#666', lineHeight: 1.55 }}>
              {r.description}
            </p>

            {/* Actions */}
            {NEXT_STATUSES[r.status]?.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {NEXT_STATUSES[r.status].map(s => (
                  <button key={s} disabled={!!busy} onClick={() => changeStatus(r.id, s)} style={{
                    background: s === 'rejected' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${s === 'rejected' ? 'var(--border)' : 'rgba(255,255,255,0.12)'}`,
                    color: s === 'rejected' ? '#555' : '#ededed',
                    padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                  }}>
                    {busy === r.id + s ? '...' : STATUS_BTN_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{
      background: `${color}18`,
      color,
      border: `1px solid ${color}33`,
      borderRadius: 5, padding: '2px 8px',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}
