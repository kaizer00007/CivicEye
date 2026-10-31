/**
 * SeedPage — Demo Account & Data Generator (/seed).
 * Protected by VITE_SEED_ENABLED === "true".
 * 
 * Uses a SECONDARY Firebase App instance so the current user's login session
 * is NEVER disrupted or overwritten. Performs authenticated writes using the secondary app.
 * 
 * Creates:
 * - 1 Admin (admin@demo.com)
 * - 8 Officers across 4 depts & 3 zones (officer1@demo.com - officer8@demo.com)
 * - 3 Citizens (citizen1@demo.com - citizen3@demo.com)
 * - 25 realistic civic issue reports with varied urgency, deadlines, photos, and ratings
 * 
 * Fully idempotent (skips accounts that already exist) with 1-click Reset Demo Data.
 */
import { useState } from 'react';
import { getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { DEMO_USERS, DEMO_PASSWORD, getSecondaryApp, runFullSeed } from '../lib/seedData';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SeedPage() {
  const { show } = useToast();
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // ── 1. Run Idempotent Seeding ──
  const handleSeedData = async () => {
    setSeeding(true);
    setLogs([]);
    addLog('Starting CivicEye demo seed routine...');

    try {
      const { createdReportsCount } = await runFullSeed(addLog);
      addLog(`✓ Successfully seeded ${createdReportsCount} reports with active, resolved & escalated tickets!`);
      show('Demo data seeding completed successfully! All systems live.', 'success', 6000);
    } catch (err) {
      console.error('Seed error:', err);
      addLog(`FATAL ERROR: ${err.message}`);
      show(`Seed error: ${err.message}`, 'error');
    } finally {
      setSeeding(false);
    }
  };

  // ── 2. Reset Demo Data ──
  const handleResetData = async () => {
    if (!window.confirm('Reset all demo reports and ratings log? Existing user accounts will be kept.')) return;

    setResetting(true);
    setLogs([]);
    addLog('Resetting demo reports and logs...');

    try {
      const secondaryApp = getSecondaryApp();
      const secDb = getFirestore(secondaryApp);

      // Delete reports
      const reportsSnap = await getDocs(collection(secDb, 'reports'));
      let delCount = 0;
      for (const d of reportsSnap.docs) {
        await deleteDoc(d.ref);
        delCount++;
      }
      addLog(`✓ Cleared ${delCount} reports.`);

      // Delete ratings log
      const logSnap = await getDocs(collection(secDb, 'ratings_log'));
      let logDel = 0;
      for (const d of logSnap.docs) {
        await deleteDoc(d.ref);
        logDel++;
      }
      addLog(`✓ Cleared ${logDel} rating logs.`);

      show('Demo data reset! Reports and rating logs cleared.', 'info');
    } catch (err) {
      console.error('Reset error:', err);
      addLog(`Reset error: ${err.message}`);
      show(`Reset error: ${err.message}`, 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <span>🌱</span> CivicEye Demo Seeding Tool
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Populates realistic municipal accounts, tickets, timelines, and ratings for a complete hackathon demo.
        </p>
      </div>

      {/* Action Card */}
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Demo Data Generator</h2>
            <p className="text-xs text-gray-500 max-w-xl">
              Creates 1 Admin, 8 Officers, 3 Citizens, and 25 realistic reports spanning the last 30 days around your default city coordinates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={seeding || resetting}
              onClick={handleResetData}
              className="px-5 py-3 border border-red-300 text-red-700 hover:bg-red-50 rounded-2xl text-xs font-bold transition disabled:opacity-50"
            >
              {resetting ? 'Resetting...' : 'Reset Demo Reports'}
            </button>

            <button
              type="button"
              disabled={seeding || resetting}
              onClick={handleSeedData}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl text-xs font-extrabold uppercase tracking-wider shadow-lg hover:shadow-xl transition transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {seeding ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Seeding Accounts &amp; Reports...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Seed All Demo Data</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Terminal / Execution Log */}
        {logs.length > 0 && (
          <div className="bg-gray-950 rounded-2xl p-4 font-mono text-xs text-green-400 space-y-1 max-h-60 overflow-y-auto shadow-inner border border-gray-800">
            {logs.map((log, index) => (
              <p key={index}>{log}</p>
            ))}
          </div>
        )}
      </div>

      {/* Credentials Quick Reference Table */}
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span>🔑</span> Demo Accounts Reference
          </h2>
          <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200 font-mono">
            Password: {DEMO_PASSWORD}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Admin */}
          <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 space-y-2">
            <span className="text-xs font-extrabold uppercase text-red-800 flex items-center gap-1.5">
              <span>⚙️</span> Admin Account
            </span>
            <p className="text-xs font-bold text-gray-900">admin@demo.com</p>
            <p className="text-[11px] text-gray-500">
              Full oversight, manual officer reassignment, verification approval queue, and overdue audit triggers.
            </p>
          </div>

          {/* Officers */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
            <span className="text-xs font-extrabold uppercase text-blue-800 flex items-center gap-1.5">
              <span>🛠️</span> 8 Field Officers
            </span>
            <p className="text-xs font-bold text-gray-900">officer1@demo.com &ndash; officer8@demo.com</p>
            <p className="text-[11px] text-gray-500">
              Roads, Water Board, Electrical, and Sanitation teams across Zones 1, 2, and 3. Includes high-performing and flagged profiles.
            </p>
          </div>

          {/* Citizens */}
          <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
            <span className="text-xs font-extrabold uppercase text-purple-800 flex items-center gap-1.5">
              <span>👥</span> 3 Citizens
            </span>
            <p className="text-xs font-bold text-gray-900">citizen1@demo.com &ndash; citizen3@demo.com</p>
            <p className="text-[11px] text-gray-500">
              Citizens with submitted issues, interactive resolution review banners, and star rating feedback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
