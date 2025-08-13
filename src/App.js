import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Trophy, Eye, EyeOff } from 'lucide-react';
import { createPortal } from "react-dom";
import { postcodeAreas } from './postcodeAreas';
import useSvgPan from "./hooks/useSvgPan";


const VIEWBOX = { x: 0, y: 0, width: 15000, height: 17500 };
const MIN_SCALE = 0.4;
const MAX_SCALE = 30;
const ZOOM_STEP = 1.25; // button zoom factor


const PostcodePursuit = () => {
  const [gameState, setGameState] = useState('menu');
  const [startArea, setStartArea] = useState('');
  const [targetArea, setTargetArea] = useState('');
  const [currentPath, setCurrentPath] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [gameWon, setGameWon] = useState(false);
  const [optimalPath, setOptimalPath] = useState([]);
  const [suggestion, setSuggestion] = useState('');
  const [showOutlines, setShowOutlines] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const suppressClickUntilRef = useRef(0);
  const [flashAreas, setFlashAreas] = useState([]);
  const [showOptimal, setShowOptimal] = useState(false);

  // Pan/zoom state
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const panStartedRef = useRef(false);
  const controlsRef = useRef(null);
  // state
const [masterMode, setMasterMode] = useState(false);

// start with difficulty
const startWithDifficulty = (mode) => {
  if (mode === 'easy') {
    setShowOutlines(true);
    setShowLabels(true);
    setMasterMode(false);
  } else if (mode === 'normal') {
    setShowOutlines(true);
    setShowLabels(false);
    setMasterMode(false);
  } else if (mode === 'hard') {
    setShowOutlines(false);
    setShowLabels(false);
    setMasterMode(false);
  } else if (mode === 'master') {
    setShowOutlines(false);
    setShowLabels(false);
    setMasterMode(true);
  }
  startNewGame();
};

const isRevealed = (code) =>
  masterMode
    ? code === startArea || code === targetArea || currentPath.includes(code)
    : true;
	
const [victoryOpen, setVictoryOpen] = useState(false);
const [elapsedMs, setElapsedMs] = useState(0);
const [streak, setStreak] = useState(() => Number(localStorage.getItem('pp_streak') || 0));
const gameStartRef = useRef(null);

const formatTime = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
};

const buildShareText = () => {
  const guesses = Math.max(0, currentPath.length - 1);
  const optimal = Math.max(0, optimalPath.length - 1);
  const time = elapsedMs ? formatTime(elapsedMs) : null;

  let text = `Postcode Pursuit — ${startArea} → ${targetArea}\n`;
  text += `Guesses: ${guesses}`;
  if (optimal) text += ` (optimal ${optimal})`;
  if (time) text += ` · Time: ${time}`;
  if (streak) text += ` · Streak: ${streak}`;
  text += `\nhttps://yourgame.example`; // optional
  return text;
};

const handleInputSubmit = (inputElement) => {
  const val = inputElement.value.toUpperCase().trim();
  if (postcodeAreas[val]) {
    makeGuess(val);
    inputElement.value = '';
  }
};

const inputRef = useRef(null);

const shareResult = async () => {
  const text = buildShareText();
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Result copied to clipboard!');
    }
  } catch {
    // user cancelled — ignore
  }
};

// ---- color + helpers ----
const BASE_FILL = '#f3f4f6';
const SEAM_PX  = 2; // keep your bleed width
const currentArea = currentPath[currentPath.length - 1] || null;
const visitedSet  = React.useMemo(() => new Set(currentPath), [currentPath]);

const getAreaColor = (code) => {
  if (code === startArea)  return '#00ff59'; // start
  if (code === targetArea) return '#ff9800'; // target
  if (currentArea && code === currentArea && code !== startArea) return '#089a26'; // latest step
  if (visitedSet.has(code)) return '#dcdcec'; // earlier visited
  return BASE_FILL; // default
};
	
/* function VictoryModal({ open, stats, onClose, onPlayAgain, onShare }) {
  const justOpenedRef = React.useRef(true);
  React.useEffect(() => {
    if (!open) return;
    justOpenedRef.current = true;
    const t = setTimeout(() => (justOpenedRef.current = false), 250);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
<div
  className="fixed inset-0 z-[2147483647]"
  style={{
    position: 'fixed',
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '10vh 16px 16px', // <-- side padding prevents edge-to-edge
    background: 'rgba(0,0,0,0.28)', // lighter so blur is visible
    backdropFilter: 'blur(10px)',    // <-- the blur
    WebkitBackdropFilter: 'blur(10px)',
  }}
  role="dialog"
  aria-modal="true"
  onClick={(e) => {
    if (!justOpenedRef.current && e.target === e.currentTarget) onClose();
  }}
>
  <div
    className="max-w-[520px] w-full p-5 rounded-2xl shadow-xl bg-white max-h-[80vh] overflow-y-auto"
    onClick={(e) => e.stopPropagation()}
  >
        <h2 className="text-xl font-semibold mb-2">You did it! 🎉</h2>
        <p className="opacity-80 mb-4">
          From <b>{stats.start}</b> to <b>{stats.target}</b><br/>
          Guesses: <b>{stats.guesses}</b>
          {typeof stats.optimal === 'number' && <> · Optimal: <b>{stats.optimal}</b></>}
          {stats.time && <> · Time: <b>{stats.time}</b></>}
          {typeof stats.streak === 'number' && <> · Streak: <b>{stats.streak}</b></>}
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onShare} className="px-3 py-2 rounded-lg border">Share</button>
          <button onClick={onPlayAgain} className="px-3 py-2 rounded-lg bg-black text-white">Play again</button>
          <button onClick={onClose} className="px-3 py-2 rounded-lg border">Close</button>
        </div>
      </div>
    </div>
  );
} */

  
  // refs (top of component)
const contentRef = useRef(null);
const didAutoFitRef = useRef(false);
const hasFitRef = useRef(false);
const { reset, zoomIn, zoomOut} = useSvgPan(svgRef, gRef, {
  enabled: gameState === 'playing',
  min: MIN_SCALE,
  max: MAX_SCALE,
  onChange: ({ scale }) => setScaleForLabels(scale), // so labels resize live
});
const fitToContent = useCallback((padding = 0.92) => {
  const g = contentRef.current;
  if (!g) return;

  // getBBox works in the SVG’s viewBox coordinate space
  const bbox = g.getBBox();
  if (!bbox || bbox.width === 0 || bbox.height === 0) return;

  const vw = VIEWBOX.width;
  const vh = VIEWBOX.height;

  // scale to fit with padding
  const fitScale = padding * Math.min(vw / bbox.width, vh / bbox.height);

  // center the bbox inside the viewBox after scaling
  const viewCx = VIEWBOX.x + vw / 2;
  const viewCy = VIEWBOX.y + vh / 2;
  const contentCx = bbox.x + bbox.width / 2;
  const contentCy = bbox.y + bbox.height / 2;
  

  const newTx = viewCx - fitScale * contentCx;
  const newTy = viewCy - fitScale * contentCy;

reset({ scale: fitScale, x: newTx, y: newTy });

  hasFitRef.current = true;
},[reset]);


const [showAbout, setShowAbout] = useState(false);

const [scaleForLabels, setScaleForLabels] = useState(1);

const finishGame = React.useCallback(() => {
	console.log('[finishGame] firing');
  setGameWon(true);

  const end = performance.now();
  const ms = gameStartRef.current ? Math.max(0, end - gameStartRef.current) : 0;
  setElapsedMs(ms);

  setStreak(prev => {
    const next = prev + 1;
    localStorage.setItem('pp_streak', String(next));
    return next;
  });

  setVictoryOpen(true);
}, []);

useEffect(() => {
  console.log('[victoryOpen]', victoryOpen);
}, [victoryOpen]);

useEffect(() => {
  if (gameState !== 'menu' && !hasFitRef.current) {
    requestAnimationFrame(() => fitToContent());
  }
}, [gameState, fitToContent]);

 useEffect(() => {
  // Lock the page scroll while this screen is shown
  const prevHtml = document.documentElement.style.overflow;
  const prevBody = document.body.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  return () => {
    document.documentElement.style.overflow = prevHtml;
    document.body.style.overflow = prevBody;
  };
}, []);

// measure controls height -> CSS var (you already have this)
useEffect(() => {
  if (!controlsRef.current) return;
  const setVar = () =>
    document.documentElement.style.setProperty('--controls-h', `${controlsRef.current.offsetHeight}px`);
  const ro = new ResizeObserver(setVar);
  ro.observe(controlsRef.current);
  setVar();
  return () => ro.disconnect();
}, []);

useEffect(() => {
  const ok = CSS.supports('backdrop-filter: blur(1px)') || CSS.supports('-webkit-backdrop-filter: blur(1px)');
  console.log('[backdrop-filter supported?]', ok);
  document.documentElement.classList.toggle('no-backdrop', !ok);
}, []);

  useEffect(() => {
    console.log('Loaded postcode areas:', Object.keys(postcodeAreas).length);
    console.log('Sample path:', postcodeAreas['AB']?.path?.slice(0, 100));
  }, []);

useEffect(() => {
  if (gameState !== 'menu' && !hasFitRef.current) {
    // wait a tick so the DOM has laid out the SVG
    requestAnimationFrame(() => fitToContent());
  }
}, [gameState, fitToContent]);

// Auto-fit the map once on mount (after paths render)
useEffect(() => {
  if (!svgRef.current || !contentRef.current || didAutoFitRef.current) return;
  // Wait a frame so the DOM has laid out
  const id = requestAnimationFrame(() => {
    try {
      const bbox = contentRef.current.getBBox(); // map's natural bounds
      if (!bbox || bbox.width === 0 || bbox.height === 0) return;

      // Fit the bbox inside the VIEWBOX with a little padding
      const PAD = 0.05; // 5% padding
      const availW = VIEWBOX.width * (1 - PAD * 2);
      const availH = VIEWBOX.height * (1 - PAD * 2);
      const s = Math.min(availW / bbox.width, availH / bbox.height);

      // Center after scaling: translate so bbox sits centered in viewBox
      const tx0 = (VIEWBOX.width  - s * bbox.width)  / 2 - s * bbox.x;
      const ty0 = (VIEWBOX.height - s * bbox.height) / 2 - s * bbox.y;

	reset({ scale: s, x: tx0, y: ty0 });
      didAutoFitRef.current = true;
    } catch {}
  });

  return () => cancelAnimationFrame(id);
}, ); 

const renderControls = () => (
  <div ref={controlsRef} className="fixed top-0 left-0 right-0 z-20">
    <div className="max-w-6xl mx-auto px-4 pt-3">
      <div className="glass p-3">
        {/* Top row: buttons + status */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <button onClick={startNewGame} className="btn btn-primary">New Game</button>

            <button
              onClick={() => {
                setCurrentPath([startArea]);
                setGuesses([]);
                setGameWon(false);
                setSuggestion('');
                setOptimalPath(findShortestPath(startArea, targetArea));
              }}
              className="btn btn-warn"
            >
              Restart
            </button>

            <button onClick={() => setGameState('menu')} className="btn btn-neutral">Menu</button>
          </div>

          <h2 className="text-lg font-semibold mr-2 text-slate-900">
            Travel from <span className="text-indigo-700">{startArea || '—'}</span> to{' '}
            <span className="text-indigo-700">{targetArea || '—'}</span>
          </h2>
          {!gameWon && currentPath.length > 0 && (
            <div className="text-sm text-slate-600">
              Current: <strong className="text-slate-900">{currentPath[currentPath.length - 1]}</strong>
            </div>
          )}

          {gameWon && (
            <div className="text-sm text-emerald-800 bg-emerald-100 border border-emerald-300 rounded px-2 py-1 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Completed in {currentPath.length - 1} (optimal {optimalPath.length - 1})
              <button
                onClick={() => setShowOptimal(v => !v)}
                className="btn btn-purple px-2 py-1"
              >
                {showOptimal ? 'Hide optimal path' : 'Show optimal path'}
              </button>
            </div>
          )}

          <div className="flex-1" />
        </div>

        {/* Input row (only while playing) */}
{!gameWon && (
  <div className="mt-3 flex flex-wrap items-center gap-2">
    <input
      ref={inputRef}
      type="text"
      className="p-2 border rounded flex-1 min-w-[220px] border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
      placeholder="Try any postcode (e.g. M, B, AB)"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleInputSubmit(e.currentTarget);
        }
      }}
    />
    <button 
      className="btn btn-hollowgreen" 
      onClick={() => handleInputSubmit(inputRef.current)}
    >
      Enter
    </button>

    {guesses.length > 0 && (
      <div className="flex flex-wrap gap-1 text-xs ml-auto">
        Last entry: {guesses.slice(-1).map((g, i) => (
          <span
            key={i}
            className={`px-2 py-1 rounded ${
              g.valid && !g.alreadyVisited
                ? 'bg-emerald-100 text-emerald-800'
                : g.alreadyVisited
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {g.area}
            {g.alreadyVisited ? ' (visited)' : ''}
            {!g.valid ? ' (invalid)' : ''}
          </span>
        ))}
      </div>
    )}
  </div>
)}

{/* Journey */}
<div className="mt-3">
  <div className="text-sm font-semibold mb-1"></div>
  <div className="badges">
    Journey: {currentPath.map((a, i) => (
      <span
        key={i}
        className={`badge ${
          a === targetArea
            ? 'badge-green'
            : i === currentPath.length - 1
            ? 'badge-blue'
            : 'badge-gray'
        }`}
      >
        <span style={{ marginRight: 6 }}>{i}:</span>{a}
      </span>
    ))}
  </div>
</div>
        {/* Optimal route badges */}
{gameWon && showOptimal && (
  <div className="mt-3">
    <div className="text-sm font-semibold mb-1">Optimal route:</div>
    <div className="badges">
      {optimalPath.map((code, i) => (
        <span key={i} className="badge badge-green">
          <span style={{ marginRight: 6 }}>{i}:</span>{code}
        </span>
      ))}
    </div>
  </div>
)}

        {/* Toggle buttons*/}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setShowOutlines(v => !v)} className="btn btn-success" title="Toggle outlines">
            {showOutlines ? <Eye className="w-4 h-4 inline" /> : <EyeOff className="w-4 h-4 inline" />} Outlines
          </button>
          <button onClick={() => setShowLabels(v => !v)} className="btn btn-success" title="Toggle labels">
            {showLabels ? <Eye className="w-4 h-4 inline" /> : <EyeOff className="w-4 h-4 inline" />} Labels
          </button>

		{/* Zoom buttons*/}
		
          <div className="ml-auto flex gap-2">
            <button onClick={() => zoomOut(ZOOM_STEP)} className="btn btn-neutral" title="Zoom out">Zoom Out</button>
            <button onClick={() => zoomIn(ZOOM_STEP)}  className="btn btn-neutral" title="Zoom in">Zoom In</button>
            <button onClick={resetView} className="btn btn-neutral" title="Reset view">Reset View</button>
			            <button className="btn btn-success" onClick={getHint}>Hint</button>

            {suggestion}
          </div>
        </div>
      </div>
    </div>
  </div>
);


  const generatePuzzle = () => {
    const areas = Object.keys(postcodeAreas);
    const start = areas[Math.floor(Math.random() * areas.length)];
    let target;
    do {
      target = areas[Math.floor(Math.random() * areas.length)];
    } while (target === start);
    return { start, target };
  };

  const findShortestPath = (start, end) => {
    if (start === end) return [start];
    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      for (const neighbor of postcodeAreas[current]?.neighbors || []) {
        if (neighbor === end) return [...path, neighbor];
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return [];
  };

  const startNewGame = () => {
    const { start, target } = generatePuzzle();
    setStartArea(start);
    setTargetArea(target);
    setCurrentPath([start]);
    setGuesses([]);
    setGameWon(false);
    setSuggestion('');
    setOptimalPath(findShortestPath(start, target));
    setGameState('playing');

	
	gameStartRef.current = performance.now();
setElapsedMs(0);
setVictoryOpen(false);
  };

  const makeGuess = (area) => {
  if (gameWon) return;

  const currentLocation = currentPath[currentPath.length - 1];
  const isValidMove = postcodeAreas[currentLocation]?.neighbors.includes(area);
  const alreadyVisited = currentPath.includes(area);
	  console.log('[guess]', { area, targetArea, isValidMove, alreadyVisited });
  // record attempt
  setGuesses((prev) => [...prev, { area, valid: isValidMove, alreadyVisited }]);

  // invalid/visited -> flash + bail
  if (!isValidMove || alreadyVisited) {
    setFlashAreas((prev) => [...prev, area]);
    setTimeout(() => {
      setFlashAreas((prev) => prev.filter((a) => a !== area));
    }, 400);
    setSuggestion('');
    return;
  }

  // valid new step
  const newPath = [...currentPath, area];
  setCurrentPath(newPath);

  // win?
  if (area === targetArea) {
    finishGame();
  } else {
    setSuggestion('');
  }
};

  const getAreaStroke = (code) => {
    if (code === startArea || code === targetArea) return '#000';
    if (currentPath.includes(code)) return '#ff9800';
    return showOutlines ? '#d1d5db' : 'none';
  };

  const getHint = () => {
    const currentLocation = currentPath[currentPath.length - 1];
    const validNeighbors =
      postcodeAreas[currentLocation]?.neighbors.filter((n) => !currentPath.includes(n)) || [];
    if (validNeighbors.length > 0) {
      const n = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
      setSuggestion(`Try ${n}`);
    }
  };



  // ----- Zoom/Pan helpers -----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// about 12px when zoomed out, grows to ~46px when zoomed in
const labelPxForScale = (s) => clamp(30 + 200 * s, 30, 300);
const svgFontSizeForScale = (s) => labelPxForScale(s) / s;


const resetView = useCallback(() => {
  hasFitRef.current = false;
  didAutoFitRef.current = false;
  requestAnimationFrame(() => fitToContent()); // same framing as initial
}, [fitToContent]);

const renderOptimalOverlay = () => {
  const pts = optimalPath
    .map(code => postcodeAreas[code]?.center)
    .filter(Boolean);

  if (pts.length < 2) return null;

  const pointsAttr = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <g pointerEvents="none">
      {/* thick underlay for contrast */}
      <polyline
        points={pointsAttr}
        fill="none"
        stroke="#000"
        strokeOpacity="0.5"
        strokeWidth={28}
        vectorEffect="non-scaling-stroke"
      />
      {/* main colored line */}
      <polyline
        points={pointsAttr}
        fill="none"
        stroke="#8b5cf6"
        strokeWidth={16}
        vectorEffect="non-scaling-stroke"
      />
      {/* waypoints + step numbers */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={120} fill="#8b5cf6" fillOpacity="0.9" />
          <text
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="160"
            fontWeight="700"
            fill="white"
          >
            {i}
          </text>
        </g>
      ))}
    </g>
  );
};

const renderMap = () => {
  const showUnderlay = !masterMode; // Easy/Normal/Hard only

  return (
    <div className="w-full h-full glass">
      <svg
        ref={svgRef}
        viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ touchAction: 'none' }}
        shapeRendering={(gameState === 'playing') ? 'crispEdges' : 'geometricPrecision'}
      >
        <rect
          x={VIEWBOX.x} y={VIEWBOX.y}
          width={VIEWBOX.width} height={VIEWBOX.height}
          fill="none" stroke="black" strokeWidth="50"
          pointerEvents="none"
        />

        {/* pan/zoom group */}
        <g ref={gRef}>
          {/* MAP CONTENT */}
          <g ref={contentRef}>
            {/* ------- BLEED LAYER (behind everything) ------- */}
            {showUnderlay && (
              <g pointerEvents="none" style={{ paintOrder: 'stroke fill' }}>
                {Object.entries(postcodeAreas).map(([code, area]) => (
                  <path
                    key={`bleed-${code}`}
                    d={area.path}
                    fill={BASE_FILL}
                    stroke={BASE_FILL}
                    strokeWidth={SEAM_PX}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fillRule="evenodd"
                  />
                ))}
              </g>
            )}

            {/* ------- VISIBLE AREAS ------- */}
            {Object.entries(postcodeAreas).map(([code, area]) => {
              const revealed = isRevealed(code);
              const color = revealed ? getAreaColor(code) : 'none';
              return (
                <g key={code}>
                  <path
                    d={area.path}
                    data-code={code}                      // (debug-friendly)
                    style={{ fill: color }}               // <- inline to beat any CSS
                    stroke={revealed ? getAreaStroke(code) : 'none'}
                    strokeWidth={revealed && showOutlines ? 2 : 0}
                    vectorEffect="non-scaling-stroke"
                    fillRule="evenodd"
                    className={`transition-opacity ${revealed ? 'hover:opacity-80 cursor-pointer' : ''}`}
                    tabIndex={revealed ? 0 : -1}
                    aria-label={`Area ${code}`}
                    onClick={() => {
                      if (!revealed) return;
                      if (Date.now() < suppressClickUntilRef.current || panStartedRef.current) return;
                      if (!gameWon) makeGuess(code);
                    }}
                    onKeyDown={(e) => {
                      if (!revealed) return;
                      if (!gameWon && (e.key === 'Enter' || e.key === ' ')) makeGuess(code);
                    }}
                  />

                  {/* labels */}
                  {revealed && showLabels && (
                    <g pointerEvents="none">
                      <text
                        x={area.center?.x}
                        y={area.center?.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={svgFontSizeForScale(scaleForLabels)}
                        fontWeight="normal"
                        className="select-none"
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                        fill={
                          visitedSet.has(code) || code === startArea || code === targetArea
                            ? 'white' : 'black'
                        }
                        aria-hidden="true"
                      >
                        {code}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* ------- TOP OVERLAY: current area (guaranteed on top) ------- */}
            {currentArea && postcodeAreas[currentArea] && (
              <path
                key="current-overlay"
                d={postcodeAreas[currentArea].path}
                fill="#089a26"
                stroke={getAreaStroke(currentArea)}
                strokeWidth={showOutlines ? 2 : 0}
                vectorEffect="non-scaling-stroke"
                fillRule="evenodd"
                pointerEvents="none"
              />
            )}
          </g>

          {/* optimal route overlay */}
          {gameWon && showOptimal && renderOptimalOverlay()}

          {/* flash overlays */}
          {flashAreas.map((code) => {
            const area = postcodeAreas[code];
            if (!area) return null;
            return (
              <path
                key={`flash-${code}`}
                d={area.path}
                className="flash-red-overlay"
                fill="#ff2d2d"
                fillOpacity="0.45"
                stroke="none"
                pointerEvents="none"
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};


const renderGameBoard = () => (
  <>
    {renderControls()}
    <div
      className="fixed left-0 right-0 bottom-0 overflow-hidden z-10"
style={{
  top: 'var(--controls-h, 0px)',
  backgroundColor: 'rgba(255, 255, 255, 0.12)', // very light
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}}
    >
      <div className="max-w-6xl mx-auto h-full p-4">
        <div className="h-full">{renderMap()}</div>
      </div>
    </div>

  </>
);

const renderMenu = () => (
  <div className="max-w-2xl mx-auto p-8 glass text-center mt-8">
    <MapPin className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
    <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Postcode Pursuit</h1>
    <p className="text-slate-600 mb-6">
      Navigate between UK postcode areas by following their geographical connections!
    </p>

    <div className="grid gap-3">
      <button
        onClick={() => startWithDifficulty('easy')}
        className="btn btn-hollowgreen w-full"
      >
        Easy
      </button>
      <button
        onClick={() => startWithDifficulty('normal')}
        className="btn btn-success w-full"
      >
        Normal
      </button>
      <button
        onClick={() => startWithDifficulty('hard')}
        className="btn btn-warn w-full"
      >
        Hard
      </button>
      <button
        onClick={() => startWithDifficulty('master')}
        className="btn btn-purple w-full"
      >
        Master
      </button>	  
	  <button className="btn btn-neutral" onClick={() => setShowAbout(true)}>
  About
</button>
{showAbout && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white max-w-lg w-full p-6 rounded-lg shadow-lg overflow-y-auto max-h-[80vh]">
      <h2 className="text-xl font-bold mb-4">About Postcode Pursuit</h2>
      <p className="mb-2">
        Postcode Pursuit is heavily inspired by the fantastic game <a href="https://travle.earth" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Travle</a>.<br/>
        The goal is to travel from your start postcode area to the target area, moving only through directly connected postcode areas.
      </p>
	  <p className ="mb-2">
	  Easy mode will show you postcode outlines and labels.<br/>
	  Hard mode shows outlines only (though there's a toggle for labels).<br/>
	  For more of a challenge, Master mode shows only the start and end postcodes.
	  </p>
	  
      <p className="mb-2">
        Some connections may seem unusual — for example:
        <ul className="list-disc list-inside pl-2">
          <li>BT connects to IM and DG due to ferry routes</li>
          <li>DA and RM are connected across the Dartford Crossing</li>
        </ul>
      </p>
      <p className="mb-4">
        More instructions and screenshots will be added soon!
      </p>
      <button
        className="btn btn-primary"
        onClick={() => setShowAbout(false)}
      >
        Close
      </button>
    </div>
  </div>
)}

    </div>
  </div>
);

return (
  <>
    <div className="h-screen w-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {gameState === 'menu' ? renderMenu() : renderGameBoard()}
    </div>
{victoryOpen && createPortal(
  <div style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 2147483647,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: '10vh', // offset from top
    padding: '10vh 16px 16px' // top offset + side padding

  }}>
    <div className="glass p-5 rounded-2xl shadow-xl text-center" style={{ 
      maxWidth: 520, 
      width: '92vw',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <h2 className="text-xl font-semibold mb-2">Victory! 🎉</h2>
      <p className="mb-4">
        From <b>{startArea}</b> to <b>{targetArea}</b><br />
        Guesses: <b>{Math.max(0, currentPath.length - 1)}</b>
        {optimalPath.length > 0 && <> · Optimal: <b>{Math.max(0, optimalPath.length - 1)}</b></>}
        {elapsedMs > 0 && <> · Time: <b>{formatTime(elapsedMs)}</b></>}
        {streak > 0 && <> · Streak: <b>{streak}</b></>}
      </p>
      <div className="flex gap-2 justify-center">
        <button onClick={shareResult} className="btn btn-purple glass">Share</button>
        <button onClick={startNewGame} className="btn btn-warn glass">Play again</button>
        <button onClick={() => setVictoryOpen(false)} className="btn btn-primary glass">Close</button>
      </div>
    </div>
  </div>,
  document.body
)}
  </>
);
};

export default PostcodePursuit;