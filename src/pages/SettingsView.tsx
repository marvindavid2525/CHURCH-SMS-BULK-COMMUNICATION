import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  ShieldCheck,
  KeyRound,
  Globe,
  Church,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useToast } from '../components/Toast.js';

interface SettingsViewProps {
  onRefreshStats: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onRefreshStats }) => {
  const toast = useToast();
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Provider Settings
  const [baseUrl, setBaseUrl] = useState('https://app.bulksmsug.com');
  const [apiKey, setApiKey] = useState('');
  const [authScheme, setAuthScheme] = useState<'Bearer' | 'Token' | 'Plain'>('Bearer');
  const [defaultSenderId, setDefaultSenderId] = useState('OmegaPrayer');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);
  const [lastConnectionTest, setLastConnectionTest] = useState<any>(null);

  // General Settings
  const [churchName, setChurchName] = useState('Omega Prayer Mission Church Mbuya');
  const [organizationUnit, setOrganizationUnit] = useState('Kampala, Uganda');
  const [adminEmail, setAdminEmail] = useState('amarvinmulindwa2003@gmail.com');
  const [defaultCountryCode, setDefaultCountryCode] = useState('+256');
  const [defaultTimezone, setDefaultTimezone] = useState('Africa/Kampala');
  const [lowCreditThreshold, setLowCreditThreshold] = useState(50);
  const [requireCampaignApproval, setRequireCampaignApproval] = useState(true);
  const [webhookSecret, setWebhookSecret] = useState('');

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      if (res.providerSettings) {
        setBaseUrl(res.providerSettings.baseUrl || 'https://app.bulksmsug.com');
        setApiKey(res.providerSettings.apiKey || '');
        setAuthScheme(res.providerSettings.authScheme || 'Bearer');
        setDefaultSenderId(res.providerSettings.defaultSenderId || 'OmegaPrayer');
        setIsApiKeyConfigured(res.providerSettings.isApiKeyConfigured || false);
        setLastConnectionTest(res.providerSettings.lastConnectionTest || null);
      }
      if (res.generalSettings) {
        setChurchName(res.generalSettings.churchName || 'Omega Prayer Mission Church Mbuya');
        setOrganizationUnit(res.generalSettings.organizationUnit || 'Kampala, Uganda');
        setAdminEmail(res.generalSettings.adminEmail || 'amarvinmulindwa2003@gmail.com');
        setDefaultCountryCode(res.generalSettings.defaultCountryCode || '+256');
        setDefaultTimezone(res.generalSettings.defaultTimezone || 'Africa/Kampala');
        setLowCreditThreshold(res.generalSettings.lowCreditThreshold || 50);
        setRequireCampaignApproval(res.generalSettings.requireCampaignApproval ?? true);
        setWebhookSecret(res.generalSettings.webhookSecret || '');
      }
    } catch (err: any) {
      toast.error('Failed to load settings', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProvider(true);
      await api.updateProviderSettings({
        baseUrl,
        apiKey,
        authScheme,
        defaultSenderId,
      });
      toast.success('Provider settings saved', 'Bulk SMS Uganda credentials updated.');
      loadSettings();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Failed to save provider settings', err.message);
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const res = await api.testProviderConnection();
      if (res.success) {
        toast.success('Connection Successful', res.message);
      } else {
        toast.warning('Connection Warning', res.message);
      }
      loadSettings();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Connection test failed', err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingGeneral(true);
      await api.updateGeneralSettings({
        churchName,
        organizationUnit,
        adminEmail,
        defaultCountryCode,
        defaultTimezone,
        lowCreditThreshold,
        requireCampaignApproval,
        webhookSecret,
      });
      toast.success('General settings saved', 'Church configuration updated.');
      onRefreshStats();
    } catch (err: any) {
      toast.error('Failed to save general settings', err.message);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/settings/export-backup';
    toast.success('Backup downloading', 'System database exported to JSON.');
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.members || !json.departments) {
          toast.error('Invalid backup', 'Missing required database collections in file.');
          return;
        }
        if (!window.confirm('Restore system from backup? This will replace current database records.')) return;

        await api.restoreBackup(json);
        toast.success('Database restored', 'System database restored successfully.');
        loadSettings();
        onRefreshStats();
      } catch (err: any) {
        toast.error('Restore failed', err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto text-slate-100">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          System Settings & API Configuration
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Omega Prayer Mission Church Mbuya • Bulk SMS Uganda & Google Webhook Security
        </p>
      </div>

      {/* 1. Bulk SMS Uganda Provider Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Bulk SMS Uganda Provider</h3>
              <p className="text-xs text-slate-400">
                Official API Docs: <a href="https://bulksmsug.com/api-docs" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">bulksmsug.com/api-docs</a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin text-blue-400' : ''}`} />
              Test API Connection
            </button>
          </div>
        </div>

        {/* Connection status indicator */}
        {lastConnectionTest && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
              lastConnectionTest.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {lastConnectionTest.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <span className="font-bold block">
                {lastConnectionTest.success ? 'API Connection Verified' : 'Gateway Connection Alert'}
              </span>
              <p className="text-[11px] mt-0.5 text-slate-300">{lastConnectionTest.message}</p>
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Timestamp: {new Date(lastConnectionTest.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveProvider} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                API Base URL
              </label>
              <input
                type="text"
                required
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://app.bulksmsug.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Authentication Scheme
              </label>
              <select
                value={authScheme}
                onChange={e => setAuthScheme(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Bearer">Bearer Token (Authorization: Bearer &lt;KEY&gt;)</option>
                <option value="Token">Token Scheme (Authorization: Token &lt;KEY&gt;)</option>
                <option value="Plain">Direct API Key</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Bulk SMS Uganda API Key (BULKSMSUGANDA_API_KEY)
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter your Bulk SMS Uganda secret API key..."
                className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Never exposed to the client. Safely stored in the secure backend environment.
            </p>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={savingProvider}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingProvider ? 'Saving Credentials...' : 'Save Provider Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. General Church & Webhook Parameters */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Church className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">General Church & Security Settings</h3>
            <p className="text-xs text-slate-400">Omega Prayer Mission Church Mbuya, Uganda</p>
          </div>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Organisation / Church Name
              </label>
              <input
                type="text"
                required
                value={churchName}
                onChange={e => setChurchName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Authorised Administrator Email
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Country Code
              </label>
              <input
                type="text"
                required
                value={defaultCountryCode}
                onChange={e => setDefaultCountryCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Timezone
              </label>
              <input
                type="text"
                required
                value={defaultTimezone}
                onChange={e => setDefaultTimezone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Low Credit Alert Threshold
              </label>
              <input
                type="number"
                min={0}
                required
                value={lowCreditThreshold}
                onChange={e => setLowCreditThreshold(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Google Webhook Secret Token (CHURCHSMS_WEBHOOK_SECRET)
            </label>
            <input
              type="text"
              required
              value={webhookSecret}
              onChange={e => setWebhookSecret(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={savingGeneral}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {savingGeneral ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Database Backup & Disaster Recovery */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Disaster Recovery & Database Backup</h3>
            <p className="text-xs text-slate-400">Export or restore full church database records</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Download Full JSON Backup
          </button>

          <input
            type="file"
            ref={restoreFileRef}
            onChange={handleRestoreFile}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => restoreFileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4 text-sky-400" />
            Restore Database from JSON
          </button>
        </div>
      </div>
    </div>
  );
};
