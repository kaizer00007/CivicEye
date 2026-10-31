/**
 * DemoPage Component (/demo) — src/pages/DemoPage.jsx
 * 
 * Hackathon Live Presentation Suite for CivicEye:
 * - 8 Pre-planned live scenarios using REAL app logic
 * - Step-by-step Narrator projection panel (right)
 * - Live Leaflet map & dynamic interactive stage (left)
 * - Auto / Manual stepper with arrow key navigation
 * - Safe Mode with 8-second Gemini timeout fallback & cached badges
 * - "Record responses" button for Firestore cache persistence
 * - Presenter Mode with high-contrast UI, enlarged typography, and 4-minute timer
 * - 4-Minute Demo Playlist running Scenarios 1, 2, 4, 6, 8 sequentially
 * - Impact Snapshot with mandatory "Sample data from demo" disclaimer
 * - Demo Checklist with "Fix what you can" auto-seed
 * - Demo Accounts Bar with 1-click role logins
 * - Keyboard shortcuts: Right arrow, Left arrow, R, S, P, Esc, ?
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  SCENARIO_DEFINITIONS,
  resetScenarioData,
  resetAllDemoScenarios,
} from '../demo/scenarioEngine';
import {
  loadDemoCacheFromFirestore,
  recordAllDemoResponses,
} from '../demo/safeMode';
import DemoChecklist from '../demo/DemoChecklist';
import DemoAccountsBar from '../demo/DemoAccountsBar';
import ImpactSnapshot from '../demo/ImpactSnapshot';
import NarratorPanel from '../demo/NarratorPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import { getFallbackReports } from '../lib/demoDataFallback';
import { DEFAULT_CENTER, DEFAULT_ZOOM, URGENCY_COLORS } from '../config';

// Playlist of scenarios for the 4-minute pitch: 1, 2, 4, 6, 8
const PLAYLIST_SCENARIO_IDS = ['scenario_1', 'scenario_2', 'scenario_4', 'scenario_6', 'scenario_8'];

function MapCenterController({ center, zoom = 14 }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function DemoPage() {
  const { user } = useAuth();
  const { show } = useToast();

  // Mode States
  const [safeMode, setSafeMode] = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);
  const [isAuto, setIsAuto] = useState(true);
  const [stepDelay, setStepDelay] = useState(2000);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [recordingCache, setRecordingCache] = useState(false);
  const [recordingLogs, setRecordingLogs] = useState([]);

  // 4-Minute Presentation Timer
  const [timerSeconds, setTimerSeconds] = useState(240); // 4:00
  const [timerRunning, setTimerRunning] = useState(false);

  // Active Scenario State
  const [activeScenarioId, setActiveScenarioId] = useState('scenario_1');
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [stepStates, setStepStates] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [scenarioContext, setScenarioContext] = useState({});

  // Playlist State
  const [playlistActive, setPlaylistActive] = useState(false);
  const [playlistIndex, setPlaylistIndex] = useState(0);

  // Live Map State
  const [mapReports, setMapReports] = useState([]);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [explorerCircle, setExplorerCircle] = useState(null);

  const activeScenario = SCENARIO_DEFINITIONS.find((s) => s.id === activeScenarioId) || SCENARIO_DEFINITIONS[0];

  // ── 1. Subscribe to Live Firestore Reports ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'reports'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMapReports(list.length > 0 ? list : getFallbackReports());
      },
      (err) => {
        console.warn('DemoPage snapshot fallback:', err.message);
        setMapReports(getFallbackReports());
      }
    );
    loadDemoCacheFromFirestore();
    return () => unsub();
  }, []);

  // ── 2. Timer Tick ──
  useEffect(() => {
    let interval = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── 3. Step Execution Engine ──
  const runStep = useCallback(
    async (stepIdx, ctx) => {
      if (!activeScenario || stepIdx >= activeScenario.steps.length) return false;
      const stepDef = activeScenario.steps[stepIdx];

      setStepStates((prev) => {
        const next = [...prev];
        next[stepIdx] = { status: 'running', timestamp: Date.now() };
        return next;
      });
      setCurrentStepIndex(stepIdx);

      try {
        const emit = (update) => {
          setStepStates((prev) => {
            const next = [...prev];
            next[stepIdx] = {
              status: update.status,
              timestamp: Date.now(),
              result: {
                summary: update.message,
                status: update.data?.status,
                officerName: update.data?.officer || update.data?.assignedOfficerName,
                ratingDelta: update.data?.ratingDelta,
                ratingReason: update.data?.ratingReason,
                confidence: update.data?.confidence,
                redFlags: update.data?.red_flags,
                aiDetails: update.data,
              },
              isCached: update.isCached,
            };
            return next;
          });

          // Live map sync
          if (update.data?.circle) {
            setExplorerCircle(update.data.circle);
            setMapCenter([update.data.circle.lat, update.data.circle.lng]);
          } else if (update.data?.location?.lat) {
            setMapCenter([update.data.location.lat, update.data.location.lng]);
          }
        };

        await stepDef.run(ctx, emit);
        return true;
      } catch (err) {
        console.error(`Step ${stepIdx} error:`, err);
        setStepStates((prev) => {
          const next = [...prev];
          next[stepIdx] = { status: 'error', error: err.message, timestamp: Date.now() };
          return next;
        });
        return false;
      }
    },
    [activeScenario]
  );

  // ── 4. Full Scenario Runner ──
  const handleRunScenario = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setStepStates(activeScenario.steps.map(() => ({ status: 'pending' })));
    setCurrentStepIndex(0);

    const ctx = {
      isSafeMode: safeMode,
    };
    setScenarioContext(ctx);

    for (let i = 0; i < activeScenario.steps.length; i++) {
      setCurrentStepIndex(i);
      const ok = await runStep(i, ctx);
      if (!ok) break;

      // In Auto mode, delay between steps (unless it's the last step)
      if (isAuto && i < activeScenario.steps.length - 1) {
        await new Promise((res) => setTimeout(res, stepDelay));
      }
    }

    setIsRunning(false);
  };

  // ── 5. Stepper Controls for Manual Mode ──
  const handleNextStep = async () => {
    if (isRunning) return;
    const nextIdx = currentStepIndex + 1;
    if (nextIdx >= activeScenario.steps.length) return;

    setIsRunning(true);
    const ctx = scenarioContext.reportId ? scenarioContext : { isSafeMode: safeMode };
    setScenarioContext(ctx);
    await runStep(nextIdx, ctx);
    setIsRunning(false);
  };

  const handlePrevStep = () => {
    if (isRunning || currentStepIndex <= 0) return;
    setCurrentStepIndex((prev) => prev - 1);
  };

  // ── 6. Scenario Reset ──
  const handleResetScenario = async (scId = activeScenarioId) => {
    await resetScenarioData(scId);
    setStepStates(activeScenario.steps.map(() => ({ status: 'pending' })));
    setCurrentStepIndex(-1);
    setScenarioContext({});
    setExplorerCircle(null);
    show(`Scenario ${scId} demo tickets cleared.`, 'info');
  };

  // ── 7. Global Reset ──
  const handleResetAllDemo = async () => {
    if (!window.confirm('Clear ALL demo tickets and demo rating logs created by Demo Mode? (Non-demo reports are untouched)')) return;
    await resetAllDemoScenarios();
    setStepStates(activeScenario.steps.map(() => ({ status: 'pending' })));
    setCurrentStepIndex(-1);
    setScenarioContext({});
    setExplorerCircle(null);
    show('All demo tickets cleared.', 'success');
  };

  // ── 8. 4-Minute Playlist Runner ──
  const handleRunPlaylist = async () => {
    if (playlistActive || isRunning) return;
    setPlaylistActive(true);
    setTimerSeconds(240);
    setTimerRunning(true);
    show('Starting 4-minute presentation playlist: Scenarios 1, 2, 4, 6, 8', 'info', 4000);

    for (let p = 0; p < PLAYLIST_SCENARIO_IDS.length; p++) {
      const sId = PLAYLIST_SCENARIO_IDS[p];
      setPlaylistIndex(p);
      setActiveScenarioId(sId);

      const scObj = SCENARIO_DEFINITIONS.find((s) => s.id === sId);
      if (!scObj) continue;

      setStepStates(scObj.steps.map(() => ({ status: 'pending' })));
      setCurrentStepIndex(0);
      setIsRunning(true);

      const ctx = { isSafeMode: safeMode };
      setScenarioContext(ctx);

      for (let i = 0; i < scObj.steps.length; i++) {
        setCurrentStepIndex(i);
        const ok = await runStep(i, ctx);
        if (!ok) break;
        if (i < scObj.steps.length - 1) {
          await new Promise((res) => setTimeout(res, 1800));
        }
      }

      setIsRunning(false);
      // Pause 2s between playlist scenarios
      if (p < PLAYLIST_SCENARIO_IDS.length - 1) {
        await new Promise((res) => setTimeout(res, 2000));
      }
    }

    setPlaylistActive(false);
    show('🎉 4-minute presentation playlist complete!', 'success', 5000);
  };

  // ── 9. Record Cache Routine ──
  const handleRecordCache = async () => {
    setRecordingCache(true);
    setRecordingLogs([]);
    const addLog = (m) => setRecordingLogs((p) => [...p, m]);

    try {
      addLog('Recording Gemini responses into Firestore demo_cache...');
      await recordAllDemoResponses(addLog);
      show('Gemini responses recorded into Firestore demo_cache!', 'success');
    } catch (err) {
      addLog(`Record failed: ${err.message}`);
      show(`Cache recording error: ${err.message}`, 'error');
    } finally {
      setRecordingCache(false);
    }
  };

  // ── 10. Global Keyboard Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStep();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetScenario();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setSafeMode((prev) => {
          show(`Safe Mode ${!prev ? 'ENABLED (Cached)' : 'DISABLED (Live Gemini)'}`, 'info', 2000);
          return !prev;
        });
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setPresenterMode((prev) => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPresenterMode(false);
        setShowHelpModal(false);
      } else if (e.key === '?') {
        e.preventDefault();
        setShowHelpModal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStep, handlePrevStep, handleResetScenario, show]);

  // Sync step states array when switching scenario
  useEffect(() => {
    setStepStates(activeScenario.steps.map(() => ({ status: 'pending' })));
    setCurrentStepIndex(-1);
    setScenarioContext({});
    setExplorerCircle(null);
  }, [activeScenarioId]);

  return (
    <div
      className={`min-h-screen transition-colors ${
        presenterMode
          ? 'bg-slate-950 text-white p-4 md:p-8'
          : 'bg-gray-50 text-gray-900 p-4 md:p-8 space-y-8'
      }`}
    >
      {/* ── Top Presenter Toolbar ── */}
      <div
        className={`rounded-3xl border p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 transition-all ${
          presenterMode
            ? 'bg-slate-900/90 border-slate-800 text-white backdrop-blur-md mb-6'
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎙️</span>
          <div>
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
              <span>CivicEye Presenter Engine</span>
              {presenterMode && (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Projector View
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Live Hackathon Demo Mode &bull; Real Gemini Calls &bull; Real Firestore Writes
            </p>
          </div>
        </div>

        {/* Action Controls Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 4-Minute Presentation Timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border font-mono text-xs font-bold ${
              timerSeconds < 30
                ? 'bg-rose-500/20 text-rose-400 border-rose-500 animate-pulse'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-700'
            }`}
          >
            <span>⏱️</span>
            <span>{formatTimer(timerSeconds)}</span>
            <button
              type="button"
              onClick={() => setTimerRunning((p) => !p)}
              className="text-[10px] px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded uppercase hover:bg-black/20"
            >
              {timerRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setTimerSeconds(240);
              }}
              className="text-[10px] px-1 py-0.5 text-gray-400 hover:text-white"
            >
              ↺
            </button>
          </div>

          {/* Safe Mode Toggle ('S') */}
          <button
            type="button"
            onClick={() => setSafeMode((p) => !p)}
            title="Toggle Safe Mode (S) — Fallback to cached responses"
            className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition flex items-center gap-1.5 ${
              safeMode
                ? 'bg-amber-500 text-white border-amber-600 shadow'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700'
            }`}
          >
            <span>🛡️</span>
            <span>Safe Mode: {safeMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Presenter Mode Toggle ('P') */}
          <button
            type="button"
            onClick={() => setPresenterMode((p) => !p)}
            title="Toggle Presenter Mode (P) — High-contrast projector layout"
            className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition flex items-center gap-1.5 ${
              presenterMode
                ? 'bg-blue-600 text-white border-blue-700 shadow'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700'
            }`}
          >
            <span>🖥️</span>
            <span>Presenter (P)</span>
          </button>

          {/* 4-Minute Playlist Button */}
          <button
            type="button"
            disabled={playlistActive || isRunning}
            onClick={handleRunPlaylist}
            title="Runs Scenarios 1, 2, 4, 6, 8 in sequence"
            className="px-3.5 py-1.5 rounded-2xl text-xs font-extrabold uppercase bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>✨</span>
            <span>{playlistActive ? `Playlist (${playlistIndex + 1}/5)...` : '4-Min Playlist'}</span>
          </button>

          {/* Record Responses Button */}
          <button
            type="button"
            disabled={recordingCache}
            onClick={handleRecordCache}
            title="Calls real Gemini and caches JSON in Firestore demo_cache"
            className="px-3 py-1.5 rounded-2xl text-xs font-bold border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {recordingCache ? <LoadingSpinner size="xs" /> : '💾'}
            <span>Record Cache</span>
          </button>

          {/* Reset All Demo Data */}
          <button
            type="button"
            onClick={handleResetAllDemo}
            className="px-3 py-1.5 rounded-2xl text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition"
          >
            Reset All
          </button>

          {/* Shortcuts Help Button */}
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="w-8 h-8 rounded-full border border-gray-300 dark:border-slate-700 flex items-center justify-center font-bold text-xs hover:bg-gray-100 dark:hover:bg-slate-800"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>
      </div>

      {/* ── Top Auxiliary Panels (Hidden in full Presenter Mode for clean projection) ── */}
      {!presenterMode && (
        <div className="space-y-6">
          <DemoChecklist />
          <DemoAccountsBar />
          <ImpactSnapshot />
        </div>
      )}

      {/* ── Scenario Selection Cards Grid ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            className={`text-sm font-extrabold uppercase tracking-wider ${
              presenterMode ? 'text-slate-300' : 'text-gray-700'
            }`}
          >
            Select Hackathon Scenario ({SCENARIO_DEFINITIONS.length} Pre-Planned Paths)
          </h2>
          <span className="text-xs font-mono text-gray-400">
            Active: {activeScenario.title}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SCENARIO_DEFINITIONS.map((sc, i) => {
            const isSelected = sc.id === activeScenarioId;
            return (
              <div
                key={sc.id}
                onClick={() => {
                  if (!isRunning) setActiveScenarioId(sc.id);
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? presenterMode
                      ? 'bg-indigo-950/80 border-indigo-500 shadow-lg ring-2 ring-indigo-500'
                      : 'bg-blue-50/80 border-blue-500 shadow-md ring-2 ring-blue-500'
                    : presenterMode
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{sc.icon}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                      #{i + 1}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">
                    ~{sc.targetMinutes}m
                  </span>
                </div>

                <h3 className="text-xs font-black truncate">{sc.title}</h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-2 mt-1 leading-snug">
                  {sc.subtitle}
                </p>

                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveScenarioId(sc.id);
                      handleResetScenario(sc.id);
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:underline disabled:opacity-30"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveScenarioId(sc.id);
                      setTimeout(() => handleRunScenario(), 50);
                    }}
                    className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-30 flex items-center gap-1"
                  >
                    <span>Run</span>
                    <span>▶</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main Stage Split: Live Map/Stage (Left) & Narrator Panel (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Live Interactive Stage & Leaflet Map (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Leaflet Map Card */}
          <div
            className={`rounded-3xl border overflow-hidden shadow-sm relative ${
              presenterMode ? 'border-slate-800' : 'border-gray-200'
            }`}
            style={{ height: '420px' }}
          >
            <MapContainer
              center={mapCenter}
              zoom={DEFAULT_ZOOM}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapCenterController center={mapCenter} />

              {/* Area Explorer Circle (Scenario 6) */}
              {explorerCircle && (
                <Circle
                  center={[explorerCircle.lat, explorerCircle.lng]}
                  radius={explorerCircle.radius}
                  pathOptions={{
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.15,
                    weight: 2,
                    dashArray: '6, 6',
                  }}
                />
              )}

              {/* Live Reports Markers */}
              {mapReports.map((rep) => {
                const lat = rep.location?.lat;
                const lng = rep.location?.lng;
                if (!lat || !lng) return null;

                const isResolved = rep.status === 'resolved';
                const color = isResolved ? '#10b981' : URGENCY_COLORS[rep.aiUrgency] || '#3b82f6';
                const isDemoReport = rep.demo === true;

                return (
                  <CircleMarker
                    key={rep.id}
                    center={[lat, lng]}
                    radius={isDemoReport ? 9 : 6}
                    pathOptions={{
                      color: isDemoReport ? '#ffffff' : color,
                      fillColor: color,
                      fillOpacity: 0.9,
                      weight: isDemoReport ? 2.5 : 1.5,
                    }}
                  >
                    <Popup>
                      <div className="p-1 space-y-1 text-xs font-sans">
                        <div className="flex items-center gap-1 font-bold">
                          <span>{isResolved ? '✅' : '⚠️'}</span>
                          <span className="capitalize">{rep.aiClassification || 'Civic Defect'}</span>
                          {isDemoReport && (
                            <span className="text-[10px] px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-mono">
                              Demo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-600">{rep.location?.address}</p>
                        <p className="font-mono text-[10px] text-gray-500">
                          Status: <strong className="uppercase">{rep.status}</strong> &bull; Urgency:{' '}
                          <strong className="uppercase">{rep.aiUrgency}</strong>
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Floating Map Overlay Label */}
            <div className="absolute top-3 left-3 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-bold shadow-md flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live CivicEye Map ({mapReports.length} Active Incidents)</span>
            </div>
          </div>

          {/* Active Context Preview Card (Shows Photos & Dynamic Verdicts) */}
          <div
            className={`p-5 rounded-3xl border space-y-3 ${
              presenterMode
                ? 'bg-slate-900/80 border-slate-800 text-white'
                : 'bg-white border-gray-200 text-gray-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                Live Scenario Stage Feedback
              </span>
              <span className="text-[11px] font-mono text-gray-400">
                {activeScenario.title}
              </span>
            </div>

            {/* Photo Comparison Display (if images are loaded) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 p-2.5 bg-gray-50 dark:bg-slate-950 text-center space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block text-gray-500">
                  Citizen Reported Defect
                </span>
                {scenarioContext.potholeBeforeImg || scenarioContext.garbageBeforeImg ? (
                  <img
                    src={scenarioContext.potholeBeforeImg?.dataUrl || scenarioContext.garbageBeforeImg?.dataUrl}
                    alt="Before Defect"
                    className="w-full h-32 object-cover rounded-xl border"
                  />
                ) : (
                  <div className="w-full h-32 rounded-xl bg-gray-200 dark:bg-slate-900 flex items-center justify-center text-xs text-gray-400 font-mono">
                    Awaiting upload...
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 p-2.5 bg-gray-50 dark:bg-slate-950 text-center space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block text-gray-500">
                  Officer Fix Proof / Verification
                </span>
                {scenarioContext.potholeAfterImg || scenarioContext.fakeFixImg || scenarioContext.garbageAfterImg ? (
                  <img
                    src={
                      scenarioContext.potholeAfterImg?.dataUrl ||
                      scenarioContext.fakeFixImg?.dataUrl ||
                      scenarioContext.garbageAfterImg?.dataUrl
                    }
                    alt="After Proof"
                    className="w-full h-32 object-cover rounded-xl border"
                  />
                ) : (
                  <div className="w-full h-32 rounded-xl bg-gray-200 dark:bg-slate-900 flex items-center justify-center text-xs text-gray-400 font-mono">
                    Awaiting proof...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Step-by-Step Narrator Panel (5 cols) */}
        <div className="lg:col-span-5 h-[620px]">
          <NarratorPanel
            scenario={activeScenario}
            stepStates={stepStates}
            currentStepIndex={currentStepIndex}
            isRunning={isRunning}
            isAuto={isAuto}
            setIsAuto={setIsAuto}
            stepDelay={stepDelay}
            setStepDelay={setStepDelay}
            onNextStep={handleNextStep}
            onPrevStep={handlePrevStep}
            onRun={handleRunScenario}
            onReset={() => handleResetScenario(activeScenarioId)}
            safeMode={safeMode}
            presenterMode={presenterMode}
          />
        </div>
      </div>

      {/* ── Cache Recording Log Terminal Modal/Banner (if active) ── */}
      {recordingLogs.length > 0 && (
        <div className="p-4 rounded-2xl bg-gray-950 text-emerald-400 font-mono text-xs border border-gray-800 shadow-xl space-y-1 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between text-gray-400 border-b border-gray-800 pb-1 mb-1">
            <span className="font-bold text-white">Cache Recording Session</span>
            <button
              type="button"
              onClick={() => setRecordingLogs([])}
              className="text-gray-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>
          {recordingLogs.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
        </div>
      )}

      {/* ── Keyboard Shortcuts Help Modal ── */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-3xl border border-gray-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-gray-200 dark:border-slate-800">
              <h3 className="text-base font-black flex items-center gap-2">
                <span>⌨️</span>
                <span>Presenter Keyboard Shortcuts</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span>Advance to next step</span>
                <kbd className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-700 font-mono font-bold">Right Arrow →</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span>Previous step display</span>
                <kbd className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-700 font-mono font-bold">Left Arrow ←</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span>Reset active scenario demo data</span>
                <kbd className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-700 font-mono font-bold">R</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span>Toggle Safe Mode (Cached vs Live Gemini)</span>
                <kbd className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-700 font-mono font-bold">S</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span>Toggle Projector Presenter Mode</span>
                <kbd className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-700 font-mono font-bold">P</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span>Exit Presenter Mode / Close Dialog</span>
                <kbd className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-700 font-mono font-bold">Esc</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span>Toggle this shortcuts guide</span>
                <kbd className="px-2 py-1 rounded bg-gray-200 dark:bg-slate-700 font-mono font-bold">?</kbd>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}