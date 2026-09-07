import Decimal from 'break_eternity.js';
import { ProbeBase, Wall, WallTier, TurretInfo, RareProbeType } from '../types/ProbeBase';
import { BigNum, big, desBig } from './bigNumber';
import { isSsRank, ssLevel, TierId, getRankTier } from './ranks';
import {
  WALL_CYCLE_STEPS,
  WALL_FINAL_GROWTH_PER_CYCLE,
  CYCLE_STEP_MULTIPLIERS,
  CYCLE_STEP_DEFENSE,
  CYCLE_STEP_TIERS,
  CYCLE_STEP_LEVELS,
  CYCLE_TOTAL_GROWTH,
  SS_WALL_HP_PER_LEVEL,
  SS_DEFENSE_PER_LEVEL,
  SS_TURRET_POWER_PER_LEVEL,
  SS_TURRET_COUNT_PER_LEVEL,
  getTierFlags,
  getTierConfig,
  PHASE_WALL_INTERVAL,
  REALITY_DRIFT_MAX_CHARGES,
} from './scaling';

// Pure combat/re-roll math extracted from useCombat. These functions have no
// reactive state and are safe to reuse or unit-test in isolation.

/** Calculate turret info (count, level, attack power) - turret damage halved to 20 base at level 1 */
export function getTurretInfo(level: number, isGold = false): { count: number; level: number; attackPower: number } {
  const basePower = Math.floor((40.0 * Math.pow(1.35, level - 1)) * 0.5); // Halved from 40 to 20 base at level 1
  const count = isGold ? 16 : 8; // Gold baser has double turrets (16)
  const attackPower = basePower * (isGold ? 2 : 1);
  return {
    count,
    level,
    attackPower,
  };
}

/** Calculate defense upgrade countdown duration based on rank and wall cycle */
export function calculateUpgradeTime(rankIndex: number, wallCycle = 0): number {
  const base = 45;
  const rankSpeedBonus = Math.pow(0.95, rankIndex); // 5% faster per rank index
  const cycleSpeedBonus = Math.pow(0.9, wallCycle); // 10% faster per completed wall cycle
  return Math.max(10, Math.floor(base * rankSpeedBonus * cycleSpeedBonus)); // Hard cap: an upgrade lasts at least 10s
}

/** Frozen upgrade-timer for a given milestone tier (the longer journey manifests as tougher tiers). */
export function computeTierJourneyTime(tier: TierId): number {
  return getTierConfig(tier).timerSeconds;
}

/** Upgrade-timer for a specific SS level based on its tier (SS=2640s, SSS=3600s, X=4500s, XD=5400s, XRD=6300s, XRFD=7200s). */
export function getSsJourneyTimeForLevel(ssLevelNum: number): number {
  return computeTierJourneyTime(getRankTier(ssLevelNum));
}

/** Determine probe ability (Chrono or Void Prism) */
export function getRandomAbility(rankIndex: number): 'chrono' | 'voidPrism' {
  const voidChance = Math.min(0.9, 0.1 + (rankIndex / 12) * 0.8);
  return Math.random() < voidChance ? 'voidPrism' : 'chrono';
}

/** Roll whether a probe is rare and what type (STRICTLY available only from S+ rank onwards, rankIndex >= 14) */
export function generateRareProbe(rankIndex: number, clanList: string[]): { isRare: boolean; rareType: RareProbeType; isClanned: boolean; clanName?: string } {
  if (rankIndex < 14) {
    return { isRare: false, rareType: null, isClanned: false };
  }
  const isRare = Math.random() < 0.5; // 50% chance if rank >= S+
  const isClanned = (rankIndex - 14) % 10 === 0; // Every 10 ranks starting from S+
  const clanName = isClanned ? clanList[Math.floor(Math.random() * clanList.length)] : undefined;

  if (!isRare) return { isRare: false, rareType: null, isClanned, clanName };

  const disablePatherActive = localStorage.getItem('pvz2_disable_pather') === 'true';

  let rareType: RareProbeType;
  let attempts = 0;
  do {
    const roll = Math.random();
    if (roll < 0.20) {
      rareType = 'doubleBaser'; // 20%
    } else if (roll < 0.40) {
      rareType = 'goldBaser'; // 20%
    } else if (roll < 0.60) {
      rareType = 'pather'; // 20%
    } else if (roll < 0.70) {
      rareType = 'tripleBaser'; // 10%
    } else {
      rareType = 'trainingProbe'; // 30%
    }
    attempts++;
  } while (disablePatherActive && rareType === 'pather' && attempts < 20);

  if (disablePatherActive && rareType === 'pather') {
    rareType = 'doubleBaser';
  }

  return { isRare: true, rareType, isClanned, clanName };
}

/** Position of a wall (tier+level) within one cycle: Wall 1-5 = 0-4, Ultra = 5-9, Mega = 10-14, Power = 15-16, Final = 17 */
export function getWallProgressionPosition(tier: WallTier, level: number): number {
  if (tier === 'wall') return Math.min(4, Math.max(0, level - 1));
  if (tier === 'ultra') return 5 + Math.min(4, Math.max(0, level - 1));
  if (tier === 'mega') return 10 + Math.min(4, Math.max(0, level - 1));
  if (tier === 'power') return 15 + Math.min(1, Math.max(0, level - 1));
  if (tier === 'final') return 17;
  return 0;
}

/**
 * O(1) walk of the wall progression (2.4x faster than the old 18-step loop and works at any size):
 * Wall 1-5 -> Ultra 1-5 -> Mega 1-5 -> Power 1-2 -> Final, then a new cycle with 1.5x the final HP.
 * Exact closed-form formula (no intermediate rounding), so it behaves identically to the loop from
 * cycle 0 onwards yet never overflows: HP stays exact all the way to XRFD and beyond.
 */
export function computeWallFromCount(count: number, rareType: RareProbeType, isClanned: boolean, rankIndex = 0): Wall {
  const wallCycle = Math.floor(count / WALL_CYCLE_STEPS);
  const pos = count >= 0 ? count % WALL_CYCLE_STEPS : 0;
  const tier = CYCLE_STEP_TIERS[pos];
  const level = CYCLE_STEP_LEVELS[pos];

  let maxHp = big(200)
    .mul(CYCLE_STEP_MULTIPLIERS[pos])
    .mul(Decimal.pow(CYCLE_TOTAL_GROWTH, wallCycle))
    .floor();
  let defense = big(CYCLE_STEP_DEFENSE[pos]);

  // SS Governor bonus: harder walls & resists
  const ssLv = isSsRank(rankIndex) ? ssLevel(rankIndex) : 0;
  if (ssLv > 0) {
    maxHp = maxHp.mul(Decimal.pow(SS_WALL_HP_PER_LEVEL, ssLv)).floor();
    defense = defense.mul(Decimal.pow(SS_DEFENSE_PER_LEVEL, ssLv)).floor();
  }

  if (rareType === 'doubleBaser') {
    maxHp = maxHp.mul(2);
    defense = defense.mul(2);
  } else if (rareType === 'tripleBaser') {
    maxHp = maxHp.mul(3);
    defense = defense.mul(3);
  }
  if (isClanned) {
    maxHp = maxHp.mul(3);
  }

  maxHp = maxHp.floor();
  defense = defense.floor();

  const wall: Wall = { tier, level, maxHp, currentHp: new Decimal(maxHp), defense };
  return wall;
}

/**
 * Turret level is derived from the global upgrade counter (level = count + 1), with rare/clan modifiers.
 * The per-level ramp (20 * 1.35^(level-1)) is kept, but the total is multiplied by the same
 * WALL_FINAL_GROWTH_PER_CYCLE factor that walls and shop items use per completed wall cycle
 * (as a Decimal, so turret DPS never overflows to Infinity even at XRFD). */
export function buildTurret(count: number, rareType: RareProbeType, isClanned: boolean, rankIndex = 0): TurretInfo {
  const isGold = rareType === 'goldBaser';
  const wallCycle = Math.floor(count / WALL_CYCLE_STEPS);
  const level = (count % WALL_CYCLE_STEPS) + 1;
  const cycleMultiplier = Decimal.pow(WALL_FINAL_GROWTH_PER_CYCLE, wallCycle);
  const base = getTurretInfo(level, isGold);
  let attackPower: BigNum = big(base.attackPower).mul(cycleMultiplier);
  if (rareType === 'doubleBaser' || rareType === 'goldBaser') {
    attackPower = attackPower.mul(1.5);
  } else if (rareType === 'tripleBaser') {
    attackPower = attackPower.mul(2.0);
  }
  const ssBonus = isSsRank(rankIndex) ? ssLevel(rankIndex) : 0;
  if (ssBonus > 0) {
    attackPower = attackPower.mul(Decimal.pow(SS_TURRET_POWER_PER_LEVEL, ssBonus - 1));
  }
  let countTotal = base.count;
  if (ssBonus > 0) {
    countTotal += SS_TURRET_COUNT_PER_LEVEL * ssBonus;
  }
  if (isClanned) {
    countTotal *= 3;
    attackPower = attackPower.mul(3);
  }
  const turret: TurretInfo = { count: countTotal, level, attackPower: attackPower.floor() };
  return turret;
}

/** Shape of a deserialized (from JSON) saved probe used when rebuilding combat state. */
export interface SavedProbeData {
  upgradeCount?: number;
  wallCycle?: number;
  shopCycle?: number;
  rankIndex?: number;
  rankName?: string;
  probeKills?: number;
  rareType?: RareProbeType;
  isRare?: boolean;
  isClanned?: boolean;
  clanName?: string;
  timeUntilUpgrade?: number;
  ability?: ProbeBase['ability'];
  abilityCooldown?: number;
  hasStartedCombat?: boolean;
  patherWallsRemaining?: number;
  patherRebuildTimer?: number;
  trainingState?: NonNullable<ProbeBase['trainingState']>;
  trainingTimer?: number;
  novaVolleyTimer?: number;
  overdriveLevel?: number;
  wallPhaseTimer?: number;
  wallPhaseInvuln?: number;
  realityDriftCharges?: number;
  wall?: { maxHp?: unknown; currentHp?: unknown; tier?: string; level?: unknown; defense?: unknown };
  turret?: { level?: unknown };
}

/** Coerce a raw saved probe object (from JSON.parse) into the typed SavedProbeData shape. */
export function coerceSavedProbe(raw: unknown): SavedProbeData {
  const pb = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const wall = pb.wall && typeof pb.wall === 'object' ? (pb.wall as Record<string, unknown>) : undefined;
  const turret = pb.turret && typeof pb.turret === 'object' ? (pb.turret as Record<string, unknown>) : undefined;
  return {
    upgradeCount: typeof pb.upgradeCount === 'number' ? (pb.upgradeCount as number) : undefined,
    wallCycle: typeof pb.wallCycle === 'number' ? (pb.wallCycle as number) : undefined,
    shopCycle: typeof pb.shopCycle === 'number' ? (pb.shopCycle as number) : undefined,
    rankIndex: typeof pb.rankIndex === 'number' ? (pb.rankIndex as number) : undefined,
    rankName: typeof pb.rankName === 'string' ? (pb.rankName as string) : undefined,
    probeKills: typeof pb.probeKills === 'number' ? (pb.probeKills as number) : undefined,
    rareType: (pb.rareType as RareProbeType) || undefined,
    isRare: typeof pb.isRare === 'boolean' ? (pb.isRare as boolean) : undefined,
    isClanned: typeof pb.isClanned === 'boolean' ? (pb.isClanned as boolean) : undefined,
    clanName: typeof pb.clanName === 'string' ? (pb.clanName as string) : undefined,
    timeUntilUpgrade: typeof pb.timeUntilUpgrade === 'number' ? (pb.timeUntilUpgrade as number) : undefined,
    ability: (pb.ability as ProbeBase['ability']) || undefined,
    abilityCooldown: typeof pb.abilityCooldown === 'number' ? (pb.abilityCooldown as number) : undefined,
    hasStartedCombat: typeof pb.hasStartedCombat === 'boolean' ? (pb.hasStartedCombat as boolean) : undefined,
    patherWallsRemaining: typeof pb.patherWallsRemaining === 'number' ? (pb.patherWallsRemaining as number) : undefined,
    patherRebuildTimer: typeof pb.patherRebuildTimer === 'number' ? (pb.patherRebuildTimer as number) : undefined,
    trainingState: (pb.trainingState as NonNullable<ProbeBase['trainingState']>) || undefined,
    trainingTimer: typeof pb.trainingTimer === 'number' ? (pb.trainingTimer as number) : undefined,
    novaVolleyTimer: typeof pb.novaVolleyTimer === 'number' ? (pb.novaVolleyTimer as number) : undefined,
    overdriveLevel: typeof pb.overdriveLevel === 'number' ? (pb.overdriveLevel as number) : undefined,
    wallPhaseTimer: typeof pb.wallPhaseTimer === 'number' ? (pb.wallPhaseTimer as number) : undefined,
    wallPhaseInvuln: typeof pb.wallPhaseInvuln === 'number' ? (pb.wallPhaseInvuln as number) : undefined,
    realityDriftCharges: typeof pb.realityDriftCharges === 'number' ? (pb.realityDriftCharges as number) : undefined,
    wall: wall
      ? { maxHp: wall.maxHp, currentHp: wall.currentHp, tier: typeof wall.tier === 'string' ? (wall.tier as string) : undefined, level: wall.level, defense: wall.defense }
      : undefined,
    turret: turret ? { level: turret.level } : undefined,
  };
}

/** Restore the global upgrade counter from a save, migrating legacy saves via their wall position */
export function loadUpgradeCount(pb: SavedProbeData, legacyWallCycle: number): number {
  const legacyCount = typeof pb.upgradeCount === 'number' ? pb.upgradeCount : 0;
  const savedWall = pb.wall;
  if (savedWall && savedWall.tier && typeof savedWall.level === 'number') {
    const pos = getWallProgressionPosition(savedWall.tier as WallTier, savedWall.level);
    return Math.max(legacyCount, pos + WALL_CYCLE_STEPS * legacyWallCycle);
  }
  return legacyCount;
}

/** Deserialize a saved wall object (Decimal fields may be strings from JSON, numbers from legacy saves). */
export function deserializeWall(saved: { maxHp?: unknown; currentHp?: unknown; tier?: string; level?: unknown; defense?: unknown }): Wall {
  const maxHp = desBig(saved?.maxHp, 0);
  const currentHp = desBig(saved?.currentHp, maxHp);
  return {
    tier: (saved?.tier as WallTier) || 'wall',
    level: typeof saved?.level === 'number' ? (saved.level as number) : 1,
    maxHp,
    currentHp,
    defense: desBig(saved?.defense, 0),
  };
}

/** Initialize the SS-tier mechanic state for a probe (flat & serializable). */
export function initSsMechanics(ssLv: number, saved?: SavedProbeData): Pick<ProbeBase, 'ssTier' | 'novaVolleyTimer' | 'overdriveLevel' | 'wallPhaseTimer' | 'wallPhaseInvuln' | 'realityDriftCharges'> {
  const flags = ssLv > 0 ? getTierFlags(ssLv) : null;
  return {
    ssTier: ssLv > 0 ? getRankTier(ssLv) : undefined,
    novaVolleyTimer: flags?.novaVolley ? (typeof saved?.novaVolleyTimer === 'number' ? saved.novaVolleyTimer : 0) : undefined,
    overdriveLevel: flags?.overdrive ? (typeof saved?.overdriveLevel === 'number' ? saved.overdriveLevel : 0) : undefined,
    wallPhaseTimer: flags?.phaseWalls ? (typeof saved?.wallPhaseTimer === 'number' ? saved.wallPhaseTimer : PHASE_WALL_INTERVAL) : undefined,
    wallPhaseInvuln: flags?.phaseWalls ? (typeof saved?.wallPhaseInvuln === 'number' ? saved.wallPhaseInvuln : 0) : undefined,
    realityDriftCharges: flags?.realityDrift ? (typeof saved?.realityDriftCharges === 'number' ? saved.realityDriftCharges : REALITY_DRIFT_MAX_CHARGES) : undefined,
  };
}