import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CharacterCameraController, APPU_DIMENSIONS } from '../controllers/CharacterCameraController';

describe('CharacterCameraController - Zoom & Framing Anti-Cropping Protection', () => {
  it('1. Calculates safe distances dynamically based on narrow portrait aspect ratio', () => {
    const controller = new CharacterCameraController();
    const camera = new THREE.PerspectiveCamera(30, 220 / 300, 0.1, 50);

    controller.update(camera, 0.016);

    // In 220x300, aspect is 0.733. minSafeDistance must be >= 4.2 to guarantee zero cropping of head/ears
    expect(controller.getMinSafeDistance()).toBeGreaterThanOrEqual(4.2);
    expect(controller.getFullSafeDistance()).toBeGreaterThanOrEqual(4.6);
  });

  it('2. Clamps maximum wheel zoom-in so head, visor and antenna never crop', () => {
    const controller = new CharacterCameraController();
    const camera = new THREE.PerspectiveCamera(30, 220 / 300, 0.1, 50);

    // Update safe distances first
    controller.update(camera, 0.016);

    // Zoom in repeatedly with negative deltaY (mouse wheel up)
    for (let i = 0; i < 50; i++) {
      controller.handleWheelZoom(-100);
      controller.update(camera, 0.016);
    }

    // Distance must never drop below minSafeDistance
    expect(controller.getDistance()).toBeGreaterThanOrEqual(controller.getMinSafeDistance());

    // Calculate visible width at this distance: 2 * D * tan(fov/2) * aspect
    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const visibleWidth = 2 * controller.getDistance() * Math.tan(vFovRad / 2) * camera.aspect;

    // Visible width must safely exceed Appu's head and ear module width (1.35)
    expect(visibleWidth).toBeGreaterThan(1.35);

    // Verify projected NDC coordinate of top of antenna and right ear are safely within [-1, 1] with breathing margin
    camera.updateMatrixWorld();
    const topAntenna = new THREE.Vector3(0, 1.075, 0).project(camera);
    const rightEar = new THREE.Vector3(0.675, 0.48, 0).project(camera);
    expect(topAntenna.y).toBeLessThan(0.95); // Inside top window edge (+1.0)
    expect(rightEar.x).toBeLessThan(0.95); // Inside right window edge (+1.0)
  });

  it('3. Keeps Appu grounded and vertically balanced so feet and boots never clip', () => {
    const controller = new CharacterCameraController();
    const camera = new THREE.PerspectiveCamera(30, 220 / 300, 0.1, 50);

    controller.update(camera, 0.016);

    // Zoom in completely
    controller.setDistance(controller.getMinSafeDistance());
    for (let i = 0; i < 60; i++) {
      controller.update(camera, 0.05);
    }

    camera.updateMatrixWorld();
    // Feet at -0.88 and top antenna at +0.88
    const feet = new THREE.Vector3(0, -0.88, 0).project(camera);
    const antenna = new THREE.Vector3(0, 0.88, 0).project(camera);

    // Both feet and antenna must stay safely inside [-1, 1] viewport bounds
    expect(feet.y).toBeGreaterThan(-0.95);
    expect(antenna.y).toBeLessThan(0.95);
  });

  it('4. Adapts safely for widescreen studio mode without over-constraining', () => {
    const controller = new CharacterCameraController();
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 50);

    controller.update(camera, 0.016);

    // In widescreen (16:9), width is ample, so minSafeDistance is smaller than in portrait
    expect(controller.getMinSafeDistance()).toBeLessThan(3.0);

    // Visible width at min distance in widescreen must still exceed head width
    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const visibleWidth = 2 * controller.getMinSafeDistance() * Math.tan(vFovRad / 2) * camera.aspect;
    expect(visibleWidth).toBeGreaterThan(1.242);
  });

  it('5. Portrait preset frames head and eyes safely without clipping', () => {
    const controller = new CharacterCameraController();
    const camera = new THREE.PerspectiveCamera(30, 220 / 300, 0.1, 50);

    controller.update(camera, 0.016);
    controller.setPreset('portrait');

    for (let i = 0; i < 60; i++) {
      controller.update(camera, 0.05);
    }

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const visibleWidth = 2 * controller.getDistance() * Math.tan(vFovRad / 2) * camera.aspect;

    // Must not crop head
    expect(visibleWidth).toBeGreaterThan(APPU_DIMENSIONS.headWidthWithMargin * 0.95);
  });
});
