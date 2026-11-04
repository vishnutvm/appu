import React from 'react';
import { AppuAnimationState } from '../types/character';

interface FloatingEmoteIndicatorProps {
  state: AppuAnimationState;
  isSleeping: boolean;
}

export const FloatingEmoteIndicator: React.FC<FloatingEmoteIndicatorProps> = ({
  state,
  isSleeping,
}) => {
  if (isSleeping || state === 'sleep' || state === 'deep_sleep' || state === 'sleep_side') {
    return (
      <div className="floating-emote-indicator sleep-badge" aria-hidden="true">
        <span className="z-char z-1">z</span>
        <span className="z-char z-2">Z</span>
        <span className="z-char z-3">z</span>
      </div>
    );
  }

  if (state === 'think') {
    return (
      <div className="floating-emote-indicator think-badge" aria-hidden="true">
        <span className="question-mark">?</span>
      </div>
    );
  }

  if (state === 'bored') {
    return (
      <div className="floating-emote-indicator bored-badge" aria-hidden="true">
        <span className="ellipsis-dots">...</span>
      </div>
    );
  }

  return null;
};
