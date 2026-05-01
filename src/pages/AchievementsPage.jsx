// pages/AchievementsPage.jsx
import React from 'react';
import { Lock, Medal } from 'lucide-react';

const HIDDEN_BONUS_IDS = new Set(['mersey', 'shortcut']); // hide while locked

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '12px',
};

const tierChipStyle = (tier) => {
  const base = {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 999,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderStyle: 'solid',
    whiteSpace: 'nowrap',
  };
  switch ((tier || '').toLowerCase()) {
    case 'bronze':    return { ...base, background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' };
    case 'silver':    return { ...base, background: '#F1F5F9', color: '#0F172A', borderColor: '#CBD5E1' };
    case 'gold':      return { ...base, background: '#FEF9C3', color: '#854D0E', borderColor: '#FDE68A' };
    case 'legendary': return { ...base, background: '#F3E8FF', color: '#6B21A8', borderColor: '#D8B4FE' };
    default:          return { ...base, background: '#FFFFFF', color: '#0F172A', borderColor: '#CBD5E1' };
  }
};

const categoryChipStyle = (category) => {
  const base = {
    fontSize: 11,
    padding: '2px 7px',
    borderRadius: 999,
    textTransform: 'inherit',
    borderWidth: 1,
    borderStyle: 'solid',
    whiteSpace: 'nowrap',
  };
  switch ((category || '').toLowerCase()) {
    case 'challenge':
      return { ...base, background: '#ffffffff', color: '#92400E', borderColor: '#F59E0B' };
    case 'streak':
      return { ...base, background: '#ffffffff', color: '#6B21A8', borderColor: '#C084FC' };
    case 'exploration':
    default:
      return { ...base, background: '#ffffffff', color: '#166534', borderColor: '#22C55E' };
  }
};

const tierBorderColor = (tier) => {
  switch ((tier || '').toLowerCase()) {
    case 'bronze':    return '#F59E0B';
    case 'silver':    return '#CBD5E1';
    case 'gold':      return '#FACC15';
    case 'legendary': return '#C084FC';
    default:          return 'rgba(255,255,255,0.5)';
  }
};

const glassCardStyle = (tier) => ({
  border: `1px solid ${tierBorderColor(tier)}`,
  background: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderRadius: 5,
  padding: '10px 12px',
});

const glassCardMuted = {
  border: '1px solid rgba(255,255,255,0.5)',
  background: 'rgba(143, 143, 143, 0.3)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderRadius: 15,
  padding: '10px 12px',
};

const TIER_ORDER  = ['legendary', 'gold', 'silver', 'bronze'];
const TIER_TITLES = {
  legendary: 'Legendary',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
};

function readAchievementsMap() {
  try { return JSON.parse(localStorage.getItem('pp_achievements_v1') || '{}'); }
  catch { return {}; }
}

function groupByTier(list) {
  return TIER_ORDER
    .map(tier => ({
      tier,
      items: list.filter(a => (a.tier || '').toLowerCase() === tier),
    }))
    .filter(g => g.items.length > 0);
}

// --- Unlocked card header ---
function AchCardUnlocked({ a, whenISO }) {
  const when = whenISO ? new Date(whenISO) : null;
  const category = a.category || 'xploration';
  return (
    <div className="glass rounded-2xl transition hover:shadow-lg"
         style={glassCardStyle(a.tier)} title={a.description}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,                // ← allow children to shrink
        }}
      >
        <div><span className="text-2xl" aria-hidden>{a.icon}</span></div>
        <div
          className="font-semibold truncate"
          style={{ flex: '1 1 auto', minWidth: 0 }}  // ← let the name truncate
        >
          <b>{a.name}</b>
        </div>
        
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span style={tierChipStyle(a.tier)}>{a.tier}</span>
        <span style={categoryChipStyle(category)}>{category}</span>
      </div>

      <div className="text-sm mt-2 text-white/90">{a.description}</div>
      {/* <div className="text-sm mt-2 text-white/90"><span
          style={{
            marginLeft: 'auto',
            ...tierChipStyle(a.tier),
            flex: '0 0 auto',          // ← chip never grows
          }}
        >
          {a.tier}
        </span><br />{a.description}</div> */}
      {when && (
        <div className="text-xs mt-2 text-emerald-200/80">
          Unlocked {when.toLocaleDateString()}
        </div>
      )}
    </div>
  );
}


function AchCardLocked({ a }) {
  const category = a.category || 'exploration';
  return (
    <div className="glass rounded-2xl" style={glassCardMuted} title={a.description}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,                           // ← allow shrink
        }}
      >
        <div className="w-6 h-6 grid place-items-center rounded bg-slate-200 text-slate-600">
          <Lock className="w-4 h-4" aria-hidden />
        </div>
        <div
          className="font-semibold text-slate-50 truncate"
          style={{ flex: '1 1 auto', minWidth: 0 }}   // ← truncate name
        >
          {a.name}
        </div>

      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span style={tierChipStyle(a.tier)}>{a.tier}</span>
        <span style={categoryChipStyle(category)}>{category}</span>
      </div>

      <div className="text-sm mt-1 text-slate-100/90">{a.description}</div>
      {/* <div className="text-sm mt-1 text-slate-100/90">        <span
          style={{
            marginLeft: 'auto',
            ...tierChipStyle(a.tier),
            flex: '0 0 auto',                        // ← chip fixed
          }}
        >
          {a.tier}
        </span><br />{a.description}</div> */}
    </div>
  );
}

function readMeta() {
  try { return JSON.parse(localStorage.getItem('pp_meta_v1') || '{}'); }
  catch { return {}; }
}

export default function AchievementsPage({
  achievements = [],
  visitedCount: visitedCountProp,
  totalAreas = 0,
  onBack,
}) {
  const unlockedMap = readAchievementsMap();
    const meta = React.useMemo(() => readMeta(), []);
  const unlockedIds = new Set(Object.keys(unlockedMap));
const visitedCount =
    Number.isFinite(visitedCountProp) ? visitedCountProp
    : (meta.visitedCount ?? Object.keys(meta.visitedAreas || {}).length ?? 0);
  const isHiddenLocked = (a) => !!a.hidden || HIDDEN_BONUS_IDS.has(a.id);

  // Split & sort
  const unlocked = achievements
    .filter(a => unlockedIds.has(a.id))
    .sort((a, b) => {
      const ta = new Date(unlockedMap[a.id]?.unlockedAt || 0).getTime();
      const tb = new Date(unlockedMap[b.id]?.unlockedAt || 0).getTime();
      return tb - ta; // newest first
    });

  const locked = achievements
    .filter(a => !unlockedIds.has(a.id) && !isHiddenLocked(a))
    .sort((a, b) => (a.tier || '').localeCompare(b.tier || '') || a.name.localeCompare(b.name));

  // Group by tier
  const unlockedGroups = groupByTier(unlocked);
  const lockedGroups   = groupByTier(locked);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center gap-2 py-4">
          <button className="btn btn-primary" onClick={onBack} aria-label="Back">← Back</button>
          <h1 className="text-2xl font-bold ml-2">
            <span className="inline-flex items-center gap-2">
              <Medal className="w-5 h-5" /> Achievements
            </span>
          </h1>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="text-slate-200 mb-4 text-sm">
            Visited <b>{visitedCount}</b> / <b>{totalAreas}</b> postcode areas
          </p>
          <div className="mb-5 rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-slate-100">
            <p><b>🧭 Exploration</b> achievements can be earned in Free Play or Daily Challenge.</p>
            <p><b>🗺️ Challenge</b> achievements require a no-hint run.</p>
            <p><b>🔥 Streak</b> achievements can only be achieved in the Daily Challenges</p>
          </div>

          {/* Unlocked */}
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-white">
              Unlocked <span className="opacity-80">({unlocked.length})</span>
            </h2>
            {unlocked.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-slate-600 text-sm">
                No achievements unlocked yet. Keep playing!
              </div>
            ) : (
              unlockedGroups.map(({ tier, items }) => (
                <div key={`unlocked-${tier}`} className="mb-6 last:mb-0">
                  <h3 className="text-slate-200 font-semibold mb-2">
                    {TIER_TITLES[tier]} <span className="opacity-80">({items.length})</span>
                  </h3>
                  <div style={gridStyle}>
                    {items.map(a => (
                      <AchCardUnlocked
                        key={a.id}
                        a={a}
                        whenISO={unlockedMap[a.id]?.unlockedAt}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Locked (bonus items excluded) */}
          <section>
            <h2 className="text-lg font-semibold mb-3 text-white">
              Locked <span className="opacity-80">({locked.length})</span>
            </h2>
            {locked.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-slate-600 text-sm">
                Nothing to show here — nice!
              </div>
            ) : (
              lockedGroups.map(({ tier, items }) => (
                <div key={`locked-${tier}`} className="mb-6 last:mb-0">
                  <h3 className="text-slate-200 font-semibold mb-2">
                    {TIER_TITLES[tier]} <span className="opacity-80">({items.length})</span>
                  </h3>
                  <div style={gridStyle}>
                    {items.map(a => <AchCardLocked key={a.id} a={a} />)}
                  </div>
                </div>
              ))
            )}
            <p className="mt-3 text-xs text-slate-400">
              Bonus (hidden) achievements don’t appear here until you unlock them.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
