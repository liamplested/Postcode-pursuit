import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ConsentManager from "./components/ConsentManager";
import PostcodePursuit from "./PostcodePursuit";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import './index.css';

function initGA(id) {
  if (window.__gaInit) return;
  window.__gaInit = true;

  // Load GA script
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=G-9N7KBCD3G3`;
  document.head.appendChild(s);

  // Bootstrap gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', id, {
    anonymize_ip: true,
    allow_google_signals: false,
  });
}
const MEASUREMENT_ID = "G-9N7KBCD3G3";

function RouteChangeTracker() {
  const location = useLocation();
  useEffect(() => {
    // Send SPA page_view on every route change
    window.gtag?.('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  useEffect(() => {
    // 1) If consent already granted from a past visit, init immediately
    try {
      const consents = JSON.parse(localStorage.getItem('pp_consents') || '{}');
      if (consents?.analytics === true) initGA(MEASUREMENT_ID);
    } catch {}

    // 2) Listen for your consent manager’s “analytics granted” signal
    const onAnalyticsGranted = () => initGA(MEASUREMENT_ID);
    // Use the exact event your ConsentManager emits:
    window.addEventListener('pp:consent:analytics_granted', onAnalyticsGranted);
    window.addEventListener('pp:consent:resolved', onAnalyticsGranted); // belt & braces if you use this

    return () => {
      window.removeEventListener('pp:consent:analytics_granted', onAnalyticsGranted);
      window.removeEventListener('pp:consent:resolved', onAnalyticsGranted);
    };
  }, []);

return (
  <BrowserRouter>
<div className="app-root">
  <ConsentManager measurementId={MEASUREMENT_ID} policyUrl="/privacy" />
  <RouteChangeTracker />

  <div className="app-shell">
    <Routes>
      <Route path="/" element={<PostcodePursuit />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
    </Routes>
      </div>
    </div>
  </BrowserRouter>
);
}