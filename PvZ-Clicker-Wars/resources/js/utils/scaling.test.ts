import { describe, it, expect } from 'vitest';
import {
  WALL_CYCLE_STEPS,
  CYCLE_STEP_MULTIPLIERS,
  CYCLE_STEP_DEFENSE,
  CYCLE_STEP_TIERS,
  CYCLE_STEP_LEVELS,
  WALL_TIER_GROWTH,
  WALL_LEVEL_GROWTH,
  getTierFlags,
  getTierConfig,
  getTierConfigBySsLevel,
  TIER_CONFIGS,
} from './scaling';

// SS_LEVELS_PER_TIER lives in ranks.ts (the shared ladder module)
import { SS_LEVELS_PER_TIER } from './ranks';

describe('wall cycle tables', () => {
  it('has 18 steps per cycle', () => {
    expect(WALL_CYCLE_STEPS).toBe(18);
    expect(CYCLE_STEP_MULTIPLIERS).toHaveLength(18);
    expect(CYCLE_STEP_DEFENSE).toHaveLength(18);
    expect(CYCLE_STEP_TIERS).toHaveLength(18);
    expect(CYCLE_STEP_LEVELS).toHaveLength(18);
  });

  it('follows the tier order Wall->Ultra->Mega->Power->Final', () => {
    expect(CYCLE_STEP_TIERS.slice(0, 5)).toEqual(['wall', 'wall', 'wall', 'wall', 'wall']);
    expect(CYCLE_STEP_TIERS.slice(5, 10)).toEqual(['ultra', 'ultra', 'ultra', 'ultra', 'ultra']);
    expect(CYCLE_STEP_TIERS.slice(10, 15)).toEqual(['mega', 'mega', 'mega', 'mega', 'mega']);
    expect(CYCLE_STEP_TIERS.slice(15, 17)).toEqual(['power', 'power']);
    expect(CYCLE_STEP_TIERS[17]).toBe('final');
  });

  it('follows the level pattern 1-5,1-5,1-5,1-2,1', () => {
    expect(CYCLE_STEP_LEVELS).toEqual([1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 1]);
  });

  it('applies the tier growth at the right boundaries', () => {
    // Wall1 -> Wall2 is a level change
    expect(CYCLE_STEP_MULTIPLIERS[1]).toBeCloseTo(CYCLE_STEP_MULTIPLIERS[0] * WALL_LEVEL_GROWTH);
    // Wall5 -> Ultra1 is a tier change
    expect(CYCLE_STEP_MULTIPLIERS[5]).toBeCloseTo(CYCLE_STEP_MULTIPLIERS[4] * WALL_TIER_GROWTH);
  });
});

describe('tier configs', () => {
  it('defines six milestone tiers in order', () => {
    expect(TIER_CONFIGS.map((t) => t.id)).toEqual(['SS', 'SSS', 'X', 'XD', 'XRD', 'XRFD']);
  });

  it('steps tiers every 50 SS levels', () => {
    expect(SS_LEVELS_PER_TIER).toBe(50);
    expect(TIER_CONFIGS[1].startSsLevel).toBe(51);
    expect(TIER_CONFIGS[5].startSsLevel).toBe(251);
  });

  it('looks up a tier config by id', () => {
    expect(getTierConfig('X').mechanic).toBe('overdrive');
    expect(getTierConfig('SS').mechanic).toBe('goldenAura');
  });

  it('maps an SS level to its tier config', () => {
    expect(getTierConfigBySsLevel(1).id).toBe('SS');
    expect(getTierConfigBySsLevel(50).id).toBe('SS');
    expect(getTierConfigBySsLevel(51).id).toBe('SSS');
    expect(getTierConfigBySsLevel(251).id).toBe('XRFD');
  });
});

describe('getTierFlags', () => {
  it('unlocks only golden aura at SS', () => {
    const f = getTierFlags(1);
    expect(f.goldenAura).toBe(true);
    expect(f.novaVolley).toBe(false);
    expect(f.finalApex).toBe(false);
  });

  it('keeps previous mechanics and adds the new tier', () => {
    const f = getTierFlags(251);
    expect(f.goldenAura).toBe(true);
    expect(f.novaVolley).toBe(true);
    expect(f.overdrive).toBe(true);
    expect(f.phaseWalls).toBe(true);
    expect(f.realityDrift).toBe(true);
    expect(f.finalApex).toBe(true);
  });
});
