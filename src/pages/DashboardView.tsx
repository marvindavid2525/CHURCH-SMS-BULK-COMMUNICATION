import React from 'react';
import {
  Users,
  Send,
  CheckCircle2,
  Clock,
  AlertOctagon,
  Building2,
  Coins,
  ShieldCheck,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  ArrowUpRight,
  UserCheck,
  UserX,
  PhoneCall,
  Activity,
  Layers,
  Link2,
  FileDown,
  AlertTriangle,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { DashboardStats, api } from '../services/api.js';
import { NavTab } from '../components/Sidebar.js';

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigateTab: (tab: NavTab) => void;
  onRefresh: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  loading,
  onNavigateTab,
  onRefresh,
}) => {
  if (loading && !stats) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-sm">Loading church metrics from database...</p>
      </div>
    );
  }

  const members = stats?.members || { total: 0, active: 0, consented: 0, nonConsented: 0, invalidPhone: 0 };
  const sms = stats?.sms || {
    totalCampaigns: 0,
    totalSubmitted: 0,
    delivered: 0,
    pending: 0,
    failed: 0,
    deliveryRate: 100,
    creditsConsumed: 0,
    remainingCredits: null,
    lowCreditWarning: false,
  };
  const departments = stats?.departments?.distribution || [];
  const recentMembers = stats?.recent?.members || [];
  const recentCampaigns = stats?.recent?.campaigns || [];
  const recentTransactions = stats?.recent?.transactions || [];

  const regSync = stats?.registrationSync || {
    totalReceived: members.total,
    totalActiveMembers: members.active,
    totalDepartmentAssignments: stats?.departments?.totalAssignments || 0,
    registrationsSynced: members.active,
    registrationsAwaiting: 0,
    missingResponseLinks: 0,
    failedRegistrationsCount: 0,
    latestExcelGeneratedAt: null,
    lastSuccessfulGoogleSync: null,
    isGoogleSheetsConnected: true,
    isBulkSMSConnected: false,
  };

  const handleDownloadExcel = () => {
    window.location.href = api.getDownloadExcelUrl();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Low credit alert if applicable */}
      {sms.lowCreditWarning && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-amber-200 text-sm">Low SMS Credit Balance Warning</h4>
              <p className="text-xs text-amber-300/80">
                Current provider credit balance is {sms.remainingCredits} credits. Please top up on Bulk SMS Uganda to prevent broadcast disruptions.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('credits')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition-all shadow-md"
          >
            Manage Credits
          </button>
        </div>
      )}

      {/* Integration Connection Status & Quick Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-white text-base">Omega Prayer Mission Church Mbuya</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
              Administrative Control Hub
            </span>
          </div>
          {/* Integration Status Badges */}
          <div className="flex items-center gap-3 flex-wrap pt-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${regSync.isGoogleSheetsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-400">Google Registration Sync:</span>
              <span className={`font-semibold ${regSync.isGoogleSheetsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {regSync.isGoogleSheetsConnected ? 'Connected (Automated)' : 'Standby'}
              </span>
            </div>
            <span className="text-slate-700">•</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${regSync.isBulkSMSConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-slate-400">Bulk SMS Uganda Gateway:</span>
              <span className={`font-semibold ${regSync.isBulkSMSConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
                {regSync.isBulkSMSConnected ? 'Online & Authenticated' : 'Key Configured'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateTab('campaigns')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
            New SMS Broadcast
          </button>
          <button
            onClick={() => onNavigateTab('response_links')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-sky-400 text-xs font-semibold border border-slate-700 transition-all"
            title="View Google Form individual edit response links"
          >
            <Link2 className="w-4 h-4" />
            Response Links
          </button>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all"
            title="Download Omega_Prayer_Mission_Member_Register.xlsx (11 worksheets with clickable hyperlinks)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel Register
          </button>
          <button
            onClick={() => onNavigateTab('google_sync')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            Sync Setup
          </button>
        </div>
      </div>

      {/* Google Registration Routing & Excel Synchronisation Hub (9 Key Indicators) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Automated Google Registration, Routing & Excel Status</h3>
              <p className="text-xs text-slate-400">Live indicators across Google Forms, Department Allocation & 11-Sheet Excel Workbook</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('response_links')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              Response Links Registry
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 9 Specific Key Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Indicator 1: Total Registrations Received */}
          <div
            onClick={() => onNavigateTab('response_links')}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
          >
            <span className="text-[11px] text-slate-400 block font-medium">1. Total Received</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-extrabold text-white font-mono group-hover:text-blue-400 transition-colors">
                {regSync.totalReceived}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Google Form entries</p>
          </div>

          {/* Indicator 2: Total Active Members */}
          <div
            onClick={() => onNavigateTab('members')}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
          >
            <span className="text-[11px] text-slate-400 block font-medium">2. Active Members</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {regSync.totalActiveMembers}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Omega Prayer register</p>
          </div>

          {/* Indicator 3: Total Department Assignments */}
          <div
            onClick={() => onNavigateTab('departments')}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
          >
            <span className="text-[11px] text-slate-400 block font-medium">3. Dept Assignments</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-extrabold text-indigo-400 font-mono">
                {regSync.totalDepartmentAssignments}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Multi-dept allocations</p>
          </div>

          {/* Indicator 4: Registrations Synchronised Successfully */}
          <div
            onClick={() => onNavigateTab('google_sync')}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
          >
            <span className="text-[11px] text-slate-400 block font-medium">4. Synced Successfully</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {regSync.registrationsSynced}
              </span>
            </div>
            <p className="text-[10px] text-emerald-500/80 mt-1">In sync with database</p>
          </div>

          {/* Indicator 5: Registrations Awaiting Synchronisation */}
          <div
            onClick={() => onNavigateTab('google_sync')}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
          >
            <span className="text-[11px] text-slate-400 block font-medium">5. Awaiting Sync</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-extrabold text-sky-400 font-mono">
                {regSync.registrationsAwaiting}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Pending batch pass</p>
          </div>

          {/* Indicator 6: Missing Response Links */}
          <div
            onClick={() => onNavigateTab('response_links')}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
          >
            <span className="text-[11px] text-slate-400 block font-medium">6. Missing Edit Links</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-extrabold text-amber-400 font-mono">
                {regSync.missingResponseLinks}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Allow edit response ON</p>
          </div>

          {/* Indicator 7: Failed Registrations */}
          <div
            onClick={() => onNavigateTab('google_sync')}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
          >
            <span className="text-[11px] text-slate-400 block font-medium">7. Failed Records</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl font-extrabold font-mono ${regSync.failedRegistrationsCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                {regSync.failedRegistrationsCount}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {regSync.failedRegistrationsCount > 0 ? 'Needs retry queue' : 'Clean (No errors)'}
            </p>
          </div>

          {/* Indicator 8: Latest Excel Generation Time */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 lg:col-span-2">
            <span className="text-[11px] text-slate-400 block font-medium">8. Latest Excel Generation Time</span>
            <p className="text-xs font-mono text-white font-bold mt-1.5 truncate">
              {regSync.latestExcelGeneratedAt
                ? new Date(regSync.latestExcelGeneratedAt).toLocaleString('en-UG', {
                    timeZone: 'Africa/Kampala',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) + ' EAT'
                : 'Generated on sync / download'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 truncate">
              Omega_Prayer_Mission_Member_Register.xlsx
            </p>
          </div>

          {/* Indicator 9: Last Successful Google Sheets Sync */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 sm:col-span-3 lg:col-span-1">
            <span className="text-[11px] text-slate-400 block font-medium">9. Last Google Sync</span>
            <p className="text-xs font-mono text-emerald-400 font-bold mt-1.5 truncate">
              {regSync.lastSuccessfulGoogleSync
                ? new Date(regSync.lastSuccessfulGoogleSync).toLocaleTimeString('en-UG', {
                    timeZone: 'Africa/Kampala',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }) + ' EAT'
                : 'Listening via Webhook'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 truncate">Real-time webhook active</p>
          </div>
        </div>
      </div>

      {/* Primary KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div
          onClick={() => onNavigateTab('members')}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition-all duration-150 shadow-md group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Registered Members</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">{members.total}</span>
            <span className="text-xs text-emerald-400 font-medium">
              {members.active} Active
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>SMS Consented: <strong className="text-emerald-400">{members.consented}</strong></span>
            <span>Non-consented: <strong className="text-amber-400">{members.nonConsented}</strong></span>
          </div>
        </div>

        {/* SMS Broadcasts */}
        <div
          onClick={() => onNavigateTab('campaigns')}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition-all duration-150 shadow-md group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">SMS Broadcast Campaigns</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">{sms.totalCampaigns}</span>
            <span className="text-xs text-slate-400">Total Campaigns</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Submitted Messages:</span>
            <strong className="text-white font-mono">{sms.totalSubmitted}</strong>
          </div>
        </div>

        {/* Delivery Performance */}
        <div
          onClick={() => onNavigateTab('history')}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition-all duration-150 shadow-md group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Confirmed Delivery Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">{sms.deliveryRate}%</span>
            <span className="text-xs text-slate-400">Success Rate</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Delivered: <strong className="text-emerald-400">{sms.delivered}</strong></span>
            <span>Failed: <strong className="text-rose-400">{sms.failed}</strong></span>
          </div>
        </div>

        {/* SMS Credits */}
        <div
          onClick={() => onNavigateTab('credits')}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition-all duration-150 shadow-md group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">SMS Gateway Balance</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {sms.remainingCredits !== null ? sms.remainingCredits : '—'}
            </span>
            <span className="text-xs text-slate-400">Available Credits</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Credits Consumed:</span>
            <strong className="text-blue-400 font-mono">{sms.creditsConsumed}</strong>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Department Distribution & Recent Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Departments Distribution */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-sm text-white">Department & Ministry Membership</h3>
            </div>
            <button
              onClick={() => onNavigateTab('departments')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              View All 14 Departments
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {departments.map(dept => {
              const maxMembers = Math.max(1, ...departments.map(d => d.totalMembers));
              const pct = Math.round((dept.totalMembers / maxMembers) * 100);

              return (
                <div
                  key={dept.id}
                  onClick={() => onNavigateTab('departments')}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-200 truncate pr-2">{dept.name}</span>
                    <span className="font-mono text-slate-400 shrink-0 font-bold">
                      {dept.totalMembers} members
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <span>SMS Consented: <strong className="text-emerald-400">{dept.consentedMembers}</strong></span>
                    <span>{Math.round((dept.consentedMembers / Math.max(1, dept.totalMembers)) * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Recent SMS Broadcasts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Recent Campaigns</h3>
              </div>
              <button
                onClick={() => onNavigateTab('campaigns')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                All
              </button>
            </div>

            {recentCampaigns.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No campaigns dispatched yet. Click "New SMS Broadcast" to send your first message.
              </div>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.slice(0, 4).map(c => {
                  let statusColor = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (c.status === 'completed') statusColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                  else if (c.status === 'sending') statusColor = 'bg-blue-500/10 text-blue-300 border-blue-500/30 animate-pulse';
                  else if (c.status === 'pending_approval') statusColor = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
                  else if (c.status === 'failed') statusColor = 'bg-rose-500/10 text-rose-300 border-rose-500/30';

                  return (
                    <div
                      key={c.id}
                      onClick={() => onNavigateTab('campaigns')}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-white truncate max-w-[170px]">{c.name}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${statusColor}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{c.message}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                        <span>Recipients: {c.recipientCount}</span>
                        <span>Credits: {c.actualCredits || c.estimatedCredits}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('campaigns')}
            className="w-full mt-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 text-center transition-colors"
          >
            Create New Broadcast Campaign
          </button>
        </div>
      </div>

      {/* Two Column Layout: Recent Registrations & Live SMS Delivery Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Registered Members */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Recently Registered Members</h3>
            </div>
            <button
              onClick={() => onNavigateTab('members')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              Directory
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentMembers.map(m => (
              <div
                key={m.id}
                onClick={() => onNavigateTab('members')}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/20">
                    {m.firstName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{m.fullName}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{m.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.smsConsent ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Consent Yes
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                      No Consent
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    {new Date(m.registrationDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live SMS Gateway Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold text-sm text-white">Live SMS Gateway Stream</h3>
            </div>
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              Full History
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No SMS activity recorded yet. Outgoing SMS messages and provider delivery receipts will appear here in real time.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentTransactions.slice(0, 5).map(tx => {
                let badge = 'bg-slate-800 text-slate-300';
                if (tx.status === 'Success') badge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                else if (tx.status === 'Sent' || tx.status === 'Submitted') badge = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                else if (tx.status === 'Failed' || tx.status === 'Rejected') badge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                return (
                  <div
                    key={tx.id}
                    onClick={() => onNavigateTab('history')}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-bold text-white truncate">{tx.recipientName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({tx.recipientPhone})</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${badge}`}>
                        {tx.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{tx.messageContent}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                      <span>{new Date(tx.sentAt).toLocaleTimeString()}</span>
                      <span>Credits: {tx.calculatedCredits}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
