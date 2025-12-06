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

  // ✅ Logged-in: make this a compact chip instead of a full "btn"
  if (user) {
    return (
      <button
        type="button"
        onClick={signOut}
        title="Sign out"
        className="
        glass glass--black
          inline-flex items-center gap-1 rounded-full
          
          px-2 py-1
          text-[11px] leading-tight
          shadow-sm hover:bg-white transition
          max-w-[9rem]
        "
      >
        {user.photoURL && (
          <img
            src={user.photoURL}
            alt=""
            className="!w-6 !h-6 rounded-full object-cover"
          />
        )}<br/>
        <span className="truncate">
          {user.displayName || 'Signed in'}
        </span>
        <LogOut className="w-3 h-3 shrink-0" />
      </button>
    );
  }

  // Logged-out state unchanged
  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={isSigningIn}
          className={`btn btn-green btn-sm inline-flex items-center gap-2 ${
            isSigningIn ? 'opacity-60 pointer-events-none' : ''
          }`}
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
        <div
          className="fixed inset-0 bg-black/30 grid place-items-center z-50"
          onClick={() => setShowEmail(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <EmailAuthDialog onClose={() => setShowEmail(false)} />
          </div>
        </div>
      )}
    </>
  );
}
