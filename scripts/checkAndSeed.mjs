import { initializeApp } from 'firebase/app';
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
  getDocs,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Parse .env
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = m[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[m[1]] = val;
  }
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

console.log('Connecting to Firebase project:', firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEMO_PASSWORD = 'Demo@1234';

const DEMO_USERS = [
  { email: 'admin@demo.com', name: 'Municipal Commissioner', role: 'admin', department: '', zone: '' },
  { email: 'officer1@demo.com', name: 'Rajesh Kumar (Roads Lead)', role: 'officer', department: 'public_works', zone: 'zone_1', rating: 4.8, streakCount: 6, totalResolved: 24, activeIssues: 2 },
  { email: 'officer2@demo.com', name: 'Anita Sharma (Pavement Inspector)', role: 'officer', department: 'public_works', zone: 'zone_2', rating: 4.2, streakCount: 2, totalResolved: 15, activeIssues: 3 },
  { email: 'officer3@demo.com', name: 'Vikram Singh (Water Supply)', role: 'officer', department: 'water_board', zone: 'zone_1', rating: 4.6, streakCount: 4, totalResolved: 19, activeIssues: 1 },
  { email: 'officer4@demo.com', name: 'Pooja Patel (Drainage Engineer)', role: 'officer', department: 'water_board', zone: 'zone_3', rating: 3.8, streakCount: 1, totalResolved: 11, activeIssues: 4 },
  { email: 'officer5@demo.com', name: 'Suresh Menon (Grid Supervisor)', role: 'officer', department: 'electrical', zone: 'zone_1', rating: 4.9, streakCount: 8, totalResolved: 31, activeIssues: 1 },
  { email: 'officer6@demo.com', name: 'Kavita Reddy (Lighting Ops)', role: 'officer', department: 'electrical', zone: 'zone_2', rating: 2.8, flagged: true, streakCount: 0, totalResolved: 8, activeIssues: 5 },
  { email: 'officer7@demo.com', name: 'Manoj Joshi (Sanitation Chief)', role: 'officer', department: 'sanitation', zone: 'zone_2', rating: 4.4, streakCount: 3, totalResolved: 22, activeIssues: 2 },
  { email: 'officer8@demo.com', name: 'Deepa Nair (Waste Management)', role: 'officer', department: 'sanitation', zone: 'zone_3', rating: 2.3, flagged: true, restrictedFromCritical: true, streakCount: 0, totalResolved: 6, activeIssues: 6 },
  { email: 'citizen1@demo.com', name: 'Aarav Mehta', role: 'citizen', phone: '+91 98765 43210' },
  { email: 'citizen2@demo.com', name: 'Priya Iyer', role: 'citizen', phone: '+91 98765 43211' },
  { email: 'citizen3@demo.com', name: 'Rohan Gupta', role: 'citizen', phone: '+91 98765 43212' },
];

function generatePlaceholderSvg(label, isFixed = false) {
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

async function seed() {
  console.log('--- Checking existing Firestore data ---');
  const repSnap = await getDocs(collection(db, 'reports'));
  console.log(`Found ${repSnap.size} reports currently in Firestore.`);

  const officerMap = {};
  const citizenMap = {};

  console.log('--- Provisioning Demo Users ---');
  for (const spec of DEMO_USERS) {
    let uid = null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, spec.email, DEMO_PASSWORD);
      uid = cred.user.uid;
      console.log(`Created auth account: ${spec.email}`);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, spec.email, DEMO_PASSWORD);
        uid = cred.user.uid;
        console.log(`Signed in existing account: ${spec.email}`);
      } else {
        console.error(`Auth error for ${spec.email}:`, err.message);
        continue;
      }
    }

    const profile = {
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

    await setDoc(doc(db, 'users', uid), profile, { merge: true });

    if (spec.role === 'officer') {
      officerMap[spec.email] = { uid, name: spec.name, ...spec };
    } else if (spec.role === 'citizen') {
      citizenMap[spec.email] = { uid, name: spec.name, ...spec };
    }

    await signOut(auth);
  }

  if (repSnap.size >= 15) {
    console.log('Reports already exist (>= 15). Skipping report re-generation.');
    process.exit(0);
  }

  console.log('--- Seeding 25 Realistic Civic Reports ---');
  const baseLat = 12.9716; // Bangalore center
  const baseLng = 77.5946;
  const now = Date.now();

  const presets = [
    { type: 'electrical_hazard', dept: 'electrical', zone: 'zone_1', sev: 9, urgency: 'critical', status: 'escalated', escalationLevel: 1, officerEmail: 'officer5@demo.com', citizenEmail: 'citizen1@demo.com', daysAgo: 2, desc: 'Exposed live wiring hanging loose from junction box near pedestrian crossing.', addr: 'MG Road, near Metro Pillar 142', traffic: true, safety: true },
    { type: 'water_leak', dept: 'water_board', zone: 'zone_1', sev: 8, urgency: 'critical', status: 'escalated', escalationLevel: 2, officerEmail: 'officer3@demo.com', citizenEmail: 'citizen2@demo.com', daysAgo: 4, desc: 'Major 12-inch water distribution line ruptured. Clean drinking water flooding roadway.', addr: 'Station Road, Opp Central Bank', traffic: true, safety: true },
    { type: 'sewage_overflow', dept: 'sanitation', zone: 'zone_2', sev: 8, urgency: 'critical', status: 'escalated', escalationLevel: 3, officerEmail: 'officer7@demo.com', citizenEmail: 'citizen3@demo.com', daysAgo: 6, desc: 'Raw sewage backflow overflowing into market storefronts.', addr: 'Gandhi Market, Lane 4', traffic: true, safety: true },
    { type: 'pothole', dept: 'public_works', zone: 'zone_1', sev: 6, urgency: 'high', status: 'in_progress', officerEmail: 'officer1@demo.com', citizenEmail: 'citizen1@demo.com', daysAgo: 1, desc: 'Deep 15cm pothole in fast lane causing vehicular braking and two-wheeler skids.', addr: 'Ring Road, Sector 3 Junction', traffic: true, safety: true },
    { type: 'garbage_dump', dept: 'sanitation', zone: 'zone_3', sev: 5, urgency: 'medium', status: 'resolved', officerEmail: 'officer8@demo.com', citizenEmail: 'citizen2@demo.com', daysAgo: 5, resolvedDaysAgo: 4, desc: 'Municipal garbage bin overflowing across sidewalk.', addr: 'Nehru Colony, Gate 2', traffic: false, safety: false, rating: 5 },
    { type: 'broken_streetlight', dept: 'electrical', zone: 'zone_2', sev: 4, urgency: 'medium', status: 'assigned', officerEmail: 'officer6@demo.com', citizenEmail: 'citizen3@demo.com', daysAgo: 2, desc: 'Sequence of four sodium-vapor street lamps dark along public park perimeter.', addr: 'Park View Road, Lake Circle', traffic: false, safety: true },
    { type: 'fallen_tree', dept: 'environment', zone: 'zone_1', sev: 7, urgency: 'high', status: 'submitted', citizenEmail: 'citizen1@demo.com', daysAgo: 0.5, desc: 'Banyan tree branch snapped and resting across dual-lane carriageway.', addr: 'Civil Lines, Near Circuit House', traffic: true, safety: true },
    { type: 'pothole', dept: 'public_works', zone: 'zone_2', sev: 7, urgency: 'high', status: 'resolved', officerEmail: 'officer2@demo.com', citizenEmail: 'citizen2@demo.com', daysAgo: 8, resolvedDaysAgo: 7, desc: 'Asphalt crumbling at bus shelter entrance.', addr: 'Model Town Main Street', traffic: true, safety: true, rating: 5 },
  ];

  for (let i = 0; i < 25; i++) {
    const p = presets[i % presets.length];
    const offsetLat = Math.sin(i * 1.7) * 0.035;
    const offsetLng = Math.cos(i * 2.3) * 0.035;
    const lat = baseLat + offsetLat;
    const lng = baseLng + offsetLng;

    const assignedOfficer = p.officerEmail ? officerMap[p.officerEmail] : null;
    const citizen = p.citizenEmail ? citizenMap[p.citizenEmail] : null;

    const daysAgo = (p.daysAgo || i * 1.2) + 0.1;
    const createdDate = new Date(now - daysAgo * 24 * 3600 * 1000);
    const deadlineDate = new Date(createdDate.getTime() + (p.urgency === 'critical' ? 24 : 72) * 3600 * 1000);
    const resolvedDate = p.status === 'resolved' ? new Date(now - (p.resolvedDaysAgo || 1) * 24 * 3600 * 1000) : null;

    const beforePhoto = generatePlaceholderSvg(p.type, false);
    const proofPhoto = p.status === 'resolved' ? generatePlaceholderSvg(p.type, true) : null;

    const docData = {
      citizenId: citizen?.uid || 'citizen_demo',
      citizenName: citizen?.name || 'Citizen Reporter',
      imageData: beforePhoto,
      imageHash: `hash_${i}_${Date.now().toString(16)}`,
      location: {
        lat,
        lng,
        address: `${p.addr || `Sector ${i + 1}, Civic Area`}, Bangalore`,
      },
      aiClassification: p.type,
      aiSeverity: p.sev,
      aiUrgency: p.urgency,
      aiDescription: p.desc,
      aiEstimatedFixDays: p.urgency === 'critical' ? 1 : 4,
      safetyRisk: Boolean(p.safety),
      affectsTraffic: Boolean(p.traffic),
      voiceNote: i % 3 === 0 ? 'Urgent attention required near public footpath.' : '',
      status: p.status,
      department: p.dept,
      zone: p.zone,
      assignedOfficerId: assignedOfficer?.uid || null,
      assignedOfficerName: assignedOfficer?.name || null,
      deadline: Timestamp.fromDate(deadlineDate),
      createdAt: Timestamp.fromDate(createdDate),
      updatedAt: Timestamp.fromDate(createdDate),
      resolvedAt: resolvedDate ? Timestamp.fromDate(resolvedDate) : null,
      upvotes: (i * 3) % 17,
      upvotedBy: [],
      escalationLevel: p.escalationLevel || 0,
      duplicateOf: null,
      resolution: {
        proofData: proofPhoto,
        proofHash: proofPhoto ? `proof_hash_${i}` : null,
        proofLocation: proofPhoto ? { lat: lat + 0.0001, lng: lng + 0.0001 } : null,
        submittedAt: resolvedDate ? Timestamp.fromDate(resolvedDate) : null,
        aiResult: proofPhoto
          ? {
              same_location: true,
              issue_resolved: true,
              confidence: 88,
              explanation: 'Gemini visual check confirms defect repaired and site restored.',
              red_flags: [],
            }
          : null,
        verificationState: p.status === 'resolved' ? 'verified' : 'none',
        adminNote: null,
      },
      citizenFeedback: p.rating
        ? { resolved: true, rating: p.rating, comment: 'Prompt repair by municipal field crew.', at: Timestamp.fromDate(resolvedDate) }
        : { resolved: null, rating: null, at: null },
      flags: {
        penalizedMissedDeadline: (p.escalationLevel || 0) > 0,
        penalizedMissedCritical: (p.escalationLevel || 0) > 0 && p.urgency === 'critical',
        penalizedNoUpdate: false,
        resolutionRatingApplied: p.status === 'resolved',
      },
    };

    const docRef = await addDoc(collection(db, 'reports'), docData);
    if (p.status === 'resolved' && assignedOfficer?.uid) {
      await addDoc(collection(db, 'ratings_log'), {
        officerId: assignedOfficer.uid,
        reportId: docRef.id,
        change: 0.3,
        reason: 'resolved_early',
        ratingAfter: 4.8,
        timestamp: Timestamp.fromDate(resolvedDate || createdDate),
      });
    }
  }

  console.log('✓ Successfully seeded 25 realistic reports and ratings into Firestore!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Fatal seed failure:', err);
  process.exit(1);
});
