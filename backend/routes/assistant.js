import Anthropic from '@anthropic-ai/sdk';
import { Router } from 'express';
import {
  buildOverviewGuidance,
  buildReportGuidance,
  getKnowledgeSnapshot,
} from '../src/assistantKnowledge.js';

const router = Router();

const ALEM_API_URL = process.env.ALEM_API_URL || 'https://llm.alem.ai/v1/chat/completions';
const ALEM_MODEL = process.env.ALEM_MODEL || 'qwen3';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
const ASSISTANT_TIMEOUT_MS = Number(process.env.ASSISTANT_TIMEOUT_MS || process.env.ANALYZE_TIMEOUT_MS) || 15000;

function toNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRoute(value, fallback = null) {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (['government', 'business', 'shared'].includes(source)) return source;
  if (source.includes('аким')) return 'government';
  if (source.includes('бизнес') || source.includes('company') || source.includes('private')) return 'business';
  if (source.includes('совмест') || source.includes('joint')) return 'shared';
  return fallback;
}

function normalizeRiskLevel(value, fallback = 'medium') {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (['critical', 'high', 'medium', 'low'].includes(source)) return source;
  if (source.includes('крит')) return 'critical';
  if (source.includes('выс')) return 'high';
  if (source.includes('низ')) return 'low';
  return fallback;
}

function normalizeConfidence(value, fallback = 'medium') {
  const source = toNonEmptyString(value)?.toLowerCase() || '';
  if (['high', 'medium', 'low'].includes(source)) return source;
  if (source.includes('выс')) return 'high';
  if (source.includes('низ')) return 'low';
  return fallback;
}

function normalizeStringArray(value, fallback = []) {
  if (Array.isArray(value)) {
    const cleaned = value.map(toNonEmptyString).filter(Boolean);
    if (cleaned.length > 0) return cleaned.slice(0, 5);
  }

  if (typeof value === 'string') {
    const cleaned = value
      .split(/[\n;]+/)
      .map(part => part.trim())
      .filter(Boolean);
    if (cleaned.length > 0) return cleaned.slice(0, 5);
  }

  return fallback;
}

function normalizeHotspots(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .map(item => {
      if (!item || typeof item !== 'object') return null;

      const label = toNonEmptyString(item.label);
      const summary = toNonEmptyString(item.summary);
      const pressureLabel = toNonEmptyString(item.pressure_label);
      const routeHint = normalizeRoute(item.route_hint, null);
      const count = Number(item.count);

      if (!label) return null;

      return {
        label,
        count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0,
        summary: summary || '',
        pressure_label: pressureLabel || 'Операционный сигнал',
        route_hint: routeHint,
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  return normalized.length > 0 ? normalized : fallback;
}

function extractJsonObject(text) {
  const source = toNonEmptyString(text);
  if (!source) return null;

  const clean = source
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json/gi, '```')
    .replace(/```[\r\n]?/g, '')
    .trim();

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Assistant request timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
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
          content: 'Ты AI-ассистент акимата. Отвечай только JSON без markdown и без длинных рассуждений.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Alem assistant upstream error: ${response.status} ${errorText}`);
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
    max_tokens: 1000,
    system: 'Ты AI-ассистент акимата. Отвечай только JSON без markdown и без длинных рассуждений.',
    messages: [{ role: 'user', content: prompt }],
  });

  return response?.content
    ?.filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n') ?? '';
}

function normalizeAssistantResult(raw, fallback, source = 'ai') {
  return {
    ...fallback,
    executive_summary: toNonEmptyString(raw?.executive_summary) || fallback.executive_summary,
    recommended_department: toNonEmptyString(raw?.recommended_department) ?? fallback.recommended_department,
    recommended_route: normalizeRoute(raw?.recommended_route, fallback.recommended_route),
    department_queue: toNonEmptyString(raw?.department_queue) || fallback.department_queue,
    control_mode: toNonEmptyString(raw?.control_mode) || fallback.control_mode,
    sla_target: toNonEmptyString(raw?.sla_target) || fallback.sla_target,
    escalation_owner: toNonEmptyString(raw?.escalation_owner) || fallback.escalation_owner,
    reasoning: toNonEmptyString(raw?.reasoning) || fallback.reasoning,
    risk_level: normalizeRiskLevel(raw?.risk_level, fallback.risk_level),
    priority_label: toNonEmptyString(raw?.priority_label) || fallback.priority_label,
    confidence_label: normalizeConfidence(raw?.confidence_label, fallback.confidence_label),
    next_actions: normalizeStringArray(raw?.next_actions, fallback.next_actions),
    oversight_flags: normalizeStringArray(raw?.oversight_flags, fallback.oversight_flags),
    hotspots: normalizeHotspots(raw?.hotspots, fallback.hotspots),
    spotlight_reports: fallback.spotlight_reports,
    source,
  };
}

function buildPrompt({ mode, fallback, report, reports, filters }) {
  const knowledge = getKnowledgeSnapshot();
  const scopedReports = Array.isArray(reports) ? reports.slice(0, 25) : [];

  return `Ты AI-ассистент диспетчеризации акимата. Твоя задача — кратко и операционно помочь принять решение.

Верни ТОЛЬКО JSON такого вида:
{
  "executive_summary": "краткая управленческая сводка",
  "recommended_department": "название департамента или null",
  "recommended_route": "government|business|shared|null",
  "department_queue": "рабочая очередь или контур исполнения",
  "control_mode": "как акимату вести этот кейс или поток",
  "sla_target": "целевой SLA/горизонт реакции",
  "escalation_owner": "кто эскалирует или контролирует",
  "reasoning": "почему ассистент рекомендует это действие",
  "risk_level": "critical|high|medium|low",
  "priority_label": "короткая метка приоритета",
  "confidence_label": "high|medium|low",
  "next_actions": ["действие 1", "действие 2"],
  "oversight_flags": ["риск 1", "риск 2"],
  "hotspots": [
    {
      "label": "горячая зона/тип потока",
      "count": 3,
      "summary": "краткое описание давления",
      "pressure_label": "тип давления",
      "route_hint": "government|business|shared|null"
    }
  ]
}

Режим: ${mode}

База знаний:
${JSON.stringify(knowledge, null, 2)}

Базовая rule-engine рекомендация:
${JSON.stringify(fallback, null, 2)}

Текущий report:
${JSON.stringify(report ?? null, null, 2)}

Текущая выборка reports:
${JSON.stringify(scopedReports, null, 2)}

Фильтры:
${JSON.stringify(filters ?? {}, null, 2)}

Сделай ответ коротким, управленческим и пригодным для дежурного сотрудника акимата. Не придумывай новые департаменты, которых нет в базе знаний. Если режим report_guidance, обязательно верни department_queue, control_mode, sla_target и escalation_owner.`;
}

router.post('/', async (req, res) => {
  const mode = req.body?.mode === 'report_guidance' ? 'report_guidance' : 'dashboard_overview';
  const reports = Array.isArray(req.body?.reports) ? req.body.reports : [];
  const report = req.body?.report && typeof req.body.report === 'object' ? req.body.report : null;
  const filters = req.body?.filters && typeof req.body.filters === 'object' ? req.body.filters : {};

  if (mode === 'report_guidance' && !report) {
    return res.status(400).json({ error: 'report is required for report_guidance mode' });
  }

  const fallback = mode === 'report_guidance'
    ? buildReportGuidance(report)
    : buildOverviewGuidance(reports, filters);

  const alemKey = process.env.ALEM_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!alemKey && !anthropicKey) {
    return res.json({ ...fallback, source: 'rule_engine' });
  }

  try {
    const prompt = buildPrompt({ mode, fallback, report, reports, filters });
    const text = alemKey
      ? await withTimeout(callAlem(prompt, alemKey), ASSISTANT_TIMEOUT_MS)
      : await withTimeout(callAnthropic(prompt, anthropicKey), ASSISTANT_TIMEOUT_MS);

    const parsed = extractJsonObject(text);
    if (!parsed) {
      return res.json(normalizeAssistantResult({ executive_summary: text }, fallback));
    }

    return res.json(normalizeAssistantResult(parsed, fallback));
  } catch (error) {
    console.error(error?.message || 'Unknown assistant error');
    return res.json({ ...fallback, source: 'rule_engine' });
  }
});

export default router;
