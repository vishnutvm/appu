import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { AppuScene } from './components/AppuScene';
import { CharacterControls } from './components/CharacterControls';
import { ReminderBubble } from './components/ReminderBubble';
import { InteractionMenu } from './components/InteractionMenu';
import { ActionsAndPosesPanel } from './components/ActionsAndPosesPanel';
import { FloatingEmoteIndicator } from './components/FloatingEmoteIndicator';
import { SettingsModal } from './components/SettingsModal';
import { RemindersModal } from './components/RemindersModal';
import { QuickAppuChat } from './components/QuickAppuChat';
import { UpdateNotification } from './components/UpdateNotification';
import { DesktopMovementController } from './controllers/DesktopMovementController';
import { AppuActionRegistry } from './controllers/AppuActionRegistry';
import { RemindersManager } from './controllers/RemindersManager';
import { ReminderRecurrence } from './types/reminders';
import { AppuActionId } from './types/actions';
import { INITIAL_CONTROLS, CharacterControlState, AppuAnimationState, AppuEmotion } from './types/character';
import { CompanionStateLabel } from './types/menu';
import { UpdaterStatus } from './types/updater';
import { Sparkles, Bell, Menu as MenuIcon, Play, Sliders } from 'lucide-react';
import { MenuPlacement } from './types/desktop';
import './types/desktop';
import './App.css';

interface QueuedReminder {
  id?: string;
  title: string;
  message?: string;
  actionText?: string;
  intervalMinutes?: number;
  specificTime?: string;
  type?: 'interval' | 'specific_time';
  recurrence?: ReminderRecurrence;
}

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
  const [activeActionId, setActiveActionId] = useState<AppuActionId | string | null>('wave');
  const [followCursorEnabled, setFollowCursorEnabled] = useState(true);

  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement>({
    horizontal: 'left',
    vertical: 'bottom',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [freeFallEnabled, setFreeFallEnabled] = useState(true);
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null);
  const [assistantName, setAssistantName] = useState<string>('Appu');

  const lastActivityRef = useRef<number>(Date.now());
  const isExitingRef = useRef<boolean>(false);
  const isHiddenRef = useRef(false);
  const spawnStateRef = useRef<'spawning_in' | 'active' | 'spawning_out' | 'hidden'>('spawning_in');
  const registerUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    isExitingRef.current = false;
  }, []);

  useEffect(() => {
    isHiddenRef.current = isHidden;
  }, [isHidden]);
  useEffect(() => {
    spawnStateRef.current = spawnState;
  }, [spawnState]);

  const handleTogglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      lastActivityRef.current = Date.now();
      movementControllerRef.current?.setIsPinned(next);
      if (window.desktopAPI?.storage) {
        window.desktopAPI.storage.saveSettings({ isPinned: next }).catch(() => {});
      }
      if (next) {
        movementControllerRef.current?.stickToEdge(() => setIsPinned(true));
      } else {
        movementControllerRef.current?.unstick(() => setIsPinned(false));
      }
      return next;
    });
  }, []);

  const handleToggleFreeFall = useCallback(() => {
    lastActivityRef.current = Date.now();
    setFreeFallEnabled((prev) => {
      const next = !prev;
      movementControllerRef.current?.setFreeFallEnabled(next);
      if (window.desktopAPI?.storage) {
        window.desktopAPI.storage.saveSettings({ freeFallEnabled: next }).catch(() => {});
      }
      return next;
    });
  }, []);

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

  // Reminder bubble state
  const [reminder, setReminder] = useState<{
    id?: string;
    title: string;
    message?: string;
    actionText?: string;
    intervalMinutes?: number;
    specificTime?: string;
    type?: 'interval' | 'specific_time';
    recurrence?: ReminderRecurrence;
  } | null>(null);

  // Sync native window bounds between compact (220x300) and expanded menu / modals / chat
  useEffect(() => {
    if (isCompanionMode) {
      if (showSettings || showRemindersModal) {
        window.desktopAPI?.setMenuOpen(true, 'modal');
      } else if (isChatOpen) {
        window.desktopAPI?.setMenuOpen(true, 'chat');
      } else if (isMenuOpen || isActionsPanelOpen || Boolean(reminder)) {
        window.desktopAPI?.setMenuOpen(true, 'menu');
      } else {
        window.desktopAPI?.setMenuOpen(false);
      }
    }
  }, [isMenuOpen, isActionsPanelOpen, showSettings, showRemindersModal, reminder, isChatOpen, isCompanionMode]);

  const [controls, setControls] = useState<CharacterControlState>(() => ({
    ...INITIAL_CONTROLS,
    transparentBackground: isCompanionMode,
    showPedestal: !isCompanionMode, // In desktop mode, Appu walks directly on the wallpaper/taskbar
    groundShadowEnabled: !isCompanionMode, // In companion mode, disable ground contact shadow to eliminate duplicate inverted reflection
    zoom: 4.8,
  }));

  // Tell main process when a reminder is active so it delays update notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && window.desktopAPI?.notifyReminderState) {
      window.desktopAPI.notifyReminderState(Boolean(reminder));
    }
  }, [reminder]);

  // Connect AI Brain Activity States to 3D Character
  useEffect(() => {
    if (typeof window === 'undefined' || !window.desktopAPI?.ai) return;

    const unsubscribe = window.desktopAPI.ai.onStateChanged((evt) => {
      if (!evt?.state) return;
      switch (evt.state) {
        case 'listening':
          setControls((prev) => ({
            ...prev,
            animationState: 'looking',
            emotion: 'curious',
          }));
          break;
        case 'thinking':
          setControls((prev) => ({
            ...prev,
            animationState: 'think',
            emotion: 'thinking',
          }));
          break;
        case 'executing':
          setControls((prev) => ({
            ...prev,
            animationState: 'point',
            emotion: 'focused',
          }));
          break;
        case 'waiting_approval':
          setControls((prev) => ({
            ...prev,
            animationState: 'looking_around',
            emotion: 'curious',
          }));
          break;
        case 'responding':
          setControls((prev) => ({
            ...prev,
            animationState: 'wave',
            emotion: 'happy',
          }));
          break;
        case 'error':
          setControls((prev) => ({
            ...prev,
            animationState: 'confused',
            emotion: 'confused',
          }));
          break;
        case 'idle':
          setControls((prev) => ({
            ...prev,
            animationState: 'idle',
            emotion: 'neutral',
          }));
          break;
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const movementControllerRef = useRef<DesktopMovementController | null>(null);
  const activeReminderIdRef = useRef<string | null>(null);
  const reminderQueueRef = useRef<QueuedReminder[]>([]);
  const presentReminderRef = useRef<((r: QueuedReminder) => void) | null>(null);

  // Clear the active reminder and present the next queued one (if any) after a short pause.
  // Returns true when another reminder is queued so callers can skip walk-home/hide.
  const finishActiveReminder = useCallback((delayMs: number) => {
    activeReminderIdRef.current = null;
    const next = reminderQueueRef.current.shift();
    if (next) {
      setTimeout(() => presentReminderRef.current?.(next), delayMs);
      return true;
    }
    return false;
  }, []);

  // Compute live character state label for the Interaction Menu header
  const characterStateLabel: CompanionStateLabel = (() => {
    if (controls.isGrabbed || controls.animationState === 'being_dragged') return 'Dragged';
    if (controls.animationState === 'falling' || controls.animationState === 'rising') return 'Falling';
    if (controls.animationState === 'landing' || controls.animationState === 'bouncing') return 'Landing';
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
    registerUserActivity();
    if (spawnState === 'active' && !isHidden && !movementControllerRef.current?.getIsOffScreen()) {
      if (goHome) {
        setIsPinned(false);
        movementControllerRef.current?.walkToHomeCorner();
      }
      return;
    }

    // When returning from hidden/offscreen state, position offscreen before showing
    if (!goHome && window.desktopAPI?.setWindowPosition && movementControllerRef.current) {
      const offX = movementControllerRef.current.getOffscreenX();
      const homeY = movementControllerRef.current.getHomeY();
      window.desktopAPI.setWindowPosition(offX, homeY);
    }

    window.desktopAPI?.showApp();
    setIsHidden(false);
    setSpawnState('active');

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
      movementControllerRef.current?.walkOnScreen(undefined, () => {
        setSpawnState('active');
      });
    }
  }, [spawnState, isHidden, registerUserActivity]);

  // IPC listeners are registered once; route them through the latest handlers
  const latestHandlersRef = useRef({ hide: handleHideAppu, show: handleShowAppu, triggerAction: handleTriggerAction });
  latestHandlersRef.current = { hide: handleHideAppu, show: handleShowAppu, triggerAction: handleTriggerAction };

  // While Appu is dragged the pointer can outrun the window; click-through must stay off
  // or the pointerup is lost and the drag never ends
  const isWindowDraggingRef = useRef(false);
  const isExpandedRef = useRef(false);
  useEffect(() => {
    if (!isCompanionMode) return;
    const onDragStart = () => {
      isWindowDraggingRef.current = true;
      window.desktopAPI?.setIgnoreMouseEvents(false);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!isWindowDraggingRef.current) return;
      isWindowDraggingRef.current = false;
      const target = e.target instanceof Element ? e.target : null;
      const overInteractive = target?.closest('.companion-character-hitbox, .companion-menu-anchor, .appu-summon-pill');
      if (!overInteractive && !isExpandedRef.current) {
        window.desktopAPI?.setIgnoreMouseEvents(true);
      }
    };
    window.addEventListener('appu-drag-start', onDragStart);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('appu-drag-start', onDragStart);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isCompanionMode]);

  // The AI's open_settings tool asks the renderer to show Preferences
  useEffect(() => {
    return window.desktopAPI?.ai?.onOpenSettings?.(() => {
      setIsChatOpen(false);
      setShowSettings(true);
    });
  }, []);

  // Studio (browser) mode: RemindersManager runs the scheduler, show its bubble here
  useEffect(() => {
    if (isCompanionMode) return;
    const present = (r: QueuedReminder) => {
      const targetReminderId = r.id || `rem_${Date.now()}`;
      if (activeReminderIdRef.current) {
        if (activeReminderIdRef.current !== targetReminderId && !reminderQueueRef.current.some((q) => q.id === targetReminderId)) {
          reminderQueueRef.current.push({ ...r, id: targetReminderId });
        }
        return;
      }
      activeReminderIdRef.current = targetReminderId;
      setReminder({ ...r, id: targetReminderId, actionText: r.actionText || 'Done' });
      latestHandlersRef.current.triggerAction('wave');
    };
    presentReminderRef.current = present;
    const manager = RemindersManager.getInstance();
    manager.setTriggerCallback(present);
    return () => {
      manager.setTriggerCallback(null);
      presentReminderRef.current = null;
    };
  }, [isCompanionMode]);

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

      // Sync persisted preferences (e.g. assistantName, isPinned, free-fall physics setting)
      if (window.desktopAPI?.storage) {
        window.desktopAPI.storage
          .getSettings()
          .then((s) => {
            if (s?.assistantName) {
              setAssistantName(s.assistantName);
            }
            if (typeof s?.isPinned === 'boolean') {
              setIsPinned(s.isPinned);
              movementControllerRef.current?.setIsPinned(s.isPinned);
            }
            if (typeof s?.freeFallEnabled === 'boolean') {
              setFreeFallEnabled(s.freeFallEnabled);
              movementControllerRef.current?.setFreeFallEnabled(s.freeFallEnabled);
            }
          })
          .catch(() => {});
      }

      const handleTriggerReminderEvent = (r: {
        id?: string;
        title: string;
        message?: string;
        actionText?: string;
        intervalMinutes?: number;
        specificTime?: string;
        type?: 'interval' | 'specific_time';
        recurrence?: ReminderRecurrence;
      }) => {
        registerUserActivity();
        const targetReminderId = r.id || `rem_${Date.now()}`;
        if (activeReminderIdRef.current) {
          if (activeReminderIdRef.current !== targetReminderId && !reminderQueueRef.current.some((q) => q.id === targetReminderId)) {
            reminderQueueRef.current.push({ ...r, id: targetReminderId });
          }
          return;
        }
        activeReminderIdRef.current = targetReminderId;

        const alreadyOnScreen =
          !isHiddenRef.current &&
          spawnStateRef.current !== 'hidden' &&
          !(movementControllerRef.current?.getIsOffScreen?.() ?? false);

        // Wake Appu window up
        window.desktopAPI?.showApp?.();
        setIsHidden(false);
        setSpawnState('active');

        const onArrivedPresentReminder = async () => {
          // If the user dismissed or snoozed while Appu was moving, abort presentation
          if (!activeReminderIdRef.current || activeReminderIdRef.current !== targetReminderId) {
            return;
          }
          if (window.desktopAPI?.getMenuPlacement) {
            try {
              const currentPlacement = await window.desktopAPI.getMenuPlacement();
              if (currentPlacement) {
                setMenuPlacement(currentPlacement);
              }
            } catch {}
          }
          window.desktopAPI?.setMenuOpen?.(true, 'menu');
          setReminder({
            id: targetReminderId,
            title: r.title,
            message: r.message,
            actionText: r.actionText || 'OK',
            intervalMinutes: r.intervalMinutes,
            specificTime: r.specificTime,
            type: r.type,
            recurrence: r.recurrence,
          });
          setControls((prev) => ({
            ...prev,
            animationState: 'wave',
            emotion: 'happy',
            rotation: 0,
          }));
        };

        if (alreadyOnScreen) {
          // Queued follow-ups: stay put and show the next bubble without a walk-in
          onArrivedPresentReminder();
          return;
        }

        // Position window offscreen to the right before walking in
        if (window.desktopAPI?.setWindowPosition && movementControllerRef.current) {
          const offX = movementControllerRef.current.getOffscreenX();
          const homeY = movementControllerRef.current.getHomeY();
          window.desktopAPI.setWindowPosition(offX, homeY);
        }

        // Smoothly walk onto screen from the side!
        movementControllerRef.current?.walkOnScreen(undefined, onArrivedPresentReminder);
      };

      presentReminderRef.current = handleTriggerReminderEvent;
      const unsubscribers: Array<(() => void) | undefined> = [];

      // Listen for incoming reminder triggers (from IPC)
      unsubscribers.push(window.desktopAPI?.onTriggerReminder((data: any) => {
        handleTriggerReminderEvent({
          id: data.id,
          title: data.title,
          message: data.message,
          actionText: data.actionText || 'Done',
          intervalMinutes: data.intervalMinutes,
          specificTime: data.specificTime,
          type: data.type,
          recurrence: data.recurrence,
        });
      }));
      // Backend holds due reminders until a listener is attached (avoids firing into a reloading page)
      window.desktopAPI?.ai?.notifyRemindersReady?.().catch(() => {});

      // Browser companion mode: the renderer scheduler is the only one running
      if (!window.desktopAPI?.onTriggerReminder) {
        RemindersManager.getInstance().setTriggerCallback((r) => {
          handleTriggerReminderEvent(r);
        });
      }

      // Left-Click on Appu mesh acknowledges/pats him without opening popup menus
      // Menu is exclusively toggled via Right-Click
      // Listen for adaptive menu placement updates from main process
      unsubscribers.push(window.desktopAPI?.onMenuPlacementChanged((placement: MenuPlacement) => {
        setMenuPlacement(placement);
      }));
      window.desktopAPI?.getMenuPlacement?.().then((p) => {
        if (p) setMenuPlacement(p);
      }).catch(() => {});

      // Automatically close menu when Appu begins being dragged
      const handleDragStart = () => {
        setIsMenuOpen(false);
        setIsActionsPanelOpen(false);
      };
      window.addEventListener('appu-drag-start', handleDragStart);

      // Listen for tray / shortcut menu toggle
      unsubscribers.push(window.desktopAPI?.onToggleMenu(() => {
        setIsMenuOpen((prev) => !prev);
      }));

      // Listen for smooth hide / show requests from Electron
      unsubscribers.push(window.desktopAPI?.onRequestHide?.(() => {
        latestHandlersRef.current.hide();
      }));

      unsubscribers.push(window.desktopAPI?.onRequestShow?.(() => {
        latestHandlersRef.current.show(false);
      }));

      // Listen for visibility change from tray
      unsubscribers.push(window.desktopAPI?.onVisibilityChanged((visible) => {
        if (!visible) {
          setIsHidden(true);
          setSpawnState('hidden');
          setIsMenuOpen(false);
          setIsActionsPanelOpen(false);
        } else {
          setIsHidden(false);
          setSpawnState('active');
        }
      }));

      // Listen for Right-Click Context Menu Actions
      unsubscribers.push(window.desktopAPI?.onContextAction((action: string) => {
        if (action === 'stick') {
          setIsPinned(true);
          movementControllerRef.current?.stickToEdge(() => setIsPinned(true));
        } else if (action === 'unstick') {
          setIsPinned(false);
          movementControllerRef.current?.unstick(() => setIsPinned(false));
        } else if (action === 'disappear') {
          latestHandlersRef.current.hide();
        } else if (action === 'reappear') {
          latestHandlersRef.current.show(false);
        } else if (action === 'go-home') {
          latestHandlersRef.current.show(true);
        } else if (action === 'wave' || action === 'sit' || action === 'sleep') {
          latestHandlersRef.current.triggerAction(action);
        }
      }));

      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe?.());
        presentReminderRef.current = null;
        window.removeEventListener('appu-drag-start', handleDragStart);
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

      // ⌘K to toggle Quick Appu Chat
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
        setIsMenuOpen(false);
        setIsActionsPanelOpen(false);
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isHidden, spawnState, handleHideAppu, handleShowAppu]);

  // Auto-Exit to off-screen after inactivity when "Stay on Screen" is OFF (!isPinned)
  useEffect(() => {
    if (!isCompanionMode) return;

    const interval = setInterval(() => {
      // 1. If pinned ("Stay on Screen" is ON), stay visible on screen
      if (isPinned) return;
      // 2. Already hidden, transitioning out, or actively exiting
      if (isHidden || spawnState === 'hidden' || spawnState === 'spawning_out' || isExitingRef.current) return;
      // 3. User is actively interacting with menus, dialogs, chat, or active reminder
      if (isMenuOpen || isActionsPanelOpen || showSettings || showRemindersModal || isChatOpen || Boolean(reminder)) return;
      // 4. In active movement or being dragged
      if (controls.isGrabbed || controls.animationState === 'walk' || controls.animationState === 'walking') return;

      const idleMs = Date.now() - lastActivityRef.current;
      // Inactivity timeout: 20 seconds
      if (idleMs >= 20000) {
        isExitingRef.current = true;
        movementControllerRef.current?.walkOffScreen(() => {
          isExitingRef.current = false;
          handleHideAppu();
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [
    isCompanionMode,
    isPinned,
    isHidden,
    spawnState,
    isMenuOpen,
    isActionsPanelOpen,
    showSettings,
    showRemindersModal,
    isChatOpen,
    reminder,
    controls.isGrabbed,
    controls.animationState,
    handleHideAppu,
  ]);

  // -------------------------------------------------------------
  // COMPANION MODE RENDER: Transparent, Frameless Desktop Widget
  // -------------------------------------------------------------
  if (isCompanionMode) {
    const isExpanded = isMenuOpen || isActionsPanelOpen || showSettings || showRemindersModal || isChatOpen || Boolean(reminder);
    isExpandedRef.current = isExpanded;

    return (
      <div
        className={`appu-desktop-companion-viewport ${
          isHidden ? 'appu-hidden' : ''
        } ${isExpanded ? 'menu-open' : 'menu-closed'} menu-h-${menuPlacement.horizontal} menu-v-${menuPlacement.vertical}`}
        onMouseMove={registerUserActivity}
        onClick={() => {
          registerUserActivity();
          if (isMenuOpen || isActionsPanelOpen) {
            setIsMenuOpen(false);
            setIsActionsPanelOpen(false);
          }
        }}
        onContextMenu={(e) => {
          registerUserActivity();
          e.preventDefault();
          setIsMenuOpen((prev) => !prev);
          setIsActionsPanelOpen(false);
        }}
        onMouseEnter={() => {
          registerUserActivity();
          // Let clicks pass through when over empty transparent space
          if (!isHidden && !isExpanded) {
            if (!isWindowDraggingRef.current) window.desktopAPI?.setIgnoreMouseEvents(true);
          }
        }}
      >
        {/* Sleek Summon Pill when Appu is Hidden */}
        {isHidden && (
          <button
            className="appu-summon-pill"
            onClick={(e) => {
              e.stopPropagation();
              registerUserActivity();
              window.desktopAPI?.setIgnoreMouseEvents(false);
              handleShowAppu(false);
            }}
            onMouseEnter={() => {
              registerUserActivity();
              window.desktopAPI?.setIgnoreMouseEvents(false);
            }}
            onMouseLeave={() => {
              window.desktopAPI?.setIgnoreMouseEvents(true);
            }}
            title={`Summon ${assistantName} back (or press ⌘H)`}
          >
            <span className="summon-icon">🤖</span>
            <span className="summon-text">{assistantName}</span>
          </button>
        )}

        {/* Left Side: 3D Character Canvas */}
        <div
          className={`companion-character-hitbox ${isPinned ? 'is-pinned' : ''} ${
            spawnState === 'spawning_in' ? 'spawning-in' : ''
          } ${spawnState === 'spawning_out' ? 'spawning-out' : ''} ${
            spawnState === 'hidden' || isHidden ? 'hidden-state' : ''
          }`}
          onMouseMove={registerUserActivity}
          onClick={(e) => {
            registerUserActivity();
            // Left-click closes menu if open, never opens it
            if (isMenuOpen || isActionsPanelOpen) {
              e.stopPropagation();
              setIsMenuOpen(false);
              setIsActionsPanelOpen(false);
            }
          }}
          onContextMenu={(e) => {
            registerUserActivity();
            // Strictly right-click opens the context menu
            e.preventDefault();
            e.stopPropagation();
            setIsMenuOpen((prev) => !prev);
            setIsActionsPanelOpen(false);
          }}
          onMouseEnter={() => {
            registerUserActivity();
            // Enable mouse interactions when hovering directly on Appu
            window.desktopAPI?.setIgnoreMouseEvents(false);
          }}
          onMouseLeave={() => {
            // Restore click-through when mouse moves away unless menu is open
            if (!isExpanded) {
              if (!isWindowDraggingRef.current) window.desktopAPI?.setIgnoreMouseEvents(true);
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
          onMouseMove={registerUserActivity}
          onMouseEnter={() => {
            registerUserActivity();
            window.desktopAPI?.setIgnoreMouseEvents(false);
          }}
          onMouseLeave={() => {
            if (!isExpanded) {
              if (!isWindowDraggingRef.current) window.desktopAPI?.setIgnoreMouseEvents(true);
            }
          }}
        >
          <InteractionMenu
            isOpen={isMenuOpen && !isHidden}
            onClose={() => setIsMenuOpen(false)}
            characterState={characterStateLabel}
            assistantName={assistantName}
            isPinned={isPinned}
            onTogglePin={handleTogglePin}
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
              setIsActionsPanelOpen(false);
              setShowRemindersModal(true);
            }}
            onOpenQuickAppu={() => {
              setIsMenuOpen(false);
              setIsActionsPanelOpen(false);
              setReminder(null);
              setIsChatOpen(true);
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

        {/* Floating Quick Appu AI Chat Window */}
        <QuickAppuChat
          isOpen={isChatOpen && !isHidden}
          onClose={() => setIsChatOpen(false)}
          assistantName={assistantName}
          onOpenSettings={() => {
            setIsChatOpen(false);
            setShowSettings(true);
          }}
        />

        {/* Preferences / Settings Modal */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
          freeFallEnabled={freeFallEnabled}
          onToggleFreeFall={handleToggleFreeFall}
          updaterStatus={updaterStatus}
          onAssistantNameChange={setAssistantName}
        />

        {/* Reminders Management Modal */}
        <RemindersModal
          isOpen={showRemindersModal}
          onClose={() => setShowRemindersModal(false)}
        />

        {/* Floating Notification Speech Bubble beside Appu (Top layer) */}
        {reminder && !isHidden && (
          <ReminderBubble
            id={reminder.id}
            title={reminder.title}
            message={reminder.message}
            intervalMinutes={reminder.intervalMinutes}
            specificTime={reminder.specificTime}
            type={reminder.type}
            recurrence={reminder.recurrence}
            actionText={reminder.actionText || 'OK'}
            autoDismissSeconds={0}
            side={menuPlacement.horizontal === 'left' ? 'left' : 'right'}
            onAction={() => {
              // The scheduler already advanced/completed this reminder when it fired
              registerUserActivity();
              setReminder(null);
              setIsMenuOpen(false);
              setIsActionsPanelOpen(false);
              // Keep Appu on-screen when another reminder is queued so the next
              // bubble can appear ~4s after dismiss (not 4s + walk-home + walk-in).
              const hasQueued = finishActiveReminder(4000);
              if (!hasQueued) {
                movementControllerRef.current?.dismissAndReturnHome('happy', () => {
                  handleHideAppu();
                });
              }
            }}
            onSnooze={(mins = 5) => {
              registerUserActivity();
              const remId = reminder.id;
              if (remId && remId !== 'status_check') {
                RemindersManager.getInstance().snoozeReminder(remId, mins);
              }
              setReminder(null);
              setIsMenuOpen(false);
              setIsActionsPanelOpen(false);
              const hasQueued = finishActiveReminder(4000);
              if (!hasQueued) {
                movementControllerRef.current?.dismissAndReturnHome('sad', () => {
                  handleHideAppu();
                });
              }
            }}
            onDismiss={() => {
              registerUserActivity();
              setReminder(null);
              setIsMenuOpen(false);
              setIsActionsPanelOpen(false);
              const hasQueued = finishActiveReminder(4000);
              if (!hasQueued) {
                movementControllerRef.current?.dismissAndReturnHome('happy', () => {
                  handleHideAppu();
                });
              }
            }}
          />
        )}
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
            <span className="brand-heading">{assistantName}</span>
            <span className="brand-sub">3D AI Assistant Character</span>
          </div>
        </div>

        {/* Desktop window controls (minimize, maximize, close) */}
        <div className="window-actions">
          {/* Interaction Menu Toggle Button for Browser Studio */}
          <button
            className={`companion-mode-launcher-btn ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            title={`Open ${assistantName} Desktop Interaction Menu`}
            aria-label="Interaction Menu"
          >
            <MenuIcon size={13} className="text-gold" />
            <span>Interaction Menu</span>
          </button>

          {/* Actions & Poses Panel Launcher */}
          <button
            className={`companion-mode-launcher-btn ${isActionsPanelOpen ? 'active' : ''}`}
            onClick={() => setIsActionsPanelOpen((prev) => !prev)}
            title="Open Actions & Poses Panel"
            aria-label="Actions & Poses"
          >
            <Play size={12} className="text-gold" fill="#f6c344" />
            <span>Actions & Poses</span>
          </button>

          {/* Developer-only Reminder simulation — never ship in production builds */}
          {import.meta.env.DEV && (
            <button
              className="companion-mode-launcher-btn"
              onClick={() => {
                setReminder(
                  reminder
                    ? null
                    : {
                        title: 'Drink Water & Take a Stretch',
                        intervalMinutes: 45,
                        type: 'interval',
                        actionText: 'Got It!',
                      }
                );
              }}
              title="Toggle Reminder Bubble Simulation (Dev Only)"
              aria-label="Test Reminder"
            >
              <Bell size={13} className="text-gold" />
              <span>Test Reminder</span>
            </button>
          )}

          {/* Appu AI Chat Launcher */}
          <button
            className={`companion-mode-launcher-btn ${isChatOpen ? 'active' : ''}`}
            onClick={() => setIsChatOpen((prev) => !prev)}
            title="Open Appu AI Chat (⌘K)"
            aria-label="Chat"
          >
            <Sparkles size={13} className="text-gold" />
            <span>Chat</span>
          </button>

          {/* Preferences / Settings Modal Launcher */}
          <button
            className="companion-mode-launcher-btn"
            onClick={() => setShowSettings(true)}
            title="Open Appu Preferences & Software Updates"
            aria-label="Preferences"
          >
            <Sliders size={13} className="text-gold" />
            <span>Preferences</span>
          </button>

          {/* Studio is browser-only — decorative window chrome has no BrowserWindow to drive */}
        </div>
      </header>

      {/* Main Studio Body: Sidebar on Left, 3D Canvas in Center, Floating Card on Right */}
      <div className="studio-main-body">
        {/* Fullscreen 3D Viewport with Appu on the illuminated gold pedestal */}
        <div className="canvas-stage">
          {reminder && (
            <div className="studio-bubble-wrapper">
              <ReminderBubble
                id={reminder.id}
                title={reminder.title}
                message={reminder.message}
                intervalMinutes={reminder.intervalMinutes}
                specificTime={reminder.specificTime}
                type={reminder.type}
                actionText={reminder.actionText || 'Done'}
                autoDismissSeconds={0}
                side="right"
                recurrence={reminder.recurrence}
                onAction={() => {
                  handleTriggerAction('cheer');
                  setReminder(null);
                  finishActiveReminder(1500);
                }}
                onSnooze={(mins = 5) => {
                  if (reminder.id && reminder.id !== 'status_check') {
                    RemindersManager.getInstance().snoozeReminder(reminder.id, mins);
                  }
                  handleTriggerAction('sad');
                  setReminder(null);
                  finishActiveReminder(1500);
                }}
                onDismiss={() => {
                  setReminder(null);
                  finishActiveReminder(1500);
                }}
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
              assistantName={assistantName}
              isPinned={isPinned}
              onTogglePin={handleTogglePin}
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
              onOpenReminders={() => {
                setIsMenuOpen(false);
                setIsActionsPanelOpen(false);
                setShowRemindersModal(true);
              }}
              onOpenSettings={() => {
                setShowSettings(true);
              }}
              onOpenQuickAppu={() => {
                setIsMenuOpen(false);
                setIsActionsPanelOpen(false);
                setIsChatOpen(true);
              }}
              onQuitAppu={() => {
                if (window.desktopAPI?.quitApp) {
                  window.desktopAPI.quitApp();
                  return;
                }
                window.close();
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
            <span>Click {assistantName} for Menu • Drag to move • Press ⌘0 / ⌘H to summon back to screen</span>
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
        onTogglePin={handleTogglePin}
        freeFallEnabled={freeFallEnabled}
        onToggleFreeFall={handleToggleFreeFall}
        updaterStatus={updaterStatus}
        onAssistantNameChange={setAssistantName}
      />

      {/* Reminders Management Modal */}
      <RemindersModal
        isOpen={showRemindersModal}
        onClose={() => setShowRemindersModal(false)}
      />

      {/* Floating Quick Appu AI Chat Window */}
      <QuickAppuChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        assistantName={assistantName}
        onOpenSettings={() => {
          setIsChatOpen(false);
          setShowSettings(true);
        }}
      />
    </div>
  );
};

export default App;
