import { BigNum } from '../utils/bigNumber';
import { TierId } from '../utils/ranks';

export type WallTier = 'wall' | 'ultra' | 'mega' | 'power' | 'final';

export interface Wall {
  tier: WallTier;
  level: number; // 1-5 for wall/ultra/mega, 1-2 for power, 1 for final
  maxHp: BigNum;
  currentHp: BigNum;
  defense: BigNum;
}

export interface TurretInfo {
  count: number; // 8 normal, 16 for gold baser, scaled for clanned
  level: number; // 1 to 13+
  attackPower: BigNum; // total attack power (Decimal; unbounded across SS tiers)
}

export type RareProbeType = 'doubleBaser' | 'goldBaser' | 'pather' | 'tripleBaser' | 'trainingProbe' | null;

/** Market construction state machine (4s build/upgrade/sell timers in economy math). */
export type MarketState = 'none' | 'building' | 'built' | 'upgrading' | 'selling';

/** Depo bouwen (256g / 4s) vanaf generator level 6; hier worden miners getraind (T8b). */
export type DepotState = 'none' | 'building' | 'built';

export interface ProbeBase {
  rankIndex: number;
  rankName: string;
  probeKills: number;
  upgradeCount: number;
  wallCycle: number;
  shopCycle: number;

  // --- Probe economy (T8): vespene pool + minerals replace the pure upgrade timer ---
  /** Current vespene pool (gas). */
  vespene: number;
  /** Minerals pool (bought at the market; walls/generator upgrades spend these). */
  minerals: number;
  /** Generator level (1 = 1 gas/s; each upgrade doubles production; max 10). */
  generatorLevel: number;
  /** Market mineral price: 155 gas per 10 minerals, +5 after each purchase. */
  mineralPrice: number;
  /** NOTE: mineral price escalation is theoretically shared across ALL probes, but the global escalation mechanic is currently ignored (per-probe price lives here). */
  /** Market build/upgrade/sell state machine. */
  marketState: MarketState;
  /** Seconds remaining on the current market timer (build/upgrade/sell). */
  marketTimer: number;
  /** True once the Underground Market upgrade is done (prereq for generator 5->6). */
  undergroundMarketBuilt: boolean;
  /** Depot build state (unlocked from generator level 6; 256g / 4s). */
  depotState: DepotState;
  /** Seconds remaining while the depot is under construction. */
  depotTimer: number;
  /** Miner tier currently being trained (4s job), or null when idle. */
  minerTrainingType: import('../utils/economyMath').MinerType | null;
  /** Seconds remaining on the current miner training job. */
  minerTrainingTimer: number;
  /** Fractional mineral accumulation from miner harvest (sub-integer remainder). */
  mineralAccum: number;
  /** Trained miner roster (max 15; only 1 Ludicrous). */
  minerCounts: import('../utils/economyMath').MinerCounts;
  /** Automated-mine counts per level (3-8; up to 100 per level, considered from ultra tier). */
  mineCounts: import('../utils/economyMath').MineCounts;
  /** Mine level under construction (4s job), or null when idle. */
  mineBuildLevel: import('../utils/economyMath').MineLevel | null;
  /** Seconds remaining on the current mine build job. */
  mineBuildTimer: number;
  /** Built repositories (+5 miner cap each; max 3). */
  repositories: number;
  wall: Wall;
  turret: TurretInfo;
  ability: 'chrono' | 'voidPrism';
  abilityCooldown: number;
  abilityActiveTimer: number;
  hasStartedCombat: boolean;
  isRare: boolean;
  rareType: RareProbeType;
  isClanned: boolean;
  clanName?: string;
  patherWallsRemaining?: number;
  patherRebuildTimer?: number;
  patherWallsKilledThisSec?: number;
  patherLastSecond?: number;
  trainingState?: 'waiting15' | 'window2' | 'castingVoid' | 'normal';
  trainingTimer?: number;

  // --- SS+ milestone tiers (flat & serializable) ---
  /** Current milestone tier of the probe ('SS' | 'SSS' | 'X' | 'XD' | 'XRD' | 'XRFD'). */
  ssTier?: TierId;
  /** SSS Nova Volley: seconds remaining while turret DPS is boosted. */
  novaVolleyTimer?: number;
  /** X Overdrive: turret DPS ramp-up level while the zealot stays engaged. */
  overdriveLevel?: number;
  /** XD Phase Walls: countdown until the wall phases out. */
  wallPhaseTimer?: number;
  /** XD Phase Walls: seconds of invulnerability remaining. */
  wallPhaseInvuln?: number;
  /** XRD Reality Drift: remaining wall-revive charges. */
  realityDriftCharges?: number;
}