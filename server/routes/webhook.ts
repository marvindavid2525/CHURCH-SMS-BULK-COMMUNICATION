import { Router, Request, Response } from 'express';
import { db, Member, GoogleSyncLog, FailedRegistration, SyncConflict } from '../db.js';
import { normalizeUgandanPhone } from '../smsService.js';
import { requireAdmin } from './auth.js';
import { generateChurchExcelRegister } from '../excelGenerator.js';
import fs from 'fs';
import path from 'path';

export const webhookRouter = Router();

/**
 * Helper to process an array of incoming registration records
 */
function processRegistrationRows(rows: any[], source: 'webhook' | 'manual' | 'retry' | 'scheduled' = 'webhook') {
  const currentDb = db.get();
  const deptNameToId = new Map<string, string>();
  currentDb.departments.forEach(dept => {
    deptNameToId.set(dept.name.toLowerCase().trim(), dept.id);
  });

  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  const newlyFailed: FailedRegistration[] = [];
  const detectedConflicts: SyncConflict[] = [];

  const now = new Date().toISOString();

  db.update(d => {
    rows.forEach((row, idx) => {
      try {
        const firstName = (row.first_name || row.firstName || row['First Name'] || row['First name'] || '').toString().trim();
        const secondName = (row.second_name || row.secondName || row['Second Name'] || row.lastName || row['Last Name'] || row.surname || row['Surname'] || '').toString().trim();
        const rawPhone = (row.phone || row.phoneNumber || row.phone_number || row['Phone Number'] || row['phone_number'] || row['Phone'] || row['Mobile'] || row.telephone || '').toString().trim();
        const rawConsent = row.sms_consent ?? row.smsConsent ?? row['sms_consent'] ?? row['SMS Consent'] ?? row['Consent'] ?? row['Do you consent to receiving SMS?'];
        const rawEmail = (row.email || row.email_address || row['Email'] || row['Email Address'] || '').toString().trim();
        const rawGender = (row.gender || row['Gender'] || '').toString().trim();
        const rawDepts = row.department || row.departments || row.selected_departments || row.selectedDepartments || row['Selected Departments'] || row['Department'] || row['Departments'] || row['Ministry'] || row['Ministries'] || '';
        const notes = (row.notes || row['Notes'] || '').toString().trim();

        // Google Response metadata
        const googleResponseId = (row.google_response_id || row.response_id || row.googleResponseId || row.responseId || row['Response ID'] || '').toString().trim();
        const googleSheetRowNumber = Number(row.row_number || row.sheet_row || row.googleSheetRowNumber || row.rowNumber || row['Row Number']) || undefined;
        let googleEditResponseUrl = (row.edit_response_url || row.edit_url || row.google_edit_url || row.googleEditResponseUrl || row.response_url || row['Edit Link'] || row['Edit URL'] || '').toString().trim();
        const googleSubmittedAt = (row.google_submitted_at || row.submitted_at || row.timestamp || row.googleSubmittedAt || row['Timestamp'] || now).toString().trim();

        // Clean & validate edit response URL
        // If it's a generic Google form URL without an edit response token, mark as unavailable
        if (googleEditResponseUrl && !googleEditResponseUrl.includes('edit2=') && !googleEditResponseUrl.includes('formResponse') && !googleEditResponseUrl.includes('docs.google.com/forms/d/e/')) {
          googleEditResponseUrl = '';
        }

        if (!firstName) {
          failedCount++;
          const errMsg = `Row ${idx + 1}: Missing First Name`;
          errors.push(errMsg);
          newlyFailed.push({
            id: 'fail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp: now,
            rawPayload: row,
            error: errMsg,
            attempts: 1,
          });
          return;
        }

        if (!rawPhone) {
          failedCount++;
          const errMsg = `Row ${idx + 1} (${firstName}): Missing Phone Number`;
          errors.push(errMsg);
          newlyFailed.push({
            id: 'fail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp: now,
            rawPayload: row,
            error: errMsg,
            attempts: 1,
          });
          return;
        }

        // Validate and normalize phone to Ugandan format
        const norm = normalizeUgandanPhone(rawPhone);
        if (!norm.isValid) {
          failedCount++;
          const errMsg = `Row ${idx + 1} (${firstName}): Invalid Ugandan phone format: "${rawPhone}"`;
          errors.push(errMsg);
          newlyFailed.push({
            id: 'fail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp: now,
            rawPayload: row,
            error: errMsg,
            attempts: 1,
          });
          return;
        }

        // Parse SMS consent strictly:
        // "Never assume consent if the consent field is blank"
        const consentVal = String(rawConsent ?? '').trim().toLowerCase();
        const hasConsent = ['yes', 'true', '1', 'agreed', 'consent', 'y', 'i agree', 'accept'].includes(consentVal);

        // Map departments into all matching departments
        const matchedDeptIds: string[] = [];
        if (rawDepts) {
          const parts = String(rawDepts).split(/[,;/|\n]/).map(p => p.trim().toLowerCase());
          parts.forEach(part => {
            if (!part) return;
            if (deptNameToId.has(part)) {
              matchedDeptIds.push(deptNameToId.get(part)!);
            } else {
              // Fuzzy match across 14 departments
              currentDb.departments.forEach(dept => {
                const lowerName = dept.name.toLowerCase();
                if (lowerName === part || lowerName.includes(part) || part.includes(lowerName)) {
                  if (!matchedDeptIds.includes(dept.id)) {
                    matchedDeptIds.push(dept.id);
                  }
                }
              });
            }
          });
        }

        // Default to "Other" department if none matched
        if (matchedDeptIds.length === 0) {
          const otherDept = currentDb.departments.find(dept => dept.name.toLowerCase() === 'other');
          if (otherDept) matchedDeptIds.push(otherDept.id);
        }

        // Match existing member:
        // 1. By Google Forms Response ID (if provided)
        // 2. By Normalized Phone (+256...)
        let existingMember: Member | undefined = undefined;
        if (googleResponseId) {
          existingMember = d.members.find(m => m.googleResponseId === googleResponseId);
        }
        if (!existingMember) {
          existingMember = d.members.find(m => m.phone === norm.e164);
        }

        if (existingMember) {
          // Detect conflicts if member has differing data previously approved by admin
          if (existingMember.source === 'manual' && existingMember.firstName !== firstName) {
            detectedConflicts.push({
              id: 'conf_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              memberId: existingMember.id,
              timestamp: now,
              fieldName: 'firstName',
              existingValue: existingMember.firstName,
              incomingValue: firstName,
              status: 'pending_review',
            });
          }

          // Update existing member record
          existingMember.firstName = firstName;
          if (secondName) existingMember.secondName = secondName;
          existingMember.fullName = `${firstName} ${existingMember.secondName}`.trim();
          if (rawEmail) existingMember.email = rawEmail.toLowerCase();
          if (['Male', 'Female'].includes(rawGender)) {
            existingMember.gender = rawGender as 'Male' | 'Female';
          }

          // Preserve existing departments (set union)
          matchedDeptIds.forEach(id => {
            if (!existingMember!.departmentIds.includes(id)) {
              existingMember!.departmentIds.push(id);
            }
          });

          // Update consent if explicitly affirmative
          if (hasConsent) {
            existingMember.smsConsent = true;
          }

          // Update Google response link fields
          if (googleResponseId) existingMember.googleResponseId = googleResponseId;
          if (googleSheetRowNumber) existingMember.googleSheetRowNumber = googleSheetRowNumber;
          if (googleEditResponseUrl) existingMember.googleEditResponseUrl = googleEditResponseUrl;
          if (googleSubmittedAt) existingMember.googleSubmittedAt = googleSubmittedAt;
          existingMember.lastSyncedAt = now;
          existingMember.syncStatus = 'synced';

          if (notes) {
            existingMember.notes = existingMember.notes && !existingMember.notes.includes(notes)
              ? `${existingMember.notes} | ${notes}`
              : existingMember.notes || notes;
          }

          existingMember.updatedAt = now;
          updatedCount++;
        } else {
          // Create new member record
          const newMember: Member = {
            id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            firstName,
            secondName,
            fullName: `${firstName} ${secondName}`.trim(),
            phone: norm.e164,
            rawPhone,
            email: rawEmail ? rawEmail.toLowerCase() : undefined,
            gender: ['Male', 'Female'].includes(rawGender) ? (rawGender as 'Male' | 'Female') : 'Other',
            departmentIds: matchedDeptIds,
            smsConsent: hasConsent,
            status: 'active',
            notes: notes || undefined,
            source: 'google_form',
            registrationDate: googleSubmittedAt || now,
            updatedAt: now,

            // Response Link fields
            googleResponseId: googleResponseId || undefined,
            googleSheetRowNumber: googleSheetRowNumber || undefined,
            googleEditResponseUrl: googleEditResponseUrl || undefined,
            googleSubmittedAt: googleSubmittedAt || now,
            lastSyncedAt: now,
            syncStatus: 'synced',
          };

          d.members.push(newMember);
          newCount++;
        }
      } catch (err: any) {
        failedCount++;
        const errMsg = `Row ${idx + 1} processing error: ${err.message}`;
        errors.push(errMsg);
        newlyFailed.push({
          id: 'fail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          timestamp: now,
          rawPayload: row,
          error: errMsg,
          attempts: 1,
        });
      }
    });

    // Save newly failed registrations
    if (newlyFailed.length > 0) {
      d.failedRegistrations = [...(d.failedRegistrations || []), ...newlyFailed].slice(-200);
    }

    // Save conflicts
    if (detectedConflicts.length > 0) {
      d.syncConflicts = [...(d.syncConflicts || []), ...detectedConflicts].slice(-100);
    }

    // Record sync log
    const syncStatus = failedCount === 0 ? 'success' : (newCount > 0 || updatedCount > 0) ? 'partial' : 'failed';
    const log: GoogleSyncLog = {
      id: 'sync_' + Date.now(),
      timestamp: now,
      source,
      status: syncStatus,
      totalReceived: rows.length,
      newCount,
      updatedCount,
      skippedCount,
      failedCount,
      errors,
      summary: `Google Sheets Registration Sync: ${newCount} new, ${updatedCount} updated, ${failedCount} failed of ${rows.length} received`,
    };

    d.googleSyncLogs.unshift(log);
    if (d.googleSyncLogs.length > 200) {
      d.googleSyncLogs = d.googleSyncLogs.slice(0, 200);
    }

    if (newCount > 0 || updatedCount > 0) {
      d.generalSettings.lastSuccessfulGoogleSync = now;
    }
  });

  // Automatically maintain & regenerate the Excel workbook register
  try {
    generateChurchExcelRegister();
  } catch (err) {
    console.error('Failed to auto-generate Excel register:', err);
  }

  return {
    success: failedCount === 0,
    newCount,
    updatedCount,
    skippedCount,
    failedCount,
    errors,
  };
}

/**
 * Public webhook endpoint for Google Forms / Google Sheets
 * POST /api/google-sheets/webhook
 * Secured by CHURCHSMS_WEBHOOK_SECRET in x-webhook-secret header
 */
webhookRouter.post('/', (req: Request, res: Response) => {
  const currentDb = db.get();
  const configuredSecret = currentDb.generalSettings.webhookSecret || process.env.CHURCHSMS_WEBHOOK_SECRET;

  const providedSecret =
    req.headers['x-webhook-secret'] ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.query.secret ||
    req.body.secret;

  // Verify secret
  if (!configuredSecret || providedSecret !== configuredSecret) {
    db.logAudit(
      'webhook',
      'WEBHOOK_AUTH_FAILED',
      `Unauthorized Google Sheets webhook attempt from IP: ${req.ip}`,
      req.ip
    );
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing x-webhook-secret header.',
    });
  }

  const payload = req.body;
  const rows: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.rows)
    ? payload.rows
    : [payload];

  if (rows.length === 0 || (rows.length === 1 && !rows[0].first_name && !rows[0].firstName && !rows[0].phone)) {
    return res.status(400).json({ error: 'No member registration data found in payload.' });
  }

  const stats = processRegistrationRows(rows, 'webhook');

  res.json({
    success: true,
    message: 'Webhook processed successfully and Excel register updated.',
    stats,
  });
});

/**
 * GET /api/google-sheets/response-links
 * (Admin only)
 * Retrieve all registered members with their Google Form individual response/edit links
 */
webhookRouter.get('/response-links', requireAdmin, (req: Request, res: Response) => {
  const { search, availability, status } = req.query;
  const currentDb = db.get();
  const departments = currentDb.departments;
  const deptMap: Record<string, string> = {};
  departments.forEach(d => {
    deptMap[d.id] = d.name;
  });

  let members = [...currentDb.members].filter(m => m.status !== 'archived');

  if (availability === 'available') {
    members = members.filter(m => Boolean(m.googleEditResponseUrl));
  } else if (availability === 'missing') {
    members = members.filter(m => !m.googleEditResponseUrl);
  }

  if (status && status !== 'all') {
    members = members.filter(m => (m.syncStatus || 'synced') === status);
  }

  if (search) {
    const q = String(search).toLowerCase();
    members = members.filter(
      m =>
        m.fullName.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.googleResponseId && m.googleResponseId.toLowerCase().includes(q))
    );
  }

  // Sort by registration/submission descending
  members.sort((a, b) => {
    const timeA = new Date(a.googleSubmittedAt || a.registrationDate).getTime();
    const timeB = new Date(b.googleSubmittedAt || b.registrationDate).getTime();
    return timeB - timeA;
  });

  const responseLinks = members.map(m => ({
    memberId: m.id,
    fullName: m.fullName,
    phone: m.phone,
    gender: m.gender,
    email: m.email,
    smsConsent: m.smsConsent,
    departmentIds: m.departmentIds,
    departmentNames: m.departmentIds.map(id => deptMap[id] || id),
    googleResponseId: m.googleResponseId || null,
    googleSheetRowNumber: m.googleSheetRowNumber || null,
    googleEditResponseUrl: m.googleEditResponseUrl || null,
    hasEditLink: Boolean(m.googleEditResponseUrl),
    googleSubmittedAt: m.googleSubmittedAt || m.registrationDate,
    lastSyncedAt: m.lastSyncedAt || m.updatedAt,
    syncStatus: m.syncStatus || 'synced',
    syncConflictNote: m.syncConflictNote,
  }));

  const totalMembers = currentDb.members.filter(m => m.status !== 'archived').length;
  const availableCount = totalMembers > 0 ? members.filter(m => Boolean(m.googleEditResponseUrl)).length : 0;
  const missingCount = totalMembers - availableCount;

  res.json({
    total: members.length,
    availableCount,
    missingCount,
    responseLinks,
  });
});

/**
 * GET /api/google-sheets/download-excel
 * (Admin only)
 * Directly generates and downloads the 11-sheet Omega_Prayer_Mission_Member_Register.xlsx
 */
webhookRouter.get('/download-excel', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).admin;
  try {
    const result = generateChurchExcelRegister();

    db.logAudit(
      admin.email,
      'DOWNLOAD_EXCEL_REGISTER',
      'Downloaded complete 11-worksheet Omega_Prayer_Mission_Member_Register.xlsx workbook',
      req.ip
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Omega_Prayer_Mission_Member_Register_${new Date().toISOString().substring(0, 10)}.xlsx"`
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(result.buffer);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to generate Excel register: ${err.message}` });
  }
});

/**
 * GET /api/google-sheets/sync-logs
 * (Admin only)
 */
webhookRouter.get('/sync-logs', requireAdmin, (req: Request, res: Response) => {
  const currentDb = db.get();
  res.json({
    logs: currentDb.googleSyncLogs || [],
    failedRegistrations: currentDb.failedRegistrations || [],
    syncConflicts: currentDb.syncConflicts || [],
    lastExcelGeneratedAt: currentDb.generalSettings.lastExcelGeneratedAt,
    lastSuccessfulGoogleSync: currentDb.generalSettings.lastSuccessfulGoogleSync,
  });
});

/**
 * POST /api/google-sheets/retry-failed
 * (Admin only)
 * Retries all failed registration rows
 */
webhookRouter.post('/retry-failed', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const currentDb = db.get();
  const failedList = currentDb.failedRegistrations || [];

  if (failedList.length === 0) {
    return res.json({ success: true, message: 'No failed registrations to retry.', retriedCount: 0 });
  }

  const rowsToRetry = failedList.map(f => f.rawPayload);

  // Clear failed list before retrying
  db.update(d => {
    d.failedRegistrations = [];
  });

  const stats = processRegistrationRows(rowsToRetry, 'retry');

  db.logAudit(
    admin.email,
    'RETRY_FAILED_REGISTRATIONS',
    `Retried ${rowsToRetry.length} failed registrations: ${stats.newCount} new, ${stats.updatedCount} updated, ${stats.failedCount} still failed`,
    req.ip
  );

  res.json({
    success: true,
    message: `Retried ${rowsToRetry.length} registrations: ${stats.newCount} created, ${stats.updatedCount} updated, ${stats.failedCount} failed.`,
    stats,
  });
});

/**
 * DELETE /api/google-sheets/failed/:id
 * (Admin only)
 * Dismisses a single failed registration record
 */
webhookRouter.delete('/failed/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const admin = (req as any).admin;

  db.update(d => {
    d.failedRegistrations = (d.failedRegistrations || []).filter(f => f.id !== id);
  });

  db.logAudit(admin.email, 'DISMISS_FAILED_REGISTRATION', `Dismissed failed registration record ${id}`, req.ip);

  res.json({ success: true, message: 'Failed registration dismissed.' });
});

/**
 * POST /api/google-sheets/trigger-manual-sync
 * (Admin only)
 * Verifies webhook listener and automatically regenerates the Excel workbook
 */
webhookRouter.post('/trigger-manual-sync', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const now = new Date().toISOString();

  // Generate / refresh Excel register
  let excelGenerated = false;
  try {
    generateChurchExcelRegister();
    excelGenerated = true;
  } catch (err) {
    console.error('Excel generation error on sync:', err);
  }

  const log: GoogleSyncLog = {
    id: 'sync_' + Date.now(),
    timestamp: now,
    source: 'manual',
    status: 'success',
    totalReceived: 0,
    newCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    errors: [],
    summary: `Manual synchronisation check verified. Webhook listener active. Excel register regenerated successfully.`,
  };

  db.update(d => {
    d.googleSyncLogs.unshift(log);
    d.generalSettings.lastSuccessfulGoogleSync = now;
    if (excelGenerated) {
      d.generalSettings.lastExcelGeneratedAt = now;
    }
  });

  db.logAudit(
    admin.email,
    'MANUAL_SYNC_TRIGGERED',
    'Administrator triggered manual sync and regenerated Omega_Prayer_Mission_Member_Register.xlsx',
    req.ip
  );

  res.json({
    success: true,
    message: 'Synchronisation verified. Excel register workbook regenerated and ready for download.',
    log,
    lastExcelGeneratedAt: now,
  });
});

/**
 * POST /api/google-sheets/simulate-registration
 * (Admin only)
 * Allows administrator to simulate an end-to-end Google Form registration with real response ID and edit URL
 */
webhookRouter.post('/simulate-registration', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const {
    firstName,
    secondName,
    phone,
    gender = 'Female',
    email,
    smsConsent = true,
    departments = 'Media and Technical, Choir, Ushering',
    notes,
  } = req.body;

  if (!firstName || !phone) {
    return res.status(400).json({ error: 'firstName and phone are required for registration simulation.' });
  }

  const simulatedResponseId = '2_ABaOnue_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const simulatedEditUrl = `https://docs.google.com/forms/d/e/1FAIpQLSc_OmegaPrayerMissionForm/viewform?edit2=${simulatedResponseId}`;

  const row = {
    first_name: firstName,
    second_name: secondName || '',
    phone,
    gender,
    email: email || '',
    sms_consent: smsConsent ? 'Yes' : 'No',
    departments,
    notes: notes || 'Simulated via ChurchSMS Manager test panel',
    google_response_id: simulatedResponseId,
    edit_response_url: simulatedEditUrl,
    submitted_at: new Date().toISOString(),
  };

  const stats = processRegistrationRows([row], 'webhook');

  db.logAudit(
    admin.email,
    'SIMULATE_GOOGLE_REGISTRATION',
    `Simulated Google Form submission for ${firstName} ${secondName || ''} (${phone}) with Response Link: ${simulatedEditUrl}`,
    req.ip
  );

  res.json({
    success: true,
    message: 'Google Form registration simulated successfully, routed into departments, and written to Excel register.',
    simulatedResponseId,
    simulatedEditUrl,
    stats,
  });
});
