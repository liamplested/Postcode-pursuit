import React from 'react';
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto p-6 prose prose-slate">
      <h1>Privacy & Cookie Policy</h1>
      <p><em>Last updated: 19 September 2025</em></p>

      <h2>Who we are</h2>
      <p>
        <strong>Postcode Pursuit</strong> is a hobby project made by Liam Plested.
        Contact: <a href="mailto:plestedl@gmail.com">plestedl@gmail.com</a>.
      </p>

      <h2>What data we collect</h2>
      <ul>
        <li>
          <b>Account (Google Sign-In)</b>: if you choose to sign in, we receive your Google UID,
          display name, email address, and profile photo URL (if available) via Firebase Authentication.
        </li>
        <li>
          <b>Gameplay & progress (cloud save)</b>: achievements, game history (start/target, result, date, moves),
          daily <i>streaks per difficulty</i> (easy/normal/hard/master), and lifetime stats
          (visited postcode areas and counts of ferry/bridge/land moves).
        </li>
        <li>
          <b>Local storage on your device</b>: we store the same progress data for offline use,
          preferences (e.g., difficulty, hints, UI toggles), tutorial completion, and an anonymous
          install ID to keep per-device counters consistent.
        </li>
        <li>
          <b>Necessary data/cookies</b> to run the site (e.g., session state, security, load balancing).
        </li>
        <li>
          <b>Optional analytics</b> (Google Analytics 4) only if you opt in.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We set essential cookies/storage needed for core functionality (e.g., remembering game state).
        If you opt in to analytics, GA4 may set additional cookies to help us understand usage patterns.
      </p>

      <h2>Authentication & cloud saves</h2>
      <p>
        We use Google Firebase to provide Google Sign-In and to sync your progress across devices.
        Your cloud save is stored under your Firebase user ID and secured by Firestore security rules.
        You can play signed out; cloud sync is optional.
      </p>

      <h2>Analytics (opt-in)</h2>
      <p>
        If you consent, we use Google Analytics 4 to measure usage and spot trends (e.g., puzzle difficulty).
        IP anonymisation is enabled. You can revoke consent any time in <Link to="/settings">Settings</Link>.
      </p>

      <h2>How we use your data</h2>
      <ul>
        <li>Run the game, save progress, and keep it in sync across devices.</li>
        <li>Remember settings and improve the experience.</li>
        <li>Maintain security and diagnose issues.</li>
      </ul>
      <p>We do <strong>not</strong> sell your personal data or use third-party advertising.</p>

      <h2>Where your data is stored</h2>
      <p>
        We use Google Firebase (Authentication and Cloud Firestore). Data is stored in the region
        configured for our Firebase project and may be processed globally by our providers
        using appropriate transfer safeguards.
      </p>

      <h2>Sharing</h2>
      <p>
        We share data with service providers only to operate the Service:
        Google Firebase (auth & database) and our hosting/CDN (e.g., Netlify).
        We may disclose information if required by law or to protect rights and safety.
      </p>

      <h2>Data retention</h2>
      <ul>
        <li><b>Cloud data (Firestore)</b>: kept until you delete your cloud save or ask us to remove it.</li>
        <li><b>Local storage</b>: remains on your device until you clear it (via your browser or in-app controls).</li>
        <li><b>Analytics</b>: retained per Google’s defaults when enabled by you.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Under UK GDPR, you may have rights to access, rectify, erase, restrict or object to processing,
        and data portability. You can export or delete your cloud data via in-app controls (where available)
        or by emailing <a href="mailto:plestedl@gmail.com">plestedl@gmail.com</a>.
      </p>

      <h2>Children</h2>
      <p>This game is not directed to children under 13.</p>

      <h2>Changes</h2>
      <p>
        We may update this page as the project evolves. Material changes will be indicated by updating the date above.
      </p>

      <div className="not-prose mt-6 flex gap-3">
        <Link to="/settings" className="btn btn-white">Settings</Link>
        <Link to="/" className="btn btn-primary">Return to Menu</Link>
      </div>
    </div>
  );
}
