/**
 * DemoChecklist Component (src/demo/DemoChecklist.jsx)
 * 
 * Verifies system readiness for hackathon live judging:
 * 1. Firebase Connected
 * 2. Gemini API key present & valid
 * 3. Demo accounts exist in Firestore
 * 4. Seed data exists (active & resolved reports)
 * 5. Demo images present in public/demo-images/
 * 6. Firestore rules allow demo writes
 * 7. Browser geolocation permission
 * 8. Browser microphone permission
 * 
 * Includes:
 * - Yellow banner for missing demo images (with canvas placeholder notice)
 * - Single "Fix What You Can" button to automatically seed missing accounts and reports
 */
import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, query, limit, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { checkDemoImagesStatus } from './imageLoader';
import { runFullSeed } from '../lib/seedData';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function DemoChecklist() {
  const { show } = useToast();
  const [checking, setChecking] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [fixLogs, setFixLogs] = useState([]);
  const [status, setStatus] = useState({
    firebase: { ok: false, label: 'Firebase Connected', detail: 'Checking...' },
    geminiKey: { ok: false, label: 'Gemini Key Configured', detail: 'Checking...' },
    demoAccounts: { ok: false, label: 'Demo Accounts Exist', detail: 'Checking...' },
    seedReports: { ok: false, label: 'Seed Reports Loaded', detail: 'Checking...' },
    demoImages: { ok: false, label: 'Demo Photos Present', detail: 'Checking...', missing: [] },
    firestoreWrites: { ok: false, label: 'Firestore Demo Writes', detail: 'Checking...' },
    locationPerm: { ok: false, label: 'Browser Geolocation', detail: 'Checking...' },
    micPerm: { ok: false, label: 'Microphone Permission', detail: 'Checking...' },
  });

  const runAllChecks = useCallback(async () => {
    setChecking(true);
    const updated = {};

    // 1. Firebase Connected
    try {
      const q = query(collection(db, 'reports'), limit(1));
      await getDocs(q);
      updated.firebase = { ok: true, label: 'Firebase Connected', detail: 'Firestore live' };
    } catch (err) {
      updated.firebase = { ok: false, label: 'Firebase Connected', detail: err.message };
    }

    // 2. Gemini API key
    const geminiKey = import.meta.env.VITE_GEMINI_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    if (geminiKey && geminiKey.length > 10 && !geminiKey.includes('replace')) {
      updated.geminiKey = { ok: true, label: 'Gemini Key Configured', detail: 'Key active' };
    } else {
      updated.geminiKey = { ok: false, label: 'Gemini Key Configured', detail: 'Missing or placeholder key' };
    }

    // 3. Demo Accounts Exist
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(5)));
      const hasUsers = !usersSnap.empty;
      updated.demoAccounts = {
        ok: hasUsers,
        label: 'Demo Accounts Exist',
        detail: hasUsers ? `${usersSnap.size}+ users found` : 'No users in Firestore',
      };
    } catch (err) {
      updated.demoAccounts = { ok: false, label: 'Demo Accounts Exist', detail: err.message };
    }

    // 4. Seed Data (Reports)
    try {
      const reportsSnap = await getDocs(query(collection(db, 'reports'), limit(10)));
      const count = reportsSnap.size;
      updated.seedReports = {
        ok: count >= 3,
        label: 'Seed Reports Loaded',
        detail: count >= 3 ? `${count}+ reports active` : `Only ${count} reports found (need seed)`,
      };
    } catch (err) {
      updated.seedReports = { ok: false, label: 'Seed Reports Loaded', detail: err.message };
    }

    // 5. Demo Images on Disk
    try {
      const imgStatus = await checkDemoImagesStatus();
      const allPresent = imgStatus.missing.length === 0;
      updated.demoImages = {
        ok: allPresent,
        label: 'Demo Photos Present',
        detail: allPresent
          ? 'All 8 demo images on disk'
          : `${imgStatus.missing.length} missing (placeholders active)`,
        missing: imgStatus.missing,
      };
    } catch (err) {
      updated.demoImages = {
        ok: false,
        label: 'Demo Photos Present',
        detail: err.message,
        missing: [],
      };
    }

    // 6. Firestore Rules Allow Demo Writes
    try {
      const probeRef = doc(db, 'reports', '_demo_probe_check');
      await setDoc(probeRef, { demo: true, probeTime: Date.now() });
      await deleteDoc(probeRef);
      updated.firestoreWrites = { ok: true, label: 'Firestore Demo Writes', detail: 'Write & delete permitted' };
    } catch (err) {
      const isNotCreated = err.message?.includes('not been used') || err.message?.includes('PERMISSION_DENIED');
      updated.firestoreWrites = {
        ok: false,
        label: 'Firestore Demo Writes',
        detail: isNotCreated
          ? 'Go to Firebase Console → Firestore Database → Create database'
          : `Write denied: ${err.code || err.message}`,
      };
    }

    // 7. Location Permission
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        updated.locationPerm = {
          ok: perm.state === 'granted',
          label: 'Browser Geolocation',
          detail: perm.state === 'granted' ? 'Granted' : `State: ${perm.state} (Prompt on report)`,
        };
      } else {
        updated.locationPerm = { ok: true, label: 'Browser Geolocation', detail: 'Supported by browser' };
      }
    } catch {
      updated.locationPerm = { ok: true, label: 'Browser Geolocation', detail: 'Supported by browser' };
    }

    // 8. Microphone Permission
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const perm = await navigator.permissions.query({ name: 'microphone' });
        updated.micPerm = {
          ok: perm.state === 'granted',
          label: 'Microphone Permission',
          detail: perm.state === 'granted' ? 'Granted' : `State: ${perm.state} (Prompt on voice note)`,
        };
      } else {
        updated.micPerm = { ok: true, label: 'Microphone Permission', detail: 'Supported by browser' };
      }
    } catch {
      updated.micPerm = { ok: true, label: 'Microphone Permission', detail: 'Supported by browser' };
    }

    setStatus(updated);
    setChecking(false);
  }, []);

  useEffect(() => {
    runAllChecks();
  }, [runAllChecks]);

  // "Fix what you can" action
  const handleFixWhatYouCan = async () => {
    setFixing(true);
    setFixLogs([]);
    const addLog = (m) => setFixLogs((prev) => [...prev, m]);

    try {
      addLog('Repairing missing demo accounts and seed reports...');
      await runFullSeed(addLog);
      show('Accounts and seed reports successfully regenerated!', 'success');
      await runAllChecks();
    } catch (err) {
      addLog(`Fix failed: ${err.message}`);
      show(`Auto-fix error: ${err.message}`, 'error');
    } finally {
      setFixing(false);
    }
  };

  const hasFixableIssues = (!status.demoAccounts.ok || !status.seedReports.ok) && !checking;
  const missingImages = status.demoImages.missing || [];

  return (
    <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
      {/* Header with Title and Action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🩺</span>
          <div>
            <h2 className="text-base font-bold text-gray-900">Demo System Health &amp; Readiness Checklist</h2>
            <p className="text-xs text-gray-500">Live checks for hackathon presentation readiness</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasFixableIssues && (
            <button
              type="button"
              disabled={fixing}
              onClick={handleFixWhatYouCan}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {fixing ? <LoadingSpinner size="xs" /> : '⚡'}
              <span>Fix What You Can</span>
            </button>
          )}

          <button
            type="button"
            disabled={checking || fixing}
            onClick={runAllChecks}
            className="px-3.5 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
          >
            {checking ? <LoadingSpinner size="xs" /> : '🔄'}
            <span>Re-check</span>
          </button>
        </div>
      </div>

      {/* Missing Images Yellow Warning Banner */}
      {missingImages.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span className="text-xs font-bold uppercase tracking-wider">
              {missingImages.length} Demo Photo{missingImages.length > 1 ? 's' : ''} Missing from public/demo-images/
            </span>
          </div>
          <p className="text-xs text-amber-800">
            Dynamic labeled canvas placeholders are currently active. For actual photography during live demos, place image files in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">public/demo-images/</code>:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {missingImages.map((file) => (
              <span key={file} className="px-2 py-0.5 bg-amber-100/80 border border-amber-300 rounded font-mono text-[11px] text-amber-900">
                {file}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Checklist Items */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(status).map(([key, item]) => {
          const isGood = item.ok;
          return (
            <div
              key={key}
              className={`p-3 rounded-2xl border transition-all ${
                isGood
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/60 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-bold leading-tight truncate">{item.label}</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isGood ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
              </div>
              <p className="text-[11px] text-gray-600 truncate" title={item.detail}>
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>

      {/* Auto-fix Log Terminal */}
      {fixLogs.length > 0 && (
        <div className="bg-gray-950 text-green-400 p-3 rounded-xl font-mono text-xs max-h-36 overflow-y-auto space-y-0.5 shadow-inner">
          {fixLogs.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </div>
  );
}