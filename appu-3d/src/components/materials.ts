import * as THREE from 'three';

// Premium glossy white ceramic exterior (subtle warmth, deep clearcoat)
export const ceramicWhiteMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xfcfdff,
  roughness: 0.12,
  metalness: 0.04,
  clearcoat: 1.0,
  clearcoatRoughness: 0.06,
  reflectivity: 0.85,
});

// Warm satin gold metallic accents (refined champagne gold)
export const goldMetallicMaterial = new THREE.MeshStandardMaterial({
  color: 0xe5b54a,
  roughness: 0.26,
  metalness: 0.88,
  envMapIntensity: 1.2,
});

// Dark graphite mechanical joints & articulate accents
export const graphiteJointMaterial = new THREE.MeshStandardMaterial({
  color: 0x242831,
  roughness: 0.38,
  metalness: 0.82,
});

// Deep black curved facial OLED screen
export const screenBaseMaterial = new THREE.MeshStandardMaterial({
  color: 0x06080e,
  roughness: 0.12,
  metalness: 0.85,
});

// Luminous golden ring eye material
export const goldenGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffcb42,
});

// Subtle chest emblem plate material
export const chestEmblemMaterial = new THREE.MeshStandardMaterial({
  color: 0x1f242d,
  roughness: 0.3,
  metalness: 0.7,
});

// Subtle glowing cyan accent core
export const cyanCoreMaterial = new THREE.MeshBasicMaterial({
  color: 0x00e5ff,
});
