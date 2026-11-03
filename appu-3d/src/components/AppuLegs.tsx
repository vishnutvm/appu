import React, { forwardRef } from 'react';
import * as THREE from 'three';
import {
  ceramicWhiteMaterial,
  goldMetallicMaterial,
  graphiteJointMaterial,
} from './materials';

interface AppuLegsProps {
  leftLegRef?: React.RefObject<THREE.Group | null>;
  rightLegRef?: React.RefObject<THREE.Group | null>;
  leftLowerLegRef?: React.RefObject<THREE.Group | null>;
  rightLowerLegRef?: React.RefObject<THREE.Group | null>;
}

export const AppuLegs = forwardRef<THREE.Group, AppuLegsProps>(
  ({ leftLegRef, rightLegRef, leftLowerLegRef, rightLowerLegRef }, _ref) => {
    return (
      <group name="LegsGroup">
        {/* LEFT LEG (+X, matching LeftArm) */}
        <group
          ref={leftLegRef}
          name="LeftLeg"
          position={[0.24, -0.56, 0]}
        >
          {/* Substantial hip socket ball joint */}
          <mesh material={graphiteJointMaterial} castShadow>
            <sphereGeometry args={[0.095, 24, 24]} />
          </mesh>
          <mesh material={goldMetallicMaterial} position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.092, 0.012, 16, 28]} />
          </mesh>

          {/* Upper Leg / Thigh */}
          <mesh material={ceramicWhiteMaterial} position={[0, -0.11, 0]} castShadow>
            <cylinderGeometry args={[0.082, 0.074, 0.22, 28]} />
          </mesh>
          {/* Lower thigh gold trim */}
          <mesh material={goldMetallicMaterial} position={[0, -0.20, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.076, 0.009, 16, 28]} />
          </mesh>

          {/* Knee joint */}
          <mesh material={graphiteJointMaterial} position={[0, -0.23, 0]} castShadow>
            <sphereGeometry args={[0.075, 24, 24]} />
          </mesh>

          {/* Lower Leg / Calf & Boot */}
          <group
            ref={leftLowerLegRef}
            name="LeftLowerLeg"
            position={[0, -0.23, 0]}
          >
            {/* Ceramic calf */}
            <mesh material={ceramicWhiteMaterial} position={[0, -0.11, 0]} castShadow>
              <cylinderGeometry args={[0.074, 0.072, 0.20, 28]} />
            </mesh>
            {/* Ankle joint collar */}
            <mesh material={graphiteJointMaterial} position={[0, -0.21, 0]}>
              <cylinderGeometry args={[0.078, 0.078, 0.03, 24]} />
            </mesh>
            <mesh material={goldMetallicMaterial} position={[0, -0.21, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.08, 0.009, 16, 28]} />
            </mesh>

            {/* Stable Rounded Ceramic Boot */}
            <group name="LeftFoot" position={[0, -0.28, 0.06]}>
              {/* Boot ceramic body */}
              <mesh material={ceramicWhiteMaterial} scale={[0.9, 0.85, 1.4]} castShadow>
                <sphereGeometry args={[0.135, 28, 28]} />
              </mesh>

              {/* Side graphite mechanical damper disc (facing outward +X) */}
              <mesh material={graphiteJointMaterial} position={[0.05, 0, -0.02]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.052, 0.052, 0.16, 24]} />
              </mesh>

              {/* Gold sole accent plate with stable flat profile */}
              <mesh material={goldMetallicMaterial} position={[0, -0.10, -0.01]} scale={[0.95, 0.7, 1.45]}>
                <cylinderGeometry args={[0.115, 0.125, 0.03, 28]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* RIGHT LEG (-X, matching RightArm) */}
        <group
          ref={rightLegRef}
          name="RightLeg"
          position={[-0.24, -0.56, 0]}
        >
          {/* Substantial hip socket ball joint */}
          <mesh material={graphiteJointMaterial} castShadow>
            <sphereGeometry args={[0.095, 24, 24]} />
          </mesh>
          <mesh material={goldMetallicMaterial} position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.092, 0.012, 16, 28]} />
          </mesh>

          {/* Upper Leg / Thigh */}
          <mesh material={ceramicWhiteMaterial} position={[0, -0.11, 0]} castShadow>
            <cylinderGeometry args={[0.082, 0.074, 0.22, 28]} />
          </mesh>
          {/* Lower thigh gold trim */}
          <mesh material={goldMetallicMaterial} position={[0, -0.20, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.076, 0.009, 16, 28]} />
          </mesh>

          {/* Knee joint */}
          <mesh material={graphiteJointMaterial} position={[0, -0.23, 0]} castShadow>
            <sphereGeometry args={[0.075, 24, 24]} />
          </mesh>

          {/* Lower Leg / Calf & Boot */}
          <group
            ref={rightLowerLegRef}
            name="RightLowerLeg"
            position={[0, -0.23, 0]}
          >
            {/* Ceramic calf */}
            <mesh material={ceramicWhiteMaterial} position={[0, -0.11, 0]} castShadow>
              <cylinderGeometry args={[0.074, 0.072, 0.20, 28]} />
            </mesh>
            {/* Ankle joint collar */}
            <mesh material={graphiteJointMaterial} position={[0, -0.21, 0]}>
              <cylinderGeometry args={[0.078, 0.078, 0.03, 24]} />
            </mesh>
            <mesh material={goldMetallicMaterial} position={[0, -0.21, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.08, 0.009, 16, 28]} />
            </mesh>

            {/* Stable Rounded Ceramic Boot */}
            <group name="RightFoot" position={[0, -0.28, 0.06]}>
              {/* Boot ceramic body */}
              <mesh material={ceramicWhiteMaterial} scale={[0.9, 0.85, 1.4]} castShadow>
                <sphereGeometry args={[0.135, 28, 28]} />
              </mesh>

              {/* Side graphite mechanical damper disc (facing outward -X) */}
              <mesh material={graphiteJointMaterial} position={[-0.05, 0, -0.02]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.052, 0.052, 0.16, 24]} />
              </mesh>

              {/* Gold sole accent plate with stable flat profile */}
              <mesh material={goldMetallicMaterial} position={[0, -0.10, -0.01]} scale={[0.95, 0.7, 1.45]}>
                <cylinderGeometry args={[0.115, 0.125, 0.03, 28]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    );
  }
);

AppuLegs.displayName = 'AppuLegs';
