import { describe, it, expect, vi } from 'vitest';
import { DesktopPhysicsEngine, ScreenBounds } from '../controllers/DesktopPhysicsEngine';

describe('DesktopPhysicsEngine: Realistic Free-Fall, Drag and Floor Collision', () => {
  const bounds: ScreenBounds = {
    minX: 100,
    maxX: 1500,
    minY: 50,
    floorY: 800,
  };

  it('1. Initializes in IDLE state at given coordinates', () => {
    const engine = new DesktopPhysicsEngine({}, { x: 500, y: 800 }, bounds);
    expect(engine.getState()).toBe('IDLE');
    expect(engine.getPosition()).toEqual({ x: 500, y: 800 });
    expect(engine.getVelocity()).toEqual({ vx: 0, vy: 0 });

    const stepRes = engine.step(0.016);
    expect(stepRes.state).toBe('IDLE');
    expect(stepRes.isResting).toBe(true);
  });

  it('2. Dragging updates coordinates and estimates movement velocity', () => {
    const engine = new DesktopPhysicsEngine({}, { x: 500, y: 800 }, bounds);

    engine.startDrag(500, 800, 1000);
    expect(engine.getState()).toBe('DRAGGING');

    engine.updateDrag(520, 750, 1050);
    engine.updateDrag(550, 700, 1100);

    const step = engine.step(0.016);
    expect(step.state).toBe('DRAGGING');
    expect(step.x).toBe(550);
    expect(step.y).toBe(700);
    expect(step.vy).toBeLessThan(0); // Upward drag
    expect(step.vx).toBeGreaterThan(0); // Rightward drag
  });

  it('3. Upward drag release transitions to RISING, then naturally accelerates into FALLING', () => {
    const onStateChange = vi.fn();
    const engine = new DesktopPhysicsEngine({}, { x: 500, y: 800 }, bounds);
    engine.setCallbacks({ onStateChange });

    engine.startDrag(500, 800, 1000);
    engine.updateDrag(500, 600, 1050);
    engine.updateDrag(500, 400, 1100);

    const { vy } = engine.releaseDrag(1100);
    expect(vy).toBeLessThan(-200); // Fast upward launch
    expect(engine.getState()).toBe('RISING');

    // Step physics forward in time until it reaches the apex and falls
    let reachedFalling = false;
    for (let i = 0; i < 60; i++) {
      const res = engine.step(0.016);
      if (res.state === 'FALLING') {
        reachedFalling = true;
        expect(res.vy).toBeGreaterThan(0); // Moving downwards
        break;
      }
    }
    expect(reachedFalling).toBe(true);
  });

  it('4. Free-fall under gravity hits floor, triggers impact squash and bounces', () => {
    const onFloorImpact = vi.fn();
    const engine = new DesktopPhysicsEngine(
      { minBounceVelocity: 200, restitutionFloor: 0.4 },
      { x: 500, y: 200 },
      bounds
    );
    engine.setCallbacks({ onFloorImpact });

    // Release from high up (y=200, floor=800)
    engine.startDrag(500, 200, 1000);
    engine.releaseDrag(1000); // 0 velocity drop

    expect(engine.getState()).toBe('FALLING');

    let hitFloor = false;
    for (let i = 0; i < 60; i++) {
      const res = engine.step(0.016);
      if (res.hasLanded) {
        hitFloor = true;
        expect(res.state).toBe('BOUNCING');
        expect(res.y).toBe(bounds.floorY);
        expect(onFloorImpact).toHaveBeenCalled();
        break;
      }
    }

    expect(hitFloor).toBe(true);
  });

  it('5. Low-velocity landing settles through LANDING -> RECOVERING -> IDLE', () => {
    const stateTransitions: string[] = [];
    const engine = new DesktopPhysicsEngine(
      { minBounceVelocity: 500 }, // High threshold so it settles softly
      { x: 500, y: 760 },
      bounds
    );
    engine.setCallbacks({
      onStateChange: (st) => stateTransitions.push(st),
    });

    engine.startDrag(500, 760, 1000);
    engine.releaseDrag(1000);

    // Run physics until resting
    for (let i = 0; i < 90; i++) {
      engine.step(0.016);
    }

    expect(engine.getState()).toBe('IDLE');
    expect(engine.getPosition().y).toBe(bounds.floorY);
    expect(stateTransitions).toContain('LANDING');
    expect(stateTransitions).toContain('RECOVERING');
    expect(stateTransitions).toContain('IDLE');
  });

  it('6. Sideways throw retains horizontal momentum and bounces off screen wall', () => {
    const onWallImpact = vi.fn();
    const engine = new DesktopPhysicsEngine({}, { x: 1400, y: 500 }, bounds);
    engine.setCallbacks({ onWallImpact });

    // Throw fast to the right towards maxX=1500
    engine.startDrag(1300, 500, 1000);
    engine.updateDrag(1420, 500, 1050);
    engine.updateDrag(1480, 500, 1100);

    const { vx } = engine.releaseDrag(1100);
    expect(vx).toBeGreaterThan(400);

    let wallBounced = false;
    for (let i = 0; i < 20; i++) {
      const res = engine.step(0.016);
      if (res.x >= bounds.maxX && res.vx < 0) {
        wallBounced = true;
        break;
      }
    }

    expect(wallBounced).toBe(true);
    expect(onWallImpact).toHaveBeenCalledWith('right', expect.any(Number));
  });

  it('7. Direct launch initializes free-fall state and velocity accurately', () => {
    const engine = new DesktopPhysicsEngine({}, { x: 500, y: 500 }, bounds);

    // Launch with downward velocity
    engine.launch(600, 300, 100, 850);
    expect(engine.getState()).toBe('FALLING');
    expect(engine.getPosition()).toEqual({ x: 600, y: 300 });
    expect(engine.getVelocity().vy).toBe(850);
    expect(engine.getVelocity().vx).toBe(100);

    // Launch with upward velocity
    engine.launch(600, 500, 0, -500);
    expect(engine.getState()).toBe('RISING');
    expect(engine.getVelocity().vy).toBe(-500);
  });
});
