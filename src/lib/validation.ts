import type {
  DistributionHub,
  HubLeadTimeOverride,
  MedicineCategory,
  StorageCondition,
  TransportMode,
  UnitType,
} from '../types/pharma.ts';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  SKU_PATTERN: /^[A-Z0-9_-]+$/,
  BATCH_PATTERN: /^[A-Z0-9_-]+$/,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  MONTH_PATTERN: /^\d{4}-\d{2}$/,
  MAX_ID_LEN: 128,
  MAX_SKU_LEN: 32,
  MAX_BATCH_LEN: 40,
  MAX_NAME_LEN: 140,
  MAX_REASON_LEN: 300,
  MAX_RATIONALE_LEN: 400,
};

export const MEDICINE_CATEGORIES: MedicineCategory[] = [
  'Antibiotics',
  'Antidiabetics',
  'Cardiovascular',
  'Pediatrics & ORS',
  'Cold-Chain Biologics',
  'Analgesics & Antipyretics',
];

export const UNIT_TYPES: UnitType[] = [
  'Strips',
  'Vials',
  'Bottles',
  'Boxes',
  'Sachets',
  'Prefilled Syringes',
];

export const STORAGE_CONDITIONS: StorageCondition[] = [
  'Ambient (15-25°C)',
  'Cold Chain (2-8°C)',
  'Cool Dry (<20°C)',
];

export const TRANSPORT_MODES: TransportMode[] = [
  'Cold-Chain Van',
  'Express Highway Cargo',
  'Hill-Route Insulated Carrier',
];

export function sanitizeId(raw: string, prefix = 'id'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);
  return cleaned.length > 0 ? cleaned : `${prefix}_${Date.now()}`;
}

export function sanitizeUpperCode(raw: string, maxLen: number): string {
  return raw
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_-]/g, '-')
    .slice(0, maxLen);
}

export function clampText(raw: string, minLen: number, maxLen: number, fallback = 'N/A'): string {
  const trimmed = raw.trim().slice(0, maxLen);
  if (trimmed.length < minLen) return fallback;
  return trimmed;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('en-IN').format(val);
}

export function isDemoDocumentId(id: string): boolean {
  return (
    id.includes('_batch_seed_') ||
    id.includes('_sale_seed_') ||
    id.includes('_xfer_seed_') ||
    id.startsWith('batch_seed_') ||
    id.startsWith('sale_seed_') ||
    id.startsWith('xfer_seed_')
  );
}

export function getDaysUntilExpiry(expiryDateIso: string, referenceDate = new Date()): number {
  const target = new Date(`${expiryDateIso}T00:00:00Z`);
  const todayUtc = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  );
  return Math.round((target.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24));
}

export function isBatchExpired(expiryDateIso: string, referenceDate = new Date()): boolean {
  return getDaysUntilExpiry(expiryDateIso, referenceDate) <= 0;
}

export function getExpirySeverity(daysLeft: number): 'expired' | 'critical' | 'warning' | 'watch' | 'healthy' {
  if (daysLeft <= 0) return 'expired';
  if (daysLeft <= 30) return 'critical';
  if (daysLeft <= 60) return 'warning';
  if (daysLeft <= 90) return 'watch';
  return 'healthy';
}

export function applyHubOverrides(
  hubs: DistributionHub[],
  overrides?: Record<string, HubLeadTimeOverride>
): DistributionHub[] {
  if (!overrides) return hubs;
  return hubs.map((h) => {
    const ov = overrides[h.id];
    if (!ov) return h;
    return {
      ...h,
      leadTimeDays:
        typeof ov.leadTimeDays === 'number' && Number.isFinite(ov.leadTimeDays)
          ? Math.max(1, Math.min(45, Math.round(ov.leadTimeDays)))
          : h.leadTimeDays,
      monsoonBufferDays:
        typeof ov.monsoonBufferDays === 'number' && Number.isFinite(ov.monsoonBufferDays)
          ? Math.max(0, Math.min(30, Math.round(ov.monsoonBufferDays)))
          : h.monsoonBufferDays,
    };
  });
}

