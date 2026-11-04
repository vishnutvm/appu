import * as THREE from 'three';
import { AppuFramingPreset } from '../types/character';

export interface CameraConfig {
  minDistance: number;
  maxDistance: number;
  defaultDistance: number;
  zoomSpeed: number;
  dampingFactor: number;
  fixedElevation: number; // Y height offset for stable horizon
}

// Bounding dimensions for Appu character to guarantee zero cropping and perfect ground framing
export const APPU_DIMENSIONS = {
  // Head & visor close-up (for portrait preset)
  headWidthWithMargin: 1.70,
  headHeightWithMargin: 1.48,
  headCenterY: 0.44,

  // Full body framing (grounded on desktop surface, perfectly filling viewport)
  fullBodyWidthWithMargin: 1.85, // Hands reach ±0.85 (width 1.70)
  fullBodyHeightWithMargin: 1.95, // Feet at -0.88, antenna at +0.88 (height 1.76)
  fullBodyCenterY: 0.04, // Natural standing center of gravity
};

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  minDistance: 4.4, // Guaranteed safe minimum: Appu fills screen with 15% margin on all sides
  maxDistance: 6.5,
  defaultDistance: 4.8, // Perfect full-body viewport framing
  zoomSpeed: 0.003,
  dampingFactor: 8.0,
  fixedElevation: 0.16,
};

export class CharacterCameraController {
  private currentDistance: number;
  private targetDistance: number;
  private currentFocalPoint: THREE.Vector3 = new THREE.Vector3(0, 0.04, 0);
  private targetFocalPoint: THREE.Vector3 = new THREE.Vector3(0, 0.04, 0);
  private currentViewAngle: THREE.Vector3 = new THREE.Vector3(0, 0.16, 1).normalize();
  private targetViewAngle: THREE.Vector3 = new THREE.Vector3(0, 0.16, 1).normalize();
  private config: CameraConfig;
  private isPresetTransition: boolean = false;
  private minSafeDistance: number = 4.4;
  private fullSafeDistance: number = 4.8;

  constructor(config: Partial<CameraConfig> = {}) {
    this.config = { ...DEFAULT_CAMERA_CONFIG, ...config };
    this.currentDistance = this.config.defaultDistance;
    this.targetDistance = this.config.defaultDistance;
  }

  public getDistance(): number {
    return this.currentDistance;
  }

  public getMinSafeDistance(): number {
    return this.minSafeDistance;
  }

  public getFullSafeDistance(): number {
    return this.fullSafeDistance;
  }

  public setDistance(dist: number) {
    const effectiveMin = Math.max(this.config.minDistance, this.minSafeDistance);
    this.targetDistance = THREE.MathUtils.clamp(
      dist,
      effectiveMin,
      this.config.maxDistance
    );
  }

  public handleWheelZoom(deltaY: number) {
    const change = deltaY * this.config.zoomSpeed;
    this.setDistance(this.targetDistance + change);
    this.isPresetTransition = false;
  }

  /**
   * Calculates safe minimum distance and full-body distance based on camera FOV and aspect ratio.
   * This guarantees that zooming in NEVER crops Appu's head or torso,
   * regardless of whether the viewport is narrow (companion mode) or wide (studio mode).
   */
  public updateSafeDistances(camera: THREE.Camera) {
    if (camera instanceof THREE.PerspectiveCamera) {
      const vFovRad = THREE.MathUtils.degToRad(camera.fov);
      const tanHalfFovV = Math.tan(vFovRad / 2);
      const aspect = Math.max(0.1, camera.aspect);
      const tanHalfFovH = tanHalfFovV * aspect;

      // Distance required so head & visor NEVER crop horizontally or vertically
      const distForHeadW = APPU_DIMENSIONS.headWidthWithMargin / (2 * tanHalfFovH);
      const distForHeadH = APPU_DIMENSIONS.headHeightWithMargin / (2 * tanHalfFovV);
      this.minSafeDistance = Math.max(distForHeadW, distForHeadH);

      // Distance required so full character body fits with breathing margin
      const distForFullW = APPU_DIMENSIONS.fullBodyWidthWithMargin / (2 * tanHalfFovH);
      const distForFullH = APPU_DIMENSIONS.fullBodyHeightWithMargin / (2 * tanHalfFovV);
      this.fullSafeDistance = Math.max(distForFullW, distForFullH);

      // Keep target distance and current distance within safe bounds
      const effectiveMin = Math.max(this.config.minDistance, this.minSafeDistance);
      if (this.targetDistance < effectiveMin) {
        this.targetDistance = effectiveMin;
      }
      if (this.currentDistance < effectiveMin) {
        this.currentDistance = effectiveMin;
      }
    }
  }

  public setPreset(preset: AppuFramingPreset) {
    this.isPresetTransition = true;

    if (preset === 'front') {
      this.targetViewAngle.set(0, 0.16, 1).normalize();
      this.targetFocalPoint.set(0, APPU_DIMENSIONS.fullBodyCenterY, 0);
      this.targetDistance = Math.max(this.fullSafeDistance, 4.8);
    } else if (preset === 'threeQuarter') {
      this.targetViewAngle.set(0.65, 0.22, 0.76).normalize();
      this.targetFocalPoint.set(0, APPU_DIMENSIONS.fullBodyCenterY, 0);
      this.targetDistance = Math.max(this.fullSafeDistance, 4.8);
    } else if (preset === 'side') {
      this.targetViewAngle.set(1.0, 0.14, 0.0).normalize();
      this.targetFocalPoint.set(0, APPU_DIMENSIONS.fullBodyCenterY, 0);
      this.targetDistance = Math.max(this.fullSafeDistance, 4.8);
    } else if (preset === 'back') {
      this.targetViewAngle.set(0, 0.16, -1).normalize();
      this.targetFocalPoint.set(0, APPU_DIMENSIONS.fullBodyCenterY, 0);
      this.targetDistance = Math.max(this.fullSafeDistance, 4.8);
    } else if (preset === 'portrait') {
      this.targetViewAngle.set(0, 0.08, 1).normalize();
      this.targetFocalPoint.set(0, APPU_DIMENSIONS.headCenterY, 0);
      this.targetDistance = Math.max(this.minSafeDistance, 4.4);
    }
  }

  /**
   * Updates camera position, orientation, safe zoom bounds, and dynamic focal point elevation.
   * Keeps camera completely free from roll, pitch glitches, or clipping at any zoom level.
   */
  public update(camera: THREE.Camera, dt: number, characterPosition?: THREE.Vector3) {
    // 1. Recompute safe bounds based on live camera aspect ratio & FOV
    this.updateSafeDistances(camera);

    const lerpFactor = Math.min(1.0, this.config.dampingFactor * dt);

    // 2. Smooth distance interpolation
    this.currentDistance = THREE.MathUtils.lerp(
      this.currentDistance,
      this.targetDistance,
      lerpFactor
    );

    // 3. Grounded Stability: Keep focal point at natural standing center of gravity (0.04)
    // and stable downward horizon angle (0.16) so Appu remains grounded and fills the window
    if (!this.isPresetTransition) {
      this.targetFocalPoint.y = APPU_DIMENSIONS.fullBodyCenterY;
      this.targetViewAngle.set(0, 0.16, 1).normalize();
    }

    // 4. Centered framing tracking (smooth follow so Appu stays centered without jarring jumps or drifting)
    if (characterPosition) {
      this.targetFocalPoint.x = characterPosition.x;
      this.targetFocalPoint.z = characterPosition.z;
    }

    // 5. Interpolate focal point
    this.currentFocalPoint.lerp(this.targetFocalPoint, lerpFactor);

    // 6. Interpolate view angle
    this.currentViewAngle.lerp(this.targetViewAngle, lerpFactor).normalize();

    // 7. Calculate stable camera position
    const camPos = this.currentFocalPoint.clone().addScaledVector(
      this.currentViewAngle,
      this.currentDistance
    );

    camera.position.copy(camPos);
    camera.lookAt(this.currentFocalPoint);
  }
}

