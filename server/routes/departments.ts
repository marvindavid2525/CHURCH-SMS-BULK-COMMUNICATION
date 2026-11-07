import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { requireAdmin } from './auth.js';

export const departmentsRouter = Router();

// All department operations require admin
departmentsRouter.use(requireAdmin);

/**
 * GET /api/departments
 * Get all departments with computed statistics
 */
departmentsRouter.get('/', (req: Request, res: Response) => {
  const currentDb = db.get();
  const members = currentDb.members;

  const result = currentDb.departments.map(dept => {
    const deptMembers = members.filter(m => m.departmentIds.includes(dept.id));
    const activeCount = deptMembers.filter(m => m.status === 'active').length;
    const consentedCount = deptMembers.filter(m => m.status === 'active' && m.smsConsent).length;

    return {
      ...dept,
      memberCount: deptMembers.length,
      activeCount,
      consentedCount,
    };
  });

  res.json({ departments: result });
});

/**
 * POST /api/departments
 * Create new department
 */
departmentsRouter.post('/', (req: Request, res: Response) => {
  const { name, description, color } = req.body;
  const admin = (req as any).admin;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Department name is required' });
  }

  const cleanName = name.trim();
  const currentDb = db.get();

  const exists = currentDb.departments.some(d => d.name.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: `Department "${cleanName}" already exists.` });
  }

  const now = new Date().toISOString();
  const newDept = {
    id: 'dept_' + Date.now(),
    name: cleanName,
    description: description ? description.trim() : '',
    color: color || '#2563eb',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  db.update(d => {
    d.departments.push(newDept);
  });

  db.logAudit(admin.email, 'CREATE_DEPARTMENT', `Created department: ${cleanName}`, req.ip);

  res.status(201).json({ department: newDept });
});

/**
 * PUT /api/departments/:id
 * Update existing department
 */
departmentsRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, color, isArchived } = req.body;
  const admin = (req as any).admin;

  const currentDb = db.get();
  const deptIndex = currentDb.departments.findIndex(d => d.id === id);

  if (deptIndex === -1) {
    return res.status(404).json({ error: 'Department not found' });
  }

  const oldName = currentDb.departments[deptIndex].name;
  const updatedName = name !== undefined ? name.trim() : oldName;

  db.update(d => {
    const target = d.departments[deptIndex];
    if (name !== undefined) target.name = updatedName;
    if (description !== undefined) target.description = description.trim();
    if (color !== undefined) target.color = color;
    if (isArchived !== undefined) target.isArchived = Boolean(isArchived);
    target.updatedAt = new Date().toISOString();
  });

  db.logAudit(admin.email, 'UPDATE_DEPARTMENT', `Updated department: ${oldName} -> ${updatedName}`, req.ip);

  res.json({ department: db.get().departments[deptIndex] });
});

/**
 * DELETE /api/departments/:id
 * Archive department (safe preservation of historical member records)
 */
departmentsRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const admin = (req as any).admin;

  const currentDb = db.get();
  const dept = currentDb.departments.find(d => d.id === id);

  if (!dept) {
    return res.status(404).json({ error: 'Department not found' });
  }

  db.update(d => {
    const target = d.departments.find(item => item.id === id);
    if (target) {
      target.isArchived = true;
      target.updatedAt = new Date().toISOString();
    }
  });

  db.logAudit(admin.email, 'ARCHIVE_DEPARTMENT', `Archived department: ${dept.name}`, req.ip);

  res.json({ success: true, message: `Department "${dept.name}" archived successfully.` });
});
