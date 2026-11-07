import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'editor';
  passwordHash: string; // SHA-256 hash
  salt: string;
  lastLogin?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  firstName: string;
  secondName: string;
  fullName: string;
  phone: string; // E.164 normalized: e.g. +256712345678
  rawPhone: string; // original input
  email?: string;
  gender: 'Male' | 'Female' | 'Other';
  departmentIds: string[];
  smsConsent: boolean;
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
  source: 'manual' | 'google_form' | 'excel_import';
  registrationDate: string;
  updatedAt: string;

  // Google Forms Response Link & Sync fields
  googleResponseId?: string;
  googleSheetRowNumber?: number;
  googleEditResponseUrl?: string;
  googleSubmittedAt?: string;
  lastSyncedAt?: string;
  syncStatus?: 'synced' | 'pending' | 'failed' | 'conflict';
  syncConflictNote?: string;
}

export interface FailedRegistration {
  id: string;
  timestamp: string;
  rawPayload: any;
  error: string;
  attempts: number;
  lastAttemptAt?: string;
}

export interface SyncConflict {
  id: string;
  memberId: string;
  timestamp: string;
  fieldName: string;
  existingValue: any;
  incomingValue: any;
  status: 'pending_review' | 'resolved_kept_existing' | 'resolved_applied_incoming';
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  recipientType: 'all_eligible' | 'departments' | 'selected_members' | 'custom';
  targetDepartmentIds?: string[];
  targetMemberIds?: string[];
  recipientCount: number;
  estimatedCredits: number;
  actualCredits: number;
  status: 'draft' | 'pending_approval' | 'sending' | 'submitted' | 'completed' | 'partially_failed' | 'failed' | 'cancelled';
  scheduledAt?: string;
  approvedBy?: string;
  createdAt: string;
  sentAt?: string;
  completedAt?: string;
  successfulCount: number;
  failedCount: number;
  pendingCount: number;
}

export interface SMSTransaction {
  id: string;
  campaignId?: string;
  providerMessageId?: string;
  recipientName: string;
  recipientPhone: string;
  messageContent: string;
  calculatedCredits: number;
  status: 'Sent' | 'Submitted' | 'Buffered' | 'Success' | 'Rejected' | 'Failed';
  errorReason?: string;
  attemptCount: number;
  providerResponse?: any;
  sentAt: string;
  deliveredAt?: string;
  lastCheckedAt?: string;
}

export interface GoogleSyncLog {
  id: string;
  timestamp: string;
  source: 'webhook' | 'manual' | 'scheduled' | 'retry';
  status: 'success' | 'partial' | 'failed';
  totalReceived: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
  summary: string;
}

export interface ProviderSettings {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  authScheme: 'Bearer' | 'Token' | 'Plain';
  defaultSenderId: string;
  lastConnectionTest?: {
    timestamp: string;
    success: boolean;
    message: string;
    rawResponse?: any;
  };
  lastKnownBalance?: number;
  lastBalanceUpdate?: string;
}

export interface GeneralSettings {
  churchName: string;
  organizationUnit: string;
  adminEmail: string;
  defaultCountryCode: string;
  defaultTimezone: string;
  lowCreditThreshold: number;
  requireCampaignApproval: boolean;
  webhookSecret: string;
  lastExcelGeneratedAt?: string;
  lastSuccessfulGoogleSync?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface DatabaseSchema {
  admins: AdminUser[];
  departments: Department[];
  members: Member[];
  campaigns: Campaign[];
  smsTransactions: SMSTransaction[];
  googleSyncLogs: GoogleSyncLog[];
  failedRegistrations: FailedRegistration[];
  syncConflicts: SyncConflict[];
  providerSettings: ProviderSettings;
  generalSettings: GeneralSettings;
  auditLogs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'churchsms-db.json');

// Preloaded 14 departments for Omega Prayer Mission Church Mbuya
const INITIAL_DEPARTMENTS: string[] = [
  'Media and Technical',
  'Prayer and Intercession',
  'Evangelism',
  'Ushering',
  'Choir',
  'Praise and Worship',
  'Hospitality',
  'Mighty Youth',
  "Children's Ministry",
  "Men's Ministry",
  "Women's Ministry",
  'Ministering Groups',
  'Church Administration',
  'Other'
];

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = hashPassword(password, salt);
  return hash === expectedHash;
}

function getDefaultDatabase(): DatabaseSchema {
  const adminSalt = generateSalt();
  // Default master password is 'OmegaPrayer2025!' or PIN '2025'
  const adminHash = hashPassword('OmegaPrayer2025!', adminSalt);

  const now = new Date().toISOString();

  const depts: Department[] = INITIAL_DEPARTMENTS.map((name, index) => ({
    id: `dept_${index + 1}`,
    name,
    description: `${name} department at Omega Prayer Mission Church Mbuya`,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }));

  // Seed sample verified members with realistic Ugandan contacts who have consented to SMS
  const sampleMembers: Member[] = [
    {
      id: 'mem_1',
      firstName: 'Marvin',
      secondName: 'Mulindwa',
      fullName: 'Marvin Mulindwa',
      phone: '+256701234567',
      rawPhone: '0701234567',
      email: 'amarvinmulindwa2003@gmail.com',
      gender: 'Male',
      departmentIds: ['dept_1', 'dept_13'], // Media & Admin
      smsConsent: true,
      status: 'active',
      notes: 'System Administrator & Media Coordinator',
      source: 'manual',
      registrationDate: '2025-01-10T09:00:00Z',
      updatedAt: now,
    },
    {
      id: 'mem_2',
      firstName: 'Sarah',
      secondName: 'Namaganda',
      fullName: 'Sarah Namaganda',
      phone: '+256772345678',
      rawPhone: '0772345678',
      email: 'sarah.namaganda@gmail.com',
      gender: 'Female',
      departmentIds: ['dept_5', 'dept_6'], // Choir & Praise
      smsConsent: true,
      status: 'active',
      notes: 'Choir Director',
      source: 'google_form',
      registrationDate: '2025-01-15T10:30:00Z',
      updatedAt: now,
    },
    {
      id: 'mem_3',
      firstName: 'David',
      secondName: 'Okello',
      fullName: 'David Okello',
      phone: '+256782456789',
      rawPhone: '256782456789',
      email: 'david.okello@gmail.com',
      gender: 'Male',
      departmentIds: ['dept_2', 'dept_10'], // Prayer & Men's
      smsConsent: true,
      status: 'active',
      notes: 'Intercession Leader',
      source: 'google_form',
      registrationDate: '2025-01-20T14:15:00Z',
      updatedAt: now,
    },
    {
      id: 'mem_4',
      firstName: 'Grace',
      secondName: 'Atuhaire',
      fullName: 'Grace Atuhaire',
      phone: '+256752567890',
      rawPhone: '0752567890',
      email: 'grace.atuhaire@yahoo.com',
      gender: 'Female',
      departmentIds: ['dept_4', 'dept_7'], // Ushering & Hospitality
      smsConsent: true,
      status: 'active',
      notes: 'Head Usher',
      source: 'manual',
      registrationDate: '2025-01-22T11:00:00Z',
      updatedAt: now,
    },
    {
      id: 'mem_5',
      firstName: 'Joshua',
      secondName: 'Mukasa',
      fullName: 'Joshua Mukasa',
      phone: '+256703678901',
      rawPhone: '0703678901',
      email: 'josh.mukasa@gmail.com',
      gender: 'Male',
      departmentIds: ['dept_8'], // Mighty Youth
      smsConsent: true,
      status: 'active',
      notes: 'Youth Fellowship Secretary',
      source: 'google_form',
      registrationDate: '2025-02-01T16:45:00Z',
      updatedAt: now,
    },
    {
      id: 'mem_6',
      firstName: 'Deborah',
      secondName: 'Kembabazi',
      fullName: 'Deborah Kembabazi',
      phone: '+256788789012',
      rawPhone: '0788789012',
      email: 'deb.kembabazi@gmail.com',
      gender: 'Female',
      departmentIds: ['dept_9', 'dept_11'], // Children & Women
      smsConsent: false, // NO SMS consent - test compliance
      status: 'active',
      notes: 'Sunday School Teacher - Requested email only, no SMS consent',
      source: 'google_form',
      registrationDate: '2025-02-05T08:20:00Z',
      updatedAt: now,
    },
    {
      id: 'mem_7',
      firstName: 'Peter',
      secondName: 'Kato',
      fullName: 'Peter Kato',
      phone: '+256704890123',
      rawPhone: '0704890123',
      email: 'peter.kato@gmail.com',
      gender: 'Male',
      departmentIds: ['dept_3'], // Evangelism
      smsConsent: true,
      status: 'active',
      notes: 'Evangelism Outreach Team',
      source: 'manual',
      registrationDate: '2025-02-10T13:00:00Z',
      updatedAt: now,
    }
  ];

  return {
    admins: [
      {
        id: 'admin_1',
        email: process.env.ADMIN_EMAIL || 'amarvinmulindwa2003@gmail.com',
        name: 'Marvin Mulindwa',
        role: 'super_admin',
        passwordHash: adminHash,
        salt: adminSalt,
        createdAt: now,
      },
      {
        id: 'admin_2',
        email: 'amarvinmulindwa2004@gmail.com',
        name: 'Marvin Mulindwa (Alt)',
        role: 'super_admin',
        passwordHash: adminHash,
        salt: adminSalt,
        createdAt: now,
      }
    ],
    departments: depts,
    members: sampleMembers,
    campaigns: [],
    smsTransactions: [],
    googleSyncLogs: [],
    failedRegistrations: [],
    syncConflicts: [],
    providerSettings: {
      providerName: 'Bulk SMS Uganda',
      baseUrl: 'https://app.bulksmsug.com',
      apiKey: process.env.BULKSMSUGANDA_API_KEY || '',
      authScheme: 'Bearer',
      defaultSenderId: 'OmegaPrayer',
      lastKnownBalance: 250,
      lastBalanceUpdate: now,
    },
    generalSettings: {
      churchName: 'Omega Prayer Mission Church Mbuya',
      organizationUnit: 'Kampala, Uganda',
      adminEmail: process.env.ADMIN_EMAIL || 'amarvinmulindwa2003@gmail.com',
      defaultCountryCode: '+256',
      defaultTimezone: 'Africa/Kampala',
      lowCreditThreshold: 50,
      requireCampaignApproval: true,
      webhookSecret: process.env.CHURCHSMS_WEBHOOK_SECRET || 'churchsms_sec_9934812398',
      lastExcelGeneratedAt: now,
      lastSuccessfulGoogleSync: now,
    },
    auditLogs: [
      {
        id: 'audit_init',
        timestamp: now,
        adminEmail: 'system',
        action: 'SYSTEM_INITIALIZE',
        details: 'ChurchSMS Manager database initialized with 14 departments and authorized administrators',
      }
    ],
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDirectory();
    this.data = this.loadDatabase();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadDatabase(): DatabaseSchema {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getDefaultDatabase();
      this.saveToFile(initial);
      return initial;
    }

    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content) as DatabaseSchema;
      // Ensure all collections exist
      if (!parsed.departments || parsed.departments.length === 0) {
        parsed.departments = getDefaultDatabase().departments;
      }
      if (!parsed.generalSettings) {
        parsed.generalSettings = getDefaultDatabase().generalSettings;
      }
      if (!parsed.providerSettings) {
        parsed.providerSettings = getDefaultDatabase().providerSettings;
      }
      if (!parsed.admins || parsed.admins.length === 0) {
        parsed.admins = getDefaultDatabase().admins;
      }
      if (!parsed.failedRegistrations) {
        parsed.failedRegistrations = [];
      }
      if (!parsed.syncConflicts) {
        parsed.syncConflicts = [];
      }
      return parsed;
    } catch (err) {
      console.error('Error loading churchsms-db.json, creating fallback', err);
      const fallback = getDefaultDatabase();
      this.saveToFile(fallback);
      return fallback;
    }
  }

  private saveToFile(state: DatabaseSchema) {
    this.ensureDataDirectory();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  public get(): DatabaseSchema {
    return this.data;
  }

  public update(updater: (db: DatabaseSchema) => void): DatabaseSchema {
    updater(this.data);
    this.saveToFile(this.data);
    return this.data;
  }

  public logAudit(adminEmail: string, action: string, details: string, ipAddress?: string) {
    this.update(db => {
      db.auditLogs.unshift({
        id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toISOString(),
        adminEmail,
        action,
        details,
        ipAddress,
      });
      // Keep recent 1000 logs
      if (db.auditLogs.length > 1000) {
        db.auditLogs = db.auditLogs.slice(0, 1000);
      }
    });
  }
}

export const db = new Database();
