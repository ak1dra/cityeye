import { Router } from 'express';
import { buildAnalyticsOverview } from '../src/analytics.js';
import { readReports } from '../src/reportStore.js';

const router = Router();

router.get('/overview', async (_req, res) => {
  try {
    const reports = await readReports();
    res.json(buildAnalyticsOverview(reports));
  } catch (error) {
    res.status(500).json({
      error: 'Failed to build analytics overview',
      detail: error.message,
    });
  }
});

export default router;
