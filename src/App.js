import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Target, Trophy, Eye, EyeOff } from 'lucide-react';
import { postcodeAreas } from './postcodeAreas';

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
  const [attempts, setAttempts] = useState(0);
  const [optimalPath, setOptimalPath] = useState([]);
  const [suggestion, setSuggestion] = useState('');
  const [showOutlines, setShowOutlines] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const suppressClickUntilRef = useRef(0);
  const [flashAreas, setFlashAreas] = useState([]);
  const [showOptimal, setShowOptimal] = useState(false);

  // Pan/zoom state
  const svgRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panStartedRef = useRef(false);
  const DRAG_THRESHOLD_PX = 5;
  const controlsRef = useRef(null);
  // state
const [masterMode, setMasterMode] = useState(false);

// start with difficulty
const startWithDifficulty = (mode) => {
  if (mode === 'easy') {
    setShowOutlines(true);
    setShowLabels(true);
    setMasterMode(false);
  } else if (mode === 'hard') {
    setShowOutlines(true);
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
  
  
  // refs (top of component)
const contentRef = useRef(null);
const didAutoFitRef = useRef(false);
const hasFitRef = useRef(false);

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

  setScale(fitScale);
  setTx(newTx);
  setTy(newTy);

  hasFitRef.current = true;
}, []);
  const BadgeList = ({ items, getColor = () => 'gray' }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((code, i) => {
      const color = getColor(code, i);
      const palette =
        color === 'green'
          ? 'border-green-600 bg-green-50 text-green-800'
          : color === 'blue'
          ? 'border-blue-600 bg-blue-50 text-blue-800'
          : 'border-gray-300 bg-gray-50 text-gray-800';

      return (
        <span
          key={`${code}-${i}`}
          className={`inline-flex items-center rounded-md border px-3 py-1 ${palette}`}
        >
          <span className="font-semibold mr-1">{i}:</span>
          {code}
        </span>
      );
    })}
  </div>
);


const [showAbout, setShowAbout] = useState(false);


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

      setScale(s);
      setTx(tx0);
      setTy(ty0);
      didAutoFitRef.current = true;
    } catch {}
  });

  return () => cancelAnimationFrame(id);
}, [postcodeAreas]); // runs after paths are in the DOM

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
                setAttempts(0);
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
              type="text"
              className="p-2 border rounded flex-1 min-w-[220px] border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Try any postcode (e.g. M, B, AB)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.toUpperCase().trim();
                  if (postcodeAreas[val]) {
                    makeGuess(val);
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
            <button className="btn btn-warn" onClick={getHint}>Hint</button>

            {suggestion && <div className="text-sm text-indigo-700">{suggestion}</div>}

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
  <div className="text-sm font-semibold mb-1">Journey:</div>
  <div className="badges">
    {currentPath.map((a, i) => (
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

        {/* Toggles + zoom */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setShowOutlines(v => !v)} className="btn btn-success" title="Toggle outlines">
            {showOutlines ? <Eye className="w-4 h-4 inline" /> : <EyeOff className="w-4 h-4 inline" />} Outlines
          </button>
          <button onClick={() => setShowLabels(v => !v)} className="btn btn-success" title="Toggle labels">
            {showLabels ? <Eye className="w-4 h-4 inline" /> : <EyeOff className="w-4 h-4 inline" />} Labels
          </button>

          <div className="ml-auto flex gap-2">
            <button onClick={() => zoomByButtons(1 / ZOOM_STEP)} className="btn btn-neutral" title="Zoom out">−</button>
            <button onClick={() => zoomByButtons(ZOOM_STEP)} className="btn btn-neutral" title="Zoom in">+</button>
            <button onClick={resetView} className="btn btn-neutral" title="Reset view">Reset</button>
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
    setAttempts(0);
    setSuggestion('');
    setOptimalPath(findShortestPath(start, target));
    setGameState('playing');

    // reset view
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const makeGuess = (area) => {
    if (gameWon) return;

    const currentLocation = currentPath[currentPath.length - 1];
    const isValidMove = postcodeAreas[currentLocation]?.neighbors.includes(area);
    const alreadyVisited = currentPath.includes(area);

    setGuesses((prev) => [...prev, { area, valid: isValidMove, alreadyVisited }]);
    setAttempts((a) => a + 1);

    if (isValidMove && !alreadyVisited) {
      const newPath = [...currentPath, area];
      setCurrentPath(newPath);
      if (area === targetArea) setGameWon(true);
    }
	if (!isValidMove || alreadyVisited) {
  setFlashAreas((prev) => [...prev, area]);
  setTimeout(() => {
    setFlashAreas((prev) => prev.filter((a) => a !== area));
  }, 400); // match animation duration
}
    setSuggestion('');
  };

const getAreaColor = (code) => {
  if (code === startArea) return '#00ff59'; // start
  if (code === targetArea) return '#ff9800'; // target

  // Find the *latest* guess for this code
  const guess = [...guesses].reverse().find((g) => g.area === code);

  if (guess) {
    if (guess.valid && !guess.alreadyVisited) return '#089a26'; // green for valid new move
    return '#f3f4f6'; // default grey for invalid/visited
  }

  if (currentPath.includes(code)) return '#3b82f6'; // blue visited
  return '#f3f4f6'; // default grey
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

  const wheelZoom = useCallback(
    (e) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      // Mouse position in viewBox coordinates
      const px = ((e.clientX - rect.left) / rect.width) * VIEWBOX.width;
      const py = ((e.clientY - rect.top) / rect.height) * VIEWBOX.height;

      // Zoom factor: deltaY>0 -> zoom out
      const zoomFactor = Math.exp(-e.deltaY * 0.0015);
      const newScale = clamp(scale * zoomFactor, MIN_SCALE, MAX_SCALE);
      const k = newScale / scale;

      // Keep the point under cursor stationary: adjust translate
      const newTx = px - k * (px - tx);
      const newTy = py - k * (py - ty);

      setScale(newScale);
      setTx(newTx);
      setTy(newTy);
    },
    [scale, tx, ty]
  );

  const startPan = useCallback((e) => {
    if (!(e.buttons & 1)) return; // primary button only
    isPanningRef.current = false; // not panning yet; wait for drag threshold
    panStartedRef.current = false;
    panStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const movePan = useCallback((e) => {
    if (!(e.buttons & 1)) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dxPx = e.clientX - panStartRef.current.x;
    const dyPx = e.clientY - panStartRef.current.y;

    if (!panStartedRef.current) {
      if (Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
      panStartedRef.current = true;
      isPanningRef.current = true;
    }

    const dx = (dxPx / rect.width) * VIEWBOX.width;
    const dy = (dyPx / rect.height) * VIEWBOX.height;

    setTx((prev) => prev + dx);
    setTy((prev) => prev + dy);
    panStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

const endPan = useCallback(() => {
  if (panStartedRef.current) {
    // Ignore clicks for the next 150ms
    suppressClickUntilRef.current = Date.now() + 150;
  }
  isPanningRef.current = false;
  panStartedRef.current = false;
}, []);

  const zoomByButtons = (factor) => {
    const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    const k = newScale / scale;

    // Zoom around center of the viewBox
    const cx = VIEWBOX.width / 2;
    const cy = VIEWBOX.height / 2;
    const newTx = cx - k * (cx - tx);
    const newTy = cy - k * (cy - ty);

    setScale(newScale);
    setTx(newTx);
    setTy(newTy);
  };

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

const renderMap = () => (
  <div className="w-full h-full glass">
    <svg
      viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ touchAction: 'none' }}
      onWheel={wheelZoom}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      onPointerCancel={endPan}
      ref={svgRef}
    >
      <rect
        x={VIEWBOX.x}
        y={VIEWBOX.y}
        width={VIEWBOX.width}
        height={VIEWBOX.height}
        fill="none"
        stroke="black"
        strokeWidth="50"
        pointerEvents="none"
      />

      {/* pan/zoom group */}
      <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
        {/* MAP CONTENT */}
        <g ref={contentRef}>
          {Object.entries(postcodeAreas).map(([code, area]) => (
            <g key={code}>
              <title>{code}</title>
              <path
                d={area.path}
                fill={isRevealed(code) ? getAreaColor(code) : 'none'}
                stroke={isRevealed(code) ? getAreaStroke(code) : 'none'}
                strokeWidth={isRevealed(code) && showOutlines ? 2 : 0}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                className={`transition-opacity ${isRevealed(code) ? 'hover:opacity-80 cursor-pointer' : ''}`}
                tabIndex={isRevealed(code) ? 0 : -1}
                aria-label={`Area ${code}`}
                onClick={() => {
                  if (!isRevealed(code)) return;
                  if (Date.now() < suppressClickUntilRef.current || panStartedRef.current) return;
                  if (!gameWon) makeGuess(code);
                }}
                onKeyDown={(e) => {
                  if (!isRevealed(code)) return;
                  if (!gameWon && (e.key === 'Enter' || e.key === ' ')) makeGuess(code);
                }}
              />

              {/* labels (non-interactive) */}
              {isRevealed(code) && showLabels && (
                <g pointerEvents="none">
                  <text
                    x={area.center?.x}
                    y={area.center?.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={svgFontSizeForScale(scale)}
                    fontWeight="bold"
                    className="select-none"
                    style={{ cursor: 'default', userSelect: 'none', WebkitUserSelect: 'none' }}
                    fill={currentPath.includes(code) || code === startArea || code === targetArea ? 'white' : 'black'}
                    aria-hidden="true"
                  >
                    {code}
                  </text>
                </g>
              )}
            </g>
          ))}
        </g>

        {/* optimal route overlay (pans/zooms with map) */}
        {gameWon && showOptimal && renderOptimalOverlay()}

        {/* flash overlays (also pan/zoom) */}
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


const renderGameBoard = () => (
  <>
    {renderControls()}
    <div
      className="fixed left-0 right-0 bottom-0 overflow-hidden z-10"
      style={{
        top: 'var(--controls-h, 0px)',
        backgroundColor: 'rgba(55, 55, 255, 0.7)', // white @ 70% opacity
        backdropFilter: 'blur(4px)', // optional glassy effect
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
        className="btn btn-success w-full"
      >
        Easy
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
  <div className="h-screen w-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
    {gameState === 'menu' ? renderMenu() : renderGameBoard()}
  </div>
);
};

export default PostcodePursuit;
