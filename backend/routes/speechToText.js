/**
 * Speech-to-text endpoint.
 *
 * Accepts audio (webm/wav/mp3/ogg) and returns transcribed text
 * using Alem's Kazakh/Russian STT model.
 *
 * POST /api/speech-to-text
 *   Content-Type: multipart/form-data  OR  application/json { audio_base64, filename }
 */

import { Router } from 'express';
import { speechToText, isSttConfigured } from '../src/alemServices.js';

const router = Router();

router.post('/', async (req, res) => {
  if (!isSttConfigured()) {
    return res.status(503).json({ error: 'Speech-to-text not configured (ALEM_STT_API_KEY missing)' });
  }

  try {
    let audioBuffer;
    let filename = 'audio.webm';

    if (req.body?.audio_base64) {
      // JSON body with base64-encoded audio
      audioBuffer = Buffer.from(req.body.audio_base64, 'base64');
      filename = req.body.filename || filename;
    } else {
      return res.status(400).json({ error: 'Provide audio_base64 in request body' });
    }

    const text = await speechToText(audioBuffer, filename);
    return res.json({ text, language: 'auto' });
  } catch (err) {
    console.error('STT error:', err.message);
    return res.status(500).json({ error: 'Speech-to-text failed' });
  }
});

export default router;
