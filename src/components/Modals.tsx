import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import {
  getDaysUntilExpiry,
  isBatchExpired,
  MEDICINE_CATEGORIES,
  STORAGE_CONDITIONS,
  TRANSPORT_MODES,
  UNIT_TYPES,
} from '../lib/validation.ts';
import type {
  DistributionHub,
  InventoryBatch,
  MedicineCategory,
  StorageCondition,
  TransportMode,
  UnitType,
} from '../types/pharma.ts';
import type {
  DemoScopeCounts,
  NewBatchInput,
  NewSalesInput,
  NewTransferInput,
} from '../context/MediFlowContext.tsx';

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F2544]">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-500 hover:text-[#0F2544] rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ModalInlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
    >
      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
      <span className="leading-snug">{message}</span>
    </div>
  );
}

export function AddBatchModal({
  hubs,
  mutating,
  onClose,
  onSubmit,
}: {
  hubs: DistributionHub[];
  mutating: boolean;
  onClose: () => void;
  onSubmit: (input: NewBatchInput) => Promise<void>;
}) {
  const defaultExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [skuCode, setSkuCode] = useState('MED-AMX-500');
  const [medicineName, setMedicineName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [category, setCategory] = useState<MedicineCategory>('Antibiotics');
  const [batchNumber, setBatchNumber] = useState(`NE-GH-${String(Date.now()).slice(-4)}`);
  const [manufacturer, setManufacturer] = useState('Cipla Ltd.');
  const [hubId, setHubId] = useState(hubs[0]?.id ?? 'hub-guwahati');
  const [quantity, setQuantity] = useState(350);
  const [unit, setUnit] = useState<UnitType>('Strips');
  const [reorderLevel, setReorderLevel] = useState(150);
  const [unitCostInr, setUnitCostInr] = useState(115);
  const [mrpInr, setMrpInr] = useState(165);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);
  const [storageCondition, setStorageCondition] = useState<StorageCondition>('Ambient (15-25°C)');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      await onSubmit({
        skuCode,
        medicineName,
        genericName,
        category,
        batchNumber,
        manufacturer,
        hubId,
        quantity,
        unit,
        reorderLevel,
        unitCostInr,
        mrpInr,
        expiryDate,
        storageCondition,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save pharmaceutical batch.');
    }
  };

  return (
    <ModalShell
      title="Register Pharmaceutical Batch"
      subtitle="Add a new incoming stock batch to Cloud Firestore with FEFO expiry tracking."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalInlineError message={submitError} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">SKU Code</label>
            <input
              type="text"
              required
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
              placeholder="MED-AMX-500"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Batch Number</label>
            <input
              type="text"
              required
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Brand / Medicine Name</label>
            <input
              type="text"
              required
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              placeholder="Augmentin 625 Duo"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Generic Salt / Composition</label>
            <input
              type="text"
              required
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              placeholder="Amoxicillin + Clavulanic Acid"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Therapeutic Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MedicineCategory)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {MEDICINE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Manufacturer</label>
            <input
              type="text"
              required
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Northeast India Hub</label>
            <select
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.state})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Storage Condition</label>
            <select
              value={storageCondition}
              onChange={(e) => setStorageCondition(e.target.value as StorageCondition)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {STORAGE_CONDITIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as UnitType)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {UNIT_TYPES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Reorder Lvl</label>
            <input
              type="number"
              min={0}
              required
              value={reorderLevel}
              onChange={(e) => setReorderLevel(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Expiry Date</label>
            <input
              type="date"
              required
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Unit Cost (INR)</label>
            <input
              type="number"
              min={1}
              step="0.5"
              required
              value={unitCostInr}
              onChange={(e) => setUnitCostInr(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">MRP (INR)</label>
            <input
              type="number"
              min={1}
              step="0.5"
              required
              value={mrpInr}
              onChange={(e) => setMrpInr(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutating}
            className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg cursor-pointer"
          >
            {mutating ? 'Saving...' : 'Save Batch'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function CreateTransferModal({
  batches,
  hubs,
  preselectedBatchId,
  mutating,
  onClose,
  onSubmit,
}: {
  batches: InventoryBatch[];
  hubs: DistributionHub[];
  preselectedBatchId?: string;
  mutating: boolean;
  onClose: () => void;
  onSubmit: (input: NewTransferInput) => Promise<void>;
}) {
  const transferableBatches = batches.filter(
    (b) => b.status === 'active' && b.quantity > 0 && !isBatchExpired(b.expiryDate)
  );
  const expiredActiveCount = batches.filter(
    (b) => b.status === 'active' && b.quantity > 0 && isBatchExpired(b.expiryDate)
  ).length;

  const initialBatch =
    transferableBatches.find((b) => b.id === preselectedBatchId) ?? transferableBatches[0];

  const [batchId, setBatchId] = useState(initialBatch?.id ?? '');
  const selectedBatch = transferableBatches.find((b) => b.id === batchId) ?? initialBatch;

  const availableTargets = hubs.filter((h) => h.id !== selectedBatch?.hubId);
  const [toHubId, setToHubId] = useState(availableTargets[0]?.id ?? '');
  const [quantity, setQuantity] = useState(
    selectedBatch ? Math.max(1, Math.min(selectedBatch.quantity, Math.round(selectedBatch.quantity * 0.35))) : 1
  );
  const [transportMode, setTransportMode] = useState<TransportMode>(
    selectedBatch?.storageCondition === 'Cold Chain (2-8°C)'
      ? 'Cold-Chain Van'
      : 'Express Highway Cargo'
  );
  const [reason, setReason] = useState('Inter-hub FEFO balancing & corridor replenishment');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBatch && toHubId === selectedBatch.hubId) {
      const nextTarget = hubs.find((h) => h.id !== selectedBatch.hubId);
      if (nextTarget) setToHubId(nextTarget.id);
    }
  }, [hubs, selectedBatch, toHubId]);

  const targetHub = hubs.find((h) => h.id === toHubId);
  const selectedDaysLeft = selectedBatch ? getDaysUntilExpiry(selectedBatch.expiryDate) : 0;
  const transitDays = targetHub ? targetHub.leadTimeDays + targetHub.monsoonBufferDays : 0;
  const insufficientShelfLife = Boolean(
    selectedBatch && targetHub && selectedDaysLeft <= transitDays
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || insufficientShelfLife) return;
    setSubmitError(null);
    try {
      await onSubmit({
        batchId: selectedBatch.id,
        toHubId,
        quantity,
        transportMode,
        reason,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create stock transfer.');
    }
  };

  return (
    <ModalShell
      title="Initiate Inter-Hub Stock Transfer"
      subtitle="Dispatch saleable stock between Northeast India distribution hubs and log an immutable movement entry."
      onClose={onClose}
    >
      {transferableBatches.length === 0 ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p>No unexpired active stock batches are available for transfer.</p>
          {expiredActiveCount > 0 && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {expiredActiveCount} active batch(es) are expired and blocked from inter-hub dispatch. Quarantine expired stock from Expiry Alerts.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <ModalInlineError message={submitError} />

          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">
              Source Batch (Unexpired Saleable Stock Only)
            </label>
            <select
              value={batchId}
              onChange={(e) => {
                const nextId = e.target.value;
                setBatchId(nextId);
                setSubmitError(null);
                const nextB = transferableBatches.find((b) => b.id === nextId);
                if (nextB) {
                  setQuantity(Math.max(1, Math.round(nextB.quantity * 0.35)));
                  if (nextB.storageCondition === 'Cold Chain (2-8°C)') {
                    setTransportMode('Cold-Chain Van');
                  }
                }
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {transferableBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.medicineName} ({b.batchNumber}) — {b.hubName} ({b.quantity} {b.unit}, {getDaysUntilExpiry(b.expiryDate)}d left)
                </option>
              ))}
            </select>
            {expiredActiveCount > 0 && (
              <p className="mt-1 text-[11px] text-slate-500">
                {expiredActiveCount} expired batch(es) excluded from transfer selection.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F2544] mb-1">Origin Hub</label>
              <input
                type="text"
                readOnly
                value={selectedBatch?.hubName ?? ''}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F2544] mb-1">Destination Hub</label>
              <select
                value={toHubId}
                onChange={(e) => {
                  setToHubId(e.target.value);
                  setSubmitError(null);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {availableTargets.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.state}) · {h.leadTimeDays + h.monsoonBufferDays}d transit
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedBatch && targetHub && (
            <div
              className={`px-3.5 py-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                insufficientShelfLife
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {insufficientShelfLife ? (
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">
                  Shelf-Life vs. Corridor Transit Check:{' '}
                  {insufficientShelfLife ? 'Blocked' : 'Cleared'}
                </p>
                <p className="mt-0.5 font-mono">
                  Batch remaining life: {selectedDaysLeft}d · Destination transit ({targetHub.leadTimeDays}d + {targetHub.monsoonBufferDays}d buffer): {transitDays}d
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F2544] mb-1">
                Quantity ({selectedBatch?.unit}) · Max {selectedBatch?.quantity}
              </label>
              <input
                type="number"
                min={1}
                max={selectedBatch?.quantity ?? 1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F2544] mb-1">Transport Corridor Mode</label>
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value as TransportMode)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {TRANSPORT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Transfer Rationale</label>
            <textarea
              rows={2}
              required
              minLength={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutating || insufficientShelfLife || availableTargets.length === 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              {mutating ? 'Dispatching...' : 'Create Transfer'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

export function AdjustStockModal({
  batch,
  mutating,
  onClose,
  onSubmit,
}: {
  batch: InventoryBatch;
  mutating: boolean;
  onClose: () => void;
  onSubmit: (batchId: string, newQuantity: number) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(batch.quantity);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      await onSubmit(batch.id, quantity);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to adjust batch quantity.');
    }
  };

  return (
    <ModalShell
      title="Adjust Batch Stock Quantity"
      subtitle={`${batch.medicineName} · Batch ${batch.batchNumber} · ${batch.hubName}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalInlineError message={submitError} />

        <div>
          <label className="block text-xs font-semibold text-[#0F2544] mb-1">
            Updated Quantity ({batch.unit})
          </label>
          <input
            type="number"
            min={0}
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Setting quantity to 0 automatically marks the batch as depleted.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutating}
            className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg cursor-pointer"
          >
            {mutating ? 'Updating...' : 'Update Quantity'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function LogSalesModal({
  batches,
  hubs,
  mutating,
  onClose,
  onSubmit,
}: {
  batches: InventoryBatch[];
  hubs: DistributionHub[];
  mutating: boolean;
  onClose: () => void;
  onSubmit: (input: NewSalesInput) => Promise<void>;
}) {
  const uniqueSkus = Array.from(
    new Map(batches.map((b) => [b.skuCode, b])).values()
  );
  const [selectedSku, setSelectedSku] = useState(uniqueSkus[0]?.skuCode ?? 'MED-AMX-500');
  const skuMeta = uniqueSkus.find((b) => b.skuCode === selectedSku);

  const [hubId, setHubId] = useState(hubs[0]?.id ?? 'hub-guwahati');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [unitsSold, setUnitsSold] = useState(250);
  const [seasonalFactor, setSeasonalFactor] = useState(1.1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuMeta) {
      setSubmitError('Please register at least one SKU batch before logging sales.');
      return;
    }
    setSubmitError(null);
    try {
      await onSubmit({
        skuCode: skuMeta.skuCode,
        medicineName: skuMeta.medicineName,
        category: skuMeta.category,
        hubId,
        month,
        unitsSold,
        unitCostInr: skuMeta.unitCostInr,
        seasonalFactor,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to log monthly sales.');
    }
  };

  return (
    <ModalShell
      title="Log Monthly Sales Dispatch"
      subtitle="Persist monthly consumption in Firestore and recalculate Moving-Average forecasts."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalInlineError message={submitError} />

        <div>
          <label className="block text-xs font-semibold text-[#0F2544] mb-1">SKU &amp; Medicine</label>
          <select
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {uniqueSkus.map((s) => (
              <option key={s.skuCode} value={s.skuCode}>
                {s.skuCode} — {s.medicineName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Distribution Hub</label>
            <select
              value={hubId}
              onChange={(e) => setHubId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Sales Month (YYYY-MM)</label>
            <input
              type="month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Units Dispatched</label>
            <input
              type="number"
              min={1}
              required
              value={unitsSold}
              onChange={(e) => setUnitsSold(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">Monsoon / Seasonal Index</label>
            <input
              type="number"
              min={0.5}
              max={2.5}
              step="0.05"
              required
              value={seasonalFactor}
              onChange={(e) => setSeasonalFactor(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutating}
            className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg cursor-pointer"
          >
            {mutating ? 'Recording...' : 'Record Sales'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function EditHubLeadTimeModal({
  hub,
  mutating,
  onClose,
  onSubmit,
}: {
  hub: DistributionHub;
  mutating: boolean;
  onClose: () => void;
  onSubmit: (hubId: string, leadTimeDays: number, monsoonBufferDays: number) => Promise<void>;
}) {
  const [leadTimeDays, setLeadTimeDays] = useState(hub.leadTimeDays);
  const [monsoonBufferDays, setMonsoonBufferDays] = useState(hub.monsoonBufferDays);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      await onSubmit(hub.id, leadTimeDays, monsoonBufferDays);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save hub lead-time parameters.');
    }
  };

  return (
    <ModalShell
      title="Configure Hub Corridor Lead Time"
      subtitle={`${hub.name} (${hub.state}) · ${hub.pilotPhase}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ModalInlineError message={submitError} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">
              Base Transit Lead Time (Days)
            </label>
            <input
              type="number"
              min={1}
              max={45}
              required
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F2544] mb-1">
              Monsoon Safety Buffer (Days)
            </label>
            <input
              type="number"
              min={0}
              max={30}
              required
              value={monsoonBufferDays}
              onChange={(e) => setMonsoonBufferDays(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
          <p className="font-semibold text-[#0F2544]">
            Effective Planning Lead Time:{' '}
            <span className="font-mono text-teal-700">
              {Math.max(1, Math.round(leadTimeDays)) + Math.max(0, Math.round(monsoonBufferDays))} days
            </span>
          </p>
          <p>
            Safety stock, reorder points, and transfer shelf-life checks for {hub.city} immediately recompute from this workspace setting.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutating}
            className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg cursor-pointer"
          >
            {mutating ? 'Saving...' : 'Save Parameters'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function ResetDemoModal({
  counts,
  mutating,
  onClose,
  onConfirm,
}: {
  counts: DemoScopeCounts;
  mutating: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to reset demonstration data.');
    }
  };

  return (
    <ModalShell
      title="Reset Synthetic Demo Dataset"
      subtitle="Only synthetic demonstration records will be refreshed. Your custom records remain untouched."
      onClose={onClose}
    >
      <div className="space-y-4">
        <ModalInlineError message={submitError} />

        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
          <p className="font-semibold">Scope of Reset Operation</p>
          <p>
            This action replaces only synthetic seed documents (demo inventory batches, demo monthly sales history, and demo transfers) with fresh Northeast India demonstration fixtures.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <p className="font-semibold text-[#0F2544]">Synthetic Demo Records (Refreshed)</p>
            <ul className="mt-2 space-y-1 font-mono text-slate-600">
              <li>Batches: {counts.demoBatches}</li>
              <li>Sales Logs: {counts.demoSales}</li>
              <li>Transfers: {counts.demoTransfers}</li>
            </ul>
          </div>
          <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/70">
            <p className="font-semibold text-emerald-900">Your Custom Records (Preserved)</p>
            <ul className="mt-2 space-y-1 font-mono text-emerald-800">
              <li>Batches: {counts.userBatches}</li>
              <li>Sales Logs: {counts.userSales}</li>
              <li>Transfers: {counts.userTransfers}</li>
            </ul>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={mutating}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mutating}
            onClick={handleConfirm}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#0F2544] hover:bg-[#17355E] disabled:opacity-50 rounded-lg cursor-pointer"
          >
            {mutating ? 'Resetting Demo...' : 'Confirm Reset Demo'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
