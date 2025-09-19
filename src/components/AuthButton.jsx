import React, { useCallback } from 'react';
import useAuth from '../hooks/useAuth';
import { LogIn, LogOut, UserCircle } from 'lucide-react';

export default function AuthButton({
  variant = 'pill',          // 'pill' | 'avatar' | 'label' (label = small text only)
  className = '',
  sizeSignedOut = 'btn-sm',  // unchanged for logged-out CTA
  nameBreakpoint = 'md',     // when to show the name (md, lg, xl)
}) {
  const { user, loading, signIn, signOut } = useAuth();

  const handleSignIn = useCallback(async () => {
    try { await signIn(); } catch { /* silent */ }
  }, [signIn]);

  const handleSignOut = useCallback(async () => {
    try { await signOut(); } catch { /* silent */ }
  }, [signOut]);

  if (loading) return null;

  if (!user) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        className={`btn btn-green ${sizeSignedOut} inline-flex items-center gap-2 ${className}`}
        title="Sign in with Google"
        aria-label="Sign in with Google"
      >
        <LogIn className="w-4 h-4" aria-hidden="true" />
        <span>Sign in</span>
      </button>
    );
  }

  const name = user.displayName || 'Signed in';
  const Name = () => (
    <span
      className={`hidden ${nameBreakpoint}:inline max-w-[8rem] truncate align-middle text-xs`}
    >
      {name}
    </span>
  );

  // ultra-compact avatar-only chip
  if (variant === 'avatar') {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className={`btn btn-white btn-xs p-1 rounded-full inline-flex items-center ${className}`}
        title={`Sign out (${name})`}
        aria-label={`Sign out (${name})`}
      >
        {user.photoURL
          ? <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" />
          : <UserCircle className="w-5 h-5" aria-hidden="true" />}
      </button>
    );
  }

  // tiny text label + chevron (no avatar)
  if (variant === 'label') {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className={`btn btn-white btn-2xs px-2 py-1 inline-flex items-center gap-1 ${className}`}
        title={`Sign out (${name})`}
        aria-label={`Sign out (${name})`}
      >
        <Name />
        <LogOut className="w-3 h-3" aria-hidden="true" />
      </button>
    );
  }

  // default: pill with small avatar + small name + small icon
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`btn btn-white btn-xs h-8 px-2 inline-flex items-center gap-1 ${className}`}
      title={`Sign out (${name})`}
      aria-label={`Sign out (${name})`}
    >
      {user.photoURL
        ? <img src={user.photoURL} alt="" className="w-4 h-4 rounded-full" />
        : <UserCircle className="w-4 h-4" aria-hidden="true" />}
      <Name />
      <LogOut className="w-3 h-3" aria-hidden="true" />
    </button>
  );
}
