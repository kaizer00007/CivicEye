/**
 * PublicDashboard — Transparency & Municipal Analytics Center.
 * No login required.
 * Features:
 * - Officer Leaderboard (Top 10 sorted by civic rating with streak & badges)
 * - Department Performance Cards (total, resolved, overdue, avg resolution time)
 * - Recharts Interactive Visualizations:
 *   - Issues by Category (Bar Chart)
 *   - Average Resolution Time by Department (Bar Chart)
 *   - 30-Day Reported vs Resolved Velocity Trend (Area Chart)
 */
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { db } from '../lib/firebase';
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  ISSUE_TYPES,
} from '../config';
import LoadingSpinner from '../components/LoadingSpinner';
import { getFallbackReports, getFallbackOfficers } from '../lib/demoDataFallback';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function PublicDashboard() {
  const [reports, setReports] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to all reports
    const unsubReports = onSnapshot(
      collection(db, 'reports'),
      (snap) => {
        const rList = [];
        snap.forEach((d) => rList.push({ id: d.id, ...d.data() }));
        setReports(rList.length > 0 ? rList : getFallbackReports());
        setLoading(false);
      },
      (err) => {
        console.warn('Public dashboard reports fallback:', err.message);
        setReports(getFallbackReports());
        setLoading(false);
      }
    );

    // 2. Listen to all officers for leaderboard
    const qOfficers = query(collection(db, 'users'), where('role', '==', 'officer'));
    const unsubOfficers = onSnapshot(
      qOfficers,
      (snap) => {
        const oList = [];
        snap.forEach((d) => oList.push({ uid: d.id, ...d.data() }));
        const list = oList.length > 0 ? oList : getFallbackOfficers();
        list.sort((a, b) => (b.rating ?? 3.5) - (a.rating ?? 3.5));
        setOfficers(list.slice(0, 10));
      },
      (err) => {
        console.warn('Officers leaderboard fallback:', err.message);
        const fb = getFallbackOfficers();
        fb.sort((a, b) => (b.rating ?? 3.5) - (a.rating ?? 3.5));
        setOfficers(fb.slice(0, 10));
      }
    );

    return () => {
      unsubReports();
      unsubOfficers();
    };
  }, []);

  const now = Date.now();

  // ── 1. High-Level Metrics ──
  const totalReports = reports.length;
  const totalResolved = reports.filter((r) => r.status === 'resolved').length;
  const resolutionRate = totalReports > 0 ? Math.round((totalResolved / totalReports) * 100) : 0;
  const totalOverdue = reports.filter((r) => {
    if (r.status === 'resolved') return false;
    const dl = r.deadline?.toMillis ? r.deadline.toMillis() : 0;
    return dl > 0 && dl < now;
  }).length;

  // Global Avg Resolution Time
  let globalResolvedCount = 0;
  let globalElapsedMs = 0;
  reports.forEach((r) => {
    if (r.status === 'resolved' && r.createdAt && r.resolvedAt) {
      const c = r.createdAt.toMillis ? r.createdAt.toMillis() : new Date(r.createdAt).getTime();
      const res = r.resolvedAt.toMillis ? r.resolvedAt.toMillis() : new Date(r.resolvedAt).getTime();
      if (res > c) {
        globalElapsedMs += res - c;
        globalResolvedCount++;
      }
    }
  });
  const avgResolutionHours = globalResolvedCount > 0
    ? Math.round(globalElapsedMs / globalResolvedCount / (1000 * 60 * 60))
    : 0;

  // ── 2. Department Breakdown Data ──
  const deptData = DEPARTMENTS.map((deptKey) => {
    const deptReports = reports.filter((r) => r.department === deptKey);
    const resolved = deptReports.filter((r) => r.status === 'resolved').length;
    const overdue = deptReports.filter((r) => {
      if (r.status === 'resolved') return false;
      const dl = r.deadline?.toMillis ? r.deadline.toMillis() : 0;
      return dl > 0 && dl < now;
    }).length;

    let resTimeHours = 0;
    let resCount = 0;
    deptReports.forEach((r) => {
      if (r.status === 'resolved' && r.createdAt && r.resolvedAt) {
        const c = r.createdAt.toMillis ? r.createdAt.toMillis() : new Date(r.createdAt).getTime();
        const res = r.resolvedAt.toMillis ? r.resolvedAt.toMillis() : new Date(r.resolvedAt).getTime();
        if (res > c) {
          resTimeHours += (res - c) / (1000 * 60 * 60);
          resCount++;
        }
      }
    });

    return {
      department: DEPARTMENT_LABELS[deptKey] || deptKey,
      total: deptReports.length,
      resolved,
      overdue,
      avgHours: resCount > 0 ? Math.round(resTimeHours / resCount) : 0,
    };
  });

  // ── 3. Issue Category Chart Data ──
  const categoryData = ISSUE_TYPES.map((type) => {
    const count = reports.filter((r) => r.aiClassification === type).length;
    return {
      name: type.replace(/_/g, ' '),
      count,
    };
  }).filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

  // ── 4. 30-Day Trend Data ──
  const daysMap = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    daysMap[key] = { date: key, reported: 0, resolved: 0 };
  }

  reports.forEach((r) => {
    if (r.createdAt) {
      const d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      const key = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (daysMap[key]) daysMap[key].reported++;
    }
    if (r.resolvedAt) {
      const d = r.resolvedAt.toDate ? r.resolvedAt.toDate() : new Date(r.resolvedAt);
      const key = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (daysMap[key]) daysMap[key].resolved++;
    }
  });
  const trendData = Object.values(daysMap);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Aggregating civic transparency data..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <span>📊</span> Municipal Transparency &amp; Accountability Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Public performance analytics, field officer leaderboard, and resolution metrics.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase text-gray-500 block">Total Issues Filed</span>
          <p className="text-3xl font-black text-gray-900">{totalReports}</p>
          <span className="text-[11px] text-blue-600 font-semibold block">Citizen Reported</span>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase text-gray-500 block">Resolution Rate</span>
          <p className="text-3xl font-black text-green-600">{resolutionRate}%</p>
          <span className="text-[11px] text-gray-400 font-semibold block">{totalResolved} fixed tickets</span>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase text-gray-500 block">Avg Resolution Time</span>
          <p className="text-3xl font-black text-blue-600">
            {avgResolutionHours > 24 ? `${Math.round(avgResolutionHours / 24)}d ${avgResolutionHours % 24}h` : `${avgResolutionHours}h`}
          </p>
          <span className="text-[11px] text-gray-400 font-semibold block">Dispatch to fix</span>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase text-gray-500 block">Overdue Tickets</span>
          <p className="text-3xl font-black text-red-600">{totalOverdue}</p>
          <span className="text-[11px] text-red-500 font-semibold block">Subject to Escalation</span>
        </div>
      </div>

      {/* ── Visual Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 30-Day Velocity Trend Chart */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">30-Day Issue Filing vs Resolution Velocity</h2>
            <p className="text-xs text-gray-400">Daily intake compared against verified field repairs</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReported" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={5} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="reported" name="Reported" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorReported)" />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issues by Category Bar Chart */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Issues by Category</h2>
            <p className="text-xs text-gray-400">Distribution of defects classified by Gemini AI</p>
          </div>
          <div className="h-72 w-full">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" name="Total Reports" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No category data available yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Department Performance Table & Resolution Time Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Department Stats Cards / Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Department Performance Metrics</h2>
            <p className="text-xs text-gray-400">Workload, completion rates, and average resolution speed</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 font-bold">Department</th>
                  <th className="pb-3 font-bold">Total Filed</th>
                  <th className="pb-3 font-bold">Resolved</th>
                  <th className="pb-3 font-bold">Overdue</th>
                  <th className="pb-3 font-bold">Avg Fix Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deptData.map((d) => (
                  <tr key={d.department} className="hover:bg-gray-50 transition">
                    <td className="py-3 font-bold text-gray-800">{d.department}</td>
                    <td className="py-3 font-semibold text-gray-600">{d.total}</td>
                    <td className="py-3 font-bold text-green-600">{d.resolved}</td>
                    <td className="py-3">
                      {d.overdue > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                          {d.overdue}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="py-3 font-mono font-medium text-blue-600">
                      {d.avgHours > 0 ? `${d.avgHours}h` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Avg Resolution Time by Department Chart */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Speed by Dept (Hours)</h2>
            <p className="text-xs text-gray-400">Lower is faster turnaround</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="department" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="avgHours" name="Avg Hours" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Officer Leaderboard (Top 10 by Rating) ── */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <span>🏆</span> Municipal Officer Leaderboard
            </h2>
            <p className="text-xs text-gray-400">
              Top field officers ranked by verified on-time resolutions and citizen satisfaction
            </p>
          </div>
          <span className="px-3 py-1 bg-yellow-50 text-yellow-800 text-xs font-bold rounded-full border border-yellow-200">
            Top 10 Performers
          </span>
        </div>

        {officers.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            No officers registered in the system yet. Seed demo accounts via /seed to populate the leaderboard.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {officers.map((officer, index) => {
              const rankMedal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
              const ratingVal = Number(officer.rating ?? 3.5).toFixed(1);

              return (
                <div
                  key={officer.uid}
                  className="p-4 rounded-2xl border border-gray-100 bg-gray-50/70 hover:bg-white hover:border-gray-200 transition shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold w-8 text-center flex-shrink-0">
                      {rankMedal}
                    </span>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">
                        {officer.name || officer.email}
                      </h3>
                      <p className="text-[11px] text-gray-500 capitalize">
                        🏢 {DEPARTMENT_LABELS[officer.department] || officer.department || 'Municipal'} &bull; 📍 {officer.zone?.replace(/_/g, ' ') || 'Zone 1'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                        <span>🔥 Streak: <strong className="text-gray-900">{officer.streakCount || 0}</strong></span>
                        <span>&bull;</span>
                        <span>✅ Fixed: <strong className="text-gray-900">{officer.totalResolved || 0}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Rating pill */}
                  <div className="text-right flex-shrink-0">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 text-green-700 font-black text-sm rounded-xl">
                      <span>⭐</span>
                      <span>{ratingVal}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
