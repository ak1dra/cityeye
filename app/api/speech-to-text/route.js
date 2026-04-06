import { NextResponse } from 'next/server';
import { isSttConfigured, speechToText } from '../../../backend/src/alemServices.js';
import { validateSpeechPayload } from '../../../lib/server/apiValidation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isSttConfigured()) {
    return NextResponse.json(
      { error: 'Speech-to-text not configured (ALEM_STT_API_KEY missing)' },
      { status: 503 }
    );
  }

  try {
    const body = validateSpeechPayload(await request.json().catch(() => ({})));
    const filename = body.filename || 'audio.webm';
    const audioBuffer = Buffer.from(body.audio_base64, 'base64');
    const text = await speechToText(audioBuffer, filename);
    return NextResponse.json({ text, language: 'auto' });
  } catch (error) {
    console.error('STT error:', error.message);
    return NextResponse.json(
      {
        error: error.statusCode ? 'Invalid speech payload' : 'Speech-to-text failed',
        detail: error.message,
      },
      { status: error.statusCode || 500 }
    );
  }
}
