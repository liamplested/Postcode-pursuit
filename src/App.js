import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ConsentManager from "./components/ConsentManager";
import PostcodePursuit from "./PostcodePursuit";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import './index.css';


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