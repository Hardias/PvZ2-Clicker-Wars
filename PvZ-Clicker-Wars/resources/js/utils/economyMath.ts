import { MarketState } from '../types/ProbeBase';

// Pure probe-economy math (T8): no reactive state, unit-testable.
// One shared vespene pool drives generator + wall upgrades; minerals come from the market
// (gas exchange) and, from generator level 6 onward, from a depot's trained miners.

// --- Market / minerals ---
export const MINERAL_BUY = {
  amount: 10, // minerals per purchase
  basePrice: 155, // gas
  priceStep: 5, // +5 gas per purchase
  // NOTE (T8): the price escalation is theoretically shared across ALL probes, but the global
  // escalation mechanic is currently ignored — the price lives per-probe on ProbeBase.mineralPrice.
} as const;

export function nextMineralPrice(price: number): number {
  return price + MINERAL_BUY.priceStep;
}

// Market construction states (build/upgrade/sell all take the same time).
export const BUILD_TIME_SECONDS = 4;
export const MARKET_BUILD_COST = 64;
export const UNDERGROUND_MARKET_UPGRADE_COST = 256;

// --- Depot + miners (from generator level 6, dictated T8b) ---
export const DEPOT_BUILD_COST = 256; // 4s build, same timer budget as the market
export const MINER_TRAINING_TIME = BUILD_TIME_SECONDS;
export const MINER_CAP = 15; // total miners per probe
export const LUDICROUS_CAP = 1; // only one Ludicrous miner may exist per probe

export const MINER_TYPES = ['simple', 'average', 'advanced', 'professional', 'master', 'ultra', 'legendary', 'perfect', 'ludicrous'] as const;
export type MinerType = (typeof MINER_TYPES)[number];
export type MinerCounts = Record<MinerType, number>;

/** Ordered weakest -> strongest. Cost in gas; rate in minerals per second (dictated T8b). */
export const MINERS: readonly { type: MinerType; name: string; costGas: number; rate: number }[] = [
  { type: 'simple', name: 'Simple', costGas: 512, rate: 1 / 8 },
  { type: 'average', name: 'Average', costGas: 1024, rate: 1 / 4 },
  { type: 'advanced', name: 'Advance', costGas: 2048, rate: 1 / 2 },
  { type: 'professional', name: 'Professional', costGas: 4096, rate: 1 },
  { type: 'master', name: 'Master', costGas: 15360, rate: 6 },
  { type: 'ultra', name: 'Ultra', costGas: 71680, rate: 36 },
  { type: 'legendary', name: 'Legendary', costGas: 275000, rate: 216 },
  { type: 'perfect', name: 'Perfect', costGas: 1000000, rate: 1296 },
  { type: 'ludicrous', name: 'Ludicrous', costGas: 10000000, rate: 17500 },
];

export type DepotState = 'none' | 'building' | 'built';

/** Index of the Ultra tier in MINERS (anything at or above it counts as "ultra or higher"). */
const ULTRA_TIER_INDEX = MINERS.findIndex((m) => m.type === 'ultra');

/**
 * True once the roster fields a miner of Ultra tier or higher (Ultra/Legendary/Perfect/
 * Ludicrous). From this tier the probe starts weighing automated mines & repositories — the
 * option stays open afterwards regardless of the roster's exact composition.
 */
export function hasUltraTier(counts: MinerCounts): boolean {
  return MINERS.some((m, i) => i >= ULTRA_TIER_INDEX && (counts[m.type] ?? 0) > 0);
}

export function minerDef(type: MinerType) {
  return MINERS.find((m) => m.type === type)!;
}

export function totalMiners(counts: MinerCounts): number {
  return MINER_TYPES.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
}

/** Combined mineral income per second for the probe's current miner roster. */
export function minerRate(counts: MinerCounts): number {
  return MINER_TYPES.reduce((sum, t) => sum + (counts[t] ?? 0) * minerDef(t).rate, 0);
}

/** The worst (weakest) miner type present, or null when the roster is empty. */
export function worstMiner(counts: MinerCounts): MinerType | null {
  for (const def of MINERS) {
    if ((counts[def.type] ?? 0) > 0) return def.type;
  }
  return null;
}

/** Is this miner type allowed to grow further under this probe's roster? */
export function minerSlotAvailable(counts: MinerCounts, type: MinerType, repositories = 0): boolean {
  const present = counts[type] ?? 0;
  if (type === 'ludicrous') return present < LUDICROUS_CAP;
  return totalMiners(counts) < minerCap(repositories);
}

// --- Repository (T8c): raises the miner cap by 5, up to 3 per probe. ---
export const REPOSITORY = { costGas: 5_000_000, capIncrease: 5, max: 3 } as const;

/** Miner cap: 15 base + 5 per repository (max +15). */
export function minerCap(repositories: number): number {
  const reps = Math.max(0, Math.min(repositories, REPOSITORY.max));
  return MINER_CAP + REPOSITORY.capIncrease * reps;
}

/** True when the roster exactly fills the current cap with Perfect + Ludicrous miners only. */
export function rosterPerfected(counts: MinerCounts, cap: number): boolean {
  if (totalMiners(counts) !== cap) return false;
  for (const t of MINER_TYPES) {
    if (t !== 'perfect' && t !== 'ludicrous' && (counts[t] ?? 0) > 0) return false;
  }
  return true;
}

// --- Automated mines (T8c): levels 3-8, buildable independently once an Ultra miner exists ---
export const MINE_LEVELS = [3, 4, 5, 6, 7, 8] as const;
export type MineLevel = (typeof MINE_LEVELS)[number];
export type MineCounts = Record<MineLevel, number>;

export const MINE_CAP_PER_LEVEL = 100; // provisional balance cap
export const MINE_BUILD_TIME = BUILD_TIME_SECONDS;

/** Ordered weakest -> strongest (level, mineral cost, gas/s). Dictated T8c. */
export const MINES: readonly { level: MineLevel; costMinerals: number; rate: number }[] = [
  { level: 3, costMinerals: 1024, rate: 32 },
  { level: 4, costMinerals: 4096, rate: 128 },
  { level: 5, costMinerals: 16384, rate: 512 },
  { level: 6, costMinerals: 65536, rate: 2048 },
  { level: 7, costMinerals: 262144, rate: 8192 },
  { level: 8, costMinerals: 1000000, rate: 32768 },
];

export function mineDef(level: MineLevel) {
  return MINES.find((m) => m.level === level)!;
}

export function emptyMineCounts(): MineCounts {
  return Object.fromEntries(MINE_LEVELS.map((l) => [l, 0])) as MineCounts;
}

/** Combined gas income per second from automated mines. */
export function mineRate(counts: MineCounts): number {
  return MINE_LEVELS.reduce((sum, l) => sum + (counts[l] ?? 0) * mineDef(l).rate, 0);
}

// --- Probe death carry-over ---
// Better probe = slightly better economy: the accumulated pools carry over scaled by 1.1 per rank.
export function probeDeathCarry(value: number): number {
  return Math.floor(value * 1.1);
}

export interface ProbeEconomyState {
  vespene: number;
  minerals: number;
  generatorLevel: number;
  mineralPrice: number;
  marketState: MarketState;
  marketTimer: number;
  undergroundMarketBuilt: boolean;
  depotState: DepotState;
  depotTimer: number;
  minerTrainingType: MinerType | null;
  minerTrainingTimer: number;
  mineralAccum: number;
  minerCounts: MinerCounts;
  // T8c automated mines + repository
  mineCounts: MineCounts;
  mineBuildLevel: MineLevel | null;
  mineBuildTimer: number;
  repositories: number;
}

/** Fresh-economy defaults for a new probe (generator 1, empty pools, no market/depot/miners). */
export function econDefaults(): ProbeEconomyState {
  return {
    vespene: 0,
    minerals: 0,
    generatorLevel: 1,
    mineralPrice: MINERAL_BUY.basePrice,
    marketState: 'none',
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
  };
}

export function emptyMinerCounts(): MinerCounts {
  return Object.fromEntries(MINER_TYPES.map((t) => [t, 0])) as MinerCounts;
}

/** Apply the carry-over scaling to saved pools when a stronger probe spawns (×1.1 per rank). */
export function econCarryOver(from: Pick<ProbeEconomyState, 'vespene' | 'minerals' | 'mineralPrice'>): ProbeEconomyState {
  return {
    ...econDefaults(),
    vespene: probeDeathCarry(from.vespene),
    minerals: probeDeathCarry(from.minerals),
    mineralPrice: from.mineralPrice,
  };
}

// --- Wall upgrade costs ---
// Gas cost of the upgrade at wall-cycle position `pos` (moving pos -> pos + 1):
//   8 * 2^pos  (W1->W2 = 8, W2->W3 = 16, ..., U5->Mega1 = 4096, doubling through Final).
// From the Mega echelon onwards the upgrades ALSO cost minerals:
//   pos 9 (U5->Mega1) = 32, pos 10 (->Mega2) = 64, pos 11 (->Mega3) = 128, doubling through pos 16.
export function wallUpgradeGas(pos: number): number {
  return 8 * Math.pow(2, Math.max(0, pos));
}

export function wallUpgradeMinerals(pos: number): number {
  return pos >= 9 ? Math.pow(2, pos - 4) : 0;
}

export function wallUpgradeCost(pos: number): { gas: number; minerals: number } {
  return { gas: wallUpgradeGas(pos), minerals: wallUpgradeMinerals(pos) };
}

// --- Turret table (dictated T8e): 13 levels, base damage + upgrade costs ---
export const TURRET_MAX_LEVEL = 13;

/**
 * Base turret damage per second per level (index = level; [0] unused).
 * t13 = 524270 dmg/0.2s — stored as display-DPS (×5 = 2.621.350); the actual 0.2s volley is
 * handled by the game loop (`turretDamageThisTick` in useGameLoop.ts).
 */
export const TURRET_DPS: readonly number[] = [0, 1, 2, 4, 8, 16, 32, 64, 128, 400, 700, 40960, 160000, 524270 * 5];

/** Upgrade cost to go FROM level L TO L+1 (row index = source level). t13 has no row: it is max. */
export const TURRET_UPGRADE_COSTS: readonly { toLevel: number; costGas: number; costMinerals: number }[] = [
  { toLevel: 2, costGas: 24, costMinerals: 0 },
  { toLevel: 3, costGas: 32, costMinerals: 0 },
  { toLevel: 4, costGas: 64, costMinerals: 0 },
  { toLevel: 5, costGas: 128, costMinerals: 0 },
  { toLevel: 6, costGas: 256, costMinerals: 0 },
  { toLevel: 7, costGas: 512, costMinerals: 16 },
  { toLevel: 8, costGas: 1024, costMinerals: 32 },
  { toLevel: 9, costGas: 2048, costMinerals: 64 },
  { toLevel: 10, costGas: 4096, costMinerals: 128 },
  { toLevel: 11, costGas: 0, costMinerals: 10240 },
  { toLevel: 12, costGas: 0, costMinerals: 20480 },
  { toLevel: 13, costGas: 1000000, costMinerals: 750000 },
];

/** Base turret damage per second for a turret level (clamped 1..13). */
export function turretDpsForLevel(level: number): number {
  const l = Math.max(1, Math.min(TURRET_MAX_LEVEL, level));
  return TURRET_DPS[l];
}

/**
 * Cost of the next defence upgrade at wall position `pos`.
 * While the turret is still leveling (positions 0-11) the probe pays the new turret table
 * (24 gas ... 1M gas + 750k minerals); once the turret caps at 13 (positions 12+) it reverts
 * to the classic wall cost (8·2^pos gas, minerals from pos 9).
 */
export function defenseUpgradeCost(pos: number): { gas: number; minerals: number } {
  if (pos < TURRET_MAX_LEVEL - 1) {
    const row = TURRET_UPGRADE_COSTS[pos];
    return { gas: row.costGas, minerals: row.costMinerals };
  }
  return wallUpgradeCost(pos);
}

// --- Generator ladder (dictated T8 + T8b, max level 10) ---
export const MAX_GENERATOR_LEVEL = 10;

export type GeneratorRequirement = { kind: 'wall'; wallPos: number } | { kind: 'market' } | { kind: 'undergroundMarket' };

export interface GeneratorUpgradeDef {
  nextLevel: number;
  costGas: number;
  costMinerals: number;
  requirement: GeneratorRequirement;
}

export const GENERATOR_UPGRADES: readonly GeneratorUpgradeDef[] = [
  { nextLevel: 2, costGas: 50, costMinerals: 0, requirement: { kind: 'wall', wallPos: 0 } }, // Wall 1
  { nextLevel: 3, costGas: 100, costMinerals: 0, requirement: { kind: 'wall', wallPos: 3 } }, // Wall 4
  { nextLevel: 4, costGas: 200, costMinerals: 0, requirement: { kind: 'market' } },
  { nextLevel: 5, costGas: 400, costMinerals: 0, requirement: { kind: 'wall', wallPos: 5 } }, // Ultra Wall
  { nextLevel: 6, costGas: 800, costMinerals: 30, requirement: { kind: 'undergroundMarket' } },
  { nextLevel: 7, costGas: 1600, costMinerals: 64, requirement: { kind: 'wall', wallPos: 8 } }, // Ultra Wall 4
  { nextLevel: 8, costGas: 3200, costMinerals: 128, requirement: { kind: 'wall', wallPos: 10 } }, // Mega Wall 1
  { nextLevel: 9, costGas: 6400, costMinerals: 256, requirement: { kind: 'wall', wallPos: 11 } }, // Mega Wall 2
  { nextLevel: 10, costGas: 12800, costMinerals: 512, requirement: { kind: 'wall', wallPos: 12 } }, // Mega Wall 3 (max)
];

/** The upgrade definition for a given CURRENT generator level (1 = the 1->2 upgrade), or undefined at max. */
export function nextGeneratorUpgrade(level: number): GeneratorUpgradeDef | undefined {
  return GENERATOR_UPGRADES.find((u) => u.nextLevel === level + 1);
}

/** Generator vespene production per second (1, 2, 4, 8, ... = 2^(level-1)). */
export function generatorRate(level: number): number {
  return Math.pow(2, Math.max(1, level) - 1);
}

export function generatorRequirementMet(def: GeneratorUpgradeDef, ctx: { wallPos: number; marketState: MarketState; undergroundMarketBuilt: boolean }): boolean {
  const req = def.requirement;
  switch (req.kind) {
    case 'wall':
      return ctx.wallPos >= req.wallPos;
    case 'market':
      return ctx.marketState === 'built' || ctx.marketState === 'upgrading' || ctx.marketState === 'selling';
    case 'undergroundMarket':
      return ctx.undergroundMarketBuilt;
  }
}