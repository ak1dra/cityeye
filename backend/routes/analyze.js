import Anthropic from '@anthropic-ai/sdk';
import { Router } from 'express';

const router = Router();

const ALEM_API_URL = process.env.ALEM_API_URL || 'https://llm.alem.ai/v1/chat/completions';
const ALEM_MODEL = process.env.ALEM_MODEL || 'qwen3';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
const ANALYZE_TIMEOUT_MS = Number(process.env.ANALYZE_TIMEOUT_MS) || 15000;
const TYPE_LABELS = {
  road: 'дорожный дефект',
  lighting: 'неисправность освещения',
  waste: 'санитарная проблема',
  greenery: 'проблема благоустройства',
  utilities: 'коммунальная проблема',
  parking: 'нарушение парковки',
  vandal: 'следы вандализма',
  other: 'городская проблема',
};

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
const TYPE_ALIASES = new Map([
  ['road', 'road'],
  ['roads', 'road'],
  ['яма', 'road'],
  ['дорож', 'road'],
  ['light', 'lighting'],
  ['lighting', 'lighting'],
  ['освещ', 'lighting'],
  ['фонар', 'lighting'],
  ['trash', 'waste'],
  ['waste', 'waste'],
  ['мусор', 'waste'],
  ['свалк', 'waste'],
  ['green', 'greenery'],
  ['greenery', 'greenery'],
  ['зелен', 'greenery'],
  ['tree', 'greenery'],
  ['utility', 'utilities'],
  ['utilities', 'utilities'],
  ['коммун', 'utilities'],
  ['вода', 'utilities'],
  ['parking', 'parking'],
  ['парков', 'parking'],
  ['vandal', 'vandal'],
  ['вандал', 'vandal'],
  ['other', 'other'],
  ['другое', 'other'],
]);
const RESPONSIBLE_ROUTE_ALIASES = new Map([
  ['government', 'government'],
  ['gov', 'government'],
  ['аким', 'government'],
  ['business', 'business'],
  ['private', 'business'],
  ['company', 'business'],
  ['бизнес', 'business'],
  ['shared', 'shared'],
  ['joint', 'shared'],
  ['совмест', 'shared'],
]);
const CONFIDENCE_ALIASES = new Map([
  ['high', 'high'],
  ['strong', 'high'],
  ['выс', 'high'],
  ['medium', 'medium'],
  ['mid', 'medium'],
  ['сред', 'medium'],
  ['low', 'low'],
  ['weak', 'low'],
  ['низ', 'low'],
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

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Analyze request timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function normalizeSeverity(value) {
  const source = toStringOrNull(value)?.toLowerCase() || '';

  for (const [marker, label] of SEVERITY_LABELS.entries()) {
    if (source.includes(marker)) return label;
  }

  return 'ВЫСОКО';
}

function normalizeIssueType(value) {
  const source = (toStringOrNull(value) ?? '').toLowerCase();

  if (TYPE_LABELS[source]) return source;

  for (const [marker, type] of TYPE_ALIASES.entries()) {
    if (source.includes(marker)) return type;
  }

  return 'other';
}

function normalizeSuggestedRole(value, fallback = 'government') {
  const source = (toStringOrNull(value) ?? fallback).toLowerCase();

  if (['government', 'business', 'shared'].includes(source)) return source;

  for (const [marker, role] of RESPONSIBLE_ROUTE_ALIASES.entries()) {
    if (source.includes(marker)) return role;
  }

  return fallback;
}

function normalizeConfidenceLabel(value, fallback = 'medium') {
  const source = (toStringOrNull(value) ?? fallback).toLowerCase();

  if (['high', 'medium', 'low'].includes(source)) return source;

  for (const [marker, level] of CONFIDENCE_ALIASES.entries()) {
    if (source.includes(marker)) return level;
  }

  return fallback;
}

function inferSuggestedRole({ reporterRole, problemType }) {
  const normalizedType = normalizeIssueType(problemType);

  if (reporterRole === 'business') return 'shared';
  if (['road', 'lighting', 'utilities'].includes(normalizedType)) return 'government';
  if (['parking', 'vandal', 'waste'].includes(normalizedType)) return 'shared';
  return 'government';
}

function inferConfidenceLabel({ imagePresent, address, comment, problemType }) {
  if (imagePresent && address && comment && problemType) return 'high';
  if (imagePresent && (comment || problemType || address)) return 'medium';
  return 'low';
}

function buildDetectedIssueTitle(problemType, severity) {
  const typeLabel = TYPE_LABELS[normalizeIssueType(problemType)] || TYPE_LABELS.other;
  if (severity === 'КРИТИЧНО') return `Критичный кейс: ${typeLabel}`;
  if (severity === 'ВЫСОКО') return `Срочный кейс: ${typeLabel}`;
  if (severity === 'НИЗКО') return `Локальный кейс: ${typeLabel}`;
  return `Требует внимания: ${typeLabel}`;
}

function buildResponsibleDept(problemType, suggestedRole) {
  if (suggestedRole === 'business') return 'Управляющая компания или частный оператор';

  const normalizedType = normalizeIssueType(problemType);

  if (normalizedType === 'road' || normalizedType === 'parking') return 'Управление городской мобильности';
  if (normalizedType === 'lighting') return 'Служба уличного освещения';
  if (normalizedType === 'utilities') return 'Коммунальные службы города';
  if (normalizedType === 'waste') return suggestedRole === 'shared' ? 'Санитарная служба и балансодержатель' : 'Санитарная служба города';
  if (normalizedType === 'greenery') return 'Служба благоустройства и озеленения';
  return suggestedRole === 'shared' ? 'Профильный отдел акимата и партнёр' : 'Управление городской инфраструктуры акимата';
}

function buildRecommendedAction(problemType, suggestedRole) {
  const normalizedType = normalizeIssueType(problemType);

  if (normalizedType === 'road') return 'Провести выезд, оградить опасный участок и направить дорожную бригаду.';
  if (normalizedType === 'lighting') return 'Проверить линию питания, опору и светильник, затем назначить ремонтную смену.';
  if (normalizedType === 'waste') return suggestedRole === 'shared'
    ? 'Согласовать зону ответственности и организовать уборку совместно с балансодержателем.'
    : 'Назначить санитарную бригаду и подтвердить уборку фотофиксацией.';
  if (normalizedType === 'utilities') return 'Оформить выезд профильной службы и проверить инженерные сети на месте.';
  if (normalizedType === 'greenery') return 'Организовать осмотр территории и назначить работы по благоустройству.';
  if (normalizedType === 'parking') return 'Проверить правомерность использования пространства и определить балансодержателя.';
  if (normalizedType === 'vandal') return 'Зафиксировать ущерб, определить владельца объекта и сформировать план восстановления.';
  return suggestedRole === 'shared'
    ? 'Провести совместный triage акимата и частного сектора с назначением ответственного.'
    : 'Назначить выездной осмотр и определить исполнителя по кейсу.';
}

function buildRiskFor(problemType) {
  const normalizedType = normalizeIssueType(problemType);
  if (normalizedType === 'road' || normalizedType === 'parking') return 'пешеходы и транспорт';
  if (normalizedType === 'lighting') return 'пешеходы в тёмное время суток';
  if (normalizedType === 'utilities') return 'жители и инженерные сети';
  if (normalizedType === 'waste') return 'жители и санитарное состояние района';
  if (normalizedType === 'vandal') return 'городская среда и общественная безопасность';
  return 'жители и городская инфраструктура';
}

function buildEstimatedFixTime(problemType, suggestedRole) {
  const normalizedType = normalizeIssueType(problemType);

  if (normalizedType === 'road' || normalizedType === 'lighting') return '24-48 часов';
  if (normalizedType === 'utilities') return 'до 24 часов для выезда, до 72 часов на устранение';
  if (normalizedType === 'waste') return suggestedRole === 'shared' ? '24-72 часа' : 'до 24 часов';
  if (normalizedType === 'vandal') return '2-5 дней';
  return '1-3 дня';
}

function buildPriorityScore(severity, suggestedRole) {
  if (severity === 'КРИТИЧНО') return suggestedRole === 'shared' ? 94 : 90;
  if (severity === 'ВЫСОКО') return suggestedRole === 'shared' ? 82 : 76;
  if (severity === 'НИЗКО') return 28;
  return suggestedRole === 'shared' ? 64 : 58;
}

function buildAiComment(context, suggestedRole, severity) {
  const typeLabel = TYPE_LABELS[normalizeIssueType(context.problemType)] || TYPE_LABELS.other;
  const routeLabel = suggestedRole === 'shared'
    ? 'в совместный контур акимата и частного сектора'
    : suggestedRole === 'business'
      ? 'в частный контур исполнения'
      : 'в контур акимата';

  const urgencyLabel = severity === 'КРИТИЧНО'
    ? 'Требуется срочная реакция.'
    : severity === 'ВЫСОКО'
      ? 'Нужна приоритетная обработка.'
      : 'Кейс требует проверки и назначения исполнителя.';

  return `AI-triage классифицирует кейс как ${typeLabel} и рекомендует направить его ${routeLabel}. ${urgencyLabel}`;
}

function buildMock(context) {
  const severity = context.imagePresent && context.comment ? 'ВЫСОКО' : 'СРЕДНЕ';
  const suggestedRole = inferSuggestedRole(context);
  const confidence = inferConfidenceLabel(context);

  return {
    detected_issue_title: buildDetectedIssueTitle(context.problemType, severity),
    type: normalizeIssueType(context.problemType),
    severity,
    priority_score: buildPriorityScore(severity, suggestedRole),
    ai_comment: buildAiComment(context, suggestedRole, severity),
    recommended_action: buildRecommendedAction(context.problemType, suggestedRole),
    estimated_fix_time: buildEstimatedFixTime(context.problemType, suggestedRole),
    responsible_dept: buildResponsibleDept(context.problemType, suggestedRole),
    risk_for: buildRiskFor(context.problemType),
    duplicate_likely: false,
    suggested_responsible_role: suggestedRole,
    confidence_label: confidence,
  };
}

function normalizeAnalyzeResult(raw, context) {
  const fallback = buildMock(context);
  const severity = normalizeSeverity(raw?.severity);

  return {
    detected_issue_title: toStringOrNull(raw?.detected_issue_title) || fallback.detected_issue_title,
    type: toStringOrNull(raw?.type) ? normalizeIssueType(raw?.type) : fallback.type,
    severity,
    priority_score: clampNumber(raw?.priority_score, 0, 100, fallback.priority_score),
    ai_comment: toStringOrNull(raw?.ai_comment) || fallback.ai_comment,
    recommended_action: toStringOrNull(raw?.recommended_action) || fallback.recommended_action,
    estimated_fix_time: toStringOrNull(raw?.estimated_fix_time) || fallback.estimated_fix_time,
    responsible_dept: toStringOrNull(raw?.responsible_dept) || fallback.responsible_dept,
    risk_for: toStringOrNull(raw?.risk_for) || fallback.risk_for,
    duplicate_likely: toBoolean(raw?.duplicate_likely, fallback.duplicate_likely),
    suggested_responsible_role: normalizeSuggestedRole(raw?.suggested_responsible_role, fallback.suggested_responsible_role),
    confidence_label: normalizeConfidenceLabel(raw?.confidence_label, fallback.confidence_label),
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

function buildPrompt(context) {
  const routeHint = inferSuggestedRole(context);
  const confidenceHint = inferConfidenceLabel(context);

  return `Ты городской AI-triage ассистент. Верни ТОЛЬКО JSON без пояснений и markdown.

Схема ответа:
{
  "detected_issue_title": "краткий диагноз по кейсу",
  "type": "road|lighting|waste|greenery|utilities|parking|vandal|other",
  "severity": "КРИТИЧНО или ВЫСОКО или СРЕДНЕ или НИЗКО",
  "priority_score": число от 0 до 100,
  "ai_comment": "краткое summary из 2 предложений",
  "recommended_action": "что делать дальше",
  "estimated_fix_time": "ожидаемый срок",
  "responsible_dept": "какой отдел или исполнитель нужен",
  "risk_for": "кто под риском",
  "duplicate_likely": false,
  "suggested_responsible_role": "government|business|shared",
  "confidence_label": "high|medium|low"
}

Контекст кейса:
- Тип от пользователя: ${context.problemType || 'не указан'}
- Адрес: ${context.address || 'не указан'}
- Описание: ${context.comment || 'не указано'}
- Кто подаёт: ${context.reporterRole || 'citizen'}
- Фото приложено: ${context.imagePresent ? 'да' : 'нет'}
- Публичный URL изображения: ${context.imageUrl || 'нет'}

Рабочие ориентиры:
- Предварительно предполагаемый контур: ${routeHint}
- Предварительная уверенность: ${confidenceHint}

Сделай triage как для городской операционной системы: коротко, предметно, без юридической канцелярщины.`;
}

async function callAlem(prompt, apiKey) {
  const response = await fetch(ALEM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ALEM_MODEL,
      enable_thinking: false,
      messages: [
        {
          role: 'system',
          content: 'Ты анализатор городских проблем. Отвечай только JSON без рассуждений.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Alem upstream error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  return message?.content
    || message?.reasoning_content
    || message?.provider_specific_fields?.reasoning
    || '';
}

async function callAnthropic(prompt, apiKey) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1200,
    system: 'Ты анализатор городских проблем. Отвечай только JSON без рассуждений и markdown.',
    messages: [{ role: 'user', content: prompt }],
  });

  return response?.content
    ?.filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n') ?? '';
}

router.post('/', async (req, res) => {
  const context = {
    address: toStringOrNull(req.body?.address),
    comment: toStringOrNull(req.body?.comment),
    problemType: req.body?.problemType,
    reporterRole: toStringOrNull(req.body?.reporter_role) ?? 'citizen',
    imageUrl: toStringOrNull(req.body?.image_url),
    imagePresent: toBoolean(req.body?.image_present, Boolean(req.body?.image_url)),
  };
  const fallback = buildMock(context);
  const alemKey = process.env.ALEM_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!alemKey && !anthropicKey) {
    console.warn('No AI provider key is configured. Returning mock analyze response.');
    return res.json(fallback);
  }

  try {
    const prompt = buildPrompt(context);
    const text = alemKey
      ? await withTimeout(callAlem(prompt, alemKey), ANALYZE_TIMEOUT_MS)
      : await withTimeout(callAnthropic(prompt, anthropicKey), ANALYZE_TIMEOUT_MS);

    const parsed = extractJsonObject(text);
    if (!parsed) {
      return res.json(normalizeAnalyzeResult({ ai_comment: text }, context));
    }

    return res.json(normalizeAnalyzeResult(parsed, context));
  } catch (err) {
    const reason = err?.message || 'Unknown analyze error';
    console.error(reason);
    return res.json(fallback);
  }
});

export default router;
