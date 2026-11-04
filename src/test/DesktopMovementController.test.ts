import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DesktopMovementController } from '../controllers/DesktopMovementController';

describe('DesktopMovementController: Drag, Drop, Placement Stability and Free-Fall Triggering', () => {
  let controller: DesktopMovementController;
  let stateChanges: Array<{ state: string; emotion: string; facing: number }>;

  beforeEach(() => {
    vi.useFakeTimers();
    stateChanges = [];
    controller = new DesktopMovementController({
      onStateChange: (state, emotion, facing) => {
        stateChanges.push({ state, emotion, facing });
      },
    });
  });

  afterEach(() => {
    controller.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('1. Dragging and dropping anywhere stays stably in place', () => {
    window.dispatchEvent(new CustomEvent('appu-dropped-by-user'));

    const latestState = stateChanges[stateChanges.length - 1];
    expect(latestState.state).toBe('sit');

    // Stays in place and never walks or falls
    vi.advanceTimersByTime(10000);
    const postTimerState = stateChanges[stateChanges.length - 1];
    expect(postTimerState.state).toBe('sit');
    const walkedOrFell = stateChanges.some((s) => s.state === 'walk' || s.state === 'falling');
    expect(walkedOrFell).toBe(false);
  });

  it('2. Drag release at normal speed (< 1350 px/s) stays in place without falling', () => {
    const startPhysicsSpy = vi.spyOn(controller, 'startFreeFallPhysics');

    // Dragging to center or top of screen at normal speed (vx: 300, vy: -500 -> speed ~583 px/s)
    window.dispatchEvent(
      new CustomEvent('appu-released-with-velocity', {
        detail: { vx: 300, vy: -500 },
      })
    );

    expect(startPhysicsSpy).not.toHaveBeenCalled();
    const latestState = stateChanges[stateChanges.length - 1];
    expect(latestState.state).toBe('sit');
  });

  it('3. Quick downward flick (speed >= 1350 px/s) triggers free-fall physics', () => {
    const startPhysicsSpy = vi.spyOn(controller, 'startFreeFallPhysics');

    window.dispatchEvent(
      new CustomEvent('appu-released-with-velocity', {
        detail: { vx: 100, vy: 1500 }, // fast downward flick
      })
    );

    expect(startPhysicsSpy).toHaveBeenCalledWith(100, 1500);
  });

  it('4. Quick upward flick (speed >= 1350 px/s) triggers free-fall physics with upward launch', () => {
    const startPhysicsSpy = vi.spyOn(controller, 'startFreeFallPhysics');

    window.dispatchEvent(
      new CustomEvent('appu-released-with-velocity', {
        detail: { vx: 200, vy: -1600 }, // fast upward flick
      })
    );

    expect(startPhysicsSpy).toHaveBeenCalledWith(200, -1600);
  });

  it('5. Fast throw sideways (speed >= 1350 px/s) triggers free-fall physics with momentum', () => {
    const startPhysicsSpy = vi.spyOn(controller, 'startFreeFallPhysics');

    window.dispatchEvent(
      new CustomEvent('appu-released-with-velocity', {
        detail: { vx: 1600, vy: 100 }, // fast sideways throw
      })
    );

    expect(startPhysicsSpy).toHaveBeenCalledWith(1600, 100);
  });

  it('6. Secondary free-fall physics method can be explicitly triggered when desired', async () => {
    // Secondary physics engine remains available for dedicated physics triggers
    await controller.startFreeFallPhysics(0, 500);
    expect(controller.getCurrentState()).toBe('IN_FREE_FALL');
    controller.stopPhysicsLoop();
  });

  it('7. Disabling free fall prevents physics simulation even when thrown or flicked', () => {
    controller.setFreeFallEnabled(false);
    expect(controller.getFreeFallEnabled()).toBe(false);

    const startPhysicsSpy = vi.spyOn(controller, 'startFreeFallPhysics');

    window.dispatchEvent(
      new CustomEvent('appu-released-with-velocity', {
        detail: { vx: 200, vy: 1600 },
      })
    );

    expect(startPhysicsSpy).not.toHaveBeenCalled();
    const latestState = stateChanges[stateChanges.length - 1];
    expect(latestState.state).toBe('sit');
  });
});
