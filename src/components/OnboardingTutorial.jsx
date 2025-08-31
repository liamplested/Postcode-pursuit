// src/components/OnboardingTutorial.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export default function OnboardingTutorial({
  isOpen,
  onSkip,
  onComplete,
  postcodeAreas = {},
}) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [path, setPath] = useState([]);
  const inputRef = useRef(null);
const ONBOARDING_KEY = 'pp:onboardingComplete:v1';



  // Mini graph (undirected) – keep this tiny & obvious
  const miniGraph = useMemo(
    () => ({
      AB: ["DD", "PH"],
      DD: ["AB", "KY", "PH"],
      PH: ["AB", "DD", "KY"],
      KY: ["DD","PH"],
    }),
    []
  );

  const START = "AB";
  const TARGET = "KY";
  const subset = useMemo(() => {
  return ["AB", "DD", "PH", "KY"];
}, []);

/*   const nodes = useMemo(
    () => Array.from(new Set([START, TARGET, ...Object.keys(miniGraph)])),
    [miniGraph]
  ); */

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setInput("");
    setPath([START]);
    const t = setTimeout(() => inputRef.current?.focus(), 5000);
    return () => clearTimeout(t);
  }, [isOpen]);

  const current = path[path.length - 1];
  const neighbours = miniGraph[current] || [];
  const visibleStep = step >= 3 && current !== TARGET ? 3 : step;



// reset when the tutorial opens
useEffect(() => {
  if (isOpen) setShowStuckHint(false);
}, [isOpen]);

// hide the hint as soon as you leave Step 2
useEffect(() => {
  if (visibleStep !== 1) setShowStuckHint(false);
}, [visibleStep]);


  const [showStuckHint, setShowStuckHint] = useState(false);
  const [showStuckHint3, setShowStuckHint3] = useState(false);

const nudgeStuck = useCallback(() => {
  if (visibleStep !== 1 || current === TARGET) return; // only step 2
  setShowStuckHint(true);
  if (inputRef.current) {
    if (!input.trim()) setInput('DD'); // prefill if empty
    inputRef.current.focus();
    inputRef.current.select?.();
  }
}, [visibleStep, current, TARGET, input]);


useEffect(() => {
  if (isOpen) {
    setShowStuckHint(false);
    setShowStuckHint3(false);
  }
}, [isOpen]);
useEffect(() => {
  if (visibleStep !== 1) setShowStuckHint(false);
}, [visibleStep]);

useEffect(() => {
  if (visibleStep !== 2) setShowStuckHint3(false);
}, [visibleStep]);

const nudgeStuckStep3 = useCallback(() => {
  if (visibleStep !== 2 || current === TARGET) return;
  setShowStuckHint3(true);
  if (!input.trim()) setInput('KY');
  inputRef.current?.focus();
  inputRef.current?.select?.();
}, [visibleStep, current, input]);

  function isNeighbour(code) {
    return neighbours.includes(code.toUpperCase());
  }

function restartTutorial() {
   setStep(1);           // jump straight to the “do a move” step
   setInput("");
   setPath([START]);     // reset path
   setShowStuckHint(false);
   setShowStuckHint3(false);
   inputRef.current?.focus();
 }

  function handleSubmit(e) {
    e.preventDefault();
    const guess = input.trim().toUpperCase();
    if (!guess) return;

    if (!isNeighbour(guess)) {
      const hint = neighbours[0];
      alert(`Not quite!. Your current location is ${current}. Try a neighbouring area, like "${hint}".`);
      setInput("");
      return;
    }

    setPath((prev) => [...prev, guess]);
    setInput("");

    if (step === 1) setStep(2);
    if (guess === TARGET) {
      setStep(4); // show completion screen with buttons
    } else if (step < 2) {
      setStep(2);
    }
  }


  
  const steps = [
    {
      title: "Welcome to Postcode Pursuit",
      body:
        "Your goal is to travel from the start postcode (in blue) to the target (in yellow), moving one neighbouring area at a time. In this tutorial, your aim is to get from AB to KY.",
      cta: "Ready? Let's go",
      onCta: () => setStep(1),
    },
    {
      title: `Start: ${START} → Target: ${TARGET}`,
      body:
        "Type a neighbouring area code of the blue start area and press Enter.",
      cta: "Got it",
      onCta: () => inputRef.current?.focus(),
    },
    {
      title: "Nice move!",
      body:
        "Keep entering valid neighbours to reach the target. Tip: If you’re unsure, try the suggestion we give you.",
      cta: "Continue",
      onCta: () => inputRef.current?.focus(),
    },
    {
      title: "Keep going…",
      body:
        "You’re close! Reach the target area to finish this mini tutorial.",
      cta: "OK",
      onCta: () => inputRef.current?.focus(),
    },
    {
      title: "You’re ready!",
      body:
        "That’s the core of the game. In the full game, the map is the whole UK, with ferries and bridges to help you get around. Try to get from the start to the target in the fewest connections. Have fun!",
      cta: "Start playing",
      onCta: () => onComplete?.(),
    },
  ];

 // --- Tight-fit helper: union bbox of the subset (runtime measurement)
 const getUnionBBox = useCallback((codes) => {
   let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
   const svgNS = "http://www.w3.org/2000/svg";
   const svg = document.createElementNS(svgNS, "svg");
   // attach so getBBox is reliable in prod builds
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
     w: (maxX - minX) + pad * 2,
     h: (maxY - minY) + pad * 2,
   };
 }, [postcodeAreas]);

  // Compute bbox once after open (avoid flicker)
  const [bbox, setBbox] = useState(null);
useEffect(() => {
  if (!isOpen) return;
  setBbox(getUnionBBox(subset) || { x: 0, y: 0, w: 15000, h: 17500 });
}, [isOpen, subset, getUnionBBox]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483646,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          width: "min(96vw, 768px)",
          borderRadius: 16,
          padding: 24,
          background: "rgba(34, 68, 160, 0.92)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
        }}
        className="rounded-2xl"
      >
        {/* Header + Skip */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl md:text-2xl font-bold">
            {steps[visibleStep].title}
          </h2>
        </div>

        <p className="text-sm md:text-base text-slate-700">
          {steps[visibleStep].body}
        </p>

        {/* Footer CTA */}
<div className="mt-4 flex justify-between">
  {step === 4 ? (
    <>
      <button
        onClick={restartTutorial}
        className="btn btn-primary"
      >
        Try again
      </button>
      <div className="flex items-center gap-2">

        <button
          onClick={() => {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      
onSkip(); // or onComplete()
    }}
          className="btn btn-success"
        >
          Continue
        </button>


        <div className="text-xs text-slate-500 hidden sm:block">
          Tip: You can replay this later.
        </div>
      </div>
      
    </>
  ) : (
    <>
      <div className="flex items-center gap-2">
 <div className="flex items-center gap-2">
   <button onClick={steps[visibleStep].onCta} className="btn btn-primary">
     {steps[visibleStep].cta}
   </button>

   {visibleStep === 2 && current !== TARGET && (
     <button type="button" className="btn btn-neutral" onClick={nudgeStuckStep3}>
       Still stuck? Click here
     </button>
   )}
 </div>
        {visibleStep === 1 && current !== TARGET && (
          <button
            type="button"
            className="btn btn-neutral"
            onClick={nudgeStuck}
          >
            Stuck? Click here
          </button>
        )}
      </div>

              {/* Input */}
        {current !== TARGET && (
          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Enter a neighbour of ${current} (e.g. ${neighbours[0]})`}
              className="flex-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring focus:ring-sky-400"
              inputMode="text"
              autoCapitalize="characters"
              aria-label="Enter neighbouring postcode area"
            />
            <button type="submit" className="btn btn-hollowgreen w-full">
              Enter
            </button>
          </form>
        )}
{showStuckHint && visibleStep === 1 && current !== TARGET && (
  <div className="mt-2 text-sm text-slate-100/90">
    Try typing <b>DD</b> or <b>PH</b> into the box and press <b>Enter</b>.
  </div>
)}

{showStuckHint3 && visibleStep === 2 && current !== TARGET && (
  <div className="mt-2 text-sm text-slate-100/90">
    Try typing <b>KY</b> (the target) and press <b>Enter</b>.
  </div>
)}
        {/* Mini map (tight-fit to subset) */}
        <div className="mt-4 border rounded-xl overflow-hidden bg-slate-50">
          <svg
            viewBox={
              bbox
                ? `${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`
                : "0 0 15000 17500"
            }
            style={{ width: "100%", height: 280 }}
          >
            {/* Real shapes */}
            {subset.map((code) => {
              const d = postcodeAreas[code]?.path;
              if (!d) return null;
              const isCurrent = code === current;
              const isTarget = code === TARGET;
              const visited = path.includes(code);

              const fill = isTarget
                ? "#FDE68A" // amber-200
                : isCurrent
                ? "#93C5FD" // blue-300
                : visited
                ? "#E2E8F0" // slate-200
                : "#66b860ff"; // slate-100

              return (
                <path
                  key={code}
                  d={d}
                  fill={fill}
                  stroke="#334155"                // slate-700
                  strokeWidth={2}                // thick so it survives scaling
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Labels (centres from main map) */}
            {subset.map((code) => {
              const c = postcodeAreas[code]?.center;
              if (!c) return null;
              return (
                <text
                  key={`label-${code}`}
                  x={c.x}
                  y={c.y}
                  textAnchor="middle"
                  fontWeight="700"
                  stroke="white"
                  strokeWidth={4}
                  fontSize="420"                 // big; scales down with viewBox
                  fill="#0F172A"
                  style={{ paintOrder: "stroke" }}
                >
                  {code}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Path chips */}
        <div className="badges">
          {path.map((p, i) => (
            <span key={`${p}-${i}`} className="px-2 py-1 rounded-lg text-sm bg-slate-200">
              {p}
            </span>
          ))}
        </div>




<div>
  <button
    className="btn btn-warn glass"
    onClick={() => {
      localStorage.setItem(ONBOARDING_KEY, 'true');
onSkip(); // or onComplete()
    }}
    aria-label="Skip tutorial"
  >
    Skip tutorial
  </button>
</div>
    </>
  )}
</div>
      </div>
    </div>,
    document.body
  );
}
