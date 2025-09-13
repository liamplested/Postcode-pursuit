// achievements.js
import { postcodeAreas, ferryLinks, bridgeLinks, } from './postcodeAreas';
import { pathHasSequence } from './utils/pathUtils';
import { lastNGamesArePerfect } from './utils/historyUtils';
import { readStreakCount } from './utils/streakUtils';
import { getCoverageMeta, getVisitedCount } from './utils/coverageUtils';
import { readJSON, GAME_HISTORY_KEY } from './utils/storageUtils';
import { ACHIEVEMENTS_KEY, writeJSON} from './PostcodePursuit';



// ---- Definitions ----
export const achievements = [
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

  { id: 'lejog_plus', name: 'LeJoG+', icon:'🏁', tier:'legendary', hidden:true,
    description: 'TR → KW in 15+ moves',
    check: (e) => e.won && e.startArea==='TR' && e.endArea==='KW' && (e.moves ?? 0) >= 15 },


  {
    id: 'backtrack',
    name: 'Backtrack',
    icon: '↩️',
    tier: 'bronze',
    description: 'Win a game where you enter the same area twice.',
    check: (e) => e.won && Array.isArray(e.pathUsed) && e.pathUsed.length !== new Set(e.pathUsed).size,
  },
  {
    id: 'long_distance',
    name: 'Long-Distance',
    icon: '📏',
    tier: 'bronze',
    description: 'Win a game where the optimal path is 5+ moves.',
    check: (e) => e.won && (e.optimalMoves ?? 0) >= 5,
  },
  
  {
    id: 'scenic_route',
    name: 'The Scenic Route',
    icon: '🌸',
    tier: 'silver',
    description: 'Win with at least 5 more moves than the optimal path.',
    check: (e) => e.won && Number.isFinite(e.optimalMoves) && (e.moves ?? 0) >= e.optimalMoves + 5,
  },
  {
    id: 'first_last',
    name: 'First and Last',
    icon: '📚',
    tier: 'silver',
    description: 'Start and finish with the same initial letter.',
    check: (e) => e.won && e.startArea?.[0] && (e.startArea[0] === e.endArea?.[0]),
  },
  
  {
    id: 'deep_dive',
    name: 'Deep Dive',
    icon: '🤿',
    tier: 'gold',
    description: 'Win a game on Hard difficulty, using 5+ moves.',
    check: (e) => e.won && e.difficulty === 'hard' && (e.moves ?? 0) >= 5,
  },
  {
    id: 'half_century',
    name: 'Half-Century',
    icon: '5️⃣0️⃣',
    tier: 'gold',
    description: 'Play 50 games.',
    check: (_e, h) => (h.totalGames ?? 0) >= 50,
  },

  {
    id: 'explorer_tour',
    name: 'The Explorer',
    icon: '🗺️',
    tier: 'legendary',
    description: 'Visit every postcode area at least once, in a single game.',
    check: (e, _h, meta) => e.won && Array.isArray(e.pathUsed) && (new Set(e.pathUsed).size) >= (meta?.totalAreas ?? 0),
  },


  ];
export const evaluateAndUnlockMetaAchievements = (...args) =>
  evaluateAndUnlockAchievements(...args);

// ---- Evaluators ----
export function evaluateAndUnlockAchievements(
  event,
  history = { totalGames: 0, totalWins: 0 },
  meta = {}
) {
  const have = readJSON(ACHIEVEMENTS_KEY, {}); // { [id]: rec }
  const nowISO = new Date().toISOString();
  const newly = [];
  for (const a of achievements) {
    try {
      if (!have[a.id] && a.check(event, history, meta)) {
        have[a.id] = { ...a, unlockedAt: nowISO };
        newly.push(have[a.id]);
      }
    } catch {
      // swallow any single-achievement error so one bad check
      // doesn’t break the rest
    }
  }
  if (newly.length) writeJSON(ACHIEVEMENTS_KEY, have);
  return newly;
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

// ---- Analytics helper ----
export function logAchievementsToGA(unlocked, context) {
  if (!window.gtag || !unlocked?.length) return;
  unlocked.forEach(a => {
    window.gtag('event', 'unlock_achievement', {
      achievement_id: a.id,
      tier: a.tier,
      category: a.category || 'standard',
      difficulty: context.difficulty,
      daily_mode: context.dailyMode ? 1 : 0,
      ferry_count: context.ferryCount ?? 0,
      bridge_count: context.bridgeCount ?? 0,
    });
  });
}
