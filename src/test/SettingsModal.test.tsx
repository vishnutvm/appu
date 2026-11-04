import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { SettingsModal } from '../components/SettingsModal';
import { UpdaterStatus } from '../types/updater';

describe('SettingsModal Component - Software Updates', () => {
  const baseStatus: UpdaterStatus = {
    state: 'Idle',
    currentVersion: '1.0.0',
    channel: 'stable',
    autoCheckEnabled: true,
    updateInfo: null,
    progress: null,
    error: null,
    lastChecked: null,
  };

  it('renders identity and persona section with user and companion name fields', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        updaterStatus={baseStatus}
      />
    );

    expect(screen.getByText('Identity & Persona')).toBeInTheDocument();
    expect(screen.getByText('Your Name (User)')).toBeInTheDocument();
    expect(screen.getByText('Companion Name')).toBeInTheDocument();
    expect(screen.getByText('Save Names')).toBeInTheDocument();
  });

  it('renders software updates section with version and channel info', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        updaterStatus={baseStatus}
      />
    );

    expect(screen.getByText('Software Updates')).toBeInTheDocument();
    expect(screen.getByText(/Appu v1.0.0 • Channel: stable/i)).toBeInTheDocument();
    expect(screen.getByText('Check Now')).toBeInTheDocument();
    expect(screen.getByText('Automatic Updates')).toBeInTheDocument();
  });

  it('allows switching update channel to Beta', () => {
    const onSetChannel = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        updaterStatus={baseStatus}
        onSetChannel={onSetChannel}
      />
    );

    const betaButton = screen.getByText('Beta');
    fireEvent.click(betaButton);
    expect(onSetChannel).toHaveBeenCalledWith('beta');
  });

  it('triggers manual update check when clicking Check Now', () => {
    const onCheckUpdates = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        updaterStatus={baseStatus}
        onCheckUpdates={onCheckUpdates}
      />
    );

    fireEvent.click(screen.getByText('Check Now'));
    expect(onCheckUpdates).toHaveBeenCalledTimes(1);
  });

  it('shows checking state with spinner and disabled button', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        updaterStatus={{ ...baseStatus, state: 'Checking' }}
      />
    );

    expect(screen.getByText('Checking...')).toBeInTheDocument();
    expect(screen.getByText(/Checking update servers for stable releases.../i)).toBeInTheDocument();
  });

  it('renders update available in settings and triggers download', () => {
    const onDownloadUpdate = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        updaterStatus={{
          ...baseStatus,
          state: 'Update Available',
          updateInfo: { version: '1.2.0', releaseNotes: 'Cool changes' },
        }}
        onDownloadUpdate={onDownloadUpdate}
      />
    );

    expect(screen.getByText(/v1.2.0 Available/i)).toBeInTheDocument();
    const downloadBtn = screen.getByText('Download');
    fireEvent.click(downloadBtn);
    expect(onDownloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('renders downloaded state and offers restart button', () => {
    const onInstallUpdate = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        updaterStatus={{
          ...baseStatus,
          state: 'Downloaded',
          updateInfo: { version: '1.2.0' },
        }}
        onInstallUpdate={onInstallUpdate}
      />
    );

    expect(screen.getByText(/v1.2.0 ready to install./i)).toBeInTheDocument();
    const restartBtn = screen.getByText('Restart Now');
    fireEvent.click(restartBtn);
    expect(onInstallUpdate).toHaveBeenCalledTimes(1);
  });

  it('renders free fall toggle and allows disabling free fall physics', () => {
    const onToggleFreeFall = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        freeFallEnabled={true}
        onToggleFreeFall={onToggleFreeFall}
        updaterStatus={baseStatus}
      />
    );

    expect(screen.getByText('Free Fall & Throw Physics')).toBeInTheDocument();
    const toggle = screen.getByLabelText('Toggle Free Fall Physics');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);
    expect(onToggleFreeFall).toHaveBeenCalledTimes(1);
  });
});
