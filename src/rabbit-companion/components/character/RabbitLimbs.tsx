import React, { forwardRef } from 'react';
import * as THREE from 'three';
import { rabbitMaterials } from './RabbitMaterials';

interface RabbitLimbsProps {
  leftArmRef?: React.RefObject<THREE.Group | null>;
  rightArmRef?: React.RefObject<THREE.Group | null>;
}

export const RabbitLimbs = forwardRef<THREE.Group, RabbitLimbsProps>(
  ({ leftArmRef, rightArmRef }, _ref) => {
    return (
      <group name="RabbitArms">
        {/* LEFT ARM (Smartwatch on wrist) */}
        <group
          ref={leftArmRef}
          name="LeftShoulder"
          position={[-0.34, 0.65, 0]}
          rotation={[0, 0, 0.15]}
        >
          {/* Upper Arm Sleeve */}
          <mesh position={[0, -0.15, 0]} material={rabbitMaterials.hoodie}>
            <cylinderGeometry args={[0.09, 0.08, 0.3, 20]} />
          </mesh>

          {/* Elbow Joint / Forearm */}
          <group position={[0, -0.3, 0]} rotation={[0, 0, -0.1]}>
            {/* Forearm Sleeve */}
            <mesh position={[0, -0.1, 0]} material={rabbitMaterials.hoodie}>
              <cylinderGeometry args={[0.08, 0.075, 0.2, 20]} />
            </mesh>

            {/* Smartwatch on Left Wrist */}
            <group position={[0, -0.2, 0]}>
              {/* Watch Strap */}
              <mesh material={rabbitMaterials.watchBand}>
                <cylinderGeometry args={[0.082, 0.082, 0.05, 20]} />
              </mesh>
              {/* Glowing Watch Screen */}
              <mesh position={[0, 0, 0.085]} material={rabbitMaterials.watchScreen}>
                <boxGeometry args={[0.05, 0.05, 0.015]} />
              </mesh>
            </group>

            {/* Left White Bunny Paw */}
            <group position={[0, -0.27, 0]}>
              <mesh material={rabbitMaterials.fur} scale={[1, 1.2, 0.9]}>
                <sphereGeometry args={[0.08, 20, 20]} />
              </mesh>
              {/* Cute little thumb */}
              <mesh position={[0.06, 0.01, 0.03]} material={rabbitMaterials.fur}>
                <sphereGeometry args={[0.035, 12, 12]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* RIGHT ARM */}
        <group
          ref={rightArmRef}
          name="RightShoulder"
          position={[0.34, 0.65, 0]}
          rotation={[0, 0, -0.15]}
        >
          {/* Upper Arm Sleeve */}
          <mesh position={[0, -0.15, 0]} material={rabbitMaterials.hoodie}>
            <cylinderGeometry args={[0.09, 0.08, 0.3, 20]} />
          </mesh>

          {/* Elbow Joint / Forearm */}
          <group position={[0, -0.3, 0]} rotation={[0, 0, 0.1]}>
            {/* Forearm Sleeve */}
            <mesh position={[0, -0.1, 0]} material={rabbitMaterials.hoodie}>
              <cylinderGeometry args={[0.08, 0.075, 0.2, 20]} />
            </mesh>

            {/* Right White Bunny Paw */}
            <group position={[0, -0.27, 0]}>
              <mesh material={rabbitMaterials.fur} scale={[1, 1.2, 0.9]}>
                <sphereGeometry args={[0.08, 20, 20]} />
              </mesh>
              {/* Cute little thumb */}
              <mesh position={[-0.06, 0.01, 0.03]} material={rabbitMaterials.fur}>
                <sphereGeometry args={[0.035, 12, 12]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    );
  }
);

RabbitLimbs.displayName = 'RabbitLimbs';
