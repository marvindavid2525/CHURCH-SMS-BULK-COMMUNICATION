import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { authRouter } from './server/routes/auth.js';
import { membersRouter } from './server/routes/members.js';
import { departmentsRouter } from './server/routes/departments.js';
import { smsRouter } from './server/routes/sms.js';
import { webhookRouter } from './server/routes/webhook.js';
import { settingsRouter } from './server/routes/settings.js';
import { reportsRouter } from './server/routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // CORS headers for API
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-webhook-secret');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'ChurchSMS Manager',
      church: 'Omega Prayer Mission Church Mbuya',
      timestamp: new Date().toISOString(),
    });
  });

  // API Route Mounts
  app.use('/api/auth', authRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/departments', departmentsRouter);
  app.use('/api/sms', smsRouter);
  app.use('/api/campaigns', smsRouter);
  app.use('/api/google-sheets/webhook', webhookRouter);
  app.use('/api/google-sheets', webhookRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/reports', reportsRouter);

  // Serve static files in production or Vite in development
  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('Production build dist/ not found, please run npm run build.');
    }
  } else {
    // Development mode with Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChurchSMS Manager backend listening on http://0.0.0.0:${PORT}`);
    console.log(`Omega Prayer Mission Church Mbuya, Uganda`);
  });
}

startServer().catch(err => {
  console.error('Failed to start ChurchSMS Manager server:', err);
  process.exit(1);
});
