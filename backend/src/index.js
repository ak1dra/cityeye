import 'dotenv/config';
import express from 'express';
import analyzeRouter from '../routes/analyze.js';
import { createReport, readReports, updateReportStatus, VALID_STATUSES } from './reportStore.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
  });
});

app.use('/api/analyze', analyzeRouter);

app.get('/api/reports', async (_req, res) => {
  try {
    res.json(await readReports());
  } catch {
    res.status(500).json({ error: 'Failed to read reports' });
  }
});

app.post('/api/reports', async (req, res) => {
  const payload = req.body ?? {};
  const hasMeaningfulInput = ['title', 'description', 'image', 'address', 'comment', 'type', 'category', 'problemType']
    .some(key => typeof payload[key] === 'string' && payload[key].trim().length > 0);

  if (!hasMeaningfulInput) {
    return res.status(400).json({
      error: 'Provide at least one field: title, description, image, address, comment, type, category, problemType',
    });
  }

  try {
    const report = await createReport(payload);
    res.status(201).json(report);
  } catch {
    res.status(500).json({ error: 'Failed to create report' });
  }
});

app.patch('/api/reports/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body ?? {};

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const updated = await updateReportStatus(id, status);
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
