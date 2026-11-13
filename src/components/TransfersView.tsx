import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Edit3, Plus, Send, XCircle } from 'lucide-react';
import { useMediFlow } from '../context/MediFlowContext.tsx';
import { formatInr, formatNumber } from '../lib/validation.ts';
import type { DistributionHub, TransferStatus } from '../types/pharma.ts';
import { StatusTag, TransferStatusTag } from './StatusTag.tsx';

export function TransfersView({
  onOpenNewTransfer,
  onOpenEditHub,
}: {
  onOpenNewTransfer: () => void;
  onOpenEditHub: (hub: DistributionHub) => void;
}) {
  const { transfers, hubs, stockMovements, advanceTransferStatus, mutating } = useMediFlow();
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransferStatus>('ALL');

  const filtered = useMemo(() => {
    return transfers.filter((t) => (statusFilter === 'ALL' ? true : t.status === statusFilter));
  }, [statusFilter, transfers]);

  const summary = useMemo(() => {
    let pending = 0;
    let inTransit = 0;
    let completedValue = 0;
    for (const t of transfers) {
      if (t.status === 'pending') pending += 1;
      if (t.status === 'in_transit') inTransit += 1;
      if (t.status === 'completed') completedValue += t.estimatedValueInr;
    }
    return { pending, inTransit, completedValue };
  }, [transfers]);

  return (
    <div className="space-y-6">
      {/* KPI Summary & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Pending Dispatch</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-[#0F2544]">
            {summary.pending}
          </p>
          <p className="mt-1 text-xs text-slate-500">Awaiting carrier loading</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">In Transit Corridors</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-amber-700">
            {summary.inTransit}
          </p>
          <p className="mt-1 text-xs text-slate-500">Active highway &amp; hill routes</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Completed Transfer Value</p>
          <p className="mt-2 font-mono tabular-nums text-2xl font-bold text-emerald-700">
            {formatInr(summary.completedValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Rebalanced across NE depots</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {(['ALL', 'pending', 'in_transit', 'completed', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer capitalize whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white text-[#0F2544] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F2544]'
              }`}
            >
              {st === 'ALL' ? 'All Transfers' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenNewTransfer}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {/* Transfers Ledger */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#0F2544]">No stock transfers in this filter</p>
            <p className="mt-1 text-xs text-slate-500">
              Initiate a transfer to balance near-expiry or low-stock batches across Northeast India hubs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Medicine &amp; Batch</th>
                  <th className="py-3 px-4">Corridor Route</th>
                  <th className="py-3 px-4">Transport Mode</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0F2544] text-sm">{t.medicineName}</p>
                      <p className="font-mono text-slate-500 mt-0.5">
                        {t.batchNumber} · {t.skuCode}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-[#0F2544]">
                        <span>{t.fromHubName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        <span>{t.toHubName}</span>
                      </div>
                      <p className="text-slate-500 mt-0.5 max-w-xs truncate">{t.reason}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{t.transportMode}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0F2544]">
                      {formatNumber(t.quantity)} {t.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#0F2544]">
                      {formatInr(t.estimatedValueInr)}
                    </td>
                    <td className="py-3 px-4">
                      <TransferStatusTag status={t.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {t.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={mutating}
                              onClick={() => {
                                void advanceTransferStatus(t.id, 'in_transit').catch(() => {});
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0F2544] hover:bg-[#17355E] disabled:opacity-50 text-white text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap"
                            >
                              <Send className="w-3 h-3" />
                              <span>Dispatch</span>
                            </button>
                            <button
                              type="button"
                              disabled={mutating}
                              onClick={() => {
                                void advanceTransferStatus(t.id, 'cancelled').catch(() => {});
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          </>
                        )}
                        {t.status === 'in_transit' && (
                          <button
                            type="button"
                            disabled={mutating}
                            onClick={() => {
                              void advanceTransferStatus(t.id, 'completed').catch(() => {});
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Received</span>
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

      {/* Northeast India Hub Lead-Time Reference & Configuration */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-bold text-[#0F2544]">
            Northeast India Distribution Corridor Parameters
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable transit lead times and monsoon safety buffers applied across forecasting, replenishment, and transfer shelf-life validation
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-4">Hub Name</th>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-4">Pilot Phase</th>
                <th className="py-2.5 px-4">Corridor Role</th>
                <th className="py-2.5 px-4 text-right">Lead Time</th>
                <th className="py-2.5 px-4 text-right">Monsoon Buffer</th>
                <th className="py-2.5 px-4 text-right">Total Transit</th>
                <th className="py-2.5 px-4 text-right">Cold-Chain Cap</th>
                <th className="py-2.5 px-4 text-right">Configure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {hubs.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-semibold text-[#0F2544]">{h.name}</td>
                  <td className="py-2.5 px-4 text-slate-600">{h.state}</td>
                  <td className="py-2.5 px-4">
                    <StatusTag
                      tone={h.pilotPhase === 'Phase 1 (Assam Pilot)' ? 'info' : 'neutral'}
                      label={h.pilotPhase}
                    />
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{h.corridorRole}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#0F2544]">
                    {h.leadTimeDays}d
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                    +{h.monsoonBufferDays}d
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-[#0F2544]">
                    {h.leadTimeDays + h.monsoonBufferDays}d
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-teal-700">
                    {formatNumber(h.coldChainCapacityUnits)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => onOpenEditHub(h)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#0F2544] bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded cursor-pointer whitespace-nowrap"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Lead Time</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Immutable Stock Movement & Audit Ledger */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-[#0F2544]">
              Immutable Stock Movement &amp; Audit Ledger ({stockMovements.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Append-only movement history capturing batch receipts, adjustments, quarantines, and inter-hub transfers
            </p>
          </div>
          <StatusTag tone="healthy" label="Append-Only Log" />
        </div>
        {stockMovements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No stock movement audit entries recorded yet. Perform an inventory adjustment, quarantine, or transfer to record an immutable ledger entry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Timestamp / Actor</th>
                  <th className="py-2.5 px-4">Event</th>
                  <th className="py-2.5 px-4">Medicine / Batch</th>
                  <th className="py-2.5 px-4">Hub / Corridor</th>
                  <th className="py-2.5 px-4 text-right">Delta</th>
                  <th className="py-2.5 px-4 text-right">Qty After</th>
                  <th className="py-2.5 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {stockMovements.slice(0, 50).map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4">
                      <p className="font-mono text-[#0F2544] whitespace-nowrap">
                        {m.timestampIso.replace('T', ' ').slice(0, 19)} UTC
                      </p>
                      <p className="text-slate-500 truncate max-w-[180px]">{m.actorEmail}</p>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-[#0F2544] border border-slate-200 whitespace-nowrap">
                        {m.movementType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-[#0F2544]">{m.medicineName}</p>
                      <p className="font-mono text-slate-500">
                        {m.batchNumber} · {m.skuCode}
                      </p>
                    </td>
                    <td className="py-2.5 px-4 text-[#0F2544]">
                      <span>{m.hubName}</span>
                      {m.targetHubName && (
                        <span className="text-slate-500"> → {m.targetHubName}</span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        m.quantityDelta > 0
                          ? 'text-emerald-700'
                          : m.quantityDelta < 0
                          ? 'text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {m.quantityDelta > 0 ? `+${formatNumber(m.quantityDelta)}` : formatNumber(m.quantityDelta)} {m.unit}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#0F2544] whitespace-nowrap">
                      {formatNumber(m.quantityAfter)} {m.unit}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate" title={m.reason}>
                      {m.reason}
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
