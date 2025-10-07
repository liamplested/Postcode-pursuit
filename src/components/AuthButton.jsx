// src/components/AuthButton.jsx
import React, { useCallback, useState } from 'react';
import useAuth from '../hooks/useAuth';
import { LogIn, LogOut, Mail } from 'lucide-react';
import EmailAuthDialog from './EmailAuthDialog';

export default function AuthButton() {
  const { user, loading, isSigningIn, signInGoogle, signOut } = useAuth();
  const [showEmail, setShowEmail] = useState(false);

  const handleGoogle = useCallback(async () => { await signInGoogle(); }, [signInGoogle]);

  if (loading) return null;

  if (user) {
    return (
      <button type="button" onClick={signOut} className="btn btn-white btn-xs h-8 px-2 inline-flex items-center gap-1" title="Sign out">
        {user.photoURL && <img src={user.photoURL} alt="" className="w-4 h-4 rounded-full" />}
        <span className="hidden md:inline max-w-[9rem] truncate text-xs">{user.displayName || 'Signed in'}</span>
        <LogOut className="w-3 h-3" />
      </button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={isSigningIn}
          className={`btn btn-green btn-sm inline-flex items-center gap-2 ${isSigningIn ? 'opacity-60 pointer-events-none' : ''}`}
          title="Sign in with Google"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign in with Google</span>
        </button>

        <button
          type="button"
          onClick={() => setShowEmail(true)}
          className="btn btn-white btn-sm inline-flex items-center gap-2"
          title="Sign in with Email"
        >
          <Mail className="w-4 h-4" />
          <span>Sign in with Email</span>
        </button>
      </div>

      {showEmail && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center z-50" onClick={() => setShowEmail(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <EmailAuthDialog onClose={() => setShowEmail(false)} />
          </div>
        </div>
      )}
    </>
  );
}
