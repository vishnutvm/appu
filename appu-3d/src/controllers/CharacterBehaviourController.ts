import * as THREE from 'three';
import { AppuAnimationState, AppuEmotion } from '../types/character';
import { AppuActionId } from '../types/actions';
import { AppuActionRegistry, APPU_ACTIONS } from './AppuActionRegistry';
import { CharacterTransformController } from './CharacterTransformController';
import { CharacterRotationController } from './CharacterRotationController';
import { CharacterMovementController } from './CharacterMovementController';
import { CharacterEmotionController } from './CharacterEmotionController';
import { CharacterReactionController } from './CharacterReactionController';
import { CharacterCollisionController } from './CharacterCollisionController';

export interface BehaviourCallbacks {
  onStateChange: (state: AppuAnimationState) => void;
  onEmotionChange: (emotion: AppuEmotion) => void;
  onActionComplete?: (actionId: AppuActionId) => void;
}

export class CharacterBehaviourController {
  private currentState: AppuAnimationState = 'idle';
  private currentActionId: AppuActionId | null = null;
  private pendingActionId: AppuActionId | null = null;
  private stateTimer: number = 0;
  private stateDuration: number = 3.5;
  private isLooping: boolean = false;
  private autonomousEnabled: boolean = true;
  private callbacks: BehaviourCallbacks;
  private lookAroundOffset: number = 0;

  // External controller references (optional or passed during update)
  private emotionCtrl?: CharacterEmotionController;
  private reactionCtrl?: CharacterReactionController;
  private collisionCtrl?: CharacterCollisionController;

  constructor(callbacks: BehaviourCallbacks) {
    this.callbacks = callbacks;
  }

  public setControllers(
    emotionCtrl: CharacterEmotionController,
    reactionCtrl: CharacterReactionController,
    collisionCtrl: CharacterCollisionController
  ) {
    this.emotionCtrl = emotionCtrl;
    this.reactionCtrl = reactionCtrl;
    this.collisionCtrl = collisionCtrl;
  }

  public getState(): AppuAnimationState {
    return this.currentState;
  }

  public getActionId(): AppuActionId | null {
    return this.currentActionId;
  }

  public getLookAroundOffset(): number {
    return this.lookAroundOffset;
  }

  public setAutonomous(enabled: boolean) {
    this.autonomousEnabled = enabled;
  }

  public getAutonomous(): boolean {
    return this.autonomousEnabled;
  }

  /**
   * Sets state with priority checking and optional emotion update.
   */
  public setState(state: AppuAnimationState, emotion?: AppuEmotion, duration: number = 0) {
    // Prevent overriding collision or hurt unless higher priority
    if (this.currentState === 'collision' && state !== 'collision' && state !== 'hurt' && state !== 'recovering') {
      if (this.stateTimer < 0.25) return;
    }

    this.currentState = state;
    this.stateTimer = 0;
    this.stateDuration = duration > 0 ? duration : 3.0;
    this.callbacks.onStateChange(state);

    if (emotion) {
      if (this.emotionCtrl) {
        this.emotionCtrl.triggerNamedEmotion(emotion, duration);
      } else {
        this.callbacks.onEmotionChange(emotion);
      }
    }
  }

  /**
   * Executes a registered action according to state machine rules.
   */
  public triggerAction(actionId: AppuActionId): boolean {
    const actionDef = AppuActionRegistry.getById(actionId);
    if (!actionDef) return false;

    // 1. If currently sleeping and a different action is requested, wake up first
    if (this.isSleeping() && actionId !== 'wake_up' && actionId !== 'sleep' && actionId !== 'deep_sleep' && actionId !== 'sleep_side') {
      this.pendingActionId = actionId;
      this.wakeUp();
      return true;
    }

    // 2. If currently in a ground pose and requested action requires standing
    const isCurrentlyGround = this.isGroundPose();
    if (isCurrentlyGround && actionDef.standingRequired && !actionDef.isGroundPose) {
      this.pendingActionId = actionId;
      this.standUp();
      return true;
    }

    // 3. Directly execute the action
    this.pendingActionId = null;
    this.currentActionId = actionId;
    this.isLooping = actionDef.isLooping;
    this.stateTimer = 0;
    this.stateDuration = actionDef.duration ?? 999999;

    this.currentState = actionDef.animation;
    this.callbacks.onStateChange(actionDef.animation);

    if (this.emotionCtrl) {
      this.emotionCtrl.triggerNamedEmotion(actionDef.associatedEmotion, actionDef.duration ?? 4.0);
    } else {
      this.callbacks.onEmotionChange(actionDef.associatedEmotion);
    }

    return true;
  }

  /**
   * Smoothly returns Appu to standing idle posture.
   */
  public standUp() {
    if (this.isSleeping()) {
      this.wakeUp();
      return;
    }

    this.currentActionId = null;
    this.isLooping = false;
    this.setState('returning_to_idle', 'happy', 0.55);
  }

  /**
   * Awakens Appu from sleep with yawn, eye blinks, and transition to stretch or standing.
   */
  public wakeUp() {
    this.currentActionId = 'wake_up';
    this.isLooping = false;
    this.setState('wake_up', 'happy', 2.2);
  }

  public isSleeping(): boolean {
    return (
      this.currentState === 'sleep' ||
      this.currentState === 'deep_sleep' ||
      this.currentState === 'sleep_side' ||
      this.currentActionId === 'sleep' ||
      this.currentActionId === 'deep_sleep' ||
      this.currentActionId === 'sleep_side'
    );
  }

  public isGroundPose(): boolean {
    if (this.isSleeping()) return true;
    if (this.currentActionId && AppuActionRegistry.isGroundPose(this.currentActionId)) {
      return true;
    }
    return (
      this.currentState === 'sit' ||
      this.currentState === 'sit_relaxed' ||
      this.currentState === 'sit_legs_extended' ||
      this.currentState === 'sit_cross_legged' ||
      this.currentState === 'lie_down' ||
      this.currentState === 'lie_down_side' ||
      this.currentState === 'side_rest' ||
      this.currentState === 'rest_head_on_hands' ||
      this.currentState === 'handstand' ||
      this.currentState === 'upside_down'
    );
  }

  // --- Interaction Event Handlers ---

  public onDragStart() {
    // Drag interrupts any running action or sleep safely
    this.pendingActionId = null;
    this.currentActionId = null;
    this.isLooping = false;
    this.setState('being_dragged', 'surprised');
  }

  public onDragEnd(_releaseVelocity?: THREE.Vector3) {
    // When released, transition to 'released' state for settling recovery
    this.setState('released', 'curious', 0.65);
  }

  public onCollision(impactSpeed: number) {
    this.pendingActionId = null;
    this.currentActionId = null;
    this.isLooping = false;
    if (impactSpeed > 2.2) {
      this.setState('collision', 'hurt', 0.45);
    } else {
      this.setState('collision', 'surprised', 0.35);
    }
  }

  public onPettingStart() {
    if (!this.isSleeping()) {
      this.setState('interacting', 'happy', 1.5);
    }
  }

  public onPettingEnd() {
    if (!this.isSleeping() && this.currentState === 'interacting') {
      this.setState('happy', 'happy', 0.8);
    }
  }

  public onTapAcknowledge() {
    if (this.isSleeping()) {
      // Tapping/clicking Appu while sleeping wakes him up!
      this.wakeUp();
    } else if (this.isGroundPose()) {
      this.setState('surprised', 'happy', 0.4);
    } else {
      this.setState('surprised', 'happy', 0.6);
    }
  }

  // --- Main Update Loop ---

  public update(
    dt: number,
    transformCtrl: CharacterTransformController,
    rotationCtrl: CharacterRotationController,
    movementCtrl: CharacterMovementController
  ) {
    this.stateTimer += dt;
    const currentPos = transformCtrl.getPosition();

    // 1. Being Dragged - Purely governed by pointer
    if (this.currentState === 'being_dragged') {
      movementCtrl.resetVelocity();
      return;
    }

    // 2. Released - Settling to ground and recovering balance
    if (this.currentState === 'released') {
      if (this.stateTimer >= 0.55) {
        this.setState('recovering', 'curious', 0.45);
      }
      return;
    }

    // 3. Collision / Hurt - Impact recoil active
    if (this.currentState === 'collision' || this.currentState === 'hurt') {
      movementCtrl.resetVelocity();
      if (this.stateTimer >= this.stateDuration) {
        this.setState('recovering', 'neutral', 0.6);
      }
      return;
    }

    // 4. Recovering - Smooth return to idle posture
    if (this.currentState === 'recovering') {
      if (this.stateTimer >= this.stateDuration) {
        this.currentActionId = null;
        this.setState('idle', 'happy', 2.5 + Math.random() * 2.0);
      }
      return;
    }

    // 5. Returning to Idle (Smooth Stand-Up Transition)
    if (this.currentState === 'returning_to_idle') {
      movementCtrl.resetVelocity();
      if (this.stateTimer >= this.stateDuration) {
        if (this.pendingActionId) {
          const nextAct = this.pendingActionId;
          this.pendingActionId = null;
          this.triggerAction(nextAct);
        } else {
          this.currentActionId = null;
          this.setState('idle', 'happy', 2.5);
        }
      }
      return;
    }

    // 6. Wake Up animation completing
    if (this.currentState === 'wake_up') {
      movementCtrl.resetVelocity();
      if (this.stateTimer >= this.stateDuration) {
        if (this.pendingActionId) {
          const nextAct = this.pendingActionId;
          this.pendingActionId = null;
          this.triggerAction(nextAct);
        } else {
          // Smooth stretch after waking
          this.triggerAction('stretch');
        }
      }
      return;
    }

    // 7. Temporary / Non-looping Actions with Defined Durations
    if (this.currentActionId) {
      const actDef = APPU_ACTIONS[this.currentActionId];
      if (actDef && !actDef.isLooping && actDef.duration) {
        if (this.stateTimer >= actDef.duration) {
          const completedId = this.currentActionId;
          this.callbacks.onActionComplete?.(completedId);

          if (actDef.returnToIdle) {
            if (actDef.isGroundPose) {
              this.currentActionId = null;
              this.setState('returning_to_idle', 'happy', 0.5);
            } else {
              this.currentActionId = null;
              this.setState('idle', 'happy', 3.0);
            }
          }
          return;
        }
        return;
      }

      // Permanent / Looping actions (e.g. sit, sleep, bored) stay until replaced
      if (actDef && actDef.isLooping) {
        movementCtrl.resetVelocity();
        return;
      }
    }

    // 8. Interacting / Petting - Gentle reaction
    if (this.currentState === 'interacting') {
      movementCtrl.resetVelocity();
      return;
    }

    // 9. Turning State: Wait for rotation to align with movement direction
    if (this.currentState === 'turning') {
      const targetDest = movementCtrl.getDestination();
      if (!targetDest) {
        this.setState('idle', 'happy');
        return;
      }

      const yawDiff = Math.abs(rotationCtrl.getTargetYaw() - rotationCtrl.getYaw());
      if (yawDiff < 0.32 || this.stateTimer > 2.0) {
        this.setState('walking', 'curious');
      }
      return;
    }

    // 10. Walking State
    if (this.currentState === 'walking') {
      const dest = movementCtrl.getDestination();
      if (!dest) {
        this.setState('idle', 'happy');
        return;
      }

      const dist = currentPos.distanceTo(dest);

      const boundaryCheck = transformCtrl.isAtBoundary(currentPos, 0.28);
      if (boundaryCheck.hit) {
        const safeX = -Math.sign(currentPos.x || 1) * (0.4 + Math.random() * 0.7);
        const safeZ = -Math.sign(currentPos.z || 1) * (0.2 + Math.random() * 0.4);
        this.startWalkTo(safeX, safeZ, rotationCtrl, movementCtrl, currentPos);
        return;
      }

      if (dist < 0.45) {
        this.setState('arriving', 'happy', 1.0);
      }
      return;
    }

    // 11. Arriving State: Decelerating to stop
    if (this.currentState === 'arriving') {
      const speed = movementCtrl.getSpeed();
      if (speed < 0.05 || this.stateTimer > 1.2) {
        movementCtrl.stop();
        this.setState('idle', 'happy', 3.0 + Math.random() * 3.0);
      }
      return;
    }

    // 12. Looking Around / Curious State
    if (this.currentState === 'looking_around' || this.currentState === 'looking') {
      this.lookAroundOffset = Math.sin(this.stateTimer * 2.2) * 0.28;
      if (this.stateTimer >= this.stateDuration) {
        this.lookAroundOffset = 0;
        this.setState('idle', 'neutral', 2.5 + Math.random() * 2.5);
      }
      return;
    }

    // 13. Surprised / Happy temporary reactions
    if (this.currentState === 'surprised' || this.currentState === 'happy') {
      if (this.stateTimer >= this.stateDuration) {
        this.setState('idle', 'neutral', 3.0);
      }
      return;
    }

    // 14. Idle State: Autonomous roaming & decision engine
    if (this.currentState === 'idle') {
      this.lookAroundOffset = 0;

      if (!this.autonomousEnabled) return;

      if (this.stateTimer >= this.stateDuration) {
        this.stateTimer = 0;
        const choice = Math.random();

        if (choice < 0.32) {
          this.setState('looking_around', 'curious', 2.2 + Math.random() * 2.0);
        } else if (choice < 0.78) {
          const targetX = (Math.random() * 2 - 1) * 1.3;
          const targetZ = (Math.random() * 2 - 1) * 0.65;

          if (Math.hypot(targetX - currentPos.x, targetZ - currentPos.z) > 0.45) {
            this.startWalkTo(targetX, targetZ, rotationCtrl, movementCtrl, currentPos);
          } else {
            this.stateDuration = 2.0;
          }
        } else {
          const emo: AppuEmotion = Math.random() > 0.5 ? 'happy' : 'neutral';
          if (this.emotionCtrl) {
            this.emotionCtrl.setBaselineEmotion(emo);
          } else {
            this.callbacks.onEmotionChange(emo);
          }
          this.stateDuration = 3.0 + Math.random() * 3.0;
        }
      }
    }
  }

  /**
   * Commands Appu to face and walk towards target coordinates smoothly.
   */
  public startWalkTo(
    targetX: number,
    targetZ: number,
    rotationCtrl: CharacterRotationController,
    movementCtrl: CharacterMovementController,
    currentPos?: THREE.Vector3
  ) {
    this.currentActionId = null;
    this.isLooping = false;
    movementCtrl.setDestination(targetX, targetZ);
    const dirX = currentPos ? targetX - currentPos.x : targetX;
    const dirZ = currentPos ? targetZ - currentPos.z : targetZ;
    rotationCtrl.setFacingDirection(dirX, dirZ);
    this.setState('turning', 'curious', 1.8);
  }

  public reset() {
    this.currentState = 'idle';
    this.currentActionId = null;
    this.pendingActionId = null;
    this.stateTimer = 0;
    this.stateDuration = 3.5;
    this.isLooping = false;
    this.lookAroundOffset = 0;
    this.callbacks.onStateChange('idle');
    this.callbacks.onEmotionChange('happy');
  }
}
