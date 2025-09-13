export function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Game history is stored here
export const GAME_HISTORY_KEY = 'pp_game_history_v1';
