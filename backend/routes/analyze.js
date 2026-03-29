import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createReport } from '../src/reportStore.js';

const router = Router();
const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const client = apiKey ? new Anthropic({ apiKey }) : null;

function getMediaType(base64) {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGO')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

function normalizeImagePayload(image) {
  const source = typeof image === 'string' ? image.trim() : '';
  if (!source) {
    const err = new Error('No image provided');
    err.statusCode = 400;
    throw err;
  }

  if (source.startsWith('data:image/') && source.includes(',')) {
    const [meta, base64] = source.split(',', 2);
    const mediaType = meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/i)?.[1] ?? getMediaType(base64);
    return { base64Data: base64, mediaType, dataUrl: source };
  }

  const mediaType = getMediaType(source);
  return { base64Data: source, mediaType, dataUrl: `data:${mediaType};base64,${source}` };
}

function extractJson(text) {
  const source = typeof text === 'string' ? text : '';
  const cleaned = source.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('AI response does not contain a JSON object');
  }

  return cleaned.slice(start, end + 1);
}

function buildPrompt({ address, comment, problemType }) {
  return `Ты AI-аналитик городской инфраструктуры CityEye в Казахстане.
Проанализируй фото и верни только JSON без markdown в формате:
{
  "title": "краткий заголовок проблемы",
  "description": "2-3 предложения с деталями и рисками",
  "category": "road | lighting | greenery | utilities | waste | other",
  "severity": "critical | high | medium | low",
  "estimated_resolution_days": 1,
  "recommendations": ["действие 1", "действие 2", "действие 3"]
}

Требования:
- Ответ строго JSON-объект.
- category и severity только из перечисленных значений.
- estimated_resolution_days целое число от 1 до 365.
- recommendations массив из 2-4 конкретных действий.

Контекст от пользователя:
${problemType ? `Тип проблемы: ${problemType}` : 'Тип проблемы не указан'}
${comment ? `Комментарий: ${comment}` : 'Комментарий не указан'}
${address ? `Адрес: ${address}` : 'Адрес не указан'}`;
}

router.post('/', async (req, res) => {
  try {
    const { image, address, comment, problemType } = req.body ?? {};
    const { base64Data, mediaType, dataUrl } = normalizeImagePayload(image);

    if (!client) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY is not configured',
        hint: 'Set ANTHROPIC_API_KEY in backend/.env',
      });
    }

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: buildPrompt({ address, comment, problemType }),
            },
          ],
        },
      ],
    });

    const textPart = response.content.find(part => part.type === 'text')?.text;
    if (!textPart) {
      throw new Error('AI returned an empty response');
    }

    const parsed = JSON.parse(extractJson(textPart));
    const report = await createReport({
      ...parsed,
      address,
      comment,
      problemType,
      image: dataUrl,
      media_type: mediaType,
      status: 'new',
    });

    res.status(201).json(report);
  } catch (err) {
    console.error('Analysis error:', err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    res.status(500).json({ error: err.message, hint: 'Check ANTHROPIC_API_KEY and AI response format' });
  }
});

export default router;
