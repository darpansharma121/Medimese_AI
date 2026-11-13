import {
  Activity,
  AlertTriangle,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  TrendingUp,
  Truck,
  X,
} from 'lucide-react';
import type { NavSection } from '../types/pharma.ts';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  expiryBadgeCount: number;
  openRecsCount: number;
  workspaceName: string;
  hubCount?: number;
  userEmail: string;
  mutating: boolean;
  onResetDemoData: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  expiryBadgeCount,
  openRecsCount,
  workspaceName,
  hubCount = 9,
  userEmail,
  mutating,
  onResetDemoData,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
    tone?: 'critical' | 'teal';
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    {
      id: 'expiry',
      label: 'Expiry Alerts',
      icon: AlertTriangle,
      count: expiryBadgeCount,
      tone: 'critical',
    },
    { id: 'forecast', label: 'Demand Forecast', icon: TrendingUp },
    {
      id: 'recommendations',
      label: 'Smart Recommendations',
      icon: CheckSquare,
      count: openRecsCount,
      tone: 'teal',
    },
    { id: 'transfers', label: 'Stock Transfers', icon: Truck },
  ];

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-[#0F2544] whitespace-nowrap truncate">
                MediFlow AI
              </span>
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="lg:hidden p-1.5 text-slate-500 hover:text-[#0F2544] rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-[#0F2544] truncate">{workspaceName}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">Northeast India · {hubCount} Hubs</p>
          </div>

          <nav className="px-3 py-4 space-y-1" aria-label="Primary Sidebar Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-[#0F2544]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-teal-700' : 'text-slate-500'
                      }`}
                    />
                    <span className="whitespace-nowrap truncate">{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span
                      className={`font-mono tabular-nums text-xs font-semibold px-1.5 py-0.5 rounded ${
                        item.tone === 'critical'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-teal-100 text-teal-800'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-2.5">
          <div className="px-1">
            <p className="text-xs font-medium text-[#0F2544] truncate">{userEmail}</p>
            <p className="text-xs text-slate-500">Distributor Manager</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={mutating}
              onClick={onResetDemoData}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${mutating ? 'animate-spin' : ''}`} />
              <span>Reset Demo</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
