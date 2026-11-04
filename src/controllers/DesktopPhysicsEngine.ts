/**
 * DesktopPhysicsEngine.ts
 *
 * Lightweight, delta-time-driven physical movement engine for Appu desktop character.
 * Provides realistic gravity, velocity tracking, horizontal momentum, drag/throw physics,
 * boundary collisions, floor impact squash/bounce, and discrete state transitions.
 */

export type DesktopPhysicsState =
  | 'IDLE'
  | 'DRAGGING'
  | 'RISING'
  | 'FALLING'
  | 'LANDING'
  | 'BOUNCING'
  | 'RECOVERING';

export interface PhysicsConfig {
  gravity: number; // Downward acceleration in px/s^2 (e.g. 2400)
  airDragHorizontal: number; // Horizontal damping coeff (s^-1)
  airDragVertical: number; // Vertical air resistance (s^-1)
  groundFriction: number; // Kinetic friction coefficient on ground [0, 1]
  restitutionFloor: number; // Bounce elasticity coefficient [0, 1]
  restitutionWall: number; // Wall bounce elasticity [0, 1]
  minBounceVelocity: number; // Minimum vertical velocity to trigger bounce (px/s)
  terminalVelocity: number; // Max fall speed in px/s
  recoveryDuration: number; // Duration of post-landing recovery in seconds
}

export interface ScreenBounds {
  minX: number;
  maxX: number;
  minY: number;
  floorY: number;
}

export interface PhysicsStepResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: DesktopPhysicsState;
  squashFactor: { x: number; y: number }; // Stretch (> 1 in Y) or Squash (< 1 in Y)
  tiltAngle: number; // Radians to tilt body based on velocity
  impactSpeed: number; // Non-zero on frames with collision
  hasLanded: boolean;
  isResting: boolean;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: 2400, // 2400 px/s^2 provides natural, responsive gravity
  airDragHorizontal: 0.6, // Air drag decelerates sideways flight
  airDragVertical: 0.15, // Light air resistance
  groundFriction: 0.88, // Decelerates horizontal skidding after touchdown
  restitutionFloor: 0.32, // Soft rubbery landing bounce without jitter
  restitutionWall: 0.25, // Light bounce off side borders
  minBounceVelocity: 260, // Minimum vertical velocity (px/s) to cause bounce
  terminalVelocity: 2600, // Safe maximum fall speed
  recoveryDuration: 0.35, // Time to return to idle after landing compression
};

export class DesktopPhysicsEngine {
  private config: PhysicsConfig;
  private state: DesktopPhysicsState = 'IDLE';

  // Position and Velocity in Desktop Pixels
  private x: number = 0;
  private y: number = 0;
  private vx: number = 0;
  private vy: number = 0;

  // Screen Boundaries
  private bounds: ScreenBounds = {
    minX: 0,
    maxX: 1920,
    minY: 0,
    floorY: 1080,
  };

  // Drag tracking history (ring buffer of last 5 samples)
  private dragHistory: Array<{ x: number; y: number; time: number }> = [];

  // Impact and visual deformation state
  private currentSquashX: number = 0;
  private currentSquashY: number = 0;
  private squashVelocityX: number = 0;
  private squashVelocityY: number = 0;

  private recoveryTimer: number = 0;
  private lastImpactSpeed: number = 0;

  // Callbacks
  private onStateChange?: (state: DesktopPhysicsState) => void;
  private onFloorImpact?: (speed: number) => void;
  private onWallImpact?: (side: 'left' | 'right' | 'top', speed: number) => void;

  constructor(
    config: Partial<PhysicsConfig> = {},
    initialPos: { x: number; y: number } = { x: 0, y: 0 },
    bounds?: ScreenBounds
  ) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    this.x = initialPos.x;
    this.y = initialPos.y;
    if (bounds) {
      this.bounds = { ...bounds };
    }
  }

  public setBounds(bounds: ScreenBounds) {
    this.bounds = { ...bounds };
    // Clamp to floor if currently below
    if (this.state === 'IDLE' && this.y > this.bounds.floorY) {
      this.y = this.bounds.floorY;
    }
  }

  public getBounds(): ScreenBounds {
    return { ...this.bounds };
  }

  public getState(): DesktopPhysicsState {
    return this.state;
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  public getVelocity(): { vx: number; vy: number } {
    return { vx: this.vx, vy: this.vy };
  }

  public setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public setCallbacks(callbacks: {
    onStateChange?: (state: DesktopPhysicsState) => void;
    onFloorImpact?: (speed: number) => void;
    onWallImpact?: (side: 'left' | 'right' | 'top', speed: number) => void;
  }) {
    this.onStateChange = callbacks.onStateChange;
    this.onFloorImpact = callbacks.onFloorImpact;
    this.onWallImpact = callbacks.onWallImpact;
  }

  private transitionTo(newState: DesktopPhysicsState) {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }

  // ---------------------------------------------------------------------------
  // Mouse Dragging Interaction Handlers
  // ---------------------------------------------------------------------------

  public startDrag(startX: number, startY: number, timeMs: number = performance.now()) {
    this.transitionTo('DRAGGING');
    this.x = startX;
    this.y = startY;
    this.vx = 0;
    this.vy = 0;
    this.dragHistory = [{ x: startX, y: startY, time: timeMs }];
    this.currentSquashX = 0;
    this.currentSquashY = 0;
    this.squashVelocityX = 0;
    this.squashVelocityY = 0;
  }

  public updateDrag(newX: number, newY: number, timeMs: number = performance.now()) {
    if (this.state !== 'DRAGGING') return;

    this.dragHistory.push({ x: newX, y: newY, time: timeMs });
    if (this.dragHistory.length > 6) {
      this.dragHistory.shift();
    }

    // Estimate instantaneous velocity from history for leaning reactions
    if (this.dragHistory.length >= 2) {
      const oldest = this.dragHistory[0];
      const dt = (timeMs - oldest.time) / 1000;
      if (dt > 0.005) {
        this.vx = (newX - oldest.x) / dt;
        this.vy = (newY - oldest.y) / dt;
      }
    }

    this.x = newX;
    this.y = newY;
  }

  public releaseDrag(timeMs: number = performance.now()): { vx: number; vy: number } {
    if (this.state !== 'DRAGGING') {
      return { vx: this.vx, vy: this.vy };
    }

    // Calculate release velocity from the last few samples (weighted average)
    let releaseVx = 0;
    let releaseVy = 0;

    if (this.dragHistory.length >= 2) {
      // Find samples within the last 120ms
      const recent = this.dragHistory.filter((pt) => timeMs - pt.time <= 120);
      if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const dt = (last.time - first.time) / 1000;
        if (dt > 0.008) {
          releaseVx = (last.x - first.x) / dt;
          releaseVy = (last.y - first.y) / dt;
        }
      }
    }

    // Clamp launch velocities to realistic limits
    const maxThrowSpeed = 2200;
    releaseVx = Math.max(-maxThrowSpeed, Math.min(maxThrowSpeed, releaseVx));
    releaseVy = Math.max(-maxThrowSpeed, Math.min(maxThrowSpeed, releaseVy));

    this.vx = releaseVx;
    this.vy = releaseVy;
    this.dragHistory = [];

    // Check if released directly on or below floor level
    if (this.y >= this.bounds.floorY - 4) {
      this.y = this.bounds.floorY;
      if (this.vy > this.config.minBounceVelocity) {
        this.transitionTo('BOUNCING');
      } else {
        this.vy = 0;
        this.transitionTo('LANDING');
        this.recoveryTimer = this.config.recoveryDuration;
      }
    } else {
      // Upward throw or falling downward
      if (this.vy < -40) {
        this.transitionTo('RISING');
      } else {
        this.transitionTo('FALLING');
      }
    }

    return { vx: this.vx, vy: this.vy };
  }

  /**
   * Directly launches free-fall physics from a given position with initial velocity.
   */
  public launch(startX: number, startY: number, launchVx: number, launchVy: number) {
    this.x = startX;
    this.y = startY;
    this.dragHistory = [];

    const maxThrowSpeed = 2200;
    this.vx = Math.max(-maxThrowSpeed, Math.min(maxThrowSpeed, launchVx));
    this.vy = Math.max(-maxThrowSpeed, Math.min(maxThrowSpeed, launchVy));

    if (this.y >= this.bounds.floorY - 4) {
      this.y = this.bounds.floorY;
      if (this.vy > this.config.minBounceVelocity) {
        this.transitionTo('BOUNCING');
      } else {
        this.vy = 0;
        this.transitionTo('LANDING');
        this.recoveryTimer = this.config.recoveryDuration;
      }
    } else {
      if (this.vy < -40) {
        this.transitionTo('RISING');
      } else {
        this.transitionTo('FALLING');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Physics Tick Update (Delta-Time Independent)
  // ---------------------------------------------------------------------------

  public step(dtSeconds: number): PhysicsStepResult {
    // Clamp delta-time to prevent physics explosion on lag spikes
    const dt = Math.min(Math.max(dtSeconds, 0.0001), 0.05);

    let impactSpeed = 0;
    let hasLanded = false;

    // Handle Dragging State
    if (this.state === 'DRAGGING') {
      this.updateSprings(dt);
      const tilt = this.calculateTilt();
      return {
        x: this.x,
        y: this.y,
        vx: this.vx,
        vy: this.vy,
        state: this.state,
        squashFactor: { x: this.currentSquashX, y: this.currentSquashY },
        tiltAngle: tilt,
        impactSpeed: 0,
        hasLanded: false,
        isResting: false,
      };
    }

    // Handle Idle State (Character fully settled on floor)
    if (this.state === 'IDLE') {
      this.vx = 0;
      this.vy = 0;
      this.y = this.bounds.floorY;
      this.updateSprings(dt);
      return {
        x: this.x,
        y: this.y,
        vx: 0,
        vy: 0,
        state: 'IDLE',
        squashFactor: { x: this.currentSquashX, y: this.currentSquashY },
        tiltAngle: 0,
        impactSpeed: 0,
        hasLanded: false,
        isResting: true,
      };
    }

    // 1. Vertical Acceleration: Gravity + Air Drag
    this.vy += this.config.gravity * dt;
    this.vy -= this.vy * this.config.airDragVertical * dt;
    this.vy = Math.min(this.config.terminalVelocity, Math.max(-this.config.terminalVelocity, this.vy));

    // 2. Horizontal Deceleration: Air Drag
    this.vx -= this.vx * this.config.airDragHorizontal * dt;

    // 3. Integrate Position (Semi-implicit Euler)
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 4. Update In-Flight State (RISING vs FALLING)
    if (this.state === 'RISING' || this.state === 'BOUNCING') {
      if (this.vy >= 0) {
        this.transitionTo('FALLING');
      }
    } else if (this.state === 'FALLING') {
      // Dynamic vertical stretch while falling fast
      const stretchAmount = Math.min(0.24, Math.max(0, this.vy / 2200) * 0.22);
      this.currentSquashY = THREE_Math_lerp(this.currentSquashY, stretchAmount, dt * 10);
      this.currentSquashX = THREE_Math_lerp(this.currentSquashX, -stretchAmount * 0.5, dt * 10);
    }

    // 5. Left & Right Wall Collision Detection
    if (this.x <= this.bounds.minX) {
      const speed = Math.abs(this.vx);
      this.x = this.bounds.minX;
      this.vx = speed * this.config.restitutionWall;
      if (speed > 80) {
        this.onWallImpact?.('left', speed);
      }
    } else if (this.x >= this.bounds.maxX) {
      const speed = Math.abs(this.vx);
      this.x = this.bounds.maxX;
      this.vx = -speed * this.config.restitutionWall;
      if (speed > 80) {
        this.onWallImpact?.('right', speed);
      }
    }

    // Ceiling collision
    if (this.y <= this.bounds.minY) {
      this.y = this.bounds.minY;
      if (this.vy < 0) {
        this.vy = -this.vy * 0.2;
        this.onWallImpact?.('top', Math.abs(this.vy));
      }
    }

    // 6. Floor Collision Detection
    if (this.y >= this.bounds.floorY) {
      this.y = this.bounds.floorY;
      impactSpeed = Math.abs(this.vy);
      this.lastImpactSpeed = impactSpeed;
      hasLanded = true;

      // Apply ground friction to horizontal motion
      this.vx *= Math.pow(1 - this.config.groundFriction, dt * 30);
      if (Math.abs(this.vx) < 8) {
        this.vx = 0;
      }

      // Determine bounce vs soft land
      if (impactSpeed > this.config.minBounceVelocity) {
        // Bounce!
        this.vy = -impactSpeed * this.config.restitutionFloor;
        this.transitionTo('BOUNCING');

        // Strong impact squash
        const squashAmount = Math.min(0.35, (impactSpeed / 1800) * 0.32);
        this.squashVelocityY = -squashAmount * 30;
        this.squashVelocityX = squashAmount * 24;

        this.onFloorImpact?.(impactSpeed);
      } else {
        // Settled on floor (LANDING or RECOVERING)
        this.vy = 0;
        if (this.state !== 'LANDING' && this.state !== 'RECOVERING') {
          this.transitionTo('LANDING');
          this.recoveryTimer = this.config.recoveryDuration;

          // Moderate landing compression
          const squashAmount = Math.min(0.25, (impactSpeed / 1200) * 0.22);
          this.squashVelocityY = -squashAmount * 22;
          this.squashVelocityX = squashAmount * 18;

          if (impactSpeed > 40) {
            this.onFloorImpact?.(impactSpeed);
          }
        }
      }
    }

    // 7. Recovery Timing
    if (this.state === 'LANDING') {
      this.recoveryTimer -= dt;
      if (this.recoveryTimer <= this.config.recoveryDuration * 0.5) {
        this.transitionTo('RECOVERING');
      }
    } else if (this.state === 'RECOVERING') {
      this.recoveryTimer -= dt;
      if (this.recoveryTimer <= 0) {
        this.transitionTo('IDLE');
        this.vx = 0;
        this.vy = 0;
      }
    }

    // Update spring physics for squash & stretch return to normal (1.0)
    this.updateSprings(dt);

    const tilt = this.calculateTilt();
    const isResting = (this.state as DesktopPhysicsState) === 'IDLE' && Math.abs(this.currentSquashY) < 0.01;

    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      state: this.state,
      squashFactor: { x: this.currentSquashX, y: this.currentSquashY },
      tiltAngle: tilt,
      impactSpeed,
      hasLanded,
      isResting,
    };
  }

  // ---------------------------------------------------------------------------
  // Dynamic Squash, Stretch & Tilt Springs
  // ---------------------------------------------------------------------------

  private updateSprings(dt: number) {
    // Underdamped spring returning squash deformation to 0
    const stiffness = 220;
    const damping = 18;

    const ax = -stiffness * this.currentSquashX - damping * this.squashVelocityX;
    const ay = -stiffness * this.currentSquashY - damping * this.squashVelocityY;

    this.squashVelocityX += ax * dt;
    this.squashVelocityY += ay * dt;

    this.currentSquashX += this.squashVelocityX * dt;
    this.currentSquashY += this.squashVelocityY * dt;
  }

  private calculateTilt(): number {
    if (this.state === 'IDLE') return 0;

    // Body tilts in direction of horizontal motion
    // Clamp tilt angle to max ±25 degrees (±0.44 rad)
    const maxTilt = 0.44;
    const tilt = -Math.max(-maxTilt, Math.min(maxTilt, (this.vx / 1400) * maxTilt));
    return tilt;
  }
}

// Utility lerp function without external dependencies
function THREE_Math_lerp(x: number, y: number, t: number): number {
  return (1 - t) * x + t * y;
}
