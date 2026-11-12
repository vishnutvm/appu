import { AppuAnimationState, AppuEmotion } from '../types/character';
import { AppuActionId } from '../types/actions';

export interface VideoAnimationEntry {
  file: string;
  category: string;
  durationSec: number;
  startTime?: number;
  endTime?: number;
  loop: boolean;
  alpha?: boolean;
  priority?: number;
  returnTo?: string | null;
}

export interface VideoChromaKeyConfig {
  enabled: boolean;
  color: [number, number, number];
  similarity: number;
  smoothness: number;
  spillSuppression: number;
}

export interface VideoCropConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoCharacterManifest {
  id: string;
  version: string;
  displayName: string;
  renderer: 'video';
  referenceImage: string;
  thumbnail: string;
  defaultAnimation: string;
  chromaKey?: VideoChromaKeyConfig;
  crop?: VideoCropConfig;
  animations: Record<string, VideoAnimationEntry>;
}

export const DEFAULT_RABBIT_VIDEO_MANIFEST: VideoCharacterManifest = {
  id: 'rabbit-video',
  version: '1.0.0',
  displayName: 'Rabbit',
  renderer: 'video',
  referenceImage: './characters/rabbit-video/character-reference.jpg',
  thumbnail: './characters/rabbit-video/character-reference.jpg',
  defaultAnimation: 'idle',
  chromaKey: {
    enabled: true,
    color: [0.0, 1.0, 0.0],
    similarity: 0.2,
    smoothness: 0.12,
    spillSuppression: 0.95,
  },
  crop: {
    x: 0.24,
    y: 0.0,
    width: 0.52,
    height: 1.0,
  },
  animations: {
    idle: {
      file: './characters/rabbit-video/animations/idle/idle.mp4',
      category: 'basic_idle',
      durationSec: 8.0,
      loop: true,
      alpha: false,
      priority: 1,
    },
    waving: {
      file: './characters/rabbit-video/animations/gestures/waving.mp4',
      category: 'gestures',
      durationSec: 3.3,
      startTime: 0,
      endTime: 3.3,
      loop: false,
      alpha: false,
      priority: 2,
    },
    walking: {
      file: './characters/rabbit-video/animations/movement/walking.mp4',
      category: 'movement',
      durationSec: 9.0,
      loop: true,
      alpha: false,
      priority: 3,
    },
    thinking: {
      file: './characters/rabbit-video/animations/assistant/thinking.mp4',
      category: 'assistant',
      durationSec: 2.8,
      startTime: 0,
      endTime: 2.8,
      loop: false,
      alpha: false,
      priority: 2,
    },
    happy: {
      file: './characters/rabbit-video/animations/emotions/happy.mp4',
      category: 'emotions',
      durationSec: 2.4,
      startTime: 0,
      endTime: 2.4,
      loop: false,
      alpha: false,
      priority: 2,
    },
    surprised: {
      file: './characters/rabbit-video/animations/emotions/surprised.mp4',
      category: 'emotions',
      durationSec: 2.05,
      startTime: 0,
      endTime: 2.05,
      loop: false,
      alpha: false,
      priority: 3,
    },
    falling: {
      file: './characters/rabbit-video/animations/physics/falling.mp4',
      category: 'physics',
      durationSec: 3.24,
      startTime: 0,
      endTime: 3.24,
      loop: true,
      alpha: false,
      priority: 4,
    },
    landing: {
      file: './characters/rabbit-video/animations/physics/landing.mp4',
      category: 'physics',
      durationSec: 1.3,
      startTime: 0,
      endTime: 1.3,
      loop: false,
      alpha: false,
      priority: 4,
    },
    recovering: {
      file: './characters/rabbit-video/animations/physics/recovering.mp4',
      category: 'physics',
      durationSec: 3.0,
      startTime: 0,
      endTime: 3.0,
      loop: false,
      alpha: false,
      priority: 3,
    },
  },
};

export const DEFAULT_HUMAN_VIDEO_MANIFEST: VideoCharacterManifest = {
  id: 'human-video',
  version: '1.0.0',
  displayName: 'Human',
  renderer: 'video',
  referenceImage: './characters/human-video/character-reference.jpg',
  thumbnail: './characters/human-video/character-thumbnail.png',
  defaultAnimation: 'idle',
  chromaKey: {
    enabled: true,
    color: [0.0, 1.0, 0.0],
    similarity: 0.09,
    smoothness: 0.07,
    spillSuppression: 1.0,
  },
  crop: {
    x: 0.3,
    y: 0.0,
    width: 0.4,
    height: 1.0,
  },
  animations: {
    idle: {
      file: './characters/human-video/animations/idle/idle.mp4',
      category: 'basic_idle',
      durationSec: 3.12,
      startTime: 0,
      endTime: 3.12,
      loop: true,
      alpha: false,
      priority: 1,
    },
    waving: {
      file: './characters/human-video/animations/gestures/waving.mp4',
      category: 'gestures',
      durationSec: 2.7,
      startTime: 0,
      endTime: 2.7,
      loop: false,
      alpha: false,
      priority: 2,
    },
    walking: {
      file: './characters/human-video/animations/movement/walking.mp4',
      category: 'movement',
      durationSec: 1.44,
      startTime: 0,
      endTime: 1.44,
      loop: true,
      alpha: false,
      priority: 3,
    },
  },
};

export function isVideoCompanionId(id: string | null | undefined): id is 'rabbit-video' | 'human-video' {
  return id === 'rabbit-video' || id === 'human-video';
}

export function isValidCompanionCharacterId(
  id: string | null | undefined
): id is 'appu-3d' | 'rabbit-video' | 'human-video' {
  return id === 'appu-3d' || id === 'rabbit-video' || id === 'human-video';
}

export function getDefaultVideoManifest(characterId: string): VideoCharacterManifest {
  return characterId === 'human-video' ? DEFAULT_HUMAN_VIDEO_MANIFEST : DEFAULT_RABBIT_VIDEO_MANIFEST;
}

const STATE_TO_VIDEO_KEY: Partial<Record<AppuAnimationState, string>> = {
  idle: 'idle',
  looking: 'looking-around',
  looking_around: 'looking-around',
  curious: 'curious',
  being_dragged: 'falling',
  released: 'falling',
  walking: 'walking',
  walk: 'walking',
  turning: 'walking',
  collision: 'surprised',
  surprised: 'surprised',
  recovering: 'recovering',
  happy: 'happy',
  hurt: 'error-reaction',
  dizzy: 'confused',
  sleepy: 'yawning',
  interacting: 'listening',
  wave: 'waving',
  waving: 'waving',
  point: 'pointing-right',
  sit: 'sitting',
  sit_relaxed: 'sitting',
  sit_legs_extended: 'sitting',
  sit_cross_legged: 'sitting',
  lie_down: 'sleeping',
  lie_down_side: 'sleeping',
  side_rest: 'sitting',
  rest_head_on_hands: 'sitting',
  sleep: 'sleeping',
  deep_sleep: 'sleeping',
  sleep_side: 'sleeping',
  wake_up: 'waking-up',
  stretch: 'stretching',
  arriving: 'small-hop',
  cheer: 'cheering',
  salute: 'greeting',
  nod: 'acknowledging',
  bow: 'greeting',
  clap: 'clapping',
  spin: 'playful-reaction',
  dance: 'dancing',
  jump: 'jumping',
  celebrate: 'celebrating',
  play_cursor: 'playful-reaction',
  think: 'thinking',
  confused: 'confused',
  bored: 'waiting',
  excited: 'excited',
  sad: 'sad',
  shy: 'shy',
  falling: 'falling',
  rising: 'jumping',
  landing: 'landing',
  bouncing: 'small-hop',
  returning_to_idle: 'getting-up',
};

const EMOTION_TO_VIDEO_KEY: Partial<Record<AppuEmotion, string>> = {
  happy: 'happy',
  excited: 'excited',
  sad: 'sad',
  confused: 'confused',
  surprised: 'surprised',
  curious: 'curious',
  shy: 'shy',
  thinking: 'thinking',
  sleepy: 'yawning',
  bored: 'disappointed',
};

/**
 * Resolves the best matching animation entry from the character manifest,
 * gracefully falling back to `defaultAnimation` (`idle`) when specific
 * action clips have not been added yet.
 */
export function resolveVideoAnimation(
  manifest: VideoCharacterManifest,
  animationState: AppuAnimationState,
  emotion?: AppuEmotion
): { key: string; entry: VideoAnimationEntry } {
  const candidates: string[] = [];

  const mappedState = STATE_TO_VIDEO_KEY[animationState];
  if (mappedState) candidates.push(mappedState);
  candidates.push(animationState);

  if (animationState === 'cheer') {
    candidates.push('happy');
  } else if (animationState === 'rising') {
    candidates.push('falling');
  } else if (animationState === 'bouncing') {
    candidates.push('landing');
  }

  if (animationState === 'idle' && emotion && emotion !== 'neutral') {
    const mappedEmotion = EMOTION_TO_VIDEO_KEY[emotion];
    if (mappedEmotion) candidates.push(mappedEmotion);
  }

  candidates.push(manifest.defaultAnimation || 'idle');

  for (const key of candidates) {
    const entry = manifest.animations[key];
    if (entry) {
      return { key, entry };
    }
  }

  const firstKey = Object.keys(manifest.animations)[0] || 'idle';
  return {
    key: firstKey,
    entry: manifest.animations[firstKey] || DEFAULT_RABBIT_VIDEO_MANIFEST.animations.idle,
  };
}

const VIDEO_KEY_TO_ACTION_IDS: Record<string, AppuActionId[]> = {
  waving: ['wave'],
  walking: ['walk'],
  cheering: ['cheer'],
  happy: ['cheer'],
  clapping: ['clap'],
  dancing: ['dance'],
  sitting: ['sit', 'sit_relaxed', 'sit_legs_extended', 'sit_cross_legged'],
  sleeping: ['sleep', 'deep_sleep', 'sleep_side'],
  'waking-up': ['wake_up'],
  stretching: ['stretch'],
  greeting: ['bow', 'salute'],
  acknowledging: ['nod'],
  celebrating: ['celebrate'],
  jumping: ['jump'],
  'playful-reaction': ['spin', 'play_cursor'],
  thinking: ['think'],
  curious: ['curious'],
  confused: ['confused'],
  waiting: ['bored'],
  excited: ['excited'],
  sad: ['sad'],
  surprised: ['surprised'],
  shy: ['shy'],
};

/**
 * Returns the list of AppuActionIds that actually have backing animations
 * registered in the given video character manifest.
 */
export function getAvailableActionIds(manifest: VideoCharacterManifest): AppuActionId[] {
  const result = new Set<AppuActionId>();
  for (const key of Object.keys(manifest.animations || {})) {
    const mapped = VIDEO_KEY_TO_ACTION_IDS[key];
    if (mapped) {
      mapped.forEach((id) => result.add(id));
    }
  }
  return Array.from(result);
}

export async function loadVideoCharacterManifest(
  characterId: string
): Promise<VideoCharacterManifest> {
  try {
    const res = await fetch(`./characters/${characterId}/character.json`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const parsed = (await res.json()) as VideoCharacterManifest;
    if (parsed && parsed.animations && Object.keys(parsed.animations).length > 0) {
      return parsed;
    }
  } catch {
    // Fallback to built-in default manifest when fetch fails (e.g. unit tests)
  }
  return getDefaultVideoManifest(characterId);
}
