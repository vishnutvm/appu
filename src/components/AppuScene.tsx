import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { CharacterControlState, AppuAnimationState, AppuEmotion } from '../types/character';
import { AppuCharacter } from './AppuCharacter';
import { CharacterTransformController } from '../controllers/CharacterTransformController';
import { CharacterRotationController } from '../controllers/CharacterRotationController';
import { CharacterMovementController } from '../controllers/CharacterMovementController';
import { CharacterCameraController } from '../controllers/CharacterCameraController';
import { CharacterBehaviourController } from '../controllers/CharacterBehaviourController';
import { CharacterAnimationController, SkeletalRefs } from '../controllers/CharacterAnimationController';
import { CharacterCollisionController } from '../controllers/CharacterCollisionController';
import { CharacterReactionController } from '../controllers/CharacterReactionController';
import { CharacterEmotionController, EmotionPriority } from '../controllers/CharacterEmotionController';
import { CharacterInteractionController } from '../controllers/CharacterInteractionController';
import { AppuActionRegistry } from '../controllers/AppuActionRegistry';
import { AppuActionId } from '../types/actions';

interface AppuSceneProps {
  controls: CharacterControlState;
  onControlsChange: React.Dispatch<React.SetStateAction<CharacterControlState>>;
  isMenuOpen?: boolean;
  menuSide?: 'left' | 'right';
  spawnState?: 'spawning_in' | 'active' | 'spawning_out' | 'hidden';
  onSpawnComplete?: () => void;
  onDespawnComplete?: () => void;
}

let appuAudioCtx: AudioContext | null = null;
const getAppuAudioContext = (): AudioContext | null => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!appuAudioCtx || appuAudioCtx.state === 'closed') {
      appuAudioCtx = new AudioCtx();
    }
    if (appuAudioCtx.state === 'suspended') {
      appuAudioCtx.resume().catch(() => {});
    }
    return appuAudioCtx;
  } catch {
    return null;
  }
};

const playSpawnChime = (type: 'in' | 'out') => {
  try {
    const ctx = getAppuAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'in') {
      // Cheerful multi-tone bootup greeting chime (C5 -> E5 -> G5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.17);

      osc2.frequency.setValueAtTime(261.63, now);
      osc2.frequency.exponentialRampToValueAtTime(329.63, now + 0.17);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.29);
      osc2.stop(now + 0.29);
    } else {
      // Gentle descending power-down blip (E5 -> C5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.18);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    }
  } catch (_e) {
    // Audio context may be restricted before interaction
  }
};

const playTactileBumpSound = (intensity: number = 0.5) => {
  try {
    const ctx = getAppuAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Deep tactile impact drop from 130Hz to 38Hz in 80ms
    osc.frequency.setValueAtTime(130, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(36, ctx.currentTime + 0.08);

    const volume = Math.min(0.25, 0.08 + (intensity / 10) * 0.12);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.085);
  } catch (_e) {
    // Ignore if audio permissions blocked before user interaction
  }
};


const DRAG_START_THRESHOLD_PX = 4;

// In desktop mode these are driven by DesktopMovementController (window walking / free-fall)
const DESKTOP_OWNED_STATES = new Set<AppuAnimationState>([
  'walk',
  'walking',
  'turning',
  'arriving',
  'being_dragged',
  'released',
  'rising',
  'falling',
  'landing',
  'bouncing',
  'recovering',
]);

export const AppuScene: React.FC<AppuSceneProps> = ({
  controls,
  onControlsChange,
  isMenuOpen = false,
  menuSide = 'left',
  spawnState = 'active',
  onSpawnComplete,
  onDespawnComplete,
}) => {
  const { camera, gl } = useThree();

  // Spawn interpolation tracking
  const spawnProgressRef = useRef(spawnState === 'hidden' ? 0.0 : 1.0);
  const prevSpawnStateRef = useRef(spawnState);

  // Portal Ring 3D refs for zero-rerender GPU animation
  const portalRingGroupRef = useRef<THREE.Group>(null);
  const portalPointLightRef = useRef<THREE.PointLight>(null);
  const portalOuterRingRef = useRef<THREE.MeshBasicMaterial>(null);
  const portalInnerRingRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    if (spawnState === 'spawning_in' && prevSpawnStateRef.current !== 'spawning_in') {
      spawnProgressRef.current = 0.0;
      playSpawnChime('in');
    } else if (spawnState === 'spawning_out' && prevSpawnStateRef.current !== 'spawning_out') {
      playSpawnChime('out');
    }
    prevSpawnStateRef.current = spawnState;
  }, [spawnState]);

  // Menu open animation & gaze reaction
  const menuGazeTimerRef = useRef(0);
  const prevMenuOpenRef = useRef(isMenuOpen);

  useEffect(() => {
    if (isMenuOpen && !prevMenuOpenRef.current) {
      // Menu just opened: Appu is happy and looks toward the options for 3 seconds!
      menuGazeTimerRef.current = 3.0;
      emotionCtrl.current.triggerEmotion('happy', 3.0, EmotionPriority.INTERACTION);
      onControlsChange((prev) => ({ ...prev, emotion: 'happy' }));
    }
    prevMenuOpenRef.current = isMenuOpen;
  }, [isMenuOpen, onControlsChange]);

  // 1. Controller Instances
  const transformCtrl = useRef(new CharacterTransformController());
  const rotationCtrl = useRef(new CharacterRotationController());
  const movementCtrl = useRef(new CharacterMovementController());
  const cameraCtrl = useRef(new CharacterCameraController());
  const animationCtrl = useRef(new CharacterAnimationController());
  const collisionCtrl = useRef(new CharacterCollisionController());
  const reactionCtrl = useRef(new CharacterReactionController());
  const emotionCtrl = useRef(new CharacterEmotionController(controls.emotion));
  const interactionCtrl = useRef(new CharacterInteractionController());

  // 2. Skeletal Joint References
  const rootGroupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const leftArmGroupRef = useRef<THREE.Group>(null);
  const rightArmGroupRef = useRef<THREE.Group>(null);
  const leftForearmGroupRef = useRef<THREE.Group>(null);
  const rightForearmGroupRef = useRef<THREE.Group>(null);
  const leftLegGroupRef = useRef<THREE.Group>(null);
  const rightLegGroupRef = useRef<THREE.Group>(null);
  const leftLowerLegGroupRef = useRef<THREE.Group>(null);
  const rightLowerLegGroupRef = useRef<THREE.Group>(null);

  // 3. Pointer & Interaction State Tracking
  const dragModeRef = useRef<'none' | 'grab' | 'stage_yaw'>('none');
  const pointerLastXRef = useRef(0);
  const pointerLastScreenRef = useRef({ x: 0, y: 0 });
  const pointerHistoryRef = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const dragStartedRef = useRef(false);
  const physicsDeformRef = useRef<{
    squashFactor: { x: number; y: number };
    tiltAngle: number;
    verticalVel: number;
  }>({
    squashFactor: { x: 0, y: 0 },
    tiltAngle: 0,
    verticalVel: 0,
  });
  const mouseNdcRef = useRef({ x: 0, y: 0 });
  const mouseSmoothRef = useRef({ x: 0, y: 0 });
  const lastUserAnimRef = useRef<AppuAnimationState>(controls.animationState);
  const lastPresetRef = useRef(controls.presetView);
  const lastZoomRef = useRef(controls.zoom);

  // Visual contact impact flash ref
  const [impactFlash, setImpactFlash] = useState<{ active: boolean; pos: THREE.Vector3 }>({
    active: false,
    pos: new THREE.Vector3(),
  });

  // 4. Blinking state
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkProgress, setBlinkProgress] = useState(0);
  const blinkTimerRef = useRef(0);
  const nextBlinkIntervalRef = useRef(3.0);

  // 5. Shadow position tracking (ground level aligned with boot soles at -0.875)
  const shadowGroupRef = useRef<THREE.Group>(null);

  // 6. Behaviour Controller Instance
  const behaviourCtrl = useRef(
    new CharacterBehaviourController({
      onStateChange: (newState) => {
        // Controller-originated; the UI-sync effect below must not re-trigger it
        lastUserAnimRef.current = newState;
        onControlsChange((prev) => ({ ...prev, animationState: newState }));
      },
      onEmotionChange: (newEmotion) => {
        onControlsChange((prev) => ({ ...prev, emotion: newEmotion }));
      },
    })
  );

  // Emotions the controller itself emitted come back via controls.emotion; they must
  // not become the new baseline or temporary reactions would stick forever
  const controllerEmotionRef = useRef<AppuEmotion | null>(null);

  // Wire controllers together on mount
  useEffect(() => {
    emotionCtrl.current.setCallback((newEmotion) => {
      controllerEmotionRef.current = newEmotion;
      onControlsChange((prev) => ({ ...prev, emotion: newEmotion }));
    });

    reactionCtrl.current.setCallbacks({
      onEmotionTrigger: (emo, dur) => {
        emotionCtrl.current.triggerNamedEmotion(emo, dur);
      },
      onStateTrigger: (st, dur) => {
        behaviourCtrl.current.setState(st, undefined, dur);
      },
      onAudioImpact: (speed) => {
        playTactileBumpSound(speed);
      },
    });

    behaviourCtrl.current.setControllers(
      emotionCtrl.current,
      reactionCtrl.current,
      collisionCtrl.current
    );

    // Setup interaction callbacks
    interactionCtrl.current.setCallbacks({
      onDragStart: () => {
        behaviourCtrl.current.onDragStart();
        onControlsChange((prev) => ({ ...prev, isGrabbed: true }));
      },
      onDragUpdate: (rawTarget: THREE.Vector3, velocity: THREE.Vector3) => {
        if (controls.transparentBackground && window.desktopAPI?.moveWindowBy) {
          // In companion mode, window moves
          transformCtrl.current.setPosition(0, 0, 0);
        } else {
          // Check collision against obstacles or boundaries
          if (controls.collisionReactions) {
            const col = collisionCtrl.current.testCollision(rawTarget, velocity);
            if (col.hasCollision && col.impactSpeed > 0.4) {
              reactionCtrl.current.triggerImpact(col.normal, col.impactSpeed);
              behaviourCtrl.current.onCollision(col.impactSpeed);

              setImpactFlash({
                active: true,
                pos: col.contactPoint.clone(),
              });
              setTimeout(() => {
                setImpactFlash((f) => ({ ...f, active: false }));
              }, 250);
            }
          }

          // Resolve position so Appu slides smoothly along boundaries/obstacles
          const resolved = collisionCtrl.current.resolvePosition(rawTarget);
          transformCtrl.current.setPosition(resolved.position.x, 0, resolved.position.z);
        }
      },
      onDragEnd: (releaseVelocity?: THREE.Vector3) => {
        behaviourCtrl.current.onDragEnd(releaseVelocity);
        onControlsChange((prev) => ({ ...prev, isGrabbed: false }));
      },
      onPettingStart: () => {
        if (controls.pettingEnabled) {
          behaviourCtrl.current.onPettingStart();
          onControlsChange((prev) => ({ ...prev, isPetting: true }));
        }
      },
      onPettingUpdate: () => {
        // Petting active
      },
      onPettingEnd: () => {
        behaviourCtrl.current.onPettingEnd();
        onControlsChange((prev) => ({ ...prev, isPetting: false }));
      },
      onTapAcknowledge: () => {
        behaviourCtrl.current.onTapAcknowledge();
        window.dispatchEvent(new CustomEvent('appu-clicked-by-user'));
      },
    });
  }, [controls.collisionReactions, controls.pettingEnabled, controls.transparentBackground, onControlsChange]);

  // Sync sensitivity and intensity settings
  useEffect(() => {
    reactionCtrl.current.setIntensity(controls.reactionIntensity);
    movementCtrl.current.setSensitivity(controls.movementSensitivity);
    interactionCtrl.current.setPettingEnabled(controls.pettingEnabled);
  }, [controls.reactionIntensity, controls.movementSensitivity, controls.pettingEnabled]);

  // Sync emotion changes directly from UI buttons
  useEffect(() => {
    if (controls.emotion === controllerEmotionRef.current) return;
    emotionCtrl.current.setBaselineEmotion(controls.emotion);
    emotionCtrl.current.reset();
  }, [controls.emotion]);

  // Sync autonomous roaming on the desktop companion
  useEffect(() => {
    if (controls.transparentBackground) {
      behaviourCtrl.current.setAutonomous(false);
      transformCtrl.current.setPosition(0, 0, 0);
    } else {
      behaviourCtrl.current.setAutonomous(true);
    }
  }, [controls.transparentBackground]);

  // Sync character rotation (from controls/DesktopMovementController)
  useEffect(() => {
    rotationCtrl.current.setTargetYaw(controls.rotation);
  }, [controls.rotation]);

  // Listen to UI-driven animation state changes (menu / actions panel)
  useEffect(() => {
    if (controls.animationState !== lastUserAnimRef.current) {
      lastUserAnimRef.current = controls.animationState;
      if (controls.animationState === 'walk' || controls.animationState === 'walking') {
        if (!controls.transparentBackground) {
          const targetX = (Math.random() * 2 - 1) * 1.3;
          const targetZ = (Math.random() * 2 - 1) * 0.65;
          const currentPos = transformCtrl.current.getPosition();
          behaviourCtrl.current.startWalkTo(targetX, targetZ, rotationCtrl.current, movementCtrl.current, currentPos);
        } else {
          behaviourCtrl.current.setState('walking');
        }
      } else if (AppuActionRegistry.getById(controls.animationState)) {
        behaviourCtrl.current.triggerAction(controls.animationState as AppuActionId);
      } else {
        behaviourCtrl.current.setState(controls.animationState);
      }
    }
  }, [controls.animationState, controls.transparentBackground]);

  // Listen for direct action triggers via window events
  useEffect(() => {
    const handleTriggerAction = (e: any) => {
      const actId = e.detail?.actionId as AppuActionId;
      if (actId) {
        behaviourCtrl.current.triggerAction(actId);
      }
    };
    const handleStandUp = () => {
      behaviourCtrl.current.standUp();
    };

    window.addEventListener('appu-trigger-action', handleTriggerAction);
    window.addEventListener('appu-stand-up', handleStandUp);

    return () => {
      window.removeEventListener('appu-trigger-action', handleTriggerAction);
      window.removeEventListener('appu-stand-up', handleStandUp);
    };
  }, []);

  // Sync camera preset button changes
  useEffect(() => {
    if (controls.presetView !== lastPresetRef.current) {
      lastPresetRef.current = controls.presetView;
      cameraCtrl.current.setPreset(controls.presetView);
    }
  }, [controls.presetView]);

  // Sync camera zoom slider changes
  useEffect(() => {
    if (Math.abs(controls.zoom - lastZoomRef.current) > 0.05) {
      lastZoomRef.current = controls.zoom;
      cameraCtrl.current.setDistance(controls.zoom);
    }
  }, [controls.zoom]);

  // Screen Edge Collision Bump Feedback
  const lastBumpTimeRef = useRef(0);
  useEffect(() => {
    if (window.desktopAPI?.onScreenEdgeBump) {
      window.desktopAPI.onScreenEdgeBump((data) => {
        const now = performance.now();
        if (now - lastBumpTimeRef.current > 300) {
          lastBumpTimeRef.current = now;
          playTactileBumpSound(data.impactSpeed);
          const norm = new THREE.Vector3(
            data.edge === 'left' ? 1 : data.edge === 'right' ? -1 : 0,
            0,
            data.edge === 'top' ? 1 : data.edge === 'bottom' ? -1 : 0
          );
          reactionCtrl.current.triggerImpact(norm, data.impactSpeed);
        }
      });
    }

    // Listen for physics engine deformation events
    const handlePhysicsDeformation = (e: any) => {
      if (e.detail) {
        physicsDeformRef.current = e.detail;
      }
    };
    window.addEventListener('appu-physics-deformation', handlePhysicsDeformation);
    return () => {
      window.removeEventListener('appu-physics-deformation', handlePhysicsDeformation);
    };
  }, []);

  // Listen for reset behaviour event
  useEffect(() => {
    const handleReset = () => {
      behaviourCtrl.current.reset();
      reactionCtrl.current.reset();
      emotionCtrl.current.reset();
      transformCtrl.current.setPosition(0, 0, 0);
      rotationCtrl.current.setTargetYaw(0);
      movementCtrl.current.stop();
      onControlsChange((prev) => ({
        ...prev,
        animationState: 'idle',
        emotion: 'happy',
        isGrabbed: false,
        isPetting: false,
        rotation: 0,
        worldPosition: [0, 0, 0],
      }));
    };
    window.addEventListener('appu-reset-behaviour', handleReset);
    return () => window.removeEventListener('appu-reset-behaviour', handleReset);
  }, [onControlsChange]);

  // 7. Setup Pointer & Wheel Interaction Listeners
  useEffect(() => {
    const dom = gl.domElement;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraCtrl.current.handleWheelZoom(e.deltaY);
      lastZoomRef.current = cameraCtrl.current.getDistance();
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      mouseNdcRef.current.x = (clientX / rect.width) * 2 - 1;
      mouseNdcRef.current.y = -(clientY / rect.height) * 2 + 1;

      if (dragModeRef.current === 'grab') {
        if (!dragStartedRef.current) {
          const moved = Math.hypot(e.screenX - pointerLastScreenRef.current.x, e.screenY - pointerLastScreenRef.current.y);
          if (moved < DRAG_START_THRESHOLD_PX) return;
          // Only a real drag interrupts walking / physics; a click must not
          dragStartedRef.current = true;
          window.dispatchEvent(new CustomEvent('appu-drag-start'));
        }
        const screenDx = Math.round(e.screenX - pointerLastScreenRef.current.x);
        const screenDy = Math.round(e.screenY - pointerLastScreenRef.current.y);

        pointerHistoryRef.current.push({ x: e.screenX, y: e.screenY, time: performance.now() });
        if (pointerHistoryRef.current.length > 8) {
          pointerHistoryRef.current.shift();
        }

        if (controls.transparentBackground && window.desktopAPI?.moveWindowBy) {
          pointerLastScreenRef.current.x = e.screenX;
          pointerLastScreenRef.current.y = e.screenY;
          if (screenDx !== 0 || screenDy !== 0) {
            window.desktopAPI.moveWindowBy(screenDx, screenDy);
          }
        }

        interactionCtrl.current.handlePointerMove(
          mouseNdcRef.current,
          { x: e.clientX, y: e.clientY },
          camera,
          transformCtrl.current.getPosition(),
          0.016
        );
      } else if (dragModeRef.current === 'stage_yaw') {
        const deltaX = e.clientX - pointerLastXRef.current;
        pointerLastXRef.current = e.clientX;
        const yawSensitivity = 0.0075;
        rotationCtrl.current.addYawDelta(deltaX * yawSensitivity);
      } else {
        // Hover move: test petting
        interactionCtrl.current.handlePointerMove(
          mouseNdcRef.current,
          { x: e.clientX, y: e.clientY },
          camera,
          transformCtrl.current.getPosition(),
          0.016
        );
      }
    };

    const handlePointerUp = () => {
      if (dragModeRef.current === 'grab') {
        const res = interactionCtrl.current.handlePointerUp();

        // Calculate release velocity from the last 80ms of pointer motion
        let releaseScreenVx = 0;
        let releaseScreenVy = 0;
        const now = performance.now();
        const recent = pointerHistoryRef.current.filter((pt) => now - pt.time <= 80);
        if (recent.length >= 2) {
          const first = recent[0];
          const last = recent[recent.length - 1];
          // Only compute velocity if pointer was actively moving right before release (< 40ms)
          if (now - last.time <= 40) {
            const dt = (last.time - first.time) / 1000;
            if (dt > 0.008) {
              releaseScreenVx = (last.x - first.x) / dt;
              releaseScreenVy = (last.y - first.y) / dt;
            }
          }
        }
        pointerHistoryRef.current = [];

        if (controls.transparentBackground) {
          if (dragStartedRef.current) {
            onControlsChange((prev) => ({
              ...prev,
              animationState: 'idle',
              emotion: 'happy',
              isGrabbed: false,
            }));
            window.dispatchEvent(
              new CustomEvent('appu-released-with-velocity', {
                detail: { vx: releaseScreenVx, vy: releaseScreenVy },
              })
            );
          } else {
            onControlsChange((prev) => ({ ...prev, isGrabbed: false }));
          }
        }
        if (res.isClick && !dragStartedRef.current) {
          window.dispatchEvent(new CustomEvent('appu-click-released'));
        }
        dragStartedRef.current = false;
      }
      dragModeRef.current = 'none';
      dom.style.cursor = 'default';
    };

    dom.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      dom.removeEventListener('wheel', handleWheel);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [camera, gl.domElement, controls.transparentBackground, onControlsChange]);

  // Pointer grab on Appu mesh
  const handleAppuPointerDown = (e: any) => {
    // Only accept left-click (button 0). Never intercept right-click (button 2).
    if (e.button !== 0 || (e.nativeEvent && e.nativeEvent.button !== 0)) {
      return;
    }
    e.stopPropagation();
    dragModeRef.current = 'grab';
    gl.domElement.style.cursor = 'grabbing';

    pointerLastScreenRef.current.x = e.screenX;
    pointerLastScreenRef.current.y = e.screenY;
    pointerHistoryRef.current = [{ x: e.screenX, y: e.screenY, time: performance.now() }];
    dragStartedRef.current = false;

    const rect = gl.domElement.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const ndc = {
      x: (clientX / rect.width) * 2 - 1,
      y: -(clientY / rect.height) * 2 + 1,
    };

    interactionCtrl.current.handlePointerDown(
      ndc,
      { x: e.clientX, y: e.clientY },
      camera,
      transformCtrl.current.getPosition()
    );
  };

  // Stage yaw handler on empty background
  const handleStagePointerDown = (e: any) => {
    // Only accept left-click (button 0)
    if (e.button !== 0 || (e.nativeEvent && e.nativeEvent.button !== 0)) {
      return;
    }
    dragModeRef.current = 'stage_yaw';
    pointerLastXRef.current = e.clientX;
    gl.domElement.style.cursor = 'ew-resize';
  };

  // 8. Main Unified Animation & Movement Loop
  useFrame((state, delta) => {
    if (!controls.isPlaying) return;

    const dt = Math.min(delta, 0.05) * controls.animationSpeed;
    const time = state.clock.getElapsedTime() * controls.animationSpeed;

    // A. Controller updates
    reactionCtrl.current.update(dt);
    emotionCtrl.current.update(dt);
    interactionCtrl.current.update(dt);

    // B. Eye Gaze tracking interpolation
    if (menuGazeTimerRef.current > 0) {
      menuGazeTimerRef.current -= dt;
      // Look towards the options menu when opened
      const menuGazeX = menuSide === 'left' ? -0.58 : 0.58;
      const menuGazeY = 0.14;
      mouseSmoothRef.current.x = THREE.MathUtils.lerp(mouseSmoothRef.current.x, menuGazeX, dt * 6.5);
      mouseSmoothRef.current.y = THREE.MathUtils.lerp(mouseSmoothRef.current.y, menuGazeY, dt * 6.5);
    } else if (controls.lookAtMouse) {
      mouseSmoothRef.current.x = THREE.MathUtils.lerp(mouseSmoothRef.current.x, mouseNdcRef.current.x, dt * 7.0);
      mouseSmoothRef.current.y = THREE.MathUtils.lerp(mouseSmoothRef.current.y, mouseNdcRef.current.y, dt * 7.0);
    } else {
      mouseSmoothRef.current.x = THREE.MathUtils.lerp(mouseSmoothRef.current.x, 0, dt * 4.0);
      mouseSmoothRef.current.y = THREE.MathUtils.lerp(mouseSmoothRef.current.y, 0, dt * 4.0);
    }

    // C. Autonomous Blinking logic
    if (controls.autoBlink) {
      blinkTimerRef.current += dt;
      if (blinkTimerRef.current >= nextBlinkIntervalRef.current) {
        setIsBlinking(true);
        const blinkProgressVal = Math.sin(((blinkTimerRef.current - nextBlinkIntervalRef.current) / 0.16) * Math.PI);
        setBlinkProgress(Math.max(0, blinkProgressVal));

        if (blinkTimerRef.current >= nextBlinkIntervalRef.current + 0.16) {
          setIsBlinking(false);
          setBlinkProgress(0);
          blinkTimerRef.current = 0;
          nextBlinkIntervalRef.current = 2.4 + Math.random() * 3.2;
        }
      }
    }

    // D. Autonomous Behaviour & State Machine Update
    const isGrabbed = interactionCtrl.current.getIsDragging() || controls.isGrabbed;
    if (!controls.transparentBackground) {
      behaviourCtrl.current.update(
        dt,
        transformCtrl.current,
        rotationCtrl.current,
        movementCtrl.current
      );
    } else {
      // Desktop mode: the window itself walks/falls (DesktopMovementController owns those
      // states); everything else (actions, taps, wake-up) still needs its timers ticked
      if (!DESKTOP_OWNED_STATES.has(behaviourCtrl.current.getState())) {
        behaviourCtrl.current.update(dt, transformCtrl.current, rotationCtrl.current, movementCtrl.current);
      }
      transformCtrl.current.setPosition(0, 0, 0);
    }

    // E. Physics Movement Update
    let currentSpeed = 0;
    const isWalking = controls.animationState === 'walk' || controls.animationState === 'walking';
    const canMoveForward = behaviourCtrl.current.getState() === 'walking' || isWalking;

    if (!isGrabbed && !controls.transparentBackground) {
      const moveResult = movementCtrl.current.update(
        dt,
        transformCtrl.current.getPosition(),
        canMoveForward,
        collisionCtrl.current
      );
      currentSpeed = moveResult.speed;

      if (moveResult.isMoving) {
        transformCtrl.current.setPosition(
          moveResult.newPosition.x,
          moveResult.newPosition.y,
          moveResult.newPosition.z
        );
        rotationCtrl.current.setFacingDirection(
          moveResult.targetDirection.x,
          moveResult.targetDirection.z
        );
      }
    } else if (controls.transparentBackground && isWalking) {
      currentSpeed = 0.72;
    } else if (isGrabbed) {
      // instantaneous speed while dragging for follow-through
      currentSpeed = Math.min(1.4, interactionCtrl.current.getDragVelocity().length());
    }

    // F. Yaw Rotation Update
    const rotResult = rotationCtrl.current.update(dt);

    // G. Camera Controller Update
    cameraCtrl.current.update(camera, dt, transformCtrl.current.getPosition());

    // H. Skeletal Animation Engine Update
    // Spawn progress delta-time damping
    if (spawnState === 'spawning_in') {
      spawnProgressRef.current = THREE.MathUtils.damp(spawnProgressRef.current, 1.0, 8.5, dt);
      if (spawnProgressRef.current >= 0.995) {
        spawnProgressRef.current = 1.0;
        onSpawnComplete?.();
      }
    } else if (spawnState === 'spawning_out') {
      spawnProgressRef.current = THREE.MathUtils.damp(spawnProgressRef.current, 0.0, 9.5, dt);
      if (spawnProgressRef.current <= 0.005) {
        spawnProgressRef.current = 0.0;
        onDespawnComplete?.();
      }
    } else if (spawnState === 'hidden') {
      spawnProgressRef.current = 0.0;
    } else {
      spawnProgressRef.current = 1.0;
    }

    const skeletalRefs: SkeletalRefs = {
      root: rootGroupRef.current,
      head: headGroupRef.current,
      leftArm: leftArmGroupRef.current,
      rightArm: rightArmGroupRef.current,
      leftForearm: leftForearmGroupRef.current,
      rightForearm: rightForearmGroupRef.current,
      leftLeg: leftLegGroupRef.current,
      rightLeg: rightLegGroupRef.current,
      leftLowerLeg: leftLowerLegGroupRef.current,
      rightLowerLeg: rightLowerLegGroupRef.current,
    };

    const deform = physicsDeformRef.current;
    const combinedSquash = {
      x: reactionCtrl.current.getSquash().x + deform.squashFactor.x,
      y: reactionCtrl.current.getSquash().y + deform.squashFactor.y,
    };

    const activeAnimState = controls.transparentBackground
      ? (isWalking ? 'walking' : controls.animationState)
      : behaviourCtrl.current.getState();

    animationCtrl.current.update(skeletalRefs, {
      state: activeAnimState,
      worldPosition: transformCtrl.current.getPosition(),
      yaw: rotResult.currentYaw,
      speed: currentSpeed,
      angularVelocity: rotResult.angularVelocity,
      isTurning: rotResult.isTurning,
      isGrabbed,
      isPetting: interactionCtrl.current.getIsPetting(),
      dragVelocity: interactionCtrl.current.getDragVelocity(),
      reactionRecoil: reactionCtrl.current.getRecoilOffset(),
      reactionHeadPitch: reactionCtrl.current.getHeadPitch(),
      reactionTorsoRoll: reactionCtrl.current.getTorsoRoll(),
      reactionSquash: combinedSquash,
      physicsTilt: deform.tiltAngle,
      physicsVerticalVel: deform.verticalVel,
      breathingEnabled: controls.breathingEnabled,
      lookAtTarget: mouseSmoothRef.current,
      lookAroundOffset: behaviourCtrl.current.getLookAroundOffset(),
      spawnProgress: spawnProgressRef.current,
      time,
      dt,
    });

    // I. Contact shadow position update (only when ground pedestal shadow is active)
    const curPos = transformCtrl.current.getPosition();
    if (controls.groundShadowEnabled && controls.showPedestal && !controls.transparentBackground) {
      shadowGroupRef.current?.position.set(curPos.x, 0, curPos.z);
    }

    // J. Portal ring zero-rerender GPU transform
    if (portalRingGroupRef.current) {
      const p = spawnProgressRef.current;
      const isTransitioning = p > 0.01 && p < 0.99;
      portalRingGroupRef.current.visible = isTransitioning;
      if (isTransitioning) {
        const ringIntensity = Math.sin(p * Math.PI);
        const ringScale = 0.4 + p * 0.75;
        portalRingGroupRef.current.position.set(curPos.x, -0.875, curPos.z);
        portalRingGroupRef.current.scale.set(ringScale, ringScale, ringScale);

        if (portalPointLightRef.current) {
          portalPointLightRef.current.intensity = ringIntensity * 3.5;
        }
        if (portalOuterRingRef.current) {
          portalOuterRingRef.current.opacity = ringIntensity * 0.85;
        }
        if (portalInnerRingRef.current) {
          portalInnerRingRef.current.opacity = ringIntensity * 0.6;
        }
      }
    }
  });

  return (
    <>
      {/* Invisible Interactive Ground & Stage Backdrop */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleStagePointerDown}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Studio Lighting Configurations */}
      {controls.lightingPreset === 'studio' && (
        <>
          <ambientLight intensity={0.75} color="#f0f5fa" />
          <directionalLight
            position={[2.8, 3.8, 3.2]}
            intensity={1.8}
            color="#ffffff"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0001}
          />
          <directionalLight
            position={[-2.8, 1.6, 2.4]}
            intensity={0.9}
            color="#e2ecf8"
          />
          <directionalLight
            position={[1.8, 2.8, -2.6]}
            intensity={2.2}
            color="#ffd670"
          />
          <directionalLight
            position={[-2.2, 1.0, -2.8]}
            intensity={0.8}
            color="#00e5ff"
          />
        </>
      )}

      {controls.lightingPreset === 'dramatic' && (
        <>
          <ambientLight intensity={0.3} color="#0d1b2a" />
          <directionalLight
            position={[3.5, 4.0, 2.0]}
            intensity={2.6}
            color="#ffffff"
            castShadow
          />
          <directionalLight
            position={[-3.0, 0.5, -2.5]}
            intensity={2.4}
            color="#00e5ff"
          />
        </>
      )}

      {controls.lightingPreset === 'warm' && (
        <>
          <ambientLight intensity={0.75} color="#fff4e6" />
          <directionalLight
            position={[2.5, 3.5, 3.0]}
            intensity={2.0}
            color="#fff0d4"
            castShadow
          />
          <directionalLight
            position={[-2.5, 1.5, 2.0]}
            intensity={1.0}
            color="#ffd89b"
          />
          <directionalLight
            position={[1.5, 2.5, -2.5]}
            intensity={2.2}
            color="#ffbb33"
          />
        </>
      )}

      {controls.lightingPreset === 'cyber' && (
        <>
          <ambientLight intensity={0.4} color="#051020" />
          <directionalLight
            position={[3.0, 3.0, 2.5]}
            intensity={1.8}
            color="#00e5ff"
            castShadow
          />
          <directionalLight
            position={[-3.0, 2.0, -2.0]}
            intensity={2.2}
            color="#ff0077"
          />
          <directionalLight
            position={[0, -2.0, 2.0]}
            intensity={1.0}
            color="#ffc83b"
          />
        </>
      )}

      {/* Appu Character with Pointer Grab and Articulated Joints */}
      <AppuCharacter
        rootRef={rootGroupRef}
        headRef={headGroupRef}
        leftArmRef={leftArmGroupRef}
        rightArmRef={rightArmGroupRef}
        leftForearmRef={leftForearmGroupRef}
        rightForearmRef={rightForearmGroupRef}
        leftLegRef={leftLegGroupRef}
        rightLegRef={rightLegGroupRef}
        leftLowerLegRef={leftLowerLegGroupRef}
        rightLowerLegRef={rightLowerLegGroupRef}
        emotion={controls.emotion}
        isBlinking={isBlinking}
        blinkProgress={blinkProgress}
        mouthOpen={0}
        eyeOffset={mouseSmoothRef.current}
        onPointerDown={handleAppuPointerDown}
      />

      {/* Collision Contact Visual Impact Flash */}
      {impactFlash.active && (
        <group position={[impactFlash.pos.x, impactFlash.pos.y + 0.45, impactFlash.pos.z]}>
          <pointLight color="#ffbb22" intensity={4.5} distance={1.2} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.08, 0.22, 32]} />
            <meshBasicMaterial color="#ffd54f" side={THREE.DoubleSide} transparent opacity={0.8} />
          </mesh>
        </group>
      )}

      {/* Holographic Ground Energy Rings during Spawn-In & Spawn-Out */}
      <group ref={portalRingGroupRef} visible={false} position={[0, -0.875, 0]}>
        <pointLight ref={portalPointLightRef} color="#f6c344" distance={1.4} intensity={0} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.32, 48]} />
          <meshBasicMaterial
            ref={portalOuterRingRef}
            color="#ffd54f"
            side={THREE.DoubleSide}
            transparent
            opacity={0}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.17, 48]} />
          <meshBasicMaterial
            ref={portalInnerRingRef}
            color="#ffaa00"
            side={THREE.DoubleSide}
            transparent
            opacity={0}
          />
        </mesh>
      </group>

      {/* Golden Cylindrical Studio Pedestal (aligned so boot soles rest precisely on illuminated top) */}
      {controls.showPedestal && (
        <group position={[0, -0.92, 0]}>
          <mesh receiveShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[1.25, 1.35, 0.08, 64]} />
            <meshStandardMaterial color="#0c1018" roughness={0.3} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.042, 0]}>
            <cylinderGeometry args={[1.18, 1.18, 0.015, 64]} />
            <meshStandardMaterial color="#d49b28" roughness={0.22} metalness={0.92} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.052, 0]}>
            <ringGeometry args={[1.12, 1.16, 64]} />
            <meshBasicMaterial color="#ffc430" side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.052, 0]}>
            <ringGeometry args={[0.92, 0.95, 64]} />
            <meshBasicMaterial color="#ffaa10" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* Dynamic Ground Contact Shadow - only rendered in studio stage when pedestal floor is present, never on transparent desktop overlay */}
      {controls.groundShadowEnabled && controls.showPedestal && !controls.transparentBackground && (
        <group ref={shadowGroupRef}>
          <ContactShadows
            position={[0, -0.875, 0]}
            opacity={0.4}
            scale={2.2}
            blur={1.6}
            far={1.2}
            color="#010612"
          />
        </group>
      )}
    </>
  );
};
