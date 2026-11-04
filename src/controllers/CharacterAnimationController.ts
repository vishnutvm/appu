import * as THREE from 'three';
import { AppuAnimationState } from '../types/character';

export interface SkeletalRefs {
  root: THREE.Group | null;
  head: THREE.Group | null;
  leftArm: THREE.Group | null;
  rightArm: THREE.Group | null;
  leftForearm: THREE.Group | null;
  rightForearm: THREE.Group | null;
  leftLeg: THREE.Group | null;
  rightLeg: THREE.Group | null;
  leftLowerLeg: THREE.Group | null;
  rightLowerLeg: THREE.Group | null;
}

export interface AnimationEngineParams {
  state: AppuAnimationState;
  worldPosition: THREE.Vector3;
  yaw: number;
  speed: number;
  angularVelocity: number;
  isTurning: boolean;
  isGrabbed: boolean;
  isPetting: boolean;
  petIntensity?: number;
  dragVelocity?: THREE.Vector3;
  reactionRecoil?: THREE.Vector3;
  reactionHeadPitch?: number;
  reactionTorsoRoll?: number;
  reactionSquash?: { x: number; y: number };
  physicsTilt?: number; // Body lean from horizontal momentum / drag
  physicsVerticalVel?: number; // Vertical fall/rise velocity (px/s)
  breathingEnabled: boolean;
  lookAtTarget: { x: number; y: number }; // Normalized screen coordinates [-1, 1]
  lookAroundOffset: number;
  spawnProgress?: number; // Normalized spawn interpolation [0, 1]
  time: number;
  dt: number;
}

export class CharacterAnimationController {
  private stridePhase: number = 0;
  private readonly strideLength: number = 0.32; // meters per half-stride

  // Settling spring on release
  private releaseSettleTime: number = 1.0;
  private releaseTimer: number = 1.0;
  private wasGrabbedLastFrame: boolean = false;

  // Smoothing states
  private smoothedFollowThroughX: number = 0;
  private smoothedFollowThroughZ: number = 0;
  private currentLiftHeight: number = 0;

  // Internal spin accumulator for 360 spin animation
  private spinAngle: number = 0;

  /**
   * Updates all skeletal joints with realistic follow-through, inertia, and stabilization.
   */
  public update(refs: SkeletalRefs, params: AnimationEngineParams) {
    const {
      state,
      worldPosition,
      yaw,
      speed,
      angularVelocity,
      isTurning,
      isGrabbed,
      isPetting,
      petIntensity = 0.5,
      dragVelocity = new THREE.Vector3(0, 0, 0),
      reactionRecoil = new THREE.Vector3(0, 0, 0),
      reactionHeadPitch = 0,
      reactionTorsoRoll = 0,
      reactionSquash = { x: 0, y: 0 },
      physicsTilt = 0,
      physicsVerticalVel = 0,
      breathingEnabled,
      lookAtTarget,
      lookAroundOffset,
      spawnProgress = 1.0,
      time,
      dt,
    } = params;

    // Detect release moment
    if (this.wasGrabbedLastFrame && !isGrabbed) {
      this.releaseTimer = 0; // Trigger settling bounce
    }
    this.wasGrabbedLastFrame = isGrabbed;

    if (this.releaseTimer < this.releaseSettleTime) {
      this.releaseTimer += dt;
    }

    // 1. Stride Phase Accumulation (Zero Foot Sliding)
    if (speed > 0.02 && !isGrabbed) {
      this.stridePhase += (speed / this.strideLength) * dt * Math.PI;
    } else {
      // Gently return phase to stable ground foot-plant
      this.stridePhase = THREE.MathUtils.lerp(
        this.stridePhase,
        Math.round(this.stridePhase / Math.PI) * Math.PI,
        dt * 8.0
      );
    }

    // 2. Drag Follow-Through & Inertia Lag
    const targetFollowThroughX = isGrabbed ? -THREE.MathUtils.clamp(dragVelocity.x * 0.045, -0.22, 0.22) : 0;
    const targetFollowThroughZ = isGrabbed ? -THREE.MathUtils.clamp(dragVelocity.z * 0.045, -0.22, 0.22) : 0;
    this.smoothedFollowThroughX = THREE.MathUtils.lerp(this.smoothedFollowThroughX, targetFollowThroughX, dt * 10.0);
    this.smoothedFollowThroughZ = THREE.MathUtils.lerp(this.smoothedFollowThroughZ, targetFollowThroughZ, dt * 10.0);

    // 3. Lift Height (smooth elevation when picked up)
    const targetLift = isGrabbed ? 0.12 : 0;
    this.currentLiftHeight = THREE.MathUtils.lerp(this.currentLiftHeight, targetLift, dt * 9.0);

    // 4. Update ROOT Group Transform (Position, Rotation, Scale)
    this.updateRootTransform(refs.root, {
      state,
      worldPosition,
      yaw,
      speed,
      angularVelocity,
      isGrabbed,
      isPetting,
      petIntensity,
      reactionRecoil,
      reactionTorsoRoll,
      reactionSquash,
      physicsTilt,
      physicsVerticalVel,
      breathingEnabled,
      spawnProgress,
      time,
      dt,
    });

    // 5. Update HEAD Kinematics (Gaze Tracking, Emotional Tilts, Ground Head Stabilization)
    this.updateHead(refs.head, {
      state,
      lookAtTarget,
      lookAroundOffset,
      isTurning,
      angularVelocity,
      isPetting,
      petIntensity,
      isGrabbed,
      speed,
      reactionHeadPitch,
      physicsVerticalVel,
      time,
      dt,
    });

    // 6. Update ARMS & FOREARMS
    this.updateArms(refs, state, speed, isGrabbed, isPetting, petIntensity, time, dt, lookAtTarget, physicsVerticalVel);

    // 7. Update LEGS & LOWER LEGS
    this.updateLegs(refs, state, speed, isGrabbed, time, dt, physicsVerticalVel);
  }

  // =========================================================================
  // ROOT BODY TRANSFORM
  // =========================================================================
  private updateRootTransform(
    root: THREE.Group | null,
    params: {
      state: AppuAnimationState;
      worldPosition: THREE.Vector3;
      yaw: number;
      speed: number;
      angularVelocity: number;
      isGrabbed: boolean;
      isPetting: boolean;
      petIntensity: number;
      reactionRecoil: THREE.Vector3;
      reactionTorsoRoll: number;
      reactionSquash: { x: number; y: number };
      physicsTilt?: number;
      physicsVerticalVel?: number;
      breathingEnabled: boolean;
      spawnProgress?: number;
      time: number;
      dt: number;
    }
  ) {
    if (!root) return;

    const {
      state,
      worldPosition,
      yaw,
      speed,
      angularVelocity,
      isGrabbed,
      isPetting,
      petIntensity,
      reactionRecoil,
      reactionTorsoRoll,
      reactionSquash,
      physicsTilt = 0,
      physicsVerticalVel = 0,
      breathingEnabled,
      spawnProgress = 1.0,
      time,
      dt,
    } = params;

    let targetY = 0.04;
    let targetPitchX = 0;
    let targetRollZ = 0;
    let targetYaw = yaw;

    // --- 3D Spawn Animation Spring Easing & Elevation ---
    const clampedSpawn = THREE.MathUtils.clamp(spawnProgress, 0, 1);
    let spawnScaleFactor = 1.0;
    let spawnElevationOffset = 0.0;
    if (clampedSpawn < 0.999) {
      if (clampedSpawn <= 0.7) {
        // Elastic spring expansion with cubic ease-out
        const tNorm = clampedSpawn / 0.7;
        spawnScaleFactor = (1 - Math.pow(1 - tNorm, 3)) * 1.07;
      } else {
        // Soft settling overshoot (1.07 down to 1.0)
        const settleNorm = (clampedSpawn - 0.7) / 0.3;
        spawnScaleFactor = 1.07 - Math.sin(settleNorm * (Math.PI / 2)) * 0.07;
      }
      // Rises smoothly from -0.32 under floor up to surface
      spawnElevationOffset = (1.0 - clampedSpawn) * -0.32;
    }
    targetY += spawnElevationOffset;

    // --- Vertical Elevation (targetY) ---
    if (isGrabbed) {
      targetY = 0.04 + this.currentLiftHeight + Math.sin(time * 3.2) * 0.015;
    } else if (this.releaseTimer < 0.45) {
      const t = this.releaseTimer / 0.45;
      targetY = 0.04 + Math.max(0, Math.sin(t * Math.PI * 2)) * (1 - t) * 0.035;
    } else if (state === 'sit' || state === 'sit_relaxed') {
      targetY = -0.22;
    } else if (state === 'sit_legs_extended' || state === 'sit_cross_legged') {
      targetY = -0.25;
    } else if (state === 'lie_down') {
      targetY = -0.36;
    } else if (state === 'lie_down_side' || state === 'sleep_side') {
      targetY = -0.34;
    } else if (state === 'side_rest') {
      targetY = -0.28;
    } else if (state === 'rest_head_on_hands') {
      targetY = -0.32;
    } else if (state === 'sleep' || state === 'deep_sleep') {
      targetY = -0.34;
    } else if (state === 'wake_up') {
      targetY = -0.16; // Rising
    } else if (state === 'returning_to_idle') {
      targetY = 0.04; // Returning to standing floor
    } else if (state === 'handstand') {
      targetY = 0.44; // Inverted elevated on hands
    } else if (state === 'upside_down') {
      targetY = 0.40;
    } else if (state === 'jump') {
      const jumpCycle = Math.sin(time * 7.0);
      targetY = jumpCycle > 0 ? 0.04 + jumpCycle * 0.28 : 0.04 + jumpCycle * 0.04;
    } else if (state === 'cheer' || state === 'celebrate') {
      targetY = 0.04 + Math.abs(Math.sin(time * 7.5)) * 0.038;
    } else if (state === 'clap') {
      targetY = 0.04 + Math.abs(Math.sin(time * 6.0)) * 0.016;
    } else if (state === 'dance') {
      targetY = 0.04 + Math.abs(Math.sin(time * 6.0)) * 0.024;
    } else if (speed > 0.05) {
      targetY = 0.04 + Math.abs(Math.sin(this.stridePhase)) * 0.036;
    } else if (isPetting) {
      targetY = 0.04 + Math.sin(time * 4.0) * 0.012 * petIntensity;
    } else if (breathingEnabled) {
      targetY = 0.04 + Math.sin(time * 1.8) * 0.012;
    }

    // --- Pitch (targetPitchX) & Roll (targetRollZ) ---
    if (state === 'lie_down') {
      targetPitchX = THREE.MathUtils.degToRad(-88);
      targetRollZ = 0;
    } else if (state === 'lie_down_side' || state === 'sleep_side') {
      targetPitchX = THREE.MathUtils.degToRad(-10);
      targetRollZ = THREE.MathUtils.degToRad(-86);
    } else if (state === 'side_rest') {
      targetPitchX = THREE.MathUtils.degToRad(-14);
      targetRollZ = THREE.MathUtils.degToRad(-75);
    } else if (state === 'rest_head_on_hands') {
      targetPitchX = THREE.MathUtils.degToRad(80);
      targetRollZ = 0;
    } else if (state === 'sleep') {
      targetPitchX = THREE.MathUtils.degToRad(-8);
      targetRollZ = THREE.MathUtils.degToRad(-85);
    } else if (state === 'deep_sleep') {
      targetPitchX = THREE.MathUtils.degToRad(-10);
      targetRollZ = THREE.MathUtils.degToRad(-90);
    } else if (state === 'sit_relaxed') {
      targetPitchX = THREE.MathUtils.degToRad(-14); // Leaning back
    } else if (state === 'bow') {
      targetPitchX = THREE.MathUtils.degToRad(32); // Polite forward bow
    } else if (state === 'bored') {
      targetPitchX = THREE.MathUtils.degToRad(12); // Slouched forward
    } else if (state === 'handstand') {
      targetPitchX = THREE.MathUtils.degToRad(-178) + Math.cos(time * 6.0) * 0.02;
      targetRollZ = Math.sin(time * 7.0) * 0.025;
    } else if (state === 'upside_down') {
      targetRollZ = THREE.MathUtils.degToRad(176);
    } else if (state === 'spin') {
      this.spinAngle += dt * 8.5;
      targetYaw = yaw + this.spinAngle;
      targetPitchX = THREE.MathUtils.degToRad(-6);
    } else if (state === 'dance') {
      targetRollZ = Math.sin(time * 6.0) * 0.08;
      targetPitchX = Math.cos(time * 6.0) * 0.04;
    } else if (state === 'dizzy') {
      targetRollZ = Math.sin(time * 4.2) * 0.14;
      targetPitchX = Math.cos(time * 4.2) * 0.12;
    } else if (state === 'play_cursor') {
      targetPitchX = THREE.MathUtils.degToRad(18); // Leaning eagerly forward
    } else if (state === 'curious') {
      targetPitchX = THREE.MathUtils.degToRad(12);
      targetRollZ = THREE.MathUtils.degToRad(-6);
    } else if (state === 'falling') {
      // Free-fall posture: tilt forward with subtle aerodynamic roll
      targetPitchX = THREE.MathUtils.degToRad(14);
      targetRollZ = physicsTilt;
    } else if (state === 'rising') {
      // Moving upward against gravity: slight backward tilt
      targetPitchX = THREE.MathUtils.degToRad(-10);
      targetRollZ = physicsTilt;
    } else if (state === 'landing' || state === 'bouncing') {
      targetPitchX = THREE.MathUtils.degToRad(8);
      targetRollZ = physicsTilt * 0.5;
    }

    // Dynamic turning, recoil and follow-through adjustments for standing
    if (!isGrabbed && (state === 'idle' || state === 'walking' || state === 'arriving')) {
      if (Math.abs(angularVelocity) > 0.1) {
        targetRollZ += -THREE.MathUtils.clamp(angularVelocity * 0.035, -0.09, 0.09);
      } else if (speed > 0.1) {
        targetRollZ += Math.sin(this.stridePhase) * 0.025; // Lateral hip sway
      } else if (isPetting) {
        targetRollZ += Math.sin(time * 3.0) * 0.03 * petIntensity;
      }
      if (speed > 0.15) {
        targetPitchX += 0.028;
      }
    }

    // Smooth root position lerp
    root.position.x = THREE.MathUtils.lerp(root.position.x, worldPosition.x + reactionRecoil.x, dt * 10.0);
    root.position.y = THREE.MathUtils.lerp(root.position.y, worldPosition.y + targetY, dt * 8.5);
    root.position.z = THREE.MathUtils.lerp(root.position.z, worldPosition.z + reactionRecoil.z, dt * 10.0);

    // Smooth rotations
    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetYaw, dt * 12.0);
    root.rotation.z = THREE.MathUtils.lerp(
      root.rotation.z,
      targetRollZ + this.smoothedFollowThroughX + reactionTorsoRoll + (isGrabbed ? physicsTilt : 0),
      dt * 9.5
    );
    root.rotation.x = THREE.MathUtils.lerp(
      root.rotation.x,
      targetPitchX + this.smoothedFollowThroughZ,
      dt * 9.5
    );

    // Breathing expansion scale
    let breatheScale = 1.0;
    if (breathingEnabled && !isGrabbed) {
      if (state === 'sleep' || state === 'deep_sleep' || state === 'sleep_side') {
        breatheScale = 1.0 + Math.sin(time * 1.3) * 0.016; // Slow deep sleeping breath
      } else {
        breatheScale = 1.0 + Math.sin(time * 2.2) * 0.012;
      }
    }

    const scaleX = 0.78 * breatheScale * (1.0 + reactionSquash.x) * spawnScaleFactor;
    const scaleY = 0.78 * breatheScale * (1.0 + reactionSquash.y) * spawnScaleFactor;
    const scaleZ = 0.78 * breatheScale * (1.0 + reactionSquash.x) * spawnScaleFactor;
    root.scale.set(scaleX, scaleY, scaleZ);
  }

  // =========================================================================
  // HEAD KINEMATICS
  // =========================================================================
  private updateHead(
    head: THREE.Group | null,
    params: {
      state: AppuAnimationState;
      lookAtTarget: { x: number; y: number };
      lookAroundOffset: number;
      isTurning: boolean;
      angularVelocity: number;
      isPetting: boolean;
      petIntensity: number;
      isGrabbed: boolean;
      speed: number;
      reactionHeadPitch: number;
      physicsVerticalVel?: number;
      time: number;
      dt: number;
    }
  ) {
    if (!head) return;

    const {
      state,
      lookAtTarget,
      lookAroundOffset,
      isTurning,
      angularVelocity,
      isPetting,
      petIntensity,
      isGrabbed,
      speed,
      reactionHeadPitch,
      physicsVerticalVel = 0,
      time,
      dt,
    } = params;

    // Clamped realistic gaze angles: Yaw ±40° (±0.7 rad), Pitch [-25°, +20°]
    const clampedGazeX = THREE.MathUtils.clamp(lookAtTarget.x, -1.0, 1.0);
    const clampedGazeY = THREE.MathUtils.clamp(lookAtTarget.y, -1.0, 1.0);

    let baseHeadYaw = clampedGazeX * 0.42;
    let baseHeadPitch = -clampedGazeY * 0.28;
    let baseHeadRoll = -clampedGazeX * 0.07;

    // Turning anticipation
    const turnAnticipation = isTurning
      ? THREE.MathUtils.clamp(angularVelocity * 0.12, -0.36, 0.36)
      : 0;

    // Special head actions & postures
    if (state === 'sleep' || state === 'deep_sleep') {
      baseHeadPitch = THREE.MathUtils.degToRad(16);
      baseHeadRoll = THREE.MathUtils.degToRad(18) + Math.sin(time * 0.4) * 0.04;
      baseHeadYaw = 0;
    } else if (state === 'side_rest') {
      baseHeadPitch = THREE.MathUtils.degToRad(10);
      baseHeadRoll = THREE.MathUtils.degToRad(45);
    } else if (state === 'rest_head_on_hands') {
      baseHeadPitch = THREE.MathUtils.degToRad(-65);
    } else if (state === 'think') {
      baseHeadRoll = THREE.MathUtils.degToRad(18); // Inquisitive tilt
      baseHeadPitch = THREE.MathUtils.degToRad(-14);
      baseHeadYaw = THREE.MathUtils.degToRad(12);
    } else if (state === 'nod') {
      baseHeadPitch = Math.sin(time * 8.5) * 0.24; // Nodding motion
      baseHeadRoll = 0;
    } else if (state === 'clap') {
      baseHeadPitch = Math.sin(time * 12.0) * 0.04; // Subtle rhythmic nod on each clap
    } else if (state === 'bow') {
      baseHeadPitch = THREE.MathUtils.degToRad(18);
    } else if (state === 'bored') {
      baseHeadPitch = THREE.MathUtils.degToRad(25) + Math.sin(time * 1.2) * 0.03;
      baseHeadRoll = THREE.MathUtils.degToRad(8);
    } else if (state === 'shy') {
      baseHeadYaw = THREE.MathUtils.degToRad(-26);
      baseHeadPitch = THREE.MathUtils.degToRad(16);
      baseHeadRoll = THREE.MathUtils.degToRad(12);
    } else if (state === 'confused') {
      baseHeadRoll = THREE.MathUtils.degToRad(-18);
      baseHeadPitch = THREE.MathUtils.degToRad(-8);
    } else if (state === 'dizzy') {
      baseHeadPitch = Math.sin(time * 4.5) * 0.22;
      baseHeadRoll = Math.cos(time * 4.5) * 0.22;
    } else if (state === 'handstand') {
      baseHeadPitch = THREE.MathUtils.degToRad(-50); // Looking at ground between hands
    } else if (state === 'stretch') {
      baseHeadPitch = THREE.MathUtils.degToRad(-24); // Looking up while stretching
    } else if (state === 'falling') {
      // Look down toward oncoming floor
      baseHeadPitch = THREE.MathUtils.degToRad(22);
    } else if (state === 'rising') {
      // Look up toward apex of throw
      baseHeadPitch = THREE.MathUtils.degToRad(-18);
    } else if (state === 'landing') {
      // Impact tuck
      baseHeadPitch = THREE.MathUtils.degToRad(16);
    }

    const petPitch = isPetting ? -0.16 * petIntensity : 0;
    const petRoll = isPetting ? 0.12 * Math.sin(time * 2.5) * petIntensity : 0;
    const dragPitch = isGrabbed ? -0.12 : 0;
    const walkingBobStabilization = speed > 0.05 ? -Math.abs(Math.sin(this.stridePhase)) * 0.04 : 0;

    const targetHeadYaw = THREE.MathUtils.clamp(
      baseHeadYaw + lookAroundOffset + turnAnticipation,
      -0.85,
      0.85
    );
    const targetHeadPitch = THREE.MathUtils.clamp(
      baseHeadPitch + dragPitch + petPitch + walkingBobStabilization + reactionHeadPitch,
      -1.2,
      0.9
    );
    const targetHeadRoll = THREE.MathUtils.clamp(baseHeadRoll + petRoll, -0.85, 0.85);

    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetHeadYaw, dt * 8.0);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, targetHeadPitch, dt * 8.5);
    head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targetHeadRoll, dt * 7.5);
  }

  // =========================================================================
  // ARMS & FOREARMS KINEMATICS
  // =========================================================================
  private updateArms(
    refs: SkeletalRefs,
    state: AppuAnimationState,
    speed: number,
    isGrabbed: boolean,
    isPetting: boolean,
    petIntensity: number,
    time: number,
    dt: number,
    lookAtTarget: { x: number; y: number },
    physicsVerticalVel: number = 0
  ) {
    const { leftArm, rightArm, leftForearm, rightForearm } = refs;
    if (!leftArm || !rightArm || !leftForearm || !rightForearm) return;

    // Free-fall posture: arms flutter/flail outward for balance under wind resistance
    if (state === 'falling') {
      const flailLeft = Math.sin(time * 9.0) * 0.12;
      const flailRight = Math.cos(time * 9.0) * 0.12;

      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-35) + flailLeft, dt * 10.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, THREE.MathUtils.degToRad(-15), dt * 8.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(55) + flailLeft, dt * 10.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-45), dt * 10.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 8.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 8.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-35) + flailRight, dt * 10.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, THREE.MathUtils.degToRad(15), dt * 8.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-55) - flailRight, dt * 10.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-45), dt * 10.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 8.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 8.0);
      return;
    }

    // Rising posture: arms streamlined trailing upward
    if (state === 'rising') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-10), dt * 9.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 8.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(25), dt * 9.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 9.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 8.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 8.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-10), dt * 9.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 8.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-25), dt * 9.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 9.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 8.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 8.0);
      return;
    }

    // Landing / Bouncing impact posture: arms flex out for impact absorption
    if (state === 'landing' || state === 'bouncing') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-15), dt * 14.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 10.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(35), dt * 14.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-50), dt * 14.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 10.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 10.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-15), dt * 14.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 10.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-35), dt * 14.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-50), dt * 14.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 10.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 10.0);
      return;
    }

    if (isGrabbed) {
      const armBalanceOsc = Math.sin(time * 3.5) * 0.06;
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-14), dt * 9.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 9.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(34) + armBalanceOsc, dt * 9.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-38), dt * 9.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 9.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 9.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-14), dt * 9.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 9.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-34) - armBalanceOsc, dt * 9.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-38), dt * 9.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 9.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 9.0);
      return;
    }

    if (isPetting) {
      const petArmOsc = Math.sin(time * 3.0) * 0.04 * petIntensity;
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-6), dt * 7.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 7.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-16) - petArmOsc, dt * 7.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-28), dt * 7.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 7.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 7.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-6), dt * 7.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 7.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(16) + petArmOsc, dt * 7.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-28), dt * 7.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 7.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 7.0);
      return;
    }

    // 1. WAVE HELLO
    if (state === 'wave' || state === 'waving') {
      // Left arm raised high beside head, forearm waving enthusiastically
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 8.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, THREE.MathUtils.degToRad(-60), dt * 8.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(140), dt * 8.0);

      const waveOsc = Math.sin(time * 7.2) * 0.28;
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-5) + waveOsc * 0.35, dt * 14.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, THREE.MathUtils.degToRad(-40), dt * 8.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, waveOsc, dt * 14.0);

      // Right arm rests naturally at side
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-6), dt * 7.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 7.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(12), dt * 7.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-18), dt * 7.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 7.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 7.0);
      return;
    }

    // 2. CHEER & CELEBRATE
    if (state === 'cheer' || state === 'celebrate') {
      const cheerPump = Math.sin(time * 8.0) * 0.08;
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-15), dt * 8.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, THREE.MathUtils.degToRad(-20), dt * 8.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(135) + cheerPump, dt * 8.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 8.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 8.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, THREE.MathUtils.degToRad(10), dt * 8.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-15), dt * 8.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, THREE.MathUtils.degToRad(20), dt * 8.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-135) - cheerPump, dt * 8.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 8.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 8.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, THREE.MathUtils.degToRad(-10), dt * 8.0);
      return;
    }

    // 3. SALUTE
    if (state === 'salute') {
      // Anatomical 3D salute: Right upper arm raises laterally up and slightly forward,
      // elbow held high, forearm flexes sharply up to brow edge (x ~ -0.52, y ~ 0.36, z ~ 0.19)
      const saluteMicro = Math.sin(time * 2.0) * 0.012;
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-18) + saluteMicro, dt * 9.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, THREE.MathUtils.degToRad(55), dt * 9.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-130), dt * 9.0);

      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-50), dt * 9.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, THREE.MathUtils.degToRad(15), dt * 9.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, THREE.MathUtils.degToRad(-30), dt * 9.0);

      // Left arm straight at side in crisp disciplined military attention
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-4), dt * 7.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 7.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(6), dt * 7.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-8), dt * 7.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 7.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 7.0);
      return;
    }

    // 4. CLAP (Natural, rhythmic clapping close to the chest with bent elbows)
    if (state === 'clap') {
      const clapCycle = (Math.sin(time * 13.0) + 1) * 0.5;
      const clapSpread = THREE.MathUtils.lerp(0.0, 0.16, clapCycle);

      // Upper arms stay close to ribs (slight pitch -22°, tucked inward ±28°)
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-22), dt * 12.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, THREE.MathUtils.degToRad(12), dt * 12.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-28), dt * 12.0);

      // Forearms flex sharply up at the elbow (-82°) with palms clapping laterally in front of chest
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-82), dt * 12.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, THREE.MathUtils.degToRad(-36) + clapSpread, dt * 16.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, THREE.MathUtils.degToRad(-15), dt * 12.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-22), dt * 12.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, THREE.MathUtils.degToRad(-12), dt * 12.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(28), dt * 12.0);

      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-82), dt * 12.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, THREE.MathUtils.degToRad(36) - clapSpread, dt * 16.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, THREE.MathUtils.degToRad(15), dt * 12.0);
      return;
    }

    // 5. BOW
    if (state === 'bow') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(12), dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-8), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-10), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(12), dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(8), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-10), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
      return;
    }

    // 6. THINK
    if (state === 'think') {
      // Right hand to chin/cheek with tucked elbow
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-80), dt * 7.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, THREE.MathUtils.degToRad(-40), dt * 7.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(60), dt * 7.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-30), dt * 7.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, THREE.MathUtils.degToRad(40), dt * 7.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, THREE.MathUtils.degToRad(20), dt * 7.0);

      // Left arm resting comfortably on waist/hip
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-10), dt * 7.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, THREE.MathUtils.degToRad(12), dt * 7.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(24), dt * 7.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-40), dt * 7.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, THREE.MathUtils.degToRad(-15), dt * 7.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, THREE.MathUtils.degToRad(10), dt * 7.0);
      return;
    }

    // 7. CONFUSED (Robot Shrug)
    if (state === 'confused') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-15), dt * 7.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, THREE.MathUtils.degToRad(20), dt * 7.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(35), dt * 7.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-70), dt * 7.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, THREE.MathUtils.degToRad(15), dt * 7.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, THREE.MathUtils.degToRad(20), dt * 7.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-15), dt * 7.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, THREE.MathUtils.degToRad(-20), dt * 7.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-35), dt * 7.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-70), dt * 7.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, THREE.MathUtils.degToRad(-15), dt * 7.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, THREE.MathUtils.degToRad(-20), dt * 7.0);
      return;
    }

    // 8. BORED
    if (state === 'bored') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-2), dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-16), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-14), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-2), dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(16), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-14), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
      return;
    }

    // 9. SHY
    if (state === 'shy') {
      // Bashful clasp in front of lower chest
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-25), dt * 7.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, THREE.MathUtils.degToRad(15), dt * 7.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-30), dt * 7.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-60), dt * 7.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 7.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 7.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-25), dt * 7.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, THREE.MathUtils.degToRad(-15), dt * 7.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(30), dt * 7.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-60), dt * 7.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 7.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 7.0);
      return;
    }

    // 10. STRETCH
    if (state === 'stretch') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-155), dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(25), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-15), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-155), dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-25), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-15), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
      return;
    }

    // 11. HANDSTAND
    if (state === 'handstand') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-175), dt * 8.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 8.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(12), dt * 8.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, 0, dt * 8.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 8.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 8.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-175), dt * 8.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 8.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-12), dt * 8.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, 0, dt * 8.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 8.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 8.0);
      return;
    }

    // 12. UPSIDE DOWN
    if (state === 'upside_down') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-35), dt * 7.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 7.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(42), dt * 7.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-30), dt * 7.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 7.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 7.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-35), dt * 7.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 7.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-42), dt * 7.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-30), dt * 7.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 7.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 7.0);
      return;
    }

    // 13. PLAY WITH CURSOR
    if (state === 'play_cursor') {
      const reachX = lookAtTarget.x * 0.35;
      const reachY = -lookAtTarget.y * 0.30;
      const swat = Math.sin(time * 6.5) * 0.12;

      // Right arm actively reaches and swats playfully towards the cursor
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-65) + reachY + swat, dt * 9.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, THREE.MathUtils.degToRad(-10) + reachX * 0.5, dt * 9.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-15) + reachX * 0.6, dt * 9.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-45) - swat * 0.5, dt * 9.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, THREE.MathUtils.degToRad(15), dt * 9.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, THREE.MathUtils.degToRad(-10), dt * 9.0);

      // Left arm acts as natural dynamic counterbalance
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 7.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, THREE.MathUtils.degToRad(-10), dt * 7.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(16), dt * 7.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-35), dt * 7.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 7.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 7.0);
      return;
    }

    // 14. SPIN & DANCE
    if (state === 'spin') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-12), dt * 8.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 8.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(58), dt * 8.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 8.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 8.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 8.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-12), dt * 8.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 8.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-58), dt * 8.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 8.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 8.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 8.0);
      return;
    }

    if (state === 'dance') {
      const armSwing = Math.sin(time * 6.0) * 0.55;
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, -armSwing, dt * 10.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 8.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-22), dt * 8.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-45), dt * 8.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 8.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 8.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, armSwing, dt * 10.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 8.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(22), dt * 8.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-45), dt * 8.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 8.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 8.0);
      return;
    }

    // 15. SITTING POSES
    if (state === 'sit' || state === 'sit_cross_legged') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-35), dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-14), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-60), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-35), dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(14), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-60), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
      return;
    }

    if (state === 'sit_relaxed') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(12), dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-24), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-25), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(12), dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(24), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-25), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
      return;
    }

    if (state === 'sit_legs_extended') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(10), dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-16), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-22), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(10), dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(16), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-22), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
      return;
    }

    // 16. LYING & SLEEPING POSES
    if (state === 'lie_down') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-35), dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-12), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-65), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-35), dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(12), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-65), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
      return;
    }

    if (state === 'side_rest' || state === 'sleep' || state === 'deep_sleep' || state === 'sleep_side') {
      // Arms cradled around head / resting comfortably
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-45), dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(25), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-85), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-20), dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(15), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-45), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
      return;
    }

    if (state === 'rest_head_on_hands') {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-50), dt * 7.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 7.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(18), dt * 7.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-95), dt * 7.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 7.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 7.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-50), dt * 7.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 7.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(-18), dt * 7.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-95), dt * 7.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 7.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 7.0);
      return;
    }

    // 17. WALKING OR IDLE
    if (speed > 0.08) {
      const armSwing = Math.sin(this.stridePhase) * 0.46;
      // Contralateral gait: Left arm swings backward (+armSwing) when left leg steps forward (-legPitch)
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, armSwing, dt * 11.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 8.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-12), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-26), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      // Right arm swings forward (-armSwing) when left leg steps forward
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, -armSwing, dt * 11.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 8.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(12), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-26), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
    } else {
      const idleBreathing = Math.sin(time * 1.8) * 0.02;
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, THREE.MathUtils.degToRad(-8) + idleBreathing, dt * 6.0);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 6.0);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, THREE.MathUtils.degToRad(-12), dt * 6.0);
      leftForearm.rotation.x = THREE.MathUtils.lerp(leftForearm.rotation.x, THREE.MathUtils.degToRad(-22), dt * 6.0);
      leftForearm.rotation.y = THREE.MathUtils.lerp(leftForearm.rotation.y, 0, dt * 6.0);
      leftForearm.rotation.z = THREE.MathUtils.lerp(leftForearm.rotation.z, 0, dt * 6.0);

      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, THREE.MathUtils.degToRad(-8) + idleBreathing, dt * 6.0);
      rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, dt * 6.0);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, THREE.MathUtils.degToRad(12), dt * 6.0);
      rightForearm.rotation.x = THREE.MathUtils.lerp(rightForearm.rotation.x, THREE.MathUtils.degToRad(-22), dt * 6.0);
      rightForearm.rotation.y = THREE.MathUtils.lerp(rightForearm.rotation.y, 0, dt * 6.0);
      rightForearm.rotation.z = THREE.MathUtils.lerp(rightForearm.rotation.z, 0, dt * 6.0);
    }
  }

  // =========================================================================
  // LEGS & LOWER LEGS KINEMATICS
  // =========================================================================
  private updateLegs(
    refs: SkeletalRefs,
    state: AppuAnimationState,
    speed: number,
    isGrabbed: boolean,
    time: number,
    dt: number,
    physicsVerticalVel: number = 0
  ) {
    const { leftLeg, rightLeg, leftLowerLeg, rightLowerLeg } = refs;
    if (!leftLeg || !rightLeg || !leftLowerLeg || !rightLowerLeg) return;

    // Free-fall posture: legs tucked upward slightly with fluttering feet
    if (state === 'falling') {
      const legFlutter = Math.sin(time * 8.0) * 0.08;
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(32) + legFlutter, dt * 10.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(42), dt * 10.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(28) - legFlutter, dt * 10.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(42), dt * 10.0);
      return;
    }

    // Rising posture: legs trailing downward behind body
    if (state === 'rising') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(-15), dt * 9.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(12), dt * 9.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(-15), dt * 9.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(12), dt * 9.0);
      return;
    }

    // Landing / Bouncing impact: deep knee bend compression
    if (state === 'landing' || state === 'bouncing') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(-35), dt * 16.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(65), dt * 16.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(-35), dt * 16.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(65), dt * 16.0);
      return;
    }

    if (isGrabbed) {
      const dangleLeft = Math.sin(time * 2.8) * 0.05 + THREE.MathUtils.degToRad(14);
      const dangleRight = Math.cos(time * 2.8) * 0.05 + THREE.MathUtils.degToRad(14);

      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, dangleLeft, dt * 9.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(26), dt * 9.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, dangleRight, dt * 9.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(26), dt * 9.0);
      return;
    }

    if (this.releaseTimer < 0.45) {
      const settleFactor = this.releaseTimer / 0.45;
      const bend = (1 - settleFactor) * THREE.MathUtils.degToRad(16);
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, bend, dt * 14.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, bend, dt * 14.0);
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, bend, dt * 14.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, bend, dt * 14.0);
      return;
    }

    // 1. SITTING VARIATIONS
    if (state === 'sit') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(-85), dt * 8.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(80), dt * 8.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(-85), dt * 8.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(80), dt * 8.0);
      return;
    }

    if (state === 'sit_relaxed') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(-78), dt * 8.0);
      leftLeg.rotation.z = THREE.MathUtils.lerp(leftLeg.rotation.z, THREE.MathUtils.degToRad(-10), dt * 8.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(72), dt * 8.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(-78), dt * 8.0);
      rightLeg.rotation.z = THREE.MathUtils.lerp(rightLeg.rotation.z, THREE.MathUtils.degToRad(10), dt * 8.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(72), dt * 8.0);
      return;
    }

    if (state === 'sit_legs_extended') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(-90), dt * 8.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(8), dt * 8.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(-90), dt * 8.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(8), dt * 8.0);
      return;
    }

    if (state === 'sit_cross_legged') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(-72), dt * 8.0);
      leftLeg.rotation.z = THREE.MathUtils.lerp(leftLeg.rotation.z, THREE.MathUtils.degToRad(-38), dt * 8.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(95), dt * 8.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(-72), dt * 8.0);
      rightLeg.rotation.z = THREE.MathUtils.lerp(rightLeg.rotation.z, THREE.MathUtils.degToRad(38), dt * 8.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(95), dt * 8.0);
      return;
    }

    // 2. LYING DOWN & SLEEPING
    if (state === 'lie_down') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, dt * 8.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, 0, dt * 8.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, dt * 8.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, 0, dt * 8.0);
      return;
    }

    if (state === 'side_rest' || state === 'sleep' || state === 'deep_sleep' || state === 'sleep_side') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(-35), dt * 7.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(55), dt * 7.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(-25), dt * 7.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(45), dt * 7.0);
      return;
    }

    if (state === 'rest_head_on_hands') {
      // Legs bent at knees kicking playfully back and forth
      const kickLeft = THREE.MathUtils.degToRad(42) + Math.sin(time * 3.5) * 0.18;
      const kickRight = THREE.MathUtils.degToRad(42) + Math.cos(time * 3.5) * 0.18;

      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, dt * 8.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, kickLeft, dt * 8.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, dt * 8.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, kickRight, dt * 8.0);
      return;
    }

    // 3. HANDSTAND & UPSIDE DOWN
    if (state === 'handstand') {
      const balanceLegWobble = Math.sin(time * 6.0) * 0.04;
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(12) + balanceLegWobble, dt * 8.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, 0, dt * 8.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(12) - balanceLegWobble, dt * 8.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, 0, dt * 8.0);
      return;
    }

    if (state === 'upside_down') {
      leftLeg.rotation.z = THREE.MathUtils.lerp(leftLeg.rotation.z, THREE.MathUtils.degToRad(-22), dt * 7.0);
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, THREE.MathUtils.degToRad(10), dt * 7.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, THREE.MathUtils.degToRad(15), dt * 7.0);

      rightLeg.rotation.z = THREE.MathUtils.lerp(rightLeg.rotation.z, THREE.MathUtils.degToRad(22), dt * 7.0);
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, THREE.MathUtils.degToRad(10), dt * 7.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, THREE.MathUtils.degToRad(15), dt * 7.0);
      return;
    }

    // 4. BORED (Tapping foot)
    if (state === 'bored') {
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, dt * 8.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, 0, dt * 8.0);

      // Foot tap on right leg
      const tapCycle = Math.sin(time * 3.8);
      const tapAngle = tapCycle > 0.6 ? (tapCycle - 0.6) * 0.35 : 0;
      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, -tapAngle * 0.5, dt * 14.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, tapAngle, dt * 14.0);
      return;
    }

    // 5. JUMP
    if (state === 'jump') {
      const jumpCycle = Math.sin(time * 7.0);
      const legBend = jumpCycle > 0.3 ? THREE.MathUtils.degToRad(25) : THREE.MathUtils.degToRad(45);
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, -legBend * 0.8, dt * 12.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, legBend, dt * 12.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, -legBend * 0.8, dt * 12.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, legBend, dt * 12.0);
      return;
    }

    // 6. WALKING STRIDES
    if (speed > 0.08) {
      const legPitch = Math.sin(this.stridePhase) * 0.52;

      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, -legPitch, dt * 13.0);
      const leftKneeBend = legPitch > 0 ? legPitch * 0.88 : 0.05;
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, leftKneeBend, dt * 13.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, legPitch, dt * 13.0);
      const rightKneeBend = -legPitch > 0 ? -legPitch * 0.88 : 0.05;
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, rightKneeBend, dt * 13.0);
    } else {
      // Solid grounded standing feet
      leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, dt * 9.0);
      leftLeg.rotation.z = THREE.MathUtils.lerp(leftLeg.rotation.z, 0, dt * 9.0);
      leftLowerLeg.rotation.x = THREE.MathUtils.lerp(leftLowerLeg.rotation.x, 0, dt * 9.0);

      rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, dt * 9.0);
      rightLeg.rotation.z = THREE.MathUtils.lerp(rightLeg.rotation.z, 0, dt * 9.0);
      rightLowerLeg.rotation.x = THREE.MathUtils.lerp(rightLowerLeg.rotation.x, 0, dt * 9.0);
    }
  }
}
