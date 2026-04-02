// @ts-nocheck
import { useEffect, useRef, useState } from 'react';

/* ── Pin colors by severity ── */
const PIN_COLOR = {
  critical: { color: '#dc2626', pulse: true  },
  high:     { color: '#d97706', pulse: false },
  medium:   { color: '#2563eb', pulse: false },
  low:      { color: '#7c3aed', pulse: false },
  resolved: { color: '#16a34a', pulse: false },
};

const CATEGORY_COLOR = {
  road:      '#dc2626',
  lighting:  '#d97706',
  waste:     '#ea580c',
  greenery:  '#16a34a',
  utilities: '#2563eb',
  resolved:  '#16a34a',
  other:     '#64748b',
};

/* ── Google Maps–style teardrop pin ── */
function pinSvg(color, pulse) {
  return `
<svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
  ${pulse ? `
  <circle cx="18" cy="18" r="14" fill="${color}" opacity="0.15">
    <animate attributeName="r" values="13;22;13" dur="2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite"/>
  </circle>` : ''}
  <path d="M18 2C9.163 2 2 9.163 2 18C2 28.5 18 42 18 42C18 42 34 28.5 34 18C34 9.163 26.837 2 18 2Z"
    fill="${color}"
    filter="drop-shadow(0 2px 6px rgba(0,0,0,0.22))"/>
  <circle cx="18" cy="18" r="9" fill="white"/>
  <circle cx="18" cy="18" r="4.5" fill="${color}"/>
</svg>`;
}

/* ── Mock pins ── */
const MOCK_PINS = [
  { id: 'm1', coords: [43.2460, 76.8820], category: 'road',      severity: 'critical', label: 'Яма',      address: 'ул. Абая 42',        ai: 'Глубокая выбоина 40×60 см на проезжей части. Требует срочного ямочного ремонта. Риск для подвески автомобилей высокий. Оценочный срок устранения: 2-3 дня.' },
  { id: 'm2', coords: [43.2340, 76.8960], category: 'lighting',  severity: 'high',     label: 'Фонарь',   address: 'пр. Достык 18',      ai: '3 фонарных столба не работают уже 12 дней. Создаёт опасность в ночное время. Ответственный: АО "Алматыэнергосбыт". Срок реакции: 5 дней.' },
  { id: 'm3', coords: [43.2410, 76.8760], category: 'waste',     severity: 'high',     label: 'Свалка',   address: 'ул. Тимирязева 5',   ai: 'Стихийная свалка объёмом ~3 м³. Нарушение санитарных норм. Требуется вывоз мусора и дезинфекция территории. Срок: 48 часов.' },
  { id: 'm4', coords: [43.2300, 76.9030], category: 'greenery',  severity: 'medium',   label: 'Граффити', address: 'ул. Гоголя 22',       ai: 'Граффити на фасаде административного здания, площадь ~8 м². Ухудшает эстетику квартала. Рекомендуется очистка или перекраска. Срок: 7 дней.' },
  { id: 'm5', coords: [43.2490, 76.9010], category: 'resolved',  severity: 'resolved', label: 'Решено',   address: 'пр. Аль-Фараби 77',  ai: 'Проблема успешно устранена силами коммунальных служб за 18 часов. Отличный показатель работы ЖКХ Бостандыкского района.' },
  { id: 'm6', coords: [43.2390, 76.8880], category: 'road',      severity: 'medium',   label: 'Выбоина',  address: 'ул. Байзакова 31',    ai: 'Множественные трещины асфальта на участке 15 м². Рекомендован плановый ремонт в течение 7 дней до ухудшения состояния.' },
];

const SEV_LABEL = {
  critical: 'Критично', high: 'Высокий', medium: 'Средний',
  low: 'Низкий', resolved: 'Решено',
};

function makeBalloon(pin) {
  const catColor = CATEGORY_COLOR[pin.type] ?? CATEGORY_COLOR.other;
  const pinCfg   = PIN_COLOR[pin.severity]  ?? PIN_COLOR.medium;
  const sevLabel = SEV_LABEL[pin.severity]  ?? '';

  return `
    <div style="
      font-family:'DM Sans',system-ui,sans-serif;
      min-width:260px;max-width:300px;
      background:rgba(255,255,255,0.92);
      backdrop-filter:blur(20px);
      -webkit-backdrop-filter:blur(20px);
      border:1px solid rgba(226,232,224,0.9);
      border-radius:14px;overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,0.1),0 1px 0 rgba(255,255,255,0.8) inset;
    ">
      <div style="height:3px;background:${catColor};"></div>
      <div style="padding:14px 16px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:14px;font-weight:600;color:#0f172a;line-height:1.3;">${pin.label}</div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:3px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style="font-size:11px;color:#94a3b8;">${pin.address}</span>
            </div>
          </div>
          ${sevLabel ? `
          <div style="
            padding:3px 8px;border-radius:999px;
            background:${pinCfg.color}14;
            border:1px solid ${pinCfg.color}33;
            font-size:10px;font-weight:600;color:${pinCfg.color};
            white-space:nowrap;flex-shrink:0;
          ">${sevLabel}</div>` : ''}
        </div>
        ${pin.ai ? `
        <div style="
          background:#f8f9f6;border:1px solid #e2e8e0;
          border-radius:10px;padding:10px 12px;
        ">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${catColor}" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>
            </svg>
            <span style="font-size:10px;font-weight:600;color:${catColor};letter-spacing:0.4px;text-transform:uppercase;">ИИ-анализ</span>
          </div>
          <div style="font-size:12px;color:#64748b;line-height:1.6;">${pin.ai}</div>
        </div>` : ''}
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════
   COMPONENT
════════════════════════════════════════ */
export default function YandexMap({
  reports = [],
  interactive = false,
  onLocationSelect,
}) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const userPlacemark = useRef(null);
  const [selectedAddress, setSelectedAddress] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    const initMap = () => {
      if (mapRef.current) return;

      const map = new window.ymaps.Map(
        containerRef.current,
        { center: [43.238949, 76.889709], zoom: 13, controls: ['zoomControl'] },
        { suppressMapOpenBlock: true }
      );
      mapRef.current = map;

      /* ── Pins ── */
      const pinsToRender = reports.length > 0 ? reports : MOCK_PINS;
      pinsToRender.forEach(pin => {
        const coords = pin.coords ?? (pin.lat && pin.lng ? [pin.lat, pin.lng] : null);
        if (!coords) return;

        const sev   = pin.severity ?? (pin.status === 'resolved' ? 'resolved' : 'medium');
        const cfg   = PIN_COLOR[sev] ?? PIN_COLOR.medium;
        const svg   = pinSvg(cfg.color, cfg.pulse);
        const href  = `data:image/svg+xml,${encodeURIComponent(svg)}`;

        const pm = new window.ymaps.Placemark(
          coords,
          {
            balloonContentHeader: '',
            balloonContentBody: makeBalloon({
              label:    pin.label    ?? pin.type       ?? 'Проблема',
              address:  pin.address  ?? '',
              ai:       pin.ai       ?? pin.ai_comment ?? '',
              category: pin.type ?? 'other',
              severity: sev,
            }),
            balloonContentFooter: '',
          },
          {
            iconLayout:      'default#image',
            iconImageHref:   href,
            iconImageSize:   [36, 44],
            iconImageOffset: [-18, -44],
            balloonPanelMaxMapArea: 0,
          }
        );
        map.geoObjects.add(pm);
      });

      /* ── Interactive click-to-pin ── */
      if (interactive) {
        map.events.add('click', async e => {
          const coords = e.get('coords');

          if (userPlacemark.current) map.geoObjects.remove(userPlacemark.current);

          const svg  = pinSvg('#0f172a', false);
          const userPin = new window.ymaps.Placemark(
            coords,
            { hintContent: 'Место проблемы' },
            {
              iconLayout:      'default#image',
              iconImageHref:   `data:image/svg+xml,${encodeURIComponent(svg)}`,
              iconImageSize:   [36, 44],
              iconImageOffset: [-18, -44],
              draggable: true,
            }
          );
          map.geoObjects.add(userPin);
          userPlacemark.current = userPin;

          userPin.events.add('dragend', async () => {
            await resolveAndNotify(userPin.geometry.getCoordinates());
          });

          await resolveAndNotify(coords);
        });

        async function resolveAndNotify(coords) {
          try {
            const result  = await window.ymaps.geocode(coords);
            const address = result.geoObjects.get(0).getAddressLine();
            setSelectedAddress(address);
            onLocationSelect?.({ lat: coords[0], lng: coords[1], address });
          } catch {
            const address = `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
            setSelectedAddress(address);
            onLocationSelect?.({ lat: coords[0], lng: coords[1], address });
          }
        }
      }
    };

    if (window.ymaps) {
      window.ymaps.ready(initMap);
    } else {
      const check = setInterval(() => {
        if (window.ymaps) { clearInterval(check); window.ymaps.ready(initMap); }
      }, 100);
    }

    return () => {
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* "Click to mark" hint */}
      {interactive && !selectedAddress && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(226,232,224,0.9)',
          color: '#64748b', borderRadius: 999,
          padding: '6px 16px',
          fontSize: 12, fontWeight: 500,
          pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          Кликните на карту, чтобы отметить место
        </div>
      )}

      {/* Selected address bar */}
      {interactive && selectedAddress && (
        <div style={{
          position: 'absolute', bottom: 14, left: 14, right: 14,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(226,232,224,0.9)',
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'rgba(37,99,235,0.08)',
            border: '1px solid rgba(37,99,235,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 500, lineHeight: 1.4 }}>
            {selectedAddress}
          </span>
        </div>
      )}
    </div>
  );
}
