import { NextResponse } from 'next/server';
import { isOcrConfigured, verifyCompletion } from '../../../backend/src/alemServices.js';
import { validateVerifyPayload } from '../../../lib/server/apiValidation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isOcrConfigured()) {
    return NextResponse.json({ error: 'OCR/Vision model not configured' }, { status: 503 });
  }

  try {
    const { before_url, after_url, type, description } = validateVerifyPayload(
      await request.json().catch(() => ({}))
    );
    const result = await verifyCompletion(before_url, after_url, { type, description });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Verify failed:', error.message);
    return NextResponse.json(
      { error: 'Verification failed', detail: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
