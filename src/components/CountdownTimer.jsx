/**
 * CountdownTimer — shows a live deadline countdown that updates every minute.
 * Displays an overdue badge when the deadline has passed.
 */
import { useState, useEffect } from 'react';

/**
 * @param {{ deadline: any }} props  — Firestore Timestamp or Date-like
 */
export default function CountdownTimer({ deadline }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!deadline) return <span className="text-xs text-gray-400">No deadline</span>;

  const dl = deadline.toDate ? deadline.toDate() : new Date(deadline);
  const diff = dl.getTime() - now;

  if (diff <= 0) {
    const overHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
    const overDays = Math.floor(overHours / 24);
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 animate-pulse">
        🚨 OVERDUE {overDays > 0 ? `${overDays}d ${overHours % 24}h` : `${overHours}h`}
      </span>
    );
  }

  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  // Color thresholds
  let colorClass = 'bg-green-50 text-green-700 border-green-200';
  if (totalHours < 6) colorClass = 'bg-red-50 text-red-700 border-red-200';
  else if (totalHours < 24) colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
  else if (totalHours < 72) colorClass = 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${colorClass}`}>
      ⏱️ {days > 0 ? `${days}d ` : ''}{hours}h {mins}m left
    </span>
  );
}

/**
 * Formats a Firestore timestamp to a human-readable date string.
 */
export function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
