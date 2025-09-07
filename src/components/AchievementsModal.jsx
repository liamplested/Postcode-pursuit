// src/components/AchievementsModal.jsx
import React from 'react';
import ModalShell from './ModalShell';

export default function AchievementsModal({
  open,
  onClose,
  achievements = [],
  visitedCount = 0,
  totalAreas = 0,
}) {
  // If you already compute unlocked elsewhere, keep that.
  const unlocked = (() => {
    try { return Object.values(JSON.parse(localStorage.getItem('pp_achievements_v1') || '{}')); }
    catch { return []; }
  })();
  const unlockedIds = new Set(unlocked.map(a => a.id));

  return (
    <ModalShell open={open} onClose={onClose} ariaLabel="Achievements">
      <div className="p-5">
        <h2 className="text-xl font-semibold mb-1">Achievements</h2>
        <p className="text-slate-600 mb-4 text-sm">
          Visited {visitedCount}/{totalAreas} postcode areas
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {achievements.map(a => {
            const isUnlocked = unlockedIds.has(a.id);
            return (
              <div
                key={a.id}
                className={`rounded-xl p-3 border ${
                  isUnlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-white/70 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>{a.icon}</span>
                  <div className="font-semibold">{a.name}</div>
                  <span className="ml-auto text-xs uppercase tracking-wide opacity-70">{a.tier}</span>
                </div>
                <div className="text-sm mt-1 text-slate-700">{a.description}</div>
                <div className="mt-2 text-xs">
                  {isUnlocked ? <span className="text-emerald-700">Unlocked ✅</span> : <span className="text-slate-500">Locked</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <button className="btn btn-primary w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </ModalShell>
  );
}
