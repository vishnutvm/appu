import React, { forwardRef } from 'react';
import * as THREE from 'three';
import { AppuHead } from './AppuHead';
import { AppuBody } from './AppuBody';
import { AppuArms } from './AppuArms';
import { AppuLegs } from './AppuLegs';
import { AppuEmotion } from '../types/character';

interface AppuCharacterProps {
  rootRef?: React.RefObject<THREE.Group | null>;
  headRef?: React.RefObject<THREE.Group | null>;
  leftArmRef?: React.RefObject<THREE.Group | null>;
  rightArmRef?: React.RefObject<THREE.Group | null>;
  leftForearmRef?: React.RefObject<THREE.Group | null>;
  rightForearmRef?: React.RefObject<THREE.Group | null>;
  leftLegRef?: React.RefObject<THREE.Group | null>;
  rightLegRef?: React.RefObject<THREE.Group | null>;
  leftLowerLegRef?: React.RefObject<THREE.Group | null>;
  rightLowerLegRef?: React.RefObject<THREE.Group | null>;
  emotion?: AppuEmotion;
  isBlinking?: boolean;
  blinkProgress?: number;
  mouthOpen?: number;
  eyeOffset?: { x: number; y: number };
  onPointerDown?: (e: any) => void;
}

export const AppuCharacter = forwardRef<THREE.Group, AppuCharacterProps>(
  (
    {
      rootRef,
      headRef,
      leftArmRef,
      rightArmRef,
      leftForearmRef,
      rightForearmRef,
      leftLegRef,
      rightLegRef,
      leftLowerLegRef,
      rightLowerLegRef,
      emotion = 'happy',
      isBlinking = false,
      blinkProgress = 0,
      mouthOpen = 0,
      eyeOffset = { x: 0, y: 0 },
      onPointerDown,
    },
    _ref
  ) => {
    return (
      <group
        ref={rootRef}
        name="AppuCharacterRoot"
        position={[0, 0.04, 0]}
        scale={[0.78, 0.78, 0.78]}
        onPointerDown={onPointerDown}
      >
        {/* Invisible Hit Collider for dependable mouse grabbing */}
        <mesh visible={false} position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 1.6, 16]} />
          <meshBasicMaterial />
        </mesh>

        {/* Head and Face */}
        <AppuHead
          ref={headRef}
          emotion={emotion}
          isBlinking={isBlinking}
          blinkProgress={blinkProgress}
          mouthOpen={mouthOpen}
          eyeOffset={eyeOffset}
        />

        {/* Articulated Neck and Torso */}
        <AppuBody />

        {/* Anatomical Arms and Articulated Hands */}
        <AppuArms
          leftArmRef={leftArmRef}
          rightArmRef={rightArmRef}
          leftForearmRef={leftForearmRef}
          rightForearmRef={rightForearmRef}
        />

        {/* Proportionate Legs and Stable Rounded Boots */}
        <AppuLegs
          leftLegRef={leftLegRef}
          rightLegRef={rightLegRef}
          leftLowerLegRef={leftLowerLegRef}
          rightLowerLegRef={rightLowerLegRef}
        />
      </group>
    );
  }
);

AppuCharacter.displayName = 'AppuCharacter';
