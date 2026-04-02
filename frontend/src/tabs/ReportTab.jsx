import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { analyzeImage } from '../api';
import { buildCollaborationFields } from '../lib/reportCollaboration';

/* ── Severity ── */
const SEV = {
  КРИТИЧНО: { label: 'Критично', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  ВЫСОКО:   { label: 'Высокий',  color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  СРЕДНЕ:   { label: 'Средний',  color: '#eab308', bg: '#fefce8', border: '#fef08a' },
  НИЗКО:    { label: 'Низкий',   color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  critical: { label: 'Критично', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  high:     { label: 'Высокий',  color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  medium:   { label: 'Средний',  color: '#eab308', bg: '#fefce8', border: '#fef08a' },
  low:      { label: 'Низкий',   color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
};

/* ── Problem types ── */
const TYPES = [
  {
    id: 'road', label: 'Яма / Дорога',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    id: 'light', label: 'Освещение',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'trash', label: 'Мусор',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
      </svg>
    ),
  },
  {
    id: 'vandal', label: 'Вандализм',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/>
      </svg>
    ),
  },
  {
    id: 'parking', label: 'Парковка',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 17V7h4a3 3 0 010 6H9"/>
      </svg>
    ),
  },
  {
    id: 'other', label: 'Другое',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
];

/* ── Pin SVG for Yandex Maps ── */
const PIN_SVG = encodeURIComponent(`
  <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1C7.37 1 2 6.37 2 13c0 9.75 12 21 12 21S26 22.75 26 13C26 6.37 20.63 1 14 1z"
      fill="#6366f1" filter="drop-shadow(0 2px 4px rgba(0,0,0,.3))"/>
    <circle cx="14" cy="13" r="5" fill="white"/>
  </svg>
`);

export default function ReportTab({ onNewReport }) {
  const [selectedType,  setSelectedType]  = useState('');
  const [address,       setAddress]       = useState('');
  const [comment,       setComment]       = useState('');
  const [location,      setLocation]      = useState(null);
  const [photoFile,     setPhotoFile]     = useState(null);
  const [photoPreview,  setPhotoPreview]  = useState(null);
  const [photoHover,    setPhotoHover]    = useState(false);

  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);
  const [result,    setResult]    = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef  = useRef();
  const mapRef        = useRef(null);
  const mapInstance   = useRef(null);
  const placemarkRef  = useRef(null);
  const currentUser = JSON.parse(localStorage.getItem('cityeye_user') || 'null');
  const isBusinessAuthor = currentUser?.role === 'business';

  /* ── Init Yandex Map ── */
  useEffect(() => {
    if (!window.ymaps) return;

    window.ymaps.ready(() => {
      if (mapInstance.current) return;

      mapInstance.current = new window.ymaps.Map(
        mapRef.current,
        { center: [43.238949, 76.889709], zoom: 13, controls: ['zoomControl'] },
        { suppressMapOpenBlock: true }
      );

      mapInstance.current.events.add('click', async (e) => {
        const coords = e.get('coords');

        if (placemarkRef.current) {
          mapInstance.current.geoObjects.remove(placemarkRef.current);
        }

        placemarkRef.current = new window.ymaps.Placemark(
          coords,
          {},
          {
            iconLayout: 'default#image',
            iconImageHref: `data:image/svg+xml,${PIN_SVG}`,
            iconImageSize:   [28, 36],
            iconImageOffset: [-14, -36],
          }
        );
        mapInstance.current.geoObjects.add(placemarkRef.current);

        try {
          const geo  = await window.ymaps.geocode(coords);
          const addr = geo.geoObjects.get(0).getAddressLine();
          setAddress(addr);
          setLocation({ lat: coords[0], lng: coords[1] });
        } catch {
          setLocation({ lat: coords[0], lng: coords[1] });
        }
      });
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, []);

  /* ── Photo ── */
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  /* ── Analyze ── */
  async function handleAnalyze() {
    if (!comment.trim()) { setError('Опишите проблему'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await analyzeImage({
        problemType: selectedType,
        address,
        comment,
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Submit ── */
  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      /* Upload photo */
      let imageUrl = null;
      if (photoFile) {
        const fileName = `${Date.now()}-${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('reports-images')
          .upload(fileName, photoFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('reports-images')
            .getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        } else {
          console.warn('Photo upload failed:', uploadError.message);
        }
      }

      /* Save to Supabase */
      const storedUser = JSON.parse(localStorage.getItem('cityeye_user') || '{}');
      const collaborationFields = buildCollaborationFields(storedUser);
      const { error: insertError } = await supabase.from('reports').insert({
        user_email:         storedUser.email || 'anonymous',
        user_name:          storedUser.name  || 'Гражданин',
        type:               result?.type     || selectedType,
        severity:           result?.severity,
        priority_score:     result?.priority_score,
        ai_comment:         result?.ai_comment,
        recommended_action: result?.recommended_action,
        estimated_fix_time: result?.estimated_fix_time,
        responsible_dept:   result?.responsible_dept,
        address,
        lat:                location?.lat ?? null,
        lng:                location?.lng ?? null,
        image_url:          imageUrl,
        status:             'new',
        ...collaborationFields,
      });
      if (insertError) throw new Error(insertError.message);

      onNewReport?.();
      setSubmitted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSelectedType(''); setAddress(''); setComment('');
    setPhotoFile(null); setPhotoPreview(null); setLocation(null);
    setResult(null); setError(null); setSubmitted(false);
  }

  const sevCfg = result ? (SEV[result.severity] ?? SEV.СРЕДНЕ) : null;

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
            Репорт отправлен!
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            {isBusinessAuthor
              ? 'Обращение поступило в совместную работу с акиматом. Обе стороны увидят заявку в едином контуре.'
              : 'Обращение принято. Ответственный отдел получит уведомление и приступит к устранению.'}
          </p>
          <button onClick={reset} style={btnPrimary}>Отправить ещё один</button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
          Сообщить о проблеме
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>
          AI определит тип и срочность автоматически
        </p>
      </div>

      {isBusinessAuthor && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(15,118,110,0.08), rgba(20,184,166,0.08))',
          border: '1px solid rgba(20,184,166,0.18)',
          borderRadius: 14,
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
            Совместная работа
          </div>
          <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.65 }}>
            Заявка от частного сектора автоматически попадёт в общий контур: её увидит и акимат, и управляющая компания.
          </div>
        </div>
      )}

      {/* ── Card: Фото ── */}
      <div style={cardStyle}>
        <SectionTitle>
          Фото <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 13 }}>(необязательно)</span>
        </SectionTitle>

        <div
          onClick={() => fileInputRef.current.click()}
          onMouseEnter={() => setPhotoHover(true)}
          onMouseLeave={() => setPhotoHover(false)}
          style={{
            border: `2px dashed ${photoHover ? '#6366f1' : '#e5e7eb'}`,
            borderRadius: 12,
            padding: photoPreview ? 0 : 32,
            textAlign: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            background: photoPreview ? 'none' : photoHover ? '#fafbff' : '#fafafa',
            transition: 'all 0.2s',
          }}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="preview" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
          ) : (
            <>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: '#f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                Нажмите чтобы добавить фото
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Необязательно · JPG PNG WEBP</div>
            </>
          )}
        </div>

        {photoPreview && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => fileInputRef.current.click()} style={btnSecondary}>
              Заменить
            </button>
            <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} style={{
              ...btnSecondary, color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2',
            }}>
              Удалить
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
      </div>

      {/* ── Card: Тип проблемы ── */}
      <div style={cardStyle}>
        <SectionTitle>Тип проблемы</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {TYPES.map(type => (
            <div
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              style={{
                padding: '16px 12px',
                border: selectedType === type.id ? '2px solid #6366f1' : '1.5px solid #e5e7eb',
                borderRadius: 12,
                textAlign: 'center',
                cursor: 'pointer',
                background: selectedType === type.id ? '#eef2ff' : '#fff',
                transition: 'all .2s',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8,
                color: selectedType === type.id ? '#6366f1' : '#9ca3af',
              }}
            >
              {type.icon}
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: selectedType === type.id ? '#6366f1' : '#6b7280',
              }}>
                {type.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card: Адрес + Карта ── */}
      <div style={cardStyle}>
        <SectionTitle>Адрес</SectionTitle>

        {/* Input */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <input
            type="text"
            placeholder="ул. Абая 10, Алматы"
            value={address}
            onChange={e => setAddress(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Yandex Map */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
            Отметьте на карте
          </label>
          <div
            ref={mapRef}
            style={{ height: 220, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}
          />
          {location && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Место отмечено: {address}
            </div>
          )}
        </div>
      </div>

      {/* ── Card: Описание ── */}
      <div style={cardStyle}>
        <SectionTitle>
          Описание <span style={{ color: '#ef4444' }}>*</span>
        </SectionTitle>
        <textarea
          rows={4}
          placeholder="Опишите проблему подробно: что случилось, насколько опасно, как давно существует..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          style={textareaStyle}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={errorStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── Кнопка Анализировать ── */}
      {!result && (
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            ...btnPrimary, width: '100%', opacity: loading ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {loading ? (
            <><div style={spinnerStyle} />AI анализирует...</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Анализировать
            </>
          )}
        </button>
      )}

      {/* ── AI Результат ── */}
      {result && (
        <div style={{
          background: 'linear-gradient(135deg, #fafbff, #f0f4ff)',
          border: '1px solid #c7d2fe',
          borderRadius: 16, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                AI-анализ
              </span>
            </div>
            {sevCfg && (
              <span style={{
                background: sevCfg.bg, color: sevCfg.color,
                border: `1px solid ${sevCfg.border}`,
                borderRadius: 20, padding: '4px 12px',
                fontSize: 12, fontWeight: 700,
              }}>
                {sevCfg.label}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <ResultCell label="Тип проблемы"       value={result.type ?? '—'} />
            <ResultCell label="Приоритет"           value={result.priority_score != null ? `${result.priority_score}/100` : '—'} />
            <ResultCell label="Срок устранения"     value={result.estimated_fix_time ?? '—'} />
            <ResultCell label="Ответственный отдел" value={result.responsible_dept ?? '—'} />
          </div>

          {result.ai_comment && (
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 10, padding: '12px 14px', marginBottom: 14,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>{result.ai_comment}</p>
            </div>
          )}

          {result.recommended_action && (
            <div style={{
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" style={{ marginTop: 1, flexShrink: 0 }}>
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 500 }}>{result.recommended_action}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                ...btnPrimary, flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <><div style={spinnerStyle} />Отправляем...</>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Отправить в акимат
                </>
              )}
            </button>
            <button onClick={() => setResult(null)} style={btnSecondary}>Изменить</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus, textarea:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
          outline: none;
        }
      `}</style>
    </div>
  );
}

/* ── Sub-components ── */
function SectionTitle({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>{children}</div>;
}

function ResultCell({ label, value }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

/* ── Styles ── */
const pageStyle = {
  maxWidth: 680, margin: '0 auto',
  padding: '32px 24px',
  fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
  display: 'flex', flexDirection: 'column', gap: 16,
};
const cardStyle = { background: '#fff', border: '1px solid #eee', borderRadius: 16, padding: 24 };
const inputStyle = {
  width: '100%', paddingLeft: 36, paddingRight: 14,
  height: 44, borderRadius: 10,
  border: '1px solid #e5e7eb', fontSize: 14,
  boxSizing: 'border-box', fontFamily: 'inherit',
  color: '#0f172a', background: '#fff', transition: 'border-color 0.15s',
};
const textareaStyle = {
  width: '100%', padding: '12px 14px',
  borderRadius: 10, border: '1px solid #e5e7eb',
  fontSize: 14, resize: 'vertical',
  boxSizing: 'border-box', fontFamily: 'inherit',
  color: '#0f172a', lineHeight: 1.65, transition: 'border-color 0.15s',
};
const btnPrimary = {
  background: '#6366f1', color: '#fff',
  border: 'none', borderRadius: 10,
  padding: '12px 24px', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
  transition: 'opacity 0.15s',
};
const btnSecondary = {
  background: '#fff', color: '#64748b',
  border: '1px solid #e5e7eb', borderRadius: 10,
  padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const errorStyle = {
  background: '#fef2f2', border: '1px solid #fecaca',
  borderRadius: 10, padding: '10px 14px',
  fontSize: 13, color: '#ef4444',
  display: 'flex', alignItems: 'center', gap: 8,
};
const spinnerStyle = {
  width: 14, height: 14,
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: '#fff', borderRadius: '50%',
  animation: 'spin 0.7s linear infinite', flexShrink: 0,
};
