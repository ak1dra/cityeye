/**
 * POST /api/analyze — AI triage endpoint.
 *
 * Primary path: 7-step AI pipeline (aiPipeline.js)
 *   INPUT/OCR → CLASSIFY → EMBED → DEDUP → ROUTE → SCORE → EXPLAIN
 *
 * Fallback: returns error (no silent mocking — AI is the core, not decoration).
 */
import { Router } from 'express';

const router = Router();

function toStr(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function buildAnalyzeContext(body = {}) {
  return {
    address: toStr(body.address),
    comment: toStr(body.comment),
    problemType: body.problemType,
    reporterRole: toStr(body.reporter_role) ?? 'citizen',
    imageUrl: toStr(body.image_url),
    imagePresent: Boolean(body.image_present || body.image_url),
    lat: body.lat != null ? Number(body.lat) : undefined,
    lng: body.lng != null ? Number(body.lng) : undefined,
  };
}

async function createOptionalSupabaseClient() {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (url && key) return createClient(url, key);
  } catch {
    // Supabase is optional for dedup.
  }

  return null;
}

function writeSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.post('/', async (req, res) => {
  const context = buildAnalyzeContext(req.body);

  // Primary: multi-step AI pipeline
  if (process.env.ALEM_API_KEY) {
    try {
      const { runTriagePipeline } = await import('../src/aiPipeline.js');
      const supabase = await createOptionalSupabaseClient();
      const result = await runTriagePipeline(context, supabase);
      return res.json(result);
    } catch (err) {
      console.error('AI pipeline failed:', err.message);
      return res.status(500).json({
        error: 'AI pipeline failed',
        detail: err.message,
        detected_issue_title: 'Ошибка AI-анализа',
        type: context.problemType || 'other',
        severity: 'СРЕДНЕ',
        priority_score: 50,
        ai_comment: 'AI-пайплайн временно недоступен. Кейс принят без автоматической классификации.',
        suggested_responsible_role: 'government',
        confidence_label: 'low',
      });
    }
  }

  // No AI key configured
  return res.status(503).json({
    error: 'AI not configured',
    detail: 'Set ALEM_API_KEY to enable the AI pipeline',
  });
});

router.post('/stream', async (req, res) => {
  const context = buildAnalyzeContext(req.body);

  if (!process.env.ALEM_API_KEY) {
    return res.status(503).json({
      error: 'AI not configured',
      detail: 'Set ALEM_API_KEY to enable the AI pipeline',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendProgress = event => {
    const eventName =
      event.state === 'step_started' ? 'step_started'
        : event.state === 'step_failed' ? 'step_failed'
          : event.state === 'pipeline_completed' ? 'pipeline_completed'
            : 'step_completed';
    writeSse(res, eventName, event);
  };

  try {
    const { runTriagePipeline } = await import('../src/aiPipeline.js');
    const supabase = await createOptionalSupabaseClient();
    const result = await runTriagePipeline(context, supabase, sendProgress);
    writeSse(res, 'result', result);
    res.end();
  } catch (err) {
    writeSse(res, 'step_failed', {
      step: 'pipeline',
      state: 'step_failed',
      error: err.message,
    });
    writeSse(res, 'error', {
      error: 'AI pipeline failed',
      detail: err.message,
    });
    res.end();
  }
});

export default router;
