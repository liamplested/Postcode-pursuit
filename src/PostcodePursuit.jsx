import React, { useState, useRef, useEffect, useCallback, useId} from 'react';
import { MapPin, Trophy, Flag, Menu, ArrowRight, BookOpen, Ship, Route, Medal, ChartColumnBig, InfoIcon, ZoomIn, ZoomOut, Scan} from 'lucide-react';
import { createPortal } from 'react-dom';
import { postcodeAreas, ferryLinks, bridgeLinks } from './postcodeAreas';
import useSvgPan from './hooks/useSvgPan';
import OnboardingTutorial from './components/OnboardingTutorial';
import * as Daily from './dailyManager';

 import StatsPage from './pages/StatsPage.jsx';
 import AchievementsPage from './pages/AchievementsPage.jsx';

// ---- Module-level constants -------------------------------------------------
// Define the World
const WORLD = { x: 0, y: 0, width: 15000, height: 17500 }; // <- your existing values
const MIN_SCALE = 0.1;
const MAX_SCALE = 30;
const ZOOM_STEP = 1.25; // button zoom factor

// Daily helpers
const DAILY_STREAK_KEY = 'pp_daily_streak_v1'; // {count:number, lastWinDate:'YYYY-MM-DD'}

function parseUTC(dateStr){ return new Date(dateStr + 'T00:00:00Z'); }
function daysBetweenUTC(a,b){
  const ms = parseUTC(b).getTime() - parseUTC(a).getTime();
  return Math.round(ms / 86400000);
}
function loadDailyStreak(){
  try { return JSON.parse(localStorage.getItem(DAILY_STREAK_KEY) || 'null'); } catch { return null; }
}
function saveDailyStreak(count, lastWinDate){
  localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify({ count, lastWinDate }));
}
//function todayUTC(){ return new Date().toISOString().slice(0,10); }

// ===== Module-scope utils (stable identity) =====
export const USED_FERRIES_KEY = 'pp_used_ferries_v1';
export const USED_BRIDGES_KEY = 'pp_used_bridges_v1';
export const VISITED_KEY      = 'pp_visited_areas_v1';
export const GAME_HISTORY_KEY = 'pp_history_v2';
export const ACHIEVEMENTS_KEY = 'pp_achievements_v1';

let _confettiPromise;

/** lazy import so we don't bloat the initial bundle */
function getConfetti() {
  if (!_confettiPromise) _confettiPromise = import('canvas-confetti');
  return _confettiPromise;
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

async function fireVictoryConfetti() {
  if (prefersReducedMotion()) return;

  try {
    const { default: confetti } = await getConfetti();

    // Two quick corner bursts + a center pop
    const z = 2147483648; // above your modal overlay (which is 2147483647)
    const base = Math.max(120, Math.min(220, Math.round(window.innerWidth / 6)));

    confetti({ particleCount: Math.round(base * 0.45), spread: 20, startVelocity: 55, origin: { x: 0.15, y: 0.2 }, zIndex: z });
    confetti({ particleCount: Math.round(base * 0.6), spread: 50, startVelocity: 55, origin: { x: 0.5, y: 0.2 }, zIndex: z });
    confetti({ particleCount: Math.round(base * 0.75), spread: 70, startVelocity: 55, origin: { x: 0.75, y: 0.2 }, zIndex: z });
    confetti({ particleCount: Math.round(base * 0.9), spread: 90, startVelocity: 55, origin: { x: 0.9, y: 0.2 }, zIndex: z });

    setTimeout(() => {
      confetti({ particleCount: Math.round(base * 0.6), spread: 100, scalar: 0.9, origin: { x: 0.5, y: 0.25 }, zIndex: z });
    }, 180);

    // optional: tidy up the canvas after a moment
    setTimeout(() => confetti.reset(), 5000);
  } catch {
    // fail silently if the import or canvas fails
  }
}


export function readJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
export function writeJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

// ---- edges coverage ----
export function canonEdge(a, b) {
  if (!a || !b) return null;
  return [a, b].sort((x, y) => x.localeCompare(y)).join('-');
}
export function readEdgeSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}
export function writeEdgeSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}
export function addUsedFerryEdge(a, b) {
  const id = canonEdge(a, b); if (!id) return false;
  const s = readEdgeSet(USED_FERRIES_KEY);
  if (s.has(id)) return false;
  s.add(id); writeEdgeSet(USED_FERRIES_KEY, s);
  return true;
}
export function addUsedBridgeEdge(a, b) {
  const id = canonEdge(a, b); if (!id) return false;
  const s = readEdgeSet(USED_BRIDGES_KEY);
  if (s.has(id)) return false;
  s.add(id); writeEdgeSet(USED_BRIDGES_KEY, s);
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

// ---- visited areas ----
export function readVisited() {
  try { return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) || '[]')); }
  catch { return new Set(); }
}
export function writeVisited(set) {
  localStorage.setItem(VISITED_KEY, JSON.stringify([...set]));
}
export function addVisited(codes = [], areas = postcodeAreas) {
  const s = readVisited();
  let changed = false;
  for (const c of codes) {
    if (c && areas[c] && !s.has(c)) { s.add(c); changed = true; }
  }
  if (changed) writeVisited(s);
  return changed;
}
export function getVisitedCount() { return readVisited().size; }

// ---- path helpers for achievements ----
export function pathHasSequence(path, seq) {
  if (!Array.isArray(path) || path.length < seq.length) return false;
  for (let i = 0; i <= path.length - seq.length; i++) {
    let ok = true;
    for (let j = 0; j < seq.length; j++) if (path[i + j] !== seq[j]) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

function readStreakCount(diff) {
  try {
    const rec = JSON.parse(localStorage.getItem(`pp_daily_streak_v2_${diff}`) || 'null');
    let n = Number(rec?.count || 0);
    if ((!rec || !Number.isFinite(n)) && diff === 'easy') {
      // legacy easy streak fallback
      const legacy = JSON.parse(localStorage.getItem('pp_daily_streak_v1') || 'null');
      n = Number(legacy?.count || 0) || 0;
    }
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function lastNGamesArePerfect(n) {
  const db = readJSON(GAME_HISTORY_KEY, { games: [] });
  const recent = db.games.slice(-n);
  if (recent.length < n) return false;
  return recent.every(g =>
    g.won &&
    Number.isFinite(g.optimalMoves) &&
    g.moves === g.optimalMoves
  );
}

export const ACHIEVEMENTS = [
  // ---- originals ----
  { id: 'first',       name: 'First Steps',  icon:'⭐', tier:'bronze',
    description: 'Finish your first game',
    check: (_e,h) => (h.totalGames ?? 0) >= 1 },

  { id: 'normal_win',  name: 'Cartographer', icon:'🧭', tier:'bronze',
    description: 'Win on Normal',
    check: (e) => e.won && e.difficulty==='normal' },

  { id: 'hard_win',    name: 'Pathfinder',   icon:'🗺️', tier:'silver',
    description: 'Win on Hard',
    check: (e) => e.won && e.difficulty==='hard' },

  { id: 'master_win',  name: 'Postcode Master', icon:'📮', tier:'gold',
    description: 'Win on Master',
    check: (e) => e.won && e.difficulty==='master' },

  { id: 'speedy',      name: 'Commuter',     icon:'🚆', tier:'silver',
    description: 'Win using the optimal number of moves',
    check: (e) => e.won && Number.isFinite(e.optimalMoves) && e.moves === e.optimalMoves },

  { id: 'ferry_win',   name: 'Mariner',      icon:'⛴️', tier:'bronze',
    description: 'Use at least two ferries in a winning route',
    check: (e) => e.won && (e.ferryCount ?? 0) >= 2 },

  { id: 'bridge_win',  name: 'Engineer',     icon:'🌉', tier:'bronze',
    description: 'Use at least two bridges/tunnels in a winning route',
    check: (e) => e.won && (e.bridgeCount ?? 0) >= 2 },

  { id: 'centurion',   name: 'Die-hard',     icon:'💯', tier:'legendary',
    description: 'Play 100 games',
    check: (_e,h) => (h.totalGames ?? 0) >= 100 },

  { id: 'visit_25', name: 'Explorer: 25%', icon:'🧭', tier:'bronze',
    description: 'Visit 25% of all postcode areas',
    check: (_e,_h,meta) => (meta?.totalAreas > 0) && (meta.visitedCount / meta.totalAreas >= 0.25) },

  { id: 'visit_50', name: 'Explorer: 50%', icon:'🗺️', tier:'silver',
    description: 'Visit 50% of all postcode areas',
    check: (_e,_h,meta) => (meta?.totalAreas > 0) && (meta.visitedCount / meta.totalAreas >= 0.50) },

  { id: 'visit_100', name: 'Explorer: All Areas', icon:'🌐', tier:'legendary',
    description: 'Visit every postcode area',
    check: (_e,_h,meta) => (meta?.totalAreas > 0) && (meta.visitedCount >= meta.totalAreas) },

  { id: 'mersey', name: 'Ferry Cross the Mersey', icon:'⛴️', tier:'bronze', hidden:true,
    description: 'Use the ferry across the Mersey in either direction',
    check: (_e,_h,meta) => !!meta?.hasMersey },

  { id: 'all_ferries', name: 'Harbour Master', icon:'⚓', tier:'gold',
    description: 'Use every ferry route at least once (across all games)',
    check: (_e,_h,meta) => (meta?.totalFerries ?? 0) > 0 && (meta.usedFerriesCount >= meta.totalFerries) },

  { id: 'all_bridges', name: 'Civil Engineer', icon:'🏗️', tier:'gold',
    description: 'Use every bridge/tunnel at least once (across all games)',
    check: (_e,_h,meta) => (meta?.totalBridges ?? 0) > 0 && (meta.usedBridgesCount >= meta.totalBridges) },

  { id: 'lejog', name: 'Land’s End to John O’Groats', icon:'🏁', tier:'silver',
    description: 'Start in TR and finish in KW in a single game',
    check: (e) => e.won && e.startArea === 'TR' && e.endArea === 'KW' },

  { id: 'shortcut', name: 'You call that a shortcut?', icon:'🌀', tier:'silver', hidden:true,
    description: 'Path contains L → IM → BT → DG (or reverse) in one game',
    check: (e) => e.won && Array.isArray(e.pathUsed) &&
      (pathHasSequence(e.pathUsed, ['L','IM','BT','DG']) || pathHasSequence(e.pathUsed, ['DG','BT','IM','L'])) },

  // ---- new: Bronze ----
  { id: 'straight_shooter', name: 'Straight Shooter', icon:'🎯', tier:'bronze',
    description: 'Win without revisiting any area',
    check: (e) => e.won && Array.isArray(e.pathUsed) &&
      new Set(e.pathUsed).size === e.pathUsed.length },

  { id: 'so_close', name: 'So Close', icon:'➕', tier:'bronze',
    description: 'Win in exactly optimal +1 moves',
    check: (e) => e.won && Number.isFinite(e.optimalMoves) && e.moves === e.optimalMoves + 1 },

  { id: 'dry_feet', name: 'Dry Feet', icon:'🥿', tier:'bronze',
    description: 'Win without using any ferries or bridges',
    check: (e) => e.won && (e.ferryCount ?? 0) === 0 && (e.bridgeCount ?? 0) === 0 },

  { id: 'quick_trip', name: 'Quick Trip', icon:'⏱️', tier:'bronze',
    description: 'Win in under 2 minutes',
    check: (e) => e.won && (e.durationMs ?? Infinity) <= 120000 },

  { id: 'first_crossing', name: 'First Crossing', icon:'🚢', tier:'bronze',
    description: 'Use any ferry route at least once (lifetime)',
    check: (_e,_h,meta) => (meta?.usedFerriesCount ?? 0) >= 1 },

  { id: 'first_span', name: 'First Span', icon:'🧱', tier:'bronze',
    description: 'Use any bridge/tunnel at least once (lifetime)',
    check: (_e,_h,meta) => (meta?.usedBridgesCount ?? 0) >= 1 },

  // ---- new: Silver ----
  { id: 'bridge_club', name: 'Bridge Club', icon:'🌉', tier:'silver',
    description: 'Win using 3+ bridges/tunnels',
    check: (e) => e.won && (e.bridgeCount ?? 0) >= 3 },

  { id: 'ferry_captain', name: 'Ferry Captain', icon:'⛴️', tier:'silver',
    description: 'Win using 3+ ferries',
    check: (e) => e.won && (e.ferryCount ?? 0) >= 3 },

  { id: 'marathoner', name: 'Marathoner', icon:'🥾', tier:'silver',
    description: 'Win with a route of 12+ moves',
    check: (e) => e.won && (e.moves ?? 0) >= 12 },

  { id: 'sprinter', name: 'Sprinter', icon:'🏃', tier:'silver',
    description: 'Win in under 60 seconds',
    check: (e) => e.won && (e.durationMs ?? Infinity) <= 60000 },

  { id: 'flawless_line', name: 'Flawless Line', icon:'🧵', tier:'silver',
    description: 'Optimal win with no revisits',
    check: (e) => e.won && Number.isFinite(e.optimalMoves) &&
      e.moves === e.optimalMoves &&
      Array.isArray(e.pathUsed) &&
      new Set(e.pathUsed).size === e.pathUsed.length },

  { id: 'sea_and_stone', name: 'Sea & Stone', icon:'⚓', tier:'silver',
    description: 'Win using both a ferry and a bridge',
    check: (e) => e.won && (e.ferryCount ?? 0) > 0 && (e.bridgeCount ?? 0) > 0 },

  // ---- new: Gold ----
  { id: 'trailblazer', name: 'Trailblazer', icon:'🧭', tier:'gold',
    description: 'Win on Hard with no ferries or bridges',
    check: (e) => e.won && e.difficulty==='hard' && (e.ferryCount ?? 0)===0 && (e.bridgeCount ?? 0)===0 },

  { id: 'masterpiece', name: 'Masterpiece', icon:'🎨', tier:'gold',
    description: 'Win on Master with optimal moves',
    check: (e) => e.won && e.difficulty==='master' && Number.isFinite(e.optimalMoves) && e.moves === e.optimalMoves },

  { id: 'explorer_75', name: 'Explorer: 75%', icon:'🧭', tier:'gold',
    description: 'Visit 75% of all postcode areas',
    check: (_e,_h,meta) => (meta?.totalAreas > 0) && (meta.visitedCount / meta.totalAreas >= 0.75) },

  { id: 'networker', name: 'Networker', icon:'🔗', tier:'gold',
    description: 'Use at least half of all ferries and half of all bridges (lifetime)',
    check: (_e,_h,meta) => {
      const tf = meta?.totalFerries ?? 0, tb = meta?.totalBridges ?? 0;
      if (tf === 0 || tb === 0) return false;
      return (meta.usedFerriesCount ?? 0) >= Math.ceil(tf/2) &&
             (meta.usedBridgesCount ?? 0) >= Math.ceil(tb/2);
    } },

  // ---- new: Legendary ----
  { id: 'grand_tour', name: 'Grand Tour', icon:'🎒', tier:'legendary',
    description: 'Win with a route of 20+ moves',
    check: (e) => e.won && (e.moves ?? 0) >= 20 },

  { id: 'zero_assist_master', name: 'Zero-Assist Master', icon:'🧘', tier:'legendary',
    description: 'Win on Master with zero hints',
    check: (e,_h,meta) => e.won && e.difficulty==='master' && ((meta?.hintsUsed ?? 0) === 0) },

  { id: 'double_perfect', name: 'Double Perfect', icon:'✨', tier:'gold',
  description: 'Two consecutive wins with optimal moves',
  check: () => lastNGamesArePerfect(2) },

{ id: 'turkey', name: 'Turkey', icon:'✨', tier:'legendary',
  description: 'Three consecutive wins with optimal moves',
  check: () => lastNGamesArePerfect(3) },

  { id: 'infrastructure_chief', name: 'Infrastructure Chief', icon:'🏆', tier:'legendary',
    description: 'Use every ferry AND every bridge at least once (lifetime)',
    check: (_e,_h,meta) => {
      const tf = meta?.totalFerries ?? 0, tb = meta?.totalBridges ?? 0;
      if (tf === 0 || tb === 0) return false;
      return (meta.usedFerriesCount >= tf) && (meta.usedBridgesCount >= tb);
    } },

    // ---- Easy streaks ----
{ id: 'streak7_easy',  name: 'Warming Up — Easy',  icon:'🔥', tier:'bronze',
  description: '7-day daily streak on Easy',
  check: () => readStreakCount('easy') >= 7 },

{ id: 'streak14_easy', name: 'In the Groove — Easy', icon:'🔥', tier:'silver',
  description: '14-day daily streak on Easy',
  check: () => readStreakCount('easy') >= 14 },

{ id: 'streak30_easy', name: 'On a Roll — Easy', icon:'🔥', tier:'gold',
  description: '30-day daily streak on Easy',
  check: () => readStreakCount('easy') >= 30 },

// ---- Normal streaks ----
{ id: 'streak7_normal',  name: 'Warming Up — Normal',  icon:'🔥', tier:'bronze',
  description: '7-day daily streak on Normal',
  check: () => readStreakCount('normal') >= 7 },

{ id: 'streak14_normal', name: 'In the Groove — Normal', icon:'🔥', tier:'silver',
  description: '14-day daily streak on Normal',
  check: () => readStreakCount('normal') >= 14 },

{ id: 'streak30_normal', name: 'On a Roll — Normal', icon:'🔥', tier:'gold',
  description: '30-day daily streak on Normal',
  check: () => readStreakCount('normal') >= 30 },

// ---- Hard streaks ----
{ id: 'streak7_hard',  name: 'Warming Up — Hard',  icon:'🔥', tier:'bronze',
  description: '7-day daily streak on Hard',
  check: () => readStreakCount('hard') >= 7 },

{ id: 'streak14_hard', name: 'In the Groove — Hard', icon:'🔥', tier:'silver',
  description: '14-day daily streak on Hard',
  check: () => readStreakCount('hard') >= 14 },

{ id: 'streak30_hard', name: 'On a Roll — Hard', icon:'🔥', tier:'gold',
  description: '30-day daily streak on Hard',
  check: () => readStreakCount('hard') >= 30 },

// ---- Master streaks ----
{ id: 'streak7_master',  name: 'Warming Up — Master',  icon:'🔥', tier:'bronze',
  description: '7-day daily streak on Master',
  check: () => readStreakCount('master') >= 7 },

{ id: 'streak14_master', name: 'In the Groove — Master', icon:'🔥', tier:'silver',
  description: '14-day daily streak on Master',
  check: () => readStreakCount('master') >= 14 },

{ id: 'streak30_master', name: 'On a Roll — Master', icon:'🔥', tier:'gold',
  description: '30-day daily streak on Master',
  check: () => readStreakCount('master') >= 30 },

// 365 streak
{ id: 'streak_365', name: 'Unbreakable', icon:'🔥', tier:'legendary',
  description: 'Daily streak of 365 (any difficulty)',
  check: (_e,_h,_meta) => ['easy','normal','hard','master'].some(d => readStreakCount(d) >= 365) },

  // ---- new: Hidden (bonus) ----
  { id: 'island_hopper', name: 'Island Hopper', icon:'🏝️', tier:'silver', hidden:true,
    description: 'In one game, visit IM, JE and GY',
    check: (e) => e.won && Array.isArray(e.pathUsed) && ['IM','JE','GY'].every(x => e.pathUsed.includes(x)) },

  { id: 'there_and_back_again', name: 'There and Back Again', icon:'🔁', tier:'gold', hidden:true,
    description: 'Return to your start area before finishing (and still win)',
    check: (e) => {
      if (!e.won || !Array.isArray(e.pathUsed) || !e.startArea) return false;
      const mid = e.pathUsed.slice(1,-1);
      return mid.includes(e.startArea);
    } },

  { id: 'all_aboard', name: 'All Aboard!', icon:'🛳️', tier:'gold', hidden:true,
    description: 'Use 5+ ferries in a single win',
    check: (e) => e.won && (e.ferryCount ?? 0) >= 5 },

  { id: 'tunneller', name: 'Tunneller', icon:'🕳️', tier:'gold', hidden:true,
    description: 'Use 5+ bridges/tunnels in a single win',
    check: (e) => e.won && (e.bridgeCount ?? 0) >= 5 },

  { id: 'unlucky_13', name: 'Unlucky for Some', icon:'🎲', tier:'silver', hidden:true,
    description: 'Win in exactly 13 moves',
    check: (e) => e.won && e.moves === 13 },

  { id: 'bookends', name: 'Bookends', icon:'🔤', tier:'silver', hidden:true,
    description: 'Start and finish with the same initial letter',
    check: (e) => e.won && e.startArea?.[0] && (e.startArea[0] === e.endArea?.[0]) },

  { id: 'lejog_plus', name: 'LeJoG+', icon:'🏁', tier:'legendary', hidden:true,
    description: 'TR → KW in 15+ moves',
    check: (e) => e.won && e.startArea==='TR' && e.endArea==='KW' && (e.moves ?? 0) >= 15 },
];


export function evaluateAndUnlockAchievements(event, history, meta){
  const have = readJSON(ACHIEVEMENTS_KEY, {}); // { [id]: rec }
  const nowISO = new Date().toISOString();
  const newly = [];
  for (const a of ACHIEVEMENTS){
    if (!have[a.id] && a.check(event, history, meta)){
      have[a.id] = { ...a, unlockedAt: nowISO };
      newly.push(have[a.id]);
    }
  }
  if (newly.length) writeJSON(ACHIEVEMENTS_KEY, have);
  return newly;
}

export function addGameToHistory(event){
  const db = readJSON(GAME_HISTORY_KEY, { games: [] });
  db.games.push(event);
  writeJSON(GAME_HISTORY_KEY, db);
  return {
    totalGames: db.games.length,
    totalWins: db.games.filter(g=>g.won).length,
  };
}

// Helper that recalculates meta-based achievements (visits/coverage) and returns newly unlocked
export function checkAndUnlockMetaAchievements(difficulty, postcodeAreas, ferryLinks, bridgeLinks) {
  const db = readJSON(GAME_HISTORY_KEY, { games: [] });
  const history = { totalGames: db.games.length, totalWins: db.games.filter(g => g.won).length };
  const cov = getCoverageMeta();
  const meta = {
    ...cov,
    visitedCount: getVisitedCount(),
    totalAreas: Object.keys(postcodeAreas).length,
    dailyStreak: 0,
  };
  const dummy = { won: false, moves: 0, difficulty };
  return evaluateAndUnlockAchievements(dummy, history, meta);
}

export default function PostcodePursuit() {
// ------------------- STATE & REFS (unchanged from your file) --------------
const [gameState, setGameState] = useState('menu');
const [difficulty, setDifficulty] = useState('normal');
const [startArea, setStartArea] = useState('');
const [targetArea, setTargetArea] = useState('');
const [currentPath, setCurrentPath] = useState([]);
const [guesses, setGuesses] = useState([]);
const [gameWon, setGameWon] = useState(false);
const [optimalPath, setOptimalPath] = useState([]);
const [achievementToasts, setAchievementToasts] = useState([]);
const [showHints, setShowHints] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

const [showOutlines, setShowOutlines] = useState(true);
const [showLabels, setShowLabels] = useState(true);
const suppressClickUntilRef = useRef(0);
const [flashAreas, setFlashAreas] = useState([]);
const [showOptimal, setShowOptimal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);  
const [dailyMode, setDailyMode] = useState(false);
const [dailyDate, setDailyDate] = useState(null);             // 'YYYY-MM-DD' (UTC)

  const [victoryOpen, setVictoryOpen] = useState(false);

const ONBOARDING_KEY = 'pp:onboardingComplete:v1';

const isActiveRound = () => gameState === 'playing' && !gameWon;

const [showTutorial, setShowTutorial] = useState(false);
const [consentResolved, setConsentResolved] = useState(
  () => !!localStorage.getItem('pp_consents')
);

const canClickAreas = difficulty === 'easy';

// --- Soft Par helpers (Daily only) ---
const parForOptimal = (optimalMoves) => Math.max(1, Math.ceil(optimalMoves * 1.5));
const parDelta = (moves, par) => moves - par; // negative = under par
function golfLabel(delta) {
  if (delta <= -3) return 'albatross';
  if (delta === -2) return 'eagle';
  if (delta === -1) return 'birdie';
  if (delta === 0)  return 'par';
  if (delta === 1)  return 'bogey';
  if (delta === 2)  return 'double bogey';
  if (delta === 3)  return 'triple bogey';
  return `${Math.abs(delta)} over par`;
}
function golfPhrase(moves, par) {
  if (!Number.isFinite(par)) return null;
  const d = parDelta(moves, par);
  const name = golfLabel(d);
  if (d < 0)  return `${Math.abs(d)} under par (${name})`;
  if (d === 0) return `level par`;
  return `${d} over par (${name})`;
}

const [dailyPar, setDailyPar] = useState(null);

// Geometric helpers (centroids etc)
const roundIdRef = useRef(null);
const landClipId = useId();
const centroidsRef = useRef({});
 const getCenter = useCallback(
   (code) => postcodeAreas[code]?.center || centroidsRef.current[code] || null,
   []
 );

useEffect(() => {
  if (victoryOpen) {
    fireVictoryConfetti();
  }
}, [victoryOpen]);

// Pan/zoom state
const svgRef = useRef(null);
const gRef = useRef(null);
const contentRef = useRef(null);
const didAutoFitRef = useRef(false);
const hasFitRef = useRef(false);
const controlsRef = useRef(null);


//Toggle for Master Mode
const [masterMode, setMasterMode] = useState(false);

const edgeType = (a, b) => {
  if (ferryAdj.get(a)?.has(b)) return 'ferry';
  if (bridgeAdj.get(a)?.has(b)) return 'bridge';
  return 'land';
};

// -------- Daily Challenge setup --------

const [dailyDifficulty, setDailyDifficulty] = useState(null); // 'easy'|'normal'|'hard'|'master'

const MAX_DAILY_HINTS = 3;
const [hintsUsed, setHintsUsed] = useState(0);

function todayUTC() { return new Date().toISOString().slice(0,10); } // YYYY-MM-DD

const dailySessionKey = (d) => `pp_daily_session_v2_${d}`;

const saveDailySessionSnapshot = React.useCallback(() => {
  if (!dailyMode || !dailyDate || !dailyDifficulty) return;
  const elapsedSoFar =
    (elapsedMs || 0) + (gameStartRef.current ? Math.max(0, performance.now() - gameStartRef.current) : 0);

  const snapshot = {
    date: dailyDate,
    difficulty: dailyDifficulty,
    startArea, targetArea, currentPath, guesses, hintsUsed,
    optimalPath, elapsedMs: Math.floor(elapsedSoFar),
    gameWon, showOptimal, victoryOpen,
    par: dailyPar,
  };
  localStorage.setItem(dailySessionKey(dailyDifficulty), JSON.stringify(snapshot));
}, [
  dailyMode, dailyDate, dailyDifficulty,
  startArea, targetArea, currentPath, guesses, hintsUsed,
  optimalPath, elapsedMs, gameWon, showOptimal, victoryOpen, dailyPar
]);

const [burgerOpen, setBurgerOpen] = useState(false);
const burgerButtonRef = useRef(null);  // anchor for positioning
const [burgerPos, setBurgerPos] = useState({ top: 0, left: 0, width: 224 }); // menu width ~224px

const guessesCount = Math.max(0, currentPath.length - 1);
const parLine = (dailyMode && Number.isFinite(dailyPar))
  ? <>Par: <b>{dailyPar}</b> · <b>{golfPhrase(guessesCount, dailyPar)}</b></>
  : null;


useEffect(() => {
  if (!burgerOpen) return;
  // wait a tick for portal render
  const id = requestAnimationFrame(() => {
    const first = document.querySelector('#pp-burger-menu [role="menuitem"]');
    first?.focus?.();
  });
  return () => cancelAnimationFrame(id);
}, [burgerOpen]);

// recompute fixed coordinates when opening / on resize / on scroll
const positionBurgerMenu = useCallback(() => {
  const btn = burgerButtonRef.current;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const gap = 8; // px spacing below the button
  const width = 224; // keep in sync with style below
  const top = rect.bottom + gap;
  const left = Math.max(8, rect.right - width); // protect from going off-screen left
  setBurgerPos({ top, left, width });
}, []);

useEffect(() => {
  if (!burgerOpen) return;
  positionBurgerMenu();
  const onReflow = () => positionBurgerMenu();
  window.addEventListener('resize', onReflow);
  window.addEventListener('scroll', onReflow, true); // true = catch scrolls inside panels too
  return () => {
    window.removeEventListener('resize', onReflow);
    window.removeEventListener('scroll', onReflow, true);
  };
}, [burgerOpen, positionBurgerMenu]);

// close if overlays change
useEffect(() => { setBurgerOpen(false); }, [gameState, showAbout, showTutorial, victoryOpen]);

// --- Daily streak (UTC) ---

// --- Streak helpers (v2) ---  (place above the first effect that uses them)
const STREAK_KEY_V2 = (d) => `pp_daily_streak_v2_${d}`;

const readStreakRecord = React.useCallback((diff) => {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY_V2(diff)) || 'null'); }
  catch { return null; }
}, []);

const saveStreakRecord = React.useCallback((diff, count, lastWinDate) => {
  localStorage.setItem(STREAK_KEY_V2(diff), JSON.stringify({ count, lastWinDate }));
}, []);

const bumpStreakFor = React.useCallback((diff) => {
  const today = (Daily?.todayUTC?.() || todayUTC());
  const rec = readStreakRecord(diff) || { count: 0, lastWinDate: null };

  let next = 1;
  if (rec.lastWinDate === today) {
    next = rec.count;                       // already counted today
  } else if (rec.lastWinDate && daysBetweenUTC(rec.lastWinDate, today) === 1) {
    next = rec.count + 1;                   // extend
  }
  saveStreakRecord(diff, next, today);
  return next;
}, [readStreakRecord, saveStreakRecord]);

const readStreak = React.useCallback((diff) => {
  const rec = readStreakRecord(diff);
  if (rec && Number.isFinite(+rec.count)) return +rec.count;

  // Legacy fallback for Easy if v2 not present
  if (diff === 'easy') {
    const legacy = loadDailyStreak();
    const n = Number(legacy?.count || 0);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}, [readStreakRecord]);

function getRouteFromHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '').trim();
  return h || ''; // '' = main app
}
const [route, setRoute] = useState(getRouteFromHash());
useEffect(() => {
  const onHash = () => setRoute(getRouteFromHash());
  window.addEventListener('hashchange', onHash);
  return () => window.removeEventListener('hashchange', onHash);
}, []);
const navigate = useCallback((r) => {
  window.location.hash = r ? `#/${r}` : '#/';
}, []);

const [setDailyStreak] = useState(() => {
  const s = loadDailyStreak();
  return s?.count || 0;
});

useEffect(() => {
  const s = loadDailyStreak();
  if (!s?.lastWinDate) return;

  const today = todayUTC();
  const gap = daysBetweenUTC(s.lastWinDate, today);

  if (gap > 1) {
    setDailyStreak(0);
    saveDailyStreak(0, s.lastWinDate);
  }
}, [setDailyStreak]); 

React.useEffect(() => {
  // If v2 easy is missing but legacy exists, copy it across
  const v2 = readStreakRecord('easy');
  if (!v2) {
    try {
      const legacy = JSON.parse(localStorage.getItem('pp_daily_streak_v1') || 'null');
      if (legacy && Number(legacy.count) > 0 && legacy.lastWinDate) {
        saveStreakRecord('easy', Number(legacy.count), legacy.lastWinDate);
        setStreaks((s) => ({ ...s, easy: Number(legacy.count) }));
      }
    } catch {}
  }
}, [readStreakRecord, saveStreakRecord]);

// Daily puzzle hash
function bfsAllDistances(start){
  const dist = new Map([[start,0]]), q=[start];
  while (q.length){ const u=q.shift(); const du=dist.get(u);
    for (const v of getNeighbors(u)) if (!dist.has(v)){ dist.set(v, du+1); q.push(v); }
  }
  return dist;
}


const resetDailyFlags = React.useCallback(() => {
  setDailyMode(false);
  setDailyDate(null);
  setDailyDifficulty(null);
  setHintsUsed(0);
  setShowHints(false);
}, []);


function toggleHints(){
  if (dailyMode) {
    // Opening the panel consumes a hint (closing doesn't refund)
    if (!showHints) {
      if (hintsUsed >= MAX_DAILY_HINTS) {
        alert('No hints left for today.');
        return;
      }
      setHintsUsed(h => h + 1);
    }
  }
  setShowHints(v => !v);
}
const [dailyChoice, setDailyChoice] = useState(null);   // 'easy'|'normal'|'hard'|'master'|null
const [freeChoice,  setFreeChoice]  = useState(null);

const DIFF_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard', master: 'Master' };
const DIFF_DESCRIPTIONS = {
  easy:   'Postcode area outlines and labels are shown. Revisit and undo both allowed.',
  normal: 'Postcode area outlines are shown. Labels hidden on unvisited areas. Revisiting and undo both allowed.',
  hard:   'No outlines or labels are shown. Revisiting is not allowed.',
  master: 'Only start, target and visited areas are shown. Revisit and undo both disabled.',
};


const undoLastMove = useCallback(() => {
  if (currentPath.length <= 1 || gameWon) return; // can't undo the start, or after win
  const newPath = currentPath.slice(0, -1);
  setCurrentPath(newPath);
  setFlashAreas(prev => prev.filter(a => a !== currentPath[currentPath.length - 1]));

  window.gtag?.('event', 'move_undone', {
    difficulty,
    start_postcode: startArea,
    target_postcode: targetArea,
    path_len_after: newPath.length - 1,
    round_id: roundIdRef.current || undefined,
  });
}, [currentPath, gameWon, difficulty, startArea, targetArea]);

useEffect(() => {
  if (masterMode) return; // 🚫 no hotkey in Master

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undoLastMove();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [undoLastMove, masterMode]);


function startOrResumeDaily(difficulty) {
  const today = Daily.todayUTC();
  const snap = Daily.loadSnapshot(difficulty);

  // Visual toggles
  if (difficulty === 'easy')   { setShowOutlines(true);  setShowLabels(true);  setMasterMode(false); }
  if (difficulty === 'normal') { setShowOutlines(true);  setShowLabels(false); setMasterMode(false); }
  if (difficulty === 'hard')   { setShowOutlines(false); setShowLabels(false); setMasterMode(false); }
  if (difficulty === 'master') { setShowOutlines(false); setShowLabels(false); setMasterMode(true);  }
  setDifficulty(difficulty);

  // Resume if today’s snapshot exists for this difficulty

  // Fresh daily
  const { start, target, path } =
    Daily.generateTodayDaily(difficulty, postcodeAreas, getNeighbors, boundsByDifficulty);


  if (snap && snap.date === today) {

        const resolvedOptimal =
          Array.isArray(snap.optimalPath) && snap.optimalPath.length
            ? snap.optimalPath
            : Daily.findShortestPathDet(snap.startArea, snap.targetArea, getNeighbors);

            setOptimalPath(resolvedOptimal);
            setDailyPar(
             Number.isFinite(snap.par) ? snap.par : parForOptimal(Math.max(0, resolvedOptimal.length - 1))
            );

    addVisited([start]);
    setDailyMode(true);
    setDailyDate(snap.date);
    setDailyDifficulty(difficulty);

    setHintsUsed(snap.hintsUsed ?? 0);
    setStartArea(snap.startArea);
    setTargetArea(snap.targetArea);
    setCurrentPath(Array.isArray(snap.currentPath) && snap.currentPath.length ? snap.currentPath : [snap.startArea]);
    setGuesses(Array.isArray(snap.guesses) ? snap.guesses : []);
/*     setOptimalPath(Array.isArray(snap.optimalPath) ? snap.optimalPath
                    : Daily.findShortestPathDet(snap.startArea, snap.targetArea, getNeighbors)); */
    setShowOptimal(!!snap.showOptimal);
    setElapsedMs(snap.elapsedMs || 0);

    if (snap.gameWon) {
      setGameWon(true);
      setVictoryOpen(true);     // show Share immediately
      setGameState('gameWon');
      gameStartRef.current = null;
    } else {
      setGameWon(false);
      setVictoryOpen(!!snap.victoryOpen);
      setGameState('playing');
      gameStartRef.current = performance.now() - (snap.elapsedMs || 0);
      requestAnimationFrame(() => focusStartAndTarget(snap.startArea, snap.targetArea));
    }
    return;
  }

setDailyChoice(null);
setFreeChoice(null);

  

  setDailyMode(true);
  setDailyDate(today);
  setDailyDifficulty(difficulty);
  setHintsUsed(0);
  setShowHints(false);

  abandonIfActive('daily_start');
  setStartArea(start);
  setTargetArea(target);
  setCurrentPath([start]);
  setGuesses([]);
  setGameWon(false);
  setOptimalPath(path);
  setGameState('playing');
  gameStartRef.current = performance.now();
  setElapsedMs(0);
  setVictoryOpen(false);
  setShowOptimal(false);

  addVisited([start]);

  requestAnimationFrame(() => focusStartAndTarget(start, target));
}


useEffect(() => {
  if (!dailyMode || !dailyDate || !dailyDifficulty) return;

  const elapsedSoFar =
    (elapsedMs || 0) +
    (gameStartRef.current ? Math.max(0, performance.now() - gameStartRef.current) : 0);

  Daily.saveSnapshot(dailyDifficulty, {
    date: dailyDate,
    difficulty: dailyDifficulty,
    startArea,
    targetArea,
    currentPath,
    guesses,
    hintsUsed,
    optimalPath,
    elapsedMs: Math.floor(elapsedSoFar),
    gameWon,
    showOptimal,
    victoryOpen,
    par: dailyPar
  });
}, [
  dailyMode, dailyDate, dailyDifficulty,
  startArea, targetArea, currentPath, guesses,
  hintsUsed, optimalPath, elapsedMs, gameWon,
  showOptimal, victoryOpen, dailyPar
]);


// ------------------- HELPERS, EFFECTS, CALLBACKS --------------------------
// difficulty
  const startWithDifficulty = (mode) => {
    if (gameState === 'playing' && !gameWon) {
    fireReroll(mode === difficulty ? 'same_difficulty' : 'change_difficulty');
  }
  resetDailyFlags(); 

	setDifficulty(mode);
    if (mode === 'easy') {
      setShowOutlines(true); setShowLabels(true); setMasterMode(false);
    } else if (mode === 'normal') {
      setShowOutlines(true); setShowLabels(false); setMasterMode(false);
    } else if (mode === 'hard') {
      setShowOutlines(false); setShowLabels(false); setMasterMode(false);
    } else if (mode === 'master') {
      setShowOutlines(false); setShowLabels(false); setMasterMode(true);
    }
    startNewGame();
  };
  
const arcPathBridge = (a, b) => arcPath(a, b, 0.12);
const arcPathFerry  = (a, b) => arcPath(a, b, 0.18);

const isRevealed = useCallback(
  (code) =>
    masterMode
      ? code === startArea || code === targetArea || currentPath.includes(code)
      : true,
  [masterMode, startArea, targetArea, currentPath]
);



  //const [streak, setStreak] = useState(() => Number(localStorage.getItem('pp_streak') || 0));
  const gameStartRef = useRef(null);
  
  const isMapInteractive = gameState !== 'menu' && !victoryOpen;

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m ? `${m}m ${r}s` : `${r}s`;
  };

useEffect(() => {
  if (!dailyMode) return;
  saveDailySessionSnapshot();
}, [
  dailyMode, dailyDate, dailyDifficulty,
  startArea, targetArea, currentPath, guesses,
  hintsUsed, optimalPath, elapsedMs, gameWon,
  showOptimal, victoryOpen, saveDailySessionSnapshot
]);

const DIFF_ORDER = ['easy', 'normal', 'hard', 'master'];


  const { reset, zoomIn, zoomOut } = useSvgPan(svgRef, gRef, {
    enabled: isMapInteractive,
    min: MIN_SCALE,
    max: MAX_SCALE,
    onChange: ({ scale }) => setScaleForLabels(scale),
  });

 const fitToContent = useCallback((padding = 0.92) => {
   const g = contentRef.current;
   if (!g) return;
   const bbox = g.getBBox();
   if (!bbox || bbox.width === 0 || bbox.height === 0) return;

   const vw = WORLD.width;
   const vh = WORLD.height;
   const fitScale = padding * Math.min(vw / bbox.width, vh / bbox.height);
   const viewCx = WORLD.x + vw / 2;
   const viewCy = WORLD.y + vh / 2;
    const contentCx = bbox.x + bbox.width / 2;
    const contentCy = bbox.y + bbox.height / 2;

    const newTx = viewCx - fitScale * contentCx;
    const newTy = viewCy - fitScale * contentCy;

    reset({ scale: fitScale, x: newTx, y: newTy });
    hasFitRef.current = true;
  }, [reset]);


  function parInfo({ moves, optimal, parMoves }) {
  const par = Number.isFinite(parMoves) ? parMoves : Math.max(1, Math.ceil(optimal * 1.5));
  const delta = moves - par;

  const label =
    delta <= -3 ? `Albatross (${delta})` :
    delta === -2 ? 'Eagle (-2)' :
    delta === -1 ? 'Birdie (-1)' :
    delta ===  0 ? 'Par (E)' :
    delta ===  1 ? 'Bogey (+1)' :
    delta ===  2 ? 'Double bogey (+2)' :
                   `+${delta}`;

  return { par, delta, label };
}

const buildShareText = () => {
  const guessesCount = Math.max(0, currentPath.length - 1);
  const optimal = Math.max(0, (optimalPath?.length || 1) - 1);

  const { par, label } = parInfo({ moves: guessesCount, optimal });
  const time = elapsedMs ? formatTime(elapsedMs) : null;

  const header = dailyMode
    ? `Postcode Pursuit — Daily ${dailyDate} (${dailyDifficulty} difficulty)`
    : `Postcode Pursuit`;

  let text = `${header}\n`;
  if (!dailyMode) text += `${startArea} → ${targetArea}\n`;

  text += `Moves: ${guessesCount}`;
  if (optimal) text += ` (optimal ${optimal})\n`;
  text += `Par ${par} : ${label}\n`;
  if (dailyMode) text += ` · Hints used: ${hintsUsed}/${MAX_DAILY_HINTS}`;
  if (time) text += ` · Time: ${time}`;

  if (dailyMode && dailyDifficulty) {
    const streak = (streaks?.[dailyDifficulty] ?? readStreak?.(dailyDifficulty) ?? 0);
    if (streak > 0) text += ` · ${DIFF_LABELS[dailyDifficulty]} streak: ${streak}`;
  }

  text += `\npostcode-pursuit.co.uk`;
  return text;
};



  const linkPaint = (type) => {
  switch (type) {
    case "ferry":
      return { stroke: "#0284c7", width: 12, dash: "40 28" }; // cyan-ish, dashed
    case "tunnel":
      return { stroke: "#adb0b6ff", width: 3, dash: "5 1" }; // slate-600, dotted-ish
    case "bridge":
    default:
      return { stroke: "#ffffffff", width: 3, dash: "" };      // slate-600, solid
  }
};

/*   const handleInputSubmit = (inputElement) => {
    const val = inputElement.value.toUpperCase().trim();
    if (postcodeAreas[val]) {
      makeGuess(val);
      inputElement.value = '';
    }
  }; */

  const handleInputSubmit = (inputElement) => {
  const val = inputElement.value.toUpperCase().trim();
  if (!val) return;
  makeGuess(val);              // allow invalid/decoy -> will flash as invalid
  inputElement.value = '';
  setSelectorEmpty(true);
};


  
  const inputRef = useRef(null);

  const shareResult = async () => {
    const text = buildShareText();
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        alert('Result copied to clipboard!');
      }
    } catch {/* ignore */}
  };
  
   const bridgeAdj = React.useMemo(() => {
  const m = new Map();
  (bridgeLinks ?? []).forEach(({ a, b }) => {
    if (!postcodeAreas[a] || !postcodeAreas[b]) return;
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a).add(b);
    m.get(b).add(a);
  });
  return m;
}, []);

const ferryAdj = React.useMemo(() => {
  const m = new Map();
  (ferryLinks ?? []).forEach(({ a, b }) => {
    if (!postcodeAreas[a] || !postcodeAreas[b]) return;
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a).add(b);
    m.get(b).add(a);
  });
  return m;
}, []);

// Big list for the selection box: real area codes + plausible decoys
const allPostcodeOptions = React.useMemo(
  () => Object.keys(postcodeAreas).sort((a, b) => a.localeCompare(b)),
  []
);


const forceUppercase = useCallback((e) => {
  const el = e.currentTarget;
  const { selectionStart, selectionEnd } = el;
  const up = el.value.toUpperCase();
  if (el.value !== up) {
    el.value = up;
    // preserve caret position
    el.setSelectionRange(selectionStart, selectionEnd);
  }
}, []);

// state (near your other state)
const [selectorEmpty, setSelectorEmpty] = useState(true);
const shouldPulse =
  gameState === 'playing' &&
  !gameWon &&
  !showTutorial &&
  !showAbout &&
  !victoryOpen &&
  selectorEmpty;
// keep your forceUppercase, then wrap it:
const handleSelectorInput = useCallback((e) => {
  forceUppercase(e);
  setSelectorEmpty(e.currentTarget.value.trim() === "");
}, [forceUppercase]);

const [showNudge, setShowNudge] = useState(false);
const nudgeDismissedRef = useRef(false);

useEffect(() => {
  if (!consentResolved) return;

  const atStart = gameState === 'playing' && currentPath.length === 1;
  if (!atStart || nudgeDismissedRef.current) {
    setShowNudge(false);
    return;
  }

  const id = window.setTimeout(() => setShowNudge(true), 20000);
  return () => window.clearTimeout(id);
}, [consentResolved, gameState, currentPath.length]);

const dismissNudge = () => {
  nudgeDismissedRef.current = true; // don’t show again this round
  setShowNudge(false);
};

const tallyEdgeUsage = useCallback((path) => {
  let ferryCount = 0, bridgeCount = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (ferryAdj.get(a)?.has(b)) ferryCount++;
    else if (bridgeAdj.get(a)?.has(b)) bridgeCount++;
  }
  return { ferryCount, bridgeCount };
}, [ferryAdj, bridgeAdj]);


useEffect(() => {
  console.log('toast check', { consentResolved, gameState, len: currentPath.length, dismissed: nudgeDismissedRef.current });
}, [consentResolved, gameState, currentPath.length]);

useEffect(() => {
  console.log('showNudge ->', showNudge);
}, [showNudge]);

// listen for consent completion from ConsentManager
useEffect(() => {
  const onResolved = () => setConsentResolved(true);
  window.addEventListener('pp:consent:resolved', onResolved);
  return () => window.removeEventListener('pp:consent:resolved', onResolved);
}, []);

// only show the tutorial after consent is resolved
useEffect(() => {
  if (!consentResolved) return;
  const done = localStorage.getItem(ONBOARDING_KEY) === 'true';
  if (!done) setShowTutorial(true);
}, [consentResolved]);

// Menu choosers
const [showDailyChooser, setShowDailyChooser] = useState(false);
const [showFreePlayChooser, setShowFreePlayChooser] = useState(false);

// simple appear animation state
/* const [dailyAnim, setDailyAnim] = useState("opacity-0 -translate-y-2 scale-95");
useEffect(() => {
  if (!showDailyChooser) return;
  const id = requestAnimationFrame(() =>
    setDailyAnim("opacity-100 translate-y-0 scale-100")
  );
  return () => cancelAnimationFrame(id);
}, [showDailyChooser]); */


// Close chooser(s) with Escape
useEffect(() => {
  if (!showDailyChooser && !showFreePlayChooser) return;
  const onKey = (e) => { if (e.key === 'Escape') { setShowDailyChooser(false); setShowFreePlayChooser(false); } };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [showDailyChooser, showFreePlayChooser]);


// simple appear animation for Free Play
const [freeAnim, setFreeAnim] = useState("opacity-0 -translate-y-2 scale-95");
useEffect(() => {
  if (!showFreePlayChooser) return;
  const id = requestAnimationFrame(() =>
    setFreeAnim("opacity-100 translate-y-0 scale-100")
  );
  return () => cancelAnimationFrame(id);
}, [showFreePlayChooser]);

const [menuAnimClass, setMenuAnimClass] = useState("opacity-0 -translate-y-1 scale-95");

useEffect(() => {
  if (!burgerOpen) return;
  // let the element paint, then animate in
  const id = requestAnimationFrame(() =>
    setMenuAnimClass("opacity-100 translate-y-0 scale-100")
  );
  return () => cancelAnimationFrame(id);
}, [burgerOpen]);


// --- unified neighbors (land + ferries + bridges) ---
const getNeighbors = React.useCallback((code) => {
  const set = new Set(postcodeAreas[code]?.neighbors ?? []);

  const ferries = ferryAdj.get(code);
  if (ferries) ferries.forEach((n) => set.add(n));

  const bridges = bridgeAdj.get(code);
  if (bridges) bridges.forEach((n) => set.add(n));

  return Array.from(set);
}, [ferryAdj, bridgeAdj]);

  // ---------- ICONS & PULSES ----------
  const attachPathRef = (id) => (el) => {
    if (!el) return;
    const b = el.getBBox();
    centroidsRef.current[id] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  function TargetMarker({ id }) {
    const c = centroidsRef.current[id];
    if (!c) return null;
    return (
      <g pointerEvents="none">
        <circle
          cx={c.x}
          cy={c.y}
          r={1}
          className="[transform-box:fill-box] [transform-origin:center] animate-ping fill-transparent stroke-amber-500 stroke-2 opacity-70"
        />
        <Flag
          x={c.x -25} y={c.y -200} width={200} height={200}
          className="text-white-900"
          strokeWidth={2.5}
          stroke='black'
          strokeOpacity={0.5}
        />
      </g>
    );
  }

  function StartMarker({ id }) {
    const c = centroidsRef.current[id];
    if (!c) return null;
    return (
      <g pointerEvents="none">
        <circle cx={c.x} cy={c.y} r={1} className="fill-white/80" />
        <MapPin
          x={c.x - 100} y={c.y - 200} width={200} height={200}
          className="text-white-700"
          strokeWidth={2.5}
          stroke='black'
          strokeOpacity={0.5}
        />
      </g>
    );
  }

  function CurrentMarker({ id }) {
    const c = centroidsRef.current[id];
    if (!c) return null;
    return (
      <g pointerEvents="none">
        <circle cx={c.x} cy={c.y} r={1} className="fill-blue-700 opacity-90" />
        <circle cx={c.x} cy={c.y} r={1}
          className="[transform-box:fill-box] [transform-origin:center] animate-ping fill-transparent stroke-blue-700 stroke-2 opacity-60"
        />
      </g>
    );
  }

  function StepBadge({ id, index }) {
    const c = centroidsRef.current[id];
    if (!c) return null;
    return (
      <g pointerEvents="none">
        <circle cx={c.x} cy={c.y} r={9} className="fill-white stroke-slate-700" />
        <text x={c.x} y={c.y + 4} textAnchor="middle"
          className="fill-slate-900 text-[10px] font-semibold">
          {index + 1}
        </text>
      </g>
    );
  }
  
/* function bfsAllDistances(start) {
  const dist = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const u = q.shift();
    const du = dist.get(u);
    for (const v of getNeighbors(u)) {
      if (!dist.has(v)) {
        dist.set(v, du + 1);
        q.push(v);
      }
    }
  }
  return dist; // Map<areaCode, steps>
} */

  // Return a quadratic curve string between area centres, with a slight bend
function arcPath(a, b, bend = 0.18) {
  const A = getCenter(a), B = getCenter(b);
  if (!A || !B) return null;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len; // unit normal
  const cx = mx + nx * bend * len;
  const cy = my + ny * bend * len;
  return `M ${A.x} ${A.y} Q ${cx} ${cy} ${B.x} ${B.y}`;
}

function bfsDistance(start, target) {
  if (!start || !target || start === target) return 0;
  const q = [[start, 0]];
  const seen = new Set([start]);
  while (q.length) {
    const [node, d] = q.shift();
    for (const n of getNeighbors(node)) {
      if (seen.has(n)) continue;
      if (n === target) return d + 1;
      seen.add(n);
      q.push([n, d + 1]);
    }
  }
  return Infinity;
}

function fireReroll(reason = 'new_game_button') {
  if (!isActiveRound()) return;
  const elapsedSec =
    gameStartRef.current ? Math.round((performance.now() - gameStartRef.current) / 1000) : null;
  const pathLen = optimalPath?.length ? optimalPath.length - 1 : null;

  window.gtag?.('event', 'game_rerolled', {
    difficulty,
    path_length: pathLen,
    elapsed_sec: elapsedSec,
    reason,                  // 'new_game_button' | 'change_difficulty' | etc.
    round_id: roundIdRef.current,
  });
}



const [errorToast, setErrorToast] = useState('');

const showError = useCallback((msg) => {
  setErrorToast(msg);
  try { 
    if ('vibrate' in navigator) navigator.vibrate(40); 
  } catch {}
}, []);



const [giveUpOpen, setGiveUpOpen] = useState(false);

const giveUpNow = useCallback(() => {
  // stop the clock
  const end = performance.now();
  const ms = gameStartRef.current ? Math.max(0, end - gameStartRef.current) : 0;
  setElapsedMs(ms);

  // record a LOSS in history (mirrors your win event)
  const advancingGuesses = guesses.filter(g => g.valid && !g.alreadyVisited);
  const ferryCount   = advancingGuesses.filter(g => g.viaFerry).length;
  const bridgeCount  = advancingGuesses.filter(g => g.viaBridge).length;
  const optimalMoves = Math.max(0, (optimalPath?.length || 1) - 1);

  const event = {
    id: (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
    dateISO: new Date().toISOString(),
    mode: dailyMode ? 'daily' : 'free',
    difficulty,
    won: false,                                        // 👈 LOSS
    moves: Math.max(0, currentPath.length - 1),
    durationMs: ms,
    usedFerry: ferryCount > 0,
    usedBridge: bridgeCount > 0,
    ferryCount,
    bridgeCount,
    optimalMoves,
    pathUsed: currentPath.slice(),
    startArea,
    endArea: targetArea,
  };
  addGameToHistory(event);

  // optional: analytics
  window.gtag?.('event', 'game_gave_up', {
    difficulty,
    start_postcode: startArea,
    target_postcode: targetArea,
    guesses: Math.max(0, currentPath.length - 1),
    time_ms: ms,
    round_id: roundIdRef.current || undefined,
  });

  // close + go back
  setGiveUpOpen(false);
  setVictoryOpen(false);
  setGameState('menu');
  roundIdRef.current = null;
}, [
  guesses, optimalPath, currentPath, startArea, targetArea,
  dailyMode, difficulty
]);



function Toast({ open, onClose, action, children }) {
  if (!open) return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        zIndex: 2147483000,
      }}
    >
      <div className="glass glass- rounded-xl shadow-lg px-3 py-2 flex items-start gap-2 max-w-[92vw] w-[520px]">
        <div className="text-sm flex-1">{children}</div>
        {action && (
          <button type="button" className="btn btn-success" onClick={action.onClick}>
            {action.label}
          </button>
        )}
        <button type="button" className="btn btn-neutral" onClick={onClose} aria-label="Dismiss">
          Dismiss
        </button>
      </div>
    </div>,
    document.body
  );
}


  // ---------- STATE CLASSES (Option A) ----------
const focusStartAndTarget = React.useCallback((startCode, targetCode, pad = 0.2) => {
  const A = getCenter(startCode);
  const B = getCenter(targetCode);
  if (!A || !B) return;

  // Tight bbox around the two points
  const minX = Math.min(A.x, B.x), maxX = Math.max(A.x, B.x);
  const minY = Math.min(A.y, B.y), maxY = Math.max(A.y, B.y);


 const MIN_FRACTION = 0.18;
 const spanX = Math.max(maxX - minX, WORLD.width  * MIN_FRACTION);
 const spanY = Math.max(maxY - minY, WORLD.height * MIN_FRACTION);

  // Expand by padding
  const w = spanX * (1 + pad * 2);
  const h = spanY * (1 + pad * 2);

  // Center of the pair
  const cx = (A.x + B.x) / 2;
  const cy = (A.y + B.y) / 2;

  // Compute scale to fit w×h inside the VIEWBOX
  const vw = WORLD.width, vh = WORLD.height;
  let s = Math.min(vw / w, vh / h);
  s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

  // Translate so the pair center is in the middle of the viewBox
  const viewCx = WORLD.x + vw / 2;
  const viewCy = WORLD.y + vh / 2;
  const tx = viewCx - s * cx;
  const ty = viewCy - s * cy;

  reset({ scale: s, x: tx, y: ty });

  hasFitRef.current = true;       // prevent other auto-fits
  didAutoFitRef.current = true;   // prevent the “first-fit” effect
}, [reset, getCenter]);



const COLORS = {
  baseFill:    '#66b860', // slate-200
  baseStroke:  '#454f5eff', // slate-400
  startFill:   '#60abb8ff', startStroke: '#1e40af',
  currentFill: '#1d4ed8', currentStroke:'#ffffffff',
  visitedFill: '#bae6fd', visitedStroke:'#424c5cff',
  targetFill:  '#FDE68A', targetStroke:'#b45309',
};

  const currentArea = currentPath[currentPath.length - 1] || null;
 // const visitedSet  = useMemo(() => new Set(currentPath), [currentPath]);
 
const getAreaStyle = (code) => {
  // Flags
  const isStart   = code === startArea;
  const isTarget  = code === targetArea;
  const isCurrent = currentArea && code === currentArea && !isStart;
  const isVisited = currentPath.includes(code);
  const isFlashing = flashAreas.includes(code);

  // MASTER: hide everything except start/target/current/visited
  const revealedInMaster = isStart || isTarget || isVisited || isCurrent;
  if (masterMode && !revealedInMaster) 
  
  
  
  
  {

    return { fill: 'transparent', stroke: 'none', strokeWidth: 0 };
  }



  
  // 🔴 Invalid/duplicate guess flash overrides everything for 400ms
if (isFlashing) {
  return {
    fill: 'url(#pp-invalid-stripes)',   // texture (not color)
    stroke: '#000',                     // high-contrast border
    strokeWidth: 4.5,                   // clearly thicker than normal
    strokeDasharray: '6 4',             // hint via line style
  };
}

  // ---- normal coloring ----
  let fill   = COLORS.baseFill;
  let stroke = COLORS.baseStroke;
  let dash   = null;

  if (isTarget) {
    fill = COLORS.targetFill;  stroke = COLORS.targetStroke;
  } else if (isStart) {
    fill = COLORS.startFill;   stroke = COLORS.startStroke;
  } else if (isCurrent) {
    fill = COLORS.currentFill; stroke = COLORS.currentStroke;
  } else if (isVisited) {
    fill = COLORS.visitedFill; stroke = COLORS.visitedStroke; dash = '3 3';
  }





  // Visited areas force outlines ON regardless of toggle/mode (your a11y rule)
  const outlinesOn = showOutlines || isVisited;
  
  

  return {
    fill,
    stroke: outlinesOn ? (isVisited ? COLORS.visitedStroke : stroke) : 'none',
    strokeWidth: outlinesOn ? 1.25 : 0,
    ...(outlinesOn && dash ? { strokeDasharray: dash } : {}),
    ...(outlinesOn ? {} : { shapeRendering: 'crispEdges' }),
  };
};
// pick a single example neighbour for the nudge
const [exampleNeighbor, setExampleNeighbor] = useState('');

useEffect(() => {
  if (gameState !== 'playing' || currentPath.length === 0) {
    setExampleNeighbor('');
    return;
  }
  const current = currentPath[currentPath.length - 1];
  // valid neighbours you haven’t visited yet
  const candidates = getNeighbors(current).filter(n => !currentPath.includes(n));

  if (candidates.length) {
    // deterministic-ish pick so it doesn’t flicker every render
    const seed =
      (current?.charCodeAt?.(0) || 0) +
      (targetArea?.charCodeAt?.(0) || 0) +
      (targetArea?.charCodeAt?.(1) || 0);
    const idx = seed % candidates.length;
    setExampleNeighbor(candidates[idx]);
  } else {
    setExampleNeighbor('');
  }
}, [gameState, currentPath, getNeighbors, targetArea]);

// --- Achievements setup

const [statsVersion, setStatsVersion] = React.useState(0);

const resetAllStats = React.useCallback(({ alsoResetStreaks = true } = {}) => {
  // Gameplay history
  localStorage.removeItem(GAME_HISTORY_KEY);

  // Achievements + visited progress
  localStorage.removeItem(ACHIEVEMENTS_KEY);
  localStorage.removeItem(VISITED_KEY);

  // Lifetime coverage caches (🚨 the missing bit)
  localStorage.removeItem(USED_FERRIES_KEY);
  localStorage.removeItem(USED_BRIDGES_KEY);

  // Daily streaks (optional)
  if (alsoResetStreaks) {
    ['easy','normal','hard','master'].forEach(d =>
      localStorage.removeItem(STREAK_KEY_V2(d))
    );
    localStorage.removeItem('pp_daily_streak_v1'); // legacy
  }

  // UI updates
  setAchievementToasts([]);
  setStatsVersion(v => v + 1);
}, []);


function computeStats(){
  const db = readJSON(GAME_HISTORY_KEY, { games: [] });
  const g = db.games;
  const wins = g.filter(x=>x.won);

  // helper: average (moves - par) where par = ceil(optimal*1.5)
  const avgVsPar = (list) => {
    const deltas = [];
    for (const x of list) {
      if (!x.won) continue;
      const opt = Number(x.optimalMoves);
      const mov = Math.max(0, Number(x.moves || 0));
      if (!Number.isFinite(opt)) continue;
      const par = Math.ceil(Math.max(0, opt) * 1.5);
      deltas.push(mov - par);
    }
    if (!deltas.length) return null;
    const mean = deltas.reduce((a,b)=>a+b,0) / deltas.length;
    return Number(mean.toFixed(1));  // e.g. -1.2, +0.7
  };

  const DIFFS = ['easy','normal','hard','master'];
  const byDiff = DIFFS.map(d => {
    const list = g.filter(x=>x.difficulty===d);
    const games = list.length;
    const w = list.filter(x=>x.won).length;
    return {
      difficulty: d,
      games,
      wins: w,
      avgVsPar: avgVsPar(list),  // may be null if no qualifying wins
    };
  });

  return {
    totalGames: g.length,
    winRate: g.length ? Math.round(wins.length / g.length * 100) : 0,
    avgMoves: wins.length ? (wins.reduce((s,x)=>s+x.moves,0)/wins.length).toFixed(1) : '—',
    bestTime: wins.length ? Math.min(...wins.map(x=>x.durationMs)) : null,
    avgVsPar: avgVsPar(g), // overall
    byDiff,
  };
}



const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);


  // ---------- Victory modal timing ----------
// BEFORE: const finishGame = useCallback(() => { ... }, [...]);

const finishGame = useCallback((finalPath) => {
  const path = Array.isArray(finalPath) && finalPath.length ? finalPath : currentPath;

  setGameWon(true);
  addVisited([targetArea], postcodeAreas);

  setGameState('gameWon');
  const end = performance.now();
  const ms = gameStartRef.current ? Math.max(0, end - gameStartRef.current) : 0;
  setElapsedMs(ms);

  const { ferryCount, bridgeCount } = tallyEdgeUsage(path);
  const optimalMoves = Math.max(0, (optimalPath?.length || 1) - 1);

  const event = {
    id: (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
    dateISO: new Date().toISOString(),
    mode: dailyMode ? 'daily' : 'free',
    difficulty,
    won: true,
    moves: Math.max(0, path.length - 1),
    durationMs: ms,
    usedFerry: ferryCount > 0,
    usedBridge: bridgeCount > 0,
    ferryCount,
    bridgeCount,
    optimalMoves,
    pathUsed: path.slice(),
    startArea,
    endArea: targetArea,
  };

  const history = addGameToHistory(event);

// 1) Bump streak first so achievements see the new value
let streakAfter = 0;
if (dailyMode && dailyDate && dailyDifficulty) {
  streakAfter = bumpStreakFor(dailyDifficulty);
  setStreaks((s) => ({ ...s, [dailyDifficulty]: streakAfter }));
  if (dailyDifficulty === 'easy') {
    setDailyStreak(streakAfter);
    saveDailyStreak(streakAfter, todayUTC());
  }
}

// 2) Now compute meta and evaluate
  // 🔹 Get the *post-win* streak first (0 if not daily)
  let nextStreak = 0;
  if (dailyMode && dailyDate && dailyDifficulty) {
    nextStreak = bumpStreakFor(dailyDifficulty);           // persists & returns new count
    setStreaks((s) => ({ ...s, [dailyDifficulty]: nextStreak }));
    if (dailyDifficulty === 'easy') {
      setDailyStreak(nextStreak);                           // keep legacy state in sync
      saveDailyStreak(nextStreak, todayUTC());
    }
  }

  const cov = getCoverageMeta(ferryLinks, bridgeLinks);
  const meta = {
    dailyStreak: nextStreak,                                // ✅ use the updated value
    visitedCount: getVisitedCount(),
    totalAreas: Object.keys(postcodeAreas).length,
    ...cov,
  };
const unlocked = evaluateAndUnlockAchievements(event, history, meta);
if (unlocked.length) setAchievementToasts(q => [...q, ...unlocked]);

  if (window.gtag) {
    window.gtag('event', 'game_won', {
      difficulty,
      start_postcode: startArea,
      target_postcode: targetArea,
      guesses: Math.max(0, path.length - 1),
      time_ms: ms,
      round_id: roundIdRef.current || undefined,
    });
  }

  setVictoryOpen(true);
}, [
  currentPath, optimalPath,
  difficulty, startArea, targetArea,
  dailyDate, dailyMode, dailyDifficulty,
  bumpStreakFor, tallyEdgeUsage, setDailyStreak
]);



useEffect(() => {
  if (gameState !== 'menu' && !hasFitRef.current) {
    requestAnimationFrame(() => fitToContent());
  }
}, [gameState, fitToContent]);

// Lock page scroll only while the map is active (no modals)
useEffect(() => {
  const prevHtml = document.documentElement.style.overflow;
  const prevBody = document.body.style.overflow;

 const shouldLock =
   (gameState !== 'menu' && !showAbout && !victoryOpen && !showTutorial)
   || showDailyChooser
   || showFreePlayChooser
   || victoryOpen
   || giveUpOpen
   || showAbout
   || leaveConfirmOpen
   || showTutorial;

  document.documentElement.style.overflow = shouldLock ? 'hidden' : prevHtml || '';
  document.body.style.overflow = shouldLock ? 'hidden' : prevBody || '';

  return () => {
    document.documentElement.style.overflow = prevHtml;
    document.body.style.overflow = prevBody;
  };
}, [gameState, showAbout, victoryOpen, showTutorial, showDailyChooser, showFreePlayChooser, giveUpOpen, leaveConfirmOpen]);

  // controls height -> CSS var
  useEffect(() => {
    if (!controlsRef.current) return;
    const setVar = () =>
      document.documentElement.style.setProperty('--controls-h', `${controlsRef.current.offsetHeight}px`);
    const ro = new ResizeObserver(setVar);
    ro.observe(controlsRef.current);
    setVar();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ok = CSS.supports('backdrop-filter: blur(1px)') || CSS.supports('-webkit-backdrop-filter: blur(1px)');
    document.documentElement.classList.toggle('no-backdrop', !ok);
  }, []);

  useEffect(() => {
    console.log('Loaded postcode areas:', Object.keys(postcodeAreas).length);
    console.log('Sample path:', postcodeAreas['AB']?.path?.slice(0, 100));
  }, []);



  // ---------- Pan/zoom ----------
  const [scaleForLabels, setScaleForLabels] = useState(1);



  useEffect(() => {
    if (!svgRef.current || !contentRef.current || didAutoFitRef.current) return;
    const id = requestAnimationFrame(() => {
      try {
        const bbox = contentRef.current.getBBox();
        if (!bbox || bbox.width === 0 || bbox.height === 0) return;
        const PAD = 0.05;
        const availW = WORLD.width * (1 - PAD * 2);
        const availH = WORLD.height * (1 - PAD * 2);
        const s = Math.min(availW / bbox.width, availH / bbox.height);
        const tx0 = (WORLD.width  - s * bbox.width)  / 2 - s * bbox.x;
        const ty0 = (WORLD.height - s * bbox.height) / 2 - s * bbox.y;
        reset({ scale: s, x: tx0, y: ty0 });
        didAutoFitRef.current = true;
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [reset]);

  // ---------- Game logic ----------

const boundsByDifficulty = {
  easy:   { min: 3, max: 10 },
  normal: { min: 4, max: 12 },
  hard:   { min: 5, max: null },  // no max
  master: { min: 8, max: null },  // no max
};
  
function generatePuzzleWithBounds(minSteps, maxSteps = null, maxRetries = 800) {
  const areas = Object.keys(postcodeAreas);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const start = areas[Math.floor(Math.random() * areas.length)];
    const dist = bfsAllDistances(start);

    // Candidates with distance in [minSteps, maxSteps] (or no max)
    const candidates = areas.filter(a => {
      if (a === start) return false;
      const d = dist.get(a);
      return Number.isFinite(d) && d >= minSteps && (maxSteps == null || d <= maxSteps);
    });

    if (candidates.length) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];

      // double-check using your pathfinder
      const path = findShortestPath(start, target); // array of nodes
      const steps = path.length ? path.length - 1 : Infinity;
      if (Number.isFinite(steps) && steps >= minSteps && (maxSteps == null || steps <= maxSteps)) {
        return { start, target, path }; // path handy for optimalPath
      }
    }
  }

  // Fallback: keep the minimum strict, drop the max (so we always meet the min)
  console.warn('No pair within bounds after retries; relaxing max only.');
  return generatePuzzleWithBounds(minSteps, null, 200);
}

  const findShortestPath = (start, end) => {
    if (start === end) return [start];
    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      for (const neighbor of getNeighbors(current)) {
        if (neighbor === end) return [...path, neighbor];
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return [];
  };

const prevStateRef = useRef(gameState);


useEffect(() => {
  const prev = prevStateRef.current;
  if (prev !== 'playing' && gameState === 'playing') {
    roundIdRef.current = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    window.gtag?.('event', 'game_started', {
      difficulty,
      start_postcode: startArea,
      target_postcode: targetArea,
      round_id: roundIdRef.current,
    });
  }
  prevStateRef.current = gameState;
}, [gameState, difficulty, startArea, targetArea]);


const abandonIfActive = useCallback((reason = 'navigation') => {
  if (gameState === 'playing' && !gameWon && window.gtag) {
    const ms = gameStartRef.current ? Math.max(0, performance.now() - gameStartRef.current) : undefined;
    window.gtag('event', 'game_abandoned', {
      difficulty,
      start_postcode: startArea,
      target_postcode: targetArea,
      guesses: Math.max(0, currentPath.length - 1),
      time_ms: ms,
      reason,
      round_id: roundIdRef.current || undefined,
    });
    roundIdRef.current = null; // prevent duplicates
  }
}, [gameState, gameWon, difficulty, startArea, targetArea, currentPath.length]);

useEffect(() => {
  const onUnload = () => abandonIfActive('beforeunload');
  window.addEventListener('beforeunload', onUnload);
  return () => window.removeEventListener('beforeunload', onUnload);
}, [abandonIfActive]);




const backToMenu = React.useCallback(() => {
  // Daily autosaves — safe to leave immediately
  if (dailyMode) {
    abandonIfActive('menu');
    setGameState('menu');
    setBurgerOpen(false);
    return;
  }

  // Free Play: warn if an active, unfinished round
  if (gameState === 'playing' && !gameWon) {
    setLeaveConfirmOpen(true);
  } else {
    abandonIfActive('menu');
    setGameState('menu');
    setBurgerOpen(false);
  }
}, [dailyMode, gameState, gameWon, abandonIfActive]);

useEffect(() => {
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();

    // Close any open overlays first (topmost-first order)
    if (leaveConfirmOpen) { setLeaveConfirmOpen(false); return; }
    if (giveUpOpen)       { setGiveUpOpen(false);       return; }
    if (victoryOpen)      { setVictoryOpen(false);      return; }
    if (showDailyChooser) { setShowDailyChooser(false); return; }
    if (showFreePlayChooser) { setShowFreePlayChooser(false); return; }
    if (showAbout)        { setShowAbout(false);        return; }
    if (showTutorial)     { setShowTutorial(false);     return; }
    if (burgerOpen)       { setBurgerOpen(false);       return; }

    // No overlays open -> behave like Back button
    backToMenu();
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [
  backToMenu,
  leaveConfirmOpen, giveUpOpen, victoryOpen,
  showDailyChooser, showFreePlayChooser,
  showAbout, showTutorial, burgerOpen
]);


const startNewGame = () => {
  nudgeDismissedRef.current = false;
  setShowHints(false);
  abandonIfActive('reroll');

  const { min, max } = boundsByDifficulty[difficulty] ?? { min: 4, max: null };
  const { start, target, path } = generatePuzzleWithBounds(min, max);

  setStartArea(start);
  setTargetArea(target);
  setCurrentPath([start]);
  setGuesses([]);
  setGameWon(false);
  addVisited([start]);

  setOptimalPath(path);              // we already have it
  setGameState('playing');
  gameStartRef.current = performance.now();
  setElapsedMs(0);
  setVictoryOpen(false);
  setShowOptimal(false);
  // Focus the camera on the start/target pair
  requestAnimationFrame(() => focusStartAndTarget(start, target));
};

// const minStepsByMode = { easy: 3, normal: 4, hard: 5, master: 6 };
const makeGuess = useCallback((area) => {
  if (gameWon) return;
  


  setErrorToast(prev => (prev ? '' : prev));
  setShowHints(false);

  const currentLocation = currentPath[currentPath.length - 1];
  const isValidMove = getNeighbors(currentLocation).includes(area);
  const alreadyVisited = currentPath.includes(area);
  const revisitAllowed = (difficulty === 'easy' || difficulty === 'normal');

  const viaFerry  = ferryAdj.get(currentLocation)?.has(area) || false;
  const viaBridge = !!bridgeAdj.get(currentLocation)?.has(area);

  setGuesses((prev) => [
  ...prev,
  { area, valid: isValidMove, alreadyVisited, viaFerry, viaBridge }
  ]);
  

if (!isValidMove || (alreadyVisited && !revisitAllowed)) {
  setFlashAreas((prev) => [...prev, area]);
  setTimeout(() => {
    setFlashAreas((prev) => prev.filter((a) => a !== area));
  }, 400);

  // NEW: reasoned feedback
  if (!isValidMove) {
    showError(`${area} isn’t adjacent to ${currentLocation}`);
  } else if (alreadyVisited && !revisitAllowed) {
    showError(`You've already visited ${area} in this game. Revisiting is not allowed in ${difficulty} difficulty`);
  }



  return;
}
  if (viaFerry) {
    if (addUsedFerryEdge(currentLocation, area)) {
      const newly = checkAndUnlockMetaAchievements(difficulty, postcodeAreas, ferryLinks, bridgeLinks);
      if (newly.length) setAchievementToasts(q => [...q, ...newly]);
    }
  }
  if (viaBridge) {
    if (addUsedBridgeEdge(currentLocation, area)) {
      const newly = checkAndUnlockMetaAchievements(difficulty, postcodeAreas, ferryLinks, bridgeLinks);
      if (newly.length) setAchievementToasts(q => [...q, ...newly]);
    }
  }

  // mark newly visited
  if (addVisited([area])) {
    const newly = checkAndUnlockMetaAchievements(difficulty, postcodeAreas, ferryLinks, bridgeLinks);
    if (newly.length) setAchievementToasts(q => [...q, ...newly]);
  }

const newPath = [...currentPath, area];
setCurrentPath(newPath);

if (area === targetArea) {
  finishGame(newPath);  // <-- pass final path so last edge is counted
}
}, [getNeighbors, gameWon, currentPath, targetArea, finishGame, ferryAdj, bridgeAdj, difficulty, showError]);

// const isFerryEdge  = (a,b) => ferryAdj.get(a)?.has(b)  || false;
// const isBridgeEdge = (a,b) => bridgeAdj.get(a)?.has(b) || false;



const handleClick = useCallback((code) => {
  if (!canClickAreas) return;
  if (gameState !== 'playing' || victoryOpen || showTutorial || showAbout) return;
  if (!isRevealed(code)) return;
  if (Date.now() < suppressClickUntilRef.current) return;
  makeGuess(code);
}, [gameState, isRevealed, makeGuess, canClickAreas, victoryOpen, showTutorial, showAbout]);


  // ---------- Label sizing helpers ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const labelPxForScale = (s) => clamp(30 + 200 * s, 30, 300); // readable range
  const svgFontSizeForScale = (s) => labelPxForScale(s) / s;

const resetView = useCallback(() => {
  hasFitRef.current = false;
  didAutoFitRef.current = false;

  requestAnimationFrame(() => {
    if (startArea && targetArea) {
      // pad controls how tight the frame is around the pair (0.2 ≈ your default)
      focusStartAndTarget(startArea, targetArea, 0.2);
    } else {
      // fallback if there’s no puzzle yet
      fitToContent();
    }
  });
}, [startArea, targetArea, focusStartAndTarget, fitToContent]);




  // ---------- Optimal path overlay ----------
  const renderOptimalOverlay = () => {
    const pts = optimalPath
      .map(code => postcodeAreas[code]?.center)
      .filter(Boolean);

    if (pts.length < 2) return null;

    const pointsAttr = pts.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <g pointerEvents="none">
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="#000"
          strokeOpacity="0.1"
          strokeWidth={15}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="#8b5cf6"
		  strokeOpacity="0.5"
          strokeWidth={8}
          vectorEffect="non-scaling-stroke"
        />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={120} fill="#8b5cf6" fillOpacity="0.9" />
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="160"
              fontWeight="700"
              fill="white"
            >
              {i}
            </text>
          </g>
        ))}
      </g>
    );
  };

// ------------------- RENDER HELPERS (map, controls, menus) -----------------

  // ---------- Map ----------
const renderMap = () => (
  <div 
    className="glass mx-auto relative" 
    style={{ 
      width: '100%', 
      maxWidth: '600px', 
      height: '600px', 
      overflow: 'hidden', 
      borderRadius: 16 
    }}
  >
    {/* Zoom overlay, top-left */}
    <div className="absolute top-2 left-2 z-10 flex gap-2">
      <button onClick={() => zoomOut(ZOOM_STEP)} className="smlbtn" title="Zoom out"><ZoomOut className="w-2 h-2" /></button>
      <button onClick={() => zoomIn(ZOOM_STEP)}  className="smlbtn" title="Zoom in"><ZoomIn className="w-2 h-2" /></button>
      <button onClick={resetView} className="smlbtn" title="Reset view to Start & Target"><Scan className="w-2 h-2" /></button>
    </div>

    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      className="block"
      viewBox={`${WORLD.x} ${WORLD.y} ${WORLD.width} ${WORLD.height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ touchAction: 'none', display: 'block' }}
    >
      <rect
        x={WORLD.x} y={WORLD.y}
        width={WORLD.width} height={WORLD.height}
        fill="transparent" pointerEvents="all"
      />
		
      <defs>		  
        {masterMode && (
          <clipPath id={landClipId} clipPathUnits="userSpaceOnUse">
            {Object.entries(postcodeAreas).map(([code, area]) => (
              <path key={`clip-${code}`} d={area.path} />
            ))}
          </clipPath>
        )}

        <pattern id="pp-invalid-stripes" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
  <rect width="10" height="10" fill="#ffffffff" />
  <path d="M0 0 L0 10" stroke="#111" strokeWidth="4" opacity="0.01" />
</pattern>
      </defs>
		
      {/* Outer g transforms (pan/zoom). Inner g is content for getBBox */}
      <g ref={gRef}>
        <g
          ref={contentRef}
          /* clip only in Master so coastline strokes are hidden */
          clipPath={masterMode ? `url(#${landClipId})` : undefined}
          /* keep crisp edges when outlines are off */
          shapeRendering={showOutlines ? undefined : "crispEdges"}
        >
          {/* BRIDGES & TUNNELS (hidden in Master) */}
          {!masterMode && Array.isArray(bridgeLinks) && bridgeLinks.length > 0 && (
            <g pointerEvents="none" aria-label="Bridges and tunnels">
              {bridgeLinks.map(({ a, b, type }, i) => {
                if (!postcodeAreas[a] || !postcodeAreas[b]) return null;
                const d = (type === "bridge" ? arcPathBridge : arcPathFerry)(a, b);
                if (!d) return null;

                const { stroke, width, dash } = linkPaint(type);
                const A = getCenter(a), B = getCenter(b);

                return (
                  <g key={`bridge-${a}-${b}-${i}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={width}
                      strokeDasharray={dash || undefined}
                      strokeLinecap="round"
                      opacity="0.95"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* subtle end caps so the line visually reaches each area */}
                    <circle cx={A.x} cy={A.y} r={Math.max(6, width * 0.6)} fill={stroke} vectorEffect="non-scaling-stroke" />
                    <circle cx={B.x} cy={B.y} r={Math.max(6, width * 0.6)} fill={stroke} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
            </g>
          )}

          {Object.entries(postcodeAreas).map(([code, area]) => {
            const isCurrent = !gameWon && currentArea && code === currentArea && code !== targetArea;
            const extra  = [
              flashAreas.includes(code) ? "animate-shake [animation-duration:.25s]" : "",
              isCurrent ? "area-pulse" : "",
            ].join(" ").trim();

            const hidden = !isRevealed(code) ? "opacity-0 pointer-events-none" : "";
            return (
              <path
                key={code}
                ref={attachPathRef(code)}
                d={area.path}
                style={getAreaStyle(code)}
                className={`hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white ${extra} ${hidden}`}
                // only attach handlers if Easy
                onClick={canClickAreas ? () => handleClick(code) : undefined}
                onKeyDown={
                  canClickAreas
                    ? (e) => (e.key === 'Enter' || e.key === ' ') && handleClick(code)
                    : undefined
                }
                tabIndex={canClickAreas ? 0 : -1}
                aria-label={code}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        {/* Ferry routes (hidden in Master) */}
        {!masterMode && Array.isArray(ferryLinks) && ferryLinks.length > 0 && (
          <g pointerEvents="none" aria-label="Ferry routes">
            {ferryLinks.map(({ a, b }, i) => {
              // skip if either endpoint isn't in your dataset
              if (!postcodeAreas[a] || !postcodeAreas[b]) return null;

              const d = arcPath(a, b);
              if (!d) return null;

              return (
                <g key={`ferry-${a}-${b}-${i}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#ffffffff"
                    strokeWidth={3}
                    strokeDasharray="4 10"
                    strokeLinecap="round"
                    opacity="0.7"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>
        )}
        
{/* Labels */}
{Object.entries(postcodeAreas).map(([code, area]) => {
  if (!isRevealed(code)) return null;

  const isStart = code === startArea;
  const isVisited = currentPath.includes(code);
  const shouldShow =
    showLabels ||                               // Easy (and any mode where labels are on)
    (difficulty === 'normal' && (isStart || isVisited)); // Normal: only Start + Visited

  if (!shouldShow) return null;
  const c = area.center || centroidsRef.current[code];
  if (!c) return null;

  return (
    <text
      key={`label-${code}`}
      x={c.x}
      y={c.y}
      textAnchor="middle"
      className="pointer-events-none select-none fill-slate-800/80"
      style={{ fontSize: svgFontSizeForScale(scaleForLabels) }}
      stroke="white"
      strokeWidth={4}
      paintOrder="stroke"
      vectorEffect="non-scaling-stroke"
    >
      {code}
    </text>
  );
})}
        
        {/* overlays (render after paths so they sit on top) */}
        {targetArea && <TargetMarker id={targetArea} />}
        {startArea && <StartMarker id={startArea} />}
        {currentArea && <CurrentMarker id={currentArea} />}
        {currentPath.map((id, i) => <StepBadge key={`b-${id}`} id={id} index={i} />)}

        {/* Optional optimal path overlay */}
        {gameWon && showOptimal && renderOptimalOverlay()}
      </g>
    </svg>
  </div>
);


  
  // ---------- Controls / UI ----------

const renderControls = () => (
  <div ref={controlsRef} className="sticky top-0 z-20 w-full pt-3 px-4">
    <div
      className="glass mx-auto relative"   // <- ensure positioned ancestor
      style={{ width: '100%', maxWidth: '600px', overflow: 'hidden', borderRadius: 10 }}
    >


<div className="absolute right-2 top-2 flex items-center gap-2 z-30">
<button
type="button"
className="btn btn-primary px-3 py-1 text-sm"
onClick={backToMenu}
aria-label="Back to menu"
title="Back to menu (Esc)"
>
←
</button>
</div>
      {/* Burger pinned over the card, top-right */}
      <div className="pin-top-right">
        <button
          ref={burgerButtonRef}
          type="button"
          className="btn btn-primary inline-flex w-auto items-center gap-2"
          aria-haspopup="menu"
          aria-expanded={burgerOpen ? 'true' : 'false'}
          aria-label="Open menu"
          onClick={() => setBurgerOpen(o => !o)}
        >
          <Menu className="w-4 h-4" />
          
        </button>
      </div>

      {/* Title row */}
      <div className="px-3 py-2" style={{ textAlign: 'center' }}>
        <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-tight">
          Travel from <span className="text-indigo-200">{startArea || '—'}</span> to{' '} 
          <span className="text-indigo-200">{targetArea || '—'}           {dailyMode && Number.isFinite(dailyPar) && (

      <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-emerald-300 bg-emerald-100 text-emerald-900 text-xs">
        - par {dailyPar}
      </span>

  )}</span>
        </h2>

      </div>

      {/* Burger menu portal (slide-in, overlays everything) */}
{burgerOpen && createPortal(
  <div
    id="pp-burger-menu"
    role="menu"
    aria-orientation="vertical"
        className={[
          "glass rounded-xl shadow-lg p-2",
          "transition duration-150 ease-out",
          "transform will-change-transform will-change-opacity",
          menuAnimClass
          ].join(" ")}
    style={{
      position: 'fixed',
      top: burgerPos.top ,
      left: burgerPos.left + 60,
      width: Math.min(burgerPos.width * 0.8, 180), // Smaller width
      zIndex: 2147483000,
      willChange: 'transform, opacity'
    }}
  >
    <ul
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10, // Reduced gap
        margin: 8,
        padding: 0,
        listStyle: 'none'
      }}
    >
      <li>
        <button
          role="menuitem"
          onClick={dailyMode ? undefined : () => { fireReroll?.('new_game_button'); startNewGame(); setBurgerOpen(false); }}
          disabled={dailyMode}
          aria-disabled={dailyMode}
          className={`btn btn-primary`}
          style={{ 
            display: 'block', 
            width: '90%', 
            padding: '0.3rem 1rem', // Smaller padding
            fontSize: '0.8rem', // Smaller text
          }}
          title={dailyMode ? 'Unavailable during Daily Challenge' : 'Start a new random game'}
        >
          New Game
        </button>
      </li>

      <li>
        <button
          role="menuitem"
          onClick={dailyMode ? undefined : () => {
            abandonIfActive('restart');
            setCurrentPath([startArea]);
            setGuesses([]);
            setGameWon(false);
            setOptimalPath(findShortestPath(startArea, targetArea));
            setBurgerOpen(false);
          }}
          disabled={dailyMode}
          aria-disabled={dailyMode}
          className="btn btn-warn"
          style={{ 
            display: 'block', 
            width: '90%', 
            padding: '0.3rem 0.1rem', 
            fontSize: '0.8rem',
          }}
          title={dailyMode ? 'Unavailable during Daily Challenge' : 'Restart this round'}
        >
          Restart
        </button>
      </li>

      <li>
        <button
          role="menuitem"
          onClick={() => { localStorage.removeItem(ONBOARDING_KEY); setShowTutorial(true); setBurgerOpen(false); }}
          className="btn btn-neutral"
          style={{ 
            display: 'block', 
            width: '90%', 
            padding: '0.3rem 0.1rem', 
            fontSize: '0.8rem',
          }}
          title="Replay the tutorial"
        >
          How to Play
        </button>
      </li>
    </ul>
  </div>,
  document.body
)}

{/* Middle: BIG centered selection box with inline submit arrow */}
{!gameWon && (
  <div className="px-3 pb-3">
    <div className="w-full">
      {/* inline-block wrapper so the absolute button can anchor correctly */}
  <div
    style={{ 
      display: 'block', 
      position: 'relative', 
      textAlign: 'center',
      width: 'fit-content',
      margin: '0 auto'
    }}
    className={shouldPulse ? 'pp-pulse-wrap' : undefined}
  >
        <input
          ref={inputRef}
          list="pp-codelist"
          type="text"
          className="rounded-2xl border border-slate-300 text-center shadow-md focus:ring-4 focus:ring-indigo-400 focus:outline-none"
          onInput={handleSelectorInput}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInputSubmit(e.currentTarget); }}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          aria-label="Select or enter a postcode"
          style={{
            // BIG + centered
            width: 200,
            height: 30,
            fontSize: 28,
            padding: '16px 64px 16px 20px', // room for the arrow button inside
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'inline-block', // Explicitly set to inline-block
            margin: '0 auto', // Belt and suspenders centering
            borderRadius: 45
          }}
        />

        <datalist id="pp-codelist">
          {allPostcodeOptions.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>

        {/* Inline submit arrow, absolutely positioned inside the input */}
        <button
          type="button"
          onClick={() => inputRef.current && handleInputSubmit(inputRef.current)}
          className="btn btn-hollowgreen rounded-xl shadow"
          aria-label="Submit postcode"
          style={{
            position: 'absolute',
            top: '45%',
            right: 8,
            transform: 'translateY(-50%)',
            width: 48,
            height: 48,
            padding: 0,
            lineHeight: 1,
            display: 'grid',
            placeItems: 'center',
            zIndex: 1,
            borderRadius: 45
          }}
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>

    {/* Last entry chips (centered) */}
    {guesses.length > 0 && (
      <div className="flex flex-wrap gap-1 text-xs mt-3 justify-center">
        Last entry:&nbsp;
        {guesses.slice(-1).map((g, i) => (
          <span
            key={i}
            className={`px-2 py-1 rounded ${
              g.valid && !g.alreadyVisited
                ? 'bg-emerald-100 text-emerald-800'
                : g.alreadyVisited
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
            }`}
          >
            {g.area}
            {g.valid && !g.alreadyVisited && g.viaFerry  ? ' (ferry)'  : ''}
            {g.valid && !g.alreadyVisited && g.viaBridge ? ' (bridge)' : ''}
          </span>
        ))}
      </div>
    )}
  </div>
)}



{/* Journey + inline actions */}
<div className="px-3 pb-2">
  {/* Row: badges + (Undo, Hint) OR trophy + optimal toggle */}
  <div className="flex flex-wrap items-center gap-2">
    <div className="badges flex flex-wrap items-center gap-2">
      <span className="text-slate-200/90">Journey:</span>
{currentPath.map((code, i) => {
  const type = i > 0 ? edgeType(currentPath[i-1], code) : null;
  return (
    <span
      key={i}
      className={`badge ${
        code === targetArea ? 'badge-green'
        : i === currentPath.length - 1 ? 'badge-blue'
        : 'badge-gray'
      }`}
      title={i === 0 ? 'Start' : type === 'ferry' ? 'Ferry crossing' : type === 'bridge' ? 'Bridge/tunnel' : 'Land border'}
    >
      <span style={{ marginRight: 6 }}>{i === 0 ? 'Start' : i}:</span>
      {code}
      {type === 'ferry' && <Ship className="w-3 h-3 ml-1" aria-label="Ferry" />}
      {type === 'bridge' && <Route className="w-3 h-3 ml-1" aria-label="Bridge/tunnel" />}
    </span>
  );
})}
    </div>

    

    {/* Actions on the right */}
    <div className="ml-auto flex items-center gap-2">
      {!gameWon && !masterMode && (
        <button
          onClick={undoLastMove}
          disabled={currentPath.length <= 1}
          aria-disabled={currentPath.length <= 1}
          title="Undo last move (Ctrl/Cmd+Z)"
          className={`btn btn-neutral ${currentPath.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Undo
        </button>
      )}


{!gameWon && (
  <button
    className="btn btn-warn"
    onClick={() => setGiveUpOpen(true)}
    title="End this game as a loss"
  >
    Give up
  </button>
)}

{giveUpOpen && createPortal(
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 2147483647,              // same as victory modal
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '10vh',
      padding: '10vh 16px 16px'
    }}
    onClick={() => setGiveUpOpen(false)} // click backdrop to close
  >
    <div
      className="glass p-5 rounded-2xl shadow-xl text-center"
      style={{
        maxWidth: 520,
        width: '92vw',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}
      onClick={(e) => e.stopPropagation()} // keep clicks inside
      role="dialog"
      aria-modal="true"
      aria-labelledby="giveup-title"
    >
      <h2 id="giveup-title" className="text-xl font-semibold mb-2">Give up?</h2>
      <p className="mb-4">
        This will record a <b>loss</b> for this {dailyMode ? 'Daily' : 'Free Play'} game.<br/>
        Current route: <b>{Math.max(0, currentPath.length - 1)}</b> moves
        {optimalPath.length > 0 && <> · Optimal: <b>{Math.max(0, optimalPath.length - 1)}</b></>}
      </p>
      <div className="flex gap-2 justify-center">
        <button onClick={giveUpNow} className="btn btn-warn glass">Give up</button>
        <button onClick={() => setGiveUpOpen(false)} className="btn btn-neutral glass">Cancel</button>
      </div>
    </div>
  </div>,
  document.body
)}


      {!gameWon && (
        <button
          className="btn btn-success"
          onClick={toggleHints}
          disabled={dailyMode && hintsUsed >= MAX_DAILY_HINTS && !showHints}
          title={dailyMode ? `Hints left: ${Math.max(0, MAX_DAILY_HINTS - hintsUsed)}` : 'Show possible neighbours'}
        >
          {dailyMode
            ? (showHints ? 'Hide hints' : `Hint (${Math.max(0, MAX_DAILY_HINTS - hintsUsed)} left)`)
            : (showHints ? 'Hide hints' : 'Hint')}
        </button>
      )}

      {gameWon && (
        <>
          {/* Trophy chip */}
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded border border-emerald-300 bg-emerald-100 text-emerald-900">
            <Trophy className="w-4 h-4" />
            <span>
              Completed in <b>{Math.max(0, currentPath.length - 1)}</b>
              {optimalPath.length > 0 && <> · Optimal <b>{Math.max(0, optimalPath.length - 1)}</b></>}
            </span>
          </div>

          {/* Toggle optimal route */}
          <button
            onClick={() => setShowOptimal(v => !v)}
            className="btn btn-purple"
          >
            {showOptimal ? 'Hide optimal route' : 'Show optimal route'}
          </button>
        </>
      )}
    </div>
  </div>

  {/* Hint panel (appears under the row when toggled, only while playing) */}
  {showHints && !gameWon && currentPath.length > 0 && (
    <div className="mt-3">
      <div className="badges flex flex-wrap items-center gap-2">
        <span className="text-slate-600 mr-1">Available connections:</span>

        {(() => {
          const current = currentPath[currentPath.length - 1];
          const options = getNeighbors(current)
            .filter(n => !currentPath.includes(n))
            .map(n => ({ n, d: bfsDistance(n, targetArea) }))
            .sort((a, b) => a.d - b.d);

          if (options.length === 0) {
            return <span className="badge badge-fail">No unvisited neighbours</span>;
          }

          return options.map(({ n, d }, idx) => {
            const best = idx === 0;
            const className = best
              ? "badge badge-blue hover:brightness-95"
              : "badge badge-gray hover:brightness-95";
            return (
              <button
                key={n}
                type="button"
                className={className}
                onClick={() => makeGuess(n)}
                title={Number.isFinite(d) ? `~${d} steps from target` : "No path"}
                aria-label={Number.isFinite(d) ? `${n}, about ${d} steps from target` : `${n}, no path`}
              >
                {n}
              </button>
            );
          });
        })()}

        <button type="button" className="btn btn-success" onClick={() => setShowHints(false)} title="Hide hints">
          Hide
        </button>
      </div>
    </div>
  )}

  {/* Optimal route badges (after completion, only when toggled on) */}
  {gameWon && showOptimal && optimalPath?.length > 0 && (
    <div className="mt-3">
      <div className="text-sm font-semibold mb-1">Optimal route:</div>
      <div className="badges flex flex-wrap items-center gap-2">
        {optimalPath.map((code, i) => (
          <span key={i} className="badge badge-green">
            <span style={{ marginRight: 6 }}>{i}:</span>{code}
          </span>
        ))}
      </div>
    </div>
  )}
</div>



      {/* Toast */}
      <Toast
        open={showNudge && !masterMode && !gameWon}
        onClose={dismissNudge}
        action={{ label: 'Open tutorial', onClick: () => { setShowTutorial(true); dismissNudge(); } }}
      >
        You are in the <b>glowing Postcode area</b>. Enter a neighbouring postcode like <b>{exampleNeighbor}</b> and press <b>Enter</b>. If you're still unsure, try the tutorial.
      </Toast>

<Toast open={!!errorToast} onClose={() => setErrorToast('')}>
  {errorToast}
</Toast>

{achievementToasts[0] && (
  <Toast
    open
    onClose={() => setAchievementToasts(q => q.slice(1))} // pop the head -> next shows
  >
    <div className="flex items-center gap-2">
      <div><Trophy className="w-6 h-6 shrink-0" aria-hidden="true" /><b>Achievement unlocked</b> </div>
      <span className="text-xl" aria-hidden>{achievementToasts[0].icon}</span>
      <div>
        <div className="font-semibold">{achievementToasts[0].name}</div>
        <div className="text-xs opacity-80">{achievementToasts[0].description}</div>
      </div>
    </div>
  </Toast>
)}


    </div>
  </div>
);






// ---------- GameBoard ----------

const renderGameBoard = () => (
  <div className="mx-auto w-full max-w-[600px] px-4">
    {renderControls()}
    <div className="grid place-items-center min-h-[calc(100dvh-var(--controls-h,0px))]"><br />
      <div className="absolute inset-0 grid place-items-center">
        {renderMap()}
      </div>
    </div>
  </div>
);
// ---------- Menu page ----------

function handleDailyChoice(diff) {
  const status = normalizeStatus(Daily.dailyStatus?.(diff)); // 'idle' | 'continue' | 'finished'
  if (status === 'finished' || status === 'continue') {
    // jump straight in: resume or show the result
    startOrResumeDaily(diff);
    setShowDailyChooser(false);
    setDailyChoice(null);
    return;
  }
  // otherwise, show the info panel with Play button
  setDailyChoice(diff);
}

const renderMenu = () => (
  <div className="max-w-2xl mx-auto p-8 glass text-center mt-8 relative">
    <MapPin className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
    <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Postcode Pursuit</h1>
    <p className="text-slate-600 mb-6">
      Navigate between UK postcode areas by following their geographical connections!
    </p>

    {/* Three big CTAs */}
    <div className="mx-autoflex flex-col sm:flex-row items-stretch justify-center gap-3 mb-6 mx-auto w-full sm:w-auto ">
<button
      type="button"
      className="btn btn-glass tint-green btn-cta"
      onClick={() => setShowDailyChooser(true)}
    >
      <Trophy className="w-6 h-6 shrink-0" aria-hidden="true" />
      <span>Daily Challenge</span>
    </button>

    <button
      type="button"
      className="btn btn-glass tint-purple btn-cta"
      onClick={() => setShowFreePlayChooser(true)}
    >
      <Flag className="w-6 h-6 shrink-0" aria-hidden="true" />
      <span>Free Play</span>
    </button>

    <button
      type="button"
      className="btn btn-glass glass--white btn-cta"
      onClick={() => setShowTutorial(true)}
    >
      <BookOpen className="w-6 h-6 shrink-0" aria-hidden="true" />
      <span>How to Play</span>
    </button>

    </div>

{/* Daily streaks summary */}
{Object.values(streaks).some(n => (Number(n) || 0) > 0) && (
<div className="mt-6 mx-auto w-full max-w-xl">
  <div className="glass glass--white rounded-xl p-4">
    <h3 className="text-base font-semibold text-slate-900 mb-3 text-center">
      Your Daily Streaks
    </h3>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-slate-600">
          <th className="text-left py-2">Difficulty</th>
          <th className="text-right py-2">Streak</th>
        </tr>
      </thead>
      <tbody>
        {DIFF_ORDER.map((d) => (
          <tr key={d} className="border-t border-slate-200/40">
            <td className="py-2 font-medium">
              {DIFF_LABELS[d] ?? d}
            </td>
            <td className="py-2 text-right">
              {streaks?.[d] > 0 ? (
                <span className="inline-flex items-center gap-2">
                  
                  <span aria-hidden="true">{renderStreak(streaks[d])}</span>
                  <span className="sr-only">{streaks[d]}-day streak</span>
                </span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
)}

    <button className="btn btn-neutral" onClick={() => setShowAbout(true)}><InfoIcon className="w-4 h-4" />About</button>

<button className="btn btn-neutral ml-2" onClick={() => navigate('stats')}>
  <ChartColumnBig className="w-4 h-4" /> Stats
</button>

<button className="btn btn-neutral ml-2" onClick={() => navigate('achievements')}>
  <Medal className="w-4 h-4" /> Achievements
</button>

    {/* --- Daily chooser modal --- */}
{showDailyChooser && createPortal(
  <div
    role="menu"
    onClick={() => setShowDailyChooser(false)}
    className={[
      "glass glass--slate rounded-xl shadow-lg p-2",
      "transition duration-150 ease-out",
      "transform will-change-transform will-change-opacity",
      menuAnimClass
    ].join(" ")}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 2147483647,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '10vh',
      padding: '10vh 16px 16px'
    }}
  >

    <div
      className={[
        "glass p-5 rounded-2xl shadow-lg",
        "transition duration-200 ease-out transform-gpu",
        freeAnim
      ].join(" ")}
      onClick={(e) => e.stopPropagation()}
      tabIndex={-1}
      style={{
        width: '400px', // Fixed width
        maxHeight: '80vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y'
      }}
    >
      <h2 className="text-2xl font-bold mb-4 text-center">Choose Daily Challenge Difficulty</h2>

      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10, // Reduced gap
          margin: 8,
          padding: 0,
          listStyle: 'none'
        }}
      >
        <li className="choice-item">
          <button
            type="button"
            className="btn btn-green btn-choice"
            onClick={() => handleDailyChoice('easy')}
            role="menuitem"
            style={{ 
              display: 'block', 
              width: '95%', 
              padding: '0.3rem 1rem', // Smaller padding
              fontSize: '2rem', // Smaller text
            }}
          >
            <span>{typeof makeDailyLabel === 'function' ? makeDailyLabel('easy') : <>Easy — {Daily.dailyStatus('easy')}</>}</span>
            {renderSingleFireForChooser(streaks?.easy)}
          </button>
        </li>

        <li className="choice-item">
          <button
            type="button"
            className="btn btn-yellow btn-choice"
            onClick={() => handleDailyChoice('normal')}
            role="menuitem"
            style={{ 
              display: 'block', 
              width: '95%', 
              padding: '0.3rem 1rem', // Smaller padding
              fontSize: '2rem', // Smaller text
            }}
          >
            <span>{typeof makeDailyLabel === 'function' ? makeDailyLabel('normal') : <>Normal — {Daily.dailyStatus('normal')}</>}</span>
            {renderSingleFireForChooser(streaks?.normal)}
          </button>
        </li>

        <li className="choice-item">
          <button
            type="button"
            className="btn btn-orange btn-choice"
            onClick={() => handleDailyChoice('hard')}
            role="menuitem"
            style={{ 
              display: 'block', 
              width: '95%', 
              padding: '0.3rem 1rem', // Smaller padding
              fontSize: '2rem', // Smaller text
            }}
          >
            <span>{typeof makeDailyLabel === 'function' ? makeDailyLabel('hard') : <>Hard — {Daily.dailyStatus('hard')}</>}</span>
            {renderSingleFireForChooser(streaks?.hard)}
          </button>
        </li>

        <li className="choice-item">
          <button
            type="button"
            className="btn btn-purple btn-choice"
            onClick={() => handleDailyChoice('master')}
            role="menuitem"
            style={{ 
              display: 'block', 
              width: '95%', 
              padding: '0.3rem 1rem', // Smaller padding
              fontSize: '2rem', // Smaller text
            }}
          >
            <span>{typeof makeDailyLabel === 'function' ? makeDailyLabel('master') : <>Master — {Daily.dailyStatus('master')}</>}</span>
            {renderSingleFireForChooser(streaks?.master)}
          </button>
        </li>
      </ul>

      <div className={`collapsible ${dailyChoice ? 'open' : ''}`}>
        <div className="inner">
          <div className="mt-4 p-4 rounded-xl bg-white/75 text-slate-900 text-center">
            <div className="font-semibold"><b>{dailyChoice && DIFF_LABELS[dailyChoice]}</b></div>
            <p className="text-sm mt-1 font-bold">{dailyChoice && DIFF_DESCRIPTIONS[dailyChoice]}</p>

            <div className="mt-3 flex gap-2 justify-center">
              <button
                className="btn btn-glass tint-green w-full max-w-[20rem]"
                onClick={() => {
                  startOrResumeDaily(dailyChoice);
                  setShowDailyChooser(false);
                  setDailyChoice(null);
                }}
                style={{ 
                  display: 'block', 
                  width: '90%', 
                  padding: '1rem 0.5rem', // Smaller padding
                  fontSize: '2rem', // Smaller text
                }}
              >
                Play game
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          className="btn btn-neutral w-full max-w-[20rem]"
          onClick={() => { setShowDailyChooser(false); setDailyChoice(null); }}
        >
          Close
        </button>
      </div>

    </div>
  </div>,
  document.body
)}


    {/* --- Free Play chooser modal --- */}
{showFreePlayChooser && createPortal(
  <div
    role="menu"
    onClick={() => setShowFreePlayChooser(false)}
        className={[
      "glass glass--slate rounded-xl shadow-lg p-2",
      "transition duration-150 ease-out",
      "transform will-change-transform will-change-opacity",
      menuAnimClass
    ].join(" ")}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 2147483647,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '10vh',
      padding: '10vh 16px 16px'
    }}
  >
   <div
      className={[
        "glass p-5 rounded-2xl shadow-lg",
        "transition duration-200 ease-out transform-gpu",
        freeAnim
      ].join(" ")}
      onClick={(e) => e.stopPropagation()}
      tabIndex={-1}
      style={{
        width: '400px', // Fixed width
        maxHeight: '80vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y'
      }}
    >
<h2 className="text-2xl font-bold mb-4 text-center">Choose Free Play Difficulty</h2>

<ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10, // Reduced gap
          margin: 8,
          padding: 0,
          listStyle: 'none'
        }}
      >
        <li className="choice-item">
          <button
            type="button"
            className="btn btn-green btn-choice"
            onClick={() => setFreeChoice('easy')}
            role="menuitem"
            style={{ 
              display: 'block', 
              width: '95%', 
              padding: '0.3rem 1rem', // Smaller padding
              fontSize: '2rem', // Smaller text
            }}
          >
            <span><>Easy</></span>
          </button>
        </li>

        <li className="choice-item">
          <button
            type="button"
            className="btn btn-yellow btn-choice"
            onClick={() => setFreeChoice('normal')}
            role="menuitem"
            style={{ 
              display: 'block', 
              width: '95%', 
              padding: '0.3rem 1rem', // Smaller padding
              fontSize: '2rem', // Smaller text
            }}
          >
            <span>Normal</span>
          </button>
        </li>

        <li className="choice-item">
          <button
            type="button"
            className="btn btn-orange btn-choice"
            onClick={() => setFreeChoice('hard')}
            role="menuitem"
            style={{ 
              display: 'block', 
              width: '95%', 
              padding: '0.3rem 1rem', // Smaller padding
              fontSize: '2rem', // Smaller text
            }}
          >
            <span>Hard</span>
          </button>
        </li>

        <li className="choice-item">
          <button
            type="button"
            className="btn btn-purple btn-choice"
            onClick={() => setFreeChoice('master')}
            role="menuitem"
            style={{ 
              display: 'block', 
              width: '95%', 
              padding: '0.3rem 1rem', // Smaller padding
              fontSize: '2rem', // Smaller text
            }}
          >
            <span>Master</span>
          </button>
        </li>
      </ul>




 <div className={`collapsible ${freeChoice ? 'open' : ''}`}>
  <div className="inner">
    <div className="mt-4 p-3 rounded-xl bg-white/75 text-slate-900">
      <div className="font-semibold">{freeChoice && DIFF_LABELS[freeChoice]}</div>
      <p className="text-sm mt-1">{freeChoice && DIFF_DESCRIPTIONS[freeChoice]}</p>

      <div className="mt-3 flex gap-2 justify-center">
        <button
          className="btn btn-glass tint-green w-full max-w-[20rem]"
          onClick={() => {
            startWithDifficulty(freeChoice);
            setShowFreePlayChooser(false);
            setFreeChoice(null);
          }}
                          style={{ 
                  display: 'block', 
                  width: '90%', 
                  padding: '1rem 0.5rem', // Smaller padding
                  fontSize: '2rem', // Smaller text
                }}
        >
          Play game
        </button>
      </div>
    </div>
  </div>
</div>

<div className="mt-4">
  <button
    className="btn btn-neutral w-full"
    onClick={() => { setShowFreePlayChooser(false); setFreeChoice(null); }}
  >
    Close
  </button>
</div>

    </div>
  </div>,
  document.body
)}


    {/* Existing About modal remains unchanged below */}
    {showAbout && createPortal(
      <div
        className="fixed inset-0 bg-black/50 z-[2147483646] grid place-items-center p-4 overflow-hidden"
        role="dialog"
        aria-modal="true"
        onClick={() => setShowAbout(false)}
      >
        <div
          className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-lg h-[85dvh] overflow-y-scroll"
          tabIndex={-1}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y'
          }}
          onClick={(e) => e.stopPropagation()}
        >
<h2 className="text-xl font-bold mb-4">About Postcode Pursuit</h2>

<p className="mb-3">
  Postcode Pursuit is a geography puzzle: travel from your <b>start</b> postcode area to the <b>target</b> by
  stepping through connected UK postcode areas. It’s inspired by the brilliant{" "}
  <a href="https://travle.earth" target="_blank" rel="noreferrer" className="text-indigo-600 underline">
    Travle
  </a>.
</p>

<h3 className="font-semibold mb-2">Connections</h3>
<ul className="list-disc list-inside space-y-1 mb-4">
  <li><b>Land borders</b> between postcode areas</li>
  <li><b>Ferries</b> — dashed lines</li>
  <li><b>Major bridges &amp; tunnels</b> — solid lines</li>
</ul>

<h3 className="font-semibold mb-2">Game Modes</h3>
<ul className="list-disc list-inside space-y-1 mb-4">
  <li>
    <b>Easy</b> — outlines and labels are visible. You may <b>revisit</b> previously visited areas.
  </li>
  <li>
    <b>Normal</b> — outlines are shown; labels are shown only on <b>Start</b> and <b>Visited</b> areas. Revisit is <b>allowed</b>.
  </li>
  <li>
    <b>Hard</b> — no outlines, no labels (connections still visible). Revisit is <b>blocked</b>.
  </li>
  <li>
    <b>Master</b> — only start/current/visited/target are visible; connections hidden. Revisit &amp; <b>Undo</b> are disabled.
  </li>
</ul>

<h3 className="font-semibold mb-2">Daily Challenge</h3>
<ul className="list-disc list-inside space-y-1 mb-4">
  <li>Pick a difficulty (Easy/Normal/Hard/Master) once per day.</li>
  <li>Progress auto-saves; you can <b>resume</b> later the same day.</li>
  <li><b>Hints:</b> up to 3 per day. Opening the hint panel consumes one.</li>
  <li><b>Streak:</b> win on consecutive days to build your daily streak.</li>
  <li>Share your result from the victory screen.</li>
</ul>

<h3 className="font-semibold mb-2">How to Play</h3>
<ul className="list-disc list-inside space-y-1 mb-4">
  <li>
    Use the <b>selection box</b> to enter a postcode. Submit with <b>Enter</b>.
  </li>
  <li>
    Pan/zoom the map; quick controls live at the <b>top-left</b> of the map (Zoom In/Out, Reset View).
  </li>
  <li>
    Use the <b>Menu</b> (top-right) for New Game, Restart, return to Menu, or Replay the Tutorial.
  </li>
</ul>

<h3 className="font-semibold mb-2">Tips &amp; Shortcuts</h3>
<ul className="list-disc list-inside space-y-1 mb-6">
  <li>Hints list neighbouring areas; click a suggestion to move there.</li>
  <li>Revisiting (Easy/Normal) helps explore; every move still counts as a guess.</li>
  <li>Keyboard: <b>Enter</b> submits; use <b>Ctrl/Cmd+Z</b> to undo a move.</li>
</ul>

<div className="sticky bottom-0 pt-3 bg-white">
  <button className="btn btn-primary w-full" onClick={() => setShowAbout(false)}>
    Close
  </button>
</div>
        </div>
      </div>,
      document.body
    )}
  </div>
);

// ---- Daily chooser helpers & streak state ----
const DIFF_BASE_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard', master: 'Master' };

// Map whatever Daily.dailyStatus returns into { idle | continue | finished }
function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (/finish|done|complete|result/.test(s)) return 'finished';   // -> "See Result"
  if (/cont|progress|resume|started|ongoing/.test(s)) return 'continue'; // -> "Continue"
  return 'idle';
}

function makeDailyLabel(diff) {
  const base = DIFF_BASE_LABELS[diff] ?? diff;
  const status = normalizeStatus(Daily.dailyStatus?.(diff));
  if (status === 'continue') return `${base} - Continue`;
  if (status === 'finished') return `${base} - Result`;
  return base; // idle
}


function renderStreak(count) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  if (n < 10) {
    return <span aria-label={`${n}-day streak`}>{'🔥'.repeat(n)}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${n}-day streak`}>
      🔥×{n}
    </span>
  );
}

function renderSingleFireForChooser(count) {
  const n = Number(count) || 0;
  return n > 0 ? (
    <span aria-label={`${n}-day streak`} title={`${n}-day streak`}>🔥</span>
  ) : null;
}

const [streaks, setStreaks] = React.useState({
  easy: 0, normal: 0, hard: 0, master: 0
});

/* 
const DIFFICULTY_META = {
easy: { label: 'Easy', hint: 'Outlines + labels', icon: '🔥' },
normal: { label: 'Normal', hint: 'Outlines only', icon: '🔥' },
hard: { label: 'Hard', hint: 'No outlines', icon: '🔥' },
master: { label: 'Master', hint: 'Start & end only', icon: '🔥' },
};
 */

React.useEffect(() => {
  setStreaks({
    easy: readStreak('easy'),
    normal: readStreak('normal'),
    hard: readStreak('hard'),
    master: readStreak('master'),
  });
  // If you emit an event when a daily is completed, add it to the deps.
}, [readStreak]);

// Route pages that replace the app UI
if (route === 'stats') {
  return (
    <StatsPage
      key={statsVersion}
      stats={computeStats()}
      onBack={() => navigate('')}
      onResetAll={resetAllStats}
    />
  );
}
if (route === 'achievements') {
  return (
    
    <AchievementsPage
      onBack={() => navigate('')}
      achievements={ACHIEVEMENTS}
      visitedCount={getVisitedCount()}
      totalAreas={Object.keys(postcodeAreas).length}
    />
  );
}

return (
  <>
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {gameState === 'menu' ? renderMenu() : renderGameBoard()}
    </div>

    <OnboardingTutorial
      isOpen={consentResolved && showTutorial}
      onSkip={() => { localStorage.setItem(ONBOARDING_KEY, 'true'); setShowTutorial(false); }}
      onComplete={() => { localStorage.setItem(ONBOARDING_KEY, 'true'); setShowTutorial(false); }}
      postcodeAreas={postcodeAreas}
    />

    {leaveConfirmOpen && createPortal(
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 2147483647,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '10vh',
      padding: '10vh 16px 16px'
    }}
    onClick={() => setLeaveConfirmOpen(false)}
    role="dialog"
    aria-modal="true"
    aria-labelledby="leave-title"
  >
    <div
      className="glass p-5 rounded-2xl shadow-xl text-center"
      style={{
        maxWidth: 520,
        width: '92vw',
        maxHeight: '80vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 id="leave-title" className="text-xl font-semibold mb-2">Leave this game?</h2>
      <p className="mb-4">
        You’ll <b>lose your current Free Play progress</b> for this round.<br/>
        Current route: <b>{Math.max(0, currentPath.length - 1)}</b> moves
        {optimalPath.length > 0 && <> · Optimal: <b>{Math.max(0, optimalPath.length - 1)}</b></>}
      </p>
      <div className="flex gap-2 justify-center">
        <button
          className="btn btn-warn glass"
          onClick={() => {
            setLeaveConfirmOpen(false);
            abandonIfActive('menu');    // analytics-safe
            setGameState('menu');
            setBurgerOpen(false);
          }}
        >
          Leave
        </button>
        <button className="btn btn-neutral glass" onClick={() => setLeaveConfirmOpen(false)}>
          Stay
        </button>
      </div>
    </div>
  </div>,
  document.body
)}


    {victoryOpen && createPortal(
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 2147483647,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '10vh',
        padding: '10vh 16px 16px'
      }}>
        <div className="glass p-5 rounded-2xl shadow-xl text-center" style={{
          maxWidth: 520,
          width: '92vw',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <h2 className="text-xl font-semibold mb-2">Victory! 🎉</h2>
          <p className="mb-4">
            From <b>{startArea}</b> to <b>{targetArea}</b><br />
            Moves: <b>{Math.max(0, currentPath.length - 1)}</b><br />
            Optimal: <b>{Math.max(0, optimalPath.length - 1)}</b><br />
            {parLine}<br />
            
             {dailyMode && (streaks?.[dailyDifficulty] ?? 0) > 0 && (
   <>Streak: <b>{streaks[dailyDifficulty]}</b> · </>
 )}
            {elapsedMs > 0 && <>Time: <b>{formatTime(elapsedMs)}</b></>}
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={shareResult} className="btn btn-purple glass">Share</button>


            <button
  onClick={() => {
    if (dailyMode) {
      setVictoryOpen(false);
      setGameState('menu'); // or show the completed daily again
    } else {
      startNewGame();
    }
  }}
  className="btn btn-warn glass"
>
  {dailyMode ? 'Back to Menu' : 'Play again'}
</button>


            <button onClick={() => setVictoryOpen(false)} className="btn btn-primary glass">Close</button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
);
}