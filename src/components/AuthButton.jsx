import React, { useCallback } from 'react';
import useAuth from '../hooks/useAuth';
import { LogIn, LogOut } from 'lucide-react';

export default function AuthButton({ size = 'btn-sm' }) {
  const { user, loading, signIn, signOut } = useAuth();

  const handleSignIn = useCallback(async () => {
    try { await signIn(); } catch (e) { console.error('Sign-in failed', e); }
  }, [signIn]);

  const handleSignOut = useCallback(async () => {
    try { await signOut(); } catch (e) { console.error('Sign-out failed', e); }
  }, [signOut]);

  if (loading) return null; // avoid flicker on first paint

  return user ? (
    <button
      type="button"
      onClick={handleSignOut}
      className={`btn btn-white ${size} inline-flex items-center gap-2`}
      title="Sign out"
      aria-label="Sign out"
    >
      {user.photoURL && (
        <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" />
      )}
      <span className="hidden sm:inline">{user.displayName || 'Signed in'}</span>
      <LogOut className="w-4 h-4" aria-hidden="true" />
    </button>
  ) : (
    <button
      type="button"
      onClick={handleSignIn}
      className={`btn btn-green ${size} inline-flex items-center gap-2`}
      title="Sign in with Google"
      aria-label="Sign in with Google"
    >
      <LogIn className="w-4 h-4" aria-hidden="true" />
      <span>Sign in</span>
    </button>
  );
}
