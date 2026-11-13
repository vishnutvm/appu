export type AppuEmotion =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'thinking'
  | 'confused'
  | 'surprised'
  | 'wink'
  | 'sleepy'
  | 'focused'
  | 'hurt'
  | 'dizzy'
  | 'bored'
  | 'excited'
  | 'sad'
  | 'shy';

export type AppuAnimationState =
  | 'idle'
  | 'looking'
  | 'curious'
  | 'being_dragged'
  | 'released'
  | 'walking'
  | 'turning'
  | 'collision'
  | 'surprised'
  | 'recovering'
  | 'happy'
  | 'hurt'
  | 'dizzy'
  | 'sleepy'
  | 'interacting'
  | 'wave'
  | 'waving'
  | 'walk'
  | 'point'
  | 'sit'
  | 'arriving'
  | 'looking_around'
  // Greetings
  | 'cheer'
  | 'salute'
  | 'nod'
  | 'bow'
  | 'clap'
  // Sitting & Resting
  | 'sit_relaxed'
  | 'sit_legs_extended'
  | 'sit_cross_legged'
  | 'lie_down'
  | 'lie_down_side'
  | 'side_rest'
  | 'rest_head_on_hands'
  // Sleep
  | 'sleep'
  | 'deep_sleep'
  | 'sleep_side'
  | 'wake_up'
  | 'stretch'
  // Playful
  | 'handstand'
  | 'upside_down'
  | 'spin'
  | 'dance'
  | 'jump'
  | 'celebrate'
  | 'play_cursor'
  // Personality & Emotions
  | 'think'
  | 'confused'
  | 'bored'
  | 'excited'
  | 'sad'
  | 'shy'
  // Realistic Free-Fall Physics States
  | 'falling'
  | 'rising'
  | 'landing'
  | 'bouncing'
  // State machine transition states
  | 'returning_to_idle';

export type CompanionCharacterId = 'appu-3d' | 'rabbit-video' | 'human-video';

export type AppuFramingPreset = 'front' | 'threeQuarter' | 'side' | 'back' | 'portrait';

export type LightingPreset = 'studio' | 'dramatic' | 'warm' | 'cyber';

export interface CharacterControlState {
  // World Position (X, Z) on ground plane
  worldPosition: [number, number, number];

  // Appearance & Transform
  rotation: number; // Character Y yaw rotation in radians (-PI to PI)
  targetRotation: number;
  zoom: number; // Camera distance
  presetView: AppuFramingPreset;
  lightingPreset: LightingPreset;

  // Facial Expression
  emotion: AppuEmotion;

  // Animation & Behavior
  animationState: AppuAnimationState;
  animationSpeed: number;
  isPlaying: boolean;
  breathingEnabled: boolean;
  autoBlink: boolean;
  lookAtMouse: boolean; // Cursor Gaze Tracking

  // Realistic Interaction & Physics Settings
  collisionReactions: boolean;
  pettingEnabled: boolean;
  reactionIntensity: number; // 0.2 to 2.0
  movementSensitivity: number; // 0.2 to 2.0

  // Drag & Interaction state
  isGrabbed: boolean;
  isPetting: boolean;

  // Desktop companion / Transparent rendering preparation
  transparentBackground: boolean;
  groundShadowEnabled: boolean;
  showPedestal: boolean;
}

export const INITIAL_CONTROLS: CharacterControlState = {
  worldPosition: [0, 0, 0],
  rotation: 0,
  targetRotation: 0,
  zoom: 4.8,
  presetView: 'front',
  lightingPreset: 'studio',

  emotion: 'happy',

  animationState: 'idle',
  animationSpeed: 1.0,
  isPlaying: true,
  breathingEnabled: true,
  autoBlink: true,
  lookAtMouse: true,

  collisionReactions: true,
  pettingEnabled: true,
  reactionIntensity: 1.0,
  movementSensitivity: 1.0,

  isGrabbed: false,
  isPetting: false,

  transparentBackground: false,
  groundShadowEnabled: true,
  showPedestal: true,
};
