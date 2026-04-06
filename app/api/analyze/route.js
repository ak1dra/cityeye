import { NextResponse } from 'next/server';
import { runTriagePipeline } from '../../../backend/src/aiPipeline.js';
import { buildAnalyzeContext, createOptionalSupabaseClient } from '../../../lib/server/analyzeContext.js';
import { validateAnalyzePayload } from '../../../lib/server/apiValidation.js';
import {
  buildAnalyzeCacheKey,
  getCachedAnalyzeResult,
  setCachedAnalyzeResult,
} from '../../../lib/server/analyzeCache.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = validateAnalyzePayload(await request.json().catch(() => ({})));
    const context = buildAnalyzeContext(body);
    const cacheKey = buildAnalyzeCacheKey(context);

    if (!process.env.ALEM_API_KEY) {
      return NextResponse.json(
        {
          error: 'AI not configured',
          detail: 'Set ALEM_API_KEY to enable the AI pipeline',
        },
        { status: 503 }
      );
    }

    const cached = getCachedAnalyzeResult(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'x-cityeye-analyze-cache': 'hit' },
      });
    }

    const supabase = createOptionalSupabaseClient();
    const result = await runTriagePipeline(context, supabase);
    setCachedAnalyzeResult(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI pipeline failed:', error.message);
    return NextResponse.json(
      {
        error: error.statusCode ? 'Invalid analyze payload' : 'AI pipeline failed',
        detail: error.message,
        ...(error.statusCode ? {} : {
          detected_issue_title: 'Ошибка AI-анализа',
          type: 'other',
          severity: 'СРЕДНЕ',
          priority_score: 50,
          ai_comment: 'AI-пайплайн временно недоступен. Кейс принят без автоматической классификации.',
          suggested_responsible_role: 'government',
          confidence_label: 'low',
        }),
      },
      { status: error.statusCode || 500 }
    );
  }
}
