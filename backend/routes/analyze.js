import { Router } from 'express';

const router = Router();

const ALEM_API_URL = process.env.ALEM_API_URL || 'https://llm.alem.ai/v1/chat/completions';
const ALEM_MODEL = process.env.ALEM_MODEL || 'qwen3';
const ANALYZE_TIMEOUT_MS = Number(process.env.ANALYZE_TIMEOUT_MS) || 15000;

const SEVERITY_LABELS = new Map([
  ['critical', 'КРИТИЧНО'],
  ['crit', 'КРИТИЧНО'],
  ['крит', 'КРИТИЧНО'],
  ['high', 'ВЫСОКО'],
  ['выс', 'ВЫСОКО'],
  ['medium', 'СРЕДНЕ'],
  ['mid', 'СРЕДНЕ'],
  ['сред', 'СРЕДНЕ'],
  ['low', 'НИЗКО'],
  ['низ', 'НИЗКО'],
]);

function toStringOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'да'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'нет'].includes(normalized)) return false;
  }

  return fallback;
}

function normalizeSeverity(value) {
  const source = toStringOrNull(value)?.toLowerCase() || '';

  for (const [marker, label] of SEVERITY_LABELS.entries()) {
    if (source.includes(marker)) return label;
  }

  return 'ВЫСОКО';
}

function buildMock(problemType, address) {
  return {
    type: problemType || 'Городская проблема',
    severity: 'ВЫСОКО',
    priority_score: 75,
    ai_comment: `Проблема зафиксирована по адресу ${address || 'Алматы'}. Требует проверки специалиста.`,
    recommended_action: 'Направить бригаду для осмотра и устранения',
    estimated_fix_time: '24-48 часов',
    responsible_dept: 'Управление городской инфраструктуры акимата',
    risk_for: 'граждане и транспорт',
    duplicate_likely: false,
  };
}

function normalizeAnalyzeResult(raw, context) {
  const fallback = buildMock(context.problemType, context.address);

  return {
    type: toStringOrNull(raw?.type) || fallback.type,
    severity: normalizeSeverity(raw?.severity),
    priority_score: clampNumber(raw?.priority_score, 0, 100, fallback.priority_score),
    ai_comment: toStringOrNull(raw?.ai_comment) || fallback.ai_comment,
    recommended_action: toStringOrNull(raw?.recommended_action) || fallback.recommended_action,
    estimated_fix_time: toStringOrNull(raw?.estimated_fix_time) || fallback.estimated_fix_time,
    responsible_dept: toStringOrNull(raw?.responsible_dept) || fallback.responsible_dept,
    risk_for: toStringOrNull(raw?.risk_for) || fallback.risk_for,
    duplicate_likely: toBoolean(raw?.duplicate_likely, fallback.duplicate_likely),
  };
}

function extractJsonObject(text) {
  const source = toStringOrNull(text);
  if (!source) return null;

  const clean = source
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json/gi, '```')
    .replace(/```[\r\n]?/g, '')
    .replace(/Thinking Process[\s\S]*?\n\n/g, '')
    .trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

router.post('/', async (req, res) => {
  const { address, comment, problemType } = req.body ?? {};
  const fallback = buildMock(problemType, address);
  const apiKey = process.env.ALEM_API_KEY;

  if (!apiKey) {
    console.warn('ALEM_API_KEY is not configured. Returning mock analyze response.');
    return res.json(fallback);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

  try {
    const requestBody = {
      model: ALEM_MODEL,
      enable_thinking: false,
      messages: [
        {
          role: 'system',
          content: 'Ты анализатор городских проблем. Отвечай ТОЛЬКО JSON без рассуждений.',
        },
        {
          role: 'user',
          content: `Верни ТОЛЬКО этот JSON заполненный данными:
{
  "type": "тип проблемы по-русски",
  "severity": "КРИТИЧНО или ВЫСОКО или СРЕДНЕ или НИЗКО",
  "priority_score": число от 0 до 100,
  "ai_comment": "2 предложения описания",
  "recommended_action": "что сделать акимату",
  "estimated_fix_time": "срок например 24 часа",
  "responsible_dept": "отдел акимата",
  "risk_for": "кто под риском",
  "duplicate_likely": false
}

Тип проблемы: ${problemType || 'дорога'}
Адрес: ${address || 'Алматы'}
Описание: ${comment || 'проблема'}`,
        },
      ],
      max_tokens: 3000,
    };

    const response = await fetch(ALEM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Analyze upstream error: ${response.status} ${errorText}`);
      return res.json(fallback);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message;
    const text = message?.content
      || message?.reasoning_content
      || message?.provider_specific_fields?.reasoning
      || '';

    const parsed = extractJsonObject(text);
    if (!parsed) {
      return res.json(normalizeAnalyzeResult({ ai_comment: text }, { problemType, address, comment }));
    }

    return res.json(normalizeAnalyzeResult(parsed, { problemType, address, comment }));
  } catch (err) {
    const reason = err?.name === 'AbortError'
      ? `Analyze request timed out after ${ANALYZE_TIMEOUT_MS}ms`
      : err?.message || 'Unknown analyze error';

    console.error(reason);
    return res.json(fallback);
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
