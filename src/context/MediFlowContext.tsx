import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import {
  BLUEPRINT_LIMITS,
  applyHubOverrides,
  clampText,
  getDaysUntilExpiry,
  isBatchExpired,
  isDemoDocumentId,
  sanitizeId,
  sanitizeUpperCode,
} from '../lib/validation.ts';
import type {
  DistributionHub,
  EvaluatedRecommendation,
  InventoryBatch,
  MedicineCategory,
  RecommendationRecord,
  SalesHistoryRecord,
  SkuForecastResult,
  StockMovementRecord,
  StockMovementType,
  StockTransfer,
  StorageCondition,
  TransferStatus,
  TransportMode,
  UnitType,
  WorkspaceConfig,
} from '../types/pharma.ts';

export interface NewBatchInput {
  skuCode: string;
  medicineName: string;
  genericName: string;
  category: MedicineCategory;
  batchNumber: string;
  manufacturer: string;
  hubId: string;
  quantity: number;
  unit: UnitType;
  reorderLevel: number;
  unitCostInr: number;
  mrpInr: number;
  expiryDate: string;
  storageCondition: StorageCondition;
}

export interface NewTransferInput {
  batchId: string;
  toHubId: string;
  quantity: number;
  transportMode: TransportMode;
  reason: string;
}

export interface NewSalesInput {
  skuCode: string;
  medicineName: string;
  category: MedicineCategory;
  hubId: string;
  month: string;
  unitsSold: number;
  unitCostInr: number;
  seasonalFactor: number;
}

export interface DemoScopeCounts {
  demoBatches: number;
  demoSales: number;
  demoTransfers: number;
  userBatches: number;
  userSales: number;
  userTransfers: number;
}

interface MediFlowContextValue {
  user: User | null;
  authReady: boolean;
  loadingData: boolean;
  mutating: boolean;
  isOnline: boolean;
  connectivityIssue: string | null;
  errorMessage: string | null;
  clearError: () => void;
  workspace: WorkspaceConfig | null;
  hubs: DistributionHub[];
  batches: InventoryBatch[];
  salesHistory: SalesHistoryRecord[];
  transfers: StockTransfer[];
  stockMovements: StockMovementRecord[];
  recommendationRecords: RecommendationRecord[];
  forecasts: SkuForecastResult[];
  evaluatedRecommendations: EvaluatedRecommendation[];
  demoScopeCounts: DemoScopeCounts;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  seedDemoData: (clearDemoOnly?: boolean) => Promise<void>;
  updateHubLeadTime: (hubId: string, leadTimeDays: number, monsoonBufferDays: number) => Promise<void>;
  addBatch: (input: NewBatchInput) => Promise<void>;
  adjustBatchQuantity: (batchId: string, newQuantity: number) => Promise<void>;
  quarantineBatch: (batchId: string) => Promise<void>;
  createTransfer: (input: NewTransferInput) => Promise<void>;
  advanceTransferStatus: (transferId: string, nextStatus: TransferStatus) => Promise<void>;
  applyRecommendation: (rec: EvaluatedRecommendation) => Promise<void>;
  dismissRecommendation: (rec: EvaluatedRecommendation) => Promise<void>;
  logSalesRecord: (input: NewSalesInput) => Promise<void>;
}

const FIRESTORE_SAFE_BATCH_SIZE = 400;

async function commitOperationsInChunks(
  operations: Array<(batch: WriteBatch) => void>,
  contextPath: string
): Promise<void> {
  if (operations.length === 0) return;
  for (let i = 0; i < operations.length; i += FIRESTORE_SAFE_BATCH_SIZE) {
    const chunk = operations.slice(i, i + FIRESTORE_SAFE_BATCH_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      op(batch);
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, contextPath);
    }
  }
}

function toReadableError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? fallback);
  let extracted = raw;
  if (raw.startsWith('{') && raw.includes('"error"')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error) extracted = parsed.error;
    } catch {
      // keep raw
    }
  }
  if (extracted.includes('permission-denied') || extracted.includes('Missing or insufficient permissions')) {
    return 'Firestore permission denied for this operation. Verify your signed-in account and deployed security rules.';
  }
  if (extracted.includes('unavailable') || extracted.includes('Failed to fetch') || extracted.includes('network')) {
    return 'Network connectivity issue while reaching MediFlow services. Check your connection and try again.';
  }
  return extracted || fallback;
}

function getCreatedAtMillis(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis?: unknown }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function createStockMovementPayload(params: {
  user: User;
  workspaceId: string;
  movementType: StockMovementType;
  skuCode: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  hubId: string;
  hubName: string;
  targetHubId?: string;
  targetHubName?: string;
  quantityDelta: number;
  quantityAfter: number;
  unit: UnitType;
  reason: string;
}) {
  const timestampIso = new Date().toISOString();
  return {
    ownerId: params.user.uid,
    workspaceId: params.workspaceId,
    movementType: params.movementType,
    skuCode: sanitizeUpperCode(params.skuCode, BLUEPRINT_LIMITS.MAX_SKU_LEN),
    medicineName: clampText(params.medicineName, 2, BLUEPRINT_LIMITS.MAX_NAME_LEN),
    batchId: sanitizeId(params.batchId, 'batch'),
    batchNumber: sanitizeUpperCode(params.batchNumber, BLUEPRINT_LIMITS.MAX_BATCH_LEN),
    hubId: params.hubId,
    hubName: clampText(params.hubName, 2, 100),
    targetHubId: params.targetHubId ?? '',
    targetHubName: params.targetHubName ? clampText(params.targetHubName, 2, 100) : '',
    quantityDelta: Math.round(params.quantityDelta),
    quantityAfter: Math.max(0, Math.round(params.quantityAfter)),
    unit: params.unit,
    reason: clampText(params.reason, 3, BLUEPRINT_LIMITS.MAX_REASON_LEN, 'Inventory movement'),
    actorUid: params.user.uid,
    actorEmail: (params.user.email ?? 'verified-distributor').slice(0, 254),
    timestampIso,
    createdAt: serverTimestamp(),
  };
}

const MediFlowContext = createContext<MediFlowContextValue | null>(null);

export function MediFlowProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [connectivityIssue, setConnectivityIssue] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [rawHubs, setRawHubs] = useState<DistributionHub[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesHistoryRecord[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovementRecord[]>([]);
  const [recommendationRecords, setRecommendationRecords] = useState<RecommendationRecord[]>([]);

  const [forecasts, setForecasts] = useState<SkuForecastResult[]>([]);
  const [evaluatedRecommendations, setEvaluatedRecommendations] = useState<EvaluatedRecommendation[]>([]);

  const hubs = useMemo(
    () => applyHubOverrides(rawHubs, workspace?.hubOverrides),
    [rawHubs, workspace?.hubOverrides]
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setConnectivityIssue(null);
    };
    const onOffline = () => {
      setIsOnline(false);
      setConnectivityIssue('Browser is offline. Changes will pause or queue until connectivity is restored.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Load regional hubs metadata from authenticated Node.js backend once signed in
  useEffect(() => {
    if (!authReady || !user) {
      setRawHubs([]);
      return;
    }

    let active = true;
    user
      .getIdToken()
      .then((token) =>
        fetch('/api/hubs', {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch hubs (${res.status})`);
        return res.json();
      })
      .then((data: { hubs?: DistributionHub[] }) => {
        if (active && Array.isArray(data.hubs)) {
          setRawHubs(data.hubs);
          setConnectivityIssue(null);
        }
      })
      .catch((err) => {
        console.error('Failed to load hubs from backend:', err);
        if (active) {
          setConnectivityIssue('Unable to reach MediFlow backend for hub metadata. Retrying on reconnect.');
        }
      });

    return () => {
      active = false;
    };
  }, [authReady, isOnline, user]);

  const runSeedPipeline = useCallback(
    async (firebaseUser: User, workspaceId: string, clearDemoOnly: boolean) => {
      const uid = firebaseUser.uid;
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/seed/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!response.ok) {
        throw new Error('Failed to generate demonstration dataset from Node.js server.');
      }

      const seedPayload = (await response.json()) as {
        batches: Array<Omit<InventoryBatch, 'ownerId' | 'workspaceId' | 'createdAt' | 'updatedAt'>>;
        salesHistory: Array<Omit<SalesHistoryRecord, 'ownerId' | 'workspaceId' | 'createdAt' | 'updatedAt'>>;
        transfers: Array<Omit<StockTransfer, 'ownerId' | 'workspaceId' | 'createdAt' | 'updatedAt'>>;
      };

      // Step 1: Delete ONLY synthetic demo documents (never real user-created data) in safe chunks <= 400
      if (clearDemoOnly) {
        const deleteOps: Array<(batch: WriteBatch) => void> = [];

        const [batchSnap, salesSnap, xferSnap, recSnap] = await Promise.all([
          getDocs(query(collection(db, 'inventoryBatches'), where('ownerId', '==', uid))),
          getDocs(query(collection(db, 'salesHistory'), where('ownerId', '==', uid))),
          getDocs(query(collection(db, 'stockTransfers'), where('ownerId', '==', uid))),
          getDocs(query(collection(db, 'recommendations'), where('ownerId', '==', uid))),
        ]);

        for (const d of batchSnap.docs) {
          if (isDemoDocumentId(d.id)) {
            deleteOps.push((wb) => wb.delete(d.ref));
          }
        }
        for (const d of salesSnap.docs) {
          if (isDemoDocumentId(d.id)) {
            deleteOps.push((wb) => wb.delete(d.ref));
          }
        }
        for (const d of xferSnap.docs) {
          const data = d.data() as { batchId?: string };
          if (isDemoDocumentId(d.id) || (data.batchId && isDemoDocumentId(data.batchId))) {
            deleteOps.push((wb) => wb.delete(d.ref));
          }
        }
        for (const d of recSnap.docs) {
          const data = d.data() as { batchId?: string };
          if (data.batchId && isDemoDocumentId(data.batchId)) {
            deleteOps.push((wb) => wb.delete(d.ref));
          }
        }

        await commitOperationsInChunks(deleteOps, 'seed_cleanup_demo_only');
      }

      const idPrefix = sanitizeId(uid.slice(0, 10), 'u');
      const seedTag = Date.now().toString(36).slice(-5);
      const batchIdMap = new Map<string, { docId: string; quantity: number }>();

      // Step 2: Write synthetic inventoryBatches & salesHistory in chunks <= 400
      const seedDataOps: Array<(batch: WriteBatch) => void> = [];

      for (const b of seedPayload.batches) {
        const docId = sanitizeId(`${idPrefix}_${seedTag}_${b.id}`, 'batch');
        batchIdMap.set(b.id, { docId, quantity: b.quantity });
        seedDataOps.push((wb) =>
          wb.set(doc(db, 'inventoryBatches', docId), {
            ownerId: uid,
            workspaceId,
            skuCode: b.skuCode,
            medicineName: b.medicineName,
            genericName: b.genericName,
            category: b.category,
            batchNumber: b.batchNumber,
            manufacturer: b.manufacturer,
            hubId: b.hubId,
            hubName: b.hubName,
            quantity: b.quantity,
            unit: b.unit,
            reorderLevel: b.reorderLevel,
            unitCostInr: b.unitCostInr,
            mrpInr: b.mrpInr,
            expiryDate: b.expiryDate,
            storageCondition: b.storageCondition,
            status: b.status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }

      for (const s of seedPayload.salesHistory) {
        const docId = sanitizeId(`${idPrefix}_${seedTag}_${s.id}`, 'sale');
        seedDataOps.push((wb) =>
          wb.set(doc(db, 'salesHistory', docId), {
            ownerId: uid,
            workspaceId,
            skuCode: s.skuCode,
            medicineName: s.medicineName,
            category: s.category,
            hubId: s.hubId,
            month: s.month,
            unitsSold: s.unitsSold,
            revenueInr: s.revenueInr,
            seasonalFactor: s.seasonalFactor,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }

      await commitOperationsInChunks(seedDataOps, 'seed_batches_and_sales');

      // Step 3: Write synthetic stockTransfers atomically with origin batch decrements
      // (after source batches are committed so firestore.rules get() + getAfter() checks pass)
      const transferOps: Array<(batch: WriteBatch) => void> = [];
      for (const t of seedPayload.transfers) {
        const mapped = batchIdMap.get(t.batchId);
        if (!mapped || mapped.quantity < t.quantity) continue;

        const docId = sanitizeId(`${idPrefix}_${seedTag}_${t.id}`, 'xfer');
        const nextQty = mapped.quantity - t.quantity;
        mapped.quantity = nextQty;

        transferOps.push((wb) => {
          wb.set(doc(db, 'stockTransfers', docId), {
            ownerId: uid,
            workspaceId,
            batchId: mapped.docId,
            skuCode: t.skuCode,
            medicineName: t.medicineName,
            batchNumber: t.batchNumber,
            fromHubId: t.fromHubId,
            fromHubName: t.fromHubName,
            toHubId: t.toHubId,
            toHubName: t.toHubName,
            quantity: t.quantity,
            unit: t.unit,
            estimatedValueInr: t.estimatedValueInr,
            transportMode: t.transportMode,
            reason: t.reason,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          wb.update(doc(db, 'inventoryBatches', mapped.docId), {
            quantity: nextQty,
            status: nextQty === 0 ? 'depleted' : 'active',
            updatedAt: serverTimestamp(),
          });
        });
      }

      transferOps.push((wb) =>
        wb.update(doc(db, 'workspaces', workspaceId), {
          seeded: true,
          updatedAt: serverTimestamp(),
        })
      );

      await commitOperationsInChunks(transferOps, 'seed_transfers_and_workspace');
    },
    []
  );

  // Bootstrap Workspace & User PII/Profile on Sign-In without ever overwriting existing data
  const ensureWorkspaceBootstrap = useCallback(
    async (firebaseUser: User) => {
      const uid = firebaseUser.uid;
      const workspaceId = sanitizeId(`ws_${uid}`, 'ws');
      const wsRef = doc(db, 'workspaces', workspaceId);
      const userRef = doc(db, 'users', uid);
      const privateRef = doc(db, 'users', uid, 'private', 'info');

      let wsSnap;
      try {
        wsSnap = await getDoc(wsRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `workspaces/${workspaceId}`);
      }

      if (!wsSnap.exists()) {
        try {
          await setDoc(wsRef, {
            ownerId: uid,
            name: 'Brahmaputra Pharma Distributors',
            region: 'Northeast India',
            primaryHubId: 'hub-guwahati',
            seeded: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `workspaces/${workspaceId}`);
        }
      }

      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }

      if (!userSnap.exists()) {
        try {
          await setDoc(userRef, {
            uid,
            displayName: clampText(firebaseUser.displayName || 'Regional Distributor', 1, 100),
            workspaceId,
            role: 'distributor_manager',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
        }
      }

      let privSnap;
      try {
        privSnap = await getDoc(privateRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${uid}/private/info`);
      }

      if (!privSnap.exists() && firebaseUser.email) {
        try {
          await setDoc(privateRef, {
            ownerId: uid,
            email: firebaseUser.email.slice(0, 254),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${uid}/private/info`);
        }
      }

      const currentData = wsSnap.exists() ? wsSnap.data() : { seeded: false };
      if (!currentData.seeded) {
        // Verify whether any batches already exist before auto-seeding to protect existing data
        const existingBatches = await getDocs(
          query(collection(db, 'inventoryBatches'), where('ownerId', '==', uid), limit(1))
        );
        if (existingBatches.empty) {
          await runSeedPipeline(firebaseUser, workspaceId, false);
        } else {
          await updateDoc(wsRef, {
            seeded: true,
            updatedAt: serverTimestamp(),
          });
        }
      }
    },
    [runSeedPipeline]
  );

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setLoadingData(true);
        try {
          await ensureWorkspaceBootstrap(firebaseUser);
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Workspace initialization failed.');
        } finally {
          setAuthReady(true);
        }
      } else {
        setWorkspace(null);
        setBatches([]);
        setSalesHistory([]);
        setTransfers([]);
        setStockMovements([]);
        setRecommendationRecords([]);
        setForecasts([]);
        setEvaluatedRecommendations([]);
        setLoadingData(false);
        setAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, [ensureWorkspaceBootstrap]);

  // Firestore Real-time Listeners (strictly gated on authReady && user)
  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const workspaceId = sanitizeId(`ws_${uid}`, 'ws');
    setLoadingData(true);

    const unsubWorkspace = onSnapshot(
      doc(db, 'workspaces', workspaceId),
      (snap) => {
        if (snap.exists()) {
          setWorkspace({ id: snap.id, ...(snap.data() as Omit<WorkspaceConfig, 'id'>) });
        }
      },
      (err) => {
        setConnectivityIssue('Firestore workspace listener interrupted.');
        setErrorMessage(toReadableError(err, 'Failed to sync workspace.'));
      }
    );

    const unsubBatches = onSnapshot(
      query(collection(db, 'inventoryBatches'), where('ownerId', '==', uid)),
      (snap) => {
        const rows: InventoryBatch[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<InventoryBatch, 'id'>),
        }));
        setBatches(rows);
        setLoadingData(false);
      },
      (err) => {
        setLoadingData(false);
        setConnectivityIssue('Firestore inventory listener interrupted.');
        setErrorMessage(toReadableError(err, 'Failed to load inventory batches.'));
      }
    );

    const unsubSales = onSnapshot(
      query(collection(db, 'salesHistory'), where('ownerId', '==', uid)),
      (snap) => {
        const rows: SalesHistoryRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SalesHistoryRecord, 'id'>),
        }));
        setSalesHistory(rows);
      },
      (err) => {
        setErrorMessage(toReadableError(err, 'Failed to load sales history.'));
      }
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, 'stockTransfers'), where('ownerId', '==', uid)),
      (snap) => {
        const rows: StockTransfer[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<StockTransfer, 'id'>),
          }))
          .sort((a, b) => {
            const diff = getCreatedAtMillis(b.createdAt) - getCreatedAtMillis(a.createdAt);
            return diff !== 0 ? diff : b.id.localeCompare(a.id);
          });
        setTransfers(rows);
      },
      (err) => {
        setErrorMessage(toReadableError(err, 'Failed to load stock transfers.'));
      }
    );

    const unsubMovements = onSnapshot(
      query(collection(db, 'stockMovements'), where('ownerId', '==', uid)),
      (snap) => {
        const rows: StockMovementRecord[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<StockMovementRecord, 'id'>),
          }))
          .sort((a, b) => b.timestampIso.localeCompare(a.timestampIso));
        setStockMovements(rows);
      },
      (err) => {
        console.warn('Stock movement listener error:', err);
      }
    );

    const unsubRecs = onSnapshot(
      query(collection(db, 'recommendations'), where('ownerId', '==', uid)),
      (snap) => {
        const rows: RecommendationRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RecommendationRecord, 'id'>),
        }));
        setRecommendationRecords(rows);
      },
      (err) => {
        setErrorMessage(toReadableError(err, 'Failed to load recommendations.'));
      }
    );

    return () => {
      unsubWorkspace();
      unsubBatches();
      unsubSales();
      unsubTransfers();
      unsubMovements();
      unsubRecs();
    };
  }, [authReady, user]);

  // Compute Moving Averages & Deterministic Recommendations via Authenticated Node.js Server
  useEffect(() => {
    if (!user || (batches.length === 0 && salesHistory.length === 0)) {
      setForecasts([]);
      setEvaluatedRecommendations([]);
      return;
    }

    let cancelled = false;
    const payload = JSON.stringify({
      batches,
      salesHistory,
      hubOverrides: workspace?.hubOverrides,
    });

    user
      .getIdToken()
      .then((token) =>
        Promise.all([
          fetch('/api/forecast/compute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: payload,
          }).then(async (r) => {
            if (!r.ok) throw new Error(`Forecast API error (${r.status})`);
            return r.json();
          }),
          fetch('/api/recommendations/evaluate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: payload,
          }).then(async (r) => {
            if (!r.ok) throw new Error(`Recommendations API error (${r.status})`);
            return r.json();
          }),
        ])
      )
      .then(([forecastData, recData]) => {
        if (cancelled) return;
        setConnectivityIssue(null);
        if (Array.isArray(forecastData?.forecasts)) {
          setForecasts(forecastData.forecasts);
        }
        if (Array.isArray(recData?.recommendations)) {
          setEvaluatedRecommendations(recData.recommendations);
        }
      })
      .catch((err) => {
        console.error('Backend calculation error:', err);
        if (!cancelled) {
          setConnectivityIssue(
            'Unable to reach MediFlow forecasting engine. Displaying cached state until reconnected.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [batches, isOnline, salesHistory, user, workspace?.hubOverrides]);

  const demoScopeCounts = useMemo<DemoScopeCounts>(() => {
    const demoBatches = batches.filter((b) => isDemoDocumentId(b.id)).length;
    const demoSales = salesHistory.filter((s) => isDemoDocumentId(s.id)).length;
    const demoTransfers = transfers.filter(
      (t) => isDemoDocumentId(t.id) || isDemoDocumentId(t.batchId)
    ).length;

    return {
      demoBatches,
      demoSales,
      demoTransfers,
      userBatches: batches.length - demoBatches,
      userSales: salesHistory.length - demoSales,
      userTransfers: transfers.length - demoTransfers,
    };
  }, [batches, salesHistory, transfers]);

  const loginWithGoogle = useCallback(async () => {
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Google Sign-In failed.');
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const seedDemoData = useCallback(
    async (clearDemoOnly = true) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);
      try {
        await runSeedPipeline(user, workspace.id, clearDemoOnly);
      } catch (err) {
        const msg = toReadableError(err, 'Failed to refresh demo data.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [runSeedPipeline, user, workspace]
  );

  const updateHubLeadTime = useCallback(
    async (hubId: string, leadTimeDays: number, monsoonBufferDays: number) => {
      if (!user || !workspace) return;
      const targetHub = hubs.find((h) => h.id === hubId);
      if (!targetHub) {
        const msg = 'Invalid hub selected for configuration.';
        setErrorMessage(msg);
        throw new Error(msg);
      }

      setMutating(true);
      setErrorMessage(null);

      const nextLead = Math.max(1, Math.min(45, Math.round(leadTimeDays)));
      const nextBuffer = Math.max(0, Math.min(30, Math.round(monsoonBufferDays)));
      const nextOverrides = {
        ...(workspace.hubOverrides ?? {}),
        [hubId]: {
          leadTimeDays: nextLead,
          monsoonBufferDays: nextBuffer,
        },
      };

      try {
        await updateDoc(doc(db, 'workspaces', workspace.id), {
          hubOverrides: nextOverrides,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        const msg = toReadableError(err, 'Failed to save hub lead-time configuration.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [hubs, user, workspace]
  );

  const addBatch = useCallback(
    async (input: NewBatchInput) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);
      const hub = hubs.find((h) => h.id === input.hubId);
      if (!hub) {
        setMutating(false);
        const msg = 'Invalid Northeast India hub selected.';
        setErrorMessage(msg);
        throw new Error(msg);
      }

      const skuCode = sanitizeUpperCode(input.skuCode, BLUEPRINT_LIMITS.MAX_SKU_LEN);
      const batchNumber = sanitizeUpperCode(input.batchNumber, BLUEPRINT_LIMITS.MAX_BATCH_LEN);
      if (!BLUEPRINT_LIMITS.SKU_PATTERN.test(skuCode) || skuCode.length < 3) {
        setMutating(false);
        const msg = 'SKU code must be at least 3 uppercase alphanumeric characters.';
        setErrorMessage(msg);
        throw new Error(msg);
      }
      if (!BLUEPRINT_LIMITS.BATCH_PATTERN.test(batchNumber) || batchNumber.length < 3) {
        setMutating(false);
        const msg = 'Batch number must be at least 3 uppercase alphanumeric characters.';
        setErrorMessage(msg);
        throw new Error(msg);
      }
      if (!BLUEPRINT_LIMITS.DATE_PATTERN.test(input.expiryDate)) {
        setMutating(false);
        const msg = 'Expiry date must follow YYYY-MM-DD format.';
        setErrorMessage(msg);
        throw new Error(msg);
      }

      const batchId = sanitizeId(`batch_${Date.now()}`, 'batch');
      const movementId = sanitizeId(`mov_${Date.now()}_add`, 'mov');
      const qty = Math.max(0, Math.round(input.quantity));
      const medicineName = clampText(input.medicineName, 2, BLUEPRINT_LIMITS.MAX_NAME_LEN);
      const payload = {
        ownerId: user.uid,
        workspaceId: workspace.id,
        skuCode,
        medicineName,
        genericName: clampText(input.genericName, 2, BLUEPRINT_LIMITS.MAX_NAME_LEN),
        category: input.category,
        batchNumber,
        manufacturer: clampText(input.manufacturer, 2, 100),
        hubId: hub.id,
        hubName: hub.name,
        quantity: qty,
        unit: input.unit,
        reorderLevel: Math.max(0, Math.round(input.reorderLevel)),
        unitCostInr: Math.max(1, Number(input.unitCostInr)),
        mrpInr: Math.max(1, Number(input.mrpInr)),
        expiryDate: input.expiryDate,
        storageCondition: input.storageCondition,
        status: qty === 0 ? 'depleted' : 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const wb = writeBatch(db);
      wb.set(doc(db, 'inventoryBatches', batchId), payload);
      wb.set(
        doc(db, 'stockMovements', movementId),
        createStockMovementPayload({
          user,
          workspaceId: workspace.id,
          movementType: 'batch_add',
          skuCode,
          medicineName,
          batchId,
          batchNumber,
          hubId: hub.id,
          hubName: hub.name,
          quantityDelta: qty,
          quantityAfter: qty,
          unit: input.unit,
          reason: `Initial batch receipt (${batchNumber})`,
        })
      );

      try {
        await wb.commit();
      } catch (err) {
        const msg = toReadableError(err, 'Failed to register pharmaceutical batch.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [hubs, user, workspace]
  );

  const adjustBatchQuantity = useCallback(
    async (batchId: string, newQuantity: number) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);
      const qty = Math.max(0, Math.round(newQuantity));
      const movementId = sanitizeId(`mov_${Date.now()}_adj`, 'mov');
      try {
        await runTransaction(db, async (tx) => {
          const batchRef = doc(db, 'inventoryBatches', batchId);
          const snap = await tx.get(batchRef);
          if (!snap.exists()) {
            throw new Error('Batch not found.');
          }
          const current = snap.data() as InventoryBatch;
          if (current.status === 'quarantined') {
            throw new Error('Quarantined batches cannot be adjusted back into active stock.');
          }
          tx.update(batchRef, {
            quantity: qty,
            status: qty === 0 ? 'depleted' : 'active',
            updatedAt: serverTimestamp(),
          });
          tx.set(
            doc(db, 'stockMovements', movementId),
            createStockMovementPayload({
              user,
              workspaceId: workspace.id,
              movementType: 'stock_adjust',
              skuCode: current.skuCode,
              medicineName: current.medicineName,
              batchId,
              batchNumber: current.batchNumber,
              hubId: current.hubId,
              hubName: current.hubName,
              quantityDelta: qty - current.quantity,
              quantityAfter: qty,
              unit: current.unit,
              reason: `Manual stock count adjustment from ${current.quantity} to ${qty}`,
            })
          );
        });
      } catch (err) {
        const msg = toReadableError(err, 'Failed to adjust batch quantity.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [user, workspace]
  );

  const quarantineBatch = useCallback(
    async (batchId: string) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);
      const movementId = sanitizeId(`mov_${Date.now()}_qtn`, 'mov');
      try {
        await runTransaction(db, async (tx) => {
          const batchRef = doc(db, 'inventoryBatches', batchId);
          const snap = await tx.get(batchRef);
          if (!snap.exists()) {
            throw new Error('Batch not found.');
          }
          const current = snap.data() as InventoryBatch;
          if (current.status !== 'active') {
            throw new Error('Only active batches can be placed in quarantine.');
          }
          tx.update(batchRef, {
            status: 'quarantined',
            updatedAt: serverTimestamp(),
          });
          tx.set(
            doc(db, 'stockMovements', movementId),
            createStockMovementPayload({
              user,
              workspaceId: workspace.id,
              movementType: 'quarantine',
              skuCode: current.skuCode,
              medicineName: current.medicineName,
              batchId,
              batchNumber: current.batchNumber,
              hubId: current.hubId,
              hubName: current.hubName,
              quantityDelta: -current.quantity,
              quantityAfter: current.quantity,
              unit: current.unit,
              reason: `Batch quarantined (expiry ${current.expiryDate}) and removed from saleable stock`,
            })
          );
        });
      } catch (err) {
        const msg = toReadableError(err, 'Failed to quarantine batch.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [user, workspace]
  );

  const createTransfer = useCallback(
    async (input: NewTransferInput) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);

      const toHub = hubs.find((h) => h.id === input.toHubId);
      if (!toHub) {
        setMutating(false);
        const msg = 'Invalid destination hub selected.';
        setErrorMessage(msg);
        throw new Error(msg);
      }

      const transferId = sanitizeId(`xfer_${Date.now()}`, 'xfer');
      const movementId = sanitizeId(`mov_${Date.now()}_xout`, 'mov');
      const requestedQty = Math.max(1, Math.round(input.quantity));

      try {
        await runTransaction(db, async (tx) => {
          const sourceRef = doc(db, 'inventoryBatches', input.batchId);
          const sourceSnap = await tx.get(sourceRef);
          if (!sourceSnap.exists()) {
            throw new Error('Source batch no longer exists.');
          }

          const sourceBatch = sourceSnap.data() as Omit<InventoryBatch, 'id'>;
          if (sourceBatch.status !== 'active') {
            throw new Error('Only active batches can be transferred.');
          }
          if (isBatchExpired(sourceBatch.expiryDate)) {
            throw new Error(
              `Cannot transfer expired batch ${sourceBatch.batchNumber} (${sourceBatch.expiryDate}). Quarantine it instead.`
            );
          }
          if (sourceBatch.hubId === toHub.id) {
            throw new Error('Destination hub must differ from origin hub.');
          }
          const daysLeft = getDaysUntilExpiry(sourceBatch.expiryDate);
          const transitDays = toHub.leadTimeDays + toHub.monsoonBufferDays;
          if (daysLeft <= transitDays) {
            throw new Error(
              `Batch expires in ${daysLeft}d, which does not exceed transit lead time (${transitDays}d) to ${toHub.name}.`
            );
          }
          if (sourceBatch.quantity < requestedQty) {
            throw new Error(`Insufficient stock: only ${sourceBatch.quantity} ${sourceBatch.unit} available.`);
          }

          const remainingQty = sourceBatch.quantity - requestedQty;
          const cleanReason = clampText(
            input.reason,
            3,
            BLUEPRINT_LIMITS.MAX_REASON_LEN,
            'Inter-hub stock balancing'
          );

          tx.set(doc(db, 'stockTransfers', transferId), {
            ownerId: user.uid,
            workspaceId: workspace.id,
            batchId: sourceSnap.id,
            skuCode: sourceBatch.skuCode,
            medicineName: sourceBatch.medicineName,
            batchNumber: sourceBatch.batchNumber,
            fromHubId: sourceBatch.hubId,
            fromHubName: sourceBatch.hubName,
            toHubId: toHub.id,
            toHubName: toHub.name,
            quantity: requestedQty,
            unit: sourceBatch.unit,
            estimatedValueInr: Math.round(requestedQty * sourceBatch.unitCostInr),
            transportMode: input.transportMode,
            reason: cleanReason,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          tx.update(sourceRef, {
            quantity: remainingQty,
            status: remainingQty === 0 ? 'depleted' : 'active',
            updatedAt: serverTimestamp(),
          });

          tx.set(
            doc(db, 'stockMovements', movementId),
            createStockMovementPayload({
              user,
              workspaceId: workspace.id,
              movementType: 'transfer_out',
              skuCode: sourceBatch.skuCode,
              medicineName: sourceBatch.medicineName,
              batchId: sourceSnap.id,
              batchNumber: sourceBatch.batchNumber,
              hubId: sourceBatch.hubId,
              hubName: sourceBatch.hubName,
              targetHubId: toHub.id,
              targetHubName: toHub.name,
              quantityDelta: -requestedQty,
              quantityAfter: remainingQty,
              unit: sourceBatch.unit,
              reason: cleanReason,
            })
          );
        });
      } catch (err) {
        const msg = toReadableError(err, 'Failed to initiate stock transfer.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [hubs, user, workspace]
  );

  const advanceTransferStatus = useCallback(
    async (transferId: string, nextStatus: TransferStatus) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);
      const movementId = sanitizeId(`mov_${Date.now()}_xst`, 'mov');

      try {
        await runTransaction(db, async (tx) => {
          const transferRef = doc(db, 'stockTransfers', transferId);
          const transferSnap = await tx.get(transferRef);
          if (!transferSnap.exists()) {
            throw new Error('Stock transfer not found.');
          }
          const transfer = transferSnap.data() as Omit<StockTransfer, 'id'>;

          const sourceRef = doc(db, 'inventoryBatches', transfer.batchId);
          const sourceSnap = await tx.get(sourceRef);

          const destBatchId = sanitizeId(`batch_rcv_${transferId}`, 'batch');
          const destRef = doc(db, 'inventoryBatches', destBatchId);
          const destSnap = nextStatus === 'completed' ? await tx.get(destRef) : null;

          if (nextStatus === 'in_transit' && transfer.status !== 'pending') {
            throw new Error('Only pending transfers can be dispatched.');
          }
          if (nextStatus === 'cancelled' && transfer.status !== 'pending') {
            throw new Error('Only pending transfers can be cancelled.');
          }
          if (
            nextStatus === 'completed' &&
            transfer.status !== 'pending' &&
            transfer.status !== 'in_transit'
          ) {
            throw new Error('Transfer is already finalized.');
          }

          if (nextStatus === 'completed') {
            if (!sourceSnap.exists()) {
              throw new Error('Origin batch metadata not found.');
            }
            const sourceBatch = sourceSnap.data() as Omit<InventoryBatch, 'id'>;
            if (!destSnap?.exists()) {
              tx.set(destRef, {
                ownerId: user.uid,
                workspaceId: workspace.id,
                skuCode: transfer.skuCode,
                medicineName: transfer.medicineName,
                genericName: sourceBatch.genericName,
                category: sourceBatch.category,
                batchNumber: transfer.batchNumber,
                manufacturer: sourceBatch.manufacturer,
                hubId: transfer.toHubId,
                hubName: transfer.toHubName,
                quantity: transfer.quantity,
                unit: transfer.unit,
                reorderLevel: sourceBatch.reorderLevel,
                unitCostInr: sourceBatch.unitCostInr,
                mrpInr: sourceBatch.mrpInr,
                expiryDate: sourceBatch.expiryDate,
                storageCondition: sourceBatch.storageCondition,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
            tx.set(
              doc(db, 'stockMovements', movementId),
              createStockMovementPayload({
                user,
                workspaceId: workspace.id,
                movementType: 'transfer_in',
                skuCode: transfer.skuCode,
                medicineName: transfer.medicineName,
                batchId: destBatchId,
                batchNumber: transfer.batchNumber,
                hubId: transfer.toHubId,
                hubName: transfer.toHubName,
                targetHubId: transfer.fromHubId,
                targetHubName: transfer.fromHubName,
                quantityDelta: transfer.quantity,
                quantityAfter: transfer.quantity,
                unit: transfer.unit,
                reason: `Received from ${transfer.fromHubName}: ${transfer.reason}`,
              })
            );
          }

          if (nextStatus === 'cancelled') {
            if (!sourceSnap.exists()) {
              throw new Error('Origin batch not found to restore stock.');
            }
            const sourceBatch = sourceSnap.data() as Omit<InventoryBatch, 'id'>;
            const restoredQty = sourceBatch.quantity + transfer.quantity;
            tx.update(sourceRef, {
              quantity: restoredQty,
              status: 'active',
              updatedAt: serverTimestamp(),
            });
            tx.set(
              doc(db, 'stockMovements', movementId),
              createStockMovementPayload({
                user,
                workspaceId: workspace.id,
                movementType: 'transfer_cancel',
                skuCode: transfer.skuCode,
                medicineName: transfer.medicineName,
                batchId: transfer.batchId,
                batchNumber: transfer.batchNumber,
                hubId: transfer.fromHubId,
                hubName: transfer.fromHubName,
                targetHubId: transfer.toHubId,
                targetHubName: transfer.toHubName,
                quantityDelta: transfer.quantity,
                quantityAfter: restoredQty,
                unit: transfer.unit,
                reason: `Cancelled transfer to ${transfer.toHubName}; stock restored`,
              })
            );
          }

          tx.update(transferRef, {
            status: nextStatus,
            updatedAt: serverTimestamp(),
          });
        });
      } catch (err) {
        const msg = toReadableError(err, 'Failed to update transfer status.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [user, workspace]
  );

  const applyRecommendation = useCallback(
    async (rec: EvaluatedRecommendation) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);

      const recDocId = sanitizeId(`rec_${user.uid.slice(0, 8)}_${rec.deterministicKey}`, 'rec');
      const movementId = sanitizeId(`mov_${Date.now()}_rec`, 'mov');

      try {
        await runTransaction(db, async (tx) => {
          const recRef = doc(db, 'recommendations', recDocId);
          const sourceRef = doc(db, 'inventoryBatches', rec.batchId);

          const [recSnap, sourceSnap] = await Promise.all([tx.get(recRef), tx.get(sourceRef)]);

          if (recSnap.exists() && recSnap.data().status !== 'open') {
            throw new Error('This recommendation has already been resolved.');
          }

          if (sourceSnap.exists()) {
            const sourceBatch = sourceSnap.data() as Omit<InventoryBatch, 'id'>;

            if (rec.actionType === 'quarantine' && sourceBatch.status === 'active') {
              tx.update(sourceRef, {
                status: 'quarantined',
                updatedAt: serverTimestamp(),
              });
              tx.set(
                doc(db, 'stockMovements', movementId),
                createStockMovementPayload({
                  user,
                  workspaceId: workspace.id,
                  movementType: 'quarantine',
                  skuCode: sourceBatch.skuCode,
                  medicineName: sourceBatch.medicineName,
                  batchId: sourceSnap.id,
                  batchNumber: sourceBatch.batchNumber,
                  hubId: sourceBatch.hubId,
                  hubName: sourceBatch.hubName,
                  quantityDelta: -sourceBatch.quantity,
                  quantityAfter: sourceBatch.quantity,
                  unit: sourceBatch.unit,
                  reason: rec.rationale,
                })
              );
            } else if (
              rec.actionType === 'transfer' &&
              rec.targetHubId &&
              sourceBatch.status === 'active' &&
              !isBatchExpired(sourceBatch.expiryDate) &&
              sourceBatch.hubId !== rec.targetHubId &&
              sourceBatch.quantity > 0
            ) {
              const toHub = hubs.find((h) => h.id === rec.targetHubId);
              if (toHub) {
                const daysLeft = getDaysUntilExpiry(sourceBatch.expiryDate);
                const transitDays = toHub.leadTimeDays + toHub.monsoonBufferDays;
                if (daysLeft <= transitDays) {
                  throw new Error(
                    `Batch shelf life (${daysLeft}d) does not exceed transit lead time (${transitDays}d) to ${toHub.name}.`
                  );
                }
                const qty = Math.min(sourceBatch.quantity, rec.suggestedQty);
                const transferId = sanitizeId(`xfer_${Date.now()}`, 'xfer');
                const remaining = sourceBatch.quantity - qty;
                tx.set(doc(db, 'stockTransfers', transferId), {
                  ownerId: user.uid,
                  workspaceId: workspace.id,
                  batchId: sourceSnap.id,
                  skuCode: sourceBatch.skuCode,
                  medicineName: sourceBatch.medicineName,
                  batchNumber: sourceBatch.batchNumber,
                  fromHubId: sourceBatch.hubId,
                  fromHubName: sourceBatch.hubName,
                  toHubId: toHub.id,
                  toHubName: toHub.name,
                  quantity: qty,
                  unit: sourceBatch.unit,
                  estimatedValueInr: Math.round(qty * sourceBatch.unitCostInr),
                  transportMode:
                    sourceBatch.storageCondition === 'Cold Chain (2-8°C)'
                      ? 'Cold-Chain Van'
                      : toHub.isHillCorridor
                      ? 'Hill-Route Insulated Carrier'
                      : 'Express Highway Cargo',
                  reason: clampText(rec.rationale, 3, BLUEPRINT_LIMITS.MAX_REASON_LEN),
                  status: 'pending',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                tx.update(sourceRef, {
                  quantity: remaining,
                  status: remaining === 0 ? 'depleted' : 'active',
                  updatedAt: serverTimestamp(),
                });
                tx.set(
                  doc(db, 'stockMovements', movementId),
                  createStockMovementPayload({
                    user,
                    workspaceId: workspace.id,
                    movementType: 'transfer_out',
                    skuCode: sourceBatch.skuCode,
                    medicineName: sourceBatch.medicineName,
                    batchId: sourceSnap.id,
                    batchNumber: sourceBatch.batchNumber,
                    hubId: sourceBatch.hubId,
                    hubName: sourceBatch.hubName,
                    targetHubId: toHub.id,
                    targetHubName: toHub.name,
                    quantityDelta: -qty,
                    quantityAfter: remaining,
                    unit: sourceBatch.unit,
                    reason: rec.rationale,
                  })
                );
              }
            } else if (rec.actionType === 'reorder' || rec.actionType === 'buffer') {
              const targetHub = hubs.find((h) => h.id === rec.hubId);
              const destHubId = targetHub?.id ?? sourceBatch.hubId;
              const destHubName = targetHub?.name ?? sourceBatch.hubName;
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + 365);
              const expiryIso = futureDate.toISOString().slice(0, 10);
              const newBatchId = sanitizeId(`batch_po_${Date.now()}`, 'batch');
              const poSuffix = String(Date.now()).slice(-4);
              const poBatchNumber = sanitizeUpperCode(`PO-${poSuffix}-${sourceBatch.skuCode.slice(-3)}`, 40);
              tx.set(doc(db, 'inventoryBatches', newBatchId), {
                ownerId: user.uid,
                workspaceId: workspace.id,
                skuCode: sourceBatch.skuCode,
                medicineName: sourceBatch.medicineName,
                genericName: sourceBatch.genericName,
                category: sourceBatch.category,
                batchNumber: poBatchNumber,
                manufacturer: sourceBatch.manufacturer,
                hubId: destHubId,
                hubName: destHubName,
                quantity: rec.suggestedQty,
                unit: sourceBatch.unit,
                reorderLevel: sourceBatch.reorderLevel,
                unitCostInr: sourceBatch.unitCostInr,
                mrpInr: sourceBatch.mrpInr,
                expiryDate: expiryIso,
                storageCondition: sourceBatch.storageCondition,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              tx.set(
                doc(db, 'stockMovements', movementId),
                createStockMovementPayload({
                  user,
                  workspaceId: workspace.id,
                  movementType: 'reorder_receive',
                  skuCode: sourceBatch.skuCode,
                  medicineName: sourceBatch.medicineName,
                  batchId: newBatchId,
                  batchNumber: poBatchNumber,
                  hubId: destHubId,
                  hubName: destHubName,
                  quantityDelta: rec.suggestedQty,
                  quantityAfter: rec.suggestedQty,
                  unit: sourceBatch.unit,
                  reason: rec.rationale,
                })
              );
            } else if (rec.actionType === 'clearance' && sourceBatch.status === 'active') {
              const cleared = Math.min(sourceBatch.quantity, rec.suggestedQty);
              const remaining = Math.max(0, sourceBatch.quantity - cleared);
              tx.update(sourceRef, {
                quantity: remaining,
                status: remaining === 0 ? 'depleted' : 'active',
                updatedAt: serverTimestamp(),
              });
              tx.set(
                doc(db, 'stockMovements', movementId),
                createStockMovementPayload({
                  user,
                  workspaceId: workspace.id,
                  movementType: 'clearance',
                  skuCode: sourceBatch.skuCode,
                  medicineName: sourceBatch.medicineName,
                  batchId: sourceSnap.id,
                  batchNumber: sourceBatch.batchNumber,
                  hubId: sourceBatch.hubId,
                  hubName: sourceBatch.hubName,
                  quantityDelta: -cleared,
                  quantityAfter: remaining,
                  unit: sourceBatch.unit,
                  reason: rec.rationale,
                })
              );
            }
          }

          if (!recSnap.exists()) {
            tx.set(recRef, {
              ownerId: user.uid,
              workspaceId: workspace.id,
              ruleId: rec.ruleId,
              priority: rec.priority,
              actionType: rec.actionType,
              skuCode: rec.skuCode,
              medicineName: rec.medicineName,
              batchId: rec.batchId,
              hubId: rec.hubId,
              targetHubId: rec.targetHubId || '',
              suggestedQty: rec.suggestedQty,
              estimatedImpactInr: rec.estimatedImpactInr,
              rationale: clampText(rec.rationale, 5, BLUEPRINT_LIMITS.MAX_RATIONALE_LEN),
              status: 'applied',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            tx.update(recRef, {
              status: 'applied',
              updatedAt: serverTimestamp(),
            });
          }
        });
      } catch (err) {
        const msg = toReadableError(err, 'Failed to apply recommendation.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [hubs, user, workspace]
  );

  const dismissRecommendation = useCallback(
    async (rec: EvaluatedRecommendation) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);

      const recDocId = sanitizeId(`rec_${user.uid.slice(0, 8)}_${rec.deterministicKey}`, 'rec');

      try {
        await runTransaction(db, async (tx) => {
          const recRef = doc(db, 'recommendations', recDocId);
          const recSnap = await tx.get(recRef);

          if (recSnap.exists() && recSnap.data().status !== 'open') {
            throw new Error('This recommendation has already been resolved.');
          }

          if (!recSnap.exists()) {
            tx.set(recRef, {
              ownerId: user.uid,
              workspaceId: workspace.id,
              ruleId: rec.ruleId,
              priority: rec.priority,
              actionType: rec.actionType,
              skuCode: rec.skuCode,
              medicineName: rec.medicineName,
              batchId: rec.batchId,
              hubId: rec.hubId,
              targetHubId: rec.targetHubId || '',
              suggestedQty: rec.suggestedQty,
              estimatedImpactInr: rec.estimatedImpactInr,
              rationale: clampText(rec.rationale, 5, BLUEPRINT_LIMITS.MAX_RATIONALE_LEN),
              status: 'dismissed',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            tx.update(recRef, {
              status: 'dismissed',
              updatedAt: serverTimestamp(),
            });
          }
        });
      } catch (err) {
        const msg = toReadableError(err, 'Failed to dismiss recommendation.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [user, workspace]
  );

  const logSalesRecord = useCallback(
    async (input: NewSalesInput) => {
      if (!user || !workspace) return;
      setMutating(true);
      setErrorMessage(null);

      const sku = sanitizeUpperCode(input.skuCode, BLUEPRINT_LIMITS.MAX_SKU_LEN);
      const units = Math.max(0, Math.round(input.unitsSold));
      const revenueAdd = Math.round(units * input.unitCostInr * 1.18);
      const seasonal = Math.min(5, Math.max(0.5, Number(input.seasonalFactor)));

      const existingMatch = salesHistory.find(
        (s) => s.skuCode === sku && s.hubId === input.hubId && s.month === input.month
      );

      if (existingMatch) {
        try {
          await runTransaction(db, async (tx) => {
            const ref = doc(db, 'salesHistory', existingMatch.id);
            const snap = await tx.get(ref);
            if (!snap.exists()) {
              throw new Error('Sales record no longer exists.');
            }
            const cur = snap.data() as SalesHistoryRecord;
            tx.update(ref, {
              unitsSold: cur.unitsSold + units,
              revenueInr: cur.revenueInr + revenueAdd,
              seasonalFactor: seasonal,
              updatedAt: serverTimestamp(),
            });
          });
        } catch (err) {
          const msg = toReadableError(err, 'Failed to update monthly sales record.');
          setErrorMessage(msg);
          throw new Error(msg);
        } finally {
          setMutating(false);
        }
        return;
      }

      const recordId = sanitizeId(`sale_${sku}_${input.hubId}_${input.month}_${Date.now().toString(36)}`, 'sale');
      const payload = {
        ownerId: user.uid,
        workspaceId: workspace.id,
        skuCode: sku,
        medicineName: clampText(input.medicineName, 2, BLUEPRINT_LIMITS.MAX_NAME_LEN),
        category: input.category,
        hubId: input.hubId,
        month: input.month,
        unitsSold: units,
        revenueInr: revenueAdd,
        seasonalFactor: seasonal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'salesHistory', recordId), payload);
      } catch (err) {
        const msg = toReadableError(err, 'Failed to record monthly sales.');
        setErrorMessage(msg);
        throw new Error(msg);
      } finally {
        setMutating(false);
      }
    },
    [salesHistory, user, workspace]
  );

  const value = useMemo<MediFlowContextValue>(
    () => ({
      user,
      authReady,
      loadingData,
      mutating,
      isOnline,
      connectivityIssue,
      errorMessage,
      clearError,
      workspace,
      hubs,
      batches,
      salesHistory,
      transfers,
      stockMovements,
      recommendationRecords,
      forecasts,
      evaluatedRecommendations,
      demoScopeCounts,
      loginWithGoogle,
      logout,
      seedDemoData,
      updateHubLeadTime,
      addBatch,
      adjustBatchQuantity,
      quarantineBatch,
      createTransfer,
      advanceTransferStatus,
      applyRecommendation,
      dismissRecommendation,
      logSalesRecord,
    }),
    [
      user,
      authReady,
      loadingData,
      mutating,
      isOnline,
      connectivityIssue,
      errorMessage,
      clearError,
      workspace,
      hubs,
      batches,
      salesHistory,
      transfers,
      stockMovements,
      recommendationRecords,
      forecasts,
      evaluatedRecommendations,
      demoScopeCounts,
      loginWithGoogle,
      logout,
      seedDemoData,
      updateHubLeadTime,
      addBatch,
      adjustBatchQuantity,
      quarantineBatch,
      createTransfer,
      advanceTransferStatus,
      applyRecommendation,
      dismissRecommendation,
      logSalesRecord,
    ]
  );

  return <MediFlowContext.Provider value={value}>{children}</MediFlowContext.Provider>;
}

export function useMediFlow() {
  const ctx = useContext(MediFlowContext);
  if (!ctx) {
    throw new Error('useMediFlow must be used inside MediFlowProvider');
  }
  return ctx;
}
