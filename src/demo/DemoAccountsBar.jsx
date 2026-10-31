/**
 * DemoAccountsBar Component (src/demo/DemoAccountsBar.jsx)
 * 
 * Provides 1-click instant role-switching between:
 * - Citizen (citizen1@demo.com)
 * - Officer (officer1@demo.com)
 * - Admin (admin@demo.com)
 * 
 * Displays the universal demo password and the current active identity.
 */
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DEMO_PASSWORD } from '../lib/seedData';
import LoadingSpinner from '../components/LoadingSpinner';

const QUICK_ACCOUNTS = [
  {
    role: 'citizen',
    label: 'Citizen',
    name: 'Aarav Mehta',
    email: 'citizen1@demo.com',
    badge: '👤 Citizen',
    theme: 'border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-900',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
  },
  {
    role: 'officer',
    label: 'Officer',
    name: 'Rajesh Kumar (Roads Lead)',
    email: 'officer1@demo.com',
    badge: '🛠️ Field Officer',
    theme: 'border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-900',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    role: 'admin',
    label: 'Admin',
    name: 'Municipal Commissioner',
    email: 'admin@demo.com',
    badge: '⚙️ City Admin',
    theme: 'border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-900',
    buttonColor: 'bg-rose-600 hover:bg-rose-700',
  },
];

export default function DemoAccountsBar() {
  const { user, login } = useAuth();
  const { show } = useToast();
  const [switching, setSwitching] = useState(null);

  const handleQuickLogin = async (acc) => {
    setSwitching(acc.role);
    try {
      await login(acc.email, DEMO_PASSWORD);
      show(`Switched session to ${acc.label} (${acc.email})`, 'success', 3000);
    } catch (err) {
      show(`Failed to login as ${acc.label}: ${err.message}`, 'error', 5000);
    } finally {
      setSwitching(null);
    }
  };

  const copyPassword = () => {
    navigator.clipboard?.writeText(DEMO_PASSWORD);
    show('Password copied: Demo@1234', 'info', 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
      {/* Header with Active User Info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔑</span>
          <div>
            <h2 className="text-base font-bold text-gray-900">Demo Role Switcher</h2>
            <p className="text-xs text-gray-500">
              One-click instant switch between roles during live presentation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyPassword}
            title="Click to copy password"
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-mono text-gray-700 border border-gray-200 transition flex items-center gap-1.5"
          >
            <span>Password:</span>
            <span className="font-bold">{DEMO_PASSWORD}</span>
            <span className="text-[10px] text-gray-400">📋</span>
          </button>

          {user && (
            <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active: {user.role?.toUpperCase()} ({user.name || user.email})</span>
            </span>
          )}
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {QUICK_ACCOUNTS.map((acc) => {
          const isActive = user?.email?.toLowerCase() === acc.email.toLowerCase();
          const isBusy = switching === acc.role;

          return (
            <div
              key={acc.role}
              className={`p-3.5 rounded-2xl border transition-all ${acc.theme} ${
                isActive ? 'ring-2 ring-gray-900 ring-offset-1 shadow-sm' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-black tracking-wide uppercase block">
                    {acc.badge}
                  </span>
                  <p className="text-xs font-bold text-gray-900 truncate mt-0.5">{acc.name}</p>
                  <p className="text-[11px] font-mono text-gray-500 truncate">{acc.email}</p>
                </div>

                {isActive && (
                  <span className="px-2 py-0.5 bg-gray-900 text-white text-[10px] font-extrabold uppercase rounded-full">
                    Current
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={isActive || switching !== null}
                onClick={() => handleQuickLogin(acc)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold text-white uppercase tracking-wider shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  acc.buttonColor
                }`}
              >
                {isBusy ? (
                  <>
                    <LoadingSpinner size="xs" />
                    <span>Signing In...</span>
                  </>
                ) : isActive ? (
                  <span>✓ Active Session</span>
                ) : (
                  <span>Login as {acc.label}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}