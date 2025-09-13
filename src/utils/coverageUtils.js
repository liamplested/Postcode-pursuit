// Count how many unique areas visited
export function getVisitedCount(path) {
  return new Set(path).size;
}

// Return coverage percentage and thresholds
export function getCoverageMeta(path, totalAreas) {
  const visited = getVisitedCount(path);
  const percent = (visited / totalAreas) * 100;
  return { visited, percent };
}
