import React from 'react';
import ModalShell from './ModalShell.jsx';

function formatBest(ms) {
  if (!ms || !Number.isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

export default function StatsModal({ open, onClose, stats }) {
  const s = stats || {
    totalGames: 0, winRate: 0, avgMoves: '—', bestTime: null, byDiff: []
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="stats-title">
      <div className="flex items-center justify-between mb-3">
        <h2 id="stats-title" className="text-xl font-semibold">Your Stats</h2>
        <button className="btn btn-neutral" onClick={onClose}>Close</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3 bg-white/10">
          <div className="text-xs opacity-80">Played</div>
          <div className="text-lg font-semibold">{s.totalGames} games</div>
        </div>
        <div className="rounded-xl p-3 bg-white/10">
          <div className="text-xs opacity-80">Win rate</div>
          <div className="text-lg font-semibold">{s.winRate}%</div>
        </div>
        <div className="rounded-xl p-3 bg-white/10">
          <div className="text-xs opacity-80">Avg moves (wins)</div>
          <div className="text-lg font-semibold">{s.avgMoves}</div>
        </div>
        <div className="rounded-xl p-3 bg-white/10">
          <div className="text-xs opacity-80">Best time</div>
          <div className="text-lg font-semibold">{formatBest(s.bestTime)}</div>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-1">By difficulty</h3>
      <ul className="text-sm">
        {(s.byDiff || []).map(r => (
          <li key={r.difficulty} className="flex justify-between py-1">
            <span className="capitalize">{r.difficulty}:</span>
            <span>{r.wins} wins</span>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
