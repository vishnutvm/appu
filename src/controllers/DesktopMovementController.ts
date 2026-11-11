import { AppuAnimationState, AppuEmotion } from '../types/character';
import { DesktopPhysicsEngine, ScreenBounds } from './DesktopPhysicsEngine';

interface MovementControllerOptions {
  onStateChange: (state: AppuAnimationState, emotion: AppuEmotion, facingRotation: number) => void;
  speedMultiplier?: number;
}

export type CompanionState =
  | 'INITIALIZING'
  | 'RESTING'
  | 'BEING_DRAGGED'
  | 'IN_FREE_FALL'
  | 'STROLLING_TO_NOTIFY'
  | 'PRESENTING_NOTIFICATION'
  | 'RETURNING_HOME';

// Calibrated speed threshold (px/s) to distinguish normal dragging from a deliberate fast flick/throw
export const FLICK_SPEED_THRESHOLD = 1350;

export class DesktopMovementController {
  private currentState: CompanionState = 'INITIALIZING';
  private speed: number = 135; // pixels per second on screen for calm, natural walking pace
  private screenWidth: number = 1600;
  private screenHeight: number = 900;
  private workAreaX: number = 0;
  private workAreaY: number = 0;

  // Home corner coordinates (bottom-right of display)
  private homeX: number = 1280;
  private homeY: number = 540;

  // Notification target coordinates (strolls inward into peripheral sight)
  private strollX: number = 960;
  private strollY: number = 540;

  // Off-screen coordinates (beyond right display edge)
  private offscreenX: number = 1920;

  private currentWindowX: number = 0;
  private currentWindowY: number = 0;

  private isWalking: boolean = false;
  private isPinned: boolean = false;
  private isOffScreen: boolean = false;
  private allowOffscreenWalking: boolean = false;
  private currentWalkInterval: any = null;
  private settleTimer: any = null;
  private stateChangeCallback: MovementControllerOptions['onStateChange'];

  // Physics Engine instance
  private physicsEngine: DesktopPhysicsEngine;
  private physicsInterval: any = null;
  // Delayed steps of a sequence (e.g. "wave, then walk off"); cancelled when a new movement starts
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private walkFacing: number = 0;
  private unsubscribeEdgeBump?: () => void;
  private lastPhysicsTickTime: number = 0;
  private freeFallEnabled: boolean = true;

  // Event listeners for window drag/drop
  private onDragStartListener = () => {
    this.stopWalking();
    this.stopPhysicsLoop();
    this.clearAllTimers();
    this.currentState = 'BEING_DRAGGED';
  };

  private onReleasedListener = (e: any) => {
    const vel = e?.detail || { vx: 0, vy: 0 };
    const speed = Math.hypot(vel.vx, vel.vy);

    // If flicked with high speed and free-fall physics is enabled:
    if (this.freeFallEnabled && speed >= FLICK_SPEED_THRESHOLD) {
      this.startFreeFallPhysics(vel.vx, vel.vy);
    } else {
      // Normal drag & place or free fall disabled: Appu stays smoothly right where placed!
      this.stopWalking();
      this.stopPhysicsLoop();
      if (this.settleTimer) clearTimeout(this.settleTimer);
      this.currentState = 'RESTING';
      this.stateChangeCallback('idle', 'happy', 0);
      this.handleUserDropped();
    }
  };

  // A click (no drag) on Appu briefly shows a tap reaction; resume the walk pose if still walking
  private onClickReleasedListener = () => {
    if (!this.isWalking) return;
    this.later(() => {
      if (this.isWalking) this.stateChangeCallback('walk', 'curious', this.walkFacing);
    }, 650);
  };

  private later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      this.pendingTimers.delete(id);
      fn();
    }, ms);
    this.pendingTimers.add(id);
  }

  /** Cancels settle + any one-shot stroll/dismiss/appear timers. */
  public clearAllTimers() {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    this.pendingTimers.forEach((id) => clearTimeout(id));
    this.pendingTimers.clear();
  }

  private onDroppedListener = () => {
    this.stopWalking();
    this.stopPhysicsLoop();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.currentState = 'RESTING';
    this.stateChangeCallback('idle', 'happy', 0);
    this.handleUserDropped();
  };

  constructor(options: MovementControllerOptions) {
    this.stateChangeCallback = options.onStateChange;
    this.physicsEngine = new DesktopPhysicsEngine();
    this.initScreen();

    // Setup physics callbacks
    this.physicsEngine.setCallbacks({
      onStateChange: (st) => {
        if (st === 'FALLING') {
          this.stateChangeCallback('falling', 'surprised', 0);
        } else if (st === 'RISING') {
          this.stateChangeCallback('rising', 'surprised', 0);
        } else if (st === 'LANDING') {
          this.stateChangeCallback('landing', 'surprised', 0);
        } else if (st === 'BOUNCING') {
          this.stateChangeCallback('bouncing', 'surprised', 0);
        } else if (st === 'RECOVERING') {
          this.stateChangeCallback('recovering', 'curious', 0);
        } else if (st === 'IDLE') {
          this.stopPhysicsLoop();
          this.currentState = 'RESTING';
          this.stateChangeCallback('idle', 'happy', 0);
          this.handleUserDropped();
        }
      },
    });

    // Listen for drag & drop events
    if (typeof window !== 'undefined') {
      window.addEventListener('appu-drag-start', this.onDragStartListener);
      window.addEventListener('appu-released-with-velocity', this.onReleasedListener);
      window.addEventListener('appu-dropped-by-user', this.onDroppedListener);
      window.addEventListener('appu-click-released', this.onClickReleasedListener);
    }

    // Listen for physical screen edge collisions to prevent walking into walls
    if (window.desktopAPI?.onScreenEdgeBump) {
      this.unsubscribeEdgeBump = window.desktopAPI.onScreenEdgeBump((_data) => {
        if (this.isWalking && !this.allowOffscreenWalking) {
          this.stopWalking();
        }
      });
    }
  }

  private async initScreen() {
    if (window.desktopAPI?.getScreenBounds) {
      try {
        const bounds = await window.desktopAPI.getScreenBounds();
        this.screenWidth = bounds.width;
        this.screenHeight = bounds.height;
        this.workAreaX = bounds.x;
        this.workAreaY = bounds.y;
      } catch (e) {
        this.screenWidth = window.screen.availWidth || 1600;
        this.screenHeight = window.screen.availHeight || 900;
      }
    } else {
      this.screenWidth = window.screen.availWidth || 1600;
      this.screenHeight = window.screen.availHeight || 900;
    }

    const INSET_RIGHT = 50;
    const INSET_BOTTOM = 42;
    const INSET_LEFT = 50;
    const INSET_TOP = 36;

    // Calculate Home Corner (bottom-right: Appu feet directly on bottom edge, right side near corner)
    this.homeX = Math.round(this.workAreaX + this.screenWidth - 220 + INSET_RIGHT - 10);
    this.homeY = Math.round(this.workAreaY + this.screenHeight - 300 + INSET_BOTTOM);

    // Calculate Notification presentation spot (~260px inward from corner)
    this.strollX = Math.round(Math.max(this.workAreaX + 100, this.homeX - 260));
    this.strollY = this.homeY;

    // Calculate Off-screen coordinates (beyond right display edge)
    this.offscreenX = Math.round(this.workAreaX + this.screenWidth + 35);

    this.currentWindowX = this.homeX;
    this.currentWindowY = this.homeY;

    // Set screen bounds for Physics Engine
    const minX = Math.round(this.workAreaX - INSET_LEFT);
    const maxX = Math.round(this.workAreaX + this.screenWidth - 220 + INSET_RIGHT);
    const minY = Math.round(this.workAreaY - INSET_TOP);
    const floorY = Math.round(this.workAreaY + this.screenHeight - 300 + INSET_BOTTOM);

    this.physicsEngine.setBounds({
      minX,
      maxX,
      minY,
      floorY,
    });
  }

  public getIsPinned(): boolean {
    return this.isPinned;
  }

  public setIsPinned(pinned: boolean) {
    this.isPinned = pinned;
  }

  public getFreeFallEnabled(): boolean {
    return this.freeFallEnabled;
  }

  public setFreeFallEnabled(enabled: boolean) {
    this.freeFallEnabled = enabled;
    if (!enabled) {
      this.stopPhysicsLoop();
    }
  }

  public getCurrentState(): CompanionState {
    return this.currentState;
  }

  public getIsOffScreen(): boolean {
    return this.isOffScreen;
  }

  public setIsOffScreen(val: boolean): void {
    this.isOffScreen = val;
  }

  public getOffscreenX(): number {
    return this.offscreenX;
  }

  public getStrollX(): number {
    return this.strollX;
  }

  public getHomeX(): number {
    return this.homeX;
  }

  public getHomeY(): number {
    return this.homeY;
  }

  /**
   * Starts companion routine: Appu briefly greets, then stands ready in Home Corner.
   */
  public async startCompanionRoutine() {
    await this.initScreen();

    // Friendly initial greeting
    this.stateChangeCallback('wave', 'happy', 0);

    this.settleTimer = setTimeout(() => {
      this.currentState = 'RESTING';
      this.stateChangeCallback('idle', 'happy', 0);
    }, 2400);
  }

  /**
   * When user drops Appu anywhere on the screen:
   * Appu stays right at that position! He stands alert and happy.
   * Never walks down to the bottom corner or drops down.
   */
  public handleUserDropped() {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);

    this.currentState = 'RESTING';
    // Stand alert and happy right where placed or landed
    this.stateChangeCallback('idle', 'happy', 0);
  }

  /**
   * Called when a reminder arrives: Appu wakes up, strolls into view, waves, and shows bubble.
   */
  public async triggerReminderStroll(onArrived: () => void) {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.stopWalking();
    this.currentState = 'STROLLING_TO_NOTIFY';

    // Wake up with happy expression
    this.stateChangeCallback('idle', 'happy', 0);

    this.later(() => {
      this.walkTo(this.strollX, this.strollY, () => {
        this.currentState = 'PRESENTING_NOTIFICATION';
        // Face forward and wave
        this.stateChangeCallback('wave', 'happy', 0);
        onArrived();
      });
    }, 500);
  }

  /**
   * Smoothly walks Appu off the side of the screen.
   */
  public async walkOffScreen(onDone?: () => void) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    await this.initScreen();

    // Wave goodbye briefly, then walk off screen to the side
    this.stateChangeCallback('wave', 'happy', 0);

    this.later(() => {
      this.currentState = 'RETURNING_HOME';
      this.allowOffscreenWalking = true;
      this.walkTo(
        this.offscreenX,
        this.homeY,
        () => {
          this.currentState = 'RESTING';
          this.isOffScreen = true;
          this.allowOffscreenWalking = false;
          this.stateChangeCallback('idle', 'neutral', 0);
          if (onDone) onDone();
        },
        true
      );
    }, 800);
  }

  /**
   * Walks Appu onto the screen from the side (e.g. for reminders or summoning).
   */
  public async walkOnScreen(targetX?: number, onDone?: () => void) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    await this.initScreen();

    const destX = targetX ?? this.strollX;

    // Immediately position window offscreen to the right
    if (window.desktopAPI?.setWindowPosition) {
      window.desktopAPI.setWindowPosition(this.offscreenX, this.homeY);
      this.currentWindowX = this.offscreenX;
      this.currentWindowY = this.homeY;
    }

    this.isOffScreen = false;
    this.allowOffscreenWalking = true;
    this.currentState = 'STROLLING_TO_NOTIFY';

    // Face left towards the screen and start walking
    this.stateChangeCallback('walk', 'curious', -Math.PI / 2);

    this.later(() => {
      this.walkTo(
        destX,
        this.homeY,
        () => {
          this.isOffScreen = false;
          this.allowOffscreenWalking = false;
          this.currentState = 'PRESENTING_NOTIFICATION';
          this.stateChangeCallback('wave', 'happy', 0);
          this.later(() => {
            this.stateChangeCallback('idle', 'happy', 0);
          }, 2000);
          if (onDone) onDone();
        },
        true
      );
    }, 60);
  }

  /**
   * Called when notification is acknowledged (OK) or snoozed:
   * Reaction:
   *  - 'happy' (OK clicked): Appu celebrates, then walks off the screen.
   *  - 'sad' (Snooze clicked): Appu looks sad/cries, then walks off the screen.
   * After the reaction, Appu always smoothly walks off the screen to the side!
   */
  public dismissAndReturnHome(reaction: 'happy' | 'sad' = 'happy', onDone?: () => void) {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.stopWalking();

    if (reaction === 'happy') {
      this.stateChangeCallback('cheer', 'happy', 0);
    } else {
      this.stateChangeCallback('sad', 'sad', 0);
    }

    this.later(() => {
      this.currentState = 'RETURNING_HOME';
      this.allowOffscreenWalking = true;
      this.walkTo(
        this.offscreenX,
        this.homeY,
        () => {
          this.currentState = 'RESTING';
          this.isOffScreen = true;
          this.allowOffscreenWalking = false;
          this.stateChangeCallback('idle', 'neutral', 0);
          if (onDone) onDone();
        },
        true
      );
    }, 1200);
  }

  /**
   * Sticks / pins Appu to the closest screen edge without clipping.
   */
  public async stickToEdge(onDone?: () => void) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.isPinned = true;

    let currentX = 0;
    let currentY = 0;
    if (window.desktopAPI?.getWindowPosition) {
      try {
        const pos = await window.desktopAPI.getWindowPosition();
        currentX = pos.x;
        currentY = pos.y;
      } catch (e) {}
    }

    const INSET_LEFT = 50;
    const INSET_RIGHT = 50;

    // Determine whether left border or right border is closest
    const distToLeft = Math.abs(currentX - (this.workAreaX - INSET_LEFT));
    const distToRight = Math.abs(currentX - (this.workAreaX + this.screenWidth - 220 + INSET_RIGHT));

    const targetX = distToLeft < distToRight
      ? this.workAreaX - INSET_LEFT + 6 // Touch left screen edge cleanly
      : this.workAreaX + this.screenWidth - 220 + INSET_RIGHT - 6; // Touch right screen edge cleanly

    const targetY = currentY;

    this.walkTo(targetX, targetY, () => {
      const inwardFacing = distToLeft < distToRight ? Math.PI / 4 : -Math.PI / 4;
      this.stateChangeCallback('idle', 'happy', inwardFacing);
      if (onDone) onDone();
    });
  }

  /**
   * Unsticks Appu from the edge and releases pin.
   */
  public async unstick(onDone?: () => void) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.isPinned = false;

    let currentX = 0;
    let currentY = 0;
    if (window.desktopAPI?.getWindowPosition) {
      try {
        const pos = await window.desktopAPI.getWindowPosition();
        currentX = pos.x;
        currentY = pos.y;
      } catch (e) {}
    }

    // Step inward from wall
    const isNearLeft = currentX < this.workAreaX + 120;
    const targetX = isNearLeft ? currentX + 140 : currentX - 140;

    this.walkTo(targetX, currentY, () => {
      this.stateChangeCallback('wave', 'happy', 0);
      this.later(() => {
        this.stateChangeCallback('idle', 'happy', 0);
        if (onDone) onDone();
      }, 1200);
    });
  }

  /**
   * Disappears / tucks away out of the screen.
   */
  public async disappear(onDone?: () => void) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);

    // Wave goodbye
    this.stateChangeCallback('wave', 'happy', 0);

    this.later(() => {
      this.stateChangeCallback('idle', 'happy', 0);
      if (onDone) onDone();
    }, 1200);
  }

  /**
   * Reappears back from hidden state with a joyful wave.
   */
  public async reappear(onDone?: () => void) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);

    this.stateChangeCallback('wave', 'happy', 0);
    this.later(() => {
      this.stateChangeCallback('idle', 'happy', 0);
      if (onDone) onDone();
    }, 1800);
  }

  /**
   * Manually walks back to Home Corner.
   */
  public walkToHomeCorner() {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.walkTo(this.homeX, this.homeY, () => {
      this.currentState = 'RESTING';
      this.stateChangeCallback('idle', 'happy', 0);
    });
  }

  /**
   * Takes a natural on-screen stroll toward the opposite half of the workspace.
   */
  public async strollOnScreen(onDone?: () => void) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    await this.initScreen();

    let currentX = this.homeX;
    let currentY = this.homeY;
    if (window.desktopAPI?.getWindowPosition) {
      try {
        const pos = await window.desktopAPI.getWindowPosition();
        currentX = pos.x;
        currentY = pos.y;
      } catch (e) {}
    }

    const minX = this.workAreaX + 24;
    const maxX = Math.max(minX, this.workAreaX + this.screenWidth - 244);
    const midpointX = (minX + maxX) / 2;
    const distance = Math.min(340, Math.max(180, (maxX - minX) * 0.25));
    const targetX = currentX >= midpointX
      ? Math.max(minX, currentX - distance)
      : Math.min(maxX, currentX + distance);

    this.currentState = 'STROLLING_TO_NOTIFY';
    this.walkTo(targetX, currentY, () => {
      this.currentState = 'RESTING';
      this.stateChangeCallback('idle', 'happy', 0);
      if (onDone) onDone();
    });
  }

  /**
   * Smoothly walks the window to target coordinates (targetX, targetY).
   * ZERO React re-renders in the 60fps loop.
   */
  public async walkTo(
    targetX: number,
    targetY: number,
    onDone: () => void,
    allowOffscreen: boolean = false,
    customSpeed?: number
  ) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.isWalking = true;
    this.allowOffscreenWalking = allowOffscreen;
    const effectiveSpeed = customSpeed ?? this.speed;

    let currentX = this.currentWindowX || targetX;
    let currentY = this.currentWindowY || targetY;

    if (window.desktopAPI?.getWindowPosition) {
      try {
        const pos = await window.desktopAPI.getWindowPosition();
        currentX = pos.x;
        currentY = pos.y;
        this.currentWindowX = pos.x;
        this.currentWindowY = pos.y;
      } catch (e) {}
    }

    if (!this.isWalking) return;

    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const initialDist = Math.hypot(dx, dy);

    if (initialDist <= 8) {
      this.stopWalking();
      this.stateChangeCallback('idle', 'happy', 0);
      onDone();
      return;
    }

    // Set walking animation and orientation ONCE at start
    let currentFacingAngle = dx >= 0 ? Math.PI / 2 : -Math.PI / 2;
    this.walkFacing = currentFacingAngle;
    this.stateChangeCallback('walk', 'curious', currentFacingAngle);

    const stepInterval = 16;
    let accumulatedX = 0;
    let accumulatedY = 0;

    this.currentWalkInterval = setInterval(() => {
      if (!this.isWalking) {
        clearInterval(this.currentWalkInterval);
        return;
      }

      const curDx = targetX - currentX;
      const curDy = targetY - currentY;
      const dist = Math.hypot(curDx, curDy);

      if (dist <= 6) {
        this.stopWalking();
        // Face forward when arriving
        this.stateChangeCallback('wave', 'happy', 0);
        onDone();
        return;
      }

      // Only update facing angle if direction flips
      const targetFacing = curDx >= 0 ? Math.PI / 2 : -Math.PI / 2;
      if (targetFacing !== currentFacingAngle) {
        currentFacingAngle = targetFacing;
        this.walkFacing = targetFacing;
        this.stateChangeCallback('walk', 'curious', currentFacingAngle);
      }

      const stepDist = (effectiveSpeed * (stepInterval / 1000));
      const stepFraction = Math.min(1.0, stepDist / dist);
      const stepX = curDx * stepFraction;
      const stepY = curDy * stepFraction;

      currentX += stepX;
      currentY += stepY;
      this.currentWindowX = currentX;
      this.currentWindowY = currentY;

      accumulatedX += stepX;
      accumulatedY += stepY;

      let sendX = 0;
      let sendY = 0;

      if (Math.abs(accumulatedX) >= 1) {
        sendX = Math.trunc(accumulatedX);
        accumulatedX -= sendX;
      }
      if (Math.abs(accumulatedY) >= 1) {
        sendY = Math.trunc(accumulatedY);
        accumulatedY -= sendY;
      }

      if ((sendX !== 0 || sendY !== 0) && window.desktopAPI?.moveWindowBy) {
        window.desktopAPI.moveWindowBy(sendX, sendY, allowOffscreen);
      }
    }, stepInterval);
  }

  public stopWalking() {
    this.clearAllTimers();
    this.isWalking = false;
    this.allowOffscreenWalking = false;
    if (this.currentWalkInterval) {
      clearInterval(this.currentWalkInterval);
      this.currentWalkInterval = null;
    }
  }

  /**
   * Begins free-fall physics simulation upon release.
   */
  public async startFreeFallPhysics(initialVx: number, initialVy: number) {
    if (!this.freeFallEnabled) return;
    this.stopWalking();
    this.stopPhysicsLoop();
    if (this.settleTimer) clearTimeout(this.settleTimer);

    await this.initScreen();

    let curX = this.homeX;
    let curY = this.homeY;

    if (window.desktopAPI?.getWindowPosition) {
      try {
        const pos = await window.desktopAPI.getWindowPosition();
        curX = pos.x;
        curY = pos.y;
      } catch (e) {}
    }

    this.currentState = 'IN_FREE_FALL';
    this.physicsEngine.launch(curX, curY, initialVx, initialVy);

    this.lastPhysicsTickTime = performance.now();
    let accumulatedX = 0;
    let accumulatedY = 0;

    this.physicsInterval = setInterval(() => {
      const now = performance.now();
      const dt = (now - this.lastPhysicsTickTime) / 1000;
      this.lastPhysicsTickTime = now;

      const res = this.physicsEngine.step(dt);

      const dx = res.x - curX;
      const dy = res.y - curY;

      curX = res.x;
      curY = res.y;

      accumulatedX += dx;
      accumulatedY += dy;

      let sendX = 0;
      let sendY = 0;

      if (Math.abs(accumulatedX) >= 1) {
        sendX = Math.trunc(accumulatedX);
        accumulatedX -= sendX;
      }
      if (Math.abs(accumulatedY) >= 1) {
        sendY = Math.trunc(accumulatedY);
        accumulatedY -= sendY;
      }

      if ((sendX !== 0 || sendY !== 0) && window.desktopAPI?.moveWindowBy) {
        window.desktopAPI.moveWindowBy(sendX, sendY);
      }

      // Notify 3D canvas of physics-driven squash/stretch deformation and body lean
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('appu-physics-deformation', {
            detail: {
              squashFactor: res.squashFactor,
              tiltAngle: res.tiltAngle,
              verticalVel: res.vy,
            },
          })
        );
      }

      if (res.isResting) {
        this.stopPhysicsLoop();
        this.currentState = 'RESTING';
        this.stateChangeCallback('idle', 'happy', 0);
        this.handleUserDropped();
      }
    }, 16);
  }

  public stopPhysicsLoop() {
    if (this.physicsInterval) {
      clearInterval(this.physicsInterval);
      this.physicsInterval = null;
    }
  }

  public destroy() {
    this.stopWalking();
    this.unsubscribeEdgeBump?.();
    this.stopPhysicsLoop();
    this.clearAllTimers();
    if (typeof window !== 'undefined') {
      window.removeEventListener('appu-drag-start', this.onDragStartListener);
      window.removeEventListener('appu-released-with-velocity', this.onReleasedListener);
      window.removeEventListener('appu-dropped-by-user', this.onDroppedListener);
      window.removeEventListener('appu-click-released', this.onClickReleasedListener);
    }
  }
}
