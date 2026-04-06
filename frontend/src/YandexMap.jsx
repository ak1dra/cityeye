import { useEffect, useRef, useState } from 'react';
import { loadYmapsModule, waitForYmaps } from './lib/yandexMapLoader';
import {
  buildHeatmapLayerConfig,
  getHotspotStyle,
  getPinVisualMeta,
  hotspotBadgeSvg,
  pinOffset,
  pinSize,
  pinSvg,
} from './lib/yandexMapVisuals';

const DEFAULT_CENTER = [43.238949, 76.889709];
const DEFAULT_ZOOM = 13;
const MAP_CONTROLS = ['zoomControl'];

function hasValidCoords(lat, lng) {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && Math.abs(lat) <= 90
    && Math.abs(lng) <= 180
    && !(lat === 0 && lng === 0);
}

function getCoords(pin) {
  if (Array.isArray(pin?.coords) && pin.coords.length === 2) {
    const [lat, lng] = pin.coords.map(Number);
    return hasValidCoords(lat, lng) ? [lat, lng] : null;
  }

  const lat = Number(pin?.lat);
  const lng = Number(pin?.lng);
  return hasValidCoords(lat, lng) ? [lat, lng] : null;
}

function createPinPlacemark(ymaps, pin, selectedReportId) {
  const coords = getCoords(pin);
  if (!coords) return null;

  const { severity, type, typeColor, isSelected, severityKey } = getPinVisualMeta(pin, selectedReportId);
  const svg = pinSvg(typeColor, severity.color, severity.pulse, {
    type,
    selected: isSelected,
    resolved: severityKey === 'resolved',
    motionKey: pin.id ?? `${coords[0]}-${coords[1]}`,
  });

  return new ymaps.Placemark(
    coords,
    {
      hintContent: pin.detected_issue_title ?? pin.label ?? pin.type ?? 'Проблема',
    },
    {
      iconLayout: 'default#image',
      iconImageHref: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      iconImageSize: pinSize(isSelected),
      iconImageOffset: pinOffset(isSelected),
      hideIconOnBalloonOpen: false,
    }
  );
}

function clearPinLayer(map, pinsRef) {
  pinsRef.current.forEach(entry => map.geoObjects.remove(entry.placemark));
  pinsRef.current = [];
}

function clearGeoObjects(map, objectsRef) {
  objectsRef.current.forEach(object => map.geoObjects.remove(object));
  objectsRef.current = [];
}

function destroyHeatmap(heatmapRef) {
  if (heatmapRef.current?.destroy) {
    heatmapRef.current.destroy();
  }
  heatmapRef.current = null;
}

async function resolveAddress(ymaps, coords) {
  try {
    const result = await ymaps.geocode(coords);
    return result.geoObjects.get(0)?.getAddressLine?.() ?? `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
  } catch {
    return `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`;
  }
}

function MapRuntimeOverlay({ mapState, mapError }) {
  if (mapState === 'ready') return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: mapState === 'error' ? 'rgba(248,250,252,0.92)' : 'rgba(241,245,249,0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 30,
      }}
    >
      <div
        style={{
          width: 'min(420px, calc(100% - 32px))',
          borderRadius: 22,
          border: '1px solid rgba(226,232,240,0.95)',
          background: 'rgba(255,255,255,0.94)',
          padding: '22px 24px',
          boxShadow: '0 24px 80px rgba(15,23,42,0.08)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b' }}>
          {mapState === 'error' ? 'Карта недоступна' : 'Загрузка карты'}
        </div>
        <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, lineHeight: 1.2, color: '#0f172a' }}>
          {mapState === 'error' ? 'Не удалось загрузить слой Яндекс Карт' : 'Подключаем карту и тепловой слой'}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: '#475569' }}>
          {mapState === 'error'
            ? (mapError || 'Обновите страницу или проверьте доступность network script для Yandex Maps.')
            : 'Геослой и пины загружаются. Если состояние зависло, выполните жёсткое обновление страницы.'}
        </div>
      </div>
    </div>
  );
}

function HeatmapFallbackNotice({ heatmapNotice, interactive, mapState }) {
  if (!heatmapNotice || mapState !== 'ready') return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: interactive ? 56 : 14,
        right: 14,
        zIndex: 22,
        maxWidth: 320,
        borderRadius: 14,
        border: '1px solid rgba(253,230,138,0.95)',
        background: 'rgba(255,251,235,0.94)',
        padding: '10px 12px',
        boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a16207' }}>
        Fallback
      </div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: '#854d0e' }}>
        {heatmapNotice}
      </div>
    </div>
  );
}

function InteractiveLocationHint({ interactive, selectedAddress }) {
  if (!interactive || selectedAddress) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(226,232,224,0.9)',
        color: '#64748b',
        borderRadius: 999,
        padding: '6px 16px',
        fontSize: 12,
        fontWeight: 500,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      Кликните на карту, чтобы отметить место
    </div>
  );
}

function SelectedAddressOverlay({ interactive, selectedAddress }) {
  if (!interactive || !selectedAddress) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        right: 14,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(226,232,224,0.9)',
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          flexShrink: 0,
          background: 'rgba(37,99,235,0.08)',
          border: '1px solid rgba(37,99,235,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 500, lineHeight: 1.4 }}>
        {selectedAddress}
      </span>
    </div>
  );
}

export default function YandexMap({
  reports = [],
  heatmapPoints = [],
  hotspots = [],
  heatmapMode = 'pins',
  interactive = false,
  onLocationSelect,
  selectedReportId = null,
  onReportSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const userPlacemarkRef = useRef(null);
  const pinsRef = useRef([]);
  const heatmapRef = useRef(null);
  const hotspotObjectsRef = useRef([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [mapState, setMapState] = useState('loading');
  const [mapError, setMapError] = useState('');
  const [heatmapStatus, setHeatmapStatus] = useState('idle');
  const [heatmapNotice, setHeatmapNotice] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return undefined;

    let cancelled = false;
    let mapClickHandler = null;

    const initMap = async () => {
      try {
        setMapState('loading');
        setMapError('');
        setSelectedAddress('');

        const ymaps = await waitForYmaps();
        if (cancelled || mapRef.current) return;

        const map = new ymaps.Map(
          containerRef.current,
          { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, controls: MAP_CONTROLS },
          { suppressMapOpenBlock: true }
        );

        mapRef.current = map;
        setMapState('ready');

        if (!interactive) return;

        const updateSelection = async coords => {
          const address = await resolveAddress(ymaps, coords);
          if (cancelled) return;
          setSelectedAddress(address);
          onLocationSelect?.({ lat: coords[0], lng: coords[1], address });
        };

        mapClickHandler = async event => {
          const coords = event.get('coords');

          if (userPlacemarkRef.current) {
            map.geoObjects.remove(userPlacemarkRef.current);
          }

          const svg = pinSvg('#64748b', '#0f172a', false, {
            type: 'other',
            selected: true,
            motionKey: 'interactive-pin',
          });

          const userPin = new ymaps.Placemark(
            coords,
            { hintContent: 'Место проблемы' },
            {
              iconLayout: 'default#image',
              iconImageHref: `data:image/svg+xml,${encodeURIComponent(svg)}`,
              iconImageSize: [44, 56],
              iconImageOffset: [-22, -50],
              draggable: true,
            }
          );

          map.geoObjects.add(userPin);
          userPlacemarkRef.current = userPin;

          userPin.events.add('dragend', async () => {
            await updateSelection(userPin.geometry.getCoordinates());
          });

          await updateSelection(coords);
        };

        map.events.add('click', mapClickHandler);
      } catch (error) {
        if (cancelled) return;
        setMapState('error');
        setMapError(error?.message || 'Не удалось инициализировать Яндекс Карты. Обновите страницу и проверьте загрузку Yandex Maps script.');
      }
    };

    initMap();

    return () => {
      cancelled = true;

      if (mapRef.current && mapClickHandler) {
        mapRef.current.events.remove('click', mapClickHandler);
      }

      destroyHeatmap(heatmapRef);
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }

      pinsRef.current = [];
      hotspotObjectsRef.current = [];
      userPlacemarkRef.current = null;
    };
  }, [interactive, onLocationSelect]);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined' || mapState !== 'ready') return;

    clearPinLayer(mapRef.current, pinsRef);

    const shouldHidePins = heatmapMode === 'heatmap' && heatmapStatus === 'ready';
    if (shouldHidePins) return;

    const ymaps = window.ymaps;

    reports.forEach(pin => {
      const placemark = createPinPlacemark(ymaps, pin, selectedReportId);
      if (!placemark) return;

      if (onReportSelect) {
        placemark.events.add('click', () => {
          onReportSelect(pin);
        });
      }

      mapRef.current.geoObjects.add(placemark);
      pinsRef.current.push({ id: pin.id, placemark, report: pin });
    });
  }, [heatmapMode, heatmapStatus, mapState, onReportSelect, reports, selectedReportId]);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined' || mapState !== 'ready') return undefined;

    if (heatmapMode === 'pins' || heatmapPoints.length === 0) {
      heatmapRef.current?.setMap?.(null);
      setHeatmapStatus('idle');
      setHeatmapNotice('');
      return undefined;
    }

    const ymaps = window.ymaps;
    const config = buildHeatmapLayerConfig(heatmapPoints);
    if (!config) {
      heatmapRef.current?.setMap?.(null);
      setHeatmapStatus('idle');
      setHeatmapNotice('');
      return undefined;
    }

    let cancelled = false;
    setHeatmapStatus('loading');

    loadYmapsModule(ymaps, 'Heatmap')
      .then(Heatmap => {
        if (cancelled || !mapRef.current) return;

        try {
          destroyHeatmap(heatmapRef);
          heatmapRef.current = new Heatmap(config.featureCollection, config.options);
          heatmapRef.current.setMap(mapRef.current);
          setHeatmapStatus('ready');
          setHeatmapNotice('');
        } catch {
          heatmapRef.current?.setMap?.(null);
          setHeatmapStatus('error');
          setHeatmapNotice('Heatmap временно недоступен. Показываем пины.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        heatmapRef.current?.setMap?.(null);
        setHeatmapStatus('error');
        setHeatmapNotice('Heatmap-модуль не загрузился. Показываем пины.');
      });

    return () => {
      cancelled = true;
    };
  }, [heatmapMode, heatmapPoints, mapState]);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined' || mapState !== 'ready') return;

    clearGeoObjects(mapRef.current, hotspotObjectsRef);

    if (heatmapMode === 'pins' || hotspots.length === 0) return;

    const ymaps = window.ymaps;
    const nextObjects = [];

    hotspots.forEach(hotspot => {
      const style = getHotspotStyle(hotspot.route_hint);
      const radius = Number(hotspot.radius_m) || 180;
      const center = [hotspot.center_lat, hotspot.center_lng];

      const zone = new ymaps.Circle(
        [center, radius],
        {
          hintContent: `${hotspot.label}: ${hotspot.summary}`,
        },
        {
          fillColor: style.fill,
          strokeColor: style.stroke,
          strokeOpacity: 0.7,
          strokeWidth: 2,
          interactivityModel: 'default#transparent',
          zIndex: 1200,
        }
      );

      const badge = new ymaps.Placemark(
        center,
        {
          hintContent: `${hotspot.label}: ${hotspot.summary}`,
          balloonContentHeader: hotspot.label,
          balloonContentBody: `${hotspot.summary}<br/>${hotspot.pressure_label}`,
        },
        {
          iconLayout: 'default#image',
          iconImageHref: `data:image/svg+xml,${encodeURIComponent(hotspotBadgeSvg(hotspot))}`,
          iconImageSize: [124, 54],
          iconImageOffset: [-26, -28],
          hideIconOnBalloonOpen: false,
          zIndex: 1500,
        }
      );

      mapRef.current.geoObjects.add(zone);
      mapRef.current.geoObjects.add(badge);
      nextObjects.push(zone, badge);
    });

    hotspotObjectsRef.current = nextObjects;
  }, [heatmapMode, hotspots, mapState]);

  useEffect(() => {
    if (!mapRef.current || interactive) return;

    const selectedEntry = selectedReportId == null
      ? null
      : pinsRef.current.find(entry => String(entry.id) === String(selectedReportId));

    const coords = selectedEntry?.placemark?.geometry?.getCoordinates?.()
      ?? getCoords(reports.find(report => String(report.id) === String(selectedReportId)));

    if (coords) {
      mapRef.current.setCenter(coords, Math.max(mapRef.current.getZoom(), 14), { duration: 250 });
    }
  }, [interactive, reports, selectedReportId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <MapRuntimeOverlay mapState={mapState} mapError={mapError} />
      <HeatmapFallbackNotice heatmapNotice={heatmapNotice} interactive={interactive} mapState={mapState} />
      <InteractiveLocationHint interactive={interactive} selectedAddress={selectedAddress} />
      <SelectedAddressOverlay interactive={interactive} selectedAddress={selectedAddress} />
    </div>
  );
}
