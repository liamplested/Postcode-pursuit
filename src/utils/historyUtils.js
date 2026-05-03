import { GAME_HISTORY_KEY, readJSON, writeJSON } from './storageUtils';

export function addGameToHistory(event, { onPersist } = {}) {
  const db = readJSON(GAME_HISTORY_KEY, { games: [] });
  db.games.push(event);
  writeJSON(GAME_HISTORY_KEY, db);
  onPersist?.();
  return { totalGames: db.games.length, totalWins: db.games.filter(g => g.won).length };
}

export function lastNGamesArePerfect(n) {
  const db = readJSON(GAME_HISTORY_KEY, { games: [] });
  const recent = db.games.slice(-n);
  return recent.length === n && recent.every(g => g.perfect === true && Number(g.hintsUsed || 0) === 0);
}
