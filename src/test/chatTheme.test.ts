import { describe, it, expect } from 'vitest';
import { companionIdToChatTheme } from '../components/chatTheme';
import { companionIdToAvatarVariant } from '../components/CompanionAvatar';

describe('chat theme mapping', () => {
  it('maps rabbit-video to rabbit chat theme and avatar', () => {
    expect(companionIdToChatTheme('rabbit-video')).toBe('rabbit');
    expect(companionIdToAvatarVariant('rabbit-video')).toBe('rabbit');
  });

  it('maps appu-3d to robot chat theme and avatar', () => {
    expect(companionIdToChatTheme('appu-3d')).toBe('robot');
    expect(companionIdToAvatarVariant('appu-3d')).toBe('robot');
  });
});