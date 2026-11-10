import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { CharacterCollisionController } from '../controllers/CharacterCollisionController';
import { CharacterReactionController } from '../controllers/CharacterReactionController';
import { CharacterEmotionController, EmotionPriority } from '../controllers/CharacterEmotionController';
import { CharacterInteractionController } from '../controllers/CharacterInteractionController';
import { CharacterBehaviourController } from '../controllers/CharacterBehaviourController';
import { CharacterMovementController } from '../controllers/CharacterMovementController';
import { CharacterAnimationController, SkeletalRefs } from '../controllers/CharacterAnimationController';
import { CharacterTransformController } from '../controllers/CharacterTransformController';
import { CharacterRotationController } from '../controllers/CharacterRotationController';

describe('Appu Realistic Interaction, Physics & Reaction System', () => {
  // -------------------------------------------------------------
  // Test 1: Dragging and physical follow-through
  // -------------------------------------------------------------
  it('1. Dragging Appu produces natural suspended balancing pose and follow-through inertia', () => {
    const animCtrl = new CharacterAnimationController();
    const mockRefs: SkeletalRefs = {
      root: new THREE.Group(),
      head: new THREE.Group(),
      leftArm: new THREE.Group(),
      rightArm: new THREE.Group(),
      leftForearm: new THREE.Group(),
      rightForearm: new THREE.Group(),
      leftLeg: new THREE.Group(),
      rightLeg: new THREE.Group(),
      leftLowerLeg: new THREE.Group(),
      rightLowerLeg: new THREE.Group(),
    };

    // Update with isGrabbed = true and rapid horizontal drag velocity over several frames
    for (let f = 0; f < 6; f++) {
      animCtrl.update(mockRefs, {
        state: 'being_dragged',
        worldPosition: new THREE.Vector3(0, 0, 0),
        yaw: 0,
        speed: 1.0,
        angularVelocity: 0,
        isTurning: false,
        isGrabbed: true,
        isPetting: false,
        dragVelocity: new THREE.Vector3(2.5, 0, 0),
        breathingEnabled: true,
        lookAtTarget: { x: 0.2, y: 0.1 },
        lookAroundOffset: 0,
        time: 1.0 + f * 0.05,
        dt: 0.05,
      });
    }

    // Root should lift above ground (> 0)
    expect(mockRefs.root!.position.y).toBeGreaterThan(0.05);

    // Body should exhibit follow-through inertia tilt away from movement direction (roll Z < 0)
    expect(mockRefs.root!.rotation.z).toBeLessThan(0);

    // Arms should be splayed outward for balance (> 20 deg)
    expect(mockRefs.leftArm!.rotation.z).toBeGreaterThan(0.3);
    expect(mockRefs.rightArm!.rotation.z).toBeLessThan(-0.3);

    // Legs should dangle suspended with bent knees (> 0 deg)
    expect(mockRefs.leftLeg!.rotation.x).toBeGreaterThan(0.1);
    expect(mockRefs.leftLowerLeg!.rotation.x).toBeGreaterThan(0.1);
  });

  // -------------------------------------------------------------
  // Test 2: Releasing and smooth recovery
  // -------------------------------------------------------------
  it('2. Releasing Appu settles feet back to ground and transitions back to idle', () => {
    const animCtrl = new CharacterAnimationController();
    const mockRefs: SkeletalRefs = {
      root: new THREE.Group(),
      head: new THREE.Group(),
      leftArm: new THREE.Group(),
      rightArm: new THREE.Group(),
      leftForearm: new THREE.Group(),
      rightForearm: new THREE.Group(),
      leftLeg: new THREE.Group(),
      rightLeg: new THREE.Group(),
      leftLowerLeg: new THREE.Group(),
      rightLowerLeg: new THREE.Group(),
    };

    // Grab first
    animCtrl.update(mockRefs, {
      state: 'being_dragged',
      worldPosition: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      speed: 0,
      angularVelocity: 0,
      isTurning: false,
      isGrabbed: true,
      isPetting: false,
      breathingEnabled: true,
      lookAtTarget: { x: 0, y: 0 },
      lookAroundOffset: 0,
      time: 0.5,
      dt: 0.05,
    });

    // Now release
    for (let i = 0; i < 20; i++) {
      animCtrl.update(mockRefs, {
        state: 'released',
        worldPosition: new THREE.Vector3(0, 0, 0),
        yaw: 0,
        speed: 0,
        angularVelocity: 0,
        isTurning: false,
        isGrabbed: false,
        isPetting: false,
        breathingEnabled: true,
        lookAtTarget: { x: 0, y: 0 },
        lookAroundOffset: 0,
        time: 0.5 + i * 0.05,
        dt: 0.05,
      });
    }

    // After settling, height returns to ground level (~0), feet aligned flat
    expect(mockRefs.root!.position.y).toBeCloseTo(0, 1);
    expect(mockRefs.leftLeg!.rotation.x).toBeCloseTo(0, 1);
    expect(mockRefs.rightLeg!.rotation.x).toBeCloseTo(0, 1);
  });

  // -------------------------------------------------------------
  // Test 3: Collision detection against virtual obstacle & boundaries
  // -------------------------------------------------------------
  it('3. Detects collision against configured virtual obstacle and resolves penetration', () => {
    const collisionCtrl = new CharacterCollisionController({
      minX: -2.0,
      maxX: 2.0,
      minZ: -1.2,
      maxZ: 1.2,
    });

    // Add obstacle at x=0.8, z=0 of size 0.5x0.5x0.5
    collisionCtrl.addBoxObstacle('test-box', [0.8, 0, 0], [0.5, 0.5, 0.5]);

    // Test moving towards obstacle
    const charPos = new THREE.Vector3(0.5, 0, 0); // within collision radius 0.32 of box at [0.55 .. 1.05]
    const velocity = new THREE.Vector3(2.0, 0, 0);

    const collision = collisionCtrl.testCollision(charPos, velocity);
    expect(collision.hasCollision).toBe(true);
    expect(collision.obstacleType).toBe('obstacle');
    expect(collision.obstacleId).toBe('test-box');
    expect(collision.normal.x).toBeLessThan(0); // Normal points out of obstacle towards left

    // Resolving position pushes character out of obstacle
    const resolved = collisionCtrl.resolvePosition(charPos);
    expect(resolved.collided).toBe(true);
    expect(resolved.position.x).toBeLessThan(0.8 - 0.25); // Character pushed outside box boundary
  });

  // -------------------------------------------------------------
  // Test 4: Impact severity scaling & controlled recoil spring
  // -------------------------------------------------------------
  it('4. Stronger impacts produce scaled recoil and appropriate emotional reaction', () => {
    const onEmotion = vi.fn();
    const onState = vi.fn();
    const onAudio = vi.fn();

    const reactionCtrl = new CharacterReactionController({
      onEmotionTrigger: onEmotion,
      onStateTrigger: onState,
      onAudioImpact: onAudio,
    });

    // Light bump: impactSpeed = 0.8
    reactionCtrl.triggerImpact(new THREE.Vector3(-1, 0, 0), 0.8);
    expect(onState).toHaveBeenCalledWith('collision', expect.any(Number));
    expect(onEmotion).toHaveBeenCalledWith('surprised', expect.any(Number));
    expect(onAudio).toHaveBeenCalled();

    // Recoil offset should push character in normal direction (-x)
    reactionCtrl.update(0.016);
    expect(reactionCtrl.getRecoilOffset().x).toBeLessThan(0);
    expect(reactionCtrl.getHeadPitch()).toBeGreaterThan(0); // Head jerks backwards

    // Reset and test strong bump: impactSpeed = 3.0
    reactionCtrl.reset();
    onEmotion.mockClear();
    onState.mockClear();

    reactionCtrl.triggerImpact(new THREE.Vector3(-1, 0, 0), 3.0);
    expect(onEmotion).toHaveBeenCalledWith('hurt', expect.any(Number));
  });

  // -------------------------------------------------------------
  // Test 5: Character expressions and emotional transitions
  // -------------------------------------------------------------
  it('5. Manages all required facial expressions and returns to baseline without abrupt switches', () => {
    const onEmotion = vi.fn();
    const emotionCtrl = new CharacterEmotionController('happy', onEmotion);

    expect(emotionCtrl.getEmotion()).toBe('happy');

    // Trigger high-priority hurt reaction for 0.4s
    emotionCtrl.triggerEmotion('hurt', 0.4, EmotionPriority.IMPACT);
    expect(emotionCtrl.getEmotion()).toBe('hurt');

    // Lower priority activity (e.g. curious) should NOT override hurt while active
    const rejected = emotionCtrl.triggerEmotion('curious', 0.5, EmotionPriority.ACTIVITY);
    expect(rejected).toBe(false);
    expect(emotionCtrl.getEmotion()).toBe('hurt');

    // Advance time past hurt duration
    emotionCtrl.update(0.45);
    // Should naturally return to baseline 'happy'
    expect(emotionCtrl.getEmotion()).toBe('happy');
  });

  // -------------------------------------------------------------
  // Test 6: Natural eye and head tracking with physical limits
  // -------------------------------------------------------------
  it('6. Head tracking clamps within physically realistic rotation limits', () => {
    const animCtrl = new CharacterAnimationController();
    const headGroup = new THREE.Group();
    const mockRefs: SkeletalRefs = {
      root: new THREE.Group(),
      head: headGroup,
      leftArm: new THREE.Group(),
      rightArm: new THREE.Group(),
      leftForearm: new THREE.Group(),
      rightForearm: new THREE.Group(),
      leftLeg: new THREE.Group(),
      rightLeg: new THREE.Group(),
      leftLowerLeg: new THREE.Group(),
      rightLowerLeg: new THREE.Group(),
    };

    // Extreme cursor target (e.g. off screen at x=5, y=5)
    animCtrl.update(mockRefs, {
      state: 'idle',
      worldPosition: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      speed: 0,
      angularVelocity: 0,
      isTurning: false,
      isGrabbed: false,
      isPetting: false,
      breathingEnabled: true,
      lookAtTarget: { x: 5.0, y: 5.0 },
      lookAroundOffset: 0,
      time: 1.0,
      dt: 0.1,
    });

    // Head yaw must not exceed physical limit of ~0.7 rad (~40 deg)
    expect(Math.abs(headGroup.rotation.y)).toBeLessThanOrEqual(0.71);
    // Head pitch must not exceed physical limit of ~0.45 rad (~25 deg)
    expect(Math.abs(headGroup.rotation.x)).toBeLessThanOrEqual(0.46);
  });

  // -------------------------------------------------------------
  // Test 7: Petting interaction
  // -------------------------------------------------------------
  it('7. Petting over head triggers happy reaction when enabled and can be toggled off', () => {
    const onPetStart = vi.fn();
    const onPetEnd = vi.fn();

    const interactionCtrl = new CharacterInteractionController({
      onDragStart: vi.fn(),
      onDragUpdate: vi.fn(),
      onDragEnd: vi.fn(),
      onPettingStart: onPetStart,
      onPettingUpdate: vi.fn(),
      onPettingEnd: onPetEnd,
      onTapAcknowledge: vi.fn(),
    });

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.lookAt(0, 0, 0);

    const characterPos = new THREE.Vector3(0, 0, 0);

    // Gently move cursor over Appu's head area (ndc x=0, y=0.15)
    for (let i = 0; i < 5; i++) {
      interactionCtrl.handlePointerMove(
        { x: 0, y: 0.15 },
        { x: 200 + i * 15, y: 150 },
        camera,
        characterPos,
        0.016
      );
    }

    expect(interactionCtrl.getIsPetting()).toBe(true);
    expect(onPetStart).toHaveBeenCalled();

    // Disable petting
    interactionCtrl.setPettingEnabled(false);
    expect(interactionCtrl.getIsPetting()).toBe(false);
    expect(onPetEnd).toHaveBeenCalled();
  });

  // -------------------------------------------------------------
  // Test 8: Natural movement with zero foot sliding
  // -------------------------------------------------------------
  it('8. Movement integrates displacement and stops precisely without foot sliding', () => {
    const movementCtrl = new CharacterMovementController({
      maxSpeed: 1.2,
      acceleration: 3.0,
      deceleration: 4.5,
      stoppingDistance: 0.04,
    });

    movementCtrl.setDestination(1.0, 0);

    let currentPos = new THREE.Vector3(0, 0, 0);
    let totalMoved = 0;

    // Simulate stepping forward
    for (let i = 0; i < 60; i++) {
      const res = movementCtrl.update(0.016, currentPos, true);
      const step = res.newPosition.distanceTo(currentPos);
      totalMoved += step;
      currentPos.copy(res.newPosition);
      if (res.hasArrived) break;
    }

    // Position reached close to 1.0
    expect(currentPos.x).toBeGreaterThan(0.7);

    // Stop movement
    movementCtrl.stop();
    const stoppedRes = movementCtrl.update(0.1, currentPos, false);
    expect(stoppedRes.speed).toBeCloseTo(0, 1);
  });

  // -------------------------------------------------------------
  // Test 9: Interaction priority resolution without conflicts
  // -------------------------------------------------------------
  it('9. Prioritizes interactions correctly: Collision and Dragging override autonomous actions', () => {
    const onStateChange = vi.fn();
    const onEmotionChange = vi.fn();
    const behaviourCtrl = new CharacterBehaviourController({
      onStateChange,
      onEmotionChange,
    });

    const transformCtrl = new CharacterTransformController();
    const rotationCtrl = new CharacterRotationController();
    const movementCtrl = new CharacterMovementController();

    // Normal idle state
    behaviourCtrl.setState('idle', 'happy');
    expect(behaviourCtrl.getState()).toBe('idle');

    // Dragging overrides idle
    behaviourCtrl.onDragStart();
    expect(behaviourCtrl.getState()).toBe('being_dragged');

    // Collision overrides dragging/walking
    behaviourCtrl.onCollision(2.5);
    expect(behaviourCtrl.getState()).toBe('collision');

    // Reset back to idle to test petting override
    behaviourCtrl.reset();
    expect(behaviourCtrl.getState()).toBe('idle');

    // Petting overrides idle
    behaviourCtrl.onPettingStart();
    expect(behaviourCtrl.getState()).toBe('interacting');
  });

  // -------------------------------------------------------------
  // Test 10: Appu always returns to stable idle state
  // -------------------------------------------------------------
  it('10. Appu consistently returns to idle state after temporary events', () => {
    const onStateChange = vi.fn();
    const onEmotionChange = vi.fn();
    const behaviourCtrl = new CharacterBehaviourController({
      onStateChange,
      onEmotionChange,
    });

    const transformCtrl = new CharacterTransformController();
    const rotationCtrl = new CharacterRotationController();
    const movementCtrl = new CharacterMovementController();

    // Trigger collision with short reaction
    behaviourCtrl.onCollision(1.0);
    expect(behaviourCtrl.getState()).toBe('collision');

    // Simulate time passing through collision -> recovering -> idle
    for (let i = 0; i < 40; i++) {
      behaviourCtrl.update(0.05, transformCtrl, rotationCtrl, movementCtrl);
    }

    expect(behaviourCtrl.getState()).toBe('idle');
  });
});
