import React, { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { rabbitMaterials } from './RabbitMaterials';
import { RabbitEmotion } from '../../types/rabbit';

interface RabbitHeadProps {
  leftEarRef?: React.RefObject<THREE.Group | null>;
  rightEarRef?: React.RefObject<THREE.Group | null>;
  emotion?: RabbitEmotion;
  isBlinking?: boolean;
  blinkProgress?: number;
  mouthOpen?: number;
  eyeOffset?: { x: number; y: number };
  onEarClick?: (side: 'left' | 'right') => void;
  onHeadClick?: () => void;
}

export const RabbitHead = forwardRef<THREE.Group, RabbitHeadProps>(
  (
    {
      leftEarRef,
      rightEarRef,
      emotion = 'happy',
      isBlinking = false,
      blinkProgress = 0,
      mouthOpen = 0,
      eyeOffset = { x: 0, y: 0 },
      onEarClick,
      onHeadClick,
    },
    ref
  ) => {
    // Eyelid scale calculation based on blink and emotion
    const eyelidScaleY = useMemo(() => {
      if (isBlinking || blinkProgress > 0) {
        return Math.min(1, Math.max(0, blinkProgress));
      }
      if (emotion === 'happy' || emotion === 'excited') {
        return 0.35; // Happy squint
      }
      if (emotion === 'surprised') {
        return 0; // Wide open
      }
      return 0.05;
    }, [isBlinking, blinkProgress, emotion]);

    // Eyebrow rotation & position offsets based on emotion
    const browConfig = useMemo(() => {
      switch (emotion) {
        case 'surprised':
          return { y: 0.28, rotZ: 0 };
        case 'thinking':
          return { y: 0.25, rotZ: 0.15 };
        case 'confused':
          return { y: 0.24, rotZ: -0.2 };
        case 'listening':
          return { y: 0.25, rotZ: 0.08 };
        case 'excited':
        case 'happy':
        default:
          return { y: 0.25, rotZ: 0.05 };
      }
    }, [emotion]);

    return (
      <group ref={ref} name="RabbitHeadRoot" position={[0, 0.95, 0]}>
        {/* Main Cute Chibi Head Mesh */}
        <mesh
          name="HeadBase"
          position={[0, 0, 0]}
          scale={[1.05, 1.0, 0.98]}
          material={rabbitMaterials.fur}
          onClick={(e) => {
            e.stopPropagation();
            onHeadClick?.();
          }}
        >
          <sphereGeometry args={[0.42, 32, 32]} />
        </mesh>

        {/* Chubby Cheeks Volume (left & right) */}
        <mesh position={[-0.26, -0.1, 0.15]} scale={[0.22, 0.18, 0.2]} material={rabbitMaterials.fur}>
          <sphereGeometry args={[1, 16, 16]} />
        </mesh>
        <mesh position={[0.26, -0.1, 0.15]} scale={[0.22, 0.18, 0.2]} material={rabbitMaterials.fur}>
          <sphereGeometry args={[1, 16, 16]} />
        </mesh>

        {/* Rosy Cheek Blush Patches */}
        <mesh position={[-0.27, -0.09, 0.32]} rotation={[0.1, -0.4, 0]} material={rabbitMaterials.cheeks}>
          <circleGeometry args={[0.085, 24]} />
        </mesh>
        <mesh position={[0.27, -0.09, 0.32]} rotation={[0.1, 0.4, 0]} material={rabbitMaterials.cheeks}>
          <circleGeometry args={[0.085, 24]} />
        </mesh>

        {/* Small Cute Pink Bunny Nose */}
        <mesh position={[0, -0.03, 0.42]} rotation={[Math.PI, 0, 0]} material={rabbitMaterials.nose}>
          <coneGeometry args={[0.045, 0.045, 16]} />
        </mesh>

        {/* Snout muzzle pad */}
        <mesh position={[0, -0.07, 0.38]} scale={[0.15, 0.09, 0.08]} material={rabbitMaterials.fur}>
          <sphereGeometry args={[1, 16, 16]} />
        </mesh>

        {/* Two Prominent Front Bunny Teeth */}
        <group position={[0, -0.11, 0.4]}>
          {/* Left tooth */}
          <mesh position={[-0.024, -0.025, 0]} scale={[0.022, 0.045, 0.015]} material={rabbitMaterials.teeth}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {/* Right tooth */}
          <mesh position={[0.024, -0.025, 0]} scale={[0.022, 0.045, 0.015]} material={rabbitMaterials.teeth}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>

        {/* Mouth Cavity (Animates open for speaking/expressions) */}
        <mesh
          position={[0, -0.13 - mouthOpen * 0.04, 0.38]}
          scale={[0.07 + mouthOpen * 0.05, 0.02 + mouthOpen * 0.06, 0.04]}
          material={rabbitMaterials.nose}
        >
          <sphereGeometry args={[1, 16, 16]} />
        </mesh>

        {/* LEFT EYE */}
        <group position={[-0.17, 0.07, 0.34]} rotation={[0, -0.2, 0]}>
          {/* Sclera (Eyeball) */}
          <mesh material={rabbitMaterials.eyeSclera} scale={[1, 1.25, 0.6]}>
            <sphereGeometry args={[0.11, 24, 24]} />
          </mesh>
          {/* Iris */}
          <group position={[eyeOffset.x * 0.03, eyeOffset.y * 0.03, 0.07]}>
            <mesh material={rabbitMaterials.eyeIris} scale={[1, 1.15, 0.2]}>
              <sphereGeometry args={[0.065, 24, 24]} />
            </mesh>
            {/* Pupil */}
            <mesh position={[0, 0, 0.03]} material={rabbitMaterials.eyePupil} scale={[1, 1.15, 0.2]}>
              <sphereGeometry args={[0.04, 24, 24]} />
            </mesh>
            {/* Specular Highlight 1 */}
            <mesh position={[0.02, 0.025, 0.05]} material={rabbitMaterials.eyeHighlight}>
              <circleGeometry args={[0.018, 16]} />
            </mesh>
            {/* Specular Highlight 2 */}
            <mesh position={[-0.015, -0.015, 0.05]} material={rabbitMaterials.eyeHighlight}>
              <circleGeometry args={[0.009, 16]} />
            </mesh>
          </group>
          {/* Upper Eyelid for Blinking & Expressions */}
          <mesh
            position={[0, 0.06 - eyelidScaleY * 0.06, 0.075]}
            scale={[1.1, eyelidScaleY * 1.2, 0.5]}
            material={rabbitMaterials.fur}
          >
            <sphereGeometry args={[0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Left Eyebrow */}
          <mesh
            position={[0, browConfig.y - 0.15, 0.09]}
            rotation={[0, 0, browConfig.rotZ]}
            scale={[0.08, 0.018, 0.02]}
            material={rabbitMaterials.fur}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>

        {/* RIGHT EYE */}
        <group position={[0.17, 0.07, 0.34]} rotation={[0, 0.2, 0]}>
          {/* Sclera (Eyeball) */}
          <mesh material={rabbitMaterials.eyeSclera} scale={[1, 1.25, 0.6]}>
            <sphereGeometry args={[0.11, 24, 24]} />
          </mesh>
          {/* Iris */}
          <group position={[eyeOffset.x * 0.03, eyeOffset.y * 0.03, 0.07]}>
            <mesh material={rabbitMaterials.eyeIris} scale={[1, 1.15, 0.2]}>
              <sphereGeometry args={[0.065, 24, 24]} />
            </mesh>
            {/* Pupil */}
            <mesh position={[0, 0, 0.03]} material={rabbitMaterials.eyePupil} scale={[1, 1.15, 0.2]}>
              <sphereGeometry args={[0.04, 24, 24]} />
            </mesh>
            {/* Specular Highlight 1 */}
            <mesh position={[0.02, 0.025, 0.05]} material={rabbitMaterials.eyeHighlight}>
              <circleGeometry args={[0.018, 16]} />
            </mesh>
            {/* Specular Highlight 2 */}
            <mesh position={[-0.015, -0.015, 0.05]} material={rabbitMaterials.eyeHighlight}>
              <circleGeometry args={[0.009, 16]} />
            </mesh>
          </group>
          {/* Upper Eyelid for Blinking & Expressions */}
          <mesh
            position={[0, 0.06 - eyelidScaleY * 0.06, 0.075]}
            scale={[1.1, eyelidScaleY * 1.2, 0.5]}
            material={rabbitMaterials.fur}
          >
            <sphereGeometry args={[0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {/* Right Eyebrow */}
          <mesh
            position={[0, browConfig.y - 0.15, 0.09]}
            rotation={[0, 0, -browConfig.rotZ]}
            scale={[0.08, 0.018, 0.02]}
            material={rabbitMaterials.fur}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>

        {/* LEFT EAR (Articulated Root) */}
        <group
          ref={leftEarRef}
          name="LeftEarRoot"
          position={[-0.18, 0.35, -0.04]}
          rotation={[0.05, 0, 0.08]}
          onClick={(e) => {
            e.stopPropagation();
            onEarClick?.('left');
          }}
        >
          {/* Outer Ear Fur */}
          <mesh position={[0, 0.32, 0]} scale={[0.16, 0.38, 0.09]} material={rabbitMaterials.fur}>
            <cylinderGeometry args={[0.6, 0.9, 2, 24]} />
          </mesh>
          {/* Tip Rounding */}
          <mesh position={[0, 0.7, 0]} scale={[0.096, 0.12, 0.06]} material={rabbitMaterials.fur}>
            <sphereGeometry args={[1, 16, 16]} />
          </mesh>
          {/* Inner Ear Pink Cavity */}
          <mesh position={[0, 0.3, 0.045]} scale={[0.1, 0.3, 0.03]} material={rabbitMaterials.innerEar}>
            <cylinderGeometry args={[0.5, 0.8, 2, 24]} />
          </mesh>
        </group>

        {/* RIGHT EAR (Articulated Root) */}
        <group
          ref={rightEarRef}
          name="RightEarRoot"
          position={[0.18, 0.35, -0.04]}
          rotation={[0.05, 0, -0.08]}
          onClick={(e) => {
            e.stopPropagation();
            onEarClick?.('right');
          }}
        >
          {/* Outer Ear Fur */}
          <mesh position={[0, 0.32, 0]} scale={[0.16, 0.38, 0.09]} material={rabbitMaterials.fur}>
            <cylinderGeometry args={[0.6, 0.9, 2, 24]} />
          </mesh>
          {/* Tip Rounding */}
          <mesh position={[0, 0.7, 0]} scale={[0.096, 0.12, 0.06]} material={rabbitMaterials.fur}>
            <sphereGeometry args={[1, 16, 16]} />
          </mesh>
          {/* Inner Ear Pink Cavity */}
          <mesh position={[0, 0.3, 0.045]} scale={[0.1, 0.3, 0.03]} material={rabbitMaterials.innerEar}>
            <cylinderGeometry args={[0.5, 0.8, 2, 24]} />
          </mesh>
        </group>
      </group>
    );
  }
);

RabbitHead.displayName = 'RabbitHead';
