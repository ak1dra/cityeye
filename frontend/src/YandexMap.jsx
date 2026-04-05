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
  vandal:    '#8b5cf6',
  parking:   '#0f766e',
  resolved:  '#16a34a',
  other:     '#64748b',
};

function normalizeCategory(value) {
  const source = String(value ?? '').toLowerCase();
  if (source.includes('road') || source.includes('яма') || source.includes('дорог')) return 'road';
  if (source.includes('light') || source.includes('осв')) return 'lighting';
  if (source.includes('waste') || source.includes('мусор') || source.includes('trash')) return 'waste';
  if (source.includes('green') || source.includes('зелен')) return 'greenery';
  if (source.includes('util') || source.includes('коммун') || source.includes('water')) return 'utilities';
  if (source.includes('park') || source.includes('парков')) return 'parking';
  if (source.includes('vandal') || source.includes('графф') || source.includes('ванд')) return 'vandal';
  return 'other';
}

function categoryIconSvg(type, strokeColor, resolved = false) {
  if (resolved) {
    return `<path d="M16.1 18.7l2 2 4.2-4.8" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  switch (type) {
    case 'road':
      return `
        <path d="M18 15.4l-.7 5.6" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M20 15.4l.7 5.6" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M19 16.8v1.5" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M19 19.6v1.2" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
      `;
    case 'lighting':
      return `
        <path d="M19 15.1a2.5 2.5 0 00-2 4c.4.5.7.9.7 1.4h2.6c0-.5.3-.9.7-1.4a2.5 2.5 0 00-2-4z" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17.8 21.6h2.4" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
      `;
    case 'waste':
      return `
        <path d="M16.2 16h5.6" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M17 16l.5 5.2h3l.5-5.2" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17.8 14.4h2.4" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
      `;
    case 'greenery':
      return `
        <path d="M21.9 15.6c-3.4-.4-5.4 1.4-5.8 4.7 3.5.4 5.4-1.4 5.8-4.7z" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17.8 20.5c.7-1.1 1.6-2.1 2.9-3" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
      `;
    case 'utilities':
      return `
        <path d="M19 14.6c1.2 1.5 2 2.6 2 3.7a2 2 0 11-4 0c0-1.1.8-2.2 2-3.7z" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    case 'parking':
      return `
        <rect x="16.1" y="14.8" width="5.8" height="7.4" rx="2" stroke="${strokeColor}" stroke-width="1.8" fill="none"/>
        <path d="M18 20.9v-4.6h1.5a1.4 1.4 0 010 2.8H18" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    case 'vandal':
      return `
        <path d="M16.4 21l5.4-5.4.9.9-5.4 5.4-1.9.4z" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20.9 14.9l1.3 1.3" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
      `;
    default:
      return `
        <path d="M17.1 20.9c1-1.2 2-2.2 3.7-3.2" stroke="${strokeColor}" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="19" cy="18.1" r="1.7" stroke="${strokeColor}" stroke-width="1.8" fill="none"/>
      `;
  }
}

function animationSeed(value) {
  const input = String(value ?? 'pin');
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 9973;
  }
  return hash;
}

/* ── Hand-drawn outline pin ── */
function pinSvg(
  typeColor,
  severityColor,
  pulse,
  {
    type = 'other',
    selected = false,
    resolved = false,
    motionKey = 'pin',
  } = {}
) {
  const seed = animationSeed(motionKey);
  const begin = `${(seed % 12) / 10}s`;
  const duration = `${3 + (seed % 4) * 0.18}s`;
  const floatAmplitude = selected ? '-1.8' : '-1.1';
  const iconStroke = resolved ? '#16a34a' : typeColor;
  const accentOpacity = selected ? 0.42 : 0.3;
  const pulseOpacity = selected ? 0.16 : pulse ? 0.12 : 0;
  const pulseMax = selected ? 18 : 15.5;
  const stroke = '#0b0f19';

  return `
<svg width="44" height="56" viewBox="0 0 44 56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="pin-shadow" x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#0f172a" flood-opacity="${selected ? '0.22' : '0.16'}"/>
    </filter>
    <filter id="pin-soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.2"/>
    </filter>
  </defs>
  <ellipse cx="22" cy="49.5" rx="${selected ? '7.6' : '6.7'}" ry="${selected ? '2.8' : '2.4'}" fill="#0f172a" opacity="0.11">
    <animate attributeName="opacity" values="0.11;0.07;0.11" dur="${duration}" begin="${begin}" repeatCount="indefinite"/>
  </ellipse>
  ${pulseOpacity > 0 ? `
    <circle cx="22" cy="20" r="10.5" fill="${resolved ? '#16a34a' : severityColor}" opacity="${pulseOpacity}" filter="url(#pin-soft)">
      <animate attributeName="r" values="10.5;${pulseMax};10.5" dur="${selected ? '1.8s' : '2.3s'}" begin="${begin}" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="${pulseOpacity};0.01;${pulseOpacity}" dur="${selected ? '1.8s' : '2.3s'}" begin="${begin}" repeatCount="indefinite"/>
    </circle>
  ` : ''}
  <g filter="url(#pin-shadow)">
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 ${floatAmplitude};0 0" dur="${duration}" begin="${begin}" repeatCount="indefinite"/>
      <path d="M12.8 15.4c-2.9 2.8-4.4 6-4.2 9.5.3 5 3.8 8.8 9.6 14.2 5.9-5.4 9.3-9.2 9.7-14.2.2-3.5-1.4-6.7-4.2-9.5" fill="none" stroke="${stroke}" stroke-width="${selected ? '3.1' : '2.9'}" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="18.2" cy="18" r="${selected ? '8.8' : '8.3'}" fill="${stroke}"/>
      <circle cx="18.2" cy="18" r="${selected ? '3.7' : '3.5'}" fill="white"/>
      <path d="M18.2 26.9v14.6" stroke="${stroke}" stroke-width="${selected ? '3.1' : '2.9'}" stroke-linecap="round"/>
      <path d="M7.8 9.8c1.8-3.1 5-4.9 8.7-4.9 2.6 0 4.7.5 6.7 1.7" fill="none" stroke="${iconStroke}" stroke-width="3" stroke-linecap="round" opacity="${accentOpacity}"/>
      <path d="M6.8 12.1c1.5-2.4 3.5-3.9 6-4.8" fill="none" stroke="${iconStroke}" stroke-width="3.2" stroke-linecap="round" opacity="${accentOpacity}"/>
      <g transform="translate(0.6 0.2)">
        ${selected || resolved ? categoryIconSvg(type, iconStroke, resolved) : ''}
      </g>
    </g>
  </g>
</svg>`;
}

function pinSize(isSelected) {
  return isSelected ? [44, 56] : [40, 52];
}

function pinOffset(isSelected) {
  return isSelected ? [-22, -50] : [-20, -46];
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

function normalizeSeverityKey(value, status) {
  if (status === 'resolved' || status === 'verified') return 'resolved';
  const source = String(value ?? '').toLowerCase();
  if (source.includes('крит') || source === 'critical') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
}

/* ════════════════════════════════════════
   COMPONENT
════════════════════════════════════════ */
export default function YandexMap({
  reports = [],
  heatmapPoints = [],
  heatmapMode = 'pins',
  interactive = false,
  onLocationSelect,
  useMockWhenEmpty = true,
  selectedReportId = null,
  onReportSelect,
}) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const userPlacemark = useRef(null);
  const pinsRef       = useRef([]);
  const heatmapRef    = useRef(null);
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

      /* ── Interactive click-to-pin ── */
      if (interactive) {
        map.events.add('click', async e => {
          const coords = e.get('coords');

          if (userPlacemark.current) map.geoObjects.remove(userPlacemark.current);

          const svg  = pinSvg('#64748b', '#0f172a', false, {
            type: 'other',
            selected: true,
            motionKey: 'interactive-pin',
          });
          const userPin = new window.ymaps.Placemark(
            coords,
            { hintContent: 'Место проблемы' },
            {
              iconLayout:      'default#image',
              iconImageHref:   `data:image/svg+xml,${encodeURIComponent(svg)}`,
              iconImageSize:   [44, 56],
              iconImageOffset: [-22, -50],
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
      if (heatmapRef.current?.destroy) {
        heatmapRef.current.destroy();
      }
      heatmapRef.current = null;
      if (mapRef.current) { mapRef.current.destroy(); mapRef.current = null; }
      pinsRef.current = [];
    };
  }, [interactive, onLocationSelect]);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;

    pinsRef.current.forEach(pinObject => mapRef.current.geoObjects.remove(pinObject.placemark));
    pinsRef.current = [];

     if (heatmapMode === 'heatmap') return;

    const pinsToRender = reports.length > 0 || !useMockWhenEmpty ? reports : MOCK_PINS;
    pinsToRender.forEach(pin => {
      const coords = pin.coords ?? (pin.lat && pin.lng ? [pin.lat, pin.lng] : null);
      if (!coords) return;

      const severity = normalizeSeverityKey(pin.severity, pin.status);
      const cfg = PIN_COLOR[severity] ?? PIN_COLOR.medium;
      const type = normalizeCategory(pin.category ?? pin.type);
      const typeColor = severity === 'resolved'
        ? CATEGORY_COLOR.resolved
        : CATEGORY_COLOR[type] ?? CATEGORY_COLOR.other;
      const isSelected = selectedReportId != null && String(pin.id) === String(selectedReportId);
      const svg = pinSvg(typeColor, cfg.color, cfg.pulse, {
        type,
        selected: isSelected,
        resolved: severity === 'resolved',
        motionKey: pin.id ?? `${coords[0]}-${coords[1]}`,
      });
      const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;

      const pm = new window.ymaps.Placemark(
        coords,
        {
          hintContent: pin.detected_issue_title ?? pin.label ?? pin.type ?? 'Проблема',
        },
        {
          iconLayout: 'default#image',
          iconImageHref: href,
          iconImageSize: pinSize(isSelected),
          iconImageOffset: pinOffset(isSelected),
          hideIconOnBalloonOpen: false,
        }
      );

      if (onReportSelect) {
        pm.events.add('click', () => {
          onReportSelect(pin);
        });
      }

      mapRef.current.geoObjects.add(pm);
      pinsRef.current.push({ id: pin.id, placemark: pm, report: pin });
    });
  }, [reports, onReportSelect, selectedReportId, useMockWhenEmpty, heatmapMode]);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined' || !window.ymaps) return;

    if (heatmapMode === 'pins' || heatmapPoints.length === 0) {
      heatmapRef.current?.setMap?.(null);
      return;
    }

    let cancelled = false;
    const featureCollection = {
      type: 'FeatureCollection',
      features: heatmapPoints.map(point => ({
        type: 'Feature',
        id: point.id,
        geometry: {
          type: 'Point',
          coordinates: [point.lat, point.lng],
        },
        properties: {
          weight: point.weight,
        },
      })),
    };

    window.ymaps.modules.require(['Heatmap'], Heatmap => {
      if (cancelled || !mapRef.current) return;

      if (!heatmapRef.current) {
        heatmapRef.current = new Heatmap(featureCollection, {
          radius: 34,
          opacity: 0.72,
          dissipating: false,
          intensityOfMidpoint: 0.28,
          gradient: {
            0.15: 'rgba(255,237,213,0.24)',
            0.35: 'rgba(251,191,36,0.38)',
            0.6: 'rgba(249,115,22,0.52)',
            0.85: 'rgba(239,68,68,0.72)',
            1.0: 'rgba(153,27,27,0.86)',
          },
        });
      } else {
        heatmapRef.current.setData(featureCollection);
      }

      heatmapRef.current.setMap(mapRef.current);
    });

    return () => {
      cancelled = true;
    };
  }, [heatmapPoints, heatmapMode]);

  useEffect(() => {
    if (!mapRef.current || interactive) return;

    const selectedEntry = selectedReportId == null
      ? null
      : pinsRef.current.find(entry => String(entry.id) === String(selectedReportId));

    if (!selectedEntry?.placemark) return;

    const coords = selectedEntry.placemark.geometry?.getCoordinates?.();
    if (coords) {
      mapRef.current.setCenter(coords, Math.max(mapRef.current.getZoom(), 14), { duration: 250 });
    }
  }, [selectedReportId, interactive, reports]);

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
