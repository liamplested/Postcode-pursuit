import { dailyStatus, saveSnapshot, todayUTC } from './dailyManager';

const HISTORY_KEY = 'pp_history_v2';

function writeHistory(games) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ games }));
}

describe('dailyStatus', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns Continue for an unfinished same-day snapshot', () => {
    saveSnapshot('normal', {
      date: todayUTC(),
      difficulty: 'normal',
      status: 'playing',
      gameWon: false,
      roundOver: false,
    });

    expect(dailyStatus('normal')).toBe('Continue');
  });

  test('returns View result for a won same-day snapshot', () => {
    saveSnapshot('hard', {
      date: todayUTC(),
      difficulty: 'hard',
      status: 'won',
      gameWon: true,
      roundOver: true,
    });

    expect(dailyStatus('hard')).toBe('View result');
  });

  test('uses daily win history when the snapshot is missing', () => {
    writeHistory([
      {
        mode: 'daily',
        difficulty: 'easy',
        won: true,
        dateISO: `${todayUTC()}T12:00:00.000Z`,
      },
    ]);

    expect(dailyStatus('easy')).toBe('View result');
  });

  test('uses daily win history when the same-day snapshot still says playing', () => {
    saveSnapshot('master', {
      date: todayUTC(),
      difficulty: 'master',
      status: 'playing',
      gameWon: false,
      roundOver: false,
    });
    writeHistory([
      {
        mode: 'daily',
        difficulty: 'master',
        won: true,
        dateISO: `${todayUTC()}T12:00:00.000Z`,
      },
    ]);

    expect(dailyStatus('master')).toBe('View result');
  });

  test('keeps gave-up history ahead of win fallback', () => {
    saveSnapshot('normal', {
      date: todayUTC(),
      difficulty: 'normal',
      status: 'playing',
      gameWon: false,
      roundOver: false,
    });
    writeHistory([
      {
        mode: 'daily',
        difficulty: 'normal',
        won: false,
        dateISO: `${todayUTC()}T08:00:00.000Z`,
      },
      {
        mode: 'daily',
        difficulty: 'normal',
        won: true,
        dateISO: `${todayUTC()}T12:00:00.000Z`,
      },
    ]);

    expect(dailyStatus('normal')).toBe('Gave up');
  });
});
