import { NextResponse } from 'next/server';
import { buildAssistantResponse } from '../../../lib/server/assistantService.js';
import { validateAssistantPayload } from '../../../lib/server/apiValidation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = validateAssistantPayload(await request.json().catch(() => ({})));
    const result = await buildAssistantResponse(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Assistant failed:', error.message);
    return NextResponse.json(
      {
        error: error.statusCode ? 'Invalid assistant payload' : 'Assistant request failed',
        detail: error.message,
      },
      { status: error.statusCode || 500 }
    );
  }
}
