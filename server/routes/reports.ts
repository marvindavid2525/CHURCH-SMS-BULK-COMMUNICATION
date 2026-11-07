import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAdmin } from './auth.js';
import { normalizeUgandanPhone } from '../smsService.js';

export const reportsRouter = Router();

reportsRouter.use(requireAdmin);

/**
 * GET /api/reports/stats
 * Overview dashboard metrics
 */
reportsRouter.get('/stats', (req: Request, res: Response) => {
  const currentDb = db.get();
  const members = currentDb.members;
  const departments = currentDb.departments;
  const campaigns = currentDb.campaigns;
  const transactions = currentDb.smsTransactions;
  const settings = currentDb.providerSettings;

  // Member metrics
  const totalMembers = members.filter(m => m.status !== 'archived').length;
  const activeMembers = members.filter(m => m.status === 'active').length;
  const consentedMembers = members.filter(m => m.status === 'active' && m.smsConsent === true).length;
  const nonConsentedMembers = members.filter(m => m.status === 'active' && !m.smsConsent).length;
  const invalidPhoneMembers = members.filter(m => m.status === 'active' && !normalizeUgandanPhone(m.phone).isValid).length;

  // Department statistics
  const departmentStats = departments
    .filter(d => !d.isArchived)
    .map(dept => {
      const deptMembers = members.filter(m => m.departmentIds.includes(dept.id) && m.status !== 'archived');
      const consented = deptMembers.filter(m => m.status === 'active' && m.smsConsent === true).length;
      return {
        id: dept.id,
        name: dept.name,
        totalMembers: deptMembers.length,
        consentedMembers: consented,
      };
    });

  // SMS metrics
  const totalCampaigns = campaigns.length;
  const totalMessagesSubmitted = transactions.length;
  const deliveredMessages = transactions.filter(t => t.status === 'Success').length;
  const pendingMessages = transactions.filter(t => t.status === 'Sent' || t.status === 'Submitted' || t.status === 'Buffered').length;
  const failedMessages = transactions.filter(t => t.status === 'Failed' || t.status === 'Rejected').length;

  const totalCreditsConsumed = transactions
    .filter(t => t.status !== 'Rejected' && t.status !== 'Failed')
    .reduce((sum, t) => sum + (t.calculatedCredits || 1), 0);

  // Delivery rate percentage
  const deliveryRate = totalMessagesSubmitted > 0
    ? Math.round((deliveredMessages / totalMessagesSubmitted) * 100)
    : 100;

  // Recent activity
  const recentMembers = [...members]
    .sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime())
    .slice(0, 5);

  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 10);

  const recentAuditLogs = [...currentDb.auditLogs].slice(0, 8);
  const recentSyncLogs = [...currentDb.googleSyncLogs].slice(0, 5);

  // Registration & Google Sync metrics
  const totalDeptAssignments = members.reduce((sum, m) => sum + m.departmentIds.length, 0);
  const syncLogs = currentDb.googleSyncLogs || [];
  const totalRegistrationsReceived = syncLogs.reduce((sum, l) => sum + (l.totalReceived || 0), 0) + members.filter(m => m.source === 'google_form').length;
  const registrationsSynced = members.filter(m => (m.syncStatus || 'synced') === 'synced').length;
  const registrationsAwaiting = members.filter(m => m.syncStatus === 'pending').length;
  const missingResponseLinks = members.filter(m => !m.googleEditResponseUrl).length;
  const failedRegistrationsCount = (currentDb.failedRegistrations || []).length;

  res.json({
    members: {
      total: totalMembers,
      active: activeMembers,
      consented: consentedMembers,
      nonConsented: nonConsentedMembers,
      invalidPhone: invalidPhoneMembers,
    },
    departments: {
      total: departments.filter(d => !d.isArchived).length,
      distribution: departmentStats,
      totalAssignments: totalDeptAssignments,
    },
    registrationSync: {
      totalReceived: totalRegistrationsReceived,
      totalActiveMembers: activeMembers,
      totalDepartmentAssignments: totalDeptAssignments,
      registrationsSynced,
      registrationsAwaiting,
      missingResponseLinks,
      failedRegistrationsCount,
      latestExcelGeneratedAt: currentDb.generalSettings.lastExcelGeneratedAt || null,
      lastSuccessfulGoogleSync: currentDb.generalSettings.lastSuccessfulGoogleSync || null,
      isGoogleSheetsConnected: Boolean(currentDb.generalSettings.webhookSecret),
      isBulkSMSConnected: Boolean(settings.apiKey || process.env.BULKSMSUGANDA_API_KEY),
    },
    sms: {
      totalCampaigns,
      totalSubmitted: totalMessagesSubmitted,
      delivered: deliveredMessages,
      pending: pendingMessages,
      failed: failedMessages,
      deliveryRate,
      creditsConsumed: totalCreditsConsumed,
      remainingCredits: settings.lastKnownBalance !== undefined ? settings.lastKnownBalance : null,
      lastBalanceUpdate: settings.lastBalanceUpdate,
      lowCreditWarning: settings.lastKnownBalance !== undefined && settings.lastKnownBalance <= (currentDb.generalSettings.lowCreditThreshold || 50),
    },
    recent: {
      members: recentMembers,
      campaigns: recentCampaigns,
      transactions: recentTransactions,
      auditLogs: recentAuditLogs,
      syncLogs: recentSyncLogs,
      failedRegistrations: (currentDb.failedRegistrations || []).slice(0, 5),
    },
  });
});

/**
 * GET /api/reports/audit-logs
 */
reportsRouter.get('/audit-logs', (req: Request, res: Response) => {
  const { limit = 100, page = 1 } = req.query;
  const currentDb = db.get();
  const logs = currentDb.auditLogs;

  const numLimit = Number(limit);
  const numPage = Number(page);
  const total = logs.length;
  const startIndex = (numPage - 1) * numLimit;
  const paginated = logs.slice(startIndex, startIndex + numLimit);

  res.json({
    total,
    page: numPage,
    limit: numLimit,
    totalPages: Math.ceil(total / numLimit),
    logs: paginated,
  });
});
