import { useMemo, useState } from 'react';
import { Check, CheckCircle2, X } from 'lucide-react';
import { useMediFlow } from '../context/MediFlowContext.tsx';
import { formatInr, formatNumber } from '../lib/validation.ts';
import type { RecommendationPriority, RecommendationStatus } from '../types/pharma.ts';
import { StatusTag } from './StatusTag.tsx';

export function RecommendationsView() {
  const {
    batches,
    hubs,
    evaluatedRecommendations,
    recommendationRecords,
    applyRecommendation,
    dismissRecommendation,
    mutating,
  } = useMediFlow();

  const [statusFilter, setStatusFilter] = useState<'ALL' | RecommendationStatus>('open');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | RecommendationPriority>('ALL');

  const mergedItems = useMemo(() => {
    const items = evaluatedRecommendations.map((rec) => {
      const persisted = recommendationRecords.find(
        (r) =>
          r.ruleId === rec.ruleId &&
          r.batchId === rec.batchId &&
          r.hubId === rec.hubId &&
          (r.targetHubId || '') === (rec.targetHubId || '')
      );
      return {
        rec,
        status: (persisted?.status ?? 'open') as RecommendationStatus,
      };
    });

    // Include historical applied/dismissed records whose batch condition may now be resolved
    for (const persisted of recommendationRecords) {
      const alreadyInEval = evaluatedRecommendations.some(
        (e) =>
          e.ruleId === persisted.ruleId &&
          e.batchId === persisted.batchId &&
          e.hubId === persisted.hubId &&
          (e.targetHubId || '') === (persisted.targetHubId || '')
      );
      if (!alreadyInEval) {
        const batchMeta = batches.find((b) => b.id === persisted.batchId);
        const originHub = hubs.find((h) => h.id === persisted.hubId);
        const destHub = persisted.targetHubId
          ? hubs.find((h) => h.id === persisted.targetHubId)
          : undefined;
        items.push({
          rec: {
            deterministicKey: persisted.id,
            ruleId: persisted.ruleId,
            ruleName: persisted.ruleId.replace('RULE-', '').replace('-', ' '),
            priority: persisted.priority,
            actionType: persisted.actionType,
            skuCode: persisted.skuCode,
            medicineName: persisted.medicineName,
            batchId: persisted.batchId,
            batchNumber: batchMeta?.batchNumber ?? persisted.batchId.slice(-8).toUpperCase(),
            hubId: persisted.hubId,
            hubName: originHub?.name ?? batchMeta?.hubName ?? persisted.hubId,
            targetHubId: persisted.targetHubId || '',
            targetHubName: destHub?.name ?? (persisted.targetHubId || ''),
            suggestedQty: persisted.suggestedQty,
            unit: batchMeta?.unit ?? 'Strips',
            estimatedImpactInr: persisted.estimatedImpactInr,
            rationale: persisted.rationale,
          },
          status: persisted.status,
        });
      }
    }

    return items.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && item.rec.priority !== priorityFilter) return false;
      return true;
    });
  }, [batches, evaluatedRecommendations, hubs, priorityFilter, recommendationRecords, statusFilter]);

  const totalOpenImpact = useMemo(() => {
    return evaluatedRecommendations.reduce((sum, r) => {
      const persisted = recommendationRecords.find(
        (p) =>
          p.ruleId === r.ruleId &&
          p.batchId === r.batchId &&
          p.hubId === r.hubId &&
          (p.targetHubId || '') === (r.targetHubId || '')
      );
      if (!persisted || persisted.status === 'open') {
        return sum + r.estimatedImpactInr;
      }
      return sum;
    }, 0);
  }, [evaluatedRecommendations, recommendationRecords]);

  return (
    <div className="space-y-6">
      {/* Deterministic Rules Summary Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-[#0F2544]">
            Deterministic Business-Rule Recommendations
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Auditable rules (R1 FEFO Clearance · R2 Inter-Hub Transfer · R3 Reorder Breach · R4 Hill-Corridor Buffer · R5 Quarantine) evaluated without external AI.
          </p>
        </div>

        <div className="text-left lg:text-right shrink-0">
          <p className="text-xs text-slate-500">Recoverable / Protected Value</p>
          <p className="font-mono tabular-nums text-xl font-bold text-teal-700">
            {formatInr(totalOpenImpact)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {(['open', 'applied', 'dismissed', 'ALL'] as const).map((st) => (
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
              {st === 'ALL' ? 'All History' : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {(['ALL', 'critical', 'warning', 'info'] as const).map((pr) => (
            <button
              key={pr}
              type="button"
              onClick={() => setPriorityFilter(pr)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer capitalize whitespace-nowrap ${
                priorityFilter === pr
                  ? 'bg-white text-[#0F2544] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F2544]'
              }`}
            >
              {pr === 'ALL' ? 'All Priorities' : pr}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendation List */}
      {mergedItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-[#0F2544]">No recommendations in this view</p>
          <p className="mt-1 text-xs text-slate-500">
            Switch filter tabs to inspect applied or dismissed actions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mergedItems.map(({ rec, status }) => (
            <article
              key={`${rec.deterministicKey}_${status}`}
              className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <StatusTag
                    tone={
                      rec.priority === 'critical'
                        ? 'critical'
                        : rec.priority === 'warning'
                        ? 'warning'
                        : 'info'
                    }
                    label={rec.ruleName}
                  />
                  <span className="font-mono text-xs text-slate-500">{rec.ruleId}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-xs text-slate-600">{rec.skuCode}</span>
                  {status !== 'open' && (
                    <StatusTag
                      tone={status === 'applied' ? 'healthy' : 'neutral'}
                      label={status === 'applied' ? 'Executed' : 'Dismissed'}
                    />
                  )}
                </div>

                <div>
                  <h3 className="font-display text-base font-bold text-[#0F2544]">
                    {rec.medicineName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Origin: <strong className="text-[#0F2544]">{rec.hubName}</strong>
                    {rec.targetHubName ? (
                      <>
                        {' → '}Destination: <strong className="text-teal-700">{rec.targetHubName}</strong>
                      </>
                    ) : null}
                    {' · '}Batch <span className="font-mono">{rec.batchNumber}</span>
                  </p>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">{rec.rationale}</p>
              </div>

              <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                <div className="text-left lg:text-right">
                  <p className="font-mono tabular-nums text-base font-bold text-[#0F2544]">
                    {formatNumber(rec.suggestedQty)} {rec.unit}
                  </p>
                  <p className="font-mono tabular-nums text-xs text-teal-700 font-semibold">
                    Impact: {formatInr(rec.estimatedImpactInr)}
                  </p>
                </div>

                {status === 'open' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => {
                        void dismissRecommendation(rec).catch(() => {});
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => {
                        void applyRecommendation(rec).catch(() => {});
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {rec.actionType === 'transfer'
                          ? 'Create Transfer'
                          : rec.actionType === 'quarantine'
                          ? 'Quarantine Now'
                          : rec.actionType === 'reorder' || rec.actionType === 'buffer'
                          ? 'Receive Stock'
                          : 'Log Clearance'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
