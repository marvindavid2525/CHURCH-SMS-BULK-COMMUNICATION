import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAdmin } from './auth.js';
import { BulkSMSUgandaService } from '../smsService.js';

export const settingsRouter = Router();

settingsRouter.use(requireAdmin);

/**
 * GET /api/settings
 * Mask sensitive API key when returning to client
 */
settingsRouter.get('/', (req: Request, res: Response) => {
  const currentDb = db.get();
  const rawApiKey = currentDb.providerSettings.apiKey || process.env.BULKSMSUGANDA_API_KEY || '';

  const maskedKey = rawApiKey
    ? `${rawApiKey.substring(0, 4)}••••••••${rawApiKey.substring(Math.max(0, rawApiKey.length - 4))}`
    : '';

  res.json({
    providerSettings: {
      ...currentDb.providerSettings,
      apiKey: maskedKey,
      isApiKeyConfigured: Boolean(rawApiKey),
    },
    generalSettings: currentDb.generalSettings,
  });
});

/**
 * PUT /api/settings/provider
 * Update SMS provider configuration
 */
settingsRouter.put('/provider', (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const { baseUrl, apiKey, authScheme, defaultSenderId } = req.body;

  db.update(d => {
    if (baseUrl !== undefined) d.providerSettings.baseUrl = baseUrl.trim();
    // Only update API key if a non-masked value was provided
    if (apiKey !== undefined && !apiKey.includes('••••')) {
      d.providerSettings.apiKey = apiKey.trim();
    }
    if (authScheme !== undefined) d.providerSettings.authScheme = authScheme;
    if (defaultSenderId !== undefined) d.providerSettings.defaultSenderId = defaultSenderId.trim();
  });

  db.logAudit(admin.email, 'UPDATE_PROVIDER_SETTINGS', 'Updated Bulk SMS Uganda provider settings', req.ip);

  res.json({ success: true, message: 'Provider settings updated successfully' });
});

/**
 * PUT /api/settings/general
 * Update church details and general settings
 */
settingsRouter.put('/general', (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const {
    churchName,
    organizationUnit,
    adminEmail,
    defaultCountryCode,
    defaultTimezone,
    lowCreditThreshold,
    requireCampaignApproval,
    webhookSecret,
  } = req.body;

  db.update(d => {
    if (churchName !== undefined) d.generalSettings.churchName = churchName.trim();
    if (organizationUnit !== undefined) d.generalSettings.organizationUnit = organizationUnit.trim();
    if (adminEmail !== undefined) d.generalSettings.adminEmail = adminEmail.trim().toLowerCase();
    if (defaultCountryCode !== undefined) d.generalSettings.defaultCountryCode = defaultCountryCode.trim();
    if (defaultTimezone !== undefined) d.generalSettings.defaultTimezone = defaultTimezone.trim();
    if (lowCreditThreshold !== undefined) d.generalSettings.lowCreditThreshold = Number(lowCreditThreshold);
    if (requireCampaignApproval !== undefined) d.generalSettings.requireCampaignApproval = Boolean(requireCampaignApproval);
    if (webhookSecret !== undefined) d.generalSettings.webhookSecret = webhookSecret.trim();
  });

  db.logAudit(admin.email, 'UPDATE_GENERAL_SETTINGS', 'Updated church general settings', req.ip);

  res.json({ success: true, message: 'General settings updated successfully', settings: db.get().generalSettings });
});

/**
 * POST /api/settings/test-connection
 * Test connection to Bulk SMS Uganda
 */
settingsRouter.post('/test-connection', async (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const result = await BulkSMSUgandaService.testConnection();

  db.logAudit(
    admin.email,
    'TEST_PROVIDER_CONNECTION',
    `Tested Bulk SMS Uganda connection: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.message})`,
    req.ip
  );

  res.json(result);
});

/**
 * GET /api/settings/export-backup
 * Export complete system database as JSON
 */
settingsRouter.get('/export-backup', (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const data = db.get();

  db.logAudit(admin.email, 'BACKUP_DATABASE_EXPORTED', 'Exported full JSON system backup', req.ip);

  res.setHeader('Content-Disposition', `attachment; filename="churchsms-backup-${new Date().toISOString().substring(0, 10)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

/**
 * POST /api/settings/restore-backup
 * Restore system database from JSON backup
 */
settingsRouter.post('/restore-backup', (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const backupData = req.body;

  if (!backupData || !Array.isArray(backupData.members) || !Array.isArray(backupData.departments)) {
    return res.status(400).json({ error: 'Invalid backup file structure. Missing required members or departments collections.' });
  }

  db.update(d => {
    d.members = backupData.members;
    d.departments = backupData.departments;
    if (Array.isArray(backupData.campaigns)) d.campaigns = backupData.campaigns;
    if (Array.isArray(backupData.smsTransactions)) d.smsTransactions = backupData.smsTransactions;
    if (backupData.generalSettings) d.generalSettings = backupData.generalSettings;
    if (backupData.providerSettings) {
      d.providerSettings = {
        ...backupData.providerSettings,
        // Preserve current API key if backup was sanitized
        apiKey: backupData.providerSettings.apiKey || d.providerSettings.apiKey,
      };
    }
  });

  db.logAudit(admin.email, 'RESTORE_DATABASE', 'Restored system database from backup file', req.ip);

  res.json({ success: true, message: 'Database successfully restored from backup.' });
});
