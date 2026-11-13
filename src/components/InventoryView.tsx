import { useMemo, useState } from 'react';
import { ArrowLeftRight, Edit3, Plus, Search, ShieldAlert } from 'lucide-react';
import { useMediFlow } from '../context/MediFlowContext.tsx';
import {
  formatInr,
  formatNumber,
  getDaysUntilExpiry,
  isBatchExpired,
  MEDICINE_CATEGORIES,
  STORAGE_CONDITIONS,
} from '../lib/validation.ts';
import type { BatchStatus, InventoryBatch } from '../types/pharma.ts';
import { QuarantineTag, StatusTag } from './StatusTag.tsx';

export function InventoryView({
  onOpenAddBatch,
  onOpenAdjustStock,
  onOpenTransferForBatch,
}: {
  onOpenAddBatch: () => void;
  onOpenAdjustStock: (batch: InventoryBatch) => void;
  onOpenTransferForBatch: (batchId: string) => void;
}) {
  const { batches, hubs, quarantineBatch, mutating } = useMediFlow();

  const [search, setSearch] = useState('');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [storageFilter, setStorageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BatchStatus>('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches
      .filter((b) => {
        if (hubFilter !== 'ALL' && b.hubId !== hubFilter) return false;
        if (categoryFilter !== 'ALL' && b.category !== categoryFilter) return false;
        if (storageFilter !== 'ALL' && b.storageCondition !== storageFilter) return false;
        if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
        if (q) {
          const hay = `${b.medicineName} ${b.genericName} ${b.skuCode} ${b.batchNumber} ${b.manufacturer}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }, [batches, categoryFilter, hubFilter, search, statusFilter, storageFilter]);

  const saleableFilteredValue = filtered
    .filter((b) => b.status === 'active' && b.quantity > 0 && !isBatchExpired(b.expiryDate))
    .reduce((acc, b) => acc + b.quantity * b.unitCostInr, 0);
  const expiredActiveInFilter = filtered.filter(
    (b) => b.status === 'active' && b.quantity > 0 && isBatchExpired(b.expiryDate)
  ).length;

  return (
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine, salt, SKU, or batch number..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(['ALL', 'active', 'quarantined', 'depleted'] as const).map((st) => (
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
                {st === 'ALL' ? 'All Statuses' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={hubFilter}
            onChange={(e) => setHubFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-[#0F2544] focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">All Northeast Hubs</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.state})
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-[#0F2544] focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">All Therapeutic Categories</option>
            {MEDICINE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={storageFilter}
            onChange={(e) => setStorageFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-[#0F2544] focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">All Storage Conditions</option>
            {STORAGE_CONDITIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="tabular-nums">
            Showing <strong className="text-[#0F2544]">{filtered.length}</strong> of {batches.length} batches · Sorted FEFO (Earliest Expiry First)
            {expiredActiveInFilter > 0 && (
              <span className="ml-2 text-red-700 font-medium">
                ({expiredActiveInFilter} expired batch(es) excluded from saleable stock)
              </span>
            )}
          </span>
          <span className="font-mono tabular-nums font-semibold text-[#0F2544]">
            Saleable Valuation: {formatInr(saleableFilteredValue)}
          </span>
        </div>
      </div>

      {/* High-Density Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#0F2544]">No matching pharmaceutical batches</p>
            <p className="mt-1 text-xs text-slate-500">
              Adjust your search filters or register a new batch into Cloud Firestore.
            </p>
            <button
              type="button"
              onClick={onOpenAddBatch}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Batch</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Medicine &amp; Salt</th>
                  <th className="py-3 px-4">Batch / SKU</th>
                  <th className="py-3 px-4">Hub &amp; Storage</th>
                  <th className="py-3 px-4 text-right">Stock</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4">Expiry</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((b) => {
                  const days = getDaysUntilExpiry(b.expiryDate);
                  const expired = days <= 0;
                  const isLow = b.status === 'active' && !expired && b.quantity <= b.reorderLevel;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#0F2544] text-sm">{b.medicineName}</p>
                        <p className="text-slate-500 mt-0.5">
                          {b.genericName} · {b.category}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono font-semibold text-[#0F2544]">{b.batchNumber}</p>
                        <p className="font-mono text-slate-500 mt-0.5">{b.skuCode}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#0F2544]">{b.hubName}</p>
                        <p className="text-slate-500 mt-0.5">{b.storageCondition}</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-mono tabular-nums font-bold text-[#0F2544] text-sm">
                          {formatNumber(b.quantity)}
                        </p>
                        <p className="text-slate-500">
                          {b.unit} · Min {b.reorderLevel}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#0F2544]">
                        {formatInr(b.unitCostInr)}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono tabular-nums font-medium text-[#0F2544]">
                          {b.expiryDate}
                        </p>
                        <p
                          className={`font-mono tabular-nums mt-0.5 font-semibold ${
                            expired
                              ? 'text-red-700'
                              : days <= 30
                              ? 'text-red-600'
                              : days <= 60
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {expired ? `Expired (${Math.abs(days)}d ago)` : `${days} days left`}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {b.status === 'quarantined' ? (
                          <QuarantineTag />
                        ) : b.status === 'depleted' ? (
                          <StatusTag tone="neutral" label="Depleted" />
                        ) : expired ? (
                          <StatusTag tone="critical" label="Expired (Non-Saleable)" />
                        ) : isLow ? (
                          <StatusTag tone="warning" label="Below Reorder" />
                        ) : (
                          <StatusTag tone="healthy" label="Healthy" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenAdjustStock(b)}
                            title="Adjust stock quantity"
                            className="p-1.5 text-slate-600 hover:text-[#0F2544] hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {b.status === 'active' && b.quantity > 0 && !expired && (
                            <button
                              type="button"
                              onClick={() => onOpenTransferForBatch(b.id)}
                              title="Transfer batch to another hub"
                              className="p-1.5 text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded border border-teal-200 cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {b.status === 'active' && (
                            <button
                              type="button"
                              disabled={mutating}
                              onClick={() => {
                                void quarantineBatch(b.id).catch(() => {});
                              }}
                              title="Quarantine batch"
                              className="p-1.5 text-red-700 hover:text-red-900 hover:bg-red-50 disabled:opacity-50 rounded border border-red-200 cursor-pointer"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
