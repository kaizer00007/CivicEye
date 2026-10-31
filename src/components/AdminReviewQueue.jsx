/**
 * AdminReviewQueue — municipal inspection panel for flagged resolution proofs.
 * Features:
 * - Side-by-side comparison of Before vs Claimed Fix photos
 * - Gemini AI visual inspection results, confidence score, and red flags
 * - Anti-cheat alerts (GPS distance, reused photo)
 * - 1-click Approve (marks verified & resolved) / Reject (reopens ticket for officer)
 */
import { useState } from 'react';
import { adminReviewVerification } from '../lib/verify';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge, UrgencyBadge } from './StatusBadge';
import LoadingSpinner from './LoadingSpinner';

export default function AdminReviewQueue({ reports, onActionComplete }) {
  const { show } = useToast();
  const [processingId, setProcessingId] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});

  // Filter reports that are awaiting admin review
  const reviewQueue = reports.filter(
    (r) =>
      r.resolution?.verificationState === 'awaiting_admin' ||
      (r.resolution?.proofData && r.status !== 'resolved' && r.resolution?.verificationState === 'rejected')
  );

  const handleReviewAction = async (report, decision) => {
    setProcessingId(report.id);
    try {
      const comment = adminNotes[report.id] || '';
      await adminReviewVerification(report.id, report, decision, comment);
      show(
        decision === 'approve'
          ? `Report marked Approved & Resolved!`
          : `Proof rejected. Returned to officer queue.`,
        decision === 'approve' ? 'success' : 'warning'
      );
      if (onActionComplete) onActionComplete();
    } catch (err) {
      show(`Action failed: ${err.message}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (reviewQueue.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm space-y-3">
        <span className="text-5xl">🛡️</span>
        <h3 className="text-lg font-bold text-gray-800">Verification Queue Clear</h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          No tickets are currently flagged for anti-cheat anomalies or awaiting manual admin inspection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>🛡️</span> Flagged Verification Review Queue ({reviewQueue.length})
        </h2>
        <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 font-semibold">
          Requires Manual Municipal Inspection
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {reviewQueue.map((report) => {
          const aiResult = report.resolution?.aiResult || {};
          const redFlags = aiResult.red_flags || [];
          const issueLabel = (report.aiClassification || 'issue').replace(/_/g, ' ');
          const isProcessing = processingId === report.id;

          return (
            <div
              key={report.id}
              className="bg-white rounded-2xl border-2 border-amber-200 shadow-md p-6 space-y-5"
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900 capitalize">
                      {issueLabel}
                    </h3>
                    <UrgencyBadge urgency={report.aiUrgency} />
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    📍 {report.location?.address} &bull; Assigned: {report.assignedOfficerName || 'Officer'}
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  ⚠️ State: {report.resolution?.verificationState}
                </span>
              </div>

              {/* Side-by-Side Photos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Before Photo */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase text-gray-600 block">
                    1. Original Report (Before)
                  </span>
                  {report.imageData ? (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-black aspect-video max-h-56 flex items-center justify-center">
                      <img
                        src={report.imageData}
                        alt="Before"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-100 h-48 flex items-center justify-center text-xs text-gray-400">
                      No Photo
                    </div>
                  )}
                </div>

                {/* Claimed Fix Photo */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase text-gray-600 block">
                    2. Claimed Fix Proof (After)
                  </span>
                  {report.resolution?.proofData ? (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-black aspect-video max-h-56 flex items-center justify-center">
                      <img
                        src={report.resolution.proofData}
                        alt="After"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-100 h-48 flex items-center justify-center text-xs text-gray-400">
                      No Proof Uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Gemini AI Visual Audit Card */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-700 flex items-center gap-1.5">
                    <span>🤖</span> Gemini AI Verification Analysis:
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full ${
                      (aiResult.confidence || 0) >= 75
                        ? 'bg-green-100 text-green-700'
                        : (aiResult.confidence || 0) >= 50
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    AI Confidence: {aiResult.confidence ?? 0}%
                  </span>
                </div>

                <p className="text-xs text-gray-800 leading-relaxed">
                  {aiResult.explanation || 'No visual analysis commentary available.'}
                </p>

                {/* Red Flags & Anti-Cheat Triggers */}
                {redFlags.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-gray-200">
                    <span className="text-[11px] font-bold text-red-700 uppercase">
                      Detected Anomalies &amp; Red Flags:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {redFlags.map((flag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-800 border border-red-200"
                        >
                          ⚠️ {flag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Note input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Municipal Admin Reason / Note:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Photo clearly matches location; repair verified despite low lighting."
                  value={adminNotes[report.id] || ''}
                  onChange={(e) =>
                    setAdminNotes({ ...adminNotes, [report.id]: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleReviewAction(report, 'reject')}
                  className="px-5 py-2.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <span>❌</span>
                  <span>Reject Proof (Reopen Ticket)</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleReviewAction(report, 'approve')}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
                >
                  {isProcessing ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Approve &amp; Mark Resolved</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
