import { NextResponse } from 'next/server';
import { createReport, readReportsPage } from '../../../lib/server/reportRepository.js';
import {
  assertReportCreator,
  buildReportAuthorFields,
  requireAuthenticatedRequest,
} from '../../../lib/server/requestAuth.js';
import {
  parseReportListParams,
  validateCreateReportPayload,
} from '../../../lib/server/reportValidation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const params = parseReportListParams(request.nextUrl.searchParams);
    const page = await readReportsPage(params);
    return NextResponse.json(page);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to read reports' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request) {
  let auth;

  try {
    auth = await requireAuthenticatedRequest(request);
    assertReportCreator(auth);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Authentication required' },
      { status: error.statusCode || 401 }
    );
  }

  const payload = await request.json().catch(() => ({}));
  try {
    validateCreateReportPayload(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode || 400 }
    );
  }

  try {
    const report = await createReport(
      {
        ...payload,
        ...buildReportAuthorFields(auth.profile),
      },
      { authToken: auth.token }
    );

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('POST /api/reports error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create report' },
      { status: 500 }
    );
  }
}
