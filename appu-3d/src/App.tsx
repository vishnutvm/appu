import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { AppuScene } from './components/AppuScene';
import { CharacterControls } from './components/CharacterControls';
import { ReminderBubble } from './components/ReminderBubble';
import { InteractionMenu } from './components/InteractionMenu';
import { ActionsAndPosesPanel } from './components/ActionsAndPosesPanel';
import { FloatingEmoteIndicator } from './components/FloatingEmoteIndicator';
import { SettingsModal } from './components/SettingsModal';
import { UpdateNotification } from './components/UpdateNotification';
import { RemindersModal } from './components/RemindersModal';
import { DesktopMovementController } from './controllers/DesktopMovementController';
import { AppuActionRegistry } from './controllers/AppuActionRegistry';
import { RemindersManager } from './controllers/RemindersManager';
import { AppuActionId } from './types/actions';
import { INITIAL_CONTROLS, CharacterControlState, AppuAnimationState, AppuEmotion } from './types/character';
import { CompanionStateLabel } from './types/menu';
import { UpdaterStatus } from './types/updater';
import { Sparkles, Bell, Menu as MenuIcon, Play } from 'lucide-react';
import { MenuPlacement } from './types/desktop';
import './types/desktop';
import './App.css';

export const App: React.FC = () => {
  // Check if running in desktop companion mode (via ?mode=companion or window.desktopAPI)
  const isCompanionMode =
    typeof window !== 'undefined' &&
    (window.location.search.includes('mode=companion') || !!window.desktopAPI);

  const [isPinned, setIsPinned] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [spawnState, setSpawnState] = useState<'spawning_in' | 'active' | 'spawning_out' | 'hidden'>('spawning_in');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isActionsPanelOpen, setIsActionsPanelOpen] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [activeActionId, setActiveActionId] = useState<AppuActionId | string | null>('wave');
  const [followCursorEnabled, setFollowCursorEnabled] = useState(true);

  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement>({
    horizontal: 'left',
    vertical: 'bottom',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null);

  // Subscribe to updater status events
  useEffect(() => {
    if (typeof window !== 'undefined' && window.desktopAPI?.updater) {
      window.desktopAPI.updater.getStatus().then((s) => setUpdaterStatus(s)).catch(() => {});
      const unsubscribe = window.desktopAPI.updater.onStatusChange((s) => {
        setUpdaterStatus(s);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

  // Sync native window bounds between compact (220x300) and expanded menu / modals
  useEffect(() => {
    if (isCompanionMode) {
      if (showRemindersModal) {
        window.desktopAPI?.setMenuOpen(true, 'modal');
      } else if (isMenuOpen || isActionsPanelOpen) {
        window.desktopAPI?.setMenuOpen(true, 'menu');
      } else {
        window.desktopAPI?.setMenuOpen(false);
      }
    }
  }, [isMenuOpen, isActionsPanelOpen, showRemindersModal, isCompanionMode]);

  const [controls, setControls] = useState<CharacterControlState>(() => ({
    ...INITIAL_CONTROLS,
    transparentBackground: isCompanionMode,
    showPedestal: !isCompanionMode, // In desktop mode, Appu walks directly on the wallpaper/taskbar
    groundShadowEnabled: !isCompanionMode, // In companion mode, disable ground contact shadow to eliminate duplicate inverted reflection
    zoom: 4.8,
  }));

  // Reminder bubble state
  const [reminder, setReminder] = useState<{
    title: string;
    message: string;
    actionText?: string;
  } | null>(null);

  // Tell main process when a reminder is active so it delays update notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && window.desktopAPI?.notifyReminderState) {
      window.desktopAPI.notifyReminderState(Boolean(reminder));
    }
  }, [reminder]);

  const movementControllerRef = useRef<DesktopMovementController | null>(null);

  // Compute live character state label for the Interaction Menu header
  const characterStateLabel: CompanionStateLabel = (() => {
    if (controls.isGrabbed) return 'Dragged';
    if (controls.animationState === 'walk' || controls.animationState === 'walking') return 'Walking';
    if (
      controls.animationState === 'sleep' ||
      controls.animationState === 'deep_sleep' ||
      controls.animationState === 'sleep_side' ||
      (controls.animationState === 'sit' && controls.emotion === 'sleepy')
    ) {
      return 'Sleeping';
    }
    if (
      controls.animationState === 'sit' ||
      controls.animationState === 'sit_relaxed' ||
      controls.animationState === 'sit_legs_extended' ||
      controls.animationState === 'sit_cross_legged'
    ) {
      return 'Sitting';
    }
    if (
      controls.animationState === 'lie_down' ||
      controls.animationState === 'lie_down_side' ||
      controls.animationState === 'side_rest' ||
      controls.animationState === 'rest_head_on_hands'
    ) {
      return 'Resting';
    }
    if (controls.animationState === 'wave' || controls.animationState === 'waving') return 'Waving';
    if (controls.animationState === 'dance') return 'Dancing';
    if (controls.animationState === 'think') return 'Thinking';
    if (
      controls.animationState === 'handstand' ||
      controls.animationState === 'upside_down' ||
      controls.animationState === 'spin' ||
      controls.animationState === 'jump' ||
      controls.animationState === 'celebrate'
    ) {
      return 'Playful';
    }
    if (controls.animationState === 'idle' && controls.emotion === 'curious') return 'Curious';
    return 'Idle';
  })();

  const isGroundPose = AppuActionRegistry.isGroundPose(controls.animationState);

  // Action dispatchers
  const handleTriggerAction = (actionId: AppuActionId) => {
    setActiveActionId(actionId);
    const actDef = AppuActionRegistry.getById(actionId);
    if (actDef) {
      setControls((prev) => ({
        ...prev,
        animationState: actDef.animation,
        emotion: actDef.associatedEmotion,
      }));
    }
    window.dispatchEvent(new CustomEvent('appu-trigger-action', { detail: { actionId } }));
  };

  const handleStandUp = () => {
    setActiveActionId(null);
    setControls((prev) => ({
      ...prev,
      animationState: 'returning_to_idle',
    }));
    window.dispatchEvent(new CustomEvent('appu-stand-up'));
  };

  // Smooth spawn-in / spawn-out & hide transitions
  const handleHideAppu = useCallback(() => {
    if (spawnState === 'spawning_out' || spawnState === 'hidden') return;
    setIsMenuOpen(false);
    setIsActionsPanelOpen(false);
    setSpawnState('spawning_out');

    movementControllerRef.current?.stopWalking();
    setControls((prev) => ({
      ...prev,
      animationState: 'sit',
      emotion: 'sleepy',
    }));

    setTimeout(() => {
      setIsHidden(true);
      setSpawnState('hidden');
      window.desktopAPI?.notifyHideFinished?.();
    }, 400);
  }, [spawnState]);

  const handleShowAppu = useCallback((goHome: boolean = false) => {
    window.desktopAPI?.showApp();
    setIsHidden(false);
    setSpawnState('spawning_in');

    setControls((prev) => ({
      ...prev,
      animationState: 'idle',
      emotion: 'happy',
      ...(goHome ? { worldPosition: [0, 0, 0], rotation: 0 } : {}),
    }));

    if (goHome) {
      setIsPinned(false);
      movementControllerRef.current?.walkToHomeCorner();
    } else {
      movementControllerRef.current?.reappear();
    }

    setTimeout(() => {
      setSpawnState('active');
    }, 520);
  }, []);

  // Initial mount: finish spawn-in into active
  useEffect(() => {
    const timer = setTimeout(() => {
      setSpawnState((prev) => (prev === 'spawning_in' ? 'active' : prev));
    }, 550);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Desktop Autonomous Movement
  useEffect(() => {
    if (isCompanionMode) {
      movementControllerRef.current = new DesktopMovementController({
        onStateChange: (state: AppuAnimationState, emotion: AppuEmotion, facingRotation: number) => {
          setControls((prev) => ({
            ...prev,
            animationState: state,
            emotion: emotion,
            rotation: facingRotation,
          }));
        },
      });

      movementControllerRef.current.startCompanionRoutine();

      // Listen for incoming reminder triggers (from IPC or RemindersManager)
      window.desktopAPI?.onTriggerReminder((data) => {
        setIsHidden(false);
        movementControllerRef.current?.triggerReminderStroll(() => {
          setReminder(data);
        });
      });

      // Connect RemindersManager scheduler callback
      const remindersManager = RemindersManager.getInstance();
      remindersManager.setTriggerCallback((r) => {
        setIsHidden(false);
        movementControllerRef.current?.triggerReminderStroll(() => {
          setReminder({
            title: r.title,
            message:
              r.type === 'interval'
                ? `Time for your ${r.intervalMinutes ? r.intervalMinutes + 'm ' : ''}reminder!`
                : `Scheduled reminder time reached!`,
            actionText: 'Done',
          });
        });
        handleTriggerAction('cheer');
      });

      // Left-Click on Appu mesh acknowledges/pats him without opening popup menus
      // Menu is exclusively toggled via Right-Click
      // Listen for adaptive menu placement updates from main process
      window.desktopAPI?.onMenuPlacementChanged((placement: MenuPlacement) => {
        setMenuPlacement(placement);
      });

      // Automatically close menu when Appu begins being dragged
      const handleDragStart = () => {
        setIsMenuOpen(false);
        setIsActionsPanelOpen(false);
      };
      window.addEventListener('appu-drag-start', handleDragStart);

      // Toggle menu when Appu character is tapped / clicked
      const handleAppuClick = () => {
        setIsMenuOpen((prev) => !prev);
        setIsActionsPanelOpen(false);
      };
      window.addEventListener('appu-clicked-by-user', handleAppuClick);

      // Listen for tray / shortcut menu toggle
      window.desktopAPI?.onToggleMenu(() => {
        setIsMenuOpen((prev) => !prev);
      });

      // Listen for smooth hide / show requests from Electron
      window.desktopAPI?.onRequestHide?.(() => {
        handleHideAppu();
      });

      window.desktopAPI?.onRequestShow?.(() => {
        handleShowAppu(false);
      });

      // Listen for visibility change from tray
      window.desktopAPI?.onVisibilityChanged((visible) => {
        if (!visible) {
          setIsHidden(true);
          setSpawnState('hidden');
          setIsMenuOpen(false);
          setIsActionsPanelOpen(false);
        } else {
          setIsHidden(false);
          setSpawnState('active');
        }
      });

      // Listen for Right-Click Context Menu Actions
      window.desktopAPI?.onContextAction((action: string) => {
        if (action === 'stick') {
          setIsPinned(true);
          movementControllerRef.current?.stickToEdge(() => setIsPinned(true));
        } else if (action === 'unstick') {
          setIsPinned(false);
          movementControllerRef.current?.unstick(() => setIsPinned(false));
        } else if (action === 'disappear') {
          handleHideAppu();
        } else if (action === 'reappear') {
          handleShowAppu(false);
        } else if (action === 'go-home') {
          handleShowAppu(true);
        } else if (action === 'wave') {
          handleTriggerAction('wave');
        } else if (action === 'sit') {
          handleTriggerAction('sit');
        } else if (action === 'sleep') {
          handleTriggerAction('sleep');
        }
      });

      return () => {
        window.removeEventListener('appu-drag-start', handleDragStart);
        window.removeEventListener('appu-clicked-by-user', handleAppuClick);
        movementControllerRef.current?.destroy();
      };
    } else {
      return () => {};
    }
  }, [isCompanionMode]);

  // Global keydown listeners for shortcuts (⌘H, ⌘0, ⌘K, etc.)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // ⌘H to toggle hide/show Appu
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (isHidden || spawnState === 'hidden' || spawnState === 'spawning_out') {
          handleShowAppu(false);
        } else {
          handleHideAppu();
        }
        return;
      }

      // ⌘0 to summon Appu to home corner
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleShowAppu(true);
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isHidden, spawnState, handleHideAppu, handleShowAppu]);

  // -------------------------------------------------------------
  // COMPANION MODE RENDER: Transparent, Frameless Desktop Widget
  // -------------------------------------------------------------
  if (isCompanionMode) {
    const isExpanded = isMenuOpen || isActionsPanelOpen || showRemindersModal;

    return (
      <div
        className={`appu-desktop-companion-viewport ${
          isHidden ? 'appu-hidden' : ''
        } ${isExpanded ? 'menu-open' : 'menu-closed'} menu-h-${menuPlacement.horizontal} menu-v-${menuPlacement.vertical}`}
        onClick={() => {
          if (isMenuOpen || isActionsPanelOpen) {
            setIsMenuOpen(false);
            setIsActionsPanelOpen(false);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsMenuOpen((prev) => !prev);
          setIsActionsPanelOpen(false);
        }}
        onMouseEnter={() => {
          // Let clicks pass through when over empty transparent space
          if (!isHidden && !isExpanded) {
            window.desktopAPI?.setIgnoreMouseEvents(true);
          }
        }}
      >
        {/* Sleek Summon Pill when Appu is Hidden */}
        {isHidden && (
          <button
            className="appu-summon-pill"
            onClick={(e) => {
              e.stopPropagation();
              window.desktopAPI?.setIgnoreMouseEvents(false);
              handleShowAppu(false);
            }}
            onMouseEnter={() => {
              window.desktopAPI?.setIgnoreMouseEvents(false);
            }}
            onMouseLeave={() => {
              window.desktopAPI?.setIgnoreMouseEvents(true);
            }}
            title="Summon Appu back (or press ⌘H)"
          >
            <span className="summon-icon">🤖</span>
            <span className="summon-text">Appu</span>
          </button>
        )}

        {/* Floating Notification Speech Bubble above Appu */}
        {reminder && !isHidden && (
          <ReminderBubble
            title={reminder.title}
            message={reminder.message}
            actionText={reminder.actionText}
            onAction={() => {
              setReminder(null);
              movementControllerRef.current?.dismissAndReturnHome();
            }}
            onDismiss={() => {
              setReminder(null);
              movementControllerRef.current?.dismissAndReturnHome();
            }}
          />
        )}

        {/* Left Side: 3D Character Canvas */}
        <div
          className={`companion-character-hitbox ${isPinned ? 'is-pinned' : ''} ${
            spawnState === 'spawning_in' ? 'spawning-in' : ''
          } ${spawnState === 'spawning_out' ? 'spawning-out' : ''} ${
            spawnState === 'hidden' || isHidden ? 'hidden-state' : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen((prev) => !prev);
            setIsActionsPanelOpen(false);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsMenuOpen((prev) => !prev);
            setIsActionsPanelOpen(false);
          }}
          onMouseEnter={() => {
            // Enable mouse interactions when hovering directly on Appu
            window.desktopAPI?.setIgnoreMouseEvents(false);
          }}
          onMouseLeave={() => {
            // Restore click-through when mouse moves away unless menu is open
            if (!isExpanded) {
              window.desktopAPI?.setIgnoreMouseEvents(true);
            }
          }}
        >
          {/* Floating Emote Indicator (Sleep Zz, Think ?, Bored ...) */}
          <FloatingEmoteIndicator
            state={controls.animationState}
            isSleeping={characterStateLabel === 'Sleeping'}
          />

          <Canvas
            shadows
            camera={{ position: [0, 0.16, 4.8], fov: 30, near: 0.1, far: 50 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            }}
            className="three-canvas"
          >
            <AppuScene
              controls={controls}
              onControlsChange={setControls}
              isMenuOpen={isExpanded}
              menuSide={isCompanionMode ? menuPlacement.horizontal : 'left'}
              spawnState={spawnState}
              onSpawnComplete={() => setSpawnState('active')}
              onDespawnComplete={() => {
                setIsHidden(true);
                setSpawnState('hidden');
                window.desktopAPI?.notifyHideFinished?.();
              }}
            />
          </Canvas>
        </div>

        {/* Right Side: Redesigned Native Interaction Menu & Actions Gallery */}
        <div
          className={`companion-menu-anchor ${isExpanded ? 'is-open' : ''}`}
          onMouseEnter={() => {
            window.desktopAPI?.setIgnoreMouseEvents(false);
          }}
          onMouseLeave={() => {
            if (!isExpanded) {
              window.desktopAPI?.setIgnoreMouseEvents(true);
            }
          }}
        >
          <InteractionMenu
            isOpen={isMenuOpen && !isHidden}
            onClose={() => setIsMenuOpen(false)}
            characterState={characterStateLabel}
            isPinned={isPinned}
            onTogglePin={() => {
              const next = !isPinned;
              setIsPinned(next);
              if (next) {
                movementControllerRef.current?.stickToEdge(() => setIsPinned(true));
              } else {
                movementControllerRef.current?.unstick(() => setIsPinned(false));
              }
            }}
            onHideAppu={() => {
              handleHideAppu();
            }}
            onReturnHome={() => {
              setIsPinned(false);
              movementControllerRef.current?.walkToHomeCorner();
            }}
            onWaveHello={() => {
              handleTriggerAction('wave');
            }}
            onCheer={() => {
              handleTriggerAction('cheer');
            }}
            onClap={() => {
              handleTriggerAction('clap');
            }}
            onDance={() => {
              handleTriggerAction('dance');
            }}
            onTakeSeat={() => {
              handleTriggerAction('sit');
            }}
            onGoToSleep={() => {
              handleTriggerAction('sleep');
            }}
            onStandUp={handleStandUp}
            onOpenReminders={() => {
              setIsMenuOpen(false);
              setShowRemindersModal(true);
            }}
            onOpenSettings={() => {
              setShowSettings(true);
            }}
            onQuitAppu={() => {
              window.desktopAPI?.quitApp();
            }}
            isWalkingHome={controls.animationState === 'walk'}
            activeActionId={activeActionId}
            followCursorEnabled={followCursorEnabled}
            onToggleFollowCursor={() => setFollowCursorEnabled((prev) => !prev)}
          />
        </div>

        {/* Reminders Modal */}
        <RemindersModal
          isOpen={showRemindersModal}
          onClose={() => setShowRemindersModal(false)}
        />

        {/* Preferences / Settings Modal */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          isPinned={isPinned}
          onTogglePin={() => {
            const next = !isPinned;
            setIsPinned(next);
            if (next) {
              movementControllerRef.current?.stickToEdge(() => setIsPinned(true));
            } else {
              movementControllerRef.current?.unstick(() => setIsPinned(false));
            }
          }}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // STUDIO APPLICATION MODE RENDER (Browser Studio View)
  // -------------------------------------------------------------
  return (
    <div
      className={`appu-studio-window ${
        controls.transparentBackground ? 'transparent-mode' : ''
      }`}
    >
      {/* Top Application Window Bar with Window Controls */}
      <header className="window-header">
        <div className="window-brand">
          <div className="brand-icon-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="6"
                width="18"
                height="13"
                rx="5"
                stroke="#f6c344"
                strokeWidth="2"
                fill="rgba(246, 195, 68, 0.2)"
              />
              <circle cx="8.5" cy="12" r="1.5" fill="#f6c344" />
              <circle cx="15.5" cy="12" r="1.5" fill="#f6c344" />
              <path
                d="M10.5 15C11 15.5 13 15.5 13.5 15"
                stroke="#f6c344"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path d="M12 2V6" stroke="#f6c344" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="brand-labels">
            <span className="brand-heading">Appu</span>
            <span className="brand-sub">3D AI Assistant Character</span>
          </div>
        </div>

        {/* Desktop window controls (minimize, maximize, close) */}
        <div className="window-actions">
          {/* Interaction Menu Toggle Button for Browser Studio */}
          <button
            className={`companion-mode-launcher-btn ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            title="Open Appu Desktop Interaction Menu"
          >
            <MenuIcon size={13} className="text-gold" />
            <span>Interaction Menu</span>
          </button>

          {/* Actions & Poses Panel Launcher */}
          <button
            className={`companion-mode-launcher-btn ${isActionsPanelOpen ? 'active' : ''}`}
            onClick={() => setIsActionsPanelOpen((prev) => !prev)}
            title="Open Actions & Poses Panel"
          >
            <Play size={12} className="text-gold" fill="#f6c344" />
            <span>Actions & Poses</span>
          </button>

          {/* Dev-only reminder simulation — hidden in production / packaged builds */}
          {import.meta.env.DEV && (
            <button
              className="companion-mode-launcher-btn"
              onClick={() => {
                setReminder(
                  reminder
                    ? null
                    : {
                        title: 'Reminder',
                        message: 'Team meeting in 5 minutes. Shall I open the meeting link for you?',
                        actionText: 'Join Meeting',
                      }
                );
              }}
              title="Toggle Reminder Bubble Simulation (Dev Only)"
            >
              <Bell size={13} className="text-gold" />
              <span>Test Reminder</span>
            </button>
          )}

          {/*
            Studio chrome is browser-only (Electron always loads ?mode=companion).
            Decorative Minimize / Maximize / Close controls are hidden here — they
            have no BrowserWindow to drive. Use companion tray Quit / hide instead.
          */}
        </div>
      </header>

      {/* Main Studio Body: Sidebar on Left, 3D Canvas in Center, Floating Card on Right */}
      <div className="studio-main-body">
        {/* Fullscreen 3D Viewport with Appu on the illuminated gold pedestal */}
        <div className="canvas-stage">
          {reminder && (
            <div className="studio-bubble-wrapper">
              <ReminderBubble
                title={reminder.title}
                message={reminder.message}
                actionText={reminder.actionText}
                onAction={() => setReminder(null)}
                onDismiss={() => setReminder(null)}
              />
            </div>
          )}

          {/* Floating Emote Indicator */}
          <FloatingEmoteIndicator
            state={controls.animationState}
            isSleeping={characterStateLabel === 'Sleeping'}
          />

          {/* Interaction Menu & Actions & Poses Panel in Studio Stage */}
          <div className="studio-menu-anchor">
            <InteractionMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              characterState={characterStateLabel}
              isPinned={isPinned}
              onTogglePin={() => setIsPinned(!isPinned)}
              onHideAppu={() => setIsMenuOpen(false)}
              onReturnHome={() => {
                setControls((prev) => ({ ...prev, animationState: 'idle' }));
              }}
              onWaveHello={() => {
                handleTriggerAction('wave');
              }}
              onTakeSeat={() => {
                handleTriggerAction('sit');
              }}
              onGoToSleep={() => {
                handleTriggerAction('sleep');
              }}
              onOpenSettings={() => {
                setShowSettings(true);
              }}
              onQuitAppu={() => {
                // Prefer native quit when studio somehow runs under Electron preload.
                if (window.desktopAPI?.quitApp) {
                  window.desktopAPI.quitApp();
                  return;
                }
                // Browser studio has no app process to terminate.
              }}
              onOpenActionsGallery={() => {
                setIsActionsPanelOpen((prev) => !prev);
              }}
              activeActionId={activeActionId}
              followCursorEnabled={followCursorEnabled}
              onToggleFollowCursor={() => setFollowCursorEnabled((prev) => !prev)}
            />

            <ActionsAndPosesPanel
              isOpen={isActionsPanelOpen}
              onClose={() => setIsActionsPanelOpen(false)}
              activeActionId={activeActionId}
              onTriggerAction={handleTriggerAction}
              onStandUp={handleStandUp}
              isGroundPose={isGroundPose}
            />
          </div>

          <Canvas
            shadows
            camera={{ position: [0, 0.16, 4.8], fov: 30, near: 0.1, far: 50 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
            }}
            className="three-canvas"
          >
            <AppuScene
              controls={controls}
              onControlsChange={setControls}
              isMenuOpen={isMenuOpen || isActionsPanelOpen}
              menuSide={isCompanionMode ? menuPlacement.horizontal : 'left'}
              spawnState={spawnState}
            />
          </Canvas>

          {/* Interaction Guide Pill */}
          <div className="stage-hint-pill">
            <Sparkles size={13} className="text-gold" />
            <span>Click Appu for Menu • Drag to move • Press ⌘0 / ⌘H to summon back to screen</span>
          </div>
        </div>

        {/* Character Studio Controls: Left Navigation & Right Floating Card */}
        <CharacterControls controls={controls} onChange={setControls} />
      </div>

      {/* Software Update Notification Banner */}
      <UpdateNotification
        status={updaterStatus}
        hasActiveReminder={Boolean(reminder)}
        onDownload={() => window.desktopAPI?.updater?.downloadUpdate()}
        onInstall={() => window.desktopAPI?.updater?.quitAndInstall()}
        onPostpone={() => window.desktopAPI?.updater?.postponeUpdate()}
        onRetry={() => window.desktopAPI?.updater?.checkForUpdates(true)}
      />

      {/* Preferences / Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isPinned={isPinned}
        onTogglePin={() => setIsPinned(!isPinned)}
        updaterStatus={updaterStatus}
      />
    </div>
  );
};

export default App;
