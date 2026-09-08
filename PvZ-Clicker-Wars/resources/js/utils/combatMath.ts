import Decimal from 'break_eternity.js';
import { ProbeBase, Wall, WallTier, TurretInfo, RareProbeType } from '../types/ProbeBase';
import { BigNum, big, desBig } from './bigNumber';
import { isSsRank, ssLevel, getRankTier } from './ranks';
import { DISABLE_PATHER_KEY } from './keys';
import { turretDpsForLevel, TURRET_MAX_LEVEL } from './economyMath';
import {
  WALL_CYCLE_STEPS,
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
  PHASE_WALL_INTERVAL,
  REALITY_DRIFT_MAX_CHARGES,
} from './scaling';

// Pure combat/re-roll math extracted from useCombat. These functions have no
// reactive state and are safe to reuse or unit-test in isolation.

/** Calculate turret info (count, level, attack power) from the dictated T8e table
 *  (t13 = 524270 dmg/0.2s; the displayed DPS is ×5, the volley itself is handled in useGameLoop). */
export function getTurretInfo(level: number, isGold = false): { count: number; level: number; attackPower: number } {
  const count = isGold ? 16 : 8; // Gold baser has double turrets (16)
  const attackPower = turretDpsForLevel(level) * (isGold ? 2 : 1);
  return {
    count,
    level,
    attackPower,
  };
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

  const disablePatherActive = localStorage.getItem(DISABLE_PATHER_KEY) === 'true';

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
 * Turret level follows the wall position 1:1 (level = pos + 1) but caps at 13 — positions 12..17
 * (Mega4..Final) keep a t13 turret. Damage comes from the dictated T8e table, multiplied by
 * rare/gold (×1.5), triple (×2), clan (×3) and SS bonuses. The per-cycle ×4671 growth is
 * DEACTIVATED for turrets (T8e) — it stays in code for walls/shop and is a future rework (tasks.md 🔭).
 */
export function buildTurret(count: number, rareType: RareProbeType, isClanned: boolean, rankIndex = 0): TurretInfo {
  const isGold = rareType === 'goldBaser';
  const pos = count >= 0 ? count % WALL_CYCLE_STEPS : 0;
  const level = Math.min(pos + 1, TURRET_MAX_LEVEL);
  const base = getTurretInfo(level, isGold);
  let attackPower: BigNum = big(base.attackPower);
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
  // T8 probe economy
  vespene?: number;
  minerals?: number;
  generatorLevel?: number;
  mineralPrice?: number;
  marketState?: string;
  marketTimer?: number;
  undergroundMarketBuilt?: boolean;
  // T8b depot + miners
  depotState?: string;
  depotTimer?: number;
  minerTrainingType?: string;
  minerTrainingTimer?: number;
  mineralAccum?: number;
  minerCounts?: Record<string, number>;
  // T8c automated mines + repository
  mineCounts?: Record<string, number>;
  mineBuildLevel?: number;
  mineBuildTimer?: number;
  repositories?: number;
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
    vespene: typeof pb.vespene === 'number' ? (pb.vespene as number) : undefined,
    minerals: typeof pb.minerals === 'number' ? (pb.minerals as number) : undefined,
    generatorLevel: typeof pb.generatorLevel === 'number' ? (pb.generatorLevel as number) : undefined,
    mineralPrice: typeof pb.mineralPrice === 'number' ? (pb.mineralPrice as number) : undefined,
    marketState: typeof pb.marketState === 'string' ? (pb.marketState as string) : undefined,
    marketTimer: typeof pb.marketTimer === 'number' ? (pb.marketTimer as number) : undefined,
    undergroundMarketBuilt: typeof pb.undergroundMarketBuilt === 'boolean' ? (pb.undergroundMarketBuilt as boolean) : undefined,
    depotState: typeof pb.depotState === 'string' ? (pb.depotState as string) : undefined,
    depotTimer: typeof pb.depotTimer === 'number' ? (pb.depotTimer as number) : undefined,
    minerTrainingType: typeof pb.minerTrainingType === 'string' ? (pb.minerTrainingType as string) : undefined,
    minerTrainingTimer: typeof pb.minerTrainingTimer === 'number' ? (pb.minerTrainingTimer as number) : undefined,
    mineralAccum: typeof pb.mineralAccum === 'number' ? (pb.mineralAccum as number) : undefined,
    minerCounts:
      pb.minerCounts && typeof pb.minerCounts === 'object'
        ? Object.fromEntries(
            Object.entries(pb.minerCounts as Record<string, unknown>).filter(([, v]) => typeof v === 'number'),
          ) as Record<string, number>
        : undefined,
    mineCounts:
      pb.mineCounts && typeof pb.mineCounts === 'object'
        ? Object.fromEntries(
            Object.entries(pb.mineCounts as Record<string, unknown>).filter(([, v]) => typeof v === 'number'),
          ) as Record<string, number>
        : undefined,
    mineBuildLevel: typeof pb.mineBuildLevel === 'number' ? (pb.mineBuildLevel as number) : undefined,
    mineBuildTimer: typeof pb.mineBuildTimer === 'number' ? (pb.mineBuildTimer as number) : undefined,
    repositories: typeof pb.repositories === 'number' ? (pb.repositories as number) : undefined,
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