import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  FileDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Phone,
  Send,
  Calendar,
  Layers,
} from 'lucide-react';
import { SMSTransaction, api } from '../services/api.js';
import { useToast } from '../components/Toast.js';
import { exportTransactionsToExcel, exportTransactionsToCSV } from '../utils/exportImport.js';

export const SMSHistoryView: React.FC = () => {
  const toast = useToast();

  const [transactions, setTransactions] = useState<SMSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isRefreshingStatuses, setIsRefreshingStatuses] = useState(false);

  // Selected Transaction for Details Modal
  const [selectedTx, setSelectedTx] = useState<SMSTransaction | null>(null);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.getTransactions({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search,
        page,
        limit: 50,
      });
      setTransactions(res.transactions);
      setTotal(res.total);
    } catch (err: any) {
      toast.error('Failed to load SMS history', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [statusFilter, search, page]);

  // Polling / refresh delivery status from Bulk SMS Uganda
  const handleRefreshStatuses = async () => {
    try {
      setIsRefreshingStatuses(true);
      const res = await api.refreshDeliveryStatuses();
      toast.success(
        'Delivery Statuses Updated',
        `Polled Bulk SMS Uganda gateway for ${res.checkedCount} pending messages, updated ${res.updatedCount} statuses.`
      );
      loadTransactions();
    } catch (err: any) {
      toast.error('Status refresh failed', err.message);
    } finally {
      setIsRefreshingStatuses(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            SMS Delivery History & Audit Trail
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Omega Prayer Mission Church Mbuya • {total} Total Transactions Recorded
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refresh delivery status button */}
          <button
            onClick={handleRefreshStatuses}
            disabled={isRefreshingStatuses}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
            title="Poll Bulk SMS Uganda for latest delivery receipts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStatuses ? 'animate-spin text-blue-400' : ''}`} />
            Refresh Delivery Receipts
          </button>

          {/* Export to Excel & CSV */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-0.5">
            <button
              onClick={() => exportTransactionsToExcel(transactions)}
              className="px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-slate-750 rounded-lg transition-colors flex items-center gap-1"
              title="Export history to Excel (.xlsx)"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => exportTransactionsToCSV(transactions)}
              className="px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-750 rounded-lg transition-colors"
              title="Export history to CSV"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by recipient name, Ugandan phone, message content, or gateway message ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Delivery Statuses</option>
              <option value="success">Success / Delivered</option>
              <option value="sent">Sent</option>
              <option value="submitted">Submitted</option>
              <option value="buffered">Buffered</option>
              <option value="failed">Failed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Recipient</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">Message Content</th>
                <th className="p-3.5">Gateway Status</th>
                <th className="p-3.5">Credits</th>
                <th className="p-3.5">Dispatched At</th>
                <th className="p-3.5 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                    Loading SMS delivery records...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <History className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-medium text-slate-400">No SMS transactions recorded.</p>
                    <p className="text-xs text-slate-500 mt-1">Dispatched messages will appear here with delivery receipts.</p>
                  </td>
                </tr>
              ) : (
                transactions.map(tx => {
                  let badge = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (tx.status === 'Success') badge = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                  else if (tx.status === 'Sent' || tx.status === 'Submitted') badge = 'bg-blue-500/10 text-blue-300 border-blue-500/30';
                  else if (tx.status === 'Buffered') badge = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
                  else if (tx.status === 'Failed' || tx.status === 'Rejected') badge = 'bg-rose-500/10 text-rose-300 border-rose-500/30';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <span className="font-bold text-white block">{tx.recipientName}</span>
                        {tx.providerMessageId && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            ID: {tx.providerMessageId}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {tx.recipientPhone}
                      </td>
                      <td className="p-3.5">
                        <p className="text-slate-300 line-clamp-2 max-w-sm font-sans">
                          {tx.messageContent}
                        </p>
                        {tx.errorReason && (
                          <p className="text-[10px] text-rose-400 mt-0.5">
                            Reason: {tx.errorReason}
                          </p>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${badge}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {tx.calculatedCredits}
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {new Date(tx.sentAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Gateway Delivery Receipt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Receipt Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white">SMS Gateway Delivery Receipt</h3>
                <p className="text-xs text-slate-400">Bulk SMS Uganda Provider Transaction</p>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Internal Transaction ID:</span>
                <span className="font-mono text-slate-200">{selectedTx.id}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Provider Message ID:</span>
                <span className="font-mono text-white font-bold">{selectedTx.providerMessageId || 'N/A'}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Recipient:</span>
                <span className="text-white font-bold">{selectedTx.recipientName} ({selectedTx.recipientPhone})</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Delivery Status:</span>
                <span className="font-mono font-bold uppercase text-blue-400">{selectedTx.status}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Credits Deducted:</span>
                <span className="font-mono text-slate-200">{selectedTx.calculatedCredits} Credit(s)</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 block">Message Content:</span>
                <p className="text-slate-200 leading-relaxed font-sans">{selectedTx.messageContent}</p>
              </div>

              {selectedTx.providerResponse && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono text-[11px]">
                  <span className="text-slate-400 block font-sans">Raw Provider Response:</span>
                  <pre className="text-slate-400 overflow-x-auto max-h-32 text-[10px]">
                    {JSON.stringify(selectedTx.providerResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
