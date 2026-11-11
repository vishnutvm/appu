import * as THREE from 'three';

export type RabbitEmotion =
  | 'happy'
  | 'surprised'
  | 'thinking'
  | 'listening'
  | 'confused'
  | 'excited'
  | 'neutral';

export type AntiGravityAction =
  | 'idle-floating'
  | 'hover'
  | 'spin'
  | 'floating-sit'
  | 'hover-walk'
  | 'fly'
  | 'jump-float';

export interface RabbitRigRefs {
  rootRef: React.RefObject<THREE.Group | null>;
  headRef: React.RefObject<THREE.Group | null>;
  leftEarRef: React.RefObject<THREE.Group | null>;
  rightEarRef: React.RefObject<THREE.Group | null>;
  leftArmRef: React.RefObject<THREE.Group | null>;
  rightArmRef: React.RefObject<THREE.Group | null>;
  leftLegRef: React.RefObject<THREE.Group | null>;
  rightLegRef: React.RefObject<THREE.Group | null>;
  leftFootRef: React.RefObject<THREE.Group | null>;
  rightFootRef: React.RefObject<THREE.Group | null>;
  tailRef: React.RefObject<THREE.Group | null>;
}

export interface RabbitState {
  emotion: RabbitEmotion;
  action: AntiGravityAction;
  isBlinking: boolean;
  blinkProgress: number;
  mouthOpen: number;
  lookAtTarget: [number, number, number];
  isDragging: boolean;
  dragOffset: [number, number, number];
  hoverHeight: number;
  spinAngle: number;
  isSpinning: boolean;
  soundIntensity: number;

  // Actions
  setEmotion: (emotion: RabbitEmotion) => void;
  setAction: (action: AntiGravityAction) => void;
  setBlink: (isBlinking: boolean, progress?: number) => void;
  setMouthOpen: (open: number) => void;
  setLookAtTarget: (target: [number, number, number]) => void;
  setIsDragging: (dragging: boolean, offset?: [number, number, number]) => void;
  setHoverHeight: (height: number) => void;
  triggerSpin: () => void;
  setSoundIntensity: (intensity: number) => void;
  resetPose: () => void;
}
