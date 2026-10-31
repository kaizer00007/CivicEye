/**
 * MapPage — the hero page of CivicEye.
 *
 * Features:
 * - Live Firestore onSnapshot markers (CircleMarker, coloured by urgency/status)
 * - Click-anywhere area explorer circle (selectable radius 250m–2km)
 * - Side panel with filtered reports list, nearest first
 * - Filters: status, "My reports" toggle
 * - "Use my location" centre button
 * - Fly-to + detail view on report click
 * - Area summary line (total, resolved, avg resolution time)
 * - Heatmap layer toggle via leaflet.heat
 * - bubblingMouseEvents: false on markers
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { haversineDistanceMeters, formatDistance } from '../lib/geoUtils';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  RADIUS_OPTIONS,
  URGENCY_COLORS,
  STATUS_LABELS,
} from '../config';
import ReportCard from '../components/ReportCard';
import ReportDetailView from '../components/ReportDetailView';
import { StatusBadge } from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { getFallbackReports } from '../lib/demoDataFallback';

/* ── Marker colour logic ── */
function getMarkerColor(report) {
  if (report.status === 'resolved') return '#16a34a';
  return URGENCY_COLORS[report.aiUrgency] || '#3b82f6';
}

/* ── Area summary calculator ── */
function computeAreaSummary(reports) {
  const total = reports.length;
  const resolved = reports.filter((r) => r.status === 'resolved').length;
  let avgMs = 0;
  let count = 0;
  reports.forEach((r) => {
    if (r.status === 'resolved' && r.createdAt && r.resolvedAt) {
      const created = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      const res = r.resolvedAt.toDate ? r.resolvedAt.toDate() : new Date(r.resolvedAt);
      avgMs += res - created;
      count++;
    }
  });
  const avgHours = count > 0 ? Math.round(avgMs / count / (1000 * 60 * 60)) : null;
  return { total, resolved, avgHours };
}

/* ── Map click handler ── */
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

/* ── Fly-to helper ── */
function FlyToPoint({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 17, { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

/* ── Heatmap layer using leaflet.heat ── */
function HeatmapLayer({ points, enabled }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    // Dynamically import leaflet.heat (side-effect attaches L.heatLayer)
    import('leaflet.heat').then(() => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      const heatPoints = points.map((p) => [
        p.lat,
        p.lng,
        (p.severity || 5) / 10, // intensity weighted by severity
      ]);
      layerRef.current = L.heatLayer(heatPoints, {
        radius: 30,
        blur: 20,
        maxZoom: 17,
        max: 1.0,
        gradient: {
          0.2: '#3b82f6',
          0.4: '#facc15',
          0.6: '#f97316',
          0.8: '#ef4444',
          1.0: '#7f1d1d',
        },
      }).addTo(map);
    }).catch((err) => {
      console.warn('Heatmap layer failed to load:', err);
    });

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [points, enabled, map]);

  return null;
}

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */
export default function MapPage() {
  const { user } = useAuth();

  // All reports from Firestore
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Map interaction
  const [circleCenter, setCircleCenter] = useState(null);
  const [radius, setRadius] = useState(500);
  const [flyTarget, setFlyTarget] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [myReportsOnly, setMyReportsOnly] = useState(false);

  // Detail view
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);

  // Heatmap
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Panel open on mobile
  const [panelOpen, setPanelOpen] = useState(false);

  /* ── Live Firestore listener ── */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'reports'),
      (snapshot) => {
        const reports = [];
        snapshot.forEach((docSnap) => {
          reports.push({ id: docSnap.id, ...docSnap.data() });
        });
        setAllReports(reports.length > 0 ? reports : getFallbackReports());
        setLoading(false);
      },
      (err) => {
        console.warn('Reports listener error, falling back to demo reports:', err.message);
        setAllReports(getFallbackReports());
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  /* ── Filtered reports (global status + my-reports) ── */
  const filteredReports = allReports.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (myReportsOnly && user && r.citizenId !== user.uid) return false;
    return true;
  });

  /* ── Reports within the circle, sorted by distance ── */
  const circleReports = circleCenter
    ? filteredReports
        .map((r) => {
          if (!r.location?.lat || !r.location?.lng) return null;
          const dist = haversineDistanceMeters(
            circleCenter.lat, circleCenter.lng,
            r.location.lat, r.location.lng
          );
          if (dist > radius) return null;
          return { ...r, _distance: dist };
        })
        .filter(Boolean)
        .sort((a, b) => a._distance - b._distance)
    : [];

  const areaSummary = computeAreaSummary(circleReports);

  /* ── Heatmap data points ── */
  const heatPoints = filteredReports
    .filter((r) => r.location?.lat && r.location?.lng)
    .map((r) => ({
      lat: r.location.lat,
      lng: r.location.lng,
      severity: r.aiSeverity,
    }));

  /* ── Handle map click: place circle ── */
  const handleMapClick = useCallback((latlng) => {
    setCircleCenter(latlng);
    setSelectedReport(null);
    setSelectedReportId(null);
    setPanelOpen(true);
  }, []);

  /* ── Handle report click (from marker or list) ── */
  const handleReportSelect = useCallback((report) => {
    setSelectedReport(report);
    setSelectedReportId(report.id);
    setFlyTarget({ lat: report.location.lat, lng: report.location.lng });
  }, []);

  /* ── Use my location ── */
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCircleCenter(latlng);
        setFlyTarget(latlng);
        setPanelOpen(true);
      },
      () => {/* ignore errors */},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ════════════ LEFT: Map ════════════ */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-[500] bg-white/70 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Loading map data..." />
          </div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onMapClick={handleMapClick} />
          <FlyToPoint target={flyTarget} />
          <HeatmapLayer points={heatPoints} enabled={showHeatmap} />

          {/* Issue markers */}
          {filteredReports.map((r) => {
            if (!r.location?.lat || !r.location?.lng) return null;
            const color = getMarkerColor(r);
            const isSelected = r.id === selectedReportId;
            return (
              <CircleMarker
                key={r.id}
                center={[r.location.lat, r.location.lng]}
                radius={isSelected ? 12 : 8}
                pathOptions={{
                  color: '#fff',
                  weight: isSelected ? 3 : 2,
                  fillColor: color,
                  fillOpacity: isSelected ? 1 : 0.85,
                }}
                bubblingMouseEvents={false}
                eventHandlers={{
                  click: () => handleReportSelect(r),
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1 max-w-[200px]">
                    <p className="font-bold capitalize">{(r.aiClassification || '').replace(/_/g, ' ')}</p>
                    <StatusBadge status={r.status} />
                    <p className="text-gray-600 truncate">{r.location?.address}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Area explorer circle */}
          {circleCenter && (
            <Circle
              center={[circleCenter.lat, circleCenter.lng]}
              radius={radius}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.08,
                weight: 2,
                dashArray: '6 4',
              }}
            />
          )}
        </MapContainer>

        {/* ── Floating controls ── */}
        <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2">
          {/* Use my location */}
          <button
            onClick={handleUseMyLocation}
            className="bg-white shadow-lg border border-gray-200 p-2.5 rounded-xl hover:bg-blue-50 transition"
            title="Use my location"
          >
            🎯
          </button>

          {/* Heatmap toggle */}
          <button
            onClick={() => setShowHeatmap((h) => !h)}
            className={`shadow-lg border p-2.5 rounded-xl transition ${
              showHeatmap ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-gray-200 hover:bg-orange-50'
            }`}
            title="Toggle heatmap"
          >
            🔥
          </button>
        </div>

        {/* ── Radius selector ── */}
        {circleCenter && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Radius:</span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  radius === r
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r >= 1000 ? `${r / 1000} km` : `${r} m`}
              </button>
            ))}
          </div>
        )}

        {/* ── Mobile panel toggle ── */}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="md:hidden absolute bottom-4 right-4 z-[400] bg-blue-600 text-white p-3 rounded-full shadow-lg text-sm font-bold"
        >
          {panelOpen ? '✕' : `📋 ${circleReports.length || filteredReports.length}`}
        </button>

        {/* ── Status filter bar ── */}
        <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 p-2 flex flex-wrap gap-1 max-w-[280px]">
          {['all', 'submitted', 'assigned', 'in_progress', 'resolved', 'escalated'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s] || s}
            </button>
          ))}
          {user && (
            <button
              onClick={() => setMyReportsOnly((m) => !m)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                myReportsOnly
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              My Reports
            </button>
          )}
        </div>
      </div>

      {/* ════════════ RIGHT: Side Panel ════════════ */}
      <div
        className={`
          ${panelOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          fixed md:static right-0 top-14 bottom-0 z-[450] md:z-auto
          w-full md:w-96 bg-white border-l border-gray-200
          flex flex-col overflow-hidden
          transition-transform duration-300
        `}
      >
        {/* Panel header */}
        <div className="border-b bg-gray-50 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm">
              {selectedReport ? 'Report Details' : circleCenter ? 'Area Explorer' : 'All Reports'}
            </h2>
            {/* Mobile close */}
            <button
              onClick={() => { setPanelOpen(false); setSelectedReport(null); }}
              className="md:hidden text-gray-400 hover:text-gray-700 text-lg"
            >
              ✕
            </button>
          </div>

          {/* Area summary */}
          {circleCenter && !selectedReport && (
            <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-600 font-medium">
              <span>📋 {areaSummary.total} reports</span>
              <span>✅ {areaSummary.resolved} resolved</span>
              {areaSummary.avgHours !== null && (
                <span>⏱️ Avg {areaSummary.avgHours < 24 ? `${areaSummary.avgHours}h` : `${Math.round(areaSummary.avgHours / 24)}d`} resolution</span>
              )}
            </div>
          )}
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto p-3">
          {selectedReport ? (
            /* Detail view */
            <ReportDetailView
              report={selectedReport}
              reportId={selectedReportId}
              onClose={() => { setSelectedReport(null); setSelectedReportId(null); }}
            />
          ) : circleCenter ? (
            /* Area explorer list */
            circleReports.length > 0 ? (
              <div className="space-y-2">
                {circleReports.map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    distance={r._distance}
                    isOwn={user && r.citizenId === user.uid}
                    isSelected={r.id === selectedReportId}
                    onClick={() => handleReportSelect(r)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-4xl">📭</span>
                <p className="text-sm text-gray-500 mt-3">No reports in this area.</p>
                <p className="text-xs text-gray-400">Try a larger radius or a different location.</p>
              </div>
            )
          ) : (
            /* No circle: show all filtered */
            filteredReports.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-2">
                  Click anywhere on the map to explore an area. Showing {filteredReports.length} reports.
                </p>
                {filteredReports.slice(0, 50).map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    isOwn={user && r.citizenId === user.uid}
                    isSelected={r.id === selectedReportId}
                    onClick={() => handleReportSelect(r)}
                  />
                ))}
                {filteredReports.length > 50 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    Showing first 50 of {filteredReports.length} reports. Use area explorer to narrow down.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-4xl">🗺️</span>
                <p className="text-sm text-gray-500 mt-3">No reports found.</p>
                <p className="text-xs text-gray-400">Try changing filters or check back later.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
