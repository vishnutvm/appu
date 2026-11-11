import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rabbitMaterials } from '../character/RabbitMaterials';
import { useRabbitStore } from '../../state/rabbitStore';

export const FloatingEnvironment: React.FC = () => {
  const { action, isSpinning } = useRabbitStore();
  const ringRef = useRef<THREE.Mesh | null>(null);
  const outerRippleRef = useRef<THREE.Mesh | null>(null);
  const spiralRef = useRef<THREE.Group | null>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Pulse and rotate the main anti-gravity cyan ring
    if (ringRef.current) {
      ringRef.current.rotation.z = time * 0.8;
      const pulse = 1 + Math.sin(time * 3) * 0.08;
      ringRef.current.scale.set(pulse, pulse, 1);
    }

    // Outer ripple breathing
    if (outerRippleRef.current) {
      outerRippleRef.current.rotation.z = -time * 0.4;
      const outerPulse = 1 + Math.sin(time * 2 + 1) * 0.12;
      outerRippleRef.current.scale.set(outerPulse, outerPulse, 1);
    }

    // Spin spiral ribbon animation
    if (spiralRef.current) {
      spiralRef.current.rotation.y = time * 6.0;
    }
  });

  return (
    <group position={[0, -0.2, 0]}>
      {/* Primary Glowing Anti-Gravity Energy Ring (As seen in character sheet) */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        material={rabbitMaterials.antiGravityGlow}
      >
        <torusGeometry args={[0.62, 0.032, 16, 48]} />
      </mesh>

      {/* Secondary Soft Ambient Floor Ripple */}
      <mesh
        ref={outerRippleRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      >
        <torusGeometry args={[0.9, 0.015, 16, 48]} />
        <meshBasicMaterial
          color="#00f3ff"
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Spin Motion Spiral Ribbons (Visible when spinning or flying) */}
      {(action === 'spin' || action === 'fly' || isSpinning) && (
        <group ref={spiralRef} position={[0, 0.6, 0]}>
          <mesh rotation={[0.4, 0, 0]}>
            <torusGeometry args={[0.75, 0.02, 12, 48]} />
            <meshBasicMaterial color="#00f3ff" transparent opacity={0.6} />
          </mesh>
          <mesh rotation={[-0.4, 0, 0]}>
            <torusGeometry args={[0.85, 0.018, 12, 48]} />
            <meshBasicMaterial color="#80e9ff" transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      {/* Soft Floating Pedestal Disk */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[1.2, 1.3, 0.08, 32]} />
        <meshStandardMaterial
          color="#161c28"
          roughness={0.7}
          metalness={0.2}
          transparent
          opacity={0.65}
        />
      </mesh>
    </group>
  );
};
