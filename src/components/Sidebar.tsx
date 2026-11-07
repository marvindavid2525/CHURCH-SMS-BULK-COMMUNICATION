import React from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Send,
  History,
  FileSpreadsheet,
  Link2,
  Coins,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
  Church,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AdminInfo } from '../services/api.js';

export type NavTab =
  | 'dashboard'
  | 'members'
  | 'departments'
  | 'campaigns'
  | 'history'
  | 'response_links'
  | 'google_sync'
  | 'credits'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  admin: AdminInfo | null;
  onLogout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  remainingCredits: number | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  admin,
  onLogout,
  isMobileOpen,
  onCloseMobile,
  remainingCredits,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      color: 'text-sky-400',
      activeGradient: 'from-blue-600 via-indigo-600 to-sky-500',
    },
    {
      id: 'members' as NavTab,
      label: 'Members',
      icon: Users,
      color: 'text-emerald-400',
      activeGradient: 'from-emerald-600 via-teal-600 to-cyan-600',
    },
    {
      id: 'departments' as NavTab,
      label: 'Departments',
      icon: Building2,
      color: 'text-indigo-400',
      activeGradient: 'from-indigo-600 via-blue-600 to-violet-600',
    },
    {
      id: 'campaigns' as NavTab,
      label: 'SMS Broadcasts',
      icon: Send,
      color: 'text-violet-400',
      activeGradient: 'from-violet-600 via-purple-600 to-indigo-600',
    },
    {
      id: 'history' as NavTab,
      label: 'Delivery History',
      icon: History,
      color: 'text-fuchsia-400',
      activeGradient: 'from-purple-600 via-fuchsia-600 to-pink-600',
    },
    {
      id: 'response_links' as NavTab,
      label: 'Response Links',
      icon: Link2,
      color: 'text-cyan-400',
      activeGradient: 'from-cyan-600 via-teal-600 to-blue-600',
    },
    {
      id: 'google_sync' as NavTab,
      label: 'Google Sheets Sync',
      icon: FileSpreadsheet,
      color: 'text-teal-400',
      activeGradient: 'from-teal-600 via-emerald-600 to-cyan-600',
    },
    {
      id: 'credits' as NavTab,
      label: 'Credits & Usage',
      icon: Coins,
      color: 'text-amber-400',
      activeGradient: 'from-amber-600 via-orange-600 to-yellow-600',
      badge: remainingCredits !== null ? `${remainingCredits}` : undefined,
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports & Analytics',
      icon: BarChart3,
      color: 'text-rose-400',
      activeGradient: 'from-rose-600 via-pink-600 to-orange-600',
    },
    {
      id: 'settings' as NavTab,
      label: 'System Settings',
      icon: Settings,
      color: 'text-slate-400',
      activeGradient: 'from-slate-700 via-slate-800 to-slate-900',
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 z-40 lg:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-slate-900/60 backdrop-blur-2xl border-r border-white/10 text-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 shadow-[4px_0_24px_0_rgba(0,0,0,0.4)] ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Church Identity Header */}
        <div>
          <div className="p-5 border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/30">
                  <Church className="w-6 h-6" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
              </div>

              <div className="min-w-0">
                <h1 className="font-bold text-sm tracking-tight leading-tight flex items-center gap-1.5 text-white">
                  ChurchSMS
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 shadow-sm">
                    Mbuya
                  </span>
                </h1>
                <p className="text-xs text-slate-300 truncate mt-0.5 font-medium">
                  Omega Prayer Mission
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  Kampala, Uganda
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links with Motion Animated Indicator */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-230px)]">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Main Portal</span>
              <Sparkles className="w-3 h-3 text-sky-400" />
            </div>

            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                    isActive ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {/* Animated Motion Tab Background */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActiveTab"
                      className={`absolute inset-0 rounded-xl bg-gradient-to-r ${item.activeGradient} shadow-lg shadow-blue-600/30 border border-white/25`}
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}

                  <div className="relative z-10 flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1 rounded-lg transition-transform group-hover:scale-110 ${
                        isActive
                          ? 'text-white'
                          : `${item.color} bg-white/[0.03] border border-white/5`
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : Number(item.badge) < 50
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 border border-white/20 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0 shadow-md">
                {admin?.name?.substring(0, 2) || 'AD'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                  {admin?.name || 'Administrator'}
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono">
                  {admin?.email || 'amarvinmulindwa2003@gmail.com'}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 transition-all duration-150"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
