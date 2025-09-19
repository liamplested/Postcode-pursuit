// src/hooks/useAuth.js
import { useEffect, useState, useCallback } from 'react';
import { auth, provider } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

export default function useAuth() {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setLoading(false);
  }), []);

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, provider);
  }, []);

  const signOutAll = useCallback(async () => {
    await signOut(auth);
  }, []);

  return { user, loading, signIn, signOut: signOutAll };
}
