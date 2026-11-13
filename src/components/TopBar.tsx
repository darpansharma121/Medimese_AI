import { Menu, Plus, WifiOff } from 'lucide-react';
import type { NavSection } from '../types/pharma.ts';

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Executive Overview',
  inventory: 'Batch Inventory Ledger',
  expiry: 'Expiry Risk & FEFO Alerts',
  forecast: 'Moving-Average Demand Forecast',
  recommendations: 'Smart Business Recommendations',
  transfers: 'Inter-Hub Stock Transfers',
};

interface TopBarProps {
  activeSection: NavSection;
  isDemoActive?: boolean;
  isOnline?: boolean;
  connectivityIssue?: string | null;
  onOpenMobileMenu: () => void;
  onOpenAddBatch: () => void;
  onOpenNewTransfer: () => void;
}

export function TopBar({
  activeSection,
  isDemoActive = false,
  isOnline = true,
  connectivityIssue = null,
  onOpenMobileMenu,
  onOpenAddBatch,
  onOpenNewTransfer,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-[#0F2544] rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 hidden sm:inline whitespace-nowrap">MediFlow AI</span>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <h1 className="font-display text-base sm:text-lg font-bold text-[#0F2544] truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {(!isOnline || connectivityIssue) && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium whitespace-nowrap">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>{!isOnline ? 'Offline' : 'Reconnecting'}</span>
          </span>
        )}
        {isDemoActive && (
          <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded border border-slate-200 bg-slate-100 text-slate-700 text-xs font-medium whitespace-nowrap">
            Synthetic Demo Data
          </span>
        )}
        {activeSection === 'transfers' ? (
          <button
            type="button"
            onClick={onOpenNewTransfer}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Transfer</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAddBatch}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Batch</span>
          </button>
        )}
      </div>
    </header>
  );
}
