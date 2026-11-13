import { ArrowRight, CheckCircle2, Info } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMediFlow } from '../context/MediFlowContext.tsx';
import { formatInr, formatNumber, getDaysUntilExpiry, isBatchExpired } from '../lib/validation.ts';
import type { NavSection } from '../types/pharma.ts';
import { StatusTag } from './StatusTag.tsx';

export function DashboardView({
  onNavigate,
}: {
  onNavigate: (section: NavSection) => void;
}) {
  const {
    batches,
    salesHistory,
    hubs,
    forecasts,
    evaluatedRecommendations,
    recommendationRecords,
    transfers,
    demoScopeCounts,
    applyRecommendation,
    mutating,
    loadingData,
  } = useMediFlow();

  // Exclude expired batches from available saleable stock & valuation
  const saleableBatches = batches.filter(
    (b) => b.status === 'active' && b.quantity > 0 && !isBatchExpired(b.expiryDate)
  );
  const expiredActiveBatches = batches.filter(
    (b) => b.status === 'active' && b.quantity > 0 && isBatchExpired(b.expiryDate)
  );
  const totalValuationInr = saleableBatches.reduce((sum, b) => sum + b.quantity * b.unitCostInr, 0);
  const totalActiveUnits = saleableBatches.reduce((sum, b) => sum + b.quantity, 0);

  const criticalExpiryBatches = batches.filter((b) => {
    if (b.status === 'depleted' || b.quantity <= 0) return false;
    return getDaysUntilExpiry(b.expiryDate) <= 30;
  });
  const expiryRiskValueInr = criticalExpiryBatches.reduce(
    (sum, b) => sum + b.quantity * b.unitCostInr,
    0
  );

  const openRecs = evaluatedRecommendations.filter((rec) => {
    const match = recommendationRecords.find(
      (r) =>
        r.ruleId === rec.ruleId &&
        r.batchId === rec.batchId &&
        r.hubId === rec.hubId &&
        (r.targetHubId || '') === (rec.targetHubId || '')
    );
    return !match || match.status === 'open';
  });

  const activeTransfersCount = transfers.filter(
    (t) => t.status === 'pending' || t.status === 'in_transit'
  ).length;

  // Aggregate monthly sales & moving average trend for Recharts
  const monthlyAggMap = new Map<string, number>();
  for (const s of salesHistory) {
    monthlyAggMap.set(s.month, (monthlyAggMap.get(s.month) ?? 0) + s.unitsSold);
  }
  const sortedMonths = Array.from(monthlyAggMap.keys()).sort();
  const trendChartData: Array<{
    month: string;
    actualUnits: number | null;
    wma3: number | null;
    forecastUnits: number | null;
  }> = sortedMonths.map((month, idx, arr) => {
    const actual = monthlyAggMap.get(month) ?? 0;
    let wma3 = actual;
    if (idx >= 2) {
      const m0 = monthlyAggMap.get(arr[idx]) ?? 0;
      const m1 = monthlyAggMap.get(arr[idx - 1]) ?? 0;
      const m2 = monthlyAggMap.get(arr[idx - 2]) ?? 0;
      wma3 = Math.round(m0 * 0.5 + m1 * 0.3 + m2 * 0.2);
    }
    return {
      month,
      actualUnits: actual,
      wma3,
      forecastUnits: null,
    };
  });

  // Append next month aggregate forecast from computed forecasts
  if (sortedMonths.length > 0 && forecasts.length > 0) {
    const [y, m] = sortedMonths[sortedMonths.length - 1].split('-').map(Number);
    const nextDt = new Date(Date.UTC(y, m, 1));
    const nextMonthLabel = `${nextDt.getUTCFullYear()}-${String(nextDt.getUTCMonth() + 1).padStart(2, '0')}`;
    const totalProjected = forecasts.reduce((acc, f) => acc + f.seasonallyAdjustedForecast, 0);
    trendChartData.push({
      month: nextMonthLabel,
      actualUnits: null,
      wma3: null,
      forecastUnits: totalProjected,
    });
  }

  // Regional hub valuation bar chart data (saleable stock only)
  const hubChartData = hubs.map((h) => {
    const hubBatches = saleableBatches.filter((b) => b.hubId === h.id);
    const valLakhs = Number(
      (hubBatches.reduce((sum, b) => sum + b.quantity * b.unitCostInr, 0) / 100000).toFixed(2)
    );
    return {
      hub: h.city,
      valuationLakhs: valLakhs,
      batches: hubBatches.length,
    };
  });

  // FEFO watchlist (top 5 nearest expiry active/quarantined batches)
  const fefoWatchlist = [...batches]
    .filter((b) => b.quantity > 0 && b.status !== 'depleted')
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    .slice(0, 5);

  const isDemoActive = demoScopeCounts.demoBatches > 0 || demoScopeCounts.demoSales > 0;

  if (loadingData && batches.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-lg p-5" />
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="h-80 bg-white border border-slate-200 rounded-lg" />
          <div className="h-80 bg-white border border-slate-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isDemoActive && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700">
          <div className="flex items-start sm:items-center gap-2">
            <Info className="w-4 h-4 text-teal-700 mt-0.5 sm:mt-0 shrink-0" />
            <span>
              <strong className="text-[#0F2544]">Synthetic Demonstration Dataset Active:</strong>{' '}
              Seeded batches, 6-month sales logs, and Assam-first corridor scenarios (Guwahati, Tezpur, Silchar, Dibrugarh) are synthetic fixtures for evaluation.
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
            {demoScopeCounts.demoBatches} demo · {demoScopeCounts.userBatches} custom batches
          </span>
        </div>
      )}

      {/* 4-Column Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Saleable Inventory Valuation</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#0F2544]">
            {formatInr(totalValuationInr)}
          </p>
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            {formatNumber(totalActiveUnits)} saleable units · {saleableBatches.length} batches
            {expiredActiveBatches.length > 0 && (
              <span className="block text-red-700 font-medium mt-0.5">
                {expiredActiveBatches.length} expired batch(es) excluded
              </span>
            )}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">30-Day &amp; Expired Exposure</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-red-700">
            {formatInr(expiryRiskValueInr)}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 tabular-nums">
              {criticalExpiryBatches.length} batches at risk
            </span>
            <button
              type="button"
              onClick={() => onNavigate('expiry')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Inspect</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Open Rule Recommendations</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#0F2544]">
            {openRecs.length}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-700 font-medium tabular-nums">
              {openRecs.filter((r) => r.priority === 'critical').length} critical triggers
            </span>
            <button
              type="button"
              onClick={() => onNavigate('recommendations')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Review</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Active Corridor Transfers</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-teal-700">
            {activeTransfersCount}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 tabular-nums">
              Across {hubs.length || 9} NE India hubs
            </span>
            <button
              type="button"
              onClick={() => onNavigate('transfers')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Track</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F2544]">
                Regional Demand &amp; WMA-3 Trajectory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aggregated monthly units dispatched vs. weighted moving-average forecast
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('forecast')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              SKU Forecast →
            </button>
          </div>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="actualUnits"
                  name="Actual Units Sold"
                  fill="#CCFBF1"
                  stroke="#0D9488"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="wma3"
                  name="WMA-3 Baseline"
                  stroke="#0F2544"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Bar
                  dataKey="forecastUnits"
                  name="Next-Month Forecast"
                  fill="#D97706"
                  radius={[4, 4, 0, 0]}
                  barSize={28}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F2544]">
                Saleable Hub Stock Valuation (INR Lakhs)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Unexpired saleable inventory capital across Assam Pilot &amp; NE Expansion depots
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              All Batches →
            </button>
          </div>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hubChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="hub" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip
                  formatter={(value) => [`₹${value ?? 0} Lakhs`, 'Saleable Value']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="valuationLakhs"
                  name="Saleable Valuation (INR Lakhs)"
                  fill="#0F2544"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Bottom Action Queue & FEFO Watchlist */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F2544]">
                Deterministic Action Queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Top priority recommendations from inventory &amp; moving-average rules
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('recommendations')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap cursor-pointer"
            >
              View All ({openRecs.length})
            </button>
          </div>

          {openRecs.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-[#0F2544]">All rule alerts resolved</p>
              <p className="mt-1 text-xs text-slate-500">
                Inventory levels and batch expiries are currently within target operating thresholds.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {openRecs.slice(0, 4).map((rec) => (
                <div
                  key={rec.deterministicKey}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusTag
                        tone={
                          rec.priority === 'critical'
                            ? 'critical'
                            : rec.priority === 'warning'
                            ? 'warning'
                            : 'info'
                        }
                        label={rec.ruleName}
                      />
                      <span className="font-mono text-xs text-slate-500">{rec.skuCode}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-[#0F2544] truncate">
                      {rec.medicineName} · {rec.hubName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{rec.rationale}</p>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-xs font-semibold text-[#0F2544]">
                      {formatInr(rec.estimatedImpactInr)}
                    </span>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => {
                        void applyRecommendation(rec).catch(() => {});
                      }}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Execute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F2544]">FEFO Expiry Watchlist</h2>
              <p className="text-xs text-slate-500 mt-0.5">Nearest expiring stock batches</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expiry')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap cursor-pointer"
            >
              Expiry Matrix →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Medicine / Hub</th>
                  <th className="py-2.5 px-4 text-right">Qty</th>
                  <th className="py-2.5 px-4 text-right">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {fefoWatchlist.map((b) => {
                  const days = getDaysUntilExpiry(b.expiryDate);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-[#0F2544] truncate max-w-[190px]">
                          {b.medicineName}
                        </p>
                        <p className="text-slate-500">
                          {b.hubName} · <span className="font-mono">{b.batchNumber}</span>
                        </p>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#0F2544]">
                        {formatNumber(b.quantity)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`font-mono tabular-nums font-semibold ${
                            days <= 0
                              ? 'text-red-700'
                              : days <= 30
                              ? 'text-red-600'
                              : days <= 60
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {days <= 0 ? 'Expired' : `${days}d`}
                        </span>
                        <p className="font-mono text-[11px] text-slate-400">{b.expiryDate}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* GRD Assam Pilot Challenge Targets (Explicitly labeled as unachieved pilot objectives) */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-display text-sm font-bold text-[#0F2544]">
              GRD Assam Phase-1 Pilot — Challenge Targets (12–16 Week Deployment Objective)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Target operational benchmarks to validate during live distributor rollout (not measured baseline achievements)
            </p>
          </div>
          <StatusTag tone="info" label="Pilot Target Spec" />
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="font-semibold text-[#0F2544]">Phase 1 Scope (Assam)</p>
            <p className="mt-1 text-slate-600">
              Guwahati Central, Tezpur Central Assam, Silchar Barak, and Dibrugarh depots.
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="font-semibold text-[#0F2544]">Stock-Out Reduction Goal</p>
            <p className="mt-1 text-slate-600">
              Target: reduce essential SKU stock-out days via reorder &amp; safety-stock triggers (requires live ERP baseline).
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="font-semibold text-[#0F2544]">FEFO Expiry Recovery Goal</p>
            <p className="mt-1 text-slate-600">
              Target: inter-hub redistribution of 31–60d near-expiry stock before write-off.
            </p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="font-semibold text-[#0F2544]">Forecast Calibration</p>
            <p className="mt-1 text-slate-600">
              Rolling historical MAE &amp; MAPE tracked per SKU in Demand Forecast as actual dispatches accumulate.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
