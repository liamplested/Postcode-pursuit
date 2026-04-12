import React from 'react';
import { Lightbulb } from 'lucide-react';

export default function TipToast({ title = 'Tip', eyebrow, children, onClose, action }) {
  return (
    <div
      style={{
        borderRadius: 24,
        background: 'rgba(255,248,225,0.95)',
        color: '#1f2937',
        border: '1px solid rgba(250,204,21,0.55)',
        boxShadow: '0 22px 60px rgba(0,0,0,0.25)',
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            background: 'rgba(251,191,36,0.22)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Lightbulb size={20} />
        </div>

        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
          {eyebrow && <div style={{ fontSize: 13, color: '#475569' }}>{eyebrow}</div>}
        </div>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.5 }}>{children}</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        {action && (
          <button className="btn btn-primary" onClick={action.onClick}>
            {action.label}
          </button>
        )}
        <button className="btn btn-neutral" onClick={onClose}>Dismiss</button>
      </div>
    </div>
  );
}