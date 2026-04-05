import 'dotenv/config';
import express from 'express';
import analyzeRouter from '../routes/analyze.js';
import analyticsRouter from '../routes/analytics.js';
import assistantRouter from '../routes/assistant.js';
import speechToTextRouter from '../routes/speechToText.js';
import verifyRouter from '../routes/verify.js';
import {
  buildReportAuthorFields,
  requireAuthenticatedProfile,
  requireManagedRole,
  requireReportCreator,
} from './auth.js';
import {
  createReport,
  readReports,
  updateReport,
  VALID_STATUSES,
  PATCHABLE_REPORT_FIELDS,
} from './reportStore.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const ANALYZE_PROVIDER = process.env.ALEM_API_KEY
  ? 'alem'
  : process.env.ANTHROPIC_API_KEY
    ? 'anthropic'
    : 'mock';
const ANALYZE_MODEL = ANALYZE_PROVIDER === 'alem'
  ? (process.env.ALEM_MODEL || 'qwen3')
  : ANALYZE_PROVIDER === 'anthropic'
    ? (process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest')
    : 'mock-triage';

app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    analyze_provider: ANALYZE_PROVIDER,
    analyze_model: ANALYZE_MODEL,
  });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/speech-to-text', speechToTextRouter);
app.use('/api/verify', verifyRouter);

app.get('/api/reports', async (_req, res) => {
  try {
    res.json(await readReports());
  } catch {
    res.status(500).json({ error: 'Failed to read reports' });
  }
});

app.post('/api/reports', requireAuthenticatedProfile, requireReportCreator, async (req, res) => {
  const payload = req.body ?? {};
  const hasMeaningfulInput = ['title', 'description', 'image', 'address', 'comment', 'type', 'category', 'problemType']
    .some(key => typeof payload[key] === 'string' && payload[key].trim().length > 0);

  if (!hasMeaningfulInput) {
    return res.status(400).json({
      error: 'Provide at least one field: title, description, image, address, comment, type, category, problemType',
    });
  }

  try {
    const report = await createReport(
      {
        ...payload,
        ...buildReportAuthorFields(req.auth.profile),
      },
      { authToken: req.auth.token }
    );
    res.status(201).json(report);
  } catch (err) {
    console.error('POST /api/reports error:', err);
    res.status(500).json({ error: err.message || 'Failed to create report' });
  }
});

app.patch('/api/reports/:id', requireAuthenticatedProfile, requireManagedRole, async (req, res) => {
  const { id } = req.params;
  const payload = req.body ?? {};
  const hasPatchField = PATCHABLE_REPORT_FIELDS.some(field =>
    Object.prototype.hasOwnProperty.call(payload, field)
  );

  if (!hasPatchField) {
    return res.status(400).json({
      error: `Provide at least one updatable field: ${PATCHABLE_REPORT_FIELDS.join(', ')}`,
    });
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'status')
    && payload.status
    && !VALID_STATUSES.includes(String(payload.status).trim().toLowerCase())
  ) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const updated = await updateReport(id, payload, { authToken: req.auth.token });
    res.json(updated);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    res.status(500).json({ error: 'Failed to save reports' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
