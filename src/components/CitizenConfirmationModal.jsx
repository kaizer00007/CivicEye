/**
 * CitizenConfirmationModal — citizen satisfaction confirmation.
 * Prompts: "Is your issue fixed?" (Yes/No + 1-5 star rating).
 * - Yes on awaiting_citizen resolves it and grants officer bonuses.
 * - No reopens the report, sets status to in_progress, routes to admin review, and applies negative feedback penalty.
 */
import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { processCitizenFeedbackRating, processResolutionRating } from '../lib/rating';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';

export default function CitizenConfirmationModal({ report, reportId, onClose }) {
  const { show } = useToast();
  const [isResolved, setIsResolved] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const officerId = report.assignedOfficerId;

      if (isResolved) {
        // Citizen confirms resolution
        await updateDoc(doc(db, 'reports', reportId), {
          status: 'resolved',
          resolvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          'resolution.verificationState': 'verified',
          'citizenFeedback.resolved': true,
          'citizenFeedback.rating': rating,
          'citizenFeedback.comment': comment || '',
          'citizenFeedback.at': serverTimestamp(),
        });

        // Apply resolution bonuses & feedback rating
        await processResolutionRating(report, reportId);
        if (officerId) {
          await processCitizenFeedbackRating(officerId, reportId, rating);
        }

        show('Thank you! Issue confirmed as resolved.', 'success');
      } else {
        // Citizen disputes fix: Reopens ticket, applies penalty, sends to admin review
        await updateDoc(doc(db, 'reports', reportId), {
          status: 'in_progress',
          updatedAt: serverTimestamp(),
          'resolution.verificationState': 'awaiting_admin',
          'citizenFeedback.resolved': false,
          'citizenFeedback.rating': rating,
          'citizenFeedback.comment': comment || 'Citizen reported issue was not adequately fixed.',
          'citizenFeedback.at': serverTimestamp(),
        });

        if (officerId) {
          await processCitizenFeedbackRating(officerId, reportId, rating);
        }

        show('Feedback recorded. Ticket reopened and escalated for municipal admin inspection.', 'warning', 6000);
      }

      if (onClose) onClose();
    } catch (err) {
      console.error('Citizen feedback error:', err);
      show(`Failed to submit feedback: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-scale-in">
        <div className="text-center space-y-1">
          <span className="text-4xl block">🔍</span>
          <h3 className="text-xl font-bold text-gray-900">Is Your Issue Fixed?</h3>
          <p className="text-xs text-gray-500">
            Field crews have completed work on "{(report.aiClassification || 'issue').replace(/_/g, ' ')}".
          </p>
        </div>

        {/* Before / After Preview */}
        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Reported Before</span>
            {report.imageData ? (
              <img src={report.imageData} alt="Before" className="w-full h-24 object-cover rounded-xl border" />
            ) : (
              <div className="w-full h-24 bg-gray-200 rounded-xl flex items-center justify-center text-xs">No Photo</div>
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Claimed Fix</span>
            {report.resolution?.proofData ? (
              <img src={report.resolution.proofData} alt="After" className="w-full h-24 object-cover rounded-xl border" />
            ) : (
              <div className="w-full h-24 bg-gray-200 rounded-xl flex items-center justify-center text-xs">Pending Photo</div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Yes / No Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsResolved(true)}
              className={`py-3 rounded-2xl font-bold text-sm transition border-2 flex items-center justify-center gap-2 ${
                isResolved
                  ? 'bg-green-600 text-white border-green-600 shadow-md'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>✅</span>
              <span>Yes, It's Fixed</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsResolved(false);
                setRating(1);
              }}
              className={`py-3 rounded-2xl font-bold text-sm transition border-2 flex items-center justify-center gap-2 ${
                !isResolved
                  ? 'bg-red-600 text-white border-red-600 shadow-md'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>❌</span>
              <span>No, Still Broken</span>
            </button>
          </div>

          {/* Star Rating */}
          <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-center space-y-1">
            <label className="block text-xs font-bold uppercase text-gray-600">
              Rate Repair Quality (1 - 5 Stars)
            </label>
            <div className="flex justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="text-2xl transition hover:scale-125 transform"
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              {rating >= 4 ? 'Great work! Officer earns positive rating bonus.' : rating <= 2 ? 'Substandard fix applies rating penalty.' : 'Neutral rating.'}
            </p>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Additional Feedback (optional)
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isResolved ? "Any remarks on the fix..." : "Explain why the issue isn't properly resolved..."}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              {submitting ? <LoadingSpinner size="sm" /> : 'Submit Confirmation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
