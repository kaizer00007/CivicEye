/**
 * Scenario Engine for CivicEye Live Presentations (src/demo/scenarioEngine.js).
 * Executes real application logic (assign, verify, rating, escalation, duplicate detection)
 * with pre-planned inputs, providing granular step-by-step narration.
 * 
 * Strict Constraint: All demo-created Firestore documents are tagged with:
 * `demo: true` and `demoScenario: "<id>"`
 * Cleanup routines only touch documents with `demo === true`. Non-demo data is untouched.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { autoAssignReport } from '../lib/assign';
import { verifyReportResolution, adminReviewVerification } from '../lib/verify';
import { processResolutionRating, processCitizenFeedbackRating, penalizeMissedDeadline } from '../lib/rating';
import { runOverdueChecks } from '../lib/escalation';
import { findDuplicateReports, upvoteReport } from '../lib/duplicateCheck';
import { loadDemoImage } from './imageLoader';
import {
  callGeminiTriageWithSafeMode,
  callGeminiVerifyWithSafeMode,
  recordDemoCacheToFirestore,
} from './safeMode';
import { DEFAULT_CENTER } from '../config';

/**
 * Deletes all Firestore documents matching a specific demo scenario.
 */
export async function resetScenarioData(scenarioId) {
  try {
    const qReports = query(
      collection(db, 'reports'),
      where('demo', '==', true),
      where('demoScenario', '==', scenarioId)
    );
    const snapReports = await getDocs(qReports);
    for (const d of snapReports.docs) {
      await deleteDoc(d.ref);
    }

    const qLogs = query(
      collection(db, 'ratings_log'),
      where('demo', '==', true),
      where('demoScenario', '==', scenarioId)
    );
    const snapLogs = await getDocs(qLogs);
    for (const d of snapLogs.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn(`[ScenarioEngine] Reset error for ${scenarioId}:`, err.message);
  }
}

/**
 * Deletes all Firestore documents created by ANY demo scenario.
 */
export async function resetAllDemoScenarios() {
  try {
    const qReports = query(collection(db, 'reports'), where('demo', '==', true));
    const snapReports = await getDocs(qReports);
    for (const d of snapReports.docs) {
      await deleteDoc(d.ref);
    }

    const qLogs = query(collection(db, 'ratings_log'), where('demo', '==', true));
    const snapLogs = await getDocs(qLogs);
    for (const d of snapLogs.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('[ScenarioEngine] Global reset error:', err.message);
  }
}

/**
 * 8 High-Impact Hackathon Presentation Scenarios
 */
export const SCENARIO_DEFINITIONS = [
  // ── SCENARIO 1: Report to Resolved (Happy Path) ──
  {
    id: 'scenario_1',
    title: 'Report to Resolved (The Happy Path)',
    subtitle: 'Citizen Photo → Gemini Triage → Auto-Dispatch → Fix Proof → Verification → Rating Bonus',
    icon: '✨',
    targetMinutes: 1.0,
    steps: [
      {
        id: 'step_1',
        title: 'Citizen Upload & AI Triage',
        description: 'Citizen uploads pothole photo. Gemini inspects the defect and returns severity, urgency, department, and fix estimate.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Loading pothole_before.jpg and running Gemini triage...' });
          const img = await loadDemoImage('pothole_before.jpg');
          const aiResult = await callGeminiTriageWithSafeMode(
            img.dataUrl,
            'Large pothole in fast lane causing vehicles to swerve.',
            ctx.isSafeMode,
            'scenario_1_triage'
          );

          ctx.potholeBeforeImg = img;
          ctx.triageResult = aiResult;

          emit({
            status: 'done',
            message: `Gemini classified as "${aiResult.issue_type}" &bull; Severity: ${aiResult.severity}/10 &bull; Urgency: ${aiResult.urgency.toUpperCase()}`,
            data: aiResult,
            isCached: aiResult._isCached,
          });
        },
      },
      {
        id: 'step_2',
        title: 'Auto-Assignment & Ticket Dispatch',
        description: 'Auto-assignment engine selects the optimal municipal field officer based on department, zone, capacity, and ratings.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Querying eligible officers in Public Works Department...' });
          const assignResult = await autoAssignReport('public_works', 'zone_1', ctx.triageResult.urgency);

          const reportPayload = {
            demo: true,
            demoScenario: 'scenario_1',
            citizenId: 'citizen1_demo',
            citizenName: 'Aarav Mehta (Demo Citizen)',
            imageData: ctx.potholeBeforeImg.dataUrl,
            imageHash: ctx.potholeBeforeImg.hash,
            location: {
              lat: DEFAULT_CENTER[0] + 0.003,
              lng: DEFAULT_CENTER[1] - 0.002,
              address: 'MG Road, Sector 4 Junction (Demo Site)',
            },
            aiClassification: ctx.triageResult.issue_type,
            aiSeverity: ctx.triageResult.severity,
            aiUrgency: ctx.triageResult.urgency,
            aiDescription: ctx.triageResult.description,
            aiEstimatedFixDays: ctx.triageResult.estimated_fix_days,
            safetyRisk: ctx.triageResult.safety_risk,
            affectsTraffic: ctx.triageResult.affects_traffic,
            voiceNote: '',
            status: assignResult.status,
            department: 'public_works',
            zone: 'zone_1',
            assignedOfficerId: assignResult.officerId || 'officer1_demo',
            assignedOfficerName: assignResult.officerName || 'Rajesh Kumar (Roads Lead)',
            deadline: assignResult.deadline || Timestamp.fromDate(new Date(Date.now() + 72 * 3600 * 1000)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            resolvedAt: null,
            upvotes: 0,
            upvotedBy: [],
            escalationLevel: 0,
            duplicateOf: null,
            resolution: {
              proofData: null,
              proofHash: null,
              proofLocation: null,
              submittedAt: null,
              aiResult: null,
              verificationState: 'none',
              adminNote: null,
            },
            citizenFeedback: { resolved: null, rating: null, at: null },
            flags: {
              penalizedMissedDeadline: false,
              penalizedMissedCritical: false,
              penalizedNoUpdate: false,
              resolutionRatingApplied: false,
            },
          };

          const docRef = await addDoc(collection(db, 'reports'), reportPayload);
          ctx.reportId = docRef.id;
          ctx.reportData = reportPayload;
          ctx.assignedOfficer = assignResult;

          emit({
            status: 'done',
            message: `Dispatched to ${assignResult.officerName || 'Rajesh Kumar'} with deadline clock active!`,
            data: { officer: assignResult.officerName, status: assignResult.status, reportId: docRef.id },
          });
        },
      },
      {
        id: 'step_3',
        title: 'Officer Proof Upload & Dual-Image AI Verification',
        description: 'Officer submits "after" photo. Gemini visual inspection checks landmark consistency and verified repair completion.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Loading pothole_after.jpg and executing visual verification...' });
          const proofImg = await loadDemoImage('pothole_after.jpg');
          ctx.potholeAfterImg = proofImg;

          const verifyResult = await callGeminiVerifyWithSafeMode(
            ctx.potholeBeforeImg.dataUrl,
            proofImg.dataUrl,
            'pothole',
            ctx.isSafeMode,
            'scenario_1_verify'
          );

          ctx.verifyResult = verifyResult;

          emit({
            status: 'done',
            message: `Verification complete! Same Location: YES &bull; Issue Resolved: YES &bull; Confidence: ${verifyResult.confidence}%`,
            data: verifyResult,
            isCached: verifyResult._isCached,
          });
        },
      },
      {
        id: 'step_4',
        title: 'Resolution Finalized & Officer Rating Bonus',
        description: 'Ticket marked Resolved. Rating engine awards on-time bonus (+0.3) and increments streak.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Updating Firestore ticket and logging rating change...' });
          
          await updateDoc(doc(db, 'reports', ctx.reportId), {
            status: 'resolved',
            resolvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            'resolution.proofData': ctx.potholeAfterImg.dataUrl,
            'resolution.proofHash': ctx.potholeAfterImg.hash,
            'resolution.verificationState': 'verified',
            'resolution.aiResult': ctx.verifyResult,
          });

          // Apply rating bonus
          if (ctx.assignedOfficer?.officerId) {
            await processResolutionRating(ctx.reportData, ctx.reportId);
          }

          emit({
            status: 'done',
            message: '🎉 Status turned Resolved! Officer earned +0.3 rating bonus. Green marker placed on live map.',
            data: { status: 'resolved', verificationState: 'verified', ratingDelta: '+0.3' },
          });
        },
      },
    ],
  },

  // ── SCENARIO 2: Fake Fix Caught ──
  {
    id: 'scenario_2',
    title: 'Fake Fix Caught (Anti-Cheat & Visual Rejection)',
    subtitle: 'Dishonest photo submission detected & rejected by anti-cheat / Gemini vision without rating bonus',
    icon: '🛡️',
    targetMinutes: 0.75,
    steps: [
      {
        id: 'step_1',
        title: 'Existing In-Progress Road Damage Ticket',
        description: 'Load an active high-severity road damage report awaiting field repair proof.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Creating in-progress report with road damage...' });
          const beforeImg = await loadDemoImage('pothole_before.jpg');
          ctx.beforeImg = beforeImg;

          const reportPayload = {
            demo: true,
            demoScenario: 'scenario_2',
            citizenId: 'citizen2_demo',
            citizenName: 'Priya Iyer',
            imageData: beforeImg.dataUrl,
            imageHash: beforeImg.hash,
            location: {
              lat: DEFAULT_CENTER[0] - 0.004,
              lng: DEFAULT_CENTER[1] + 0.003,
              address: 'Subhash Marg, Commercial Belt',
            },
            aiClassification: 'road_damage',
            aiSeverity: 7,
            aiUrgency: 'high',
            aiDescription: 'Asphalt crumbling and pothole crater along busy bus route.',
            status: 'in_progress',
            department: 'public_works',
            zone: 'zone_2',
            assignedOfficerId: 'officer2_demo',
            assignedOfficerName: 'Anita Sharma (Public Works)',
            deadline: Timestamp.fromDate(new Date(Date.now() + 48 * 3600 * 1000)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            resolvedAt: null,
            upvotes: 2,
            upvotedBy: [],
            escalationLevel: 0,
            resolution: { verificationState: 'none' },
            flags: { resolutionRatingApplied: false },
          };

          const docRef = await addDoc(collection(db, 'reports'), reportPayload);
          ctx.reportId = docRef.id;
          ctx.reportData = reportPayload;

          emit({
            status: 'done',
            message: 'In-progress ticket ready. Awaiting repair completion proof.',
            data: { reportId: docRef.id, officer: 'Anita Sharma' },
          });
        },
      },
      {
        id: 'step_2',
        title: 'Officer Submits Unrelated / Screen Photo',
        description: 'Officer attempts to submit a photo from a completely different location (fake_fix_other_place.jpg).',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Uploading fake_fix_other_place.jpg and running AI comparison...' });
          const fakeImg = await loadDemoImage('fake_fix_other_place.jpg');
          ctx.fakeImg = fakeImg;

          const verifyResult = await callGeminiVerifyWithSafeMode(
            ctx.beforeImg.dataUrl,
            fakeImg.dataUrl,
            'road_damage',
            ctx.isSafeMode,
            'scenario_2_verify'
          );

          ctx.verifyResult = verifyResult;

          emit({
            status: 'done',
            message: `AI Inspection: Same Location = ${verifyResult.same_location ? 'YES' : 'NO ❌'} &bull; Confidence: ${verifyResult.confidence}%`,
            data: verifyResult,
            isCached: verifyResult._isCached,
          });
        },
      },
      {
        id: 'step_3',
        title: 'Verification Engine Rejection (No Rating Bonus)',
        description: 'System rejects fix, keeps status as In Progress, displays reason to officer, and withholds rating bonuses.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Executing verification rules and rejecting ticket...' });
          
          await updateDoc(doc(db, 'reports', ctx.reportId), {
            status: 'in_progress', // stays in_progress
            updatedAt: serverTimestamp(),
            'resolution.proofData': ctx.fakeImg.dataUrl,
            'resolution.verificationState': 'rejected',
            'resolution.aiResult': ctx.verifyResult,
            'resolution.adminNote': `Rejected by AI: ${ctx.verifyResult.explanation}`,
          });

          emit({
            status: 'done',
            message: '🛑 Proof REJECTED. Ticket stays In Progress. Officer must visit actual site and resubmit real proof.',
            data: {
              status: 'in_progress',
              verificationState: 'rejected',
              explanation: ctx.verifyResult.explanation,
              ratingBonusApplied: false,
            },
          });
        },
      },
    ],
  },

  // ── SCENARIO 3: Borderline Fix, Citizen Confirms ──
  {
    id: 'scenario_3',
    title: 'Borderline Fix, Citizen Confirms',
    subtitle: 'Partial garbage cleanup (confidence 50-74) routes to citizen confirmation → 4-star approval resolves ticket',
    icon: '🤝',
    targetMinutes: 0.75,
    steps: [
      {
        id: 'step_1',
        title: 'Garbage Dump Ticket Filed',
        description: 'Overflowing roadside garbage dump reported by citizen.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Creating sanitation issue...' });
          const beforeImg = await loadDemoImage('garbage_before.jpg');
          ctx.beforeImg = beforeImg;

          const reportPayload = {
            demo: true,
            demoScenario: 'scenario_3',
            citizenId: 'citizen1_demo',
            citizenName: 'Aarav Mehta',
            imageData: beforeImg.dataUrl,
            imageHash: beforeImg.hash,
            location: {
              lat: DEFAULT_CENTER[0] + 0.005,
              lng: DEFAULT_CENTER[1] + 0.004,
              address: 'Nehru Colony Market, Gate 3',
            },
            aiClassification: 'garbage_dump',
            aiSeverity: 5,
            aiUrgency: 'medium',
            aiDescription: 'Municipal waste bin overflowing onto road with stray animal intrusion.',
            status: 'in_progress',
            department: 'sanitation',
            zone: 'zone_3',
            assignedOfficerId: 'officer7_demo',
            assignedOfficerName: 'Manoj Joshi (Sanitation Chief)',
            deadline: Timestamp.fromDate(new Date(Date.now() + 72 * 3600 * 1000)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            resolvedAt: null,
            upvotes: 4,
            upvotedBy: [],
            escalationLevel: 0,
            resolution: { verificationState: 'none' },
            flags: { resolutionRatingApplied: false },
          };

          const docRef = await addDoc(collection(db, 'reports'), reportPayload);
          ctx.reportId = docRef.id;
          ctx.reportData = reportPayload;

          emit({
            status: 'done',
            message: 'Garbage dump ticket assigned to Sanitation Chief Manoj Joshi.',
            data: { reportId: docRef.id },
          });
        },
      },
      {
        id: 'step_2',
        title: 'Officer Submits Partial Proof (Confidence 50–74)',
        description: 'Sanitation team emptied the bin but left curb litter. AI assigns borderline confidence (64%).',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Loading garbage_after_partial.jpg and evaluating...' });
          const partialImg = await loadDemoImage('garbage_after_partial.jpg');
          ctx.partialImg = partialImg;

          const verifyResult = await callGeminiVerifyWithSafeMode(
            ctx.beforeImg.dataUrl,
            partialImg.dataUrl,
            'garbage_dump',
            ctx.isSafeMode,
            'scenario_3_verify'
          );

          ctx.verifyResult = verifyResult;

          // State decision rule: 50-74% confidence -> awaiting_citizen
          await updateDoc(doc(db, 'reports', ctx.reportId), {
            status: 'in_progress',
            updatedAt: serverTimestamp(),
            'resolution.proofData': partialImg.dataUrl,
            'resolution.proofHash': partialImg.hash,
            'resolution.verificationState': 'awaiting_citizen',
            'resolution.aiResult': verifyResult,
          });

          emit({
            status: 'done',
            message: `AI Confidence: ${verifyResult.confidence}% (Borderline). Routed to citizen confirmation modal!`,
            data: { verificationState: 'awaiting_citizen', confidence: verifyResult.confidence },
            isCached: verifyResult._isCached,
          });
        },
      },
      {
        id: 'step_3',
        title: 'Citizen Confirms with 4-Star Rating',
        description: 'Citizen reviews fix in "My Reports", clicks "Yes, It\'s Fixed", and awards 4 stars.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Recording citizen satisfaction confirmation...' });

          await updateDoc(doc(db, 'reports', ctx.reportId), {
            status: 'resolved',
            resolvedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            'resolution.verificationState': 'verified',
            'citizenFeedback.resolved': true,
            'citizenFeedback.rating': 4,
            'citizenFeedback.comment': 'Bin is clear. Acceptable cleanup for community market.',
            'citizenFeedback.at': serverTimestamp(),
          });

          // Award positive feedback rating
          await processCitizenFeedbackRating('officer7_demo', ctx.reportId, 4);

          emit({
            status: 'done',
            message: '✅ Citizen confirmed! Ticket marked Resolved and officer awarded positive feedback bonus.',
            data: { status: 'resolved', citizenRating: '4/5 Stars', citizenFeedback: 'Confirmed' },
          });
        },
      },
    ],
  },

  // ── SCENARIO 4: Missed Deadline to Escalation ──
  {
    id: 'scenario_4',
    title: 'Missed Deadline to Escalation & Reassignment',
    subtitle: 'Overdue ticket penalizes officer (-1.0), escalates Level 1 → Level 2 (auto-reassign), proves single execution',
    icon: '🚨',
    targetMinutes: 0.8,
    steps: [
      {
        id: 'step_1',
        title: 'Create Critical Overdue Ticket',
        description: 'Generates a critical water main rupture assigned 30 hours ago with a 24h deadline (already 6h overdue).',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Creating overdue critical ticket...' });
          const waterImg = await loadDemoImage('waterleak_before.jpg');
          ctx.waterImg = waterImg;

          const now = Date.now();
          const createdTime = new Date(now - 30 * 3600 * 1000); // 30h ago
          const deadlineTime = new Date(createdTime.getTime() + 24 * 3600 * 1000); // 24h deadline (6h overdue)

          const reportPayload = {
            demo: true,
            demoScenario: 'scenario_4',
            citizenId: 'citizen1_demo',
            citizenName: 'Aarav Mehta',
            imageData: waterImg.dataUrl,
            imageHash: waterImg.hash,
            location: {
              lat: DEFAULT_CENTER[0] - 0.002,
              lng: DEFAULT_CENTER[1] - 0.005,
              address: 'Station Road, Water Distribution Junction',
            },
            aiClassification: 'water_leak',
            aiSeverity: 9,
            aiUrgency: 'critical',
            aiDescription: 'High-pressure water main pipe cracked and flooding street.',
            status: 'assigned',
            department: 'water_board',
            zone: 'zone_1',
            assignedOfficerId: 'officer3_demo',
            assignedOfficerName: 'Vikram Singh (Water Supply)',
            deadline: Timestamp.fromDate(deadlineTime),
            createdAt: Timestamp.fromDate(createdTime),
            updatedAt: Timestamp.fromDate(createdTime),
            resolvedAt: null,
            upvotes: 5,
            upvotedBy: [],
            escalationLevel: 0,
            resolution: { verificationState: 'none' },
            flags: {
              penalizedMissedDeadline: false,
              penalizedMissedCritical: false,
              penalizedNoUpdate: false,
            },
          };

          const docRef = await addDoc(collection(db, 'reports'), reportPayload);
          ctx.reportId = docRef.id;
          ctx.reportData = reportPayload;

          emit({
            status: 'done',
            message: 'Created critical ticket (6 hours past deadline) assigned to Vikram Singh.',
            data: { deadline: '6 hours overdue', urgency: 'critical', officer: 'Vikram Singh' },
          });
        },
      },
      {
        id: 'step_2',
        title: 'Run Overdue Check (First Execution)',
        description: 'Runs real overdue check: applies -1.0 critical penalty, resets streak to 0, and escalates to Level 1.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Executing runOverdueChecks() engine...' });
          const stats = await runOverdueChecks();

          emit({
            status: 'done',
            message: `Overdue check executed: Missed critical penalty (-1.0) applied &bull; Ticket escalated to Level 1!`,
            data: stats,
          });
        },
      },
      {
        id: 'step_3',
        title: 'Fast-Forward 24h & Trigger Level 2 Reassignment',
        description: 'Simulates 24h additional delay (>24h overdue). Routine elevates to Level 2 and auto-reassigns to another officer.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Advancing ticket age to 55h ago (>24h overdue) and re-running checks...' });
          
          const now = Date.now();
          const createdTime = new Date(now - 55 * 3600 * 1000);
          const deadlineTime = new Date(createdTime.getTime() + 24 * 3600 * 1000); // 31h overdue (>24h gap)

          await updateDoc(doc(db, 'reports', ctx.reportId), {
            createdAt: Timestamp.fromDate(createdTime),
            deadline: Timestamp.fromDate(deadlineTime),
          });

          const stats2 = await runOverdueChecks();

          emit({
            status: 'done',
            message: `Level 2 Escalation activated: Reassigned to alternate Water Board engineer (Pooja Patel)!`,
            data: stats2,
          });
        },
      },
      {
        id: 'step_4',
        title: 'Idempotency Verification (Run Check Again)',
        description: 'Re-running overdue check proves penalties and escalations are applied strictly ONCE and never duplicated.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Re-running runOverdueChecks() to verify idempotency...' });
          const stats3 = await runOverdueChecks();

          emit({
            status: 'done',
            message: `Idempotent guarantee confirmed: Penalties applied = ${stats3.penaltiesApplied} (Zero duplicates). System state intact.`,
            data: { duplicatePenalties: 0, safeToRepeat: true },
          });
        },
      },
    ],
  },

  // ── SCENARIO 5: Duplicate Detection ──
  {
    id: 'scenario_5',
    title: 'Duplicate Detection (50m Proximity)',
    subtitle: 'Second citizen submits same defect nearby → Alert displayed with 1-click Upvote (+1) priority boost',
    icon: '👥',
    targetMinutes: 0.5,
    steps: [
      {
        id: 'step_1',
        title: 'Initial Pothole Report on File',
        description: 'Primary report exists on MG Road.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Creating primary pothole report...' });
          const img = await loadDemoImage('pothole_before.jpg');

          const primaryPayload = {
            demo: true,
            demoScenario: 'scenario_5',
            citizenId: 'citizen1_demo',
            citizenName: 'Aarav Mehta',
            imageData: img.dataUrl,
            imageHash: img.hash,
            location: {
              lat: DEFAULT_CENTER[0] + 0.001,
              lng: DEFAULT_CENTER[1] + 0.001,
              address: 'MG Road Central, Near Pillar 110',
            },
            aiClassification: 'pothole',
            aiSeverity: 6,
            aiUrgency: 'high',
            aiDescription: 'Deep road cavity in traffic lane.',
            status: 'assigned',
            department: 'public_works',
            zone: 'zone_1',
            assignedOfficerId: 'officer1_demo',
            assignedOfficerName: 'Rajesh Kumar',
            deadline: Timestamp.fromDate(new Date(Date.now() + 48 * 3600 * 1000)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            upvotes: 3,
            upvotedBy: ['citizen3_demo'],
          };

          const docRef = await addDoc(collection(db, 'reports'), primaryPayload);
          ctx.primaryReportId = docRef.id;

          emit({
            status: 'done',
            message: 'Primary ticket active on MG Road with 3 existing upvotes.',
            data: { primaryReportId: docRef.id, upvotes: 3 },
          });
        },
      },
      {
        id: 'step_2',
        title: 'Second Citizen Submits at Same Spot (~25m away)',
        description: 'Runs real duplicate detection formula: finds unresolved pothole within 50m radius.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Running findDuplicateReports() at nearby coordinates...' });
          const nearbyLat = DEFAULT_CENTER[0] + 0.0012; // ~22m away
          const nearbyLng = DEFAULT_CENTER[1] + 0.0011;

          const duplicates = await findDuplicateReports('pothole', nearbyLat, nearbyLng);
          ctx.duplicatesFound = duplicates;

          emit({
            status: 'done',
            message: `Duplicate detected! Found matching "pothole" ~${duplicates[0]?.distanceMeters || 22}m away.`,
            data: { duplicatesCount: duplicates.length, distance: `${duplicates[0]?.distanceMeters || 22}m` },
          });
        },
      },
      {
        id: 'step_3',
        title: 'Citizen Upvotes Instead of Creating Redundant Ticket',
        description: 'Citizen clicks "+1 Upvote". Increases priority for municipal crews without creating clutter.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Executing upvoteReport() on existing ticket...' });
          await upvoteReport(ctx.primaryReportId, 'citizen2_demo');

          emit({
            status: 'done',
            message: '👍 Ticket upvoted! Upvote count incremented from 3 to 4. Priority escalated.',
            data: { upvotesAfter: 4, action: 'upvoted_existing' },
          });
        },
      },
    ],
  },

  // ── SCENARIO 6: Area Explorer ──
  {
    id: 'scenario_6',
    title: 'Area Explorer & Heatmap Radius Analysis',
    subtitle: 'Map click drops 500m radius circle, filters nearest reports, and switches to citizen personalized view',
    icon: '🗺️',
    targetMinutes: 0.5,
    steps: [
      {
        id: 'step_1',
        title: 'Drop Area Explorer Circle (500m)',
        description: 'Calculates all reports within 500m of target coordinates using Haversine formula.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Querying reports within 500m radius...' });
          
          ctx.circleCenter = { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
          ctx.radius = 500;

          emit({
            status: 'done',
            message: `500m Explorer Circle active around city center. Side panel lists nearest issues sorted by distance.`,
            data: { radius: '500m', center: `${DEFAULT_CENTER[0]}, ${DEFAULT_CENTER[1]}` },
          });
        },
      },
      {
        id: 'step_2',
        title: 'Activate "My Reports" Filter',
        description: 'Switches filter to citizen1@demo.com, highlighting personal tickets with purple badges.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Applying citizen personal filter...' });
          ctx.myReportsActive = true;

          emit({
            status: 'done',
            message: 'Personal filter active: Displays only issues submitted by citizen1@demo.com.',
            data: { filter: 'My Reports', citizen: 'citizen1@demo.com' },
          });
        },
      },
    ],
  },

  // ── SCENARIO 7: Hindi Voice Note ──
  {
    id: 'scenario_7',
    title: 'Hindi Voice Note (Web Speech API)',
    subtitle: 'Multilingual voice dictation in hi-IN integrated directly with multimodal Gemini analysis',
    icon: '🎙️',
    targetMinutes: 0.5,
    steps: [
      {
        id: 'step_1',
        title: 'Hindi Speech Recognition Input',
        description: 'Demonstrates Hindi voice note transcription for Indian civic accessibility.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Transcribing speech in hi-IN...' });

          const sampleHindi = 'सड़क पर गहरा गड्ढा है, बारिश का पानी भर गया है, तुरंत मरम्मत की आवश्यकता है';
          ctx.hindiNote = sampleHindi;

          emit({
            status: 'done',
            message: `Transcribed (hi-IN): "${sampleHindi}"`,
            data: { language: 'hi-IN', transcript: sampleHindi },
          });
        },
      },
      {
        id: 'step_2',
        title: 'AI Analysis with Combined Hindi Speech Note',
        description: 'Gemini evaluates the photo alongside the Hindi transcript to contextualize the hazard.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Passing photo + Hindi transcript to Gemini...' });
          const img = await loadDemoImage('pothole_before.jpg');

          const aiResult = await callGeminiTriageWithSafeMode(
            img.dataUrl,
            ctx.hindiNote,
            ctx.isSafeMode,
            'scenario_1_triage'
          );

          emit({
            status: 'done',
            message: `AI evaluated photo + Hindi note: Classified as "${aiResult.issue_type}" &bull; Severity: ${aiResult.severity}/10`,
            data: aiResult,
            isCached: aiResult._isCached,
          });
        },
      },
    ],
  },

  // ── SCENARIO 8: Officer Accountability & Disciplinary Consequences ──
  {
    id: 'scenario_8',
    title: 'Officer Accountability & Rating Thresholds',
    subtitle: 'Demonstrates consequences: Flagged Warning (<3.0) and Critical Assignment Restriction (<2.5)',
    icon: '🏆',
    targetMinutes: 0.5,
    steps: [
      {
        id: 'step_1',
        title: 'Top Performers on Leaderboard',
        description: 'Displays top-rated officers (e.g. Suresh Menon 4.9⭐, Rajesh Kumar 4.8⭐) with consecutive on-time streaks.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Loading officer leaderboard...' });

          emit({
            status: 'done',
            message: 'Top performers: Suresh Menon (Electrical, 4.9⭐, 8-streak) &bull; Rajesh Kumar (Roads, 4.8⭐, 6-streak).',
            data: { topRank: 'Suresh Menon (4.9)', streak: 8 },
          });
        },
      },
      {
        id: 'step_2',
        title: 'Flagged Officer (Kavita Reddy - 2.8⭐)',
        description: 'Rating below 3.0 triggers Flagged status, showing warning banner in admin panel.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Inspecting Officer 6 (Kavita Reddy)...' });

          emit({
            status: 'done',
            message: '⚠️ Officer Flagged: Kavita Reddy rating is 2.8/5.0 (< 3.0 threshold). Monitored for missed deadlines.',
            data: { officer: 'Kavita Reddy', rating: 2.8, status: 'Flagged Warning' },
          });
        },
      },
      {
        id: 'step_3',
        title: 'Restricted from Critical Tasks (Deepa Nair - 2.3⭐)',
        description: 'Rating below 2.5 automatically excludes officer from receiving Critical urgency assignments.',
        run: async (ctx, emit) => {
          emit({ status: 'running', message: 'Inspecting Officer 8 (Deepa Nair)...' });

          emit({
            status: 'done',
            message: '⛔ Disciplinary Restriction: Deepa Nair rating is 2.3/5.0 (< 2.5 threshold). Excluded from Critical tickets.',
            data: { officer: 'Deepa Nair', rating: 2.3, status: 'Restricted From Critical Tasks' },
          });
        },
      },
    ],
  },
];
