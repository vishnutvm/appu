import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ModelManager } from '../character/ModelManager';
import { FloatingEnvironment } from './FloatingEnvironment';
import { FloatingParticles } from './FloatingParticles';
import { AntiGravityController } from '../controller/AntiGravityController';
import { InteractionManager } from '../controller/InteractionManager';
import { useRabbitStore } from '../../state/rabbitStore';
import { RabbitRigRefs } from '../../types/rabbit';

interface RabbitSceneProps {
  className?: string;
  enableOrbit?: boolean;
  modelUrl?: string | null;
}

export const RabbitScene: React.FC<RabbitSceneProps> = ({
  className = '',
  enableOrbit = true,
  modelUrl = null,
}) => {
  const {
    emotion,
    isBlinking,
    blinkProgress,
    mouthOpen,
    setIsDragging,
    triggerSpin,
    setEmotion,
  } = useRabbitStore();

  const [eyeOffset, setEyeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Rig joint references
  const rootRef = useRef<THREE.Group | null>(null);
  const headRef = useRef<THREE.Group | null>(null);
  const leftEarRef = useRef<THREE.Group | null>(null);
  const rightEarRef = useRef<THREE.Group | null>(null);
  const leftArmRef = useRef<THREE.Group | null>(null);
  const rightArmRef = useRef<THREE.Group | null>(null);
  const leftLegRef = useRef<THREE.Group | null>(null);
  const rightLegRef = useRef<THREE.Group | null>(null);
  const leftFootRef = useRef<THREE.Group | null>(null);
  const rightFootRef = useRef<THREE.Group | null>(null);
  const tailRef = useRef<THREE.Group | null>(null);

  const rigRefs: RabbitRigRefs = {
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
  };

  // Pointer click triggers
  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    setIsDragging(true, [0, 0, 0]);
  };

  const handleEarClick = (side: 'left' | 'right') => {
    setEmotion('excited');
    if (side === 'left' && leftEarRef.current) {
      leftEarRef.current.rotation.z += 0.25;
    } else if (rightEarRef.current) {
      rightEarRef.current.rotation.z -= 0.25;
    }
  };

  const handleHeadClick = () => {
    setEmotion('happy');
  };

  const handleBodyClick = () => {
    triggerSpin();
  };

  return (
    <div className={`w-full h-full relative ${className}`} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0.75, 3.8], fov: 35 }}
        shadows
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        {/* Atmospheric Ambient Illumination */}
        <ambientLight intensity={0.7} />

        {/* Key Studio Light */}
        <directionalLight
          position={[3, 5, 4]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />

        {/* Soft Warm Front-Left Fill */}
        <directionalLight position={[-3, 2, 2.5]} intensity={0.45} color="#fff1e6" />

        {/* Vibrant Silhouette Rim / Back Light on White Fur */}
        <directionalLight position={[0, 4.5, -4.5]} intensity={1.6} color="#67e8f9" />

        {/* Anti-Gravity Cyan Underglow */}
        <pointLight position={[0, -0.15, 0]} intensity={2.2} distance={3.0} color="#00f3ff" />

        {/* Floating Weightless Particles */}
        <FloatingParticles count={40} />

        {/* Motion Energy Ribbons (Active during spin/fly) */}
        <FloatingEnvironment />

        {/* 3D Rabbit Character (Supports real GLB or procedural rig) */}
        <ModelManager
          customModelUrl={modelUrl}
          rig={rigRefs}
          emotion={emotion}
          isBlinking={isBlinking}
          blinkProgress={blinkProgress}
          mouthOpen={mouthOpen}
          eyeOffset={eyeOffset}
          onPointerDown={handlePointerDown}
          onEarClick={handleEarClick}
          onHeadClick={handleHeadClick}
          onBodyClick={handleBodyClick}
        />

        {/* Anti-Gravity Procedural Motion Controller */}
        <AntiGravityController rig={rigRefs} />

        {/* Cursor Gaze Tracking & Drag Handler */}
        <InteractionManager rig={rigRefs} onEyeOffsetChange={setEyeOffset} />

        {/* Smooth OrbitControls enabled by default */}
        {enableOrbit && (
          <OrbitControls
            target={[0, 0.6, 0]}
            enablePan={false}
            enableDamping
            dampingFactor={0.06}
            minDistance={1.8}
            maxDistance={5.5}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2 + 0.15}
          />
        )}
      </Canvas>
    </div>
  );
};
