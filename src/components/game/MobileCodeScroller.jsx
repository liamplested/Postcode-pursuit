import React from 'react';

export default function MobileCodeScroller({
  current,
  onPick,
  getNeighbors,
  currentPath,
  allCodes,
  showNeighborsToggle = false,
}) {
  const [mode, setMode] = React.useState(showNeighborsToggle ? 'neighbors' : 'search');
  const [query, setQuery] = React.useState('');

  const normCodes = React.useMemo(
    () => Array.from(new Set(allCodes.map((c) => String(c).toUpperCase()))).sort(),
    [allCodes]
  );

  const neighborOptions = React.useMemo(() => {
    if (!current) return [];
    return getNeighbors(current).filter((n) => !currentPath.includes(n));
  }, [current, getNeighbors, currentPath]);

  const pushLetter = (ch) => {
    const L = String(ch || '').toUpperCase();
    if (!/^[A-Z]$/.test(L)) return;
    setQuery((q) => (q + L).slice(0, 2));
  };
  const backspace = () => setQuery((q) => q.slice(0, -1));
  const clearQuery = () => setQuery('');

  const searchOptions = React.useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const exact = normCodes.filter((c) => c === q);
    const starts = normCodes.filter((c) => c.startsWith(q) && c !== q);
    const contains = normCodes.filter((c) => !c.startsWith(q) && c.includes(q));
    return [...exact, ...starts, ...contains];
  }, [normCodes, query]);

  const options = mode === 'neighbors' ? neighborOptions : searchOptions;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const railLabel =
    mode === 'neighbors'
      ? 'Available neighbours'
      : query.length > 0
        ? 'Matching postcodes'
        : 'Suggested postcodes';

  const railContent =
    mode === 'neighbors'
      ? (neighborOptions.length ? neighborOptions : null)
      : (query.length > 0 ? options : null);

  return (
    <div className="glass glass--white p-5 rounded-0xl shadow-xl text-left">
      <div className="flex items-center justify-between px-3 pb-1">
        <div className="text-xs opacity-80">
          {mode === 'neighbors'
            ? 'Neighbours'
            : query
              ? <>Typing: <b>{query}</b></>
              : 'Type a code (1-2 letters)...'}
        </div>

        {showNeighborsToggle && (
          <div className="flex gap-1">
            <button
              type="button"
              className={`badge ${mode === 'neighbors' ? 'badge-blue' : 'badge-gray'}`}
              onClick={() => setMode('neighbors')}
              aria-pressed={mode === 'neighbors'}
            >
              Neighbours
            </button>
            <button
              type="button"
              className={`badge ${mode !== 'neighbors' ? 'badge-blue' : 'badge-gray'}`}
              onClick={() => setMode('search')}
              aria-pressed={mode !== 'neighbors'}
            >
              Search
            </button>
          </div>
        )}
      </div>

      {mode !== 'neighbors' && (
        <div className="mx-3 mb-2 p-2 rounded-lg bg-slate-900/10">
          {alphabet.map((L) => (
            <button key={L} type="button" onClick={() => pushLetter(L)} className="btn btn-white text-sm" aria-label={`Type ${L}`}>
              {L}
            </button>
          ))}
          <br />
          <button type="button" onClick={backspace} className="btn btn-white col-span-2 text-sm">
            Backspace
          </button>
          <button type="button" onClick={clearQuery} className="btn btn-white col-span-2 text-sm">
            Clear
          </button>
        </div>
      )}

      <div className="pp-mobile-option-rail mx-3 mb-3" role="listbox" aria-label={railLabel}>
        {railContent ? (
          railContent.map((code) => (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={false}
              className={`btn btn-green hover:brightness-95 pp-mobile-option-chip ${
                mode !== 'neighbors' && code === query ? 'ring-1 ring-indigo-500 font-semibold' : ''
              }`}
              onClick={() => {
                onPick?.(code);
                if (mode !== 'neighbors') clearQuery();
              }}
              aria-label={`Select ${code}`}
            >
              {code}
            </button>
          ))
        ) : (
          <span className="pp-mobile-option-empty">
            {mode === 'neighbors'
              ? 'No unvisited neighbours'
              : query.length > 0
                ? 'No matches'
                : 'Matching postcode options will appear here'}
          </span>
        )}
      </div>
    </div>
  );
}
