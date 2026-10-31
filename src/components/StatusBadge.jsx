/**
 * StatusBadge — reusable colored badge for status and urgency.
 */
import { STATUS_COLORS, STATUS_LABELS, URGENCY_COLORS, URGENCY_LABELS } from '../config';

export function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.submitted;
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }} />
      {label}
    </span>
  );
}

export function UrgencyBadge({ urgency }) {
  const color = URGENCY_COLORS[urgency] || '#3b82f6';
  const label = URGENCY_LABELS[urgency] || urgency;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const sev = Number(severity) || 0;
  let color = 'bg-blue-100 text-blue-700';
  if (sev >= 8) color = 'bg-red-100 text-red-700';
  else if (sev >= 6) color = 'bg-orange-100 text-orange-700';
  else if (sev >= 4) color = 'bg-yellow-100 text-yellow-700';

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>
      Sev {sev}/10
    </span>
  );
}

export function EscalationBadge({ level }) {
  if (!level || level === 0) return null;
  const colors = ['', 'bg-amber-100 text-amber-800', 'bg-orange-100 text-orange-800', 'bg-red-100 text-red-800'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${colors[level] || colors[1]}`}>
      🔺 Escalation L{level}
    </span>
  );
}
