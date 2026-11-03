import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { ActionsAndPosesPanel } from '../components/ActionsAndPosesPanel';

describe('ActionsAndPosesPanel Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    activeActionId: 'wave',
    onTriggerAction: vi.fn(),
    onStandUp: vi.fn(),
    isGroundPose: false,
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(<ActionsAndPosesPanel {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders panel header and category tabs', () => {
    render(<ActionsAndPosesPanel {...defaultProps} />);
    expect(screen.getByText('Actions & Poses')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Greetings/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sitting & Resting/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sleep/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Playful/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Emotes/i })).toBeInTheDocument();
  });

  it('renders pose cards and highlights the active pose', () => {
    render(<ActionsAndPosesPanel {...defaultProps} activeActionId="wave" />);
    const waveButton = screen.getByRole('button', { name: /Wave Hello/i });
    expect(waveButton).toBeInTheDocument();
    expect(waveButton).toHaveClass('is-active');
    expect(waveButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters actions by category when tab clicked', () => {
    render(<ActionsAndPosesPanel {...defaultProps} />);
    // Click Sleep category tab
    fireEvent.click(screen.getByRole('tab', { name: /Sleep/i }));

    // Sleep actions should be present
    expect(screen.getByRole('button', { name: /^Sleep$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deep Sleep/i })).toBeInTheDocument();

    // Wave Hello (Greetings category) should not be visible in filtered tab
    expect(screen.queryByRole('button', { name: /Wave Hello/i })).toBeNull();
  });

  it('triggers onTriggerAction when a pose card is clicked', () => {
    const onTriggerAction = vi.fn();
    render(<ActionsAndPosesPanel {...defaultProps} onTriggerAction={onTriggerAction} />);

    const cheerBtn = screen.getByRole('button', { name: /Cheer/i });
    fireEvent.click(cheerBtn);
    expect(onTriggerAction).toHaveBeenCalledWith('cheer');
  });

  it('displays Stand Up button when in ground pose and triggers onStandUp', () => {
    const onStandUp = vi.fn();
    const { rerender } = render(
      <ActionsAndPosesPanel {...defaultProps} isGroundPose={false} onStandUp={onStandUp} />
    );
    expect(screen.queryByText('Stand Up')).toBeNull();

    rerender(<ActionsAndPosesPanel {...defaultProps} isGroundPose={true} onStandUp={onStandUp} />);
    const standUpBtn = screen.getByText('Stand Up');
    expect(standUpBtn).toBeInTheDocument();

    fireEvent.click(standUpBtn);
    expect(onStandUp).toHaveBeenCalledTimes(1);
  });
});
