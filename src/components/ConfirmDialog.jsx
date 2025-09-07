// ConfirmDialog.jsx
import React from "react";
import OverlayShell from "./OverlayShell";

export default function ConfirmDialog({
  open,
  title = "Give up?",
  message = "Give up and record a loss? This will count in your stats.",
  confirmLabel = "Give up",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  // lock scroll while open
  React.useEffect(() => {
    if (!open) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  // keyboard shortcuts
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if (e.key === "Enter") onConfirm?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  return (
    <OverlayShell open={open} onBackdrop={onCancel}>
      <div
        className="glass p-5 rounded-2xl shadow-xl text-center mx-auto"
        style={{
          maxWidth: 520,
          width: "92vw",
          maxHeight: "80vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        {message && <p className="text-sm opacity-90 mb-4">{message}</p>}
        <div className="flex justify-center gap-2">
          <button className="btn btn-neutral" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn btn-warn" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </OverlayShell>
  );
}
