/**
 * ProtectedRoute — role-based route guard.
 * Wraps children; redirects if unauthenticated or wrong role.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FullPageSpinner } from './LoadingSpinner';

/**
 * @param {string[]} allowedRoles — roles allowed to view this route (e.g. ['officer','admin'])
 * @param {string} redirectTo — where to redirect unauthorized users
 */
export default function ProtectedRoute({ children, allowedRoles, redirectTo = '/login' }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;

  // Not logged in
  if (!user) return <Navigate to={redirectTo} replace />;

  // Logged in but wrong role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect by role
    const roleRedirects = {
      citizen: '/',
      officer: '/officer',
      admin:   '/admin',
    };
    return <Navigate to={roleRedirects[user.role] || '/'} replace />;
  }

  return children;
}
