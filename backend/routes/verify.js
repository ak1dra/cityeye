import { Router } from 'express';
import { verifyCompletion, isOcrConfigured } from '../src/alemServices.js';

const router = Router();

/**
 * POST /api/verify
 * AI-verify that a reported issue was actually fixed by comparing before/after photos.
 *
 * Body: { before_url, after_url, type?, description? }
 * Response: { verdict, confidence, reasoning, changes_detected }
 */
router.post('/', async (req, res) => {
  if (!isOcrConfigured()) {
    return res.status(503).json({ error: 'OCR/Vision model not configured' });
  }

  const { before_url, after_url, type, description } = req.body || {};

  if (!before_url || !after_url) {
    return res.status(400).json({ error: 'Both before_url and after_url are required' });
  }

  try {
    const result = await verifyCompletion(before_url, after_url, { type, description });
    res.json(result);
  } catch (err) {
    console.error('Verify failed:', err.message);
    res.status(500).json({ error: 'Verification failed', detail: err.message });
  }
});

export default router;
