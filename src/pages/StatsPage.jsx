import React, { useEffect, useState, useMemo } from 'react';
import { ChartColumnBig, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

import { bridgeLinks, ferryLinks, postcodeAreas } from '../postcodeAreas';
import {
  META_KEY,
  USED_BRIDGES_KEY,
  USED_FERRIES_KEY,
  VISITED_KEY,
  canonEdge,
  readJSON,
  writeJSON,
} from '../utils/storageUtils';

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
    avgVsPar: null,
    byDiff: DIFFS.map(d => ({ difficulty: d, games: 0, wins: 0, avgVsPar: null })),
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

  if (Math.abs(v) < 0.05) return 'Even';

  const mag = Math.abs(v).toFixed(1).replace(/\.0$/, ''); // 3.0 → 3
  return v < 0 ? `${mag} under` : `${mag} over`;
}

function readMeta() {
  try {
    return readJSON(META_KEY, {}) || {};
  } catch {
    return {};
  }
}

function objectMapFromStored(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((x) => [x, true]));
  }

  if (value && typeof value === 'object') return value;
  return {};
}

function edgeLabel(edge) {
  return `${edge.a} ↔ ${edge.b}`;
}

function buildEdgeCoverage(links, usedMap) {
  const seen = new Set();

  return (links || [])
    .map((edge) => ({ ...edge, key: canonEdge(edge.a, edge.b) }))
    .filter((edge) => {
      if (!edge.key || seen.has(edge.key)) return false;
      seen.add(edge.key);
      return true;
    })
    .sort((a, b) => edgeLabel(a).localeCompare(edgeLabel(b)))
    .map((edge) => ({ ...edge, used: Boolean(usedMap[edge.key]) }));
}

function CoveragePill({ children, used, type = undefined }) {
  return (
    <span className={`pp-coverage-pill ${used ? 'is-used' : 'is-unused'}`}>
      <span>{children}</span>
      {type && <span className="pp-coverage-edge-type">{type}</span>}
    </span>
  );
}

function CoverageCodeSection({ visitedCodes, unvisitedCodes }) {
  return (
    <div className="pp-coverage-columns">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-100">Visited</h3>
        {visitedCodes.length === 0 ? (
          <p className="text-xs text-slate-400">No areas visited yet.</p>
        ) : (
          <div className="pp-coverage-pill-list">
            {visitedCodes.map((code) => (
              <CoveragePill key={code} used>
                {code}
              </CoveragePill>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-100">Not yet visited</h3>
        {unvisitedCodes.length === 0 ? (
          <p className="text-xs text-slate-300">You've visited every area.</p>
        ) : (
          <div className="pp-coverage-pill-list">
            {unvisitedCodes.map((code) => (
              <CoveragePill key={code} used={false}>
                {code}
              </CoveragePill>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverageEdgeSection({ usedEdges, unusedEdges, usedTitle, unusedTitle }) {
  return (
    <div className="pp-coverage-columns">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-100">{usedTitle}</h3>
        {usedEdges.length === 0 ? (
          <p className="text-xs text-slate-400">None used yet.</p>
        ) : (
          <div className="pp-coverage-pill-list">
            {usedEdges.map((edge) => (
              <CoveragePill key={edge.key} used type={edge.type}>
                {edgeLabel(edge)}
              </CoveragePill>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2 text-slate-100">{unusedTitle}</h3>
        {unusedEdges.length === 0 ? (
          <p className="text-xs text-slate-300">Everything in this set has been used.</p>
        ) : (
          <div className="pp-coverage-pill-list">
            {unusedEdges.map((edge) => (
              <CoveragePill key={edge.key} used={false} type={edge.type}>
                {edgeLabel(edge)}
              </CoveragePill>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function useCoverage() {
  const meta = useMemo(() => readMeta(), []);

  const visitedMap = useMemo(
    () => ({
      ...objectMapFromStored(readJSON(VISITED_KEY, [])),
      ...objectMapFromStored(meta.visitedAreas || {}),
    }),
    [meta]
  );
  const usedFerriesMap = useMemo(
    () => ({
      ...objectMapFromStored(readJSON(USED_FERRIES_KEY, [])),
      ...objectMapFromStored(meta.usedFerries || {}),
    }),
    [meta]
  );
  const usedBridgesMap = useMemo(
    () => ({
      ...objectMapFromStored(readJSON(USED_BRIDGES_KEY, [])),
      ...objectMapFromStored(meta.usedBridges || {}),
    }),
    [meta]
  );

  const allCodes = useMemo(
    () => Object.keys(postcodeAreas).sort(),
    []
  );
  const ferryEdges = useMemo(
    () => buildEdgeCoverage(ferryLinks, usedFerriesMap),
    [usedFerriesMap]
  );
  const bridgeEdges = useMemo(
    () => buildEdgeCoverage(bridgeLinks, usedBridgesMap),
    [usedBridgesMap]
  );

  const visitedCodes = allCodes.filter(code => visitedMap[code]);
  const unvisitedCodes = allCodes.filter(code => !visitedMap[code]);
  const usedFerryEdges = ferryEdges.filter((edge) => edge.used);
  const unusedFerryEdges = ferryEdges.filter((edge) => !edge.used);
  const usedBridgeEdges = bridgeEdges.filter((edge) => edge.used);
  const unusedBridgeEdges = bridgeEdges.filter((edge) => !edge.used);

  return {
    visitedCodes,
    unvisitedCodes,
    visitedCount: visitedCodes.length,
    totalAreas: allCodes.length,
    ferryEdges,
    bridgeEdges,
    usedFerryEdges,
    unusedFerryEdges,
    usedBridgeEdges,
    unusedBridgeEdges,
  };
}

export default function StatsPage({
  stats,
  onBack,
  onResetAll = undefined,   // parent still handles stats/streaks/achievements
  onResetStats = undefined, // kept for compatibility if used elsewhere
}) {
  const [viewStats, setViewStats] = useState(stats || zeroStats());
  const [showReset, setShowReset] = useState(false);
  const [alsoResetStreaks, setAlsoResetStreaks] = useState(false);
  const [alsoResetCoverage, setAlsoResetCoverage] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [coverageTab, setCoverageTab] = useState('areas');

  const coverage = useCoverage();

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
            <button
              className="btn btn-primary rounded-lg"
              onClick={onBack}
              aria-label="Back"
            >
              ← Back
            </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="glass-tile">
              <div className="stat-label">Total games</div>
              <div className="stat-value">{viewStats.totalGames}</div>
            </div>
<div className="glass-tile">
  <div className="stat-label">Win count</div>
  <div className="stat-value">{viewStats.winCount}</div>
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

            {/* Visited postcode areas KPI */}
            <div className="glass-tile flex flex-col gap-1">
              <div className="stat-label">Visited postcode areas</div>
              <div className="stat-value">
                {coverage.visitedCount} / {coverage.totalAreas}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCoverageTab('areas');
                  setShowCoverage(true);
                }}
                className="btn-glass tint-blue"
              >
                View breakdown
              </button>
            </div>

            <div className="glass-tile flex flex-col gap-1">
              <div className="stat-label">Ferry routes used</div>
              <div className="stat-value">
                {coverage.usedFerryEdges.length} / {coverage.ferryEdges.length}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCoverageTab('ferries');
                  setShowCoverage(true);
                }}
                className="btn-glass tint-blue"
              >
                View breakdown
              </button>
            </div>

            <div className="glass-tile flex flex-col gap-1">
              <div className="stat-label">Bridges/tunnels used</div>
              <div className="stat-value">
                {coverage.usedBridgeEdges.length} / {coverage.bridgeEdges.length}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCoverageTab('bridges');
                  setShowCoverage(true);
                }}
                className="btn-glass tint-blue"
              >
                View breakdown
              </button>
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
                      <tr
                        key={row.difficulty}
                        className={`table-row ${ROW_STYLE[row.difficulty] || ''}`}
                      >
                        <td className="py-2.5 px-3 font-medium">
                          {DIFF_LABEL[row.difficulty] ?? row.difficulty}
                        </td>
                        <td className="py-2.5 px-3 text-right">{row.games}</td>
                        <td className="py-2.5 px-3 text-right">{row.wins}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <span className="tabular-nums">{pct}%</span>
                            <div
                              className="h-2 w-24 rounded bg-white/15 overflow-hidden"
                              aria-hidden
                            >
                              <div
                                className={`h-full ${
                                  BAR_TINT[row.difficulty] || 'bg-slate-400/80'
                                }`}
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

      {/* Coverage breakdown modal */}
      {showCoverage &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setShowCoverage(false)}
            className="fixed inset-0 flex items-start justify-center"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              padding: '8vh 16px 16px',
              zIndex: 2147483647,
            }}
          >
            <div
              className="glass p-6 md:p-7 rounded-2xl shadow-xl text-left max-w-3xl w-[96vw] max-h-[84vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-50">
                  Coverage breakdown
                </h2>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCoverage(false)}
                >
                  Close
                </button>
              </div>

              <p className="text-sm text-slate-200 mb-3">
                Visited <b>{coverage.visitedCount}</b> of{' '}
                <b>{coverage.totalAreas}</b> postcode areas, used{' '}
                <b>{coverage.usedFerryEdges.length}</b> of{' '}
                <b>{coverage.ferryEdges.length}</b> ferry routes, and used{' '}
                <b>{coverage.usedBridgeEdges.length}</b> of{' '}
                <b>{coverage.bridgeEdges.length}</b> bridge/tunnel routes.
              </p>

              <div className="pp-coverage-tabs" role="tablist" aria-label="Coverage breakdown">
                {[
                  ['areas', 'Postcodes'],
                  ['ferries', 'Ferries'],
                  ['bridges', 'Bridges'],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={coverageTab === tab}
                    className={coverageTab === tab ? 'is-active' : ''}
                    onClick={() => setCoverageTab(tab)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '1.5rem',
                  maxHeight: '60vh',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                }}
              >
                {coverageTab === 'areas' && (
                  <CoverageCodeSection
                    visitedCodes={coverage.visitedCodes}
                    unvisitedCodes={coverage.unvisitedCodes}
                  />
                )}
                {coverageTab === 'ferries' && (
                  <CoverageEdgeSection
                    usedEdges={coverage.usedFerryEdges}
                    unusedEdges={coverage.unusedFerryEdges}
                    usedTitle="Used ferry routes"
                    unusedTitle="Not yet used"
                  />
                )}
                {coverageTab === 'bridges' && (
                  <CoverageEdgeSection
                    usedEdges={coverage.usedBridgeEdges}
                    unusedEdges={coverage.unusedBridgeEdges}
                    usedTitle="Used bridges/tunnels"
                    unusedTitle="Not yet used"
                  />
                )}
                {false && (
                  <>
                {/* Visited column */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-slate-100">
                    Visited
                  </h3>
                  {coverage.visitedCodes.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No areas visited yet.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      {coverage.visitedCodes.map((code) => (
                        <span
                          key={code}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '999px',
                            background: 'rgba(0, 255, 115, 0.23)',
                            border: '1px solid rgba(42, 255, 35, 0.7)',
                          }}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unvisited column */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 text-slate-100">
                    Not yet visited
                  </h3>
                  {coverage.unvisitedCodes.length === 0 ? (
                    <p className="text-xs text-slate-300">
                      You’ve visited every area 🎉
                    </p>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      {coverage.unvisitedCodes.map((code) => (
                        <span
                          key={code}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '999px',
                            background: 'rgba(212, 125, 25, 0.38)',
                            border: '1px solid rgba(255, 123, 0, 0.8)',
                          }}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Reset overlay (portal) */}
      {showReset &&
        createPortal(
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
              zIndex: 2147483647,
            }}
          >
            <div
              className="glass p-6 md:p-7 rounded-2xl shadow-xl text-left max-w-md w-[92vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-2">Reset statistics?</h2>
              <p className="mb-4 text-sm text-slate-700">
                This will permanently delete:
                <br />• All game history, times and moves
                <br />• All unlocked achievements
                <br />• Daily streaks (if selected)
                <br />• Visited postcode areas (if selected)
              </p>

              <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={alsoResetStreaks}
                  onChange={(e) => setAlsoResetStreaks(e.target.checked)}
                />
                <span className="text-slate-100">
                  Also reset daily streaks
                </span>
              </label>
<br/>
              <label className="flex items-center gap-3 mt-1 text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoResetCoverage}
                  onChange={(e) => setAlsoResetCoverage(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">
                  Also reset coverage
                </span>
              </label>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  className="btn btn-neutral"
                  onClick={() => setShowReset(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-warn"
                  onClick={() => {
                    // Let parent handle stats / streaks / achievements as before
                    if (onResetAll) {
                      onResetAll({ alsoResetStreaks, alsoResetCoverage });
                    }

                    // Optional: reset coverage locally
                    if (alsoResetCoverage) {
                      writeJSON(META_KEY, {
                        visitedAreas: {},
                        visitedCount: 0,
                        usedFerries: {},
                        usedBridges: {},
                        usedFerriesCount: 0,
                        usedBridgesCount: 0,
                        countersByDevice: {},
                        counters: { ferries: 0, bridges: 0, land: 0 },
                      });
                      writeJSON(VISITED_KEY, []);
                      writeJSON(USED_FERRIES_KEY, []);
                      writeJSON(USED_BRIDGES_KEY, []);
                    }

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
