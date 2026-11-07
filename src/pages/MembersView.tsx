import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  FileDown,
  FileUp,
  Copy,
  Trash2,
  Edit,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  MoreHorizontal,
  ChevronDown,
  Layers,
  Phone,
  Mail,
  Calendar,
  Building2,
  FileSpreadsheet,
  X,
  Merge,
} from 'lucide-react';
import { Member, Department, api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { exportMembersToExcel, exportMembersToCSV, parseImportFile, downloadSampleImportTemplate } from '../utils/exportImport.js';
import { ExcelImportModal } from '../components/ExcelImportModal.js';

interface MembersViewProps {
  departments: Department[];
  onOpenSendToMember?: (member: Member) => void;
  onRefreshStats: () => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  departments,
  onOpenSendToMember,
  onRefreshStats,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedConsent, setSelectedConsent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [selectedGender, setSelectedGender] = useState('all');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [profileMember, setProfileMember] = useState<Member | null>(null);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<{ phone: string; count: number; members: Member[] }[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRichImportModal, setShowRichImportModal] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Form State for Add / Edit
  const [formFirstName, setFormFirstName] = useState('');
  const [formSecondName, setFormSecondName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formGender, setFormGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [formDeptIds, setFormDeptIds] = useState<string[]>([]);
  const [formSmsConsent, setFormSmsConsent] = useState(true);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive' | 'archived'>('active');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const departmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    departments.forEach(d => {
      map[d.id] = d.name;
    });
    return map;
  }, [departments]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const res = await api.getMembers({
        search,
        departmentId: selectedDept,
        smsConsent: selectedConsent === 'all' ? undefined : selectedConsent,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        gender: selectedGender,
      });
      setMembers(res.members);
    } catch (err: any) {
      toast.error('Failed to load members', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [search, selectedDept, selectedConsent, selectedStatus, selectedGender]);

  const resetForm = () => {
    setFormFirstName('');
    setFormSecondName('');
    setFormPhone('');
    setFormEmail('');
    setFormGender('Male');
    setFormDeptIds([]);
    setFormSmsConsent(true);
    setFormStatus('active');
    setFormNotes('');
    setEditingMember(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setFormFirstName(m.firstName);
    setFormSecondName(m.secondName);
    setFormPhone(m.rawPhone || m.phone);
    setFormEmail(m.email || '');
    setFormGender(m.gender);
    setFormDeptIds(m.departmentIds || []);
    setFormSmsConsent(m.smsConsent);
    setFormStatus(m.status);
    setFormNotes(m.notes || '');
    setShowAddModal(true);
  };

  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim()) {
      toast.error('First name required');
      return;
    }
    if (!formPhone.trim()) {
      toast.error('Phone number required');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<Member> = {
        firstName: formFirstName.trim(),
        secondName: formSecondName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        gender: formGender,
        departmentIds: formDeptIds,
        smsConsent: formSmsConsent,
        status: formStatus,
        notes: formNotes.trim(),
      };

      if (editingMember) {
        await api.updateMember(editingMember.id, payload);
        toast.success('Member updated', `${payload.firstName} ${payload.secondName || ''} updated successfully.`);
      } else {
        await api.createMember(payload);
        toast.success('Member registered', `${payload.firstName} added to church directory.`);
      }

      setShowAddModal(false);
      resetForm();
      loadMembers();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Failed to save member', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (m: Member, hard = false) => {
    const confirmMsg = hard
      ? `Permanently delete ${m.fullName}? This cannot be undone.`
      : `Archive ${m.fullName}? They will be removed from active broadcast lists.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteMember(m.id, hard);
      toast.success(hard ? 'Member permanently removed' : 'Member archived');
      loadMembers();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Operation failed', err.message);
    }
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map(m => m.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkAction = async (action: string, deptId?: string) => {
    if (selectedIds.size === 0) return;
    try {
      await api.bulkMemberAction(Array.from(selectedIds), action, deptId);
      toast.success('Bulk action applied', `Applied to ${selectedIds.size} members.`);
      setSelectedIds(new Set());
      loadMembers();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Bulk action failed', err.message);
    }
  };

  // Check Duplicates
  const handleCheckDuplicates = async () => {
    try {
      const res = await api.checkDuplicates();
      setDuplicateGroups(res.groups);
      setShowDuplicatesModal(true);
    } catch (err: any) {
      toast.error('Failed to check duplicates', err.message);
    }
  };

  const handleMergeDuplicates = async (primaryId: string, dupIds: string[]) => {
    try {
      await api.mergeDuplicates(primaryId, dupIds);
      toast.success('Duplicates safely merged', 'Combined department memberships and preserved consent.');
      // Refresh duplicates list
      const res = await api.checkDuplicates();
      setDuplicateGroups(res.groups);
      loadMembers();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Merge failed', err.message);
    }
  };

  // Import handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseImportFile(file);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast.error('Empty file', 'No rows found in the uploaded file.');
        return;
      }
      setImportRows(parsed);
      setShowImportModal(true);
    } catch (err: any) {
      toast.error('File parsing failed', err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    try {
      setIsImporting(true);
      const res = await api.importMembers(importRows, true);
      toast.success(
        'Import complete',
        `${res.createdCount} new members created, ${res.updatedCount} updated, ${res.skippedCount} skipped.`
      );
      setShowImportModal(false);
      setImportRows([]);
      loadMembers();
      onRefreshStats();
    } catch (err: any) {
      toast.error('Import failed', err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Church Member Directory
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Omega Prayer Mission Church Mbuya • {members.length} members shown
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Check Duplicates Button */}
          <button
            onClick={handleCheckDuplicates}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
            title="Scan for duplicate phone numbers"
          >
            <Merge className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Resolve</span> Duplicates
          </button>

          {/* Excel Import Modal Trigger */}
          <button
            onClick={() => setShowRichImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all shadow-sm active:scale-95"
            title="Import church contacts & member details from Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import Excel</span>
          </button>

          {/* Download Sample Template */}
          <button
            onClick={() => downloadSampleImportTemplate()}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold border border-slate-700 transition-all"
            title="Download blank Excel template pre-formatted with sample columns"
          >
            <FileDown className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Sample</span> Template
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-0.5">
            <button
              onClick={() => exportMembersToExcel(members, departmentMap)}
              className="px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-slate-750 rounded-lg transition-colors flex items-center gap-1"
              title="Export displayed members to Excel (.xlsx)"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => exportMembersToCSV(members, departmentMap)}
              className="px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-750 rounded-lg transition-colors"
              title="Export displayed members to CSV"
            >
              CSV
            </button>
          </div>

          {/* Add Member CTA */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search member name, Ugandan phone, email, notes..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All 14 Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.memberCount})
                </option>
              ))}
            </select>
          </div>

          {/* SMS Consent Filter */}
          <div>
            <select
              value={selectedConsent}
              onChange={e => setSelectedConsent(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">SMS Consent: All</option>
              <option value="true">Consented (Eligible)</option>
              <option value="false">No Consent (Excluded)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="active">Status: Active</option>
              <option value="inactive">Status: Inactive</option>
              <option value="archived">Status: Archived</option>
              <option value="all">Status: All</option>
            </select>
          </div>
        </div>

        {/* Selected Rows Action Toolbar */}
        {selectedIds.size > 0 && (
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs bg-blue-950/20 p-2.5 rounded-xl border border-blue-900/40 animate-in fade-in">
            <span className="font-semibold text-blue-300">
              {selectedIds.size} member{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkAction('grant_consent')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30"
              >
                Grant SMS Consent
              </button>
              <button
                onClick={() => handleBulkAction('revoke_consent')}
                className="px-2.5 py-1 rounded-lg bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30"
              >
                Revoke Consent
              </button>
              <button
                onClick={() => handleBulkAction('activate')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Activate
              </button>
              <button
                onClick={() => handleBulkAction('deactivate')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Deactivate
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2 py-1 text-slate-400 hover:text-white"
              >
                Deselect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={members.length > 0 && selectedIds.size === members.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-3.5">Member Name</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">SMS Consent</th>
                <th className="p-3.5">Departments</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                    Loading member directory...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-medium text-slate-400">No members match your filter criteria.</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting the search or department filter.</p>
                  </td>
                </tr>
              ) : (
                members.map(m => {
                  const isSelected = selectedIds.has(m.id);
                  const isMTN = m.phone.includes('77') || m.phone.includes('78') || m.phone.includes('76');
                  const isAirtel = m.phone.includes('70') || m.phone.includes('75') || m.phone.includes('74');

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-blue-950/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(m.id)}
                          className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Name & Email */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/20">
                            {m.firstName[0]}
                          </div>
                          <div>
                            <p
                              onClick={() => setProfileMember(m)}
                              className="font-bold text-white hover:text-blue-400 cursor-pointer transition-colors"
                            >
                              {m.fullName}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate max-w-[160px]">
                              {m.email || m.gender}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Carrier */}
                      <td className="p-3.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-200 font-semibold">{m.phone}</span>
                          {isMTN && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 font-bold font-sans">
                              MTN
                            </span>
                          )}
                          {isAirtel && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300 border border-rose-500/20 font-bold font-sans">
                              Airtel
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SMS Consent */}
                      <td className="p-3.5">
                        {m.smsConsent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Consented
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium text-[11px]">
                            <XCircle className="w-3 h-3 text-amber-400" />
                            No Consent
                          </span>
                        )}
                      </td>

                      {/* Department Chips */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {m.departmentIds.length === 0 ? (
                            <span className="text-slate-500 italic text-[11px]">None assigned</span>
                          ) : (
                            m.departmentIds.map(dId => (
                              <span
                                key={dId}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 font-medium truncate"
                              >
                                {departmentMap[dId] || dId}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                            m.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : m.status === 'inactive'
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send individual SMS */}
                          <button
                            onClick={() => onOpenSendToMember?.(m)}
                            disabled={!m.smsConsent || m.status !== 'active'}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                            title={
                              !m.smsConsent
                                ? 'Cannot send SMS: Member has not consented'
                                : m.status !== 'active'
                                ? 'Cannot send SMS: Member is inactive'
                                : 'Send Individual SMS'
                            }
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Profile view */}
                          <button
                            onClick={() => setProfileMember(m)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="View Member Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Edit Member Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Archive/Delete */}
                          <button
                            onClick={() => handleDeleteMember(m)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                            title="Archive Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Add / Edit Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingMember ? 'Edit Church Member' : 'Register New Church Member'}
                  </h3>
                  <p className="text-xs text-slate-400">Omega Prayer Mission Church Mbuya</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitMember} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={e => setFormFirstName(e.target.value)}
                    placeholder="e.g. Marvin"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Second Name / Surname
                  </label>
                  <input
                    type="text"
                    value={formSecondName}
                    onChange={e => setFormSecondName(e.target.value)}
                    placeholder="e.g. Mulindwa"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ugandan Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="0712345678 or +256712345678"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Accepts 07..., 256..., +256... formats
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="member@gmail.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Gender</label>
                  <select
                    value={formGender}
                    onChange={e => setFormGender(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Department Multi-Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Church Departments & Ministries (Multiple Allowed)
                </label>
                <div className="p-3 bg-slate-950 border border-slate-700/80 rounded-xl max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {departments.map(dept => {
                    const isChecked = formDeptIds.includes(dept.id);
                    return (
                      <label
                        key={dept.id}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                          isChecked ? 'bg-blue-950 text-blue-200' : 'text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setFormDeptIds(formDeptIds.filter(id => id !== dept.id));
                            } else {
                              setFormDeptIds([...formDeptIds, dept.id]);
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                        />
                        <span className="truncate">{dept.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* SMS Consent Checkbox */}
              <div className="p-3.5 bg-slate-950 border border-emerald-500/30 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSmsConsent}
                    onChange={e => setFormSmsConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Explicit Church SMS Communication Consent
                    </span>
                    <span className="text-[11px] text-slate-400 leading-snug block mt-0.5">
                      Member has consented to receive prayer announcements, service alerts and ministry updates via SMS. Non-consenting members are automatically excluded from bulk dispatches.
                    </span>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Administrative Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="e.g. Joined during 2025 missions week, preferred morning contact..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingMember ? 'Save Changes' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Phone Resolver Modal */}
      {showDuplicatesModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Merge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Duplicate Phone Number Resolver</h3>
                  <p className="text-xs text-slate-400">
                    Safe resolution • Combines departments and archives duplicate profiles
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDuplicatesModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {duplicateGroups.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="font-bold text-white text-sm">No duplicate phone numbers detected!</p>
                  <p className="text-xs text-slate-400 mt-1">
                    All active church members have distinct, normalized Ugandan phone records.
                  </p>
                </div>
              ) : (
                duplicateGroups.map((grp, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-300">
                        Phone: {grp.phone} ({grp.count} matching records)
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Collision
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {grp.members.map((m, mIdx) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white truncate">{m.fullName}</span>
                            <span className="text-[10px] text-slate-500">ID: {m.id}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Depts: {m.departmentIds.map(dId => departmentMap[dId] || dId).join(', ') || 'None'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Consent: <strong className={m.smsConsent ? 'text-emerald-400' : 'text-amber-400'}>{m.smsConsent ? 'Yes' : 'No'}</strong>
                          </p>

                          <button
                            onClick={() => {
                              const otherIds = grp.members.filter(o => o.id !== m.id).map(o => o.id);
                              handleMergeDuplicates(m.id, otherIds);
                            }}
                            className="mt-2 w-full py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-semibold text-[11px] transition-colors"
                          >
                            Keep as Primary & Merge Others
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => setShowDuplicatesModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Profile Modal */}
      {profileMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600/20 text-blue-400 font-bold text-base flex items-center justify-center border border-blue-500/30">
                  {profileMember.firstName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{profileMember.fullName}</h3>
                  <p className="text-xs text-slate-400">Omega Prayer Mission Church Member</p>
                </div>
              </div>
              <button
                onClick={() => setProfileMember(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-mono font-bold text-white">{profileMember.phone}</span>
              </div>

              {profileMember.email && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-white font-mono">{profileMember.email}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">SMS Consent:</span>
                <span className={profileMember.smsConsent ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {profileMember.smsConsent ? 'Explicit Consent Granted' : 'No SMS Consent'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-slate-400 block">Department Memberships:</span>
                <div className="flex flex-wrap gap-1">
                  {profileMember.departmentIds.length === 0 ? (
                    <span className="text-slate-500 italic">None</span>
                  ) : (
                    profileMember.departmentIds.map(dId => (
                      <span
                        key={dId}
                        className="px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-700/40 font-semibold"
                      >
                        {departmentMap[dId] || dId}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {profileMember.notes && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Notes:</span>
                  <p className="text-slate-300">{profileMember.notes}</p>
                </div>
              )}

              <div className="text-[11px] text-slate-500 pt-2 flex items-center justify-between">
                <span>Registration: {new Date(profileMember.registrationDate).toLocaleDateString()}</span>
                <span>Source: {profileMember.source}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => {
                  setProfileMember(null);
                  handleOpenEdit(profileMember);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Edit Details
              </button>
              <button
                onClick={() => {
                  const target = profileMember;
                  setProfileMember(null);
                  onOpenSendToMember?.(target);
                }}
                disabled={!profileMember.smsConsent || profileMember.status !== 'active'}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                Send SMS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Import Preview ({importRows.length} Rows)</h3>
                  <p className="text-xs text-slate-400">Verifying phone numbers and consent declarations</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-300">
                Found <strong>{importRows.length}</strong> record(s) in uploaded file. Existing members matched by Ugandan phone number will have their information updated and departments preserved.
              </p>

              {/* Sample preview table */}
              <div className="overflow-x-auto max-h-60 border border-slate-800 rounded-xl">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-950 text-slate-400 font-mono">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Consent</th>
                      <th className="p-2">Departments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {importRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="p-2 text-slate-500">{i + 1}</td>
                        <td className="p-2 text-white">
                          {row.first_name || row.firstName || row['First Name']} {row.second_name || row.secondName || row['Second Name'] || ''}
                        </td>
                        <td className="p-2 text-slate-300">{row.phone || row.phoneNumber || row['Phone']}</td>
                        <td className="p-2 text-emerald-400">
                          {String(row.sms_consent ?? row.smsConsent ?? row['SMS Consent'] ?? '')}
                        </td>
                        <td className="p-2 text-slate-400">{row.department || row.departments || row['Department'] || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importRows.length > 5 && (
                <p className="text-[11px] text-slate-500 italic text-center">
                  ...and {importRows.length - 5} more rows.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-50"
              >
                {isImporting ? 'Importing Members...' : `Import All ${importRows.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rich Excel Import Modal */}
      <ExcelImportModal
        isOpen={showRichImportModal}
        onClose={() => setShowRichImportModal(false)}
        departments={departments}
        onImportComplete={() => {
          loadMembers();
          onRefreshStats();
        }}
      />
    </div>
  );
};
