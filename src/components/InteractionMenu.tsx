import React, { useEffect, useRef, useState } from 'react';
import { InteractionMenuProps } from '../types/menu';
import './InteractionMenu.css';

export const InteractionMenu: React.FC<InteractionMenuProps> = ({
  isOpen,
  onClose,
  characterState,
  isPinned,
  onTogglePin,
  onHideAppu,
  onWaveHello,
  onTakeSeat,
  onGoToSleep,
  onCheer,
  onClap,
  onDance,
  onStandUp,
  onOpenReminders,
  onOpenQuickAppu,
  onOpenSettings,
  onQuitAppu,
  activeActionId,
  followCursorEnabled = false,
  onToggleFollowCursor,
  onOpenAssistantTab,
  assistantName = 'Appu',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<'actions' | 'settings' | null>(null);

  // Reset active submenu when menu closes
  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenu(null);
    }
  }, [isOpen]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSitting = characterState === 'Sitting';
  const isSleeping = characterState === 'Sleeping';
  const isSittingOrSleeping = isSitting || isSleeping;

  return (
    <div
      ref={menuRef}
      className="interaction-menu-card minimal"
      role="menu"
      aria-label={`${assistantName} Quick Menu`}
    >
      <div className="minimal-menu-list">
        {/* --- Chat Direct Item (First Option) --- */}
        <div
          role="menuitem"
          tabIndex={0}
          className="menu-item-row is-chat-action"
          onMouseEnter={() => setActiveSubmenu(null)}
          onClick={() => {
            if (onOpenQuickAppu) {
              onOpenQuickAppu();
            } else if (onOpenAssistantTab) {
              onOpenAssistantTab('chat');
            }
            onClose();
          }}
        >
          <span className="item-title">Chat</span>
          <span className="key-hint">AI ⌘K</span>
        </div>

        {/* --- Actions Submenu --- */}
        <div
          role="menuitem"
          tabIndex={0}
          aria-haspopup="true"
          aria-expanded={activeSubmenu === 'actions'}
          className={`menu-item-row has-submenu ${activeSubmenu === 'actions' ? 'is-submenu-open' : ''}`}
          onMouseEnter={() => setActiveSubmenu('actions')}
          onClick={() => setActiveSubmenu((prev) => (prev === 'actions' ? null : 'actions'))}
        >
          <span className="item-title">Actions</span>
          <span className="submenu-arrow">›</span>

          {activeSubmenu === 'actions' && (
            <div
              className="submenu-flyout"
              role="menu"
              aria-label="Actions Submenu"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                role="menuitem"
                tabIndex={0}
                className={`menu-item-row ${activeActionId === 'wave' ? 'is-active' : ''}`}
                onClick={() => {
                  onWaveHello();
                  onClose();
                }}
              >
                <span className="item-title">Wave</span>
              </div>

              <div
                role="menuitem"
                tabIndex={0}
                className={`menu-item-row ${activeActionId === 'cheer' ? 'is-active' : ''}`}
                onClick={() => {
                  onCheer ? onCheer() : onWaveHello();
                  onClose();
                }}
              >
                <span className="item-title">Cheer</span>
              </div>

              <div
                role="menuitem"
                tabIndex={0}
                className={`menu-item-row ${activeActionId === 'clap' ? 'is-active' : ''}`}
                onClick={() => {
                  onClap ? onClap() : onWaveHello();
                  onClose();
                }}
              >
                <span className="item-title">Clap</span>
              </div>

              <div
                role="menuitem"
                tabIndex={0}
                className={`menu-item-row ${activeActionId === 'dance' ? 'is-active' : ''}`}
                onClick={() => {
                  onDance ? onDance() : onWaveHello();
                  onClose();
                }}
              >
                <span className="item-title">Dance</span>
              </div>

              <div
                role="menuitem"
                tabIndex={0}
                className={`menu-item-row ${isSitting ? 'is-disabled' : ''}`}
                onClick={() => {
                  if (!isSitting) {
                    onTakeSeat();
                    onClose();
                  }
                }}
              >
                <span className="item-title">Sit</span>
              </div>

              <div
                role="menuitem"
                tabIndex={0}
                className={`menu-item-row ${isSleeping ? 'is-disabled' : ''}`}
                onClick={() => {
                  if (!isSleeping) {
                    onGoToSleep();
                    onClose();
                  }
                }}
              >
                <span className="item-title">Sleep</span>
              </div>

              {isSittingOrSleeping && (
                <div
                  role="menuitem"
                  tabIndex={0}
                  className="menu-item-row"
                  onClick={() => {
                    onStandUp ? onStandUp() : onWaveHello();
                    onClose();
                  }}
                >
                  <span className="item-title">Stand Up</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- Reminders Direct Item --- */}
        <div
          role="menuitem"
          tabIndex={0}
          className="menu-item-row"
          onMouseEnter={() => setActiveSubmenu(null)}
          onClick={() => {
            onOpenReminders ? onOpenReminders() : undefined;
            onClose();
          }}
        >
          <span className="item-title">Reminders</span>
        </div>

        {/* --- Settings Submenu --- */}
        <div
          role="menuitem"
          tabIndex={0}
          aria-haspopup="true"
          aria-expanded={activeSubmenu === 'settings'}
          className={`menu-item-row has-submenu ${activeSubmenu === 'settings' ? 'is-submenu-open' : ''}`}
          onMouseEnter={() => setActiveSubmenu('settings')}
          onClick={() => setActiveSubmenu((prev) => (prev === 'settings' ? null : 'settings'))}
        >
          <span className="item-title">Settings</span>
          <span className="submenu-arrow">›</span>

          {activeSubmenu === 'settings' && (
            <div
              className="submenu-flyout"
              role="menu"
              aria-label="Settings Submenu"
              onClick={(e) => e.stopPropagation()}
            >
              {onToggleFollowCursor && (
                <div
                  role="menuitem"
                  tabIndex={0}
                  className="menu-item-row"
                  onClick={onToggleFollowCursor}
                >
                  <span className="item-title">Follow Cursor</span>
                  <span className={`status-pill ${followCursorEnabled ? 'on' : 'off'}`}>
                    {followCursorEnabled ? 'On' : 'Off'}
                  </span>
                </div>
              )}

              <div
                role="menuitem"
                tabIndex={0}
                className="menu-item-row"
                onClick={onTogglePin}
              >
                <span className="item-title">Stay on Screen</span>
                <span className={`status-pill ${isPinned ? 'on' : 'off'}`}>
                  {isPinned ? 'On' : 'Off'}
                </span>
              </div>

              <div
                role="menuitem"
                tabIndex={0}
                className="menu-item-row"
                onClick={() => {
                  onHideAppu();
                  onClose();
                }}
              >
                <span className="item-title">Hide {assistantName}</span>
                <span className="key-hint">⌘H</span>
              </div>

              {onOpenSettings && (
                <div
                  role="menuitem"
                  tabIndex={0}
                  className="menu-item-row"
                  onClick={() => {
                    onOpenSettings();
                    onClose();
                  }}
                >
                  <span className="item-title">Preferences...</span>
                  <span className="key-hint">⌘,</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="menu-divider" />

        {/* --- Quit Companion Direct Item --- */}
        <div
          role="menuitem"
          tabIndex={0}
          className="menu-item-row is-danger"
          onMouseEnter={() => setActiveSubmenu(null)}
          onClick={() => {
            onQuitAppu();
            onClose();
          }}
        >
          <span className="item-title">Quit {assistantName}</span>
        </div>
      </div>
    </div>
  );
};
