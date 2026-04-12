import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorToast({ message, onClose }) {
  return (
    <div
      style={{
        borderRadius: 20,
        background: 'rgba(7,10,20,0.86)',
        border: '1px solid rgba(248,113,113,0.28)',
        boxShadow: '0 22px 60px rgba(0,0,0,0.35)',
        padding: 14,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        color: 'white',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          background: 'rgba(239,68,68,0.16)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={20} color="#fca5a5" />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Invalid move</div>
        <div style={{ color: 'rgba(255,255,255,0.76)', fontSize: 13, marginTop: 2 }}>
          {message}
        </div>
      </div>

      <button className="btn btn-neutral" onClick={onClose}>Dismiss</button>
    </div>
  );
}