

import useAuth from './useAuth';
import { db, ts } from '../firebase';
import { doc, getDoc, setDoc  } from 'firebase/firestore';
import React from 'react';



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


function mergeMeta(a, b) {
  const out = { ...(a || {}), ...(b || {}) };

  // 1) visitedAreas: set-union
  const visited = { ...(a?.visitedAreas || {}), ...(b?.visitedAreas || {}) };
  const visitedCount = Object.keys(visited).length;

  // 2) per-device counters: max per device (monotonic)
  const byDev = { ...(a?.countersByDevice || {}) };
  for (const [dev, c] of Object.entries(b?.countersByDevice || {})) {
    const base = byDev[dev] || {};
    byDev[dev] = {
      ferries: Math.max(base.ferries || 0, c.ferries || 0),
      bridges: Math.max(base.bridges || 0, c.bridges || 0),
      land:    Math.max(base.land    || 0, c.land    || 0),
    };
  }

  // 3) totals = sum across devices
  const totals = Object.values(byDev).reduce(
    (acc, c) => ({
      ferries: acc.ferries + (c.ferries || 0),
      bridges: acc.bridges + (c.bridges || 0),
      land:    acc.land    + (c.land    || 0),
    }),
    { ferries: 0, bridges: 0, land: 0 }
  );

  return { ...out, visitedAreas: visited, visitedCount, countersByDevice: byDev, counters: totals };
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
  const keyOf = (g) => JSON.stringify([g.start, g.target, g.date, g.won, g.moves]);
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
    version: 1,
    achievements: ach,
    history: { games },
    streaks,                         // <-- was 'streak'
    meta: mergeMeta(cloud.meta, local.meta),
  };
}

async function loadCloud(uid) {
  const ref = doc(db, 'users', uid, 'pp', 'v1');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveCloud(uid, data) {
  const ref = doc(db, 'users', uid, 'pp', 'v1');
  const payload = pruneUndefinedDeep({ ...data, updatedAt: ts() });
  await setDoc(ref, payload, { merge: true });
}

export default function useCloudSync(getLocalSnapshot, writeLocalSnapshot) {
  const { user } = useAuth();
  const [syncing, setSyncing] = React.useState(false);
  const raf = React.useRef(0);

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
      const local = getSnapRef.current();
      const cloud = await loadCloud(user.uid);
      if (cancelled) return;
      const merged = mergeCloudWithLocal(cloud, local);  
      await saveCloud(user.uid, merged);                  
      if (cancelled) return;
      writeSnapRef.current(merged);
      setSyncing(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // queued save
  const queueSave = React.useCallback(() => {
    if (!user) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(async () => {
      const snapshot = getSnapRef.current();
      await saveCloud(user.uid, snapshot);
    });
  }, [user]);

  // immediate save
  const saveNow = React.useCallback(async () => {
    if (!user) return;
    const snapshot = getSnapRef.current();
    await saveCloud(user.uid, snapshot);
  }, [user]);

  return { user, syncing, queueSave, saveNow };
}

