/**
 * App — root component with React Router.
 * Routes are role-gated using ProtectedRoute.
 * Public routes (map, dashboard) are accessible without login.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import MapPage from './pages/MapPage';
import PublicDashboard from './pages/PublicDashboard';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ReportPage from './pages/ReportPage';
import MyReportsPage from './pages/MyReportsPage';
import OfficerDashboard from './pages/OfficerDashboard';
import AdminPanel from './pages/AdminPanel';
import SeedPage from './pages/SeedPage';
import DemoPage from './pages/DemoPage';

// Seed route guard: only available when VITE_SEED_ENABLED is "true"
const seedEnabled = import.meta.env.VITE_SEED_ENABLED === 'true';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* ── Public routes ── */}
          <Route path="/" element={<MapPage />} />
          <Route path="/dashboard" element={<PublicDashboard />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* ── Citizen routes ── */}
          <Route
            path="/report"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <ReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-reports"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <MyReportsPage />
              </ProtectedRoute>
            }
          />

          {/* ── Officer routes ── */}
          <Route
            path="/officer"
            element={
              <ProtectedRoute allowedRoles={['officer']}>
                <OfficerDashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Admin routes ── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/demo"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DemoPage />
              </ProtectedRoute>
            }
          />

          {/* ── Seed tool (conditional) ── */}
          {seedEnabled && (
            <Route path="/seed" element={<SeedPage />} />
          )}

          {/* ── Catch-all ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
