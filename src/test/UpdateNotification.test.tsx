import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { UpdateNotification } from '../components/UpdateNotification';
import { UpdaterStatus } from '../types/updater';

describe('UpdateNotification Component', () => {
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

  it('does not render when status is Idle or Up To Date', () => {
    const { container: c1 } = render(
      <UpdateNotification
        status={{ ...baseStatus, state: 'Idle' }}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
        onPostpone={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <UpdateNotification
        status={{ ...baseStatus, state: 'Up To Date' }}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
        onPostpone={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(c2.firstChild).toBeNull();
  });

  it('does not render when a reminder is actively firing', () => {
    const { container } = render(
      <UpdateNotification
        status={{
          ...baseStatus,
          state: 'Update Available',
          updateInfo: { version: '1.1.0', releaseNotes: 'New features' },
        }}
        hasActiveReminder={true}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
        onPostpone={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Update Available with version and triggers download or postpone', () => {
    const onDownload = vi.fn();
    const onPostpone = vi.fn();

    render(
      <UpdateNotification
        status={{
          ...baseStatus,
          state: 'Update Available',
          updateInfo: {
            version: '1.1.0',
            releaseNotes: 'Faster startup and new emotes',
          },
        }}
        onDownload={onDownload}
        onInstall={vi.fn()}
        onPostpone={onPostpone}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText(/Update Available • v1.1.0/i)).toBeInTheDocument();
    expect(screen.getByText('Update Now')).toBeInTheDocument();
    expect(screen.getByText('Later')).toBeInTheDocument();

    // Toggle release notes
    fireEvent.click(screen.getByText('Release Notes'));
    expect(screen.getByText(/Faster startup and new emotes/i)).toBeInTheDocument();

    // Trigger update now
    fireEvent.click(screen.getByText('Update Now'));
    expect(onDownload).toHaveBeenCalledTimes(1);

    // Trigger later
    fireEvent.click(screen.getByText('Later'));
    expect(onPostpone).toHaveBeenCalledTimes(1);
  });

  it('renders Downloading state with progress percentage and metrics', () => {
    render(
      <UpdateNotification
        status={{
          ...baseStatus,
          state: 'Downloading',
          updateInfo: { version: '1.2.0' },
          progress: {
            percent: 64,
            bytesPerSecond: 2 * 1024 * 1024,
            transferred: 32 * 1024 * 1024,
            total: 50 * 1024 * 1024,
          },
        }}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
        onPostpone={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText(/Downloading Appu v1.2.0.../i)).toBeInTheDocument();
    expect(screen.getByText(/64% • 32.0 MB of 50.0 MB/i)).toBeInTheDocument();
    expect(screen.getByText('2.0 MB/s')).toBeInTheDocument();
  });

  it('renders Downloaded state and triggers restart on user approval', () => {
    const onInstall = vi.fn();

    render(
      <UpdateNotification
        status={{
          ...baseStatus,
          state: 'Downloaded',
          updateInfo: { version: '1.2.0' },
        }}
        onDownload={vi.fn()}
        onInstall={onInstall}
        onPostpone={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText(/Update Ready • v1.2.0/i)).toBeInTheDocument();
    expect(screen.getByText('Restart Now')).toBeInTheDocument();
    expect(screen.getByText('Restart Later')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Restart Now'));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('renders Error state and allows retry', () => {
    const onRetry = vi.fn();

    render(
      <UpdateNotification
        status={{
          ...baseStatus,
          state: 'Error',
          error: 'Network timeout while downloading',
        }}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
        onPostpone={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Update Error')).toBeInTheDocument();
    expect(screen.getByText('Network timeout while downloading')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
