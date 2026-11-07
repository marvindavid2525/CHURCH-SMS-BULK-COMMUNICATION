/**
 * ChurchSMS Manager
 * Omega Prayer Mission Church Mbuya, Uganda
 *
 * @license Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider, useToast } from './components/Toast.js';
import { Sidebar, NavTab } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { LoginView } from './pages/LoginView.js';
import { DashboardView } from './pages/DashboardView.js';
import { MembersView } from './pages/MembersView.js';
import { DepartmentsView } from './pages/DepartmentsView.js';
import { CampaignsView } from './pages/CampaignsView.js';
import { SMSHistoryView } from './pages/SMSHistoryView.js';
import { GoogleSyncView } from './pages/GoogleSyncView.js';
import { ResponseLinksView } from './pages/ResponseLinksView.js';
import { CreditsView } from './pages/CreditsView.js';
import { ReportsView } from './pages/ReportsView.js';
import { SettingsView } from './pages/SettingsView.js';
import { AdminInfo, Department, Member, DashboardStats, api } from './services/api.js';
import { ExcelImportModal } from './components/ExcelImportModal.js';
import { GoogleFormsGuideModal } from './components/GoogleFormsGuideModal.js';

function MainApp() {
  const toast = useToast();

  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Navigation
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Global cached data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('churchsms_sec_9934812398');

  // Modals for Google Forms guide and Excel import
  const [showFormsGuide, setShowFormsGuide] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);

  // Pre-selected shortcuts for SMS Composer
  const [composerDeptId, setComposerDeptId] = useState<string | undefined>(undefined);
  const [composerMember, setComposerMember] = useState<Member | null>(null);

  // Check auth session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = api.getToken();
        if (token) {
          const res = await api.getCurrentAdmin();
          setAdmin(res.admin);
        } else {
          // If no token, test if we have admin session or show login
          setAdmin(null);
        }
      } catch (err) {
        setAdmin(null);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkSession();

    const handleAuthExpired = () => {
      setAdmin(null);
      toast.warning('Session expired', 'Please sign in to continue.');
    };

    window.addEventListener('auth_expired', handleAuthExpired);
    return () => window.removeEventListener('auth_expired', handleAuthExpired);
  }, [toast]);

  // Load global data (departments, dashboard stats, settings)
  const refreshGlobalData = useCallback(async () => {
    if (!admin) return;
    try {
      setIsRefreshing(true);
      const [deptRes, statsRes, settingsRes] = await Promise.all([
        api.getDepartments(),
        api.getDashboardStats(),
        api.getSettings(),
      ]);
      setDepartments(deptRes.departments);
      setStats(statsRes);
      setIsApiKeyConfigured(settingsRes.providerSettings?.isApiKeyConfigured || false);
      if (settingsRes.generalSettings?.webhookSecret) {
        setWebhookSecret(settingsRes.generalSettings.webhookSecret);
      }
    } catch (err: any) {
      console.error('Failed to refresh data', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [admin]);

  useEffect(() => {
    if (admin) {
      refreshGlobalData();
    }
  }, [admin, refreshGlobalData]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      api.setToken(null);
    }
    setAdmin(null);
    toast.info('Signed out', 'You have been safely logged out.');
  };

  const handleSendToMember = (member: Member) => {
    setComposerMember(member);
    setComposerDeptId(undefined);
    setCurrentTab('campaigns');
  };

  const handleSendToDepartment = (deptId: string) => {
    setComposerDeptId(deptId);
    setComposerMember(null);
    setCurrentTab('campaigns');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Initializing ChurchSMS Manager...</p>
        <p className="text-xs text-slate-500 mt-1">Omega Prayer Mission Church Mbuya, Uganda</p>
      </div>
    );
  }

  // If unauthenticated, show Administrator Login
  if (!admin) {
    return (
      <LoginView
        onLoginSuccess={adminData => {
          setAdmin(adminData);
          toast.success('Welcome back', `Signed in as ${adminData.name}`);
        }}
      />
    );
  }

  const remainingCredits = stats?.sms?.remainingCredits ?? null;

  const webhookUrl = `${window.location.origin}/api/google-sheets/webhook`;

  return (
    <div className="relative min-h-screen bg-[#070b16] text-slate-100 flex flex-col lg:flex-row antialiased selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Ambient Colorful Lucid Glass Glowing Mesh Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/4 -right-32 w-[480px] h-[480px] bg-sky-500/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/4 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[150px]" />
        <div className="absolute -bottom-20 right-10 w-[420px] h-[420px] bg-violet-600/12 rounded-full blur-[140px]" />
      </div>

      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={tab => {
          if (tab !== 'campaigns') {
            setComposerDeptId(undefined);
            setComposerMember(null);
          }
          setCurrentTab(tab);
        }}
        admin={admin}
        onLogout={handleLogout}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        remainingCredits={remainingCredits}
      />

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          currentTab={currentTab}
          onOpenMobile={() => setIsMobileOpen(true)}
          onNavigateTab={tab => {
            if (tab !== 'campaigns') {
              setComposerDeptId(undefined);
              setComposerMember(null);
            }
            setCurrentTab(tab);
          }}
          admin={admin}
          remainingCredits={remainingCredits}
          isApiKeyConfigured={isApiKeyConfigured}
          onRefreshData={refreshGlobalData}
          isRefreshing={isRefreshing}
          onOpenFormsGuide={() => setShowFormsGuide(true)}
          onOpenExcelImport={() => setShowExcelImport(true)}
        />

        <main className="flex-1 pb-12">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              loading={isRefreshing}
              onNavigateTab={tab => {
                if (tab !== 'campaigns') {
                  setComposerDeptId(undefined);
                  setComposerMember(null);
                }
                setCurrentTab(tab);
              }}
              onRefresh={refreshGlobalData}
            />
          )}

          {currentTab === 'members' && (
            <MembersView
              departments={departments}
              onOpenSendToMember={handleSendToMember}
              onRefreshStats={refreshGlobalData}
            />
          )}

          {currentTab === 'departments' && (
            <DepartmentsView
              departments={departments}
              onRefresh={refreshGlobalData}
              onSendToDepartment={handleSendToDepartment}
            />
          )}

          {currentTab === 'campaigns' && (
            <CampaignsView
              departments={departments}
              preselectedDeptId={composerDeptId}
              preselectedMember={composerMember}
              onRefreshStats={refreshGlobalData}
              remainingCredits={remainingCredits}
            />
          )}

          {currentTab === 'history' && <SMSHistoryView />}

          {currentTab === 'google_sync' && <GoogleSyncView />}

          {currentTab === 'response_links' && (
            <ResponseLinksView
              departments={departments}
              onRefreshStats={refreshGlobalData}
              onViewMemberProfile={handleSendToMember}
            />
          )}

          {currentTab === 'credits' && (
            <CreditsView stats={stats} onRefreshStats={refreshGlobalData} />
          )}

          {currentTab === 'reports' && <ReportsView stats={stats} />}

          {currentTab === 'settings' && (
            <SettingsView onRefreshStats={refreshGlobalData} />
          )}
        </main>
      </div>

      {/* Global Interactive Google Forms Guide Modal */}
      <GoogleFormsGuideModal
        isOpen={showFormsGuide}
        onClose={() => setShowFormsGuide(false)}
        webhookUrl={webhookUrl}
        webhookSecret={webhookSecret}
      />

      {/* Global Excel Contacts & Details Import Modal */}
      <ExcelImportModal
        isOpen={showExcelImport}
        onClose={() => setShowExcelImport(false)}
        departments={departments}
        onImportComplete={() => {
          refreshGlobalData();
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
