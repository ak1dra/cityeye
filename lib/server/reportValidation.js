import {
  PATCHABLE_REPORT_FIELDS,
  VALID_RESPONSIBLE_ROLES,
  VALID_SEVERITIES,
  VALID_STATUSES,
} from '../../backend/src/reportStore.js';

const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 300;
const VALID_REPORT_VIEWS = ['default', 'map', 'feed', 'gov', 'contractor'];

function toTrimmedString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toCsvArray(value) {
  const normalized = toTrimmedString(value);
  if (!normalized) return [];
  return normalized
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function toBooleanParam(value) {
  const normalized = toTrimmedString(value)?.toLowerCase();
  if (!normalized) return null;
  if (['true', '1', 'yes', 'y', 'да'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'нет'].includes(normalized)) return false;
  return null;
}

function toPositiveInt(value, fallback, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(Math.round(numeric), max));
}

function onlyAllowed(values, allowed) {
  return values.filter(value => allowed.includes(value));
}

function toAllowedValue(value, allowed, fallback) {
  const normalized = toTrimmedString(value)?.toLowerCase();
  if (!normalized) return fallback;
  return allowed.includes(normalized) ? normalized : fallback;
}

export function parseReportListParams(searchParams) {
  const getter = key => {
    if (!searchParams) return null;
    if (typeof searchParams.get === 'function') return searchParams.get(key);
    return searchParams[key] ?? null;
  };

  const statuses = onlyAllowed(toCsvArray(getter('status')), VALID_STATUSES);
  const severities = onlyAllowed(toCsvArray(getter('severity')), VALID_SEVERITIES);
  const responsibleRoles = onlyAllowed(toCsvArray(getter('responsible_role')), VALID_RESPONSIBLE_ROLES);
  const sharedCase = toBooleanParam(getter('shared_case'));
  const search = toTrimmedString(getter('search'));
  const limit = toPositiveInt(getter('limit'), DEFAULT_LIMIT, MAX_LIMIT) || DEFAULT_LIMIT;
  const offset = toPositiveInt(getter('offset'), 0, 100000);
  const view = toAllowedValue(getter('view'), VALID_REPORT_VIEWS, 'default');

  return {
    statuses,
    severities,
    responsibleRoles,
    sharedCase,
    search,
    limit,
    offset,
    view,
  };
}

export function validateCreateReportPayload(payload = {}) {
  const hasMeaningfulInput = ['title', 'description', 'image', 'address', 'comment', 'type', 'category', 'problemType']
    .some(key => typeof payload[key] === 'string' && payload[key].trim().length > 0);

  if (!hasMeaningfulInput) {
    const error = new Error(
      'Provide at least one field: title, description, image, address, comment, type, category, problemType'
    );
    error.statusCode = 400;
    throw error;
  }
}

export function validatePatchReportPayload(payload = {}) {
  const hasPatchField = PATCHABLE_REPORT_FIELDS.some(field =>
    Object.prototype.hasOwnProperty.call(payload, field)
  );

  if (!hasPatchField) {
    const error = new Error(`Provide at least one updatable field: ${PATCHABLE_REPORT_FIELDS.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'status')
    && payload.status
    && !VALID_STATUSES.includes(String(payload.status).trim().toLowerCase())
  ) {
    const error = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
}
