import { useMemo, useState } from 'react';
import { ArrowLeftRight, ShieldAlert } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMediFlow } from '../context/MediFlowContext.tsx';
import { formatInr, formatNumber, getDaysUntilExpiry, getExpirySeverity } from '../lib/validation.ts';
import { QuarantineTag, StatusTag } from './StatusTag.tsx';

type ExpiryBucketFilter = 'ALL' | 'expired' | 'critical' | 'warning' | 'watch';

export function ExpiryAlertsView({
  onOpenTransferForBatch,
}: {
  onOpenTransferForBatch: (batchId: string) => void;
}) {
  const { batches, quarantineBatch, mutating } = useMediFlow();
  const [bucketFilter, setBucketFilter] = useState<ExpiryBucketFilter>('ALL');

  const trackedBatches = useMemo(() => {
    return batches
      .filter((b) => b.quantity > 0 && b.status !== 'depleted')
      .map((b) => {
        const daysLeft = getDaysUntilExpiry(b.expiryDate);
        const severity = getExpirySeverity(daysLeft);
        const valueInr = Math.round(b.quantity * b.unitCostInr);
        return { ...b, daysLeft, severity, valueInr };
      })
      .filter((b) => b.severity !== 'healthy')
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [batches]);

  const bucketStats = useMemo(() => {
    const init = {
      expired: { count: 0, valueInr: 0 },
      critical: { count: 0, valueInr: 0 },
      warning: { count: 0, valueInr: 0 },
      watch: { count: 0, valueInr: 0 },
    };
    for (const b of trackedBatches) {
      if (b.severity in init) {
        const key = b.severity as keyof typeof init;
        init[key].count += 1;
        init[key].valueInr += b.valueInr;
      }
    }
    return init;
  }, [trackedBatches]);

  const chartData = [
    { window: 'Expired', valueLakhs: Number((bucketStats.expired.valueInr / 100000).toFixed(2)), color: '#991B1B' },
    { window: '0–30 Days', valueLakhs: Number((bucketStats.critical.valueInr / 100000).toFixed(2)), color: '#DC2626' },
    { window: '31–60 Days', valueLakhs: Number((bucketStats.warning.valueInr / 100000).toFixed(2)), color: '#D97706' },
    { window: '61–90 Days', valueLakhs: Number((bucketStats.watch.valueInr / 100000).toFixed(2)), color: '#0D9488' },
  ];

  const displayed = trackedBatches.filter((b) =>
    bucketFilter === 'ALL' ? true : b.severity === bucketFilter
  );

  return (
    <div className="space-y-6">
      {/* 4 Risk Buckets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setBucketFilter(bucketFilter === 'expired' ? 'ALL' : 'expired')}
          className={`text-left bg-white border rounded-lg p-5 transition-colors cursor-pointer ${
            bucketFilter === 'expired' ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Already Expired</span>
            <StatusTag tone="critical" label="Quarantine" />
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-red-700">
            {formatInr(bucketStats.expired.valueInr)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {bucketStats.expired.count} batch(es) requiring isolation
          </p>
        </button>

        <button
          type="button"
          onClick={() => setBucketFilter(bucketFilter === 'critical' ? 'ALL' : 'critical')}
          className={`text-left bg-white border rounded-lg p-5 transition-colors cursor-pointer ${
            bucketFilter === 'critical' ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Critical (1–30 Days)</span>
            <StatusTag tone="critical" label="Urgent" />
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-red-600">
            {formatInr(bucketStats.critical.valueInr)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {bucketStats.critical.count} batch(es) in immediate window
          </p>
        </button>

        <button
          type="button"
          onClick={() => setBucketFilter(bucketFilter === 'warning' ? 'ALL' : 'warning')}
          className={`text-left bg-white border rounded-lg p-5 transition-colors cursor-pointer ${
            bucketFilter === 'warning' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Warning (31–60 Days)</span>
            <StatusTag tone="warning" label="Transfer Window" />
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-amber-700">
            {formatInr(bucketStats.warning.valueInr)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {bucketStats.warning.count} batch(es) suitable for redistribution
          </p>
        </button>

        <button
          type="button"
          onClick={() => setBucketFilter(bucketFilter === 'watch' ? 'ALL' : 'watch')}
          className={`text-left bg-white border rounded-lg p-5 transition-colors cursor-pointer ${
            bucketFilter === 'watch' ? 'border-teal-600 ring-1 ring-teal-600' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Watchlist (61–90 Days)</span>
            <StatusTag tone="info" label="Monitor" />
          </div>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-teal-700">
            {formatInr(bucketStats.watch.valueInr)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {bucketStats.watch.count} batch(es) in 90-day horizon
          </p>
        </button>
      </div>

      {/* Expiry Exposure Chart */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F2544]">
              Capital-at-Risk by Expiry Window (INR Lakhs)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any card above to filter the FEFO resolution table below
            </p>
          </div>
          {bucketFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setBucketFilter('ALL')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>
        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="window" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
              <Tooltip
                formatter={(val) => [`₹${val ?? 0} Lakhs`, 'Capital at Risk']}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="valueLakhs" name="Exposure (INR Lakhs)" radius={[4, 4, 0, 0]} barSize={48}>
                {chartData.map((entry) => (
                  <Cell key={entry.window} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* FEFO Resolution Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-bold text-[#0F2544]">
            Expiry Risk Batches ({displayed.length})
          </h2>
          <span className="text-xs text-slate-500">Sorted by fewest remaining days</span>
        </div>

        {displayed.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No batches in this expiry risk window.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Medicine &amp; Batch</th>
                  <th className="py-3 px-4">Hub</th>
                  <th className="py-3 px-4 text-right">Stock</th>
                  <th className="py-3 px-4 text-right">Value at Risk</th>
                  <th className="py-3 px-4">Expiry Countdown</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {displayed.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0F2544] text-sm">{b.medicineName}</p>
                      <p className="font-mono text-slate-500 mt-0.5">
                        {b.batchNumber} · {b.skuCode}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-[#0F2544] font-medium">{b.hubName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#0F2544]">
                      {formatNumber(b.quantity)} {b.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0F2544]">
                      {formatInr(b.valueInr)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-mono tabular-nums font-bold ${
                          b.daysLeft <= 30 ? 'text-red-700' : b.daysLeft <= 60 ? 'text-amber-700' : 'text-teal-700'
                        }`}
                      >
                        {b.daysLeft <= 0 ? `Expired (${Math.abs(b.daysLeft)}d ago)` : `${b.daysLeft} days`}
                      </span>
                      <p className="font-mono text-slate-400">{b.expiryDate}</p>
                    </td>
                    <td className="py-3 px-4">
                      {b.status === 'quarantined' ? (
                        <QuarantineTag />
                      ) : b.severity === 'expired' ? (
                        <StatusTag tone="critical" label="Expired Active" />
                      ) : b.severity === 'critical' ? (
                        <StatusTag tone="critical" label="Critical <=30d" />
                      ) : b.severity === 'warning' ? (
                        <StatusTag tone="warning" label="Warning 31-60d" />
                      ) : (
                        <StatusTag tone="info" label="Watch 61-90d" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {b.daysLeft <= 0 && b.status === 'active' && (
                          <button
                            type="button"
                            disabled={mutating}
                            onClick={() => {
                              void quarantineBatch(b.id).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Quarantine</span>
                          </button>
                        )}
                        {b.daysLeft > 0 && b.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => onOpenTransferForBatch(b.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>Redistribute</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
