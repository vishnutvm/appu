import * as THREE from 'three';

export interface StageBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_STAGE_BOUNDS: StageBounds = {
  minX: -2.0,
  maxX: 2.0,
  minZ: -1.2,
  maxZ: 1.2,
};

export class CharacterTransformController {
  private position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private bounds: StageBounds;

  constructor(bounds: StageBounds = DEFAULT_STAGE_BOUNDS) {
    this.bounds = bounds;
  }

  public getPosition(): THREE.Vector3 {
    return this.position;
  }

  public setPosition(x: number, y: number, z: number): THREE.Vector3 {
    this.position.set(
      THREE.MathUtils.clamp(x, this.bounds.minX, this.bounds.maxX),
      y,
      THREE.MathUtils.clamp(z, this.bounds.minZ, this.bounds.maxZ)
    );
    return this.position;
  }

  public translate(deltaX: number, deltaZ: number): THREE.Vector3 {
    return this.setPosition(
      this.position.x + deltaX,
      this.position.y,
      this.position.z + deltaZ
    );
  }

  public clampToBounds(pos: THREE.Vector3): THREE.Vector3 {
    pos.x = THREE.MathUtils.clamp(pos.x, this.bounds.minX, this.bounds.maxX);
    pos.z = THREE.MathUtils.clamp(pos.z, this.bounds.minZ, this.bounds.maxZ);
    return pos;
  }

  public isAtBoundary(pos: THREE.Vector3, threshold: number = 0.15): { hit: boolean; normal: THREE.Vector2 } {
    const normal = new THREE.Vector2(0, 0);
    let hit = false;

    if (pos.x >= this.bounds.maxX - threshold) {
      normal.x = -1;
      hit = true;
    } else if (pos.x <= this.bounds.minX + threshold) {
      normal.x = 1;
      hit = true;
    }

    if (pos.z >= this.bounds.maxZ - threshold) {
      normal.y = -1;
      hit = true;
    } else if (pos.z <= this.bounds.minZ + threshold) {
      normal.y = 1;
      hit = true;
    }

    return { hit, normal };
  }
}
