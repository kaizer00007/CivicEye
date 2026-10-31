/**
 * Rating Engine (src/lib/rating.js).
 * Calculates officer rating adjustments, on-time streak bonuses, consequences,
 * and maintains an immutable audit log in `ratings_log`.
 */
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  RATING_DELTAS,
  RATING_MIN,
  RATING_MAX,
  RATING_FLAGGED,
  RATING_RESTRICTED_CRITICAL,
  STREAK_THRESHOLD,
} from '../config';

/**
 * Applies a specific rating adjustment to an officer and logs the event.
 * 
 * @param {string} officerId 
 * @param {string} reportId 
 * @param {string} eventName (key in RATING_DELTAS)
 * @param {string} [customReason]
 * @returns {Promise<number>} New rating after change
 */
export async function applyRatingChange(officerId, reportId, eventName, customReason = '') {
  if (!officerId) return 3.5;

  const delta = RATING_DELTAS[eventName] ?? 0;
  const officerRef = doc(db, 'users', officerId);
  const officerSnap = await getDoc(officerRef);

  if (!officerSnap.exists()) return 3.5;

  const officerData = officerSnap.data();
  const currentRating = Number(officerData.rating ?? 3.5);

  // Clamp rating between RATING_MIN (0) and RATING_MAX (5)
  const newRating = Math.max(RATING_MIN, Math.min(RATING_MAX, +(currentRating + delta).toFixed(2)));

  // Update consequence flags (cleared when rating recovers)
  const flagged = newRating < RATING_FLAGGED;
  const restrictedFromCritical = newRating < RATING_RESTRICTED_CRITICAL;

  // Persist to officer profile
  await updateDoc(officerRef, {
    rating: newRating,
    flagged,
    restrictedFromCritical,
  });

  // Write immutable audit entry to ratings_log
  await addDoc(collection(db, 'ratings_log'), {
    officerId,
    reportId: reportId || null,
    change: delta,
    reason: customReason || eventName,
    ratingAfter: newRating,
    timestamp: serverTimestamp(),
  });

  return newRating;
}

/**
 * Handles resolution rating bonus & streak logic when a report is verified.
 * 
 * @param {any} report 
 * @param {string} reportId 
 */
export async function processResolutionRating(report, reportId) {
  if (!report.assignedOfficerId) return;
  if (report.flags?.resolutionRatingApplied) return; // Prevent double bonuses

  const officerId = report.assignedOfficerId;
  const officerRef = doc(db, 'users', officerId);
  const officerSnap = await getDoc(officerRef);
  if (!officerSnap.exists()) return;

  const officerData = officerSnap.data();
  const now = Date.now();
  const deadlineMs = report.deadline?.toMillis
    ? report.deadline.toMillis()
    : report.deadline ? new Date(report.deadline).getTime() : 0;
  const createdAtMs = report.createdAt?.toMillis
    ? report.createdAt.toMillis()
    : report.createdAt ? new Date(report.createdAt).getTime() : now;

  let deltaSum = 0;
  let reason = 'on_time_resolution';

  const isCritical = report.aiUrgency === 'critical';
  const isOnTime = deadlineMs > 0 ? now <= deadlineMs : true;

  if (isOnTime) {
    const totalAllowed = deadlineMs - createdAtMs;
    const elapsed = now - createdAtMs;

    // Critical issue resolved in under half its deadline
    if (isCritical && totalAllowed > 0 && elapsed <= totalAllowed / 2) {
      deltaSum += RATING_DELTAS.resolved_critical_fast;
      reason = 'resolved_critical_fast';
    } else if (deadlineMs > 0 && now < deadlineMs) {
      // Resolved early
      deltaSum += RATING_DELTAS.resolved_early;
      reason = 'resolved_early';
    }

    // Streak handling: Increment streak
    const currentStreak = (officerData.streakCount || 0) + 1;
    let streakBonus = 0;
    if (currentStreak % STREAK_THRESHOLD === 0) {
      streakBonus = RATING_DELTAS.streak_bonus;
      deltaSum += streakBonus;
    }

    // Update streak and resolved counters on officer
    await updateDoc(officerRef, {
      streakCount: currentStreak,
      totalResolved: increment(1),
      activeIssues: Math.max(0, (officerData.activeIssues || 1) - 1),
    });

    if (deltaSum > 0) {
      await applyRatingChange(
        officerId,
        reportId,
        reason,
        streakBonus > 0 ? `${reason}_with_streak_bonus` : reason
      );
    }
  } else {
    // Resolved late: reset streak, decrement active issues
    await updateDoc(officerRef, {
      streakCount: 0,
      totalResolved: increment(1),
      activeIssues: Math.max(0, (officerData.activeIssues || 1) - 1),
    });
  }

  // Mark resolutionRatingApplied flag on report
  await updateDoc(doc(db, 'reports', reportId), {
    'flags.resolutionRatingApplied': true,
  });
}

/**
 * Handles citizen feedback rating impacts.
 * 
 * @param {string} officerId 
 * @param {string} reportId 
 * @param {number} stars (1 to 5)
 */
export async function processCitizenFeedbackRating(officerId, reportId, stars) {
  if (!officerId) return;

  if (stars >= 4) {
    await applyRatingChange(
      officerId,
      reportId,
      'positive_feedback',
      `Citizen rated ${stars}/5 stars`
    );
  } else if (stars <= 2) {
    await applyRatingChange(
      officerId,
      reportId,
      'negative_feedback',
      `Citizen rated ${stars}/5 stars`
    );
  }
}

/**
 * Penalizes an officer for missing a ticket deadline.
 * Resets on-time streak to 0 and flags the report so penalty is applied only once.
 * 
 * @param {any} report 
 * @param {string} reportId 
 */
export async function penalizeMissedDeadline(report, reportId) {
  const officerId = report.assignedOfficerId;
  if (!officerId) return;

  const isCritical = report.aiUrgency === 'critical';
  const alreadyPenalized = isCritical
    ? report.flags?.penalizedMissedCritical
    : report.flags?.penalizedMissedDeadline;

  if (alreadyPenalized) return;

  // Reset streak on missed deadline
  const officerRef = doc(db, 'users', officerId);
  await updateDoc(officerRef, { streakCount: 0 });

  const eventName = isCritical ? 'missed_critical' : 'missed_deadline';
  await applyRatingChange(
    officerId,
    reportId,
    eventName,
    `Missed ${isCritical ? 'critical' : 'standard'} ticket deadline`
  );

  // Update report flags
  const flagField = isCritical ? 'flags.penalizedMissedCritical' : 'flags.penalizedMissedDeadline';
  await updateDoc(doc(db, 'reports', reportId), {
    [flagField]: true,
  });
}

/**
 * Penalizes an officer when a ticket sits for >48h without progress update.
 * 
 * @param {any} report 
 * @param {string} reportId 
 */
export async function penalizeNoUpdate(report, reportId) {
  const officerId = report.assignedOfficerId;
  if (!officerId) return;
  if (report.flags?.penalizedNoUpdate) return; // Only apply once

  await applyRatingChange(
    officerId,
    reportId,
    'no_update_48h',
    'No activity update for 48 hours'
  );

  await updateDoc(doc(db, 'reports', reportId), {
    'flags.penalizedNoUpdate': true,
  });
}
