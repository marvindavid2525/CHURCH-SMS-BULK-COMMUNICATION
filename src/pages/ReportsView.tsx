import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileDown,
  PieChart,
  Users,
  Send,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { DashboardStats, api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
  stats: DashboardStats | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ stats }) => {
  const toast = useToast();

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    setLoadingLogs(true);
    api.getAuditLogs(1, 50).then(res => {
      setAuditLogs(res.logs || []);
    }).catch(e => {
      console.error('Audit logs error', e);
    }).finally(() => {
      setLoadingLogs(false);
    });
  }, []);

  const members = stats?.members || { total: 0, active: 0, consented: 0, nonConsented: 0, invalidPhone: 0 };
  const sms = stats?.sms || { totalCampaigns: 0, totalSubmitted: 0, delivered: 0, pending: 0, failed: 0, creditsConsumed: 0 };
  const departments = stats?.departments?.distribution || [];

  // Export full statistical report to Excel
  const handleExportFullReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary KPIs
    const summaryData = [
      { Metric: 'Total Registered Members', Value: members.total },
      { Metric: 'Active Members', Value: members.active },
      { Metric: 'SMS Consented Members', Value: members.consented },
      { Metric: 'Non-Consented Members', Value: members.nonConsented },
      { Metric: 'Invalid Phone Numbers', Value: members.invalidPhone },
      { Metric: 'Total SMS Campaigns', Value: sms.totalCampaigns },
      { Metric: 'Total Messages Submitted', Value: sms.totalSubmitted },
      { Metric: 'Confirmed Delivered (Success)', Value: sms.delivered },
      { Metric: 'Pending Deliveries', Value: sms.pending },
      { Metric: 'Failed / Rejected', Value: sms.failed },
      { Metric: 'Total Credits Consumed', Value: sms.creditsConsumed },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive_Summary');

    // Sheet 2: Department Distribution
    const deptData = departments.map(d => ({
      'Department Name': d.name,
      'Total Members': d.totalMembers,
      'SMS Consented Members': d.consentedMembers,
      'Consent Rate': d.totalMembers > 0 ? `${Math.round((d.consentedMembers / d.totalMembers) * 100)}%` : '0%',
    }));
    const wsDept = XLSX.utils.json_to_sheet(deptData);
    XLSX.utils.book_append_sheet(wb, wsDept, 'Departments');

    XLSX.writeFile(wb, `ChurchSMS_Full_Report_${new Date().toISOString().substring(0, 10)}.xlsx`);
    toast.success('Report exported', 'Executive Excel report downloaded.');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Church Communication Reports & Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Omega Prayer Mission Church Mbuya • Real-time Statistical Analysis
          </p>
        </div>

        <button
          onClick={handleExportFullReport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95 self-start sm:self-auto"
        >
          <FileDown className="w-4 h-4" />
          Export Executive Report (.xlsx)
        </button>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SMS Consent Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            SMS Consent Compliance Distribution
          </h3>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-semibold">SMS Consented (Eligible for Broadcasts)</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {members.consented} ({members.active > 0 ? Math.round((members.consented / members.active) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${members.active > 0 ? (members.consented / members.active) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-semibold">Non-Consenting / Opted Out</span>
                <span className="font-mono text-amber-400 font-bold">
                  {members.nonConsented} ({members.active > 0 ? Math.round((members.nonConsented / members.active) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${members.active > 0 ? (members.nonConsented / members.active) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SMS Delivery Performance Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-400" />
            SMS Delivery Status Breakdown
          </h3>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-center">
              <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-1">Delivered</span>
              <span className="text-2xl font-bold text-white font-mono">{sms.delivered}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Confirmed Success</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-blue-500/30 text-center">
              <span className="text-[10px] text-blue-400 uppercase font-bold block mb-1">Pending</span>
              <span className="text-2xl font-bold text-white font-mono">{sms.pending}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Sent / Buffered</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-rose-500/30 text-center">
              <span className="text-[10px] text-rose-400 uppercase font-bold block mb-1">Failed</span>
              <span className="text-2xl font-bold text-white font-mono">{sms.failed}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Rejected / Error</span>
            </div>
          </div>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-400" />
          Department Breakdown & SMS Outreach Readiness
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Department Name</th>
                <th className="p-3 font-mono">Total Members</th>
                <th className="p-3 font-mono">Consented SMS</th>
                <th className="p-3">Consent Percentage</th>
                <th className="p-3">Readiness Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {departments.map(dept => {
                const pct = dept.totalMembers > 0
                  ? Math.round((dept.consentedMembers / dept.totalMembers) * 100)
                  : 0;

                return (
                  <tr key={dept.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{dept.name}</td>
                    <td className="p-3 font-mono text-slate-300">{dept.totalMembers}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">{dept.consentedMembers}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-400 text-[11px]">{pct}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {dept.consentedMembers > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          Ready for Broadcast
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          No Consented Contacts
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Administrative Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Administrative Audit Trail
          </h3>
          <span className="text-xs text-slate-400 font-mono">Recent 50 Actions</span>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Administrator</th>
                <th className="p-3">Action</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/40">
                  <td className="p-3 text-slate-400 font-mono text-[11px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-semibold text-white truncate max-w-[160px]">
                    {log.adminEmail}
                  </td>
                  <td className="p-3 font-mono text-blue-400 uppercase text-[10px] font-bold">
                    {log.action}
                  </td>
                  <td className="p-3 text-slate-300 max-w-md truncate">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
