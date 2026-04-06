import { supabase } from './lib/supabase';
import { readDemoUser } from './lib/demoAuth';

const BASE = '/api';

async function parseApiResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

function normalizeArrayParam(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function buildQueryString(params = {}) {
  const search = new URLSearchParams();

  const appendMaybeCsv = (key, value) => {
    const values = normalizeArrayParam(value);
    if (values.length > 0) search.set(key, values.join(','));
  };

  appendMaybeCsv('status', params.status);
  appendMaybeCsv('severity', params.severity);
  appendMaybeCsv('responsible_role', params.responsible_role);

  if (typeof params.view === 'string' && params.view.trim()) {
    search.set('view', params.view.trim());
  }
  if (typeof params.shared_case === 'boolean') {
    search.set('shared_case', String(params.shared_case));
  }
  if (typeof params.search === 'string' && params.search.trim()) {
    search.set('search', params.search.trim());
  }
  if (Number.isFinite(params.limit)) {
    search.set('limit', String(params.limit));
  }
  if (Number.isFinite(params.offset)) {
    search.set('offset', String(params.offset));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

function normalizePagePayload(payload, fallbackLimit = 120, fallbackOffset = 0) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      limit: fallbackLimit,
      offset: fallbackOffset,
      has_more: false,
      source: 'supabase',
    };
  }

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: Number.isFinite(payload?.total) ? payload.total : (Array.isArray(payload?.items) ? payload.items.length : 0),
    limit: Number.isFinite(payload?.limit) ? payload.limit : fallbackLimit,
    offset: Number.isFinite(payload?.offset) ? payload.offset : fallbackOffset,
    has_more: Boolean(payload?.has_more),
    source: typeof payload?.source === 'string' ? payload.source : 'supabase',
  };
}

async function buildAuthHeaders(extraHeaders = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const demoUser = readDemoUser();

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!token && demoUser?.email ? { 'x-cityeye-demo-user': demoUser.email } : {}),
    ...extraHeaders,
  };
}

export async function analyzeImage(payload) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiResponse(res);
}

function parseSseBlock(block) {
  const lines = block.split('\n').map(line => line.trimEnd());
  let event = 'message';
  const dataLines = [];

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;

  try {
    return { event, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}

export async function analyzeImageStream(payload, { signal, onEvent } = {}) {
  const res = await fetch(`${BASE}/analyze/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream') || !res.body) {
    throw new Error('STREAM_UNAVAILABLE');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const parsed = parseSseBlock(block);

      if (parsed) {
        onEvent?.(parsed);
        if (parsed.event === 'error') {
          throw new Error(parsed.data?.detail || parsed.data?.error || 'Streaming analyze failed');
        }
        if (parsed.event === 'result') {
          finalResult = parsed.data;
        }
      }

      separatorIndex = buffer.indexOf('\n\n');
    }

    if (done) break;
  }

  if (!finalResult) {
    throw new Error('Streaming completed without final result');
  }

  return finalResult;
}

export async function getAssistantGuidance(payload) {
  const res = await fetch(`${BASE}/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiResponse(res);
}

export async function getAnalyticsOverview() {
  const res = await fetch(`${BASE}/analytics/overview`);
  return parseApiResponse(res);
}

export async function getReportsPage(params = {}) {
  const query = buildQueryString(params);
  const fallbackLimit = Number.isFinite(params.limit) ? params.limit : 120;
  const fallbackOffset = Number.isFinite(params.offset) ? params.offset : 0;
  const res = await fetch(`${BASE}/reports${query}`);
  const payload = await parseApiResponse(res);
  return normalizePagePayload(payload, fallbackLimit, fallbackOffset);
}

export async function getReports(params = {}) {
  const page = await getReportsPage(params);
  return page.items;
}

export async function createReport(payload) {
  const res = await fetch(`${BASE}/reports`, {
    method: 'POST',
    headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  return parseApiResponse(res);
}

export async function updateReport(id, fields) {
  const res = await fetch(`${BASE}/reports/${id}`, {
    method: 'PATCH',
    headers: await buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(fields),
  });
  return parseApiResponse(res);
}

export async function updateStatus(id, status, extraFields = {}) {
  return updateReport(id, { ...extraFields, status });
}

/**
 * Speech-to-text: send audio and get transcribed text back.
 * @param {string} audioBase64 - base64-encoded audio
 * @param {string} [filename]  - original filename (for mime detection)
 * @returns {Promise<{ text: string }>}
 */
export async function transcribeAudio(audioBase64, filename = 'audio.webm') {
  const res = await fetch(`${BASE}/speech-to-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_base64: audioBase64, filename }),
  });
  return parseApiResponse(res);
}

/**
 * AI Verify: compare before/after photos to check if issue was fixed.
 * @param {{ before_url: string, after_url: string, type?: string, description?: string }} payload
 * @returns {Promise<{ verdict: string, confidence: number, reasoning: string, changes_detected: string }>}
 */
export async function verifyCompletion(payload) {
  const res = await fetch(`${BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiResponse(res);
}
