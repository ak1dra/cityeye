/**
 * CityEye AI Pipeline  –  multi-step triage engine.
 *
 * Steps:
 *   0  INPUT    – normalise raw request + optional OCR / STT
 *   1  CLASSIFY – Qwen 3.5 determines type, severity, comment
 *   2  EMBED    – Embedder vectorises report text
 *   3  DEDUP    – search Supabase for nearby + semantically similar reports
 *   4  ROUTE    – LLM + knowledge-base rules decide department & route
 *   5  SCORE    – weighted composite priority score
 *   6  EXPLAIN  – assemble explainability trace
 *
 * Every step is traced via Langfuse so judges can see the full pipeline.
 */

import {
  chatCompletion,
  getEmbedding,
  rerank,
  ocrImage,
  computePriorityScore,
  isConfigured,
  isOcrConfigured,
} from './alemServices.js';
import { normalizeProblemType, buildReportGuidance } from './assistantKnowledge.js';
import { getRoutingContext, isRagConfigured } from './ragService.js';

/* ------------------------------------------------------------------ */
/*  Langfuse tracing (lightweight wrapper – works even without key)    */
/* ------------------------------------------------------------------ */

let Langfuse = null;
let langfuseClient = null;

async function initLangfuse() {
  if (langfuseClient) return langfuseClient;
  if (!process.env.LANGFUSE_SECRET_KEY) return null;
  try {
    const mod = await import('langfuse');
    Langfuse = mod.Langfuse;
    langfuseClient = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    });
    return langfuseClient;
  } catch {
    console.warn('Langfuse SDK not installed – tracing disabled');
    return null;
  }
}

/** Create a trace (or noop stub). */
async function createTrace(name, metadata) {
  const lf = await initLangfuse();
  if (!lf) {
    // return a lightweight stub so callers don't need null checks
    const noop = () => noopSpan;
    const noopSpan = { span: noop, generation: noop, end: noop, update: noop };
    return { trace: noopSpan, flush: async () => {} };
  }
  const trace = lf.trace({ name, metadata });
  return { trace, flush: () => lf.flushAsync() };
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

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

function extractJson(text) {
  if (!text) return null;
  const clean = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json/gi, '```')
    .replace(/```[\r\n]?/g, '')
    .trim();
  const m = clean.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function normSeverity(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('крит') || s === 'critical') return 'critical';
  if (s.includes('выс') || s === 'high') return 'high';
  if (s.includes('низ') || s === 'low') return 'low';
  return 'medium';
}

function normRoute(v, fallback = 'government') {
  const s = String(v || '').toLowerCase();
  if (['government', 'business', 'shared'].includes(s)) return s;
  if (s.includes('аким') || s.includes('gov')) return 'government';
  if (s.includes('бизнес') || s.includes('business')) return 'business';
  if (s.includes('совмест') || s.includes('shared')) return 'shared';
  return fallback;
}

function ruleBasedRoute(type, reporterRole) {
  if (reporterRole === 'business') return 'shared';
  if (['road', 'lighting', 'utilities', 'greenery'].includes(type)) return 'government';
  if (['parking', 'vandal', 'waste'].includes(type)) return 'shared';
  return 'government';
}

/* ------------------------------------------------------------------ */
/*  STEP 0  –  INPUT normalisation                                     */
/* ------------------------------------------------------------------ */

async function stepInput(ctx, span) {
  const s = span.span({ name: 'step_0_input', metadata: { has_image: ctx.imagePresent } });
  const start = Date.now();

  // If image URL provided, run OCR (uses its own API key)
  let ocrText = '';
  if (ctx.imageUrl && isOcrConfigured()) {
    try {
      ocrText = await ocrImage(ctx.imageUrl);
    } catch (err) {
      console.warn('OCR failed:', err.message);
    }
  }

  const result = {
    ...ctx,
    ocrText,
    combinedText: [ctx.comment, ctx.address, ocrText].filter(Boolean).join(' | '),
  };

  s.end({ output: { ocrText: ocrText.slice(0, 200), latency_ms: Date.now() - start } });
  return result;
}

/* ------------------------------------------------------------------ */
/*  STEP 1  –  CLASSIFY via Qwen 3.5                                   */
/* ------------------------------------------------------------------ */

async function stepClassify(ctx, span) {
  const s = span.span({ name: 'step_1_classify' });
  const start = Date.now();

  const ocrHint = ctx.ocrText ? `\n- OCR с фото: ${ctx.ocrText.slice(0, 300)}` : '';

  const prompt = `/no_think
Верни ТОЛЬКО JSON. Не объясняй.

{"type":"road|lighting|waste|greenery|utilities|parking|vandal|other","severity":"critical|high|medium|low","detected_issue_title":"диагноз до 10 слов","ai_comment":"что произошло и что делать","risk_for":"кто под риском","recommended_action":"действие","estimated_fix_time":"срок","responsible_dept":"отдел"}

Тип: ${ctx.problemType || 'не указан'}
Адрес: ${ctx.address || 'не указан'}
Описание: ${ctx.comment || 'не указано'}
Кто: ${ctx.reporterRole || 'citizen'}
Фото: ${ctx.imagePresent ? 'да' : 'нет'}${ocrHint}`;

  let classification = null;
  try {
    const raw = await chatCompletion({
      system: 'Ты анализатор городских проблем. Отвечай ТОЛЬКО JSON без рассуждений.',
      user: prompt,
    });
    classification = extractJson(raw);
  } catch (err) {
    console.warn('Classify LLM failed:', err.message);
  }

  // Normalise
  const type = normalizeProblemType(classification?.type || ctx.problemType);
  const severity = normSeverity(classification?.severity);

  const result = {
    type,
    severity,
    detected_issue_title: classification?.detected_issue_title || `${TYPE_LABELS[type] || 'городская проблема'}`,
    ai_comment: classification?.ai_comment || '',
    risk_for: classification?.risk_for || '',
    recommended_action: classification?.recommended_action || '',
    estimated_fix_time: classification?.estimated_fix_time || '',
    responsible_dept: classification?.responsible_dept || '',
  };

  s.end({
    output: { type, severity, has_llm_response: !!classification },
    metadata: { latency_ms: Date.now() - start },
  });
  return result;
}

/* ------------------------------------------------------------------ */
/*  STEP 2  –  EMBED report text                                       */
/* ------------------------------------------------------------------ */

async function stepEmbed(ctx, span) {
  const s = span.span({ name: 'step_2_embed' });
  const start = Date.now();

  let embedding = [];
  const text = ctx.combinedText || ctx.comment || ctx.address || '';
  if (text && isConfigured()) {
    try {
      embedding = await getEmbedding(text);
    } catch (err) {
      console.warn('Embedding failed:', err.message);
    }
  }

  s.end({ metadata: { latency_ms: Date.now() - start, vector_dim: embedding.length } });
  return { embedding };
}

/* ------------------------------------------------------------------ */
/*  STEP 3  –  DEDUP  find similar reports                             */
/* ------------------------------------------------------------------ */

async function stepDedup(ctx, classification, embedding, supabase, span) {
  const s = span.span({ name: 'step_3_dedup' });
  const start = Date.now();

  let duplicateLikely = false;
  let similarCount = 0;
  let similarReports = [];

  if (supabase && ctx.lat != null && ctx.lng != null) {
    try {
      const latDelta = 0.0025;
      const lngDelta = 0.0025 / Math.max(Math.cos((ctx.lat * Math.PI) / 180), 0.3);

      // Geo-based: same type within 200m in last 7 days
      const { data } = await supabase
        .from('reports')
        .select('id, title, address, type, severity, status, created_at, lat, lng')
        .eq('type', classification.type)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .gte('lat', ctx.lat - latDelta)
        .lte('lat', ctx.lat + latDelta)
        .gte('lng', ctx.lng - lngDelta)
        .lte('lng', ctx.lng + lngDelta)
        .not('status', 'in', '("resolved","verified","rejected")')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(20);

      if (data?.length > 0) {
        // simple distance filter (Haversine approximation)
        const nearby = data.filter(r => {
          if (r.lat == null || r.lng == null) return false;
          const dLat = (r.lat - ctx.lat) * 111320;
          const dLng = (r.lng - ctx.lng) * 111320 * Math.cos(ctx.lat * Math.PI / 180);
          return Math.sqrt(dLat * dLat + dLng * dLng) < 200;
        });

        if (nearby.length > 0 && embedding.length > 0) {
          // Use reranker to check semantic similarity
          try {
            const docs = nearby.map(r => `${r.title || ''} ${r.address || ''}`);
            const ranked = await rerank({
              query: ctx.combinedText || ctx.comment || '',
              documents: docs,
              topN: 3,
            });
            similarReports = ranked
              .filter(r => r.relevance_score > 0.7)
              .map(r => nearby[r.index]);
            duplicateLikely = similarReports.length > 0;
            similarCount = similarReports.length;
          } catch {
            // reranker failed – fall back to geo count
            duplicateLikely = nearby.length > 0;
            similarCount = nearby.length;
          }
        } else {
          duplicateLikely = nearby.length > 0;
          similarCount = nearby.length;
        }
      }
    } catch (err) {
      console.warn('Dedup query failed:', err.message);
    }
  }

  s.end({
    output: { duplicate_likely: duplicateLikely, similar_count: similarCount },
    metadata: { latency_ms: Date.now() - start },
  });

  return { duplicateLikely, similarCount, similarReports };
}

/* ------------------------------------------------------------------ */
/*  STEP 4  –  ROUTE  decide responsible party                         */
/* ------------------------------------------------------------------ */

async function stepRoute(ctx, classification, dedup, span) {
  const s = span.span({ name: 'step_4_route' });
  const start = Date.now();

  // Rule-based baseline
  const ruleRoute = ruleBasedRoute(classification.type, ctx.reporterRole);

  // Try RAG retrieval for knowledge base context
  let ragContext = '';
  let ragUsed = false;
  if (isRagConfigured()) {
    try {
      ragContext = await getRoutingContext({
        type: classification.type,
        severity: classification.severity,
        address: ctx.address,
        reporterRole: ctx.reporterRole,
        aiComment: classification.ai_comment,
      });
      ragUsed = ragContext.length > 0;
    } catch (err) {
      console.warn('RAG retrieval failed:', err.message);
    }
  }

  // Try LLM routing with RAG context (or fallback hardcoded rules)
  let aiRoute = ruleRoute;
  let routeReasoning = '';

  if (isConfigured()) {
    try {
      const duplicateContext = dedup.duplicateLikely
        ? `\nВНИМАНИЕ: Найдено ${dedup.similarCount} похожих кейсов в радиусе 200м. Это может быть повторное обращение.`
        : '';

      const knowledgeSection = ragUsed
        ? `\nКонтекст из базы знаний акимата (RAG):\n${ragContext}`
        : `\nПравила маршрутизации:
- road/lighting/utilities/greenery → обычно government
- waste/parking/vandal → обычно shared (акимат + подрядчик)
- Если подал business → всегда shared
- Если critical severity → government (нужна быстрая реакция)`;

      const routePrompt = `/no_think
Верни ТОЛЬКО JSON. Не объясняй.

{"route":"government|business|shared","department":"департамент","sla":"срок SLA","reasoning":"причина маршрута"}

Тип: ${classification.type} (${TYPE_LABELS[classification.type]})
Серьёзность: ${classification.severity}
Кто: ${ctx.reporterRole}
Адрес: ${ctx.address || 'не указан'}
Описание: ${classification.ai_comment}${duplicateContext}
${knowledgeSection}`;

      const raw = await chatCompletion({
        system: 'Ты маршрутизатор городских кейсов акимата. Используй базу знаний для точных решений. Только JSON.',
        user: routePrompt,
      });
      const parsed = extractJson(raw);
      if (parsed?.route) {
        aiRoute = normRoute(parsed.route, ruleRoute);
        routeReasoning = parsed.reasoning || '';
        // Enrich classification with RAG-derived data
        if (parsed.department) classification.responsible_dept = parsed.department;
        if (parsed.sla) classification.estimated_fix_time = parsed.sla;
      }
    } catch (err) {
      console.warn('Route LLM failed:', err.message);
    }
  }

  const aiRuleAgreement = aiRoute === ruleRoute;

  s.end({
    output: { ai_route: aiRoute, rule_route: ruleRoute, agreement: aiRuleAgreement, rag_used: ragUsed },
    metadata: { latency_ms: Date.now() - start, reasoning: routeReasoning, rag_chunks: ragUsed ? ragContext.length : 0 },
  });

  return { route: aiRoute, ruleRoute, aiRuleAgreement, routeReasoning, ragUsed };
}

/* ------------------------------------------------------------------ */
/*  STEP 5  –  SCORE  weighted priority                                */
/* ------------------------------------------------------------------ */

function stepScore(ctx, classification, dedup, routing, span) {
  const s = span.span({ name: 'step_5_score' });
  const start = Date.now();

  const { score, factors } = computePriorityScore({
    severityKey: classification.severity,
    imagePresent: ctx.imagePresent,
    hasAddress: Boolean(ctx.address),
    commentLength: (ctx.comment || '').length,
    typeExplicit: ctx.problemType && ctx.problemType !== 'other',
    aiRouteMatchesRule: routing.aiRuleAgreement,
    duplicateNearbyCount: dedup.similarCount,
    minutesSinceCreation: 0,
  });

  s.end({ output: { score, factors }, metadata: { latency_ms: Date.now() - start } });
  return { score, factors };
}

/* ------------------------------------------------------------------ */
/*  STEP 6  –  EXPLAIN  assemble full trace                            */
/* ------------------------------------------------------------------ */

function stepExplain(ctx, classification, dedup, routing, scoring) {
  const confidenceFactors = [
    { name: 'Фото приложено', present: ctx.imagePresent, weight: 25 },
    { name: 'Адрес указан', present: Boolean(ctx.address), weight: 15 },
    { name: 'Описание подробное', present: (ctx.comment || '').length > 30, weight: 15 },
    { name: 'Тип указан', present: ctx.problemType && ctx.problemType !== 'other', weight: 10 },
    { name: 'AI и правила совпадают', present: routing.aiRuleAgreement, weight: 20 },
    { name: 'Найдены похожие кейсы', present: dedup.similarCount > 0, weight: 15 },
  ];

  const confidenceScore = confidenceFactors
    .filter(f => f.present)
    .reduce((sum, f) => sum + f.weight, 0);

  const confidenceLabel = confidenceScore >= 70 ? 'high' : confidenceScore >= 40 ? 'medium' : 'low';

  return {
    confidence_score: confidenceScore,
    confidence_label: confidenceLabel,
    confidence_factors: confidenceFactors,
    routing_reasoning: routing.routeReasoning,
    rule_route: routing.ruleRoute,
    ai_route: routing.route,
    ai_rule_agreement: routing.aiRuleAgreement,
    rag_used: routing.ragUsed || false,
    priority_factors: scoring.factors,
    duplicate_likely: dedup.duplicateLikely,
    similar_count: dedup.similarCount,
    ocr_text: ctx.ocrText || null,
  };
}

/* ================================================================== */
/*  MAIN PIPELINE  –  orchestrate all steps                            */
/* ================================================================== */

/**
 * Run the full AI triage pipeline.
 *
 * @param {object} input
 * @param {string}  input.address
 * @param {string}  input.comment
 * @param {string}  input.problemType
 * @param {string}  input.reporterRole
 * @param {string}  input.imageUrl
 * @param {boolean} input.imagePresent
 * @param {number}  [input.lat]
 * @param {number}  [input.lng]
 * @param {object}  [supabase]  optional supabase client for dedup queries
 * @returns {Promise<object>} full triage result with explainability
 */
export async function runTriagePipeline(input, supabase = null, onProgress = null) {
  const pipelineStart = Date.now();
  const { trace, flush } = await createTrace('cityeye_triage_pipeline', {
    reporter_role: input.reporterRole,
    problem_type: input.problemType,
    has_image: input.imagePresent,
  });

  const pipelineTrace = [];
  const emitProgress = payload => {
    if (typeof onProgress !== 'function') return;
    try {
      onProgress(payload);
    } catch {
      // Ignore observer failures — pipeline must still finish.
    }
  };

  try {
    // Step 0: Input + OCR
    const t0 = Date.now();
    emitProgress({ step: 'input_ocr', state: 'step_started' });
    const enrichedCtx = await stepInput(input, trace);
    const step0 = { step: 'input_ocr', latency_ms: Date.now() - t0, result: enrichedCtx.ocrText ? 'ocr_extracted' : 'no_ocr' };
    pipelineTrace.push(step0);
    emitProgress({ ...step0, state: 'step_completed' });

    // Step 1 + 2: Classify & Embed IN PARALLEL (they are independent)
    const t12 = Date.now();
    emitProgress({ step: 'classify', state: 'step_started', meta: { branch: 'parallel' } });
    emitProgress({ step: 'embed', state: 'step_started', meta: { branch: 'parallel' } });

    const classifyPromise = stepClassify(enrichedCtx, trace)
      .then(classification => {
        const event = {
          step: 'classify',
          latency_ms: Date.now() - t12,
          model: 'qwen3',
          result: `${classification.type}/${classification.severity}`,
        };
        pipelineTrace.push(event);
        emitProgress({ ...event, state: 'step_completed', meta: { branch: 'parallel' } });
        return classification;
      })
      .catch(error => {
        emitProgress({ step: 'classify', state: 'step_failed', error: error.message, meta: { branch: 'parallel' } });
        throw error;
      });

    const embedPromise = stepEmbed(enrichedCtx, trace)
      .then(({ embedding }) => {
        const event = {
          step: 'embed',
          latency_ms: Date.now() - t12,
          vector_dim: embedding.length,
          result: `${embedding.length}d vector`,
        };
        pipelineTrace.push(event);
        emitProgress({ ...event, state: 'step_completed', meta: { branch: 'parallel' } });
        return { embedding };
      })
      .catch(error => {
        emitProgress({ step: 'embed', state: 'step_failed', error: error.message, meta: { branch: 'parallel' } });
        throw error;
      });

    const [classification, { embedding }] = await Promise.all([classifyPromise, embedPromise]);

    // Step 3: Dedup
    const t3 = Date.now();
    emitProgress({ step: 'dedup', state: 'step_started' });
    const dedup = await stepDedup(enrichedCtx, classification, embedding, supabase, trace);
    const step3 = { step: 'dedup', latency_ms: Date.now() - t3, result: `${dedup.similarCount} similar` };
    pipelineTrace.push(step3);
    emitProgress({ ...step3, state: 'step_completed' });

    // Step 4: Route
    const t4 = Date.now();
    emitProgress({ step: 'route', state: 'step_started' });
    const routing = await stepRoute(enrichedCtx, classification, dedup, trace);
    const step4 = {
      step: 'route',
      latency_ms: Date.now() - t4,
      result: routing.route,
      agreement: routing.aiRuleAgreement,
      rag: routing.ragUsed ? 'RAGFlow KB' : 'rules',
    };
    pipelineTrace.push(step4);
    emitProgress({ ...step4, state: 'step_completed' });

    // Step 5: Score
    const t5 = Date.now();
    emitProgress({ step: 'score', state: 'step_started' });
    const scoring = stepScore(enrichedCtx, classification, dedup, routing, trace);
    const step5 = { step: 'score', latency_ms: Date.now() - t5, result: scoring.score };
    pipelineTrace.push(step5);
    emitProgress({ ...step5, state: 'step_completed' });

    // Step 6: Explain
    emitProgress({ step: 'explain', state: 'step_started' });
    const explainability = stepExplain(enrichedCtx, classification, dedup, routing, scoring);
    const step6 = { step: 'explain', result: `confidence=${explainability.confidence_score}%` };
    pipelineTrace.push(step6);
    emitProgress({ ...step6, state: 'step_completed' });

    const totalLatency = Date.now() - pipelineStart;
    const totalEvent = { step: 'total', latency_ms: totalLatency };
    pipelineTrace.push(totalEvent);
    emitProgress({ ...totalEvent, state: 'pipeline_completed' });

    trace.update({ output: { score: scoring.score, route: routing.route, severity: classification.severity } });

    const result = {
      // Core triage fields (backward-compatible with old single-call format)
      detected_issue_title: classification.detected_issue_title,
      type: classification.type,
      severity: classification.severity === 'critical' ? 'КРИТИЧНО'
        : classification.severity === 'high' ? 'ВЫСОКО'
          : classification.severity === 'low' ? 'НИЗКО' : 'СРЕДНЕ',
      priority_score: scoring.score,
      ai_comment: classification.ai_comment,
      recommended_action: classification.recommended_action,
      estimated_fix_time: classification.estimated_fix_time,
      responsible_dept: classification.responsible_dept,
      risk_for: classification.risk_for,
      duplicate_likely: dedup.duplicateLikely,
      suggested_responsible_role: routing.route,
      confidence_label: explainability.confidence_label,

      // NEW: explainability payload for frontend
      explainability: {
        confidence_score: explainability.confidence_score,
        confidence_factors: explainability.confidence_factors,
        priority_factors: explainability.priority_factors,
        routing_reasoning: explainability.routing_reasoning,
        rule_route: explainability.rule_route,
        ai_route: explainability.ai_route,
        ai_rule_agreement: explainability.ai_rule_agreement,
        rag_used: explainability.rag_used,
        similar_count: explainability.similar_count,
        ocr_text: explainability.ocr_text,
      },

      // NEW: pipeline trace for transparency
      ai_pipeline_trace: pipelineTrace,
      pipeline_latency_ms: totalLatency,
    };

    await flush();
    return result;
  } catch (err) {
    emitProgress({
      step: 'pipeline',
      state: 'step_failed',
      error: err.message,
    });
    trace.update({ output: { error: err.message } });
    await flush();
    throw err;
  }
}
