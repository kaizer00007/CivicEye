/**
 * SignupPage — citizen self-registration.
 * Only creates "citizen" role accounts.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SignupPage() {
  const { signup, user } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !email || !password) {
      show('Please fill in all required fields', 'warning');
      return;
    }
    if (password.length < 6) {
      show('Password must be at least 6 characters', 'warning');
      return;
    }
    if (password !== confirm) {
      show('Passwords do not match', 'warning');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name.trim(), phone.trim());
      show('Account created! Welcome to CivicEye.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email':        'Invalid email address.',
        'auth/weak-password':        'Password is too weak. Use at least 6 characters.',
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
          <h1 className="mt-3 text-3xl font-bold text-gray-900">Join CivicEye</h1>
          <p className="mt-2 text-gray-500">Create a citizen account to report issues</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  text-sm placeholder-gray-400 transition"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="signup-email"
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
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone (optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  text-sm placeholder-gray-400 transition"
                placeholder="+91 9876543210"
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  text-sm placeholder-gray-400 transition"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  text-sm placeholder-gray-400 transition"
                placeholder="Re-enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium
                hover:bg-blue-700 focus:ring-4 focus:ring-blue-200
                disabled:opacity-50 disabled:cursor-not-allowed
                transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
