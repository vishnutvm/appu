import React from 'react';
import {
  Play,
  Pause,
  Compass,
  SunMedium,
  Camera,
  Settings,
  Smile,
  Maximize2,
  Hand,
  RotateCcw,
} from 'lucide-react';
import {
  CharacterControlState,
  AppuEmotion,
  AppuAnimationState,
  AppuFramingPreset,
  LightingPreset,
} from '../types/character';

interface CharacterControlsProps {
  controls: CharacterControlState;
  onChange: React.Dispatch<React.SetStateAction<CharacterControlState>>;
}

export const CharacterControls: React.FC<CharacterControlsProps> = ({
  controls,
  onChange,
}) => {
  const setActiveTab = (
    tab: 'animations' | 'expressions' | 'interactions' | 'camera' | 'lighting' | 'settings'
  ) => {
    onChange((prev) => ({ ...prev, activeTab: tab }));
  };

  const setAnimationState = (anim: AppuAnimationState) => {
    onChange((prev) => ({ ...prev, animationState: anim }));
  };

  const setEmotion = (emo: AppuEmotion) => {
    onChange((prev) => ({ ...prev, emotion: emo }));
  };

  const setPresetView = (view: AppuFramingPreset) => {
    onChange((prev) => ({ ...prev, presetView: view }));
  };

  const setLighting = (lighting: LightingPreset) => {
    onChange((prev) => ({ ...prev, lightingPreset: lighting }));
  };

  const togglePlay = () => {
    onChange((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChange((prev) => ({ ...prev, animationSpeed: val }));
  };

  const handleResetBehaviour = () => {
    window.dispatchEvent(new CustomEvent('appu-reset-behaviour'));
  };

  return (
    <>
      {/* 1. Left Vertical Navigation Sidebar */}
      <aside className="studio-left-sidebar">
        {/* Appu Studio Logo */}
        <div className="studio-brand">
          <div className="brand-robot-circle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="6" width="18" height="13" rx="5" stroke="#f6c344" strokeWidth="2" fill="rgba(246, 195, 68, 0.15)"/>
              <circle cx="8.5" cy="12" r="1.5" fill="#f6c344"/>
              <circle cx="15.5" cy="12" r="1.5" fill="#f6c344"/>
              <path d="M10.5 15C11 15.5 13 15.5 13.5 15" stroke="#f6c344" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 2V6" stroke="#f6c344" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="brand-text-label">Appu Studio</span>
        </div>

        {/* Navigation Items */}
        <nav className="studio-nav-list">
          <button
            className={`nav-item ${controls.activeTab === 'animations' ? 'active' : ''}`}
            onClick={() => setActiveTab('animations')}
          >
            <Compass size={17} />
            <span>Animations</span>
          </button>

          <button
            className={`nav-item ${controls.activeTab === 'expressions' ? 'active' : ''}`}
            onClick={() => setActiveTab('expressions')}
          >
            <Smile size={17} />
            <span>Expressions</span>
          </button>

          <button
            className={`nav-item ${controls.activeTab === 'interactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('interactions')}
          >
            <Hand size={17} />
            <span>Interactions</span>
          </button>

          <button
            className={`nav-item ${controls.activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
          >
            <Camera size={17} />
            <span>Camera</span>
          </button>

          <button
            className={`nav-item ${controls.activeTab === 'lighting' ? 'active' : ''}`}
            onClick={() => setActiveTab('lighting')}
          >
            <SunMedium size={17} />
            <span>Lighting</span>
          </button>

          <button
            className={`nav-item ${controls.activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>
        </nav>
      </aside>

      {/* 2. Right Floating Interactive Control Card */}
      <div className="studio-right-card">
        {/* Dynamic Section Header based on activeTab */}
        <div className="card-section-title">
          <span>
            {controls.activeTab === 'animations' && 'Animations & Poses'}
            {controls.activeTab === 'expressions' && 'Facial Expressions'}
            {controls.activeTab === 'interactions' && 'Realistic Interactions & Physics'}
            {controls.activeTab === 'camera' && 'Camera Angles & Turnaround'}
            {controls.activeTab === 'lighting' && 'Studio Lighting'}
            {controls.activeTab === 'settings' && 'Studio & Desktop Settings'}
          </span>
        </div>

        {/* TAB 1: ANIMATIONS */}
        {controls.activeTab === 'animations' && (
          <div className="anim-pill-row">
            {(
              [
                ['idle', 'Idle'],
                ['wave', 'Wave'],
                ['walk', 'Walk'],
                ['point', 'Point'],
                ['sit', 'Sit'],
              ] as const
            ).map(([anim, label]) => (
              <button
                key={anim}
                className={`anim-pill-btn ${
                  controls.animationState === anim ||
                  (anim === 'walk' && ['walking', 'turning', 'arriving'].includes(controls.animationState))
                    ? 'active'
                    : ''
                }`}
                onClick={() => setAnimationState(anim)}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* TAB 2: EXPRESSIONS */}
        {controls.activeTab === 'expressions' && (
          <div className="expression-icons-grid">
            {(
              [
                ['neutral', 'Neutral'],
                ['happy', 'Happy'],
                ['curious', 'Curious'],
                ['thinking', 'Thinking'],
                ['confused', 'Confused'],
                ['surprised', 'Surprised'],
                ['hurt', 'Hurt'],
                ['dizzy', 'Dizzy'],
                ['wink', 'Wink'],
                ['sleepy', 'Sleepy'],
                ['focused', 'Focused'],
              ] as const
            ).map(([emo, label]) => (
              <button
                key={emo}
                className={`expression-mini-card ${controls.emotion === emo ? 'active' : ''}`}
                onClick={() => setEmotion(emo)}
                title={label}
              >
                <div className="oled-mini-face">
                  {emo === 'happy' ? (
                    <svg width="24" height="14" viewBox="0 0 24 14">
                      <path d="M4 11C4 7 7 4 9 4" stroke="#ffae00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                      <path d="M15 11C15 7 18 4 20 4" stroke="#ffae00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    </svg>
                  ) : emo === 'hurt' ? (
                    <svg width="24" height="14" viewBox="0 0 24 14">
                      <path d="M4 3L8 7L4 11" stroke="#ffae00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                      <path d="M20 3L16 7L20 11" stroke="#ffae00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    </svg>
                  ) : emo === 'dizzy' ? (
                    <svg width="24" height="14" viewBox="0 0 24 14">
                      <path d="M5 7A2.5 2.5 0 0 1 8 5A3.5 3.5 0 1 1 5 8" stroke="#ffae00" strokeWidth="2" strokeLinecap="round" fill="none" />
                      <path d="M15 7A2.5 2.5 0 0 1 18 5A3.5 3.5 0 1 1 15 8" stroke="#ffae00" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                  ) : emo === 'wink' ? (
                    <svg width="24" height="14" viewBox="0 0 24 14">
                      <circle cx="7" cy="7" r="4.5" stroke="#ffae00" strokeWidth="2" fill="none" />
                      <line x1="15" y1="7" x2="21" y2="7" stroke="#ffae00" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  ) : emo === 'sleepy' || emo === 'focused' ? (
                    <svg width="24" height="14" viewBox="0 0 24 14">
                      <path d="M4 5C4 9 7 10 9 10" stroke="#ffae00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                      <path d="M15 5C15 9 18 10 20 10" stroke="#ffae00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    </svg>
                  ) : (
                    <svg width="24" height="14" viewBox="0 0 24 14">
                      <circle cx="7" cy="7" r="4.5" stroke="#ffae00" strokeWidth="2" fill="none" />
                      <circle cx="17" cy="7" r="4.5" stroke="#ffae00" strokeWidth="2" fill="none" />
                    </svg>
                  )}
                </div>
                <span className="mini-label">{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* TAB 3: INTERACTIONS (Section 9 dedicated controls) */}
        {controls.activeTab === 'interactions' && (
          <div className="settings-stack">
            {/* 1. Cursor tracking toggle */}
            <button
              className={`toggle-line-btn ${controls.lookAtMouse ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, lookAtMouse: !prev.lookAtMouse }))}
            >
              <span>Cursor Gaze Tracking</span>
              <span className="state-badge">{controls.lookAtMouse ? 'ON' : 'OFF'}</span>
            </button>

            {/* 2. Collision reactions toggle */}
            <button
              className={`toggle-line-btn ${controls.collisionReactions ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, collisionReactions: !prev.collisionReactions }))}
            >
              <span>Collision Reactions</span>
              <span className="state-badge">{controls.collisionReactions ? 'ON' : 'OFF'}</span>
            </button>

            {/* 3. Petting interaction toggle */}
            <button
              className={`toggle-line-btn ${controls.pettingEnabled ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, pettingEnabled: !prev.pettingEnabled }))}
            >
              <span>Head Petting Reaction</span>
              <span className="state-badge">{controls.pettingEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* 4. Natural blinking toggle */}
            <button
              className={`toggle-line-btn ${controls.autoBlink ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, autoBlink: !prev.autoBlink }))}
            >
              <span>Natural Blinking</span>
              <span className="state-badge">{controls.autoBlink ? 'ON' : 'OFF'}</span>
            </button>

            {/* 5. Reaction intensity slider */}
            <div className="slider-setting-row">
              <div className="slider-setting-header">
                <span>Reaction Intensity</span>
                <span className="slider-setting-val">{controls.reactionIntensity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={controls.reactionIntensity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChange((prev) => ({ ...prev, reactionIntensity: val }));
                }}
                className="speed-range-slider"
              />
            </div>

            {/* 7. Movement sensitivity slider */}
            <div className="slider-setting-row">
              <div className="slider-setting-header">
                <span>Movement Sensitivity</span>
                <span className="slider-setting-val">{controls.movementSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={controls.movementSensitivity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChange((prev) => ({ ...prev, movementSensitivity: val }));
                }}
                className="speed-range-slider"
              />
            </div>

            {/* 8. Reset behaviour button */}
            <button className="reset-action-btn" onClick={handleResetBehaviour}>
              <RotateCcw size={13} />
              <span>Reset Behaviour & State</span>
            </button>
          </div>
        )}

        {/* TAB 4: CAMERA */}
        {controls.activeTab === 'camera' && (
          <div className="anim-pill-row">
            {(
              [
                ['front', 'Front'],
                ['threeQuarter', '3/4 View'],
                ['side', 'Side'],
                ['back', 'Back'],
                ['portrait', 'Portrait'],
              ] as const
            ).map(([cam, label]) => (
              <button
                key={cam}
                className={`anim-pill-btn ${controls.presetView === cam ? 'active' : ''}`}
                onClick={() => setPresetView(cam)}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* TAB 5: LIGHTING */}
        {controls.activeTab === 'lighting' && (
          <div className="anim-pill-row">
            {(
              [
                ['studio', 'Studio'],
                ['dramatic', 'Dramatic'],
                ['warm', 'Warm'],
                ['cyber', 'Cyber'],
              ] as const
            ).map(([light, label]) => (
              <button
                key={light}
                className={`anim-pill-btn ${controls.lightingPreset === light ? 'active' : ''}`}
                onClick={() => setLighting(light)}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* TAB 6: SETTINGS */}
        {controls.activeTab === 'settings' && (
          <div className="settings-stack">
            <button
              className={`toggle-line-btn ${controls.breathingEnabled ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, breathingEnabled: !prev.breathingEnabled }))}
            >
              <span>Breathing Expansion</span>
              <span className="state-badge">{controls.breathingEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <button
              className={`toggle-line-btn ${controls.showPedestal ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, showPedestal: !prev.showPedestal }))}
            >
              <span>Gold Studio Pedestal</span>
              <span className="state-badge">{controls.showPedestal ? 'ON' : 'OFF'}</span>
            </button>
            <button
              className={`toggle-line-btn ${controls.transparentBackground ? 'active' : ''}`}
              onClick={() => onChange((prev) => ({ ...prev, transparentBackground: !prev.transparentBackground }))}
            >
              <span>Desktop Transparent Mode</span>
              <span className="state-badge">{controls.transparentBackground ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        )}

        {/* Bottom Playback & Speed Bar */}
        <div className="playback-footer-row">
          <button className="round-play-btn" onClick={togglePlay} title={controls.isPlaying ? 'Pause' : 'Play'}>
            {controls.isPlaying ? <Pause size={14} fill="#ffffff" /> : <Play size={14} fill="#ffffff" />}
          </button>

          <span className="speed-text">{controls.animationSpeed.toFixed(1)}x</span>
          <input
            type="range"
            min="0.2"
            max="2.0"
            step="0.1"
            value={controls.animationSpeed}
            onChange={handleSpeedChange}
            className="speed-range-slider"
          />

          <button
            className="icon-subtle-btn"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            title="Toggle Fullscreen"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
    </>
  );
};
