/**
 * ReportDetailView — full detail panel for a single civic report.
 * Shows photo, AI description, address, officer, deadline, 4-step timeline,
 * escalation, verification state, upvote button.
 * Reused by MapPage, MyReportsPage, AdminPanel.
 */
import { useState } from 'react';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { StatusBadge, UrgencyBadge, SeverityBadge, EscalationBadge } from './StatusBadge';
import { DEPARTMENT_LABELS } from '../config';
import CitizenConfirmationModal from './CitizenConfirmationModal';

/** 4-step timeline steps */
const STEPS = ['submitted', 'assigned', 'in_progress', 'resolved'];
const STEP_LABELS = ['Submitted', 'Assigned', 'In Progress', 'Resolved'];
const STEP_ICONS = ['📋', '👤', '🔧', '✅'];

function getStepIndex(status) {
  const idx = STEPS.indexOf(status);
  return idx >= 0 ? idx : 0;
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function deadlineCountdown(deadline) {
  if (!deadline) return null;
  const dl = deadline.toDate ? deadline.toDate() : new Date(deadline);
  const now = new Date();
  const diff = dl - now;
  if (diff <= 0) return { text: 'OVERDUE', overdue: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return { text: `${days}d ${hours % 24}h remaining`, overdue: false };
  return { text: `${hours}h remaining`, overdue: false };
}

export default function ReportDetailView({ report, reportId, onClose }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [upvoting, setUpvoting] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  if (!report) return null;

  const issueLabel = (report.aiClassification || 'other').replace(/_/g, ' ');
  const dept = DEPARTMENT_LABELS[report.department] || report.department;
  const currentStep = getStepIndex(report.status);
  const dl = deadlineCountdown(report.deadline);
  const hasUpvoted = user && report.upvotedBy?.includes(user.uid);

  const handleUpvote = async () => {
    if (!user) { show('Login to upvote reports', 'warning'); return; }
    if (hasUpvoted) { show('You already upvoted this report', 'info'); return; }
    setUpvoting(true);
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        upvotes: increment(1),
        upvotedBy: arrayUnion(user.uid),
      });
      show('Upvoted! This increases priority.', 'success');
    } catch (err) {
      show('Upvote failed: ' + err.message, 'error');
    } finally {
      setUpvoting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-gray-50 border-b px-4 py-3 sticky top-0 z-10">
        <h3 className="font-bold text-gray-900 capitalize text-sm">{issueLabel}</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        )}
      </div>

      {/* Photo */}
      {report.imageData && (
        <img
          src={report.imageData}
          alt={issueLabel}
          className="w-full max-h-52 object-cover border-b"
        />
      )}

      <div className="p-4 space-y-4">
        {/* Badges row */}
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={report.status} />
          <UrgencyBadge urgency={report.aiUrgency} />
          <SeverityBadge severity={report.aiSeverity} />
          <EscalationBadge level={report.escalationLevel} />
        </div>

        {/* AI Description */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">AI Description</p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
            {report.aiDescription || 'No description available.'}
          </p>
        </div>

        {/* Address */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Location</p>
          <p className="text-sm text-gray-800">{report.location?.address || 'Unknown location'}</p>
          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
            {report.location?.lat?.toFixed(5)}, {report.location?.lng?.toFixed(5)}
          </p>
        </div>

        {/* Department & Officer */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500 font-semibold uppercase mb-0.5">Department</p>
            <p className="text-gray-900 font-medium">{dept}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500 font-semibold uppercase mb-0.5">Assigned Officer</p>
            <p className="text-gray-900 font-medium">{report.assignedOfficerName || 'Unassigned'}</p>
          </div>
        </div>

        {/* Deadline */}
        {report.deadline && (
          <div className={`p-3 rounded-lg text-xs font-semibold ${dl?.overdue ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            ⏱️ Deadline: {formatTimestamp(report.deadline)} — <span className="uppercase">{dl?.text || 'Calculating...'}</span>
          </div>
        )}

        {/* 4-Step Timeline */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Timeline</p>
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isComplete = idx <= currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div key={step} className="flex flex-col items-center flex-1 relative">
                  {/* Connector line */}
                  {idx > 0 && (
                    <div className={`absolute top-4 -left-1/2 w-full h-0.5 ${idx <= currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                  {/* Step circle */}
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition
                    ${isComplete
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                    }
                    ${isCurrent ? 'ring-2 ring-green-200 shadow-md' : ''}
                  `}>
                    {STEP_ICONS[idx]}
                  </div>
                  <span className={`mt-1.5 text-[10px] font-semibold text-center ${isComplete ? 'text-green-700' : 'text-gray-400'}`}>
                    {STEP_LABELS[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <span className="text-gray-500 font-semibold">Submitted:</span>{' '}
            <span className="text-gray-800">{formatTimestamp(report.createdAt)}</span>
          </div>
          {report.resolvedAt && (
            <div>
              <span className="text-gray-500 font-semibold">Resolved:</span>{' '}
              <span className="text-gray-800">{formatTimestamp(report.resolvedAt)}</span>
            </div>
          )}
        </div>

        {/* Verification state */}
        {report.resolution?.verificationState && report.resolution.verificationState !== 'none' && (
          <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-xs space-y-1">
            <p className="font-semibold text-purple-700 uppercase">Verification Status</p>
            <p className="text-purple-900 font-bold capitalize">{report.resolution.verificationState.replace(/_/g, ' ')}</p>
            {report.resolution.aiResult?.explanation && (
              <p className="text-[11px] text-purple-800 italic">
                AI audit: {report.resolution.aiResult.explanation}
              </p>
            )}
          </div>
        )}

        {/* Citizen Feedback Banner */}
        {user && user.uid === report.citizenId && (report.resolution?.verificationState === 'awaiting_citizen' || report.status === 'resolved') && !report.citizenFeedback?.at && (
          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900">🔍 Is your issue fixed?</span>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(true)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                Review &amp; Rate Fix
              </button>
            </div>
            <p className="text-[11px] text-blue-700">
              Confirm whether the municipal team successfully fixed the problem.
            </p>
          </div>
        )}

        {report.citizenFeedback?.at && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs space-y-0.5">
            <span className="font-bold text-green-900">
              Citizen Feedback: {report.citizenFeedback.resolved ? 'Confirmed Resolved ✅' : 'Disputed ❌'} ({report.citizenFeedback.rating || 5}⭐)
            </span>
            {report.citizenFeedback.comment && (
              <p className="text-gray-600 italic">"{report.citizenFeedback.comment}"</p>
            )}
          </div>
        )}

        {/* Upvote + Meta */}
        <div className="flex items-center justify-between pt-2 border-t">
          <button
            onClick={handleUpvote}
            disabled={upvoting || hasUpvoted}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              hasUpvoted
                ? 'bg-blue-100 text-blue-600 cursor-default'
                : 'bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-700'
            }`}
          >
            👍 {hasUpvoted ? 'Upvoted' : 'Upvote'} ({report.upvotes || 0})
          </button>
          <span className="text-[11px] text-gray-400">
            Reported by {report.citizenName || 'Citizen'}
          </span>
        </div>
      </div>

      {/* Citizen Confirmation Modal */}
      {showFeedbackModal && (
        <CitizenConfirmationModal
          report={report}
          reportId={reportId}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  );
}
