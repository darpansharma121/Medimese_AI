import { Activity, ArrowRight, ShieldCheck, TrendingUp, Truck } from 'lucide-react';
import { useMediFlow } from '../context/MediFlowContext.tsx';

export function AuthGate() {
  const { loginWithGoogle, errorMessage, clearError } = useMediFlow();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full mx-auto bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-[#0F2544]">
              <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white">
                <Activity className="w-5 h-5" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight">MediFlow AI</span>
            </div>

            <h1 className="mt-8 font-display text-3xl font-bold text-[#0F2544] tracking-tight leading-tight text-balance">
              Pharmaceutical inventory &amp; cold-chain intelligence for Northeast India.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
              Manage FEFO batch expiry risk, moving-average demand forecasts, and inter-hub stock transfers across 9 regional depots from Guwahati and Tezpur to Aizawl and Imphal.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F2544]">Batch-Level FEFO &amp; Expiry Control</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Automated 30/60/90-day risk stratification and CDSCO quarantine workflows.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F2544]">Moving-Average Demand Forecasting</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    SMA-3, SMA-6, and weighted moving averages calibrated for regional monsoon lead times.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F2544]">Deterministic Stock Redistribution</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Transparent rule-based transfer and reorder triggers backed by Cloud Firestore.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200">
            {errorMessage && (
              <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between gap-2">
                <span>{errorMessage}</span>
                <button type="button" onClick={clearError} className="underline font-medium shrink-0">
                  Dismiss
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3 bg-[#0F2544] hover:bg-[#17355E] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <span>Sign in with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="mt-3 text-xs text-slate-500">
              Authenticated workspace with per-distributor Cloud Firestore isolation.
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-100 border-t lg:border-t-0 lg:border-l border-slate-200 p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
              Active Distribution Network
            </p>
            <h2 className="mt-2 font-display text-lg font-bold text-[#0F2544]">
              9 Northeast Corridor Hubs
            </h2>
            <div className="mt-5 divide-y divide-slate-200 border-t border-b border-slate-200 text-xs">
              {[
                { hub: 'Guwahati Central Hub', state: 'Assam', lead: '2d lead' },
                { hub: 'Tezpur Central Assam Depot', state: 'Assam', lead: '3d lead' },
                { hub: 'Silchar Barak Depot', state: 'Assam', lead: '5d lead' },
                { hub: 'Dibrugarh Upper Assam', state: 'Assam', lead: '4d lead' },
                { hub: 'Shillong Meghalaya Hub', state: 'Meghalaya', lead: '4d lead' },
                { hub: 'Imphal Manipur Hub', state: 'Manipur', lead: '7d lead' },
                { hub: 'Agartala Tripura Depot', state: 'Tripura', lead: '6d lead' },
                { hub: 'Dimapur Nagaland Hub', state: 'Nagaland', lead: '5d lead' },
                { hub: 'Aizawl Mizoram Depot', state: 'Mizoram', lead: '8d lead' },
              ].map((row) => (
                <div key={row.hub} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#0F2544]">{row.hub}</p>
                    <p className="text-slate-500">{row.state}</p>
                  </div>
                  <span className="font-mono tabular-nums text-slate-600">{row.lead}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-500 leading-relaxed">
            Sign in to load your synthetic Northeast India distributor dataset and begin managing live Firestore inventory.
          </p>
        </div>
      </div>
    </div>
  );
}
