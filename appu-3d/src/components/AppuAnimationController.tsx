import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CharacterControlState } from '../types/character';
import { AppuCharacter } from './AppuCharacter';

interface AppuAnimationControllerProps {
  controls: CharacterControlState;
}

export const AppuAnimationController: React.FC<AppuAnimationControllerProps> = ({
  controls,
}) => {
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

  // Blinking state
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkProgress, setBlinkProgress] = useState(0);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  // Mouse tracking references
  const mouseTargetRef = useRef({ x: 0, y: 0 });
  const mouseCurrentRef = useRef({ x: 0, y: 0 });
  const blinkTimerRef = useRef(0);
  const nextBlinkIntervalRef = useRef(2.8);
  const blinkDurationRef = useRef(0.18);
  const blinkProgressRef = useRef(0);
  const isBlinkingRef = useRef(false);

  // Global mouse move listener
  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      mouseTargetRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTargetRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handlePointerMove);
    return () => window.removeEventListener('mousemove', handlePointerMove);
  }, []);

  useFrame((_state, delta) => {
    if (!controls.isPlaying) return;

    // Delta time scaled by user's speed setting
    const dt = Math.min(delta, 0.1) * controls.animationSpeed;
    const time = _state.clock.getElapsedTime() * controls.animationSpeed;

    // 1. Mouse gaze interpolation
    if (controls.lookAtMouse) {
      mouseCurrentRef.current.x = THREE.MathUtils.lerp(
        mouseCurrentRef.current.x,
        mouseTargetRef.current.x,
        0.06
      );
      mouseCurrentRef.current.y = THREE.MathUtils.lerp(
        mouseCurrentRef.current.y,
        mouseTargetRef.current.y,
        0.06
      );
    } else {
      mouseCurrentRef.current.x = THREE.MathUtils.lerp(
        mouseCurrentRef.current.x,
        0,
        0.06
      );
      mouseCurrentRef.current.y = THREE.MathUtils.lerp(
        mouseCurrentRef.current.y,
        0,
        0.06
      );
    }

    // 2. Natural Blinking Loop
    if (controls.autoBlink) {
      blinkTimerRef.current += dt;
      if (!isBlinkingRef.current && blinkTimerRef.current >= nextBlinkIntervalRef.current) {
        isBlinkingRef.current = true;
        blinkTimerRef.current = 0;
        blinkProgressRef.current = 0;
        setIsBlinking(true);
      }
      if (isBlinkingRef.current) {
        blinkProgressRef.current = Math.min(
          1.0,
          blinkTimerRef.current / blinkDurationRef.current
        );
        setBlinkProgress(blinkProgressRef.current);
        if (blinkTimerRef.current >= blinkDurationRef.current) {
          isBlinkingRef.current = false;
          blinkTimerRef.current = 0;
          blinkProgressRef.current = 0;
          nextBlinkIntervalRef.current = 2.0 + Math.random() * 3.5;
          setIsBlinking(false);
          setBlinkProgress(0);
        }
      }
    }

    // Update eye offset for screen texture
    setEyeOffset({
      x: mouseCurrentRef.current.x,
      y: mouseCurrentRef.current.y,
    });

    const anim = controls.animationState;

    // 3. Root body transform, idle breathing, sit posture, and walk bob
    if (rootGroupRef.current) {
      let targetY = 0.04;
      if (anim === 'sit') {
        targetY = -0.28; // lower onto ground / pedestal
      } else if (anim === 'walk') {
        targetY = 0.04 + Math.abs(Math.sin(time * 5.0)) * 0.04;
      } else {
        targetY = 0.04 + Math.sin(time * 1.6) * 0.025;
      }

      rootGroupRef.current.position.y = THREE.MathUtils.lerp(
        rootGroupRef.current.position.y,
        targetY,
        0.1
      );

      const breatheScale = controls.breathingEnabled
        ? 1.0 + Math.sin(time * 2.2) * 0.012
        : 1.0;

      rootGroupRef.current.scale.set(
        0.78 * breatheScale,
        0.78 * breatheScale,
        0.78 * breatheScale
      );

      const targetRotY = controls.rotation + (anim === 'walk' ? Math.sin(time * 2.5) * 0.04 : Math.sin(time * 0.8) * 0.02);
      rootGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        rootGroupRef.current.rotation.y,
        targetRotY,
        0.1
      );

      if (anim === 'walk') {
        rootGroupRef.current.rotation.z = Math.sin(time * 2.5) * 0.03;
      } else {
        rootGroupRef.current.rotation.z = THREE.MathUtils.lerp(rootGroupRef.current.rotation.z, 0, 0.1);
      }
    }

    // 4. Smooth Head Tilting & Interactive Gaze
    if (headGroupRef.current) {
      const headTargetYaw = mouseCurrentRef.current.x * 0.36 + Math.sin(time * 0.7) * 0.02;
      const headTargetPitch = -mouseCurrentRef.current.y * 0.22 + Math.cos(time * 1.1) * 0.012;
      const headTargetRoll = -mouseCurrentRef.current.x * 0.07;

      headGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        headGroupRef.current.rotation.y,
        headTargetYaw,
        0.08
      );
      headGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        headGroupRef.current.rotation.x,
        headTargetPitch,
        0.08
      );
      headGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        headGroupRef.current.rotation.z,
        headTargetRoll,
        0.08
      );
    }

    // 5. Normal Robot Arms & Forearms Animation System (Idle, Wave, Walk, Point, Sit)
    // LEFT ARM (Viewer's right side, +X)
    if (leftArmGroupRef.current && leftForearmGroupRef.current) {
      if (anim === 'wave') {
        // High enthusiastic wave on the left arm held forward and up
        const targetShoulderZ = THREE.MathUtils.degToRad(78);
        const targetShoulderX = THREE.MathUtils.degToRad(-18);
        const targetShoulderY = THREE.MathUtils.degToRad(10);

        leftArmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.z, targetShoulderZ, 0.1);
        leftArmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.x, targetShoulderX, 0.1);
        leftArmGroupRef.current.rotation.y = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.y, targetShoulderY, 0.1);

        // Forearm waving back and forth clearly above and outward in front of character
        const waveAngle = Math.sin(time * 6.0) * 0.35 + THREE.MathUtils.degToRad(42);
        leftForearmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.z, waveAngle, 0.2);
        leftForearmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-20), 0.1);
      } else if (anim === 'point') {
        // Pointing arm raised directly forward towards user/camera
        const targetShoulderZ = THREE.MathUtils.degToRad(20);
        const targetShoulderX = THREE.MathUtils.degToRad(-85); // point straight forward
        const targetShoulderY = THREE.MathUtils.degToRad(15);

        leftArmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.z, targetShoulderZ, 0.1);
        leftArmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.x, targetShoulderX, 0.1);
        leftArmGroupRef.current.rotation.y = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.y, targetShoulderY, 0.1);

        leftForearmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-10), 0.1);
        leftForearmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.z, 0, 0.1);
      } else if (anim === 'walk') {
        // Walk arm swing forward and backward
        const armSwing = Math.sin(time * 5.0) * 0.40;
        leftArmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.x, -armSwing, 0.15);
        leftArmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.z, THREE.MathUtils.degToRad(-12), 0.1);
        leftArmGroupRef.current.rotation.y = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.y, 0, 0.1);

        leftForearmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-20), 0.1);
        leftForearmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.z, 0, 0.1);
      } else if (anim === 'sit') {
        // Hands resting peacefully on lap/knees
        leftArmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.z, THREE.MathUtils.degToRad(-15), 0.1);
        leftArmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-35), 0.1);
        leftArmGroupRef.current.rotation.y = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.y, THREE.MathUtils.degToRad(-10), 0.1);

        leftForearmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-45), 0.1);
        leftForearmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.z, THREE.MathUtils.degToRad(15), 0.1);
      } else {
        // NORMAL RELAXED ROBOT IDLE:
        const idleRotZ = THREE.MathUtils.degToRad(-12) + Math.sin(time * 1.6) * 0.02 - mouseCurrentRef.current.x * 0.02;
        const idleRotX = THREE.MathUtils.degToRad(-6) + Math.cos(time * 1.6) * 0.015;
        const idleRotY = THREE.MathUtils.degToRad(-4);

        leftArmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.z, idleRotZ, 0.08);
        leftArmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.x, idleRotX, 0.08);
        leftArmGroupRef.current.rotation.y = THREE.MathUtils.lerp(leftArmGroupRef.current.rotation.y, idleRotY, 0.08);

        leftForearmGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-12), 0.08);
        leftForearmGroupRef.current.rotation.z = THREE.MathUtils.lerp(leftForearmGroupRef.current.rotation.z, THREE.MathUtils.degToRad(-4), 0.08);
      }
    }

    // RIGHT ARM (Viewer's left side, -X)
    if (rightArmGroupRef.current && rightForearmGroupRef.current) {
      if (anim === 'walk') {
        const armSwing = -Math.sin(time * 5.0) * 0.40;
        rightArmGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.x, -armSwing, 0.15);
        rightArmGroupRef.current.rotation.z = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.z, THREE.MathUtils.degToRad(12), 0.1);
        rightArmGroupRef.current.rotation.y = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.y, 0, 0.1);

        rightForearmGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightForearmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-20), 0.1);
        rightForearmGroupRef.current.rotation.z = THREE.MathUtils.lerp(rightForearmGroupRef.current.rotation.z, 0, 0.1);
      } else if (anim === 'sit') {
        rightArmGroupRef.current.rotation.z = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.z, THREE.MathUtils.degToRad(15), 0.1);
        rightArmGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-35), 0.1);
        rightArmGroupRef.current.rotation.y = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.y, THREE.MathUtils.degToRad(10), 0.1);

        rightForearmGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightForearmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-45), 0.1);
        rightForearmGroupRef.current.rotation.z = THREE.MathUtils.lerp(rightForearmGroupRef.current.rotation.z, THREE.MathUtils.degToRad(-15), 0.1);
      } else {
        // NORMAL RELAXED ROBOT IDLE:
        const idleRotZ = THREE.MathUtils.degToRad(12) - Math.sin(time * 1.6) * 0.02 - mouseCurrentRef.current.x * 0.02;
        const idleRotX = THREE.MathUtils.degToRad(-6) + Math.cos(time * 1.6) * 0.015;
        const idleRotY = THREE.MathUtils.degToRad(4);

        rightArmGroupRef.current.rotation.z = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.z, idleRotZ, 0.08);
        rightArmGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.x, idleRotX, 0.08);
        rightArmGroupRef.current.rotation.y = THREE.MathUtils.lerp(rightArmGroupRef.current.rotation.y, idleRotY, 0.08);

        rightForearmGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightForearmGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-12), 0.08);
        rightForearmGroupRef.current.rotation.z = THREE.MathUtils.lerp(rightForearmGroupRef.current.rotation.z, THREE.MathUtils.degToRad(4), 0.08);
      }
    }

    // 6. Legs & Feet Animation System (Idle, Walk, Sit)
    if (
      leftLegGroupRef.current &&
      rightLegGroupRef.current &&
      leftLowerLegGroupRef.current &&
      rightLowerLegGroupRef.current
    ) {
      if (anim === 'sit') {
        // Hips bend forward 85 deg, knees bend down/forward 80 deg
        leftLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftLegGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-85), 0.15);
        leftLowerLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftLowerLegGroupRef.current.rotation.x, THREE.MathUtils.degToRad(80), 0.15);

        rightLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightLegGroupRef.current.rotation.x, THREE.MathUtils.degToRad(-85), 0.15);
        rightLowerLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightLowerLegGroupRef.current.rotation.x, THREE.MathUtils.degToRad(80), 0.15);
      } else if (anim === 'walk') {
        const legSwing = Math.sin(time * 5.0) * 0.55;
        leftLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftLegGroupRef.current.rotation.x, -legSwing, 0.2);
        const leftKneeBend = legSwing > 0 ? legSwing * 0.8 : 0.1;
        leftLowerLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftLowerLegGroupRef.current.rotation.x, leftKneeBend, 0.2);

        rightLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightLegGroupRef.current.rotation.x, legSwing, 0.2);
        const rightKneeBend = -legSwing > 0 ? -legSwing * 0.8 : 0.1;
        rightLowerLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightLowerLegGroupRef.current.rotation.x, rightKneeBend, 0.2);
      } else {
        const subtleLegShift = Math.sin(time * 1.6 + 0.3) * 0.02;
        leftLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftLegGroupRef.current.rotation.x, subtleLegShift, 0.1);
        leftLowerLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(leftLowerLegGroupRef.current.rotation.x, 0, 0.1);

        rightLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightLegGroupRef.current.rotation.x, -subtleLegShift, 0.1);
        rightLowerLegGroupRef.current.rotation.x = THREE.MathUtils.lerp(rightLowerLegGroupRef.current.rotation.x, 0, 0.1);
      }
    }
  });

  return (
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
      eyeOffset={eyeOffset}
    />
  );
};
