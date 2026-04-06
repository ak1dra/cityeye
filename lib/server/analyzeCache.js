const ANALYZE_CACHE_TTL_MS = Number(process.env.ANALYZE_CACHE_TTL_MS || 5 * 60 * 1000);
const ANALYZE_CACHE_MAX_ENTRIES = Number(process.env.ANALYZE_CACHE_MAX_ENTRIES || 80);

const cache = new Map();

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function roundCoordinate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(5));
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  while (cache.size > ANALYZE_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export function buildAnalyzeCacheKey(context = {}) {
  return JSON.stringify({
    address: normalizeText(context.address),
    comment: normalizeText(context.comment),
    problemType: normalizeText(context.problemType),
    reporterRole: normalizeText(context.reporterRole || 'citizen'),
    imageUrl: normalizeText(context.imageUrl),
    imagePresent: Boolean(context.imagePresent),
    lat: roundCoordinate(context.lat),
    lng: roundCoordinate(context.lng),
  });
}

export function getCachedAnalyzeResult(key) {
  if (!key) return null;
  pruneCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedAnalyzeResult(key, value) {
  if (!key || !value) return;
  cache.set(key, {
    value,
    expiresAt: Date.now() + ANALYZE_CACHE_TTL_MS,
  });
  pruneCache();
}
