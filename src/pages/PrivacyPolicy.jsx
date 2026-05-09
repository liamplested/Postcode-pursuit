import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy({ onBack }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate("/", { replace: true });
  };

  return (
    <div className="page">
      <div className="pp-page-header">
        <button onClick={handleBack} className="btn btn-primary" aria-label="Back">
          &larr; Back
        </button>
        <h1>Privacy Policy</h1>
      </div>
      <p><b>Last updated: 23 April 2026</b></p>

      <p>
        Postcode Pursuit is a browser-based game. We keep data collection to a minimum 
        and only use what’s needed to run the game and understand how it’s being used.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Gameplay data (moves, progress, achievements)</li>
        <li>Basic usage data (for example, which pages are visited)</li>
        <li>Account-related data if you choose to sign in</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the game and save your progress</li>
        <li>To improve the experience over time</li>
        <li>To understand how people are using the game</li>
      </ul>

      <h2>Analytics</h2>
      <p>
        We use Google Analytics (GA4) to understand how the game is used. This may 
        involve cookies or similar technologies.
      </p>
      <p>
        Analytics is only enabled if you give consent. You can choose this when you first 
        visit the site, and change your preference later.
      </p>

      <h2>Accounts and cloud storage</h2>
      <p>
        If you sign in, your progress (including achievements and stats) may be stored 
        using Firebase, a service provided by Google. This allows your progress to sync 
        across devices.
      </p>

      <h2>Local storage</h2>
      <p>
        We also store some data directly in your browser (local storage) so the game can 
        remember your progress and settings without requiring an account.
      </p>

      <h2>Data sharing</h2>
      <p>
        We do not sell your data. We only share data with services we rely on to run the 
        game, such as Google Analytics and Firebase.
      </p>

      <h2>Where data is processed</h2>
      <p>
        Some data may be processed outside of the United Kingdom (for example, by Google 
        services).
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can choose whether to enable analytics</li>
        <li>You can play without signing in</li>
        <li>You can clear stored data at any time via your browser</li>
      </ul>

      <h2>Changes</h2>
      <p>
        This policy may change as the game evolves. The latest version will always be 
        available here.
      </p>

      <h2>Contact</h2>
<p>
  If you have any questions about this policy or how your data is handled, 
  you can contact us at <br />

  <a 
  href="mailto:plestedl@gmail.com"
  style={{ color: "#7dd3fc", textDecoration: "underline" }}
>
   plestedl@gmail.com
</a>
</p>

      <a
        href="https://forms.gle/Hf6fgRzBSnnZCqYJ6"
        className="mt-3 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
      >
        Send feedback
      </a>
    </div>
  );
}
