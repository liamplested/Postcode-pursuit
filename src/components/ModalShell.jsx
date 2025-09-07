import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ModalShell({
  open,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  children,
}) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock page scroll while open
  useEffect(() => {
    if (!open) return;
    const { style: html } = document.documentElement;
    const { style: body } = document.body;
    const prevHtml = html.overflow;
    const prevBody = body.overflow;
    html.overflow = 'hidden';
    body.overflow = 'hidden';
    return () => { html.overflow = prevHtml; body.overflow = prevBody; };
  }, [open]);

  // Focus panel on open
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => panelRef.current?.focus?.());
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const node = (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 z-[2147483647] flex items-start justify-center p-4"
      style={{ paddingTop: '10vh' }}
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <div
        ref={panelRef}
        className="glass rounded-2xl shadow-xl w-[92vw] max-w-[520px] max-h-[80vh] overflow-y-auto outline-none"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
