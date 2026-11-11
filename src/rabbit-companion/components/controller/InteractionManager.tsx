import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useRabbitStore } from '../../state/rabbitStore';
import { RabbitRigRefs } from '../../types/rabbit';

interface InteractionManagerProps {
  rig: RabbitRigRefs;
  onEyeOffsetChange?: (offset: { x: number; y: number }) => void;
}

export const InteractionManager: React.FC<InteractionManagerProps> = ({
  rig,
  onEyeOffsetChange,
}) => {
  const { viewport } = useThree();
  const {
    isDragging,
    setIsDragging,
    triggerSpin,
    setEmotion,
  } = useRabbitStore();

  const mouseTargetRef = useRef<THREE.Vector2>(new THREE.Vector2(0, 0));
  const smoothHeadRotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastClickTimeRef = useRef<number>(0);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // Normalize pointer to -1 to +1
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseTargetRef.current.set(nx, ny);

      if (isDragging) {
        // Compute 3D drag offset based on viewport
        const dx = (nx - dragStartRef.current.x) * (viewport.width * 0.45);
        const dy = (ny - dragStartRef.current.y) * (viewport.height * 0.45);
        setIsDragging(true, [dx, dy, 0]);
      }
    };

    const handlePointerUp = () => {
      if (isDragging) {
        setIsDragging(false, [0, 0, 0]);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, setIsDragging, viewport]);

  useFrame((_state, delta) => {
    const safeDelta = Math.min(delta, 0.1);

    // 1. Head LookAt Gaze Tracking with Physiologic Limits
    // Yaw: max +/- 35 deg (~0.6 rad)
    // Pitch: max +/- 20 deg (~0.35 rad)
    const targetHeadYaw = -mouseTargetRef.current.x * 0.55;
    const targetHeadPitch = -mouseTargetRef.current.y * 0.3;

    smoothHeadRotRef.current.x = THREE.MathUtils.damp(
      smoothHeadRotRef.current.x,
      targetHeadPitch,
      6,
      safeDelta
    );
    smoothHeadRotRef.current.y = THREE.MathUtils.damp(
      smoothHeadRotRef.current.y,
      targetHeadYaw,
      6,
      safeDelta
    );

    if (rig.headRef.current) {
      rig.headRef.current.rotation.x = smoothHeadRotRef.current.x;
      rig.headRef.current.rotation.y = smoothHeadRotRef.current.y;
    }

    // 2. Eye Pupil Tracking Offset
    if (onEyeOffsetChange) {
      onEyeOffsetChange({
        x: mouseTargetRef.current.x * 0.6,
        y: mouseTargetRef.current.y * 0.4,
      });
    }
  });

  return null;
};
