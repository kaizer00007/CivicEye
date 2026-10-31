/**
 * Navbar — responsive top navigation bar.
 * Shows different links based on user role.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { show } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      show('Logged out successfully', 'success');
      navigate('/');
    } catch (err) {
      show('Logout failed: ' + err.message, 'error');
    }
  };

  /** Check if a path is the current route */
  const isActive = (path) => location.pathname === path;
  const linkClass = (path) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive(path)
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-500 hover:text-white'
    }`;

  // Build nav links based on role
  const navLinks = [
    { to: '/', label: '🗺️ Map', roles: null },           // public
    { to: '/dashboard', label: '📊 Dashboard', roles: null }, // public
  ];

  if (user) {
    if (user.role === 'citizen') {
      navLinks.push({ to: '/report', label: '📝 Report Issue', roles: ['citizen'] });
      navLinks.push({ to: '/my-reports', label: '📋 My Reports', roles: ['citizen'] });
    }
    if (user.role === 'officer') {
      navLinks.push({ to: '/officer', label: '🛠️ My Tasks', roles: ['officer'] });
    }
    if (user.role === 'admin') {
      navLinks.push({ to: '/admin', label: '⚙️ Admin', roles: ['admin'] });
      navLinks.push({ to: '/demo', label: '🎙️ Demo Mode', roles: ['admin'] });
    }
  }

  return (
    <nav className="bg-blue-600 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-white font-bold text-lg">
            <span className="text-2xl">👁️</span>
            <span>CivicEye</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className={linkClass(link.to)}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* User section */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <span className="text-blue-100 text-sm">
                  {user.name || user.email}
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-800 text-blue-200 uppercase">
                    {user.role}
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm bg-blue-800 text-blue-100 rounded-md
                    hover:bg-blue-900 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-1.5 text-sm bg-white text-blue-600 rounded-md
                  font-medium hover:bg-blue-50 transition-colors"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white p-2"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-blue-700 border-t border-blue-500 px-4 pb-3 pt-2 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`block ${linkClass(link.to)}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-blue-500 pt-2 mt-2">
            {user ? (
              <>
                <p className="text-blue-200 text-sm px-3 py-1">
                  {user.name || user.email} ({user.role})
                </p>
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 text-sm text-blue-100 hover:bg-blue-500 rounded-md"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="block px-3 py-2 text-sm text-white bg-blue-800 rounded-md text-center"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
