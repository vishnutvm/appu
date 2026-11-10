import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { CharacterBehaviourController } from '../controllers/CharacterBehaviourController';
import { CharacterEmotionController } from '../controllers/CharacterEmotionController';
import { CharacterReactionController } from '../controllers/CharacterReactionController';
import { DesktopMovementController } from '../controllers/DesktopMovementController';

describe('Behaviour fixes', () => {
  describe('tap no longer freezes a pose', () => {
    it('keeps a looping ground pose active when tapped', () => {
      const onStateChange = vi.fn();
      const onEmotionChange = vi.fn();
      const emotionCtrl = new CharacterEmotionController('happy', onEmotionChange);
      const behaviour = new CharacterBehaviourController({ onStateChange, onEmotionChange });
      behaviour.setControllers(emotionCtrl, new CharacterReactionController(), {
        reset: vi.fn(),
      } as any);

      behaviour.triggerAction('sit');
      expect(behaviour.getActionId()).toBe('sit');
      expect(behaviour.getState()).toBe('sit');

      behaviour.onTapAcknowledge();

      // Pose must remain; tap only flashes emotion on ground poses.
      expect(behaviour.getActionId()).toBe('sit');
      expect(behaviour.getState()).toBe('sit');
      expect(emotionCtrl.getEmotion()).toBe('happy');

      const mockTransform = {
        getPosition: () => new THREE.Vector3(),
        setPosition: vi.fn(),
        isAtBoundary: () => ({ hit: false }),
      } as any;
      const mockRotation = {
        getYaw: () => 0,
        getTargetYaw: () => 0,
        setFacingDirection: vi.fn(),
      } as any;
      const mockMovement = {
        getDestination: () => null,
        getSpeed: () => 0,
        resetVelocity: vi.fn(),
        stop: vi.fn(),
      } as any;

      behaviour.update(0.1, mockTransform, mockRotation, mockMovement);
      expect(behaviour.getState()).toBe('sit');
      expect(behaviour.getActionId()).toBe('sit');
    });

    it('still wakes Appu when tapped while sleeping', () => {
      const behaviour = new CharacterBehaviourController({
        onStateChange: vi.fn(),
        onEmotionChange: vi.fn(),
      });
      behaviour.triggerAction('sleep');
      behaviour.onTapAcknowledge();
      expect(behaviour.getState()).toBe('wake_up');
    });
  });

  describe('zero-duration emotions do not stick', () => {
    it('returns to baseline after a zero-duration trigger', () => {
      const onEmotionChange = vi.fn();
      const emotionCtrl = new CharacterEmotionController('happy', onEmotionChange);

      emotionCtrl.triggerNamedEmotion('surprised', 0);
      expect(emotionCtrl.getEmotion()).toBe('surprised');

      emotionCtrl.update(1 / 60);
      expect(emotionCtrl.getEmotion()).toBe('happy');
    });

    it('keeps timed emotions until their duration elapses', () => {
      const emotionCtrl = new CharacterEmotionController('happy');
      emotionCtrl.triggerNamedEmotion('surprised', 0.5);
      emotionCtrl.update(0.2);
      expect(emotionCtrl.getEmotion()).toBe('surprised');
      emotionCtrl.update(0.4);
      expect(emotionCtrl.getEmotion()).toBe('happy');
    });
  });

  describe('leftover timers are cancelled', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('cancels pending stroll timers when clearAllTimers / destroy runs', () => {
      const onStateChange = vi.fn();
      const controller = new DesktopMovementController({ onStateChange });

      const onArrived = vi.fn();
      void controller.triggerReminderStroll(onArrived);

      controller.clearAllTimers();
      vi.advanceTimersByTime(2000);

      expect(onArrived).not.toHaveBeenCalled();
      controller.destroy();
    });

    it('cancels delayed dizzy emotion when reaction is reset', () => {
      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);

      const onEmotionTrigger = vi.fn();
      const reaction = new CharacterReactionController({
        onEmotionTrigger,
        onStateTrigger: vi.fn(),
      });

      reaction.triggerImpact(new THREE.Vector3(1, 0, 0), 3.5);
      expect(onEmotionTrigger).toHaveBeenCalledWith('hurt', 0.65);

      reaction.reset();
      now += 1000;
      vi.advanceTimersByTime(1000);

      expect(onEmotionTrigger).not.toHaveBeenCalledWith('dizzy', 0.95);
    });
  });
});
