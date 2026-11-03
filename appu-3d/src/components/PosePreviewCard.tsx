import React from 'react';
import { AppuActionDefinition } from '../types/actions';
import { PoseThumbnail } from './PoseThumbnails';
import { Play } from 'lucide-react';

interface PosePreviewCardProps {
  action: AppuActionDefinition;
  isActive: boolean;
  onSelect: (action: AppuActionDefinition) => void;
  onDoubleClick?: (action: AppuActionDefinition) => void;
}

export const PosePreviewCard: React.FC<PosePreviewCardProps> = ({
  action,
  isActive,
  onSelect,
  onDoubleClick,
}) => {
  return (
    <button
      type="button"
      className={`pose-preview-card ${isActive ? 'is-active' : ''}`}
      onClick={() => onSelect(action)}
      onDoubleClick={() => onDoubleClick ? onDoubleClick(action) : onSelect(action)}
      title={`${action.label}: ${action.description}`}
      aria-pressed={isActive}
      aria-label={action.label}
    >
      <div className="preview-canvas-container">
        <PoseThumbnail actionId={action.id} size={54} className="preview-thumbnail" />
        {action.badge && <span className="preview-badge">{action.badge}</span>}
        {isActive && (
          <div className="active-glow-indicator" aria-hidden="true">
            <Play size={10} className="active-play-icon" />
          </div>
        )}
      </div>

      <div className="pose-card-info">
        <span className="pose-label">{action.shortLabel || action.label}</span>
      </div>
    </button>
  );
};
