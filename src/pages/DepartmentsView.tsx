import React, { useState } from 'react';
import {
  Building2,
  Users,
  Plus,
  Send,
  Edit,
  Trash2,
  CheckCircle2,
  UserCheck,
  Eye,
  Shield,
  Layers,
} from 'lucide-react';
import { Department, Member, api } from '../services/api.js';
import { useToast } from '../components/Toast.js';

interface DepartmentsViewProps {
  departments: Department[];
  onRefresh: () => void;
  onSendToDepartment: (departmentId: string) => void;
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({
  departments,
  onRefresh,
  onSendToDepartment,
}) => {
  const toast = useToast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Members of a department
  const [viewingDept, setViewingDept] = useState<Department | null>(null);
  const [deptMembers, setDeptMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const handleOpenAdd = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptDesc('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setDeptName(dept.name);
    setDeptDesc(dept.description || '');
    setShowAddModal(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) {
      toast.error('Department name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingDept) {
        await api.updateDepartment(editingDept.id, {
          name: deptName.trim(),
          description: deptDesc.trim(),
        });
        toast.success('Department updated', `Updated ${deptName.trim()}.`);
      } else {
        await api.createDepartment({
          name: deptName.trim(),
          description: deptDesc.trim(),
        });
        toast.success('Department created', `Created ${deptName.trim()}.`);
      }
      setShowAddModal(false);
      onRefresh();
    } catch (err: any) {
      toast.error('Failed to save department', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveDepartment = async (dept: Department) => {
    if (!window.confirm(`Archive "${dept.name}"? Historical records will be preserved.`)) return;

    try {
      await api.deleteDepartment(dept.id);
      toast.success('Department archived', `${dept.name} archived.`);
      onRefresh();
    } catch (err: any) {
      toast.error('Archive failed', err.message);
    }
  };

  const handleViewDeptMembers = async (dept: Department) => {
    setViewingDept(dept);
    setLoadingMembers(true);
    try {
      const res = await api.getMembers({ departmentId: dept.id, status: 'all' });
      setDeptMembers(res.members);
    } catch (err: any) {
      toast.error('Failed to load department members', err.message);
    } finally {
      setLoadingMembers(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Church Departments & Ministries
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Omega Prayer Mission Church Mbuya • {departments.length} Departments Configured
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept, index) => {
          const consentPercent = dept.memberCount > 0
            ? Math.round((dept.consentedCount / dept.memberCount) * 100)
            : 0;

          return (
            <div
              key={dept.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all duration-150 flex flex-col justify-between ${
                dept.isArchived
                  ? 'border-slate-800/50 opacity-60'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                      #{index + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white leading-snug">{dept.name}</h3>
                      {dept.isArchived && (
                        <span className="text-[10px] text-rose-400 font-mono uppercase font-bold">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(dept)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Edit Department"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {!dept.isArchived && (
                      <button
                        onClick={() => handleArchiveDepartment(dept)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        title="Archive Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mt-1">
                  {dept.description || 'Ministry department serving Omega Prayer Mission Church Mbuya'}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">Total Members</span>
                    <span className="text-lg font-bold text-white font-mono">{dept.memberCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block">SMS Consented</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {dept.consentedCount}{' '}
                      <span className="text-[10px] text-slate-400 font-sans font-normal">({consentPercent}%)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => handleViewDeptMembers(dept)}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/80 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Members
                </button>
                <button
                  onClick={() => onSendToDepartment(dept.id)}
                  disabled={dept.consentedCount === 0}
                  className="py-1.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  title={dept.consentedCount === 0 ? 'No consenting members to send to' : 'Send SMS to this department'}
                >
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                  SMS
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-base text-white">
                {editingDept ? 'Edit Department' : 'Create Church Department'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Department / Ministry Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  placeholder="e.g. Media and Technical"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <textarea
                  rows={3}
                  value={deptDesc}
                  onChange={e => setDeptDesc(e.target.value)}
                  placeholder="Brief description of ministry role and responsibilities..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Department Members Modal */}
      {viewingDept && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{viewingDept.name} Members</h3>
                  <p className="text-xs text-slate-400">
                    {deptMembers.length} member(s) assigned to this department
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingDept(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              {loadingMembers ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                  Loading members...
                </div>
              ) : deptMembers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No church members currently assigned to {viewingDept.name}.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 max-h-96 overflow-y-auto">
                  {deptMembers.map(m => (
                    <div
                      key={m.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {m.firstName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{m.fullName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{m.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.smsConsent ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Consented
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            No Consent
                          </span>
                        )}
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
              <span className="text-xs text-slate-400">
                Consented SMS recipients:{' '}
                <strong className="text-emerald-400">
                  {deptMembers.filter(m => m.smsConsent && m.status === 'active').length}
                </strong>
              </span>
              <button
                onClick={() => {
                  const dId = viewingDept.id;
                  setViewingDept(null);
                  onSendToDepartment(dId);
                }}
                disabled={deptMembers.filter(m => m.smsConsent && m.status === 'active').length === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                Compose Department SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
