import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { RabbitRigRefs, RabbitEmotion } from '../../types/rabbit';

interface ProductionRabbitModelProps {
  modelUrl?: string;
  rig: RabbitRigRefs;
  emotion?: RabbitEmotion;
  isBlinking?: boolean;
  blinkProgress?: number;
  mouthOpen?: number;
  eyeOffset?: { x: number; y: number };
}

export const ProductionRabbitModel: React.FC<ProductionRabbitModelProps> = ({
  modelUrl = './models/rabbit.glb',
  rig,
  emotion = 'happy',
  isBlinking = false,
  blinkProgress = 0,
  mouthOpen = 0,
  eyeOffset = { x: 0, y: 0 },
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(modelUrl);
  const { actions, names } = useAnimations(gltf.animations, groupRef);

  // Mapped bones & morph targets
  const bonesRef = useRef<{
    head?: THREE.Bone;
    leftEar?: THREE.Bone;
    rightEar?: THREE.Bone;
    leftArm?: THREE.Bone;
    rightArm?: THREE.Bone;
    leftLeg?: THREE.Bone;
    rightLeg?: THREE.Bone;
  }>({});

  const morphMeshesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!gltf.scene) return;

    // Traverse model to configure shadows and extract humanoid/ear bones
    const bones: typeof bonesRef.current = {};
    const morphs: THREE.Mesh[] = [];

    gltf.scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if ((node as THREE.Mesh).morphTargetInfluences) {
          morphs.push(node as THREE.Mesh);
        }
      }

      if ((node as THREE.Bone).isBone) {
        const name = node.name.toLowerCase();
        if (name.includes('head')) bones.head = node as THREE.Bone;
        if (name.includes('ear') && (name.includes('l') || name.includes('left'))) bones.leftEar = node as THREE.Bone;
        if (name.includes('ear') && (name.includes('r') || name.includes('right'))) bones.rightEar = node as THREE.Bone;
        if (name.includes('arm') && (name.includes('l') || name.includes('left'))) bones.leftArm = node as THREE.Bone;
        if (name.includes('arm') && (name.includes('r') || name.includes('right'))) bones.rightArm = node as THREE.Bone;
        if (name.includes('leg') && (name.includes('l') || name.includes('left'))) bones.leftLeg = node as THREE.Bone;
        if (name.includes('leg') && (name.includes('r') || name.includes('right'))) bones.rightLeg = node as THREE.Bone;
      }
    });

    bonesRef.current = bones;
    morphMeshesRef.current = morphs;

    // If GLB contains embedded animation clips, play idle
    if (names.length > 0) {
      const idleClip = names.find((n) => n.toLowerCase().includes('idle')) || names[0];
      actions[idleClip]?.reset().fadeIn(0.5).play();
    }
  }, [gltf, actions, names]);

  useFrame(() => {
    // 1. Sync Morph Targets for Expressions, Blinking & Lip Sync
    morphMeshesRef.current.forEach((mesh) => {
      const dict = mesh.morphTargetDictionary;
      const infl = mesh.morphTargetInfluences;
      if (!dict || !infl) return;

      // Blinking
      const blinkIdx = dict['blink'] ?? dict['eyesClosed'] ?? dict['blink_both'];
      if (blinkIdx !== undefined) {
        infl[blinkIdx] = isBlinking ? 1 : blinkProgress;
      }

      // Mouth opening for speech / audio
      const mouthIdx = dict['mouthOpen'] ?? dict['viseme_aa'] ?? dict['jawOpen'];
      if (mouthIdx !== undefined) {
        infl[mouthIdx] = mouthOpen;
      }

      // Smile / Happy
      const smileIdx = dict['smile'] ?? dict['happy'];
      if (smileIdx !== undefined) {
        infl[smileIdx] = emotion === 'happy' || emotion === 'excited' ? 0.8 : 0;
      }
    });

    // 2. Sync Head LookAt Tracking to Bone
    const headBone = bonesRef.current.head;
    if (headBone && rig.headRef.current) {
      headBone.rotation.x = rig.headRef.current.rotation.x;
      headBone.rotation.y = rig.headRef.current.rotation.y;
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      <primitive object={gltf.scene} scale={[1, 1, 1]} />
    </group>
  );
};
