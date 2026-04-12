import React from 'react';
import { createPortal } from 'react-dom';

export default function ToastShell({ open, onClose, children, width = 420 }) {
  if (!open) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        pointerEvents: 'none',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: `${width}px`,
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}