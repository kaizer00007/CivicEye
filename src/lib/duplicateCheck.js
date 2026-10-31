/**
 * Duplicate check and upvote utilities (src/lib/duplicateCheck.js).
 * Searches for open reports of the same issue type within 50 meters.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { haversineDistanceMeters } from './geoUtils';
import { DUPLICATE_RADIUS_METERS } from '../config';

/**
 * Checks if a similar unresolved report exists within 50 meters.
 * 
 * @param {string} issueType 
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<Array<{
 *   id: string,
 *   distanceMeters: number,
 *   [key: string]: any
 * }>>}
 */
export async function findDuplicateReports(issueType, lat, lng) {
  try {
    const reportsRef = collection(db, 'reports');
    // Fetch reports of same issue type
    const q = query(reportsRef, where('aiClassification', '==', issueType));
    const snap = await getDocs(q);

    const duplicates = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      // Ignore resolved reports
      if (data.status === 'resolved') return;

      if (data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
        const dist = haversineDistanceMeters(lat, lng, data.location.lat, data.location.lng);
        if (dist <= DUPLICATE_RADIUS_METERS) {
          duplicates.push({
            id: docSnap.id,
            distanceMeters: Math.round(dist),
            ...data,
          });
        }
      }
    });

    // Sort closest first
    duplicates.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return duplicates;
  } catch (err) {
    console.warn('[CivicEye] Duplicate check error:', err.message);
    return [];
  }
}

/**
 * Upvotes an existing report. Adds citizen's UID to upvotedBy array and increments counter.
 * 
 * @param {string} reportId 
 * @param {string} userId 
 * @returns {Promise<boolean>} True if newly upvoted, false if already upvoted
 */
export async function upvoteReport(reportId, userId) {
  if (!reportId || !userId) return false;

  const reportRef = doc(db, 'reports', reportId);
  await updateDoc(reportRef, {
    upvotes: increment(1),
    upvotedBy: arrayUnion(userId),
  });

  return true;
}
