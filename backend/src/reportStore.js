import { randomUUID } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_PATH = join(__dirname, '../data/reports.json');

export const VALID_STATUSES = ['new', 'in_progress', 'resolved', 'rejected'];
export const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const VALID_CATEGORIES = ['road', 'lighting', 'greenery', 'utilities', 'waste', 'other'];

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

function toStringOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

  return {
    title,
    description,
    category,
    severity,
    status,
    address,
    image: normalizeImage(payload.image, payload.media_type),
    comment,
    estimated_resolution_days: estimatedResolutionDays,
    recommendations: normalizeRecommendations(payload.recommendations ?? payload.recommended_action, category, severity),
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

export async function updateReportStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const reports = await readReports();
  const index = reports.findIndex(report => report.id === id);

  if (index === -1) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    throw err;
  }

  reports[index] = {
    ...reports[index],
    status,
    updated_at: new Date().toISOString(),
  };

  await writeReports(reports);
  return reports[index];
}
