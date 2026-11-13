import type {
  EvaluatedRecommendation,
  ForecastMonthlyPoint,
  HubLeadTimeOverride,
  InventoryBatch,
  SalesHistoryRecord,
  SkuForecastResult,
} from '../src/types/pharma.ts';
import { applyHubOverrides } from '../src/lib/validation.ts';
import { NE_INDIA_HUBS } from './neIndiaData.ts';

function daysBetween(fromDate: Date, toIsoDate: string): number {
  const target = new Date(`${toIsoDate}T00:00:00Z`);
  const base = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  return Math.round((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

function isSaleableBatch(batch: InventoryBatch, referenceDate: Date): boolean {
  return batch.status === 'active' && batch.quantity > 0 && daysBetween(referenceDate, batch.expiryDate) > 0;
}

function nextMonths(lastMonth: string, count: number): string[] {
  const [yearStr, monthStr] = lastMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    const dt = new Date(Date.UTC(year, month + i, 1));
    result.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

/**
 * Deterministic Moving-Average Demand Forecasting Engine
 * Uses SMA-3, SMA-6, WMA-3 (weights 0.5 / 0.3 / 0.2), rolling one-step-ahead backtesting,
 * and configurable Northeast India hub lead-time safety stock.
 * Expired batches (expiryDate <= referenceDate) are strictly excluded from saleable stock.
 */
export function computeMovingAverageForecasts(
  batches: InventoryBatch[],
  salesHistory: SalesHistoryRecord[],
  filterHubId?: string,
  referenceDate = new Date(),
  hubOverrides?: Record<string, HubLeadTimeOverride>
): SkuForecastResult[] {
  const effectiveHubs = applyHubOverrides(NE_INDIA_HUBS, hubOverrides);
  const hubMap = new Map(effectiveHubs.map((h) => [h.id, h]));

  // Group sales by skuCode + hubId (or across all hubs if filterHubId === 'ALL')
  const grouped = new Map<string, SalesHistoryRecord[]>();

  for (const rec of salesHistory) {
    if (filterHubId && filterHubId !== 'ALL' && rec.hubId !== filterHubId) {
      continue;
    }
    const groupKey = filterHubId === 'ALL' ? `${rec.skuCode}__ALL` : `${rec.skuCode}__${rec.hubId}`;
    const arr = grouped.get(groupKey) ?? [];
    arr.push(rec);
    grouped.set(groupKey, arr);
  }

  const results: SkuForecastResult[] = [];

  for (const [groupKey, records] of grouped.entries()) {
    const [skuCode, hubScope] = groupKey.split('__');

    // Aggregate by month in case hubScope === 'ALL'
    const monthTotals = new Map<string, { units: number; seasonalSum: number; count: number }>();
    for (const r of records) {
      const existing = monthTotals.get(r.month) ?? { units: 0, seasonalSum: 0, count: 0 };
      existing.units += r.unitsSold;
      existing.seasonalSum += r.seasonalFactor;
      existing.count += 1;
      monthTotals.set(r.month, existing);
    }

    const sortedMonths = Array.from(monthTotals.keys()).sort();
    if (sortedMonths.length === 0) continue;

    const monthlyValues = sortedMonths.map((m) => monthTotals.get(m)!.units);
    const n = monthlyValues.length;

    let absErrorSum = 0;
    let absErrorCount = 0;
    let pctErrorSum = 0;
    let pctErrorCount = 0;

    // Rolling SMA-3, WMA-3, and strict one-step-ahead backtest forecast (using 0..idx-1 only)
    const series: ForecastMonthlyPoint[] = sortedMonths.map((month, idx) => {
      const actualUnits = monthlyValues[idx];
      let sma3Point: number | null = null;
      let wma3Point: number | null = null;
      if (idx >= 2) {
        sma3Point = Math.round((monthlyValues[idx] + monthlyValues[idx - 1] + monthlyValues[idx - 2]) / 3);
        wma3Point = Math.round(
          monthlyValues[idx] * 0.5 + monthlyValues[idx - 1] * 0.3 + monthlyValues[idx - 2] * 0.2
        );
      } else if (idx === 1) {
        sma3Point = Math.round((monthlyValues[1] + monthlyValues[0]) / 2);
        wma3Point = Math.round(monthlyValues[1] * 0.6 + monthlyValues[0] * 0.4);
      } else {
        sma3Point = actualUnits;
        wma3Point = actualUnits;
      }

      let backtestForecast: number | null = null;
      if (idx >= 1) {
        const prior = monthlyValues.slice(Math.max(0, idx - 3), idx);
        let priorWma = prior[0];
        if (prior.length === 3) {
          priorWma = Math.round(prior[2] * 0.5 + prior[1] * 0.3 + prior[0] * 0.2);
        } else if (prior.length === 2) {
          priorWma = Math.round(prior[1] * 0.6 + prior[0] * 0.4);
        }
        const monthMeta = monthTotals.get(month)!;
        const monthSeasonal = monthMeta.count > 0 ? monthMeta.seasonalSum / monthMeta.count : 1;
        backtestForecast = Math.round(priorWma * (0.65 + 0.35 * monthSeasonal));

        const absErr = Math.abs(actualUnits - backtestForecast);
        absErrorSum += absErr;
        absErrorCount += 1;

        // Protect MAPE from zero actual demand
        if (actualUnits > 0) {
          pctErrorSum += (absErr / actualUnits) * 100;
          pctErrorCount += 1;
        }
      }

      return {
        month,
        actualUnits,
        sma3: sma3Point,
        wma3: wma3Point,
        backtestForecast,
        projectedUnits: null,
      };
    });

    const maeUnits = absErrorCount > 0 ? Number((absErrorSum / absErrorCount).toFixed(1)) : null;
    const mapePct = pctErrorCount > 0 ? Number((pctErrorSum / pctErrorCount).toFixed(1)) : null;

    // Latest SMA-3, SMA-6, WMA-3
    const last3 = monthlyValues.slice(-3);
    const sma3 = Math.round(last3.reduce((acc, v) => acc + v, 0) / last3.length);

    const last6 = monthlyValues.slice(-6);
    const sma6 = Math.round(last6.reduce((acc, v) => acc + v, 0) / last6.length);

    let wma3 = sma3;
    if (last3.length === 3) {
      wma3 = Math.round(last3[2] * 0.5 + last3[1] * 0.3 + last3[0] * 0.2);
    } else if (last3.length === 2) {
      wma3 = Math.round(last3[1] * 0.6 + last3[0] * 0.4);
    }

    const latestMonth = sortedMonths[n - 1];
    const latestMeta = monthTotals.get(latestMonth)!;
    const seasonalFactor = Number((latestMeta.seasonalSum / latestMeta.count).toFixed(2));

    // Weighted moving average adjusted by NE India regional seasonal factor
    const seasonallyAdjustedForecast = Math.round(wma3 * (0.65 + 0.35 * seasonalFactor));
    const dailyBurnRate = Number((seasonallyAdjustedForecast / 30).toFixed(2));

    // Trend % comparing recent 3 months vs prior 3 months
    const prior3 = monthlyValues.slice(Math.max(0, n - 6), Math.max(0, n - 3));
    const priorAvg = prior3.length > 0 ? prior3.reduce((a, b) => a + b, 0) / prior3.length : sma6;
    const trendPct = priorAvg > 0 ? Number((((sma3 - priorAvg) / priorAvg) * 100).toFixed(1)) : 0;

    // Sum ONLY saleable (active, non-expired, positive quantity) stock for this SKU + hub scope
    const matchingBatches = batches.filter(
      (b) =>
        b.skuCode === skuCode &&
        isSaleableBatch(b, referenceDate) &&
        (hubScope === 'ALL' || b.hubId === hubScope)
    );
    const currentStock = matchingBatches.reduce((sum, b) => sum + b.quantity, 0);

    const hub = hubScope === 'ALL' ? undefined : hubMap.get(hubScope);
    const effectiveLeadDays = hub ? hub.leadTimeDays + hub.monsoonBufferDays : 5;
    const safetyStock = Math.ceil(dailyBurnRate * effectiveLeadDays * 0.65);
    const reorderPoint = Math.ceil(dailyBurnRate * effectiveLeadDays + safetyStock);
    const daysOfCover = dailyBurnRate > 0 ? Math.round(currentStock / dailyBurnRate) : 999;

    const targetStock = Math.ceil(seasonallyAdjustedForecast * 1.5 + safetyStock);
    const suggestedOrderQty = Math.max(0, targetStock - currentStock);

    let stockHealth: 'healthy' | 'low' | 'critical' | 'overstock' = 'healthy';
    if (currentStock === 0 || currentStock <= safetyStock || daysOfCover < 10) {
      stockHealth = 'critical';
    } else if (currentStock <= reorderPoint || daysOfCover < 22) {
      stockHealth = 'low';
    } else if (daysOfCover > 110) {
      stockHealth = 'overstock';
    }

    // Add 3-month forward projection points
    const futureMonths = nextMonths(latestMonth, 3);
    const slope = n >= 2 ? (wma3 - sma6) * 0.25 : 0;
    futureMonths.forEach((fm, idx) => {
      const projected = Math.max(1, Math.round(seasonallyAdjustedForecast + slope * (idx + 1)));
      series.push({
        month: fm,
        actualUnits: null,
        sma3: null,
        wma3: null,
        backtestForecast: null,
        projectedUnits: projected,
      });
    });

    results.push({
      skuCode,
      medicineName: records[0].medicineName,
      category: records[0].category,
      hubId: hubScope,
      hubName: hubScope === 'ALL' ? 'All Northeast Hubs (Aggregated)' : hub?.name ?? hubScope,
      currentStock,
      sma3,
      sma6,
      wma3,
      seasonalFactor,
      seasonallyAdjustedForecast,
      dailyBurnRate,
      daysOfCover,
      safetyStock,
      reorderPoint,
      suggestedOrderQty,
      trendPct,
      mapePct,
      maeUnits,
      backtestPoints: absErrorCount,
      stockHealth,
      series,
    });
  }

  return results.sort((a, b) => a.daysOfCover - b.daysOfCover);
}

/**
 * Deterministic Business Rules Engine (Zero external AI API)
 * Evaluates batch expiry, FEFO velocity, configurable regional corridor lead-times,
 * hub imbalances, and zero-stock SKUs.
 */
export function evaluateDeterministicRecommendations(
  batches: InventoryBatch[],
  salesHistory: SalesHistoryRecord[],
  referenceDate = new Date(),
  hubOverrides?: Record<string, HubLeadTimeOverride>
): EvaluatedRecommendation[] {
  const effectiveHubs = applyHubOverrides(NE_INDIA_HUBS, hubOverrides);
  const forecasts = computeMovingAverageForecasts(
    batches,
    salesHistory,
    undefined,
    referenceDate,
    hubOverrides
  );
  const forecastMap = new Map<string, SkuForecastResult>();
  for (const f of forecasts) {
    forecastMap.set(`${f.skuCode}__${f.hubId}`, f);
  }

  const hubMap = new Map(effectiveHubs.map((h) => [h.id, h]));
  const recommendations: EvaluatedRecommendation[] = [];

  // Index hub stock by SKU for inter-hub transfer matching
  const skuHubForecasts = new Map<string, SkuForecastResult[]>();
  for (const f of forecasts) {
    const arr = skuHubForecasts.get(f.skuCode) ?? [];
    arr.push(f);
    skuHubForecasts.set(f.skuCode, arr);
  }

  // Evaluate per-batch rules: R5 (Quarantine), R1 (Urgent Expiry Clearance), R2 (Inter-Hub Transfer)
  for (const batch of batches) {
    if (batch.quantity <= 0 || batch.status === 'depleted') continue;

    const daysToExpiry = daysBetween(referenceDate, batch.expiryDate);
    const forecast = forecastMap.get(`${batch.skuCode}__${batch.hubId}`);
    const dailyBurn = forecast?.dailyBurnRate ?? Math.max(1, Math.round(batch.reorderLevel / 15));
    const batchDaysOfStock = dailyBurn > 0 ? Math.round(batch.quantity / dailyBurn) : 999;

    // RULE R5: Expired Active Stock -> Immediate Quarantine
    if (daysToExpiry <= 0 && batch.status === 'active') {
      recommendations.push({
        deterministicKey: `R5_${batch.id}`,
        ruleId: 'RULE-R5-QUARANTINE',
        ruleName: 'Expired Batch Quarantine Protocol',
        priority: 'critical',
        actionType: 'quarantine',
        skuCode: batch.skuCode,
        medicineName: batch.medicineName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        hubId: batch.hubId,
        hubName: batch.hubName,
        targetHubId: '',
        targetHubName: '',
        suggestedQty: batch.quantity,
        unit: batch.unit,
        estimatedImpactInr: Math.round(batch.quantity * batch.unitCostInr),
        rationale: `Batch ${batch.batchNumber} expired ${Math.abs(daysToExpiry)} days ago (${batch.expiryDate}). Excluded from saleable stock; quarantine immediately to prevent non-compliant dispatch.`,
      });
      continue;
    }

    if (batch.status !== 'active' || daysToExpiry <= 0) continue;

    // RULE R1: Critical <= 30 Days Expiry with Excess Stock Over Burn Capacity
    if (daysToExpiry > 0 && daysToExpiry <= 30) {
      const consumableBeforeExpiry = Math.floor(dailyBurn * daysToExpiry * 0.85);
      const excessUnits = Math.max(Math.round(batch.quantity * 0.4), batch.quantity - consumableBeforeExpiry);
      const clearanceQty = Math.min(batch.quantity, Math.max(1, excessUnits));
      recommendations.push({
        deterministicKey: `R1_${batch.id}`,
        ruleId: 'RULE-R1-EXPIRY',
        ruleName: 'FEFO Urgent Hospital Clearance',
        priority: 'critical',
        actionType: 'clearance',
        skuCode: batch.skuCode,
        medicineName: batch.medicineName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        hubId: batch.hubId,
        hubName: batch.hubName,
        targetHubId: '',
        targetHubName: '',
        suggestedQty: clearanceQty,
        unit: batch.unit,
        estimatedImpactInr: Math.round(clearanceQty * batch.unitCostInr * 0.82),
        rationale: `Expires in ${daysToExpiry} days (${batch.expiryDate}). At ${dailyBurn} ${batch.unit}/day burn rate, ${clearanceQty} ${batch.unit} exceed normal absorption; allocate to partner hospitals on FEFO priority.`,
      });
    }

    // RULE R2: Near-Expiry Surplus (31-90 days) Redistribution to Deficit Hub
    if (daysToExpiry > 30 && daysToExpiry <= 90 && batchDaysOfStock > daysToExpiry * 0.8) {
      const peerHubs = (skuHubForecasts.get(batch.skuCode) ?? []).filter((p) => {
        if (p.hubId === batch.hubId || p.daysOfCover >= 28) return false;
        const peerMeta = hubMap.get(p.hubId);
        const transitDays = peerMeta ? peerMeta.leadTimeDays + peerMeta.monsoonBufferDays : 5;
        return daysToExpiry > transitDays + 15;
      });

      let targetHub = peerHubs.sort((a, b) => a.daysOfCover - b.daysOfCover)[0];

      if (!targetHub) {
        const lowPeerBatch = batches.find((other) => {
          if (
            other.skuCode !== batch.skuCode ||
            other.hubId === batch.hubId ||
            other.status !== 'active' ||
            other.quantity > other.reorderLevel
          ) {
            return false;
          }
          const peerMeta = hubMap.get(other.hubId);
          const transitDays = peerMeta ? peerMeta.leadTimeDays + peerMeta.monsoonBufferDays : 5;
          return daysToExpiry > transitDays + 15;
        });
        if (lowPeerBatch) {
          const transferable = Math.min(
            Math.round(batch.quantity * 0.45),
            Math.max(20, lowPeerBatch.reorderLevel * 2 - lowPeerBatch.quantity)
          );
          if (transferable > 0) {
            recommendations.push({
              deterministicKey: `R2_${batch.id}_${lowPeerBatch.hubId}`,
              ruleId: 'RULE-R2-TRANSFER',
              ruleName: 'Inter-Hub Expiry Salvage Transfer',
              priority: 'warning',
              actionType: 'transfer',
              skuCode: batch.skuCode,
              medicineName: batch.medicineName,
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              hubId: batch.hubId,
              hubName: batch.hubName,
              targetHubId: lowPeerBatch.hubId,
              targetHubName: lowPeerBatch.hubName,
              suggestedQty: transferable,
              unit: batch.unit,
              estimatedImpactInr: Math.round(transferable * batch.unitCostInr),
              rationale: `${batch.hubName} holds ${batchDaysOfStock}d cover expiring in ${daysToExpiry}d, while ${lowPeerBatch.hubName} is below reorder threshold (${lowPeerBatch.quantity} ${batch.unit}). Transfer ${transferable} ${batch.unit} to prevent expiry write-off.`,
            });
          }
        }
      } else {
        const deficitQty = Math.max(20, Math.round(targetHub.seasonallyAdjustedForecast - targetHub.currentStock));
        const transferable = Math.min(Math.round(batch.quantity * 0.5), deficitQty);
        if (transferable > 0) {
          recommendations.push({
            deterministicKey: `R2_${batch.id}_${targetHub.hubId}`,
            ruleId: 'RULE-R2-TRANSFER',
            ruleName: 'Inter-Hub Expiry Salvage Transfer',
            priority: 'warning',
            actionType: 'transfer',
            skuCode: batch.skuCode,
            medicineName: batch.medicineName,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            hubId: batch.hubId,
            hubName: batch.hubName,
            targetHubId: targetHub.hubId,
            targetHubName: targetHub.hubName,
            suggestedQty: transferable,
            unit: batch.unit,
            estimatedImpactInr: Math.round(transferable * batch.unitCostInr),
            rationale: `${batch.hubName} has ${batchDaysOfStock}d cover (expires ${batch.expiryDate}), while ${targetHub.hubName} has only ${targetHub.daysOfCover}d cover. Transfer ${transferable} ${batch.unit} to salvage stock value.`,
          });
        }
      }
    }
  }

  // Evaluate SKU+Hub level rules: R3 (Reorder Trigger, including zero-stock) & R4 (Hill/Monsoon Corridor Buffer)
  for (const forecast of forecasts) {
    const saleableBatches = batches.filter(
      (b) =>
        b.skuCode === forecast.skuCode &&
        b.hubId === forecast.hubId &&
        isSaleableBatch(b, referenceDate)
    );
    const sameHubFallbackBatch = batches.find(
      (b) => b.skuCode === forecast.skuCode && b.hubId === forecast.hubId
    );
    const crossHubSkuBatch = batches.find((b) => b.skuCode === forecast.skuCode);
    const templateBatch = saleableBatches[0] ?? sameHubFallbackBatch ?? crossHubSkuBatch;
    if (!templateBatch) continue;

    const hub = hubMap.get(forecast.hubId);
    const effectiveLeadDays = hub ? hub.leadTimeDays + hub.monsoonBufferDays : 5;

    if (forecast.currentStock <= forecast.reorderPoint && forecast.suggestedOrderQty > 0) {
      const isZeroStock = forecast.currentStock === 0;
      const isCritical = isZeroStock || forecast.stockHealth === 'critical';
      recommendations.push({
        deterministicKey: `R3_${forecast.skuCode}_${forecast.hubId}`,
        ruleId: 'RULE-R3-REORDER',
        ruleName: isZeroStock
          ? 'Stockout Emergency Replenishment'
          : 'Moving-Average Reorder Point Breach',
        priority: isCritical ? 'critical' : 'warning',
        actionType: 'reorder',
        skuCode: forecast.skuCode,
        medicineName: forecast.medicineName,
        batchId: templateBatch.id,
        batchNumber: isZeroStock ? 'STOCKOUT-0' : templateBatch.batchNumber,
        hubId: forecast.hubId,
        hubName: forecast.hubName,
        targetHubId: '',
        targetHubName: '',
        suggestedQty: forecast.suggestedOrderQty,
        unit: templateBatch.unit,
        estimatedImpactInr: Math.round(forecast.suggestedOrderQty * templateBatch.unitCostInr),
        rationale: isZeroStock
          ? `Zero saleable stock at ${forecast.hubName} (all batches depleted or expired). Historical WMA-3 forecast (${forecast.wma3}/mo) and ${effectiveLeadDays}d lead time require immediate replenishment of ${forecast.suggestedOrderQty} ${templateBatch.unit}.`
          : `Saleable stock (${forecast.currentStock} ${templateBatch.unit}) breached Reorder Point (${forecast.reorderPoint}) based on WMA-3 forecast (${forecast.wma3}/mo) and ${effectiveLeadDays}d corridor lead time.`,
      });
    } else if (
      hub?.isHillCorridor &&
      (templateBatch.category === 'Cold-Chain Biologics' || templateBatch.category === 'Pediatrics & ORS') &&
      forecast.daysOfCover < 30
    ) {
      const bufferQty = Math.max(25, Math.round(forecast.dailyBurnRate * 10));
      recommendations.push({
        deterministicKey: `R4_${forecast.skuCode}_${forecast.hubId}`,
        ruleId: 'RULE-R4-MONSOON',
        ruleName: 'Hill-Corridor Monsoon Safety Buffer',
        priority: 'info',
        actionType: 'buffer',
        skuCode: forecast.skuCode,
        medicineName: forecast.medicineName,
        batchId: templateBatch.id,
        batchNumber: templateBatch.batchNumber,
        hubId: forecast.hubId,
        hubName: forecast.hubName,
        targetHubId: '',
        targetHubName: '',
        suggestedQty: bufferQty,
        unit: templateBatch.unit,
        estimatedImpactInr: Math.round(bufferQty * templateBatch.unitCostInr),
        rationale: `${hub.name} (${hub.state}) requires +${hub.monsoonBufferDays}d hill-route buffer for ${templateBatch.category}. Raise reserve by ${bufferQty} ${templateBatch.unit} to maintain 30d cover.`,
      });
    }
  }

  const priorityRank = { critical: 0, warning: 1, info: 2 };
  return recommendations.sort(
    (a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.estimatedImpactInr - a.estimatedImpactInr
  );
}

