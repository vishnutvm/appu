import * as THREE from 'three';

export interface InteractionCallbacks {
  onDragStart: (worldPos: THREE.Vector3) => void;
  onDragUpdate: (worldPos: THREE.Vector3, velocity: THREE.Vector3) => void;
  onDragEnd: (releaseVelocity: THREE.Vector3) => void;
  onPettingStart: () => void;
  onPettingUpdate: (intensity: number) => void;
  onPettingEnd: () => void;
  onTapAcknowledge: () => void;
}

export class CharacterInteractionController {
  private isDragging: boolean = false;
  private isPetting: boolean = false;
  private pettingEnabled: boolean = true;
  private groundPlane: THREE.Plane;
  private raycaster: THREE.Raycaster;

  private dragOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private currentDragPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private lastDragPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private dragVelocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Click vs Drag discrimination
  private pointerDownTime: number = 0;
  private totalDragDistance: number = 0;
  private lastScreenPos: { x: number; y: number } = { x: 0, y: 0 };

  // Petting stroke detection
  private petStrokeAccumulator: number = 0;
  private lastPetTime: number = 0;
  private petIntensity: number = 0;

  private callbacks?: InteractionCallbacks;

  constructor(callbacks?: InteractionCallbacks, groundHeight: number = 0) {
    this.callbacks = callbacks;
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundHeight);
    this.raycaster = new THREE.Raycaster();
  }

  public setCallbacks(callbacks: InteractionCallbacks) {
    this.callbacks = callbacks;
  }

  public setPettingEnabled(enabled: boolean) {
    this.pettingEnabled = enabled;
    if (!enabled && this.isPetting) {
      this.isPetting = false;
      this.callbacks?.onPettingEnd();
    }
  }

  public getPettingEnabled(): boolean {
    return this.pettingEnabled;
  }

  public getIsDragging(): boolean {
    return this.isDragging;
  }

  public getIsPetting(): boolean {
    return this.isPetting;
  }

  public getDragVelocity(): THREE.Vector3 {
    return this.dragVelocity;
  }

  /**
   * Starts drag on Appu.
   */
  public handlePointerDown(
    ndc: { x: number; y: number },
    screenPos: { x: number; y: number },
    camera: THREE.Camera,
    characterPos: THREE.Vector3
  ): boolean {
    this.pointerDownTime = performance.now();
    this.totalDragDistance = 0;
    this.lastScreenPos = { ...screenPos };

    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
    const hitPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint);

    if (hit) {
      this.isDragging = true;
      this.dragOffset.set(
        characterPos.x - hitPoint.x,
        0,
        characterPos.z - hitPoint.z
      );
      this.currentDragPos.copy(characterPos);
      this.lastDragPos.copy(characterPos);
      this.dragVelocity.set(0, 0, 0);
      this.callbacks?.onDragStart(characterPos);
      return true;
    }
    return false;
  }

  /**
   * Updates pointer motion. Handles dragging follow and petting detection.
   */
  public handlePointerMove(
    ndc: { x: number; y: number },
    screenPos: { x: number; y: number },
    camera: THREE.Camera,
    characterPos: THREE.Vector3,
    dt: number
  ) {
    const screenDx = screenPos.x - this.lastScreenPos.x;
    const screenDy = screenPos.y - this.lastScreenPos.y;
    this.totalDragDistance += Math.hypot(screenDx, screenDy);
    this.lastScreenPos = { ...screenPos };

    // 1. Dragging update
    if (this.isDragging) {
      this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const hitPoint = new THREE.Vector3();
      const hit = this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint);

      if (hit) {
        const rawTarget = new THREE.Vector3(
          hitPoint.x + this.dragOffset.x,
          0,
          hitPoint.z + this.dragOffset.z
        );

        if (dt > 0.001) {
          const v = rawTarget.clone().sub(this.lastDragPos).divideScalar(dt);
          // Smooth velocity filter
          this.dragVelocity.lerp(v, Math.min(1.0, dt * 18.0));
        }

        this.lastDragPos.copy(rawTarget);
        this.currentDragPos.copy(rawTarget);
        this.callbacks?.onDragUpdate(rawTarget, this.dragVelocity);
      }
      return;
    }

    // 2. Petting interaction check (hovering cursor over head)
    if (this.pettingEnabled && !this.isDragging) {
      this.checkPetting(ndc, camera, characterPos, screenDx, screenDy);
    }
  }

  /**
   * Detects gentle stroke movements over Appu's head area.
   */
  private checkPetting(
    ndc: { x: number; y: number },
    camera: THREE.Camera,
    characterPos: THREE.Vector3,
    screenDx: number,
    screenDy: number
  ) {
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);

    // Head is located around characterPos + (0, 0.44 to 0.75, 0)
    const headCenter = characterPos.clone().add(new THREE.Vector3(0, 0.55, 0));
    const headRadius = 0.42;

    const headSphere = new THREE.Sphere(headCenter, headRadius);
    const intersectsHead = this.raycaster.ray.intersectsSphere(headSphere);

    const now = performance.now();
    const movementMag = Math.hypot(screenDx, screenDy);

    if (intersectsHead && movementMag > 1.2 && movementMag < 45) {
      // Gentle movement over head detected!
      this.petStrokeAccumulator += movementMag;
      this.lastPetTime = now;

      if (!this.isPetting && this.petStrokeAccumulator > 35) {
        this.isPetting = true;
        this.callbacks?.onPettingStart();
      }

      if (this.isPetting) {
        this.petIntensity = THREE.MathUtils.clamp(this.petStrokeAccumulator / 120, 0.3, 1.0);
        this.callbacks?.onPettingUpdate(this.petIntensity);
      }
    } else {
      // If cursor stops or leaves head area, conclude petting
      if (this.isPetting && now - this.lastPetTime > 400) {
        this.isPetting = false;
        this.petStrokeAccumulator = 0;
        this.callbacks?.onPettingEnd();
      }
    }
  }

  /**
   * Pointer release handling. Discriminates between quick click vs release after drag.
   */
  public handlePointerUp(): { isClick: boolean; releaseVelocity: THREE.Vector3 } {
    const isClick = this.totalDragDistance < 8 && performance.now() - this.pointerDownTime < 380;
    const releaseVel = this.dragVelocity.clone();

    if (this.isDragging) {
      this.isDragging = false;
      if (isClick) {
        this.callbacks?.onTapAcknowledge();
      } else {
        this.callbacks?.onDragEnd(releaseVel);
      }
    }

    if (this.isPetting) {
      this.isPetting = false;
      this.petStrokeAccumulator = 0;
      this.callbacks?.onPettingEnd();
    }

    return { isClick, releaseVelocity: releaseVel };
  }

  public update(dt: number) {
    if (!this.isDragging) {
      this.dragVelocity.lerp(new THREE.Vector3(0, 0, 0), dt * 10.0);
    }
  }
}
