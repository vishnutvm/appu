import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRabbitStore } from '../../state/rabbitStore';
import { RabbitRigRefs } from '../../types/rabbit';

interface AntiGravityControllerProps {
  rig: RabbitRigRefs;
}

export const AntiGravityController: React.FC<AntiGravityControllerProps> = ({ rig }) => {
  const {
    action,
    isDragging,
    dragOffset,
    hoverHeight,
    isSpinning,
    setBlink,
    setAction,
  } = useRabbitStore();

  // Internal physics & timing states
  const blinkTimerRef = useRef<number>(2.5);
  const isBlinkingRef = useRef<boolean>(false);
  const earTwitchTimerRef = useRef<number>(4.0);
  const earTwitchActiveRef = useRef<'left' | 'right' | null>(null);
  const earTwitchProgressRef = useRef<number>(0);

  // Spin rotation tracking
  const currentSpinAngleRef = useRef<number>(0);
  const targetSpinAngleRef = useRef<number>(0);

  // Smooth position and tilt dampers
  const currentPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const targetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const currentRotRef = useRef<THREE.Euler>(new THREE.Euler(0, 0, 0));

  // Jump physics tracking
  const jumpProgressRef = useRef<number>(0);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const safeDelta = Math.min(delta, 0.1);

    // 1. Natural Blinking Cycle
    blinkTimerRef.current -= safeDelta;
    if (blinkTimerRef.current <= 0) {
      if (!isBlinkingRef.current) {
        isBlinkingRef.current = true;
        setBlink(true, 1);
        blinkTimerRef.current = 0.15; // Blink duration
      } else {
        isBlinkingRef.current = false;
        setBlink(false, 0);
        // Next blink between 3.0 and 6.0 seconds
        blinkTimerRef.current = 3.0 + Math.random() * 3.0;
      }
    }

    // 2. Ear Twitch Autonomous Behavior
    earTwitchTimerRef.current -= safeDelta;
    if (earTwitchTimerRef.current <= 0 && !earTwitchActiveRef.current) {
      earTwitchActiveRef.current = Math.random() > 0.5 ? 'left' : 'right';
      earTwitchProgressRef.current = 0;
      earTwitchTimerRef.current = 4.0 + Math.random() * 4.0;
    }

    let twitchOffsetLeft = 0;
    let twitchOffsetRight = 0;
    if (earTwitchActiveRef.current) {
      earTwitchProgressRef.current += safeDelta * 12; // Fast twitch frequency
      const twitchVal = Math.sin(earTwitchProgressRef.current) * 0.25;
      if (earTwitchActiveRef.current === 'left') {
        twitchOffsetLeft = twitchVal;
      } else {
        twitchOffsetRight = twitchVal;
      }

      if (earTwitchProgressRef.current >= Math.PI * 2) {
        earTwitchActiveRef.current = null;
      }
    }

    // 3. Position and Rotation Kinematics based on AntiGravity Action
    let targetY = hoverHeight;
    let targetX = 0;
    let targetZ = 0;
    let targetPitch = 0;
    let targetRoll = 0;
    let targetYaw = 0;

    // Handle Dragging
    if (isDragging) {
      targetX = dragOffset[0];
      targetY = hoverHeight + dragOffset[1];
      targetZ = dragOffset[2];
      targetRoll = -dragOffset[0] * 0.35;
      targetPitch = dragOffset[1] * 0.2;
    } else {
      switch (action) {
        case 'spin':
          targetY = hoverHeight + Math.sin(time * 3) * 0.1;
          if (isSpinning) {
            targetSpinAngleRef.current += safeDelta * Math.PI * 3.5;
            if (targetSpinAngleRef.current >= Math.PI * 2) {
              targetSpinAngleRef.current = Math.PI * 2;
              // Reset spin upon completion
              if (currentSpinAngleRef.current >= Math.PI * 1.95) {
                targetSpinAngleRef.current = 0;
                currentSpinAngleRef.current = 0;
                setAction('idle-floating');
              }
            }
          }
          currentSpinAngleRef.current = THREE.MathUtils.damp(
            currentSpinAngleRef.current,
            targetSpinAngleRef.current,
            10,
            safeDelta
          );
          targetYaw = currentSpinAngleRef.current;
          break;

        case 'fly':
          // Dynamic flying superman pose with forward lean
          targetY = hoverHeight + 0.15 + Math.sin(time * 3.5) * 0.06;
          targetPitch = 0.95; // Leaning forward ~55 degrees
          targetRoll = Math.sin(time * 2.0) * 0.1;
          break;

        case 'floating-sit':
          // Calm hovering meditation
          targetY = hoverHeight - 0.05 + Math.sin(time * 1.5) * 0.04;
          targetPitch = -0.05;
          targetRoll = Math.sin(time * 1.2) * 0.02;
          break;

        case 'hover-walk':
          // Mid-air walking steps with rhythmic bob
          targetY = hoverHeight + Math.abs(Math.sin(time * 5.0)) * 0.08;
          targetPitch = 0.08;
          targetRoll = Math.sin(time * 2.5) * 0.04;
          break;

        case 'jump-float':
          jumpProgressRef.current += safeDelta * 2.0;
          if (jumpProgressRef.current <= Math.PI) {
            targetY = hoverHeight + Math.sin(jumpProgressRef.current) * 0.7;
          } else {
            jumpProgressRef.current = 0;
            setAction('idle-floating');
          }
          break;

        case 'hover':
        case 'idle-floating':
        default:
          // Organic weightless floating: gentle sinusoidal levitation
          targetY = hoverHeight + Math.sin(time * 2.2) * 0.08;
          targetPitch = Math.cos(time * 1.4) * 0.025;
          targetRoll = Math.sin(time * 1.6) * 0.035;
          break;
      }
    }

    targetPosRef.current.set(targetX, targetY, targetZ);

    // Apply smooth Spring-Damper interpolation to Root
    if (rig.rootRef.current) {
      currentPosRef.current.lerp(targetPosRef.current, 0.12);
      rig.rootRef.current.position.copy(currentPosRef.current);

      currentRotRef.current.x = THREE.MathUtils.damp(currentRotRef.current.x, targetPitch, 8, safeDelta);
      currentRotRef.current.y = THREE.MathUtils.damp(currentRotRef.current.y, targetYaw, 10, safeDelta);
      currentRotRef.current.z = THREE.MathUtils.damp(currentRotRef.current.z, targetRoll, 8, safeDelta);
      rig.rootRef.current.rotation.copy(currentRotRef.current);
    }

    // 4. Secondary Limb & Ear Kinematics based on Mode
    const leftEar = rig.leftEarRef.current;
    const rightEar = rig.rightEarRef.current;
    const leftArm = rig.leftArmRef.current;
    const rightArm = rig.rightArmRef.current;
    const leftLeg = rig.leftLegRef.current;
    const rightLeg = rig.rightLegRef.current;
    const tail = rig.tailRef.current;

    // Ears Secondary Reactivity
    if (leftEar && rightEar) {
      if (action === 'fly') {
        // Fold back due to wind/motion resistance
        leftEar.rotation.x = THREE.MathUtils.damp(leftEar.rotation.x, -0.65, 8, safeDelta);
        rightEar.rotation.x = THREE.MathUtils.damp(rightEar.rotation.x, -0.65, 8, safeDelta);
      } else {
        // Autonomous inertia and twitches
        const earSway = Math.sin(time * 2.5) * 0.05;
        leftEar.rotation.x = THREE.MathUtils.damp(leftEar.rotation.x, 0.05 + earSway + twitchOffsetLeft, 10, safeDelta);
        rightEar.rotation.x = THREE.MathUtils.damp(rightEar.rotation.x, 0.05 + earSway + twitchOffsetRight, 10, safeDelta);
        leftEar.rotation.z = THREE.MathUtils.damp(leftEar.rotation.z, 0.08 + twitchOffsetLeft * 0.5, 10, safeDelta);
        rightEar.rotation.z = THREE.MathUtils.damp(rightEar.rotation.z, -0.08 - twitchOffsetRight * 0.5, 10, safeDelta);
      }
    }

    // Arm Articulations
    if (leftArm && rightArm) {
      if (action === 'fly') {
        // Swept back aerodynamic pose
        leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, -1.2, 8, safeDelta);
        rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, -1.2, 8, safeDelta);
        leftArm.rotation.z = THREE.MathUtils.damp(leftArm.rotation.z, 0.4, 8, safeDelta);
        rightArm.rotation.z = THREE.MathUtils.damp(rightArm.rotation.z, -0.4, 8, safeDelta);
      } else if (action === 'floating-sit') {
        // Resting peacefully in lap
        leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, 0.6, 6, safeDelta);
        rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, 0.6, 6, safeDelta);
        leftArm.rotation.z = THREE.MathUtils.damp(leftArm.rotation.z, 0.35, 6, safeDelta);
        rightArm.rotation.z = THREE.MathUtils.damp(rightArm.rotation.z, -0.35, 6, safeDelta);
      } else if (action === 'hover-walk') {
        // Counter-swing arms
        const armWalk = Math.sin(time * 5.0) * 0.35;
        leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, armWalk, 10, safeDelta);
        rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, -armWalk, 10, safeDelta);
      } else {
        // Gentle weightless hovering balance
        const armHover = Math.sin(time * 1.8) * 0.08;
        leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, armHover, 6, safeDelta);
        rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, armHover, 6, safeDelta);
        leftArm.rotation.z = THREE.MathUtils.damp(leftArm.rotation.z, 0.18 + armHover * 0.5, 6, safeDelta);
        rightArm.rotation.z = THREE.MathUtils.damp(rightArm.rotation.z, -0.18 - armHover * 0.5, 6, safeDelta);
      }
    }

    // Leg Articulations
    if (leftLeg && rightLeg) {
      if (action === 'floating-sit') {
        // Crossed legs in air
        leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, -1.2, 8, safeDelta);
        rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, -1.2, 8, safeDelta);
        leftLeg.rotation.z = THREE.MathUtils.damp(leftLeg.rotation.z, 0.6, 8, safeDelta);
        rightLeg.rotation.z = THREE.MathUtils.damp(rightLeg.rotation.z, -0.6, 8, safeDelta);
      } else if (action === 'fly') {
        // Legs trailing behind
        leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, -0.5, 8, safeDelta);
        rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, -0.5, 8, safeDelta);
        leftLeg.rotation.z = THREE.MathUtils.damp(leftLeg.rotation.z, 0.05, 8, safeDelta);
        rightLeg.rotation.z = THREE.MathUtils.damp(rightLeg.rotation.z, -0.05, 8, safeDelta);
      } else if (action === 'hover-walk') {
        // Cyclic walking stride
        const legWalk = Math.sin(time * 5.0) * 0.5;
        leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, -legWalk, 12, safeDelta);
        rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, legWalk, 12, safeDelta);
        leftLeg.rotation.z = THREE.MathUtils.damp(leftLeg.rotation.z, 0, 8, safeDelta);
        rightLeg.rotation.z = THREE.MathUtils.damp(rightLeg.rotation.z, 0, 8, safeDelta);
      } else {
        // Natural hovering dangle
        const legDangle = Math.sin(time * 1.5) * 0.05;
        leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, legDangle, 6, safeDelta);
        rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, -legDangle * 0.5, 6, safeDelta);
        leftLeg.rotation.z = THREE.MathUtils.damp(leftLeg.rotation.z, 0.04, 6, safeDelta);
        rightLeg.rotation.z = THREE.MathUtils.damp(rightLeg.rotation.z, -0.04, 6, safeDelta);
      }
    }

    // Tail gentle wag
    if (tail) {
      tail.rotation.y = Math.sin(time * 3.5) * 0.15;
    }
  });

  return null;
};
