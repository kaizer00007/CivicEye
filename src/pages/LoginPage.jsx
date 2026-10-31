/**
 * LoginPage — email/password login with role-based redirect.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function LoginPage() {
  const { login, user } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (user) {
    const redirects = { citizen: '/', officer: '/officer', admin: '/admin' };
    navigate(redirects[user.role] || '/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      show('Please fill in all fields', 'warning');
      return;
    }
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      show(`Welcome back, ${loggedInUser.name || loggedInUser.email}!`, 'success');
      const redirects = { citizen: '/', officer: '/officer', admin: '/admin' };
      navigate(redirects[loggedInUser.role] || '/', { replace: true });
    } catch (err) {
      const messages = {
        'auth/user-not-found':    'No account found with this email.',
        'auth/wrong-password':    'Incorrect password.',
        'auth/invalid-email':     'Invalid email address.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/invalid-credential': 'Invalid email or password.',
      };
      show(messages[err.code] || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">👁️</span>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">Sign in to CivicEye</h1>
          <p className="mt-2 text-gray-500">Report and track civic issues in your area</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  text-sm placeholder-gray-400 transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  text-sm placeholder-gray-400 transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium
                hover:bg-blue-700 focus:ring-4 focus:ring-blue-200
                disabled:opacity-50 disabled:cursor-not-allowed
                transition flex items-center justify-center gap-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign up
            </Link>
          </p>

          {/* Demo credentials hint */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <p className="font-semibold mb-1">Demo accounts (after seeding):</p>
            <p>Admin: admin@demo.com · Officer: officer1@demo.com</p>
            <p>Citizen: citizen1@demo.com · Password: Demo@1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
