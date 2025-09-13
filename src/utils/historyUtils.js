import { readJSON, GAME_HISTORY_KEY } from './storageUtils';

// Check if the last N games were "perfect" (no mistakes, optimal path, etc.)
export function lastNGamesArePerfect(n) {
  const history = readJSON(GAME_HISTORY_KEY, []);
  if (!Array.isArray(history) || history.length < n) return false;

  const recent = history.slice(-n);
  return recent.every(g => g.perfect === true);
}
