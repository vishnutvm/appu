import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFaceScreenTexture } from './AppuEyes';
import { AppuEmotion } from '../types/character';

interface AppuFaceProps {
  emotion?: AppuEmotion;
  isBlinking?: boolean;
  blinkProgress?: number;
  mouthOpen?: number;
  eyeOffset?: { x: number; y: number };
}

export const AppuFace: React.FC<AppuFaceProps> = ({
  emotion = 'happy',
  isBlinking = false,
  blinkProgress = 0,
  mouthOpen = 0,
  eyeOffset = { x: 0, y: 0 },
}) => {
  const faceTexture = useFaceScreenTexture(
    emotion,
    isBlinking,
    blinkProgress,
    mouthOpen,
    eyeOffset
  );

  // Visor curvature parameters centered precisely on the front of the redesigned head
  const visorGeometry = useMemo(() => {
    const phiLength = Math.PI * 0.62;
    const phiStart = Math.PI * 0.5 - phiLength * 0.5;
    const thetaLength = Math.PI * 0.35;
    const thetaStart = Math.PI * 0.5 - thetaLength * 0.5;

    return new THREE.SphereGeometry(
      0.548,
      48,
      32,
      phiStart,
      phiLength,
      thetaStart,
      thetaLength
    );
  }, []);

  const visorMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: faceTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  }, [faceTexture]);

  return (
    <group name="FacialDisplayGroup">
      {/* Curved OLED display mesh with harmonious head scaling */}
      <mesh
        name="FacialDisplay"
        geometry={visorGeometry}
        material={visorMaterial}
        scale={[1.152, 0.982, 1.055]}
      />
    </group>
  );
};
