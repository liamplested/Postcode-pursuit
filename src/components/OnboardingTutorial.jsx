// src/components/OnboardingTutorial.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export default function OnboardingTutorial({
  isOpen,
  onSkip,
  onComplete,
  postcodeAreas = {},
}) {
  const [activeTab, setActiveTab] = useState("tutorial");
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [path, setPath] = useState([]);
  const [showStuckHint, setShowStuckHint] = useState(false);
  const [showTargetHint, setShowTargetHint] = useState(false);
  const [error, setError] = useState("");
  const [bbox, setBbox] = useState(null);
  const inputRef = useRef(null);

  const START = "AB";
  const TARGET = "KY";

  const miniGraph = useMemo(
    () => ({
      AB: ["DD", "PH"],
      DD: ["AB", "KY", "PH"],
      PH: ["AB", "DD", "KY"],
      KY: ["DD", "PH"],
    }),
    []
  );

  const subset = useMemo(() => ["AB", "DD", "PH", "KY"], []);
  const current = path[path.length - 1] || START;
  const neighbours = miniGraph[current] || [];
  const visibleStep = step >= 3 && current !== TARGET ? 3 : step;

  const closeTutorial = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const resetTutorial = useCallback((nextStep = 0) => {
    setStep(nextStep);
    setInput("");
    setPath([START]);
    setShowStuckHint(false);
    setShowTargetHint(false);
    setError("");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("tutorial");
    resetTutorial(0);
  }, [isOpen, resetTutorial]);

  useEffect(() => {
    if (activeTab === "tutorial" && isOpen && current !== TARGET) {
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [activeTab, current, isOpen]);

  useEffect(() => {
    if (visibleStep !== 1) setShowStuckHint(false);
    if (visibleStep !== 2) setShowTargetHint(false);
  }, [visibleStep]);

  const getUnionBBox = useCallback((codes) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.style.opacity = "0";
    document.body.appendChild(svg);

    for (const code of codes) {
      const d = postcodeAreas[code]?.path;
      if (!d) continue;
      const p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
      const b = p.getBBox();
      if (b && b.width && b.height) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
      svg.removeChild(p);
    }

    document.body.removeChild(svg);
    if (!isFinite(minX)) return null;
    const pad = 400;
    return {
      x: Math.max(0, minX - pad),
      y: Math.max(0, minY - pad),
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    };
  }, [postcodeAreas]);

  useEffect(() => {
    if (!isOpen) return;
    setBbox(getUnionBBox(subset) || { x: 0, y: 0, w: 15000, h: 17500 });
  }, [isOpen, subset, getUnionBBox]);

  function isNeighbour(code) {
    return neighbours.includes(code.toUpperCase());
  }

  function handleSubmit(e) {
    e.preventDefault();
    const guess = input.trim().toUpperCase();
    if (!guess) return;

    if (!isNeighbour(guess)) {
      const hint = neighbours[0];
      setError(`Not quite. You are currently in ${current}. Try a neighbouring area, like ${hint}.`);
      setInput("");
      return;
    }

    setPath((prev) => [...prev, guess]);
    setInput("");
    setError("");

    if (guess === TARGET) {
      setStep(4);
    } else if (step <= 1) {
      setStep(2);
    } else if (step < 3) {
      setStep(3);
    }
  }

  const steps = [
    {
      title: "Welcome to Postcode Pursuit",
      body: "Your goal is to travel from the blue start postcode area to the orange target, moving one neighbouring area at a time. In this sandbox, get from AB to KY.",
      cta: "Ready? Let's go",
      onCta: () => setStep(1),
    },
    {
      title: `Start: ${START} -> Target: ${TARGET}`,
      body: "Type a neighbouring postcode area of AB and press Enter. DD and PH are both valid first moves.",
      cta: "Focus input",
      onCta: () => inputRef.current?.focus(),
    },
    {
      title: "Nice move",
      body: "Your current area has changed. Keep choosing connected postcode areas until you reach the target.",
      cta: "Continue",
      onCta: () => inputRef.current?.focus(),
    },
    {
      title: "Keep going",
      body: "You are close. Reach KY to finish this sandbox route.",
      cta: "OK",
      onCta: () => inputRef.current?.focus(),
    },
    {
      title: "You know the core loop",
      body: "That is the basic loop: move through connected postcode areas and try to reach the target in fewer moves. Close the tutorial when you are ready to look around or choose a game.",
      cta: "Close Tutorial",
      onCta: closeTutorial,
    },
  ];

  if (!isOpen) return null;

  const renderTutorial = () => (
    <>
      <div className="pp-tutorial-copy">
        <h2>{steps[visibleStep].title}</h2>
        <p>{steps[visibleStep].body}</p>
      </div>

      <div className="pp-tutorial-progress" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= Math.min(visibleStep, 3) ? "active" : ""} />
        ))}
      </div>

      <div className="pp-tutorial-map" aria-label="Sandbox tutorial map">
        <svg
          viewBox={bbox ? `${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}` : "0 0 15000 17500"}
          style={{ width: "100%", height: 280 }}
        >
          {subset.map((code) => {
            const d = postcodeAreas[code]?.path;
            if (!d) return null;
            const isCurrent = code === current;
            const isTarget = code === TARGET;
            const visited = path.includes(code);
            const fill = isTarget
              ? "#FBBF24"
              : isCurrent
                ? "#38BDF8"
                : visited
                  ? "#BBF7D0"
                  : "#E2E8F0";

            return (
              <path
                key={code}
                d={d}
                fill={fill}
                stroke="#334155"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {subset.map((code) => {
            const c = postcodeAreas[code]?.center;
            if (!c) return null;
            return (
              <text
                key={`label-${code}`}
                x={c.x}
                y={c.y}
                textAnchor="middle"
                fontWeight="800"
                stroke="white"
                strokeWidth={4}
                fontSize="420"
                fill="#0F172A"
                style={{ paintOrder: "stroke" }}
              >
                {code}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="pp-tutorial-path" aria-label="Sandbox journey">
        {path.map((p, i) => (
          <span key={`${p}-${i}`} className={i === path.length - 1 ? "current" : ""}>
            {i === 0 ? "Start " : i === path.length - 1 ? "Current " : ""}{p}
          </span>
        ))}
      </div>

      {error && <div className="pp-tutorial-error" role="alert">{error}</div>}

      {current !== TARGET && (
        <form onSubmit={handleSubmit} className="pp-tutorial-form">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Enter a neighbour of ${current} (e.g. ${neighbours[0]})`}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Enter neighbouring postcode area"
          />
          <button type="submit" className="btn btn-hollowgreen">Enter</button>
        </form>
      )}

      {showStuckHint && visibleStep === 1 && current !== TARGET && (
        <div className="pp-tutorial-hint">Try typing <b>DD</b> or <b>PH</b>, then press <b>Enter</b>.</div>
      )}

      {showTargetHint && visibleStep === 2 && current !== TARGET && (
        <div className="pp-tutorial-hint">Try typing <b>KY</b>, the target, then press <b>Enter</b>.</div>
      )}

      <div className="pp-tutorial-actions">
        {step === 4 ? (
          <>
            <button type="button" onClick={() => resetTutorial(1)} className="btn btn-primary">Try again</button>
            <button type="button" onClick={closeTutorial} className="btn btn-success">Close Tutorial</button>
          </>
        ) : (
          <>
            <div className="pp-tutorial-action-left">
              <button type="button" onClick={steps[visibleStep].onCta} className="btn btn-primary">
                {steps[visibleStep].cta}
              </button>
              {visibleStep === 1 && current !== TARGET && (
                <button type="button" className="btn btn-neutral" onClick={() => {
                  setShowStuckHint(true);
                  if (!input.trim()) setInput("DD");
                  inputRef.current?.focus();
                  inputRef.current?.select?.();
                }}>
                  Stuck?
                </button>
              )}
              {visibleStep === 2 && current !== TARGET && (
                <button type="button" className="btn btn-neutral" onClick={() => {
                  setShowTargetHint(true);
                  if (!input.trim()) setInput("KY");
                  inputRef.current?.focus();
                  inputRef.current?.select?.();
                }}>
                  Still stuck?
                </button>
              )}
            </div>
            <button type="button" onClick={onSkip} className="btn btn-warn">Skip tutorial</button>
          </>
        )}
      </div>
    </>
  );

  const renderRules = () => (
    <div className="pp-rules-grid">
      <section>
        <h3>Daily Challenge</h3>
        <p>Daily Challenge is the main shared puzzle. Each difficulty has one route per day, progress is saved, and wins build separate daily streaks.</p>
      </section>
      <section>
        <h3>Free Play</h3>
        <p>Free Play creates random routes whenever you want to practise, explore the map, or chase exploration achievements without waiting for tomorrow.</p>
      </section>
      <section>
        <h3>Movement</h3>
        <p>Move from your current postcode area to a connected neighbouring area. Some routes use bridges, tunnels or ferries as special connections.</p>
      </section>
      <section>
        <h3>Hints</h3>
        <p>Hints show available connections. Daily hints are limited. Exploration and streak achievements can still count, but challenge achievements require a no-hint run.</p>
      </section>
      <section>
        <h3>Scoring</h3>
        <p>Each route has an optimal path. Daily puzzles also show par, so your result can be under par, on par or over par.</p>
      </section>
      <section>
        <h3>Difficulty</h3>
        <p>Easy and Normal are more forgiving. Hard and Master hide more map information and restrict undo or revisits for a tougher challenge.</p>
      </section>
      <section>
        <h3>Mobile controls</h3>
        <p>On phones, use Enter for postcode choices, Journey for your route history, and Actions for undo, giving up and hints.</p>
      </section>
      <section>
        <h3>Achievements</h3>
        <p>Exploration achievements reward coverage and route features. Challenge achievements reward clean, efficient runs. Streak achievements are earned through Daily Challenge.</p>
      </section>
      <div className="pp-rules-actions">
        <button type="button" onClick={() => setActiveTab("tutorial")} className="btn btn-primary">Play sandbox tutorial</button>
        <button type="button" onClick={closeTutorial} className="btn btn-success">Close Tutorial</button>
      </div>
    </div>
  );

  return createPortal(
    <div className="pp-tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="pp-tutorial-title">
      <div className="pp-tutorial-modal">
        <div className="pp-tutorial-header">
          <div>
            <div className="pp-tutorial-eyebrow">How to Play</div>
            <h1 id="pp-tutorial-title">Postcode Pursuit</h1>
          </div>
          <button type="button" className="btn btn-neutral" onClick={closeTutorial}>Close</button>
        </div>

        <div className="pp-tutorial-tabs" role="tablist" aria-label="How to Play tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tutorial"}
            className={activeTab === "tutorial" ? "active" : ""}
            onClick={() => setActiveTab("tutorial")}
          >
            Tutorial
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "rules"}
            className={activeTab === "rules" ? "active" : ""}
            onClick={() => setActiveTab("rules")}
          >
            Rules
          </button>
        </div>

        <div className="pp-tutorial-content">
          {activeTab === "tutorial" ? renderTutorial() : renderRules()}
        </div>
      </div>
    </div>,
    document.body
  );
}
