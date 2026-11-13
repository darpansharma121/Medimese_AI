import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';

export type SemanticTone = 'healthy' | 'warning' | 'critical' | 'info' | 'neutral';

export function StatusTag({
  tone,
  label,
}: {
  tone: SemanticTone;
  label: string;
}) {
  const styles: Record<SemanticTone, string> = {
    healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-teal-50 text-teal-800 border-teal-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const Icon =
    tone === 'healthy'
      ? CheckCircle2
      : tone === 'warning'
      ? AlertTriangle
      : tone === 'critical'
      ? AlertCircle
      : tone === 'info'
      ? Info
      : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap shrink-0 ${styles[tone]}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export function TransferStatusTag({
  status,
}: {
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
}) {
  if (status === 'completed') return <StatusTag tone="healthy" label="Completed" />;
  if (status === 'in_transit') return <StatusTag tone="warning" label="In Transit" />;
  if (status === 'cancelled') return <StatusTag tone="neutral" label="Cancelled" />;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium whitespace-nowrap shrink-0">
      <Truck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
      <span>Pending Dispatch</span>
    </span>
  );
}

export function QuarantineTag() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-medium whitespace-nowrap shrink-0">
      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      <span>Quarantined</span>
    </span>
  );
}

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
        <p className="leading-snug break-all">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-red-600 hover:text-red-900 p-0.5 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
