import { AppuAnimationState, AppuEmotion } from './character';

export type ActionCategory =
  | 'greetings'
  | 'resting'
  | 'sleep'
  | 'playful'
  | 'emotions';

export type AppuActionId =
  // Greetings
  | 'wave'
  | 'cheer'
  | 'salute'
  | 'nod'
  | 'bow'
  | 'clap'
  // Sitting & Resting
  | 'sit'
  | 'sit_relaxed'
  | 'sit_legs_extended'
  | 'sit_cross_legged'
  | 'lie_down'
  | 'lie_down_side'
  | 'side_rest'
  | 'rest_head_on_hands'
  // Sleep
  | 'sleep'
  | 'deep_sleep'
  | 'sleep_side'
  | 'wake_up'
  | 'stretch'
  // Playful
  | 'walk'
  | 'handstand'
  | 'upside_down'
  | 'spin'
  | 'dance'
  | 'jump'
  | 'celebrate'
  | 'play_cursor'
  // Personality & Emotions
  | 'think'
  | 'curious'
  | 'confused'
  | 'bored'
  | 'excited'
  | 'sad'
  | 'surprised'
  | 'dizzy'
  | 'shy';

export interface AppuActionDefinition {
  id: AppuActionId;
  category: ActionCategory;
  label: string;
  shortLabel?: string;
  description: string;
  animation: AppuAnimationState;
  duration: number | null; // seconds; null means permanent/looping until interrupted
  isLooping: boolean;
  interruptible: boolean;
  returnToIdle: boolean;
  isGroundPose: boolean;
  standingRequired?: boolean;
  associatedEmotion: AppuEmotion;
  badge?: string; // Optional overlay visual accent (e.g. 'z z', '?', '...')
}

export interface CategoryMetadata {
  id: ActionCategory;
  label: string;
  iconName: string;
  description: string;
}

export const ACTION_CATEGORIES: CategoryMetadata[] = [
  {
    id: 'greetings',
    label: 'Greetings',
    iconName: 'Hand',
    description: 'Friendly welcomes, bows and salutes',
  },
  {
    id: 'resting',
    label: 'Sitting & Resting',
    iconName: 'Armchair',
    description: 'Ground poses, chairs, and relaxed sitting postures',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    iconName: 'Moon',
    description: 'Peaceful naps, deep rest, and wake-up stretches',
  },
  {
    id: 'playful',
    label: 'Playful',
    iconName: 'Gamepad2',
    description: 'Acrobatics, dances, spins, and cursor games',
  },
  {
    id: 'emotions',
    label: 'Emotes',
    iconName: 'Smile',
    description: 'Expressive reactions, thoughts, and mood gestures',
  },
];
