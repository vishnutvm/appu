import React, { Suspense } from 'react';
import * as THREE from 'three';
import { RabbitCharacter } from './RabbitCharacter';
import { ProductionRabbitModel } from './ProductionRabbitModel';
import { RabbitRigRefs, RabbitEmotion } from '../../types/rabbit';

interface ModelManagerProps {
  customModelUrl?: string | null;
  rig: RabbitRigRefs;
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

export const ModelManager: React.FC<ModelManagerProps> = ({
  customModelUrl,
  rig,
  emotion = 'happy',
  isBlinking = false,
  blinkProgress = 0,
  mouthOpen = 0,
  eyeOffset = { x: 0, y: 0 },
  onPointerDown,
  onEarClick,
  onHeadClick,
  onBodyClick,
}) => {
  // If custom GLB model URL is supplied, render production model with fallback
  if (customModelUrl) {
    return (
      <Suspense
        fallback={
          <RabbitCharacter
            rootRef={rig.rootRef}
            headRef={rig.headRef}
            leftEarRef={rig.leftEarRef}
            rightEarRef={rig.rightEarRef}
            leftArmRef={rig.leftArmRef}
            rightArmRef={rig.rightArmRef}
            leftLegRef={rig.leftLegRef}
            rightLegRef={rig.rightLegRef}
            leftFootRef={rig.leftFootRef}
            rightFootRef={rig.rightFootRef}
            tailRef={rig.tailRef}
            emotion={emotion}
            isBlinking={isBlinking}
            blinkProgress={blinkProgress}
            mouthOpen={mouthOpen}
            eyeOffset={eyeOffset}
            onPointerDown={onPointerDown}
            onEarClick={onEarClick}
            onHeadClick={onHeadClick}
            onBodyClick={onBodyClick}
          />
        }
      >
        <group ref={rig.rootRef} onPointerDown={onPointerDown}>
          <ProductionRabbitModel
            modelUrl={customModelUrl}
            rig={rig}
            emotion={emotion}
            isBlinking={isBlinking}
            blinkProgress={blinkProgress}
            mouthOpen={mouthOpen}
            eyeOffset={eyeOffset}
          />
        </group>
      </Suspense>
    );
  }

  // Default high-fidelity procedural character rig
  return (
    <RabbitCharacter
      rootRef={rig.rootRef}
      headRef={rig.headRef}
      leftEarRef={rig.leftEarRef}
      rightEarRef={rig.rightEarRef}
      leftArmRef={rig.leftArmRef}
      rightArmRef={rig.rightArmRef}
      leftLegRef={rig.leftLegRef}
      rightLegRef={rig.rightLegRef}
      leftFootRef={rig.leftFootRef}
      rightFootRef={rig.rightFootRef}
      tailRef={rig.tailRef}
      emotion={emotion}
      isBlinking={isBlinking}
      blinkProgress={blinkProgress}
      mouthOpen={mouthOpen}
      eyeOffset={eyeOffset}
      onPointerDown={onPointerDown}
      onEarClick={onEarClick}
      onHeadClick={onHeadClick}
      onBodyClick={onBodyClick}
    />
  );
};
