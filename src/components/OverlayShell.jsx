// OverlayShell.jsx
import React from "react";
import { createPortal } from "react-dom";

export default function OverlayShell({ open, onBackdrop, children }) {
  if (!open) return null;

  return createPortal(
    <div
      onClick={onBackdrop}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 2147483647,             // same as Victory modal
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "10vh",
        padding: "10vh 16px 16px",
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* stop backdrop click */}
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%" }}>
        {children}
      </div>
    </div>,
    document.body
  );
}
