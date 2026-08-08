import React from 'react';
import { ArrowLeft, MapPinned, Medal, Play, Route, Shield, Sparkles } from 'lucide-react';

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

const CHALLENGE_STYLES = [
  { icon: MapPinned, className: 'pp-challenge-card--emerald' },
  { icon: Route, className: 'pp-challenge-card--sky' },
  { icon: Shield, className: 'pp-challenge-card--violet' },
  { icon: Sparkles, className: 'pp-challenge-card--amber' },
];

function revisitRuleFor(challenge) {
  if (challenge.allowRevisits) {
    return 'Revisits allowed where needed to use every bridge, tunnel, and ferry.';
  }
  return 'No revisits: each postcode area can only be used once.';
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
    <div className="pp-info-page pp-challenges-page mx-auto">
      <div className="pp-challenge-topbar">
        <button className="btn btn-primary" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div>
          <h1>Challenges</h1>
          <p>Special objectives with stricter route rules and saved local bests.</p>
        </div>
      </div>

      <section className="pp-challenge-rules">
        <span><Shield className="h-4 w-4" /> Three lives</span>
        <span><MapPinned className="h-4 w-4" /> Normal-style map</span>
        <span><Route className="h-4 w-4" /> No labels, undo, or hints</span>
      </section>

      <div className="pp-challenge-grid">
        {challenges.map((challenge, index) => {
          const best = bests?.[challenge.id] || null;
          const style = CHALLENGE_STYLES[index % CHALLENGE_STYLES.length];
          const Icon = style.icon;
          return (
            <section key={challenge.id} className={`pp-challenge-card ${style.className}`}>
              <div className="pp-challenge-card-main">
                <div className="pp-challenge-icon" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="pp-challenge-copy">
                  <h2>{challenge.name}</h2>
                  <p>{challenge.description}</p>
                  <div className="pp-challenge-meta">
                    <span><Sparkles className="h-4 w-4" aria-hidden="true" /> {revisitRuleFor(challenge)}</span>
                  </div>
                  <div className="pp-challenge-best">
                    <Medal className="h-4 w-4" aria-hidden="true" />
                    <BestSummary best={best} />
                  </div>
                </div>
              </div>

              <div className="pp-challenge-start">
                <label htmlFor={`challenge-start-${challenge.id}`}>
                  Start postcode
                </label>
                <div className="pp-challenge-start-row">
                  <input
                    id={`challenge-start-${challenge.id}`}
                    value={starts[challenge.id] || ''}
                    onChange={(event) => handleStartChange(challenge.id, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleStart(challenge.id);
                    }}
                    placeholder={challenge.allowedStarts?.join(' or ') || 'e.g. EH'}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button className="btn btn-primary" onClick={() => handleStart(challenge.id)}>
                    <Play className="h-4 w-4" /> Start
                  </button>
                </div>
                <p className="pp-challenge-hint">{challenge.startHint}</p>
                {errors[challenge.id] && (
                  <p className="pp-challenge-error">{errors[challenge.id]}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
