
import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';

export default function EmailAuthDialog({ onClose }) {
  const { signInEmail, signUpEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg('');
    setBusy(true);
    let res;
    if (mode === 'signin')  res = await signInEmail(email, pw);
    if (mode === 'signup')  res = await signUpEmail(email, pw);
    if (mode === 'reset')   res = await resetPassword(email);

    setBusy(false);
    if (res?.ok) {
      if (mode === 'reset') setMsg('Check your email for a reset link.');
      else onClose?.();
    } else if (res) {
      setMsg(res.message || 'Something went wrong.');
    }
  }

  return (
    <div className="rounded-2xl shadow-xl bg-white p-4 w-80">
      <h3 className="text-lg font-semibold mb-2">
        {mode === 'signin' ? 'Sign in with Email' : mode === 'signup' ? 'Create account' : 'Reset password'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            className="w-full mt-1 input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        {mode !== 'reset' && (
          <label className="block text-sm">
            Password
            <input
              type="password"
              required
              minLength={6}
              className="w-full mt-1 input"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>
        )}

        {msg && <div className="text-xs text-red-600">{msg}</div>}

        <div className="flex items-center justify-between mt-3">
          <button type="button" className="btn btn-white btn-sm" onClick={() => onClose?.()} disabled={busy}>
            Cancel
          </button>
          <div className="flex gap-2">
            {mode === 'signin' && (
              <button type="button" className="btn btn-white btn-sm" onClick={() => setMode('reset')} disabled={busy}>
                Forgot?
              </button>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {mode === 'signin' ? 'Sign in'
                : mode === 'signup' ? 'Create'
                : 'Send link'}
            </button>
          </div>
        </div>
      </form>

      <div className="text-xs mt-3">
        {mode === 'signin' ? (
          <>New here? <button className="btn btn-white btn-sm underline" onClick={() => setMode('signup')}>Create an account</button></>
        ) : mode === 'signup' ? (
          <>Already have an account? <button className="btn btn-white btn-sm underline" onClick={() => setMode('signin')}>Sign in</button></>
        ) : (
          <button className="underline" onClick={() => setMode('signin')}>Back to sign in</button>
        )}
      </div>
    </div>
  );
}
