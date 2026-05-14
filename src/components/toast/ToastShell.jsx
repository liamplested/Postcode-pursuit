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
        overflow: 'hidden',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: `${width}px`,
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
