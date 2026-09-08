import { ZealotStats } from '../types/Zealot';
import { ProbeBase } from '../types/ProbeBase';
import { big } from './bigNumber';
import { emptyMinerCounts, emptyMineCounts } from './economyMath';

/** Build a fully-populated ZealotStats mock for component tests (overridable per-test). */
export function zealotStatsMock(overrides: Partial<ZealotStats> = {}): ZealotStats {
  return {
    hp: big(1000),
    maxHp: big(2000),
    baseAttack: big(50),
    baseAttackSpeed: 15,
    baseDefense: 5,
    baseHpRegen: big(10),
    minerals: big(500),
    vespeneGas: big(30),
    infiniteVespene: false,
    emergencyTeleports: 2,
    deaths: 3,
    isImmobilized: false,
    wallsKilled: 120,
    damageDone: big(50000),
    highestAverageDps: big(1234),
    abilityImmunityTimer: 0,
    damageImmunityTimer: 0,
    undyingUsedThisFight: false,
    totalMineralsEarned: big(10000),
    totalVespeneEarned: big(888),
    totalPlayTimeSeconds: 3661,
    ...overrides,
  };
}

/** Build a standard, non-rare D- (rankIndex 0) ProbeBase mock for component tests. */
export function probeBaseMock(overrides: Partial<ProbeBase> = {}): ProbeBase {
  return {
    rankIndex: 0,
    rankName: 'D-',
    probeKills: 42,
    upgradeCount: 0,
    wallCycle: 0,
    shopCycle: 0,
    vespene: 120,
    minerals: 4,
    generatorLevel: 2,
    mineralPrice: 155,
    marketState: 'built',
    marketTimer: 0,
    undergroundMarketBuilt: false,
    depotState: 'none',
    depotTimer: 0,
    minerTrainingType: null,
    minerTrainingTimer: 0,
    mineralAccum: 0,
    minerCounts: emptyMinerCounts(),
    mineCounts: emptyMineCounts(),
    mineBuildLevel: null,
    mineBuildTimer: 0,
    repositories: 0,
    wall: {
      tier: 'wall',
      level: 1,
      maxHp: big(1000),
      currentHp: big(500),
      defense: big(0),
    },
    turret: { count: 0, level: 1, attackPower: big(0) },
    ability: 'chrono',
    abilityCooldown: 0,
    abilityActiveTimer: 0,
    hasStartedCombat: true,
    isRare: false,
    rareType: null,
    isClanned: false,
    ...overrides,
  };
}