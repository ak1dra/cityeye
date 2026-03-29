import { useState, useRef } from 'react';
import { analyzeImage } from '../api';
import { Camera, MapPin, ChevronDown, Clock, Building, AlertTriangle } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { label: 'Критично',   color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  high:     { label: 'Высокий',    color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  medium:   { label: 'Средний',    color: '#EAB308', bg: '#FEFCE8', border: '#FEF08A' },
  low:      { label: 'Низкий',     color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
};

const DEPT_BY_CATEGORY = {
  road:       'Управление дорог и транспорта',
  lighting:   'Отдел городского освещения',
  greenery:   'Управление природных ресурсов',
  utilities:  'КСК / Горводоканал',
  waste:      'Экологическая служба',
  other:      'Акимат района',
};

const CATEGORY_OPTIONS = [
  { value: '',          label: 'Выберите тип проблемы' },
  { value: 'road',      label: 'Дороги' },
  { value: 'lighting',  label: 'Освещение' },
  { value: 'greenery',  label: 'Озеленение' },
  { value: 'utilities', label: 'Коммуникации' },
  { value: 'waste',     label: 'Мусор' },
  { value: 'other',     label: 'Другое' },
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ReportTab({ onNewReport }) {
  const [preview, setPreview]   = useState(null);
  const [base64, setBase64]     = useState(null);
  const [address, setAddress]   = useState('');
  const [category, setCategory] = useState('');
  const [comment, setComment]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [result, setResult]     = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const b64 = await fileToBase64(file);
    setBase64(b64);
    setPreview(b64);
    setResult(null);
    setError(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function submit(e) {
    e.preventDefault();
    if (!base64) { setError('Загрузите фото'); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeImage({
        image: base64,
        address,
        comment,
        problemType: category || undefined,
      });
      setResult(data);
      onNewReport?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPreview(null);
    setBase64(null);
    setAddress('');
    setCategory('');
    setComment('');
    setResult(null);
    setError(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
          Сообщить о проблеме
        </h2>
        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Сфотографируйте и опишите проблему — ИИ определит тип и срочность
        </p>
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        boxShadow: 'var(--shadow)',
      }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Drop zone */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Фото проблемы <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current.click()}
              onKeyDown={e => e.key === 'Enter' && inputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              style={{
                border: `2px dashed ${dragging ? 'var(--accent)' : preview ? 'var(--border)' : '#93C5FD'}`,
                borderRadius: 10,
                background: dragging ? 'rgba(37,99,235,0.04)' : preview ? '#fff' : '#EFF6FF',
                minHeight: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="preview"
                  style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#3B82F6', pointerEvents: 'none', padding: 32 }}>
                  <Camera size={48} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.7 }} />
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 6 }}>
                    Перетащите фото или нажмите
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>JPG, PNG, WEBP — до 10 МБ</div>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
            {preview && (
              <button
                type="button"
                onClick={() => { setPreview(null); setBase64(null); }}
                style={{
                  marginTop: 8, background: 'transparent', color: 'var(--text-muted)',
                  padding: '4px 0', fontSize: '0.82rem', textDecoration: 'underline',
                }}
              >
                Удалить фото
              </button>
            )}
          </div>

          {/* Address */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Адрес или ориентир
            </label>
            <div style={{ position: 'relative' }}>
              <MapPin size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="ул. Абая 10, Алматы"
                value={address}
                onChange={e => setAddress(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Тип проблемы
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ paddingRight: 36 }}
              >
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Comment */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              Комментарий <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(опционально)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Опишите проблему своими словами..."
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="submit"
              disabled={loading || !base64}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                padding: '12px 28px',
                borderRadius: 8,
                fontSize: '0.95rem',
                fontWeight: 600,
                flex: 1,
              }}
            >
              {loading ? 'Анализируем...' : 'Отправить репорт'}
            </button>
            {(preview || result) && (
              <button
                type="button"
                onClick={reset}
                style={{
                  background: 'var(--bg-section)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  padding: '12px 20px',
                  borderRadius: 8,
                }}
              >
                Сбросить
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Result card */}
      {result && (
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* Result header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                Результат анализа
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>{result.title}</div>
            </div>
            {(() => {
              const sev = SEVERITY_CONFIG[result.severity];
              return sev ? (
                <span style={{
                  background: sev.bg, color: sev.color,
                  border: `1px solid ${sev.border}`,
                  borderRadius: 20, padding: '4px 14px',
                  fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  {sev.label}
                </span>
              ) : null;
            })()}
          </div>

          <p style={{ margin: 0, lineHeight: 1.65, color: 'var(--text)', fontSize: '0.9rem' }}>
            {result.description}
          </p>

          {/* Meta info row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}>
            {result.estimated_resolution_days != null && (
              <div style={{
                background: 'var(--bg-section)', borderRadius: 8, padding: '12px 14px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 4 }}>
                  <Clock size={13} />
                  Срок устранения
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1rem' }}>
                  {result.estimated_resolution_days} дней
                </div>
              </div>
            )}
            <div style={{
              background: 'var(--bg-section)', borderRadius: 8, padding: '12px 14px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 4 }}>
                <Building size={13} />
                Ответственный отдел
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.88rem' }}>
                {DEPT_BY_CATEGORY[result.category] ?? 'Акимат района'}
              </div>
            </div>
          </div>

          {result.recommendations?.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.9rem', color: 'var(--text)' }}>
                Рекомендации
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.recommendations.map((r, i) => (
                  <li key={i} style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: 8, padding: '10px 14px',
            color: '#166534', fontSize: '0.85rem', fontWeight: 500,
          }}>
            ✓ Репорт успешно отправлен в систему
          </div>
        </div>
      )}
    </div>
  );
}
