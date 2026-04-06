import { NextResponse } from 'next/server';
import { buildAnalyticsOverview } from '../../../../backend/src/analytics.js';
import { readAnalyticsSource } from '../../../../lib/server/reportRepository.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { reports, summary, source } = await readAnalyticsSource();
    const overview = buildAnalyticsOverview(reports);
    return NextResponse.json({
      ...overview,
      ...summary,
      source,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to build analytics overview',
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
