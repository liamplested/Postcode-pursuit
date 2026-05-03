const ACTIVE_ATTEMPT_KEY = 'pp_analytics_active_attempt_v1';
const ATTEMPT_SUMMARIES_KEY = 'pp_analytics_attempt_summaries_v1';
const MAX_STORED_ATTEMPTS = 1000;
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const IGNORE_EMPTY_ABANDON_MS = 2000;

function nowISO() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function makeId(prefix = 'attempt') {
  return `${prefix}_${crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function bandIncorrect(count) {
  const n = Number(count) || 0;
  if (n === 0) return '0';
  if (n <= 2) return '1-2';
  if (n <= 5) return '3-5';
  return '6+';
}

function bandHints(count) {
  const n = Number(count) || 0;
  if (n === 0) return '0';
  if (n === 1) return '1';
  return '2+';
}

function bandDuration(seconds) {
  const n = Number(seconds) || 0;
  if (n < 30) return '<30s';
  if (n < 60) return '30-59s';
  if (n < 180) return '1-3m';
  if (n < 300) return '3-5m';
  return '5m+';
}

function parBand(outcome, parDelta) {
  if (outcome !== 'won') return outcome;
  if (!Number.isFinite(parDelta)) return 'unknown';
  if (parDelta < 0) return 'under';
  if (parDelta === 0) return 'on';
  return 'over';
}

function normalizeEvents(events) {
  return Array.isArray(events) ? events.slice(-250) : [];
}

function hasMeaningfulInteraction(attempt) {
  const counts = attempt?.counts || {};
  const moves = Math.max(0, (attempt?.path?.length || 1) - 1);
  return (
    moves > 0 ||
    Number(counts.incorrectGuesses || 0) > 0 ||
    Number(counts.hintsUsed || 0) > 0 ||
    Number(counts.hintsOpened || 0) > 0 ||
    Number(counts.undos || 0) > 0
  );
}

function getActiveAttempt() {
  return readJSON(ACTIVE_ATTEMPT_KEY, null);
}

function saveActiveAttempt(attempt) {
  writeJSON(ACTIVE_ATTEMPT_KEY, attempt);
}

function clearActiveAttempt() {
  try {
    localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
  } catch {}
}

function appendSummary(summary) {
  const existing = readJSON(ATTEMPT_SUMMARIES_KEY, []);
  const summaries = Array.isArray(existing) ? existing.filter((item) => item?.id !== summary.id) : [];
  summaries.push(summary);
  writeJSON(ATTEMPT_SUMMARIES_KEY, summaries.slice(-MAX_STORED_ATTEMPTS));
}

function elapsedMsFor(attempt, fallbackMs) {
  if (Number.isFinite(fallbackMs)) return Math.max(0, Math.round(fallbackMs));
  if (!attempt?.startedAtMs) return 0;
  return Math.max(0, nowMs() - attempt.startedAtMs);
}

function buildSummary(attempt, outcome, details = {}) {
  const durationMs = elapsedMsFor(attempt, details.durationMs);
  const moves = Number.isFinite(details.moves) ? details.moves : Math.max(0, (details.pathUsed?.length || attempt.path?.length || 1) - 1);
  const par = Number.isFinite(details.par) ? details.par : details.optimalMoves;
  const parDelta = outcome === 'won' && Number.isFinite(par) ? moves - par : null;
  const incorrectGuesses = Number(attempt.counts?.incorrectGuesses || 0);
  const hintsUsed = Number.isFinite(details.hintsUsed) ? details.hintsUsed : Number(attempt.counts?.hintsUsed || 0);
  const undos = Number(attempt.counts?.undos || 0);
  const events = normalizeEvents(attempt.events);
  const firstIncorrect = events.find((event) => event?.type === 'guess_incorrect');
  const firstCorrect = events.find((event) => event?.type === 'guess_correct');
  const incorrectBeforeFirstMove = firstCorrect
    ? events.filter((event) => event?.type === 'guess_incorrect' && Number(event.t || 0) < Number(firstCorrect.t || 0)).length
    : incorrectGuesses;

  return {
    id: attempt.id,
    roundId: attempt.roundId || attempt.id,
    mode: attempt.mode,
    difficulty: attempt.difficulty,
    dailyDate: attempt.dailyDate || null,
    startedAt: attempt.startedAt,
    endedAt: details.endedAt || nowISO(),
    outcome,
    startArea: attempt.startArea,
    targetArea: attempt.targetArea,
    moves,
    par: Number.isFinite(par) ? par : null,
    optimalMoves: Number.isFinite(details.optimalMoves) ? details.optimalMoves : null,
    parDelta,
    incorrectGuesses,
    incorrectBeforeOutcome: incorrectGuesses,
    incorrectBeforeFirstMove,
    hintsOpened: Number(attempt.counts?.hintsOpened || 0),
    hintsUsed,
    undos,
    durationMs,
    durationSeconds: Math.round(durationMs / 1000),
    inputStyle: details.inputStyle || attempt.inputStyle || 'unknown',
    mapStyle: details.mapStyle || attempt.mapStyle || 'standard',
    pathUsed: Array.isArray(details.pathUsed) ? details.pathUsed : attempt.path || [],
    incorrectBand: bandIncorrect(incorrectGuesses),
    hintBand: bandHints(hintsUsed),
    durationBand: bandDuration(durationMs / 1000),
    parBand: parBand(outcome, parDelta),
    firstIncorrectAtMs: firstIncorrect ? Number(firstIncorrect.t || 0) : null,
    firstCorrectAtMs: firstCorrect ? Number(firstCorrect.t || 0) : null,
    gaveUpAfterMoves: outcome === 'gave_up' ? moves : null,
    gaveUpAfterIncorrect: outcome === 'gave_up' ? incorrectGuesses : null,
    events,
  };
}

export function startAttempt(details = {}) {
  const existing = getActiveAttempt();
  if (existing?.id && existing?.roundId === details.roundId) return existing;
  if (existing?.id) {
    const duration = elapsedMsFor(existing);
    if (duration >= IGNORE_EMPTY_ABANDON_MS || hasMeaningfulInteraction(existing)) {
      appendSummary(buildSummary(existing, 'abandoned', { endedAt: nowISO(), durationMs: duration }));
    }
  }

  const startedAtMs = nowMs();
  const attempt = {
    id: makeId(),
    roundId: details.roundId || null,
    mode: details.mode || 'free',
    difficulty: details.difficulty || 'normal',
    dailyDate: details.dailyDate || null,
    startArea: details.startArea || null,
    targetArea: details.targetArea || null,
    inputStyle: details.inputStyle || 'unknown',
    mapStyle: details.mapStyle || 'standard',
    startedAt: nowISO(),
    startedAtMs,
    path: details.startArea ? [details.startArea] : [],
    counts: {
      incorrectGuesses: 0,
      hintsOpened: 0,
      hintsUsed: 0,
      undos: 0,
    },
    events: [
      {
        type: 'game_started',
        t: 0,
        at: nowISO(),
        startArea: details.startArea || null,
        targetArea: details.targetArea || null,
      },
    ],
  };
  saveActiveAttempt(attempt);
  return attempt;
}

export function recordAttemptEvent(type, details = {}) {
  const attempt = getActiveAttempt();
  if (!attempt?.id) return null;

  const event = {
    type,
    t: elapsedMsFor(attempt),
    at: nowISO(),
    ...details,
  };

  attempt.counts = {
    incorrectGuesses: 0,
    hintsOpened: 0,
    hintsUsed: 0,
    undos: 0,
    ...(attempt.counts || {}),
  };

  if (type === 'guess_incorrect') {
    attempt.counts.incorrectGuesses = Number(attempt.counts.incorrectGuesses || 0) + 1;
  }
  if (type === 'hint_opened') {
    attempt.counts.hintsOpened = Number(attempt.counts.hintsOpened || 0) + 1;
  }
  if (type === 'hint_used') {
    attempt.counts.hintsUsed = Number(attempt.counts.hintsUsed || 0) + 1;
  }
  if (type === 'move_undone') {
    attempt.counts.undos = Number(attempt.counts.undos || 0) + 1;
  }
  if (type === 'guess_correct' && details.to) {
    attempt.path = Array.isArray(details.path) ? details.path : [...(attempt.path || []), details.to];
  }

  if (type === 'guess_correct') {
    delete event.path;
  }

  attempt.events = normalizeEvents([...(attempt.events || []), event]);
  saveActiveAttempt(attempt);
  return attempt;
}

export function finishAttempt(outcome, details = {}) {
  const attempt = getActiveAttempt();
  if (!attempt?.id) return null;
  const summary = buildSummary(attempt, outcome, details);
  appendSummary(summary);
  clearActiveAttempt();
  return summary;
}

export function abandonActiveAttempt(reason = 'navigation', details = {}) {
  const attempt = getActiveAttempt();
  if (!attempt?.id) return null;
  const duration = elapsedMsFor(attempt, details.durationMs);
  if (details.onlyIfStale && duration < STALE_AFTER_MS) return null;
  if (duration < IGNORE_EMPTY_ABANDON_MS && !hasMeaningfulInteraction(attempt)) {
    clearActiveAttempt();
    return null;
  }
  recordAttemptEvent('game_abandoned', { reason });
  return finishAttempt('abandoned', { ...details, durationMs: duration });
}

export function getAttemptAnalyticsSnapshot() {
  const active = getActiveAttempt();
  return {
    version: 1,
    exportedAt: nowISO(),
    activeAttempt: active || null,
    attemptSummaries: readJSON(ATTEMPT_SUMMARIES_KEY, []),
  };
}

export { ATTEMPT_SUMMARIES_KEY, ACTIVE_ATTEMPT_KEY };
