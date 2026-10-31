/**
 * AdminOverdueBanner — Admin Panel header widget.
 * Features:
 * - Alerts admin on Level 1, 2, and 3 escalated reports
 * - "Run Overdue Check" action button to trigger deadline penalties, reassignments & auto-accepts
 * - Live stats on overdue & escalated issues
 */
import { useState } from 'react';
import { runOverdueChecks } from '../lib/escalation';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';

export default function AdminOverdueBanner({ reports = [], onComplete }) {
  const { show } = useToast();
  const [running, setRunning] = useState(false);

  const escalatedReports = reports.filter(
    (r) => (r.escalationLevel || 0) > 0 && r.status !== 'resolved'
  );
  const criticalEscalations = escalatedReports.filter((r) => r.escalationLevel >= 3);
  const reassignments = escalatedReports.filter((r) => r.escalationLevel === 2);

  const handleRunChecks = async () => {
    setRunning(true);
    try {
      show('Checking deadlines, processing escalations & citizen auto-accepts...', 'info', 3000);
      const res = await runOverdueChecks();
      show(
        `Routine complete! Checked ${res.checkedCount} tickets &bull; Penalties applied: ${res.penaltiesApplied} &bull; Escalated: ${res.escalationsCount} &bull; Reassigned: ${res.reassignmentsCount} &bull; Auto-accepted: ${res.autoAcceptedCount}`,
        'success',
        6000
      );
      if (onComplete) onComplete();
    } catch (err) {
      show(`Overdue check error: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 rounded-3xl p-6 text-white shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚨</span>
            <h2 className="text-xl font-black tracking-tight">
              Municipal Escalation &amp; Accountability Engine
            </h2>
          </div>
          <p className="text-xs text-red-100 max-w-xl leading-relaxed">
            Monitors missed deadlines, applies officer score penalties, triggers automatic Level-2 ticket reassignments, and auto-resolves stagnant borderline fixes.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          disabled={running}
          onClick={handleRunChecks}
          className="px-6 py-3 bg-white hover:bg-gray-50 text-red-700 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-xl disabled:opacity-50 transition transform active:scale-95 flex items-center gap-2 whitespace-nowrap"
        >
          {running ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Running Audit Checks...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Run Overdue Check</span>
            </>
          )}
        </button>
      </div>

      {/* Escalation Tiers Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-3 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-red-200 block">Level 1: Overdue</span>
            <span className="text-lg font-black">{escalatedReports.length}</span>
          </div>
          <span className="text-xl">⚠️</span>
        </div>

        <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-3 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-orange-200 block">Level 2: Reassigned (+24h)</span>
            <span className="text-lg font-black">{reassignments.length}</span>
          </div>
          <span className="text-xl">🔄</span>
        </div>

        <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-3 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-200 block">Level 3: Critical Failure (+48h)</span>
            <span className="text-lg font-black">{criticalEscalations.length}</span>
          </div>
          <span className="text-xl">🛑</span>
        </div>
      </div>
    </div>
  );
}
