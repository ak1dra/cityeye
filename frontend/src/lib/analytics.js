const DISTRICT_HINTS = [
  'Медеуский',
  'Бостандыкский',
  'Алмалинский',
  'Жетысуский',
  'Ауэзовский',
  'Турксибский',
  'Алатауский',
  'Наурызбайский',
];

const TYPE_LABELS = {
  road: 'Дороги',
  lighting: 'Освещение',
  waste: 'Мусор',
  greenery: 'Озеленение',
  utilities: 'Коммуналка',
  parking: 'Парковка',
  vandal: 'Вандализм',
  other: 'Другое',
};

const TYPE_COLORS = {
  road: '#ef4444',
  lighting: '#f59e0b',
  waste: '#84cc16',
  greenery: '#22c55e',
  utilities: '#06b6d4',
  parking: '#8b5cf6',
  vandal: '#ec4899',
  other: '#94a3b8',
};

function toLower(value) {
  return String(value ?? '').trim().toLowerCase();
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasValidGeoPoint(lat, lng) {
  return lat != null
    && lng != null
    && Math.abs(lat) <= 90
    && Math.abs(lng) <= 180
    && !(lat === 0 && lng === 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSeverityKey(value, status) {
  if (['resolved', 'verified'].includes(toLower(status))) return 'resolved';
  const source = toLower(value);
  if (source.includes('крит') || source === 'critical') return 'critical';
  if (source.includes('выс') || source === 'high') return 'high';
  if (source.includes('низ') || source === 'low') return 'low';
  return 'medium';
}

function normalizeType(value) {
  const source = toLower(value);
  if (source.includes('road') || source.includes('яма') || source.includes('дорог')) return 'road';
  if (source.includes('light') || source.includes('осв')) return 'lighting';
  if (source.includes('waste') || source.includes('мусор') || source.includes('trash') || source.includes('свалк')) return 'waste';
  if (source.includes('green') || source.includes('зелен')) return 'greenery';
  if (source.includes('util') || source.includes('коммун') || source.includes('water') || source.includes('канализ')) return 'utilities';
  if (source.includes('park') || source.includes('парков')) return 'parking';
  if (source.includes('vandal') || source.includes('ванд') || source.includes('графф')) return 'vandal';
  return 'other';
}

function inferRoute(report = {}) {
  const source = toLower(report.responsible_role ?? report.suggested_responsible_role);
  if (['government', 'business', 'shared'].includes(source)) return source;
  if (report.shared_case) return 'shared';
  return 'government';
}

function isOpenStatus(status) {
  return !['resolved', 'verified', 'rejected'].includes(toLower(status));
}

function extractDistrict(address = '') {
  const lower = toLower(address);
  return DISTRICT_HINTS.find(name => lower.includes(toLower(name).replace('ский', ''))) || null;
}

function buildHeatWeight(report = {}) {
  const severity = normalizeSeverityKey(report.severity, report.status);
  const base =
    severity === 'critical' ? 1.05
      : severity === 'high' ? 0.78
        : severity === 'medium' ? 0.5
          : severity === 'low' ? 0.25
            : 0;

  if (base === 0 || !isOpenStatus(report.status)) return 0;

  const createdAt = report.created_at ? new Date(report.created_at).getTime() : null;
  const ageDays = createdAt ? Math.max(0, (Date.now() - createdAt) / 86400000) : 14;
  const recencyDecay = clamp(1 - (ageDays / 21) * 0.6, 0.35, 1);
  const statusKey = toLower(report.status);
  const priorityScore = toFiniteNumber(report.priority_score);
  const priorityBoost = priorityScore == null
    ? 0
    : clamp((priorityScore - 55) / 180, 0, 0.18);
  const ageBoost =
    ageDays >= 12 ? 0.12
      : ageDays >= 6 ? 0.06
        : 0;
  const executionBoost = ['triage', 'in_progress'].includes(statusKey) ? 0.04 : 0;
  const waitingBonus = toLower(report.status) === 'waiting_partner' ? 0.15 : 0;
  const sharedBonus = inferRoute(report) === 'shared' ? 0.08 : 0;
  const duplicateBoost = report.duplicate_likely ? 0.05 : 0;

  return Number(
    clamp(
      base * recencyDecay + priorityBoost + ageBoost + executionBoost + waitingBonus + sharedBonus + duplicateBoost,
      0.12,
      1.55
    ).toFixed(3)
  );
}

function distanceMeters(left, right) {
  const leftLat = toFiniteNumber(left.lat ?? left.center_lat);
  const leftLng = toFiniteNumber(left.lng ?? left.center_lng);
  const rightLat = toFiniteNumber(right.lat ?? right.center_lat);
  const rightLng = toFiniteNumber(right.lng ?? right.center_lng);
  if (leftLat == null || leftLng == null || rightLat == null || rightLng == null) return Number.POSITIVE_INFINITY;

  const lat1 = (leftLat * Math.PI) / 180;
  const lng1 = (leftLng * Math.PI) / 180;
  const lat2 = (rightLat * Math.PI) / 180;
  const lng2 = (rightLng * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clusterGeoPoints(points = []) {
  const clusters = [];
  for (const point of [...points].sort((left, right) => right.weight - left.weight)) {
    let closest = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      const distance = distanceMeters(point, cluster);
      if (distance <= 320 && distance < closestDistance) {
        closest = cluster;
        closestDistance = distance;
      }
    }

    if (!closest) {
      clusters.push({
        center_lat: point.lat,
        center_lng: point.lng,
        sum_weight: point.weight,
        peak_weight: point.weight,
        count: 1,
        route_counts: { [point.route]: 1 },
        districts: point.district ? { [point.district]: 1 } : {},
        type_counts: { [point.type]: 1 },
      });
      continue;
    }

    const totalWeight = closest.sum_weight + point.weight;
    closest.center_lat = ((closest.center_lat * closest.sum_weight) + (point.lat * point.weight)) / totalWeight;
    closest.center_lng = ((closest.center_lng * closest.sum_weight) + (point.lng * point.weight)) / totalWeight;
    closest.sum_weight = totalWeight;
    closest.peak_weight = Math.max(closest.peak_weight, point.weight);
    closest.count += 1;
    closest.route_counts[point.route] = (closest.route_counts[point.route] ?? 0) + 1;
    closest.type_counts[point.type] = (closest.type_counts[point.type] ?? 0) + 1;
    if (point.district) closest.districts[point.district] = (closest.districts[point.district] ?? 0) + 1;
  }

  return clusters;
}

export function buildGeoHotspotsFromPoints(points = []) {
  const clusters = clusterGeoPoints(points);

  return clusters
    .filter(cluster => cluster.count >= 2 || cluster.sum_weight >= 1.5)
    .sort((left, right) => right.sum_weight - left.sum_weight)
    .slice(0, 6)
    .map((cluster, index) => {
      const dominantDistrict = Object.entries(cluster.districts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const topTypes = Object.entries(cluster.type_counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([type]) => TYPE_LABELS[type] ?? TYPE_LABELS.other);
      const routeHint = Object.entries(cluster.route_counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'government';
      const intensity = Number((cluster.sum_weight / cluster.count).toFixed(2));

      return {
        id: `client-hotspot-${index + 1}`,
        center_lat: Number(cluster.center_lat.toFixed(6)),
        center_lng: Number(cluster.center_lng.toFixed(6)),
        intensity,
        count: cluster.count,
        radius_m:
          cluster.count >= 5 || cluster.sum_weight >= 4.2 ? 310
            : cluster.count >= 3 || cluster.sum_weight >= 2.6 ? 240
              : 180,
        peak_weight: Number(cluster.peak_weight.toFixed(2)),
        top_types: topTypes,
        route_hint: routeHint,
        label: dominantDistrict ? `${dominantDistrict} район` : `Горячая зона ${index + 1}`,
        pressure_label:
          intensity >= 1 ? 'Критическая нагрузка'
            : intensity >= 0.72 ? 'Высокое давление'
              : 'Растущий поток',
        summary: `${cluster.count} кейс(ов) · ${topTypes.join(' / ')}`,
      };
    });

}

function buildGeoAnalytics(reports = []) {
  const geoHeatmapPoints = reports
    .filter(report => isOpenStatus(report.status))
    .map(report => {
      const lat = toFiniteNumber(report.lat);
      const lng = toFiniteNumber(report.lng);
      if (!hasValidGeoPoint(lat, lng)) return null;
      const type = normalizeType(report.type ?? report.category);
      return {
        id: report.id,
        lat,
        lng,
        weight: buildHeatWeight(report),
        type,
        type_label: TYPE_LABELS[type] ?? TYPE_LABELS.other,
        severity: normalizeSeverityKey(report.severity, report.status),
        status: report.status || 'new',
        route: inferRoute(report),
        shared_case: Boolean(report.shared_case || report.responsible_role === 'shared'),
        district: extractDistrict(report.address),
      };
    })
    .filter(point => point && point.weight > 0);

  const hotspots = buildGeoHotspotsFromPoints(geoHeatmapPoints);

  return { geoHeatmapPoints, hotspots };
}

function buildTrend(reports = []) {
  const buckets = new Map();
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { date: key, new: 0, resolved: 0 });
  }

  for (const report of reports) {
    if (!report.created_at) continue;
    const createdAt = new Date(report.created_at);
    const key = `${createdAt.getDate()}.${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.new += 1;
    if (['resolved', 'verified'].includes(toLower(report.status))) bucket.resolved += 1;
  }

  return [...buckets.values()];
}

export function buildClientAnalyticsOverview(reports = []) {
  const total = reports.length;
  const openReports = reports.filter(report => isOpenStatus(report.status));
  const resolvedReports = reports.filter(report => ['resolved', 'verified'].includes(toLower(report.status)));
  const newCnt = reports.filter(report => toLower(report.status) === 'new').length;
  const inProgCnt = reports.filter(report => ['triage', 'in_progress', 'waiting_partner'].includes(toLower(report.status))).length;
  const resolvedCnt = resolvedReports.length;
  const criticalCnt = reports.filter(report => normalizeSeverityKey(report.severity, report.status) === 'critical').length;
  const waitingPartner = reports.filter(report => toLower(report.status) === 'waiting_partner').length;
  const routeBreakdown = {
    government: reports.filter(report => inferRoute(report) === 'government').length,
    business: reports.filter(report => inferRoute(report) === 'business').length,
    shared: reports.filter(report => inferRoute(report) === 'shared').length,
  };
  const severityBreakdown = {
    critical: reports.filter(report => normalizeSeverityKey(report.severity, report.status) === 'critical').length,
    high: reports.filter(report => normalizeSeverityKey(report.severity, report.status) === 'high').length,
    medium: reports.filter(report => normalizeSeverityKey(report.severity, report.status) === 'medium').length,
    low: reports.filter(report => normalizeSeverityKey(report.severity, report.status) === 'low').length,
    resolved: reports.filter(report => normalizeSeverityKey(report.severity, report.status) === 'resolved').length,
  };

  const typeBuckets = new Map();
  const districtBuckets = new Map();
  for (const report of reports) {
    const type = normalizeType(report.type ?? report.category);
    if (!typeBuckets.has(type)) {
      typeBuckets.set(type, { type, label: TYPE_LABELS[type] ?? TYPE_LABELS.other, color: TYPE_COLORS[type] ?? TYPE_COLORS.other, total: 0, open: 0, resolved: 0 });
    }
    const typeBucket = typeBuckets.get(type);
    typeBucket.total += 1;
    if (isOpenStatus(report.status)) typeBucket.open += 1;
    else typeBucket.resolved += 1;

    const district = extractDistrict(report.address) ?? 'Без района';
    if (!districtBuckets.has(district)) {
      districtBuckets.set(district, { district, total: 0, open: 0, resolved: 0 });
    }
    const districtBucket = districtBuckets.get(district);
    districtBucket.total += 1;
    if (isOpenStatus(report.status)) districtBucket.open += 1;
    else districtBucket.resolved += 1;
  }

  const typeBreakdown = [...typeBuckets.values()].sort((left, right) => right.total - left.total);
  const districtBreakdown = [...districtBuckets.values()]
    .filter(bucket => bucket.district !== 'Без района')
    .map(bucket => ({
      ...bucket,
      score: bucket.total > 0 ? Math.round((bucket.resolved / bucket.total) * 100) : 0,
    }))
    .sort((left, right) => right.total - left.total);

  const resolvedWithDates = resolvedReports.filter(report => report.created_at && report.updated_at);
  const slaCompliant = resolvedWithDates.filter(report =>
    ((new Date(report.updated_at).getTime() - new Date(report.created_at).getTime()) / 3600000) <= 72
  ).length;
  const avgResolveHours = resolvedWithDates.length > 0
    ? Math.round(resolvedWithDates.reduce((sum, report) => (
      sum + ((new Date(report.updated_at).getTime() - new Date(report.created_at).getTime()) / 3600000)
    ), 0) / resolvedWithDates.length)
    : 0;
  const slaPercent = resolvedWithDates.length > 0
    ? Math.round((slaCompliant / resolvedWithDates.length) * 100)
    : 0;

  const geo = buildGeoAnalytics(reports);

  return {
    total,
    open: openReports.length,
    resolved: resolvedCnt,
    newCnt,
    inProgCnt,
    resolvedCnt,
    criticalCnt,
    waitingPartner,
    sharedOpen: openReports.filter(report => inferRoute(report) === 'shared').length,
    sharedCnt: routeBreakdown.shared,
    govRoute: routeBreakdown.government,
    busRoute: routeBreakdown.business,
    avgResolveHours,
    slaPercent,
    slaCompliant,
    resolvedCount: resolvedWithDates.length,
    trend: buildTrend(reports),
    typeBreakdown,
    type_breakdown: typeBreakdown,
    severityBreakdown,
    severity_breakdown: severityBreakdown,
    routeBreakdown,
    route_breakdown: routeBreakdown,
    districtBreakdown,
    district_breakdown: districtBreakdown,
    geoHeatmapPoints: geo.geoHeatmapPoints,
    geo_heatmap_points: geo.geoHeatmapPoints,
    hotspots: geo.hotspots,
  };
}
