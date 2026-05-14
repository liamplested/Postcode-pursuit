import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AboutPage({ onBack }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate('/', { replace: true });
  };

  return (
    <div className="pp-info-page mx-auto max-w-3xl p-6">
      <div className="pp-page-header">
        <button className="btn btn-primary" onClick={handleBack} aria-label="Back">
          &larr; Back
        </button>
        <h1>About Postcode Pursuit</h1>
      </div>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <p>
          <strong>Postcode Pursuit</strong> is a daily UK geography puzzle. Start in one postcode area
          and reach the <strong>Target</strong> by moving through adjacent postcode areas. It is inspired by{' '}
          <a href="https://travle.earth" target="_blank" rel="noreferrer">
            Travle
          </a>.
        </p>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2>How it works</h2>
        <ul>
          <li>Move between neighbouring UK postcode areas.</li>
          <li>Dashed lines show ferry links.</li>
          <li>Solid lines show major bridges and tunnels.</li>
          <li>Reach the target in as few moves as possible.</li>
        </ul>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2>Difficulty modes</h2>
        <div className="pp-info-grid">
          <div>
            <h3>Easy</h3>
            <p>Outlines and labels always visible. Revisits and undo allowed.</p>
          </div>
          <div>
            <h3>Normal</h3>
            <p>Outlines visible; labels shown for Start and visited areas. Revisits and undo allowed.</p>
          </div>
          <div>
            <h3>Hard</h3>
            <p>No outlines or labels. No revisits. No undo.</p>
          </div>
          <div>
            <h3>Master</h3>
            <p>Only start, current, visited and target areas are shown. No revisits. No undo.</p>
          </div>
        </div>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2>Daily Challenge</h2>
        <ul>
          <li>Choose one difficulty each day.</li>
          <li>Your progress is saved automatically, so you can resume later.</li>
          <li>You get up to 3 hints per day for each difficulty.</li>
          <li>Streaks are tracked separately for each difficulty.</li>
          <li>You can share your result once you finish.</li>
        </ul>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2>Scoring, stats and achievements</h2>
        <ul>
          <li>Each daily puzzle has a Par based on the optimal route.</li>
          <li>The Stats page shows wins, win rate, average moves, best time and average vs Par.</li>
          <li>Unlock achievements for harder wins, perfect routes, long journeys, ferries, bridges, coverage and streaks.</li>
          <li>Some achievements stay hidden until you discover them.</li>
        </ul>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2>Controls</h2>
        <ul>
          <li>Type a neighbouring postcode area and press Enter.</li>
          <li>Use the map controls to zoom or reset the view.</li>
          <li>Open the menu for New Game, Restart, Tutorial and more.</li>
          <li>Ctrl/Cmd + Z undoes a move where undo is available.</li>
        </ul>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2>Privacy & data</h2>
        <ul>
          <li>Your progress, stats, achievements, coverage and streaks are stored locally in your browser.</li>
          <li>Clearing site data, switching browser or using another device can reset your progress.</li>
        </ul>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2>Thanks</h2>
        <p>
          Thanks to Shabi, Szilard, Taneisha and Chris W for early feedback that helped shape different parts of the game.
        </p>
      </section>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <h2>Feedback</h2>
        <p>Got feedback, spotted a bug, or have an idea for the game?</p>
        <a
          href="https://forms.gle/Hf6fgRzBSnnZCqYJ6"
          className="btn btn-primary inline-flex"
        >
          Send feedback
        </a>
        <div className="mt-4 text-xs opacity-50">
          <a href="#/challenges">Experimental challenges</a>
        </div>
      </section>
    </div>
  );
}
