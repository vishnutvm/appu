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
        updaterStatus={baseStatus}
      />
    );

    expect(screen.getByText('Identity & Persona')).toBeInTheDocument();
    expect(screen.getByText('Your Name (User)')).toBeInTheDocument();
    expect(screen.getByText('Companion Name')).toBeInTheDocument();
    expect(screen.getByText('Save Names')).toBeInTheDocument();
  });

  it('renders software updates section with version and channel info without automatic updates row', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        updaterStatus={baseStatus}
      />
    );

    expect(screen.getByText('Software Updates')).toBeInTheDocument();
    expect(screen.getByText(/Appu v1.0.0 • Channel: stable/i)).toBeInTheDocument();
    expect(screen.getByText('Check Now')).toBeInTheDocument();
    expect(screen.queryByText('Automatic Updates')).not.toBeInTheDocument();
  });

  it('allows switching update channel to Beta', () => {
    const onSetChannel = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
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

  it('renders Companion Behavior section with Stay on Screen toggle', () => {
    const onTogglePin = vi.fn();
    const onToggleFreeFall = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        isPinned={false}
        onTogglePin={onTogglePin}
        freeFallEnabled={true}
        onToggleFreeFall={onToggleFreeFall}
        updaterStatus={baseStatus}
      />
    );

    expect(screen.getByText('Companion Behavior')).toBeInTheDocument();
    expect(screen.getByText('Stay on Screen')).toBeInTheDocument();
    expect(screen.getByText('Free Fall & Throw Physics')).toBeInTheDocument();

    const stayBtn = screen.getByRole('switch', { name: 'Stay on Screen' });
    fireEvent.click(stayBtn);
    expect(onTogglePin).toHaveBeenCalledTimes(1);

    const freeFallBtn = screen.getByRole('switch', { name: 'Free Fall Physics' });
    fireEvent.click(freeFallBtn);
    expect(onToggleFreeFall).toHaveBeenCalledTimes(1);
  });

  it('invokes onAssistantNameChange when saving new companion name', () => {
    const onAssistantNameChange = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        updaterStatus={baseStatus}
        onAssistantNameChange={onAssistantNameChange}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    // inputs[0] is user name, inputs[1] is companion name
    fireEvent.change(inputs[1], { target: { value: 'Nova' } });

    const saveBtn = screen.getByText('Save Names');
    fireEvent.click(saveBtn);

    expect(onAssistantNameChange).toHaveBeenCalledWith('Nova');
  });
});
