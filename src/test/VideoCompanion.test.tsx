import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { SettingsModal } from '../components/SettingsModal';
import { VideoCharacterStage } from '../components/VideoCharacterStage';
import { InteractionMenu } from '../components/InteractionMenu';
import { ActionsAndPosesPanel } from '../components/ActionsAndPosesPanel';
import { INITIAL_CONTROLS } from '../types/character';
import {
  DEFAULT_RABBIT_VIDEO_MANIFEST,
  getAvailableActionIds,
  resolveVideoAnimation,
  VideoCharacterManifest,
} from '../services/videoCharacterManifest';

describe('Video Companion POC Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('resolves idle fallback for unimplemented actions while mapping wrapped clips', () => {
    const resWave = resolveVideoAnimation(DEFAULT_RABBIT_VIDEO_MANIFEST, 'wave', 'happy');
    expect(resWave.key).toBe('waving');
    expect(resWave.entry.file).toContain('waving.mp4');
    expect(resWave.entry.loop).toBe(false);

    const resWalk = resolveVideoAnimation(DEFAULT_RABBIT_VIDEO_MANIFEST, 'walk', 'neutral');
    expect(resWalk.key).toBe('walking');
    expect(resWalk.entry.file).toContain('walking.mp4');
    expect(resWalk.entry.loop).toBe(true);

    const resFallback = resolveVideoAnimation(DEFAULT_RABBIT_VIDEO_MANIFEST, 'dance', 'excited');
    expect(resFallback.key).toBe('idle');
    expect(resFallback.entry.file).toContain('idle.mp4');
    expect(resFallback.entry.loop).toBe(true);
  });

  it('resolves mapped action clip when added to manifest', () => {
    const expanded: VideoCharacterManifest = {
      ...DEFAULT_RABBIT_VIDEO_MANIFEST,
      animations: {
        ...DEFAULT_RABBIT_VIDEO_MANIFEST.animations,
        waving: {
          file: './characters/rabbit-video/animations/gestures/waving.webm',
          category: 'gestures',
          durationSec: 2.5,
          loop: false,
          alpha: true,
        },
        thinking: {
          file: './characters/rabbit-video/animations/assistant/thinking.webm',
          category: 'assistant',
          durationSec: 3.0,
          loop: true,
          alpha: true,
        },
      },
    };

    expect(resolveVideoAnimation(expanded, 'wave').key).toBe('waving');
    expect(resolveVideoAnimation(expanded, 'think').key).toBe('thinking');
    expect(resolveVideoAnimation(expanded, 'dance').key).toBe('idle');
  });

  it('allows selecting Rabbit (Video POC) in SettingsModal and persists choice', () => {
    const onCompanionCharacterChange = vi.fn();
    const saveSettings = vi.fn().mockResolvedValue(true);
    (window as any).desktopAPI = {
      storage: {
        getSettings: vi.fn().mockResolvedValue({ companionCharacter: 'appu-3d' }),
        saveSettings,
      },
      setIgnoreMouseEvents: vi.fn(),
    };

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        companionCharacter="appu-3d"
        onCompanionCharacterChange={onCompanionCharacterChange}
      />
    );

    const robotRadio = screen.getByRole('radio', { name: /Robo/i });
    const rabbitRadio = screen.getByRole('radio', { name: /Rabbit/i });

    expect(robotRadio).toHaveAttribute('aria-checked', 'true');
    expect(rabbitRadio).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(rabbitRadio);

    expect(onCompanionCharacterChange).toHaveBeenCalledWith('rabbit-video');
    expect(saveSettings).toHaveBeenCalledWith({ companionCharacter: 'rabbit-video' });
    expect(window.localStorage.getItem('appu_companion_character')).toBe('rabbit-video');

    delete (window as any).desktopAPI;
  });

  it('supports Scale In and Scale Out controls in SettingsModal and persists scale', () => {
    const onCompanionScaleChange = vi.fn();
    const saveSettings = vi.fn().mockResolvedValue(true);
    const setCompanionScale = vi.fn();
    (window as any).desktopAPI = {
      storage: {
        getSettings: vi.fn().mockResolvedValue({ companionScale: 1.0 }),
        saveSettings,
      },
      setCompanionScale,
      setIgnoreMouseEvents: vi.fn(),
    };

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        companionScale={1.0}
        onCompanionScaleChange={onCompanionScaleChange}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Scale In' }));
    expect(onCompanionScaleChange).toHaveBeenCalledWith(1.15);
    expect(setCompanionScale).toHaveBeenCalledWith(1.15);
    expect(saveSettings).toHaveBeenCalledWith({ companionScale: 1.15 });
    expect(window.localStorage.getItem('appu_companion_scale')).toBe('1.15');

    fireEvent.click(screen.getByRole('button', { name: 'Scale Out' }));
    expect(onCompanionScaleChange).toHaveBeenCalledWith(1.0);

    delete (window as any).desktopAPI;
  });

  it('renders VideoCharacterStage gracefully with rabbit-video manifest', () => {
    const onControlsChange = vi.fn();
    render(
      <VideoCharacterStage
        characterId="rabbit-video"
        controls={{ ...INITIAL_CONTROLS, animationState: 'wave' }}
        onControlsChange={onControlsChange}
        isCompanionMode={false}
      />
    );

    const stage = screen.getByTestId('video-character-stage');
    expect(stage).toHaveAttribute('data-character-id', 'rabbit-video');
    expect(stage).toHaveAttribute('data-animation-key', 'waving');
  });

  it('shows only available actions in InteractionMenu and ActionsAndPosesPanel for Rabbit', () => {
    const available = getAvailableActionIds(DEFAULT_RABBIT_VIDEO_MANIFEST);
    expect(available).toEqual(['wave', 'walk']);

    const { unmount } = render(
      <InteractionMenu
        isOpen={true}
        onClose={vi.fn()}
        characterState="Idle"
        isPinned={false}
        onTogglePin={vi.fn()}
        onHideAppu={vi.fn()}
        onReturnHome={vi.fn()}
        onWaveHello={vi.fn()}
        onWalk={vi.fn()}
        onTakeSeat={vi.fn()}
        onGoToSleep={vi.fn()}
        onOpenSettings={vi.fn()}
        onQuitAppu={vi.fn()}
        availableActions={available}
      />
    );

    fireEvent.click(screen.getByText('Actions'));
    expect(screen.getByText('Wave')).toBeInTheDocument();
    expect(screen.getByText('Walk')).toBeInTheDocument();
    expect(screen.queryByText('Cheer')).not.toBeInTheDocument();
    expect(screen.queryByText('Clap')).not.toBeInTheDocument();
    expect(screen.queryByText('Dance')).not.toBeInTheDocument();
    expect(screen.queryByText('Sit')).not.toBeInTheDocument();
    expect(screen.queryByText('Sleep')).not.toBeInTheDocument();
    unmount();

    render(
      <ActionsAndPosesPanel
        isOpen={true}
        onClose={vi.fn()}
        onTriggerAction={vi.fn()}
        onStandUp={vi.fn()}
        availableActions={available}
      />
    );

    expect(screen.getByText('Wave')).toBeInTheDocument();
    expect(screen.getByText('Walk')).toBeInTheDocument();
    expect(screen.queryByText('Handstand')).not.toBeInTheDocument();
  });
});
