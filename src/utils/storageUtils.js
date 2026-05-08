import { postcodeAreas, ferryLinks, bridgeLinks } from '../postcodeAreas';
import { getAttemptAnalyticsSnapshot } from './attemptAnalytics';

export const USED_FERRIES_KEY = 'pp_used_ferries_v1';
export const USED_BRIDGES_KEY = 'pp_used_bridges_v1';
export const VISITED_KEY = 'pp_visited_areas_v1';
export const GAME_HISTORY_KEY = 'pp_history_v2';
export const ACHIEVEMENTS_KEY = 'pp_achievements_v1';
export const META_KEY = 'pp_meta_v1';

export const DIFFS = ['easy', 'normal', 'hard', 'master'];
export const STREAK_KEY_V2 = (d) => `pp_daily_streak_v2_${d}`;
export const dailySessionKey = (d) => `pp_daily_session_v2_${d}`;

export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function objectMapFromStored(value) {
  if (Array.isArray(value)) return Object.fromEntries(value.map((x) => [x, true]));
  if (value && typeof value === 'object') return value;
  return {};
}

function arrayFromStoredSet(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.keys(value);
  return [];
}

function readStreakV2(diff) {
  return readJSON(STREAK_KEY_V2(diff), null);
}

function saveStreakV2(diff, count, lastWinDate) {
  writeJSON(STREAK_KEY_V2(diff), { count, lastWinDate });
}

function readStreaksAll() {
  const out = {};
  for (const d of DIFFS) {
    const rec = readStreakV2(d);
    if (rec && Number.isFinite(+rec.count)) {
      out[d] = { count: +rec.count, lastWinDate: rec.lastWinDate || null };
    }
  }

  if (!out.easy) {
    const legacy = readJSON('pp_daily_streak_v1', null);
    if (legacy && Number.isFinite(+legacy.count)) {
      out.easy = { count: +legacy.count, lastWinDate: legacy.lastWinDate || null };
    }
  }

  return out;
}

function writeStreaksAll(streaks) {
  const fallback = emptySnapshot().streaks;
  for (const d of DIFFS) {
    const rec = streaks?.[d] ?? fallback[d];
    const count = Number(rec?.count) || 0;
    const lastWinDate = rec?.lastWinDate || null;

    if (count > 0 && lastWinDate) {
      saveStreakV2(d, count, lastWinDate);
    } else {
      localStorage.removeItem(STREAK_KEY_V2(d));
    }
  }
}

function readDailySessionsAll() {
  const out = {};
  for (const d of DIFFS) {
    out[d] = readJSON(dailySessionKey(d), null);
  }
  return out;
}

function writeDailySessionsAll(sessions) {
  for (const d of DIFFS) {
    const snap = sessions?.[d] ?? null;
    if (snap) {
      writeJSON(dailySessionKey(d), snap);
    } else {
      localStorage.removeItem(dailySessionKey(d));
    }
  }
}

export function emptySnapshot() {
  return {
    version: 2,
    achievements: {},
    history: { games: [] },
    streaks: {
      easy: { count: 0, lastWinDate: null },
      normal: { count: 0, lastWinDate: null },
      hard: { count: 0, lastWinDate: null },
      master: { count: 0, lastWinDate: null },
    },
    dailySessions: {
      easy: null,
      normal: null,
      hard: null,
      master: null,
    },
    meta: {
      visitedAreas: {},
      usedFerries: {},
      usedBridges: {},
      visitedCount: 0,
      usedFerriesCount: 0,
      usedBridgesCount: 0,
    },
  };
}

function readCoverageMeta() {
  const visitedAreas = objectMapFromStored(readJSON(VISITED_KEY, {}));
  const usedFerries = objectMapFromStored(readJSON(USED_FERRIES_KEY, []));
  const usedBridges = objectMapFromStored(readJSON(USED_BRIDGES_KEY, []));

  return {
    visitedAreas,
    usedFerries,
    usedBridges,
    visitedCount: Object.keys(visitedAreas).length,
    usedFerriesCount: Object.keys(usedFerries).length,
    usedBridgesCount: Object.keys(usedBridges).length,
  };
}

export function getLocalSnapshot({ includeAnalytics = true } = {}) {
  const base = emptySnapshot();
  const storedMeta = readJSON(META_KEY, base.meta) || base.meta;
  const coverageMeta = readCoverageMeta();

  const snapshot = {
    version: base.version,
    achievements: readJSON(ACHIEVEMENTS_KEY, base.achievements),
    history: readJSON(GAME_HISTORY_KEY, base.history),
    streaks: readStreaksAll() || base.streaks,
    dailySessions: readDailySessionsAll() || base.dailySessions,
    meta: {
      ...storedMeta,
      ...coverageMeta,
    },
  };

  if (includeAnalytics) {
    snapshot.analytics = getAttemptAnalyticsSnapshot();
  }

  return snapshot;
}

export function writeLocalSnapshot(s) {
  const base = emptySnapshot();
  const snap = {
    ...base,
    ...s,
    achievements: s?.achievements ?? base.achievements,
    history: s?.history ?? base.history,
    streaks: s?.streaks ?? base.streaks,
    dailySessions: s?.dailySessions ?? base.dailySessions,
    meta: { ...base.meta, ...(s?.meta || {}) },
  };

  writeJSON(ACHIEVEMENTS_KEY, snap.achievements);
  writeJSON(GAME_HISTORY_KEY, snap.history);
  writeStreaksAll(snap.streaks);
  writeDailySessionsAll(snap.dailySessions);
  writeJSON(META_KEY, snap.meta);
  writeJSON(VISITED_KEY, Object.keys(snap.meta.visitedAreas || {}));
  writeJSON(USED_FERRIES_KEY, Object.keys(snap.meta.usedFerries || {}));
  writeJSON(USED_BRIDGES_KEY, Object.keys(snap.meta.usedBridges || {}));
}

export function canonEdge(a, b) {
  if (!a || !b) return null;
  return [a, b].sort((x, y) => x.localeCompare(y)).join('-');
}

export function readEdgeSet(key) {
  return new Set(arrayFromStoredSet(readJSON(key, [])));
}

export function writeEdgeSet(key, set) {
  writeJSON(key, [...set]);
}

export function addUsedFerryEdge(a, b) {
  const id = canonEdge(a, b);
  if (!id) return false;
  const s = readEdgeSet(USED_FERRIES_KEY);
  if (s.has(id)) return false;
  s.add(id);
  writeEdgeSet(USED_FERRIES_KEY, s);
  return true;
}

export function addUsedBridgeEdge(a, b) {
  const id = canonEdge(a, b);
  if (!id) return false;
  const s = readEdgeSet(USED_BRIDGES_KEY);
  if (s.has(id)) return false;
  s.add(id);
  writeEdgeSet(USED_BRIDGES_KEY, s);
  return true;
}

export function getCoverageMeta(ferries = ferryLinks, bridges = bridgeLinks) {
  const usedF = readEdgeSet(USED_FERRIES_KEY);
  const usedB = readEdgeSet(USED_BRIDGES_KEY);
  const allF = new Set((ferries ?? []).map(({ a, b }) => canonEdge(a, b)).filter(Boolean));
  const allB = new Set((bridges ?? []).map(({ a, b }) => canonEdge(a, b)).filter(Boolean));
  return {
    usedFerriesCount: usedF.size,
    usedBridgesCount: usedB.size,
    totalFerries: allF.size,
    totalBridges: allB.size,
    hasMersey: usedF.has(canonEdge('L', 'CH')),
  };
}

export function readVisited() {
  return new Set(arrayFromStoredSet(readJSON(VISITED_KEY, [])));
}

export function writeVisited(set) {
  writeJSON(VISITED_KEY, [...set]);
}

export function addVisited(codes = [], areas = postcodeAreas) {
  const s = readVisited();
  let changed = false;
  for (const c of codes) {
    if (c && areas[c] && !s.has(c)) {
      s.add(c);
      changed = true;
    }
  }
  if (changed) writeVisited(s);
  return changed;
}

export function getVisitedCount() {
  return readVisited().size;
}

export function getLifetimeVisitedCount() {
  const meta = readJSON(META_KEY, {});
  if (Number.isFinite(meta?.visitedCount)) return meta.visitedCount;
  if (Number.isFinite(meta?.counters?.visitedCount)) return meta.counters.visitedCount;
  if (Array.isArray(meta?.visitedAreas)) return new Set(meta.visitedAreas).size;
  if (meta?.visitedAreas && typeof meta.visitedAreas === 'object') {
    return Object.keys(meta.visitedAreas).length;
  }
  return getVisitedCount();
}

