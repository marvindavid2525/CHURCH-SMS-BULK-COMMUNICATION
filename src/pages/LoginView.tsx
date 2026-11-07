import React, { useState } from 'react';
import { Church, Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { api, AdminInfo } from '../services/api.js';

interface LoginViewProps {
  onLoginSuccess: (admin: AdminInfo) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('amarvinmulindwa2003@gmail.com');
  const [password, setPassword] = useState('OmegaPrayer2025!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(email.trim(), password);
      onLoginSuccess(res.admin);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDefaultCredentials = () => {
    setEmail('amarvinmulindwa2003@gmail.com');
    setPassword('OmegaPrayer2025!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden text-slate-100">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-500 shadow-xl shadow-blue-500/25 ring-2 ring-white/20 mb-4">
            <Church className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            ChurchSMS Manager
          </h1>
          <p className="text-sm font-medium text-blue-400 mt-1">
            Omega Prayer Mission Church Mbuya
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Kampala, Uganda • Centralized Bulk SMS Administration
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-7 shadow-2xl backdrop-blur-md">
          <div className="mb-6 pb-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Administrator Access
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Authorised church administrators only
              </p>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
              Secure
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Administrator Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="amarvinmulindwa2003@gmail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Authorised: <span className="text-slate-400 font-mono">amarvinmulindwa2003@gmail.com</span>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password / PIN
                </label>
                <button
                  type="button"
                  onClick={fillDefaultCredentials}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Fill Credentials
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Quick Helper Banner */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="text-slate-300 font-semibold flex items-center gap-1">
                <span>Default Initial Credentials:</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Password:</span>
                <code className="text-blue-300 font-mono bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-900/50">OmegaPrayer2025!</code>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Or Master PIN:</span>
                <code className="text-blue-300 font-mono bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-900/50">2025</code>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99] mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Omega Prayer Mission Church Mbuya, Uganda.</p>
          <p className="mt-0.5">Bulk SMS Uganda API Integration • Secure Church Communications</p>
        </div>
      </div>
    </div>
  );
};
