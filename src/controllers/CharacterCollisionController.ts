import * as THREE from 'three';

export interface BoxObstacle {
  id: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface CollisionResult {
  hasCollision: boolean;
  contactPoint: THREE.Vector3;
  normal: THREE.Vector3;
  penetration: number;
  impactSpeed: number;
  obstacleType: 'boundary' | 'obstacle' | 'none';
  obstacleId?: string;
}

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

export class CharacterCollisionController {
  private bounds: StageBounds;
  private obstacles: Map<string, BoxObstacle> = new Map();
  private characterRadius: number = 0.32;

  constructor(bounds: StageBounds = DEFAULT_STAGE_BOUNDS) {
    this.bounds = bounds;
  }

  public setBounds(bounds: StageBounds) {
    this.bounds = bounds;
  }

  public getBounds(): StageBounds {
    return this.bounds;
  }

  public setCharacterRadius(radius: number) {
    this.characterRadius = radius;
  }

  public getCharacterRadius(): number {
    return this.characterRadius;
  }

  public addBoxObstacle(id: string, center: [number, number, number], size: [number, number, number]) {
    const halfX = size[0] / 2;
    const halfY = size[1] / 2;
    const halfZ = size[2] / 2;
    this.obstacles.set(id, {
      id,
      min: new THREE.Vector3(center[0] - halfX, center[1] - halfY, center[2] - halfZ),
      max: new THREE.Vector3(center[0] + halfX, center[1] + halfY, center[2] + halfZ),
    });
  }

  public removeObstacle(id: string) {
    this.obstacles.delete(id);
  }

  public clearObstacles() {
    this.obstacles.clear();
  }

  /**
   * Tests whether character at position with given velocity collides with boundaries or obstacles.
   */
  public testCollision(pos: THREE.Vector3, velocity: THREE.Vector3): CollisionResult {
    let maxImpactSpeed = 0;
    let worstResult: CollisionResult = {
      hasCollision: false,
      contactPoint: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      penetration: 0,
      impactSpeed: 0,
      obstacleType: 'none',
    };

    const speed = velocity.length();

    // 1. Boundary checks
    // Max X
    if (pos.x + this.characterRadius > this.bounds.maxX) {
      const pen = pos.x + this.characterRadius - this.bounds.maxX;
      const normal = new THREE.Vector3(-1, 0, 0);
      const impact = Math.max(0, -velocity.dot(normal));
      if (pen > worstResult.penetration || impact > maxImpactSpeed) {
        maxImpactSpeed = impact;
        worstResult = {
          hasCollision: true,
          contactPoint: new THREE.Vector3(this.bounds.maxX, pos.y, pos.z),
          normal,
          penetration: pen,
          impactSpeed: impact || speed,
          obstacleType: 'boundary',
        };
      }
    }
    // Min X
    if (pos.x - this.characterRadius < this.bounds.minX) {
      const pen = this.bounds.minX - (pos.x - this.characterRadius);
      const normal = new THREE.Vector3(1, 0, 0);
      const impact = Math.max(0, -velocity.dot(normal));
      if (pen > worstResult.penetration || impact > maxImpactSpeed) {
        maxImpactSpeed = impact;
        worstResult = {
          hasCollision: true,
          contactPoint: new THREE.Vector3(this.bounds.minX, pos.y, pos.z),
          normal,
          penetration: pen,
          impactSpeed: impact || speed,
          obstacleType: 'boundary',
        };
      }
    }
    // Max Z
    if (pos.z + this.characterRadius > this.bounds.maxZ) {
      const pen = pos.z + this.characterRadius - this.bounds.maxZ;
      const normal = new THREE.Vector3(0, 0, -1);
      const impact = Math.max(0, -velocity.dot(normal));
      if (pen > worstResult.penetration || impact > maxImpactSpeed) {
        maxImpactSpeed = impact;
        worstResult = {
          hasCollision: true,
          contactPoint: new THREE.Vector3(pos.x, pos.y, this.bounds.maxZ),
          normal,
          penetration: pen,
          impactSpeed: impact || speed,
          obstacleType: 'boundary',
        };
      }
    }
    // Min Z
    if (pos.z - this.characterRadius < this.bounds.minZ) {
      const pen = this.bounds.minZ - (pos.z - this.characterRadius);
      const normal = new THREE.Vector3(0, 0, 1);
      const impact = Math.max(0, -velocity.dot(normal));
      if (pen > worstResult.penetration || impact > maxImpactSpeed) {
        maxImpactSpeed = impact;
        worstResult = {
          hasCollision: true,
          contactPoint: new THREE.Vector3(pos.x, pos.y, this.bounds.minZ),
          normal,
          penetration: pen,
          impactSpeed: impact || speed,
          obstacleType: 'boundary',
        };
      }
    }

    // 2. Obstacles check (circle vs AABB on XZ plane)
    for (const [id, box] of this.obstacles.entries()) {
      // Find closest point on box to circle center
      const closestX = THREE.MathUtils.clamp(pos.x, box.min.x, box.max.x);
      const closestZ = THREE.MathUtils.clamp(pos.z, box.min.z, box.max.z);

      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < this.characterRadius * this.characterRadius) {
        const dist = Math.sqrt(distSq);
        const pen = this.characterRadius - dist;
        let normal = new THREE.Vector3();

        if (dist > 0.0001) {
          normal.set(dx / dist, 0, dz / dist);
        } else {
          // Inside box center, resolve along closest face
          const dLeft = Math.abs(pos.x - box.min.x);
          const dRight = Math.abs(box.max.x - pos.x);
          const dBack = Math.abs(pos.z - box.min.z);
          const dFront = Math.abs(box.max.z - pos.z);
          const minD = Math.min(dLeft, dRight, dBack, dFront);

          if (minD === dLeft) normal.set(-1, 0, 0);
          else if (minD === dRight) normal.set(1, 0, 0);
          else if (minD === dBack) normal.set(0, 0, -1);
          else normal.set(0, 0, 1);
        }

        const impact = Math.max(0, -velocity.dot(normal));
        if (pen > worstResult.penetration || impact > maxImpactSpeed) {
          maxImpactSpeed = impact;
          worstResult = {
            hasCollision: true,
            contactPoint: new THREE.Vector3(closestX, pos.y, closestZ),
            normal,
            penetration: pen,
            impactSpeed: impact || speed,
            obstacleType: 'obstacle',
            obstacleId: id,
          };
        }
      }
    }

    return worstResult;
  }

  /**
   * Resolves position so character does not penetrate boundaries or obstacles.
   * Returns corrected position and contact information.
   */
  public resolvePosition(targetPos: THREE.Vector3): {
    position: THREE.Vector3;
    collided: boolean;
    normal: THREE.Vector3;
    penetration: number;
    obstacleType: 'boundary' | 'obstacle' | 'none';
    obstacleId?: string;
  } {
    const resolved = targetPos.clone();
    let collided = false;
    let mainNormal = new THREE.Vector3();
    let maxPen = 0;
    let obsType: 'boundary' | 'obstacle' | 'none' = 'none';
    let obsId: string | undefined;

    // 1. Clamp to boundary walls
    if (resolved.x + this.characterRadius > this.bounds.maxX) {
      const pen = resolved.x + this.characterRadius - this.bounds.maxX;
      resolved.x = this.bounds.maxX - this.characterRadius;
      collided = true;
      mainNormal.set(-1, 0, 0);
      maxPen = Math.max(maxPen, pen);
      obsType = 'boundary';
    } else if (resolved.x - this.characterRadius < this.bounds.minX) {
      const pen = this.bounds.minX - (resolved.x - this.characterRadius);
      resolved.x = this.bounds.minX + this.characterRadius;
      collided = true;
      mainNormal.set(1, 0, 0);
      maxPen = Math.max(maxPen, pen);
      obsType = 'boundary';
    }

    if (resolved.z + this.characterRadius > this.bounds.maxZ) {
      const pen = resolved.z + this.characterRadius - this.bounds.maxZ;
      resolved.z = this.bounds.maxZ - this.characterRadius;
      collided = true;
      mainNormal.set(0, 0, -1);
      maxPen = Math.max(maxPen, pen);
      obsType = 'boundary';
    } else if (resolved.z - this.characterRadius < this.bounds.minZ) {
      const pen = this.bounds.minZ - (resolved.z - this.characterRadius);
      resolved.z = this.bounds.minZ + this.characterRadius;
      collided = true;
      mainNormal.set(0, 0, 1);
      maxPen = Math.max(maxPen, pen);
      obsType = 'boundary';
    }

    // 2. Resolve against obstacles
    for (const [id, box] of this.obstacles.entries()) {
      const closestX = THREE.MathUtils.clamp(resolved.x, box.min.x, box.max.x);
      const closestZ = THREE.MathUtils.clamp(resolved.z, box.min.z, box.max.z);

      const dx = resolved.x - closestX;
      const dz = resolved.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < this.characterRadius * this.characterRadius) {
        collided = true;
        obsType = 'obstacle';
        obsId = id;
        const dist = Math.sqrt(distSq);

        if (dist > 0.0001) {
          const pen = this.characterRadius - dist;
          resolved.x += (dx / dist) * pen;
          resolved.z += (dz / dist) * pen;
          mainNormal.set(dx / dist, 0, dz / dist);
          maxPen = Math.max(maxPen, pen);
        } else {
          // Push out along closest side
          const dLeft = Math.abs(resolved.x - box.min.x);
          const dRight = Math.abs(box.max.x - resolved.x);
          const dBack = Math.abs(resolved.z - box.min.z);
          const dFront = Math.abs(box.max.z - resolved.z);
          const minD = Math.min(dLeft, dRight, dBack, dFront);

          if (minD === dLeft) {
            resolved.x = box.min.x - this.characterRadius;
            mainNormal.set(-1, 0, 0);
          } else if (minD === dRight) {
            resolved.x = box.max.x + this.characterRadius;
            mainNormal.set(1, 0, 0);
          } else if (minD === dBack) {
            resolved.z = box.min.z - this.characterRadius;
            mainNormal.set(0, 0, -1);
          } else {
            resolved.z = box.max.z + this.characterRadius;
            mainNormal.set(0, 0, 1);
          }
          maxPen = Math.max(maxPen, this.characterRadius);
        }
      }
    }

    return {
      position: resolved,
      collided,
      normal: mainNormal,
      penetration: maxPen,
      obstacleType: obsType,
      obstacleId: obsId,
    };
  }
}
