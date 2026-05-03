import React, { useEffect, useRef, useState } from "react";

/**
 * Postcode Pursuit – Cookie Consent Manager
 *
 * What it does
 * - Blocks the UI with an overlay on first visit until the user chooses.
 * - Lets users Accept all, Reject non‑essential, or Customise.
 * - Stores choice in localStorage (pp_consents) with a schema + version.
 * - Only enables Google Analytics (gtag) if analytics consent is true.
 * - Queues gtag events until consent is given, then flushes.
 *
 * Usage
 * 1) Remove any static GA tag from index.html. We'll inject it after consent.
 * 2) Place <ConsentManager measurementId={"G-XXXXXXX"} /> high in your tree
 *    (e.g., in App.jsx) so it renders above everything else.
 * 3) Optional: pass `policyUrl` to link your cookie/privacy policy.
 */

const STORAGE_KEY = "pp_consents";
const SCHEMA_VERSION = 1; // bump if schema changes



// Types
// ConsentShape = { version:number, timestamp:number, choices: { necessary:true, analytics:boolean } }

function readConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== SCHEMA_VERSION) return null; // ignore old schemas
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(choices) {
  const payload = {
    version: SCHEMA_VERSION,
    timestamp: Date.now(),
    choices: { necessary: true, analytics: !!choices.analytics },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}



// --- Google Analytics gating ----------------------------------------------
// We install a temporary gtag stub to queue events until real GA is enabled.
(function ensureGtagQueue() {
  if (typeof window === "undefined") return;
  if (!window.dataLayer) window.dataLayer = [];
  if (!window.gtag) {
    const queued = [];
    const stub = function () { queued.push(arguments); };
    stub.__queue = queued;
    window.gtag = stub;
  }
})();

function enableAnalytics(measurementId) {
  if (!measurementId || typeof document === "undefined") return;
  if (window.__gaInit) return;
  window.__gaInit = true;

  // 1) Capture any queued calls from the stub (if present)
  const queued = (window.gtag && window.gtag.__queue) ? [...window.gtag.__queue] : [];

  // 2) Load GA script
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);

  // 3) Install the REAL gtag that pushes to dataLayer
  window.dataLayer = window.dataLayer || [];
  function realGtag(){ window.dataLayer.push(arguments); }
  window.gtag = realGtag;                 // <-- overwrite the stub
  delete window.gtag.__queue;             // cleanup in case it existed

  // 4) Bootstrap + initial config (this will also send initial page_view)
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });

  // 5) Flush any calls that happened before consent
  queued.forEach(args => window.gtag.apply(null, args));
}

// --- Accessibility helpers --------------------------------------------------
function useFocusTrap(active) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    // Save previously focused element
    const prev = document.activeElement;

    // Focus the first focusable element
    const focusables = root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length) focusables[0].focus();

    function handleKey(e) {
      if (e.key !== "Tab") return;
      const f = Array.from(focusables);
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function preventScroll(e) { e.preventDefault(); }

    root.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden"; // lock background scroll
    document.addEventListener("wheel", preventScroll, { passive: false });
    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      root.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      document.removeEventListener("wheel", preventScroll);
      document.removeEventListener("touchmove", preventScroll);
      if (prev && prev.focus) prev.focus();
    };
  }, [active]);
  return ref;
}

export default function ConsentManager({ measurementId, policyUrl }) {
  const existing = readConsent();
  const [open, setOpen] = useState(!existing);
  const [customise, setCustomise] = useState(false);

 const [analytics, setAnalytics] = useState(
  () => existing?.choices?.analytics ?? false
);

  const dialogRef = useFocusTrap(open);


  // Enable analytics immediately if previously granted
  useEffect(() => {
    if (existing?.choices?.analytics) enableAnalytics(measurementId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(choice) {
    const payload = writeConsent(choice);
    if (payload.choices.analytics) enableAnalytics(measurementId);
    setOpen(false);
    window.dispatchEvent(new Event("pp:consent:resolved"));
  }

useEffect(() => {
  const onOpen = () => setOpen(true);
  window.addEventListener('pp:consent:open', onOpen);
  return () => window.removeEventListener('pp:consent:open', onOpen);
}, []);
  
if (!open) return null;

return (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="cookie-title"
    // Inline layout styles so it always behaves like a blocking overlay
    style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 2147483646,              // above everything
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {/* Backdrop */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(2px)",
      }}
    />

    {/* Dialog */}
    <div
      ref={dialogRef}
      // Keep Tailwind classes for nice styling if available…
      className="relative mx-4 w-[min(760px,100%)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
      // …but also give sane fallbacks so it looks fine without Tailwind.
      style={{
        position: "relative",
        maxWidth: 760,
        width: "min(760px, 100%)",
        borderRadius: 16,
        background: "slate",
        boxShadow: "0 20px 40px rgba(0,0,0,.18)",
        padding: 24,
      }}
    >
      <h2 id="cookie-title" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
        Cookies & data usage
      </h2>
      <p style={{ marginTop: 8, lineHeight: 1.5 }}>
        We use <b>necessary</b> cookies to run the site. With your permission, we’d also like to use
        <b> analytics</b> (Google Analytics) to understand usage and improve Postcode Pursuit. You can change your choice any time in Settings.
      </p>

      {/* Buttons */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => commit({ analytics: false })}
          style={{ padding: "10px 14px", borderRadius: 12, background: "#494a4bff", border: 0, fontWeight: 600 }}
        >
          Reject non-essential
        </button>
        <button
          type="button"
          onClick={() => commit({ analytics: true })}
          style={{ padding: "10px 14px", borderRadius: 12, background: "#ffffffff", color: "black", border: 0, fontWeight: 700 }}
        >
          Accept all
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setCustomise(v => !v)}
          aria-expanded={customise}
          aria-controls="customise-panel"
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #5d677cff", background: "#111397ff", fontWeight: 600 }}
        >
          {customise ? "Hide options" : "Customise"}
        </button>
      </div>

{customise && (
  <>
    <div id="customise-panel" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#0e3358ff", border: "1px solid #e5e7eb" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <input type="checkbox" checked readOnly /> <span><b>Necessary</b> — required to make the site work (always on)</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} /> <span><b>Analytics</b> — helps us understand how the game is used</span>
      </label>
    </div>

    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => commit({ analytics })}
        style={{ padding: "10px 14px", borderRadius: 12, background: "#ffffffff", color: "black", border: 0, fontWeight: 700 }}
      >
        Save preferences
      </button>
    </div>
  </>

      )}

      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
        {policyUrl ? (
          <a href={policyUrl}>Read our Cookie & Privacy Policy</a>
        ) : (
          <span>Tip: pass a <code>policyUrl</code> to link your policy.</span>
        )}
      </div>
    </div>
  </div>
);
}

// --- Helper: hook to read consent elsewhere in the app ----------------------
export function useCookieConsent() {
  const [consent, setConsent] = useState(() => readConsent()?.choices ?? { necessary: true, analytics: false });
  useEffect(() => {
    function onStorage(e) {
      if (e.key === STORAGE_KEY) {
        const now = readConsent();
        if (now) setConsent(now.choices);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return consent; // { necessary:true, analytics:boolean }
}

// --- Optional: expose a safe gtag wrapper you can import around the app -----
export function gtagSafe() {
  // Always define; will no-op until GA is enabled (after consent)
  if (typeof window === "undefined" || !window.gtag) return () => {};
  return window.gtag;
}
