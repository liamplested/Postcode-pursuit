import React, { useState, useEffect } from 'react';
import { MapPin, Target, RotateCcw, Trophy, Eye, EyeOff } from 'lucide-react';
import { postcodeAreas } from './postcodeAreas';

const PostcodeTravle = () => {
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

useEffect(() => {
  console.log("Loaded postcode areas:", Object.keys(postcodeAreas).length);
  console.log("Sample path:", postcodeAreas["AB"]?.path?.slice(0, 100));
}, []);

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
  };

  const makeGuess = (area) => {
    if (gameWon) return;

    const currentLocation = currentPath[currentPath.length - 1];
    const isValidMove = postcodeAreas[currentLocation]?.neighbors.includes(area);
    const alreadyVisited = currentPath.includes(area);

    setGuesses([...guesses, { area, valid: isValidMove, alreadyVisited }]);
    setAttempts(attempts + 1);

    if (isValidMove && !alreadyVisited) {
      const newPath = [...currentPath, area];
      setCurrentPath(newPath);
      if (area === targetArea) setGameWon(true);
    }

    setSuggestion('');
  };

const getAreaColor = (code) => {
  if (code === startArea) return '#22c55e';
  if (code === targetArea) return '#ef4444';
  
  const guess = guesses.find(g => g.area === code);
  
  if (guess) {
    if (guess.valid && !guess.alreadyVisited) return '#22c55e'; // green for valid new move
    return '#f97316'; // orange for invalid or already visited
  }

  if (currentPath.includes(code)) return '#3b82f6'; // blue for visited
  return '#f3f4f6'; // grey for unvisited
};

  const getAreaStroke = (code) => {
    if (code === startArea || code === targetArea) return '#000';
    if (currentPath.includes(code)) return '#1d4ed8';
    return showOutlines ? '#d1d5db' : 'none';
  };

  const getHint = () => {
    const currentLocation = currentPath[currentPath.length - 1];
    const validNeighbors = postcodeAreas[currentLocation]?.neighbors.filter(n => !currentPath.includes(n)) || [];
    if (validNeighbors.length > 0) {
      const n = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
      setSuggestion(`Try ${n}`);
    }
  };

  const renderMap = () => (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">UK Postcode Areas</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowOutlines(!showOutlines)} className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200">
            {showOutlines ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} Outlines
          </button>
          <button onClick={() => setShowLabels(!showLabels)} className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200">
            {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} Labels
          </button>
        </div>
      </div>

      <div className="relative">
        <svg viewBox="0 0 25000 37500" className="w-full h-auto border rounded">

          {Object.entries(postcodeAreas).map(([code, area]) => (
            <g key={code}>
              <path
                d={area.path}
                fill={getAreaColor(code)}
                stroke={getAreaStroke(code)}
                strokeWidth={showOutlines ? 25 : 0}
                className="hover:opacity-80 cursor-pointer transition-opacity"
                onClick={() => !gameWon && makeGuess(code)}
              />
              {showLabels && area.center && (
<text
  x={area.center?.x}
  y={area.center?.y}
  textAnchor="middle"
  dominantBaseline="middle"
  fontSize="200"        // big enough for your scale
  fontWeight="bold"
  className="pointer-events-none select-none"
  fill={
    currentPath.includes(code) || code === startArea || code === targetArea
      ? 'white'
      : 'black'
  }
>
  {showLabels ? code : ''}
</text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );

  const renderGameBoard = () => (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>{renderMap()}</div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Travel from {startArea} to {targetArea}</h2>
            {gameWon ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <div className="flex justify-center items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  Completed in {currentPath.length - 1} steps!
                </div>
                <div className="text-sm mt-1">
                  Optimal: {optimalPath.length - 1} steps
                </div>
              </div>
            ) : (
              <div className="text-gray-600">Current: <strong>{currentPath[currentPath.length - 1]}</strong></div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="font-semibold">Journey:</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {currentPath.map((a, i) => (
                <span key={i} className={`px-3 py-1 rounded ${a === targetArea ? 'bg-green-500 text-white' : i === currentPath.length - 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{a}</span>
              ))}
            </div>
          </div>

          {!gameWon && suggestion && <div className="text-blue-500 mb-4">{suggestion}</div>}

          {!gameWon && (
            <>
              <div className="mb-6">
                <h3 className="font-semibold">Try any postcode:</h3>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    className="flex-1 p-2 border rounded"
                    placeholder="e.g. M, B, AB"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.target.value.toUpperCase().trim();
                        if (postcodeAreas[val]) {
                          makeGuess(val);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <button onClick={getHint} className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">Hint</button>
                </div>
              </div>

              {guesses.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Recent Attempts ({attempts})</h3>
                  <div className="flex flex-wrap gap-2">
                    {guesses.slice(-10).map((g, i) => (
                      <span key={i} className={`px-2 py-1 rounded text-sm ${
                        g.valid && !g.alreadyVisited ? 'bg-green-200 text-green-800' :
                        g.alreadyVisited ? 'bg-yellow-200 text-yellow-800' :
                        'bg-red-200 text-red-800'
                      }`}>
                        {g.area}{g.alreadyVisited ? ' (visited)' : ''}{!g.valid ? ' (invalid)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-4 justify-center">
            <button onClick={startNewGame} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> New Game
            </button>
            <button onClick={() => setGameState('menu')} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMenu = () => (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg text-center">
      <MapPin className="w-16 h-16 mx-auto text-blue-500 mb-4" />
      <h1 className="text-3xl font-bold text-gray-800 mb-2">UK Postcode Travle</h1>
      <p className="text-gray-600 mb-4">Navigate between UK postcode areas by following their geographical connections!</p>
      <button onClick={startNewGame} className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 mx-auto">
        <Target className="w-5 h-5" /> Start Playing
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      {gameState === 'menu' ? renderMenu() : renderGameBoard()}
    </div>
  );
};

export default PostcodeTravle;
