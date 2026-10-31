/**
 * Demo Data Fallback Store (src/lib/demoDataFallback.js)
 * 
 * Provides an immediate, resilient offline/in-memory data layer populated with
 * all 25 realistic reports and 12 demo accounts (1 Admin, 8 Officers, 3 Citizens).
 * 
 * Ensures that if Firebase Cloud Firestore has not yet been enabled in the user's
 * Firebase console (PERMISSION_DENIED) or during connectivity drops, the application
 * ALWAYS shows rich, populated data on the Map, Public Dashboard, Officer Dashboard,
 * Admin Panel, and Demo Mode.
 */
import { DEFAULT_CENTER } from '../config';
import { DEMO_USERS, generateDemoReports } from './seedData';

// Map of mock officer UIDs
const officerMap = {};
const citizenMap = {};

DEMO_USERS.forEach((u, idx) => {
  const uid = `demo_uid_${idx}_${u.role}`;
  if (u.role === 'officer') {
    officerMap[u.email] = { uid, ...u };
  } else if (u.role === 'citizen') {
    citizenMap[u.email] = { uid, ...u };
  }
});

// Generate 25 pre-populated reports with consistent IDs
let cachedFallbackReports = null;

export function getFallbackReports() {
  if (cachedFallbackReports) return cachedFallbackReports;

  const rawReports = generateDemoReports(officerMap, citizenMap);
  cachedFallbackReports = rawReports.map((r, i) => ({
    id: `report_demo_${i + 1}`,
    ...r,
    createdAt: { toDate: () => r.createdAt, toMillis: () => r.createdAt.getTime() },
    updatedAt: { toDate: () => r.updatedAt, toMillis: () => r.updatedAt.getTime() },
    deadline: r.deadline ? { toDate: () => r.deadline, toMillis: () => r.deadline.getTime() } : null,
    resolvedAt: r.resolvedAt ? { toDate: () => r.resolvedAt, toMillis: () => r.resolvedAt.getTime() } : null,
  }));

  return cachedFallbackReports;
}

export function getFallbackOfficers() {
  return DEMO_USERS.filter((u) => u.role === 'officer').map((u, i) => ({
    uid: `demo_officer_${i + 1}`,
    ...u,
  }));
}

export function getFallbackUsers() {
  return DEMO_USERS.map((u, i) => ({
    uid: `demo_user_${i + 1}`,
    ...u,
  }));
}
