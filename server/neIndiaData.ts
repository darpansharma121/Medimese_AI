import type {
  DistributionHub,
  MedicineCategory,
  StorageCondition,
  UnitType,
} from '../src/types/pharma.ts';

export const NE_INDIA_HUBS: DistributionHub[] = [
  {
    id: 'hub-guwahati',
    name: 'Guwahati Central Hub',
    city: 'Guwahati',
    state: 'Assam',
    corridorRole: 'Primary Regional Gateway & C&F Depot',
    leadTimeDays: 2,
    monsoonBufferDays: 1,
    coldChainCapacityUnits: 45000,
    isHillCorridor: false,
    pilotPhase: 'Phase 1 (Assam Pilot)',
  },
  {
    id: 'hub-tezpur',
    name: 'Tezpur Central Assam Depot',
    city: 'Tezpur',
    state: 'Assam',
    corridorRole: 'North-Bank Brahmaputra & Sonitpur Feeder',
    leadTimeDays: 3,
    monsoonBufferDays: 2,
    coldChainCapacityUnits: 16000,
    isHillCorridor: false,
    pilotPhase: 'Phase 1 (Assam Pilot)',
  },
  {
    id: 'hub-silchar',
    name: 'Silchar Barak Depot',
    city: 'Silchar',
    state: 'Assam',
    corridorRole: 'Barak Valley & Southern Feeder',
    leadTimeDays: 5,
    monsoonBufferDays: 3,
    coldChainCapacityUnits: 14000,
    isHillCorridor: true,
    pilotPhase: 'Phase 1 (Assam Pilot)',
  },
  {
    id: 'hub-dibrugarh',
    name: 'Dibrugarh Upper Assam Hub',
    city: 'Dibrugarh',
    state: 'Assam',
    corridorRole: 'Upper Assam & Arunachal East Corridor',
    leadTimeDays: 4,
    monsoonBufferDays: 2,
    coldChainCapacityUnits: 18000,
    isHillCorridor: false,
    pilotPhase: 'Phase 1 (Assam Pilot)',
  },
  {
    id: 'hub-shillong',
    name: 'Shillong Meghalaya Hub',
    city: 'Shillong',
    state: 'Meghalaya',
    corridorRole: 'Khasi-Jaintia Hill Cold-Chain Node',
    leadTimeDays: 4,
    monsoonBufferDays: 2,
    coldChainCapacityUnits: 12000,
    isHillCorridor: true,
    pilotPhase: 'Phase 2 (NE Expansion)',
  },
  {
    id: 'hub-imphal',
    name: 'Imphal Manipur Hub',
    city: 'Imphal',
    state: 'Manipur',
    corridorRole: 'NH-2 & NH-37 Valley Supply Hub',
    leadTimeDays: 7,
    monsoonBufferDays: 4,
    coldChainCapacityUnits: 15000,
    isHillCorridor: true,
    pilotPhase: 'Phase 2 (NE Expansion)',
  },
  {
    id: 'hub-agartala',
    name: 'Agartala Tripura Depot',
    city: 'Agartala',
    state: 'Tripura',
    corridorRole: 'Tripura State Hospital & Retail Feeder',
    leadTimeDays: 6,
    monsoonBufferDays: 2,
    coldChainCapacityUnits: 13500,
    isHillCorridor: false,
    pilotPhase: 'Phase 2 (NE Expansion)',
  },
  {
    id: 'hub-dimapur',
    name: 'Dimapur Nagaland Hub',
    city: 'Dimapur',
    state: 'Nagaland',
    corridorRole: 'Nagaland Railhead & Foothill Distribution',
    leadTimeDays: 5,
    monsoonBufferDays: 3,
    coldChainCapacityUnits: 11000,
    isHillCorridor: true,
    pilotPhase: 'Phase 2 (NE Expansion)',
  },
  {
    id: 'hub-aizawl',
    name: 'Aizawl Mizoram Depot',
    city: 'Aizawl',
    state: 'Mizoram',
    corridorRole: 'High-Altitude NH-306 Supply Node',
    leadTimeDays: 8,
    monsoonBufferDays: 4,
    coldChainCapacityUnits: 9500,
    isHillCorridor: true,
    pilotPhase: 'Phase 2 (NE Expansion)',
  },
];

interface SkuCatalogItem {
  skuCode: string;
  medicineName: string;
  genericName: string;
  category: MedicineCategory;
  manufacturer: string;
  unit: UnitType;
  unitCostInr: number;
  mrpInr: number;
  storageCondition: StorageCondition;
  baseMonthlyDemand: number;
}

const SKU_CATALOG: SkuCatalogItem[] = [
  {
    skuCode: 'MED-AMX-500',
    medicineName: 'Moxikind-CV 625 Tablets',
    genericName: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
    category: 'Antibiotics',
    manufacturer: 'Mankind Pharma',
    unit: 'Strips',
    unitCostInr: 142,
    mrpInr: 205,
    storageCondition: 'Cool Dry (<20°C)',
    baseMonthlyDemand: 940,
  },
  {
    skuCode: 'MED-AZM-500',
    medicineName: 'Azithral 500mg Tablets',
    genericName: 'Azithromycin IP 500mg',
    category: 'Antibiotics',
    manufacturer: 'Alembic Pharmaceuticals',
    unit: 'Strips',
    unitCostInr: 86,
    mrpInr: 124,
    storageCondition: 'Ambient (15-25°C)',
    baseMonthlyDemand: 780,
  },
  {
    skuCode: 'MED-INS-GLR',
    medicineName: 'Basalog One Insulin Glargine',
    genericName: 'Insulin Glargine 100 IU/ml',
    category: 'Cold-Chain Biologics',
    manufacturer: 'Biocon Biologics',
    unit: 'Prefilled Syringes',
    unitCostInr: 415,
    mrpInr: 580,
    storageCondition: 'Cold Chain (2-8°C)',
    baseMonthlyDemand: 320,
  },
  {
    skuCode: 'MED-MET-500',
    medicineName: 'Glycomet-GP 2 Tablets',
    genericName: 'Glimepiride 2mg + Metformin 500mg SR',
    category: 'Antidiabetics',
    manufacturer: 'USV Private Ltd.',
    unit: 'Strips',
    unitCostInr: 98,
    mrpInr: 145,
    storageCondition: 'Ambient (15-25°C)',
    baseMonthlyDemand: 1150,
  },
  {
    skuCode: 'MED-TEL-40',
    medicineName: 'Telma 40 Tablets',
    genericName: 'Telmisartan IP 40mg',
    category: 'Cardiovascular',
    manufacturer: 'Glenmark Pharmaceuticals',
    unit: 'Strips',
    unitCostInr: 112,
    mrpInr: 168,
    storageCondition: 'Ambient (15-25°C)',
    baseMonthlyDemand: 1020,
  },
  {
    skuCode: 'MED-ORS-WHO',
    medicineName: 'Electral WHO ORS Powder',
    genericName: 'Oral Rehydration Salts IP 21.8g',
    category: 'Pediatrics & ORS',
    manufacturer: 'FDC Limited',
    unit: 'Sachets',
    unitCostInr: 14,
    mrpInr: 22,
    storageCondition: 'Ambient (15-25°C)',
    baseMonthlyDemand: 2400,
  },
  {
    skuCode: 'MED-RAB-VAX',
    medicineName: 'Rabipur Anti-Rabies Vaccine',
    genericName: 'Purified Chick Embryo Cell Rabies Vaccine',
    category: 'Cold-Chain Biologics',
    manufacturer: 'Bavarian Nordic / GSK',
    unit: 'Vials',
    unitCostInr: 285,
    mrpInr: 390,
    storageCondition: 'Cold Chain (2-8°C)',
    baseMonthlyDemand: 260,
  },
  {
    skuCode: 'MED-PCM-650',
    medicineName: 'Dolo-650 Paracetamol',
    genericName: 'Paracetamol IP 650mg',
    category: 'Analgesics & Antipyretics',
    manufacturer: 'Micro Labs Ltd.',
    unit: 'Strips',
    unitCostInr: 22,
    mrpInr: 34,
    storageCondition: 'Ambient (15-25°C)',
    baseMonthlyDemand: 2850,
  },
  {
    skuCode: 'MED-CEF-1GM',
    medicineName: 'Monocef 1g Injection',
    genericName: 'Ceftriaxone Sodium IP 1000mg',
    category: 'Antibiotics',
    manufacturer: 'Aristo Pharmaceuticals',
    unit: 'Vials',
    unitCostInr: 44,
    mrpInr: 68,
    storageCondition: 'Cool Dry (<20°C)',
    baseMonthlyDemand: 690,
  },
  {
    skuCode: 'MED-ATO-20',
    medicineName: 'Atorva 20mg Tablets',
    genericName: 'Atorvastatin IP 20mg',
    category: 'Cardiovascular',
    manufacturer: 'Zydus Lifesciences',
    unit: 'Strips',
    unitCostInr: 134,
    mrpInr: 196,
    storageCondition: 'Ambient (15-25°C)',
    baseMonthlyDemand: 810,
  },
];

function formatDateOffset(baseDate: Date, offsetDays: number): string {
  const dt = new Date(baseDate.getTime());
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

function formatMonthOffset(baseDate: Date, offsetMonths: number): string {
  const dt = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + offsetMonths, 1));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export interface GeneratedSeedBatch {
  id: string;
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
  expiryDate: string;
  storageCondition: StorageCondition;
  status: 'active' | 'quarantined' | 'depleted';
}

export interface GeneratedSeedSale {
  id: string;
  skuCode: string;
  medicineName: string;
  category: MedicineCategory;
  hubId: string;
  month: string;
  unitsSold: number;
  revenueInr: number;
  seasonalFactor: number;
}

export interface GeneratedSeedTransfer {
  id: string;
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
  transportMode: 'Cold-Chain Van' | 'Express Highway Cargo' | 'Hill-Route Insulated Carrier';
  reason: string;
  status: 'pending' | 'in_transit' | 'completed';
}

export function generateSyntheticDataset(referenceDate = new Date()) {
  const hubMap = new Map(NE_INDIA_HUBS.map((h) => [h.id, h]));

  // Deterministic, realistic Northeast India distributor batch scenarios:
  // Includes: expired batch, <30d critical expiry, 30-90d excess surplus for inter-hub transfer,
  // low stock reorder triggers, and healthy baseline batches across all 8 NE hubs.
  const batchBlueprint: Array<{
    skuIndex: number;
    hubId: string;
    batchSuffix: string;
    qty: number;
    reorderLevel: number;
    expiryOffsetDays: number;
    status: 'active' | 'quarantined' | 'depleted';
  }> = [
    // 1. Expired active batch -> triggers RULE-R5-QUARANTINE
    { skuIndex: 0, hubId: 'hub-silchar', batchSuffix: 'AS24A', qty: 185, reorderLevel: 220, expiryOffsetDays: -12, status: 'active' },
    // 2. Critical <= 30d expiry surplus -> triggers RULE-R1-EXPIRY
    { skuIndex: 5, hubId: 'hub-guwahati', batchSuffix: 'GH25K', qty: 2100, reorderLevel: 600, expiryOffsetDays: 19, status: 'active' },
    // 3. Critical <= 30d cold-chain expiry -> triggers RULE-R1-EXPIRY
    { skuIndex: 6, hubId: 'hub-agartala', batchSuffix: 'TR25V', qty: 190, reorderLevel: 80, expiryOffsetDays: 24, status: 'active' },
    // 4. 30-90d surplus in Guwahati, while Imphal is critically low -> triggers RULE-R2-TRANSFER
    { skuIndex: 2, hubId: 'hub-guwahati', batchSuffix: 'GH26C', qty: 680, reorderLevel: 120, expiryOffsetDays: 58, status: 'active' },
    { skuIndex: 2, hubId: 'hub-imphal', batchSuffix: 'MN26C', qty: 28, reorderLevel: 95, expiryOffsetDays: 195, status: 'active' },
    // 5. 30-90d surplus in Dibrugarh, while Aizawl is low -> triggers RULE-R2-TRANSFER
    { skuIndex: 8, hubId: 'hub-dibrugarh', batchSuffix: 'DB26M', qty: 920, reorderLevel: 180, expiryOffsetDays: 67, status: 'active' },
    { skuIndex: 8, hubId: 'hub-aizawl', batchSuffix: 'MZ26M', qty: 55, reorderLevel: 150, expiryOffsetDays: 220, status: 'active' },
    // 6. Low stock reorder triggers across hubs -> triggers RULE-R3-REORDER & RULE-R4-MONSOON
    { skuIndex: 1, hubId: 'hub-shillong', batchSuffix: 'ML26Z', qty: 18, reorderLevel: 65, expiryOffsetDays: 260, status: 'active' },
    { skuIndex: 3, hubId: 'hub-dimapur', batchSuffix: 'NL26G', qty: 16, reorderLevel: 70, expiryOffsetDays: 310, status: 'active' },
    { skuIndex: 7, hubId: 'hub-imphal', batchSuffix: 'MN26P', qty: 45, reorderLevel: 180, expiryOffsetDays: 290, status: 'active' },
    // 7. Healthy primary & regional stocks
    { skuIndex: 0, hubId: 'hub-guwahati', batchSuffix: 'GH26A', qty: 1450, reorderLevel: 400, expiryOffsetDays: 285, status: 'active' },
    { skuIndex: 1, hubId: 'hub-guwahati', batchSuffix: 'GH26B', qty: 1120, reorderLevel: 350, expiryOffsetDays: 340, status: 'active' },
    { skuIndex: 3, hubId: 'hub-guwahati', batchSuffix: 'GH26D', qty: 1890, reorderLevel: 450, expiryOffsetDays: 380, status: 'active' },
    { skuIndex: 4, hubId: 'hub-guwahati', batchSuffix: 'GH26T', qty: 1620, reorderLevel: 380, expiryOffsetDays: 410, status: 'active' },
    { skuIndex: 4, hubId: 'hub-shillong', batchSuffix: 'ML26T', qty: 440, reorderLevel: 180, expiryOffsetDays: 175, status: 'active' },
    { skuIndex: 5, hubId: 'hub-silchar', batchSuffix: 'AS26O', qty: 1680, reorderLevel: 500, expiryOffsetDays: 140, status: 'active' },
    { skuIndex: 6, hubId: 'hub-guwahati', batchSuffix: 'GH26R', qty: 410, reorderLevel: 110, expiryOffsetDays: 210, status: 'active' },
    { skuIndex: 7, hubId: 'hub-guwahati', batchSuffix: 'GH26L', qty: 3900, reorderLevel: 900, expiryOffsetDays: 430, status: 'active' },
    { skuIndex: 9, hubId: 'hub-dibrugarh', batchSuffix: 'DB26V', qty: 640, reorderLevel: 220, expiryOffsetDays: 250, status: 'active' },
    { skuIndex: 9, hubId: 'hub-agartala', batchSuffix: 'TR26V', qty: 480, reorderLevel: 190, expiryOffsetDays: 82, status: 'active' },
    { skuIndex: 4, hubId: 'hub-aizawl', batchSuffix: 'MZ26T', qty: 290, reorderLevel: 140, expiryOffsetDays: 295, status: 'active' },
    { skuIndex: 5, hubId: 'hub-dimapur', batchSuffix: 'NL26O', qty: 860, reorderLevel: 320, expiryOffsetDays: 44, status: 'active' },
    { skuIndex: 6, hubId: 'hub-shillong', batchSuffix: 'ML25R', qty: 35, reorderLevel: 75, expiryOffsetDays: -4, status: 'quarantined' },
    { skuIndex: 3, hubId: 'hub-agartala', batchSuffix: 'TR26D', qty: 710, reorderLevel: 240, expiryOffsetDays: 325, status: 'active' },
    // 8. Assam Phase-1 Tezpur scenarios:
    //    - Near-expiry surplus in Guwahati (MED-TEL-40, 52d left) + deficit in Tezpur -> Guwahati-to-Tezpur transfer candidate
    //    - Zero-stock depleted batch in Tezpur (MED-AZM-500) -> triggers zero-stock reorder recommendation
    //    - Healthy & active ORS stock in Tezpur
    { skuIndex: 4, hubId: 'hub-guwahati', batchSuffix: 'GH26S', qty: 760, reorderLevel: 180, expiryOffsetDays: 52, status: 'active' },
    { skuIndex: 4, hubId: 'hub-tezpur', batchSuffix: 'TZ26T', qty: 32, reorderLevel: 120, expiryOffsetDays: 215, status: 'active' },
    { skuIndex: 1, hubId: 'hub-tezpur', batchSuffix: 'TZ26Z', qty: 0, reorderLevel: 95, expiryOffsetDays: 190, status: 'depleted' },
    { skuIndex: 5, hubId: 'hub-tezpur', batchSuffix: 'TZ26O', qty: 540, reorderLevel: 220, expiryOffsetDays: 185, status: 'active' },
  ];

  const batches: GeneratedSeedBatch[] = batchBlueprint.map((item, idx) => {
    const sku = SKU_CATALOG[item.skuIndex];
    const hub = hubMap.get(item.hubId) ?? NE_INDIA_HUBS[0];
    return {
      id: `batch_seed_${String(idx + 1).padStart(2, '0')}`,
      skuCode: sku.skuCode,
      medicineName: sku.medicineName,
      genericName: sku.genericName,
      category: sku.category,
      batchNumber: `NE-${item.batchSuffix}-${String(101 + idx)}`,
      manufacturer: sku.manufacturer,
      hubId: hub.id,
      hubName: hub.name,
      quantity: item.qty,
      unit: sku.unit,
      reorderLevel: item.reorderLevel,
      unitCostInr: sku.unitCostInr,
      mrpInr: sku.mrpInr,
      expiryDate: formatDateOffset(referenceDate, item.expiryOffsetDays),
      storageCondition: sku.storageCondition,
      status: item.status,
    };
  });

  // Generate 6 months of historical sales per SKU across key hubs
  const hubShareMultipliers: Record<string, number> = {
    'hub-guwahati': 0.34,
    'hub-tezpur': 0.09,
    'hub-silchar': 0.11,
    'hub-dibrugarh': 0.12,
    'hub-shillong': 0.09,
    'hub-imphal': 0.10,
    'hub-agartala': 0.07,
    'hub-dimapur': 0.05,
    'hub-aizawl': 0.03,
  };

  // Seasonal factors for Northeast India (monsoon & post-monsoon humidity/vector surge)
  const monthlySeasonality = [0.92, 0.98, 1.08, 1.16, 1.12, 1.05];

  const salesHistory: GeneratedSeedSale[] = [];
  let saleCounter = 1;

  // Create aggregated sales history for every hub that holds each SKU
  const seenSkuHub = new Set<string>();
  for (const batch of batches) {
    const key = `${batch.skuCode}__${batch.hubId}`;
    if (seenSkuHub.has(key)) continue;
    seenSkuHub.add(key);

    const sku = SKU_CATALOG.find((s) => s.skuCode === batch.skuCode)!;
    const share = hubShareMultipliers[batch.hubId] ?? 0.1;

    for (let mOffset = -5; mOffset <= 0; mOffset++) {
      const mIdx = mOffset + 5; // 0..5
      const month = formatMonthOffset(referenceDate, mOffset);
      const seasonalFactor = monthlySeasonality[mIdx];
      // Deterministic gentle wave so moving averages show realistic divergence
      const microVariation = 1 + (((saleCounter + mIdx) % 5) - 2) * 0.04;
      const unitsSold = Math.max(
        18,
        Math.round(sku.baseMonthlyDemand * share * seasonalFactor * microVariation)
      );
      const revenueInr = Math.round(unitsSold * sku.unitCostInr * 1.18);

      salesHistory.push({
        id: `sale_seed_${String(saleCounter).padStart(3, '0')}`,
        skuCode: sku.skuCode,
        medicineName: sku.medicineName,
        category: sku.category,
        hubId: batch.hubId,
        month,
        unitsSold,
        revenueInr,
        seasonalFactor,
      });
      saleCounter++;
    }
  }

  // Initial seed stock transfers to showcase active corridor operations
  const transfers: GeneratedSeedTransfer[] = [
    {
      id: 'xfer_seed_01',
      batchId: batches[10].id,
      skuCode: batches[10].skuCode,
      medicineName: batches[10].medicineName,
      batchNumber: batches[10].batchNumber,
      fromHubId: 'hub-guwahati',
      fromHubName: 'Guwahati Central Hub',
      toHubId: 'hub-imphal',
      toHubName: 'Imphal Manipur Hub',
      quantity: 180,
      unit: batches[10].unit,
      estimatedValueInr: 180 * batches[10].unitCostInr,
      transportMode: 'Hill-Route Insulated Carrier',
      reason: 'NH-2 pre-monsoon replenishment for Imphal district hospital indent',
      status: 'in_transit',
    },
    {
      id: 'xfer_seed_02',
      batchId: batches[16].id,
      skuCode: batches[16].skuCode,
      medicineName: batches[16].medicineName,
      batchNumber: batches[16].batchNumber,
      fromHubId: 'hub-guwahati',
      fromHubName: 'Guwahati Central Hub',
      toHubId: 'hub-shillong',
      toHubName: 'Shillong Meghalaya Hub',
      quantity: 60,
      unit: batches[16].unit,
      estimatedValueInr: 60 * batches[16].unitCostInr,
      transportMode: 'Cold-Chain Van',
      reason: '2-8°C vaccine cold-chain top-up after Shillong batch quarantine',
      status: 'pending',
    },
    {
      id: 'xfer_seed_03',
      batchId: batches[12].id,
      skuCode: batches[12].skuCode,
      medicineName: batches[12].medicineName,
      batchNumber: batches[12].batchNumber,
      fromHubId: 'hub-guwahati',
      fromHubName: 'Guwahati Central Hub',
      toHubId: 'hub-dibrugarh',
      toHubName: 'Dibrugarh Upper Assam Hub',
      quantity: 240,
      unit: batches[12].unit,
      estimatedValueInr: 240 * batches[12].unitCostInr,
      transportMode: 'Express Highway Cargo',
      reason: 'Scheduled Upper Assam chronic care stock balancing',
      status: 'completed',
    },
  ];

  return {
    hubs: NE_INDIA_HUBS,
    batches,
    salesHistory,
    transfers,
  };
}
