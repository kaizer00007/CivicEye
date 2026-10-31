/**
 * main.jsx — React app entry point.
 * Wraps App with AuthProvider and ToastProvider.
 * If Firebase config is missing, renders a setup notice instead of a blank page.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];
const missingEnv = REQUIRED_ENV.filter((k) => !import.meta.env[k]);

function ConfigError({ missing, error }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border border-red-200 rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold text-red-700 mb-2">CivicEye couldn't start</h1>
        {missing.length > 0 ? (
          <>
            <p className="text-sm text-gray-700 mb-3">
              These environment variables are missing from the build. Add them in your
              Netlify project settings (Environment variables) and redeploy:
            </p>
            <ul className="text-sm font-mono bg-gray-50 rounded p-3 space-y-1">
              {missing.map((k) => <li key={k}>{k}</li>)}
            </ul>
          </>
        ) : (
          <p className="text-sm text-gray-700">{String(error?.message || error)}</p>
        )}
      </div>
    </div>
  );
}

if (missingEnv.length > 0) {
  root.render(<ConfigError missing={missingEnv} />);
} else {
  // Load the app lazily so a Firebase init failure shows a message instead of a white screen
  Promise.all([
    import('./App'),
    import('./contexts/AuthContext'),
    import('./contexts/ToastContext'),
  ])
    .then(([{ default: App }, { AuthProvider }, { ToastProvider }]) => {
      root.render(
        <React.StrictMode>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </React.StrictMode>
      );
    })
    .catch((err) => {
      console.error('[CivicEye] Failed to start:', err);
      root.render(<ConfigError missing={[]} error={err} />);
    });
}
