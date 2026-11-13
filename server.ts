import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { NE_INDIA_HUBS, generateSyntheticDataset } from './server/neIndiaData.ts';
import {
  computeMovingAverageForecasts,
  evaluateDeterministicRecommendations,
} from './server/forecastEngine.ts';
import {
  requireFirebaseAuth,
  type AuthenticatedRequest,
} from './server/authMiddleware.ts';
import type { HubLeadTimeOverride, InventoryBatch, SalesHistoryRecord } from './src/types/pharma.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_RECORDS_PER_REQUEST = 2500;

function validateOwnedRecords(
  records: Array<{ ownerId?: unknown }>,
  uid: string
): boolean {
  return records.every((rec) => typeof rec === 'object' && rec !== null && rec.ownerId === uid);
}

function sanitizeHubOverrides(
  raw: unknown
): Record<string, HubLeadTimeOverride> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: Record<string, HubLeadTimeOverride> = {};
  for (const [hubId, val] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(hubId)) continue;
    if (!val || typeof val !== 'object') continue;
    const item = val as { leadTimeDays?: unknown; monsoonBufferDays?: unknown };
    const lead = Number(item.leadTimeDays);
    const buffer = Number(item.monsoonBufferDays);
    if (Number.isFinite(lead) && Number.isFinite(buffer)) {
      result[hubId] = {
        leadTimeDays: Math.max(1, Math.min(45, Math.round(lead))),
        monsoonBufferDays: Math.max(0, Math.min(30, Math.round(buffer))),
      };
    }
  }
  return result;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  // Public Health Check (no sensitive data)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'MediFlow AI Backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Protected Northeast India Distribution Hubs Metadata
  app.get('/api/hubs', requireFirebaseAuth, (_req, res) => {
    res.json({ hubs: NE_INDIA_HUBS });
  });

  // Protected Synthetic Demonstration Dataset Generator (returns payload only; never modifies DB directly)
  app.post('/api/seed/generate', requireFirebaseAuth, (_req, res) => {
    const dataset = generateSyntheticDataset(new Date());
    res.json(dataset);
  });

  // Protected Moving-Average Demand Forecasting Endpoint
  app.post('/api/forecast/compute', requireFirebaseAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.authUser?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Unauthenticated request.' });
      return;
    }

    const body = req.body as {
      batches?: InventoryBatch[];
      salesHistory?: SalesHistoryRecord[];
      hubId?: string;
      hubOverrides?: unknown;
    };

    if (!Array.isArray(body?.batches) || !Array.isArray(body?.salesHistory)) {
      res.status(400).json({ error: 'batches and salesHistory arrays are required.' });
      return;
    }
    if (
      body.batches.length > MAX_RECORDS_PER_REQUEST ||
      body.salesHistory.length > MAX_RECORDS_PER_REQUEST
    ) {
      res.status(400).json({ error: 'Payload exceeds maximum record limit.' });
      return;
    }
    if (
      !validateOwnedRecords(body.batches, uid) ||
      !validateOwnedRecords(body.salesHistory, uid)
    ) {
      res.status(403).json({ error: 'Forbidden: records must belong to the authenticated user.' });
      return;
    }

    const forecasts = computeMovingAverageForecasts(
      body.batches,
      body.salesHistory,
      body.hubId,
      new Date(),
      sanitizeHubOverrides(body.hubOverrides)
    );
    res.json({ forecasts });
  });

  // Protected Deterministic Business-Rules Recommendations Endpoint
  app.post('/api/recommendations/evaluate', requireFirebaseAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.authUser?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Unauthenticated request.' });
      return;
    }

    const body = req.body as {
      batches?: InventoryBatch[];
      salesHistory?: SalesHistoryRecord[];
      hubOverrides?: unknown;
    };

    if (!Array.isArray(body?.batches) || !Array.isArray(body?.salesHistory)) {
      res.status(400).json({ error: 'batches and salesHistory arrays are required.' });
      return;
    }
    if (
      body.batches.length > MAX_RECORDS_PER_REQUEST ||
      body.salesHistory.length > MAX_RECORDS_PER_REQUEST
    ) {
      res.status(400).json({ error: 'Payload exceeds maximum record limit.' });
      return;
    }
    if (
      !validateOwnedRecords(body.batches, uid) ||
      !validateOwnedRecords(body.salesHistory, uid)
    ) {
      res.status(403).json({ error: 'Forbidden: records must belong to the authenticated user.' });
      return;
    }

    const recommendations = evaluateDeterministicRecommendations(
      body.batches,
      body.salesHistory,
      new Date(),
      sanitizeHubOverrides(body.hubOverrides)
    );
    res.json({ recommendations });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MediFlow AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MediFlow AI server:', err);
  process.exit(1);
});
