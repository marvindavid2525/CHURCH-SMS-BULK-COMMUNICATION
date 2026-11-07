import { db, SMSTransaction, Member } from './db.js';

export interface NormalizedPhone {
  isValid: boolean;
  e164: string; // +256712345678
  local: string; // 0712345678
  display: string; // +256 712 345 678
  carrier?: string;
  raw: string;
}

/**
 * Normalises Ugandan phone numbers.
 * Supports:
 * - 0712345678
 * - 712345678
 * - 256712345678
 * - +256712345678
 */
export function normalizeUgandanPhone(input: string): NormalizedPhone {
  const raw = String(input || '').trim();
  // Strip non-digits
  let digits = raw.replace(/\D/g, '');

  if (!digits) {
    return { isValid: false, e164: '', local: '', display: raw, raw };
  }

  // If starts with 256 and has 12 digits: e.g. 256712345678
  if (digits.startsWith('256') && digits.length === 12) {
    digits = digits.substring(3); // 712345678
  }

  // If starts with 0 and has 10 digits: e.g. 0712345678
  if (digits.startsWith('0') && digits.length === 10) {
    digits = digits.substring(1); // 712345678
  }

  // Now digits should be 9 digits starting with 7, 3, 4, 2 (mobile or fixed)
  if (digits.length === 9 && ['7', '3', '4'].includes(digits[0])) {
    const e164 = `+256${digits}`;
    const local = `0${digits}`;
    const display = `+256 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;

    // Identify carrier
    const prefix = digits.substring(0, 2);
    let carrier = 'Uganda Mobile';
    if (['77', '78', '76'].includes(prefix)) carrier = 'MTN Uganda';
    else if (['70', '75', '74'].includes(prefix)) carrier = 'Airtel Uganda';
    else if (['72'].includes(prefix)) carrier = 'Lycamobile';
    else if (['73'].includes(prefix)) carrier = 'Smile Telecom';

    return { isValid: true, e164, local, display, carrier, raw };
  }

  // Fallback if not strictly 9 digits
  return { isValid: false, e164: raw, local: raw, display: raw, raw };
}

/**
 * Calculates segments and estimated credits for SMS content
 */
export function calculateSMSCredits(message: string): {
  characterCount: number;
  segments: number;
  isUnicode: boolean;
  maxCharsPerSegment: number;
} {
  const text = message || '';
  const length = text.length;

  // Check for characters outside basic GSM 7-bit charset
  // eslint-disable-next-line no-control-regex
  const isUnicode = /[^\u0020-\u007E\u00A0-\u00FF\u20AC]/.test(text);

  if (length === 0) {
    return { characterCount: 0, segments: 0, isUnicode, maxCharsPerSegment: 160 };
  }

  if (isUnicode) {
    const maxSingle = 70;
    const maxConcat = 67;
    const segments = length <= maxSingle ? 1 : Math.ceil(length / maxConcat);
    return { characterCount: length, segments, isUnicode: true, maxCharsPerSegment: length <= maxSingle ? 70 : 67 };
  } else {
    const maxSingle = 160;
    const maxConcat = 153;
    const segments = length <= maxSingle ? 1 : Math.ceil(length / maxConcat);
    return { characterCount: length, segments, isUnicode: false, maxCharsPerSegment: length <= maxSingle ? 160 : 153 };
  }
}

/**
 * Resolves template variables in a message for a specific member
 */
export function personalizeMessage(template: string, member: Member, departmentNames?: string): string {
  let text = template;
  const firstName = member.firstName || 'Member';
  const fullName = member.fullName || `${member.firstName} ${member.secondName}`.trim() || 'Church Member';
  const depts = departmentNames || 'Omega Prayer Mission';

  text = text.replace(/\{first_name\}/gi, firstName);
  text = text.replace(/\{full_name\}/gi, fullName);
  text = text.replace(/\{department\}/gi, depts);
  text = text.replace(/\{phone\}/gi, member.phone || '');

  return text;
}

/**
 * Bulk SMS Uganda API Client
 */
export class BulkSMSUgandaService {
  private static getHeaders() {
    const settings = db.get().providerSettings;
    const apiKey = settings.apiKey || process.env.BULKSMSUGANDA_API_KEY || '';

    let authValue = apiKey;
    if (settings.authScheme === 'Bearer') {
      authValue = `Bearer ${apiKey}`;
    } else if (settings.authScheme === 'Token') {
      authValue = `Token ${apiKey}`;
    }

    return {
      'Authorization': authValue,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'ChurchSMS-Manager/1.0 (Omega Prayer Mission Church Mbuya)'
    };
  }

  /**
   * Test connection to provider
   */
  public static async testConnection(): Promise<{
    success: boolean;
    message: string;
    status: number;
    data?: any;
  }> {
    const settings = db.get().providerSettings;
    const apiKey = settings.apiKey || process.env.BULKSMSUGANDA_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        message: 'BULKSMSUGANDA_API_KEY is not configured. Please set your API key in Settings.',
        status: 400
      };
    }

    const baseUrl = settings.baseUrl || 'https://app.bulksmsug.com';
    const authUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/auth`;

    try {
      const response = await fetch(authUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { raw: responseText };
      }

      const success = response.ok && (responseJson?.status === 1 || responseJson?.status === 'success' || response.status === 200);

      // Save test connection result in provider settings
      db.update(d => {
        d.providerSettings.lastConnectionTest = {
          timestamp: new Date().toISOString(),
          success,
          message: success
            ? 'Successfully connected to Bulk SMS Uganda API'
            : (responseJson?.data || responseJson?.message || `HTTP ${response.status}: ${response.statusText}`),
          rawResponse: responseJson,
        };
        // If balance is returned in auth
        if (responseJson?.balance !== undefined) {
          d.providerSettings.lastKnownBalance = Number(responseJson.balance);
          d.providerSettings.lastBalanceUpdate = new Date().toISOString();
        }
      });

      return {
        success,
        message: success
          ? 'Successfully authenticated with Bulk SMS Uganda API'
          : (responseJson?.data || responseJson?.message || `Provider returned HTTP ${response.status}`),
        status: response.status,
        data: responseJson,
      };
    } catch (err: any) {
      const errorMsg = `Connection failed: ${err.message}`;
      db.update(d => {
        d.providerSettings.lastConnectionTest = {
          timestamp: new Date().toISOString(),
          success: false,
          message: errorMsg,
        };
      });
      return {
        success: false,
        message: errorMsg,
        status: 500,
      };
    }
  }

  /**
   * Send single SMS via Bulk SMS Uganda
   */
  public static async sendSMS(recipientNumber: string, message: string): Promise<{
    success: boolean;
    providerMessageId?: string;
    calculatedCredits?: number;
    status: 'Sent' | 'Submitted' | 'Buffered' | 'Success' | 'Rejected' | 'Failed';
    message: string;
    rawResponse?: any;
  }> {
    const settings = db.get().providerSettings;
    const apiKey = settings.apiKey || process.env.BULKSMSUGANDA_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        status: 'Failed',
        message: 'BULKSMSUGANDA_API_KEY is not configured in Settings.',
      };
    }

    const norm = normalizeUgandanPhone(recipientNumber);
    if (!norm.isValid) {
      return {
        success: false,
        status: 'Rejected',
        message: `Invalid Ugandan phone number: ${recipientNumber}`,
      };
    }

    const baseUrl = settings.baseUrl || 'https://app.bulksmsug.com';
    const sendUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/send-sms`;

    // Provider accepts 07... or 256...
    // Per documentation sample:
    // { "number": "0712345678", "message": "..." }
    const payload = {
      number: norm.local,
      message,
    };

    try {
      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { raw: responseText };
      }

      // Check documentation response format:
      // Success: { "timestamp": 1727118964, "calculatedCredits": 1, "message": "...", "contact": "+256...", "status": "Sent", "id": "..." }
      // Error: { "status": 0, "data": "Invalid API Key" }
      const isHttpOk = response.ok;
      const isStatusZero = responseJson?.status === 0;

      if (!isHttpOk || isStatusZero) {
        const errorDetail = responseJson?.data || responseJson?.message || `HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          status: 'Failed',
          message: errorDetail,
          rawResponse: responseJson,
        };
      }

      // Successful dispatch
      const providerId = responseJson.id || responseJson.message_id || `msg_${Date.now()}`;
      const calculatedCredits = Number(responseJson.calculatedCredits || 1);
      const rawStatus = String(responseJson.status || 'Sent');

      let parsedStatus: 'Sent' | 'Submitted' | 'Buffered' | 'Success' | 'Rejected' | 'Failed' = 'Sent';
      if (rawStatus.toLowerCase() === 'success') parsedStatus = 'Success';
      else if (rawStatus.toLowerCase() === 'submitted') parsedStatus = 'Submitted';
      else if (rawStatus.toLowerCase() === 'buffered') parsedStatus = 'Buffered';
      else if (rawStatus.toLowerCase() === 'rejected') parsedStatus = 'Rejected';
      else if (rawStatus.toLowerCase() === 'failed') parsedStatus = 'Failed';

      // Deduct or update credit tracking
      db.update(d => {
        if (d.providerSettings.lastKnownBalance !== undefined) {
          d.providerSettings.lastKnownBalance = Math.max(0, d.providerSettings.lastKnownBalance - calculatedCredits);
          d.providerSettings.lastBalanceUpdate = new Date().toISOString();
        }
      });

      return {
        success: true,
        providerMessageId: providerId,
        calculatedCredits,
        status: parsedStatus,
        message: 'Message successfully submitted to SMS gateway',
        rawResponse: responseJson,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'Failed',
        message: `Network/Gateway error: ${err.message}`,
      };
    }
  }

  /**
   * Check delivery status for a message ID
   * GET /api/v1/status/{message-id}
   */
  public static async checkDeliveryStatus(providerMessageId: string): Promise<{
    success: boolean;
    status: 'Sent' | 'Submitted' | 'Buffered' | 'Success' | 'Rejected' | 'Failed';
    rawResponse?: any;
    error?: string;
  }> {
    const settings = db.get().providerSettings;
    const baseUrl = settings.baseUrl || 'https://app.bulksmsug.com';
    const statusUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/status/${encodeURIComponent(providerMessageId)}`;

    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { raw: responseText };
      }

      if (!response.ok) {
        return {
          success: false,
          status: 'Failed',
          error: `HTTP ${response.status}: ${response.statusText}`,
          rawResponse: responseJson,
        };
      }

      // Format per doc:
      // { "status": 1, "data": { "id": "...", "status": "Success", ... } }
      const statusData = responseJson?.data || responseJson;
      const rawStatus = String(statusData?.status || '').toLowerCase();

      let parsedStatus: 'Sent' | 'Submitted' | 'Buffered' | 'Success' | 'Rejected' | 'Failed' = 'Sent';
      if (rawStatus === 'success' || rawStatus === 'delivered') parsedStatus = 'Success';
      else if (rawStatus === 'submitted') parsedStatus = 'Submitted';
      else if (rawStatus === 'buffered') parsedStatus = 'Buffered';
      else if (rawStatus === 'rejected') parsedStatus = 'Rejected';
      else if (rawStatus === 'failed') parsedStatus = 'Failed';

      return {
        success: true,
        status: parsedStatus,
        rawResponse: responseJson,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'Failed',
        error: err.message,
      };
    }
  }
}
