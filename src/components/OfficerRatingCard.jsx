/**
 * OfficerRatingCard — displays officer's live performance stats and rating history.
 * Shows:
 * - Current rating out of 5.0 with color coding
 * - Warning flags: Flagged (< 3.0), Restricted Critical (< 2.5), Under Review (< 2.0)
 * - Streak count with fire icon
 * - Active issues count and total resolved
 * - Recent rating change history from ratings_log
 */
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  RATING_FLAGGED,
  RATING_RESTRICTED_CRITICAL,
  RATING_REVIEW,
  DEPARTMENT_LABELS,
} from '../config';

export default function OfficerRatingCard({ officer }) {
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const rating = Number(officer?.rating ?? 3.5).toFixed(1);
  const ratingNum = Number(rating);

  // Fetch recent ratings log for this officer
  useEffect(() => {
    if (!officer?.uid) return;

    const q = query(
      collection(db, 'ratings_log'),
      where('officerId', '==', officer.uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const history = [];
        snap.forEach((doc) => {
          history.push({ id: doc.id, ...doc.data() });
        });
        setLogs(history);
        setLoadingLogs(false);
      },
      (err) => {
        // In case index isn't ready yet, fallback gracefully
        console.warn('ratings_log listener fallback:', err.message);
        setLoadingLogs(false);
      }
    );

    return unsub;
  }, [officer?.uid]);

  // Status color based on rating
  let ratingColor = 'text-green-600 bg-green-50 border-green-200';
  if (ratingNum < RATING_REVIEW) {
    ratingColor = 'text-red-700 bg-red-50 border-red-300';
  } else if (ratingNum < RATING_RESTRICTED_CRITICAL) {
    ratingColor = 'text-orange-700 bg-orange-50 border-orange-300';
  } else if (ratingNum < RATING_FLAGGED) {
    ratingColor = 'text-amber-700 bg-amber-50 border-amber-300';
  }

  const deptLabel = DEPARTMENT_LABELS[officer?.department] || officer?.department || 'Field Officer';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
      {/* Header Profile */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{officer?.name || officer?.email}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 uppercase tracking-wide">
              {officer?.role || 'Officer'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            🏢 {deptLabel} &bull; 📍 {officer?.zone?.replace(/_/g, ' ')?.toUpperCase() || 'All Zones'}
          </p>
        </div>

        {/* Big Rating Pill */}
        <div className={`px-4 py-2 rounded-xl border text-center font-extrabold ${ratingColor}`}>
          <div className="text-2xl leading-none flex items-center justify-center gap-1">
            <span>⭐</span>
            <span>{rating}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider block mt-1 font-semibold">
            Civic Score
          </span>
        </div>
      </div>

      {/* Warning Banners if rating drops */}
      <div className="space-y-1.5">
        {ratingNum < RATING_REVIEW && (
          <div className="p-2.5 rounded-lg bg-red-100 border border-red-300 text-red-800 text-xs font-bold flex items-center gap-2">
            <span>⛔</span>
            <span>CRITICAL REVIEW: Rating below 2.0. Open tickets eligible for admin reassignment.</span>
          </div>
        )}
        {ratingNum < RATING_RESTRICTED_CRITICAL && ratingNum >= RATING_REVIEW && (
          <div className="p-2.5 rounded-lg bg-orange-100 border border-orange-300 text-orange-800 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>RESTRICTED: Rating below 2.5. Excluded from receiving Critical urgency tasks.</span>
          </div>
        )}
        {ratingNum < RATING_FLAGGED && ratingNum >= RATING_RESTRICTED_CRITICAL && (
          <div className="p-2.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>FLAGGED: Rating below 3.0. Monitored for missed deadlines.</span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
          <span className="text-xl">🔥</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{officer?.streakCount || 0}</p>
          <p className="text-[11px] text-gray-500 font-medium">On-Time Streak</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
          <span className="text-xl">🛠️</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{officer?.activeIssues || 0}/10</p>
          <p className="text-[11px] text-gray-500 font-medium">Active Tasks</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
          <span className="text-xl">✅</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{officer?.totalResolved || 0}</p>
          <p className="text-[11px] text-gray-500 font-medium">Total Resolved</p>
        </div>
      </div>

      {/* Rating History Log */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
          Recent Rating Adjustments
        </h3>
        {loadingLogs ? (
          <p className="text-xs text-gray-400 italic">Loading rating history...</p>
        ) : logs.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-3 text-center text-xs text-gray-500">
            No rating adjustments recorded yet. Complete assigned tasks on time to earn rating bonuses!
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {logs.map((item) => {
              const isPositive = (item.change || 0) > 0;
              return (
                <div key={item.id} className="p-3 bg-white flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-gray-800 capitalize">
                      {item.reason?.replace(/_/g, ' ') || 'Rating event'}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      Rating after: {Number(item.ratingAfter || 0).toFixed(2)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded font-mono font-bold text-xs ${
                      isPositive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {isPositive ? `+${item.change}` : item.change}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
