import * as THREE from 'three';

/**
 * Visual Source of Truth: Character Reference Sheet Palette
 *
 * White Fur:           #FFFFFF
 * Inner Ear / Nose:    #FFD6D6 / #FF8E8E
 * Rosy Cheeks:         #FF8E8E
 * Navy-Blue Hoodie:    #0F2D5C
 * Cream Hood Lining:   #E9DCC2
 * Beige Cargo Joggers: #D9B387
 * Dark Accents/Shoes:  #2E3A59
 * Glow Cyan:           #00F3FF
 */

export const rabbitMaterials = {
  // Soft white fluffy fur
  fur: new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.75,
    metalness: 0.05,
  }),

  // Inner ear pink velvet
  innerEar: new THREE.MeshStandardMaterial({
    color: '#ffd6d6',
    roughness: 0.6,
    metalness: 0.0,
  }),

  // Small pink bunny nose
  nose: new THREE.MeshStandardMaterial({
    color: '#ff8e8e',
    roughness: 0.4,
    metalness: 0.05,
  }),

  // Rosy cheeks blush
  cheeks: new THREE.MeshStandardMaterial({
    color: '#ff8e8e',
    roughness: 0.9,
    transparent: true,
    opacity: 0.85,
  }),

  // Two prominent front teeth
  teeth: new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.2,
    metalness: 0.0,
  }),

  // Navy-blue hoodie exterior
  hoodie: new THREE.MeshStandardMaterial({
    color: '#0f2d5c',
    roughness: 0.7,
    metalness: 0.1,
  }),

  // Cream-colored hood lining and cords
  hoodLining: new THREE.MeshStandardMaterial({
    color: '#e9dcc2',
    roughness: 0.8,
    metalness: 0.05,
  }),

  // White undershirt
  undershirt: new THREE.MeshStandardMaterial({
    color: '#f8f9fa',
    roughness: 0.7,
    metalness: 0.0,
  }),

  // Beige cargo jogger pants
  cargoPants: new THREE.MeshStandardMaterial({
    color: '#d9b387',
    roughness: 0.8,
    metalness: 0.05,
  }),

  // Sneaker upper (navy)
  sneakerNavy: new THREE.MeshStandardMaterial({
    color: '#2e3a59',
    roughness: 0.5,
    metalness: 0.1,
  }),

  // Sneaker rubber sole and laces (white)
  sneakerWhite: new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.4,
    metalness: 0.0,
  }),

  // Neck headphones chassis
  headphonesBody: new THREE.MeshStandardMaterial({
    color: '#2e3a59',
    roughness: 0.35,
    metalness: 0.3,
  }),

  // Neck headphones cushion
  headphonesCushion: new THREE.MeshStandardMaterial({
    color: '#e9dcc2',
    roughness: 0.8,
    metalness: 0.0,
  }),

  // Metallic headband
  headbandMetal: new THREE.MeshStandardMaterial({
    color: '#c0c0c0',
    roughness: 0.2,
    metalness: 0.85,
  }),

  // Smartwatch band
  watchBand: new THREE.MeshStandardMaterial({
    color: '#1a2230',
    roughness: 0.6,
    metalness: 0.1,
  }),

  // Smartwatch glowing screen
  watchScreen: new THREE.MeshStandardMaterial({
    color: '#00f3ff',
    emissive: '#00d0e0',
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.2,
  }),

  // Eye Sclera (eyeball white)
  eyeSclera: new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.1,
    metalness: 0.0,
  }),

  // Big expressive blue eye iris
  eyeIris: new THREE.MeshStandardMaterial({
    color: '#1864ab',
    roughness: 0.15,
    metalness: 0.1,
  }),

  // Deep dark pupil
  eyePupil: new THREE.MeshStandardMaterial({
    color: '#08121e',
    roughness: 0.05,
    metalness: 0.0,
  }),

  // Specular reflection glint
  eyeHighlight: new THREE.MeshBasicMaterial({
    color: '#ffffff',
  }),

  // Anti-gravity glowing cyan energy ring
  antiGravityGlow: new THREE.MeshStandardMaterial({
    color: '#00f3ff',
    emissive: '#00f3ff',
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.75,
    roughness: 0.1,
  }),

  // Motion aura ribbon
  motionSpiral: new THREE.MeshBasicMaterial({
    color: '#00f3ff',
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  }),
};
