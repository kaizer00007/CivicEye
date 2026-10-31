/**
 * OfficerDashboard — Field Officer task management hub.
 * Features:
 * - Real-time onSnapshot of reports assigned to the current officer
 * - Sorted by deadline (nearest first) with live CountdownTimer and Overdue badge
 * - Status filters (All, Assigned, In Progress, Resolved)
 * - Quick Actions: Accept Task, Mark In Progress, Submit Resolution Proof
 * - Personal OfficerRatingCard with streak, active tasks, rating history
 * - Detail inspection with map location and photo
 */
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import OfficerRatingCard from '../components/OfficerRatingCard';
import CountdownTimer, { formatTimestamp } from '../components/CountdownTimer';
import { StatusBadge, UrgencyBadge, SeverityBadge, EscalationBadge } from '../components/StatusBadge';
import { compressImage } from '../lib/imageUtils';
import { verifyReportResolution } from '../lib/verify';
import LoadingSpinner from '../components/LoadingSpinner';
import { getFallbackReports } from '../lib/demoDataFallback';

export default function OfficerDashboard() {
  const { user } = useAuth();
  const { show } = useToast();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);

  // Resolution modal state
  const [resolvingReport, setResolvingReport] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofData, setProofData] = useState('');
  const [proofHash, setProofHash] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);

  // 1. Real-time onSnapshot listener for officer's assigned reports
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'reports'),
      where('assignedOfficerId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() });
        });

        const list = items.length > 0 ? items : getFallbackReports().slice(0, 4);

        // Sort by deadline ascending (nearest deadline first; reports without deadline at end)
        list.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          const timeA = a.deadline.toMillis ? a.deadline.toMillis() : new Date(a.deadline).getTime();
          const timeB = b.deadline.toMillis ? b.deadline.toMillis() : new Date(b.deadline).getTime();
          return timeA - timeB;
        });

        setReports(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Officer reports listener error, using fallback:', err.message);
        setReports(getFallbackReports().slice(0, 4));
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid]);

  // 2. Action: Accept Task (transitions from 'assigned' to 'in_progress')
  const handleAcceptTask = async (reportId) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
      show('Task accepted! Work is now marked In Progress.', 'success');
    } catch (err) {
      show(`Failed to update task: ${err.message}`, 'error');
    }
  };

  // 3. Handle Resolution Proof Image Upload
  const handleProofPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      show('Compressing completion photo...', 'info', 2000);
      const compressed = await compressImage(file);
      setProofFile(file);
      setProofData(compressed.dataUrl);
      setProofHash(compressed.hash);
      show('Proof image ready for submission!', 'success');
    } catch (err) {
      show(err.message, 'error');
    }
  };

  // 4. Submit Proof Photo & Run Gemini Verification + Anti-Cheat (Phase 5)
  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!proofData) {
      show('Please take or upload an "after" proof photo.', 'warning');
      return;
    }

    setSubmittingProof(true);
    try {
      show('Running AI visual verification and anti-cheat checks...', 'info', 3000);

      let currentPos = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
          );
          currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {
          // GPS optional fallback
        }
      }

      const verifyResult = await verifyReportResolution(
        resolvingReport.id,
        resolvingReport,
        proofData,
        proofHash,
        currentPos,
        adminNote
      );

      if (verifyResult.verificationState === 'verified') {
        show('🎉 Work verified by Gemini! Issue marked Resolved with on-time rating bonus.', 'success', 6000);
      } else if (verifyResult.verificationState === 'awaiting_citizen') {
        show('Work submitted! Routed to citizen for satisfaction confirmation.', 'info', 6000);
      } else if (verifyResult.verificationState === 'awaiting_admin') {
        show('Verification flagged: Sent to municipal admin inspection queue.', 'warning', 6000);
      } else {
        show(`AI inspection rejected fix: ${verifyResult.explanation}`, 'error', 7000);
      }

      setResolvingReport(null);
      setProofData('');
      setProofHash('');
      setAdminNote('');
    } catch (err) {
      show(`Verification error: ${err.message}`, 'error');
    } finally {
      setSubmittingProof(false);
    }
  };

  // Filter reports by status tab
  const filteredReports = reports.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Top Banner */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <span>🛠️</span> Municipal Officer Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage assigned field issues, monitor countdown deadlines, and submit repair proofs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Column: Tasks Feed (2 cols on large) ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All Tasks', count: reports.length },
                { id: 'assigned', label: 'Pending Accept', count: reports.filter((r) => r.status === 'assigned').length },
                { id: 'in_progress', label: 'In Progress', count: reports.filter((r) => r.status === 'in_progress').length },
                { id: 'resolved', label: 'Resolved', count: reports.filter((r) => r.status === 'resolved').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      statusFilter === tab.id ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <span className="text-xs text-gray-400 font-medium hidden sm:inline">
              Sorted by earliest deadline
            </span>
          </div>

          {/* Reports List */}
          {loading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" text="Loading assigned tasks..." />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3 shadow-sm">
              <span className="text-5xl">🎉</span>
              <h3 className="text-lg font-bold text-gray-800">No tasks in this category</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {statusFilter === 'all'
                  ? 'You currently have no issues assigned to your queue. Enjoy your day!'
                  : `There are currently no tasks with status "${statusFilter}".`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const issueLabel = (report.aiClassification || 'Issue').replace(/_/g, ' ');
                const isSelected = selectedReport?.id === report.id;

                return (
                  <div
                    key={report.id}
                    className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-sm ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="p-5 space-y-4">
                      {/* Top Row: Type, Countdown & Status */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-900 capitalize">
                              {issueLabel}
                            </h3>
                            <EscalationBadge level={report.escalationLevel} />
                          </div>
                          <p className="text-xs text-gray-500 truncate max-w-md">
                            📍 {report.location?.address || 'Location coordinates on file'}
                          </p>
                        </div>

                        {/* Deadline & Status Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <CountdownTimer deadline={report.deadline} />
                          <StatusBadge status={report.status} />
                        </div>
                      </div>

                      {/* Middle Row: Photo Thumbnail & AI Description */}
                      <div className="flex gap-4 items-start">
                        {report.imageData && (
                          <img
                            src={report.imageData}
                            alt={issueLabel}
                            className="w-20 h-20 rounded-xl object-cover border border-gray-200 flex-shrink-0"
                          />
                        )}
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <UrgencyBadge urgency={report.aiUrgency} />
                            <SeverityBadge severity={report.aiSeverity} />
                            {report.safetyRisk && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700">
                                ⚠️ Public Hazard
                              </span>
                            )}
                            {report.affectsTraffic && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700">
                                🚗 Traffic Blocked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                            {report.aiDescription}
                          </p>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                        <div className="text-[11px] text-gray-400">
                          Assigned: {formatTimestamp(report.createdAt)}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Accept Button for newly assigned issues */}
                          {report.status === 'assigned' && (
                            <button
                              type="button"
                              onClick={() => handleAcceptTask(report.id)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                            >
                              ✓ Accept Task
                            </button>
                          )}

                          {/* Resolve Button (Proof required) */}
                          {report.status === 'in_progress' && (
                            <button
                              type="button"
                              onClick={() => setResolvingReport(report)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 flex items-center gap-1.5"
                            >
                              <span>📸</span>
                              <span>Mark Resolved (Proof)</span>
                            </button>
                          )}

                          {/* Toggle expand full details */}
                          <button
                            type="button"
                            onClick={() => setSelectedReport(isSelected ? null : report)}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
                          >
                            {isSelected ? 'Hide Details' : 'View Full Details'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details Panel */}
                      {isSelected && (
                        <div className="pt-4 mt-2 border-t border-gray-100 space-y-3 bg-gray-50/70 p-4 rounded-xl text-xs animate-scale-in">
                          <div>
                            <span className="font-semibold text-gray-700 block mb-0.5">Full AI Report:</span>
                            <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                              {report.aiDescription}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                              <span className="font-semibold text-gray-700">Citizen:</span>{' '}
                              <span className="text-gray-900">{report.citizenName}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Zone:</span>{' '}
                              <span className="text-gray-900 uppercase">{report.zone || 'Zone 1'}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Coordinates:</span>{' '}
                              <span className="text-gray-900 font-mono">
                                {report.location?.lat?.toFixed(5)}, {report.location?.lng?.toFixed(5)}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Estimated Days:</span>{' '}
                              <span className="text-gray-900">{report.aiEstimatedFixDays || 7} days</span>
                            </div>
                          </div>

                          {report.resolution?.proofData && (
                            <div className="pt-2 border-t">
                              <span className="font-semibold text-gray-700 block mb-1">
                                Submitted Resolution Proof:
                              </span>
                              <img
                                src={report.resolution.proofData}
                                alt="Fix proof"
                                className="w-32 h-32 rounded-lg object-cover border"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right Column: Officer Rating & Performance Card ── */}
        <div className="space-y-6">
          <OfficerRatingCard officer={user} />
        </div>
      </div>

      {/* ── Modal: Submit Resolution Proof ── */}
      {resolvingReport && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📸</span> Submit Work Resolution Proof
                </h3>
                <p className="text-xs text-gray-500">
                  Task: {(resolvingReport.aiClassification || 'Issue').replace(/_/g, ' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolvingReport(null)}
                className="text-gray-400 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitProof} className="space-y-4">
              {/* Photo Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Live Site "After" Proof Photo <span className="text-red-500">*</span>
                </label>

                {proofData ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-300 bg-black aspect-video max-h-56 flex items-center justify-center">
                    <img src={proofData} alt="Proof preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setProofData('');
                        setProofHash('');
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg shadow"
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer block transition bg-gray-50 hover:bg-blue-50/20">
                    <span className="text-3xl block mb-2">📷</span>
                    <span className="text-xs font-bold text-blue-600 block">
                      Snap live camera photo or upload repair proof
                    </span>
                    <span className="text-[11px] text-gray-400 mt-1 block">
                      Anti-cheat checks will verify location coordinates and image authenticity.
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleProofPhotoSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Officer Note */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Officer Field Notes / Work Done
                </label>
                <textarea
                  rows={2}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="e.g. Cleared debris, patched asphalt with cold mix, tested water pressure..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Anti-cheat disclaimer */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[11px] text-blue-800 space-y-1">
                <p className="font-bold">🛡️ AI Anti-Cheat Verification Active:</p>
                <p>
                  Gemini compares this photo with the original before-photo to ensure the site is identical and the defect was genuinely fixed.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingReport(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingProof || !proofData}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50 transition flex items-center gap-2"
                >
                  {submittingProof ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Submitting Proof...</span>
                    </>
                  ) : (
                    <span>Submit &amp; Verify Work</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
