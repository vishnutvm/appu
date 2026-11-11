import React, { forwardRef } from 'react';
import * as THREE from 'three';
import { RabbitHead } from './RabbitHead';
import { RabbitBody } from './RabbitBody';
import { RabbitLimbs } from './RabbitLimbs';
import { RabbitLegs } from './RabbitLegs';
import { RabbitEmotion } from '../../types/rabbit';

interface RabbitCharacterProps {
  rootRef?: React.RefObject<THREE.Group | null>;
  headRef?: React.RefObject<THREE.Group | null>;
  leftEarRef?: React.RefObject<THREE.Group | null>;
  rightEarRef?: React.RefObject<THREE.Group | null>;
  leftArmRef?: React.RefObject<THREE.Group | null>;
  rightArmRef?: React.RefObject<THREE.Group | null>;
  leftLegRef?: React.RefObject<THREE.Group | null>;
  rightLegRef?: React.RefObject<THREE.Group | null>;
  leftFootRef?: React.RefObject<THREE.Group | null>;
  rightFootRef?: React.RefObject<THREE.Group | null>;
  tailRef?: React.RefObject<THREE.Group | null>;
  emotion?: RabbitEmotion;
  isBlinking?: boolean;
  blinkProgress?: number;
  mouthOpen?: number;
  eyeOffset?: { x: number; y: number };
  onPointerDown?: (e: any) => void;
  onEarClick?: (side: 'left' | 'right') => void;
  onHeadClick?: () => void;
  onBodyClick?: () => void;
}

export const RabbitCharacter = forwardRef<THREE.Group, RabbitCharacterProps>(
  (
    {
      rootRef,
      headRef,
      leftEarRef,
      rightEarRef,
      leftArmRef,
      rightArmRef,
      leftLegRef,
      rightLegRef,
      leftFootRef,
      rightFootRef,
      tailRef,
      emotion = 'happy',
      isBlinking = false,
      blinkProgress = 0,
      mouthOpen = 0,
      eyeOffset = { x: 0, y: 0 },
      onPointerDown,
      onEarClick,
      onHeadClick,
      onBodyClick,
    },
    _ref
  ) => {
    return (
      <group
        ref={rootRef}
        name="RabbitCharacterRoot"
        position={[0, 0, 0]}
        scale={[0.85, 0.85, 0.85]}
        onPointerDown={onPointerDown}
      >
        {/* Invisible Hit Collider for dependable pointer grabbing and dragging */}
        <mesh visible={false} position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 1.8, 16]} />
          <meshBasicMaterial />
        </mesh>

        {/* Head, Ears, Eyes, Teeth, Rosy Cheeks */}
        <RabbitHead
          ref={headRef}
          leftEarRef={leftEarRef}
          rightEarRef={rightEarRef}
          emotion={emotion}
          isBlinking={isBlinking}
          blinkProgress={blinkProgress}
          mouthOpen={mouthOpen}
          eyeOffset={eyeOffset}
          onEarClick={onEarClick}
          onHeadClick={onHeadClick}
        />

        {/* Navy Hoodie Torso, Neck Headphones, Cream Hood Lining, Fluffy Tail */}
        <RabbitBody
          tailRef={tailRef}
          onBodyClick={onBodyClick}
        />

        {/* Articulated Navy Sleeves, White Paws & Left Wrist Smartwatch */}
        <RabbitLimbs
          leftArmRef={leftArmRef}
          rightArmRef={rightArmRef}
        />

        {/* Beige Cargo Joggers with Side Pockets & Navy/White Sneakers */}
        <RabbitLegs
          leftLegRef={leftLegRef}
          rightLegRef={rightLegRef}
          leftFootRef={leftFootRef}
          rightFootRef={rightFootRef}
        />
      </group>
    );
  }
);

RabbitCharacter.displayName = 'RabbitCharacter';
