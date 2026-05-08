// pages/AchievementsPage.jsx
import React from 'react';
import { ArrowLeft, CheckCircle2, Lock, Medal } from 'lucide-react';
import { postcodeAreas, ferryLinks, bridgeLinks } from '../postcodeAreas';
import {
  ACHIEVEMENTS_KEY,
  GAME_HISTORY_KEY,
  META_KEY,
  STREAK_KEY_V2,
  USED_BRIDGES_KEY,
  USED_FERRIES_KEY,
  VISITED_KEY,
  canonEdge,
  readJSON,
} from '../utils/storageUtils';

const HIDDEN_BONUS_IDS = new Set(['mersey', 'shortcut']);
const DIFFS = ['easy', 'normal', 'hard', 'master'];
const DIFF_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard', master: 'Master' };
const STREAK_MILESTONES = [7, 14, 30, 365];

const NON_REPEATABLE_IDS = new Set([
  'first',
  'centurion',
  'half_century',
  'double_perfect',
  'turkey',
]);

const COVERAGE_IDS = new Set([
  'visit_25',
  'visit_50',
  'explorer_75',
  'visit_100',
  'first_crossing',
  'first_span',
  'all_ferries',
  'all_bridges',
  'networker',
  'infrastructure_chief',
]);

const TIER_ORDER = ['legendary', 'gold', 'silver', 'bronze'];
const TIER_RANK = Object.fromEntries(TIER_ORDER.map((tier, i) => [tier, i]));

function readAchievementsMap() {
  return readJSON(ACHIEVEMENTS_KEY, {});
}

function readHistory() {
  return readJSON(GAME_HISTORY_KEY, { games: [] })?.games || [];
}

function asObjectMap(value) {
  if (Array.isArray(value)) return Object.fromEntries(value.map((x) => [x, true]));
  if (value && typeof value === 'object') return value;
  return {};
}

function readStreakCount(diff) {
  const rec = readJSON(STREAK_KEY_V2(diff), null);
  return Number(rec?.count || 0);
}

function readFullMeta() {
  const stored = readJSON(META_KEY, {}) || {};
  const visitedAreas = asObjectMap(readJSON(VISITED_KEY, stored.visitedAreas || {}));
  const usedFerries = asObjectMap(readJSON(USED_FERRIES_KEY, stored.usedFerries || {}));
  const usedBridges = asObjectMap(readJSON(USED_BRIDGES_KEY, stored.usedBridges || {}));
  const allFerries = new Set((ferryLinks || []).map(({ a, b }) => canonEdge(a, b)).filter(Boolean));
  const allBridges = new Set((bridgeLinks || []).map(({ a, b }) => canonEdge(a, b)).filter(Boolean));

  return {
    ...stored,
    visitedAreas,
    usedFerries,
    usedBridges,
    visitedCount: Object.keys(visitedAreas).length,
    totalAreas: Object.keys(postcodeAreas || {}).length,
    usedFerriesCount: Object.keys(usedFerries).length,
    usedBridgesCount: Object.keys(usedBridges).length,
    totalFerries: allFerries.size,
    totalBridges: allBridges.size,
  };
}

function achievementKind(a) {
  if ((a.category || '').toLowerCase() === 'streak' || a.id.startsWith('streak')) return 'streak';
  if (COVERAGE_IDS.has(a.id)) return 'coverage';
  if (NON_REPEATABLE_IDS.has(a.id) || a.hidden) return 'lifetime';
  return 'game';
}

function getStreakTarget(a) {
  if (a.id === 'streak_365') return { target: 365, diff: null };
  const match = /^streak(\d+)_(easy|normal|hard|master)$/.exec(a.id);
  if (!match) return null;
  return { target: Number(match[1]), diff: match[2] };
}

function getStreakProgress(a) {
  const targetInfo = getStreakTarget(a);
  if (!targetInfo) return null;

  if (targetInfo.diff) {
    const current = readStreakCount(targetInfo.diff);
    return {
      current,
      total: targetInfo.target,
      label: `${current} / ${targetInfo.target} days`,
      detail: `${DIFF_LABELS[targetInfo.diff]} current streak`,
    };
  }

  const current = Math.max(...DIFFS.map(readStreakCount));
  return {
    current,
    total: targetInfo.target,
    label: `${current} / ${targetInfo.target} days`,
    detail: 'Best current streak',
  };
}

function getCoverageProgress(a, meta, totalAreasProp) {
  const totalAreas = Number(totalAreasProp) || meta.totalAreas || 0;
  const visited = meta.visitedCount || 0;
  const usedFerries = meta.usedFerriesCount || 0;
  const totalFerries = meta.totalFerries || 0;
  const usedBridges = meta.usedBridgesCount || 0;
  const totalBridges = meta.totalBridges || 0;

  switch (a.id) {
    case 'visit_25':
      return progress('Areas visited', visited, Math.ceil(totalAreas * 0.25), totalAreas);
    case 'visit_50':
      return progress('Areas visited', visited, Math.ceil(totalAreas * 0.5), totalAreas);
    case 'explorer_75':
      return progress('Areas visited', visited, Math.ceil(totalAreas * 0.75), totalAreas);
    case 'visit_100':
      return progress('Areas visited', visited, totalAreas, totalAreas);
    case 'first_crossing':
      return progress('Ferry routes used', usedFerries, 1, totalFerries);
    case 'first_span':
      return progress('Bridge/tunnel routes used', usedBridges, 1, totalBridges);
    case 'all_ferries':
      return progress('Ferry routes used', usedFerries, totalFerries, totalFerries);
    case 'all_bridges':
      return progress('Bridge/tunnel routes used', usedBridges, totalBridges, totalBridges);
    case 'networker': {
      const ferryNeed = Math.ceil(totalFerries / 2);
      const bridgeNeed = Math.ceil(totalBridges / 2);
      return {
        detail: 'Ferries and bridges used',
        current: Math.min(usedFerries, ferryNeed) + Math.min(usedBridges, bridgeNeed),
        total: ferryNeed + bridgeNeed,
        label: `${usedFerries}/${ferryNeed} ferries · ${usedBridges}/${bridgeNeed} bridges`,
      };
    }
    case 'infrastructure_chief':
      return {
        detail: 'All infrastructure used',
        current: usedFerries + usedBridges,
        total: totalFerries + totalBridges,
        label: `${usedFerries}/${totalFerries} ferries · ${usedBridges}/${totalBridges} bridges`,
      };
    default:
      return null;
  }
}

function progress(detail, current, target, denominator = target) {
  return {
    detail,
    current,
    total: target,
    label: denominator && denominator !== target ? `${current} / ${denominator}` : `${current} / ${target}`,
  };
}

function getGameRepeatCount(a, games, meta) {
  if (achievementKind(a) !== 'game') return null;
  let count = 0;

  for (const game of games) {
    try {
      if ((a.category || '').toLowerCase() === 'challenge' && Number(game?.hintsUsed || 0) > 0) continue;
      if (a.check?.(game, { totalGames: 0, totalWins: 0 }, meta)) count += 1;
    } catch {}
  }

  return count;
}

function getRepeatCount(a, unlockedRecord, games, meta) {
  const kind = achievementKind(a);
  const stored = Number(unlockedRecord?.achievedCount || unlockedRecord?.count || 0);

  if (kind === 'game') {
    const fromHistory = getGameRepeatCount(a, games, meta);
    return Math.max(stored, fromHistory || 0, unlockedRecord ? 1 : 0);
  }

  if (kind === 'streak') {
    return Math.max(stored, unlockedRecord ? 1 : 0);
  }

  return null;
}

function pct(current, total) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

function nextStreakMilestone(count) {
  return STREAK_MILESTONES.find((n) => count < n) || 365;
}

function sortAchievements(a, b) {
  const tierDelta = (TIER_RANK[(a.tier || '').toLowerCase()] ?? 99) - (TIER_RANK[(b.tier || '').toLowerCase()] ?? 99);
  return tierDelta || a.name.localeCompare(b.name);
}

function sortByUnlockedThenAchievement(a, b) {
  const unlockedDelta = Number(!!b.unlockedRecord) - Number(!!a.unlockedRecord);
  return unlockedDelta || sortAchievements(a.achievement, b.achievement);
}

function sortStreakAchievements(a, b) {
  const unlockedDelta = Number(!!b.unlockedRecord) - Number(!!a.unlockedRecord);
  if (unlockedDelta) return unlockedDelta;

  const targetA = getStreakTarget(a.achievement);
  const targetB = getStreakTarget(b.achievement);
  const milestoneDelta = (targetA?.target ?? 9999) - (targetB?.target ?? 9999);
  if (milestoneDelta) return milestoneDelta;

  const diffA = targetA?.diff ? DIFFS.indexOf(targetA.diff) : DIFFS.length;
  const diffB = targetB?.diff ? DIFFS.indexOf(targetB.diff) : DIFFS.length;
  return diffA - diffB || a.achievement.name.localeCompare(b.achievement.name);
}

function cardClass(tier, unlocked) {
  const base = 'pp-ach-card';
  if (!unlocked) return `${base} pp-ach-card--locked`;
  return `${base} pp-ach-card--${(tier || 'bronze').toLowerCase()}`;
}

function categoryLabel(kind) {
  if (kind === 'game') return 'Repeatable';
  if (kind === 'streak') return 'Streak';
  if (kind === 'coverage') return 'Progress';
  return 'Lifetime';
}

function ProgressBar({ progressInfo, complete = false }) {
  if (!progressInfo || !progressInfo.total) return null;
  const width = pct(progressInfo.current, progressInfo.total);
  return (
    <div className="mt-3">
      <div className="pp-ach-progress-label">
        <span>{progressInfo.detail}</span>
        <span className="tabular-nums">{complete ? 'Complete' : progressInfo.label}</span>
      </div>
      <div className="pp-ach-progress-track">
        <div
          className={complete ? 'pp-ach-progress-fill pp-ach-progress-fill--complete' : 'pp-ach-progress-fill'}
          style={{ width: `${complete ? 100 : width}%` }}
        />
      </div>
    </div>
  );
}

function AchievementCard({ achievement, unlockedRecord, repeatCount, progressInfo }) {
  const unlocked = !!unlockedRecord;
  const kind = achievementKind(achievement);
  const isComplete = unlocked && kind !== 'game';
  const when = unlockedRecord?.unlockedAt ? new Date(unlockedRecord.unlockedAt) : null;

  return (
    <article
      className={cardClass(achievement.tier, unlocked)}
      title={achievement.description}
    >
      <div className="pp-ach-card-inner">
        <div className={unlocked ? 'pp-ach-icon' : 'pp-ach-icon pp-ach-icon--locked'}>
          {unlocked ? <span aria-hidden>{achievement.icon}</span> : <Lock className="h-5 w-5" aria-hidden />}
        </div>

        <div className="pp-ach-card-body">
          <div className="pp-ach-title-row">
            <h3>{achievement.name}</h3>
            {repeatCount > 1 && (
              <span className="pp-ach-count">
                x{repeatCount}
              </span>
            )}
            {unlocked && repeatCount <= 1 && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" aria-label="Unlocked" />
            )}
          </div>

          <div className="pp-ach-chip-row">
            <span className="pp-ach-chip pp-ach-chip--tier">
              {achievement.tier}
            </span>
            <span className="pp-ach-chip">
              {categoryLabel(kind)}
            </span>
          </div>

          <p className="pp-ach-desc">{achievement.description}</p>

          <ProgressBar progressInfo={progressInfo} complete={isComplete} />

          <div className="pp-ach-meta">
            {unlocked ? (
              <>
                <span>{kind === 'game' ? 'Unlocked' : 'Completed'}</span>
                {repeatCount > 1 && <span>Achieved {repeatCount} times</span>}
                {when && <span>{when.toLocaleDateString()}</span>}
              </>
            ) : (
              <span>Locked</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Section({ title, note, count, children }) {
  return (
    <section className="pp-ach-section">
      <div className="pp-ach-section-head">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
        <span className="pp-ach-section-count">
          {count}
        </span>
      </div>
      <div className="pp-ach-grid">{children}</div>
    </section>
  );
}

export default function AchievementsPage({
  achievements = [],
  visitedCount: visitedCountProp,
  totalAreas = 0,
  onBack,
}) {
  const unlockedMap = readAchievementsMap();
  const unlockedIds = new Set(Object.keys(unlockedMap));
  const games = readHistory();
  const meta = readFullMeta();
  const visitedCount =
    Number.isFinite(visitedCountProp) ? visitedCountProp : (meta.visitedCount || 0);
  const resolvedTotalAreas = Number(totalAreas) || meta.totalAreas || 0;

  const visibleAchievements = achievements.filter((a) => unlockedIds.has(a.id) || !(a.hidden || HIDDEN_BONUS_IDS.has(a.id)));

  const enriched = visibleAchievements.map((achievement) => {
    const unlockedRecord = unlockedMap[achievement.id] || null;
    const kind = achievementKind(achievement);
    const progressInfo =
      kind === 'streak'
        ? getStreakProgress(achievement)
        : kind === 'coverage'
          ? getCoverageProgress(achievement, meta, resolvedTotalAreas)
          : null;

    return {
      achievement,
      kind,
      unlockedRecord,
      repeatCount: getRepeatCount(achievement, unlockedRecord, games, meta),
      progressInfo,
    };
  });

  const unlocked = enriched.filter((x) => x.unlockedRecord);
  const repeatable = enriched.filter((x) => x.kind === 'game').sort(sortByUnlockedThenAchievement);
  const streaks = enriched.filter((x) => x.kind === 'streak').sort(sortStreakAchievements);
  const coverage = enriched.filter((x) => x.kind === 'coverage').sort(sortByUnlockedThenAchievement);
  const lifetime = enriched.filter((x) => x.kind === 'lifetime').sort(sortByUnlockedThenAchievement);

  const streakSummary = DIFFS.map((diff) => {
    const current = readStreakCount(diff);
    const next = nextStreakMilestone(current);
    return { diff, current, next };
  });

  return (
    <div className="pages-achievements pp-ach-page">
      <div className="pp-ach-wrap">
        <div className="pp-ach-topbar">
          <div>
            <h1>
              <Medal className="h-6 w-6" /> <span>Achievements</span>
            </h1>
            <p>
              Repeat counts, current streak milestones, and lifetime progress.
            </p>
          </div>
          <button className="btn btn-primary pp-ach-back" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="pp-ach-summary">
          <div className="pp-ach-metric">
            <div>{unlocked.length} / {visibleAchievements.length}</div>
            <span>Unlocked</span>
          </div>
          <div className="pp-ach-metric">
            <div>{visitedCount} / {resolvedTotalAreas}</div>
            <span>Areas Visited</span>
          </div>
          <div className="pp-ach-metric">
            <div>{meta.usedFerriesCount} / {meta.totalFerries}</div>
            <span>Ferries Used</span>
          </div>
          <div className="pp-ach-metric">
            <div>{meta.usedBridgesCount} / {meta.totalBridges}</div>
            <span>Bridges Used</span>
          </div>
        </div>

        <div className="pp-ach-note">
          <p className="m-0"><b>Repeatable</b> achievements quietly track how many times they have been achieved where history can determine it.</p>
          <p className="m-0 mt-1"><b>Streak</b> achievements show current progress toward each milestone. <b>Coverage</b> achievements show permanent lifetime progress.</p>
        </div>

        <div className="pp-ach-sections">
          <Section
            title="Repeatable Per Game"
            note="First unlock gets the moment; later repeats stay as a subtle count."
            count={`${repeatable.filter((x) => x.unlockedRecord).length} unlocked`}
          >
            {repeatable.map((item) => (
              <AchievementCard key={item.achievement.id} {...item} />
            ))}
          </Section>

          <Section
            title="Repeatable Streak Milestones"
            note="Achievements are permanent, but the bars track the streak you are building now."
            count={`${streaks.filter((x) => x.unlockedRecord).length} unlocked`}
          >
            {streaks.map((item) => (
              <AchievementCard key={item.achievement.id} {...item} />
            ))}
          </Section>

          <div className="pp-ach-streak-strip">
            {streakSummary.map(({ diff, current, next }) => (
              <div key={diff} className="pp-ach-mini">
                <div>{DIFF_LABELS[diff]}</div>
                <p>
                  <b className="tabular-nums">{current}</b> days · {Math.max(0, next - current)} to {next}
                </p>
                <ProgressBar
                  progressInfo={{
                    detail: 'Current streak',
                    current,
                    total: next,
                    label: `${current} / ${next}`,
                  }}
                />
              </div>
            ))}
          </div>

          <Section
            title="Lifetime / Meta Coverage"
            note="Slow-burn achievements with natural counters and progress bars."
            count={`${coverage.filter((x) => x.unlockedRecord).length} unlocked`}
          >
            {coverage.map((item) => (
              <AchievementCard key={item.achievement.id} {...item} />
            ))}
          </Section>

          <Section
            title="Lifetime Achievements"
            note="One-off goals and hidden discoveries stay clean and binary."
            count={`${lifetime.filter((x) => x.unlockedRecord).length} unlocked`}
          >
            {lifetime.map((item) => (
              <AchievementCard key={item.achievement.id} {...item} />
            ))}
          </Section>
        </div>

        <p className="pp-ach-footnote">
          Bonus hidden achievements do not appear here until unlocked.
        </p>
      </div>
    </div>
  );
}
