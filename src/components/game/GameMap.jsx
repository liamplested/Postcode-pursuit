import React from 'react';
import { bridgeLinks, ferryLinks, postcodeAreas } from '../../postcodeAreas';

function makeSpx(scale, mult = 1) {
  const s = Math.max(Number(scale || 1), 0.0001);
  return (n) => (mult * n) / s;
}

function Callout({ code, label, color, getCenter, scale }) {
  const c = getCenter(code);
  if (!c) return null;

  const CALLOUT_MULT = 7;
  const CAP = {
    stroke: 0.1,
    dot: 14,
    halo1: 40,
    halo2: 80,
    bubbleW: 320,
    bubbleH: 96,
    radius: 18,
    font: 24,
    notch: 18,
  };
  const spx = makeSpx(scale, CALLOUT_MULT);

  const WESTish = ['W', 'NW', 'SW', 'HA', 'UB', 'TW', 'KT', 'SM'];
  const EASTish = ['E', 'N', 'SE', 'IG', 'EN', 'RM', 'BR', 'CR', 'DA'];
  const offsetFor = (value) => {
    if (value === 'WC' || value === 'EC') return { ox: 0, oy: -spx(120) };
    if (WESTish.includes(value)) return { ox: -spx(140), oy: -spx(40) };
    if (EASTish.includes(value)) return { ox: spx(140), oy: -spx(40) };
    return { ox: spx(120), oy: -spx(60) };
  };

  const { ox, oy } = offsetFor(code);
  const bx = c.x + ox;
  const by = c.y + oy;

  const sw = spx(0.1, CAP.stroke);
  const rDot = spx(9, CAP.dot);
  const r1 = spx(28, CAP.halo1);
  const r2 = spx(46, CAP.halo2);
  const bw = spx(220, CAP.bubbleW);
  const bh = spx(100, CAP.bubbleH);
  const br = spx(14, CAP.radius);
  const font = spx(30, CAP.font);
  const notch = spx(1, CAP.notch);

  return (
    <g pointerEvents="none">
      <line x1={c.x} y1={c.y} x2={bx} y2={by} stroke={color} strokeWidth={sw} opacity="0.5" />
      <circle cx={c.x} cy={c.y} r={r2} fill={color} opacity="0.08" />
      <circle cx={c.x} cy={c.y} r={r1} fill={color} opacity="0.14" />
      <circle cx={c.x} cy={c.y} r={rDot} fill={color} />
      <path
        d={`M ${bx - notch} ${by + bh / 2 - 1} L ${c.x} ${c.y} L ${bx + notch} ${by + bh / 2 - 1}`}
        fill={color}
        opacity="0.92"
      />
      <rect
        x={bx - bw / 2}
        y={by - bh / 2}
        width={bw}
        height={bh}
        rx={br}
        fill={color}
        opacity="0.92"
        filter="url(#pp-bubble-shadow)"
      />
      <text
        x={bx}
        y={by + font * 0.12}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontWeight="800"
        fontSize={font}
      >
        {label}
      </text>
    </g>
  );
}

function CurrentMarker({ id, centroidsRef, mapStyle = 'standard' }) {
  const c = centroidsRef.current[id];
  if (!c) return null;
  const stroke = mapStyle === 'night' ? '#bfdbfe' : '#1d4ed8';
  return (
    <g pointerEvents="none">
      <circle cx={c.x} cy={c.y} r={1} fill={stroke} opacity="0.9" />
      <circle
        cx={c.x}
        cy={c.y}
        r={1}
        className="[transform-box:fill-box] [transform-origin:center] animate-ping fill-transparent stroke-2 opacity-60"
        stroke={stroke}
      />
    </g>
  );
}

function StepBadge({ id, index, centroidsRef, mapStyle = 'standard' }) {
  const c = centroidsRef.current[id];
  if (!c) return null;
  const night = mapStyle === 'night';
  return (
    <g pointerEvents="none">
      <circle cx={c.x} cy={c.y} r={9} fill={night ? '#0f172a' : '#ffffff'} stroke={night ? '#e0f2fe' : '#334155'} />
      <text x={c.x} y={c.y + 4} textAnchor="middle" fill={night ? '#f8fafc' : '#0f172a'} className="text-[10px] font-semibold">
        {index + 1}
      </text>
    </g>
  );
}

function OptimalPathOverlay({ optimalPath }) {
  const pts = optimalPath.map((code) => postcodeAreas[code]?.center).filter(Boolean);
  if (pts.length < 2) return null;

  const pointsAttr = pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <g pointerEvents="none">
      <polyline points={pointsAttr} fill="none" stroke="#000" strokeOpacity="0.1" strokeWidth={15} vectorEffect="non-scaling-stroke" />
      <polyline points={pointsAttr} fill="none" stroke="#8b5cf6" strokeOpacity="0.5" strokeWidth={8} vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={120} fill="#8b5cf6" fillOpacity="0.9" />
          <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="160" fontWeight="700" fill="white">
            {i}
          </text>
        </g>
      ))}
    </g>
  );
}

export default function GameMap({
  WORLD,
  arcPath,
  arcPathBridge,
  arcPathFerry,
  attachPathRef,
  canClickAreas,
  centroidsRef,
  contentRef,
  currentArea,
  currentPath,
  difficulty,
  ferryLinks: ferryRoutes = ferryLinks,
  flashAreas,
  gameWon,
  roundResolved,
  getAreaStyle,
  getCenter,
  gRef,
  handleClick,
  isRevealed,
  labelVisibleAtScale,
  landClipId,
  linkPaint,
  masterMode,
  optimalPath,
  scaleForLabels,
  showLabels,
  showOptimal,
  showOutlines,
  startArea,
  svgFontSizeForScale,
  svgRef,
  targetArea,
  mapStyle = 'standard',
}) {
  const nightMap = mapStyle === 'night';
  const labelFill = nightMap ? '#f8fafc' : '#1f2937';
  const labelStroke = nightMap ? '#0f172a' : '#ffffff';

  return (
    <div
      className="pp-map-canvas glass glass--map mx-auto relative"
      style={{ width: '99%', maxWidth: '900px', overflow: 'hidden', borderRadius: 16 }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="block"
        viewBox={`${WORLD.x} ${WORLD.y} ${WORLD.width} ${WORLD.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ touchAction: 'none', display: 'block' }}
      >
        <rect x={WORLD.x} y={WORLD.y} width={WORLD.width} height={WORLD.height} fill="transparent" pointerEvents="all" />
        <defs>
          <filter id="pp-bubble-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
          </filter>
        </defs>
        <defs>
          {masterMode && (
            <clipPath id={landClipId} clipPathUnits="userSpaceOnUse">
              {Object.entries(postcodeAreas).map(([code, area]) => (
                <path key={`clip-${code}`} d={area.path} />
              ))}
            </clipPath>
          )}
          <pattern id="pp-invalid-stripes" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="#ffffffff" />
            <path d="M0 0 L0 10" stroke="#111" strokeWidth="4" opacity="0.01" />
          </pattern>
        </defs>

        <g ref={gRef}>
          <g
            ref={contentRef}
            clipPath={masterMode ? `url(#${landClipId})` : undefined}
            shapeRendering={showOutlines ? undefined : 'crispEdges'}
          >
            {!masterMode && Array.isArray(bridgeLinks) && bridgeLinks.length > 0 && (
              <g pointerEvents="none" aria-label="Bridges and tunnels">
                {bridgeLinks.map(({ a, b, type }, i) => {
                  if (!postcodeAreas[a] || !postcodeAreas[b]) return null;
                  const d = (type === 'bridge' ? arcPathBridge : arcPathFerry)(a, b);
                  if (!d) return null;

                  const { stroke, width, dash } = linkPaint(type);
                  const A = getCenter(a);
                  const B = getCenter(b);

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
                      <circle cx={A.x} cy={A.y} r={Math.max(6, width * 0.6)} fill={stroke} vectorEffect="non-scaling-stroke" />
                      <circle cx={B.x} cy={B.y} r={Math.max(6, width * 0.6)} fill={stroke} vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
              </g>
            )}

            {Object.entries(postcodeAreas).map(([code, area]) => {
              const isCurrent = !gameWon && currentArea && code === currentArea && code !== targetArea;
              const extra = [
                flashAreas.includes(code) ? 'animate-shake [animation-duration:.25s]' : '',
                isCurrent ? 'area-pulse' : '',
              ].join(' ').trim();

              const hidden = !isRevealed(code) ? 'opacity-0 pointer-events-none' : '';
              return (
                <path
                  key={code}
                  ref={attachPathRef(code)}
                  d={area.path}
                  style={getAreaStyle(code)}
                  className={`hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white ${extra} ${hidden}`}
                  onClick={canClickAreas ? () => handleClick(code) : undefined}
                  onKeyDown={canClickAreas ? (e) => (e.key === 'Enter' || e.key === ' ') && handleClick(code) : undefined}
                  tabIndex={canClickAreas ? 0 : -1}
                  aria-label={code}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>

          {!masterMode && Array.isArray(ferryRoutes) && ferryRoutes.length > 0 && (
            <g pointerEvents="none" aria-label="Ferry routes">
              {ferryRoutes.map(({ a, b }, i) => {
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

          {Object.entries(postcodeAreas).map(([code, area]) => {
            if (!isRevealed(code)) return null;

            const isStart = code === startArea;
            const isTarget = code === targetArea;
            const isVisited = currentPath.includes(code);
            const baseShouldShow = showLabels || (difficulty === 'normal' && (isStart || isVisited));
            if (!baseShouldShow) return null;

            const scaleNow = Number(scaleForLabels ?? 1);
            const zoomOK = isStart || isTarget || labelVisibleAtScale(code, scaleNow);
            if (!zoomOK) return null;

            const c = area.center || centroidsRef.current[code];
            if (!c) return null;

            return (
              <text
                key={`label-${code}`}
                x={c.x}
                y={c.y}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{ fontSize: svgFontSizeForScale(scaleForLabels) }}
                fill={labelFill}
                stroke={labelStroke}
                strokeWidth={4}
                paintOrder="stroke"
                vectorEffect="non-scaling-stroke"
              >
                {code}
              </text>
            );
          })}

          <g id="callouts-overlay">
            {startArea && <Callout code={startArea} label={`Start: ${startArea}`} color="#167903ff" getCenter={getCenter} scale={scaleForLabels || 1} />}
            {targetArea && <Callout code={targetArea} label={`Target: ${targetArea}`} color="#da5903ff" getCenter={getCenter} scale={scaleForLabels || 1} />}
          </g>

          {currentArea && <CurrentMarker id={currentArea} centroidsRef={centroidsRef} mapStyle={mapStyle} />}
          {currentPath.map((id, i) => (
            <StepBadge key={`b-${id}`} id={id} index={i} centroidsRef={centroidsRef} mapStyle={mapStyle} />
          ))}

          {(roundResolved ?? gameWon) && showOptimal && <OptimalPathOverlay optimalPath={optimalPath} />}
        </g>
      </svg>
    </div>
  );
}
