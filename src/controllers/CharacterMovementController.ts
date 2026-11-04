import * as THREE from 'three';
import { CharacterCollisionController } from './CharacterCollisionController';

export interface MovementConfig {
  maxSpeed: number; // Maximum walking speed in m/s (default 1.15)
  acceleration: number; // m/s^2 (default 3.2)
  deceleration: number; // m/s^2 (default 4.5)
  stoppingDistance: number; // Distance at which target is considered reached (0.04 m)
  decelRadius: number; // Distance at which character starts braking (0.55 m)
  sensitivity: number; // Multiplier
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  maxSpeed: 1.15,
  acceleration: 3.2,
  deceleration: 4.5,
  stoppingDistance: 0.04,
  decelRadius: 0.55,
  sensitivity: 1.0,
};

export class CharacterMovementController {
  private velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private destination: THREE.Vector3 | null = null;
  private config: MovementConfig;

  constructor(config: Partial<MovementConfig> = {}) {
    this.config = { ...DEFAULT_MOVEMENT_CONFIG, ...config };
  }

  public setSensitivity(sensitivity: number) {
    this.config.sensitivity = THREE.MathUtils.clamp(sensitivity, 0.2, 2.5);
  }

  public getSensitivity(): number {
    return this.config.sensitivity;
  }

  public getVelocity(): THREE.Vector3 {
    return this.velocity;
  }

  public getSpeed(): number {
    return this.velocity.length();
  }

  public getDestination(): THREE.Vector3 | null {
    return this.destination;
  }

  public setDestination(x: number, z: number) {
    this.destination = new THREE.Vector3(x, 0, z);
  }

  public stop() {
    this.destination = null;
    this.velocity.set(0, 0, 0);
  }

  public resetVelocity() {
    this.velocity.set(0, 0, 0);
  }

  /**
   * Updates velocity and calculates new position for delta time `dt`.
   * Integrates collision resolution so character slides along walls instead of clipping.
   */
  public update(
    dt: number,
    currentPos: THREE.Vector3,
    canMove: boolean = true,
    collisionCtrl?: CharacterCollisionController
  ): {
    newPosition: THREE.Vector3;
    velocity: THREE.Vector3;
    speed: number;
    hasArrived: boolean;
    isMoving: boolean;
    targetDirection: THREE.Vector3;
    distanceToTarget: number;
    collidedWithObstacle: boolean;
  } {
    const targetDirection = new THREE.Vector3(0, 0, 0);
    const newPos = currentPos.clone();
    let collidedWithObstacle = false;

    const effectiveMaxSpeed = this.config.maxSpeed * this.config.sensitivity;
    const effectiveAccel = this.config.acceleration * this.config.sensitivity;
    const effectiveDecel = this.config.deceleration;

    if (!this.destination) {
      // Natural deceleration to full stop
      const currentSpeed = this.velocity.length();
      if (currentSpeed > 0.001) {
        const brake = Math.min(currentSpeed, effectiveDecel * dt);
        this.velocity.setLength(currentSpeed - brake);
      } else {
        this.velocity.set(0, 0, 0);
      }

      newPos.addScaledVector(this.velocity, dt);

      // Resolve collision on new position
      if (collisionCtrl) {
        const res = collisionCtrl.resolvePosition(newPos);
        newPos.copy(res.position);
        if (res.collided) {
          // Zero out velocity into collision normal
          const vIntoNormal = this.velocity.dot(res.normal);
          if (vIntoNormal < 0) {
            this.velocity.sub(res.normal.clone().multiplyScalar(vIntoNormal));
          }
        }
      }

      return {
        newPosition: newPos,
        velocity: this.velocity.clone(),
        speed: this.velocity.length(),
        hasArrived: false,
        isMoving: this.velocity.length() > 0.01,
        targetDirection,
        distanceToTarget: 0,
        collidedWithObstacle: false,
      };
    }

    // Vector to destination
    const toTarget = new THREE.Vector3(
      this.destination.x - currentPos.x,
      0,
      this.destination.z - currentPos.z
    );
    const distance = toTarget.length();

    if (distance <= this.config.stoppingDistance) {
      // Reached destination cleanly
      this.destination = null;
      this.velocity.set(0, 0, 0);
      return {
        newPosition: newPos,
        velocity: this.velocity.clone(),
        speed: 0,
        hasArrived: true,
        isMoving: false,
        targetDirection,
        distanceToTarget: 0,
        collidedWithObstacle: false,
      };
    }

    targetDirection.copy(toTarget).normalize();

    if (!canMove) {
      // Character is still turning or waiting: decelerate smoothly
      const currentSpeed = this.velocity.length();
      if (currentSpeed > 0.001) {
        const brake = Math.min(currentSpeed, effectiveDecel * dt);
        this.velocity.setLength(currentSpeed - brake);
      } else {
        this.velocity.set(0, 0, 0);
      }
      newPos.addScaledVector(this.velocity, dt);

      return {
        newPosition: newPos,
        velocity: this.velocity.clone(),
        speed: this.velocity.length(),
        hasArrived: false,
        isMoving: this.velocity.length() > 0.01,
        targetDirection,
        distanceToTarget: distance,
        collidedWithObstacle: false,
      };
    }

    // Desired speed with smooth deceleration curve near destination
    let desiredSpeed = effectiveMaxSpeed;
    if (distance < this.config.decelRadius) {
      const factor = Math.max(0.12, distance / this.config.decelRadius);
      desiredSpeed *= factor;
    }

    const desiredVelocity = targetDirection.clone().multiplyScalar(desiredSpeed);

    // Smooth acceleration
    const speedDiff = desiredVelocity.clone().sub(this.velocity);
    const maxAccel = effectiveAccel * dt;
    if (speedDiff.length() > maxAccel) {
      speedDiff.setLength(maxAccel);
    }
    this.velocity.add(speedDiff);

    // Apply movement
    newPos.addScaledVector(this.velocity, dt);

    // Resolve collision against obstacles & boundaries
    if (collisionCtrl) {
      const res = collisionCtrl.resolvePosition(newPos);
      newPos.copy(res.position);
      if (res.collided) {
        collidedWithObstacle = true;
        const vIntoNormal = this.velocity.dot(res.normal);
        if (vIntoNormal < 0) {
          // Slide along wall tangent
          this.velocity.sub(res.normal.clone().multiplyScalar(vIntoNormal));
        }
      }
    }

    return {
      newPosition: newPos,
      velocity: this.velocity.clone(),
      speed: this.velocity.length(),
      hasArrived: false,
      isMoving: true,
      targetDirection,
      distanceToTarget: distance,
      collidedWithObstacle,
    };
  }
}
