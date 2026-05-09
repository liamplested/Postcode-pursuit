import useAuth from './useAuth';
import { db, ts } from '../firebase';
import { deleteField, doc, getDoc, setDoc  } from 'firebase/firestore';
import React from 'react';

const todayUTC = () => new Date().toISOString().slice(0,10);
const daysBetweenUTC = (a, b) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);


const pickMoreRecentSession = (a, b) => {
  if (!a) return b;
  if (!b) return a;

  const aTime = Date.parse(a.savedAt || a.updatedAt || a.date || 0);
  const bTime = Date.parse(b.savedAt || b.updatedAt || b.date || 0);

  return bTime >= aTime ? b : a;
};

const mergeDailySessions = (cloudSessions = {}, localSessions = {}) => {
  const out = {};
  for (const d of DIFFS) {
    out[d] = pickMoreRecentSession(cloudSessions[d], localSessions[d]);
  }
  return out;
};


function normalizeStreaks(merged) {
  const out = { ...merged, streaks: { ...(merged.streaks || {}) } };
  const today = todayUTC();
  for (const d of DIFFS) {
    const rec = out.streaks[d];
    if (rec?.lastWinDate && daysBetweenUTC(rec.lastWinDate, today) >= 2) {
      out.streaks[d] = { ...rec, count: 0 }; // reset if missed ≥ 1 full day
    }
  }
  return out;
}

function pruneUndefinedDeep(value) {
  if (value === undefined) return undefined;          // signal to caller to drop
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    const arr = value.map(pruneUndefinedDeep).filter(v => v !== undefined);
    return arr;
  }

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const pruned = pruneUndefinedDeep(v);
    if (pruned !== undefined) out[k] = pruned;        // drop undefined keys
  }
  return out;
}

async function mergeAndSave(uid, localSnapshot) {
  const cloud = await loadCloud(uid);
  const merged = normalizeStreaks(mergeCloudWithLocal(cloud, localSnapshot));
  await saveCloud(uid, merged);
  return merged;
}

function mergeBooleanMap(a = {}, b = {}) {
  return { ...objectMapFromStored(a), ...objectMapFromStored(b) };
}

function objectMapFromStored(value) {
  if (Array.isArray(value)) return Object.fromEntries(value.map((x) => [x, true]));
  if (value && typeof value === 'object') return value;
  return {};
}

function mergeMeta(a, b) {

  const out = { ...(a || {}), ...(b || {}) };

  // 1) visitedAreas: set-union
  const visitedAreas = mergeBooleanMap(a?.visitedAreas, b?.visitedAreas);
  const visitedCount = Object.keys(visitedAreas).length;

  // 2) ferry / bridge coverage: set-union
  const usedFerries = mergeBooleanMap(a?.usedFerries, b?.usedFerries);
  const usedBridges = mergeBooleanMap(a?.usedBridges, b?.usedBridges);

  const usedFerriesCount = Object.keys(usedFerries).length;
  const usedBridgesCount = Object.keys(usedBridges).length;

  // 3) per-device counters: max per device (monotonic)
  const byDev = { ...(a?.countersByDevice || {}) };
  for (const [dev, c] of Object.entries(b?.countersByDevice || {})) {
    const base = byDev[dev] || {};
    byDev[dev] = {
      ferries: Math.max(base.ferries || 0, c.ferries || 0),
      bridges: Math.max(base.bridges || 0, c.bridges || 0),
      land: Math.max(base.land || 0, c.land || 0),
    };
  }

  // 4) totals = sum across devices
  const totals = Object.values(byDev).reduce(
    (acc, c) => ({
      ferries: acc.ferries + (c.ferries || 0),
      bridges: acc.bridges + (c.bridges || 0),
      land: acc.land + (c.land || 0),
    }),
    { ferries: 0, bridges: 0, land: 0 }
  );

  return {
    ...out,

    visitedAreas,
    visitedCount,

    usedFerries,
    usedBridges,
    usedFerriesCount,
    usedBridgesCount,

    countersByDevice: byDev,
    counters: totals,

    hasMersey: !!(a?.hasMersey || b?.hasMersey),

    totalAreas: Math.max(a?.totalAreas || 0, b?.totalAreas || 0),
    totalFerries: Math.max(a?.totalFerries || 0, b?.totalFerries || 0),
    totalBridges: Math.max(a?.totalBridges || 0, b?.totalBridges || 0),

    hintsUsed: Math.max(a?.hintsUsed || 0, b?.hintsUsed || 0),
  };
}


// ---- merge policy ----
// helper: choose newer lastWinDate; tie → higher count
const pickStreak = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  const aDate = a.lastWinDate || '';
  const bDate = b.lastWinDate || '';
  if (aDate === bDate) return (a.count || 0) >= (b.count || 0) ? a : b;
  return aDate > bDate ? a : b;
};

// back-compat: coerce {streak} → {streaks: {easy: streak}}
const toStreaks = (snap) => {
  if (!snap) return {};
  if (snap.streaks && typeof snap.streaks === 'object') return snap.streaks;
  if (snap.streak && typeof snap.streak === 'object') return { easy: snap.streak };
  return {};
};

// merge per-difficulty
const DIFFS = ['easy', 'normal', 'hard', 'master'];
const mergeStreaks = (cloudStreaks = {}, localStreaks = {}) => {
  const out = {};
  for (const d of DIFFS) out[d] = pickStreak(cloudStreaks[d], localStreaks[d]);
  return out;
};

function mergeCloudWithLocal(cloud, local) {
  if (!cloud) return local;

  // achievements: union, prefer earliest unlock
  const ach = { ...(cloud.achievements || {}) };
  for (const [id, rec] of Object.entries(local.achievements || {})) {
    if (!ach[id] || rec.unlockedAt < ach[id].unlockedAt) ach[id] = rec;
  }

  // history: concat + de-dupe by a stable key
  const keyOf = (g) => {
    if (!g) return 'null';

    // 1️⃣ Prefer explicit unique id if present (new records)
    if (g.id) return g.id;

    // 2️⃣ Fallback for legacy records without an id
    const start = g.startArea ?? g.start ?? '';
    const end   = g.endArea   ?? g.target ?? '';
    const date  = g.dateISO   ?? g.date   ?? '';
    const mode  = g.mode      ?? '';
    const diff  = g.difficulty ?? '';
    const moves = typeof g.moves === 'number'
      ? g.moves
      : (g.guesses ?? 0);
    const won   = !!g.won;

    return JSON.stringify([start, end, date, mode, diff, won, moves]);
  };

  const seen = new Set();
  const games = [...(cloud.history?.games || []), ...(local.history?.games || [])]
    .filter((g) => {
      const k = keyOf(g || {});
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  // streaks: per-difficulty merge (with back-compat for legacy 'streak')
  const streaks = mergeStreaks(toStreaks(cloud), toStreaks(local));

return {
  version: 2,
  achievements: ach,
  history: { games },
  streaks,
  dailySessions: mergeDailySessions(cloud.dailySessions, local.dailySessions),
  meta: mergeMeta(cloud.meta, local.meta),
};
}

async function loadCloud(uid) {
  const ref = doc(db, 'users', uid, 'pp', 'v1');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveCloud(uid, data, { merge = true } = {}) {
  const ref = doc(db, 'users', uid, 'pp', 'v1');
  const { analytics, ...progressData } = data || {};
  const payload = pruneUndefinedDeep({ ...progressData, updatedAt: ts() });
  if (merge) {
    payload.analytics = deleteField();
  }
  await setDoc(ref, payload, { merge });
}

export default function useCloudSync(getLocalSnapshot, writeLocalSnapshot) {
  const { user } = useAuth();
  const [syncing, setSyncing] = React.useState(false);
  const raf = React.useRef(0);
  const saveChain = React.useRef(Promise.resolve());

  // ⬇️ keep the latest callbacks without re-running effects
  const getSnapRef = React.useRef(getLocalSnapshot);
  const writeSnapRef = React.useRef(writeLocalSnapshot);
  React.useEffect(() => { getSnapRef.current = getLocalSnapshot; }, [getLocalSnapshot]);
  React.useEffect(() => { writeSnapRef.current = writeLocalSnapshot; }, [writeLocalSnapshot]);

  // merge on sign-in
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const local = getSnapRef.current();
        const cloud = await loadCloud(user.uid);
        if (cancelled) return;

        const merged0 = mergeCloudWithLocal(cloud, local);
        const merged  = normalizeStreaks(merged0);      // 👈 reset if stale

        // Only write if changed in Firestore
        if (JSON.stringify(merged) !== JSON.stringify(cloud)) {
          await saveCloud(user.uid, merged);
          if (cancelled) return;
        }

        writeSnapRef.current(merged);                    // keep local in sync
      } catch (e) {
        console.error('[cloud merge] failed:', e);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // queued save
const queueSave = React.useCallback(() => {
  if (!user) return;
  if (raf.current) cancelAnimationFrame(raf.current);
  raf.current = requestAnimationFrame(async () => {
    saveChain.current = saveChain.current
      .catch(() => {})
      .then(async () => {
        try {
          const local = getSnapRef.current();
          const merged = await mergeAndSave(user.uid, local);
          writeSnapRef.current(merged);
        } catch (e) {
          console.error('[cloud queueSave] failed:', e);
        }
      });
  });
}, [user]);

  // immediate save
const saveNow = React.useCallback(async () => {
  if (!user) return;
  saveChain.current = saveChain.current
    .catch(() => {})
    .then(async () => {
      try {
        const local = getSnapRef.current();
        const merged = await mergeAndSave(user.uid, local);
        writeSnapRef.current(merged);
      } catch (e) {
        console.error('[cloud saveNow] failed:', e);
      }
    });
  return saveChain.current;
}, [user]);

const overwriteNow = React.useCallback(async (snapshot) => {
  if (!user) return;
  saveChain.current = saveChain.current
    .catch(() => {})
    .then(async () => {
      await saveCloud(user.uid, snapshot, { merge: false });
      writeSnapRef.current(snapshot);
    });
  return saveChain.current;
}, [user]);

  return { user, syncing, queueSave, saveNow, overwriteNow  };
}
