export type MedicineCategory =
  | 'Antibiotics'
  | 'Antidiabetics'
  | 'Cardiovascular'
  | 'Pediatrics & ORS'
  | 'Cold-Chain Biologics'
  | 'Analgesics & Antipyretics';

export type UnitType =
  | 'Strips'
  | 'Vials'
  | 'Bottles'
  | 'Boxes'
  | 'Sachets'
  | 'Prefilled Syringes';

export type StorageCondition =
  | 'Ambient (15-25°C)'
  | 'Cold Chain (2-8°C)'
  | 'Cool Dry (<20°C)';

export type BatchStatus = 'active' | 'quarantined' | 'depleted';

export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled';

export type TransportMode =
  | 'Cold-Chain Van'
  | 'Express Highway Cargo'
  | 'Hill-Route Insulated Carrier';

export type RecommendationPriority = 'critical' | 'warning' | 'info';

export type RecommendationActionType =
  | 'transfer'
  | 'reorder'
  | 'clearance'
  | 'quarantine'
  | 'buffer';

export type RecommendationStatus = 'open' | 'applied' | 'dismissed';

export type NavSection =
  | 'dashboard'
  | 'inventory'
  | 'expiry'
  | 'forecast'
  | 'recommendations'
  | 'transfers';

export type PilotPhase = 'Phase 1 (Assam Pilot)' | 'Phase 2 (NE Expansion)';

export type StockMovementType =
  | 'batch_add'
  | 'stock_adjust'
  | 'quarantine'
  | 'clearance'
  | 'reorder_receive'
  | 'transfer_out'
  | 'transfer_in'
  | 'transfer_cancel';

export interface HubLeadTimeOverride {
  leadTimeDays: number;
  monsoonBufferDays: number;
}

export interface DistributionHub {
  id: string;
  name: string;
  city: string;
  state: string;
  corridorRole: string;
  leadTimeDays: number;
  monsoonBufferDays: number;
  coldChainCapacityUnits: number;
  isHillCorridor: boolean;
  pilotPhase: PilotPhase;
}

export interface WorkspaceConfig {
  id: string;
  ownerId: string;
  name: string;
  region: string;
  primaryHubId: string;
  seeded: boolean;
  hubOverrides?: Record<string, HubLeadTimeOverride>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InventoryBatch {
  id: string;
  ownerId: string;
  workspaceId: string;
  skuCode: string;
  medicineName: string;
  genericName: string;
  category: MedicineCategory;
  batchNumber: string;
  manufacturer: string;
  hubId: string;
  hubName: string;
  quantity: number;
  unit: UnitType;
  reorderLevel: number;
  unitCostInr: number;
  mrpInr: number;
  expiryDate: string; // YYYY-MM-DD
  storageCondition: StorageCondition;
  status: BatchStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SalesHistoryRecord {
  id: string;
  ownerId: string;
  workspaceId: string;
  skuCode: string;
  medicineName: string;
  category: MedicineCategory;
  hubId: string;
  month: string; // YYYY-MM
  unitsSold: number;
  revenueInr: number;
  seasonalFactor: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StockTransfer {
  id: string;
  ownerId: string;
  workspaceId: string;
  batchId: string;
  skuCode: string;
  medicineName: string;
  batchNumber: string;
  fromHubId: string;
  fromHubName: string;
  toHubId: string;
  toHubName: string;
  quantity: number;
  unit: UnitType;
  estimatedValueInr: number;
  transportMode: TransportMode;
  reason: string;
  status: TransferStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StockMovementRecord {
  id: string;
  ownerId: string;
  workspaceId: string;
  movementType: StockMovementType;
  skuCode: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  hubId: string;
  hubName: string;
  targetHubId: string;
  targetHubName: string;
  quantityDelta: number;
  quantityAfter: number;
  unit: UnitType;
  reason: string;
  actorUid: string;
  actorEmail: string;
  timestampIso: string;
  createdAt?: unknown;
}

export interface RecommendationRecord {
  id: string;
  ownerId: string;
  workspaceId: string;
  ruleId: string;
  priority: RecommendationPriority;
  actionType: RecommendationActionType;
  skuCode: string;
  medicineName: string;
  batchId: string;
  hubId: string;
  targetHubId: string;
  suggestedQty: number;
  estimatedImpactInr: number;
  rationale: string;
  status: RecommendationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ForecastMonthlyPoint {
  month: string;
  actualUnits: number | null;
  sma3: number | null;
  wma3: number | null;
  backtestForecast: number | null;
  projectedUnits: number | null;
}

export interface SkuForecastResult {
  skuCode: string;
  medicineName: string;
  category: MedicineCategory;
  hubId: string;
  hubName: string;
  currentStock: number;
  sma3: number;
  sma6: number;
  wma3: number;
  seasonalFactor: number;
  seasonallyAdjustedForecast: number;
  dailyBurnRate: number;
  daysOfCover: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedOrderQty: number;
  trendPct: number;
  mapePct: number | null;
  maeUnits: number | null;
  backtestPoints: number;
  stockHealth: 'healthy' | 'low' | 'critical' | 'overstock';
  series: ForecastMonthlyPoint[];
}

export interface EvaluatedRecommendation {
  deterministicKey: string;
  ruleId: string;
  ruleName: string;
  priority: RecommendationPriority;
  actionType: RecommendationActionType;
  skuCode: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  hubId: string;
  hubName: string;
  targetHubId: string;
  targetHubName: string;
  suggestedQty: number;
  unit: UnitType;
  estimatedImpactInr: number;
  rationale: string;
}

