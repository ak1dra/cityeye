import { useState } from 'react';
import { updateStatus } from '../api';
import { MapPin, Clock, ChevronDown, AlertTriangle } from 'lucide-react';

const GOV_USER = {
  name: 'Ruslan Berdenov',
  position: 'Заместитель акима Алматы',
  avatar: '/ruslan-avatar.jpg',
  initials: 'RB',
};

const SEVERITY_CONFIG = {
  critical: { label: 'Критично', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  high:     { label: 'Высокий',  color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  medium:   { label: 'Средний',  color: '#EAB308', bg: '#FEFCE8', border: '#FEF08A' },
  low:      { label: 'Низкий',   color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
};

const STATUS_CONFIG = {
  new:         { label: 'Новый',    color: '#2563EB', bg: '#EFF6FF' },
  in_progress: { label: 'В работе', color: '#F97316', bg: '#FFF7ED' },
  resolved:    { label: 'Решено',   color: '#22C55E', bg: '#F0FDF4' },
  rejected:    { label: 'Отклонён', color: '#94A3B8', bg: '#F8FAFC' },
};

const CATEGORY_LABEL = {
  road: 'Дороги', lighting: 'Освещение', greenery: 'Озеленение',
  utilities: 'Коммуникации', waste: 'Мусор', other: 'Другое',
};

const NEXT_STATUSES = {
  new:         ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved:    [],
  rejected:    ['new'],
};

const STATUS_BTN = {
  in_progress: { label: 'В работе', style: { background: '#FFF7ED', color: '#F97316', border: '1px solid #FED7AA' } },
  resolved:    { label: 'Решено',   style: { background: '#F0FDF4', color: '#22C55E', border: '1px solid #BBF7D0' } },
  rejected:    { label: 'Отклонить',style: { background: 'var(--bg-section)', color: 'var(--text-muted)', border: '1px solid var(--border)' } },
  new:         { label: 'Вернуть',  style: { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' } },
};

const DISTRICTS = [
  'Алатауский', 'Алмалинский', 'Ауэзовский',
  'Бостандыкский', 'Жетысуский', 'Медеуский', 'Наурызбайский', 'Турксибский',
];

function districtScore(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return 40 + Math.abs(h % 58);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

export default function GovTab({ reports, onStatusChange }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const newCount      = reports.filter(r => r.status === 'new').length;
  const inProgCount   = reports.filter(r => r.status === 'in_progress').length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;

  // avg resolution time mock
  const avgHours = 18;

  const filtered = [...reports].reverse().filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
    return true;
  });

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <img
              src={GOV_USER.avatar}
              alt={GOV_USER.name}
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #6366f1', display: 'block' }}
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
            <div style={{ display: 'none', width: 52, height: 52, borderRadius: '50%', background: '#eef2ff', border: '2.5px solid #6366f1', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#6366f1' }}>
              {GOV_USER.initials}
            </div>
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>{GOV_USER.name}</h2>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#6366f1"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#eef2ff', color: '#6366f1', padding: '2px 8px', borderRadius: 20 }}>Официально</span>
            </div>
            <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {GOV_USER.position} · Портал управления городом
            </p>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '5px 14px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Онлайн</span>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <MetricCard icon="🔴" value={newCount} label="Новых" color="#EF4444" bg="#FEF2F2" border="#FECACA" />
        <MetricCard icon="🟡" value={inProgCount} label="В работе" color="#F97316" bg="#FFF7ED" border="#FED7AA" />
        <MetricCard icon="🟢" value={resolvedCount} label="Решено" color="#22C55E" bg="#F0FDF4" border="#BBF7D0" />
        <MetricCard icon="⏱" value={`${avgHours}ч`} label="Среднее время" color="#2563EB" bg="#EFF6FF" border="#BFDBFE" />
      </div>

      {/* Filters */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid var(--border)',
        padding: '14px 16px', display: 'flex', gap: 12, flexWrap: 'wrap',
        alignItems: 'center', boxShadow: 'var(--shadow)',
      }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>Фильтры:</span>

        <div style={{ position: 'relative', minWidth: 150 }}>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ paddingRight: 30, fontSize: '0.84rem' }}
          >
            <option value="all">Все статусы</option>
            <option value="new">Новый</option>
            <option value="in_progress">В работе</option>
            <option value="resolved">Решено</option>
            <option value="rejected">Отклонён</option>
          </select>
          <ChevronDown size={14} color="var(--text-muted)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        <div style={{ position: 'relative', minWidth: 150 }}>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            style={{ paddingRight: 30, fontSize: '0.84rem' }}
          >
            <option value="all">Все приоритеты</option>
            <option value="critical">Критично</option>
            <option value="high">Высокий</option>
            <option value="medium">Средний</option>
            <option value="low">Низкий</option>
          </select>
          <ChevronDown size={14} color="var(--text-muted)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        <span style={{ marginLeft: 'auto', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          {filtered.length} из {reports.length}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 8, padding: '10px 14px',
          color: '#EF4444', fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: '#fff', borderRadius: 12,
        border: '1px solid var(--border)', overflow: 'hidden',
        boxShadow: 'var(--shadow)',
      }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 500, color: 'var(--text)' }}>Нет репортов</div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>Измените фильтры или ожидайте новых обращений</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-section)', borderBottom: '1px solid var(--border)' }}>
                  {['Фото', 'Тип', 'Адрес', 'Приоритет', 'Статус', 'Время', 'Действие'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: '0.78rem', fontWeight: 600,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const sev = SEVERITY_CONFIG[r.severity];
                  const st = STATUS_CONFIG[r.status];
                  const nexts = NEXT_STATUSES[r.status] ?? [];
                  return (
                    <tr key={r.id} style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                      background: i % 2 === 0 ? '#fff' : '#FAFAFA',
                    }}>
                      {/* Photo */}
                      <td style={{ padding: '10px 14px' }}>
                        {r.image ? (
                          <img src={r.image} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--bg-section)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid var(--border)' }}>
                            📷
                          </div>
                        )}
                      </td>
                      {/* Type */}
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {CATEGORY_LABEL[r.type] ?? r.type ?? '—'}
                      </td>
                      {/* Address */}
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', maxWidth: 180 }}>
                        {r.address ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.address}</span>
                          </span>
                        ) : '—'}
                      </td>
                      {/* Priority */}
                      <td style={{ padding: '10px 14px' }}>
                        {sev && (
                          <span style={{
                            background: sev.bg, color: sev.color,
                            border: `1px solid ${sev.border}`,
                            borderRadius: 20, padding: '2px 10px',
                            fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap',
                          }}>
                            {sev.label}
                          </span>
                        )}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '10px 14px' }}>
                        {st && (
                          <span style={{
                            background: st.bg, color: st.color,
                            borderRadius: 20, padding: '2px 10px',
                            fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            {st.label}
                          </span>
                        )}
                      </td>
                      {/* Time */}
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {timeAgo(r.created_at)}
                        </span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {nexts.map(s => {
                            const btn = STATUS_BTN[s] ?? {};
                            return (
                              <button
                                key={s}
                                disabled={!!busy}
                                onClick={() => changeStatus(r.id, s)}
                                style={{
                                  ...btn.style,
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {busy === r.id + s ? '...' : btn.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* District ratings */}
      <div style={{
        background: '#fff', borderRadius: 12,
        border: '1px solid var(--border)', padding: 20,
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: 16 }}>
          Рейтинг районов по эффективности
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DISTRICTS.map(d => {
            const score = districtScore(d);
            const color = score >= 70 ? '#22C55E' : score >= 50 ? '#F97316' : '#EF4444';
            return (
              <div key={d}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 }}>{d}</span>
                  <span style={{ fontSize: '0.875rem', color, fontWeight: 700 }}>{score}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-section)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${score}%`,
                    background: color, borderRadius: 4,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, color, bg, border }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: '1.4rem' }}>{icon}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.82rem', color, opacity: 0.8, fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}
