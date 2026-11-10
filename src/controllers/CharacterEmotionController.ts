import { AppuEmotion } from '../types/character';

export enum EmotionPriority {
  BASELINE = 1,
  ACTIVITY = 2,
  INTERACTION = 3,
  IMPACT = 4,
}

export interface EmotionChangeCallback {
  (emotion: AppuEmotion): void;
}

export class CharacterEmotionController {
  private currentEmotion: AppuEmotion = 'happy';
  private baselineEmotion: AppuEmotion = 'happy';
  private currentPriority: EmotionPriority = EmotionPriority.BASELINE;
  private durationRemaining: number = 0;
  private onEmotionChange?: EmotionChangeCallback;

  constructor(baselineEmotion: AppuEmotion = 'happy', onEmotionChange?: EmotionChangeCallback) {
    this.baselineEmotion = baselineEmotion;
    this.currentEmotion = baselineEmotion;
    this.onEmotionChange = onEmotionChange;
  }

  public setCallback(cb: EmotionChangeCallback) {
    this.onEmotionChange = cb;
  }

  public getEmotion(): AppuEmotion {
    return this.currentEmotion;
  }

  public getBaselineEmotion(): AppuEmotion {
    return this.baselineEmotion;
  }

  public setBaselineEmotion(emotion: AppuEmotion) {
    this.baselineEmotion = emotion;
    if (this.currentPriority === EmotionPriority.BASELINE) {
      this.currentEmotion = emotion;
      this.onEmotionChange?.(this.currentEmotion);
    }
  }

  /**
   * Triggers an emotion with specific duration and priority.
   */
  public triggerEmotion(
    emotion: AppuEmotion,
    duration: number = 0,
    priority: EmotionPriority = EmotionPriority.INTERACTION
  ): boolean {
    // If incoming emotion has lower priority than active temporary emotion, reject it
    if (this.durationRemaining > 0 && priority < this.currentPriority) {
      return false;
    }

    this.currentEmotion = emotion;
    this.onEmotionChange?.(this.currentEmotion);

    // Zero / negative duration must not stick — settle back to baseline on the next update tick.
    if (duration <= 0) {
      this.currentPriority = priority;
      this.durationRemaining = Number.EPSILON;
      return true;
    }

    this.currentPriority = priority;
    this.durationRemaining = duration;
    return true;
  }

  /**
   * Automatically derives default priority from emotion type.
   */
  public triggerNamedEmotion(emotion: AppuEmotion, duration: number = 0): boolean {
    let prio = EmotionPriority.ACTIVITY;
    if (emotion === 'hurt' || emotion === 'dizzy') {
      prio = EmotionPriority.IMPACT;
    } else if (emotion === 'surprised' || emotion === 'happy' || emotion === 'confused') {
      prio = EmotionPriority.INTERACTION;
    } else if (emotion === 'neutral') {
      prio = EmotionPriority.BASELINE;
    }
    return this.triggerEmotion(emotion, duration, prio);
  }

  /**
   * Updates duration timer and settles back to baseline when expired.
   */
  public update(dt: number) {
    if (this.durationRemaining > 0) {
      this.durationRemaining -= dt;
      if (this.durationRemaining <= 0) {
        this.durationRemaining = 0;
        this.currentPriority = EmotionPriority.BASELINE;
        if (this.currentEmotion !== this.baselineEmotion) {
          this.currentEmotion = this.baselineEmotion;
          this.onEmotionChange?.(this.currentEmotion);
        }
      }
    }
  }

  public reset() {
    this.durationRemaining = 0;
    this.currentPriority = EmotionPriority.BASELINE;
    this.currentEmotion = this.baselineEmotion;
    this.onEmotionChange?.(this.currentEmotion);
  }
}
