/**
 * AuthContext — manages Firebase Auth state + Firestore user profile.
 * Provides: user (with profile), loading, login, signup, logout.
 * Sign-up always creates role "citizen".
 */
import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DEFAULT_OFFICER_RATING } from '../config';
import { DEMO_USERS } from '../lib/seedData';

const AuthContext = createContext(null);

/**
 * Fetch the user profile from Firestore users/{uid}.
 */
async function fetchProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);    // null = not logged in
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await fetchProfile(firebaseUser.uid);
          setUser(profile || { uid: firebaseUser.uid, email: firebaseUser.email, role: 'citizen' });
        } catch (err) {
          console.error('Failed to fetch user profile:', err.message);
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: 'citizen' });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  /**
   * Login with email + password. Returns the user profile.
   * If Firebase Auth is unavailable or accounts not yet seeded, seamlessly falls back to demo account.
   */
  async function login(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchProfile(cred.user.uid);
      const u = profile || { uid: cred.user.uid, email, role: 'citizen' };
      setUser(u);
      return u;
    } catch (err) {
      const demoSpec = DEMO_USERS.find((d) => d.email.toLowerCase() === email?.toLowerCase());
      if (demoSpec) {
        console.warn(`[AuthContext] Firebase auth error (${err.message}). Logging in with local demo profile.`);
        const u = { uid: `demo_${demoSpec.role}`, ...demoSpec };
        setUser(u);
        return u;
      }
      throw err;
    }
  }

  /**
   * Sign up a new citizen. Creates Firebase Auth account + Firestore profile.
   */
  async function signup(email, password, name, phone = '') {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile = {
      name,
      email,
      phone,
      role: 'citizen',
      department: '',
      zone: '',
      rating: DEFAULT_OFFICER_RATING,
      totalResolved: 0,
      activeIssues: 0,
      streakCount: 0,
      restrictedFromCritical: false,
      flagged: false,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile);
    const u = { uid: cred.user.uid, ...profile };
    setUser(u);
    return u;
  }

  /**
   * Logout.
   */
  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  /**
   * Refresh the profile from Firestore (useful after external changes).
   */
  async function refreshProfile() {
    if (!auth.currentUser) return;
    const profile = await fetchProfile(auth.currentUser.uid);
    if (profile) setUser(profile);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
