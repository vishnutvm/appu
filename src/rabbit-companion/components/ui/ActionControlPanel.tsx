import React from 'react';
import { useRabbitStore } from '../../state/rabbitStore';
import { AntiGravityAction, RabbitEmotion } from '../../types/rabbit';

interface ActionControlPanelProps {
  enableOrbit: boolean;
  onToggleOrbit: () => void;
}

export const ActionControlPanel: React.FC<ActionControlPanelProps> = ({
  enableOrbit,
  onToggleOrbit,
}) => {
  const {
    action,
    emotion,
    mouthOpen,
    setAction,
    setEmotion,
    setMouthOpen,
    resetPose,
  } = useRabbitStore();

  const actions: { id: AntiGravityAction; label: string; icon: string }[] = [
    { id: 'idle-floating', label: 'Idle (Float)', icon: '✨' },
    { id: 'hover', label: 'Hover', icon: '🛸' },
    { id: 'spin', label: 'Anti-Gravity Spin', icon: '🌀' },
    { id: 'floating-sit', label: 'Floating Sit', icon: '🧘' },
    { id: 'hover-walk', label: 'Hover Walk', icon: '🚶' },
    { id: 'fly', label: 'Fly (Dive)', icon: '🚀' },
    { id: 'jump-float', label: 'Jump & Float', icon: '🦘' },
  ];

  const emotions: { id: RabbitEmotion; label: string }[] = [
    { id: 'happy', label: '😊 Happy' },
    { id: 'excited', label: '🤩 Excited' },
    { id: 'surprised', label: '😲 Surprised' },
    { id: 'thinking', label: '🤔 Thinking' },
    { id: 'listening', label: '👂 Listening' },
    { id: 'confused', label: '🤨 Confused' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        padding: '16px 20px',
        maxWidth: '92vw',
        width: '680px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 243, 255, 0.15)',
        zIndex: 50,
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Action Chips */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
          Anti-Gravity Actions
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {actions.map((act) => {
            const isActive = action === act.id;
            return (
              <button
                key={act.id}
                onClick={() => setAction(act.id)}
                style={{
                  background: isActive ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
                  border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isActive ? '#ffffff' : '#cbd5e1',
                  borderRadius: '12px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>{act.icon}</span>
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Emotion Chips */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
          Facial Expressions
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {emotions.map((emo) => {
            const isActive = emotion === emo.id;
            return (
              <button
                key={emo.id}
                onClick={() => setEmotion(emo.id)}
                style={{
                  background: isActive ? '#4f46e5' : 'rgba(255, 255, 255, 0.08)',
                  border: isActive ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isActive ? '#ffffff' : '#cbd5e1',
                  borderRadius: '12px',
                  padding: '5px 11px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {emo.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Voice/Mouth Open & Extra Utilities */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '10px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Mouth / Voice:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={mouthOpen}
            onChange={(e) => setMouthOpen(parseFloat(e.target.value))}
            style={{ width: '100px', accentColor: '#00f3ff', cursor: 'pointer' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onToggleOrbit}
            style={{
              background: enableOrbit ? '#059669' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              borderRadius: '10px',
              padding: '5px 10px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {enableOrbit ? '🔓 Free Orbit' : '🔒 Fixed Focus'}
          </button>

          <button
            onClick={resetPose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              borderRadius: '10px',
              padding: '5px 10px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
};
