import React, { useState, useEffect } from 'react';
import {
  Link2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Filter,
  FileDown,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Info,
  Layers,
  Send,
  Building2,
  FileSpreadsheet,
  HelpCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { api, Member, Department } from '../services/api.js';
import { useToast } from '../components/Toast.js';

interface ResponseLinksViewProps {
  departments: Department[];
  onViewMemberProfile?: (member: Member) => void;
  onRefreshStats: () => void;
}

export const ResponseLinksView: React.FC<ResponseLinksViewProps> = ({
  departments,
  onViewMemberProfile,
  onRefreshStats,
}) => {
  const toast = useToast();

  const [responseLinks, setResponseLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Statistics
  const [availableCount, setAvailableCount] = useState(0);
  const [missingCount, setMissingCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Simulation Modal
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simFirstName, setSimFirstName] = useState('Emmanuel');
  const [simSecondName, setSimSecondName] = useState('Kanyike');
  const [simPhone, setSimPhone] = useState('0776554433');
  const [simEmail, setSimEmail] = useState('emmanuel.kanyike@gmail.com');
  const [simGender, setSimGender] = useState('Male');
  const [simDepts, setSimDepts] = useState('Media and Technical, Choir, Ushering');
  const [simConsent, setSimConsent] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);

  // Selected Member for Profile Drawer/Modal
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  const loadResponseLinks = async () => {
    try {
      setLoading(true);
      const res = await api.getResponseLinks({
        search,
        availability: availabilityFilter === 'all' ? undefined : availabilityFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });

      let list = res.responseLinks || [];
      if (selectedDeptFilter !== 'all') {
        list = list.filter(item => item.departmentIds.includes(selectedDeptFilter));
      }

      setResponseLinks(list);
      setAvailableCount(res.availableCount);
      setMissingCount(res.missingCount);
      setTotalCount(res.total);
    } catch (err: any) {
      toast.error('Failed to load response links', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResponseLinks();
  }, [search, availabilityFilter, statusFilter, selectedDeptFilter]);

  const handleCopy = (url: string, id: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Response link copied', 'The individual Google Form edit response URL is on your clipboard.');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadExcel = () => {
    window.location.href = api.getDownloadExcelUrl();
    toast.success(
      'Downloading Excel Register',
      'Generating Omega_Prayer_Mission_Member_Register.xlsx with all 11 worksheets and clickable hyperlinks.'
    );
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSimulating(true);
      const res = await api.simulateRegistration({
        firstName: simFirstName,
        secondName: simSecondName,
        phone: simPhone,
        email: simEmail,
        gender: simGender,
        departments: simDepts,
        smsConsent: simConsent,
      });

      toast.success(
        'Registration Simulated',
        `Generated response ID: ${res.simulatedResponseId} and routed into selected departments.`
      );
      setShowSimulateModal(false);
      loadResponseLinks();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Simulation failed', err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-400" />
            Registration Response Links
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Omega Prayer Mission Church Mbuya • Individual Google Forms Edit URLs & Department Routing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Test Registration Simulator Button */}
          <button
            onClick={() => setShowSimulateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
            title="Simulate incoming Google Form registration with edit response link"
          >
            <Play className="w-3.5 h-3.5 text-sky-400" />
            Simulate Form Submit
          </button>

          {/* Download 11-Sheet Excel Register */}
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all active:scale-95"
            title="Download Omega_Prayer_Mission_Member_Register.xlsx"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Excel Register (.xlsx)
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-slate-400 text-xs block mb-1">Active Response Links Available</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">{availableCount}</span>
            <span className="text-xs text-slate-400">members with direct edit URLs</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Clickable in Excel & dashboard</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-slate-400 text-xs block mb-1">Missing Response Links</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400 font-mono">{missingCount}</span>
            <span className="text-xs text-slate-400">manual or legacy entries</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Enable "Allow response editing" in Google Forms</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <span className="text-slate-400 text-xs block mb-1">Department Routing Distribution</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{departments.length}</span>
            <span className="text-xs text-slate-400">active ministries receiving members</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Multi-department allocation enabled</p>
        </div>
      </div>

      {/* Instructions on Google Forms Setting */}
      <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-900/50 text-xs text-blue-200 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">How to enable individual response editing in Google Forms:</p>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            In your church Google Form, click <strong>Settings &gt; Responses</strong>, and switch <strong className="text-white">"Allow response editing"</strong> to <strong className="text-emerald-400">ON</strong>. When enabled, Google Forms generates a unique, persistent edit URL for each respondent which our Google Apps Script automatically forwards to ChurchSMS Manager on every submission.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search member name, phone, response ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={availabilityFilter}
              onChange={e => setAvailabilityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Link Availability: All Members</option>
              <option value="available">Active Link Available ({availableCount})</option>
              <option value="missing">Response Link Missing ({missingCount})</option>
            </select>
          </div>

          <div>
            <select
              value={selectedDeptFilter}
              onChange={e => setSelectedDeptFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Filter by Department: All</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.memberCount})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadResponseLinks}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Response Links Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Member Name</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">Routed Departments</th>
                <th className="p-3.5">Submission Date</th>
                <th className="p-3.5">Response Link Status</th>
                <th className="p-3.5">Individual Response URL</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                    Loading registration response links...
                  </td>
                </tr>
              ) : responseLinks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <Link2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-medium text-slate-400">No member response links match your filter.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      New Google Form registrations will appear here automatically with their individual edit links.
                    </p>
                  </td>
                </tr>
              ) : (
                responseLinks.map(item => (
                  <tr key={item.memberId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <span className="font-bold text-white block">{item.fullName}</span>
                      {item.googleResponseId && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {item.googleResponseId.substring(0, 18)}...
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 font-mono text-slate-300">
                      {item.phone}
                    </td>

                    {/* Department chips */}
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {item.departmentNames.length === 0 ? (
                          <span className="text-slate-500 italic text-[11px]">None</span>
                        ) : (
                          item.departmentNames.map((dName: string, i: number) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 font-medium"
                            >
                              {dName}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                      {new Date(item.googleSubmittedAt).toLocaleDateString()}
                    </td>

                    {/* Status badge */}
                    <td className="p-3.5">
                      {item.hasEditLink ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Link Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium text-[11px]">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Unavailable
                        </span>
                      )}
                    </td>

                    {/* URL cell */}
                    <td className="p-3.5 max-w-xs truncate font-mono text-[11px]">
                      {item.hasEditLink ? (
                        <a
                          href={item.googleEditResponseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 truncate"
                        >
                          <span className="truncate">{item.googleEditResponseUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-600 italic">No edit response URL</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.hasEditLink && (
                          <>
                            <a
                              href={item.googleEditResponseUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Open Original Google Form Response"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleCopy(item.googleEditResponseUrl, item.memberId)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Copy Edit Response URL"
                            >
                              {copiedId === item.memberId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedMember(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Profile Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Details Drawer/Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white">{selectedMember.fullName}</h3>
                <p className="text-xs text-slate-400">Google Form Registration Details</p>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Member ID:</span>
                <span className="font-mono text-white">{selectedMember.memberId}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-mono text-emerald-400 font-bold">{selectedMember.phone}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Google Response ID:</span>
                <span className="font-mono text-white">{selectedMember.googleResponseId || 'N/A'}</span>
              </div>

              {selectedMember.hasEditLink && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block">Individual Edit Response URL:</span>
                  <a
                    href={selectedMember.googleEditResponseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline break-all block font-mono text-[11px]"
                  >
                    {selectedMember.googleEditResponseUrl}
                  </a>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-slate-400 block">Allocated Church Departments:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedMember.departmentNames.map((dName: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-700/40 font-semibold"
                    >
                      {dName}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between text-slate-400 text-[11px] pt-2">
                <span>Submitted: {new Date(selectedMember.googleSubmittedAt).toLocaleString()}</span>
                <span>Last Synced: {new Date(selectedMember.lastSyncedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
              >
                Close
              </button>
              {selectedMember.hasEditLink && (
                <a
                  href={selectedMember.googleEditResponseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Google Forms
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simulation Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Simulate Google Form Submission</h3>
                  <p className="text-xs text-slate-400">Test end-to-end routing with response ID & edit URL</p>
                </div>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={simFirstName}
                    onChange={e => setSimFirstName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Second Name</label>
                  <input
                    type="text"
                    value={simSecondName}
                    onChange={e => setSimSecondName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ugandan Phone Number</label>
                <input
                  type="text"
                  required
                  value={simPhone}
                  onChange={e => setSimPhone(e.target.value)}
                  placeholder="0712345678"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Selected Ministries (Comma separated)</label>
                <input
                  type="text"
                  value={simDepts}
                  onChange={e => setSimDepts(e.target.value)}
                  placeholder="Media and Technical, Choir, Mighty Youth"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-200 block">Automated Simulation will:</span>
                <p>1. Generate a real Google Forms response token (`2_ABaOnue...`).</p>
                <p>2. Create/update member and route into all selected ministries.</p>
                <p>3. Generate clickable hyperlinks across all 11 worksheets in `Omega_Prayer_Mission_Member_Register.xlsx`.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  {isSimulating ? 'Simulating...' : 'Dispatch Simulated Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
