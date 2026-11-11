import { describe, it, expect, beforeEach } from 'vitest';
import { useRabbitStore } from '../rabbit-companion/state/rabbitStore';
import { rabbitMaterials } from '../rabbit-companion/components/character/RabbitMaterials';

describe('Rabbit Companion State & Integrity', () => {
  beforeEach(() => {
    useRabbitStore.getState().resetPose();
  });

  it('initializes with default floating and happy state', () => {
    const state = useRabbitStore.getState();
    expect(state.emotion).toBe('happy');
    expect(state.action).toBe('idle-floating');
    expect(state.isDragging).toBe(false);
    expect(state.isSpinning).toBe(false);
  });

  it('updates anti-gravity actions correctly', () => {
    const { setAction } = useRabbitStore.getState();

    setAction('hover');
    expect(useRabbitStore.getState().action).toBe('hover');

    setAction('floating-sit');
    expect(useRabbitStore.getState().action).toBe('floating-sit');

    setAction('hover-walk');
    expect(useRabbitStore.getState().action).toBe('hover-walk');

    setAction('fly');
    expect(useRabbitStore.getState().action).toBe('fly');

    setAction('spin');
    expect(useRabbitStore.getState().action).toBe('spin');
    expect(useRabbitStore.getState().isSpinning).toBe(true);
  });

  it('updates facial emotions and mouth opening for voice', () => {
    const { setEmotion, setMouthOpen, setSoundIntensity } = useRabbitStore.getState();

    setEmotion('excited');
    expect(useRabbitStore.getState().emotion).toBe('excited');

    setEmotion('surprised');
    expect(useRabbitStore.getState().emotion).toBe('surprised');

    setMouthOpen(0.8);
    expect(useRabbitStore.getState().mouthOpen).toBe(0.8);

    setSoundIntensity(0.5);
    expect(useRabbitStore.getState().soundIntensity).toBe(0.5);
    expect(useRabbitStore.getState().mouthOpen).toBeCloseTo(0.75);
  });

  it('verifies PBR materials match character reference sheet palette', () => {
    // White fur (#ffffff)
    expect(rabbitMaterials.fur.color.getHexString()).toBe('ffffff');

    // Navy hoodie (#0f2d5c)
    expect(rabbitMaterials.hoodie.color.getHexString()).toBe('0f2d5c');

    // Cream hood lining (#e9dcc2)
    expect(rabbitMaterials.hoodLining.color.getHexString()).toBe('e9dcc2');

    // Beige cargo jogger pants (#d9b387)
    expect(rabbitMaterials.cargoPants.color.getHexString()).toBe('d9b387');

    // Dark accent sneaker/headphones (#2e3a59)
    expect(rabbitMaterials.sneakerNavy.color.getHexString()).toBe('2e3a59');
  });
});
