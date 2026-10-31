/**
 * AdminPanel — Municipal oversight, officer dispatch, and verification review center.
 * Features:
 * - Auto-runs overdue routine on initial mount (idempotent)
 * - AdminOverdueBanner with manual "Run Overdue Check" trigger
 * - AdminReviewQueue for flagged visual verification proofs
 * - Tabs: All Reports, Unassigned Tickets, Officers Oversight, Review Queue
 * - Manual Reassignment modal for any ticket
 * - Direct link to /seed
 */
import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useToast } from '../contexts/ToastContext';
import { runOverdueChecks } from '../lib/escalation';
import AdminOverdueBanner from '../components/AdminOverdueBanner';
import AdminReviewQueue from '../components/AdminReviewQueue';
import { StatusBadge, UrgencyBadge, SeverityBadge, EscalationBadge } from '../components/StatusBadge';
import CountdownTimer, { formatTimestamp } from '../components/CountdownTimer';
import { DEPARTMENT_LABELS, DEPARTMENTS } from '../config';
import LoadingSpinner from '../components/LoadingSpinner';
import { getFallbackReports, getFallbackOfficers } from '../lib/demoDataFallback';

export default function AdminPanel() {
  const { show } = useToast();

  const [reports, setReports] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'unassigned' | 'officers' | 'queue'

  // Filter state for reports
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');

  // Manual Reassignment Modal State
  const [reassignReport, setReassignReport] = useState(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // 1. Auto-run overdue routine on mount (idempotent)
  useEffect(() => {
    let mounted = true;
    runOverdueChecks().then((stats) => {
      if (!mounted) return;
      if (stats.penaltiesApplied > 0 || stats.escalationsCount > 0 || stats.autoAcceptedCount > 0) {
        show(
          `Automated audit completed: ${stats.penaltiesApplied} penalties applied, ${stats.escalationsCount} escalations processed.`,
          'info',
          5000
        );
      }
    });
    return () => { mounted = false; };
  }, []);

  // 2. Real-time reports listener
  useEffect(() => {
    const unsubReports = onSnapshot(
      collection(db, 'reports'),
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        const reportsList = list.length > 0 ? list : getFallbackReports();
        reportsList.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });
        setReports(reportsList);
        setLoading(false);
      },
      (err) => {
        console.warn('Admin reports listener error, using fallback demo reports:', err.message);
        setReports(getFallbackReports());
        setLoading(false);
      }
    );

    // 3. Real-time users listener (for officers)
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const oList = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.role === 'officer') {
            oList.push({ uid: d.id, ...data });
          }
        });
        const finalOfficers = oList.length > 0 ? oList : getFallbackOfficers();
        finalOfficers.sort((a, b) => (b.rating ?? 3.5) - (a.rating ?? 3.5));
        setOfficers(finalOfficers);
      },
      (err) => {
        console.warn('Admin officers listener error, using fallback:', err.message);
        setOfficers(getFallbackOfficers());
      }
    );

    return () => {
      unsubReports();
      unsubUsers();
    };
  }, []);

  // 4. Handle Manual Reassignment
  const handleConfirmReassign = async (e) => {
    e.preventDefault();
    if (!selectedOfficerId) {
      show('Please select an officer from the list', 'warning');
      return;
    }

    setReassigning(true);
    try {
      const targetOfficer = officers.find((o) => o.uid === selectedOfficerId);
      if (!targetOfficer) throw new Error('Selected officer not found');

      // Decrement old officer's active count if present
      if (reassignReport.assignedOfficerId) {
        await updateDoc(doc(db, 'users', reassignReport.assignedOfficerId), {
          activeIssues: increment(-1),
        });
      }

      // Increment new officer's active count
      await updateDoc(doc(db, 'users', targetOfficer.uid), {
        activeIssues: increment(1),
      });

      // Update report document
      await updateDoc(doc(db, 'reports', reassignReport.id), {
        assignedOfficerId: targetOfficer.uid,
        assignedOfficerName: targetOfficer.name || targetOfficer.email,
        status: 'assigned',
        updatedAt: serverTimestamp(),
      });

      show(`Report successfully reassigned to ${targetOfficer.name || targetOfficer.email}!`, 'success');
      setReassignReport(null);
      setSelectedOfficerId('');
    } catch (err) {
      show(`Reassignment failed: ${err.message}`, 'error');
    } finally {
      setReassigning(false);
    }
  };

  // Filtered views
  const unassignedReports = reports.filter((r) => !r.assignedOfficerId || r.status === 'submitted');
  const flaggedOfficers = officers.filter((o) => o.flagged || (o.rating ?? 3.5) < 3.0);
  const reviewQueue = reports.filter(
    (r) => r.resolution?.verificationState === 'awaiting_admin'
  );

  const filteredReports = reports.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (deptFilter !== 'all' && r.department !== deptFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <span>⚙️</span> Municipal Administration &amp; Command Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Global ticket oversight, officer reallocation, verification approvals, and audit tools.
          </p>
        </div>

        {/* Action Links */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/demo"
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition transform active:scale-95 flex items-center gap-2"
          >
            <span>🎙️</span>
            <span>Launch Demo Mode</span>
          </Link>

          <Link
            to="/seed"
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition transform active:scale-95 flex items-center gap-2"
          >
            <span>🌱</span>
            <span>Seed Demo Data</span>
          </Link>
        </div>
      </div>

      {/* Overdue & Escalation Banner */}
      <AdminOverdueBanner reports={reports} />

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'reports', label: 'All Reports', count: reports.length, icon: '📋' },
          { id: 'unassigned', label: 'Unassigned Tickets', count: unassignedReports.length, icon: '⚠️' },
          { id: 'officers', label: 'Officers & Oversight', count: officers.length, icon: '👮' },
          { id: 'queue', label: 'Verification Queue', count: reviewQueue.length, icon: '🛡️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-20 text-center">
          <LoadingSpinner size="lg" text="Loading municipal administration data..." />
        </div>
      ) : (
        <>
          {/* ════════ TAB 1: ALL REPORTS ════════ */}
          {activeTab === 'reports' && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="submitted">Submitted</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="escalated">Escalated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Department</label>
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Departments</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {DEPARTMENT_LABELS[d] || d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <span className="text-xs text-gray-400 font-medium">
                  Showing {filteredReports.length} of {reports.length} reports
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider">
                      <th className="pb-3 font-bold">Issue / Location</th>
                      <th className="pb-3 font-bold">Department</th>
                      <th className="pb-3 font-bold">Status</th>
                      <th className="pb-3 font-bold">Assigned Officer</th>
                      <th className="pb-3 font-bold">Deadline</th>
                      <th className="pb-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReports.map((report) => {
                      const issueLabel = (report.aiClassification || 'issue').replace(/_/g, ' ');
                      return (
                        <tr key={report.id} className="hover:bg-gray-50 transition">
                          <td className="py-3.5 pr-4 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-900 capitalize">{issueLabel}</span>
                              <UrgencyBadge urgency={report.aiUrgency} />
                              <SeverityBadge severity={report.aiSeverity} />
                              <EscalationBadge level={report.escalationLevel} />
                            </div>
                            <p className="text-[11px] text-gray-500 truncate max-w-xs">
                              {report.location?.address || 'Location on file'}
                            </p>
                          </td>
                          <td className="py-3.5 font-medium text-gray-700 capitalize">
                            {DEPARTMENT_LABELS[report.department] || report.department}
                          </td>
                          <td className="py-3.5">
                            <StatusBadge status={report.status} />
                          </td>
                          <td className="py-3.5 font-medium text-gray-800">
                            {report.assignedOfficerName || (
                              <span className="text-amber-600 font-bold">⚠️ Unassigned</span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <CountdownTimer deadline={report.deadline} />
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setReassignReport(report);
                                setSelectedOfficerId(report.assignedOfficerId || '');
                              }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition shadow-sm"
                            >
                              Reassign
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════ TAB 2: UNASSIGNED TICKETS ════════ */}
          {activeTab === 'unassigned' && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div className="border-b pb-3">
                <h2 className="text-base font-bold text-gray-900">Unassigned Reports Queue</h2>
                <p className="text-xs text-gray-400">
                  Tickets where no eligible officer had open capacity or department match at filing time
                </p>
              </div>

              {unassignedReports.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 space-y-2">
                  <span className="text-4xl block">🎉</span>
                  <p className="font-bold text-gray-800">Zero Unassigned Tickets!</p>
                  <p>All citizen reports have been successfully matched and dispatched to field crews.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {unassignedReports.map((report) => (
                    <div key={report.id} className="py-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 capitalize">
                            {(report.aiClassification || 'issue').replace(/_/g, ' ')}
                          </span>
                          <UrgencyBadge urgency={report.aiUrgency} />
                          <SeverityBadge severity={report.aiSeverity} />
                        </div>
                        <p className="text-xs text-gray-500">{report.location?.address}</p>
                        <p className="text-[11px] text-gray-400">
                          Filed: {formatTimestamp(report.createdAt)} &bull; Dept: {DEPARTMENT_LABELS[report.department] || report.department}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setReassignReport(report);
                          setSelectedOfficerId('');
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition"
                      >
                        Assign Officer Now
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════ TAB 3: OFFICERS OVERSIGHT & FLAGGED ════════ */}
          {activeTab === 'officers' && (
            <div className="space-y-6">
              {/* Flagged Officers Warning Banner */}
              {flaggedOfficers.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <span>⚠️</span>
                    <span>Officers Flagged for Low Performance ({flaggedOfficers.length})</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    Officers with rating &lt; 3.0 are subject to missed deadline audits. Officers with rating &lt; 2.5 are excluded from critical tasks.
                  </p>
                </div>
              )}

              {/* Officers Table */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="border-b pb-3">
                  <h2 className="text-base font-bold text-gray-900">Municipal Field Officers Directory</h2>
                  <p className="text-xs text-gray-400">Oversight of workload, rating scores, and disciplinary restrictions</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider">
                        <th className="pb-3 font-bold">Officer</th>
                        <th className="pb-3 font-bold">Department / Zone</th>
                        <th className="pb-3 font-bold">Rating</th>
                        <th className="pb-3 font-bold">Active Load</th>
                        <th className="pb-3 font-bold">Total Fixed</th>
                        <th className="pb-3 font-bold">Status Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {officers.map((officer) => {
                        const r = Number(officer.rating ?? 3.5).toFixed(2);
                        const isRestricted = officer.restrictedFromCritical;
                        const isFlagged = officer.flagged || Number(r) < 3.0;

                        return (
                          <tr key={officer.uid} className="hover:bg-gray-50 transition">
                            <td className="py-3 font-bold text-gray-900">
                              {officer.name || officer.email}
                            </td>
                            <td className="py-3 text-gray-600 capitalize">
                              {DEPARTMENT_LABELS[officer.department] || officer.department || 'All'} &bull; {officer.zone || 'Zone 1'}
                            </td>
                            <td className="py-3 font-bold text-green-700">
                              ⭐ {r}
                            </td>
                            <td className="py-3 font-semibold text-gray-800">
                              {officer.activeIssues || 0} / 10
                            </td>
                            <td className="py-3 font-bold text-blue-600">
                              {officer.totalResolved || 0}
                            </td>
                            <td className="py-3">
                              {isRestricted ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                  Restricted Critical
                                </span>
                              ) : isFlagged ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                  Flagged Warning
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                  Good Standing
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 4: VERIFICATION REVIEW QUEUE ════════ */}
          {activeTab === 'queue' && (
            <AdminReviewQueue reports={reports} />
          )}
        </>
      )}

      {/* ── Reassignment Modal ── */}
      {reassignReport && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Manual Officer Reassignment</h3>
                <p className="text-xs text-gray-500">
                  Task: {(reassignReport.aiClassification || 'issue').replace(/_/g, ' ')} &bull; Dept: {DEPARTMENT_LABELS[reassignReport.department] || reassignReport.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassignReport(null)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmReassign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                  Select Field Officer:
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {officers
                    .filter((o) => !reassignReport.department || o.department === reassignReport.department || !o.department)
                    .map((officer) => (
                      <label
                        key={officer.uid}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition text-xs ${
                          selectedOfficerId === officer.uid
                            ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="officerRadio"
                            value={officer.uid}
                            checked={selectedOfficerId === officer.uid}
                            onChange={(e) => setSelectedOfficerId(e.target.value)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="font-bold text-gray-900 block">{officer.name || officer.email}</span>
                            <span className="text-[11px] text-gray-500">
                              📍 {officer.zone || 'Zone 1'} &bull; Active: {officer.activeIssues || 0}/10
                            </span>
                          </div>
                        </div>

                        <span className="font-bold text-green-700">⭐ {Number(officer.rating ?? 3.5).toFixed(1)}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setReassignReport(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !selectedOfficerId}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {reassigning ? <LoadingSpinner size="sm" /> : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
