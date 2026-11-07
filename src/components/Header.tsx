import React, { useState } from 'react';
import {
  Menu,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  User,
  ShieldAlert,
  FileSpreadsheet,
  HelpCircle,
  UploadCloud,
  Sparkles,
} from 'lucide-react';
import { NavTab } from './Sidebar.js';
import { AdminInfo, api } from '../services/api.js';
import { useToast } from './Toast.js';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobile: () => void;
  onNavigateTab: (tab: NavTab) => void;
  admin: AdminInfo | null;
  remainingCredits: number | null;
  isApiKeyConfigured: boolean;
  onRefreshData: () => void;
  isRefreshing?: boolean;
  onOpenFormsGuide?: () => void;
  onOpenExcelImport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobile,
  onNavigateTab,
  admin,
  remainingCredits,
  isApiKeyConfigured,
  onRefreshData,
  isRefreshing,
  onOpenFormsGuide,
  onOpenExcelImport,
}) => {
  const toast = useToast();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Executive Dashboard',
      subtitle: 'Real-time overview of members, SMS broadcasts and delivery performance',
    },
    members: {
      title: 'Church Members Directory',
      subtitle: 'Manage church members, Ugandan phone verification, SMS consent & department assignments',
    },
    departments: {
      title: 'Departments & Ministries',
      subtitle: '14 church ministries with many-to-many member allocation and targeted messaging',
    },
    campaigns: {
      title: 'SMS Broadcast & Campaigns',
      subtitle: 'Compose personalized messages, enforce consent rules and queue bulk dispatches',
    },
    history: {
      title: 'SMS Delivery History',
      subtitle: 'Audit trail of all sent messages with live delivery status receipts from Bulk SMS Uganda',
    },
    response_links: {
      title: 'Registration Response Links',
      subtitle: 'Individual Google Form edit response URLs, response routing & live Excel register sync',
    },
    google_sync: {
      title: 'Google Forms & Sheets Sync',
      subtitle: 'Secure webhook integration connecting registration forms directly to the member database',
    },
    credits: {
      title: 'SMS Credits & Usage',
      subtitle: 'Monitor provider balance, track consumption by campaign and estimate message credits',
    },
    reports: {
      title: 'Reports & Analytics',
      subtitle: 'Comprehensive statistics, department distributions and delivery breakdown exports',
    },
    settings: {
      title: 'System & API Settings',
      subtitle: 'Configure Bulk SMS Uganda API credentials, church parameters and security backup',
    },
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match', 'Please ensure the new password and confirmation match.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password too short', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setIsChangingPass(true);
      await api.changePassword(currentPassword, newPassword);
      toast.success('Password updated', 'Your administrator password has been updated securely.');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Password change failed', err.message);
    } finally {
      setIsChangingPass(false);
    }
  };

  const info = titles[currentTab] || { title: 'ChurchSMS Manager', subtitle: '' };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/60 backdrop-blur-2xl border-b border-white/10 px-4 sm:px-6 py-3 transition-all shadow-sm">
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Mobile hamburger & title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobile}
            className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 lg:hidden border border-white/5"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                {info.title}
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate max-w-xl">
              {info.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Actions and Status Pills */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Action: Google Forms Sync Guide */}
          {onOpenFormsGuide && (
            <button
              onClick={onOpenFormsGuide}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold border border-sky-500/30 transition-all shadow-sm active:scale-95"
              title="Step-by-step interactive guide on linking Google Forms"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>Forms Sync Guide</span>
            </button>
          )}

          {/* Quick Action: Excel Import */}
          {onOpenExcelImport && (
            <button
              onClick={onOpenExcelImport}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all shadow-sm active:scale-95"
              title="Import members and contacts from an Excel spreadsheet"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Import Excel</span>
            </button>
          )}

          {/* Refresh button with glass style */}
          <button
            onClick={onRefreshData}
            disabled={isRefreshing}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/10"
            title="Refresh latest data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Bulk SMS Uganda API status pill */}
          <div
            onClick={() => onNavigateTab('settings')}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border transition-all ${
              isApiKeyConfigured
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
            }`}
            title={isApiKeyConfigured ? 'Bulk SMS Uganda API Connected' : 'Configure BULKSMSUGANDA_API_KEY in Settings'}
          >
            {isApiKeyConfigured ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px]">SMS Gateway Ready</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />
                <span className="text-[11px]">Set API Key</span>
              </>
            )}
          </div>

          {/* Credits pill */}
          <div
            onClick={() => onNavigateTab('credits')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold cursor-pointer border transition-all ${
              remainingCredits !== null && remainingCredits <= 50
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'
                : 'bg-slate-800/80 text-slate-200 border-white/10 hover:bg-slate-700/80'
            }`}
            title="Remaining SMS Credits"
          >
            <span className="text-slate-400 font-sans text-[10px] hidden sm:inline uppercase tracking-wider">Credits:</span>
            <span className="text-white text-[11px] sm:text-xs">
              {remainingCredits !== null ? remainingCredits : '—'}
            </span>
          </div>

          {/* Quick CTA to Compose SMS with colorful gradient */}
          <button
            onClick={() => onNavigateTab('campaigns')}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all active:scale-95 border border-white/15"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Broadcast</span>
          </button>

          {/* Admin security button */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/10"
            title="Administrator Security & Password"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900/95 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Administrator Credentials</h3>
                  <p className="text-xs text-slate-400">Update password for {admin?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Current Password / Setup PIN</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password or PIN"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Administrator Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Initial administrator password defaults to <code className="bg-slate-950 px-1 py-0.5 rounded text-white font-mono">OmegaPrayer2025!</code> or setup PIN <code className="bg-slate-950 px-1 py-0.5 rounded text-white font-mono">2025</code>.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  {isChangingPass ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
