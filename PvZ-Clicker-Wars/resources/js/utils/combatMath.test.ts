import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getTurretInfo,
  computeWallFromCount,
  buildTurret,
  getWallProgressionPosition,
  generateRareProbe,
  loadUpgradeCount,
  deserializeWall,
  initSsMechanics,
} from './combatMath';
import { CYCLE_TOTAL_GROWTH } from './scaling';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getTurretInfo', () => {
  it('returns base table damage: level 1 = 1 DPS', () => {
    expect(getTurretInfo(1).attackPower).toBe(1);
    expect(getTurretInfo(1).count).toBe(8);
  });

  it('follows the dictated turret table', () => {
    expect(getTurretInfo(2).attackPower).toBe(2);
    expect(getTurretInfo(3).attackPower).toBe(4);
    expect(getTurretInfo(4).attackPower).toBe(8);
    expect(getTurretInfo(5).attackPower).toBe(16);
    expect(getTurretInfo(6).attackPower).toBe(32);
    expect(getTurretInfo(7).attackPower).toBe(64);
    expect(getTurretInfo(8).attackPower).toBe(128);
    expect(getTurretInfo(9).attackPower).toBe(400);
    expect(getTurretInfo(10).attackPower).toBe(700);
    expect(getTurretInfo(11).attackPower).toBe(40960);
    expect(getTurretInfo(12).attackPower).toBe(160000);
  });

  it('t13 is the 524270/0.2s volley displayed as DPS (x5)', () => {
    expect(getTurretInfo(13).attackPower).toBe(524270 * 5);
  });

  it('doubles count and power for a gold baser', () => {
    const gold = getTurretInfo(1, true);
    expect(gold.count).toBe(16);
    expect(gold.attackPower).toBe(2);
  });
});

describe('getWallProgressionPosition', () => {
  it('maps tiers to their position bucket', () => {
    expect(getWallProgressionPosition('wall', 1)).toBe(0);
    expect(getWallProgressionPosition('wall', 5)).toBe(4);
    expect(getWallProgressionPosition('ultra', 1)).toBe(5);
    expect(getWallProgressionPosition('mega', 1)).toBe(10);
    expect(getWallProgressionPosition('power', 1)).toBe(15);
    expect(getWallProgressionPosition('final', 1)).toBe(17);
  });
});

describe('computeWallFromCount', () => {
  it('builds Wall Lv 1 with 200 HP at count 0', () => {
    const w = computeWallFromCount(0, null, false);
    expect(w.tier).toBe('wall');
    expect(w.level).toBe(1);
    expect(w.maxHp.toNumber()).toBe(200);
  });

  it('follows the full progression across a cycle', () => {
    const wall1 = computeWallFromCount(0, null, false);
    const wall5 = computeWallFromCount(4, null, false);
    const final = computeWallFromCount(17, null, false);
    expect(wall5.maxHp.gt(wall1.maxHp)).toBe(true);
    expect(final.maxHp.gt(wall5.maxHp)).toBe(true);
    expect(final.tier).toBe('final');
  });

  it('grows the next cycle by CYCLE_TOTAL_GROWTH', () => {
    const cycle0 = computeWallFromCount(0, null, false);
    const cycle1 = computeWallFromCount(18, null, false);
    const expected = cycle0.maxHp.mul(CYCLE_TOTAL_GROWTH).floor();
    expect(cycle1.maxHp.eq(expected)).toBe(true);
  });

  it('doubles wall HP for a double baser', () => {
    const normal = computeWallFromCount(0, null, false);
    const db = computeWallFromCount(0, 'doubleBaser', false);
    expect(db.maxHp.eq(normal.maxHp.mul(2))).toBe(true);
  });

  it('triples wall HP for a clanned probe', () => {
    const normal = computeWallFromCount(0, null, false);
    const clan = computeWallFromCount(0, null, true);
    expect(clan.maxHp.eq(normal.maxHp.mul(3))).toBe(true);
  });
});

describe('buildTurret', () => {
  it('derives level = count + 1 within a cycle', () => {
    const t = buildTurret(0, null, false);
    expect(t.level).toBe(1);
    expect(t.attackPower.toNumber()).toBe(1);
    expect(t.count).toBe(8);
  });

  it('caps the turret at level 13 (524270/0.2s, 2621350 DPS)', () => {
    const t13 = buildTurret(12, null, false);
    expect(t13.level).toBe(13);
    expect(t13.attackPower.toNumber()).toBe(524270 * 5);
  });

  it('turret is deactivated from cycle growth (no x4671 multiplier)', () => {
    const cycle0 = buildTurret(0, null, false);
    const cycle1 = buildTurret(18, null, false);
    expect(cycle1.attackPower.eq(cycle0.attackPower)).toBe(true);
    expect(cycle1.level).toBe(cycle0.level);
  });

  it('boosts attack for a triple baser', () => {
    const normal = buildTurret(0, null, false);
    const triple = buildTurret(0, 'tripleBaser', false);
    expect(triple.attackPower.eq(normal.attackPower.mul(2))).toBe(true);
  });

  it('triples turret count for a clanned probe', () => {
    const clan = buildTurret(0, null, true);
    expect(clan.count).toBe(24);
    expect(clan.attackPower.eq(buildTurret(0, null, false).attackPower.mul(3))).toBe(true);
  });
});

describe('generateRareProbe', () => {
  it('never rolls rare below S+ (rankIndex < 14)', () => {
    for (let r = 0; r < 14; r++) {
      const res = generateRareProbe(r, []);
      expect(res.isRare).toBe(false);
    }
  });
});

describe('loadUpgradeCount', () => {
  it('restores from the saved wall position', () => {
    const res = loadUpgradeCount({ wall: { tier: 'wall', level: 5 } }, 0);
    // Wall Lv 5 is position 4 within a cycle
    expect(res).toBe(4);
  });

  it('falls back to the legacy upgradeCount when no wall tier is present', () => {
    expect(loadUpgradeCount({ upgradeCount: 7 }, 0)).toBe(7);
  });
});

describe('deserializeWall', () => {
  it('parses string Decimal fields', () => {
    const w = deserializeWall({ maxHp: '1e12', currentHp: '5e11', tier: 'mega', level: 3, defense: '10' });
    expect(w.maxHp.toNumber()).toBe(1e12);
    expect(w.currentHp.toNumber()).toBe(5e11);
    expect(w.tier).toBe('mega');
    expect(w.level).toBe(3);
  });

  it('defaults missing currentHp to maxHp', () => {
    const w = deserializeWall({ maxHp: 500 });
    expect(w.currentHp.toNumber()).toBe(500);
  });
});

describe('initSsMechanics', () => {
  it('returns undefined mechanics for a non-SS level', () => {
    const m = initSsMechanics(0);
    expect(m.ssTier).toBeUndefined();
    expect(m.novaVolleyTimer).toBeUndefined();
  });

  it('fills tier mechanics for an SS level', () => {
    const m = initSsMechanics(1);
    expect(m.ssTier).toBe('SS');
    expect(m.wallPhaseTimer).toBeUndefined(); // not a phaseWalls tier
  });

  it('initializes phase wall timers for XD tier', () => {
    const m = initSsMechanics(151);
    expect(m.ssTier).toBe('XD');
    expect(m.wallPhaseTimer).toBe(15);
    expect(m.wallPhaseInvuln).toBe(0);
  });
});
