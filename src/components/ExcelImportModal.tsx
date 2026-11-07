import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Users,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api, Department } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { parseImportFile, downloadSampleImportTemplate } from '../utils/exportImport.js';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  onImportComplete: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  departments,
  onImportComplete,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'summary'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: { row: number; error: string; data: any }[];
  } | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep('upload');
    setFile(null);
    setParsedRows([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const processFile = async (uploadedFile: File) => {
    const ext = uploadedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast.error('Unsupported file format', 'Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    try {
      setIsParsing(true);
      const rows = await parseImportFile(uploadedFile);
      if (!Array.isArray(rows) || rows.length === 0) {
        toast.error('Empty spreadsheet', 'No valid rows or records were found in the uploaded file.');
        return;
      }

      setFile(uploadedFile);
      setParsedRows(rows);
      setStep('preview');
      toast.success('File analyzed', `Parsed ${rows.length} record(s) from ${uploadedFile.name}.`);
    } catch (err: any) {
      toast.error('Failed to parse file', err.message || 'Error reading spreadsheet structure.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processFile(dropped);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    try {
      setIsImporting(true);
      setStep('importing');
      const res = await api.importMembers(parsedRows, updateExisting);
      setImportResult({
        createdCount: res.createdCount || 0,
        updatedCount: res.updatedCount || 0,
        skippedCount: res.skippedCount || 0,
        errors: res.errors || [],
      });
      setStep('summary');
      onImportComplete();
      toast.success(
        'Excel Import Successful',
        `${res.createdCount} new members created, ${res.updatedCount} updated in Omega Prayer Mission database.`
      );
    } catch (err: any) {
      toast.error('Import failed', err.message || 'An error occurred during batch member processing.');
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  // Analyze preview rows
  const validRowsCount = parsedRows.filter(r => {
    const phone = r.phone || r.phoneNumber || r.phone_number || r['Phone Number'] || r['Phone'] || '';
    const clean = String(phone).replace(/[\s\-\(\)\.]/g, '');
    const hasPhone = clean.length >= 9;
    const hasName = Boolean(r.first_name || r.firstName || r['First Name'] || r['Given Name']);
    return hasPhone && hasName;
  }).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_16px_48px_0_rgba(0,0,0,0.5)] flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Subtle glass gradient top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950/70 rounded-[14px] flex items-center justify-center text-emerald-300">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
                Excel Contacts & Member Import
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Bulk Ingestion
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Omega Prayer Mission Church Mbuya • Upload .xlsx, .xls or .csv
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* STEP 1: UPLOAD SCREEN */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Drag and Drop Box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                    : 'border-white/10 hover:border-emerald-500/40 bg-slate-950/40 hover:bg-slate-950/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <UploadCloud className="w-8 h-8 animate-pulse" />
                </div>

                <h4 className="text-base font-bold text-white mb-1">
                  Drag & Drop Excel Spreadsheet Here
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Supports modern Excel workbooks (.xlsx), Excel 97-2004 (.xls), or comma-separated values (.csv).
                </p>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all">
                  Browse Computer Files
                </div>
              </div>

              {/* Sample Template & Guidelines Card */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Need the formatted Excel template?
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Includes columns: First Name, Second Name, Phone Number, Gender, Email, SMS Consent, Departments, and Notes.
                  </p>
                </div>

                <button
                  onClick={() => downloadSampleImportTemplate()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-emerald-300 text-xs font-semibold border border-emerald-500/20 shrink-0 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Download Sample Template (.xlsx)
                </button>
              </div>

              {/* Intelligent Features Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ugandan Phone Clean
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Auto-normalizes local formats (`07...`, `256...`) into verified `+256...` format.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-sky-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Department Routing
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Matches ministries (e.g. Choir, Media) and automatically adds members to corresponding sheets.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Conflict Safe
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Updates existing members without wiping department assignments or consent records.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW SCREEN */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-white truncate max-w-xs">{file?.name}</h5>
                    <p className="text-[10px] text-slate-400">
                      {parsedRows.length} total rows parsed • {validRowsCount} ready to import
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep('upload')}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Choose Different File
                </button>
              </div>

              {/* Duplicate & Update Strategy Option */}
              <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-900/40 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="updateExisting"
                  checked={updateExisting}
                  onChange={e => setUpdateExisting(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="updateExisting" className="text-xs text-slate-300 cursor-pointer">
                  <strong className="text-white block font-semibold">
                    Merge & update existing members (Recommended)
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    If an existing member with the same Ugandan phone number is found, update their details and add any new department memberships without removing current ones.
                  </span>
                </label>
              </div>

              {/* Preview Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Data Preview (First 8 Rows)</span>
                  <span>Total {parsedRows.length} rows</span>
                </div>

                <div className="overflow-x-auto max-h-64 border border-white/10 rounded-2xl bg-slate-950/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-white/5 sticky top-0">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Phone Number</th>
                        <th className="p-2.5">Consent</th>
                        <th className="p-2.5">Departments</th>
                        <th className="p-2.5">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[11px] font-sans">
                      {parsedRows.slice(0, 8).map((row, idx) => {
                        const firstName = row.first_name || row.firstName || row['First Name'] || row['Given Name'] || '';
                        const secondName = row.second_name || row.secondName || row['Second Name'] || row.lastName || row['Last Name'] || '';
                        const phone = row.phone || row.phoneNumber || row.phone_number || row['Phone Number'] || row['Phone'] || '';
                        const consent = row.sms_consent ?? row.smsConsent ?? row['SMS Consent'] ?? row['Consent'] ?? 'Yes';
                        const depts = row.department || row.departments || row.selected_departments || row['Departments'] || row['Ministry'] || '';
                        const email = row.email || row['Email'] || '';

                        const isMissingName = !firstName;
                        const isMissingPhone = !phone;

                        return (
                          <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-2.5 font-mono text-slate-500">{idx + 1}</td>
                            <td className="p-2.5 font-semibold text-white">
                              {isMissingName ? (
                                <span className="text-rose-400 italic">Missing Name</span>
                              ) : (
                                `${firstName} ${secondName}`.trim()
                              )}
                            </td>
                            <td className="p-2.5 font-mono">
                              {isMissingPhone ? (
                                <span className="text-rose-400 italic">Missing Phone</span>
                              ) : (
                                <span className="text-emerald-400 font-bold">{phone}</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                                {String(consent)}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-300 max-w-xs truncate">
                              {depts || <span className="text-slate-500 italic">None</span>}
                            </td>
                            <td className="p-2.5 text-slate-400 font-mono text-[10px] truncate max-w-xs">
                              {email || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {parsedRows.length > 8 && (
                  <p className="text-[11px] text-slate-500 italic text-center pt-1">
                    ...and {parsedRows.length - 8} more rows ready for processing.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: IMPORTING SPINNER SCREEN */}
          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <div>
                <h4 className="text-base font-bold text-white">Ingesting Member Contacts...</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Normalizing Ugandan telephone formats, updating department rosters, and regenerating 11-sheet Excel register.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SUMMARY SCREEN */}
          {step === 'summary' && importResult && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-200 text-sm">Spreadsheet Import Completed</h4>
                  <p className="text-xs text-emerald-300/80">
                    The church member database and master 11-sheet Excel register have been updated.
                  </p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 text-center">
                  <span className="text-slate-400 text-xs block mb-1">New Members Created</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {importResult.createdCount}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 text-center">
                  <span className="text-slate-400 text-xs block mb-1">Existing Updated</span>
                  <span className="text-2xl font-bold font-mono text-sky-400">
                    {importResult.updatedCount}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 text-center">
                  <span className="text-slate-400 text-xs block mb-1">Skipped / Errors</span>
                  <span className={`text-2xl font-bold font-mono ${importResult.skippedCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {importResult.skippedCount}
                  </span>
                </div>
              </div>

              {/* Error details if any */}
              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Skipped Rows & Warnings ({importResult.errors.length})
                  </h5>
                  <div className="max-h-40 overflow-y-auto border border-white/5 rounded-xl p-3 bg-slate-950/60 font-mono text-[11px] text-slate-300 space-y-1">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="text-amber-300/90">
                        Row {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-5 sm:p-6 border-t border-white/5 bg-slate-950/40 flex items-center justify-between gap-3">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all"
              >
                Select Excel File (.xlsx)
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isImporting || parsedRows.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  <span>Import {parsedRows.length} Members</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {step === 'summary' && (
            <div className="w-full flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all"
              >
                Done & Return to Directory
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
