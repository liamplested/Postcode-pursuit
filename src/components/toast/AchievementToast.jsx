import React from 'react';
import { Trophy } from 'lucide-react';

export default function AchievementToast({ icon, title, description, onClose }) {
  return (
    <div
      style={{
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 28px 60px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(9,14,28,0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        color: 'white',
      }}
    >
      <div style={{ height: 4, background: 'linear-gradient(90deg, #22c55e, #06b6d4, #8b5cf6)' }} />
      <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: 'rgba(34,197,94,0.18)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {icon ? <span style={{ fontSize: 20 }}>{icon}</span> : <Trophy size={22} />}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Achievement unlocked</div>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 4 }}>
            <strong>{title}</strong> — {description}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-success" onClick={onClose}>Nice</button>
            <button className="btn btn-neutral" onClick={onClose}>Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
}