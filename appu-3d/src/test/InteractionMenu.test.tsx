import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { InteractionMenu } from '../components/InteractionMenu';
import { CompanionStateLabel } from '../types/menu';

describe('InteractionMenu Component - Grouped Context Menu', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    characterState: 'Idle' as CompanionStateLabel,
    isPinned: false,
    onTogglePin: vi.fn(),
    onHideAppu: vi.fn(),
    onReturnHome: vi.fn(),
    onWaveHello: vi.fn(),
    onTakeSeat: vi.fn(),
    onGoToSleep: vi.fn(),
    onCheer: vi.fn(),
    onClap: vi.fn(),
    onDance: vi.fn(),
    onStandUp: vi.fn(),
    onOpenReminders: vi.fn(),
    onOpenSettings: vi.fn(),
    onQuitAppu: vi.fn(),
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(<InteractionMenu {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders crisp minimal grouped items on main menu', () => {
    render(<InteractionMenu {...defaultProps} characterState="Idle" />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Reminders')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Quit Appu')).toBeInTheDocument();

    // Verify removed clutter is not present
    expect(screen.queryByText('Return to home position')).toBeNull();
    expect(screen.queryByText('Walk to Here')).toBeNull();
    expect(screen.queryByText('Presence')).toBeNull();
    expect(screen.queryByText('Movement')).toBeNull();
    expect(screen.queryByText('Assistant')).toBeNull();
  });

  it('opens Actions submenu on click and triggers Wave', () => {
    const onWaveHello = vi.fn();
    const onClose = vi.fn();
    render(<InteractionMenu {...defaultProps} onWaveHello={onWaveHello} onClose={onClose} />);

    // Actions submenu is initially not visible
    expect(screen.queryByText('Wave')).toBeNull();

    // Click Actions to expand
    fireEvent.click(screen.getByText('Actions'));
    expect(screen.getByText('Wave')).toBeInTheDocument();
    expect(screen.getByText('Cheer')).toBeInTheDocument();
    expect(screen.getByText('Clap')).toBeInTheDocument();
    expect(screen.getByText('Dance')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Wave'));
    expect(onWaveHello).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onCheer from Actions submenu', () => {
    const onCheer = vi.fn();
    const onClose = vi.fn();
    render(<InteractionMenu {...defaultProps} onCheer={onCheer} onClose={onClose} />);

    fireEvent.click(screen.getByText('Actions'));
    fireEvent.click(screen.getByText('Cheer'));
    expect(onCheer).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables Sit when already sitting', () => {
    const onTakeSeat = vi.fn();
    render(<InteractionMenu {...defaultProps} characterState="Sitting" onTakeSeat={onTakeSeat} />);
    fireEvent.click(screen.getByText('Actions'));
    const sitRow = screen.getByText('Sit').closest('.menu-item-row');
    expect(sitRow).toHaveClass('is-disabled');
    if (sitRow) fireEvent.click(sitRow);
    expect(onTakeSeat).not.toHaveBeenCalled();
  });

  it('disables Sleep when already sleeping', () => {
    const onGoToSleep = vi.fn();
    render(<InteractionMenu {...defaultProps} characterState="Sleeping" onGoToSleep={onGoToSleep} />);
    fireEvent.click(screen.getByText('Actions'));
    const sleepRow = screen.getByText('Sleep').closest('.menu-item-row');
    expect(sleepRow).toHaveClass('is-disabled');
    if (sleepRow) fireEvent.click(sleepRow);
    expect(onGoToSleep).not.toHaveBeenCalled();
  });

  it('shows Stand Up option in Actions submenu only when sitting or sleeping', () => {
    const { rerender } = render(<InteractionMenu {...defaultProps} characterState="Idle" />);
    fireEvent.click(screen.getByText('Actions'));
    expect(screen.queryByText('Stand Up')).toBeNull();

    rerender(<InteractionMenu {...defaultProps} characterState="Sitting" />);
    expect(screen.getByText('Stand Up')).toBeInTheDocument();
  });

  it('opens Settings submenu with Stay on screen and Hide Appu', () => {
    const onTogglePin = vi.fn();
    const onHideAppu = vi.fn();
    const onClose = vi.fn();
    render(
      <InteractionMenu
        {...defaultProps}
        isPinned={false}
        onTogglePin={onTogglePin}
        onHideAppu={onHideAppu}
        onClose={onClose}
      />
    );

    expect(screen.queryByText('Stay on Screen')).toBeNull();
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Stay on Screen')).toBeInTheDocument();
    expect(screen.getByText('Hide Appu')).toBeInTheDocument();
    expect(screen.getByText('⌘H')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Stay on Screen'));
    expect(onTogglePin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Hide Appu'));
    expect(onHideAppu).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenReminders when clicking Reminders', () => {
    const onOpenReminders = vi.fn();
    const onClose = vi.fn();
    render(<InteractionMenu {...defaultProps} onOpenReminders={onOpenReminders} onClose={onClose} />);
    fireEvent.click(screen.getByText('Reminders'));
    expect(onOpenReminders).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onQuitAppu when clicking Quit Appu', () => {
    const onQuitAppu = vi.fn();
    const onClose = vi.fn();
    render(<InteractionMenu {...defaultProps} onQuitAppu={onQuitAppu} onClose={onClose} />);
    fireEvent.click(screen.getByText('Quit Appu'));
    expect(onQuitAppu).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<InteractionMenu {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
