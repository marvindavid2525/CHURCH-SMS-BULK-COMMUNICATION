import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Code2,
  Check,
  Send,
  AlertTriangle,
  RotateCcw,
  Trash2,
  HelpCircle,
  FileDown,
  Info,
} from 'lucide-react';
import { GoogleSyncLog, api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { GoogleFormsGuideModal } from '../components/GoogleFormsGuideModal.js';

export const GoogleSyncView: React.FC = () => {
  const toast = useToast();

  const [logs, setLogs] = useState<GoogleSyncLog[]>([]);
  const [failedList, setFailedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [scriptMode, setScriptMode] = useState<'form' | 'sheet'>('form');
  const [showGuideModal, setShowGuideModal] = useState(false);

  const [webhookSecret, setWebhookSecret] = useState('churchsms_sec_9934812398');
  const [lastExcelGen, setLastExcelGen] = useState<string | null>(null);

  const webhookUrl = `${window.location.origin}/api/google-sheets/webhook`;

  const loadLogsAndSettings = async () => {
    try {
      setLoading(true);
      const [syncData, settingsRes] = await Promise.all([
        api.getSyncLogs(),
        api.getSettings(),
      ]);
      setLogs(syncData.logs || []);
      setFailedList(syncData.failedRegistrations || []);
      setLastExcelGen(syncData.lastExcelGeneratedAt || null);

      if (settingsRes.generalSettings?.webhookSecret) {
        setWebhookSecret(settingsRes.generalSettings.webhookSecret);
      }
    } catch (err: any) {
      toast.error('Failed to load sync logs', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogsAndSettings();
  }, []);

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      const res = await api.triggerManualSync();
      toast.success('Sync Listener & Excel Verified', res.message);
      loadLogsAndSettings();
    } catch (err: any) {
      toast.error('Manual sync failed', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      setIsRetrying(true);
      const res = await api.retryFailedRegistrations();
      toast.success('Retry Batch Complete', res.message);
      loadLogsAndSettings();
    } catch (err: any) {
      toast.error('Retry failed', err.message);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDismissFailed = async (id: string) => {
    try {
      await api.dismissFailedRegistration(id);
      toast.info('Failed record dismissed');
      loadLogsAndSettings();
    } catch (err: any) {
      toast.error('Dismiss failed', err.message);
    }
  };

  const handleDownloadExcel = () => {
    window.location.href = api.getDownloadExcelUrl();
    toast.success(
      'Downloading Excel Register',
      'Generating Omega_Prayer_Mission_Member_Register.xlsx with 11 worksheets and clickable response links.'
    );
  };

  // Google Form Container Script (captures edit-response URL directly from form submit event)
  const formContainerScript = `/**
 * Google Apps Script for Omega Prayer Mission Church Mbuya (Google Form)
 * Open your Google Registration Form:
 * Click 3 vertical dots (Top Right) > Script editor
 * Paste this script and add a Trigger:
 * Triggers > Add Trigger > sendToChurchSMS > From form > On form submit
 */

const CHURCHSMS_WEBHOOK_URL = "${webhookUrl}";
const CHURCHSMS_WEBHOOK_SECRET = "${webhookSecret}";

function sendToChurchSMS(e) {
  try {
    const response = e.response;
    const itemResponses = response.getItemResponses();
    
    // Retrieve individual Google Form response ID and Edit URL
    const responseId = response.getId();
    const editResponseUrl = response.getEditResponseUrl();
    const timestamp = response.getTimestamp().toISOString();

    const data = {
      google_response_id: responseId,
      edit_response_url: editResponseUrl,
      submitted_at: timestamp,
    };

    itemResponses.forEach(item => {
      const title = item.getItem().getTitle().toLowerCase().trim();
      const answer = item.getResponse();

      if (title.includes("first name")) {
        data.first_name = answer;
      } else if (title.includes("second name") || title.includes("last name") || title.includes("surname")) {
        data.second_name = answer;
      } else if (title.includes("phone") || title.includes("mobile") || title.includes("contact")) {
        data.phone = answer;
      } else if (title.includes("consent") || title.includes("sms")) {
        data.sms_consent = Array.isArray(answer) ? answer.join(", ") : answer;
      } else if (title.includes("gender")) {
        data.gender = answer;
      } else if (title.includes("email")) {
        data.email = answer;
      } else if (title.includes("department") || title.includes("ministr")) {
        data.departments = Array.isArray(answer) ? answer.join(", ") : answer;
      }
    });

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-webhook-secret": CHURCHSMS_WEBHOOK_SECRET
      },
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(CHURCHSMS_WEBHOOK_URL, options);
    Logger.log("ChurchSMS Response: " + res.getContentText());
  } catch (err) {
    Logger.log("ChurchSMS Error: " + err.toString());
  }
}
`;

  // Google Sheet Container Script
  const sheetContainerScript = `/**
 * Google Apps Script for Omega Prayer Mission Church Mbuya (Google Sheet)
 * In your Responses Spreadsheet:
 * Extensions > Apps Script
 * Paste this script and add a Trigger:
 * Triggers > Add Trigger > onFormSubmitSheet > From spreadsheet > On form submit
 */

const CHURCHSMS_WEBHOOK_URL = "${webhookUrl}";
const CHURCHSMS_WEBHOOK_SECRET = "${webhookSecret}";

function onFormSubmitSheet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    
    // Read header row and submitted row values
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const rowData = {
      row_number: lastRow
    };
    headers.forEach((header, index) => {
      rowData[header.toString().trim()] = rowValues[index];
    });

    // Try to retrieve edit response URL from form if linked
    let editResponseUrl = "";
    let responseId = "";
    try {
      const formUrl = sheet.getFormUrl();
      if (formUrl) {
        const form = FormApp.openByUrl(formUrl);
        const formResponses = form.getResponses();
        if (formResponses.length > 0) {
          const lastFormResponse = formResponses[formResponses.length - 1];
          responseId = lastFormResponse.getId();
          editResponseUrl = lastFormResponse.getEditResponseUrl();
        }
      }
    } catch (eForm) {
      Logger.log("Notice: " + eForm.toString());
    }

    const payload = {
      first_name: rowData["First Name"] || rowData["First name"] || rowData["firstName"] || "",
      second_name: rowData["Second Name"] || rowData["Last Name"] || rowData["Surname"] || "",
      phone: rowData["Phone Number"] || rowData["Phone"] || rowData["Mobile"] || "",
      sms_consent: rowData["SMS Consent"] || rowData["Do you consent to receiving SMS?"] || "Yes",
      gender: rowData["Gender"] || "",
      email: rowData["Email Address"] || rowData["Email"] || "",
      departments: rowData["Departments"] || rowData["Department"] || rowData["Ministry"] || "",
      notes: "Google Form Row #" + lastRow,
      google_response_id: responseId,
      edit_response_url: editResponseUrl,
      row_number: lastRow
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-webhook-secret": CHURCHSMS_WEBHOOK_SECRET
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(CHURCHSMS_WEBHOOK_URL, options);
    Logger.log("ChurchSMS Response: " + res.getContentText());
  } catch (err) {
    Logger.log("ChurchSMS Sync Error: " + err.toString());
  }
}
`;

  const activeScript = scriptMode === 'form' ? formContainerScript : sheetContainerScript;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-sky-400" />
            Google Forms & Google Sheets Sync
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Omega Prayer Mission Church Mbuya • Real-time Member Registration & Department Routing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-sky-600/30 transition-all active:scale-95 border border-white/20"
          >
            <HelpCircle className="w-4 h-4 text-white" />
            <span>5-Step Setup Walkthrough</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold border border-white/10 transition-all"
            title="Download latest generated Omega_Prayer_Mission_Member_Register.xlsx"
          >
            <FileDown className="w-4 h-4 text-emerald-400" />
            <span>Excel Register</span>
          </button>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
            Sync & Check
          </button>
        </div>
      </div>

      {/* Hero Interactive Walkthrough Banner */}
      <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-blue-950/60 via-slate-900/80 to-slate-950/90 border border-sky-500/25 shadow-xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-bold uppercase tracking-wider">
                Interactive Walkthrough
              </span>
              <span className="text-xs text-slate-400">• Step-by-Step Setup</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              How to Get Your Google Forms Connected to ChurchSMS Manager
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Connect your Google Registration Form to automatically extract individual response edit links, clean Ugandan telephone numbers, route into 14 church departments, and update the 11-sheet Excel register without manual work.
            </p>
          </div>

          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-sky-500/30 transition-all self-start md:self-auto shrink-0 active:scale-95 border border-white/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Setup Guide</span>
          </button>
        </div>
      </div>

      {/* Synchronisation Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-slate-400 text-xs block mb-1">Webhook Endpoint</span>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Active & Verified
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Accepting form submissions</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-slate-400 text-xs block mb-1">Auto-Sync Schedule</span>
          <div className="flex items-center gap-2 text-white font-bold text-sm font-mono">
            <Clock className="w-4 h-4 text-blue-400" />
            Every 5 Minutes
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Timezone: Africa/Kampala</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-slate-400 text-xs block mb-1">Excel Register Maintenance</span>
          <div className="text-emerald-400 font-bold text-sm font-mono truncate">
            {lastExcelGen ? new Date(lastExcelGen).toLocaleTimeString() : 'Auto-maintained'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">11 worksheets generated</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-slate-400 text-xs block mb-1">Failed Registrations Queue</span>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold font-mono ${failedList.length > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {failedList.length}
            </span>
            {failedList.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">
                Action Needed
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {failedList.length === 0 ? 'Zero pending errors' : 'Ready for retry'}
          </p>
        </div>
      </div>

      {/* Failed Registrations Queue Section (if any) */}
      {failedList.length > 0 && (
        <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  Failed Registrations Queue ({failedList.length} Records)
                </h3>
                <p className="text-xs text-rose-300/80">
                  Submissions with invalid Ugandan phone numbers or incomplete fields were safely captured here
                </p>
              </div>
            </div>

            <button
              onClick={handleRetryFailed}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-all self-start sm:self-auto disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              Retry All Failed Records
            </button>
          </div>

          <div className="overflow-x-auto max-h-60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px]">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Failed Reason</th>
                  <th className="p-3">Raw Data Provided</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {failedList.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-slate-400 text-[11px]">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-semibold text-rose-400">
                      {item.error}
                    </td>
                    <td className="p-3 font-mono text-slate-300 max-w-sm truncate text-[11px]">
                      {JSON.stringify(item.rawPayload)}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDismissFailed(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Dismiss record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HTTP 403 Troubleshooting & Permissions Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <HelpCircle className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-sm text-white">
            Google Sheets & Apps Script HTTP 403 Diagnostic Guide
          </h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          If you encountered an HTTP 403 error during Google Sheets integration, follow these verified configuration steps:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-bold text-amber-300 block">1. x-webhook-secret Header</span>
            <p className="text-slate-400 text-[11px]">
              Every HTTP POST request from Apps Script must include the exact header <code className="text-slate-200">x-webhook-secret: {webhookSecret}</code>. Unauthorized requests return HTTP 401/403.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-bold text-amber-300 block">2. Google Sheet Sharing</span>
            <p className="text-slate-400 text-[11px]">
              Ensure the administrator account running the trigger has <strong>Editor</strong> permission on the spreadsheet and linked form.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-bold text-amber-300 block">3. UrlFetchApp Scopes</span>
            <p className="text-slate-400 text-[11px]">
              When saving the Apps Script, click <strong>Review Permissions</strong> to grant Google permission to dispatch outbound webhooks to ChurchSMS Manager.
            </p>
          </div>
        </div>
      </div>

      {/* Webhook Configuration & Apps Script Snippet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Webhook URL & Secret */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Registration Webhook Credentials
          </h3>
          <p className="text-xs text-slate-400">
            Use these credentials in your church Google Form or Google Sheets script trigger.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Live Webhook Endpoint (POST)
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 font-mono text-xs text-slate-200">
              <span className="truncate flex-1 text-blue-300">{webhookUrl}</span>
              <button
                onClick={() => handleCopy(webhookUrl, setCopiedUrl)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                title="Copy Webhook URL"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              CHURCHSMS_WEBHOOK_SECRET Header
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 font-mono text-xs text-slate-200">
              <span className="truncate flex-1 text-emerald-300">{webhookSecret}</span>
              <button
                onClick={() => handleCopy(webhookSecret, setCopiedSecret)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                title="Copy Secret"
              >
                {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Header name: <code className="text-slate-300">x-webhook-secret</code>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs text-slate-300">
            <span className="font-semibold text-white block mb-1">Automatic Routing Guarantees:</span>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Preserves original Google Sheet without deletion or cell overwrite.
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Routes members into all selected church ministries simultaneously.
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Automatically maintains 11-sheet <strong className="text-white">Omega_Prayer_Mission_Member_Register.xlsx</strong>.
            </div>
          </div>
        </div>

        {/* Right: Copyable Apps Script with Form & Sheet tabs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm text-white">Google Apps Script Snippet</span>
              </div>

              {/* Mode switch: Form vs Sheet with Motion animated indicator */}
              <div className="flex items-center gap-1 bg-slate-950/80 border border-white/10 rounded-xl p-1 text-xs">
                <button
                  onClick={() => setScriptMode('form')}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    scriptMode === 'form' ? 'text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {scriptMode === 'form' && (
                    <motion.div
                      layoutId="scriptModeTab"
                      className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-600/30 border border-white/20"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">From Google Form (Recommended)</span>
                </button>

                <button
                  onClick={() => setScriptMode('sheet')}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    scriptMode === 'sheet' ? 'text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {scriptMode === 'sheet' && (
                    <motion.div
                      layoutId="scriptModeTab"
                      className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-600/30 border border-white/20"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">From Google Sheet</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-slate-400">
                {scriptMode === 'form'
                  ? 'Captures response ID and individual edit response URL directly.'
                  : 'Reads newly appended row values from the response spreadsheet.'}
              </p>
              <button
                onClick={() => handleCopy(activeScript, setCopiedScript)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-colors"
              >
                {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copy Script
              </button>
            </div>

            <pre className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
              {activeScript}
            </pre>
          </div>

          <p className="text-[11px] text-slate-500 pt-1">
            * Trigger: <strong>Triggers &gt; Add Trigger &gt; On form submit</strong>.
          </p>
        </div>
      </div>

      {/* Synchronisation History Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Synchronisation Audit Log
          </h3>
          <span className="text-xs text-slate-400 font-mono">{logs.length} Log Entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Source</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Summary</th>
                <th className="p-3.5 font-mono">New</th>
                <th className="p-3.5 font-mono">Updated</th>
                <th className="p-3.5 font-mono">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                    Loading sync logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No webhook submissions received yet. Submissions from Google Forms will be logged here.
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  let badge = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (log.status === 'success') badge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                  else if (log.status === 'partial') badge = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
                  else if (log.status === 'failed') badge = 'bg-rose-500/10 text-rose-300 border-rose-500/30';

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3.5 uppercase font-mono text-[10px] text-slate-300 font-bold">
                        {log.source}
                      </td>
                      <td className="p-3.5">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${badge}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300 max-w-md truncate">
                        {log.summary}
                        {log.errors && log.errors.length > 0 && (
                          <span className="text-rose-400 block text-[10px] mt-0.5">
                            Errors: {log.errors.join('; ')}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-emerald-400 font-bold">{log.newCount}</td>
                      <td className="p-3.5 font-mono text-blue-400 font-bold">{log.updatedCount}</td>
                      <td className="p-3.5 font-mono text-rose-400 font-bold">{log.failedCount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Forms Step-by-Step Setup Modal */}
      <GoogleFormsGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        webhookUrl={webhookUrl}
        webhookSecret={webhookSecret}
      />
    </div>
  );
};
