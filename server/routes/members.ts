import { Router, Request, Response } from 'express';
import { db, Member } from '../db.js';
import { requireAdmin } from './auth.js';
import { normalizeUgandanPhone } from '../smsService.js';
import { generateChurchExcelRegister } from '../excelGenerator.js';

export const membersRouter = Router();

membersRouter.use(requireAdmin);

/**
 * GET /api/members
 * Get members with filters, search, and sorting
 */
membersRouter.get('/', (req: Request, res: Response) => {
  const {
    search,
    departmentId,
    smsConsent,
    status,
    gender,
    sortBy = 'name',
    sortOrder = 'asc',
  } = req.query;

  const currentDb = db.get();
  let list = [...currentDb.members];

  // Exclude permanently deleted, keep archived if requested
  if (status) {
    list = list.filter(m => m.status === status);
  } else {
    // Default show non-archived or all
  }

  // Filter by department
  if (departmentId && departmentId !== 'all') {
    list = list.filter(m => m.departmentIds.includes(String(departmentId)));
  }

  // Filter by SMS consent
  if (smsConsent !== undefined && smsConsent !== '') {
    const consentBool = smsConsent === 'true' || smsConsent === '1';
    list = list.filter(m => m.smsConsent === consentBool);
  }

  // Filter by gender
  if (gender && gender !== 'all') {
    list = list.filter(m => m.gender === gender);
  }

  // Text search (name, phone, email, notes)
  if (search) {
    const q = String(search).toLowerCase().trim();
    list = list.filter(m =>
      m.fullName.toLowerCase().includes(q) ||
      m.phone.toLowerCase().includes(q) ||
      m.rawPhone.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.notes && m.notes.toLowerCase().includes(q))
    );
  }

  // Sorting
  list.sort((a, b) => {
    let fieldA = '';
    let fieldB = '';

    if (sortBy === 'name') {
      fieldA = a.fullName.toLowerCase();
      fieldB = b.fullName.toLowerCase();
    } else if (sortBy === 'date') {
      fieldA = a.registrationDate;
      fieldB = b.registrationDate;
    } else if (sortBy === 'phone') {
      fieldA = a.phone;
      fieldB = b.phone;
    }

    if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  res.json({
    total: list.length,
    members: list,
  });
});

/**
 * GET /api/members/:id
 */
membersRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const member = db.get().members.find(m => m.id === id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }
  res.json({ member });
});

/**
 * POST /api/members
 * Create member manually
 */
membersRouter.post('/', (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const {
    firstName,
    secondName,
    phone,
    email,
    gender = 'Other',
    departmentIds = [],
    smsConsent = false,
    status = 'active',
    notes = '',
  } = req.body;

  if (!firstName || !firstName.trim()) {
    return res.status(400).json({ error: 'First name is required' });
  }

  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const norm = normalizeUgandanPhone(phone);
  if (!norm.isValid) {
    return res.status(400).json({
      error: `Invalid Ugandan phone number: "${phone}". Expected format like 0712345678, +256712345678, or 256712345678.`,
    });
  }

  const currentDb = db.get();
  // Check if duplicate phone exists
  const existing = currentDb.members.find(m => m.phone === norm.e164 && m.status !== 'archived');
  if (existing) {
    return res.status(409).json({
      error: `A member with phone number ${norm.display} already exists (${existing.fullName}).`,
      existingMember: existing,
    });
  }

  const now = new Date().toISOString();
  const fName = firstName.trim();
  const sName = secondName ? secondName.trim() : '';
  const fullName = `${fName} ${sName}`.trim();

  const newMember: Member = {
    id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    firstName: fName,
    secondName: sName,
    fullName,
    phone: norm.e164,
    rawPhone: String(phone).trim(),
    email: email ? String(email).trim().toLowerCase() : undefined,
    gender: ['Male', 'Female'].includes(gender) ? gender : 'Other',
    departmentIds: Array.isArray(departmentIds) ? departmentIds : [],
    smsConsent: Boolean(smsConsent),
    status: ['active', 'inactive', 'archived'].includes(status) ? status : 'active',
    notes: notes ? String(notes).trim() : '',
    source: 'manual',
    registrationDate: now,
    updatedAt: now,
  };

  db.update(d => {
    d.members.push(newMember);
  });

  db.logAudit(admin.email, 'CREATE_MEMBER', `Created member: ${fullName} (${norm.e164})`, req.ip);

  res.status(201).json({ member: newMember });
});

/**
 * PUT /api/members/:id
 * Update member
 */
membersRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const admin = (req as any).admin;
  const {
    firstName,
    secondName,
    phone,
    email,
    gender,
    departmentIds,
    smsConsent,
    status,
    notes,
  } = req.body;

  const currentDb = db.get();
  const index = currentDb.members.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const current = currentDb.members[index];
  let updatedPhone = current.phone;
  let rawPhone = current.rawPhone;

  if (phone && phone !== current.rawPhone && phone !== current.phone) {
    const norm = normalizeUgandanPhone(phone);
    if (!norm.isValid) {
      return res.status(400).json({ error: `Invalid Ugandan phone format: "${phone}"` });
    }
    // Check collision with another active member
    const collision = currentDb.members.find(m => m.id !== id && m.phone === norm.e164 && m.status !== 'archived');
    if (collision) {
      return res.status(409).json({
        error: `Phone number ${norm.display} is already used by ${collision.fullName}`,
      });
    }
    updatedPhone = norm.e164;
    rawPhone = String(phone).trim();
  }

  const fName = firstName !== undefined ? firstName.trim() : current.firstName;
  const sName = secondName !== undefined ? secondName.trim() : current.secondName;
  const fullName = `${fName} ${sName}`.trim();

  db.update(d => {
    const target = d.members[index];
    target.firstName = fName;
    target.secondName = sName;
    target.fullName = fullName;
    target.phone = updatedPhone;
    target.rawPhone = rawPhone;
    if (email !== undefined) target.email = email ? email.trim().toLowerCase() : undefined;
    if (gender !== undefined) target.gender = gender;
    if (departmentIds !== undefined && Array.isArray(departmentIds)) target.departmentIds = departmentIds;
    if (smsConsent !== undefined) target.smsConsent = Boolean(smsConsent);
    if (status !== undefined) target.status = status;
    if (notes !== undefined) target.notes = notes.trim();
    target.updatedAt = new Date().toISOString();
  });

  db.logAudit(admin.email, 'UPDATE_MEMBER', `Updated member: ${fullName} (${id})`, req.ip);

  res.json({ member: db.get().members[index] });
});

/**
 * DELETE /api/members/:id
 * Archive or remove member
 */
membersRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { hardDelete } = req.query;
  const admin = (req as any).admin;

  const currentDb = db.get();
  const member = currentDb.members.find(m => m.id === id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  db.update(d => {
    if (hardDelete === 'true') {
      d.members = d.members.filter(m => m.id !== id);
    } else {
      const target = d.members.find(m => m.id === id);
      if (target) {
        target.status = 'archived';
        target.updatedAt = new Date().toISOString();
      }
    }
  });

  db.logAudit(
    admin.email,
    hardDelete === 'true' ? 'DELETE_MEMBER' : 'ARCHIVE_MEMBER',
    `Member ${member.fullName} (${member.phone}) ${hardDelete === 'true' ? 'deleted' : 'archived'}`,
    req.ip
  );

  res.json({ success: true, message: `Member ${member.fullName} ${hardDelete === 'true' ? 'deleted' : 'archived'}.` });
});

/**
 * GET /api/members/duplicates/check
 * Detect all duplicate phone numbers across members
 */
membersRouter.get('/duplicates/check', (req: Request, res: Response) => {
  const currentDb = db.get();
  const phoneMap = new Map<string, Member[]>();

  currentDb.members
    .filter(m => m.status !== 'archived')
    .forEach(m => {
      const list = phoneMap.get(m.phone) || [];
      list.push(m);
      phoneMap.set(m.phone, list);
    });

  const duplicateGroups: { phone: string; count: number; members: Member[] }[] = [];
  phoneMap.forEach((members, phone) => {
    if (members.length > 1) {
      duplicateGroups.push({
        phone,
        count: members.length,
        members,
      });
    }
  });

  res.json({
    totalDuplicateGroups: duplicateGroups.length,
    groups: duplicateGroups,
  });
});

/**
 * POST /api/members/merge-duplicates
 * Safely merge duplicate member records into one primary record
 */
membersRouter.post('/merge-duplicates', (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const { primaryMemberId, duplicateMemberIds } = req.body;

  if (!primaryMemberId || !Array.isArray(duplicateMemberIds) || duplicateMemberIds.length === 0) {
    return res.status(400).json({ error: 'primaryMemberId and duplicateMemberIds array are required' });
  }

  const currentDb = db.get();
  const primary = currentDb.members.find(m => m.id === primaryMemberId);
  if (!primary) {
    return res.status(404).json({ error: 'Primary member not found' });
  }

  const duplicates = currentDb.members.filter(m => duplicateMemberIds.includes(m.id));

  // Merge department memberships (set union)
  const allDeptIds = new Set(primary.departmentIds);
  // SMS consent: if any has consented, keep true
  let mergedConsent = primary.smsConsent;
  let combinedNotes = primary.notes || '';

  duplicates.forEach(dup => {
    dup.departmentIds.forEach(dId => allDeptIds.add(dId));
    if (dup.smsConsent) mergedConsent = true;
    if (dup.notes && !combinedNotes.includes(dup.notes)) {
      combinedNotes = combinedNotes ? `${combinedNotes} | Merged note: ${dup.notes}` : dup.notes;
    }
  });

  db.update(d => {
    const targetPrimary = d.members.find(m => m.id === primaryMemberId);
    if (targetPrimary) {
      targetPrimary.departmentIds = Array.from(allDeptIds);
      targetPrimary.smsConsent = mergedConsent;
      targetPrimary.notes = combinedNotes;
      targetPrimary.updatedAt = new Date().toISOString();
    }

    // Archive or remove merged duplicates
    d.members = d.members.map(m => {
      if (duplicateMemberIds.includes(m.id)) {
        return {
          ...m,
          status: 'archived',
          notes: `${m.notes || ''} [Merged into ${primary.fullName} (${primary.id}) on ${new Date().toISOString()}]`,
          updatedAt: new Date().toISOString(),
        };
      }
      return m;
    });
  });

  db.logAudit(
    admin.email,
    'MERGE_MEMBERS',
    `Merged ${duplicates.length} duplicate records into primary member: ${primary.fullName} (${primary.id})`,
    req.ip
  );

  res.json({
    success: true,
    message: `Merged ${duplicates.length} duplicate(s) into ${primary.fullName}.`,
    primaryMember: db.get().members.find(m => m.id === primaryMemberId),
  });
});

/**
 * POST /api/members/bulk-action
 * Perform action on multiple selected members
 */
membersRouter.post('/bulk-action', (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const { memberIds, action, departmentId } = req.body;

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds array is required' });
  }

  db.update(d => {
    d.members.forEach(m => {
      if (memberIds.includes(m.id)) {
        if (action === 'activate') m.status = 'active';
        else if (action === 'deactivate') m.status = 'inactive';
        else if (action === 'archive') m.status = 'archived';
        else if (action === 'grant_consent') m.smsConsent = true;
        else if (action === 'revoke_consent') m.smsConsent = false;
        else if (action === 'add_department' && departmentId) {
          if (!m.departmentIds.includes(departmentId)) {
            m.departmentIds.push(departmentId);
          }
        } else if (action === 'remove_department' && departmentId) {
          m.departmentIds = m.departmentIds.filter(id => id !== departmentId);
        }
        m.updatedAt = new Date().toISOString();
      }
    });
  });

  db.logAudit(admin.email, 'BULK_MEMBER_ACTION', `Applied action "${action}" on ${memberIds.length} members`, req.ip);

  res.json({ success: true, count: memberIds.length });
});

/**
 * POST /api/members/import
 * Batch import members from Excel / CSV array
 */
membersRouter.post('/import', (req: Request, res: Response) => {
  const admin = (req as any).admin;
  const { rows, updateExisting = true } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array is required' });
  }

  const currentDb = db.get();
  const deptNameToId = new Map<string, string>();
  currentDb.departments.forEach(dept => {
    deptNameToId.set(dept.name.toLowerCase().trim(), dept.id);
  });

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: { row: number; error: string; data: any }[] = [];

  db.update(d => {
    rows.forEach((row, index) => {
      const rawFirstName = row.first_name || row.firstName || row['First Name'] || row['First name'] || row['Given Name'] || '';
      const rawSecondName = row.second_name || row.secondName || row['Second Name'] || row.lastName || row['Last Name'] || row.surname || row['Surname'] || '';
      const rawPhone = row.phone || row.phoneNumber || row.phone_number || row['Phone Number'] || row['phone_number'] || row['Phone'] || row['Mobile'] || row['Telephone'] || row.tel || '';
      const rawConsent = row.sms_consent ?? row.smsConsent ?? row['sms_consent'] ?? row['SMS Consent'] ?? row['Consent'] ?? row['Do you consent to receiving SMS?'];
      const rawEmail = row.email || row.email_address || row['Email'] || row['Email Address'] || '';
      const rawGender = row.gender || row['Gender'] || '';
      const rawDepts = row.department || row.departments || row.selected_departments || row.selectedDepartments || row['Departments'] || row['Department'] || row['Ministry'] || row['Ministries'] || row['Departments / Ministries'] || '';
      const rawNotes = row.notes || row['Notes'] || row.comment || row['Comment'] || '';

      if (!rawFirstName || !String(rawFirstName).trim()) {
        errors.push({ row: index + 1, error: 'Missing first name', data: row });
        skippedCount++;
        return;
      }

      const normPhone = normalizeUgandanPhone(rawPhone);
      if (!normPhone.isValid) {
        errors.push({ row: index + 1, error: `Invalid Ugandan phone: "${rawPhone}"`, data: row });
        skippedCount++;
        return;
      }

      // Consent check:
      // Must be explicitly affirmative
      const consentStr = String(rawConsent ?? '').trim().toLowerCase();
      const hasConsent = ['yes', 'true', '1', 'agreed', 'consent', 'y'].includes(consentStr);

      // Parse departments
      const matchedDeptIds: string[] = [];
      if (rawDepts) {
        const parts = String(rawDepts).split(/[,;/]/).map(p => p.trim().toLowerCase());
        parts.forEach(part => {
          if (!part) return;
          // Exact match
          if (deptNameToId.has(part)) {
            matchedDeptIds.push(deptNameToId.get(part)!);
          } else {
            // Partial match
            currentDb.departments.forEach(dept => {
              if (dept.name.toLowerCase().includes(part) || part.includes(dept.name.toLowerCase())) {
                if (!matchedDeptIds.includes(dept.id)) {
                  matchedDeptIds.push(dept.id);
                }
              }
            });
          }
        });
      }

      // If no department matched, assign "Other" department if available
      if (matchedDeptIds.length === 0) {
        const otherDept = currentDb.departments.find(dp => dp.name.toLowerCase() === 'other');
        if (otherDept) matchedDeptIds.push(otherDept.id);
      }

      const now = new Date().toISOString();
      const existingMember = d.members.find(m => m.phone === normPhone.e164);

      if (existingMember) {
        if (updateExisting) {
          // Update details, combine departments
          existingMember.firstName = String(rawFirstName).trim();
          existingMember.secondName = String(rawSecondName).trim();
          existingMember.fullName = `${existingMember.firstName} ${existingMember.secondName}`.trim();
          if (rawEmail) existingMember.email = String(rawEmail).trim().toLowerCase();
          if (['Male', 'Female'].includes(String(rawGender))) {
            existingMember.gender = rawGender as 'Male' | 'Female';
          }
          matchedDeptIds.forEach(dId => {
            if (!existingMember.departmentIds.includes(dId)) {
              existingMember.departmentIds.push(dId);
            }
          });
          if (hasConsent) existingMember.smsConsent = true;
          if (rawNotes) {
            existingMember.notes = existingMember.notes ? `${existingMember.notes} | ${rawNotes}` : String(rawNotes).trim();
          }
          existingMember.updatedAt = now;
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // Create new member
        const newMember: Member = {
          id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          firstName: String(rawFirstName).trim(),
          secondName: String(rawSecondName).trim(),
          fullName: `${String(rawFirstName).trim()} ${String(rawSecondName).trim()}`.trim(),
          phone: normPhone.e164,
          rawPhone: String(rawPhone).trim(),
          email: rawEmail ? String(rawEmail).trim().toLowerCase() : undefined,
          gender: ['Male', 'Female'].includes(String(rawGender)) ? rawGender as 'Male' | 'Female' : 'Other',
          departmentIds: matchedDeptIds,
          smsConsent: hasConsent,
          status: 'active',
          source: 'excel_import',
          notes: rawNotes ? String(rawNotes).trim() : undefined,
          registrationDate: now,
          updatedAt: now,
        };
        d.members.push(newMember);
        createdCount++;
      }
    });

    if (createdCount > 0 || updatedCount > 0) {
      d.generalSettings.lastSuccessfulGoogleSync = new Date().toISOString();
    }
  });

  // Automatically regenerate the master 11-sheet Excel workbook register
  try {
    generateChurchExcelRegister();
  } catch (err) {
    console.error('Failed to update Excel register after member import:', err);
  }

  db.logAudit(
    admin.email,
    'IMPORT_MEMBERS',
    `Imported members via Excel: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`,
    req.ip
  );

  res.json({
    success: true,
    createdCount,
    updatedCount,
    skippedCount,
    errors,
  });
});
