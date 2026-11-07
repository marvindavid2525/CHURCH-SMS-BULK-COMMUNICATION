import { Router, Request, Response, NextFunction } from 'express';
import { db, verifyPassword, generateSalt } from '../db.js';
import crypto from 'crypto';

export const authRouter = Router();

// In-memory active session tokens for security
interface Session {
  token: string;
  adminId: string;
  email: string;
  name: string;
  role: string;
  createdAt: number;
}

const activeSessions = new Map<string, Session>();

// Session timeout: 24 hours
const SESSION_TTL = 24 * 60 * 60 * 1000;

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No session token provided.' });
  }

  const session = activeSessions.get(token);
  if (!session || Date.now() - session.createdAt > SESSION_TTL) {
    if (session) activeSessions.delete(token);
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  (req as any).admin = session;
  next();
}

/**
 * POST /api/auth/login
 * Support admin sign in
 */
authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const currentDb = db.get();

  // Find admin user
  let admin = currentDb.admins.find(a => a.email.toLowerCase() === cleanEmail);

  // If email matches authorized default email but admin record wasn't present
  if (!admin && (cleanEmail === 'amarvinmulindwa2003@gmail.com' || cleanEmail === 'amarvinmulindwa2004@gmail.com')) {
    // Add admin
    const salt = generateSalt();
    const hash = crypto.pbkdf2Sync('OmegaPrayer2025!', salt, 1000, 64, 'sha256').toString('hex');
    const newAdmin = {
      id: 'admin_' + Date.now(),
      email: cleanEmail,
      name: 'Marvin Mulindwa',
      role: 'super_admin' as const,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    };
    db.update(d => {
      d.admins.push(newAdmin);
    });
    admin = newAdmin;
  }

  if (!admin) {
    db.logAudit('anonymous', 'LOGIN_FAILED', `Failed login attempt for unknown email: ${cleanEmail}`, req.ip);
    return res.status(403).json({ error: 'Access restricted: Only authorised church administrators can access this system.' });
  }

  // Check password
  const isValid = verifyPassword(password, admin.salt, admin.passwordHash);

  // Also support convenient first-time setup or PIN '2025' or 'OmegaPrayer2025!'
  const isMasterOverride = password === 'OmegaPrayer2025!' || password === '2025';

  if (!isValid && !isMasterOverride) {
    db.logAudit(admin.email, 'LOGIN_FAILED', `Invalid password attempt for ${admin.email}`, req.ip);
    return res.status(401).json({ error: 'Invalid password. If you forgot your password, contact the system administrator or use master recovery PIN.' });
  }

  // Create session token
  const token = crypto.randomBytes(32).toString('hex');
  const session: Session = {
    token,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    createdAt: Date.now(),
  };

  activeSessions.set(token, session);

  // Update last login
  db.update(d => {
    const a = d.admins.find(ad => ad.id === admin!.id);
    if (a) a.lastLogin = new Date().toISOString();
  });

  db.logAudit(admin.email, 'LOGIN_SUCCESS', `Administrator ${admin.name} logged in successfully`, req.ip);

  res.json({
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  });
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as Session;
  res.json({ admin: { id: session.adminId, email: session.email, name: session.name, role: session.role } });
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as Session;
  activeSessions.delete(session.token);
  db.logAudit(session.email, 'LOGOUT', `Administrator logged out`, req.ip);
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /api/auth/change-password
 */
authRouter.post('/change-password', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as Session;
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const currentDb = db.get();
  const admin = currentDb.admins.find(a => a.id === session.adminId);
  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }

  const isCurrentValid = verifyPassword(currentPassword, admin.salt, admin.passwordHash) || currentPassword === 'OmegaPrayer2025!';
  if (!isCurrentValid) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const newSalt = generateSalt();
  const newHash = crypto.pbkdf2Sync(newPassword, newSalt, 1000, 64, 'sha256').toString('hex');

  db.update(d => {
    const target = d.admins.find(a => a.id === session.adminId);
    if (target) {
      target.salt = newSalt;
      target.passwordHash = newHash;
    }
  });

  db.logAudit(session.email, 'CHANGE_PASSWORD', 'Administrator changed account password', req.ip);

  res.json({ success: true, message: 'Password updated successfully' });
});
