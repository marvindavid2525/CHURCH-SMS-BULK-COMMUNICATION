/**
 * Client API Service for ChurchSMS Manager
 * Omega Prayer Mission Church Mbuya, Uganda
 */

const API_BASE = '/api';

export interface AdminInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isArchived: boolean;
  memberCount: number;
  activeCount: number;
  consentedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  firstName: string;
  secondName: string;
  fullName: string;
  phone: string;
  rawPhone: string;
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

export interface DashboardStats {
  members: {
    total: number;
    active: number;
    consented: number;
    nonConsented: number;
    invalidPhone: number;
  };
  departments: {
    total: number;
    distribution: {
      id: string;
      name: string;
      totalMembers: number;
      consentedMembers: number;
    }[];
    totalAssignments?: number;
  };
  registrationSync?: {
    totalReceived: number;
    totalActiveMembers: number;
    totalDepartmentAssignments: number;
    registrationsSynced: number;
    registrationsAwaiting: number;
    missingResponseLinks: number;
    failedRegistrationsCount: number;
    latestExcelGeneratedAt: string | null;
    lastSuccessfulGoogleSync: string | null;
    isGoogleSheetsConnected: boolean;
    isBulkSMSConnected: boolean;
  };
  sms: {
    totalCampaigns: number;
    totalSubmitted: number;
    delivered: number;
    pending: number;
    failed: number;
    deliveryRate: number;
    creditsConsumed: number;
    remainingCredits: number | null;
    lastBalanceUpdate?: string;
    lowCreditWarning: boolean;
  };
  recent: {
    members: Member[];
    campaigns: Campaign[];
    transactions: SMSTransaction[];
    auditLogs: any[];
    syncLogs: GoogleSyncLog[];
  };
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('churchsms_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('churchsms_token', token);
    } else {
      localStorage.removeItem('churchsms_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
      window.dispatchEvent(new CustomEvent('auth_expired'));
      throw new Error('Session expired or unauthorized. Please sign in again.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Server request failed with status ${response.status}`);
    }

    return data as T;
  }

  // Auth
  async login(email: string, password: string): Promise<{ token: string; admin: AdminInfo }> {
    const res = await this.request<{ token: string; admin: AdminInfo }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async getCurrentAdmin(): Promise<{ admin: AdminInfo }> {
    return this.request<{ admin: AdminInfo }>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/reports/stats');
  }

  async getAuditLogs(page = 1, limit = 50): Promise<any> {
    return this.request(`/reports/audit-logs?page=${page}&limit=${limit}`);
  }

  // Members
  async getMembers(params: {
    search?: string;
    departmentId?: string;
    smsConsent?: string;
    status?: string;
    gender?: string;
  } = {}): Promise<{ total: number; members: Member[] }> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.departmentId) query.append('departmentId', params.departmentId);
    if (params.smsConsent) query.append('smsConsent', params.smsConsent);
    if (params.status) query.append('status', params.status);
    if (params.gender) query.append('gender', params.gender);

    return this.request<{ total: number; members: Member[] }>(`/members?${query.toString()}`);
  }

  async createMember(member: Partial<Member>): Promise<{ member: Member }> {
    return this.request<{ member: Member }>('/members', {
      method: 'POST',
      body: JSON.stringify(member),
    });
  }

  async updateMember(id: string, member: Partial<Member>): Promise<{ member: Member }> {
    return this.request<{ member: Member }>(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(member),
    });
  }

  async deleteMember(id: string, hardDelete = false): Promise<{ success: boolean; message: string }> {
    return this.request(`/members/${id}?hardDelete=${hardDelete}`, {
      method: 'DELETE',
    });
  }

  async checkDuplicates(): Promise<{ totalDuplicateGroups: number; groups: { phone: string; count: number; members: Member[] }[] }> {
    return this.request('/members/duplicates/check');
  }

  async mergeDuplicates(primaryMemberId: string, duplicateMemberIds: string[]): Promise<any> {
    return this.request('/members/merge-duplicates', {
      method: 'POST',
      body: JSON.stringify({ primaryMemberId, duplicateMemberIds }),
    });
  }

  async bulkMemberAction(memberIds: string[], action: string, departmentId?: string): Promise<any> {
    return this.request('/members/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ memberIds, action, departmentId }),
    });
  }

  async importMembers(rows: any[], updateExisting = true): Promise<any> {
    return this.request('/members/import', {
      method: 'POST',
      body: JSON.stringify({ rows, updateExisting }),
    });
  }

  // Departments
  async getDepartments(): Promise<{ departments: Department[] }> {
    return this.request<{ departments: Department[] }>('/departments');
  }

  async createDepartment(data: { name: string; description?: string; color?: string }): Promise<{ department: Department }> {
    return this.request<{ department: Department }>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDepartment(id: string, data: Partial<Department>): Promise<{ department: Department }> {
    return this.request<{ department: Department }>(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDepartment(id: string): Promise<any> {
    return this.request(`/departments/${id}`, { method: 'DELETE' });
  }

  // SMS
  async sendTestSMS(phone: string, message: string): Promise<any> {
    return this.request('/sms/send-test', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    });
  }

  async sendIndividualSMS(memberId: string, message: string): Promise<any> {
    return this.request('/sms/send-individual', {
      method: 'POST',
      body: JSON.stringify({ memberId, message }),
    });
  }

  async getTransactions(params: {
    status?: string;
    campaignId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ total: number; page: number; limit: number; totalPages: number; transactions: SMSTransaction[] }> {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.campaignId) query.append('campaignId', params.campaignId);
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));

    return this.request(`/sms/transactions?${query.toString()}`);
  }

  async refreshDeliveryStatuses(): Promise<{ checkedCount: number; updatedCount: number }> {
    return this.request('/sms/refresh-statuses', { method: 'POST' });
  }

  // Campaigns
  async getCampaigns(): Promise<{ campaigns: Campaign[] }> {
    return this.request<{ campaigns: Campaign[] }>('/campaigns');
  }

  async previewRecipients(data: {
    recipientType: string;
    targetDepartmentIds?: string[];
    targetMemberIds?: string[];
    message?: string;
  }): Promise<{
    recipientCount: number;
    duplicatesExcluded: number;
    segmentsPerRecipient: number;
    estimatedTotalCredits: number;
    isUnicode: boolean;
    samplePreviews: { memberId: string; fullName: string; phone: string; personalizedText: string }[];
    recipients: { id: string; fullName: string; phone: string; departments: string[] }[];
  }> {
    return this.request('/campaigns/preview-recipients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createCampaign(data: {
    name: string;
    message: string;
    recipientType: string;
    targetDepartmentIds?: string[];
    targetMemberIds?: string[];
    submitForApproval?: boolean;
  }): Promise<{ campaign: Campaign }> {
    return this.request('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async dispatchCampaign(id: string): Promise<any> {
    return this.request(`/campaigns/${id}/dispatch`, { method: 'POST' });
  }

  async cancelCampaign(id: string): Promise<any> {
    return this.request(`/campaigns/${id}/cancel`, { method: 'POST' });
  }

  // Google Sheets & Response Links
  async getSyncLogs(): Promise<{
    logs: GoogleSyncLog[];
    failedRegistrations: any[];
    syncConflicts: any[];
    lastExcelGeneratedAt?: string;
    lastSuccessfulGoogleSync?: string;
  }> {
    return this.request<{
      logs: GoogleSyncLog[];
      failedRegistrations: any[];
      syncConflicts: any[];
      lastExcelGeneratedAt?: string;
      lastSuccessfulGoogleSync?: string;
    }>('/google-sheets/sync-logs');
  }

  async triggerManualSync(): Promise<{ success: boolean; message: string; log: GoogleSyncLog; lastExcelGeneratedAt?: string }> {
    return this.request('/google-sheets/trigger-manual-sync', { method: 'POST' });
  }

  async getResponseLinks(params: { search?: string; availability?: string; status?: string } = {}): Promise<{
    total: number;
    availableCount: number;
    missingCount: number;
    responseLinks: Array<{
      memberId: string;
      fullName: string;
      phone: string;
      gender: string;
      email?: string;
      smsConsent: boolean;
      departmentIds: string[];
      departmentNames: string[];
      googleResponseId: string | null;
      googleSheetRowNumber: number | null;
      googleEditResponseUrl: string | null;
      hasEditLink: boolean;
      googleSubmittedAt: string;
      lastSyncedAt: string;
      syncStatus: string;
      syncConflictNote?: string;
    }>;
  }> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.availability) query.append('availability', params.availability);
    if (params.status) query.append('status', params.status);
    return this.request(`/google-sheets/response-links?${query.toString()}`);
  }

  async retryFailedRegistrations(): Promise<{
    success: boolean;
    message: string;
    stats?: any;
    retriedCount?: number;
  }> {
    return this.request('/google-sheets/retry-failed', { method: 'POST' });
  }

  async dismissFailedRegistration(id: string): Promise<any> {
    return this.request(`/google-sheets/failed/${id}`, { method: 'DELETE' });
  }

  async simulateRegistration(data: any): Promise<any> {
    return this.request('/google-sheets/simulate-registration', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getDownloadExcelUrl(): string {
    return `/api/google-sheets/download-excel`;
  }

  // Settings
  async getSettings(): Promise<any> {
    return this.request('/settings');
  }

  async updateProviderSettings(data: any): Promise<any> {
    return this.request('/settings/provider', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateGeneralSettings(data: any): Promise<any> {
    return this.request('/settings/general', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testProviderConnection(): Promise<any> {
    return this.request('/settings/test-connection', { method: 'POST' });
  }

  async restoreBackup(backupData: any): Promise<any> {
    return this.request('/settings/restore-backup', {
      method: 'POST',
      body: JSON.stringify(backupData),
    });
  }
}

export const api = new ApiService();
