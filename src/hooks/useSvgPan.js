import { useEffect, useRef, useCallback } from "react";

export default function useSvgPan(
  svgRef,
  gRef,
  { enabled = true, min = 0.4, max = 30, onChange } = {}
) {
  const s = useRef({
    x: 0,
    y: 0,
    scale: 1,
    pointers: new Map(),
    prev1: null,
    prev2: null,
    raf: 0,
  });

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // keep onChange stable for apply()
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const apply = useCallback(() => {
    const g = gRef.current;
    if (!g) return;
    const { x, y, scale: k } = s.current;
    g.setAttribute("transform", `matrix(${k} 0 0 ${k} ${x} ${y})`);
    onChangeRef.current?.({ x, y, scale: k });
  }, [gRef]);

  const getSVGPoint = useCallback(
    (clientX, clientY) => {
      const svg = svgRef.current;
      if (!svg) return { x: clientX, y: clientY };
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: clientX, y: clientY };
      const p = pt.matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
    [svgRef]
  );

  const schedule = useCallback(
    (fn) => {
      if (s.current.raf) return;
      s.current.raf = requestAnimationFrame(() => {
        s.current.raf = 0;
        fn();
        apply();
      });
    },
    [apply]
  );

  // --- Handlers ----------------------------------------------------

  const onPointerDown = useCallback(
    (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {}
      s.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      s.current.prev1 = { x: e.clientX, y: e.clientY };

      if (s.current.pointers.size === 2) {
        const pts = [...s.current.pointers.values()];
        const [a, b] = pts;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        s.current.prev2 = { d: Math.hypot(dx, dy) };
      }
    },
    [svgRef]
  );

  const onPointerUp = useCallback((e) => {
    s.current.pointers.delete(e.pointerId);
    s.current.prev1 = null;
    if (s.current.pointers.size < 2) s.current.prev2 = null;
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!s.current.pointers.has(e.pointerId)) return;
      s.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      schedule(() => {
        const pts = [...s.current.pointers.values()];

        if (pts.length === 1) {
          // pan
          const p = pts[0];
          const prev = s.current.prev1 || p;
          const prevSvg = getSVGPoint(prev.x, prev.y);
          const currSvg = getSVGPoint(p.x, p.y);
          s.current.x += currSvg.x - prevSvg.x;
          s.current.y += currSvg.y - prevSvg.y;
          s.current.prev1 = { ...p };
        } else if (pts.length === 2) {
          // pinch
          const [a, b] = pts;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (!s.current.prev2 || s.current.prev2.d === 0) {
            s.current.prev2 = { d };
            return;
          }
          const k = s.current.scale;
          const k2 = clamp(k * (d / s.current.prev2.d), min, max);

          // keep pinch midpoint fixed
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2;
          const { x: U, y: V } = getSVGPoint(cx, cy);
          const f = k2 / k;

          s.current.x = U * (1 - f) + f * s.current.x;
          s.current.y = V * (1 - f) + f * s.current.y;
          s.current.scale = k2;

          s.current.prev2 = { d };
        }
      });
    },
    [min, max, getSVGPoint, schedule]
  );

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      const k = s.current.scale;
      const step = Math.sign(e.deltaY) * -0.2;
      const k2 = clamp(k * (1 + step), min, max);

      const { x: U, y: V } = getSVGPoint(e.clientX, e.clientY);
      const f = k2 / k;

      s.current.x = U * (1 - f) + f * s.current.x;
      s.current.y = V * (1 - f) + f * s.current.y;
      s.current.scale = k2;

      apply();
    },
    [min, max, getSVGPoint, apply]
  );

  // --- Attach / detach listeners ----------------------------------

  useEffect(() => {
    if (!enabled) return;
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;

    svg.style.touchAction = "none";
    svg.addEventListener("pointerdown", onPointerDown, { passive: true });
    svg.addEventListener("pointermove", onPointerMove, { passive: true });
    svg.addEventListener("pointerup", onPointerUp, { passive: true });
    svg.addEventListener("pointercancel", onPointerUp, { passive: true });
    svg.addEventListener("wheel", onWheel, { passive: false });

    apply();

    return () => {
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerUp);
      svg.removeEventListener("wheel", onWheel);
    };
  }, [enabled, svgRef, gRef, onPointerDown, onPointerMove, onPointerUp, onWheel, apply]);

  // --- Programmatic controls --------------------------------------

  const zoomTo = useCallback(
    (targetScale, cxClient, cyClient) => {
      const svg = svgRef.current;
      if (!svg) return;

      const k = s.current.scale;
      const k2 = clamp(targetScale, min, max);

      const rect = svg.getBoundingClientRect();
      const cx = cxClient ?? rect.left + rect.width / 2;
      const cy = cyClient ?? rect.top + rect.height / 2;

      const { x: U, y: V } = getSVGPoint(cx, cy);
      const f = k2 / k;

      s.current.x = U * (1 - f) + f * s.current.x;
      s.current.y = V * (1 - f) + f * s.current.y;
      s.current.scale = k2;

      apply();
    },
    [min, max, getSVGPoint, apply, svgRef]
  );

  const reset = useCallback(
    ({ x = 0, y = 0, scale = 1 } = {}) => {
      s.current.x = x;
      s.current.y = y;
      s.current.scale = scale;
      apply();
    },
    [apply]
  );

  return {
    reset,
    zoomIn: (factor = 1.25) => zoomTo(s.current.scale * factor),
    zoomOut: (factor = 1.25) => zoomTo(s.current.scale / factor),
    zoomTo,
    getState: () => ({
      x: s.current.x,
      y: s.current.y,
      scale: s.current.scale,
    }),
  };
}
