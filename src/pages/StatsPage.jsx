import React, { useEffect, useState } from 'react';
import { ChartColumnBig, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

const ROW_STYLE = {
  easy:   'diff-easy',
  normal: 'diff-normal',
  hard:   'diff-hard',
  master: 'diff-master',
};

const BAR_TINT = {
  easy:   'bg-emerald-400/80',
  normal: 'bg-amber-400/80',
  hard:   'bg-orange-400/80',
  master: 'bg-violet-400/80',
};

const DIFFS = ['easy', 'normal', 'hard', 'master'];
const DIFF_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard', master: 'Master' };


function zeroStats() {
  return {
    totalGames: 0,
    winRate: 0,
    avgMoves: '—',
    bestTime: null,
    byDiff: DIFFS.map(d => ({ difficulty: d, games: 0, wins: 0 })),
  };
}

function fmt(ms) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

function fmtPar(x) {
  if (x === null || x === undefined) return '—';
  const v = Number(x);
  if (!Number.isFinite(v)) return '—';

  // Treat tiny values as even (handles rounding noise)
  if (Math.abs(v) < 0.05) return 'Even';

  const mag = Math.abs(v).toFixed(1).replace(/\.0$/, ''); // e.g. 3.0 -> 3
  return v < 0 ? `${mag} under` : `${mag} over`;
}

export default function StatsPage({
  stats,
  onBack,
  onResetAll = undefined,
  onResetStats = undefined,
}) {
  const [viewStats, setViewStats] = useState(stats || zeroStats());
  const [showReset, setShowReset] = useState(false);
  const [alsoResetStreaks, setAlsoResetStreaks] = useState(true);

  useEffect(() => {
    setViewStats(stats || zeroStats());
  }, [stats]);

  return (
    <div
      data-page="stats"
      className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50"
    >
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3">
            <button className="btn btn-primary rounded-lg" onClick={onBack} aria-label="Back">← Back</button>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-50 flex items-center gap-2">
              <ChartColumnBig className="w-5 h-5" /> Statistics
            </h1>
          </div>
          <button
            className="btn btn-warn rounded-lg inline-flex items-center gap-2"
            onClick={() => setShowReset(true)}
            title="Reset all recorded stats"
          >
            <Trash2 className="w-4 h-4" />
            Reset stats
          </button>
        </div>

        {/* Panel */}
        <div className="glass glass-panel p-6 md:p-8 space-y-8">
          {/* KPI grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="glass-tile">
              <div className="stat-label">Total games</div>
              <div className="stat-value">{viewStats.totalGames}</div>
            </div>
            <div className="glass-tile">
              <div className="stat-label">Win rate</div>
              <div className="stat-value">{viewStats.winRate}%</div>
            </div>
            <div className="glass-tile">
              <div className="stat-label">Avg moves (wins)</div>
              <div className="stat-value">{viewStats.avgMoves}</div>
            </div>
            <div className="glass-tile">
              <div className="stat-label">Best time</div>
              <div className="stat-value">{fmt(viewStats.bestTime)}</div>
            </div>
                <div className="glass-tile">
                <div className="stat-label">Avg vs Par (wins)</div>
               <div className="stat-value">{fmtPar(viewStats.avgVsPar)}</div>
            </div>
          </div>

          {/* Difficulty table */}
          <div>
            <h3 className="font-semibold text-white mb-3">By difficulty</h3>
            <div className="glass-table rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-head">
                    <th className="text-left py-2.5 px-3">Difficulty</th>
                    <th className="text-right py-2.5 px-3">Games</th>
                    <th className="text-right py-2.5 px-3">Wins</th>
                    <th className="text-right py-2.5 px-3">Win %</th>
                    <th className="text-right py-2.5 px-3">Par</th>
                  </tr>
                </thead>
                <tbody>
                  {viewStats.byDiff.map((row) => {
                    const pct = row.games ? Math.round((row.wins / row.games) * 100) : 0;
                    return (
                      <tr key={row.difficulty} className={`table-row ${ROW_STYLE[row.difficulty] || ''}`}>
                        <td className="py-2.5 px-3 font-medium">{DIFF_LABEL[row.difficulty] ?? row.difficulty}</td>
                        <td className="py-2.5 px-3 text-right">{row.games}</td>
                        <td className="py-2.5 px-3 text-right">{row.wins}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <span className="tabular-nums">{pct}%</span>
                            <div className="h-2 w-24 rounded bg-white/15 overflow-hidden" aria-hidden>
                              <div
                                className={`h-full ${BAR_TINT[row.difficulty] || 'bg-slate-400/80'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                             <td className="py-2.5 px-3 text-right">
       <span className="tabular-nums">
         {fmtPar(row.avgVsPar)}
       </span>
     </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      

      {/* Reset overlay (portal) */}
 {showReset && createPortal(
   <div
     role="dialog"
     aria-modal="true"
     onClick={() => setShowReset(false)}
     className="fixed inset-0 flex items-start justify-center"
     style={{
       position: 'fixed',
       inset: 0,
       background: 'rgba(0,0,0,0.6)',
       padding: '10vh 16px 16px',
       zIndex: 2147483647,   // match the victory modal
     }}
   >
          <div
            className="glass p-6 md:p-7 rounded-2xl shadow-xl text-left max-w-md w-[92vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-2">Reset statistics?</h2>
<p className="mb-4 text-sm text-slate-700">
  This will permanently delete:
  <br />• All game history (wins, times, moves)
  <br />• All unlocked achievements
  <br />• Your visited areas progress (reset to 0)
</p>

            <label className="flex items-center gap-2 mb-5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-indigo-500"
                checked={alsoResetStreaks}
                onChange={(e) => setAlsoResetStreaks(e.target.checked)}
              />
              <span className="text-slate-100">Also reset daily streaks</span>
            </label>

            <div className="flex gap-2 justify-end">
              <button className="btn btn-neutral" onClick={() => setShowReset(false)}>Cancel</button>
              <button
  className="btn btn-warn"
  onClick={() => {
    onResetAll?.({ alsoResetStreaks });
    setShowReset(false);
  }}
>
  Yes, reset everything
</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
