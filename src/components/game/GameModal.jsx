import React from 'react';
import { createPortal } from 'react-dom';

export default function GameModal({ open, onClose, title, children }) {
  if (!open) return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 2147483647,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '10vh',
        padding: '10vh 16px 16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="glass glass--white p-5 rounded-2xl shadow-xl text-left"
        style={{
          maxWidth: 520,
          width: '92vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 id="modal-title" className="text-xl font-semibold mb-3">{title}</h2>}
        {children}
        <div className="mt-4">
          <button className="btn btn-primary w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
