const PIN_COLOR = {
  critical: { color: '#dc2626', pulse: true },
  high: { color: '#d97706', pulse: false },
  medium: { color: '#2563eb', pulse: false },
  low: { color: '#7c3aed', pulse: false },
  resolved: { color: '#16a34a', pulse: false },
};

const CATEGORY_COLOR = {
  road: '#dc2626',
  lighting: '#d97706',
  waste: '#ea580c',
  greenery: '#16a34a',
  utilities: '#2563eb',
  vandal: '#8b5cf6',
  parking: '#0f766e',
  resolved: '#16a34a',
  other: '#64748b',
};

const HOTSPOT_ROUTE_STYLES = {
  government: { fill: 'rgba(248,113,113,0.16)', stroke: '#ef4444', badge: '#dc2626' },
  business: { fill: 'rgba(16,185,129,0.16)', stroke: '#10b981', badge: '#059669' },
  shared: { fill: 'rgba(245,158,11,0.18)', stroke: '#f59e0b', badge: '#d97706' },
};

export function normalizeCategory(value) {
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

export function normalizeSeverityKey(value, status) {
  if (status === 'resolved' || status === 'verified') return 'resolved';
  const source = String(value ?? '').toLowerCase();
  if (source.includes('крит') || source === 'critical') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
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

export function pinSvg(typeColor, severityColor, pulse, {
  type = 'other',
  selected = false,
  resolved = false,
  motionKey = 'pin',
} = {}) {
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

export function pinSize(isSelected) {
  return isSelected ? [44, 56] : [40, 52];
}

export function pinOffset(isSelected) {
  return isSelected ? [-22, -50] : [-20, -46];
}

export function getPinVisualMeta(pin, selectedReportId = null) {
  const severityKey = normalizeSeverityKey(pin?.severity, pin?.status);
  const severity = PIN_COLOR[severityKey] ?? PIN_COLOR.medium;
  const type = normalizeCategory(pin?.category ?? pin?.type);
  const typeColor = severityKey === 'resolved'
    ? CATEGORY_COLOR.resolved
    : CATEGORY_COLOR[type] ?? CATEGORY_COLOR.other;
  const isSelected = selectedReportId != null && String(pin.id) === String(selectedReportId);

  return {
    severityKey,
    severity,
    type,
    typeColor,
    isSelected,
  };
}

export function getHotspotStyle(routeHint = 'government') {
  return HOTSPOT_ROUTE_STYLES[routeHint] ?? HOTSPOT_ROUTE_STYLES.government;
}

export function hotspotBadgeSvg(hotspot = {}) {
  const style = getHotspotStyle(hotspot.route_hint);
  const count = hotspot.count ?? 0;
  const pressure = hotspot.pressure_label ?? 'Горячая зона';
  const summary = hotspot.summary ?? '';
  const summaryText = summary.length > 23 ? `${summary.slice(0, 23)}…` : summary;
  const pressureText = pressure.length > 18 ? `${pressure.slice(0, 18)}…` : pressure;

  return `
<svg width="124" height="54" viewBox="0 0 124 54" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="hotspot-shadow" x="-30%" y="-40%" width="160%" height="200%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <g filter="url(#hotspot-shadow)">
    <rect x="36" y="8" width="80" height="34" rx="17" fill="rgba(255,255,255,0.94)" stroke="rgba(226,232,240,0.95)"/>
    <circle cx="27" cy="26" r="18" fill="${style.badge}" />
    <circle cx="27" cy="26" r="13.5" fill="rgba(255,255,255,0.16)" />
    <text x="27" y="30" text-anchor="middle" font-size="15" font-weight="700" font-family="Inter, Arial, sans-serif" fill="#ffffff">${count}</text>
    <text x="48" y="22" font-size="10" font-weight="700" font-family="Inter, Arial, sans-serif" fill="#475569">${pressureText}</text>
    <text x="48" y="33" font-size="9.5" font-weight="600" font-family="Inter, Arial, sans-serif" fill="#0f172a">${summaryText}</text>
  </g>
</svg>`;
}

export function buildHeatmapLayerConfig(heatmapPoints = []) {
  if (!Array.isArray(heatmapPoints) || heatmapPoints.length === 0) return null;

  const maxWeight = Math.max(...heatmapPoints.map(point => Number(point.weight) || 0), 0.75);
  const averageWeight =
    heatmapPoints.reduce((sum, point) => sum + (Number(point.weight) || 0), 0) / heatmapPoints.length;

  const radius =
    heatmapPoints.length >= 18 ? 48
      : heatmapPoints.length >= 10 ? 42
        : 36;

  const midpoint =
    maxWeight >= 1.2 || averageWeight >= 0.82 ? 0.22
      : maxWeight >= 0.9 ? 0.26
        : 0.3;

  return {
    featureCollection: {
      type: 'FeatureCollection',
      features: heatmapPoints.map(point => ({
        type: 'Feature',
        id: point.id,
        geometry: {
          type: 'Point',
          coordinates: [point.lat, point.lng],
        },
        properties: {
          weight: Math.max(0.18, Math.min(1.8, (Number(point.weight) || 0.2) * 1.18)),
        },
      })),
    },
    options: {
      radius,
      opacity: 0.78,
      dissipating: false,
      intensityOfMidpoint: midpoint,
      gradient: {
        0.08: 'rgba(255,247,237,0.08)',
        0.22: 'rgba(254,215,170,0.22)',
        0.42: 'rgba(251,191,36,0.42)',
        0.62: 'rgba(249,115,22,0.6)',
        0.82: 'rgba(239,68,68,0.8)',
        1.0: 'rgba(127,29,29,0.94)',
      },
    },
  };
}
