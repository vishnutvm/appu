import React, { useState, useMemo } from 'react';
import { ActionCategory, AppuActionDefinition, AppuActionId, ACTION_CATEGORIES } from '../types/actions';
import { AppuActionRegistry } from '../controllers/AppuActionRegistry';
import { PosePreviewCard } from './PosePreviewCard';
import { Play, Sparkles, UserCheck, X } from 'lucide-react';
import './ActionsAndPosesPanel.css';

interface ActionsAndPosesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeActionId?: AppuActionId | string | null;
  onTriggerAction: (actionId: AppuActionId) => void;
  onStandUp: () => void;
  isGroundPose?: boolean;
  availableActions?: string[] | null;
}

export const ActionsAndPosesPanel: React.FC<ActionsAndPosesPanelProps> = ({
  isOpen,
  onClose,
  activeActionId,
  onTriggerAction,
  onStandUp,
  isGroundPose = false,
  availableActions = null,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory | 'all'>('all');

  const allActions = useMemo(() => {
    const base = AppuActionRegistry.getAll();
    if (!availableActions) return base;
    return base.filter((a) => availableActions.includes(a.id));
  }, [availableActions]);

  const visibleCategories = useMemo(() => {
    if (!availableActions) return ACTION_CATEGORIES;
    return ACTION_CATEGORIES.filter((cat) => allActions.some((a) => a.category === cat.id));
  }, [allActions, availableActions]);

  const filteredActions = useMemo(() => {
    if (selectedCategory === 'all') return allActions;
    return allActions.filter((a) => a.category === selectedCategory);
  }, [allActions, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div
      className="actions-poses-panel-card"
      role="region"
      aria-label="Actions and Poses Gallery"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header matching reference image: "▶ Actions & Poses" */}
      <div className="panel-header">
        <div className="header-title-group">
          <Play size={12} className="header-play-accent" fill="#f6c344" />
          <h2 className="header-title">Actions & Poses</h2>
        </div>

        <div className="header-actions">
          {isGroundPose && (
            <button
              type="button"
              className="stand-up-btn"
              onClick={onStandUp}
              title="Return Appu to Standing Position"
            >
              <UserCheck size={12} />
              <span>Stand Up</span>
            </button>
          )}
          <button
            type="button"
            className="panel-close-btn"
            onClick={onClose}
            title="Close Panel"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="category-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'all'}
          className={`category-tab-btn ${selectedCategory === 'all' ? 'is-selected' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          <Sparkles size={11} className="tab-icon" />
          <span>All</span>
        </button>

        {visibleCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={selectedCategory === cat.id}
            className={`category-tab-btn ${selectedCategory === cat.id ? 'is-selected' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Grid of Pose Cards */}
      <div className="pose-cards-scroll-container">
        <div className="pose-cards-grid">
          {filteredActions.map((action) => {
            const isActive = activeActionId === action.id;
            return (
              <PosePreviewCard
                key={action.id}
                action={action}
                isActive={isActive}
                onSelect={(act) => onTriggerAction(act.id)}
                onDoubleClick={(act) => onTriggerAction(act.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
