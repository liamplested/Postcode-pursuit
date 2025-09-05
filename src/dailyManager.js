// src/dailyManager.js
export const DAILY_VERSION = 'v2'; // bump if map topology changes

export const todayUTC = () => new Date().toISOString().slice(0, 10);

const mulberry32 = (a) => () => {
  let t = (a += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hashSeed = (str) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const sessionKey = (difficulty) => `pp_daily_session_${DAILY_VERSION}_${difficulty}`;

export const loadSnapshot = (difficulty) => {
  try { return JSON.parse(localStorage.getItem(sessionKey(difficulty)) || 'null'); }
  catch { return null; }
};
export const saveSnapshot = (difficulty, snapshot) => {
  localStorage.setItem(sessionKey(difficulty), JSON.stringify(snapshot));
};

const sortedAreas = (postcodeAreas) => {
  const list = Object.keys(postcodeAreas);
  list.sort((a, b) => (a > b) - (a < b)); // ASCII deterministic
  return list;
};

// Deterministic BFS helpers (neighbors sorted)
const bfsAllDistancesDet = (start, getNeighbors) => {
  const dist = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const u = q.shift();
    const du = dist.get(u);
    const ns = getNeighbors(u).slice().sort();
    for (const v of ns) if (!dist.has(v)) {
      dist.set(v, du + 1);
      q.push(v);
    }
  }
  return dist;
};

export const findShortestPathDet = (start, end, getNeighbors) => {
  if (start === end) return [start];
  const q = [[start]];
  const seen = new Set([start]);
  while (q.length) {
    const path = q.shift();
    const cur = path[path.length - 1];
    const ns = getNeighbors(cur).slice().sort();
    for (const n of ns) {
      if (n === end) return [...path, n];
      if (!seen.has(n)) { seen.add(n); q.push([...path, n]); }
    }
  }
  return [];
};

const seedFor = (difficulty) => hashSeed(`${todayUTC()}|${difficulty}|${DAILY_VERSION}`);

export function generateTodayDaily(difficulty, postcodeAreas, getNeighbors, boundsByDifficulty) {
  const areas = sortedAreas(postcodeAreas);
  const rnd = mulberry32(seedFor(difficulty));
  const { min, max } = boundsByDifficulty[difficulty];

  for (let attempt = 0; attempt < 400; attempt++) {
    const start = areas[Math.floor(rnd() * areas.length)];
    const dist = bfsAllDistancesDet(start, getNeighbors);

    const candidates = areas.filter(a => {
      if (a === start) return false;
      const d = dist.get(a);
      return Number.isFinite(d) && d >= min && (max == null || d <= max);
    });
    if (!candidates.length) continue;

    const target = candidates[Math.floor(rnd() * candidates.length)];
    const path = findShortestPathDet(start, target, getNeighbors);
    const steps = path.length ? path.length - 1 : Infinity;

    if (Number.isFinite(steps) && steps >= min && (max == null || steps <= max)) {
      return { start, target, path, steps };
    }
  }

  // cautious fallback
  const start = areas[0], target = areas[1];
  const path = findShortestPathDet(start, target, getNeighbors);
  return { start, target, path, steps: Math.max(0, path.length - 1) };
}

export const dailyStatus = (difficulty) => {
  const snap = loadSnapshot(difficulty);
  const today = todayUTC();
  if (snap && snap.date === today) return snap.gameWon ? 'View result' : 'Continue';
  return 'Start';
};

export function getStreak(diff) {
  try {
    const raw = localStorage.getItem(`pp_daily_streak_v2_${diff}`);
    if (raw) return Number(JSON.parse(raw)?.count ?? 0) || 0;
    if (diff === 'easy') {
      const legacy = localStorage.getItem('pp_daily_streak_v1');
      if (legacy) return Number(JSON.parse(legacy)?.count ?? 0) || 0;
    }
  } catch {}
  return 0;
}
