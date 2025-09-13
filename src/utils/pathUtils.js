// Check if the current path contains a given subsequence
export function pathHasSequence(path, seq) {
  if (!Array.isArray(path) || !Array.isArray(seq)) return false;
  if (seq.length === 0 || seq.length > path.length) return false;

  for (let i = 0; i <= path.length - seq.length; i++) {
    if (seq.every((s, j) => path[i + j] === s)) return true;
  }
  return false;
}
