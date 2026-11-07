import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  ShieldCheck,
  Code2,
  Play,
  Layers,
  ArrowRight,
  X,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from './Toast.js';

interface GoogleFormsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookUrl: string;
  webhookSecret: string;
}

export const GoogleFormsGuideModal: React.FC<GoogleFormsGuideModalProps> = ({
  isOpen,
  onClose,
  webhookUrl,
  webhookSecret,
}) => {
  const toast = useToast();
  const [activeStep, setActiveStep] = useState(1);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [guideMode, setGuideMode] = useState<'form' | 'sheet'>('form');

  if (!isOpen) return null;

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const formContainerScript = `/**
 * Google Apps Script for Omega Prayer Mission Church Mbuya (Google Form)
 * In Google Forms:
 * 1. Click the 3 dots menu (top right) > Script editor
 * 2. Paste this code
 * 3. Triggers (Clock icon) > Add Trigger > onFormSubmit > From form > On form submit
 */

const CHURCHSMS_WEBHOOK_URL = "${webhookUrl}";
const CHURCHSMS_WEBHOOK_SECRET = "${webhookSecret}";

function onFormSubmit(e) {
  try {
    const itemResponses = e.response.getItemResponses();
    const data = {
      google_response_id: e.response.getId(),
      edit_response_url: e.response.getEditResponseUrl(),
      google_submitted_at: e.response.getTimestamp().toISOString()
    };

    itemResponses.forEach(function(itemResponse) {
      const title = itemResponse.getItem().getTitle().trim();
      const answer = itemResponse.getResponse();
      data[title] = Array.isArray(answer) ? answer.join(", ") : answer;
    });

    const payload = {
      first_name: data["First Name"] || data["First name"] || data["firstName"] || "",
      second_name: data["Second Name"] || data["Last Name"] || data["Surname"] || "",
      phone_number: data["Phone Number"] || data["Phone"] || data["Mobile"] || "",
      sms_consent: data["SMS Consent"] || data["Do you consent to receiving SMS?"] || "Yes",
      gender: data["Gender"] || "",
      email: data["Email Address"] || data["Email"] || "",
      selected_departments: data["Departments"] || data["Department"] || data["Ministry"] || "",
      google_response_id: data.google_response_id,
      edit_response_url: data.edit_response_url,
      google_submitted_at: data.google_submitted_at
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
    Logger.log("ChurchSMS Error: " + err.toString());
  }
}
`;

  const sheetContainerScript = `/**
 * Google Apps Script for Omega Prayer Mission Church Mbuya (Google Sheet)
 * In your Responses Spreadsheet:
 * 1. Extensions > Apps Script
 * 2. Paste this code
 * 3. Triggers (Clock icon) > Add Trigger > onFormSubmitSheet > From spreadsheet > On form submit
 */

const CHURCHSMS_WEBHOOK_URL = "${webhookUrl}";
const CHURCHSMS_WEBHOOK_SECRET = "${webhookSecret}";

function onFormSubmitSheet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowValues = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    const rowData = { row_number: lastRow };
    headers.forEach((header, index) => {
      rowData[header.toString().trim()] = rowValues[index];
    });

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
      phone_number: rowData["Phone Number"] || rowData["Phone"] || rowData["Mobile"] || "",
      sms_consent: rowData["SMS Consent"] || rowData["Do you consent to receiving SMS?"] || "Yes",
      gender: rowData["Gender"] || "",
      email: rowData["Email Address"] || rowData["Email"] || "",
      selected_departments: rowData["Departments"] || rowData["Department"] || rowData["Ministry"] || "",
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
    Logger.log("ChurchSMS Error: " + err.toString());
  }
}
`;

  const steps = [
    { number: 1, title: 'Form Questions & Edit Link' },
    { number: 2, title: 'Link to Google Sheet' },
    { number: 3, title: 'Open Apps Script' },
    { number: 4, title: 'Paste Pre-Filled Script' },
    { number: 5, title: 'Add "On Form Submit" Trigger' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_60px_0_rgba(0,0,0,0.6)] flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Lucid glass gradient header bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-400 via-blue-600 to-indigo-500" />

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 p-0.5 shadow-lg shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950/70 rounded-[14px] flex items-center justify-center text-sky-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white flex items-center gap-2">
                Google Forms Sync Setup Guide
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Step-by-Step
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Connect your Google Registration Form to ChurchSMS Manager in 5 easy steps
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="p-3 sm:p-4 bg-slate-950/40 border-b border-white/5 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {steps.map(s => {
              const isActive = activeStep === s.number;
              const isPast = activeStep > s.number;
              return (
                <button
                  key={s.number}
                  onClick={() => setActiveStep(s.number)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-white/20'
                      : isPast
                      ? 'bg-slate-800/80 text-emerald-300 hover:bg-slate-800'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-white text-blue-700'
                        : isPast
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? <Check className="w-3 h-3" /> : s.number}
                  </span>
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* STEP 1: FORM QUESTIONS & SETTINGS */}
          {activeStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                  1
                </span>
                <div>
                  <h4 className="font-bold text-white text-base">Setup Questions & Enable Response Editing</h4>
                  <p className="text-xs text-slate-400">Configure your Google Form with the recommended question titles</p>
                </div>
              </div>

              {/* CRITICAL NOTE: ALLOW RESPONSE EDITING */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-bold text-xs text-amber-200">
                    Crucial Setting: "Allow response editing" must be enabled
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    In your Google Form, click <strong className="text-white">Settings</strong> &gt; <strong className="text-white">Responses</strong> &gt; switch <strong className="text-emerald-400">"Allow response editing"</strong> to <strong className="text-white">ON</strong>. This allows Google Forms to generate the unique edit URL (<code className="text-sky-300">?edit2=...</code>) so administrators can view or update responses directly.
                  </p>
                </div>
              </div>

              {/* Recommended Question Fields Table */}
              <div className="space-y-2">
                <h5 className="font-bold text-xs text-white">Recommended Google Form Questions:</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-0.5">
                    <span className="font-bold text-sky-400 font-mono">1. First Name</span>
                    <p className="text-[11px] text-slate-400">Short answer (Required)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-0.5">
                    <span className="font-bold text-sky-400 font-mono">2. Second Name</span>
                    <p className="text-[11px] text-slate-400">Short answer (e.g. Mukisa, Kasirye)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-0.5">
                    <span className="font-bold text-emerald-400 font-mono">3. Phone Number</span>
                    <p className="text-[11px] text-slate-400">Short answer (e.g. 0772123456 or +256701234567)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-0.5">
                    <span className="font-bold text-indigo-400 font-mono">4. Gender</span>
                    <p className="text-[11px] text-slate-400">Multiple choice: Male / Female</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-0.5">
                    <span className="font-bold text-purple-400 font-mono">5. Email Address</span>
                    <p className="text-[11px] text-slate-400">Short answer (Optional)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-0.5">
                    <span className="font-bold text-teal-400 font-mono">6. Departments / Ministries</span>
                    <p className="text-[11px] text-slate-400">Checkboxes: Media and Technical, Choir, Mighty Youth, Ushering, Prayer...</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 sm:col-span-2 space-y-0.5">
                    <span className="font-bold text-amber-400 font-mono">7. Do you consent to receiving SMS notifications?</span>
                    <p className="text-[11px] text-slate-400">Multiple choice: Yes / No</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LINK TO GOOGLE SHEET */}
          {activeStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                  2
                </span>
                <div>
                  <h4 className="font-bold text-white text-base">Link Form to a Google Spreadsheet</h4>
                  <p className="text-xs text-slate-400">Create a real-time responses spreadsheet in Google Drive</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-3 text-xs leading-relaxed">
                <p className="text-slate-200">
                  Linking your form to a spreadsheet provides a permanent archive in Google Drive and allows you to attach triggers from either the Form itself or the linked Sheet.
                </p>

                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p className="text-slate-300">
                      Inside your Google Form, click on the <strong className="text-white">Responses</strong> tab at the top.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="text-slate-300">
                      Click the green <strong className="text-emerald-400">"Link to Sheets"</strong> icon on the right side.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="text-slate-300">
                      Select <strong className="text-white">"Create a new spreadsheet"</strong> named e.g. <em className="text-sky-300">"Omega Prayer Mission Church Registrations"</em> and click <strong className="text-white">Create</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: OPEN APPS SCRIPT */}
          {activeStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                  3
                </span>
                <div>
                  <h4 className="font-bold text-white text-base">Open Google Apps Script Editor</h4>
                  <p className="text-xs text-slate-400">Access the integrated automation script editor in Google Workspace</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
                  <span className="font-bold text-sky-400 block text-sm">Option A: From Google Form (Direct)</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    1. In your Google Form, click the <strong className="text-white">three dots menu (⋮)</strong> in the top right next to Send.<br />
                    2. Click <strong className="text-white">Script editor</strong> (&lt;/&gt; icon).<br />
                    3. A new tab opens with the Google Apps Script project.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
                  <span className="font-bold text-indigo-400 block text-sm">Option B: From Google Sheet</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    1. In your linked responses Google Sheet, click the top menu <strong className="text-white">Extensions</strong>.<br />
                    2. Select <strong className="text-white">Apps Script</strong>.<br />
                    3. A new tab opens with the bound script project.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 text-xs text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  No local software installation required — Apps Script runs safely inside Google's secure cloud servers.
                </span>
              </div>
            </div>
          )}

          {/* STEP 4: PASTE SCRIPT */}
          {activeStep === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                    4
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-base">Paste Pre-Filled Script into Code.gs</h4>
                    <p className="text-xs text-slate-400">Contains your live webhook endpoint and secret pre-configured</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5 text-xs">
                  <button
                    onClick={() => setGuideMode('form')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      guideMode === 'form' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Form Script
                  </button>
                  <button
                    onClick={() => setGuideMode('sheet')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      guideMode === 'sheet' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sheet Script
                  </button>
                </div>
              </div>

              {/* Webhook Credentials pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Live Webhook URL:</span>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-sky-300">
                    <span className="truncate">{webhookUrl}</span>
                    <button
                      onClick={() => handleCopy(webhookUrl, setCopiedUrl)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Secret Header (x-webhook-secret):</span>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-emerald-300">
                    <span className="truncate">{webhookSecret}</span>
                    <button
                      onClick={() => handleCopy(webhookSecret, setCopiedSecret)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0"
                    >
                      {copiedSecret ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Code Box */}
              <div className="relative rounded-2xl bg-slate-950 border border-white/10 overflow-hidden shadow-inner">
                <div className="p-2.5 bg-slate-900 border-b border-white/5 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400">Code.gs (Ready to paste)</span>
                  <button
                    onClick={() =>
                      handleCopy(guideMode === 'form' ? formContainerScript : sheetContainerScript, setCopiedScript)
                    }
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition-colors"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy Complete Script
                  </button>
                </div>

                <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 leading-relaxed selection:bg-blue-600">
                  {guideMode === 'form' ? formContainerScript : sheetContainerScript}
                </pre>
              </div>
            </div>
          )}

          {/* STEP 5: ADD ON FORM SUBMIT TRIGGER */}
          {activeStep === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                  5
                </span>
                <div>
                  <h4 className="font-bold text-white text-base">Add the "On form submit" Trigger</h4>
                  <p className="text-xs text-slate-400">Enables automated execution each time a church member submits</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-3 text-xs leading-relaxed">
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p className="text-slate-300">
                      In the left sidebar of Apps Script, click the <strong className="text-white">Triggers icon</strong> (it looks like a small alarm clock).
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="text-slate-300">
                      Click the blue <strong className="text-sky-400">+ Add Trigger</strong> button at the bottom right.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="text-slate-300">
                      Set the trigger fields:<br />
                      • Choose which function to run: <strong className="text-white font-mono">{guideMode === 'form' ? 'onFormSubmit' : 'onFormSubmitSheet'}</strong><br />
                      • Select event source: <strong className="text-white">{guideMode === 'form' ? 'From form' : 'From spreadsheet'}</strong><br />
                      • Select event type: <strong className="text-emerald-400 font-bold">On form submit</strong><br />
                      • Failure notification settings: <strong className="text-white">Notify me immediately</strong>
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-mono flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <p className="text-slate-300">
                      Click <strong className="text-white">Save</strong>. Google will show an authorization dialog: click your account, then click <strong className="text-white">Advanced &gt; Go to Untitled project (unsafe) &gt; Allow</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Ready Confirmation */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-200 block">Everything is now automated!</span>
                  <p className="text-emerald-300/80 mt-0.5">
                    Every new registration submitted via Google Forms will immediately be parsed, mapped into ministries, assigned an edit link, and recorded in the 11-sheet Excel register.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="p-5 sm:p-6 border-t border-white/5 bg-slate-950/40 flex items-center justify-between">
          <button
            type="button"
            disabled={activeStep === 1}
            onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Previous Step
          </button>

          <div className="flex items-center gap-2">
            {activeStep < 5 ? (
              <button
                type="button"
                onClick={() => setActiveStep(prev => Math.min(5, prev + 1))}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all"
              >
                Next Step
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Done & Ready to Receive
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
