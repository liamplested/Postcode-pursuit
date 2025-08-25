import React from 'react';
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto p-6 prose prose-slate">
      <h1>Privacy & Cookie Policy</h1>
      <p><em>Last updated: 22 August 2025</em></p>

      <h2>Who we are</h2>
      <p>
        Postcode Pursuit is a hobby project, made by Liam Plested. Contact: 
        <a href="mailto:plestedl@gmail.com"> plestedl@gmail.com</a>.
      </p>

      <h2>What data we collect</h2>
      <ul>
        <li><b>Necessary data/cookies</b> to run the site (e.g., remembering game state, tutorial completion).</li>
        <li><b>Optional analytics</b> (Google Analytics 4) only if you opt in.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We set necessary cookies for core functionality. If you opt in to analytics, GA4 may set 
        additional cookies to help us understand usage patterns.
      </p>

      <h2>Analytics (opt-in)</h2>
      <p>
        If you consent, we use Google Analytics 4 to measure usage, and to track trends to see if puzzles need to made easier, more difficult, etc. IP anonymisation is 
        enabled. You can revoke consent any time in <a href="/settings">Settings</a>.
      </p>

      <h2>Data retention</h2>
      <p>
        Game-related local storage (e.g., streaks, tutorial completion) stays on your device. Aggregated
        analytics data is retained per Google’s defaults.
      </p>

      <h2>Your rights</h2>
      <p>
        Under UK GDPR, you may have rights to access, rectify, or erase your personal data. 
        Contact us at the email above.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this page as the project evolves. Material changes will be indicated by updating the date above.
      </p>
<div className="not-prose mt-6">
  <Link to="/" className="btn btn-primary">
    Return to Menu
  </Link>
</div>
    </div>
  );
}
