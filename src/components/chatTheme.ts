import { CompanionCharacterId } from '../types/character';

export type ChatThemeId = 'rabbit' | 'robot';

/** Maps stage companion id to chat chrome theme (follows Settings character). */
export function companionIdToChatTheme(characterId?: CompanionCharacterId | null): ChatThemeId {
  return characterId === 'appu-3d' ? 'robot' : 'rabbit';
}