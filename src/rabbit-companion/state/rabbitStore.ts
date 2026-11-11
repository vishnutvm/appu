import { create } from 'zustand';
import { RabbitState, RabbitEmotion, AntiGravityAction } from '../types/rabbit';

export const useRabbitStore = create<RabbitState>((set, get) => ({
  emotion: 'happy',
  action: 'idle-floating',
  isBlinking: false,
  blinkProgress: 0,
  mouthOpen: 0,
  lookAtTarget: [0, 0, 2],
  isDragging: false,
  dragOffset: [0, 0, 0],
  hoverHeight: 0,
  spinAngle: 0,
  isSpinning: false,
  soundIntensity: 0,

  setEmotion: (emotion: RabbitEmotion) => set({ emotion }),

  setAction: (action: AntiGravityAction) => {
    if (action === 'spin') {
      get().triggerSpin();
    } else {
      set({ action, isSpinning: false });
    }
  },

  setBlink: (isBlinking: boolean, progress = isBlinking ? 1 : 0) =>
    set({ isBlinking, blinkProgress: progress }),

  setMouthOpen: (mouthOpen: number) => set({ mouthOpen }),

  setLookAtTarget: (target: [number, number, number]) => set({ lookAtTarget: target }),

  setIsDragging: (isDragging: boolean, offset: [number, number, number] = [0, 0, 0]) =>
    set({ isDragging, dragOffset: offset }),

  setHoverHeight: (hoverHeight: number) => set({ hoverHeight }),

  triggerSpin: () => {
    set({ action: 'spin', isSpinning: true });
  },

  setSoundIntensity: (soundIntensity: number) =>
    set({ soundIntensity, mouthOpen: Math.min(1, soundIntensity * 1.5) }),

  resetPose: () =>
    set({
      emotion: 'happy',
      action: 'idle-floating',
      isDragging: false,
      hoverHeight: 0,
      isSpinning: false,
      mouthOpen: 0,
    }),
}));
