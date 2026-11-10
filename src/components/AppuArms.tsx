import React, { forwardRef } from 'react';
import * as THREE from 'three';
import {
  ceramicWhiteMaterial,
  goldMetallicMaterial,
  graphiteJointMaterial,
} from './materials';

interface AppuArmsProps {
  leftArmRef?: React.RefObject<THREE.Group | null>;
  rightArmRef?: React.RefObject<THREE.Group | null>;
  leftForearmRef?: React.RefObject<THREE.Group | null>;
  rightForearmRef?: React.RefObject<THREE.Group | null>;
}

export const AppuArms = forwardRef<THREE.Group, AppuArmsProps>(
  ({ leftArmRef, rightArmRef, leftForearmRef, rightForearmRef }, _ref) => {
    return (
      <group name="ArmsGroup">
        {/* LEFT ARM (Viewer's right side, +X) */}
        <group
          ref={leftArmRef}
          name="LeftArm"
          position={[0.55, -0.02, 0.04]}
        >
          {/* Anatomical rounded shoulder ball joint */}
          <mesh name="LeftShoulder" material={graphiteJointMaterial} castShadow>
            <sphereGeometry args={[0.096, 28, 28]} />
          </mesh>
          {/* Ceramic shoulder armor cap */}
          <mesh
            material={ceramicWhiteMaterial}
            position={[0.02, 0.03, 0]}
            scale={[1.1, 0.9, 1.0]}
            castShadow
          >
            <sphereGeometry args={[0.094, 24, 24]} />
          </mesh>
          {/* Gold shoulder accent ring */}
          <mesh material={goldMetallicMaterial} position={[0.02, -0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.092, 0.012, 16, 32]} />
          </mesh>

          {/* Upper Arm Pivot */}
          <group name="LeftUpperArm" position={[0, -0.04, 0]}>
            {/* Glossy ceramic upper arm bicep */}
            <mesh material={ceramicWhiteMaterial} position={[0, -0.11, 0]} castShadow>
              <cylinderGeometry args={[0.074, 0.068, 0.20, 28]} />
            </mesh>
            {/* Gold upper arm ring */}
            <mesh material={goldMetallicMaterial} position={[0, -0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.070, 0.009, 16, 28]} />
            </mesh>

            {/* Elbow joint */}
            <mesh name="LeftElbow" material={graphiteJointMaterial} position={[0, -0.21, 0]} castShadow>
              <sphereGeometry args={[0.070, 24, 24]} />
            </mesh>

            {/* Forearm Pivot */}
            <group
              ref={leftForearmRef}
              name="LeftForearm"
              position={[0, -0.21, 0]}
            >
              {/* Ceramic forearm */}
              <mesh material={ceramicWhiteMaterial} position={[0, -0.10, 0]} castShadow>
                <cylinderGeometry args={[0.068, 0.062, 0.19, 28]} />
              </mesh>
              {/* Gold wrist collar */}
              <mesh material={goldMetallicMaterial} position={[0, -0.19, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.064, 0.01, 16, 28]} />
              </mesh>

              {/* Hand & Articulated Fingers (Facing inward toward the hip/thigh like a normal robot) */}
              <group name="LeftHand" position={[0, -0.23, 0]}>
                {/* Graphite palm */}
                <mesh material={graphiteJointMaterial} scale={[0.7, 1.0, 0.85]} castShadow>
                  <sphereGeometry args={[0.066, 24, 24]} />
                </mesh>

                {/* Thumb pointing naturally forward-inward */}
                <group position={[-0.02, -0.01, 0.04]} rotation={[THREE.MathUtils.degToRad(-25), 0, THREE.MathUtils.degToRad(-20)]}>
                  <mesh material={ceramicWhiteMaterial} position={[0, -0.032, 0]} castShadow>
                    <capsuleGeometry args={[0.015, 0.042, 12, 16]} />
                  </mesh>
                  <mesh material={goldMetallicMaterial} position={[0, -0.058, 0]}>
                    <sphereGeometry args={[0.013, 12, 12]} />
                  </mesh>
                </group>

                {/* Index finger pointing downward */}
                <group position={[-0.01, -0.05, 0.028]} rotation={[THREE.MathUtils.degToRad(8), 0, THREE.MathUtils.degToRad(-5)]}>
                  <mesh material={ceramicWhiteMaterial} position={[0, -0.038, 0]} castShadow>
                    <capsuleGeometry args={[0.014, 0.055, 12, 16]} />
                  </mesh>
                  <mesh material={goldMetallicMaterial} position={[0, -0.068, 0]}>
                    <sphereGeometry args={[0.012, 12, 12]} />
                  </mesh>
                </group>

                {/* Middle finger */}
                <group position={[-0.01, -0.055, 0.002]} rotation={[0, 0, THREE.MathUtils.degToRad(-5)]}>
                  <mesh material={ceramicWhiteMaterial} position={[0, -0.042, 0]} castShadow>
                    <capsuleGeometry args={[0.015, 0.060, 12, 16]} />
                  </mesh>
                  <mesh material={goldMetallicMaterial} position={[0, -0.074, 0]}>
                    <sphereGeometry args={[0.013, 12, 12]} />
                  </mesh>
                </group>

                {/* Ring / Pinky finger */}
                <group position={[-0.01, -0.05, -0.024]} rotation={[THREE.MathUtils.degToRad(-8), 0, THREE.MathUtils.degToRad(-5)]}>
                  <mesh material={ceramicWhiteMaterial} position={[0, -0.035, 0]} castShadow>
                    <capsuleGeometry args={[0.014, 0.050, 12, 16]} />
                  </mesh>
                  <mesh material={goldMetallicMaterial} position={[0, -0.064, 0]}>
                    <sphereGeometry args={[0.012, 12, 12]} />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>

        {/* RIGHT ARM (Viewer's left side, -X) */}
        <group
          ref={rightArmRef}
          name="RightArm"
          position={[-0.55, -0.02, 0.04]}
        >
          {/* Anatomical rounded shoulder ball joint */}
          <mesh name="RightShoulder" material={graphiteJointMaterial} castShadow>
            <sphereGeometry args={[0.096, 28, 28]} />
          </mesh>
          {/* Ceramic shoulder armor cap */}
          <mesh
            material={ceramicWhiteMaterial}
            position={[-0.02, 0.03, 0]}
            scale={[1.1, 0.9, 1.0]}
            castShadow
          >
            <sphereGeometry args={[0.094, 24, 24]} />
          </mesh>
          {/* Gold shoulder accent ring */}
          <mesh material={goldMetallicMaterial} position={[-0.02, -0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.092, 0.012, 16, 32]} />
          </mesh>

          {/* Upper Arm Pivot */}
          <group name="RightUpperArm" position={[0, -0.04, 0]}>
            {/* Glossy ceramic upper arm bicep */}
            <mesh material={ceramicWhiteMaterial} position={[0, -0.11, 0]} castShadow>
              <cylinderGeometry args={[0.074, 0.068, 0.20, 28]} />
            </mesh>
            {/* Gold upper arm ring */}
            <mesh material={goldMetallicMaterial} position={[0, -0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.070, 0.009, 16, 28]} />
            </mesh>

            {/* Elbow joint */}
            <mesh name="RightElbow" material={graphiteJointMaterial} position={[0, -0.21, 0]} castShadow>
              <sphereGeometry args={[0.070, 24, 24]} />
            </mesh>

            {/* Forearm Pivot */}
            <group
              ref={rightForearmRef}
              name="RightForearm"
              position={[0, -0.21, 0]}
            >
              {/* Ceramic forearm */}
              <mesh material={ceramicWhiteMaterial} position={[0, -0.10, 0]} castShadow>
                <cylinderGeometry args={[0.068, 0.062, 0.19, 28]} />
              </mesh>
              {/* Gold wrist collar */}
              <mesh material={goldMetallicMaterial} position={[0, -0.19, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.064, 0.01, 16, 28]} />
              </mesh>

              {/* Hand & Articulated Fingers (Facing inward toward the hip/thigh like a normal robot) */}
              <group name="RightHand" position={[0, -0.23, 0]}>
                {/* Graphite palm */}
                <mesh material={graphiteJointMaterial} scale={[0.7, 1.0, 0.85]} castShadow>
                  <sphereGeometry args={[0.066, 24, 24]} />
                </mesh>

                {/* Thumb pointing naturally forward-inward */}
                <group position={[0.02, -0.01, 0.04]} rotation={[THREE.MathUtils.degToRad(-25), 0, THREE.MathUtils.degToRad(20)]}>
                  <mesh material={ceramicWhiteMaterial} position={[0, -0.032, 0]} castShadow>
                    <capsuleGeometry args={[0.015, 0.042, 12, 16]} />
                  </mesh>
                  <mesh material={goldMetallicMaterial} position={[0, -0.058, 0]}>
                    <sphereGeometry args={[0.013, 12, 12]} />
                  </mesh>
                </group>

                {/* Index finger pointing downward */}
                <group position={[0.01, -0.05, 0.028]} rotation={[THREE.MathUtils.degToRad(8), 0, THREE.MathUtils.degToRad(5)]}>
                  <mesh material={ceramicWhiteMaterial} position={[0, -0.038, 0]} castShadow>
                    <capsuleGeometry args={[0.014, 0.055, 12, 16]} />
                  </mesh>
                  <mesh material={goldMetallicMaterial} position={[0, -0.068, 0]}>
                    <sphereGeometry args={[0.012, 12, 12]} />
                  </mesh>
                </group>

                {/* Middle finger */}
                <group position={[0.01, -0.055, 0.002]} rotation={[0, 0, THREE.MathUtils.degToRad(5)]}>
                  <mesh material={ceramicWhiteMaterial} position={[0, -0.042, 0]} castShadow>
                    <capsuleGeometry args={[0.015, 0.060, 12, 16]} />
                  </mesh>
                  <mesh material={goldMetallicMaterial} position={[0, -0.074, 0]}>
                    <sphereGeometry args={[0.013, 12, 12]} />
                  </mesh>
                </group>

                {/* Ring / Pinky finger */}
                <group position={[0.01, -0.05, -0.024]} rotation={[THREE.MathUtils.degToRad(-8), 0, THREE.MathUtils.degToRad(5)]}>
                  <mesh material={ceramicWhiteMaterial} position={[0, -0.035, 0]} castShadow>
                    <capsuleGeometry args={[0.014, 0.050, 12, 16]} />
                  </mesh>
                  <mesh material={goldMetallicMaterial} position={[0, -0.064, 0]}>
                    <sphereGeometry args={[0.012, 12, 12]} />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    );
  }
);

AppuArms.displayName = 'AppuArms';
