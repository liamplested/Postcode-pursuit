import React, { useState, useRef, useEffect, useCallback, useId} from 'react';
import { MapPin, Trophy, Flag, Menu, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { postcodeAreas, ferryLinks, bridgeLinks } from './postcodeAreas';
import useSvgPan from './hooks/useSvgPan';
import OnboardingTutorial from './components/OnboardingTutorial';
import * as Daily from './dailyManager';

// ---- Module-level constants -------------------------------------------------
// Define the World
const WORLD = { x: 0, y: 0, width: 15000, height: 17500 }; // <- your existing values
const MIN_SCALE = 0.1;
const MAX_SCALE = 30;
const ZOOM_STEP = 1.25; // button zoom factor

// Daily helpers
const DAILY_STREAK_KEY = 'pp_daily_streak_v1'; // {count:number, lastWinDate:'YYYY-MM-DD'}




function parseUTC(dateStr){ return new Date(dateStr + 'T00:00:00Z'); }
function daysBetweenUTC(a,b){
  const ms = parseUTC(b).getTime() - parseUTC(a).getTime();
  return Math.round(ms / 86400000);
}
function loadDailyStreak(){
  try { return JSON.parse(localStorage.getItem(DAILY_STREAK_KEY) || 'null'); } catch { return null; }
}
function saveDailyStreak(count, lastWinDate){
  localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify({ count, lastWinDate }));
}
//function todayUTC(){ return new Date().toISOString().slice(0,10); }


export default function PostcodePursuit() {
// ------------------- STATE & REFS (unchanged from your file) --------------
const [gameState, setGameState] = useState('menu');
const [difficulty, setDifficulty] = useState('normal');
const [startArea, setStartArea] = useState('');
const [targetArea, setTargetArea] = useState('');
const [currentPath, setCurrentPath] = useState([]);
const [guesses, setGuesses] = useState([]);
const [gameWon, setGameWon] = useState(false);
const [optimalPath, setOptimalPath] = useState([]);

const [showHints, setShowHints] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

const [showOutlines, setShowOutlines] = useState(true);
const [showLabels, setShowLabels] = useState(true);
const suppressClickUntilRef = useRef(0);
const [flashAreas, setFlashAreas] = useState([]);
const [showOptimal, setShowOptimal] = useState(false);
  const [showAbout, setShowAbout] = useState(false);  
const [dailyMode, setDailyMode] = useState(false);
const [dailyDate, setDailyDate] = useState(null);             // 'YYYY-MM-DD' (UTC)

  const [victoryOpen, setVictoryOpen] = useState(false);

const ONBOARDING_KEY = 'pp:onboardingComplete:v1';

const isActiveRound = () => gameState === 'playing' && !gameWon;

const [showTutorial, setShowTutorial] = useState(false);
const [consentResolved, setConsentResolved] = useState(
  () => !!localStorage.getItem('pp_consents')
);

const canClickAreas = difficulty === 'easy';

//const mapHostRef = useRef(null);

// Geometric helpers (centroids etc)
const roundIdRef = useRef(null);
const landClipId = useId();
const centroidsRef = useRef({});
 const getCenter = useCallback(
   (code) => postcodeAreas[code]?.center || centroidsRef.current[code] || null,
   []
 );


// Pan/zoom state
const svgRef = useRef(null);
const gRef = useRef(null);
const contentRef = useRef(null);
const didAutoFitRef = useRef(false);
const hasFitRef = useRef(false);
const controlsRef = useRef(null);



//Toggle for Master Mode
const [masterMode, setMasterMode] = useState(false);


// -------- Daily Challenge setup --------

const [dailyDifficulty, setDailyDifficulty] = useState(null); // 'easy'|'normal'|'hard'|'master'

const MAX_DAILY_HINTS = 3;
const [hintsUsed, setHintsUsed] = useState(0);

function todayUTC() { return new Date().toISOString().slice(0,10); } // YYYY-MM-DD

const dailySessionKey = (d) => `pp_daily_session_v2_${d}`;

const saveDailySessionSnapshot = React.useCallback(() => {
  if (!dailyMode || !dailyDate || !dailyDifficulty) return;
  const elapsedSoFar =
    (elapsedMs || 0) + (gameStartRef.current ? Math.max(0, performance.now() - gameStartRef.current) : 0);

  const snapshot = {
    date: dailyDate,
    difficulty: dailyDifficulty,
    startArea, targetArea, currentPath, guesses, hintsUsed,
    optimalPath, elapsedMs: Math.floor(elapsedSoFar),
    gameWon, showOptimal, victoryOpen,
  };
  localStorage.setItem(dailySessionKey(dailyDifficulty), JSON.stringify(snapshot));
}, [
  dailyMode, dailyDate, dailyDifficulty,
  startArea, targetArea, currentPath, guesses, hintsUsed,
  optimalPath, elapsedMs, gameWon, showOptimal, victoryOpen
]);

const [burgerOpen, setBurgerOpen] = useState(false);
const burgerButtonRef = useRef(null);  // anchor for positioning
const [burgerPos, setBurgerPos] = useState({ top: 0, left: 0, width: 224 }); // menu width ~224px

// close on outside click / Escape
useEffect(() => {
  const onDown = (e) => {
    if (!burgerOpen) return;
    // If click is outside the menu and outside the button, close it.
    const btn = burgerButtonRef.current;
    const menu = document.getElementById('pp-burger-menu');
    if (!btn) return setBurgerOpen(false);
    if (btn.contains(e.target)) return;         // click on button -> ignore
    if (menu && menu.contains(e.target)) return; // click inside menu -> ignore
    setBurgerOpen(false);
  };
  const onKey = (e) => { if (e.key === 'Escape') setBurgerOpen(false); };
  document.addEventListener('mousedown', onDown);
  document.addEventListener('keydown', onKey);
  return () => {
    document.removeEventListener('mousedown', onDown);
    document.removeEventListener('keydown', onKey);
  };
}, [burgerOpen]);

useEffect(() => {
  if (!burgerOpen) return;
  // wait a tick for portal render
  const id = requestAnimationFrame(() => {
    const first = document.querySelector('#pp-burger-menu [role="menuitem"]');
    first?.focus?.();
  });
  return () => cancelAnimationFrame(id);
}, [burgerOpen]);

// recompute fixed coordinates when opening / on resize / on scroll
const positionBurgerMenu = useCallback(() => {
  const btn = burgerButtonRef.current;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const gap = 8; // px spacing below the button
  const width = 224; // keep in sync with style below
  const top = rect.bottom + gap;
  const left = Math.max(8, rect.right - width); // protect from going off-screen left
  setBurgerPos({ top, left, width });
}, []);

useEffect(() => {
  if (!burgerOpen) return;
  positionBurgerMenu();
  const onReflow = () => positionBurgerMenu();
  window.addEventListener('resize', onReflow);
  window.addEventListener('scroll', onReflow, true); // true = catch scrolls inside panels too
  return () => {
    window.removeEventListener('resize', onReflow);
    window.removeEventListener('scroll', onReflow, true);
  };
}, [burgerOpen, positionBurgerMenu]);

// close if overlays change
useEffect(() => { setBurgerOpen(false); }, [gameState, showAbout, showTutorial, victoryOpen]);

// --- Daily streak (UTC) ---


const [dailyStreak, setDailyStreak] = useState(() => {
  const s = loadDailyStreak();
  return s?.count || 0;
});

useEffect(() => {
  const s = loadDailyStreak();
  if (!s?.lastWinDate) return;

  const today = todayUTC();
  const gap = daysBetweenUTC(s.lastWinDate, today);

  if (gap > 1) {
    setDailyStreak(0);
    saveDailyStreak(0, s.lastWinDate);
  }
}, []); 


// Daily puzzle hash
function bfsAllDistances(start){
  const dist = new Map([[start,0]]), q=[start];
  while (q.length){ const u=q.shift(); const du=dist.get(u);
    for (const v of getNeighbors(u)) if (!dist.has(v)){ dist.set(v, du+1); q.push(v); }
  }
  return dist;
}


const resetDailyFlags = React.useCallback(() => {
  setDailyMode(false);
  setDailyDate(null);
  setDailyDifficulty(null);
  setHintsUsed(0);
  setShowHints(false);
}, []);


function toggleHints(){
  if (dailyMode) {
    // Opening the panel consumes a hint (closing doesn't refund)
    if (!showHints) {
      if (hintsUsed >= MAX_DAILY_HINTS) {
        alert('No hints left for today.');
        return;
      }
      setHintsUsed(h => h + 1);
    }
  }
  setShowHints(v => !v);
}
const [dailyChoice, setDailyChoice] = useState(null);   // 'easy'|'normal'|'hard'|'master'|null
const [freeChoice,  setFreeChoice]  = useState(null);

const DIFF_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard', master: 'Master' };
const DIFF_DESCRIPTIONS = {
  easy:   'Postcode area outlines and labels are shown. Revisit and undo both allowed.',
  normal: 'Postcode area outlines are shown. Labels hidden on unvisited areas. Revisiting and undo both allowed.',
  hard:   'No outlines or labels are shown. Revisiting is not allowed.',
  master: 'Only start, target and visited areas are shown. Revisit and undo both disabled.',
};

const undoLastMove = useCallback(() => {
  if (currentPath.length <= 1 || gameWon) return; // can't undo the start, or after win
  const newPath = currentPath.slice(0, -1);
  setCurrentPath(newPath);
  setFlashAreas(prev => prev.filter(a => a !== currentPath[currentPath.length - 1]));

  window.gtag?.('event', 'move_undone', {
    difficulty,
    start_postcode: startArea,
    target_postcode: targetArea,
    path_len_after: newPath.length - 1,
    round_id: roundIdRef.current || undefined,
  });
}, [currentPath, gameWon, difficulty, startArea, targetArea]);

useEffect(() => {
  if (masterMode) return; // 🚫 no hotkey in Master

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undoLastMove();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [undoLastMove, masterMode]);

function startOrResumeDaily(difficulty) {
  const today = Daily.todayUTC();
  const snap = Daily.loadSnapshot(difficulty);

  // Visual toggles
  if (difficulty === 'easy')   { setShowOutlines(true);  setShowLabels(true);  setMasterMode(false); }
  if (difficulty === 'normal') { setShowOutlines(true);  setShowLabels(false); setMasterMode(false); }
  if (difficulty === 'hard')   { setShowOutlines(false); setShowLabels(false); setMasterMode(false); }
  if (difficulty === 'master') { setShowOutlines(false); setShowLabels(false); setMasterMode(true);  }
  setDifficulty(difficulty);

  // Resume if today’s snapshot exists for this difficulty
  if (snap && snap.date === today) {
    setDailyMode(true);
    setDailyDate(snap.date);
    setDailyDifficulty(difficulty);

    setHintsUsed(snap.hintsUsed ?? 0);
    setStartArea(snap.startArea);
    setTargetArea(snap.targetArea);
    setCurrentPath(Array.isArray(snap.currentPath) && snap.currentPath.length ? snap.currentPath : [snap.startArea]);
    setGuesses(Array.isArray(snap.guesses) ? snap.guesses : []);
    setOptimalPath(Array.isArray(snap.optimalPath) ? snap.optimalPath
                    : Daily.findShortestPathDet(snap.startArea, snap.targetArea, getNeighbors));
    setShowOptimal(!!snap.showOptimal);
    setElapsedMs(snap.elapsedMs || 0);

    if (snap.gameWon) {
      setGameWon(true);
      setVictoryOpen(true);     // show Share immediately
      setGameState('gameWon');
      gameStartRef.current = null;
    } else {
      setGameWon(false);
      setVictoryOpen(!!snap.victoryOpen);
      setGameState('playing');
      gameStartRef.current = performance.now() - (snap.elapsedMs || 0);
      requestAnimationFrame(() => focusStartAndTarget(snap.startArea, snap.targetArea));
    }
    return;
  }

setDailyChoice(null);
setFreeChoice(null);

  // Fresh daily
  const { start, target, path } =
    Daily.generateTodayDaily(difficulty, postcodeAreas, getNeighbors, boundsByDifficulty);

  setDailyMode(true);
  setDailyDate(today);
  setDailyDifficulty(difficulty);
  setHintsUsed(0);
  setShowHints(false);

  abandonIfActive('daily_start');
  setStartArea(start);
  setTargetArea(target);
  setCurrentPath([start]);
  setGuesses([]);
  setGameWon(false);
  setOptimalPath(path);
  setGameState('playing');
  gameStartRef.current = performance.now();
  setElapsedMs(0);
  setVictoryOpen(false);
  setShowOptimal(false);

  requestAnimationFrame(() => focusStartAndTarget(start, target));
}


useEffect(() => {
  if (!dailyMode || !dailyDate || !dailyDifficulty) return;

  const elapsedSoFar =
    (elapsedMs || 0) +
    (gameStartRef.current ? Math.max(0, performance.now() - gameStartRef.current) : 0);

  Daily.saveSnapshot(dailyDifficulty, {
    date: dailyDate,
    difficulty: dailyDifficulty,
    startArea,
    targetArea,
    currentPath,
    guesses,
    hintsUsed,
    optimalPath,
    elapsedMs: Math.floor(elapsedSoFar),
    gameWon,
    showOptimal,
    victoryOpen,
  });
}, [
  dailyMode, dailyDate, dailyDifficulty,
  startArea, targetArea, currentPath, guesses,
  hintsUsed, optimalPath, elapsedMs, gameWon,
  showOptimal, victoryOpen
]);


// ------------------- HELPERS, EFFECTS, CALLBACKS --------------------------
// difficulty
  const startWithDifficulty = (mode) => {
    if (gameState === 'playing' && !gameWon) {
    fireReroll(mode === difficulty ? 'same_difficulty' : 'change_difficulty');
  }
  resetDailyFlags(); 

	setDifficulty(mode);
    if (mode === 'easy') {
      setShowOutlines(true); setShowLabels(true); setMasterMode(false);
    } else if (mode === 'normal') {
      setShowOutlines(true); setShowLabels(false); setMasterMode(false);
    } else if (mode === 'hard') {
      setShowOutlines(false); setShowLabels(false); setMasterMode(false);
    } else if (mode === 'master') {
      setShowOutlines(false); setShowLabels(false); setMasterMode(true);
    }
    startNewGame();
  };



  
const arcPathBridge = (a, b) => arcPath(a, b, 0.12);
const arcPathFerry  = (a, b) => arcPath(a, b, 0.18);

const isRevealed = useCallback(
  (code) =>
    masterMode
      ? code === startArea || code === targetArea || currentPath.includes(code)
      : true,
  [masterMode, startArea, targetArea, currentPath]
);



  //const [streak, setStreak] = useState(() => Number(localStorage.getItem('pp_streak') || 0));
  const gameStartRef = useRef(null);
  
  const isMapInteractive = gameState !== 'menu' && !victoryOpen;

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m ? `${m}m ${r}s` : `${r}s`;
  };

useEffect(() => {
  if (!dailyMode) return;
  saveDailySessionSnapshot();
}, [
  dailyMode, dailyDate, dailyDifficulty,
  startArea, targetArea, currentPath, guesses,
  hintsUsed, optimalPath, elapsedMs, gameWon,
  showOptimal, victoryOpen, saveDailySessionSnapshot
]);





  const { reset, zoomIn, zoomOut } = useSvgPan(svgRef, gRef, {
    enabled: isMapInteractive,
    min: MIN_SCALE,
    max: MAX_SCALE,
    onChange: ({ scale }) => setScaleForLabels(scale),
  });

 const fitToContent = useCallback((padding = 0.92) => {
   const g = contentRef.current;
   if (!g) return;
   const bbox = g.getBBox();
   if (!bbox || bbox.width === 0 || bbox.height === 0) return;

   const vw = WORLD.width;
   const vh = WORLD.height;
   const fitScale = padding * Math.min(vw / bbox.width, vh / bbox.height);
   const viewCx = WORLD.x + vw / 2;
   const viewCy = WORLD.y + vh / 2;
    const contentCx = bbox.x + bbox.width / 2;
    const contentCy = bbox.y + bbox.height / 2;

    const newTx = viewCx - fitScale * contentCx;
    const newTy = viewCy - fitScale * contentCy;

    reset({ scale: fitScale, x: newTx, y: newTy });
    hasFitRef.current = true;
  }, [reset]);

const buildShareText = () => {
  const guessesCount = Math.max(0, currentPath.length - 1);
  const optimal = Math.max(0, optimalPath.length - 1);
  const time = elapsedMs ? formatTime(elapsedMs) : null;

  let header = dailyMode
    ? `Postcode Pursuit — Daily ${dailyDate} (${dailyDifficulty?.toUpperCase()})`
    : `Postcode Pursuit — ${startArea} → ${targetArea}`;

  let text = `${header}\n`;
  if (!dailyMode) text += `${startArea} → ${targetArea}\n`;

  text += `Guesses: ${guessesCount}`;
  if (optimal) text += ` (optimal ${optimal})`;
  if (dailyMode) text += ` · Hints: ${hintsUsed}/${MAX_DAILY_HINTS}`;
  if (time) text += ` · Time: ${time}`;
  if (dailyMode && dailyStreak) text += ` · Streak: ${dailyStreak}`;
  text += `\npostcode-pursuit.co.uk`;

  return text;
};
  
  const linkPaint = (type) => {
  switch (type) {
    case "ferry":
      return { stroke: "#0284c7", width: 12, dash: "40 28" }; // cyan-ish, dashed
    case "tunnel":
      return { stroke: "#adb0b6ff", width: 3, dash: "5 1" }; // slate-600, dotted-ish
    case "bridge":
    default:
      return { stroke: "#ffffffff", width: 3, dash: "" };      // slate-600, solid
  }
};

/*   const handleInputSubmit = (inputElement) => {
    const val = inputElement.value.toUpperCase().trim();
    if (postcodeAreas[val]) {
      makeGuess(val);
      inputElement.value = '';
    }
  }; */

  const handleInputSubmit = (inputElement) => {
  const val = inputElement.value.toUpperCase().trim();
  if (!val) return;
  makeGuess(val);              // allow invalid/decoy -> will flash as invalid
  inputElement.value = '';
  setSelectorEmpty(true);
};


  
  const inputRef = useRef(null);

  const shareResult = async () => {
    const text = buildShareText();
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        alert('Result copied to clipboard!');
      }
    } catch {/* ignore */}
  };
  
   const bridgeAdj = React.useMemo(() => {
  const m = new Map();
  (bridgeLinks ?? []).forEach(({ a, b }) => {
    if (!postcodeAreas[a] || !postcodeAreas[b]) return;
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a).add(b);
    m.get(b).add(a);
  });
  return m;
}, []);

const ferryAdj = React.useMemo(() => {
  const m = new Map();
  (ferryLinks ?? []).forEach(({ a, b }) => {
    if (!postcodeAreas[a] || !postcodeAreas[b]) return;
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a).add(b);
    m.get(b).add(a);
  });
  return m;
}, []);

// Big list for the selection box: real area codes + plausible decoys
const allPostcodeOptions = React.useMemo(
  () => Object.keys(postcodeAreas).sort((a, b) => a.localeCompare(b)),
  []
);



const forceUppercase = useCallback((e) => {
  const el = e.currentTarget;
  const { selectionStart, selectionEnd } = el;
  const up = el.value.toUpperCase();
  if (el.value !== up) {
    el.value = up;
    // preserve caret position
    el.setSelectionRange(selectionStart, selectionEnd);
  }
}, []);

// state (near your other state)
const [selectorEmpty, setSelectorEmpty] = useState(true);
const shouldPulse =
  gameState === 'playing' &&
  !gameWon &&
  !showTutorial &&
  !showAbout &&
  !victoryOpen &&
  selectorEmpty;
// keep your forceUppercase, then wrap it:
const handleSelectorInput = useCallback((e) => {
  forceUppercase(e);
  setSelectorEmpty(e.currentTarget.value.trim() === "");
}, [forceUppercase]);

const [showNudge, setShowNudge] = useState(false);
const nudgeDismissedRef = useRef(false);

useEffect(() => {
  if (!consentResolved) return;

  const atStart = gameState === 'playing' && currentPath.length === 1;
  if (!atStart || nudgeDismissedRef.current) {
    setShowNudge(false);
    return;
  }

  const id = window.setTimeout(() => setShowNudge(true), 20000);
  return () => window.clearTimeout(id);
}, [consentResolved, gameState, currentPath.length]);

const dismissNudge = () => {
  nudgeDismissedRef.current = true; // don’t show again this round
  setShowNudge(false);
};

useEffect(() => {
  if (gameState === 'playing' && !showTutorial && !showAbout && !victoryOpen) {
    inputRef.current?.focus();
    inputRef.current?.select?.();
  }
}, [gameState, showTutorial, showAbout, victoryOpen]);

useEffect(() => {
  console.log('toast check', { consentResolved, gameState, len: currentPath.length, dismissed: nudgeDismissedRef.current });
}, [consentResolved, gameState, currentPath.length]);

useEffect(() => {
  console.log('showNudge ->', showNudge);
}, [showNudge]);

// listen for consent completion from ConsentManager
useEffect(() => {
  const onResolved = () => setConsentResolved(true);
  window.addEventListener('pp:consent:resolved', onResolved);
  return () => window.removeEventListener('pp:consent:resolved', onResolved);
}, []);

// only show the tutorial after consent is resolved
useEffect(() => {
  if (!consentResolved) return;
  const done = localStorage.getItem(ONBOARDING_KEY) === 'true';
  if (!done) setShowTutorial(true);
}, [consentResolved]);

// Menu choosers
const [showDailyChooser, setShowDailyChooser] = useState(false);
const [showFreePlayChooser, setShowFreePlayChooser] = useState(false);

// Close chooser(s) with Escape
useEffect(() => {
  if (!showDailyChooser && !showFreePlayChooser) return;
  const onKey = (e) => { if (e.key === 'Escape') { setShowDailyChooser(false); setShowFreePlayChooser(false); } };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [showDailyChooser, showFreePlayChooser]);


useEffect(() => {
  if (gameState === 'playing' && !showTutorial && !showAbout && !victoryOpen) {
    inputRef.current?.focus();
    inputRef.current?.select?.();
  }
}, [gameState, showTutorial, showAbout, victoryOpen]);


// --- unified neighbors (land + ferries + bridges) ---
const getNeighbors = React.useCallback((code) => {
  const set = new Set(postcodeAreas[code]?.neighbors ?? []);

  const ferries = ferryAdj.get(code);
  if (ferries) ferries.forEach((n) => set.add(n));

  const bridges = bridgeAdj.get(code);
  if (bridges) bridges.forEach((n) => set.add(n));

  return Array.from(set);
}, [ferryAdj, bridgeAdj]);

  // ---------- ICONS & PULSES ----------
  const attachPathRef = (id) => (el) => {
    if (!el) return;
    const b = el.getBBox();
    centroidsRef.current[id] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  function TargetMarker({ id }) {
    const c = centroidsRef.current[id];
    if (!c) return null;
    return (
      <g pointerEvents="none">
        <circle
          cx={c.x}
          cy={c.y}
          r={1}
          className="[transform-box:fill-box] [transform-origin:center] animate-ping fill-transparent stroke-amber-500 stroke-2 opacity-70"
        />
        <Flag
          x={c.x -25} y={c.y -200} width={200} height={200}
          className="text-white-900"
          strokeWidth={2.5}
          stroke='black'
          strokeOpacity={0.5}
        />
      </g>
    );
  }

  function StartMarker({ id }) {
    const c = centroidsRef.current[id];
    if (!c) return null;
    return (
      <g pointerEvents="none">
        <circle cx={c.x} cy={c.y} r={1} className="fill-white/80" />
        <MapPin
          x={c.x - 100} y={c.y - 200} width={200} height={200}
          className="text-white-700"
          strokeWidth={2.5}
          stroke='black'
          strokeOpacity={0.5}
        />
      </g>
    );
  }

  function CurrentMarker({ id }) {
    const c = centroidsRef.current[id];
    if (!c) return null;
    return (
      <g pointerEvents="none">
        <circle cx={c.x} cy={c.y} r={1} className="fill-blue-700 opacity-90" />
        <circle cx={c.x} cy={c.y} r={1}
          className="[transform-box:fill-box] [transform-origin:center] animate-ping fill-transparent stroke-blue-700 stroke-2 opacity-60"
        />
      </g>
    );
  }

  function StepBadge({ id, index }) {
    const c = centroidsRef.current[id];
    if (!c) return null;
    return (
      <g pointerEvents="none">
        <circle cx={c.x} cy={c.y} r={9} className="fill-white stroke-slate-700" />
        <text x={c.x} y={c.y + 4} textAnchor="middle"
          className="fill-slate-900 text-[10px] font-semibold">
          {index + 1}
        </text>
      </g>
    );
  }
  
/* function bfsAllDistances(start) {
  const dist = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const u = q.shift();
    const du = dist.get(u);
    for (const v of getNeighbors(u)) {
      if (!dist.has(v)) {
        dist.set(v, du + 1);
        q.push(v);
      }
    }
  }
  return dist; // Map<areaCode, steps>
} */

  // Return a quadratic curve string between area centres, with a slight bend
function arcPath(a, b, bend = 0.18) {
  const A = getCenter(a), B = getCenter(b);
  if (!A || !B) return null;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len; // unit normal
  const cx = mx + nx * bend * len;
  const cy = my + ny * bend * len;
  return `M ${A.x} ${A.y} Q ${cx} ${cy} ${B.x} ${B.y}`;
}

function bfsDistance(start, target) {
  if (!start || !target || start === target) return 0;
  const q = [[start, 0]];
  const seen = new Set([start]);
  while (q.length) {
    const [node, d] = q.shift();
    for (const n of getNeighbors(node)) {
      if (seen.has(n)) continue;
      if (n === target) return d + 1;
      seen.add(n);
      q.push([n, d + 1]);
    }
  }
  return Infinity;
}


function fireReroll(reason = 'new_game_button') {
  if (!isActiveRound()) return;
  const elapsedSec =
    gameStartRef.current ? Math.round((performance.now() - gameStartRef.current) / 1000) : null;
  const pathLen = optimalPath?.length ? optimalPath.length - 1 : null;

  window.gtag?.('event', 'game_rerolled', {
    difficulty,
    path_length: pathLen,
    elapsed_sec: elapsedSec,
    reason,                  // 'new_game_button' | 'change_difficulty' | etc.
    round_id: roundIdRef.current,
  });
}


function Toast({ open, onClose, action, children }) {
  if (!open) return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        zIndex: 2147483000,
      }}
    >
      <div className="glass rounded-xl shadow-lg px-3 py-2 flex items-start gap-2 max-w-[92vw] w-[520px]">
        <div className="text-sm flex-1">{children}</div>
        {action && (
          <button type="button" className="btn btn-success" onClick={action.onClick}>
            {action.label}
          </button>
        )}
        <button type="button" className="btn btn-neutral" onClick={onClose} aria-label="Dismiss">
          Dismiss
        </button>
      </div>
    </div>,
    document.body
  );
}


  // ---------- STATE CLASSES (Option A) ----------
const focusStartAndTarget = React.useCallback((startCode, targetCode, pad = 0.2) => {
  const A = getCenter(startCode);
  const B = getCenter(targetCode);
  if (!A || !B) return;

  // Tight bbox around the two points
  const minX = Math.min(A.x, B.x), maxX = Math.max(A.x, B.x);
  const minY = Math.min(A.y, B.y), maxY = Math.max(A.y, B.y);


 const MIN_FRACTION = 0.18;
 const spanX = Math.max(maxX - minX, WORLD.width  * MIN_FRACTION);
 const spanY = Math.max(maxY - minY, WORLD.height * MIN_FRACTION);

  // Expand by padding
  const w = spanX * (1 + pad * 2);
  const h = spanY * (1 + pad * 2);

  // Center of the pair
  const cx = (A.x + B.x) / 2;
  const cy = (A.y + B.y) / 2;

  // Compute scale to fit w×h inside the VIEWBOX
  const vw = WORLD.width, vh = WORLD.height;
  let s = Math.min(vw / w, vh / h);
  s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

  // Translate so the pair center is in the middle of the viewBox
  const viewCx = WORLD.x + vw / 2;
  const viewCy = WORLD.y + vh / 2;
  const tx = viewCx - s * cx;
  const ty = viewCy - s * cy;

  reset({ scale: s, x: tx, y: ty });

  hasFitRef.current = true;       // prevent other auto-fits
  didAutoFitRef.current = true;   // prevent the “first-fit” effect
}, [reset, getCenter]);



const COLORS = {
  baseFill:    '#66b860', // slate-200
  baseStroke:  '#454f5eff', // slate-400
  startFill:   '#60abb8ff', startStroke: '#1e40af',
  currentFill: '#1d4ed8', currentStroke:'#1e3a8a',
  visitedFill: '#bae6fd', visitedStroke:'#64748b',
  targetFill:  '#FDE68A', targetStroke:'#b45309',
};

  const currentArea = currentPath[currentPath.length - 1] || null;
 // const visitedSet  = useMemo(() => new Set(currentPath), [currentPath]);




 
const getAreaStyle = (code) => {
  // Flags
  const isStart   = code === startArea;
  const isTarget  = code === targetArea;
  const isCurrent = currentArea && code === currentArea && !isStart;
  const isVisited = currentPath.includes(code);
  const isFlashing = flashAreas.includes(code);

  // MASTER: hide everything except start/target/current/visited
  const revealedInMaster = isStart || isTarget || isVisited || isCurrent;
  if (masterMode && !revealedInMaster) 
  
  
  
  
  {

    return { fill: 'transparent', stroke: 'none', strokeWidth: 0 };
  }



  
  // 🔴 Invalid/duplicate guess flash overrides everything for 400ms
  if (isFlashing) {
    return {
      fill: '#f43f5e',                                // rose-500
      stroke: showOutlines ? '#be123c' : 'none',      // rose-700 outline only if outlines on
      strokeWidth: showOutlines ? 1.25 : 1,
      // Don't dash during flash; keeps the flash clean & obvious
    };
  }

  // ---- normal coloring ----
  let fill   = COLORS.baseFill;
  let stroke = COLORS.baseStroke;
  let dash   = null;

  if (isTarget) {
    fill = COLORS.targetFill;  stroke = COLORS.targetStroke;
  } else if (isStart) {
    fill = COLORS.startFill;   stroke = COLORS.startStroke;
  } else if (isCurrent) {
    fill = COLORS.currentFill; stroke = COLORS.currentStroke;
  } else if (isVisited) {
    fill = COLORS.visitedFill; stroke = COLORS.visitedStroke; dash = '3 3';
  }





  // Visited areas force outlines ON regardless of toggle/mode (your a11y rule)
  const outlinesOn = showOutlines || isVisited;
  
  

  return {
    fill,
    stroke: outlinesOn ? (isVisited ? COLORS.visitedStroke : stroke) : 'none',
    strokeWidth: outlinesOn ? 1.25 : 0,
    ...(outlinesOn && dash ? { strokeDasharray: dash } : {}),
    ...(outlinesOn ? {} : { shapeRendering: 'crispEdges' }),
  };
};
// pick a single example neighbour for the nudge
const [exampleNeighbor, setExampleNeighbor] = useState('');

useEffect(() => {
  if (gameState !== 'playing' || currentPath.length === 0) {
    setExampleNeighbor('');
    return;
  }
  const current = currentPath[currentPath.length - 1];
  // valid neighbours you haven’t visited yet
  const candidates = getNeighbors(current).filter(n => !currentPath.includes(n));

  if (candidates.length) {
    // deterministic-ish pick so it doesn’t flicker every render
    const seed =
      (current?.charCodeAt?.(0) || 0) +
      (targetArea?.charCodeAt?.(0) || 0) +
      (targetArea?.charCodeAt?.(1) || 0);
    const idx = seed % candidates.length;
    setExampleNeighbor(candidates[idx]);
  } else {
    setExampleNeighbor('');
  }
}, [gameState, currentPath, getNeighbors, targetArea]);
  // ---------- Victory modal timing ----------
  const finishGame = useCallback(() => {
    setGameWon(true);
	setGameState('gameWon');
    const end = performance.now();
    const ms = gameStartRef.current ? Math.max(0, end - gameStartRef.current) : 0;
    setElapsedMs(ms);
    // Update Daily streak only for Daily mode
if (dailyMode && dailyDate) {
  const today = todayUTC();
  const s = loadDailyStreak() || { count: 0, lastWinDate: null };

  // Only increment once per day
  if (s.lastWinDate === today) {
    // already counted today's win; keep as-is
    setDailyStreak(s.count);
    saveDailyStreak(s.count, s.lastWinDate);
  } else {
    // check if yesterday was the last win → extend, else reset to 1
    const extend = s.lastWinDate && daysBetweenUTC(s.lastWinDate, today) === 1;
    const next = extend ? (s.count + 1) : 1;
    setDailyStreak(next);
    saveDailyStreak(next, today);
  }
}
	   if (window.gtag) {
     window.gtag('event', 'game_won', {
       difficulty,
       start_postcode: startArea,
       target_postcode: targetArea,
       guesses: Math.max(0, currentPath.length - 1),
       time_ms: ms,
	   round_id: roundIdRef.current || undefined,
     });
   }
	
	
    setVictoryOpen(true);
  }, [currentPath.length, difficulty, startArea, targetArea, dailyDate,dailyMode]);

useEffect(() => {
  if (gameState !== 'menu' && !hasFitRef.current) {
    requestAnimationFrame(() => fitToContent());
  }
}, [gameState, fitToContent]);

// Lock page scroll only while the map is active (no modals)
useEffect(() => {
  const prevHtml = document.documentElement.style.overflow;
  const prevBody = document.body.style.overflow;

 const shouldLock =
   (gameState !== 'menu' && !showAbout && !victoryOpen && !showTutorial)
   || showDailyChooser
   || showFreePlayChooser;

  document.documentElement.style.overflow = shouldLock ? 'hidden' : prevHtml || '';
  document.body.style.overflow = shouldLock ? 'hidden' : prevBody || '';

  return () => {
    document.documentElement.style.overflow = prevHtml;
    document.body.style.overflow = prevBody;
  };
}, [gameState, showAbout, victoryOpen, showTutorial, showDailyChooser, showFreePlayChooser]);

  // controls height -> CSS var
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
    document.documentElement.classList.toggle('no-backdrop', !ok);
  }, []);

  useEffect(() => {
    console.log('Loaded postcode areas:', Object.keys(postcodeAreas).length);
    console.log('Sample path:', postcodeAreas['AB']?.path?.slice(0, 100));
  }, []);

  // ---------- Pan/zoom ----------
  const [scaleForLabels, setScaleForLabels] = useState(1);



  useEffect(() => {
    if (!svgRef.current || !contentRef.current || didAutoFitRef.current) return;
    const id = requestAnimationFrame(() => {
      try {
        const bbox = contentRef.current.getBBox();
        if (!bbox || bbox.width === 0 || bbox.height === 0) return;
        const PAD = 0.05;
        const availW = WORLD.width * (1 - PAD * 2);
        const availH = WORLD.height * (1 - PAD * 2);
        const s = Math.min(availW / bbox.width, availH / bbox.height);
        const tx0 = (WORLD.width  - s * bbox.width)  / 2 - s * bbox.x;
        const ty0 = (WORLD.height - s * bbox.height) / 2 - s * bbox.y;
        reset({ scale: s, x: tx0, y: ty0 });
        didAutoFitRef.current = true;
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [reset]);

  // ---------- Game logic ----------

const boundsByDifficulty = {
  easy:   { min: 3, max: 10 },
  normal: { min: 4, max: 12 },
  hard:   { min: 5, max: null },  // no max
  master: { min: 8, max: null },  // no max
};
  
function generatePuzzleWithBounds(minSteps, maxSteps = null, maxRetries = 800) {
  const areas = Object.keys(postcodeAreas);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const start = areas[Math.floor(Math.random() * areas.length)];
    const dist = bfsAllDistances(start);

    // Candidates with distance in [minSteps, maxSteps] (or no max)
    const candidates = areas.filter(a => {
      if (a === start) return false;
      const d = dist.get(a);
      return Number.isFinite(d) && d >= minSteps && (maxSteps == null || d <= maxSteps);
    });

    if (candidates.length) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];

      // double-check using your pathfinder
      const path = findShortestPath(start, target); // array of nodes
      const steps = path.length ? path.length - 1 : Infinity;
      if (Number.isFinite(steps) && steps >= minSteps && (maxSteps == null || steps <= maxSteps)) {
        return { start, target, path }; // path handy for optimalPath
      }
    }
  }

  // Fallback: keep the minimum strict, drop the max (so we always meet the min)
  console.warn('No pair within bounds after retries; relaxing max only.');
  return generatePuzzleWithBounds(minSteps, null, 200);
}

  const findShortestPath = (start, end) => {
    if (start === end) return [start];
    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      for (const neighbor of getNeighbors(current)) {
        if (neighbor === end) return [...path, neighbor];
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return [];
  };

const prevStateRef = useRef(gameState);

useEffect(() => {
  const prev = prevStateRef.current;
  if (prev !== 'playing' && gameState === 'playing') {
    roundIdRef.current = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    window.gtag?.('event', 'game_started', {
      difficulty,
      start_postcode: startArea,
      target_postcode: targetArea,
      round_id: roundIdRef.current,
    });
  }
  prevStateRef.current = gameState;
}, [gameState, difficulty, startArea, targetArea]);


const abandonIfActive = useCallback((reason = 'navigation') => {
  if (gameState === 'playing' && !gameWon && window.gtag) {
    const ms = gameStartRef.current ? Math.max(0, performance.now() - gameStartRef.current) : undefined;
    window.gtag('event', 'game_abandoned', {
      difficulty,
      start_postcode: startArea,
      target_postcode: targetArea,
      guesses: Math.max(0, currentPath.length - 1),
      time_ms: ms,
      reason,
      round_id: roundIdRef.current || undefined,
    });
    roundIdRef.current = null; // prevent duplicates
  }
}, [gameState, gameWon, difficulty, startArea, targetArea, currentPath.length]);

useEffect(() => {
  const onUnload = () => abandonIfActive('beforeunload');
  window.addEventListener('beforeunload', onUnload);
  return () => window.removeEventListener('beforeunload', onUnload);
}, [abandonIfActive]);

const startNewGame = () => {
  nudgeDismissedRef.current = false;
  setShowHints(false);
  abandonIfActive('reroll');

  const { min, max } = boundsByDifficulty[difficulty] ?? { min: 4, max: null };
  const { start, target, path } = generatePuzzleWithBounds(min, max);

  setStartArea(start);
  setTargetArea(target);
  setCurrentPath([start]);
  setGuesses([]);
  setGameWon(false);

  setOptimalPath(path);              // we already have it
  setGameState('playing');
  gameStartRef.current = performance.now();
  setElapsedMs(0);
  setVictoryOpen(false);
  setShowOptimal(false);
  // Focus the camera on the start/target pair
  requestAnimationFrame(() => focusStartAndTarget(start, target));
};

// const minStepsByMode = { easy: 3, normal: 4, hard: 5, master: 6 };
const makeGuess = useCallback((area) => {
  if (gameWon) return;
  setShowHints(false); 

  const currentLocation = currentPath[currentPath.length - 1];
  const isValidMove = getNeighbors(currentLocation).includes(area);
  const alreadyVisited = currentPath.includes(area);
  const revisitAllowed = (difficulty === 'easy' || difficulty === 'normal');

  const viaFerry = ferryAdj.get(currentLocation)?.has(area) || false;
  const viaBridge = !!bridgeAdj.get(currentLocation)?.has(area);
  setGuesses((prev) => [
  ...prev,
  { area, valid: isValidMove, alreadyVisited, viaFerry, viaBridge }
  ]);
  

  if (!isValidMove || (alreadyVisited && !revisitAllowed)) {
    setFlashAreas((prev) => [...prev, area]);
    setTimeout(() => {
      setFlashAreas((prev) => prev.filter((a) => a !== area));
    }, 400);
    ;
    return;
  }

  const newPath = [...currentPath, area];
  setCurrentPath(newPath);

  if (area === targetArea) {
    finishGame();
  } else {
    ;
  }
}, [getNeighbors, gameWon, currentPath, targetArea, finishGame, ferryAdj, bridgeAdj, difficulty]);

// const isFerryEdge  = (a,b) => ferryAdj.get(a)?.has(b)  || false;
// const isBridgeEdge = (a,b) => bridgeAdj.get(a)?.has(b) || false;



const handleClick = useCallback((code) => {
  if (!canClickAreas) return;
  if (gameState !== 'playing' || victoryOpen || showTutorial || showAbout) return;
  if (!isRevealed(code)) return;
  if (Date.now() < suppressClickUntilRef.current) return;
  makeGuess(code);
}, [gameState, isRevealed, makeGuess, canClickAreas, victoryOpen, showTutorial, showAbout]);

  // ---------- Label sizing helpers ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const labelPxForScale = (s) => clamp(30 + 200 * s, 30, 300); // readable range
  const svgFontSizeForScale = (s) => labelPxForScale(s) / s;

  const resetView = useCallback(() => {
    hasFitRef.current = false;
    didAutoFitRef.current = false;
    requestAnimationFrame(() => fitToContent());
  }, [fitToContent]);

  // ---------- Optimal path overlay ----------
  const renderOptimalOverlay = () => {
    const pts = optimalPath
      .map(code => postcodeAreas[code]?.center)
      .filter(Boolean);

    if (pts.length < 2) return null;

    const pointsAttr = pts.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <g pointerEvents="none">
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="#000"
          strokeOpacity="0.1"
          strokeWidth={15}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="#8b5cf6"
		  strokeOpacity="0.5"
          strokeWidth={8}
          vectorEffect="non-scaling-stroke"
        />
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

// ------------------- RENDER HELPERS (map, controls, menus) -----------------

  // ---------- Map ----------
const renderMap = () => (
  <div 
    className="glass mx-auto relative" 
    style={{ 
      width: '100%', 
      maxWidth: '600px', 
      height: '600px', 
      overflow: 'hidden', 
      borderRadius: 16 
    }}
  >
    {/* Zoom overlay, top-left */}
    <div className="absolute top-2 left-2 z-10 flex gap-2">
      <button onClick={() => zoomOut(ZOOM_STEP)} className="btn btn-neutral" title="Zoom out">-</button>
      <button onClick={() => zoomIn(ZOOM_STEP)}  className="btn btn-neutral" title="Zoom in">+</button>
      <button onClick={resetView} className="btn btn-neutral" title="Reset view">Reset</button>
    </div>

    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      className="block"
      viewBox={`${WORLD.x} ${WORLD.y} ${WORLD.width} ${WORLD.height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ touchAction: 'none', display: 'block' }}
    >
      <rect
        x={WORLD.x} y={WORLD.y}
        width={WORLD.width} height={WORLD.height}
        fill="transparent" pointerEvents="all"
      />
		
      <defs>		  
        {masterMode && (
          <clipPath id={landClipId} clipPathUnits="userSpaceOnUse">
            {Object.entries(postcodeAreas).map(([code, area]) => (
              <path key={`clip-${code}`} d={area.path} />
            ))}
          </clipPath>
        )}
      </defs>
		
      {/* Outer g transforms (pan/zoom). Inner g is content for getBBox */}
      <g ref={gRef}>
        <g
          ref={contentRef}
          /* clip only in Master so coastline strokes are hidden */
          clipPath={masterMode ? `url(#${landClipId})` : undefined}
          /* keep crisp edges when outlines are off */
          shapeRendering={showOutlines ? undefined : "crispEdges"}
        >
          {/* BRIDGES & TUNNELS (hidden in Master) */}
          {!masterMode && Array.isArray(bridgeLinks) && bridgeLinks.length > 0 && (
            <g pointerEvents="none" aria-label="Bridges and tunnels">
              {bridgeLinks.map(({ a, b, type }, i) => {
                if (!postcodeAreas[a] || !postcodeAreas[b]) return null;
                const d = (type === "bridge" ? arcPathBridge : arcPathFerry)(a, b);
                if (!d) return null;

                const { stroke, width, dash } = linkPaint(type);
                const A = getCenter(a), B = getCenter(b);

                return (
                  <g key={`bridge-${a}-${b}-${i}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={width}
                      strokeDasharray={dash || undefined}
                      strokeLinecap="round"
                      opacity="0.95"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* subtle end caps so the line visually reaches each area */}
                    <circle cx={A.x} cy={A.y} r={Math.max(6, width * 0.6)} fill={stroke} vectorEffect="non-scaling-stroke" />
                    <circle cx={B.x} cy={B.y} r={Math.max(6, width * 0.6)} fill={stroke} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
            </g>
          )}

          {Object.entries(postcodeAreas).map(([code, area]) => {
            const isCurrent = !gameWon && currentArea && code === currentArea && code !== targetArea;
            const extra  = [
              flashAreas.includes(code) ? "animate-shake [animation-duration:.25s]" : "",
              isCurrent ? "area-pulse" : "",
            ].join(" ").trim();

            const hidden = !isRevealed(code) ? "opacity-0 pointer-events-none" : "";
            return (
              <path
                key={code}
                ref={attachPathRef(code)}
                d={area.path}
                style={getAreaStyle(code)}
                className={`hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white ${extra} ${hidden}`}
                // only attach handlers if Easy
                onClick={canClickAreas ? () => handleClick(code) : undefined}
                onKeyDown={
                  canClickAreas
                    ? (e) => (e.key === 'Enter' || e.key === ' ') && handleClick(code)
                    : undefined
                }
                tabIndex={canClickAreas ? 0 : -1}
                aria-label={code}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        {/* Ferry routes (hidden in Master) */}
        {!masterMode && Array.isArray(ferryLinks) && ferryLinks.length > 0 && (
          <g pointerEvents="none" aria-label="Ferry routes">
            {ferryLinks.map(({ a, b }, i) => {
              // skip if either endpoint isn't in your dataset
              if (!postcodeAreas[a] || !postcodeAreas[b]) return null;

              const d = arcPath(a, b);
              if (!d) return null;

              return (
                <g key={`ferry-${a}-${b}-${i}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#ffffffff"
                    strokeWidth={3}
                    strokeDasharray="4 10"
                    strokeLinecap="round"
                    opacity="0.7"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>
        )}
        
{/* Labels */}
{Object.entries(postcodeAreas).map(([code, area]) => {
  if (!isRevealed(code)) return null;

  const isStart = code === startArea;
  const isVisited = currentPath.includes(code);
  const shouldShow =
    showLabels ||                               // Easy (and any mode where labels are on)
    (difficulty === 'normal' && (isStart || isVisited)); // Normal: only Start + Visited

  if (!shouldShow) return null;
  const c = area.center || centroidsRef.current[code];
  if (!c) return null;

  return (
    <text
      key={`label-${code}`}
      x={c.x}
      y={c.y}
      textAnchor="middle"
      className="pointer-events-none select-none fill-slate-800/80"
      style={{ fontSize: svgFontSizeForScale(scaleForLabels) }}
      stroke="white"
      strokeWidth={4}
      paintOrder="stroke"
      vectorEffect="non-scaling-stroke"
    >
      {code}
    </text>
  );
})}
        
        {/* overlays (render after paths so they sit on top) */}
        {targetArea && <TargetMarker id={targetArea} />}
        {startArea && <StartMarker id={startArea} />}
        {currentArea && <CurrentMarker id={currentArea} />}
        {currentPath.map((id, i) => <StepBadge key={`b-${id}`} id={id} index={i} />)}

        {/* Optional optimal path overlay */}
        {gameWon && showOptimal && renderOptimalOverlay()}
      </g>
    </svg>
  </div>
);


  
  // ---------- Controls / UI ----------

const renderControls = () => (
  <div ref={controlsRef} className="sticky top-0 z-20 w-full pt-3 px-4">
    <div
      className="glass mx-auto relative"   // <- ensure positioned ancestor
      style={{ width: '100%', maxWidth: '600px', overflow: 'hidden', borderRadius: 16 }}
    >
      {/* Burger pinned over the card, top-right */}
      <div className="pin-top-right">
        <button
          ref={burgerButtonRef}
          type="button"
          className="btn btn-neutral inline-flex w-auto items-center gap-2"
          aria-haspopup="menu"
          aria-expanded={burgerOpen ? 'true' : 'false'}
          aria-label="Open menu"
          onClick={() => setBurgerOpen(o => !o)}
        >
          <Menu className="w-4 h-4" />
          
        </button>
      </div>

      {/* Title row */}
      <div className="px-3 py-2">
        <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-tight">
          Travel from <span className="text-indigo-200">{startArea || '—'}</span> to{' '}
          <span className="text-indigo-200">{targetArea || '—'}</span>
        </h2>
      </div>

      {/* Burger menu portal (slide-in, overlays everything) */}
{burgerOpen && createPortal(
  <div
    id="pp-burger-menu"
    role="menu"
    aria-orientation="vertical"
    className="glass rounded-xl shadow-lg p-2 animate-menu-pop"
    style={{
      position: 'fixed',
      top: burgerPos.top,
      left: burgerPos.left,
      width: burgerPos.width,
      zIndex: 2147483000,
      willChange: 'transform, opacity'
    }}
  >
    <ul
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        margin: 0,
        padding: 0,
        listStyle: 'none'
      }}
    >
      <li>
        <button
          role="menuitem"
          onClick={dailyMode ? undefined : () => { fireReroll?.('new_game_button'); startNewGame(); setBurgerOpen(false); }}
          disabled={dailyMode}
          aria-disabled={dailyMode}
          className={`btn btn-primary`}
          style={{ display: 'block', width: '100%' }}
          title={dailyMode ? 'Unavailable during Daily Challenge' : 'Start a new random game'}
        >
          New Game
        </button>
      </li>

      <li>
        <button
          role="menuitem"
          onClick={dailyMode ? undefined : () => {
            abandonIfActive('restart');
            setCurrentPath([startArea]);
            setGuesses([]);
            setGameWon(false);
            setOptimalPath(findShortestPath(startArea, targetArea));
            setBurgerOpen(false);
          }}
          disabled={dailyMode}
          aria-disabled={dailyMode}
          className="btn btn-warn"
          style={{ display: 'block', width: '100%' }}
          title={dailyMode ? 'Unavailable during Daily Challenge' : 'Restart this round'}
        >
          Restart
        </button>
      </li>

      <li>
        <button
          role="menuitem"
          onClick={() => { abandonIfActive('menu'); setGameState('menu'); setBurgerOpen(false); }}
          className="btn btn-neutral"
          style={{ display: 'block', width: '100%' }}
          title="Return to main menu"
        >
          Menu
        </button>
      </li>

      <li>
        <button
          role="menuitem"
          onClick={() => { localStorage.removeItem(ONBOARDING_KEY); setShowTutorial(true); setBurgerOpen(false); }}
          className="btn btn-neutral"
          style={{ display: 'block', width: '100%' }}
          title="Replay the tutorial"
        >
          How to Play
        </button>
      </li>
    </ul>
  </div>,
  document.body
)}

{/* Middle: BIG centered selection box with inline submit arrow */}
{!gameWon && (
  <div className="px-3 pb-3">
    <div className="w-full flex justify-center">
      {/* inline-block wrapper so the absolute button can anchor correctly */}
  <div
    style={{ display: 'inline-block', position: 'relative' }}
    className={shouldPulse ? 'pp-pulse-wrap' : undefined}
  >
        <input
          ref={inputRef}
          list="pp-codelist"
          type="text"
          className="rounded-2xl border border-slate-300 text-center shadow-md focus:ring-4 focus:ring-indigo-400 focus:outline-none"
          onInput={handleSelectorInput}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInputSubmit(e.currentTarget); }}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="go"
          aria-label="Select or enter a postcode"
          style={{
            // BIG + centered
            width: 200,
            height: 30,
            fontSize: 28,
            padding: '16px 64px 16px 20px', // room for the arrow button inside
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'block'               // avoid inline baseline quirks,
          }}
        />

        <datalist id="pp-codelist">
          {allPostcodeOptions.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>

        {/* Inline submit arrow, absolutely positioned inside the input */}
        <button
          type="button"
          onClick={() => inputRef.current && handleInputSubmit(inputRef.current)}
          className="btn btn-hollowgreen rounded-xl shadow"
          aria-label="Submit postcode"
          style={{
            position: 'absolute',
            top: '50%',
            right: 8,
            transform: 'translateY(-50%)',
            width: 48,
            height: 48,
            padding: 0,
            lineHeight: 1,
            display: 'grid',
            placeItems: 'center',
            zIndex: 1
          }}
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>

    {/* Last entry chips (centered) */}
    {guesses.length > 0 && (
      <div className="flex flex-wrap gap-1 text-xs mt-3 justify-center">
        Last entry:&nbsp;
        {guesses.slice(-1).map((g, i) => (
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
            {g.valid && !g.alreadyVisited && g.viaFerry  ? ' (ferry)'  : ''}
            {g.valid && !g.alreadyVisited && g.viaBridge ? ' (bridge)' : ''}
          </span>
        ))}
      </div>
    )}
  </div>
)}



{/* Journey + inline actions */}
<div className="px-3 pb-2">
  {/* Row: badges + (Undo, Hint) OR trophy + optimal toggle */}
  <div className="flex flex-wrap items-center gap-2">
    <div className="badges flex flex-wrap items-center gap-2">
      <span className="text-slate-200/90">Journey:</span>
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

    {/* Actions on the right */}
    <div className="ml-auto flex items-center gap-2">
      {!gameWon && !masterMode && (
        <button
          onClick={undoLastMove}
          disabled={currentPath.length <= 1}
          aria-disabled={currentPath.length <= 1}
          title="Undo last move (Ctrl/Cmd+Z)"
          className={`btn btn-neutral ${currentPath.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Undo
        </button>
      )}

      {!gameWon && (
        <button
          className="btn btn-success"
          onClick={toggleHints}
          disabled={dailyMode && hintsUsed >= MAX_DAILY_HINTS && !showHints}
          title={dailyMode ? `Hints left: ${Math.max(0, MAX_DAILY_HINTS - hintsUsed)}` : 'Show possible neighbours'}
        >
          {dailyMode
            ? (showHints ? 'Hide hints' : `Hint (${Math.max(0, MAX_DAILY_HINTS - hintsUsed)} left)`)
            : (showHints ? 'Hide hints' : 'Hint')}
        </button>
      )}

      {gameWon && (
        <>
          {/* Trophy chip */}
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded border border-emerald-300 bg-emerald-100 text-emerald-900">
            <Trophy className="w-4 h-4" />
            <span>
              Completed in <b>{Math.max(0, currentPath.length - 1)}</b>
              {optimalPath.length > 0 && <> · Optimal <b>{Math.max(0, optimalPath.length - 1)}</b></>}
            </span>
          </div>

          {/* Toggle optimal route */}
          <button
            onClick={() => setShowOptimal(v => !v)}
            className="btn btn-purple"
          >
            {showOptimal ? 'Hide optimal route' : 'Show optimal route'}
          </button>
        </>
      )}
    </div>
  </div>

  {/* Hint panel (appears under the row when toggled, only while playing) */}
  {showHints && !gameWon && currentPath.length > 0 && (
    <div className="mt-3">
      <div className="badges flex flex-wrap items-center gap-2">
        <span className="text-slate-600 mr-1">Available connections:</span>

        {(() => {
          const current = currentPath[currentPath.length - 1];
          const options = getNeighbors(current)
            .filter(n => !currentPath.includes(n))
            .map(n => ({ n, d: bfsDistance(n, targetArea) }))
            .sort((a, b) => a.d - b.d);

          if (options.length === 0) {
            return <span className="badge badge-fail">No unvisited neighbours</span>;
          }

          return options.map(({ n, d }, idx) => {
            const best = idx === 0;
            const className = best
              ? "badge badge-blue hover:brightness-95"
              : "badge badge-gray hover:brightness-95";
            return (
              <button
                key={n}
                type="button"
                className={className}
                onClick={() => makeGuess(n)}
                title={Number.isFinite(d) ? `~${d} steps from target` : "No path"}
                aria-label={Number.isFinite(d) ? `${n}, about ${d} steps from target` : `${n}, no path`}
              >
                {n}
              </button>
            );
          });
        })()}

        <button type="button" className="btn btn-neutral" onClick={() => setShowHints(false)} title="Hide hints">
          Hide
        </button>
      </div>
    </div>
  )}

  {/* Optimal route badges (after completion, only when toggled on) */}
  {gameWon && showOptimal && optimalPath?.length > 0 && (
    <div className="mt-3">
      <div className="text-sm font-semibold mb-1">Optimal route:</div>
      <div className="badges flex flex-wrap items-center gap-2">
        {optimalPath.map((code, i) => (
          <span key={i} className="badge badge-green">
            <span style={{ marginRight: 6 }}>{i}:</span>{code}
          </span>
        ))}
      </div>
    </div>
  )}
</div>



      {/* Toast */}
      <Toast
        open={showNudge && !masterMode && !gameWon}
        onClose={dismissNudge}
        action={{ label: 'Open tutorial', onClick: () => { setShowTutorial(true); dismissNudge(); } }}
      >
        You are in the <b>glowing Postcode area</b>. Enter a neighbouring postcode like <b>{exampleNeighbor}</b> and press <b>Enter</b>. If you’re still unsure, try the tutorial.
      </Toast>
    </div>
  </div>
);






// ---------- GameBoard ----------

const renderGameBoard = () => (
  <div className="mx-auto w-full max-w-[600px] px-4">
    {renderControls()}
    <div className="grid place-items-center min-h-[calc(100dvh-var(--controls-h,0px))]"><br /><br />
      <div className="absolute inset-0 grid place-items-center">
        {renderMap()}
      </div>
    </div>
  </div>
);
// ---------- Menu page ----------
const renderMenu = () => (
  <div className="max-w-2xl mx-auto p-8 glass text-center mt-8 relative">
    <MapPin className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
    <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Postcode Pursuit</h1>
    <p className="text-slate-600 mb-6">
      Navigate between UK postcode areas by following their geographical connections!
    </p>

    {/* Two big CTAs */}
    <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 mb-6">
      <button
        type="button"
        className="btn btn-success text-lg py-3 sm:flex-1"
        onClick={() => setShowDailyChooser(true)}
      >
        Daily Challenge
      </button>
      <button
        type="button"
        className="btn btn-purple text-lg py-3 sm:flex-1"
        onClick={() => setShowFreePlayChooser(true)}
      >
        Free Play
      </button>
        <button
    type="button"
    className="btn btn-neutral text-lg py-3"
    onClick={() => setShowTutorial(true)}
  >
    How to Play
  </button>
    </div>

    <button className="btn btn-neutral" onClick={() => setShowAbout(true)}>About</button>

    {/* --- Daily chooser modal --- */}
{showDailyChooser && createPortal(
  <div
    role="dialog"
    aria-modal="true"
    onClick={() => setShowDailyChooser(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 2147483647,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '10vh',
      padding: '10vh 16px 16px'
    }}
  >
    <div
      className="glass w-full max-w-md p-5 rounded-2xl shadow-lg"
      onClick={(e) => e.stopPropagation()}
      tabIndex={-1}
      style={{
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}
    >
      <h2 className="text-xl font-bold mb-3">Choose Daily Challenge Difficulty</h2>
<div className="grid gap-2">
  <button className="btn btn-green btn--full"  onClick={() => setDailyChoice('easy')}>
    Easy — {Daily.dailyStatus('easy')}
  </button>
  <button className="btn btn-yellow btn--full" onClick={() => setDailyChoice('normal')}>
    Normal — {Daily.dailyStatus('normal')}
  </button>
  <button className="btn btn-orange btn--full" onClick={() => setDailyChoice('hard')}>
    Hard — {Daily.dailyStatus('hard')}
  </button>
  <button className="btn btn-purple btn--full" onClick={() => setDailyChoice('master')}>
    Master — {Daily.dailyStatus('master')}
  </button>
</div>

{dailyChoice && (
  <div className="mt-4 p-3 rounded-xl bg-white/75 text-slate-900">
    <div className="font-semibold">
      {DIFF_LABELS[dailyChoice]}
    </div>
    <p className="text-sm mt-1">{DIFF_DESCRIPTIONS[dailyChoice]}</p>

    <div className="mt-3 flex gap-2">
      <button
        className="btn btn-primary flex-1"
        onClick={() => {
          startOrResumeDaily(dailyChoice);
          setShowDailyChooser(false);
          setDailyChoice(null);
        }}
      >
        Play game
      </button>
      <button className="btn btn-neutral" onClick={() => setDailyChoice(null)}>
        Change
      </button>
    </div>
  </div>
)}

<div className="mt-4">
  <button
    className="btn btn-neutral w-full"
    onClick={() => { setShowDailyChooser(false); setDailyChoice(null); }}
  >
    Close
  </button>
</div>

    </div>
  </div>,
  document.body
)}


    {/* --- Free Play chooser modal --- */}
{showFreePlayChooser && createPortal(
  <div
    role="dialog"
    aria-modal="true"
    onClick={() => setShowFreePlayChooser(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 2147483647,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingTop: '10vh',
      padding: '10vh 16px 16px'
    }}
  >
    <div
      className="glass w-full max-w-md p-5 rounded-2xl shadow-lg"
      onClick={(e) => e.stopPropagation()}
      tabIndex={-1}
      style={{
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}
    >
<h2 className="text-xl font-bold mb-3">Choose Free Play Difficulty</h2>

<div className="grid gap-2">
  <button className="btn btn-green btn--full"  onClick={() => setFreeChoice('easy')}>Easy</button>
  <button className="btn btn-yellow btn--full" onClick={() => setFreeChoice('normal')}>Normal</button>
  <button className="btn btn-orange btn--full" onClick={() => setFreeChoice('hard')}>Hard</button>
  <button className="btn btn-purple btn--full" onClick={() => setFreeChoice('master')}>Master</button>
</div>

{freeChoice && (
  <div className="mt-4 p-3 rounded-xl bg-white/75 text-slate-900">
    <div className="font-semibold">
      {DIFF_LABELS[freeChoice]}
    </div>
    <p className="text-sm mt-1">{DIFF_DESCRIPTIONS[freeChoice]}</p>

    <div className="mt-3 flex gap-2">
      <button
        className="btn btn-primary flex-1"
        onClick={() => {
          startWithDifficulty(freeChoice);
          setShowFreePlayChooser(false);
          setFreeChoice(null);
        }}
      >
        Play game
      </button>
      <button className="btn btn-neutral" onClick={() => setFreeChoice(null)}>
        Change
      </button>
    </div>
  </div>
)}

<div className="mt-4">
  <button
    className="btn btn-neutral w-full"
    onClick={() => { setShowFreePlayChooser(false); setFreeChoice(null); }}
  >
    Close
  </button>
</div>

    </div>
  </div>,
  document.body
)}


    {/* Existing About modal remains unchanged below */}
    {showAbout && createPortal(
      <div
        className="fixed inset-0 bg-black/50 z-[2147483646] grid place-items-center p-4 overflow-hidden"
        role="dialog"
        aria-modal="true"
        onClick={() => setShowAbout(false)}
      >
        <div
          className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-lg h-[85dvh] overflow-y-scroll"
          tabIndex={-1}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y'
          }}
          onClick={(e) => e.stopPropagation()}
        >
<h2 className="text-xl font-bold mb-4">About Postcode Pursuit</h2>

<p className="mb-3">
  Postcode Pursuit is a geography puzzle: travel from your <b>start</b> postcode area to the <b>target</b> by
  stepping through connected UK postcode areas. It’s inspired by the brilliant{" "}
  <a href="https://travle.earth" target="_blank" rel="noreferrer" className="text-indigo-600 underline">
    Travle
  </a>.
</p>

<h3 className="font-semibold mb-2">Connections</h3>
<ul className="list-disc list-inside space-y-1 mb-4">
  <li><b>Land borders</b> between postcode areas</li>
  <li><b>Ferries</b> — dashed lines</li>
  <li><b>Major bridges &amp; tunnels</b> — solid lines</li>
</ul>

<h3 className="font-semibold mb-2">Game Modes</h3>
<ul className="list-disc list-inside space-y-1 mb-4">
  <li>
    <b>Easy</b> — outlines and labels are visible. You may <b>revisit</b> previously visited areas.
  </li>
  <li>
    <b>Normal</b> — outlines are shown; labels are shown only on <b>Start</b> and <b>Visited</b> areas. Revisit is <b>allowed</b>.
  </li>
  <li>
    <b>Hard</b> — no outlines, no labels (connections still visible). Revisit is <b>blocked</b>.
  </li>
  <li>
    <b>Master</b> — only start/current/visited/target are visible; connections hidden. Revisit &amp; <b>Undo</b> are disabled.
  </li>
</ul>

<h3 className="font-semibold mb-2">Daily Challenge</h3>
<ul className="list-disc list-inside space-y-1 mb-4">
  <li>Pick a difficulty (Easy/Normal/Hard/Master) once per day.</li>
  <li>Progress auto-saves; you can <b>resume</b> later the same day.</li>
  <li><b>Hints:</b> up to 3 per day. Opening the hint panel consumes one.</li>
  <li><b>Streak:</b> win on consecutive days to build your daily streak.</li>
  <li>Share your result from the victory screen.</li>
</ul>

<h3 className="font-semibold mb-2">How to Play</h3>
<ul className="list-disc list-inside space-y-1 mb-4">
  <li>
    Use the <b>selection box</b> to enter a postcode. Submit with <b>Enter</b>.
  </li>
  <li>
    Pan/zoom the map; quick controls live at the <b>top-left</b> of the map (Zoom In/Out, Reset View).
  </li>
  <li>
    Use the <b>Menu</b> (top-right) for New Game, Restart, return to Menu, or Replay the Tutorial.
  </li>
</ul>

<h3 className="font-semibold mb-2">Tips &amp; Shortcuts</h3>
<ul className="list-disc list-inside space-y-1 mb-6">
  <li>Hints list neighbouring areas; click a suggestion to move there.</li>
  <li>Revisiting (Easy/Normal) helps explore; every move still counts as a guess.</li>
  <li>Keyboard: <b>Enter</b> submits; use <b>Ctrl/Cmd+Z</b> to undo a move.</li>
</ul>

<div className="sticky bottom-0 pt-3 bg-white">
  <button className="btn btn-primary w-full" onClick={() => setShowAbout(false)}>
    Close
  </button>
</div>
        </div>
      </div>,
      document.body
    )}
  </div>
);



return (
  <>
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {gameState === 'menu' ? renderMenu() : renderGameBoard()}
    </div>

    {/* Single OnboardingTutorial instance */}
<OnboardingTutorial
  isOpen={consentResolved && showTutorial}   // extra guard is fine
  onSkip={() => { localStorage.setItem(ONBOARDING_KEY, 'true'); setShowTutorial(false); }}
  onComplete={() => { localStorage.setItem(ONBOARDING_KEY, 'true'); setShowTutorial(false); }}
  postcodeAreas={postcodeAreas}
/>

    {victoryOpen && createPortal(
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 2147483647,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '10vh',
        padding: '10vh 16px 16px'
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
            {dailyMode && dailyStreak > 0 && <> · Streak: <b>{dailyStreak}</b></>}
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={shareResult} className="btn btn-purple glass">Share</button>


            <button
  onClick={() => {
    if (dailyMode) {
      setVictoryOpen(false);
      setGameState('menu'); // or show the completed daily again
    } else {
      startNewGame();
    }
  }}
  className="btn btn-warn glass"
>
  {dailyMode ? 'Back to Menu' : 'Play again'}
</button>


            <button onClick={() => setVictoryOpen(false)} className="btn btn-primary glass">Close</button>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
);
}