import { auth, db, ts } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const CONSENT_KEY = 'pp_consents';

export function hasAnalyticsConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed?.choices?.analytics;
  } catch {
    return false;
  }
}

function compactEvents(events = []) {
  if (!Array.isArray(events)) return [];
  return events.map((event) => {
    if (!event || typeof event !== 'object') return event;
    const { path, ...rest } = event;
    return rest;
  });
}

function gaOutcomeValue(outcome) {
  if (outcome === 'won') return 1;
  if (outcome === 'gave_up') return 0;
  return -1;
}

export function buildGAAttemptPayload(summary) {
  if (!summary) return null;
  return {
    mode: summary.mode,
    difficulty: summary.difficulty,
    outcome: summary.outcome,
    outcome_value: gaOutcomeValue(summary.outcome),
    moves: summary.moves ?? 0,
    par: summary.par ?? undefined,
    par_delta: summary.parDelta ?? undefined,
    par_band: summary.parBand,
    incorrect_guesses: summary.incorrectGuesses ?? 0,
    incorrect_band: summary.incorrectBand,
    incorrect_before_first_move: summary.incorrectBeforeFirstMove ?? 0,
    hints_used: summary.hintsUsed ?? 0,
    hint_band: summary.hintBand,
    undos: summary.undos ?? 0,
    duration_seconds: summary.durationSeconds ?? 0,
    duration_band: summary.durationBand,
    input_style: summary.inputStyle,
    map_style: summary.mapStyle,
    daily_mode: summary.mode === 'daily' ? 1 : 0,
  };
}

export function sendAttemptSummaryToGA(summary) {
  if (!summary || !hasAnalyticsConsent()) return false;
  if (typeof window === 'undefined' || !window.gtag) return false;
  const payload = buildGAAttemptPayload(summary);
  if (!payload) return false;
  window.gtag('event', 'game_attempt_summary', payload);
  return true;
}

export async function saveAttemptSummaryToFirebase(summary) {
  if (!hasAnalyticsConsent()) return false;
  const user = auth.currentUser;
  if (!user || !summary?.id) return false;

  const ref = doc(db, 'users', user.uid, 'analyticsAttempts', summary.id);
  const payload = {
    ...summary,
    uid: user.uid,
    events: compactEvents(summary.events),
    syncedAt: ts(),
  };

  await setDoc(ref, payload, { merge: true });
  return true;
}

export function syncAttemptSummary(summary) {
  sendAttemptSummaryToGA(summary);
  saveAttemptSummaryToFirebase(summary).catch((error) => {
    console.warn('[attempt analytics] Firebase sync failed:', error);
  });
}
