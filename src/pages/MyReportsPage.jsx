/**
 * MyReportsPage — Citizen report tracking and feedback center.
 * Features:
 * - Live real-time stream (onSnapshot) of citizen's own submitted reports
 * - Summary cards: Total Reported, Active/In Progress, Resolved
 * - Detailed inspection reusing ReportDetailView
 * - Integrated satisfaction confirmation / star rating prompts
 */
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import ReportCard from '../components/ReportCard';
import ReportDetailView from '../components/ReportDetailView';
import LoadingSpinner from '../components/LoadingSpinner';

export default function MyReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'reports'),
      where('citizenId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() });
        });

        // Sort newest first
        items.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setReports(items);
        // If currently selected report was updated in Firestore, update state
        if (selectedReport) {
          const updated = items.find((i) => i.id === selectedReport.id);
          if (updated) setSelectedReport(updated);
        }
        setLoading(false);
      },
      (err) => {
        console.error('MyReports listener error:', err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid]);

  const filteredReports = reports.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const totalCount = reports.length;
  const inProgressCount = reports.filter((r) => r.status === 'in_progress' || r.status === 'assigned').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved').length;
  const awaitingFeedbackCount = reports.filter(
    (r) =>
      (r.resolution?.verificationState === 'awaiting_citizen' || r.status === 'resolved') &&
      !r.citizenFeedback?.at
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <span>📋</span> My Reported Issues
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track real-time progress on your community issue reports and verify repairs.
          </p>
        </div>

        <Link
          to="/report"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition transform active:scale-95 flex items-center gap-2"
        >
          <span>📸</span>
          <span>Report New Issue</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-gray-500">Total Filed</span>
            <p className="text-2xl font-black text-gray-900 mt-1">{totalCount}</p>
          </div>
          <span className="text-2xl p-3 bg-blue-50 text-blue-600 rounded-xl">📋</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-gray-500">In Progress</span>
            <p className="text-2xl font-black text-amber-600 mt-1">{inProgressCount}</p>
          </div>
          <span className="text-2xl p-3 bg-amber-50 text-amber-600 rounded-xl">🔧</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-gray-500">Resolved</span>
            <p className="text-2xl font-black text-green-600 mt-1">{resolvedCount}</p>
          </div>
          <span className="text-2xl p-3 bg-green-50 text-green-600 rounded-xl">✅</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-purple-200 bg-purple-50/40 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-purple-700">Needs Your Review</span>
            <p className="text-2xl font-black text-purple-900 mt-1">{awaitingFeedbackCount}</p>
          </div>
          <span className="text-2xl p-3 bg-purple-100 text-purple-700 rounded-xl">⭐</span>
        </div>
      </div>

      {/* Main Layout: List (left) & Detail View (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Reports List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap gap-2 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
            {[
              { id: 'all', label: 'All Reports' },
              { id: 'assigned', label: 'Assigned' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'resolved', label: 'Resolved' },
              { id: 'escalated', label: 'Escalated' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List Content */}
          {loading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" text="Loading your civic reports..." />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm space-y-3">
              <span className="text-5xl">🌱</span>
              <h3 className="text-lg font-bold text-gray-800">No reports found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {statusFilter === 'all'
                  ? "You haven't submitted any civic issues yet. Be the eyes of your community!"
                  : `You have no reports currently marked as "${statusFilter}".`}
              </p>
              {statusFilter === 'all' && (
                <Link
                  to="/report"
                  className="inline-block mt-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow hover:bg-blue-700 transition"
                >
                  File First Report
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  isOwn={true}
                  isSelected={selectedReport?.id === report.id}
                  onClick={() => setSelectedReport(report)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Selected Report Detail */}
        <div className="space-y-4">
          {selectedReport ? (
            <div className="sticky top-20">
              <ReportDetailView
                report={selectedReport}
                reportId={selectedReport.id}
                onClose={() => setSelectedReport(null)}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-400 space-y-2 sticky top-20">
              <span className="text-3xl block">👈</span>
              <p className="text-xs font-semibold text-gray-600">
                Select any report from the list to view its complete progress timeline, officer assignment, and verification proof.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
