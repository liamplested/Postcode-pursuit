import { readJSON, writeJSON, META_KEY } from '../PostcodePursuit';
import { getInstallId } from './installId';

export function recordLifetimeMove({ nextCode, type }, { onPersist } = {}) {
  const meta = readJSON(META_KEY, {}) || {};

  // visited set
  const visited = { ...(meta.visitedAreas || {}) };
  if (nextCode) visited[nextCode] = true;

  // per-device counters
  const id = getInstallId();
  const byDev = { ...(meta.countersByDevice || {}) };
  const mine = { ferries: 0, bridges: 0, land: 0, ...(byDev[id] || {}) };
  if (type === 'ferry')   mine.ferries += 1;
  else if (type === 'bridge') mine.bridges += 1;
  else                      mine.land += 1;
  byDev[id] = mine;

  // recompute totals
  const totals = Object.values(byDev).reduce(
    (acc, c) => ({
      ferries: acc.ferries + (c.ferries || 0),
      bridges: acc.bridges + (c.bridges || 0),
      land:    acc.land    + (c.land    || 0),
    }),
    { ferries: 0, bridges: 0, land: 0 }
  );

  const nextMeta = {
    ...meta,
    visitedAreas: visited,
    visitedCount: Object.keys(visited).length,
    countersByDevice: byDev,
    counters: totals,
  };

  writeJSON(META_KEY, nextMeta);
  onPersist?.();
  return nextMeta;
}