import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { AppuActionRegistry, APPU_ACTIONS } from '../controllers/AppuActionRegistry';
import { CharacterAnimationController, SkeletalRefs } from '../controllers/CharacterAnimationController';
import { CharacterBehaviourController } from '../controllers/CharacterBehaviourController';
import { CharacterEmotionController } from '../controllers/CharacterEmotionController';
import { CharacterReactionController } from '../controllers/CharacterReactionController';
import { CharacterCollisionController } from '../controllers/CharacterCollisionController';

const createMockRefs = (): SkeletalRefs => ({
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
});

describe('Appu Advanced Actions, Poses & Personality Interaction System', () => {
  // -------------------------------------------------------------
  // Test Suite 1: Action Registry & Definitions
  // -------------------------------------------------------------
  describe('Action Registry & Definitions', () => {
    it('1. Contains all required categorized actions matching specifications', () => {
      const allActions = AppuActionRegistry.getAll();
      expect(allActions.length).toBeGreaterThanOrEqual(33);

      const greetings = AppuActionRegistry.getByCategory('greetings');
      expect(greetings.map((a) => a.id)).toEqual(
        expect.arrayContaining(['wave', 'cheer', 'salute', 'nod', 'bow', 'clap'])
      );

      const resting = AppuActionRegistry.getByCategory('resting');
      expect(resting.map((a) => a.id)).toEqual(
        expect.arrayContaining([
          'sit',
          'sit_relaxed',
          'sit_legs_extended',
          'sit_cross_legged',
          'lie_down',
          'lie_down_side',
          'side_rest',
          'rest_head_on_hands',
        ])
      );

      const sleep = AppuActionRegistry.getByCategory('sleep');
      expect(sleep.map((a) => a.id)).toEqual(
        expect.arrayContaining(['sleep', 'deep_sleep', 'sleep_side', 'wake_up', 'stretch'])
      );

      const playful = AppuActionRegistry.getByCategory('playful');
      expect(playful.map((a) => a.id)).toEqual(
        expect.arrayContaining([
          'handstand',
          'upside_down',
          'spin',
          'dance',
          'jump',
          'celebrate',
          'play_cursor',
        ])
      );

      const emotions = AppuActionRegistry.getByCategory('emotions');
      expect(emotions.map((a) => a.id)).toEqual(
        expect.arrayContaining([
          'think',
          'curious',
          'confused',
          'bored',
          'excited',
          'sad',
          'surprised',
          'dizzy',
          'shy',
        ])
      );
    });

    it('2. Distinguishes ground poses and permanent vs temporary looping flags correctly', () => {
      expect(AppuActionRegistry.isGroundPose('sit')).toBe(true);
      expect(AppuActionRegistry.isGroundPose('sit_relaxed')).toBe(true);
      expect(AppuActionRegistry.isGroundPose('lie_down')).toBe(true);
      expect(AppuActionRegistry.isGroundPose('side_rest')).toBe(true);
      expect(AppuActionRegistry.isGroundPose('sleep')).toBe(true);
      expect(AppuActionRegistry.isGroundPose('handstand')).toBe(true);
      expect(AppuActionRegistry.isGroundPose('wave')).toBe(false);
      expect(AppuActionRegistry.isGroundPose('salute')).toBe(false);

      expect(APPU_ACTIONS.sit.isLooping).toBe(true);
      expect(APPU_ACTIONS.sleep.isLooping).toBe(true);
      expect(APPU_ACTIONS.bored.isLooping).toBe(true);
      expect(APPU_ACTIONS.wave.isLooping).toBe(false);
      expect(APPU_ACTIONS.salute.isLooping).toBe(false);
    });

    it('3. Features overlay visual badges matching the reference art storyboard', () => {
      expect(APPU_ACTIONS.sleep.badge).toBe('z z');
      expect(APPU_ACTIONS.think.badge).toBe('?');
      expect(APPU_ACTIONS.bored.badge).toBe('...');
    });
  });

  // -------------------------------------------------------------
  // Test Suite 2: Kinematic Poses & Joint Rotation Accuracy
  // -------------------------------------------------------------
  describe('Kinematic Poses & Joint Rotations', () => {
    it('4. Sitting poses lower hips naturally, bend knees, and place hands on knees/lap', () => {
      const animCtrl = new CharacterAnimationController();
      const refs = createMockRefs();

      // Run multiple frames for smooth lerp convergence
      for (let f = 0; f < 15; f++) {
        animCtrl.update(refs, {
          state: 'sit',
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
          time: f * 0.05,
          dt: 0.05,
        });
      }

      // Root lowered onto ground (y < 0)
      expect(refs.root!.position.y).toBeLessThan(-0.15);
      // Legs bent forward (x < -1.0 rad / ~-60 deg)
      expect(refs.leftLeg!.rotation.x).toBeLessThan(-1.0);
      expect(refs.rightLeg!.rotation.x).toBeLessThan(-1.0);
      // Knees bent downward (x > 1.0 rad / ~60 deg)
      expect(refs.leftLowerLeg!.rotation.x).toBeGreaterThan(1.0);
      expect(refs.rightLowerLeg!.rotation.x).toBeGreaterThan(1.0);
      // Arms resting forward on knees (x < -0.4 rad)
      expect(refs.leftArm!.rotation.x).toBeLessThan(-0.4);
      expect(refs.rightArm!.rotation.x).toBeLessThan(-0.4);
    });

    it('5. Lie Down and Side Rest maintain ground contact and coordinated full-body orientation', () => {
      const animCtrl = new CharacterAnimationController();
      const refs = createMockRefs();

      // Lie Down
      for (let f = 0; f < 15; f++) {
        animCtrl.update(refs, {
          state: 'lie_down',
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
          time: f * 0.05,
          dt: 0.05,
        });
      }

      // Lowered to floor
      expect(refs.root!.position.y).toBeLessThan(-0.25);
      // Horizontal torso pitch (pitchX close to -PI/2)
      expect(refs.root!.rotation.x).toBeLessThan(-1.2);

      // Side Rest
      const sideRefs = createMockRefs();
      for (let f = 0; f < 15; f++) {
        animCtrl.update(sideRefs, {
          state: 'side_rest',
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
          time: f * 0.05,
          dt: 0.05,
        });
      }

      // Root rolled onto side (rollZ < -1.0 rad)
      expect(sideRefs.root!.rotation.z).toBeLessThan(-1.0);
      // Head propped up (rollZ > 0.5 rad)
      expect(sideRefs.head!.rotation.z).toBeGreaterThan(0.5);
    });

    it('6. Handstand inverts root, grounds hands, and balances legs upright in air', () => {
      const animCtrl = new CharacterAnimationController();
      const refs = createMockRefs();

      for (let f = 0; f < 15; f++) {
        animCtrl.update(refs, {
          state: 'handstand',
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
          time: f * 0.05,
          dt: 0.05,
        });
      }

      // Inverted elevated root (> 0.25)
      expect(refs.root!.position.y).toBeGreaterThan(0.25);
      // Body inverted pitch (pitchX close to -PI / -3.14 rad)
      expect(refs.root!.rotation.x).toBeLessThan(-2.5);
      // Arms bearing weight down towards floor
      expect(refs.leftArm!.rotation.x).toBeLessThan(-2.5);
      expect(refs.rightArm!.rotation.x).toBeLessThan(-2.5);
    });

    it('7. Salute snaps right forearm crisply to brow while left arm rests at side', () => {
      const animCtrl = new CharacterAnimationController();
      const refs = createMockRefs();

      for (let f = 0; f < 15; f++) {
        animCtrl.update(refs, {
          state: 'salute',
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
          time: f * 0.05,
          dt: 0.05,
        });
      }

      // Right arm raised laterally up with elbow high and forearm bent to brow
      expect(refs.rightArm!.rotation.z).toBeLessThan(-1.5);
      expect(refs.rightForearm!.rotation.x).toBeLessThan(-0.5);
      // Left arm resting straight and tucked disciplined against hip
      expect(refs.leftArm!.rotation.z).toBeGreaterThan(0.05);
    });

    it('8. Bored produces slouch, lowered head, and foot tapping', () => {
      const animCtrl = new CharacterAnimationController();
      const refs = createMockRefs();

      for (let f = 0; f < 15; f++) {
        animCtrl.update(refs, {
          state: 'bored',
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
          time: f * 0.05,
          dt: 0.05,
        });
      }

      // Slouched torso (pitchX > 0.1)
      expect(refs.root!.rotation.x).toBeGreaterThan(0.1);
      // Lowered head (pitchX > 0.3)
      expect(refs.head!.rotation.x).toBeGreaterThan(0.3);
    });
  });

  // -------------------------------------------------------------
  // Test Suite 3: State Machine Rules & Transitions
  // -------------------------------------------------------------
  describe('Behaviour State Machine & Rules', () => {
    it('9. Only one major action controls character at a time', () => {
      const onStateChange = vi.fn();
      const onEmotionChange = vi.fn();
      const behaviour = new CharacterBehaviourController({ onStateChange, onEmotionChange });

      behaviour.triggerAction('wave');
      expect(behaviour.getState()).toBe('wave');
      expect(behaviour.getActionId()).toBe('wave');

      behaviour.triggerAction('cheer');
      expect(behaviour.getState()).toBe('cheer');
      expect(behaviour.getActionId()).toBe('cheer');
    });

    it('10. Dragging interrupts running actions immediately into being_dragged', () => {
      const onStateChange = vi.fn();
      const onEmotionChange = vi.fn();
      const behaviour = new CharacterBehaviourController({ onStateChange, onEmotionChange });

      behaviour.triggerAction('dance');
      expect(behaviour.getState()).toBe('dance');

      behaviour.onDragStart();
      expect(behaviour.getState()).toBe('being_dragged');
      expect(behaviour.getActionId()).toBeNull();
    });

    it('11. Sleeping is interruptible by user tap/click, triggering natural wake_up', () => {
      const onStateChange = vi.fn();
      const onEmotionChange = vi.fn();
      const behaviour = new CharacterBehaviourController({ onStateChange, onEmotionChange });

      behaviour.triggerAction('sleep');
      expect(behaviour.isSleeping()).toBe(true);

      // User clicks Appu while sleeping
      behaviour.onTapAcknowledge();
      expect(behaviour.getState()).toBe('wake_up');
      expect(behaviour.getActionId()).toBe('wake_up');
    });

    it('12. Incompatible ground pose smoothly stands up before beginning requested standing action', () => {
      const onStateChange = vi.fn();
      const onEmotionChange = vi.fn();
      const behaviour = new CharacterBehaviourController({ onStateChange, onEmotionChange });

      // Put Appu in Sit pose
      behaviour.triggerAction('sit');
      expect(behaviour.isGroundPose()).toBe(true);

      // Now request Wave (which requires standing)
      behaviour.triggerAction('wave');
      // Should transition to returning_to_idle first
      expect(behaviour.getState()).toBe('returning_to_idle');

      // Fast-forward update past transition duration
      const mockTransform = { getPosition: () => new THREE.Vector3(), setPosition: vi.fn(), isAtBoundary: () => ({ hit: false }) } as any;
      const mockRotation = { getYaw: () => 0, getTargetYaw: () => 0, setFacingDirection: vi.fn() } as any;
      const mockMovement = { getDestination: () => null, getSpeed: () => 0, resetVelocity: vi.fn(), stop: vi.fn() } as any;

      behaviour.update(0.6, mockTransform, mockRotation, mockMovement);

      // After standing up, queued Wave action executes!
      expect(behaviour.getState()).toBe('wave');
      expect(behaviour.getActionId()).toBe('wave');
    });

    it('13. Stand Up command smoothly transitions Appu back to idle', () => {
      const onStateChange = vi.fn();
      const onEmotionChange = vi.fn();
      const behaviour = new CharacterBehaviourController({ onStateChange, onEmotionChange });

      behaviour.triggerAction('sit');
      behaviour.standUp();
      expect(behaviour.getState()).toBe('returning_to_idle');

      const mockTransform = { getPosition: () => new THREE.Vector3(), setPosition: vi.fn(), isAtBoundary: () => ({ hit: false }) } as any;
      const mockRotation = { getYaw: () => 0, getTargetYaw: () => 0, setFacingDirection: vi.fn() } as any;
      const mockMovement = { getDestination: () => null, getSpeed: () => 0, resetVelocity: vi.fn(), stop: vi.fn() } as any;

      behaviour.update(0.6, mockTransform, mockRotation, mockMovement);
      expect(behaviour.getState()).toBe('idle');
    });
  });
});
