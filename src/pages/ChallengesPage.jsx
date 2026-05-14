import React from 'react';
import { ArrowLeft, Play } from 'lucide-react';

function formatTime(ms) {
  if (!ms && ms !== 0) return '-';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function BestSummary({ best }) {
  if (!best) return <span>No local best yet</span>;
  return (
    <span>
      {best.moves} connections · {best.livesLost} lives lost · {formatTime(best.durationMs)}
    </span>
  );
}

export default function ChallengesPage({ challenges, bests, onBack, onStart }) {
  const [starts, setStarts] = React.useState({});
  const [errors, setErrors] = React.useState({});

  const handleStart = (challengeId) => {
    const result = onStart(challengeId, starts[challengeId]);
    if (result?.ok) return;
    setErrors((prev) => ({ ...prev, [challengeId]: result?.message || 'Could not start challenge.' }));
  };

  const handleStartChange = (challengeId, value) => {
    setStarts((prev) => ({ ...prev, [challengeId]: value.toUpperCase() }));
    setErrors((prev) => ({ ...prev, [challengeId]: '' }));
  };

  return (
    <div className="pp-info-page mx-auto max-w-4xl p-6">
      <div className="pp-page-header">
        <button className="btn btn-primary" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1>Challenges</h1>
      </div>

      <section className="glass pp-settings-section p-4 rounded-xl mb-6">
        <p>
          Official challenge rules: Normal-style map, no labels, no undo, no hints, and three lives.
          Revisits are only allowed where the objective requires them.
        </p>
      </section>

      <div className="grid gap-4">
        {challenges.map((challenge) => {
          const best = bests?.[challenge.id] || null;
          return (
            <section key={challenge.id} className="glass pp-settings-section p-4 rounded-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{challenge.name}</h2>
                  <p className="mt-1">{challenge.description}</p>
                  <p className="mt-2 text-sm opacity-80">
                    <BestSummary best={best} />
                  </p>
                </div>

                <div className="min-w-[220px]">
                  <label className="block text-sm font-semibold" htmlFor={`challenge-start-${challenge.id}`}>
                    Start postcode
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id={`challenge-start-${challenge.id}`}
                      value={starts[challenge.id] || ''}
                      onChange={(event) => handleStartChange(challenge.id, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleStart(challenge.id);
                      }}
                      placeholder={challenge.allowedStarts?.join(' or ') || 'e.g. EH'}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <button className="btn btn-primary" onClick={() => handleStart(challenge.id)}>
                      <Play className="h-4 w-4" /> Start
                    </button>
                  </div>
                  <p className="mt-2 text-xs opacity-75">{challenge.startHint}</p>
                  {errors[challenge.id] && (
                    <p className="mt-2 text-sm text-rose-200">{errors[challenge.id]}</p>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
