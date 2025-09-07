// src/components/StatsModal.jsx
import React from 'react';
import ModalShell from './ModalShell';

export default function StatsModal({ open, onClose, stats }) {
  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Statistics">
      <div className="p-5">
        <h2 className="text-xl font-semibold mb-4">Statistics</h2>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="glass glass--white rounded-xl p-3">
            <div className="text-slate-500">Total games</div>
            <div className="text-xl font-semibold">{stats.totalGames}</div>
          </div>
          <div className="glass glass--white rounded-xl p-3">
            <div className="text-slate-500">Win rate</div>
            <div className="text-xl font-semibold">{stats.winRate}%</div>
          </div>
          <div className="glass glass--white rounded-xl p-3">
            <div className="text-slate-500">Avg moves (wins)</div>
            <div className="text-xl font-semibold">{stats.avgMoves}</div>
          </div>
          <div className="glass glass--white rounded-xl p-3">
            <div className="text-slate-500">Best time</div>
            <div className="text-xl font-semibold">
              {stats.bestTime ? `${Math.round(stats.bestTime / 1000)}s` : '—'}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="font-semibold mb-2">By difficulty</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-600">
                <th className="text-left py-2">Difficulty</th>
                <th className="text-right py-2">Games</th>
                <th className="text-right py-2">Wins</th>
              </tr>
            </thead>
            <tbody>
              {stats.byDiff.map((row) => (
                <tr key={row.difficulty} className="border-t border-slate-200/40">
                  <td className="py-2 font-medium">{row.difficulty}</td>
                  <td className="py-2 text-right">{row.games}</td>
                  <td className="py-2 text-right">{row.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5">
          <button className="btn btn-primary w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </ModalShell>
  );
}
