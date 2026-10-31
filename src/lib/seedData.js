/**
 * Seed data definitions and generators for CivicEye hackathon demo.
 * Generates 1 Admin, 8 Officers across 4 departments & 3 zones, 3 Citizens,
 * and 25 realistic civic issue reports distributed around DEFAULT_CENTER over the last 30 days.
 */
import { DEFAULT_CENTER, ISSUE_TYPES, DEPARTMENTS } from '../config';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function getSecondaryApp() {
  const name = 'CivicEyeSecondarySeedApp';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  return initializeApp(firebaseConfig, name);
}

/**
 * Runs the full idempotent seed routine for CivicEye demo.
 * @param {(msg: string) => void} [onLog] 
 */
export async function runFullSeed(onLog = () => {}) {
  const secondaryApp = getSecondaryApp();
  const secAuth = getAuth(secondaryApp);
  const secDb = getFirestore(secondaryApp);

  const officerMap = {};
  const citizenMap = {};

  onLog(`Creating ${DEMO_USERS.length} demo accounts (Admin, Officers, Citizens)...`);

  for (const spec of DEMO_USERS) {
    let uid = null;
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, spec.email, DEMO_PASSWORD);
      uid = cred.user.uid;
      onLog(`✓ Created auth user: ${spec.email}`);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(secAuth, spec.email, DEMO_PASSWORD);
        uid = cred.user.uid;
        onLog(`• Account exists, signed in: ${spec.email}`);
      } else {
        onLog(`✕ Auth error on ${spec.email}: ${err.message}`);
        continue;
      }
    }

    const profilePayload = {
      name: spec.name,
      email: spec.email,
      phone: spec.phone || '',
      role: spec.role,
      department: spec.department || '',
      zone: spec.zone || '',
      rating: spec.rating ?? 3.5,
      totalResolved: spec.totalResolved || 0,
      activeIssues: spec.activeIssues || 0,
      streakCount: spec.streakCount || 0,
      restrictedFromCritical: Boolean(spec.restrictedFromCritical),
      flagged: Boolean(spec.flagged),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(secDb, 'users', uid), profilePayload, { merge: true });

    if (spec.role === 'officer') {
      officerMap[spec.email] = { uid, name: spec.name, ...spec };
    } else if (spec.role === 'citizen') {
      citizenMap[spec.email] = { uid, name: spec.name, ...spec };
    }

    await signOut(secAuth);
  }

  onLog('Generating 25 realistic reports around DEFAULT_CENTER...');
  const demoReports = generateDemoReports(officerMap, citizenMap);

  let createdReportsCount = 0;
  for (const rep of demoReports) {
    const reportPayload = {
      ...rep,
      createdAt: Timestamp.fromDate(rep.createdAt),
      updatedAt: Timestamp.fromDate(rep.updatedAt),
      deadline: rep.deadline ? Timestamp.fromDate(rep.deadline) : null,
      resolvedAt: rep.resolvedAt ? Timestamp.fromDate(rep.resolvedAt) : null,
      'resolution.submittedAt': rep.resolution?.submittedAt
        ? Timestamp.fromDate(rep.resolution.submittedAt)
        : null,
      'citizenFeedback.at': rep.citizenFeedback?.at
        ? Timestamp.fromDate(rep.citizenFeedback.at)
        : null,
    };

    const docRef = await addDoc(collection(secDb, 'reports'), reportPayload);
    createdReportsCount++;

    if (rep.status === 'resolved' && rep.assignedOfficerId) {
      await addDoc(collection(secDb, 'ratings_log'), {
        officerId: rep.assignedOfficerId,
        reportId: docRef.id,
        change: 0.3,
        reason: 'resolved_early',
        ratingAfter: 4.8,
        timestamp: reportPayload.resolvedAt || reportPayload.createdAt,
      });
    }
  }

  onLog(`✓ Successfully seeded ${createdReportsCount} reports!`);
  return { createdReportsCount };
}

export const DEMO_PASSWORD = 'Demo@1234';

// ── Demo Accounts Spec ──
export const DEMO_USERS = [
  // 1 Admin
  {
    email: 'admin@demo.com',
    name: 'Municipal Commissioner',
    role: 'admin',
    department: '',
    zone: '',
  },

  // 8 Officers across 4 departments and 3 zones
  {
    email: 'officer1@demo.com',
    name: 'Rajesh Kumar (Roads Lead)',
    role: 'officer',
    department: 'public_works',
    zone: 'zone_1',
    rating: 4.8,
    streakCount: 6,
    totalResolved: 24,
    activeIssues: 2,
  },
  {
    email: 'officer2@demo.com',
    name: 'Anita Sharma (Pavement Inspector)',
    role: 'officer',
    department: 'public_works',
    zone: 'zone_2',
    rating: 4.2,
    streakCount: 2,
    totalResolved: 15,
    activeIssues: 3,
  },
  {
    email: 'officer3@demo.com',
    name: 'Vikram Singh (Water Supply)',
    role: 'officer',
    department: 'water_board',
    zone: 'zone_1',
    rating: 4.6,
    streakCount: 4,
    totalResolved: 19,
    activeIssues: 1,
  },
  {
    email: 'officer4@demo.com',
    name: 'Pooja Patel (Drainage Engineer)',
    role: 'officer',
    department: 'water_board',
    zone: 'zone_3',
    rating: 3.8,
    streakCount: 1,
    totalResolved: 11,
    activeIssues: 4,
  },
  {
    email: 'officer5@demo.com',
    name: 'Suresh Menon (Grid Supervisor)',
    role: 'officer',
    department: 'electrical',
    zone: 'zone_1',
    rating: 4.9,
    streakCount: 8,
    totalResolved: 31,
    activeIssues: 1,
  },
  {
    email: 'officer6@demo.com',
    name: 'Kavita Reddy (Lighting Ops)',
    role: 'officer',
    department: 'electrical',
    zone: 'zone_2',
    rating: 2.8, // Flagged warning demonstration
    flagged: true,
    streakCount: 0,
    totalResolved: 8,
    activeIssues: 5,
  },
  {
    email: 'officer7@demo.com',
    name: 'Manoj Joshi (Sanitation Chief)',
    role: 'officer',
    department: 'sanitation',
    zone: 'zone_2',
    rating: 4.4,
    streakCount: 3,
    totalResolved: 22,
    activeIssues: 2,
  },
  {
    email: 'officer8@demo.com',
    name: 'Deepa Nair (Waste Management)',
    role: 'officer',
    department: 'sanitation',
    zone: 'zone_3',
    rating: 2.3, // Restricted from critical demonstration
    flagged: true,
    restrictedFromCritical: true,
    streakCount: 0,
    totalResolved: 6,
    activeIssues: 6,
  },

  // 3 Citizens
  {
    email: 'citizen1@demo.com',
    name: 'Aarav Mehta',
    role: 'citizen',
    phone: '+91 98765 43210',
  },
  {
    email: 'citizen2@demo.com',
    name: 'Priya Iyer',
    role: 'citizen',
    phone: '+91 98765 43211',
  },
  {
    email: 'citizen3@demo.com',
    name: 'Rohan Gupta',
    role: 'citizen',
    phone: '+91 98765 43212',
  },
];

/**
 * Creates an inline SVG Data URL representing a civic defect or repair photo.
 */
export function generatePlaceholderImage(label, isFixed = false) {
  const bg = isFixed ? '#15803d' : '#1e293b';
  const text = isFixed ? 'REPAIRED / VERIFIED' : label.toUpperCase();
  const subtext = isFixed ? 'Municipal Field Crew Completion' : 'Reported Civic Defect Photo';
  const icon = isFixed ? '✅' : '⚠️';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="${bg}"/>
    <circle cx="300" cy="160" r="60" fill="rgba(255,255,255,0.1)"/>
    <text x="300" y="175" font-family="sans-serif" font-size="50" text-anchor="middle" fill="#ffffff">${icon}</text>
    <text x="300" y="260" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle" fill="#ffffff">${text}</text>
    <text x="300" y="295" font-family="sans-serif" font-size="14" text-anchor="middle" fill="rgba(255,255,255,0.7)">${subtext}</text>
    <text x="300" y="360" font-family="monospace" font-size="11" text-anchor="middle" fill="rgba(255,255,255,0.4)">CIVICEYE VERIFICATION AUDIT TRAIL</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Prepares 25 realistic reports seeded around DEFAULT_CENTER.
 */
export function generateDemoReports(officerMap, citizenMap) {
  const baseLat = DEFAULT_CENTER[0];
  const baseLng = DEFAULT_CENTER[1];
  const now = Date.now();

  const presets = [
    // 1. Critical electrical hazard (Overdue, Escalated L1)
    {
      type: 'electrical_hazard',
      dept: 'electrical',
      zone: 'zone_1',
      sev: 9,
      urgency: 'critical',
      status: 'escalated',
      escalationLevel: 1,
      officerEmail: 'officer5@demo.com',
      citizenEmail: 'citizen1@demo.com',
      daysAgo: 2,
      hoursOverdue: 12,
      desc: 'Exposed live wiring hanging loose from junction box near pedestrian crossing. Imminent danger during rainfall.',
      addr: 'MG Road, near Metro Pillar 142',
      traffic: true,
      safety: true,
    },
    // 2. High severity water main burst (Escalated L2 - Reassigned)
    {
      type: 'water_leak',
      dept: 'water_board',
      zone: 'zone_1',
      sev: 8,
      urgency: 'critical',
      status: 'escalated',
      escalationLevel: 2,
      officerEmail: 'officer3@demo.com',
      citizenEmail: 'citizen2@demo.com',
      daysAgo: 4,
      hoursOverdue: 30,
      desc: 'Major 12-inch water distribution line ruptured. Clean drinking water flooding the entire roadway.',
      addr: 'Station Road, Opp Central Bank',
      traffic: true,
      safety: true,
    },
    // 3. Sewage overflow (Escalated L3 - Critical Failure)
    {
      type: 'sewage_overflow',
      dept: 'sanitation',
      zone: 'zone_2',
      sev: 8,
      urgency: 'critical',
      status: 'escalated',
      escalationLevel: 3,
      officerEmail: 'officer7@demo.com',
      citizenEmail: 'citizen3@demo.com',
      daysAgo: 6,
      hoursOverdue: 55,
      desc: 'Raw sewage backflow from underground sewer chamber overflowing into market storefronts.',
      addr: 'Gandhi Market, Lane 4',
      traffic: true,
      safety: true,
    },
    // 4. Large pothole on arterial road (In Progress)
    {
      type: 'pothole',
      dept: 'public_works',
      zone: 'zone_1',
      sev: 6,
      urgency: 'high',
      status: 'in_progress',
      officerEmail: 'officer1@demo.com',
      citizenEmail: 'citizen1@demo.com',
      daysAgo: 1,
      remainingHours: 48,
      desc: 'Deep 15cm pothole in fast lane causing sudden vehicular braking and two-wheeler skids.',
      addr: 'Ring Road, Sector 3 Junction',
      traffic: true,
      safety: true,
    },
    // 5. Overflowing garbage dumpster (Resolved Early)
    {
      type: 'garbage_dump',
      dept: 'sanitation',
      zone: 'zone_3',
      sev: 5,
      urgency: 'medium',
      status: 'resolved',
      verificationState: 'verified',
      officerEmail: 'officer8@demo.com',
      citizenEmail: 'citizen2@demo.com',
      daysAgo: 5,
      resolvedDaysAgo: 4,
      desc: 'Municipal garbage bin overflowing across sidewalk with stray cattle gathering.',
      addr: 'Nehru Colony, Gate 2',
      traffic: false,
      safety: false,
      rating: 5,
    },
    // 6. Broken streetlight cluster (Assigned)
    {
      type: 'broken_streetlight',
      dept: 'electrical',
      zone: 'zone_2',
      sev: 4,
      urgency: 'medium',
      status: 'assigned',
      officerEmail: 'officer6@demo.com',
      citizenEmail: 'citizen3@demo.com',
      daysAgo: 2,
      remainingHours: 96,
      desc: 'Sequence of four sodium-vapor street lamps dark along public park perimeter.',
      addr: 'Park View Road, Lake Circle',
      traffic: false,
      safety: true,
    },
    // 7. Unassigned Report (Awaiting Dispatch)
    {
      type: 'fallen_tree',
      dept: 'environment',
      zone: 'zone_1',
      sev: 7,
      urgency: 'high',
      status: 'submitted',
      citizenEmail: 'citizen1@demo.com',
      daysAgo: 0.5,
      desc: 'Banyan tree branch snapped and resting across dual-lane carriageway.',
      addr: 'Civil Lines, Near Circuit House',
      traffic: true,
      safety: true,
    },
    // 8. Verified pothole fix (Resolved Fast)
    {
      type: 'pothole',
      dept: 'public_works',
      zone: 'zone_2',
      sev: 7,
      urgency: 'high',
      status: 'resolved',
      verificationState: 'verified',
      officerEmail: 'officer2@demo.com',
      citizenEmail: 'citizen2@demo.com',
      daysAgo: 8,
      resolvedDaysAgo: 7,
      desc: 'Asphalt crumbling at bus shelter entrance.',
      addr: 'Model Town Main Street',
      traffic: true,
      safety: true,
      rating: 5,
    },
    // 9. Road cave-in / drainage collapse (In Progress)
    {
      type: 'road_damage',
      dept: 'public_works',
      zone: 'zone_1',
      sev: 8,
      urgency: 'critical',
      status: 'in_progress',
      officerEmail: 'officer1@demo.com',
      citizenEmail: 'citizen3@demo.com',
      daysAgo: 0.8,
      remainingHours: 12,
      desc: 'Storm drain slab collapsed under vehicle weight, leaving 1-meter sinkhole.',
      addr: 'Kasturba Road, Corner Plot',
      traffic: true,
      safety: true,
    },
    // 10. Verification Queue Item (Awaiting Admin Review)
    {
      type: 'water_leak',
      dept: 'water_board',
      zone: 'zone_3',
      sev: 6,
      urgency: 'high',
      status: 'in_progress',
      verificationState: 'awaiting_admin',
      officerEmail: 'officer4@demo.com',
      citizenEmail: 'citizen1@demo.com',
      daysAgo: 3,
      desc: 'Valve chamber leaking fresh water onto pavement continuously.',
      addr: 'Industrial Area Phase 2',
      traffic: false,
      safety: false,
      hasProof: true,
    },
  ];

  // Fill up to 25 with distributed variety
  const reports = [];
  const totalReportsCount = 25;

  for (let i = 0; i < totalReportsCount; i++) {
    const preset = presets[i % presets.length];
    const offsetLat = (Math.sin(i * 1.7) * 0.035);
    const offsetLng = (Math.cos(i * 2.3) * 0.035);

    const lat = baseLat + offsetLat;
    const lng = baseLng + offsetLng;

    const assignedOfficer = preset.officerEmail ? officerMap[preset.officerEmail] : null;
    const citizen = preset.citizenEmail ? citizenMap[preset.citizenEmail] : null;

    const daysAgo = (preset.daysAgo ?? (i * 1.2)) + 0.1;
    const createdDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    let deadlineDate = null;
    if (preset.urgency === 'critical') {
      deadlineDate = new Date(createdDate.getTime() + 24 * 60 * 60 * 1000);
    } else if (preset.urgency === 'high') {
      deadlineDate = new Date(createdDate.getTime() + 72 * 60 * 60 * 1000);
    } else {
      deadlineDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    let resolvedDate = null;
    if (preset.status === 'resolved') {
      resolvedDate = new Date(now - (preset.resolvedDaysAgo || 1) * 24 * 60 * 60 * 1000);
    }

    const type = preset.type || ISSUE_TYPES[i % ISSUE_TYPES.length];
    const beforePhoto = generatePlaceholderImage(type.replace(/_/g, ' '), false);
    const proofPhoto = (preset.status === 'resolved' || preset.hasProof)
      ? generatePlaceholderImage(type.replace(/_/g, ' '), true)
      : null;

    reports.push({
      citizenId: citizen?.uid || 'citizen_demo',
      citizenName: citizen?.name || 'Citizen Reporter',
      imageData: beforePhoto,
      imageHash: `hash_${i}_${Date.now().toString(16)}`,
      location: {
        lat,
        lng,
        address: `${preset.addr || `Sector ${i + 1}, Civic Area`}, City Zone`,
      },
      aiClassification: type,
      aiSeverity: preset.sev || 5,
      aiUrgency: preset.urgency || 'medium',
      aiDescription: preset.desc || `Reported ${type.replace(/_/g, ' ')} issue identified in public area.`,
      aiEstimatedFixDays: preset.urgency === 'critical' ? 1 : 4,
      safetyRisk: Boolean(preset.safety),
      affectsTraffic: Boolean(preset.traffic),
      voiceNote: i % 3 === 0 ? 'Urgent attention required near public footpath.' : '',
      status: preset.status || 'assigned',
      department: preset.dept || DEPARTMENTS[i % DEPARTMENTS.length],
      zone: preset.zone || 'zone_1',
      assignedOfficerId: assignedOfficer?.uid || null,
      assignedOfficerName: assignedOfficer?.name || null,
      deadline: deadlineDate,
      createdAt: createdDate,
      updatedAt: createdDate,
      resolvedAt: resolvedDate,
      upvotes: (i * 3) % 17,
      upvotedBy: [],
      escalationLevel: preset.escalationLevel || 0,
      duplicateOf: null,
      resolution: {
        proofData: proofPhoto,
        proofHash: proofPhoto ? `proof_hash_${i}` : null,
        proofLocation: proofPhoto ? { lat: lat + 0.0001, lng: lng + 0.0001 } : null,
        submittedAt: proofPhoto ? resolvedDate || createdDate : null,
        aiResult: proofPhoto
          ? {
              same_location: true,
              issue_resolved: true,
              confidence: 88,
              explanation: 'Gemini visual check confirms defect repaired and site restored.',
              red_flags: preset.verificationState === 'awaiting_admin' ? ['anti_cheat_gps_distance_120m'] : [],
            }
          : null,
        verificationState: preset.verificationState || (preset.status === 'resolved' ? 'verified' : 'none'),
        adminNote: preset.verificationState === 'awaiting_admin' ? 'GPS distance flag triggered (>100m)' : null,
      },
      citizenFeedback: preset.rating
        ? {
            resolved: true,
            rating: preset.rating,
            comment: 'Prompt repair by municipal field crew.',
            at: resolvedDate,
          }
        : { resolved: null, rating: null, at: null },
      flags: {
        penalizedMissedDeadline: preset.escalationLevel > 0,
        penalizedMissedCritical: preset.escalationLevel > 0 && preset.urgency === 'critical',
        penalizedNoUpdate: false,
        resolutionRatingApplied: preset.status === 'resolved',
      },
    });
  }

  return reports;
}
