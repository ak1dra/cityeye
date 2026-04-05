/**
 * Alem Platform service wrappers.
 *
 * Each Alem service has its OWN API key:
 *   - Qwen 3       ALEM_API_KEY          → /v1/chat/completions
 *   - Deepseek OCR ALEM_OCR_API_KEY      → /v1/chat/completions  (vision)
 *   - Embedder     ALEM_EMBEDDER_API_KEY  → /v1/embeddings
 *   - Reranker     ALEM_RERANKER_API_KEY  → /v1/rerank
 *   - STT Kazakh   ALEM_STT_API_KEY       → /v1/audio/transcriptions
 */

/* ------------------------------------------------------------------ */
/*  ENV / defaults                                                     */
/* ------------------------------------------------------------------ */

const ALEM_BASE = 'https://llm.alem.ai/v1';

// Per-service API keys
const KEY_LLM      = () => process.env.ALEM_API_KEY || '';
const KEY_OCR      = () => process.env.ALEM_OCR_API_KEY || '';
const KEY_EMBEDDER = () => process.env.ALEM_EMBEDDER_API_KEY || '';
const KEY_RERANKER = () => process.env.ALEM_RERANKER_API_KEY || '';
const KEY_STT      = () => process.env.ALEM_STT_API_KEY || '';

// Model names (confirmed from Alem docs)
const MODEL_LLM      = () => process.env.ALEM_MODEL || 'qwen3';
const MODEL_OCR      = () => process.env.ALEM_OCR_MODEL || 'deepseek-ocr';
const MODEL_EMBEDDER = () => process.env.ALEM_EMBEDDER_MODEL || 'text-1024';
const MODEL_RERANKER = () => process.env.ALEM_RERANKER_MODEL || 'reranker';
const MODEL_STT      = () => process.env.ALEM_STT_MODEL || 'speech-to-text-kk';

const TIMEOUT_MS = () => Number(process.env.ALEM_TIMEOUT_MS) || 20000;

/* ------------------------------------------------------------------ */
/*  Low-level helpers                                                  */
/* ------------------------------------------------------------------ */

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Alem request timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Generic JSON POST to Alem.
 * @param {string} path     e.g. '/chat/completions'
 * @param {string} apiKey   per-service key
 * @param {object} body     request payload
 * @param {number} [timeoutMs]
 */
async function alemFetch(path, apiKey, body, timeoutMs) {
  const url = `${ALEM_BASE}${path}`;
  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }),
    timeoutMs ?? TIMEOUT_MS(),
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Alem ${path} error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Multipart form POST (for STT).
 */
async function alemFetchForm(path, apiKey, formData, timeoutMs) {
  const url = `${ALEM_BASE}${path}`;
  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    }),
    timeoutMs ?? TIMEOUT_MS(),
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Alem ${path} error ${res.status}: ${text}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  1. CHAT  –  Qwen 3                                                 */
/* ------------------------------------------------------------------ */

/**
 * Send a chat-completion request to Qwen 3.
 * @param {{ system?: string, user: string, model?: string }} opts
 * @returns {Promise<string>} assistant reply text
 */
export async function chatCompletion({ system, user, model }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const data = await alemFetch('/chat/completions', KEY_LLM(), {
    model: model || MODEL_LLM(),
    messages,
    max_tokens: 3000,
    temperature: 0.2,
    enable_thinking: false,
  });

  const msg = data?.choices?.[0]?.message;
  return msg?.content || msg?.reasoning_content || '';
}

/* ------------------------------------------------------------------ */
/*  2. EMBEDDER  –  text → vector  (model: text-1024)                  */
/* ------------------------------------------------------------------ */

/**
 * Get embedding vector(s) for one or more texts.
 * @param {string|string[]} input
 * @returns {Promise<number[][]>} array of float vectors
 */
export async function getEmbeddings(input) {
  const data = await alemFetch('/embeddings', KEY_EMBEDDER(), {
    model: MODEL_EMBEDDER(),
    input: Array.isArray(input) ? input : [input],
  });
  return (data?.data || []).map(d => d.embedding);
}

/** Single text → single vector shorthand. */
export async function getEmbedding(text) {
  const [vec] = await getEmbeddings(text);
  return vec || [];
}

/* ------------------------------------------------------------------ */
/*  3. RERANKER  –  re-score candidates against a query                */
/* ------------------------------------------------------------------ */

/**
 * @param {{ query: string, documents: string[], topN?: number }} opts
 * @returns {Promise<Array<{ index: number, relevance_score: number }>>}
 */
export async function rerank({ query, documents, topN }) {
  const data = await alemFetch('/rerank', KEY_RERANKER(), {
    model: MODEL_RERANKER(),
    query,
    documents,
    top_n: topN ?? documents.length,
  });
  return data?.results || [];
}

/* ------------------------------------------------------------------ */
/*  4. DEEPSEEK OCR  –  extract text from image                        */
/* ------------------------------------------------------------------ */

/**
 * Run OCR on an image URL.
 * Uses deepseek-ocr vision model with its own API key.
 * @param {string} imageUrl  public URL
 * @returns {Promise<string>} extracted text & visual description
 */
export async function ocrImage(imageUrl) {
  if (!imageUrl) return '';

  const data = await alemFetch('/chat/completions', KEY_OCR(), {
    model: MODEL_OCR(),
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
          {
            type: 'text',
            text: 'Опиши что видишь на фото: состояние инфраструктуры, видимые повреждения, текст на табличках/вывесках. Кратко, на русском.',
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  const msg = data?.choices?.[0]?.message;
  return msg?.content || '';
}

/* ------------------------------------------------------------------ */
/*  5. SPEECH-TO-TEXT  –  audio → text  (Kazakh)                       */
/* ------------------------------------------------------------------ */

/**
 * Transcribe audio buffer to text (Kazakh / Russian).
 * @param {Buffer} audioBuffer  raw audio bytes (webm, wav, mp3, ogg)
 * @param {string} [filename]   original filename for mime detection
 * @returns {Promise<string>} transcribed text
 */
export async function speechToText(audioBuffer, filename = 'audio.webm') {
  const form = new FormData();
  form.append('file', new Blob([audioBuffer]), filename);
  form.append('model', MODEL_STT());

  return alemFetchForm('/audio/transcriptions', KEY_STT(), form).then(d => d?.text || '');
}

/* ------------------------------------------------------------------ */
/*  6. SCORE API  –  composite scoring                                 */
/* ------------------------------------------------------------------ */

/**
 * Compute a weighted priority score.
 *
 * Factors & weights for urban-issue triage:
 *   severity      0.35
 *   data_quality  0.25
 *   ai_agreement  0.15
 *   recency       0.10
 *   geo_signal    0.15
 */
export function computePriorityScore({
  severityKey = 'medium',
  imagePresent = false,
  hasAddress = false,
  commentLength = 0,
  typeExplicit = false,
  aiRouteMatchesRule = false,
  duplicateNearbyCount = 0,
  minutesSinceCreation = 0,
}) {
  const SEVERITY_BASE = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.2 };

  const factors = [
    {
      name: 'severity',
      value: SEVERITY_BASE[severityKey] ?? 0.5,
      weight: 0.35,
    },
    {
      name: 'data_quality',
      value: [
        imagePresent ? 0.35 : 0,
        hasAddress ? 0.25 : 0,
        commentLength > 30 ? 0.25 : commentLength > 10 ? 0.1 : 0,
        typeExplicit ? 0.15 : 0,
      ].reduce((a, b) => a + b, 0),
      weight: 0.25,
    },
    {
      name: 'ai_rule_agreement',
      value: aiRouteMatchesRule ? 1.0 : 0.3,
      weight: 0.15,
    },
    {
      name: 'recency',
      value: minutesSinceCreation < 60 ? 1.0 : minutesSinceCreation < 360 ? 0.6 : 0.3,
      weight: 0.10,
    },
    {
      name: 'geo_signal',
      value: duplicateNearbyCount > 2 ? 1.0 : duplicateNearbyCount > 0 ? 0.6 : 0.1,
      weight: 0.15,
    },
  ];

  factors.forEach(f => { f.contribution = +(f.value * f.weight).toFixed(4); });
  const raw = factors.reduce((sum, f) => sum + f.contribution, 0);
  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));

  return { score, factors };
}

/* ------------------------------------------------------------------ */
/*  7. VERIFY  –  compare before/after photos via vision model         */
/* ------------------------------------------------------------------ */

/**
 * AI-verify completion: compare "before" and "after" photos.
 * Uses deepseek-ocr (vision) to determine if the issue was actually fixed.
 *
 * @param {string} beforeUrl  public URL of the original problem photo
 * @param {string} afterUrl   public URL of the completion photo
 * @param {{ type?: string, description?: string }} context
 * @returns {Promise<{ verdict: string, confidence: number, reasoning: string, changes_detected: string }>}
 */
export async function verifyCompletion(beforeUrl, afterUrl, context = {}) {
  if (!beforeUrl || !afterUrl) {
    return { verdict: 'NO_PHOTOS', confidence: 0, reasoning: 'Нет фото для сравнения', changes_detected: '' };
  }

  const data = await alemFetch('/chat/completions', KEY_OCR(), {
    model: MODEL_OCR(),
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: beforeUrl } },
          { type: 'image_url', image_url: { url: afterUrl } },
          {
            type: 'text',
            text: `/no_think
Первое фото — проблема (ДО). Второе фото — результат ремонта (ПОСЛЕ).
${context.type ? `Тип проблемы: ${context.type}.` : ''}
${context.description ? `Описание: ${context.description}` : ''}

Сравни два фото и верни ТОЛЬКО JSON:
{"verdict":"VERIFIED|SUSPICIOUS|NOT_FIXED","confidence":0-100,"reasoning":"1 предложение","changes_detected":"что изменилось"}

VERIFIED = проблема явно устранена
SUSPICIOUS = неясно, нужна проверка
NOT_FIXED = проблема осталась`,
          },
        ],
      },
    ],
    max_tokens: 300,
  }, 30000);

  const raw = data?.choices?.[0]?.message?.content || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { verdict: 'SUSPICIOUS', confidence: 30, reasoning: 'AI не смог проанализировать фото', changes_detected: raw.slice(0, 200) };
  }

  try {
    const parsed = JSON.parse(match[0]);
    const validVerdicts = ['VERIFIED', 'SUSPICIOUS', 'NOT_FIXED'];
    return {
      verdict: validVerdicts.includes(parsed.verdict) ? parsed.verdict : 'SUSPICIOUS',
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 50)),
      reasoning: String(parsed.reasoning || '').slice(0, 300),
      changes_detected: String(parsed.changes_detected || '').slice(0, 300),
    };
  } catch {
    return { verdict: 'SUSPICIOUS', confidence: 30, reasoning: 'Ошибка парсинга ответа AI', changes_detected: '' };
  }
}

/* ------------------------------------------------------------------ */
/*  Health checks                                                      */
/* ------------------------------------------------------------------ */

export function isConfigured()    { return Boolean(KEY_LLM()); }
export function isOcrConfigured() { return Boolean(KEY_OCR()); }
export function isSttConfigured() { return Boolean(KEY_STT()); }
