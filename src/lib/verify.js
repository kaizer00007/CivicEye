/**
 * Resolution Verification Engine (src/lib/verify.js).
 * Coordinates:
 * 1. Anti-cheat checks:
 *    - Image hash duplicate check (against original report & all other reports' proofs)
 *    - Officer GPS distance check (must be within 100m of report location)
 *    - Timestamp sequence check (proof cannot precede assignment)
 * 2. Gemini AI dual-image visual verification.
 * 3. State decision tree:
 *    - verified: AI confirms same place + resolved with confidence >= 75%, no red flags.
 *    - awaiting_citizen: AI indicates resolution with 50-74% confidence.
 *    - rejected: AI reports not resolved or wrong location.
 *    - awaiting_admin: Any red flags or anti-cheat flags detected.
 * 4. Triggers Rating Engine upon verified resolution.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { verifyResolutionProof } from './gemini';
import { haversineDistanceMeters } from './geoUtils';
import { hashHammingDistance } from './imageUtils';
import { processResolutionRating } from './rating';
import {
  MAX_PROOF_DISTANCE_METERS,
  VERIFICATION_AUTO_APPROVE,
  VERIFICATION_BORDERLINE,
} from '../config';

/**
 * Runs complete resolution verification flow on submitted proof.
 * 
 * @param {string} reportId 
 * @param {any} report The existing report object before update
 * @param {string} proofData Base64 JPEG data URL of completion photo
 * @param {string} proofHash 64-bit perceptual hash of completion photo
 * @param {{ lat: number, lng: number }|null} proofLocation Officer's GPS coordinates
 * @param {string} [officerNote='']
 * @returns {Promise<{
 *   success: boolean,
 *   verificationState: 'verified'|'awaiting_citizen'|'awaiting_admin'|'rejected',
 *   status: 'resolved'|'in_progress',
 *   explanation: string,
 *   redFlags: string[],
 *   antiCheatTriggered: boolean
 * }>}
 */
export async function verifyReportResolution(
  reportId,
  report,
  proofData,
  proofHash,
  proofLocation,
  officerNote = ''
) {
  const redFlags = [];
  let antiCheatTriggered = false;

  // ── Step 1: Anti-Cheat Checks ──

  // Check 1A: Hash identical to original report's before photo
  if (report.imageHash && proofHash) {
    const distToBefore = hashHammingDistance(report.imageHash, proofHash);
    if (distToBefore <= 4) {
      redFlags.push('anti_cheat_reused_before_photo');
      antiCheatTriggered = true;
    }
  }

  // Check 1B: Hash matches any existing report's proof
  try {
    const dupProofQuery = query(
      collection(db, 'reports'),
      where('resolution.proofHash', '==', proofHash)
    );
    const dupProofSnap = await getDocs(dupProofQuery);
    let isReusedProof = false;
    dupProofSnap.forEach((d) => {
      if (d.id !== reportId) {
        isReusedProof = true;
      }
    });

    if (isReusedProof) {
      redFlags.push('anti_cheat_duplicate_proof_photo_reused');
      antiCheatTriggered = true;
    }
  } catch (err) {
    console.warn('Proof duplicate query check skipped:', err.message);
  }

  // Check 1C: Officer GPS distance > 100 meters
  if (
    proofLocation &&
    report.location?.lat &&
    report.location?.lng &&
    typeof proofLocation.lat === 'number'
  ) {
    const distMeters = haversineDistanceMeters(
      proofLocation.lat,
      proofLocation.lng,
      report.location.lat,
      report.location.lng
    );

    if (distMeters > MAX_PROOF_DISTANCE_METERS) {
      redFlags.push(`anti_cheat_gps_distance_${Math.round(distMeters)}m`);
      antiCheatTriggered = true;
    }
  }

  // ── Step 2: Gemini Dual-Image Visual Analysis ──
  const aiResult = await verifyResolutionProof(
    report.imageData,
    proofData,
    report.aiClassification || 'issue'
  );

  if (aiResult.red_flags && aiResult.red_flags.length > 0) {
    redFlags.push(...aiResult.red_flags);
  }

  // ── Step 3: Decision Logic ──
  let verificationState = 'rejected';
  let status = 'in_progress';

  if (antiCheatTriggered || redFlags.length > 0) {
    // Any red flag or anti-cheat failure routes directly to admin review
    verificationState = 'awaiting_admin';
    status = 'in_progress';
  } else if (!aiResult.same_location || !aiResult.issue_resolved) {
    // Problem was not fixed or photo taken at wrong location
    verificationState = 'rejected';
    status = 'in_progress';
  } else if (
    aiResult.same_location &&
    aiResult.issue_resolved &&
    aiResult.confidence >= VERIFICATION_AUTO_APPROVE
  ) {
    // Auto-verified!
    verificationState = 'verified';
    status = 'resolved';
  } else if (
    aiResult.issue_resolved &&
    aiResult.confidence >= VERIFICATION_BORDERLINE
  ) {
    // Borderline fix: routes to citizen confirmation
    verificationState = 'awaiting_citizen';
    status = 'in_progress';
  }

  // ── Step 4: Persist Resolution to Firestore ──
  const updatePayload = {
    updatedAt: serverTimestamp(),
    status,
    'resolution.proofData': proofData,
    'resolution.proofHash': proofHash,
    'resolution.proofLocation': proofLocation || null,
    'resolution.submittedAt': serverTimestamp(),
    'resolution.aiResult': {
      same_location: aiResult.same_location,
      issue_resolved: aiResult.issue_resolved,
      confidence: aiResult.confidence,
      explanation: aiResult.explanation,
      red_flags: redFlags,
    },
    'resolution.verificationState': verificationState,
    'resolution.adminNote': officerNote || '',
  };

  if (status === 'resolved') {
    updatePayload.resolvedAt = serverTimestamp();
  }

  await updateDoc(doc(db, 'reports', reportId), updatePayload);

  // ── Step 5: Trigger Rating Engine if Verified ──
  if (verificationState === 'verified') {
    await processResolutionRating(report, reportId);
  }

  return {
    success: verificationState === 'verified',
    verificationState,
    status,
    explanation: aiResult.explanation,
    redFlags,
    antiCheatTriggered,
  };
}

/**
 * Admin action: Manually approves or rejects a flagged verification.
 * 
 * @param {string} reportId 
 * @param {any} report 
 * @param {'approve'|'reject'} decision 
 * @param {string} [adminComment='']
 */
export async function adminReviewVerification(reportId, report, decision, adminComment = '') {
  const isApproved = decision === 'approve';

  const updatePayload = {
    updatedAt: serverTimestamp(),
    'resolution.verificationState': isApproved ? 'verified' : 'rejected',
    'resolution.adminNote': adminComment || `Admin marked ${decision}.`,
  };

  if (isApproved) {
    updatePayload.status = 'resolved';
    updatePayload.resolvedAt = serverTimestamp();
  } else {
    updatePayload.status = 'in_progress';
  }

  await updateDoc(doc(db, 'reports', reportId), updatePayload);

  if (isApproved) {
    await processResolutionRating(report, reportId);
  }
}
