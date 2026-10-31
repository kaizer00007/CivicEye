/**
 * Escalation & Overdue Check Engine (src/lib/escalation.js).
 * Runs automated maintenance routines:
 * 1. Deadline penalties (missed_deadline / missed_critical) & streak resets
 * 2. Escalation tiers:
 *    - Level 1: Deadline passed -> marked 'escalated', level 1
 *    - Level 2: 24h past deadline -> auto-reassigns to another department officer
 *    - Level 3: 48h past deadline -> escalated to level 3 (critical failure)
 * 3. No-update 48h penalty (no activity on ticket for 48h)
 * 4. 48h Citizen Auto-Accept (borderline resolutions automatically confirmed)
 * 
 * Idempotent: Safe to run repeatedly on admin dashboard mount or via manual button.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  penalizeMissedDeadline,
  penalizeNoUpdate,
  processResolutionRating,
} from './rating';
import {
  ESCALATION_GAP,
  NO_UPDATE_THRESHOLD,
  CITIZEN_CONFIRM_TIMEOUT,
  MAX_ACTIVE_ISSUES,
} from '../config';

/**
 * Finds another eligible officer in the department to take over an overdue ticket.
 * 
 * @param {string} department 
 * @param {string} zone 
 * @param {string} excludeOfficerId 
 * @returns {Promise<{ uid: string, name: string }|null>}
 */
async function findReassignmentOfficer(department, zone, excludeOfficerId) {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'officer'),
      where('department', '==', department)
    );
    const snap = await getDocs(q);
    const candidates = [];

    snap.forEach((d) => {
      if (d.id !== excludeOfficerId) {
        candidates.push({ uid: d.id, ...d.data() });
      }
    });

    // Filter capacity < 10
    let eligible = candidates.filter((o) => (o.activeIssues || 0) < MAX_ACTIVE_ISSUES);
    if (eligible.length === 0) return null;

    // Prefer same zone, lowest active issues
    eligible.sort((a, b) => {
      const zoneA = a.zone === zone ? 0 : 1;
      const zoneB = b.zone === zone ? 0 : 1;
      if (zoneA !== zoneB) return zoneA - zoneB;
      return (a.activeIssues || 0) - (b.activeIssues || 0);
    });

    const chosen = eligible[0];
    return {
      uid: chosen.uid,
      name: chosen.name || chosen.email || 'Municipal Officer',
    };
  } catch (err) {
    console.warn('Reassignment search error:', err.message);
    return null;
  }
}

/**
 * Runs full overdue check across all open reports.
 * 
 * @returns {Promise<{
 *   checkedCount: number,
 *   penaltiesApplied: number,
 *   escalationsCount: number,
 *   reassignmentsCount: number,
 *   autoAcceptedCount: number
 * }>}
 */
export async function runOverdueChecks() {
  const stats = {
    checkedCount: 0,
    penaltiesApplied: 0,
    escalationsCount: 0,
    reassignmentsCount: 0,
    autoAcceptedCount: 0,
  };

  try {
    const now = Date.now();
    const reportsRef = collection(db, 'reports');

    // Query non-resolved reports
    const openQuery = query(
      reportsRef,
      where('status', 'in', ['assigned', 'in_progress', 'escalated'])
    );
    const snap = await getDocs(openQuery);

    for (const docSnap of snap.docs) {
      stats.checkedCount++;
      const report = docSnap.data();
      const reportId = docSnap.id;

      const deadlineMs = report.deadline?.toMillis
        ? report.deadline.toMillis()
        : report.deadline ? new Date(report.deadline).getTime() : 0;

      const updatedAtMs = report.updatedAt?.toMillis
        ? report.updatedAt.toMillis()
        : report.updatedAt ? new Date(report.updatedAt).getTime() : now;

      const updates = {};

      // ── Routine A: Citizen 48h Auto-Accept ──
      if (
        report.resolution?.verificationState === 'awaiting_citizen' &&
        report.resolution?.submittedAt
      ) {
        const submittedMs = report.resolution.submittedAt?.toMillis
          ? report.resolution.submittedAt.toMillis()
          : new Date(report.resolution.submittedAt).getTime();

        if (now - submittedMs >= CITIZEN_CONFIRM_TIMEOUT) {
          updates.status = 'resolved';
          updates.resolvedAt = serverTimestamp();
          updates['resolution.verificationState'] = 'verified';
          updates['citizenFeedback.resolved'] = true;
          updates['citizenFeedback.rating'] = 4;
          updates['citizenFeedback.autoAccepted'] = true;
          updates['citizenFeedback.at'] = serverTimestamp();

          await updateDoc(doc(db, 'reports', reportId), updates);
          await processResolutionRating(report, reportId);
          stats.autoAcceptedCount++;
          continue; // Ticket now resolved, skip overdue escalation
        }
      }

      // ── Routine B: Missed Deadline Penalties & Escalation ──
      if (deadlineMs > 0 && now > deadlineMs) {
        const overdueDiff = now - deadlineMs;

        // Apply penalty if not already done
        const isCritical = report.aiUrgency === 'critical';
        const alreadyPenalized = isCritical
          ? report.flags?.penalizedMissedCritical
          : report.flags?.penalizedMissedDeadline;

        if (!alreadyPenalized) {
          await penalizeMissedDeadline(report, reportId);
          stats.penaltiesApplied++;
        }

        // Determine Escalation Level
        let targetLevel = 1;
        if (overdueDiff >= 2 * ESCALATION_GAP) {
          targetLevel = 3;
        } else if (overdueDiff >= ESCALATION_GAP) {
          targetLevel = 2;
        }

        const currentLevel = report.escalationLevel || 0;
        if (targetLevel > currentLevel) {
          updates.escalationLevel = targetLevel;
          updates.status = 'escalated';
          updates.updatedAt = serverTimestamp();
          stats.escalationsCount++;

          // Escalation Level 2 Action: Auto-reassign to another eligible officer
          if (targetLevel >= 2 && currentLevel < 2 && report.department) {
            const newOfficer = await findReassignmentOfficer(
              report.department,
              report.zone,
              report.assignedOfficerId
            );

            if (newOfficer) {
              // Decrement old officer's active issues count
              if (report.assignedOfficerId) {
                await updateDoc(doc(db, 'users', report.assignedOfficerId), {
                  activeIssues: increment(-1),
                });
              }

              // Increment new officer's active issues count
              await updateDoc(doc(db, 'users', newOfficer.uid), {
                activeIssues: increment(1),
              });

              updates.assignedOfficerId = newOfficer.uid;
              updates.assignedOfficerName = newOfficer.name;
              stats.reassignmentsCount++;
            }
          }
        }
      }

      // ── Routine C: No-Update 48h Penalty ──
      if (
        report.assignedOfficerId &&
        now - updatedAtMs >= NO_UPDATE_THRESHOLD &&
        !report.flags?.penalizedNoUpdate
      ) {
        await penalizeNoUpdate(report, reportId);
        stats.penaltiesApplied++;
      }

      // Persist any staged report updates
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'reports', reportId), updates);
      }
    }
  } catch (err) {
    console.error('Overdue check engine error:', err);
  }

  return stats;
}
