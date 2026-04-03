import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { analyzeImage } from '../api';
import { AITriagePanel } from '../components/AITriagePanel';
import { getAIDossier } from '../lib/aiTriage';
import { buildCollaborationFields } from '../lib/reportCollaboration';

const MIN_CONTEXT_COMMENT = 8;

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
    id: 'lighting', label: 'Освещение',
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
    id: 'waste', label: 'Мусор',
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

const PIN_SVG = encodeURIComponent(`
  <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1C7.37 1 2 6.37 2 13c0 9.75 12 21 12 21S26 22.75 26 13C26 6.37 20.63 1 14 1z"
      fill="#6366f1" filter="drop-shadow(0 2px 4px rgba(0,0,0,.3))"/>
    <circle cx="14" cy="13" r="5" fill="white"/>
  </svg>
`);

function buildContextSignature({ photoFile, selectedType, address, comment, reporterRole }) {
  if (!photoFile) return '';

  return JSON.stringify({
    photo: `${photoFile.name}:${photoFile.size}:${photoFile.lastModified}`,
    selectedType,
    address: address.trim(),
    comment: comment.trim(),
    reporterRole,
  });
}

export default function ReportTab({ onNewReport }) {
  const [selectedType, setSelectedType] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [location, setLocation] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoHover, setPhotoHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [analyzedSignature, setAnalyzedSignature] = useState('');

  const fileInputRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const placemarkRef = useRef(null);
  const pendingAnalyzeSignature = useRef('');

  const currentUser = JSON.parse(localStorage.getItem('cityeye_user') || 'null');
  const reporterRole = currentUser?.role || 'citizen';
  const isBusinessAuthor = reporterRole === 'business';
  const hasPhoto = Boolean(photoFile);
  const hasContext = Boolean(selectedType || address.trim() || comment.trim().length >= MIN_CONTEXT_COMMENT);
  const contextSignature = buildContextSignature({ photoFile, selectedType, address, comment, reporterRole });
  const isResultFresh = Boolean(result) && analyzedSignature === contextSignature;
  const isResultStale = Boolean(result) && Boolean(analyzedSignature) && analyzedSignature !== contextSignature;
  const canManualAnalyze = hasPhoto && hasContext && !loading;
  const successDossier = result ? getAIDossier(result) : null;

  useEffect(() => {
    if (!window.ymaps) return;

    window.ymaps.ready(() => {
      if (mapInstance.current) return;

      mapInstance.current = new window.ymaps.Map(
        mapRef.current,
        { center: [43.238949, 76.889709], zoom: 13, controls: ['zoomControl'] },
        { suppressMapOpenBlock: true }
      );

      mapInstance.current.events.add('click', async event => {
        const coords = event.get('coords');

        if (placemarkRef.current) {
          mapInstance.current.geoObjects.remove(placemarkRef.current);
        }

        placemarkRef.current = new window.ymaps.Placemark(
          coords,
          {},
          {
            iconLayout: 'default#image',
            iconImageHref: `data:image/svg+xml,${PIN_SVG}`,
            iconImageSize: [28, 36],
            iconImageOffset: [-14, -36],
          }
        );
        mapInstance.current.geoObjects.add(placemarkRef.current);

        try {
          const geo = await window.ymaps.geocode(coords);
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

  async function runAnalyze(signature = contextSignature, resetOutput = false) {
    if (!photoFile) {
      setError('Для AI triage сначала загрузите фото.');
      return;
    }

    if (!hasContext) {
      setError('Добавьте минимальный контекст: тип, адрес или короткое описание.');
      return;
    }

    pendingAnalyzeSignature.current = signature;
    setLoading(true);
    setError(null);
    if (resetOutput) setResult(null);

    try {
      const data = await analyzeImage({
        problemType: selectedType,
        address: address.trim(),
        comment: comment.trim(),
        reporter_role: reporterRole,
        image_present: true,
      });

      if (pendingAnalyzeSignature.current !== signature) return;

      setResult(data);
      setAnalyzedSignature(signature);
    } catch (err) {
      if (pendingAnalyzeSignature.current !== signature) return;
      setError(err.message || 'Не удалось выполнить AI triage.');
    } finally {
      if (pendingAnalyzeSignature.current === signature) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!hasPhoto || !hasContext || saving || submitted || loading) return;
    if (!contextSignature || analyzedSignature === contextSignature) return;

    const timeout = setTimeout(() => {
      runAnalyze(contextSignature, false);
    }, isResultStale ? 350 : 700);

    return () => clearTimeout(timeout);
  }, [hasPhoto, hasContext, saving, submitted, loading, contextSignature, analyzedSignature, isResultStale]);

  function resetAnalyzeState() {
    pendingAnalyzeSignature.current = '';
    setResult(null);
    setAnalyzedSignature('');
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    resetAnalyzeState();
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setSubmitted(false);
    setError(null);
    resetAnalyzeState();

    const reader = new FileReader();
    reader.onload = loadEvent => setPhotoPreview(loadEvent.target?.result || null);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!photoFile) {
      setError('Добавьте фото, чтобы отправить кейс в AI-assisted triage flow.');
      return;
    }

    if (!isResultFresh) {
      setError('Подождите завершения AI triage или запустите переанализ, если вы изменили контекст кейса.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let imageUrl = null;

      if (photoFile) {
        const fileName = `${Date.now()}-${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('reports-images')
          .upload(fileName, photoFile);

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from('reports-images')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      const storedUser = JSON.parse(localStorage.getItem('cityeye_user') || '{}');
      const collaborationFields = buildCollaborationFields(storedUser);
      const payload = {
        user_email: storedUser.email || 'anonymous',
        user_name: storedUser.name || 'Гражданин',
        type: result?.type || selectedType || 'other',
        category: result?.type || selectedType || 'other',
        detected_issue_title: result?.detected_issue_title,
        severity: result?.severity,
        priority_score: result?.priority_score,
        ai_comment: result?.ai_comment,
        recommended_action: result?.recommended_action,
        estimated_fix_time: result?.estimated_fix_time,
        responsible_dept: result?.responsible_dept,
        risk_for: result?.risk_for,
        duplicate_likely: result?.duplicate_likely,
        suggested_responsible_role: result?.suggested_responsible_role,
        confidence_label: result?.confidence_label,
        address: address.trim() || null,
        comment: comment.trim() || null,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        image_url: imageUrl,
        status: 'new',
        ...collaborationFields,
      };

      const { error: insertError } = await supabase.from('reports').insert(payload);
      if (insertError) throw new Error(insertError.message);

      onNewReport?.();
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Не удалось отправить кейс.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSelectedType('');
    setAddress('');
    setComment('');
    setLocation(null);
    setSubmitted(false);
    setError(null);
    setLoading(false);
    setSaving(false);
    removePhoto();
  }

  if (submitted) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
            Кейс отправлен в AI-triage
          </h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            {isBusinessAuthor
              ? 'AI оформил кейс как заявку частного сектора и подготовил его для совместной работы с акиматом.'
              : 'AI сформировал досье кейса и отправил его в городской контур исполнения.'}
          </p>

          {successDossier?.hasTriage && (
            <div style={{
              margin: '0 auto 24px',
              maxWidth: 440,
              padding: '16px 18px',
              borderRadius: 16,
              background: 'linear-gradient(135deg,#f8fbff,#eef4ff)',
              border: '1px solid #c7d2fe',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                AI-досье
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                {successDossier.diagnosisTitle}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <SummaryBadge tone={successDossier.severity}>{successDossier.severity.label}</SummaryBadge>
                <SummaryBadge tone={successDossier.confidence}>{successDossier.confidence.shortLabel}</SummaryBadge>
                <SummaryBadge tone={successDossier.suggestedRole}>{successDossier.suggestedRole.label}</SummaryBadge>
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.65 }}>
                {successDossier.aiComment}
              </div>
            </div>
          )}

          <button onClick={reset} style={btnPrimary}>Отправить ещё один</button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
          Photo-first AI triage
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>
          Сначала фото, затем AI собирает досье кейса и готовит маршрут исполнения.
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
            Shared-case mode
          </div>
          <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.65 }}>
            Кейс от частного сектора сразу получает AI-triage и уходит в видимый контур совместной работы с акиматом.
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <SectionTitle>
          Фото <span style={{ color: '#ef4444' }}>*</span>
        </SectionTitle>

        <div
          onClick={() => fileInputRef.current?.click()}
          onMouseEnter={() => setPhotoHover(true)}
          onMouseLeave={() => setPhotoHover(false)}
          style={{
            border: `2px dashed ${photoHover ? '#6366f1' : '#dbe3ef'}`,
            borderRadius: 16,
            padding: photoPreview ? 0 : 32,
            textAlign: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            background: photoPreview ? 'none' : photoHover ? '#fafbff' : '#fafafa',
            transition: 'all 0.2s',
          }}
        >
          {photoPreview ? (
            <img src={photoPreview} alt="preview" style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
          ) : (
            <>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                Загрузите фото проблемы
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Фото обязательно для photo-first AI triage · JPG PNG WEBP
              </div>
            </>
          )}
        </div>

        {photoPreview && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={btnSecondary}>
              Заменить
            </button>
            <button
              type="button"
              onClick={removePhoto}
              style={{ ...btnSecondary, color: '#ef4444', borderColor: '#fecaca', background: '#fef2f2' }}
            >
              Удалить
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
      </div>

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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                color: selectedType === type.id ? '#6366f1' : '#9ca3af',
              }}
            >
              {type.icon}
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: selectedType === type.id ? '#6366f1' : '#6b7280',
              }}>
                {type.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <SectionTitle>Адрес</SectionTitle>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <input
            type="text"
            placeholder="ул. Абая 10, Алматы"
            value={address}
            onChange={event => setAddress(event.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
            Отметьте на карте
          </label>
          <div ref={mapRef} style={{ height: 220, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }} />
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

      <div style={cardStyle}>
        <SectionTitle>Контекст для AI</SectionTitle>
        <textarea
          rows={4}
          placeholder="Коротко опишите, что видно на фото, насколько опасна проблема и что мешает жителям."
          value={comment}
          onChange={event => setComment(event.target.value)}
          style={textareaStyle}
        />
        <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          Достаточно фото и одного элемента контекста: тип, адрес или короткое описание.
        </div>
      </div>

      <InfoBanner
        tone={
          !hasPhoto
            ? 'neutral'
            : loading
              ? 'info'
              : isResultFresh
                ? 'success'
                : hasContext
                  ? 'info'
                  : 'warning'
        }
        title={
          !hasPhoto
            ? 'Сначала загрузите фото'
            : loading
              ? 'AI triage обновляет досье кейса'
              : isResultFresh
                ? 'AI-досье готово к отправке'
                : hasContext
                  ? 'AI triage запускается автоматически'
                  : 'Добавьте контекст для AI'
        }
        text={
          !hasPhoto
            ? 'Photo-first сценарий начинается с изображения проблемы.'
            : loading
              ? 'Система пересчитывает severity, priority, suggested route и action plan.'
              : isResultFresh
                ? 'Кейс получил AI severity, маршрут исполнения и план действий.'
                : hasContext
                  ? 'Через мгновение AI соберёт досье и подготовит кейс к отправке.'
                  : 'Выберите тип, укажите адрес или добавьте короткое описание, чтобы запустить triage.'
        }
      />

      {error && (
        <div style={errorStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {(result || loading) && (
        <div style={{ ...cardStyle, padding: 18 }}>
          {loading && !result && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 14, background: '#eef4ff', border: '1px solid #bfdbfe', marginBottom: 16 }}>
              <div style={spinnerBlueStyle} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>
                  AI triage анализирует кейс
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                  Формируем severity, priority score, suggested route и recommended action.
                </div>
              </div>
            </div>
          )}

          {result && <AITriagePanel data={result} title="AI-досье кейса" />}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => runAnalyze(contextSignature, true)}
              disabled={!canManualAnalyze}
              style={{
                ...btnSecondary,
                borderColor: '#c7d2fe',
                color: '#4338ca',
                background: '#eef2ff',
                opacity: canManualAnalyze ? 1 : 0.55,
              }}
            >
              {loading ? 'Переанализируем...' : 'Переанализировать'}
            </button>

            <button
              onClick={handleSubmit}
              disabled={saving || loading || !isResultFresh}
              style={{
                ...btnPrimary,
                flex: 1,
                minWidth: 220,
                opacity: saving || loading || !isResultFresh ? 0.65 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {saving ? (
                <><div style={spinnerStyle} />Отправляем кейс...</>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Отправить в AI-assisted workflow
                </>
              )}
            </button>
          </div>

          {isResultStale && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px' }}>
              Контекст кейса изменился. Дождитесь обновления AI triage перед отправкой.
            </div>
          )}
        </div>
      )}

      {!result && canManualAnalyze && !loading && (
        <button
          onClick={() => runAnalyze(contextSignature, true)}
          style={{
            ...btnSecondary,
            width: '100%',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#fff',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Запустить AI triage сейчас
        </button>
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

function SectionTitle({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>{children}</div>;
}

function SummaryBadge({ tone, children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: 999,
      background: tone.bg,
      color: tone.color,
      border: `1px solid ${tone.border}`,
      fontSize: 12,
      fontWeight: 700,
    }}>
      {children}
    </span>
  );
}

function InfoBanner({ tone, title, text }) {
  const palette = {
    neutral: { bg: '#f8fafc', border: '#e2e8f0', title: '#334155', text: '#64748b' },
    info: { bg: '#eff6ff', border: '#bfdbfe', title: '#1d4ed8', text: '#475569' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', text: '#475569' },
    warning: { bg: '#fff7ed', border: '#fed7aa', title: '#c2410c', text: '#7c2d12' },
  }[tone];

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${palette.border}`, background: palette.bg, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: palette.title, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: palette.text, lineHeight: 1.65 }}>
        {text}
      </div>
    </div>
  );
}

const pageStyle = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '32px 24px',
  fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #eee',
  borderRadius: 16,
  padding: 24,
};

const inputStyle = {
  width: '100%',
  paddingLeft: 36,
  paddingRight: 14,
  height: 44,
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#0f172a',
  background: '#fff',
  transition: 'border-color 0.15s',
};

const textareaStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  resize: 'vertical',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#0f172a',
  lineHeight: 1.65,
  transition: 'border-color 0.15s',
};

const btnPrimary = {
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '12px 24px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
  transition: 'opacity 0.15s',
};

const btnSecondary = {
  background: '#fff',
  color: '#64748b',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const errorStyle = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  color: '#ef4444',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const spinnerStyle = {
  width: 14,
  height: 14,
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
  flexShrink: 0,
};

const spinnerBlueStyle = {
  width: 16,
  height: 16,
  border: '2px solid rgba(37,99,235,0.2)',
  borderTopColor: '#2563eb',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
  flexShrink: 0,
};
