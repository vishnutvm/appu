import React, { forwardRef } from 'react';
import * as THREE from 'three';
import { rabbitMaterials } from './RabbitMaterials';

interface RabbitBodyProps {
  onBodyClick?: () => void;
  tailRef?: React.RefObject<THREE.Group | null>;
}

export const RabbitBody = forwardRef<THREE.Group, RabbitBodyProps>(
  ({ onBodyClick, tailRef }, ref) => {
    return (
      <group ref={ref} name="RabbitTorsoRoot" position={[0, 0.48, 0]}>
        {/* Navy-Blue Hoodie Main Torso */}
        <mesh
          name="HoodieBody"
          position={[0, 0, 0]}
          scale={[1.05, 1.15, 0.95]}
          material={rabbitMaterials.hoodie}
          onClick={(e) => {
            e.stopPropagation();
            onBodyClick?.();
          }}
        >
          {/* Tapered capsule/cylinder torso */}
          <cylinderGeometry args={[0.3, 0.34, 0.62, 32]} />
        </mesh>

        {/* Hoodie Kangaroo Front Pocket */}
        <mesh position={[0, -0.09, 0.26]} rotation={[0.08, 0, 0]} material={rabbitMaterials.hoodie}>
          <boxGeometry args={[0.34, 0.16, 0.08]} />
        </mesh>

        {/* White Undershirt Hem Peeking Out at Bottom */}
        <mesh position={[0, -0.32, 0]} material={rabbitMaterials.undershirt}>
          <cylinderGeometry args={[0.345, 0.35, 0.06, 32]} />
        </mesh>

        {/* Cream-colored Hood draped around neck/back */}
        <group position={[0, 0.28, -0.06]}>
          {/* Main draped hood volume */}
          <mesh material={rabbitMaterials.hoodie} scale={[1.2, 0.5, 1.1]}>
            <torusGeometry args={[0.26, 0.1, 16, 32]} />
          </mesh>
          {/* Cream inner lining of hood */}
          <mesh material={rabbitMaterials.hoodLining} scale={[1.16, 0.48, 1.05]}>
            <torusGeometry args={[0.25, 0.07, 16, 32]} />
          </mesh>
        </group>

        {/* Cream Hood Drawstrings (left & right) */}
        <group position={[0, 0.24, 0.28]}>
          <mesh position={[-0.08, -0.1, 0]} rotation={[0, 0, 0.05]} material={rabbitMaterials.hoodLining}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 12]} />
          </mesh>
          <mesh position={[-0.08, -0.21, 0]} material={rabbitMaterials.sneakerWhite}>
            <sphereGeometry args={[0.018, 12, 12]} />
          </mesh>

          <mesh position={[0.08, -0.1, 0]} rotation={[0, 0, -0.05]} material={rabbitMaterials.hoodLining}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 12]} />
          </mesh>
          <mesh position={[0.08, -0.21, 0]} material={rabbitMaterials.sneakerWhite}>
            <sphereGeometry args={[0.018, 12, 12]} />
          </mesh>
        </group>

        {/* Headphones draped around neck */}
        <group name="NeckHeadphones" position={[0, 0.32, 0.02]} rotation={[0.2, 0, 0]}>
          {/* Headband Arc */}
          <mesh material={rabbitMaterials.headbandMetal} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.36, 0.022, 16, 32, Math.PI]} />
          </mesh>

          {/* Left Earcup */}
          <group position={[-0.34, -0.05, 0.12]} rotation={[0.2, 0.4, 0.3]}>
            <mesh material={rabbitMaterials.headphonesBody}>
              <cylinderGeometry args={[0.11, 0.11, 0.06, 24]} />
            </mesh>
            <mesh position={[0, -0.035, 0]} material={rabbitMaterials.headphonesCushion}>
              <cylinderGeometry args={[0.1, 0.1, 0.03, 24]} />
            </mesh>
          </group>

          {/* Right Earcup */}
          <group position={[0.34, -0.05, 0.12]} rotation={[0.2, -0.4, -0.3]}>
            <mesh material={rabbitMaterials.headphonesBody}>
              <cylinderGeometry args={[0.11, 0.11, 0.06, 24]} />
            </mesh>
            <mesh position={[0, -0.035, 0]} material={rabbitMaterials.headphonesCushion}>
              <cylinderGeometry args={[0.1, 0.1, 0.03, 24]} />
            </mesh>
          </group>
        </group>

        {/* Fluffy Round Bunny Tail at back */}
        <group ref={tailRef} position={[0, -0.24, -0.3]}>
          <mesh material={rabbitMaterials.fur}>
            <sphereGeometry args={[0.12, 24, 24]} />
          </mesh>
        </group>
      </group>
    );
  }
);

RabbitBody.displayName = 'RabbitBody';
