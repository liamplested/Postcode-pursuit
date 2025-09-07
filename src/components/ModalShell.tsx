import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;              // id of your <h2>
  children: React.ReactNode;
  contentClassName?: string;        // optional extra classes for the card
};

export default function ModalShell({
  open,
  onClose,
  labelledBy,
  children,
  contentClassName,
}: ModalShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus the card when opened (basic focus trap entry point)
  useEffect(() => {
    if (open) requestAnimationFrame(() => contentRef.current?.focus());
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[2147483646] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onClose}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`glass p-5 rounded-2xl shadow-xl w-[92vw] max-w-2xl max-h-[84vh] overflow-y-auto outline-none ${contentClassName ?? ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
