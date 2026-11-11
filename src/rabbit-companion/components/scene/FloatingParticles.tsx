import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FloatingParticlesProps {
  count?: number;
}

export const FloatingParticles: React.FC<FloatingParticlesProps> = ({ count = 45 }) => {
  const pointsRef = useRef<THREE.Points | null>(null);

  // Generate initial particle positions and random drift velocities
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = Math.random() * 4 - 1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;

      vel[i * 3 + 0] = (Math.random() - 0.5) * 0.05;
      vel[i * 3 + 1] = 0.08 + Math.random() * 0.12; // Gentle upward levitation
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }

    return [pos, vel];
  }, [count]);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;
    const safeDelta = Math.min(delta, 0.1);

    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 1] += velocities[i * 3 + 1] * safeDelta;
      posArray[i * 3 + 0] += velocities[i * 3 + 0] * safeDelta;

      // Wrap around vertically to keep particles circulating
      if (posArray[i * 3 + 1] > 3.5) {
        posArray[i * 3 + 1] = -1.2;
        posArray[i * 3 + 0] = (Math.random() - 0.5) * 5;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 4;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#80e9ff"
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};
