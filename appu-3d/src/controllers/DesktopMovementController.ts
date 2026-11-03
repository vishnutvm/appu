import { AppuAnimationState, AppuEmotion } from '../types/character';

interface MovementControllerOptions {
  onStateChange: (state: AppuAnimationState, emotion: AppuEmotion, facingRotation: number) => void;
  speedMultiplier?: number;
}

export type CompanionState =
  | 'INITIALIZING'
  | 'RESTING'
  | 'BEING_DRAGGED'
  | 'STROLLING_TO_NOTIFY'
  | 'PRESENTING_NOTIFICATION'
  | 'RETURNING_HOME';

export class DesktopMovementController {
  private currentState: CompanionState = 'INITIALIZING';
  private speed: number = 100; // pixels per second on screen
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

  private isWalking: boolean = false;
  private isPinned: boolean = false;
  private currentWalkInterval: any = null;
  private settleTimer: any = null;
  private stateChangeCallback: MovementControllerOptions['onStateChange'];

  constructor(options: MovementControllerOptions) {
    this.stateChangeCallback = options.onStateChange;
    this.initScreen();

    // Listen for drag start: immediately cancel any walking or timers
    if (typeof window !== 'undefined') {
      window.addEventListener('appu-drag-start', () => {
        this.stopWalking();
        if (this.settleTimer) clearTimeout(this.settleTimer);
        this.currentState = 'BEING_DRAGGED';
      });

      // Listen for drop: settle peacefully right where the user placed him
      window.addEventListener('appu-dropped-by-user', () => {
        this.handleUserDropped();
      });
    }

    // Listen for physical screen edge collisions to prevent walking into walls
    if (window.desktopAPI?.onScreenEdgeBump) {
      window.desktopAPI.onScreenEdgeBump((_data) => {
        if (this.isWalking) {
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

    // Calculate Home Corner (bottom-right: Appu feet directly on bottom edge, right side near corner)
    this.homeX = Math.round(this.workAreaX + this.screenWidth - 220 + INSET_RIGHT - 10);
    this.homeY = Math.round(this.workAreaY + this.screenHeight - 300 + INSET_BOTTOM);

    // Calculate Notification presentation spot (~260px inward from corner)
    this.strollX = Math.round(Math.max(this.workAreaX + 100, this.homeX - 260));
    this.strollY = this.homeY;
  }

  public getIsPinned(): boolean {
    return this.isPinned;
  }

  public setIsPinned(pinned: boolean) {
    this.isPinned = pinned;
  }

  /**
   * Starts companion routine: Appu briefly greets, then rests peacefully in Home Corner.
   */
  public async startCompanionRoutine() {
    await this.initScreen();

    // Friendly initial greeting
    this.stateChangeCallback('wave', 'happy', 0);

    this.settleTimer = setTimeout(() => {
      this.currentState = 'RESTING';
      this.stateChangeCallback('sit', 'sleepy', 0);
    }, 2400);
  }

  /**
   * When user drops Appu anywhere on the screen:
   * If pinned: stays right at that location!
   * If not pinned: looks around for 8 seconds, then walks back to Home Corner so screen remains clear.
   */
  public handleUserDropped() {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);

    if (this.isPinned) {
      this.currentState = 'RESTING';
      this.stateChangeCallback('idle', 'happy', 0);
      return;
    }

    this.currentState = 'RESTING';
    // Look around curiously
    this.stateChangeCallback('idle', 'curious', 0);

    // After 8 seconds of curiosity, walk back to Home Corner to clear the workspace
    this.settleTimer = setTimeout(async () => {
      if (this.isPinned || this.isWalking) return;

      let currentX = 0;
      let currentY = 0;
      if (window.desktopAPI?.getWindowPosition) {
        try {
          const pos = await window.desktopAPI.getWindowPosition();
          currentX = pos.x;
          currentY = pos.y;
        } catch (e) {}
      }

      const distToHome = Math.hypot(this.homeX - currentX, this.homeY - currentY);
      if (distToHome > 80 && !this.isPinned) {
        this.walkToHomeCorner();
      } else {
        this.stateChangeCallback('sit', 'sleepy', 0);
      }
    }, 8000);
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

    setTimeout(() => {
      this.walkTo(this.strollX, this.strollY, () => {
        this.currentState = 'PRESENTING_NOTIFICATION';
        // Face forward and wave
        this.stateChangeCallback('wave', 'happy', 0);
        onArrived();
      });
    }, 500);
  }

  /**
   * Called when notification is dismissed: waves goodbye and walks back to home corner.
   */
  public dismissAndReturnHome() {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.stopWalking();

    // Wave goodbye
    this.stateChangeCallback('wave', 'happy', 0);

    setTimeout(() => {
      this.currentState = 'RETURNING_HOME';
      this.walkTo(this.homeX, this.homeY, () => {
        this.currentState = 'RESTING';
        this.stateChangeCallback('sit', 'sleepy', 0);
      });
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
      setTimeout(() => {
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

    setTimeout(() => {
      this.stateChangeCallback('sit', 'sleepy', 0);
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
    setTimeout(() => {
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
      this.stateChangeCallback('sit', 'sleepy', 0);
    });
  }

  /**
   * Smoothly walks the window to target coordinates (targetX, targetY).
   * ZERO React re-renders in the 60fps loop.
   */
  public async walkTo(targetX: number, targetY: number, onDone: () => void) {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.isWalking = true;

    let currentX = targetX;
    let currentY = targetY;

    if (window.desktopAPI?.getWindowPosition) {
      try {
        const pos = await window.desktopAPI.getWindowPosition();
        currentX = pos.x;
        currentY = pos.y;
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
        this.stateChangeCallback('idle', 'happy', 0);
        onDone();
        return;
      }

      // Only update facing angle if direction flips
      const targetFacing = curDx >= 0 ? Math.PI / 2 : -Math.PI / 2;
      if (targetFacing !== currentFacingAngle) {
        currentFacingAngle = targetFacing;
        this.stateChangeCallback('walk', 'curious', currentFacingAngle);
      }

      const stepDist = (this.speed * (stepInterval / 1000));
      const stepFraction = Math.min(1.0, stepDist / dist);
      const stepX = curDx * stepFraction;
      const stepY = curDy * stepFraction;

      currentX += stepX;
      currentY += stepY;

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
        window.desktopAPI.moveWindowBy(sendX, sendY);
      }
    }, stepInterval);
  }

  public stopWalking() {
    this.isWalking = false;
    if (this.currentWalkInterval) {
      clearInterval(this.currentWalkInterval);
      this.currentWalkInterval = null;
    }
  }

  public destroy() {
    this.stopWalking();
    if (this.settleTimer) clearTimeout(this.settleTimer);
  }
}
