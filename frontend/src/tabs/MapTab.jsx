import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl:     markerShadowUrl,
});

const SEVERITY_CONFIG = {
  critical: { color: '#EF4444', emoji: '🔴', label: 'Критично' },
  high:     { color: '#F97316', emoji: '🟡', label: 'Высокий' },
  medium:   { color: '#3B82F6', emoji: '🔵', label: 'Средний' },
  low:      { color: '#22C55E', emoji: '🟢', label: 'Решено / Низкий' },
};

const STATUS_LABEL = {
  new:         'Новый',
  in_progress: 'В работе',
  resolved:    'Решён',
  rejected:    'Отклонён',
};

const CATEGORY_LABEL = {
  road: 'Дороги', lighting: 'Освещение', greenery: 'Озеленение',
  utilities: 'Коммуникации', waste: 'Мусор', other: 'Другое',
};

function idToOffset(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const lat = ((h & 0xffff) / 0xffff - 0.5) * 0.06;
  const lng = (((h >> 16) & 0xffff) / 0xffff - 0.5) * 0.08;
  return [lat, lng];
}

const ALMATY = [43.2220, 76.8512];

function coloredIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;
      background:${color};
      border:2.5px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,.25);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const ATTR = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/">OSM</a>';

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 15 });
    }
  }, [positions, map]);
  return null;
}

export default function MapTab({ reports }) {
  const positioned = reports.map(r => {
    const [dlat, dlng] = idToOffset(r.id);
    return { ...r, latlng: [ALMATY[0] + dlat, ALMATY[1] + dlng] };
  });

  const positions = positioned.map(r => r.latlng);

  const counts = {
    critical: reports.filter(r => r.severity === 'critical').length,
    high:     reports.filter(r => r.severity === 'high').length,
    medium:   reports.filter(r => r.severity === 'medium').length,
    low:      reports.filter(r => r.severity === 'low' || r.status === 'resolved').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
            Карта проблем · Алматы
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {reports.length} маркер{reports.length === 1 ? '' : 'ов'} на карте
          </p>
        </div>
      </div>

      {/* Map */}
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--border)', height: 500,
        boxShadow: 'var(--shadow)',
      }}>
        <MapContainer
          center={ALMATY}
          zoom={12}
          style={{ height: '100%', width: '100%', background: '#F8FAFC' }}
        >
          <TileLayer attribution={ATTR} url={TILE} />
          {positions.length > 1 && <FitBounds positions={positions} />}
          {positioned.map(r => {
            const cfg = SEVERITY_CONFIG[r.severity] ?? { color: '#94A3B8' };
            return (
              <Marker key={r.id} position={r.latlng} icon={coloredIcon(cfg.color)}>
                <Popup>
                  <div style={{ minWidth: 200, fontFamily: 'system-ui, sans-serif', padding: 2 }}>
                    <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>{r.title}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                      {CATEGORY_LABEL[r.type] ?? r.type}
                    </div>
                    {r.address && (
                      <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>📍 {r.address}</div>
                    )}
                    <div style={{ marginTop: 8, display: 'flex', gap: 5 }}>
                      <span style={{
                        background: (cfg.color) + '22', color: cfg.color,
                        border: `1px solid ${cfg.color}55`,
                        borderRadius: 4, padding: '2px 8px',
                        fontSize: '0.73rem', fontWeight: 700,
                      }}>
                        {cfg.label ?? r.severity?.toUpperCase()}
                      </span>
                      <span style={{
                        background: '#F1F5F9', borderRadius: 4,
                        padding: '2px 8px', fontSize: '0.73rem', color: '#475569',
                      }}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    {r.description && (
                      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>
                        {r.description.slice(0, 120)}{r.description.length > 120 ? '…' : ''}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend + counters */}
      <div style={{
        background: '#fff', borderRadius: 10, border: '1px solid var(--border)',
        padding: '14px 20px', display: 'flex', gap: 20, flexWrap: 'wrap',
        alignItems: 'center', boxShadow: 'var(--shadow)',
      }}>
        {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: cfg.color, border: '2.5px solid #fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)', flexShrink: 0,
            }} />
            <span style={{ fontSize: '0.84rem', color: 'var(--text)', fontWeight: 500 }}>
              {cfg.label}
            </span>
            <span style={{
              background: 'var(--bg-section)', borderRadius: 10,
              padding: '1px 8px', fontSize: '0.78rem',
              color: 'var(--text-muted)', fontWeight: 600,
            }}>
              {counts[key] ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
