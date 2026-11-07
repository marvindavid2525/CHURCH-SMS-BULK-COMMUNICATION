import { Router, Request, Response } from 'express';
import { db, Campaign, SMSTransaction, Member } from '../db.js';
import { requireAdmin } from './auth.js';
import {
  BulkSMSUgandaService,
  calculateSMSCredits,
  normalizeUgandanPhone,
  personalizeMessage,
} from '../smsService.js';

export const smsRouter = Router();

smsRouter.use(requireAdmin);

/**
 * POST /api/sms/send-test
 * Sends a single test message to a specified number
 */
smsRouter.post('/send-test', async (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message are required' });
  }

  const norm = normalizeUgandanPhone(phone);
  if (!norm.isValid) {
    return res.status(400).json({ error: `Invalid Ugandan phone number: ${phone}` });
  }

  const creditInfo = calculateSMSCredits(message);
  const now = new Date().toISOString();

  // Call provider
  const result = await BulkSMSUgandaService.sendSMS(norm.e164, message);

  // Record transaction
  const transaction: SMSTransaction = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    providerMessageId: result.providerMessageId,
    recipientName: 'Test Recipient',
    recipientPhone: norm.e164,
    messageContent: message,
    calculatedCredits: result.calculatedCredits || creditInfo.segments,
    status: result.status,
    errorReason: result.success ? undefined : result.message,
    attemptCount: 1,
    providerResponse: result.rawResponse,
    sentAt: now,
    lastCheckedAt: now,
  };

  db.update(d => {
    d.smsTransactions.unshift(transaction);
  });

  db.logAudit(
    admin.email,
    'SEND_TEST_SMS',
    `Sent test SMS to ${norm.e164}: ${result.status} (${result.message})`,
    req.ip
  );

  res.json({
    success: result.success,
    transaction,
    providerResult: result,
  });
});

/**
 * POST /api/sms/send-individual
 * Send single message to an existing member with consent check
 */
smsRouter.post('/send-individual', async (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const { memberId, message } = req.body;

  if (!memberId || !message) {
    return res.status(400).json({ error: 'memberId and message are required' });
  }

  const currentDb = db.get();
  const member = currentDb.members.find(m => m.id === memberId);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // Enforce consent
  if (!member.smsConsent) {
    return res.status(403).json({
      error: `Member "${member.fullName}" has not consented to receiving SMS messages.`,
    });
  }

  if (member.status !== 'active') {
    return res.status(400).json({
      error: `Member "${member.fullName}" is currently ${member.status}. Only active members can be sent messages.`,
    });
  }

  // Find department names
  const deptNames = currentDb.departments
    .filter(d => member.departmentIds.includes(d.id))
    .map(d => d.name)
    .join(', ');

  const personalized = personalizeMessage(message, member, deptNames);
  const creditInfo = calculateSMSCredits(personalized);
  const now = new Date().toISOString();

  // Send via provider
  const result = await BulkSMSUgandaService.sendSMS(member.phone, personalized);

  const transaction: SMSTransaction = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    recipientName: member.fullName,
    recipientPhone: member.phone,
    messageContent: personalized,
    calculatedCredits: result.calculatedCredits || creditInfo.segments,
    status: result.status,
    providerMessageId: result.providerMessageId,
    errorReason: result.success ? undefined : result.message,
    attemptCount: 1,
    providerResponse: result.rawResponse,
    sentAt: now,
    lastCheckedAt: now,
  };

  db.update(d => {
    d.smsTransactions.unshift(transaction);
  });

  db.logAudit(
    admin.email,
    'SEND_INDIVIDUAL_SMS',
    `Sent SMS to ${member.fullName} (${member.phone}): ${result.status}`,
    req.ip
  );

  res.json({
    success: result.success,
    transaction,
    providerResult: result,
  });
});

/**
 * GET /api/sms/transactions
 * Retrieve SMS transactions with filters and search
 */
smsRouter.get('/transactions', (req: Request, res: Response) => {
  const { status, campaignId, search, limit = 100, page = 1 } = req.query;
  const currentDb = db.get();
  let list = [...currentDb.smsTransactions];

  if (status && status !== 'all') {
    list = list.filter(t => t.status.toLowerCase() === String(status).toLowerCase());
  }

  if (campaignId) {
    list = list.filter(t => t.campaignId === campaignId);
  }

  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      t =>
        t.recipientName.toLowerCase().includes(q) ||
        t.recipientPhone.toLowerCase().includes(q) ||
        t.messageContent.toLowerCase().includes(q) ||
        (t.providerMessageId && t.providerMessageId.toLowerCase().includes(q))
    );
  }

  // Sort by sentAt descending
  list.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  const numLimit = Number(limit);
  const numPage = Number(page);
  const total = list.length;
  const startIndex = (numPage - 1) * numLimit;
  const paginated = list.slice(startIndex, startIndex + numLimit);

  res.json({
    total,
    page: numPage,
    limit: numLimit,
    totalPages: Math.ceil(total / numLimit),
    transactions: paginated,
  });
});

/**
 * POST /api/sms/refresh-statuses
 * Check delivery status for pending/submitted transactions from Bulk SMS Uganda
 */
smsRouter.post('/refresh-statuses', async (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const currentDb = db.get();

  // Find transactions that are not in final state (Success, Rejected, Failed)
  const pendingTransactions = currentDb.smsTransactions.filter(
    t => (t.status === 'Sent' || t.status === 'Submitted' || t.status === 'Buffered') && t.providerMessageId
  );

  let updatedCount = 0;
  const now = new Date().toISOString();

  // Check in batches of 5 to avoid overloading
  for (const tx of pendingTransactions.slice(0, 50)) {
    try {
      const statusRes = await BulkSMSUgandaService.checkDeliveryStatus(tx.providerMessageId!);
      if (statusRes.success && statusRes.status !== tx.status) {
        db.update(d => {
          const item = d.smsTransactions.find(t => t.id === tx.id);
          if (item) {
            item.status = statusRes.status;
            item.lastCheckedAt = now;
            if (statusRes.status === 'Success') {
              item.deliveredAt = now;
            }
            if (statusRes.rawResponse) {
              item.providerResponse = statusRes.rawResponse;
            }
          }
        });
        updatedCount++;
      } else {
        // Update lastCheckedAt
        db.update(d => {
          const item = d.smsTransactions.find(t => t.id === tx.id);
          if (item) item.lastCheckedAt = now;
        });
      }
    } catch (e) {
      console.error(`Status check failed for tx ${tx.id}`, e);
    }
  }

  db.logAudit(
    admin.email,
    'REFRESH_DELIVERY_STATUSES',
    `Polled delivery status for ${pendingTransactions.length} pending SMS, updated ${updatedCount}`,
    req.ip
  );

  res.json({
    checkedCount: pendingTransactions.length,
    updatedCount,
  });
});

/**
 * CAMPAIGNS ENDPOINTS
 */

/**
 * GET /api/campaigns or /api/sms/campaigns
 */
smsRouter.get(['/', '/campaigns'], (req: Request, res: Response) => {
  const currentDb = db.get();
  const campaigns = [...(currentDb.campaigns || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ campaigns });
});

/**
 * POST /api/campaigns/preview-recipients or /api/sms/campaigns/preview-recipients
 */
smsRouter.post(['/preview-recipients', '/campaigns/preview-recipients'], (req: Request, res: Response) => {
  const { recipientType, targetDepartmentIds = [], targetMemberIds = [], message = '' } = req.body;
  const currentDb = db.get();

  // Filter members
  let eligible = currentDb.members.filter(m => m.status === 'active' && m.smsConsent === true);

  if (recipientType === 'departments') {
    eligible = eligible.filter(m =>
      targetDepartmentIds.some((deptId: string) => m.departmentIds.includes(deptId))
    );
  } else if (recipientType === 'selected_members') {
    eligible = eligible.filter(m => targetMemberIds.includes(m.id));
  }

  // Deduplicate by normalized phone number
  const seenPhones = new Set<string>();
  const deduplicatedMembers: Member[] = [];
  let duplicatesExcluded = 0;

  eligible.forEach(m => {
    if (seenPhones.has(m.phone)) {
      duplicatesExcluded++;
    } else {
      seenPhones.add(m.phone);
      deduplicatedMembers.push(m);
    }
  });

  // Calculate estimated credits
  const creditInfo = calculateSMSCredits(message);
  const totalCreditsNeeded = deduplicatedMembers.length * creditInfo.segments;

  // Sample personalized preview (first 3 members)
  const previews = deduplicatedMembers.slice(0, 3).map(m => {
    const deptNames = currentDb.departments
      .filter(d => m.departmentIds.includes(d.id))
      .map(d => d.name)
      .join(', ');
    return {
      memberId: m.id,
      fullName: m.fullName,
      phone: m.phone,
      personalizedText: personalizeMessage(message, m, deptNames),
    };
  });

  res.json({
    recipientCount: deduplicatedMembers.length,
    duplicatesExcluded,
    segmentsPerRecipient: creditInfo.segments,
    estimatedTotalCredits: totalCreditsNeeded,
    isUnicode: creditInfo.isUnicode,
    samplePreviews: previews,
    recipients: deduplicatedMembers.map(m => ({
      id: m.id,
      fullName: m.fullName,
      phone: m.phone,
      departments: currentDb.departments
        .filter(d => m.departmentIds.includes(d.id))
        .map(d => d.name),
    })),
  });
});

/**
 * POST /api/campaigns
 * Create a new campaign (draft or submitted for approval)
 */
smsRouter.post(['/', '/campaigns'], (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const {
    name,
    message,
    recipientType,
    targetDepartmentIds = [],
    targetMemberIds = [],
    submitForApproval = false,
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Campaign name is required' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const currentDb = db.get();
  // Filter eligible recipients
  let eligible = currentDb.members.filter(m => m.status === 'active' && m.smsConsent === true);

  if (recipientType === 'departments') {
    eligible = eligible.filter(m =>
      targetDepartmentIds.some((deptId: string) => m.departmentIds.includes(deptId))
    );
  } else if (recipientType === 'selected_members') {
    eligible = eligible.filter(m => targetMemberIds.includes(m.id));
  }

  // Deduplicate
  const seenPhones = new Set<string>();
  const finalRecipients: Member[] = [];
  eligible.forEach(m => {
    if (!seenPhones.has(m.phone)) {
      seenPhones.add(m.phone);
      finalRecipients.push(m);
    }
  });

  const creditInfo = calculateSMSCredits(message);
  const estimatedCredits = finalRecipients.length * creditInfo.segments;
  const now = new Date().toISOString();

  const newCampaign: Campaign = {
    id: 'camp_' + Date.now(),
    name: name.trim(),
    message: message.trim(),
    recipientType,
    targetDepartmentIds,
    targetMemberIds,
    recipientCount: finalRecipients.length,
    estimatedCredits,
    actualCredits: 0,
    status: submitForApproval ? 'pending_approval' : 'draft',
    createdAt: now,
    successfulCount: 0,
    failedCount: 0,
    pendingCount: finalRecipients.length,
  };

  db.update(d => {
    d.campaigns.unshift(newCampaign);
  });

  db.logAudit(
    admin.email,
    'CREATE_CAMPAIGN',
    `Created campaign "${newCampaign.name}" (${newCampaign.status}) with ${finalRecipients.length} recipients`,
    req.ip
  );

  res.status(201).json({ campaign: newCampaign });
});

/**
 * POST /api/campaigns/:id/dispatch
 * Administrator approval and dispatch execution
 */
smsRouter.post(['/:id/dispatch', '/campaigns/:id/dispatch'], async (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const { id } = req.params;

  const currentDb = db.get();
  const campaign = currentDb.campaigns.find(c => c.id === id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  if (campaign.status === 'sending' || campaign.status === 'completed') {
    return res.status(400).json({ error: `Campaign is already ${campaign.status}` });
  }

  // Recalculate eligible deduplicated recipients
  let eligible = currentDb.members.filter(m => m.status === 'active' && m.smsConsent === true);
  if (campaign.recipientType === 'departments' && campaign.targetDepartmentIds) {
    eligible = eligible.filter(m =>
      campaign.targetDepartmentIds!.some(deptId => m.departmentIds.includes(deptId))
    );
  } else if (campaign.recipientType === 'selected_members' && campaign.targetMemberIds) {
    eligible = eligible.filter(m => campaign.targetMemberIds!.includes(m.id));
  }

  const seen = new Set<string>();
  const recipients: Member[] = [];
  eligible.forEach(m => {
    if (!seen.has(m.phone)) {
      seen.add(m.phone);
      recipients.push(m);
    }
  });

  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No eligible recipients found with SMS consent.' });
  }

  // Mark campaign sending
  const now = new Date().toISOString();
  db.update(d => {
    const c = d.campaigns.find(item => item.id === id);
    if (c) {
      c.status = 'sending';
      c.sentAt = now;
      c.approvedBy = admin.email;
      c.pendingCount = recipients.length;
    }
  });

  db.logAudit(
    admin.email,
    'APPROVE_AND_DISPATCH_CAMPAIGN',
    `Dispatched campaign "${campaign.name}" to ${recipients.length} recipients`,
    req.ip
  );

  // Return response immediately, execute queue in background
  res.json({
    success: true,
    message: `Campaign approved and dispatch initiated for ${recipients.length} recipients.`,
    campaignId: id,
    totalRecipients: recipients.length,
  });

  // Run dispatch asynchronously with controlled pacing (e.g., 200ms delay between dispatches)
  (async () => {
    let successCount = 0;
    let failCount = 0;
    let actualCreditsConsumed = 0;

    for (const member of recipients) {
      // Check if campaign was cancelled mid-send
      const checkCamp = db.get().campaigns.find(c => c.id === id);
      if (checkCamp && checkCamp.status === 'cancelled') {
        break;
      }

      const deptNames = db.get().departments
        .filter(d => member.departmentIds.includes(d.id))
        .map(d => d.name)
        .join(', ');

      const personalizedText = personalizeMessage(campaign.message, member, deptNames);
      const creditInfo = calculateSMSCredits(personalizedText);

      try {
        const sendResult = await BulkSMSUgandaService.sendSMS(member.phone, personalizedText);

        const tx: SMSTransaction = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          campaignId: campaign.id,
          providerMessageId: sendResult.providerMessageId,
          recipientName: member.fullName,
          recipientPhone: member.phone,
          messageContent: personalizedText,
          calculatedCredits: sendResult.calculatedCredits || creditInfo.segments,
          status: sendResult.status,
          errorReason: sendResult.success ? undefined : sendResult.message,
          attemptCount: 1,
          providerResponse: sendResult.rawResponse,
          sentAt: new Date().toISOString(),
          lastCheckedAt: new Date().toISOString(),
        };

        if (sendResult.success) {
          successCount++;
          actualCreditsConsumed += tx.calculatedCredits;
        } else {
          failCount++;
        }

        db.update(d => {
          d.smsTransactions.unshift(tx);
          const c = d.campaigns.find(item => item.id === id);
          if (c) {
            c.successfulCount = successCount;
            c.failedCount = failCount;
            c.pendingCount = Math.max(0, recipients.length - (successCount + failCount));
            c.actualCredits = actualCreditsConsumed;
          }
        });
      } catch (err: any) {
        failCount++;
        const tx: SMSTransaction = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          campaignId: campaign.id,
          recipientName: member.fullName,
          recipientPhone: member.phone,
          messageContent: personalizedText,
          calculatedCredits: creditInfo.segments,
          status: 'Failed',
          errorReason: err.message,
          attemptCount: 1,
          sentAt: new Date().toISOString(),
        };
        db.update(d => {
          d.smsTransactions.unshift(tx);
        });
      }

      // Small pacing delay to avoid slamming the provider
      await new Promise(r => setTimeout(r, 150));
    }

    // Finalize campaign status
    db.update(d => {
      const c = d.campaigns.find(item => item.id === id);
      if (c && c.status === 'sending') {
        c.status = failCount === 0 ? 'completed' : successCount > 0 ? 'partially_failed' : 'failed';
        c.completedAt = new Date().toISOString();
        c.pendingCount = 0;
      }
    });
  })();
});

/**
 * POST /api/campaigns/:id/cancel
 */
smsRouter.post(['/:id/cancel', '/campaigns/:id/cancel'], (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const { id } = req.params;

  db.update(d => {
    const c = d.campaigns.find(item => item.id === id);
    if (c) {
      c.status = 'cancelled';
    }
  });

  db.logAudit(admin.email, 'CANCEL_CAMPAIGN', `Cancelled campaign ${id}`, req.ip);

  res.json({ success: true, message: 'Campaign cancelled.' });
});
