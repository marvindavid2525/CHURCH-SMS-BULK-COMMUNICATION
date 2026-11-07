import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Users,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  XCircle,
  Eye,
  RefreshCw,
  Sparkles,
  PhoneCall,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Campaign, Department, Member, api } from '../services/api.js';
import { useToast } from '../components/Toast.js';

interface CampaignsViewProps {
  departments: Department[];
  preselectedDeptId?: string;
  preselectedMember?: Member | null;
  onRefreshStats: () => void;
  remainingCredits: number | null;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  departments,
  preselectedDeptId,
  preselectedMember,
  onRefreshStats,
  remainingCredits,
}) => {
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeSubTab, setActiveSubTab] = useState<'compose' | 'campaigns'>(
    preselectedDeptId || preselectedMember ? 'compose' : 'compose'
  );

  // Form State
  const [campaignName, setCampaignName] = useState(
    preselectedMember
      ? `Direct SMS to ${preselectedMember.fullName}`
      : `Sunday Service Announcement - ${new Date().toLocaleDateString()}`
  );
  const [recipientType, setRecipientType] = useState<'all_eligible' | 'departments' | 'selected_members' | 'custom'>(
    preselectedDeptId ? 'departments' : preselectedMember ? 'selected_members' : 'all_eligible'
  );
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>(
    preselectedDeptId ? [preselectedDeptId] : []
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    preselectedMember ? [preselectedMember.id] : []
  );
  const [message, setMessage] = useState(
    'Hello {first_name}, Omega Prayer Mission Church Mbuya invites you to our fellowship and Sunday service. We look forward to worshiping with you!'
  );

  // Recipient preview data
  const [previewData, setPreviewData] = useState<{
    recipientCount: number;
    duplicatesExcluded: number;
    segmentsPerRecipient: number;
    estimatedTotalCredits: number;
    isUnicode: boolean;
    samplePreviews: { memberId: string; fullName: string; phone: string; personalizedText: string }[];
    recipients: { id: string; fullName: string; phone: string; departments: string[] }[];
  } | null>(null);

  // Test SMS Modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('0701234567');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Campaign List
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Members list for picker
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Update when preselected changes
  useEffect(() => {
    if (preselectedDeptId) {
      setRecipientType('departments');
      setSelectedDeptIds([preselectedDeptId]);
      setActiveSubTab('compose');
    }
  }, [preselectedDeptId]);

  useEffect(() => {
    if (preselectedMember) {
      setRecipientType('selected_members');
      setSelectedMemberIds([preselectedMember.id]);
      setCampaignName(`Direct SMS to ${preselectedMember.fullName}`);
      setActiveSubTab('compose');
    }
  }, [preselectedMember]);

  // Load members for manual picker
  useEffect(() => {
    api.getMembers({ status: 'active', smsConsent: 'true' }).then(res => {
      setAllMembers(res.members);
    });
  }, []);

  // Load campaigns
  const loadCampaigns = async (silent = false) => {
    try {
      if (!silent) setLoadingCampaigns(true);
      const res = await api.getCampaigns();
      setCampaigns(res.campaigns || []);
    } catch (err: any) {
      console.error('Failed to load campaigns', err);
      if (!silent) {
        toast.error('Failed to load campaigns', err.message);
      }
    } finally {
      if (!silent) setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(() => loadCampaigns(true), 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live recipient preview
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await api.previewRecipients({
          recipientType,
          targetDepartmentIds: selectedDeptIds,
          targetMemberIds: selectedMemberIds,
          message,
        });
        setPreviewData(res);
      } catch (e) {
        console.error('Preview error', e);
      }
    };
    fetchPreview();
  }, [recipientType, selectedDeptIds, selectedMemberIds, message]);

  // Insert personalization variable
  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const updated = message.substring(0, start) + variable + message.substring(end);
    setMessage(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + variable.length;
        textareaRef.current.focus();
      }
    }, 10);
  };

  // Send Test SMS
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;

    try {
      setIsSendingTest(true);
      // Personalize sample test
      const sample = message
        .replace(/\{first_name\}/gi, 'Marvin')
        .replace(/\{full_name\}/gi, 'Marvin Mulindwa')
        .replace(/\{department\}/gi, 'Media and Technical');

      const res = await api.sendTestSMS(testPhone, sample);
      if (res.success) {
        toast.success('Test SMS dispatched', `Message submitted to Bulk SMS Uganda for ${testPhone}.`);
        setShowTestModal(false);
      } else {
        toast.error('Test SMS failed', res.providerResult?.message || 'Gateway rejected message');
      }
      onRefreshStats();
    } catch (err: any) {
      toast.error('Test SMS failed', err.message);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Launch Campaign
  const handleLaunchCampaign = async () => {
    if (!previewData || previewData.recipientCount === 0) {
      toast.error('No recipients', 'There are no active, consenting members matching your selection.');
      return;
    }

    try {
      setIsDispatching(true);
      // 1. Create campaign
      const campRes = await api.createCampaign({
        name: campaignName.trim(),
        message: message.trim(),
        recipientType,
        targetDepartmentIds: selectedDeptIds,
        targetMemberIds: selectedMemberIds,
        submitForApproval: false,
      });

      // 2. Dispatch
      await api.dispatchCampaign(campRes.campaign.id);

      toast.success(
        'Campaign dispatched!',
        `Broadcast "${campaignName}" initiated for ${previewData.recipientCount} members.`
      );
      setShowConfirmModal(false);
      setActiveSubTab('campaigns');
      loadCampaigns();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Campaign dispatch failed', err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  // Cancel Campaign
  const handleCancelCampaign = async (id: string) => {
    if (!window.confirm('Cancel this campaign broadcast?')) return;
    try {
      await api.cancelCampaign(id);
      toast.info('Campaign cancelled');
      loadCampaigns();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Cancel failed', err.message);
    }
  };

  // Approve & Dispatch pending campaign
  const handleApprovePending = async (id: string) => {
    try {
      await api.dispatchCampaign(id);
      toast.success('Campaign approved and dispatched');
      loadCampaigns();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Dispatch failed', err.message);
    }
  };

  const charCount = message.length;
  const isUnicode = previewData?.isUnicode || false;
  const maxSingle = isUnicode ? 70 : 160;
  const maxConcat = isUnicode ? 67 : 153;
  const segments = charCount === 0 ? 0 : charCount <= maxSingle ? 1 : Math.ceil(charCount / maxConcat);
  const remainingInSegment = charCount === 0 ? maxSingle : segments === 1 ? maxSingle - charCount : (segments * maxConcat) - charCount;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" />
            SMS Broadcast & Campaigns
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Omega Prayer Mission Church Mbuya • Bulk SMS Uganda Gateway
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setActiveSubTab('compose')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'compose'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Compose Broadcast
          </button>
          <button
            onClick={() => setActiveSubTab('campaigns')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'campaigns'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Campaign History</span>
            {campaigns.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono">
                {campaigns.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeSubTab === 'compose' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Composer Form */}
          <div className="lg:col-span-2 space-y-5">
            {/* Campaign Name */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Broadcast / Campaign Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g. Sunday Service Reminder, Youth Fellowship Meeting"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Recipient Targeting Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Target Recipients
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* All Eligible */}
                  <div
                    onClick={() => setRecipientType('all_eligible')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      recipientType === 'all_eligible'
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow-md ring-1 ring-blue-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-white">All Consenting</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Entire church database with verified SMS consent
                    </p>
                  </div>

                  {/* Specific Departments */}
                  <div
                    onClick={() => setRecipientType('departments')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      recipientType === 'departments'
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow-md ring-1 ring-blue-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white">By Department</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Target 1 or multiple church ministries
                    </p>
                  </div>

                  {/* Selected Members */}
                  <div
                    onClick={() => setRecipientType('selected_members')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      recipientType === 'selected_members'
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow-md ring-1 ring-blue-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">Specific Members</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Pick individual leaders or specific recipients
                    </p>
                  </div>
                </div>

                {/* Sub-selectors */}
                {recipientType === 'departments' && (
                  <div className="mt-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Select Departments (Multi-select supported):</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDeptIds.length === departments.length) {
                            setSelectedDeptIds([]);
                          } else {
                            setSelectedDeptIds(departments.map(d => d.id));
                          }
                        }}
                        className="text-[11px] text-blue-400 hover:underline"
                      >
                        {selectedDeptIds.length === departments.length ? 'Deselect All' : 'Select All 14'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                      {departments.map(dept => {
                        const isChecked = selectedDeptIds.includes(dept.id);
                        return (
                          <label
                            key={dept.id}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                              isChecked ? 'bg-blue-950/60 text-blue-200 border border-blue-800/40' : 'text-slate-300 hover:bg-slate-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedDeptIds(selectedDeptIds.filter(id => id !== dept.id));
                                } else {
                                  setSelectedDeptIds([...selectedDeptIds, dept.id]);
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                            />
                            <span className="truncate">{dept.name}</span>
                            <span className="text-[10px] text-slate-500 ml-auto font-mono">
                              ({dept.consentedCount} eligible)
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recipientType === 'selected_members' && (
                  <div className="mt-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search member name or phone to add..."
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                    <div className="max-h-44 overflow-y-auto space-y-1">
                      {allMembers
                        .filter(m =>
                          m.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
                          m.phone.includes(memberSearch)
                        )
                        .slice(0, 30)
                        .map(m => {
                          const isChecked = selectedMemberIds.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer ${
                                isChecked ? 'bg-blue-950/60 text-blue-200 border border-blue-800/40' : 'text-slate-300 hover:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedMemberIds(selectedMemberIds.filter(id => id !== m.id));
                                    } else {
                                      setSelectedMemberIds([...selectedMemberIds, m.id]);
                                    }
                                  }}
                                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                                />
                                <span className="font-semibold text-white truncate">{m.fullName}</span>
                                <span className="font-mono text-slate-400 text-[11px]">({m.phone})</span>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Message Composition Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  SMS Message Body <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Insert tag:</span>
                  <button
                    type="button"
                    onClick={() => insertVariable('{first_name}')}
                    className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-mono transition-colors"
                  >
                    {'{first_name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{full_name}')}
                    className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-mono transition-colors"
                  >
                    {'{full_name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{department}')}
                    className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-mono transition-colors"
                  >
                    {'{department}'}
                  </button>
                </div>
              </div>

              <textarea
                ref={textareaRef}
                rows={5}
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your church announcement here..."
                className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
              />

              {/* Character and Segments Counter */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-3 text-slate-400">
                  <span>
                    Characters: <strong className="text-white font-mono">{charCount}</strong>
                  </span>
                  <span>
                    Segments:{' '}
                    <strong className="text-blue-400 font-mono">
                      {segments} credit{segments > 1 ? 's' : ''}/SMS
                    </strong>
                  </span>
                  {isUnicode && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                      Unicode
                    </span>
                  )}
                </div>
                <div className="text-slate-400 text-[11px]">
                  {remainingInSegment} characters left in current segment
                </div>
              </div>

              {/* Quick test button */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowTestModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-sky-400" />
                  Send Test SMS First
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!previewData || previewData.recipientCount === 0 || !message.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Review & Broadcast ({previewData?.recipientCount || 0} Recipients)
                </button>
              </div>
            </div>
          </div>

          {/* Right Col: Summary & Live Preview */}
          <div className="space-y-5">
            {/* Live Recipient & Credits Impact Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Broadcast Summary & Safety
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Total Unique Recipients:</span>
                  <span className="font-bold text-white font-mono text-sm">
                    {previewData?.recipientCount ?? '—'}
                  </span>
                </div>

                {previewData && previewData.duplicatesExcluded > 0 && (
                  <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-900/50 text-[11px] text-blue-300 flex items-center justify-between">
                    <span>Cross-department deduplicated:</span>
                    <strong className="font-mono">{previewData.duplicatesExcluded} numbers</strong>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Estimated Total Credits:</span>
                  <span className="font-bold text-blue-400 font-mono text-sm">
                    {previewData?.estimatedTotalCredits ?? '—'} credits
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Current Provider Balance:</span>
                  <span className="font-bold text-slate-200 font-mono">
                    {remainingCredits !== null ? `${remainingCredits} credits` : 'Unchecked'}
                  </span>
                </div>
              </div>

              {/* Consent compliance note */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Consent Enforcement:</strong> Members who have not explicitly agreed to SMS communications are excluded on the backend.
                </span>
              </div>
            </div>

            {/* Resolved Preview Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                Live Recipient Preview
              </h3>
              <p className="text-[11px] text-slate-400">
                Sample preview as received on a recipient's phone:
              </p>

              {previewData?.samplePreviews?.[0] ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-700/80 shadow-inner relative space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-2">
                    <span className="font-semibold text-slate-300">
                      To: {previewData.samplePreviews[0].fullName}
                    </span>
                    <span className="font-mono">{previewData.samplePreviews[0].phone}</span>
                  </div>
                  <div className="text-xs text-white leading-relaxed whitespace-pre-wrap font-sans">
                    {previewData.samplePreviews[0].personalizedText}
                  </div>
                  <div className="text-[10px] text-slate-500 text-right pt-1 font-mono">
                    Sender: OmegaPrayer
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 text-center text-xs text-slate-500">
                  Select at least one recipient to view live message preview.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Campaigns Sub-tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white">Broadcast Campaign Audit Log</h3>
            <button
              onClick={() => loadCampaigns(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCampaigns ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">Campaign Name</th>
                    <th className="p-3.5">Recipients</th>
                    <th className="p-3.5">Delivery Status</th>
                    <th className="p-3.5">Credits</th>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500">
                        No campaigns recorded yet. Click "Compose Broadcast" to create your first church SMS campaign.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map(c => {
                      let statusBadge = 'bg-slate-800 text-slate-300 border-slate-700';
                      if (c.status === 'completed') statusBadge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                      else if (c.status === 'sending') statusBadge = 'bg-blue-500/10 text-blue-300 border-blue-500/30 animate-pulse';
                      else if (c.status === 'pending_approval') statusBadge = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
                      else if (c.status === 'partially_failed') statusBadge = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
                      else if (c.status === 'failed') statusBadge = 'bg-rose-500/10 text-rose-300 border-rose-500/30';

                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40">
                          <td className="p-3.5">
                            <p className="font-bold text-white text-xs">{c.name}</p>
                            <p className="text-[11px] text-slate-400 line-clamp-1 max-w-sm mt-0.5">
                              {c.message}
                            </p>
                          </td>
                          <td className="p-3.5 font-mono text-slate-200">
                            {c.recipientCount} members
                          </td>
                          <td className="p-3.5">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${statusBadge}`}>
                              {c.status.replace('_', ' ')}
                            </span>
                            {c.status === 'sending' && (
                              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                                <div
                                  className="h-full bg-blue-500 animate-pulse"
                                  style={{
                                    width: `${Math.round(
                                      ((c.successfulCount + c.failedCount) / Math.max(1, c.recipientCount)) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-slate-300">
                            {c.actualCredits || c.estimatedCredits} credits
                          </td>
                          <td className="p-3.5 text-slate-400 text-[11px]">
                            {new Date(c.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.status === 'pending_approval' && (
                                <button
                                  onClick={() => handleApprovePending(c.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]"
                                >
                                  Approve & Send
                                </button>
                              )}
                              {c.status === 'sending' && (
                                <button
                                  onClick={() => handleCancelCampaign(c.id)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-[11px]"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && previewData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Administrator Broadcast Approval</h3>
                  <p className="text-xs text-slate-400">Omega Prayer Mission Church Mbuya</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <p className="text-slate-300">
                You are about to broadcast the following campaign to verified church members:
              </p>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Campaign:</span>
                  <span className="font-bold text-white">{campaignName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Recipients:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {previewData.recipientCount} Members
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Segments per Member:</span>
                  <span className="font-mono text-slate-200">{segments} segment(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Credits to be Consumed:</span>
                  <span className="font-bold text-blue-400 font-mono text-sm">
                    {previewData.estimatedTotalCredits} credits
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-24 overflow-y-auto text-[11px] text-slate-300 italic">
                "{message}"
              </div>

              {remainingCredits !== null && remainingCredits < previewData.estimatedTotalCredits && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    Warning: Current credit balance ({remainingCredits}) is lower than estimated credits ({previewData.estimatedTotalCredits}).
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDispatching}
                onClick={handleLaunchCampaign}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isDispatching ? 'Initiating Dispatch...' : 'Approve & Dispatch SMS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test SMS Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">Send Test SMS</h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTest} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Test Phone Number (Uganda)
                </label>
                <input
                  type="text"
                  required
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="0712345678"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Message Preview</span>
                <p className="line-clamp-3 italic">
                  {message
                    .replace(/\{first_name\}/gi, 'Marvin')
                    .replace(/\{full_name\}/gi, 'Marvin Mulindwa')
                    .replace(/\{department\}/gi, 'Media and Technical')}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  {isSendingTest ? 'Sending...' : 'Send Test SMS Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
