import React, { forwardRef } from 'react';
import * as THREE from 'three';
import { rabbitMaterials } from './RabbitMaterials';

interface RabbitLegsProps {
  leftLegRef?: React.RefObject<THREE.Group | null>;
  rightLegRef?: React.RefObject<THREE.Group | null>;
  leftFootRef?: React.RefObject<THREE.Group | null>;
  rightFootRef?: React.RefObject<THREE.Group | null>;
}

export const RabbitLegs = forwardRef<THREE.Group, RabbitLegsProps>(
  ({ leftLegRef, rightLegRef, leftFootRef, rightFootRef }, _ref) => {
    return (
      <group name="RabbitLegsRoot" position={[0, 0.16, 0]}>
        {/* Hip/Pelvis Beige Cargo Base */}
        <mesh position={[0, 0.05, 0]} material={rabbitMaterials.cargoPants}>
          <cylinderGeometry args={[0.34, 0.32, 0.16, 32]} />
        </mesh>

        {/* LEFT LEG */}
        <group ref={leftLegRef} name="LeftHip" position={[-0.17, 0, 0]}>
          {/* Upper Thigh Jogger Pant */}
          <mesh position={[0, -0.16, 0]} material={rabbitMaterials.cargoPants}>
            <cylinderGeometry args={[0.13, 0.11, 0.3, 20]} />
          </mesh>

          {/* Left Cargo Flap Pocket on Lateral Side */}
          <mesh position={[-0.11, -0.16, 0.02]} rotation={[0, 0, -0.05]} material={rabbitMaterials.cargoPants}>
            <boxGeometry args={[0.04, 0.12, 0.1]} />
          </mesh>

          {/* Knee / Lower Calf */}
          <group position={[0, -0.32, 0]}>
            <mesh position={[0, -0.1, 0]} material={rabbitMaterials.cargoPants}>
              <cylinderGeometry args={[0.105, 0.09, 0.2, 20]} />
            </mesh>
            {/* Jogger Ankle Cuff */}
            <mesh position={[0, -0.2, 0]} material={rabbitMaterials.cargoPants}>
              <torusGeometry args={[0.08, 0.02, 12, 20]} />
            </mesh>

            {/* Left Sneaker Foot */}
            <group ref={leftFootRef} position={[0, -0.23, 0.06]}>
              {/* White Rubber Sneaker Sole */}
              <mesh position={[0, -0.04, 0]} material={rabbitMaterials.sneakerWhite}>
                <boxGeometry args={[0.14, 0.04, 0.26]} />
              </mesh>
              {/* White Toe Cap */}
              <mesh position={[0, -0.02, 0.1]} scale={[0.13, 0.06, 0.08]} material={rabbitMaterials.sneakerWhite}>
                <sphereGeometry args={[1, 16, 16]} />
              </mesh>
              {/* Navy Sneaker Body Upper */}
              <mesh position={[0, 0, -0.02]} scale={[0.13, 0.07, 0.2]} material={rabbitMaterials.sneakerNavy}>
                <boxGeometry args={[1, 1, 1]} />
              </mesh>
              {/* Sneaker White Lace Band */}
              <mesh position={[0, 0.035, 0.02]} rotation={[-0.3, 0, 0]} material={rabbitMaterials.sneakerWhite}>
                <boxGeometry args={[0.09, 0.015, 0.05]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* RIGHT LEG */}
        <group ref={rightLegRef} name="RightHip" position={[0.17, 0, 0]}>
          {/* Upper Thigh Jogger Pant */}
          <mesh position={[0, -0.16, 0]} material={rabbitMaterials.cargoPants}>
            <cylinderGeometry args={[0.13, 0.11, 0.3, 20]} />
          </mesh>

          {/* Right Cargo Flap Pocket on Lateral Side */}
          <mesh position={[0.11, -0.16, 0.02]} rotation={[0, 0, 0.05]} material={rabbitMaterials.cargoPants}>
            <boxGeometry args={[0.04, 0.12, 0.1]} />
          </mesh>

          {/* Knee / Lower Calf */}
          <group position={[0, -0.32, 0]}>
            <mesh position={[0, -0.1, 0]} material={rabbitMaterials.cargoPants}>
              <cylinderGeometry args={[0.105, 0.09, 0.2, 20]} />
            </mesh>
            {/* Jogger Ankle Cuff */}
            <mesh position={[0, -0.2, 0]} material={rabbitMaterials.cargoPants}>
              <torusGeometry args={[0.08, 0.02, 12, 20]} />
            </mesh>

            {/* Right Sneaker Foot */}
            <group ref={rightFootRef} position={[0, -0.23, 0.06]}>
              {/* White Rubber Sneaker Sole */}
              <mesh position={[0, -0.04, 0]} material={rabbitMaterials.sneakerWhite}>
                <boxGeometry args={[0.14, 0.04, 0.26]} />
              </mesh>
              {/* White Toe Cap */}
              <mesh position={[0, -0.02, 0.1]} scale={[0.13, 0.06, 0.08]} material={rabbitMaterials.sneakerWhite}>
                <sphereGeometry args={[1, 16, 16]} />
              </mesh>
              {/* Navy Sneaker Body Upper */}
              <mesh position={[0, 0, -0.02]} scale={[0.13, 0.07, 0.2]} material={rabbitMaterials.sneakerNavy}>
                <boxGeometry args={[1, 1, 1]} />
              </mesh>
              {/* Sneaker White Lace Band */}
              <mesh position={[0, 0.035, 0.02]} rotation={[-0.3, 0, 0]} material={rabbitMaterials.sneakerWhite}>
                <boxGeometry args={[0.09, 0.015, 0.05]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    );
  }
);

RabbitLegs.displayName = 'RabbitLegs';
