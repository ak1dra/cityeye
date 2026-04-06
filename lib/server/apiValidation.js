function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toTrimmedString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value) {
  if (value == null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function toObject(value, fieldName) {
  if (value == null) return null;
  if (!isPlainObject(value)) fail(`${fieldName} must be an object`);
  return value;
}

function normalizeMode(value) {
  const normalized = toTrimmedString(value);
  if (!normalized) return 'dashboard_overview';
  if (['dashboard_overview', 'report_guidance'].includes(normalized)) {
    return normalized;
  }
  fail('mode must be either dashboard_overview or report_guidance');
}

export function validateAnalyzePayload(payload = {}) {
  if (!isPlainObject(payload)) fail('Request body must be a JSON object');

  const normalized = {
    address: toTrimmedString(payload.address),
    comment: toTrimmedString(payload.comment),
    image_url: toTrimmedString(payload.image_url),
    image_data_url: toTrimmedString(payload.image_data_url),
    image: toTrimmedString(payload.image),
    problemType: toTrimmedString(payload.problemType),
    type: toTrimmedString(payload.type),
    category: toTrimmedString(payload.category),
    reporter_role: toTrimmedString(payload.reporter_role),
    image_present: Boolean(payload.image_present),
    lat: toFiniteNumber(payload.lat),
    lng: toFiniteNumber(payload.lng),
  };

  const hasMeaningfulInput = [
    normalized.address,
    normalized.comment,
    normalized.image_url,
    normalized.image_data_url,
    normalized.image,
    normalized.problemType,
    normalized.type,
    normalized.category,
  ].some(Boolean) || Number.isFinite(normalized.lat) || Number.isFinite(normalized.lng);

  if (!hasMeaningfulInput) {
    fail('Provide at least one signal for AI analysis: image, comment, address, type, category or coordinates');
  }

  return normalized;
}

export function validateVerifyPayload(payload = {}) {
  if (!isPlainObject(payload)) fail('Request body must be a JSON object');

  const beforeUrl = toTrimmedString(payload.before_url);
  const afterUrl = toTrimmedString(payload.after_url);
  if (!beforeUrl || !afterUrl) {
    fail('Both before_url and after_url are required');
  }

  return {
    before_url: beforeUrl,
    after_url: afterUrl,
    type: toTrimmedString(payload.type),
    description: toTrimmedString(payload.description),
  };
}

export function validateAssistantPayload(payload = {}) {
  if (!isPlainObject(payload)) fail('Request body must be a JSON object');

  const report = toObject(payload.report, 'report');
  const filters = toObject(payload.filters, 'filters') || {};
  const reports = Array.isArray(payload.reports)
    ? payload.reports.filter(item => isPlainObject(item)).slice(0, 100)
    : [];

  return {
    mode: normalizeMode(payload.mode),
    report,
    reports,
    filters,
  };
}

export function validateSpeechPayload(payload = {}) {
  if (!isPlainObject(payload)) fail('Request body must be a JSON object');

  const audioBase64 = toTrimmedString(payload.audio_base64);
  if (!audioBase64) {
    fail('Provide audio_base64 in request body');
  }

  return {
    audio_base64: audioBase64,
    filename: toTrimmedString(payload.filename) || 'audio.webm',
  };
}
