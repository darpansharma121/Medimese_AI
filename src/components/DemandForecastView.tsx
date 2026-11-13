import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { auth } from '../lib/firebase.ts';
import { useMediFlow } from '../context/MediFlowContext.tsx';
import { formatNumber } from '../lib/validation.ts';
import type { SkuForecastResult } from '../types/pharma.ts';
import { StatusTag } from './StatusTag.tsx';

export function DemandForecastView({
  onOpenLogSales,
}: {
  onOpenLogSales: () => void;
}) {
  const { batches, salesHistory, hubs, workspace, demoScopeCounts } = useMediFlow();
  const [hubScope, setHubScope] = useState<string>('ALL');
  const [scopedForecasts, setScopedForecasts] = useState<SkuForecastResult[]>([]);
  const [selectedSkuKey, setSelectedSkuKey] = useState<string>('');
  const [computing, setComputing] = useState(false);

  const phase1Hubs = useMemo(
    () => hubs.filter((h) => h.pilotPhase === 'Phase 1 (Assam Pilot)'),
    [hubs]
  );
  const phase2Hubs = useMemo(
    () => hubs.filter((h) => h.pilotPhase !== 'Phase 1 (Assam Pilot)'),
    [hubs]
  );

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser || (batches.length === 0 && salesHistory.length === 0)) {
      setScopedForecasts([]);
      return;
    }

    let cancelled = false;
    setComputing(true);

    (async () => {
      try {
        const idToken = await currentUser.getIdToken();
        const r = await fetch('/api/forecast/compute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            batches,
            salesHistory,
            hubId: hubScope === 'ALL' ? 'ALL' : hubScope,
            hubOverrides: workspace?.hubOverrides,
          }),
        });
        if (!r.ok) {
          throw new Error(`Forecast computation failed (${r.status})`);
        }
        const data = (await r.json()) as { forecasts?: SkuForecastResult[] };
        if (cancelled) return;
        const list = Array.isArray(data.forecasts) ? data.forecasts : [];
        setScopedForecasts(list);
        if (list.length > 0) {
          setSelectedSkuKey((prev) => {
            const exists = list.some((item) => `${item.skuCode}__${item.hubId}` === prev);
            return exists ? prev : `${list[0].skuCode}__${list[0].hubId}`;
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Forecast compute error:', err);
        }
      } finally {
        if (!cancelled) setComputing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [batches, hubScope, salesHistory, workspace?.hubOverrides]);

  const activeForecast = useMemo(() => {
    return (
      scopedForecasts.find((f) => `${f.skuCode}__${f.hubId}` === selectedSkuKey) ??
      scopedForecasts[0] ??
      null
    );
  }, [scopedForecasts, selectedSkuKey]);

  const isDemoSalesActive = demoScopeCounts.demoSales > 0;

  return (
    <div className="space-y-6">
      {/* Controls & Methodology Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-display text-base font-bold text-[#0F2544]">
              Moving-Average Demand Forecasting Engine
            </h2>
            {isDemoSalesActive && (
              <StatusTag tone="info" label="Synthetic Demo Baseline" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic SMA-3, SMA-6, Weighted Moving Average (0.50 / 0.30 / 0.20), and rolling one-step-ahead historical backtesting adjusted for configurable corridor lead times.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            value={hubScope}
            onChange={(e) => setHubScope(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-[#0F2544] focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">All Northeast Hubs (Aggregated)</option>
            {phase1Hubs.length > 0 && (
              <optgroup label="Phase 1 (Assam Pilot)">
                {phase1Hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.state})
                  </option>
                ))}
              </optgroup>
            )}
            {phase2Hubs.length > 0 && (
              <optgroup label="Phase 2 (NE Expansion)">
                {phase2Hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.state})
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <button
            type="button"
            onClick={onOpenLogSales}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F2544] hover:bg-[#17355E] text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Log Monthly Sale</span>
          </button>
        </div>
      </div>

      {activeForecast ? (
        <>
          {/* Selected SKU Deep-Dive Chart + KPIs */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-teal-700">
                    {activeForecast.skuCode}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500">{activeForecast.category}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500">{activeForecast.hubName}</span>
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-[#0F2544]">
                  {activeForecast.medicineName}
                </h3>
              </div>

              <select
                value={`${activeForecast.skuCode}__${activeForecast.hubId}`}
                onChange={(e) => setSelectedSkuKey(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-[#0F2544] max-w-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {scopedForecasts.map((f) => (
                  <option key={`${f.skuCode}__${f.hubId}`} value={`${f.skuCode}__${f.hubId}`}>
                    {f.medicineName} ({f.skuCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-medium text-slate-500">SMA-3 Monthly</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-[#0F2544]">
                  {formatNumber(activeForecast.sma3)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-medium text-slate-500">SMA-6 Baseline</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-[#0F2544]">
                  {formatNumber(activeForecast.sma6)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-medium text-slate-500">WMA-3 Forecast</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-teal-700">
                  {formatNumber(activeForecast.seasonallyAdjustedForecast)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-medium text-slate-500">Safety Stock</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-[#0F2544]">
                  {formatNumber(activeForecast.safetyStock)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-medium text-slate-500">Reorder Point</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-amber-700">
                  {formatNumber(activeForecast.reorderPoint)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-medium text-slate-500">Days of Cover</p>
                <p
                  className={`mt-1 font-mono tabular-nums text-base font-bold ${
                    activeForecast.daysOfCover < 14
                      ? 'text-red-700'
                      : activeForecast.daysOfCover < 25
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {activeForecast.daysOfCover >= 999 ? '∞' : `${activeForecast.daysOfCover}d`}
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-medium text-slate-500">Backtest MAE</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-[#0F2544]">
                  {activeForecast.maeUnits !== null
                    ? `${formatNumber(activeForecast.maeUnits)}`
                    : 'N/A'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {activeForecast.backtestPoints} step(s)
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-[11px] font-medium text-slate-500">Backtest MAPE</p>
                <p className="mt-1 font-mono tabular-nums text-base font-bold text-[#0F2544]">
                  {activeForecast.mapePct !== null ? `${activeForecast.mapePct}%` : 'N/A'}
                </p>
                <p className="text-[10px] text-slate-400">non-zero actuals</p>
              </div>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeForecast.series} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
                  <Line
                    type="monotone"
                    dataKey="actualUnits"
                    name="Actual Dispatched"
                    stroke="#0F2544"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="backtestForecast"
                    name="Historical Predicted (Backtest)"
                    stroke="#7C3AED"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sma3"
                    name="SMA-3"
                    stroke="#64748B"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="wma3"
                    name="WMA-3"
                    stroke="#0D9488"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="projectedUnits"
                    name="3-Month Forecast"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    strokeDasharray="5 3"
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* All SKUs Forecast Matrix */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h3 className="font-display text-base font-bold text-[#0F2544]">
                SKU Moving-Average &amp; Backtest Matrix ({scopedForecasts.length})
              </h3>
              {computing && <span className="text-xs text-slate-500">Recalculating...</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Medicine / SKU</th>
                    <th className="py-3 px-4 text-right">Saleable Stock</th>
                    <th className="py-3 px-4 text-right">SMA-3</th>
                    <th className="py-3 px-4 text-right">WMA-3 Adj.</th>
                    <th className="py-3 px-4 text-right">Reorder Pt</th>
                    <th className="py-3 px-4 text-right">MAE</th>
                    <th className="py-3 px-4 text-right">MAPE</th>
                    <th className="py-3 px-4 text-right">Cover</th>
                    <th className="py-3 px-4">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {scopedForecasts.map((f) => {
                    const rowKey = `${f.skuCode}__${f.hubId}`;
                    const isSelected = rowKey === `${activeForecast.skuCode}__${activeForecast.hubId}`;
                    return (
                      <tr
                        key={rowKey}
                        onClick={() => setSelectedSkuKey(rowKey)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-teal-50/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#0F2544]">{f.medicineName}</p>
                          <p className="font-mono text-slate-500">
                            {f.skuCode} · {f.category}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0F2544]">
                          {formatNumber(f.currentStock)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {formatNumber(f.sma3)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                          {formatNumber(f.seasonallyAdjustedForecast)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatNumber(f.reorderPoint)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {f.maeUnits !== null ? formatNumber(f.maeUnits) : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                          {f.mapePct !== null ? `${f.mapePct}%` : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#0F2544]">
                          {f.daysOfCover >= 999 ? '∞' : `${f.daysOfCover}d`}
                        </td>
                        <td className="py-3 px-4">
                          {f.stockHealth === 'critical' ? (
                            <StatusTag tone="critical" label="Stockout Risk" />
                          ) : f.stockHealth === 'low' ? (
                            <StatusTag tone="warning" label="Reorder Due" />
                          ) : f.stockHealth === 'overstock' ? (
                            <StatusTag tone="info" label="Surplus" />
                          ) : (
                            <StatusTag tone="healthy" label="Healthy" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <p className="text-sm font-semibold text-[#0F2544]">No historical sales records available</p>
          <p className="mt-1 text-xs text-slate-500">
            Log monthly sales records or reset the demonstration dataset to compute moving averages.
          </p>
          <button
            type="button"
            onClick={onOpenLogSales}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log First Sale</span>
          </button>
        </div>
      )}
    </div>
  );
}
