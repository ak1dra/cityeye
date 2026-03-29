import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/* ── Chart data: 30 days ── */
const CHART_DATA = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  const label = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  const seed = (i * 137 + 42) & 0xfffff;
  return {
    date: label,
    new:      6  + (seed % 18),
    resolved: 3  + ((seed >> 4) % 14),
  };
});

/* ── Districts ── */
const DISTRICTS = [
  { name: 'Медеуский',      score: 91 },
  { name: 'Бостандыкский',  score: 84 },
  { name: 'Алмалинский',    score: 73 },
  { name: 'Жетысуский',     score: 67 },
  { name: 'Ауэзовский',     score: 58 },
  { name: 'Турксибский',    score: 49 },
  { name: 'Алатауский',     score: 41 },
  { name: 'Наурызбайский',  score: 35 },
];

/* ── Status flow ── */
const NEXT = {
  new:         'in_progress',
  in_progress: 'resolved',
  resolved:    null,
  rejected:    'new',
};

const ST_LABEL = {
  new:         'Новый',
  in_progress: 'В работе',
  resolved:    'Решено',
  rejected:    'Отклонён',
};

const ST_COLOR = {
  new:         '#3B82F6',
  in_progress: '#F97316',
  resolved:    '#22C55E',
  rejected:    '#6B7280',
};

const ST_BG = {
  new:         'rgba(59,130,246,0.14)',
  in_progress: 'rgba(249,115,22,0.14)',
  resolved:    'rgba(34,197,94,0.14)',
  rejected:    'rgba(107,114,128,0.14)',
};

const SEV_LABEL = { critical: 'Критично', high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const SEV_COLOR = { critical: '#EF4444', high: '#F97316', medium: '#3B82F6', low: '#22C55E' };
const SEV_BG    = {
  critical: 'rgba(239,68,68,0.14)', high: 'rgba(249,115,22,0.14)',
  medium:   'rgba(59,130,246,0.14)', low: 'rgba(34,197,94,0.14)',
};

const CAT_LABEL = {
  road: 'Дороги', lighting: 'Освещение', greenery: 'Озеленение',
  utilities: 'Коммуникации', waste: 'Мусор', other: 'Другое',
};

/* ── SVG Icon ── */
function Icon({ n, size = 16, color = 'currentColor' }) {
  const s = { width: size, height: size, flexShrink: 0, display: 'block' };
  const p = { stroke: color, fill: 'none', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    pin:      <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
    clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    building: <><rect x="3" y="9" width="18" height="13" rx="2"/><path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
    eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    alert:    <><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    chart:    <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    map:      <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
    logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    photo:    <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
  };
  return <svg style={s} viewBox="0 0 24 24" {...p}>{paths[n]}</svg>;
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}

/* ── Custom Tooltip ── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1a1f16', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '10px 14px',
      fontSize: '0.78rem', color: '#fff',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function Dashboard({ reports = [], onStatusChange, onTabChange, user, onLogout }) {
  const [busy, setBusy] = useState(null);
  const [filterSev, setFilterSev] = useState('all');

  /* guard */
  if (user?.role !== 'government') {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0f110d', gap: 16,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(239,68,68,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon n="alert" size={28} color="#EF4444" />
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
          Доступно только для гос. органов
        </div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', maxWidth: 300, textAlign: 'center' }}>
          Войдите в аккаунт государственного служащего для доступа к панели акимата
        </div>
        <button
          onClick={() => onTabChange?.('map')}
          style={{
            marginTop: 8, padding: '10px 24px', borderRadius: 10,
            background: 'rgba(255,255,255,0.07)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Вернуться на карту
        </button>
      </div>
    );
  }

  /* metrics */
  const newCount  = reports.filter(r => r.status === 'new').length + 127;
  const inProgCnt = reports.filter(r => r.status === 'in_progress').length + 48;
  const resCnt    = reports.filter(r => r.status === 'resolved').length + 843;

  /* filtered table */
  const tableRows = [...reports].reverse().filter(r =>
    filterSev === 'all' || r.severity === filterSev
  );

  async function advanceStatus(id, next) {
    if (!next) return;
    setBusy(id);
    try {
      const { updateStatus } = await import('../api.js');
      await updateStatus(id, next);
      await onStatusChange?.();
    } catch { /* ignore */ } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0f110d', overflow: 'hidden',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* ── Top bar ── */}
      <header style={{
        height: 60, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 28px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#111310',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, background: '#c8f060',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon n="building" size={15} color="#0f110d" />
          </div>
          <div>
            <div style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '0.9rem', fontWeight: 800, color: '#fff', lineHeight: 1.1,
            }}>
              Панель акимата
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>
              {user?.name ?? 'Акимат Алматы'} · Алматы
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Nav pills */}
        {['map', 'feed', 'report'].map(id => {
          const labels = { map: 'Карта', feed: 'Лента', report: 'Репорт' };
          return (
            <button key={id} onClick={() => onTabChange?.(id)} style={{
              background: 'transparent', color: 'rgba(255,255,255,0.35)',
              border: 'none', padding: '6px 12px', borderRadius: 7,
              fontSize: '0.82rem', cursor: 'pointer', marginRight: 4,
            }}>
              {labels[id]}
            </button>
          );
        })}

        <button onClick={onLogout} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)',
          borderRadius: 8, padding: '6px 12px',
          fontSize: '0.8rem', cursor: 'pointer', marginLeft: 8,
        }}>
          <Icon n="logout" size={13} color="rgba(255,255,255,0.5)" />
          Выйти
        </button>
      </header>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>

        {/* ── Section 1: Metrics ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <MetricCard value={newCount}  label="Новых репортов" color="#EF4444" icon="alert" />
          <MetricCard value={inProgCnt} label="В обработке"    color="#F97316" icon="eye" />
          <MetricCard value={resCnt}    label="Решено"         color="#22C55E" icon="check" />
          <MetricCard value="18ч"       label="Среднее время"  color="#3B82F6" icon="clock" />
        </div>

        {/* ── Section 2: Chart ── */}
        <div style={{
          background: '#161a12',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '20px 20px 12px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                Динамика репортов
              </div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                За последние 30 дней · Алматы
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ color: '#EF4444', label: 'Новые' }, { color: '#22C55E', label: 'Решённые' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={CHART_DATA} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
              <Line
                type="monotone" dataKey="new" name="Новые"
                stroke="#EF4444" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#EF4444' }}
              />
              <Line
                type="monotone" dataKey="resolved" name="Решённые"
                stroke="#22C55E" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#22C55E' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── Section 3: Table ── */}
        <div style={{
          background: '#161a12',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, overflow: 'hidden',
          marginBottom: 24,
        }}>
          {/* Table header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Репорты граждан</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                {tableRows.length} из {reports.length} записей
              </div>
            </div>
            {/* Severity filter */}
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                <button key={s} onClick={() => setFilterSev(s)} style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: filterSev === s ? (SEV_BG[s] ?? 'rgba(255,255,255,0.1)') : 'transparent',
                  color: filterSev === s ? (SEV_COLOR[s] ?? '#fff') : 'rgba(255,255,255,0.3)',
                  border: filterSev === s ? `1px solid ${SEV_COLOR[s] ?? 'rgba(255,255,255,0.2)'}` : '1px solid transparent',
                  fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer',
                }}>
                  {s === 'all' ? 'Все' : SEV_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {tableRows.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.875rem' }}>
              Нет репортов по выбранному фильтру
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Фото', 'Тип', 'Адрес', 'Приоритет', 'Статус', 'Время', 'Действие'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: '0.68rem', fontWeight: 700,
                        color: 'rgba(255,255,255,0.25)',
                        textTransform: 'uppercase', letterSpacing: '0.6px',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => {
                    const sev = r.severity;
                    const next = NEXT[r.status];
                    const isLast = i === tableRows.length - 1;

                    const btnLabel = next === 'in_progress' ? 'В работе'
                                   : next === 'resolved'    ? 'Решено'
                                   : next === 'new'         ? 'Вернуть'
                                   : null;

                    const btnColor = next === 'resolved'    ? '#22C55E'
                                   : next === 'in_progress' ? '#F97316'
                                   : '#3B82F6';

                    return (
                      <tr key={r.id} style={{
                        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}>
                        {/* Photo */}
                        <td style={{ padding: '10px 14px' }}>
                          {r.image ? (
                            <img src={r.image} alt="" style={{
                              width: 42, height: 42, borderRadius: 8,
                              objectFit: 'cover', border: '1px solid rgba(255,255,255,0.08)',
                            }} />
                          ) : (
                            <div style={{
                              width: 42, height: 42, borderRadius: 8,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Icon n="photo" size={16} color="rgba(255,255,255,0.2)" />
                            </div>
                          )}
                        </td>
                        {/* Type */}
                        <td style={{ padding: '10px 14px', fontSize: '0.83rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
                          {CAT_LABEL[r.category] ?? r.type ?? '—'}
                        </td>
                        {/* Address */}
                        <td style={{ padding: '10px 14px', maxWidth: 180 }}>
                          {r.address ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                              <Icon n="pin" size={11} color="rgba(255,255,255,0.3)" />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.address}</span>
                            </span>
                          ) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                        </td>
                        {/* Severity */}
                        <td style={{ padding: '10px 14px' }}>
                          {sev && (
                            <span style={{
                              background: SEV_BG[sev], color: SEV_COLOR[sev],
                              borderRadius: 20, padding: '3px 10px',
                              fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
                            }}>
                              {SEV_LABEL[sev]}
                            </span>
                          )}
                        </td>
                        {/* Status */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            background: ST_BG[r.status],
                            color: ST_COLOR[r.status],
                            borderRadius: 20, padding: '3px 10px',
                            fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            {ST_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                        {/* Time */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>
                            <Icon n="clock" size={11} color="rgba(255,255,255,0.25)" />
                            {timeAgo(r.created_at)}
                          </span>
                        </td>
                        {/* Action */}
                        <td style={{ padding: '10px 14px' }}>
                          {btnLabel && (
                            <button
                              disabled={busy === r.id}
                              onClick={() => advanceStatus(r.id, next)}
                              style={{
                                background: `rgba(${btnColor === '#22C55E' ? '34,197,94' : btnColor === '#F97316' ? '249,115,22' : '59,130,246'},0.12)`,
                                color: btnColor,
                                border: `1px solid ${btnColor}33`,
                                borderRadius: 8, padding: '5px 12px',
                                fontSize: '0.75rem', fontWeight: 700,
                                cursor: busy === r.id ? 'not-allowed' : 'pointer',
                                opacity: busy === r.id ? 0.5 : 1,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {busy === r.id ? '...' : btnLabel}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Section 4: District ratings ── */}
        <div style={{
          background: '#161a12',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '20px 24px',
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            Рейтинг районов
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>
            Эффективность устранения проблем · Алматы
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 40px' }}>
            {DISTRICTS.map(d => {
              const color = d.score >= 80 ? '#22C55E' : d.score >= 50 ? '#F97316' : '#EF4444';
              const bgColor = d.score >= 80 ? 'rgba(34,197,94,0.08)' : d.score >= 50 ? 'rgba(249,115,22,0.08)' : 'rgba(239,68,68,0.08)';
              return (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                      {d.name}
                    </span>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: 800, color,
                      background: bgColor, borderRadius: 6, padding: '1px 7px',
                    }}>
                      {d.score}%
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${d.score}%`,
                      background: color, borderRadius: 4,
                      transition: 'width 0.8s ease',
                      boxShadow: `0 0 8px ${color}66`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({ value, label, color, icon }) {
  const bgMap = {
    '#EF4444': 'rgba(239,68,68,0.08)',
    '#F97316': 'rgba(249,115,22,0.08)',
    '#22C55E': 'rgba(34,197,94,0.08)',
    '#3B82F6': 'rgba(59,130,246,0.08)',
  };
  return (
    <div style={{
      background: '#161a12',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: bgMap[color] ?? 'rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <Icon n={icon} size={18} color={color} />
      </div>
      <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: 5 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}
