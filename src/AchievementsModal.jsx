import React, { useMemo } from 'react';
import ModalShell from './ModalShell.jsx';

function safeReadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export default function AchievementsModal({
  open,
  onClose,
  achievements,            // master list (ACHIEVEMENTS array)
  visitedCount,            // number
  totalAreas,              // number
  storageKey = 'pp_achievements_v1',
}) {
  const { unlocked, locked } = useMemo(() => {
    const have = safeReadJSON(storageKey, {}); // { [id]: { unlockedAt, ... } }
    const u = [];
    const seen = new Set();

    (achievements || []).forEach(a => {
      const rec = have[a.id];
      if (rec?.unlockedAt) {
        u.push({ ...a, ...rec });
        seen.add(a.id);
      }
    });
    u.sort((x, y) => new Date(y.unlockedAt) - new Date(x.unlockedAt));

    const l = (achievements || []).filter(a => !seen.has(a.id));
    return { unlocked: u, locked: l };
  }, [achievements, storageKey]);

  const pct = totalAreas ? Math.floor((visitedCount / totalAreas) * 100) : 0;

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch { return iso ?? ''; }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="achievements-title">
      <div className="flex items-center justify-between mb-3">
        <h2 id="achievements-title" className="text-xl font-semibold">Achievements</h2>
        <button className="btn btn-neutral" onClick={onClose}>Close</button>
      </div>

      {/* Tracker */}
      <section className="mb-4">
        <h3 className="text-sm font-semibold mb-2 opacity-80">Postcode Areas Visited</h3>
        <div className="rounded-xl p-3 bg-white/10">
          <div className="flex items-center justify-between mb-2 text-sm">
            <div><span>{visitedCount} / {totalAreas}</span></div>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 rounded bg-white/10 overflow-hidden">
            <div className="h-full bg-white/60" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <hr className="border-white/10 my-3" />

      {/* Unlocked */}
      <section className="mb-4">
        <h3 className="text-sm font-semibold mb-2 opacity-80">Achieved ({unlocked.length})</h3>
        {unlocked.length === 0 ? (
          <div className="text-sm opacity-80 bg-white/10 rounded-xl p-3">
            You haven’t unlocked any achievements yet. Play a few rounds to start earning them!
          </div>
        ) : (
          <ul className="grid gap-2">
            {unlocked.map(a => (
              <li key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/10">
                <span className="text-2xl" aria-hidden>{a.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs opacity-80">{a.description}</div>
                </div>
                <div className="text-xs whitespace-nowrap">{fmtDate(a.unlockedAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="border-white/10 my-3" />

      {/* Locked */}
      <section>
        <h3 className="text-sm font-semibold mb-2 opacity-80">Locked ({locked.length})</h3>
        {locked.length === 0 ? (
          <div className="text-sm opacity-80 bg-white/10 rounded-xl p-3">
            You’ve unlocked everything for now. More achievements coming soon!
          </div>
        ) : (
          <ul className="grid gap-2">
            {locked.map(a => (
              <li
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 opacity-75"
                aria-disabled="true"
              >
                <span className="text-2xl" aria-hidden>{a.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs opacity-80">{a.description}</div>
                </div>
                <div className="text-xs uppercase tracking-wide opacity-70">Not yet achieved</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ModalShell>
  );
}
