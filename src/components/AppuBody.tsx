import React, { forwardRef } from 'react';
import * as THREE from 'three';
import {
  ceramicWhiteMaterial,
  goldMetallicMaterial,
  graphiteJointMaterial,
  chestEmblemMaterial,
  cyanCoreMaterial,
} from './materials';

interface AppuBodyProps {
  neckRef?: React.RefObject<THREE.Group | null>;
}

export const AppuBody = forwardRef<THREE.Group, AppuBodyProps>((_props, ref) => {
  return (
    <group ref={ref} name="BodyAndTorso">
      {/* Visible Articulated Neck Connection */}
      <group name="Neck" position={[0, 0.20, 0]}>
        {/* Graphite articulated neck column */}
        <mesh material={graphiteJointMaterial} castShadow>
          <cylinderGeometry args={[0.13, 0.16, 0.14, 36]} />
        </mesh>
        {/* Gold mechanical collar ring */}
        <mesh material={goldMetallicMaterial} position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.015, 16, 40]} />
        </mesh>
        {/* Lower graphite socket bezel */}
        <mesh material={graphiteJointMaterial} position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.165, 0.012, 16, 40]} />
        </mesh>
      </group>

      {/* Redesigned Substantial Torso */}
      <group name="Torso" position={[0, -0.16, 0]}>
        {/* Main upper ceramic chest shell - broader, anatomical */}
        <mesh
          name="UpperChestShell"
          material={ceramicWhiteMaterial}
          position={[0, 0.08, 0]}
          scale={[1.05, 0.95, 0.88]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.52, 64, 64]} />
        </mesh>

        {/* Lower torso abdomen taper */}
        <mesh
          name="AbdomenShell"
          material={ceramicWhiteMaterial}
          position={[0, -0.22, 0]}
          scale={[0.88, 0.85, 0.82]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.48, 48, 48]} />
        </mesh>

        {/* Mid-body graphite articulative waist band */}
        <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]} material={graphiteJointMaterial}>
          <cylinderGeometry args={[0.42, 0.43, 0.06, 40]} />
        </mesh>
        {/* Gold trim dividing waist */}
        <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMetallicMaterial}>
          <torusGeometry args={[0.435, 0.01, 16, 40]} />
        </mesh>

        {/* Elegant Chest Design with Subtle Cyan Illuminated Core on Front (+Z) */}
        <group name="ChestCore" position={[0, 0.12, 0.38]}>
          {/* Graphite protective shield plate */}
          <mesh
            material={chestEmblemMaterial}
            scale={[1.1, 0.95, 0.28]}
            castShadow
          >
            <sphereGeometry args={[0.22, 36, 36]} />
          </mesh>

          {/* Refined gold outer bezel */}
          <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={goldMetallicMaterial}>
            <torusGeometry args={[0.082, 0.012, 16, 36]} />
          </mesh>

          {/* Dark OLED core cavity */}
          <mesh position={[0, 0, 0.055]}>
            <circleGeometry args={[0.07, 32]} />
            <meshStandardMaterial color="#05080e" roughness={0.2} metalness={0.8} />
          </mesh>

          {/* Glowing cyan status core dot */}
          <mesh position={[0, 0, 0.062]} material={cyanCoreMaterial}>
            <circleGeometry args={[0.034, 28]} />
          </mesh>
        </group>
      </group>
    </group>
  );
});

AppuBody.displayName = 'AppuBody';
