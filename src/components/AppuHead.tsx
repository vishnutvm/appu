import React, { forwardRef } from 'react';
import * as THREE from 'three';
import {
  ceramicWhiteMaterial,
  goldMetallicMaterial,
  graphiteJointMaterial,
} from './materials';
import { AppuFace } from './AppuFace';
import { AppuEmotion } from '../types/character';

interface AppuHeadProps {
  emotion?: AppuEmotion;
  isBlinking?: boolean;
  blinkProgress?: number;
  mouthOpen?: number;
  eyeOffset?: { x: number; y: number };
}

export const AppuHead = forwardRef<THREE.Group, AppuHeadProps>(
  ({ emotion, isBlinking, blinkProgress, mouthOpen, eyeOffset }, ref) => {
    return (
      <group ref={ref} name="Head" position={[0, 0.44, 0]}>
        {/* Main Head Shell: Smooth glossy white ceramic oval with balanced humanized proportion */}
        <mesh
          name="HeadShell"
          material={ceramicWhiteMaterial}
          scale={[1.15, 0.98, 1.05]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.54, 64, 64]} />
        </mesh>

        {/* Small, refined top antenna with gold accent base */}
        <group name="Antenna" position={[0, 0.54, 0.12]} rotation={[THREE.MathUtils.degToRad(12), 0, 0]}>
          {/* Base socket */}
          <mesh material={graphiteJointMaterial} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 0.03, 32]} />
          </mesh>
          {/* Gold ring accent */}
          <mesh material={goldMetallicMaterial} position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.042, 0.007, 16, 32]} />
          </mesh>
          {/* Slender streamlined stem */}
          <mesh material={graphiteJointMaterial} position={[0, 0.055, 0]} castShadow>
            <capsuleGeometry args={[0.018, 0.06, 16, 20]} />
          </mesh>
          {/* Luminous indicator tip */}
          <mesh material={goldMetallicMaterial} position={[0, 0.095, 0]}>
            <sphereGeometry args={[0.022, 20, 20]} />
          </mesh>
        </group>

        {/* Left Side Ear Module with Gold & Graphite Details (+X, character left) */}
        <group name="LeftEarModule" position={[0.64, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          {/* White outer cap */}
          <mesh material={ceramicWhiteMaterial} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.035, 36]} />
          </mesh>
          {/* Graphite center disc */}
          <mesh material={graphiteJointMaterial} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.025, 36]} />
          </mesh>
          {/* Gold metallic outer ring accent */}
          <mesh material={goldMetallicMaterial} position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.135, 0.016, 16, 36]} />
          </mesh>
          {/* Subtle inner gold dot */}
          <mesh material={goldMetallicMaterial} position={[0, 0.035, 0]}>
            <sphereGeometry args={[0.032, 16, 16]} />
          </mesh>
        </group>

        {/* Right Side Ear Module with Gold & Graphite Details (-X, character right) */}
        <group name="RightEarModule" position={[-0.64, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
          {/* White outer cap */}
          <mesh material={ceramicWhiteMaterial} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.035, 36]} />
          </mesh>
          {/* Graphite center disc */}
          <mesh material={graphiteJointMaterial} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.025, 36]} />
          </mesh>
          {/* Gold metallic outer ring accent */}
          <mesh material={goldMetallicMaterial} position={[0, 0.025, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.135, 0.016, 16, 36]} />
          </mesh>
          {/* Subtle inner gold dot */}
          <mesh material={goldMetallicMaterial} position={[0, 0.035, 0]}>
            <sphereGeometry args={[0.032, 16, 16]} />
          </mesh>
        </group>

        {/* Curved Facial OLED display & Expressive Eyes */}
        <AppuFace
          emotion={emotion}
          isBlinking={isBlinking}
          blinkProgress={blinkProgress}
          mouthOpen={mouthOpen}
          eyeOffset={eyeOffset}
        />
      </group>
    );
  }
);

AppuHead.displayName = 'AppuHead';
