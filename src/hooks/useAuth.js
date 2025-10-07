// src/hooks/useAuth.js
import { useEffect, useState, useCallback } from 'react';
import { auth, provider } from '../firebase';
import {
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';

export default function useAuth() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setLoading(false);
  }), []);

  // Google popup (already had this)
  const signInGoogle = useCallback(async () => {
    if (isSigningIn) return { ok: false, code: 'busy', silent: true };
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, provider);
      return { ok: true };
    } catch (e) {
      const code = e?.code || 'unknown';
      const silent = code === 'auth/popup-closed-by-user'
        || code === 'auth/cancelled-popup-request'
        || code === 'auth/popup-blocked';
      if (!silent) console.warn('Google sign-in failed:', code, e);
      return { ok: false, code, silent };
    } finally {
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  // Email/Password — sign in
  const signInEmail = useCallback(async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { ok: true };
    } catch (e) {
      const code = e?.code || 'unknown';
      return {
        ok: false,
        code,
        message:
          code === 'auth/user-not-found' ? 'No account with that email.'
        : code === 'auth/wrong-password' ? 'Incorrect password.'
        : code === 'auth/too-many-requests' ? 'Too many attempts. Try later.'
        : 'Sign in failed.',
      };
    }
  }, []);

  // Email/Password — sign up
  const signUpEmail = useCallback(async (email, password) => {
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      return { ok: true };
    } catch (e) {
      const code = e?.code || 'unknown';
      return {
        ok: false,
        code,
        message:
          code === 'auth/email-already-in-use' ? 'Email already in use.'
        : code === 'auth/invalid-email' ? 'Invalid email.'
        : code === 'auth/weak-password' ? 'Password too weak (min 6 chars).'
        : 'Sign up failed.',
      };
    }
  }, []);

  // Optional: let a signed-in Google user add a password (link accounts)
  const linkPassword = useCallback(async (email, password) => {
    try {
      const cred = EmailAuthProvider.credential(email.trim(), password);
      await linkWithCredential(auth.currentUser, cred);
      return { ok: true };
    } catch (e) {
      const code = e?.code || 'unknown';
      return { ok: false, code, message: 'Could not add password.' };
    }
  }, []);

  // Password reset (sends email)
const resetPassword = useCallback(async (email) => {
  const e = (email || '').trim();
  if (!e) return { ok: false, message: 'Enter your email.' };

  try {
    // ⚠️ no pre-flight — just ask Firebase to send it
    await sendPasswordResetEmail(auth, e /*, optional actionCodeSettings */);

    // Always show a generic success (prevents account enumeration)
    return { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
  } catch (err) {
    const code = err?.code || 'unknown';

    // These are the only ones worth surfacing to the user:
    if (code === 'auth/invalid-email') {
      return { ok: false, message: 'Invalid email address.' };
    }
    if (code === 'auth/invalid-continue-uri' || code === 'auth/unauthorized-continue-uri') {
      return { ok: false, message: 'Reset link could not be generated. Check Authorized domains / Continue URL.' };
    }
    if (code === 'auth/operation-not-allowed') {
      return { ok: false, message: 'Email/password sign-in is disabled in this project.' };
    }
    if (code === 'auth/too-many-requests') {
      return { ok: false, message: 'Too many attempts. Try again later.' };
    }

    // For auth/user-not-found and most others, just return generic success to avoid enumeration
    console.warn('resetPassword error:', code, err);
    return { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
  }
}, []);

  const signOutAll = useCallback(async () => {
    try { await signOut(auth); } catch (e) { console.warn('Sign-out failed:', e?.code || e); }
  }, []);

  return {
    user, loading, isSigningIn,
    signInGoogle,
    signInEmail, signUpEmail, resetPassword, linkPassword,
    signOut: signOutAll,
  };
}
