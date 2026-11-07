import React, { useState } from 'react';
import {
  Coins,
  TrendingDown,
  AlertTriangle,
  ExternalLink,
  Calculator,
  RefreshCw,
  CheckCircle2,
  Clock,
  Send,
  Building2,
} from 'lucide-react';
import { DashboardStats, api } from '../services/api.js';
import { useToast } from '../components/Toast.js';

interface CreditsViewProps {
  stats: DashboardStats | null;
  onRefreshStats: () => void;
}

export const CreditsView: React.FC<CreditsViewProps> = ({ stats, onRefreshStats }) => {
  const toast = useToast();

  const [testMessage, setTestMessage] = useState('Hello from Omega Prayer Mission Church Mbuya.');
  const [recipientCount, setRecipientCount] = useState(150);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const remaining = stats?.sms?.remainingCredits;
  const consumed = stats?.sms?.creditsConsumed || 0;
  const lastUpdate = stats?.sms?.lastBalanceUpdate;

  // Credit calculation for the estimator
  const charLength = testMessage.length;
  // Unicode check
  // eslint-disable-next-line no-control-regex
  const isUnicode = /[^\u0020-\u007E\u00A0-\u00FF\u20AC]/.test(testMessage);
  const maxSingle = isUnicode ? 70 : 160;
  const maxConcat = isUnicode ? 67 : 153;
  const segments = charLength === 0 ? 0 : charLength <= maxSingle ? 1 : Math.ceil(charLength / maxConcat);
  const estimatedTotal = segments * recipientCount;

  const handleTestConnection = async () => {
    try {
      setIsRefreshing(true);
      const res = await api.testProviderConnection();
      if (res.success) {
        toast.success('Provider Connection Active', res.message);
      } else {
        toast.warning('Provider Check', res.message);
      }
      onRefreshStats();
    } catch (err: any) {
      toast.error('Connection test failed', err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            SMS Credits & Usage Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Bulk SMS Uganda Provider Account • Omega Prayer Mission Church Mbuya
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTestConnection}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            Query Provider Balance
          </button>
          <a
            href="https://app.bulksmsug.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition-all"
          >
            <span>Top Up on BulkSMSUg</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Primary Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Available Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Available Provider Credits</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {remaining !== null && remaining !== undefined ? remaining : '—'}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {lastUpdate ? `Last updated: ${new Date(lastUpdate).toLocaleTimeString()}` : 'Snapshot from gateway'}
          </p>
        </div>

        {/* Consumed Credits */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Credits Consumed</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-blue-400 font-mono">
            {consumed}
          </div>
          <p className="text-[11px] text-slate-500">
            Across {stats?.sms?.totalSubmitted || 0} messages dispatched
          </p>
        </div>

        {/* Confirmed Delivery Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Delivery Efficiency</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            {stats?.sms?.deliveryRate || 100}%
          </div>
          <p className="text-[11px] text-slate-500">
            {stats?.sms?.delivered || 0} confirmed delivered messages
          </p>
        </div>
      </div>

      {/* Credit Estimator & Calculator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Calculator className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-base text-white">Interactive SMS Credit Estimator</h3>
            <p className="text-xs text-slate-400">
              Calculate segments and credits required for an upcoming church campaign
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Inputs */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Draft Message Content
              </label>
              <textarea
                rows={4}
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estimated Number of Recipients
              </label>
              <input
                type="number"
                min={1}
                value={recipientCount}
                onChange={e => setRecipientCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full sm:w-64 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono"
              />
            </div>
          </div>

          {/* Results Breakdown */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5 text-xs">
              <span className="font-bold text-white block pb-2 border-b border-slate-800">
                Segment Breakdown
              </span>
              <div className="flex justify-between">
                <span className="text-slate-400">Character Count:</span>
                <span className="font-mono text-white font-bold">{charLength} chars</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Encoding:</span>
                <span className="font-mono text-slate-300">{isUnicode ? 'Unicode (70 char limit)' : 'Standard GSM 7-bit (160 char limit)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Segments per Member:</span>
                <span className="font-mono text-blue-400 font-bold">{segments} credit(s)</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-sm">
                <span className="font-bold text-white">Total Credits Needed:</span>
                <span className="font-bold text-amber-400 font-mono">{estimatedTotal} credits</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              * Based on Bulk SMS Uganda standard concatenation billing rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
