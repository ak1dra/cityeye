import { runTriagePipeline } from '../../../../backend/src/aiPipeline.js';
import { buildAnalyzeContext, createOptionalSupabaseClient } from '../../../../lib/server/analyzeContext.js';
import { validateAnalyzePayload } from '../../../../lib/server/apiValidation.js';
import {
  buildAnalyzeCacheKey,
  getCachedAnalyzeResult,
  setCachedAnalyzeResult,
} from '../../../../lib/server/analyzeCache.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function writeSse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request) {
  let context;

  try {
    const body = validateAnalyzePayload(await request.json().catch(() => ({})));
    context = buildAnalyzeContext(body);
  } catch (error) {
    return Response.json(
      {
        error: 'Invalid analyze payload',
        detail: error.message,
      },
      { status: error.statusCode || 400 }
    );
  }

  if (!process.env.ALEM_API_KEY) {
    return Response.json(
      {
        error: 'AI not configured',
        detail: 'Set ALEM_API_KEY to enable the AI pipeline',
      },
      { status: 503 }
    );
  }

  const cacheKey = buildAnalyzeCacheKey(context);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const cached = getCachedAnalyzeResult(cacheKey);
      if (cached) {
        controller.enqueue(encoder.encode(writeSse('pipeline_completed', {
          step: 'pipeline',
          state: 'pipeline_completed',
          cached: true,
        })));
        controller.enqueue(encoder.encode(writeSse('result', cached)));
        controller.close();
        return;
      }

      const sendProgress = event => {
        const eventName =
          event.state === 'step_started' ? 'step_started'
            : event.state === 'step_failed' ? 'step_failed'
              : event.state === 'pipeline_completed' ? 'pipeline_completed'
                : 'step_completed';

        controller.enqueue(encoder.encode(writeSse(eventName, event)));
      };

      try {
        const supabase = createOptionalSupabaseClient();
        const result = await runTriagePipeline(context, supabase, sendProgress);
        setCachedAnalyzeResult(cacheKey, result);
        controller.enqueue(encoder.encode(writeSse('result', result)));
      } catch (error) {
        controller.enqueue(encoder.encode(writeSse('step_failed', {
          step: 'pipeline',
          state: 'step_failed',
          error: error.message,
        })));
        controller.enqueue(encoder.encode(writeSse('error', {
          error: 'AI pipeline failed',
          detail: error.message,
        })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
