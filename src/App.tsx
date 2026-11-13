import { useMemo, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { MediFlowProvider, useMediFlow } from './context/MediFlowContext.tsx';
import { getDaysUntilExpiry } from './lib/validation.ts';
import type { DistributionHub, InventoryBatch, NavSection } from './types/pharma.ts';
import { AuthGate } from './components/AuthGate.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { ErrorBanner } from './components/StatusTag.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { InventoryView } from './components/InventoryView.tsx';
import { ExpiryAlertsView } from './components/ExpiryAlertsView.tsx';
import { DemandForecastView } from './components/DemandForecastView.tsx';
import { RecommendationsView } from './components/RecommendationsView.tsx';
import { TransfersView } from './components/TransfersView.tsx';
import {
  AddBatchModal,
  AdjustStockModal,
  CreateTransferModal,
  EditHubLeadTimeModal,
  LogSalesModal,
  ResetDemoModal,
} from './components/Modals.tsx';

function MediFlowShell() {
  const {
    user,
    authReady,
    mutating,
    isOnline,
    connectivityIssue,
    errorMessage,
    clearError,
    workspace,
    hubs,
    batches,
    evaluatedRecommendations,
    recommendationRecords,
    demoScopeCounts,
    logout,
    seedDemoData,
    updateHubLeadTime,
    addBatch,
    adjustBatchQuantity,
    createTransfer,
    logSalesRecord,
  } = useMediFlow();

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [transferModalBatchId, setTransferModalBatchId] = useState<string | null>(null);
  const [newTransferOpen, setNewTransferOpen] = useState(false);
  const [adjustBatch, setAdjustBatch] = useState<InventoryBatch | null>(null);
  const [editHub, setEditHub] = useState<DistributionHub | null>(null);
  const [logSalesOpen, setLogSalesOpen] = useState(false);
  const [resetDemoOpen, setResetDemoOpen] = useState(false);

  const expiryBadgeCount = useMemo(() => {
    return batches.filter(
      (b) => b.quantity > 0 && b.status !== 'depleted' && getDaysUntilExpiry(b.expiryDate) <= 30
    ).length;
  }, [batches]);

  const openRecsCount = useMemo(() => {
    return evaluatedRecommendations.filter((rec) => {
      const match = recommendationRecords.find(
        (r) =>
          r.ruleId === rec.ruleId &&
          r.batchId === rec.batchId &&
          r.hubId === rec.hubId &&
          (r.targetHubId || '') === (rec.targetHubId || '')
      );
      return !match || match.status === 'open';
    }).length;
  }, [evaluatedRecommendations, recommendationRecords]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-600">Connecting to MediFlow AI...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const openTransferDialog = (batchId?: string) => {
    setTransferModalBatchId(batchId ?? null);
    setNewTransferOpen(true);
  };

  const isDemoActive = demoScopeCounts.demoBatches > 0 || demoScopeCounts.demoSales > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-[#0F2544]">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        expiryBadgeCount={expiryBadgeCount}
        openRecsCount={openRecsCount}
        workspaceName={workspace?.name ?? 'Brahmaputra Pharma Distributors'}
        hubCount={hubs.length || 9}
        userEmail={user.email ?? 'Distributor Account'}
        mutating={mutating}
        onResetDemoData={() => setResetDemoOpen(true)}
        onLogout={logout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <TopBar
          activeSection={activeSection}
          isDemoActive={isDemoActive}
          isOnline={isOnline}
          connectivityIssue={connectivityIssue}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenAddBatch={() => setAddBatchOpen(true)}
          onOpenNewTransfer={() => openTransferDialog()}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-5">
          {(!isOnline || connectivityIssue) && (
            <div
              role="status"
              className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs sm:text-sm text-amber-900"
            >
              <WifiOff className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
              <span>
                {!isOnline
                  ? 'Browser is currently offline. Firestore and forecasting updates will resume when connectivity is restored.'
                  : connectivityIssue}
              </span>
            </div>
          )}

          {errorMessage && <ErrorBanner message={errorMessage} onDismiss={clearError} />}

          {activeSection === 'dashboard' && <DashboardView onNavigate={setActiveSection} />}
          {activeSection === 'inventory' && (
            <InventoryView
              onOpenAddBatch={() => setAddBatchOpen(true)}
              onOpenAdjustStock={(b) => setAdjustBatch(b)}
              onOpenTransferForBatch={(id) => openTransferDialog(id)}
            />
          )}
          {activeSection === 'expiry' && (
            <ExpiryAlertsView onOpenTransferForBatch={(id) => openTransferDialog(id)} />
          )}
          {activeSection === 'forecast' && (
            <DemandForecastView onOpenLogSales={() => setLogSalesOpen(true)} />
          )}
          {activeSection === 'recommendations' && <RecommendationsView />}
          {activeSection === 'transfers' && (
            <TransfersView
              onOpenNewTransfer={() => openTransferDialog()}
              onOpenEditHub={(h) => setEditHub(h)}
            />
          )}
        </main>
      </div>

      {addBatchOpen && (
        <AddBatchModal
          hubs={hubs}
          mutating={mutating}
          onClose={() => setAddBatchOpen(false)}
          onSubmit={addBatch}
        />
      )}

      {newTransferOpen && (
        <CreateTransferModal
          batches={batches}
          hubs={hubs}
          preselectedBatchId={transferModalBatchId ?? undefined}
          mutating={mutating}
          onClose={() => {
            setNewTransferOpen(false);
            setTransferModalBatchId(null);
          }}
          onSubmit={createTransfer}
        />
      )}

      {adjustBatch && (
        <AdjustStockModal
          batch={adjustBatch}
          mutating={mutating}
          onClose={() => setAdjustBatch(null)}
          onSubmit={adjustBatchQuantity}
        />
      )}

      {editHub && (
        <EditHubLeadTimeModal
          hub={editHub}
          mutating={mutating}
          onClose={() => setEditHub(null)}
          onSubmit={updateHubLeadTime}
        />
      )}

      {logSalesOpen && (
        <LogSalesModal
          batches={batches}
          hubs={hubs}
          mutating={mutating}
          onClose={() => setLogSalesOpen(false)}
          onSubmit={logSalesRecord}
        />
      )}

      {resetDemoOpen && (
        <ResetDemoModal
          counts={demoScopeCounts}
          mutating={mutating}
          onClose={() => setResetDemoOpen(false)}
          onConfirm={() => seedDemoData(true)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <MediFlowProvider>
      <MediFlowShell />
    </MediFlowProvider>
  );
}
