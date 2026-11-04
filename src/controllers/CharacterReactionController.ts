import * as THREE from 'three';
import { AppuEmotion, AppuAnimationState } from '../types/character';

export interface ReactionCallbacks {
  onEmotionTrigger: (emotion: AppuEmotion, duration: number) => void;
  onStateTrigger: (state: AppuAnimationState, duration: number) => void;
  onAudioImpact?: (impactSpeed: number) => void;
}

export class CharacterReactionController {
  // Spring damper state for physical recoil
  private recoilOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private recoilVelocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private headPitch: number = 0;
  private headPitchVelocity: number = 0;
  private torsoRoll: number = 0;
  private torsoRollVelocity: number = 0;
  private squashX: number = 0;
  private squashY: number = 0;

  // Reaction timer & active status
  private isReacting: boolean = false;
  private reactionTimer: number = 0;
  private reactionTotalDuration: number = 0;
  private lastImpactTime: number = 0;
  private intensityMultiplier: number = 1.0;

  private callbacks?: ReactionCallbacks;

  constructor(callbacks?: ReactionCallbacks) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: ReactionCallbacks) {
    this.callbacks = callbacks;
  }

  public setIntensity(intensity: number) {
    this.intensityMultiplier = THREE.MathUtils.clamp(intensity, 0.2, 2.5);
  }

  public getIntensity(): number {
    return this.intensityMultiplier;
  }

  public getIsReacting(): boolean {
    return this.isReacting;
  }

  /**
   * Triggers a physically plausible impact response.
   * @param normal Normal vector pointing OUT of the impacted surface
   * @param impactSpeed Magnitude of relative impact velocity
   */
  public triggerImpact(normal: THREE.Vector3, impactSpeed: number = 1.0) {
    const now = performance.now();
    // Cooldown check (prevent machine-gun triggers)
    if (now - this.lastImpactTime < 240) return;
    this.lastImpactTime = now;

    const effectiveSpeed = Math.max(0.6, impactSpeed) * this.intensityMultiplier;

    // Small, controlled recoil impulse along collision normal (pushing Appu backwards)
    const recoilMagnitude = THREE.MathUtils.clamp(effectiveSpeed * 0.06, 0.04, 0.18);
    const impulse = normal.clone().multiplyScalar(recoilMagnitude * 12.0);
    this.recoilVelocity.copy(impulse);

    // Head jerk backward (pitch up/back depending on contact direction)
    const headJerk = THREE.MathUtils.clamp(effectiveSpeed * 0.12, 0.15, 0.42);
    this.headPitchVelocity = headJerk * 14.0;

    // Torso squash and roll
    const squashAmt = THREE.MathUtils.clamp(effectiveSpeed * 0.08, 0.08, 0.22);
    this.squashX = squashAmt;
    this.squashY = -squashAmt;

    // Roll tilt if impact was oblique
    if (Math.abs(normal.x) > 0.3) {
      this.torsoRollVelocity = -Math.sign(normal.x) * THREE.MathUtils.clamp(effectiveSpeed * 0.08, 0.05, 0.16) * 10.0;
    }

    this.isReacting = true;
    this.reactionTimer = 0;

    // Audio tactile bump
    this.callbacks?.onAudioImpact?.(effectiveSpeed);

    // Emotional and state reaction staged sequence based on impact severity
    if (effectiveSpeed < 1.4) {
      // Light bump: Surprised -> recovery -> idle
      this.reactionTotalDuration = 0.55;
      this.callbacks?.onStateTrigger('collision', 0.25);
      this.callbacks?.onEmotionTrigger('surprised', 0.55);
    } else if (effectiveSpeed < 2.6) {
      // Moderate impact: Surprised briefly -> Hurt (squinted >< eyes) -> recovery
      this.reactionTotalDuration = 0.95;
      this.callbacks?.onStateTrigger('collision', 0.35);
      this.callbacks?.onEmotionTrigger('hurt', 0.95);
    } else {
      // Strong impact: Hurt -> Dizzy (spiral @ @ eyes) -> recovery
      this.reactionTotalDuration = 1.6;
      this.callbacks?.onStateTrigger('collision', 0.45);
      this.callbacks?.onEmotionTrigger('hurt', 0.65);
      setTimeout(() => {
        if (this.isReacting) {
          this.callbacks?.onEmotionTrigger('dizzy', 0.95);
        }
      }, 650);
    }
  }

  /**
   * Updates spring physics and damping for recoil, head and torso.
   */
  public update(dt: number) {
    if (dt <= 0) return;

    // Critically-damped spring for position recoil
    // F_spring = -k * x, F_damping = -c * v
    const kPos = 180.0;
    const cPos = 24.0;
    const ax = -kPos * this.recoilOffset.x - cPos * this.recoilVelocity.x;
    const az = -kPos * this.recoilOffset.z - cPos * this.recoilVelocity.z;
    this.recoilVelocity.x += ax * dt;
    this.recoilVelocity.z += az * dt;
    this.recoilOffset.x += this.recoilVelocity.x * dt;
    this.recoilOffset.z += this.recoilVelocity.z * dt;

    // Head pitch spring
    const kHead = 160.0;
    const cHead = 22.0;
    const aHead = -kHead * this.headPitch - cHead * this.headPitchVelocity;
    this.headPitchVelocity += aHead * dt;
    this.headPitch += this.headPitchVelocity * dt;

    // Torso roll spring
    const kRoll = 140.0;
    const cRoll = 20.0;
    const aRoll = -kRoll * this.torsoRoll - cRoll * this.torsoRollVelocity;
    this.torsoRollVelocity += aRoll * dt;
    this.torsoRoll += this.torsoRollVelocity * dt;

    // Squash decay
    this.squashX = THREE.MathUtils.lerp(this.squashX, 0, dt * 12.0);
    this.squashY = THREE.MathUtils.lerp(this.squashY, 0, dt * 12.0);

    // Track total reaction time
    if (this.isReacting) {
      this.reactionTimer += dt;
      if (
        this.reactionTimer >= this.reactionTotalDuration &&
        this.recoilOffset.length() < 0.005 &&
        Math.abs(this.headPitch) < 0.01
      ) {
        this.isReacting = false;
        this.recoilOffset.set(0, 0, 0);
        this.recoilVelocity.set(0, 0, 0);
        this.headPitch = 0;
        this.headPitchVelocity = 0;
        this.torsoRoll = 0;
        this.torsoRollVelocity = 0;
      }
    }
  }

  public getRecoilOffset(): THREE.Vector3 {
    return this.recoilOffset;
  }

  public getHeadPitch(): number {
    return this.headPitch;
  }

  public getTorsoRoll(): number {
    return this.torsoRoll;
  }

  public getSquash(): { x: number; y: number } {
    return { x: this.squashX, y: this.squashY };
  }

  public reset() {
    this.recoilOffset.set(0, 0, 0);
    this.recoilVelocity.set(0, 0, 0);
    this.headPitch = 0;
    this.headPitchVelocity = 0;
    this.torsoRoll = 0;
    this.torsoRollVelocity = 0;
    this.squashX = 0;
    this.squashY = 0;
    this.isReacting = false;
    this.reactionTimer = 0;
    this.lastImpactTime = 0;
  }
}
