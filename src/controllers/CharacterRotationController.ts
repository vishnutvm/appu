import * as THREE from 'three';

export class CharacterRotationController {
  private currentYaw: number = 0;
  private targetYaw: number = 0;
  private turnSpeed: number = 8.0; // rad/s for smooth turning

  public getYaw(): number {
    return this.currentYaw;
  }

  public getTargetYaw(): number {
    return this.targetYaw;
  }

  public setTargetYaw(yaw: number) {
    this.targetYaw = this.normalizeAngle(yaw);
  }

  public setInstantYaw(yaw: number) {
    this.currentYaw = this.normalizeAngle(yaw);
    this.targetYaw = this.currentYaw;
  }

  public addYawDelta(delta: number) {
    this.setTargetYaw(this.targetYaw + delta);
  }

  public setFacingDirection(dirX: number, dirZ: number) {
    if (Math.abs(dirX) > 0.001 || Math.abs(dirZ) > 0.001) {
      // In Three.js: angle on XZ plane where (0, 1) is front (+Z), (1, 0) is right (+X)
      const angle = Math.atan2(dirX, dirZ);
      this.setTargetYaw(angle);
    }
  }

  public update(dt: number): { currentYaw: number; isTurning: boolean; angularVelocity: number } {
    const diff = this.shortestAngleDiff(this.currentYaw, this.targetYaw);
    const step = diff * Math.min(1.0, this.turnSpeed * dt);
    this.currentYaw = this.normalizeAngle(this.currentYaw + step);

    const isTurning = Math.abs(diff) > 0.04;
    return {
      currentYaw: this.currentYaw,
      isTurning,
      angularVelocity: step / Math.max(0.001, dt),
    };
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  private shortestAngleDiff(from: number, to: number): number {
    const diff = (to - from) % (Math.PI * 2);
    return ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  }
}
