import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createReport } from '../src/reportStore.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getMediaType(b64) {
  if (b64.startsWith('/9j/'))   return 'image/jpeg';
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('R0lGO')) return 'image/gif';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

function extractJson(text) {
  const cleaned = text.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('AI response does not contain a JSON object');
  }
  return cleaned.slice(start, end + 1);
}

const SEV_MAP = {
  'КРИТИЧНО': 'critical',
  'ВЫСОКО':   'high',
  'СРЕДНЕ':   'medium',
  'НИЗКО':    'low',
};

router.post('/', async (req, res) => {
  try {
    const { image, address, comment, problemType } = req.body ?? {};

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY is not configured',
        hint: 'Set ANTHROPIC_API_KEY in backend/.env',
      });
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const mediaType  = getMediaType(base64Data);
    const dataUrl    = image.includes(',') ? image : `data:${mediaType};base64,${base64Data}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data },
          },
          {
            type: 'text',
            text: `Анализируй фото городской проблемы.
Верни ТОЛЬКО JSON без markdown:
{
  "type": "тип проблемы",
  "severity": "КРИТИЧНО | ВЫСОКО | СРЕДНЕ | НИЗКО",
  "priority_score": число 0-100,
  "ai_comment": "2-3 предложения",
  "recommended_action": "действие",
  "estimated_fix_time": "срок",
  "responsible_dept": "отдел",
  "risk_for": "кто под риском",
  "duplicate_likely": false
}
${address ? 'Адрес: ' + address : ''}
${comment ? 'Комментарий: ' + comment : ''}`,
          },
        ],
      }],
    });

    const text   = response.content[0].text;
    const parsed = JSON.parse(extractJson(text));

    const severityEn = SEV_MAP[parsed.severity?.toUpperCase?.()] ?? 'medium';
    const report = await createReport({
      title:                    parsed.type,
      description:              parsed.ai_comment,
      category:                 problemType ?? 'other',
      severity:                 severityEn,
      priority_score:           parsed.priority_score,
      ai_comment:               parsed.ai_comment,
      recommended_action:       parsed.recommended_action,
      estimated_fix_time:       parsed.estimated_fix_time,
      responsible_dept:         parsed.responsible_dept,
      risk_for:                 parsed.risk_for,
      duplicate_likely:         parsed.duplicate_likely ?? false,
      estimated_resolution_days: 1,
      recommendations:          [parsed.recommended_action].filter(Boolean),
      address,
      comment,
      problemType,
      image:                    dataUrl,
      media_type:               mediaType,
      status:                   'new',
    });

    res.status(201).json(report);
  } catch (err) {
    console.error('Analysis error:', err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: err.message, hint: 'Check ANTHROPIC_API_KEY and image format' });
  }
});

export default router;
