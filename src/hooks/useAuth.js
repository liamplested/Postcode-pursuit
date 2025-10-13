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

  // Small helper to normalise provider strings (optional nicety for the UI)
  const friendlyProviders = (methods = []) => {
    const map = {
      'google.com': 'google',
      'facebook.com': 'facebook',
      'apple.com': 'apple',
      'password': 'password',
      'github.com': 'github',
      'microsoft.com': 'microsoft',
      'twitter.com': 'twitter',
      'yahoo.com': 'yahoo',
    };
    return methods.map(m => map[m] || m);
  };

  // Google popup
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

  // Email/Password — sign in (uses fetchSignInMethodsForEmail for hints)
  const signInEmail = useCallback(async (email, password) => {
    const em = (email || '').trim();
    try {
      await signInWithEmailAndPassword(auth, em, password);
      return { ok: true };
    } catch (e) {
      const code = e?.code || 'unknown';

      if (code === 'auth/user-not-found') {
        // Check if this email exists but only with an OAuth provider
        try {
          const methods = await fetchSignInMethodsForEmail(auth, em);
          if (methods.length && !methods.includes('password')) {
            // Tell the UI which provider(s) can be used (e.g. ['google'])
            return {
              ok: false,
              code: 'use-provider',
              providerHints: friendlyProviders(methods),
              message: 'This email uses a different sign-in method.',
            };
          }
        } catch {/* fall through to generic */}
        return { ok: false, code, message: 'No account with that email.' };
      }

      if (code === 'auth/wrong-password') {
        return { ok: false, code, message: 'Incorrect password.' };
      }
      if (code === 'auth/too-many-requests') {
        return { ok: false, code, message: 'Too many attempts. Try later.' };
      }
      return { ok: false, code, message: 'Sign in failed.' };
    }
  }, []);

  // Email/Password — sign up (returns provider hints if email already in use)
  const signUpEmail = useCallback(async (email, password) => {
    const em = (email || '').trim();
    try {
      await createUserWithEmailAndPassword(auth, em, password);
      return { ok: true };
    } catch (e) {
      const code = e?.code || 'unknown';

      if (code === 'auth/email-already-in-use') {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, em);
          return {
            ok: false,
            code: 'email-in-use',
            providerHints: friendlyProviders(methods),
            message: methods.includes('password')
              ? 'Email already in use. Try signing in.'
              : 'Email is already registered with a different sign-in method.',
          };
        } catch {/* fall through */}
        return { ok: false, code, message: 'Email already in use.' };
      }

      if (code === 'auth/invalid-email') {
        return { ok: false, code, message: 'Invalid email.' };
      }
      if (code === 'auth/weak-password') {
        return { ok: false, code, message: 'Password too weak (min 6 chars).' };
      }
      return { ok: false, code, message: 'Sign up failed.' };
    }
  }, []);

  // Optional: let a signed-in Google user add a password (link accounts)
  const linkPassword = useCallback(async (email, password) => {
    try {
      const cred = EmailAuthProvider.credential((email || '').trim(), password);
      await linkWithCredential(auth.currentUser, cred);
      return { ok: true };
    } catch (e) {
      const code = e?.code || 'unknown';
      return { ok: false, code, message: 'Could not add password.' };
    }
  }, []);

  // Password reset (keeps generic success to avoid email enumeration)
  const resetPassword = useCallback(async (email) => {
    const em = (email || '').trim();
    if (!em) return { ok: false, message: 'Enter your email.' };

    try {
      await sendPasswordResetEmail(auth, em /*, actionCodeSettings */);
      // Always generic success response
      return { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
    } catch (err) {
      const code = err?.code || 'unknown';
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
      // Generic success for all other cases to avoid enumeration
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
