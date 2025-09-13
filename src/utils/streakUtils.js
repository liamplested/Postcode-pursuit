// Read streak counts from localStorage
export function readStreakCount(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parsed?.count ?? 0;
  } catch {
    return 0;
  }
}
