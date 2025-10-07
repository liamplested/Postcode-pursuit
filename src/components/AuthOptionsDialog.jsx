import React from 'react';
import { auth } from '../firebase';
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import useAuth from '../hooks/useAuth';
import EmailAuthDialog from './EmailAuthDialog';
import { Apple, Facebook, LogIn, Mail, Chrome } from 'lucide-react';

// ----- provider setup -----
const PROVIDERS = {
  google:   () => new GoogleAuthProvider(),
  apple:    () => new OAuthProvider('apple.com'),
  facebook: () => new FacebookAuthProvider(),
  // add more here as needed...
};

const ICONS = {
  google:   <Chrome className="w-4 h-4" />,
  apple:    <Apple className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
};

const LABELS = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
};

const LAST_KEY = 'pp_last_provider';

// crude iOS Safari detect (use redirect there)
const isIOSWebkit = (() => {
  const ua = navigator.userAgent || '';
  return /(iPad|iPhone|iPod)/.test(ua) || (/(Macintosh)/.test(ua) && 'ontouchend' in document);
})();

export default function AuthOptionsDialog({ onClose }) {
  const { isSigningIn } = useAuth(); // just to disable while busy
  const [more, setMore] = React.useState(false);
  const [showEmail, setShowEmail] = React.useState(false);

  // pick primary: last used → Apple on iOS/mac → Google
  const last = localStorage.getItem(LAST_KEY);
  const primary =
    (last && PROVIDERS[last] ? last :
    (isIOSWebkit && PROVIDERS.apple ? 'apple' : 'google'));

  const others = Object.keys(PROVIDERS).filter((k) => k !== primary);

  async function doFederated(providerKey) {
    const make = PROVIDERS[providerKey];
    if (!make) return;
    const provider = make();
    try {
      if (isIOSWebkit) await signInWithRedirect(auth, provider);
      else await signInWithPopup(auth, provider);
      localStorage.setItem(LAST_KEY, providerKey);
      onClose?.();
    } catch (e) {
      // benign popup errors are fine to ignore; others log
      const code = e?.code || '';
      if (!/popup-closed-by-user|cancelled-popup-request|popup-blocked/i.test(code)) {
        console.warn('Federated sign-in failed:', code, e);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-4 w-[min(92vw,360px)]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-3">Sign in</h3>

        {/* Primary single CTA */}
        <button
          type="button"
          disabled={isSigningIn}
          onClick={() => doFederated(primary)}
          className={`btn btn-green w-full inline-flex items-center justify-center gap-2 ${isSigningIn ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {ICONS[primary] ?? <LogIn className="w-4 h-4" />}
          <span>Continue with {LABELS[primary] || primary}</span>
        </button>

        {/* Divider */}
        <div className="my-3 flex items-center gap-3">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-xs uppercase tracking-wide text-slate-500">or</span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        {/* More options (collapsed by default) */}
        {!more ? (
          <button
            type="button"
            onClick={() => setMore(true)}
            className="btn btn-white w-full"
          >
            More sign-in options
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {others.map((k) => (
              <button
                key={k}
                type="button"
                disabled={isSigningIn}
                onClick={() => doFederated(k)}
                className="btn btn-white btn-sm inline-flex items-center justify-center gap-2"
                title={`Sign in with ${LABELS[k] || k}`}
              >
                {ICONS[k] ?? <LogIn className="w-4 h-4" />}
                <span>{LABELS[k] || k}</span>
              </button>
            ))}

            {/* Email lives here too */}
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="btn btn-white btn-sm inline-flex items-center justify-center gap-2 col-span-2"
              title="Sign in with Email"
            >
              <Mail className="w-4 h-4" />
              <span>Email &amp; password</span>
            </button>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button className="btn btn-white btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>

      {showEmail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30" onClick={() => setShowEmail(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <EmailAuthDialog onClose={() => setShowEmail(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
