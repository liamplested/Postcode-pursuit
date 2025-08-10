import { useEffect, useRef } from "react";

export default function useSvgPan(svgRef, gRef, { enabled = true } = {}) {
  const s = useRef({
    x: 0, y: 0, scale: 1,
    pointers: new Map(),
    prev1: null,
    raf: 0,
  });

  const apply = () => {
    const g = gRef.current;
    if (!g) return;
    g.setAttribute("transform", `translate(${s.current.x} ${s.current.y}) scale(${s.current.scale})`);
  };

  const getSVGPoint = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const schedule = (fn) => {
    if (s.current.raf) return;
    s.current.raf = requestAnimationFrame(() => {
      s.current.raf = 0;
      fn();
      apply();
    });
  };

  const onPointerDown = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    try { svg.setPointerCapture(e.pointerId); } catch {}
    s.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    s.current.prev1 = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e) => {
    s.current.pointers.delete(e.pointerId);
    s.current.prev1 = null;
  };

  const onPointerMove = (e) => {
    if (!s.current.pointers.has(e.pointerId)) return;
    s.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    schedule(() => {
      const pts = [...s.current.pointers.values()];
      if (pts.length !== 1) return; // pan-only
      const p = pts[0];
      const prev = s.current.prev1 || p;

      const prevSvg = getSVGPoint(prev.x, prev.y);
      const currSvg = getSVGPoint(p.x, p.y);
      s.current.x += (currSvg.x - prevSvg.x);
      s.current.y += (currSvg.y - prevSvg.y);

      s.current.prev1 = { ...p };
    });
  };

// check gamestart loads
useEffect(() => {
  if (!enabled) { 
    console.log('[pan] disabled');
    return;
  }
  console.log('[pan] trying to bind…', { svg: !!svgRef.current, g: !!gRef.current });

  const svg = svgRef.current;
  const g = gRef.current;
  if (!svg || !g) return;

  console.log('[pan] bound listeners');
  // ...
}, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;           // wait until actually mounted

    svg.style.touchAction = "none";

    svg.addEventListener("pointerdown", onPointerDown, { passive: true });
    svg.addEventListener("pointermove", onPointerMove, { passive: true });
    svg.addEventListener("pointerup", onPointerUp, { passive: true });
    svg.addEventListener("pointercancel", onPointerUp, { passive: true });

    apply(); // initial

    return () => {
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerUp);
    };
    // include .current so this re-runs when refs get populated after menu->playing
  }, [enabled, svgRef.current, gRef.current]);

  return {
    reset: ({ x = 0, y = 0, scale = 1 } = {}) => {
      s.current.x = x; s.current.y = y; s.current.scale = scale;
      apply();
    },
    getState: () => ({ x: s.current.x, y: s.current.y, scale: s.current.scale }),
  };
}
