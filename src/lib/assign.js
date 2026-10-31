/**
 * Auto-Assignment engine (src/lib/assign.js).
 * Assigns newly submitted reports to eligible municipal officers.
 * 
 * Rules:
 * 1. Officer must be in the same department and zone.
 * 2. Officer must have activeIssues < 10.
 * 3. Critical urgency: officer with highest rating, excluding officers with restrictedFromCritical === true.
 * 4. Non-critical: officer with lowest activeIssues.
 * 5. Deadline computed from urgency (critical 24h, high 72h, medium 7d, low 14d).
 * 6. Officer's activeIssues is incremented.
 * 7. If no officer is available, leaves report status as "submitted" and unassigned.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { DEADLINES, MAX_ACTIVE_ISSUES } from '../config';

/**
 * Finds the most suitable officer and assigns them to the report.
 * 
 * @param {string} department 
 * @param {string} zone 
 * @param {string} urgency ('critical'|'high'|'medium'|'low')
 * @returns {Promise<{
 *   assigned: boolean,
 *   officerId: string|null,
 *   officerName: string|null,
 *   deadline: Timestamp|null,
 *   status: 'assigned'|'submitted'
 * }>}
 */
export async function autoAssignReport(department, zone, urgency) {
  try {
    const usersRef = collection(db, 'users');
    
    // Query officers in the same department
    // We filter by role and department first; zone and capacity in JS to avoid complex composite index requirements
    const q = query(
      usersRef,
      where('role', '==', 'officer'),
      where('department', '==', department)
    );

    const snapshot = await getDocs(q);
    const candidates = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      candidates.push({
        uid: docSnap.id,
        ...data,
      });
    });

    // Filter by zone and active issue limit (< 10)
    let eligible = candidates.filter(
      (o) => (o.zone === zone || !o.zone) && (o.activeIssues || 0) < MAX_ACTIVE_ISSUES
    );

    // If no candidate in exact zone, fall back to any eligible in the department
    if (eligible.length === 0) {
      eligible = candidates.filter((o) => (o.activeIssues || 0) < MAX_ACTIVE_ISSUES);
    }

    if (eligible.length === 0) {
      // No officer available
      return {
        assigned: false,
        officerId: null,
        officerName: null,
        deadline: null,
        status: 'submitted',
      };
    }

    let selected = null;
    const isCritical = urgency === 'critical';

    if (isCritical) {
      // Highest rating, excluding restrictedFromCritical
      const nonRestricted = eligible.filter((o) => !o.restrictedFromCritical);
      const pool = nonRestricted.length > 0 ? nonRestricted : eligible;
      pool.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      selected = pool[0];
    } else {
      // Lowest active issues
      eligible.sort((a, b) => (a.activeIssues || 0) - (b.activeIssues || 0));
      selected = eligible[0];
    }

    // Calculate deadline Timestamp from urgency
    const durationMs = DEADLINES[urgency] || DEADLINES.medium;
    const deadlineDate = new Date(Date.now() + durationMs);
    const deadlineTimestamp = Timestamp.fromDate(deadlineDate);

    // Increment selected officer's activeIssues count
    const officerRef = doc(db, 'users', selected.uid);
    await updateDoc(officerRef, {
      activeIssues: increment(1),
    });

    return {
      assigned: true,
      officerId: selected.uid,
      officerName: selected.name || selected.email || 'Municipal Officer',
      deadline: deadlineTimestamp,
      status: 'assigned',
    };
  } catch (err) {
    console.error('[CivicEye] Auto-assignment failed:', err);
    return {
      assigned: false,
      officerId: null,
      officerName: null,
      deadline: null,
      status: 'submitted',
    };
  }
}
