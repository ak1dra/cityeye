import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_PATH = join(__dirname, '../data/reports.json');

export const VALID_STATUSES = ['new', 'triage', 'in_progress', 'waiting_partner', 'resolved', 'verified', 'rejected'];
export const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const VALID_CATEGORIES = ['road', 'lighting', 'greenery', 'utilities', 'waste', 'other'];
export const VALID_REPORTER_ROLES = ['citizen', 'government', 'business'];
export const VALID_RESPONSIBLE_ROLES = ['government', 'business', 'shared'];
export const VALID_CONFIDENCE_LABELS = ['high', 'medium', 'low'];
export const PATCHABLE_REPORT_FIELDS = [
  'title',
  'description',
  'type',
  'category',
  'severity',
  'status',
  'address',
  'comment',
  'image',
  'image_url',
  'completion_image_url',
  'partner_comment',
  'priority_score',
  'detected_issue_title',
  'ai_comment',
  'recommended_action',
  'estimated_fix_time',
  'responsible_dept',
  'risk_for',
  'duplicate_likely',
  'suggested_responsible_role',
  'confidence_label',
  'estimated_resolution_days',
  'recommendations',
  'lat',
  'lng',
  'user_email',
  'user_name',
  'reporter_role',
  'reporter_org_name',
  'responsible_role',
  'assigned_org_name',
  'shared_case',
];

const CATEGORY_ALIASES = new Map([
  ['road', 'road'],
  ['roads', 'road'],
  ['pothole', 'road'],
  ['parking', 'road'],
  ['дорож', 'road'],
  ['яма', 'road'],
  ['парков', 'road'],
  ['lighting', 'lighting'],
  ['light', 'lighting'],
  ['освещ', 'lighting'],
  ['фонар', 'lighting'],
  ['greenery', 'greenery'],
  ['green', 'greenery'],
  ['зелен', 'greenery'],
  ['дерев', 'greenery'],
  ['utilities', 'utilities'],
  ['utility', 'utilities'],
  ['коммун', 'utilities'],
  ['вода', 'utilities'],
  ['канализ', 'utilities'],
  ['waste', 'waste'],
  ['trash', 'waste'],
  ['garbage', 'waste'],
  ['мусор', 'waste'],
  ['свалк', 'waste'],
  ['other', 'other'],
  ['другое', 'other'],
]);

const SEVERITY_ALIASES = new Map([
  ['critical', 'critical'],
  ['crit', 'critical'],
  ['критично', 'critical'],
  ['критический', 'critical'],
  ['высоко', 'high'],
  ['high', 'high'],
  ['medium', 'medium'],
  ['mid', 'medium'],
  ['средне', 'medium'],
  ['средний', 'medium'],
  ['low', 'low'],
  ['низко', 'low'],
  ['низкий', 'low'],
]);

const REPORTER_ROLE_ALIASES = new Map([
  ['citizen', 'citizen'],
  ['user', 'citizen'],
  ['resident', 'citizen'],
  ['граждан', 'citizen'],
  ['government', 'government'],
  ['gov', 'government'],
  ['state', 'government'],
  ['акимат', 'government'],
  ['business', 'business'],
  ['company', 'business'],
  ['private', 'business'],
  ['бизнес', 'business'],
  ['ук', 'business'],
]);

const RESPONSIBLE_ROLE_ALIASES = new Map([
  ['government', 'government'],
  ['gov', 'government'],
  ['акимат', 'government'],
  ['business', 'business'],
  ['private', 'business'],
  ['company', 'business'],
  ['бизнес', 'business'],
  ['shared', 'shared'],
  ['joint', 'shared'],
  ['совмест', 'shared'],
]);

function toStringOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumberOrNull(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toBooleanOrNull(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'да'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'нет'].includes(normalized)) return false;
  }

  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function includesAny(source, markers) {
  return markers.some(marker => source.includes(marker));
}

function defaultTitleByCategory(category) {
  const titles = {
    road: 'Проблема дорожной инфраструктуры',
    lighting: 'Проблема уличного освещения',
    greenery: 'Проблема озеленения',
    utilities: 'Проблема коммунальных сетей',
    waste: 'Проблема с мусором',
    other: 'Городская инфраструктурная проблема',
  };
  return titles[category] ?? titles.other;
}

function defaultDescriptionByCategory(category, address, comment) {
  const base = {
    road: 'Обнаружен дефект дорожного покрытия или организации движения.',
    lighting: 'Обнаружена неисправность уличного освещения.',
    greenery: 'Обнаружена проблема с зелёными насаждениями или благоустройством.',
    utilities: 'Обнаружена неисправность коммунальной инфраструктуры.',
    waste: 'Обнаружено нарушение санитарного состояния территории.',
    other: 'Обнаружена проблема городской инфраструктуры.',
  };

  const pieces = [base[category] ?? base.other];
  if (address) pieces.push(`Адрес: ${address}.`);
  if (comment) pieces.push(`Комментарий пользователя: ${comment}.`);
  return pieces.join(' ');
}

function defaultRecommendations(category, severity) {
  const urgency =
    severity === 'critical'
      ? 'Выполнить выезд и первичные меры в течение 24 часов.'
      : severity === 'high'
        ? 'Поставить в приоритет и назначить исполнителя на ближайшие 1-2 дня.'
        : severity === 'medium'
          ? 'Добавить в план работ на ближайшую неделю.'
          : 'Включить в плановое обслуживание.';

  const byCategory = {
    road: 'Оградить опасный участок и направить дорожную бригаду.',
    lighting: 'Проверить линию питания и заменить неисправные элементы.',
    greenery: 'Провести выездной осмотр и организовать работы по благоустройству.',
    utilities: 'Проверить коммуникации и оформить заявку в профильную службу.',
    waste: 'Организовать вывоз отходов и уборку прилегающей территории.',
    other: 'Назначить профильное подразделение для детальной проверки.',
  };

  return [urgency, byCategory[category] ?? byCategory.other];
}

function defaultPriorityScore(severity) {
  if (severity === 'critical') return 90;
  if (severity === 'high') return 70;
  if (severity === 'low') return 20;
  return 50;
}

export async function readReports() {
  try {
    const raw = await readFile(REPORTS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeReports(reports) {
  await writeFile(REPORTS_PATH, JSON.stringify(reports, null, 2));
}

export function normalizeCategory(value) {
  const source = (toStringOrNull(value) ?? 'other').toLowerCase();

  if (VALID_CATEGORIES.includes(source)) return source;

  for (const [marker, category] of CATEGORY_ALIASES.entries()) {
    if (source.includes(marker)) return category;
  }

  return 'other';
}

export function normalizeSeverity(value, priorityScore) {
  const source = (toStringOrNull(value) ?? '').toLowerCase();

  if (VALID_SEVERITIES.includes(source)) return source;

  for (const [marker, severity] of SEVERITY_ALIASES.entries()) {
    if (source.includes(marker)) return severity;
  }

  const score = Number(priorityScore);
  if (Number.isFinite(score)) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  }

  return 'medium';
}

export function normalizeEstimatedResolutionDays(value, severity = 'medium') {
  if (Number.isFinite(value)) {
    return clamp(Math.round(value), 1, 365);
  }

  const source = toStringOrNull(value);
  if (!source) {
    return severity === 'critical' ? 1 : severity === 'high' ? 2 : severity === 'medium' ? 5 : 10;
  }

  const lower = source.toLowerCase();
  const numbers = lower.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
  const numeric = numbers.length > 0 ? Math.max(...numbers) : null;

  if (numeric == null) {
    return severity === 'critical' ? 1 : severity === 'high' ? 2 : severity === 'medium' ? 5 : 10;
  }

  if (includesAny(lower, ['час', 'hour', 'hr']) || /\d+\s*h\b/.test(lower)) {
    return clamp(Math.ceil(numeric / 24), 1, 365);
  }

  if (includesAny(lower, ['нед', 'week'])) {
    return clamp(numeric * 7, 1, 365);
  }

  return clamp(numeric, 1, 365);
}

export function normalizeRecommendations(value, category, severity) {
  if (Array.isArray(value)) {
    const cleaned = value
      .map(toStringOrNull)
      .filter(Boolean)
      .slice(0, 4);

    if (cleaned.length > 0) return cleaned;
  }

  if (typeof value === 'string') {
    const cleaned = value
      .split(/[\n;]+/)
      .map(part => part.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (cleaned.length > 0) return cleaned;
  }

  return defaultRecommendations(category, severity);
}

function normalizeImage(image, mediaType = 'image/jpeg') {
  const raw = toStringOrNull(image);
  if (!raw) return null;

  if (raw.startsWith('data:image/')) return raw;
  return `data:${mediaType};base64,${raw}`;
}

function normalizePriorityScore(value, severity = 'medium') {
  const numeric = toNumberOrNull(value);
  if (numeric == null) return defaultPriorityScore(severity);
  return clamp(Math.round(numeric), 0, 100);
}

function normalizeCoordinate(value, min, max) {
  const numeric = toNumberOrNull(value);
  if (numeric == null) return null;
  return clamp(numeric, min, max);
}

function normalizeReporterRole(value, fallback = 'citizen') {
  const source = (toStringOrNull(value) ?? fallback).toLowerCase();

  if (VALID_REPORTER_ROLES.includes(source)) return source;

  for (const [marker, role] of REPORTER_ROLE_ALIASES.entries()) {
    if (source.includes(marker)) return role;
  }

  return fallback;
}

function normalizeResponsibleRole(value, fallback = 'government') {
  const source = (toStringOrNull(value) ?? fallback).toLowerCase();

  if (VALID_RESPONSIBLE_ROLES.includes(source)) return source;

  for (const [marker, role] of RESPONSIBLE_ROLE_ALIASES.entries()) {
    if (source.includes(marker)) return role;
  }

  return fallback;
}

function normalizeConfidenceLabel(value, fallback = 'medium') {
  const source = (toStringOrNull(value) ?? fallback).toLowerCase();

  if (VALID_CONFIDENCE_LABELS.includes(source)) return source;
  if (source.includes('выс')) return 'high';
  if (source.includes('низ')) return 'low';
  return 'medium';
}

function normalizeCollaborationFields(payload = {}) {
  const inferredReporterRole =
    payload.user_email === 'business@cityeye.kz'
      ? 'business'
      : payload.user_email === 'gov@cityeye.kz'
        ? 'government'
        : 'citizen';

  const reporterRole = normalizeReporterRole(payload.reporter_role, inferredReporterRole);
  const reporterOrgName = reporterRole === 'business'
    ? toStringOrNull(payload.reporter_org_name ?? payload.user_name)
    : null;

  let responsibleRole = normalizeResponsibleRole(
    payload.responsible_role,
    reporterRole === 'business' ? 'shared' : 'government'
  );

  let sharedCase = toBooleanOrNull(payload.shared_case);
  if (sharedCase == null) sharedCase = responsibleRole === 'shared';
  if (sharedCase) responsibleRole = 'shared';
  if (responsibleRole === 'shared') sharedCase = true;

  let assignedOrgName = toStringOrNull(payload.assigned_org_name);
  if ((responsibleRole === 'business' || responsibleRole === 'shared') && !assignedOrgName) {
    assignedOrgName = reporterRole === 'business' ? reporterOrgName : null;
  }
  if (responsibleRole === 'government') {
    assignedOrgName = null;
  }

  return {
    reporter_role: reporterRole,
    reporter_org_name: reporterOrgName,
    responsible_role: responsibleRole,
    assigned_org_name: assignedOrgName,
    shared_case: sharedCase,
  };
}

export function normalizeReportPayload(payload = {}) {
  const category = normalizeCategory(payload.category ?? payload.problemType ?? payload.type);
  const severity = normalizeSeverity(payload.severity, payload.priority_score);

  const address = toStringOrNull(payload.address);
  const comment = toStringOrNull(payload.comment);
  const title = toStringOrNull(payload.title)
    ?? toStringOrNull(payload.type)
    ?? defaultTitleByCategory(category);

  const description = toStringOrNull(payload.description)
    ?? toStringOrNull(payload.ai_comment)
    ?? defaultDescriptionByCategory(category, address, comment);

  const statusCandidate = toStringOrNull(payload.status)?.toLowerCase();
  const status = VALID_STATUSES.includes(statusCandidate) ? statusCandidate : 'new';

  const estimatedResolutionDays = normalizeEstimatedResolutionDays(
    payload.estimated_resolution_days ?? payload.estimated_fix_time,
    severity
  );

  const userEmail = toStringOrNull(payload.user_email);
  const userName = toStringOrNull(payload.user_name);
  const collaboration = normalizeCollaborationFields({
    ...payload,
    user_email: userEmail,
    user_name: userName,
  });

  return {
    title,
    description,
    type: toStringOrNull(payload.type) ?? title,
    category,
    severity,
    status,
    address,
    lat: normalizeCoordinate(payload.lat, -90, 90),
    lng: normalizeCoordinate(payload.lng, -180, 180),
    image: normalizeImage(payload.image, payload.media_type),
    image_url: toStringOrNull(payload.image_url),
    comment,
    priority_score: normalizePriorityScore(payload.priority_score, severity),
    detected_issue_title: toStringOrNull(payload.detected_issue_title) ?? title,
    ai_comment: toStringOrNull(payload.ai_comment) ?? description,
    recommended_action: toStringOrNull(payload.recommended_action),
    estimated_fix_time: toStringOrNull(payload.estimated_fix_time),
    responsible_dept: toStringOrNull(payload.responsible_dept),
    risk_for: toStringOrNull(payload.risk_for),
    duplicate_likely: toBooleanOrNull(payload.duplicate_likely) ?? false,
    suggested_responsible_role: normalizeResponsibleRole(payload.suggested_responsible_role, collaboration.responsible_role),
    confidence_label: normalizeConfidenceLabel(payload.confidence_label, payload.image || payload.image_url ? 'high' : 'medium'),
    estimated_resolution_days: estimatedResolutionDays,
    recommendations: normalizeRecommendations(payload.recommendations ?? payload.recommended_action, category, severity),
    user_email: userEmail,
    user_name: userName,
    completion_image_url: toStringOrNull(payload.completion_image_url),
    partner_comment: toStringOrNull(payload.partner_comment),
    ...collaboration,
  };
}

export async function createReport(payload = {}) {
  const normalized = normalizeReportPayload(payload);
  const now = new Date().toISOString();
  const report = {
    id: randomUUID(),
    ...normalized,
    created_at: now,
    updated_at: now,
  };

  const reports = await readReports();
  reports.push(report);
  await writeReports(reports);
  return report;
}

export async function updateReport(id, patch = {}) {
  const reports = await readReports();
  const index = reports.findIndex(report => report.id === id);

  if (index === -1) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    throw err;
  }

  const existing = reports[index];
  const normalized = normalizeReportPayload({ ...existing, ...patch });

  reports[index] = {
    ...existing,
    ...normalized,
    updated_at: new Date().toISOString(),
  };

  await writeReports(reports);
  return reports[index];
}

export async function updateReportStatus(id, status, extraFields = {}) {
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  return updateReport(id, { ...extraFields, status });
}
